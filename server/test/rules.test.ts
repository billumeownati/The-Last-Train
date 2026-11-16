import { describe, expect, it } from 'vitest';
import { LUGGAGE_CAPACITY } from '@tlt/shared';
import { makeRig, startGame, toRoam } from './helpers.js';
import type { PlayerState } from '../src/game/state.js';

const walk = (rig: ReturnType<typeof toRoam>, p: PlayerState, to: Parameters<typeof rig.room.move>[1]) => {
  const r = rig.room.move(p.id, to);
  expect(r.ok, r.ok ? '' : r.error).toBe(true);
  rig.run(rig.room.T.walk * 1.5);
};

describe('lobby and start', () => {
  it('needs 4 connected players, host only', () => {
    const rig = makeRig(3);
    expect(rig.room.start(rig.room.s.hostId).ok).toBe(false);
    const rig4 = makeRig(4);
    expect(rig4.room.start(rig4.players[1].id).ok).toBe(false);
    expect(rig4.room.start(rig4.room.s.hostId).ok).toBe(true);
    expect(rig4.room.s.phase).toBe('briefing');
  });

  it('rejects duplicate names and a 7th passenger', () => {
    const rig = makeRig(6);
    expect(rig.room.addPlayer('p1').ok).toBe(false);
    expect(rig.room.addPlayer('Someone').ok).toBe(false);
  });

  it('moves host when the host disconnects, and gives it back when they return', () => {
    const rig = makeRig(4);
    const host = rig.room.s.hostId;
    rig.room.setConnected(host, false);
    expect(rig.room.s.hostId).not.toBe(host);
    rig.room.setConnected(host, true);
    expect(rig.room.s.hostId).toBe(host);
  });
});

describe('movement', () => {
  it('starts everyone in the sleeper car; only adjacent moves; takes about 2 seconds', () => {
    const rig = toRoam(5);
    const p = rig.players[0];
    expect(p.carriage).toBe('sleepers');
    expect(rig.room.move(p.id, 'observation').ok).toBe(false); // not adjacent
    expect(rig.room.move(p.id, 'dining').ok).toBe(true);
    expect(rig.room.player(p.id)!.moving).not.toBeNull();
    rig.run(1000);
    expect(p.carriage).toBe('sleepers'); // still walking
    rig.run(1500);
    expect(p.carriage).toBe('dining');
    expect(p.moving).toBeNull();
  });

  it('keeps the engine locked until the station 4 event', () => {
    const rig = toRoam(5);
    const p = rig.players[0];
    walk(rig, p, 'dining');
    walk(rig, p, 'observation');
    expect(rig.room.move(p.id, 'engine').ok).toBe(false);
    rig.room.s.engineUnlocked = true;
    expect(rig.room.move(p.id, 'engine').ok).toBe(true);
  });

  it('limits the luggage van to two passengers, counting people on their way in', () => {
    const rig = toRoam(6);
    const [a, b, c] = rig.players;
    expect(rig.room.move(a.id, 'luggage').ok).toBe(true);
    expect(rig.room.move(b.id, 'luggage').ok).toBe(true);
    const third = rig.room.move(c.id, 'luggage');
    expect(third.ok).toBe(false);
    rig.run(3000);
    expect(rig.players.filter((p) => p.carriage === 'luggage')).toHaveLength(LUGGAGE_CAPACITY);
    expect(rig.room.move(c.id, 'luggage').ok).toBe(false);
    walk(rig, a, 'sleepers');
    expect(rig.room.move(c.id, 'luggage').ok).toBe(true);
  });

  it('cannot move or act while moving; cannot move during dining', () => {
    const rig = toRoam(4);
    const p = rig.players[0];
    rig.room.move(p.id, 'dining');
    expect(rig.room.move(p.id, 'observation').ok).toBe(false);
  });
});

describe('searching', () => {
  it('takes ~5s, awards the clue exclusively to whoever finishes first, and marks the object searched', () => {
    const rig = toRoam(6, 4);
    const [a, b] = rig.players;
    const obj = [...rig.room.s.objects.values()].find((o) => o.carriage === 'sleepers' && o.clueId && o.from <= 1)!;
    expect(rig.room.act(a.id, obj.id).ok).toBe(true);
    rig.run(1000);
    expect(rig.room.act(b.id, obj.id).ok).toBe(true); // b starts later
    rig.run(3000);
    expect(a.clues).toHaveLength(0); // not done yet
    rig.run(1500);
    expect(a.clues).toHaveLength(1);
    expect(a.notes.some((n) => n.kind === 'find')).toBe(true);
    rig.run(1500);
    expect(b.clues).toHaveLength(0);
    expect(obj.searched).toBe(true);
    expect(rig.room.act(rig.players[2].id, obj.id).ok).toBe(false); // already searched
  });

  it('only works in your own carriage', () => {
    const rig = toRoam(4);
    const lug = rig.room.s.objects.get('lug-trunk-1')!;
    expect(rig.room.act(rig.players[0].id, lug.id).ok).toBe(false);
  });

  it('cancels when you start walking', () => {
    const rig = toRoam(4);
    const p = rig.players[0];
    const obj = [...rig.room.s.objects.values()].find((o) => o.carriage === 'sleepers' && o.from <= 1)!;
    rig.room.act(p.id, obj.id);
    rig.room.move(p.id, 'dining');
    expect(p.action).toBeNull();
  });

  it('locked objects cannot be searched', () => {
    const rig = toRoam(6);
    const p = rig.players[0];
    walk(rig, p, 'dining');
    expect(rig.room.act(p.id, 'din-cabinet').ok).toBe(false);
  });

  it('the viewing glass gives a vision (once per station) without being exclusive', () => {
    const rig = toRoam(4);
    const [a, b] = rig.players;
    for (const p of [a, b]) {
      walk(rig, p, 'dining');
      walk(rig, p, 'observation');
    }
    expect(rig.room.act(a.id, 'obs-window').ok).toBe(true);
    expect(rig.room.act(b.id, 'obs-window').ok).toBe(true);
    rig.run(rig.room.T.gaze + 500);
    expect(a.notes.some((n) => n.kind === 'vision')).toBe(true);
    expect(b.notes.some((n) => n.kind === 'vision')).toBe(true);
    expect(rig.room.act(a.id, 'obs-window').ok).toBe(false);
  });
});

describe('discovery is paced across the journey', () => {
  it('an object stays dormant until its station, and the view says so', () => {
    const rig = toRoam(6, 61);
    const late = [...rig.room.s.objects.values()].find((o) => o.carriage === 'sleepers' && o.from === 3)!;
    const p = rig.players[0];
    const r = rig.room.act(p.id, late.id);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/nothing to find here yet/i);
    const dormantInView = rig.view(p)!.objects.find((o) => o.id === late.id)!;
    expect(dormantInView.dormant).toBe(true);
    const early = [...rig.room.s.objects.values()].find((o) => o.carriage === 'sleepers' && o.from === 1)!;
    expect(rig.view(p)!.objects.find((o) => o.id === early.id)!.dormant).toBe(false);
    rig.room.s.station = 3; // the train remembers more
    expect(rig.room.act(p.id, late.id).ok).toBe(true);
  });

  it('spreads the clues so that every station has something new to find (6 players)', () => {
    const { room } = startGame(6, 62);
    const perStation = [0, 0, 0, 0, 0, 0];
    for (const o of room.s.objects.values()) if (o.clueId && !o.locked && !o.hidden) perStation[o.from]++;
    perStation[3] += 1; // the stranger's suitcase appears at station 3
    for (let st = 1; st <= 5; st++) expect(perStation[st], `station ${st}`).toBeGreaterThanOrEqual(2);
    expect(Math.max(...perStation)).toBeLessThanOrEqual(9);
  });

  it('keeps the sleeper car searchable at roam 1 (the lights fail only afterwards)', () => {
    const rig = toRoam(6, 63);
    const early = [...rig.room.s.objects.values()].filter((o) => o.carriage === 'sleepers' && o.clueId && o.from <= 1);
    expect(early.length).toBeGreaterThanOrEqual(3);
  });
});

describe('conductor', () => {
  it('only answers when you share a carriage, once per station', () => {
    const rig = toRoam(5);
    const p = rig.players[0];
    expect(rig.room.s.conductor).toBe('dining');
    expect(rig.room.ask(p.id, 'where').ok).toBe(false);
    walk(rig, p, 'dining');
    const r = rig.room.ask(p.id, 'where');
    expect(r.ok).toBe(true);
    expect(p.notes.some((n) => n.kind === 'conductor')).toBe(true);
    expect(rig.room.ask(p.id, 'where').ok).toBe(false);
  });

  it('tells the stowaway they are not on the list; never tells innocents they are the stowaway', () => {
    const rig = toRoam(5, 9);
    const sw = rig.stowaway();
    walk(rig, sw, 'dining');
    const r = rig.room.ask(sw.id, 'board');
    expect(r.ok && r.data).toContain("don't have you");
    const other = rig.players.find((p) => !p.isStowaway)!;
    walk(rig, other, 'dining');
    const r2 = rig.room.ask(other.id, 'board');
    expect(r2.ok && r2.data).not.toContain("don't have you");
  });
});

describe('phases, events and the dining vote', () => {
  it('runs roam, event, dining in order and runs out the clock', () => {
    const rig = toRoam(4);
    expect(rig.room.s.station).toBe(1);
    rig.run(rig.room.T.roam + 500);
    expect(rig.room.s.phase).toBe('event');
    expect(rig.room.s.currentEvent!.title).toBe('The Lights Fail');
    rig.run(rig.room.T.event + 500);
    expect(rig.room.s.phase).toBe('dining');
    rig.run(10_000);
    expect(rig.players.every((p) => p.carriage === 'dining' && !p.moving)).toBe(true);
  });

  it('event 1 stops searching in the sleeper car for the event and the next roam', () => {
    const rig = toRoam(4, 2);
    rig.run(rig.room.T.roam + 500);
    const p = rig.players[0];
    // during the event nobody can search the sleepers (and nobody can be searched into the dark)
    const obj = [...rig.room.s.objects.values()].find((o) => o.carriage === 'sleepers')!;
    p.carriage = 'sleepers';
    expect(rig.room.act(p.id, obj.id).ok).toBe(false);
    expect(rig.view(p)!.effects.lockedSearch).toContain('sleepers');
  });

  it('opens a ballot at the end of dining, tallies it and applies the winning option', () => {
    const rig = toRoam(5, 3);
    rig.run(rig.room.T.roam + rig.room.T.event + 1000); // into dining
    const d = rig.room.s.dining!;
    expect(d.options.length).toBeGreaterThanOrEqual(2);
    expect(rig.room.diningVote(rig.players[0].id, d.options[0].id).ok).toBe(false); // ballot not open yet
    rig.run(rig.room.T.dining - rig.room.T.diningVote - 2000);
    rig.run(3000);
    expect(d.voting).toBe(true);
    const target = d.options.find((o) => o.kind === 'openLocked' || o.kind === 'shiftLuggage') ?? d.options[0];
    for (const p of rig.players) rig.room.diningVote(p.id, target.id);
    // everyone voted: the ballot closes after a short window and the next roam begins
    rig.run(rig.room.T.closingWindow + rig.room.T.resultShow + 1500);
    expect(rig.room.s.phase).toBe('roam');
    expect(rig.room.s.station).toBe(2);
    expect(rig.room.s.feed.some((f) => f.kind === 'vote')).toBe(true);
  });

  it('skipping the vote makes the next event worse', () => {
    const rig = toRoam(4, 6);
    rig.run(rig.room.T.roam + rig.room.T.event + rig.room.T.dining + rig.room.T.resultShow + 3000); // dining 1 ends, nobody voted
    expect(rig.room.s.station).toBe(2);
    expect(rig.room.s.skippedLastVote).toBe(true);
    rig.run(rig.room.T.roam + 500); // into event 2
    expect(rig.room.s.currentEvent!.worse).toBe(true);
    expect(rig.view(rig.players[0])!.effects.slowWalk).toBeGreaterThan(1);
  });

  it('the flooded luggage van expels anyone inside and refuses entry', () => {
    const rig = toRoam(5, 8);
    const p = rig.players[0];
    walk(rig, p, 'luggage');
    rig.room.s.station = 2;
    rig.room['applyEffects'](rig.room.story.events[1].effects);
    expect(p.carriage).toBe('sleepers');
    expect(rig.room.move(p.id, 'luggage').ok).toBe(false);
  });

  it('confine keeps a player in their own cabin for the next roam', () => {
    const rig = toRoam(5, 12);
    const p = rig.players[0];
    rig.room.s.confines.push({ playerId: p.id, until: { phase: 'roam', station: 2 } });
    rig.run(rig.room.T.roam + rig.room.T.event + rig.room.T.dining + rig.room.T.resultShow + 3000);
    expect(rig.room.s.station).toBe(2);
    expect(p.carriage).toBe('sleepers');
    expect(rig.room.move(p.id, 'dining').ok).toBe(false);
    const other = [...rig.room.s.objects.values()].find((o) => o.carriage === 'sleepers' && o.ownerRole !== p.roleId)!;
    expect(rig.room.act(p.id, other.id).ok).toBe(false);
    rig.room.s.effects = []; // event 1's blackout also lasts through roam 2; take it out of the picture
    const mine = [...rig.room.s.objects.values()].find((o) => o.ownerRole === p.roleId && o.from <= 2)!;
    expect(rig.room.act(p.id, mine.id).ok).toBe(true);
  });

  it('everyone ready skips ahead', () => {
    const rig = toRoam(4);
    for (const p of rig.players) rig.room.setReady(p.id, true);
    expect(rig.room.s.phase).toBe('event');
  });
});

describe('stowaway', () => {
  it('delivers a hint to the stowaway each station and confirms them at station 4', () => {
    const rig = toRoam(5, 14);
    const sw = rig.stowaway();
    for (let st = 1; st <= 4; st++) {
      rig.run(rig.room.T.roam + 500);
      expect(rig.room.s.phase).toBe('event');
      if (st < 4) expect(sw.stowawayConfirmed).toBe(false);
      rig.run(rig.room.T.event + rig.room.T.dining + rig.room.T.resultShow + 1500);
    }
    expect(sw.stowawayConfirmed).toBe(true);
    expect(sw.notes.filter((n) => n.kind === 'hint').length).toBeGreaterThanOrEqual(3);
    const v = rig.view(sw)!;
    expect(v.me!.stowawayConfirmed).toBe(true);
    expect(v.me!.truth).toBeTruthy();
  });

  it('never exposes roles, lies, goals or the stowaway in another player\'s view', () => {
    const rig = toRoam(6, 15);
    rig.run(rig.room.T.roam + rig.room.T.event + 1000);
    const secrets = new Map<string, string[]>();
    for (const p of rig.players) secrets.set(p.id, [p.memory, p.lie, p.goalText].filter((s) => s.length > 20));
    for (const viewer of rig.players) {
      const json = JSON.stringify(rig.view(viewer));
      for (const other of rig.players) {
        if (other.id === viewer.id) continue;
        for (const s of secrets.get(other.id)!) {
          if (secrets.get(viewer.id)!.includes(s)) continue; // identical card text (e.g. shared "Get off the train.")
          expect(json, `${viewer.name} must not see ${other.name}'s card text`).not.toContain(s);
        }
        expect(json).not.toContain(other.token);
      }
      expect(json).not.toContain('stowawayId');
      expect(json).not.toContain('isStowaway');
      expect(json).not.toContain(rig.room.story.stowaway.truth);
      expect(json).not.toContain('"roleId":"' + (rig.view(viewer)!.me!.roleId === 'A' ? 'B' : 'A') + '"');
    }
  });

  it('does not show the contents of unsearched objects', () => {
    const rig = toRoam(6, 16);
    const v = rig.view(rig.players[0])!;
    const json = JSON.stringify(v);
    for (const clue of rig.room.s.clues.values()) expect(json).not.toContain(clue.text);
  });
});

describe('chat is proximity filtered on the server', () => {
  it('only reaches people in the same carriage', () => {
    const rig = toRoam(5, 17);
    const [a, b, c] = rig.players;
    walk(rig, c, 'dining');
    rig.run(300);
    expect(rig.room.chat(a.id, 'hello sleepers').ok).toBe(true);
    rig.run(300);
    expect(rig.view(b)!.chat.some((m) => m.text === 'hello sleepers')).toBe(true);
    expect(rig.view(c)!.chat.some((m) => m.text === 'hello sleepers')).toBe(false);
    expect(rig.view(a)!.chat.some((m) => m.text === 'hello sleepers')).toBe(true);
  });

  it('cannot chat while walking', () => {
    const rig = toRoam(4);
    rig.room.move(rig.players[0].id, 'dining');
    expect(rig.room.chat(rig.players[0].id, 'hi').ok).toBe(false);
  });

  it('clue reveal works only in the dining car, and is seen only there', () => {
    const rig = toRoam(5, 18);
    const [a, b] = rig.players;
    const obj = [...rig.room.s.objects.values()].find((o) => o.carriage === 'sleepers' && o.clueId && o.from <= 1)!;
    rig.room.act(a.id, obj.id);
    rig.run(rig.room.T.search + 500);
    expect(a.clues.length).toBe(1);
    expect(rig.room.reveal(a.id, a.clues[0].id).ok).toBe(false); // not in dining
    walk(rig, a, 'dining');
    walk(rig, b, 'dining');
    expect(rig.room.reveal(a.id, a.clues[0].id).ok).toBe(true);
    expect(rig.view(b)!.chat.some((m) => m.kind === 'reveal' && m.clue?.text === a.clues[0].text)).toBe(true);
    const c = rig.players[2];
    expect(rig.view(c)!.chat.some((m) => m.kind === 'reveal')).toBe(false);
  });
});

describe('disconnects', () => {
  it('a dropped passenger falls asleep in their cabin and can rejoin', () => {
    const rig = toRoam(5, 19);
    const p = rig.players[2];
    walk(rig, p, 'dining');
    rig.room.setConnected(p.id, false);
    expect(p.carriage).toBe('sleepers');
    expect(rig.room.move(p.id, 'dining').ok).toBe(false);
    expect(rig.room.findDisconnectedByName(p.name)).toBe(p);
    rig.room.setConnected(p.id, true);
    expect(rig.room.move(p.id, 'dining').ok).toBe(true);
  });

  it('a sleeper who reconnects during dinner walks to the dining car', () => {
    const rig = toRoam(4, 20);
    const p = rig.players[1];
    rig.room.setConnected(p.id, false);
    rig.run(rig.room.T.roam + rig.room.T.event + 500);
    expect(rig.room.s.phase).toBe('dining');
    expect(p.carriage).toBe('sleepers');
    rig.room.setConnected(p.id, true);
    rig.run(5000);
    expect(p.carriage).toBe('dining');
  });
});

describe('startGame sanity', () => {
  it('briefing lasts 60s and then roam begins', () => {
    const rig = startGame(4);
    expect(rig.room.s.phase).toBe('briefing');
    rig.run(rig.room.T.briefing + 500);
    expect(rig.room.s.phase).toBe('roam');
  });
});
