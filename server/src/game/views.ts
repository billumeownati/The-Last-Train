import {
  STATION_COUNT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type ConductorQuestion,
  type GameView,
  type PublicPlayer,
} from '@tlt/shared';
import type { Room } from './room.js';

const QUESTIONS: { id: ConductorQuestion; label: string }[] = [
  { id: 'where', label: 'Where are we going?' },
  { id: 'who', label: 'Who is this person?' },
  { id: 'carriage', label: 'What is in that carriage?' },
  { id: 'board', label: 'Where did I board?' },
];

/**
 * The only function that turns server state into something a client sees.
 * Anything not returned here never leaves the server: other players' roles, goals, lies,
 * clues in hand, the Stowaway's identity, un-revealed ending steps, and the contents of unsearched objects.
 */
export function buildView(room: Room, playerId: string): GameView | null {
  const me = room.player(playerId);
  if (!me) return null;
  const S = room.s;
  const story = room.story;
  const now = room.clock;

  const players: PublicPlayer[] = room.players
    .sort((a, b) => a.joinOrder - b.joinOrder)
    .map((p) => {
      const role = room.roleOf(p);
      const sameCar = p.id === me.id || (p.carriage === me.carriage && !p.moving && !me.moving);
      const out: PublicPlayer = {
        id: p.id,
        name: p.name,
        isHost: p.id === S.hostId,
        connected: p.connected,
        ready: p.ready,
        voiceOn: p.voiceOn,
      };
      if (S.phase !== 'lobby' && role) {
        out.characterId = role.character;
        out.characterName = role.name;
        out.characterTitle = role.title;
        out.carriage = p.moving ? null : p.carriage;
        out.transit = p.moving ? { from: p.moving.from, to: p.moving.to, startedAt: p.moving.startedAt, arriveAt: p.moving.arriveAt } : null;
        out.confined = room.confinedNow(p);
        out.activity = sameCar && p.action ? { ...p.action } : null;
      }
      return out;
    });

  const myCar = me.moving ? null : me.carriage;
  const objects = [...S.objects.values()]
    .filter((o) => !o.hidden)
    .map((o) => ({
      id: o.id,
      carriage: o.carriage,
      label: o.label,
      kind: o.kind as GameView['objects'][number]['kind'],
      slot: o.slot,
      ownerPlayerId: o.ownerPlayerId,
      ...(S.phase !== 'lobby' && myCar === o.carriage ? { searched: o.searched, locked: o.locked, dormant: S.station < o.from } : {}),
    }));

  const role = room.roleOf(me);
  const inGame = S.phase !== 'lobby' && role;

  let dining: GameView['dining'] = null;
  if (S.dining && (S.phase === 'dining' || S.phase === 'roam')) {
    const d = S.dining;
    dining = {
      subphase: d.voting ? 'vote' : 'talk',
      voteStartsAt: d.voteStartsAt,
      prompt: d.prompt,
      options: d.options.map((o) => ({ id: o.id, text: o.text })),
      myVote: me.diningVote,
      voted: room.players.filter((p) => p.connected && p.diningVote !== null).length,
      total: room.players.filter((p) => p.connected).length,
      result: d.result,
    };
    if (S.phase === 'roam') dining = null; // only shown while dinner is on
  }

  const final: GameView['final'] =
    S.phase === 'finalVote'
      ? {
          candidates: room.players
            .sort((a, b) => a.joinOrder - b.joinOrder)
            .map((p) => ({ id: p.id, name: p.name, characterName: room.roleOf(p)?.name ?? p.name })),
          myVote: me.finalVote,
          voted: room.players.filter((p) => p.connected && p.finalVote !== null).length,
          total: room.players.filter((p) => p.connected).length,
        }
      : null;

  const ending: GameView['ending'] =
    S.phase === 'ending' && S.ending
      ? {
          steps: S.ending.steps.slice(0, S.ending.revealed),
          total: S.ending.steps.length,
          done: S.ending.revealed >= S.ending.steps.length,
          nextAt: S.ending.nextAt,
        }
      : null;

  return {
    serverNow: now,
    code: S.code,
    youId: me.id,
    hostId: S.hostId,
    phase: S.phase,
    station: S.station,
    stations: story.stations,
    phaseStartedAt: S.phaseStartedAt,
    phaseEndsAt: S.phaseEndsAt,
    premise: S.premise,
    title: story.meta.title,
    tagline: story.meta.tagline,
    briefingTip: story.meta.briefingTip,
    players,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    canStart: S.phase === 'lobby' && room.players.length >= MIN_PLAYERS && room.players.every((p) => p.connected),
    objects,
    conductor: S.phase === 'roam' || S.phase === 'event' || S.phase === 'dining' || S.phase === 'finalVote' ? { carriage: S.conductor } : null,
    effects: {
      lockedSearch: (['engine', 'observation', 'dining', 'sleepers', 'luggage'] as const).filter((c) => room.searchLocked(c)),
      closed: (['engine', 'observation', 'dining', 'sleepers', 'luggage'] as const).filter((c) => room.isClosed(c)),
      slowWalk: room.walkFactor(),
      slowSearch: room.searchFactor(),
      blackout: room.blackout(),
      lockVision: room.visionLocked(),
      engineUnlocked: S.engineUnlocked,
    },
    event: S.currentEvent && S.phase !== 'lobby' ? { ...S.currentEvent } : null,
    dining,
    final,
    ending,
    me:
      inGame && role
        ? {
            roleId: role.id,
            characterId: role.character,
            characterName: role.name,
            characterTitle: role.title,
            blurb: role.blurb,
            memory: me.memory,
            lie: me.lie,
            goalText: me.goalText,
            goalKind: me.goalKind!,
            stowawayConfirmed: me.stowawayConfirmed,
            truth: me.stowawayConfirmed ? story.stowaway.truth : undefined,
          }
        : null,
    clues: me.clues.map(({ clueRef: _c, ...c }) => c),
    notes: me.notes,
    feed: S.feed.slice(-40),
    chat: S.chat
      .filter((m) => m.audience.has(me.id))
      .slice(-80)
      .map(({ audience: _a, ...m }) => m),
    voiceAllowed: room.voiceAllowed(),
    questionAsked: me.questionStation === S.station,
    visionSeen: me.visionStation === S.station,
    pendingReveal: me.pendingRevealUntil !== null ? { until: me.pendingRevealUntil } : null,
    timing: { searchMs: room.T.search, gazeMs: room.T.gaze, walkMs: room.T.walk },
    conductorQuestions: QUESTIONS,
  };
}

export { STATION_COUNT };
