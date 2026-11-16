import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARRIAGES,
  CHARACTER_IDS,
  ROLE_IDS,
  STATION_COUNT,
  type CarriageId,
  type CharacterId,
  type DiningOptionKind,
  type GoalKind,
  type ObjectKind,
  type RoleId,
  type StationInfo,
} from '@tlt/shared';

/* ------------------------------------------------------------------ */
/* Story file shape (content/story.json)                               */
/* ------------------------------------------------------------------ */

export interface StoryGoal {
  kind: GoalKind;
  target?: RoleId;
  text: string;
}

export interface StoryRole {
  id: RoleId;
  character: CharacterId;
  name: string;
  short: string;
  title: string;
  blurb: string;
  memory: string;
  falseMemory: string;
  lie: string;
  goal: StoryGoal;
  board: string;
  who: string;
  epilogues: {
    leftWin: string[];
    leftLose: string[];
    stayed: string[];
    stayedWin?: string[];
  };
}

export interface StoryHint {
  station: number;
  text: string;
  confirmation?: boolean;
  redHerrings?: string[];
}

export interface StoryObject {
  id: string;
  carriage: CarriageId;
  label: string;
  kind: ObjectKind;
  slot: number;
  /** Station (1-5) from which this can be searched. Spreads discoveries over the whole journey. Default 1. */
  from?: number;
  owner?: RoleId;
  locked?: boolean;
  hidden?: boolean;
  empty: string;
}

export type ClueType = 'lie' | 'memory' | 'truth' | 'engine' | 'event';

export interface StoryClue {
  id: string;
  type: ClueType;
  role?: RoleId;
  object: string;
  title: string;
  text: string;
}

export type EffectScope = 'event' | 'event+roam';

export type StoryEffect =
  | { type: 'lockSearch'; carriage: CarriageId; scope: EffectScope }
  | { type: 'closeCarriage'; carriage: CarriageId; scope: EffectScope }
  | { type: 'unlockCarriage'; carriage: CarriageId }
  | { type: 'spawnObject'; object: string }
  | { type: 'slowWalk'; factor: number; scope: EffectScope }
  | { type: 'slowSearch'; factor: number; scope: EffectScope }
  | { type: 'blackout'; scope: EffectScope }
  | { type: 'lockVision'; scope: EffectScope }
  | { type: 'confirmStowaway' };

export interface StoryEvent {
  station: number;
  title: string;
  text: string;
  effects: StoryEffect[];
  worse: { text: string; effects: StoryEffect[] };
}

export interface StoryDiningOption {
  id: string;
  kind: DiningOptionKind;
  /** Role id, object id, or 'random', depending on `kind`. */
  target?: string;
  text: string;
}

export interface StoryDiningVote {
  station: number;
  prompt: string;
  options: StoryDiningOption[];
}

export interface Story {
  meta: {
    title: string;
    tagline: string;
    premise: string;
    premiseFewer: string;
    briefingTip: string;
  };
  stations: StationInfo[];
  roles: StoryRole[];
  stowaway: {
    goalText: string;
    truth: string;
    boardAnswer: string;
    redHerringBoard: string;
    hints: StoryHint[];
    epilogues: { left: string[]; stayed: string[] };
    reveal: string;
  };
  objects: StoryObject[];
  clues: StoryClue[];
  events: StoryEvent[];
  visions: string[];
  conductor: {
    route: CarriageId[];
    intro: string;
    refuse: string;
    where: string[];
    carriage: Record<CarriageId, string>;
    tieBreak: string;
  };
  diningVotes: StoryDiningVote[];
  finalVote: { prompt: string; tieBreakText: string };
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

const here = dirname(fileURLToPath(import.meta.url));

export function defaultStoryPath(): string {
  return process.env.STORY_PATH ? resolve(process.env.STORY_PATH) : resolve(here, '../../content/story.json');
}

export function loadStory(path = defaultStoryPath()): Story {
  const raw = readFileSync(path, 'utf8');
  const story = JSON.parse(raw) as Story;
  const problems = validateStory(story);
  const errors = problems.filter((p) => p.level === 'error');
  if (errors.length) {
    throw new Error(`story.json is invalid:\n${errors.map((e) => ' - ' + e.message).join('\n')}`);
  }
  return story;
}

/* ------------------------------------------------------------------ */
/* Text templating                                                     */
/* ------------------------------------------------------------------ */

export const DROPPED = 'a passenger who got off at an earlier stop';

export interface TextContext {
  story: Story;
  inPlay: Set<RoleId>;
  extra?: Record<string, string>;
}

/**
 * Replaces `{A}` / `{A:short}` role references with the character name, or with the
 * "got off at an earlier stop" phrase when that role is not in play. `{key}` pulls from `extra`.
 */
export function renderText(tpl: string, ctx: TextContext): string {
  const out = tpl.replace(/\{([A-F])(?::(short))?\}/g, (_m, id: RoleId, short?: string) => {
    if (!ctx.inPlay.has(id)) return DROPPED;
    const role = ctx.story.roles.find((r) => r.id === id);
    if (!role) return DROPPED;
    return short ? role.short : role.name;
  }).replace(/\{(\w+)\}/g, (m, key: string) => (ctx.extra && key in ctx.extra ? ctx.extra[key] : m));
  return out.replace(/(^|[.!?]['"]?\s+)a passenger who got off/g, (_m, pre: string) => `${pre}A passenger who got off`);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface Problem {
  level: 'error' | 'warn';
  message: string;
}

export function validateStory(s: Story): Problem[] {
  const out: Problem[] = [];
  const err = (message: string) => out.push({ level: 'error', message });
  const warn = (message: string) => out.push({ level: 'warn', message });

  if (!s.stations || s.stations.length !== STATION_COUNT) err(`stations: need exactly ${STATION_COUNT}`);
  if (!s.visions || s.visions.length !== STATION_COUNT) err(`visions: need exactly ${STATION_COUNT}`);
  if (!s.conductor?.where || s.conductor.where.length !== STATION_COUNT) err(`conductor.where: need exactly ${STATION_COUNT}`);
  if (!s.conductor?.route || s.conductor.route.length !== STATION_COUNT) err(`conductor.route: need exactly ${STATION_COUNT}`);
  for (const c of s.conductor?.route ?? []) if (!CARRIAGES.includes(c)) err(`conductor.route: unknown carriage ${c}`);
  for (const c of CARRIAGES) if (!s.conductor?.carriage?.[c]) err(`conductor.carriage.${c} missing`);

  const roleIds = new Set<string>();
  const chars = new Set<string>();
  for (const r of s.roles ?? []) {
    if (!ROLE_IDS.includes(r.id)) err(`role ${r.id}: unknown id`);
    if (roleIds.has(r.id)) err(`role ${r.id}: duplicate`);
    roleIds.add(r.id);
    if (!CHARACTER_IDS.includes(r.character)) err(`role ${r.id}: unknown character ${r.character}`);
    if (chars.has(r.character)) err(`role ${r.id}: character ${r.character} used twice`);
    chars.add(r.character);
    for (const k of ['name', 'short', 'title', 'blurb', 'memory', 'falseMemory', 'lie', 'board', 'who'] as const) {
      if (!r[k]) err(`role ${r.id}: missing ${k}`);
    }
    if (!r.goal?.text) err(`role ${r.id}: missing goal.text`);
    if (r.goal && (r.goal.kind === 'leaveBehind' || r.goal.kind === 'keepTogether')) {
      if (!r.goal.target || !ROLE_IDS.includes(r.goal.target)) err(`role ${r.id}: goal ${r.goal.kind} needs a valid target`);
      if (r.goal.target === r.id) err(`role ${r.id}: goal targets itself`);
    }
    const ep = r.epilogues;
    for (const k of ['leftWin', 'leftLose', 'stayed'] as const) {
      if (!ep?.[k] || ep[k].length < 1) err(`role ${r.id}: epilogues.${k} needs at least one line`);
    }
    if (r.goal?.kind === 'stayBehind' && !ep?.stayedWin) warn(`role ${r.id}: stayBehind goal without epilogues.stayedWin`);
    if (r.memory === r.falseMemory) err(`role ${r.id}: memory equals falseMemory`);
  }
  for (const id of ROLE_IDS) if (!roleIds.has(id)) err(`roles: role ${id} missing (the game needs all six)`);
  for (const id of ['A', 'B', 'C', 'D'] as RoleId[]) {
    const r = s.roles?.find((x) => x.id === id);
    if (r?.goal.target && ['E', 'F'].includes(r.goal.target)) {
      warn(`role ${id}: targets droppable role ${r.goal.target}; it will fall back to 'getOff' in 4-5 player games`);
    }
  }

  const objIds = new Set<string>();
  for (const o of s.objects ?? []) {
    if (objIds.has(o.id)) err(`object ${o.id}: duplicate`);
    objIds.add(o.id);
    if (!CARRIAGES.includes(o.carriage)) err(`object ${o.id}: unknown carriage`);
    if (o.owner && !ROLE_IDS.includes(o.owner)) err(`object ${o.id}: unknown owner`);
    if (o.carriage === 'sleepers' && !o.owner) err(`object ${o.id}: sleeper objects need an owner`);
    if (!o.empty) err(`object ${o.id}: missing 'empty' text`);
    if (o.from !== undefined && (!Number.isInteger(o.from) || o.from < 1 || o.from > STATION_COUNT)) err(`object ${o.id}: 'from' must be a station 1-${STATION_COUNT}`);
  }
  const clueIds = new Set<string>();
  const clueObj = new Map<string, string>();
  for (const c of s.clues ?? []) {
    if (clueIds.has(c.id)) err(`clue ${c.id}: duplicate`);
    clueIds.add(c.id);
    if (!objIds.has(c.object)) err(`clue ${c.id}: unknown object ${c.object}`);
    if ((c.type === 'lie' || c.type === 'memory') && !c.role) err(`clue ${c.id}: ${c.type} clue needs a role`);
    if (clueObj.has(c.object)) err(`clue ${c.id}: object ${c.object} already holds clue ${clueObj.get(c.object)}`);
    clueObj.set(c.object, c.id);
    for (const m of (c.text + c.title).matchAll(/\{(\w+)(?::\w+)?\}/g)) {
      if (!/^[A-F]$/.test(m[1]) && !['legit1', 'legit2'].includes(m[1])) err(`clue ${c.id}: unknown placeholder {${m[1]}}`);
    }
  }
  for (const r of s.roles ?? []) {
    const lies = (s.clues ?? []).filter((c) => c.type === 'lie' && c.role === r.id);
    if (lies.length < 2) warn(`role ${r.id}: only ${lies.length} lie clue(s); the design calls for 2`);
    if (!(s.clues ?? []).some((c) => c.type === 'memory' && c.role === r.id)) warn(`role ${r.id}: no memory clue to disprove a false memory`);
  }
  for (const o of s.objects ?? []) {
    if (o.locked && !clueObj.has(o.id)) warn(`object ${o.id}: locked but holds no clue`);
  }

  const evSt = new Set<number>();
  for (const e of s.events ?? []) {
    evSt.add(e.station);
    for (const eff of [...e.effects, ...(e.worse?.effects ?? [])]) {
      if (eff.type === 'spawnObject' && !objIds.has(eff.object)) err(`event ${e.station}: spawnObject unknown ${eff.object}`);
    }
  }
  for (let i = 1; i <= STATION_COUNT; i++) if (!evSt.has(i)) err(`events: station ${i} missing`);

  const hintSt = new Set((s.stowaway?.hints ?? []).map((h) => h.station));
  for (let i = 1; i <= STATION_COUNT; i++) if (!hintSt.has(i)) warn(`stowaway.hints: station ${i} has no hint`);
  if (!(s.stowaway?.hints ?? []).some((h) => h.confirmation)) warn('stowaway.hints: no confirmation hint');

  for (const v of s.diningVotes ?? []) {
    if (v.station < 1 || v.station >= STATION_COUNT) err(`diningVotes: station ${v.station} out of range (1-${STATION_COUNT - 1})`);
    if (v.options.length < 2) err(`diningVotes ${v.station}: need at least 2 options`);
    for (const o of v.options) {
      if (o.kind === 'openLocked') {
        const t = s.objects.find((x) => x.id === o.target);
        if (!t) err(`diningVotes ${v.station}/${o.id}: openLocked target ${o.target} unknown`);
        else if (!t.locked) err(`diningVotes ${v.station}/${o.id}: ${o.target} is not locked`);
      }
      if ((o.kind === 'searchSuitcase' || o.kind === 'confine') && o.target && o.target !== 'random' && !ROLE_IDS.includes(o.target as RoleId)) {
        err(`diningVotes ${v.station}/${o.id}: target must be a role id or 'random'`);
      }
    }
  }
  for (let i = 1; i < STATION_COUNT; i++) if (!(s.diningVotes ?? []).some((v) => v.station === i)) warn(`diningVotes: station ${i} has no vote`);

  return out;
}
