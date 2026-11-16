import {
  CARRIAGES,
  CARRIAGE_NAMES,
  CHAT_MAX_LEN,
  LUGGAGE_CAPACITY,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROLE_IDS,
  ROLE_REMOVAL_ORDER,
  STATION_COUNT,
  TIMING,
  adjacent,
  carriageIndex,
  cleanName,
  routeBetween,
  type CarriageId,
  type ConductorQuestion,
  type EndingStep,
  type RoleId,
} from '@tlt/shared';
import { renderText, DROPPED, type Story, type StoryEffect, type StoryRole } from '../content.js';
import type {
  ActiveEffect,
  DiningOptionInstance,
  ObjectState,
  PlayerState,
  RoomState,
} from './state.js';
import { newPlayerId, newToken, numberWord, pick, shuffle, type Rng } from './util.js';

export interface RoomDeps {
  story: Story;
  now?: () => number;
  rng?: Rng;
  /** Multiplies every duration. 1 = real time. Use e.g. 0.1 to speed up a playtest. */
  timeScale?: number;
  onChange?: () => void;
  onToast?: (playerId: string, kind: 'info' | 'error', text: string) => void;
}

export type Res<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const okR = <T = undefined>(data?: T): Res<T> => ({ ok: true, data: data as T });
const fail = (error: string): Res<never> => ({ ok: false, error });

export class Room {
  readonly s: RoomState;
  readonly story: Story;
  readonly T;
  private readonly now: () => number;
  private readonly rng: Rng;
  private readonly deps: RoomDeps;
  private idCounter = 1;
  private joinCounter = 0;
  private lastChatAt = new Map<string, number>();
  /** The person who opened the room. If they drop and return, they get host rights back. */
  private founderId = '';
  lastActivityAt: number;

  constructor(code: string, deps: RoomDeps) {
    this.deps = deps;
    this.story = deps.story;
    this.now = deps.now ?? (() => Date.now());
    this.rng = deps.rng ?? Math.random;
    const k = deps.timeScale ?? 1;
    this.T = {
      briefing: TIMING.briefingMs * k,
      roam: TIMING.roamMs * k,
      event: TIMING.eventMs * k,
      dining: TIMING.diningMs * k,
      diningVote: TIMING.diningVoteMs * k,
      finalVote: TIMING.finalVoteMs * k,
      endingStep: TIMING.endingStepMs * k,
      search: TIMING.searchMs * k,
      gaze: TIMING.gazeMs * k,
      walk: TIMING.walkMs * k,
      revealPick: TIMING.revealPickMs * k,
      rejoinGrace: TIMING.rejoinGraceMs * k,
      /** After everyone has voted, keep the ballot open this long so a vote can still be changed. */
      closingWindow: Math.max(1500, 5000 * k),
      /** How long the tally of a dining ballot stays on screen before the train moves on. */
      resultShow: Math.max(1500, 7000 * k),
    };
    this.lastActivityAt = this.now();
    this.s = {
      code,
      hostId: '',
      phase: 'lobby',
      station: 0,
      phaseStartedAt: this.now(),
      phaseEndsAt: 0,
      players: new Map(),
      objects: new Map(),
      clues: new Map(),
      inPlay: new Set(),
      stowawayId: null,
      conductor: 'dining',
      effects: [],
      confines: [],
      engineUnlocked: false,
      skippedLastVote: false,
      currentEvent: null,
      dining: null,
      finalDeadlineExtended: false,
      final: null,
      ending: null,
      feed: [],
      chat: [],
      premise: '',
      legit: null,
    };
  }

  /* ================================================================== */
  /* helpers                                                             */
  /* ================================================================== */

  private changed() {
    this.lastActivityAt = this.now();
    this.deps.onChange?.();
  }

  private toast(playerId: string, kind: 'info' | 'error', text: string) {
    this.deps.onToast?.(playerId, kind, text);
  }

  private id() {
    return this.idCounter++;
  }

  /** The room's clock (real time in production, a fake clock in tests). */
  get clock(): number {
    return this.now();
  }

  get players(): PlayerState[] {
    return [...this.s.players.values()];
  }

  player(id: string): PlayerState | undefined {
    return this.s.players.get(id);
  }

  roleOf(p: PlayerState): StoryRole | undefined {
    return p.roleId ? this.story.roles.find((r) => r.id === p.roleId) : undefined;
  }

  playerByRole(role: RoleId): PlayerState | undefined {
    return this.players.find((p) => p.roleId === role);
  }

  private connected(): PlayerState[] {
    return this.players.filter((p) => p.connected);
  }

  private inGame(): boolean {
    return this.s.phase !== 'lobby';
  }

  private ctxText(extra?: Record<string, string>) {
    return { story: this.story, inPlay: this.s.inPlay, extra };
  }

  private addFeed(kind: 'station' | 'event' | 'vote' | 'reveal' | 'system', text: string) {
    this.s.feed.push({ id: this.id(), at: this.now(), kind, text });
    if (this.s.feed.length > 80) this.s.feed.splice(0, this.s.feed.length - 80);
  }

  private addNote(p: PlayerState, kind: 'hint' | 'vision' | 'conductor' | 'find' | 'system' | 'truth', title: string, text: string) {
    p.notes.push({ id: this.id(), at: this.now(), station: this.s.station, kind, title, text });
  }

  private addChat(
    from: PlayerState | null,
    text: string,
    carriage: CarriageId | 'all',
    audience: Iterable<string>,
    kind: 'chat' | 'reveal' | 'system' = 'chat',
    clue?: { title: string; text: string },
  ) {
    this.s.chat.push({
      id: this.id(),
      at: this.now(),
      fromId: from?.id ?? null,
      fromName: from?.name ?? 'The Conductor',
      text,
      carriage,
      kind,
      clue,
      audience: new Set(audience),
    });
    if (this.s.chat.length > 200) this.s.chat.splice(0, this.s.chat.length - 200);
  }

  private startPhase(phase: RoomState['phase'], durationMs: number) {
    this.s.phase = phase;
    this.s.phaseStartedAt = this.now();
    this.s.phaseEndsAt = durationMs > 0 ? this.now() + durationMs : 0;
    for (const p of this.players) p.ready = false;
  }

  /* ================================================================== */
  /* lobby                                                               */
  /* ================================================================== */

  addPlayer(rawName: string): Res<PlayerState> {
    if (this.s.phase !== 'lobby') return fail('The game has already started. Rejoin with your original name.');
    const name = cleanName(rawName);
    if (name.length < 1) return fail('Pick a name.');
    if (this.players.length >= MAX_PLAYERS) return fail('The train is full (6 passengers).');
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return fail('That name is taken in this room.');
    const p: PlayerState = {
      id: newPlayerId(),
      token: newToken(),
      name,
      joinOrder: this.joinCounter++,
      connected: true,
      disconnectedAt: null,
      voiceOn: false,
      ready: false,
      roleId: null,
      isStowaway: false,
      characterId: null,
      goalKind: null,
      goalTarget: null,
      goalText: '',
      memory: '',
      lie: '',
      carriage: 'sleepers',
      moving: null,
      action: null,
      clues: [],
      notes: [],
      stowawayConfirmed: false,
      questionStation: 0,
      visionStation: 0,
      diningVote: null,
      finalVote: null,
      pendingRevealUntil: null,
    };
    this.s.players.set(p.id, p);
    if (!this.s.hostId) this.s.hostId = p.id;
    if (!this.founderId) this.founderId = p.id;
    this.changed();
    return okR(p);
  }

  findByToken(token: string): PlayerState | undefined {
    return this.players.find((p) => p.token === token);
  }

  findDisconnectedByName(name: string): PlayerState | undefined {
    const n = cleanName(name).toLowerCase();
    return this.players.find((p) => p.name.toLowerCase() === n && !p.connected);
  }

  nameInUse(name: string): boolean {
    const n = cleanName(name).toLowerCase();
    return this.players.some((p) => p.name.toLowerCase() === n);
  }

  setConnected(id: string, connected: boolean) {
    const p = this.player(id);
    if (!p || p.connected === connected) return;
    p.connected = connected;
    if (!connected) {
      p.disconnectedAt = this.now();
      p.voiceOn = false;
      p.ready = false;
      if (this.inGame() && this.s.phase !== 'ending') {
        // The character falls asleep in their cabin.
        p.action = null;
        p.moving = null;
        p.carriage = 'sleepers';
      }
      if (this.s.hostId === id) this.migrateHost();
    } else {
      p.disconnectedAt = null;
      if (id === this.founderId) this.s.hostId = id;
      if (this.s.phase === 'dining' || this.s.phase === 'finalVote') this.gather(p);
    }
    this.changed();
  }

  private migrateHost() {
    const next = this.connected().sort((a, b) => a.joinOrder - b.joinOrder)[0];
    if (next) this.s.hostId = next.id;
  }

  removePlayer(id: string): Res {
    if (this.s.phase !== 'lobby') return fail('Cannot leave a game in progress.');
    if (!this.s.players.delete(id)) return fail('No such player.');
    if (this.founderId === id) this.founderId = '';
    if (this.s.hostId === id) {
      this.s.hostId = '';
      this.migrateHost();
      if (!this.s.hostId) {
        const any = this.players[0];
        if (any) this.s.hostId = any.id;
      }
    }
    this.changed();
    return okR();
  }

  /* ================================================================== */
  /* dealing                                                             */
  /* ================================================================== */

  start(byId: string): Res {
    if (this.s.phase !== 'lobby') return fail('Already started.');
    if (byId !== this.s.hostId) return fail('Only the host can start.');
    const ps = this.players;
    if (ps.length < MIN_PLAYERS) return fail(`Need at least ${MIN_PLAYERS} passengers.`);
    if (ps.length > MAX_PLAYERS) return fail(`At most ${MAX_PLAYERS} passengers.`);
    if (ps.some((p) => !p.connected)) return fail('Someone has disconnected. Wait for them or remove them.');
    this.deal();
    this.startPhase('briefing', this.T.briefing);
    this.s.station = 0;
    this.changed();
    return okR();
  }

  private deal() {
    const ps = shuffle(this.players, this.rng);
    const n = ps.length;
    const inPlay = new Set<RoleId>(ROLE_IDS);
    for (const r of ROLE_REMOVAL_ORDER) {
      if (inPlay.size > n) inPlay.delete(r);
    }
    this.s.inPlay = inPlay;
    const roles = shuffle(
      this.story.roles.filter((r) => inPlay.has(r.id)),
      this.rng,
    );
    const stowaway = ps[Math.floor(this.rng() * n)];
    this.s.stowawayId = stowaway.id;

    ps.forEach((p, i) => {
      const role = roles[i];
      p.roleId = role.id;
      p.characterId = role.character;
      p.isStowaway = p === stowaway;
      p.clues = [];
      p.notes = [];
      p.carriage = 'sleepers';
      p.moving = null;
      p.action = null;
      p.stowawayConfirmed = false;
      p.questionStation = 0;
      p.visionStation = 0;
      p.diningVote = null;
      p.finalVote = null;
      p.pendingRevealUntil = null;
    });

    for (const p of ps) {
      const role = this.roleOf(p)!;
      p.lie = renderText(role.lie, this.ctxText());
      if (p.isStowaway) {
        p.memory = renderText(role.falseMemory, this.ctxText());
        p.goalKind = 'getOff';
        p.goalTarget = null;
        p.goalText = this.story.stowaway.goalText;
      } else {
        p.memory = renderText(role.memory, this.ctxText());
        const g = role.goal;
        const targetOk = !g.target || inPlay.has(g.target);
        if (!targetOk) {
          p.goalKind = 'getOff';
          p.goalTarget = null;
          p.goalText = 'Get off the train.';
        } else {
          p.goalKind = g.kind;
          p.goalTarget = g.target ?? null;
          p.goalText = renderText(g.text, this.ctxText());
        }
      }
    }

    // two confirmed-innocent roles for the engine manifest
    const innocents = shuffle(
      ps.filter((p) => !p.isStowaway),
      this.rng,
    ).slice(0, 2);
    this.s.legit = [this.roleOf(innocents[0])!.name, this.roleOf(innocents[1] ?? innocents[0])!.name];

    this.placeObjectsAndClues();
    const count = numberWord(n);
    const off = numberWord(n - 1);
    this.s.premise = renderText(this.story.meta.premise, this.ctxText({ count, off })) + (n < 6 ? ' ' + this.story.meta.premiseFewer : '');
  }

  private placeObjectsAndClues() {
    const { story } = this;
    const S = this.s;
    S.objects.clear();
    S.clues.clear();
    S.effects = [];
    S.confines = [];
    S.engineUnlocked = false;
    S.skippedLastVote = false;
    S.currentEvent = null;
    S.dining = null;
    S.final = null;
    S.ending = null;
    S.feed = [];
    S.chat = [];
    S.conductor = 'dining';

    for (const o of story.objects) {
      if (o.owner && !S.inPlay.has(o.owner)) continue;
      const owner = o.owner ? this.playerByRole(o.owner) : undefined;
      S.objects.set(o.id, {
        id: o.id,
        carriage: o.carriage,
        label: o.label,
        kind: o.kind,
        slot: o.slot,
        ownerRole: o.owner,
        ownerPlayerId: owner?.id,
        empty: o.empty,
        from: o.from ?? 1,
        locked: !!o.locked,
        hidden: !!o.hidden,
        clueId: null,
        searched: false,
      });
    }

    const extra = { legit1: S.legit![0], legit2: S.legit![1] };
    const live = story.clues.filter((c) => !c.role || S.inPlay.has(c.role)); // dropped role, dropped clues
    const make = (c: (typeof live)[number]) => ({
      id: c.id,
      title: renderText(c.title, this.ctxText(extra)),
      text: renderText(c.text, this.ctxText(extra)),
      type: c.type,
      role: c.role,
      heldBy: null,
    });
    const homeless: typeof live = [];
    for (const c of live) {
      const obj = S.objects.get(c.object);
      if (obj && !obj.clueId) {
        S.clues.set(c.id, make(c));
        obj.clueId = c.id;
      } else homeless.push(c); // its cabin belonged to a dropped role
    }
    for (const c of homeless) {
      const origFrom = story.objects.find((o) => o.id === c.object)?.from ?? 1;
      const obj = this.relocate(c.role, origFrom);
      if (!obj) continue;
      S.clues.set(c.id, make(c));
      obj.clueId = c.id;
    }
  }

  /** A clue's home cabin belonged to a dropped role. Put it in another free cabin (never the owner's own). */
  private relocate(forRole: RoleId | undefined, origFrom: number): ObjectState | undefined {
    const free = [...this.s.objects.values()].filter((o) => !o.clueId && !o.hidden && !o.locked);
    const cabins = free.filter((o) => o.carriage === 'sleepers' && o.ownerRole !== forRole);
    // keep the discovery pace: prefer a home that opens no later than the original one
    const early = cabins.filter((o) => o.from <= origFrom);
    return pick(early.length ? early : cabins, this.rng) ?? pick(free.filter((o) => o.carriage !== 'engine'), this.rng);
  }

  /* ================================================================== */
  /* phase machine                                                       */
  /* ================================================================== */

  /** Called by the server loop (about 4x a second) and by tests after advancing a fake clock. */
  tick() {
    const now = this.now();
    let dirty = false;

    if (this.s.phase === 'lobby') {
      for (const p of this.players) {
        if (!p.connected && p.disconnectedAt !== null && now - p.disconnectedAt > this.T.rejoinGrace) {
          this.s.players.delete(p.id);
          if (this.s.hostId === p.id) this.migrateHost();
          dirty = true;
        }
      }
      if (dirty) this.changed();
      return;
    }

    // movement
    for (const p of this.players) {
      const m = p.moving;
      if (m && now >= m.arriveAt) {
        p.carriage = m.to;
        if (m.rest.length) {
          const next = m.rest[0];
          const dur = this.walkMs();
          p.moving = { from: m.to, to: next, startedAt: m.arriveAt, arriveAt: m.arriveAt + dur, rest: m.rest.slice(1) };
        } else {
          p.moving = null;
        }
        dirty = true;
      }
    }

    // actions (finish in the order they were due)
    const due = this.players.filter((p) => p.action && now >= p.action.endsAt).sort((a, b) => a.action!.endsAt - b.action!.endsAt);
    for (const p of due) {
      this.completeAction(p);
      dirty = true;
    }

    // forced reveal timeouts
    for (const p of this.players) {
      if (p.pendingRevealUntil !== null && (now >= p.pendingRevealUntil || !p.connected)) {
        this.forceRandomReveal(p);
        dirty = true;
      }
    }

    // phase timers
    const S = this.s;
    switch (S.phase) {
      case 'briefing':
        if (now >= S.phaseEndsAt) {
          this.enterRoam(1);
          dirty = true;
        }
        break;
      case 'roam':
        if (now >= S.phaseEndsAt) {
          this.enterEvent();
          dirty = true;
        }
        break;
      case 'event':
        if (now >= S.phaseEndsAt) {
          this.enterDining();
          dirty = true;
        }
        break;
      case 'dining': {
        const d = S.dining;
        if (d && !d.voting && now >= d.voteStartsAt) {
          this.openDiningVote();
          dirty = true;
        } else if (d && d.voting && !d.result && now >= S.phaseEndsAt) {
          // ballot closed: show the tally for a few seconds before dinner ends
          this.resolveDiningVote();
          S.phaseEndsAt = now + this.T.resultShow;
          dirty = true;
        } else if (now >= S.phaseEndsAt) {
          if (S.station >= STATION_COUNT) this.enterFinalVote();
          else this.finishDining();
          dirty = true;
        }
        break;
      }
      case 'finalVote':
        if (now >= S.phaseEndsAt) {
          const lateDisc = this.players.filter((p) => !p.connected && p.disconnectedAt !== null && now - p.disconnectedAt < this.T.rejoinGrace);
          if (lateDisc.length && !S.finalDeadlineExtended) {
            S.finalDeadlineExtended = true;
            S.phaseEndsAt = Math.max(...lateDisc.map((p) => p.disconnectedAt! + this.T.rejoinGrace)) + 500;
          } else {
            this.resolveFinal();
          }
          dirty = true;
        }
        break;
      case 'ending': {
        const e = S.ending;
        if (e && e.revealed < e.steps.length && now >= e.nextAt) {
          e.revealed++;
          e.nextAt = now + this.T.endingStep;
          dirty = true;
        }
        break;
      }
    }

    if (dirty) this.changed();
  }

  /** Everyone connected has pressed Ready. */
  private allReady(): boolean {
    const c = this.connected();
    return c.length > 0 && c.every((p) => p.ready);
  }

  setReady(id: string, ready: boolean): Res {
    const p = this.player(id);
    if (!p) return fail('No such player.');
    const S = this.s;
    if (!['briefing', 'roam', 'event', 'dining'].includes(S.phase)) return fail('Nothing to be ready for.');
    if (S.phase === 'dining' && S.dining?.voting) return fail('The ballot is already open.');
    p.ready = ready;
    if (this.allReady()) {
      switch (S.phase) {
        case 'briefing':
          this.enterRoam(1);
          break;
        case 'roam':
          this.enterEvent();
          break;
        case 'event':
          this.enterDining();
          break;
        case 'dining':
          if (S.station >= STATION_COUNT) this.enterFinalVote();
          else if (S.dining) this.openDiningVote();
          else this.finishDining();
          break;
      }
    }
    this.changed();
    return okR();
  }

  private leavePhase(phase: 'event' | 'roam') {
    const st = this.s.station;
    this.s.effects = this.s.effects.filter((e) => !(e.until !== 'never' && e.until.phase === phase && e.until.station === st));
    if (phase === 'roam') this.s.confines = this.s.confines.filter((c) => !(c.until.station === st));
  }

  private enterRoam(station: number) {
    const S = this.s;
    S.station = station;
    this.startPhase('roam', this.T.roam);
    S.dining = null;
    S.currentEvent = S.currentEvent && S.currentEvent.station === station ? S.currentEvent : null;
    const info = this.story.stations[station - 1];
    this.addFeed('station', `Station ${station} of ${STATION_COUNT}: ${info.name}. ${info.blurb}`);
    S.conductor = this.story.conductor.route[station - 1] ?? 'dining';
    if (this.isClosed(S.conductor)) S.conductor = 'dining';
    for (const p of this.players) {
      p.action = null;
      p.moving = null;
      p.diningVote = null;
      if (station === 1) p.carriage = 'sleepers';
      if (this.confinedNow(p)) {
        p.carriage = 'sleepers';
        this.addNote(p, 'system', 'Confined to your cabin', 'The conductor has locked your door for this leg. You may search only your own cabin.');
      }
    }
    // expel anyone standing in a closed carriage (e.g. engine still locked)
    for (const c of CARRIAGES) if (this.isClosed(c)) this.expel(c);
  }

  private enterEvent() {
    const S = this.s;
    this.leavePhase('roam');
    this.startPhase('event', this.T.event);
    const ev = this.story.events.find((e) => e.station === S.station)!;
    const worse = S.skippedLastVote && ev.worse.effects.length > 0;
    S.skippedLastVote = false;
    const effects: StoryEffect[] = [...ev.effects, ...(worse ? ev.worse.effects : [])];
    const text = ev.text + (worse && ev.worse.text ? ' ' + ev.worse.text : '');
    S.currentEvent = { station: S.station, title: ev.title, text, worse };
    this.addFeed('event', `${ev.title}. ${text}`);
    for (const p of this.players) p.action = null;
    this.applyEffects(effects);
    this.deliverHints();
  }

  private applyEffects(effects: StoryEffect[]) {
    const S = this.s;
    const station = S.station;
    const until = (scope: 'event' | 'event+roam'): ActiveEffect['until'] =>
      scope === 'event' ? { phase: 'event', station } : { phase: 'roam', station: station + 1 };
    for (const eff of effects) {
      switch (eff.type) {
        case 'lockSearch':
        case 'slowWalk':
        case 'slowSearch':
        case 'blackout':
        case 'lockVision':
          S.effects.push({ effect: eff, until: until(eff.scope) });
          break;
        case 'closeCarriage':
          S.effects.push({ effect: eff, until: until(eff.scope) });
          this.expel(eff.carriage);
          break;
        case 'unlockCarriage':
          if (eff.carriage === 'engine') S.engineUnlocked = true;
          break;
        case 'spawnObject': {
          const o = S.objects.get(eff.object);
          if (o) o.hidden = false;
          break;
        }
        case 'confirmStowaway': {
          const sw = S.stowawayId ? this.player(S.stowawayId) : undefined;
          if (sw && !sw.stowawayConfirmed) {
            sw.stowawayConfirmed = true;
            const hint = this.story.stowaway.hints.find((h) => h.confirmation);
            if (hint) this.addNote(sw, 'hint', 'The conductor speaks to you', hint.text);
            this.addNote(sw, 'truth', 'Who you really are', this.story.stowaway.truth);
          }
          break;
        }
      }
    }
  }

  private deliverHints() {
    const S = this.s;
    const hint = this.story.stowaway.hints.find((h) => h.station === S.station);
    if (!hint) return;
    const sw = S.stowawayId ? this.player(S.stowawayId) : undefined;
    if (!hint.confirmation && sw) this.addNote(sw, 'hint', 'A private thought', hint.text);
    const herrings = hint.redHerrings ?? [];
    if (!herrings.length) return;
    const innocents = shuffle(
      this.players.filter((p) => p !== sw && p.connected),
      this.rng,
    );
    let given = 0;
    for (const p of innocents) {
      if (given >= 2) break;
      if (this.rng() < 0.45) {
        this.addNote(p, 'hint', 'A private thought', pick(herrings, this.rng)!);
        given++;
      }
    }
  }

  private enterDining() {
    const S = this.s;
    this.leavePhase('event');
    this.startPhase('dining', this.T.dining);
    S.conductor = 'dining';
    for (const p of this.players) {
      p.action = null;
      this.gather(p);
    }
    if (S.station < STATION_COUNT) {
      const vote = this.story.diningVotes.find((v) => v.station === S.station);
      if (vote) {
        S.dining = {
          prompt: renderText(vote.prompt, this.ctxText()),
          options: this.buildOptions(vote.options),
          voteStartsAt: S.phaseEndsAt - this.T.diningVote,
          voting: false,
          result: null,
        };
      } else {
        S.dining = null;
      }
    } else {
      S.dining = null;
      this.addFeed('system', 'The last supper. When the talking stops, you will vote on who stays aboard.');
    }
    this.addChat(null, 'The conductor takes his place at the head of the dining car.', 'dining', this.players.map((p) => p.id), 'system');
  }

  /** Walk a player to the dining car (used when dinner is called, and when a sleeper reconnects). */
  private gather(p: PlayerState) {
    if (!p.connected) return;
    if (p.moving) {
      p.carriage = p.moving.to;
      p.moving = null;
    }
    const route = routeBetween(p.carriage, 'dining');
    if (route.length) {
      const dur = this.T.walk;
      p.moving = { from: p.carriage, to: route[0], startedAt: this.now(), arriveAt: this.now() + dur, rest: route.slice(1) };
    }
  }

  private buildOptions(opts: import('../content.js').StoryDiningOption[]): DiningOptionInstance[] {
    const out: DiningOptionInstance[] = [];
    const usedTargets = new Set<string>();
    const render = (text: string, p?: PlayerState) =>
      renderText(text, this.ctxText(p ? { target: `${this.roleOf(p)?.name ?? p.name} (${p.name})` } : undefined));
    const randomTarget = (): PlayerState | undefined => {
      const pool = this.players.filter((p) => p.connected && !usedTargets.has(p.id));
      const t = pick(pool.length ? pool : this.connected(), this.rng);
      if (t) usedTargets.add(t.id);
      return t;
    };
    for (const o of opts) {
      if (o.kind === 'openLocked') {
        const obj = this.s.objects.get(o.target ?? '');
        if (!obj || !obj.locked || !obj.clueId) continue;
        out.push({ id: o.id, kind: o.kind, text: render(o.text), targetObject: obj.id });
      } else if (o.kind === 'shiftLuggage') {
        const movable = [...this.s.objects.values()].some((x) => x.carriage === 'luggage' && !x.locked && x.clueId);
        if (!movable) continue;
        out.push({ id: o.id, kind: o.kind, text: render(o.text) });
      } else {
        let t: PlayerState | undefined;
        if (!o.target || o.target === 'random') t = randomTarget();
        else {
          if (!this.s.inPlay.has(o.target as RoleId)) continue;
          t = this.playerByRole(o.target as RoleId);
          if (t) usedTargets.add(t.id);
        }
        if (!t) continue;
        out.push({ id: o.id, kind: o.kind, text: render(o.text, t), targetPlayerId: t.id });
      }
    }
    // never leave fewer than two real choices
    const fallbackKinds = [
      { kind: 'searchSuitcase' as const, text: 'Search the suitcase of {target}. They must show the table what they hold.' },
      { kind: 'confine' as const, text: 'Lock {target} in their cabin for the next leg. They may search only their own cabin.' },
    ];
    let f = 0;
    while (out.length < 2 && f < fallbackKinds.length) {
      const t = randomTarget();
      if (!t) break;
      const fb = fallbackKinds[f++];
      out.push({ id: `f${f}`, kind: fb.kind, text: render(fb.text, t), targetPlayerId: t.id });
    }
    return out;
  }

  private openDiningVote() {
    const S = this.s;
    const d = S.dining;
    if (!d || d.voting) return;
    d.voting = true;
    d.voteStartsAt = this.now();
    S.phaseEndsAt = this.now() + this.T.diningVote;
    for (const p of this.players) p.ready = false;
    this.addChat(null, d.prompt, 'dining', this.players.map((p) => p.id), 'system');
  }

  diningVote(id: string, optionId: string | null): Res {
    const p = this.player(id);
    const d = this.s.dining;
    if (!p || this.s.phase !== 'dining' || !d || !d.voting) return fail('There is no ballot open.');
    if (optionId !== null && optionId !== 'skip' && !d.options.some((o) => o.id === optionId)) return fail('No such option.');
    p.diningVote = optionId;
    const conn = this.connected();
    if (conn.every((x) => x.diningVote !== null)) {
      this.s.phaseEndsAt = Math.min(this.s.phaseEndsAt, this.now() + this.T.closingWindow);
    }
    this.changed();
    return okR();
  }

  /** End of the dining phase for stations 1..4: resolve the ballot and move on. */
  private finishDining() {
    const S = this.s;
    const d = S.dining;
    if (d && !d.result) this.resolveDiningVote();
    this.enterRoam(S.station + 1);
  }

  private resolveDiningVote() {
    const S = this.s;
    const d = S.dining!;
    const counts: Record<string, number> = { skip: 0 };
    for (const o of d.options) counts[o.id] = 0;
    for (const p of this.players) {
      const v = p.diningVote;
      if (v && v in counts) counts[v]++;
    }
    const best = Math.max(...Object.values(counts));
    const top = Object.keys(counts).filter((k) => counts[k] === best);
    const winner = best === 0 ? 'skip' : top.length === 1 ? top[0] : pick(top, this.rng)!;
    const tiedNote = top.length > 1 && best > 0 ? ` ${this.story.conductor.tieBreak}` : '';
    if (winner === 'skip') {
      S.skippedLastVote = true;
      d.result = { counts, winnerId: null, text: `Nobody acted.${best === 0 ? '' : tiedNote} The train will not forget.`, skipped: true };
      this.addFeed('vote', 'The table chose to do nothing. The next stop will be harder for it.');
    } else {
      const opt = d.options.find((o) => o.id === winner)!;
      const text = this.applyDiningOption(opt);
      d.result = { counts, winnerId: winner, text: text + tiedNote, skipped: false };
      this.addFeed('vote', text);
    }
    this.addChat(null, d.result.text, 'dining', this.players.map((p) => p.id), 'system');
  }

  private applyDiningOption(o: DiningOptionInstance): string {
    const S = this.s;
    switch (o.kind) {
      case 'openLocked': {
        const obj = S.objects.get(o.targetObject!);
        if (obj) obj.locked = false;
        return `The conductor forces open the ${obj?.label.toLowerCase() ?? 'lock'}. It can be searched now.`;
      }
      case 'shiftLuggage': {
        const objs = [...S.objects.values()].filter((x) => x.carriage === 'luggage' && !x.locked);
        const clues = objs.filter((x) => x.clueId).map((x) => x.clueId!);
        for (const x of objs) {
          x.clueId = null;
          x.searched = false;
        }
        const homes = shuffle(objs, this.rng);
        // clues that were already found stay found: only unclaimed clues were sitting in objects.
        clues.forEach((cid, i) => (homes[i].clueId = cid));
        return 'The porter shifts the luggage in the van. Everything has landed somewhere new.';
      }
      case 'searchSuitcase': {
        const t = this.player(o.targetPlayerId!);
        if (!t) return 'Nobody to search.';
        const who = `${this.roleOf(t)?.name ?? t.name} (${t.name})`;
        if (!t.clues.length) return `${who}'s suitcase is searched. They hold nothing at all.`;
        t.pendingRevealUntil = this.now() + this.T.revealPick;
        if (!t.connected) this.forceRandomReveal(t);
        return `${who}'s suitcase is searched. They must show the table one clue they hold.`;
      }
      case 'confine': {
        const t = this.player(o.targetPlayerId!);
        if (!t) return 'Nobody to confine.';
        S.confines.push({ playerId: t.id, until: { phase: 'roam', station: S.station + 1 } });
        return `${this.roleOf(t)?.name ?? t.name} (${t.name}) will be locked in their cabin for the next leg.`;
      }
    }
  }

  private enterFinalVote() {
    const S = this.s;
    S.effects = [];
    S.confines = [];
    this.startPhase('finalVote', this.T.finalVote);
    S.finalDeadlineExtended = false;
    S.conductor = 'dining';
    for (const p of this.players) {
      p.action = null;
      p.finalVote = null;
      this.gather(p);
    }
    this.addFeed('system', this.story.finalVote.prompt);
    this.addChat(null, this.story.finalVote.prompt, 'dining', this.players.map((p) => p.id), 'system');
  }

  finalVote(id: string, target: string | null): Res {
    const p = this.player(id);
    if (!p || this.s.phase !== 'finalVote') return fail('There is no ballot open.');
    if (target !== null) {
      if (target === id) return fail('You cannot vote for yourself.');
      if (!this.s.players.has(target)) return fail('No such passenger.');
    }
    p.finalVote = target;
    if (this.connected().every((x) => x.finalVote !== null)) {
      this.s.phaseEndsAt = Math.min(this.s.phaseEndsAt, this.now() + this.T.closingWindow);
    }
    this.changed();
    return okR();
  }

  private resolveFinal() {
    const S = this.s;
    const counts = new Map<string, number>();
    for (const p of this.players) counts.set(p.id, 0);
    for (const p of this.players) {
      if (p.connected && p.finalVote && p.finalVote !== p.id && counts.has(p.finalVote)) counts.set(p.finalVote, counts.get(p.finalVote)! + 1);
    }
    const absent = this.players.filter((p) => !p.connected).map((p) => p.id);
    let left: string[];
    let tied = false;
    if (absent.length) {
      left = absent; // anyone who is not aboard in spirit stays aboard in fact
    } else {
      const best = Math.max(...counts.values());
      const top = [...counts.entries()].filter(([, v]) => v === best).map(([k]) => k);
      tied = top.length > 1;
      left = [tied ? pick(top, this.rng)! : top[0]];
    }
    S.final = { counts, absent, left, tied };
    this.buildEnding();
  }

  private buildEnding() {
    const S = this.s;
    const f = S.final!;
    const leftSet = new Set(f.left);
    const steps: EndingStep[] = [];
    steps.push({
      kind: 'tally',
      counts: this.players
        .map((p) => ({ playerId: p.id, name: p.name, characterName: this.roleOf(p)?.name ?? p.name, votes: f.counts.get(p.id) ?? 0 }))
        .sort((a, b) => b.votes - a.votes),
      absent: f.absent,
    });
    steps.push({
      kind: 'left',
      playerIds: f.left,
      names: f.left.map((id) => `${this.roleOf(this.player(id)!)?.name ?? ''} (${this.player(id)!.name})`),
    });
    const off = shuffle(
      this.players.filter((p) => !leftSet.has(p.id)),
      this.rng,
    );
    const stayed = this.players.filter((p) => leftSet.has(p.id));
    for (const p of [...off, ...stayed]) steps.push(this.playerEnding(p, leftSet));
    const sw = this.player(S.stowawayId!)!;
    steps.push({
      kind: 'truth',
      stowawayId: sw.id,
      stowawayName: sw.name,
      characterName: this.roleOf(sw)?.name ?? sw.name,
      text: this.story.stowaway.reveal.replace('{name}', `${sw.name} (as ${this.roleOf(sw)?.name})`),
    });
    S.ending = { steps, revealed: 1, nextAt: this.now() + this.T.endingStep };
    this.startPhase('ending', 0);
    S.phaseEndsAt = 0;
    for (const p of this.players) {
      p.action = null;
    }
  }

  /** Does this player's goal hold, given who is left behind? */
  evaluateGoal(p: PlayerState, left: Set<string>): boolean {
    if (!p.connected && left.has(p.id)) return false; // absent: stays aboard, cannot win
    const got = !left.has(p.id);
    const target = p.goalTarget ? this.playerByRole(p.goalTarget) : undefined;
    switch (p.goalKind) {
      case 'stayBehind':
        return left.has(p.id);
      case 'leaveBehindStowaway':
        return got && !!this.s.stowawayId && left.has(this.s.stowawayId);
      case 'leaveBehind':
        return got && !!target && left.has(target.id);
      case 'keepTogether':
        return got && !!target && !left.has(target.id);
      case 'getOff':
      default:
        return got;
    }
  }

  private playerEnding(p: PlayerState, left: Set<string>): EndingStep {
    const role = this.roleOf(p)!;
    const gotOff = !left.has(p.id);
    const won = this.evaluateGoal(p, left);
    let lines: string[];
    if (p.isStowaway) {
      lines = gotOff ? this.story.stowaway.epilogues.left : this.story.stowaway.epilogues.stayed;
    } else if (gotOff) {
      lines = won ? role.epilogues.leftWin : role.epilogues.leftLose;
    } else {
      lines = won ? (role.epilogues.stayedWin ?? role.epilogues.stayed) : role.epilogues.stayed;
    }
    return {
      kind: 'player',
      playerId: p.id,
      name: p.name,
      characterName: role.name,
      characterId: role.character,
      gotOff,
      won,
      goalText: p.goalText,
      lines: lines.map((l) => renderText(l, this.ctxText())),
      wasStowaway: p.isStowaway,
    };
  }

  endingNext(id: string): Res {
    const e = this.s.ending;
    if (this.s.phase !== 'ending' || !e) return fail('Not in the ending.');
    if (id !== this.s.hostId) return fail('Only the host can advance.');
    if (e.revealed < e.steps.length) {
      e.revealed++;
      e.nextAt = this.now() + this.T.endingStep;
      this.changed();
    }
    return okR();
  }

  playAgain(id: string): Res {
    if (this.s.phase !== 'ending') return fail('The game is not over.');
    if (id !== this.s.hostId) return fail('Only the host can restart.');
    const S = this.s;
    for (const p of this.players) {
      if (!p.connected) S.players.delete(p.id);
    }
    for (const p of this.players) {
      p.roleId = null;
      p.isStowaway = false;
      p.characterId = null;
      p.goalKind = null;
      p.goalTarget = null;
      p.goalText = '';
      p.memory = '';
      p.lie = '';
      p.carriage = 'sleepers';
      p.moving = null;
      p.action = null;
      p.clues = [];
      p.notes = [];
      p.stowawayConfirmed = false;
      p.questionStation = 0;
      p.visionStation = 0;
      p.diningVote = null;
      p.finalVote = null;
      p.pendingRevealUntil = null;
      p.ready = false;
    }
    S.objects.clear();
    S.clues.clear();
    S.effects = [];
    S.confines = [];
    S.engineUnlocked = false;
    S.stowawayId = null;
    S.dining = null;
    S.final = null;
    S.ending = null;
    S.currentEvent = null;
    S.feed = [];
    S.chat = [];
    S.station = 0;
    S.premise = '';
    this.startPhase('lobby', 0);
    if (!this.s.players.has(S.hostId)) {
      S.hostId = '';
      this.migrateHost();
    }
    this.changed();
    return okR();
  }

  /* ================================================================== */
  /* effects queries                                                     */
  /* ================================================================== */

  private effectsOf<T extends StoryEffect['type']>(type: T): Extract<StoryEffect, { type: T }>[] {
    return this.s.effects.map((e) => e.effect).filter((e): e is Extract<StoryEffect, { type: T }> => e.type === type);
  }

  isClosed(c: CarriageId): boolean {
    if (c === 'engine' && !this.s.engineUnlocked) return true;
    return this.effectsOf('closeCarriage').some((e) => e.carriage === c);
  }

  searchLocked(c: CarriageId): boolean {
    return this.effectsOf('lockSearch').some((e) => e.carriage === c);
  }

  walkFactor(): number {
    return Math.max(1, ...this.effectsOf('slowWalk').map((e) => e.factor));
  }

  searchFactor(): number {
    return Math.max(1, ...this.effectsOf('slowSearch').map((e) => e.factor));
  }

  visionLocked(): boolean {
    return this.effectsOf('lockVision').length > 0;
  }

  blackout(): boolean {
    return this.effectsOf('blackout').length > 0;
  }

  private walkMs(): number {
    return this.T.walk * this.walkFactor();
  }

  confinedNow(p: PlayerState): boolean {
    return this.s.confines.some((c) => c.playerId === p.id && c.until.station === this.s.station) && this.s.phase === 'roam';
  }

  /** Anyone standing in a carriage that just closed is shooed toward the dining car. */
  private expel(c: CarriageId) {
    const idx = carriageIndex(c);
    const toward = CARRIAGES[idx + (idx < carriageIndex('dining') ? 1 : -1)];
    for (const p of this.players) {
      if (p.moving && p.moving.to === c) {
        p.moving = null;
      }
      if (p.carriage === c && !p.moving) {
        p.carriage = toward;
        p.action = null;
      }
    }
  }

  /* ================================================================== */
  /* movement and actions                                                */
  /* ================================================================== */

  private canMoveOrAct(p: PlayerState): Res {
    if (!['roam', 'event'].includes(this.s.phase)) return fail('Not now.');
    if (!p.connected) return fail('You are asleep.');
    return okR();
  }

  move(id: string, to: CarriageId): Res {
    const p = this.player(id);
    if (!p) return fail('No such player.');
    const g = this.canMoveOrAct(p);
    if (!g.ok) return g;
    if (p.moving) return fail('You are already walking.');
    if (this.confinedNow(p)) return fail('Your cabin door is locked.');
    if (!CARRIAGES.includes(to)) return fail('No such carriage.');
    if (!adjacent(p.carriage, to)) return fail('You can only walk to the next carriage.');
    if (to === 'engine' && !this.s.engineUnlocked) return fail('The engine door is locked.');
    if (this.isClosed(to)) return fail(`The ${CARRIAGE_NAMES[to]} is shut.`);
    if (to === 'luggage') {
      const n = this.players.filter((q) => q.id !== p.id && ((q.carriage === 'luggage' && !q.moving) || q.moving?.to === 'luggage')).length;
      if (n >= LUGGAGE_CAPACITY) return fail('The luggage van is full (2 at a time).');
    }
    p.action = null;
    const dur = this.walkMs();
    p.moving = { from: p.carriage, to, startedAt: this.now(), arriveAt: this.now() + dur, rest: [] };
    this.changed();
    return okR();
  }

  act(id: string, objectId: string): Res {
    const p = this.player(id);
    if (!p) return fail('No such player.');
    const g = this.canMoveOrAct(p);
    if (!g.ok) return g;
    if (p.moving) return fail('You are walking.');
    const obj = this.s.objects.get(objectId);
    if (!obj || obj.hidden) return fail('There is nothing like that here.');
    if (obj.carriage !== p.carriage) return fail('That is in another carriage.');
    if (this.isClosed(obj.carriage)) return fail('This carriage is shut.');
    if (this.confinedNow(p) && obj.ownerRole !== p.roleId) return fail('Your door is locked. You may only search your own cabin.');
    if (this.s.station < obj.from) return fail('There is nothing to find here yet. The train remembers more at a later station.');
    const isVision = obj.kind === 'window';
    if (isVision) {
      if (this.visionLocked()) return fail('The glass is frosted over.');
      if (p.visionStation === this.s.station) return fail('You have already seen this station\'s vision.');
    } else {
      if (this.searchLocked(obj.carriage)) return fail('Too dark to search.');
      if (obj.locked) return fail('It is locked.');
      if (obj.searched) return fail('Already searched.');
    }
    const dur = isVision ? this.T.gaze : this.T.search * this.searchFactor();
    p.action = { kind: isVision ? 'gaze' : 'search', objectId, startedAt: this.now(), endsAt: this.now() + dur };
    this.changed();
    return okR();
  }

  cancel(id: string) {
    const p = this.player(id);
    if (p?.action) {
      p.action = null;
      this.changed();
    }
  }

  private completeAction(p: PlayerState) {
    const a = p.action!;
    p.action = null;
    const obj = this.s.objects.get(a.objectId);
    if (!obj) return;
    if (a.kind === 'gaze') {
      p.visionStation = this.s.station;
      this.addNote(p, 'vision', `The viewing glass: ${this.story.stations[this.s.station - 1].name}`, this.story.visions[this.s.station - 1]);
      this.toast(p.id, 'info', 'You see a vision. Check your notes.');
      return;
    }
    if (obj.searched) {
      this.toast(p.id, 'info', 'Someone searched that while you were looking.');
      return;
    }
    if (obj.locked || this.searchLocked(obj.carriage) || this.isClosed(obj.carriage)) {
      this.toast(p.id, 'error', 'You can no longer search that.');
      return;
    }
    obj.searched = true;
    if (obj.clueId) {
      const clue = this.s.clues.get(obj.clueId)!;
      obj.clueId = null;
      clue.heldBy = p.id;
      p.clues.push({
        id: clue.id,
        clueRef: clue.id,
        title: clue.title,
        text: clue.text,
        foundStation: this.s.station,
        source: obj.label + (obj.ownerRole ? ` (${this.cabinOwnerLabel(obj)})` : ''),
        revealed: false,
      });
      this.addNote(p, 'find', `Found: ${clue.title}`, clue.text);
      this.toast(p.id, 'info', `You found something: ${clue.title}`);
    } else {
      this.toast(p.id, 'info', obj.empty);
    }
  }

  private cabinOwnerLabel(obj: ObjectState): string {
    const owner = obj.ownerPlayerId ? this.player(obj.ownerPlayerId) : undefined;
    return owner ? `${this.roleOf(owner)?.name ?? ''}'s cabin` : 'a cabin';
  }

  /* ================================================================== */
  /* the conductor                                                       */
  /* ================================================================== */

  ask(id: string, question: ConductorQuestion, target?: string): Res<string> {
    const p = this.player(id);
    const S = this.s;
    if (!p) return fail('No such player.');
    if (!['roam', 'event', 'dining'].includes(S.phase)) return fail('The conductor is not taking questions.');
    if (p.moving || p.carriage !== S.conductor) return fail(`The conductor is in the ${CARRIAGE_NAMES[S.conductor]}.`);
    if (p.questionStation === S.station) return fail(this.story.conductor.refuse);
    const c = this.story.conductor;
    let text: string;
    let title: string;
    switch (question) {
      case 'where':
        title = 'Where are we going?';
        text = c.where[S.station - 1];
        break;
      case 'carriage': {
        if (!target || !CARRIAGES.includes(target as CarriageId)) return fail('Which carriage?');
        title = `What is in the ${CARRIAGE_NAMES[target as CarriageId]}?`;
        text = c.carriage[target as CarriageId];
        break;
      }
      case 'who': {
        const t = target ? this.player(target) : undefined;
        if (!t || t.id === p.id) return fail('Who do you mean?');
        title = `Who is ${this.roleOf(t)?.name ?? t.name}?`;
        text = `'${this.roleOf(t)!.who}'`;
        break;
      }
      case 'board': {
        title = 'Where did I board?';
        if (p.isStowaway) text = `'${this.story.stowaway.boardAnswer}'`;
        else if (this.rng() < 0.3) text = `'${this.story.stowaway.redHerringBoard}'`;
        else text = `'${this.roleOf(p)!.board}'`;
        break;
      }
      default:
        return fail('Unknown question.');
    }
    p.questionStation = S.station;
    this.addNote(p, 'conductor', title, text);
    this.changed();
    return okR(text);
  }

  /* ================================================================== */
  /* clues and chat                                                      */
  /* ================================================================== */

  reveal(id: string, clueId: string): Res {
    const p = this.player(id);
    if (!p) return fail('No such player.');
    const card = p.clues.find((c) => c.id === clueId);
    if (!card) return fail('You do not hold that clue.');
    const forced = p.pendingRevealUntil !== null;
    if (!forced) {
      if (!['roam', 'event', 'dining', 'finalVote'].includes(this.s.phase)) return fail('Not now.');
      if (p.moving || p.carriage !== 'dining') return fail('You can only show a clue in the Dining Car.');
    }
    this.doReveal(p, card, forced);
    this.changed();
    return okR();
  }

  private doReveal(p: PlayerState, card: PlayerState['clues'][number], forced: boolean) {
    card.revealed = true;
    p.pendingRevealUntil = null;
    const audience = forced ? this.players.map((q) => q.id) : this.players.filter((q) => q.carriage === 'dining' && !q.moving).map((q) => q.id);
    this.addChat(p, forced ? `is forced to show: ${card.title}` : `lays a clue on the table: ${card.title}`, 'dining', audience, 'reveal', {
      title: card.title,
      text: card.text,
    });
    if (forced) this.addFeed('reveal', `${p.name} showed the table: ${card.title}.`);
  }

  private forceRandomReveal(p: PlayerState) {
    const pool = p.clues.filter((c) => !c.revealed);
    const card = pick(pool.length ? pool : p.clues, this.rng);
    p.pendingRevealUntil = null;
    if (card) this.doReveal(p, card, true);
  }

  chat(id: string, raw: string): Res {
    const p = this.player(id);
    if (!p) return fail('No such player.');
    const text = raw.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LEN);
    if (!text) return fail('Empty message.');
    const last = this.lastChatAt.get(id) ?? 0;
    if (this.now() - last < 250) return fail('Slow down.');
    this.lastChatAt.set(id, this.now());
    const S = this.s;
    if (S.phase === 'lobby' || S.phase === 'briefing' || S.phase === 'ending') {
      this.addChat(p, text, 'all', this.players.map((q) => q.id));
    } else {
      if (p.moving) return fail('You are between carriages.');
      if (!p.connected) return fail('You are asleep.');
      const audience = this.players.filter((q) => q.carriage === p.carriage && !q.moving).map((q) => q.id);
      this.addChat(p, text, p.carriage, audience);
    }
    this.changed();
    return okR();
  }

  setVoice(id: string, on: boolean) {
    const p = this.player(id);
    if (!p || p.voiceOn === on) return;
    p.voiceOn = on;
    this.changed();
  }

  voiceAllowed(): boolean {
    return ['lobby', 'briefing', 'dining', 'finalVote', 'ending'].includes(this.s.phase);
  }

  /** Used by tests and the network layer for the room-wide dealing summary. */
  get droppedPhrase() {
    return DROPPED;
  }
}
