import type {
  CarriageId,
  CharacterId,
  ClueCard,
  ChatMessage,
  DiningOptionKind,
  EndingStep,
  FeedItem,
  GoalKind,
  NoteView,
  PhaseId,
  RoleId,
} from '@tlt/shared';
import type { StoryEffect } from '../content.js';

export interface Moving {
  from: CarriageId;
  to: CarriageId;
  startedAt: number;
  arriveAt: number;
  /** Carriages still to walk after `to` (used when everyone is called to dinner). */
  rest: CarriageId[];
}

export interface Action {
  kind: 'search' | 'gaze';
  objectId: string;
  startedAt: number;
  endsAt: number;
}

export interface PlayerState {
  id: string;
  token: string;
  name: string;
  joinOrder: number;
  connected: boolean;
  disconnectedAt: number | null;
  voiceOn: boolean;
  ready: boolean;

  /* dealt at game start */
  roleId: RoleId | null;
  isStowaway: boolean;
  characterId: CharacterId | null;
  goalKind: GoalKind | null;
  goalTarget: RoleId | null;
  goalText: string;
  memory: string;
  lie: string;

  /* position and activity */
  carriage: CarriageId;
  moving: Moving | null;
  action: Action | null;

  /* knowledge */
  clues: (ClueCard & { clueRef: string })[];
  notes: NoteView[];
  stowawayConfirmed: boolean;
  questionStation: number;
  visionStation: number;

  /* votes */
  diningVote: string | null;
  finalVote: string | null;
  pendingRevealUntil: number | null;
}

export interface ObjectState {
  id: string;
  carriage: CarriageId;
  label: string;
  kind: string;
  slot: number;
  ownerRole?: RoleId;
  ownerPlayerId?: string;
  empty: string;
  /** First station at which it can be searched. */
  from: number;
  /** Needs a dining vote to open. */
  locked: boolean;
  /** Spawned by an event. */
  hidden: boolean;
  /** The clue currently hidden here, if any. */
  clueId: string | null;
  searched: boolean;
}

export interface ClueInstance {
  id: string;
  title: string;
  text: string;
  type: string;
  role?: RoleId;
  /** Which player holds it (once found). */
  heldBy: string | null;
}

export interface ActiveEffect {
  effect: StoryEffect;
  /** The effect is dropped when this phase of this station ends. */
  until: { phase: 'event' | 'roam'; station: number } | 'never';
}

export interface ConfineEffect {
  playerId: string;
  until: { phase: 'roam'; station: number };
}

export interface DiningOptionInstance {
  id: string;
  kind: DiningOptionKind;
  text: string;
  targetObject?: string;
  targetPlayerId?: string;
}

export interface DiningState {
  prompt: string;
  options: DiningOptionInstance[];
  voteStartsAt: number;
  voting: boolean;
  result: null | { counts: Record<string, number>; winnerId: string | null; text: string; skipped: boolean };
}

export interface FinalResult {
  counts: Map<string, number>;
  absent: string[];
  left: string[];
  tied: boolean;
}

export interface EndingState {
  steps: EndingStep[];
  revealed: number;
  nextAt: number;
}

export interface ChatRecord extends ChatMessage {
  audience: Set<string>;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: PhaseId;
  station: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
  players: Map<string, PlayerState>;
  objects: Map<string, ObjectState>;
  clues: Map<string, ClueInstance>;
  inPlay: Set<RoleId>;
  stowawayId: string | null;
  conductor: CarriageId;
  effects: ActiveEffect[];
  confines: ConfineEffect[];
  engineUnlocked: boolean;
  skippedLastVote: boolean;
  currentEvent: { station: number; title: string; text: string; worse: boolean } | null;
  dining: DiningState | null;
  finalDeadlineExtended: boolean;
  final: FinalResult | null;
  ending: EndingState | null;
  feed: FeedItem[];
  chat: ChatRecord[];
  premise: string;
  legit: [string, string] | null;
}
