import { describe, expect, it } from 'vitest';
import { STATION_COUNT } from '@tlt/shared';
import { toRoam } from './helpers.js';
import type { Rig } from './helpers.js';

/** Plays a whole game with bots that wander, search and vote, and checks the invariants hold. */
function playThrough(rig: Rig, voter: (rig: Rig, voterId: string) => string) {
  const { room } = rig;
  const phases: string[] = [];
  const seenPhase = (p: string) => {
    if (phases[phases.length - 1] !== p) phases.push(p);
  };
  let guard = 0;
  while (room.s.phase !== 'ending' && guard++ < 20000) {
    seenPhase(`${room.s.phase}${room.s.station}`);
    // bots act every simulated second
    for (const p of rig.players) {
      if (!p.connected) continue;
      if (room.s.phase === 'roam' || room.s.phase === 'event') {
        if (!p.moving && !p.action) {
          const choices = ['search', 'search', 'move', 'ask'] as const;
          const c = choices[Math.floor(Math.random() * choices.length)];
          if (c === 'search') {
            const here = [...room.s.objects.values()].filter((o) => o.carriage === p.carriage && !o.hidden);
            const o = here[Math.floor(Math.random() * here.length)];
            if (o) room.act(p.id, o.id);
          } else if (c === 'move') {
            const dirs = ['engine', 'observation', 'dining', 'sleepers', 'luggage'] as const;
            room.move(p.id, dirs[Math.floor(Math.random() * dirs.length)]);
          } else room.ask(p.id, 'board');
        }
      }
      if (room.s.phase === 'dining' && room.s.dining?.voting && p.diningVote === null) {
        const opts = room.s.dining.options;
        room.diningVote(p.id, Math.random() < 0.8 ? opts[Math.floor(Math.random() * opts.length)].id : 'skip');
      }
      if (room.s.phase === 'finalVote' && p.finalVote === null) room.finalVote(p.id, voter(rig, p.id));
      if (p.pendingRevealUntil !== null && p.clues.length) room.reveal(p.id, p.clues[0].id);
    }
    rig.run(1000, 250);
  }
  return phases;
}

describe('a whole game', () => {
  for (const n of [4, 5, 6]) {
    it(`${n} players play from briefing to the last ending`, () => {
      const rig = toRoam(n, 100 + n);
      const phases = playThrough(rig, (r, me) => r.players.find((p) => p.id !== me)!.id);
      const { room } = rig;
      expect(room.s.phase).toBe('ending');
      // 5 stations of roam/event/dining, the final ballot, then endings
      for (let st = 1; st <= STATION_COUNT; st++) {
        expect(phases).toContain(`roam${st}`);
        expect(phases).toContain(`event${st}`);
        expect(phases).toContain(`dining${st}`);
      }
      expect(phases).toContain(`finalVote${STATION_COUNT}`);

      // exactly one stays aboard, everyone else steps down
      const f = room.s.final!;
      expect(f.left).toHaveLength(1);
      const steps = room.s.ending!.steps;
      const ends = steps.filter((s) => s.kind === 'player');
      expect(ends).toHaveLength(n);
      expect(ends.filter((s) => s.kind === 'player' && !s.gotOff)).toHaveLength(1);
      expect(steps[steps.length - 1].kind).toBe('truth');
      // each player has a 2-line epilogue
      for (const s of ends) if (s.kind === 'player') expect(s.lines.length).toBeGreaterThanOrEqual(2);
    });
  }

  it('reveals the ending one step at a time and never sends future steps', () => {
    const rig = toRoam(4, 31);
    playThrough(rig, (r, me) => r.players.find((p) => p.id !== me)!.id);
    const host = rig.room.s.hostId;
    const first = rig.view(rig.room.player(host)!)!.ending!;
    expect(first.steps).toHaveLength(1);
    expect(first.total).toBeGreaterThan(first.steps.length);
    expect(JSON.stringify(first)).not.toContain('"truth"');
    rig.run(rig.room.T.endingStep + 500);
    expect(rig.view(rig.room.player(host)!)!.ending!.steps).toHaveLength(2);
    expect(rig.room.endingNext(rig.players.find((p) => p.id !== host)!.id).ok).toBe(false);
    while (!rig.view(rig.room.player(host)!)!.ending!.done) rig.room.endingNext(host);
    expect(rig.view(rig.room.player(host)!)!.ending!.steps.at(-1)!.kind).toBe('truth');
  });

  it('the host can play again; the room resets to the lobby with everyone still seated', () => {
    const rig = toRoam(4, 32);
    playThrough(rig, (r, me) => r.players.find((p) => p.id !== me)!.id);
    const host = rig.room.s.hostId;
    expect(rig.room.playAgain(rig.players.find((p) => p.id !== host)!.id).ok).toBe(false);
    expect(rig.room.playAgain(host).ok).toBe(true);
    expect(rig.room.s.phase).toBe('lobby');
    expect(rig.room.players).toHaveLength(4);
    expect(rig.room.players.every((p) => p.roleId === null)).toBe(true);
    expect(rig.room.start(host).ok).toBe(true);
  });
});

describe('the final vote', () => {
  function toFinal(n: number, seed: number): Rig {
    const rig = toRoam(n, seed);
    let guard = 0;
    while (rig.room.s.phase !== 'finalVote' && guard++ < 5000) rig.run(1000, 250);
    expect(rig.room.s.phase).toBe('finalVote');
    return rig;
  }

  it('plurality leaves one passenger aboard; no self votes', () => {
    const rig = toFinal(5, 40);
    const [a, b, c, d, e] = rig.players;
    expect(rig.room.finalVote(a.id, a.id).ok).toBe(false);
    for (const p of [a, c, d, e]) rig.room.finalVote(p.id, b.id);
    rig.room.finalVote(b.id, a.id);
    rig.run(rig.room.T.closingWindow + 1000);
    expect(rig.room.s.phase).toBe('ending');
    expect(rig.room.s.final!.left).toEqual([b.id]);
    const tally = rig.view(a)!.ending!.steps[0];
    expect(tally.kind).toBe('tally');
  });

  it('ties are broken at random among the tied, never outside them', () => {
    const results = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const rig = toFinal(4, 40 + seed);
      const [a, b, c, d] = rig.players;
      rig.room.finalVote(a.id, b.id);
      rig.room.finalVote(b.id, a.id);
      rig.room.finalVote(c.id, b.id);
      rig.room.finalVote(d.id, a.id);
      rig.run(rig.room.T.closingWindow + 1000);
      expect(rig.room.s.final!.tied).toBe(true);
      const left = rig.room.s.final!.left[0];
      expect([a.id, b.id]).toContain(left);
      results.add(left === a.id ? 'a' : 'b');
    }
    expect(results.size).toBe(2);
  });

  it('absent at the final vote means staying aboard, and cannot win', () => {
    const rig = toFinal(5, 41);
    const [a, b, c, d, e] = rig.players;
    for (const p of [a, b, c, d]) rig.room.finalVote(p.id, e.id === p.id ? a.id : p.id === a.id ? b.id : a.id);
    rig.room.setConnected(e.id, false);
    rig.run(rig.room.T.finalVote + rig.room.T.rejoinGrace + 2000);
    expect(rig.room.s.phase).toBe('ending');
    expect(rig.room.s.final!.left).toContain(e.id);
    const left = new Set(rig.room.s.final!.left);
    expect(rig.room.evaluateGoal(e, left)).toBe(false);
  });
});

describe('goals', () => {
  it('evaluates each goal kind', () => {
    const rig = toRoam(6, 50);
    const { room } = rig;
    const set = (ids: string[]) => new Set(ids);
    const sw = rig.stowaway();
    const others = rig.players.filter((p) => !p.isStowaway);
    const x = others[0];

    x.goalKind = 'getOff';
    expect(room.evaluateGoal(x, set([sw.id]))).toBe(true);
    expect(room.evaluateGoal(x, set([x.id]))).toBe(false);

    x.goalKind = 'leaveBehindStowaway';
    expect(room.evaluateGoal(x, set([sw.id]))).toBe(true);
    expect(room.evaluateGoal(x, set([others[1].id]))).toBe(false);
    expect(room.evaluateGoal(x, set([x.id]))).toBe(false);

    x.goalKind = 'stayBehind';
    expect(room.evaluateGoal(x, set([x.id]))).toBe(true);
    expect(room.evaluateGoal(x, set([sw.id]))).toBe(false);

    x.goalKind = 'leaveBehind';
    x.goalTarget = others[1].roleId;
    expect(room.evaluateGoal(x, set([others[1].id]))).toBe(true);
    expect(room.evaluateGoal(x, set([others[2].id]))).toBe(false);

    x.goalKind = 'keepTogether';
    expect(room.evaluateGoal(x, set([others[2].id]))).toBe(true);
    expect(room.evaluateGoal(x, set([others[1].id]))).toBe(false);
  });
});
