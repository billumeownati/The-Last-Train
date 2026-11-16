import { describe, expect, it } from 'vitest';
import { startGame, story } from './helpers.js';
import { DROPPED, renderText } from '../src/content.js';

describe('dealing', () => {
  for (const n of [4, 5, 6]) {
    it(`${n} players: one role each, one stowaway, correct roles dropped`, () => {
      const { room } = startGame(n, 7 + n);
      const roles = room.players.map((p) => p.roleId);
      expect(new Set(roles).size).toBe(n);
      expect(room.players.filter((p) => p.isStowaway)).toHaveLength(1);
      if (n < 6) expect(roles).not.toContain('F');
      if (n < 5) expect(roles).not.toContain('E');
      if (n >= 5) expect(roles).toContain('E');
      expect(room.s.inPlay.size).toBe(n);
    });

    it(`${n} players: every placed clue is unique, in a real object, with no stray placeholders`, () => {
      const { room } = startGame(n, 3 + n);
      const seen = new Set<string>();
      for (const o of room.s.objects.values()) {
        if (!o.clueId) continue;
        expect(seen.has(o.clueId)).toBe(false);
        seen.add(o.clueId);
        const clue = room.s.clues.get(o.clueId)!;
        expect(clue.text).not.toMatch(/\{\w+/);
        expect(clue.title).not.toMatch(/\{\w+/);
        // lie/memory clues never sit in their own subject's cabin once relocated
        if (clue.role && o.ownerRole) expect(o.ownerRole).not.toBe(clue.role);
      }
      // every live clue found a home
      const expected = story.clues.filter((c) => !c.role || room.s.inPlay.has(c.role)).length;
      expect(room.s.clues.size).toBe(expected);
      expect(seen.size).toBe(expected);
    });
  }

  it('drops clues of dropped roles and objects in their cabins', () => {
    const { room } = startGame(4, 11);
    expect(room.s.objects.has('cab-E-trunk')).toBe(false);
    expect(room.s.objects.has('cab-F-bunk')).toBe(false);
    expect(room.s.clues.has('c-E1')).toBe(false);
    expect(room.s.clues.has('c-F2')).toBe(false);
    // clue that was in a dropped cabin got a new home
    expect(room.s.clues.has('c-MA')).toBe(true);
    expect([...room.s.objects.values()].some((o) => o.clueId === 'c-MA')).toBe(true);
  });

  it('refers to dropped roles as a passenger who got off at an earlier stop', () => {
    const { room } = startGame(4, 5);
    const hale = room.players.find((p) => p.roleId === 'A')!;
    const text = hale.isStowaway ? story.roles[0].falseMemory : story.roles[0].memory;
    if (text.includes('{E')) expect(hale.memory).toContain(DROPPED);
    expect(renderText('{F} waits. {E:short}', { story, inPlay: new Set(['A']) })).toBe(`A passenger who got off at an earlier stop waits. A${DROPPED.slice(1)}`);
  });

  it('stowaway gets the false memory and the neutral goal; others get the true memory', () => {
    const { room } = startGame(6, 21);
    for (const p of room.players) {
      const role = room.roleOf(p)!;
      if (p.isStowaway) {
        expect(p.goalKind).toBe('getOff');
        expect(p.goalText).toBe(story.stowaway.goalText);
        expect(p.memory).toBe(renderText(role.falseMemory, { story, inPlay: room.s.inPlay }));
      } else {
        expect(p.goalKind).toBe(role.goal.kind);
        expect(p.memory).toBe(renderText(role.memory, { story, inPlay: room.s.inPlay }));
      }
    }
  });

  it('engine manifest names two innocent roles', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { room } = startGame(6, seed);
      const m = room.s.clues.get('c-manifest')!;
      const sw = room.roleOf(room.player(room.s.stowawayId!)!)!;
      expect(m.text).not.toContain(sw.name);
      expect(room.s.legit![0]).not.toBe(sw.name);
      expect(room.s.legit![1]).not.toBe(sw.name);
    }
  });

  it('goals that target a dropped role fall back to getOff', () => {
    for (let seed = 1; seed < 10; seed++) {
      const { room } = startGame(4, seed);
      for (const p of room.players) {
        expect(['getOff', 'leaveBehindStowaway', 'leaveBehind', 'keepTogether']).toContain(p.goalKind);
        if (p.goalTarget) expect(room.s.inPlay.has(p.goalTarget)).toBe(true);
      }
    }
  });
});
