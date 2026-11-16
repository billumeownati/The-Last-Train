/**
 * Shared contract between server and client: constants, view types and socket protocol.
 * The server is authoritative. The client only ever sees a `GameView` built for *that* player,
 * so nothing in here may carry information a player is not entitled to see.
 */

/* ------------------------------------------------------------------ */
/* Static layout                                                       */
/* ------------------------------------------------------------------ */

/** Front of the train first. Index distance = number of ~2 s hops between carriages. */
export const CARRIAGES = ['engine', 'observation', 'dining', 'sleepers', 'luggage'] as const;
export type CarriageId = (typeof CARRIAGES)[number];

export const CARRIAGE_NAMES: Record<CarriageId, string> = {
  engine: 'The Engine',
  observation: 'Observation Car',
  dining: 'Dining Car',
  sleepers: 'Sleeper Car',
  luggage: 'Luggage Van',
};

export const ROLE_IDS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type RoleId = (typeof ROLE_IDS)[number];
/** When fewer than six play, roles are dropped in this order (F first, then E). */
export const ROLE_REMOVAL_ORDER: RoleId[] = ['F', 'E'];

export const CHARACTER_IDS = ['fedora', 'cloche', 'bowler', 'flatcap', 'widebrim', 'tophat'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export const STATION_COUNT = 5;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;
export const LUGGAGE_CAPACITY = 2;

export type PhaseId = 'lobby' | 'briefing' | 'roam' | 'event' | 'dining' | 'finalVote' | 'ending';

/** Baseline timings in milliseconds. The server may scale these (TIME_SCALE) for testing. */
export const TIMING = {
  briefingMs: 60_000,
  roamMs: 180_000,
  eventMs: 60_000,
  diningMs: 180_000,
  /** The last slice of the dining phase is the secret ballot. */
  diningVoteMs: 20_000,
  finalVoteMs: 60_000,
  endingStepMs: 9_000,
  searchMs: 5_000,
  gazeMs: 10_000,
  walkMs: 2_000,
  revealPickMs: 30_000,
  rejoinGraceMs: 45_000,
} as const;

export const CHAT_MAX_LEN = 280;
export const NAME_MAX_LEN = 16;
export const ROOM_CODE_LEN = 4;

/* ------------------------------------------------------------------ */
/* Content-facing enums (also used by content/story.json)             */
/* ------------------------------------------------------------------ */

export type ObjectKind =
  | 'trunk'
  | 'crate'
  | 'bag'
  | 'shelf'
  | 'drawer'
  | 'lockbox'
  | 'window'
  | 'lantern'
  | 'cabinet'
  | 'bunk'
  | 'desk'
  | 'coat'
  | 'device';

export type GoalKind = 'getOff' | 'leaveBehindStowaway' | 'leaveBehind' | 'keepTogether' | 'stayBehind';

export type DiningOptionKind = 'openLocked' | 'searchSuitcase' | 'shiftLuggage' | 'confine';

export type ConductorQuestion = 'where' | 'who' | 'carriage' | 'board';

/* ------------------------------------------------------------------ */
/* Views sent to clients                                               */
/* ------------------------------------------------------------------ */

export interface StationInfo {
  id: string;
  name: string;
  theme: 'forest' | 'flood' | 'burning' | 'snow' | 'dark';
  blurb: string;
}

export interface ActivityView {
  kind: 'search' | 'gaze';
  objectId: string;
  startedAt: number;
  endsAt: number;
}

export interface TransitView {
  from: CarriageId;
  to: CarriageId;
  startedAt: number;
  arriveAt: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
  voiceOn: boolean;
  /** Present once roles are dealt. Characters are public (the avatar is the character). */
  characterId?: CharacterId;
  characterName?: string;
  characterTitle?: string;
  /** Where the avatar is. `null` carriage means walking (see `transit`). */
  carriage?: CarriageId | null;
  transit?: TransitView | null;
  /** Only filled in for players in the viewer's own carriage (and for the viewer). */
  activity?: ActivityView | null;
  confined?: boolean;
}

export interface ObjectView {
  id: string;
  carriage: CarriageId;
  label: string;
  kind: ObjectKind;
  slot: number;
  /** Cabin objects belong to a player. */
  ownerPlayerId?: string;
  /** Dynamic state: only provided for the carriage the viewer is standing in. */
  searched?: boolean;
  locked?: boolean;
  /** Too early to search: the train has not remembered this yet. */
  dormant?: boolean;
}

export interface ClueCard {
  id: string;
  title: string;
  text: string;
  foundStation: number;
  source: string;
  revealed: boolean;
}

export interface NoteView {
  id: number;
  at: number;
  station: number;
  kind: 'hint' | 'vision' | 'conductor' | 'find' | 'system' | 'truth';
  title: string;
  text: string;
}

export interface FeedItem {
  id: number;
  at: number;
  kind: 'station' | 'event' | 'vote' | 'reveal' | 'system';
  text: string;
}

export interface ChatMessage {
  id: number;
  at: number;
  fromId: string | null;
  fromName: string;
  text: string;
  carriage: CarriageId | 'all';
  kind: 'chat' | 'reveal' | 'system';
  clue?: { title: string; text: string };
}

export interface MyCard {
  roleId: RoleId;
  characterId: CharacterId;
  characterName: string;
  characterTitle: string;
  blurb: string;
  memory: string;
  lie: string;
  goalText: string;
  goalKind: GoalKind;
  /** Only once the conductor has confirmed it to the Stowaway (station 4). */
  stowawayConfirmed: boolean;
  truth?: string;
}

export interface ConductorState {
  carriage: CarriageId;
}

export interface ActiveEffects {
  lockedSearch: CarriageId[];
  closed: CarriageId[];
  slowWalk: number;
  slowSearch: number;
  blackout: boolean;
  lockVision: boolean;
  engineUnlocked: boolean;
}

export interface EventView {
  station: number;
  title: string;
  text: string;
  worse: boolean;
}

export interface DiningView {
  subphase: 'talk' | 'vote';
  voteStartsAt: number;
  prompt: string;
  options: { id: string; text: string }[];
  myVote: string | null;
  voted: number;
  total: number;
  result: null | {
    counts: Record<string, number>;
    winnerId: string | null;
    text: string;
    skipped: boolean;
  };
}

export interface FinalVoteView {
  candidates: { id: string; name: string; characterName: string }[];
  myVote: string | null;
  voted: number;
  total: number;
}

export type EndingStep =
  | { kind: 'tally'; counts: { playerId: string; name: string; characterName: string; votes: number }[]; absent: string[] }
  | { kind: 'left'; playerIds: string[]; names: string[] }
  | {
      kind: 'player';
      playerId: string;
      name: string;
      characterName: string;
      characterId: CharacterId;
      gotOff: boolean;
      won: boolean;
      goalText: string;
      lines: string[];
      wasStowaway: boolean;
    }
  | { kind: 'truth'; stowawayId: string; stowawayName: string; characterName: string; text: string };

export interface EndingView {
  /** Steps revealed so far. The server never sends future steps. */
  steps: EndingStep[];
  total: number;
  done: boolean;
  nextAt: number;
}

export interface GameView {
  serverNow: number;
  code: string;
  youId: string;
  hostId: string;
  phase: PhaseId;
  station: number;
  stations: StationInfo[];
  phaseStartedAt: number;
  phaseEndsAt: number;
  premise: string;
  title: string;
  tagline: string;
  briefingTip: string;
  players: PublicPlayer[];
  minPlayers: number;
  maxPlayers: number;
  canStart: boolean;
  objects: ObjectView[];
  conductor: ConductorState | null;
  effects: ActiveEffects;
  event: EventView | null;
  dining: DiningView | null;
  final: FinalVoteView | null;
  ending: EndingView | null;
  me: MyCard | null;
  clues: ClueCard[];
  notes: NoteView[];
  feed: FeedItem[];
  chat: ChatMessage[];
  voiceAllowed: boolean;
  questionAsked: boolean;
  visionSeen: boolean;
  /** Set when a search of your suitcase forced you to reveal a clue. */
  pendingReveal: { until: number } | null;
  timing: { searchMs: number; gazeMs: number; walkMs: number };
  /** Conductor menu: carriage names are fixed, the rest come from the story file. */
  conductorQuestions: { id: ConductorQuestion; label: string }[];
}

/* ------------------------------------------------------------------ */
/* Socket protocol                                                     */
/* ------------------------------------------------------------------ */

export interface Ack<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface JoinResult {
  code: string;
  playerId: string;
  token: string;
}

export interface ClientToServer {
  'room:create': (p: { name: string }, cb: (r: Ack<JoinResult>) => void) => void;
  'room:join': (p: { code: string; name: string }, cb: (r: Ack<JoinResult>) => void) => void;
  'room:rejoin': (p: { code: string; token: string }, cb: (r: Ack<JoinResult>) => void) => void;
  'room:leave': () => void;
  'room:kick': (p: { playerId: string }) => void;
  'game:start': (cb: (r: Ack) => void) => void;
  'game:ready': (p: { ready: boolean }) => void;
  'game:move': (p: { to: CarriageId }, cb: (r: Ack) => void) => void;
  'game:act': (p: { objectId: string }, cb: (r: Ack) => void) => void;
  'game:cancel': () => void;
  'game:ask': (p: { question: ConductorQuestion; target?: string }, cb: (r: Ack) => void) => void;
  'game:reveal': (p: { clueId: string }, cb: (r: Ack) => void) => void;
  'game:diningVote': (p: { optionId: string | null }) => void;
  'game:finalVote': (p: { playerId: string | null }) => void;
  'game:endingNext': () => void;
  'game:playAgain': () => void;
  'chat:send': (p: { text: string }) => void;
  'voice:join': (p: { on: boolean }) => void;
  'voice:signal': (p: { to: string; data: unknown }) => void;
}

export interface ServerToClient {
  state: (v: GameView) => void;
  'voice:signal': (p: { from: string; data: unknown }) => void;
  'toast': (p: { kind: 'info' | 'error'; text: string }) => void;
  kicked: () => void;
}

/* ------------------------------------------------------------------ */
/* Small helpers shared by both sides                                  */
/* ------------------------------------------------------------------ */

export function carriageIndex(c: CarriageId): number {
  return CARRIAGES.indexOf(c);
}

export function adjacent(a: CarriageId, b: CarriageId): boolean {
  return Math.abs(carriageIndex(a) - carriageIndex(b)) === 1;
}

/** Shortest walk (carriage ids after `from`, ending at `to`). */
export function routeBetween(from: CarriageId, to: CarriageId): CarriageId[] {
  const i = carriageIndex(from);
  const j = carriageIndex(to);
  const out: CarriageId[] = [];
  const step = j > i ? 1 : -1;
  for (let k = i + step; k !== j + step && out.length < 10; k += step) out.push(CARRIAGES[k]);
  return i === j ? [] : out;
}

export function normaliseCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LEN);
}

export function cleanName(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LEN);
}
