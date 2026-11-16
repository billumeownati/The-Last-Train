import { loadStory } from '../src/content.js';
import { Room } from '../src/game/room.js';
import { mulberry32 } from '../src/game/util.js';
import type { PlayerState } from '../src/game/state.js';
import { buildView } from '../src/game/views.js';

export const story = loadStory();

export class Clock {
  t = 1_000_000;
  now = () => this.t;
  advance(ms: number) {
    this.t += ms;
  }
}

export interface Rig {
  room: Room;
  clock: Clock;
  players: PlayerState[];
  /** advance the fake clock in small steps, ticking the room each step */
  run(ms: number, step?: number): void;
  view(p: PlayerState): ReturnType<typeof buildView>;
  byRole(role: string): PlayerState;
  stowaway(): PlayerState;
}

export function makeRig(n: number, seed = 1): Rig {
  const clock = new Clock();
  const room = new Room('TEST', { story, now: clock.now, rng: mulberry32(seed) });
  const players: PlayerState[] = [];
  for (let i = 0; i < n; i++) {
    const r = room.addPlayer(`P${i + 1}`);
    if (!r.ok) throw new Error(r.error);
    players.push(r.data);
  }
  const rig: Rig = {
    room,
    clock,
    players,
    run(ms, step = 250) {
      for (let t = 0; t < ms; t += step) {
        clock.advance(step);
        room.tick();
      }
    },
    view: (p) => buildView(room, p.id),
    byRole: (role) => {
      const p = room.players.find((x) => x.roleId === role);
      if (!p) throw new Error(`no player with role ${role}`);
      return p;
    },
    stowaway: () => room.player(room.s.stowawayId!)!,
  };
  return rig;
}

export function startGame(n: number, seed = 1): Rig {
  const rig = makeRig(n, seed);
  const r = rig.room.start(rig.room.s.hostId);
  if (!r.ok) throw new Error(r.error);
  return rig;
}

/** Skip briefing and be standing in Roam of station 1. */
export function toRoam(n: number, seed = 1): Rig {
  const rig = startGame(n, seed);
  rig.run(rig.room.T.briefing + 500);
  if (rig.room.s.phase !== 'roam') throw new Error('expected roam, got ' + rig.room.s.phase);
  return rig;
}
