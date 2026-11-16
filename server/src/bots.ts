/**
 * Bot passengers for solo testing:  npm run bots -- ABCD 3
 * Joins room ABCD with 3 bots that wander, search, ask the conductor, chat and vote.
 * They play like noisy amateurs, which is exactly what you want when you are testing alone.
 */
import { io, type Socket } from 'socket.io-client';
import { CARRIAGES, type ClientToServer, type GameView, type ServerToClient } from '@tlt/shared';

const [code = '', countArg = '3'] = process.argv.slice(2);
const URL = process.env.SERVER_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const COUNT = Math.min(5, Math.max(1, Number(countArg) || 3));
if (!/^[A-Za-z]{4}$/.test(code)) {
  console.error('Usage: npm run bots -- <ROOMCODE> [count]');
  process.exit(1);
}

const NAMES = ['Ada', 'Bram', 'Cleo', 'Dov', 'Edie'];
const LINES = [
  'I was asleep the whole way, honestly.',
  'Does anyone else remember the sleet?',
  'Somebody here is not telling the truth.',
  'Who sat in the front?',
  'I found something strange in the luggage van.',
  'Look, we all want to get off this train.',
  "Don't look at me, I barely knew any of you.",
  'The conductor looked at me oddly.',
];
const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function bot(name: string) {
  const s: Socket<ServerToClient, ClientToServer> = io(URL, { transports: ['websocket'] });
  let view: GameView | null = null;
  let last = 0;
  let readied = '';
  s.on('connect', () => {
    s.emit('room:join', { code: code.toUpperCase(), name }, (r) => {
      if (!r.ok) {
        console.log(`[${name}] could not join: ${r.error}`);
        process.exit(1);
      }
      console.log(`[${name}] aboard`);
    });
  });
  s.on('state', (v) => (view = v));
  setInterval(() => {
    const v = view;
    if (!v) return;
    const me = v.players.find((p) => p.id === v.youId);
    if (!me) return;
    const now = Date.now();
    const key = `${v.phase}${v.station}${v.dining?.subphase ?? ''}`;
    if (v.pendingReveal && v.clues.length) s.emit('game:reveal', { clueId: rnd(v.clues).id }, () => undefined);
    if (v.phase === 'briefing' && readied !== key) {
      readied = key;
      setTimeout(() => s.emit('game:ready', { ready: true }), 1500 + Math.random() * 4000);
    }
    if ((v.phase === 'roam' || v.phase === 'event') && now - last > 1800 + Math.random() * 2000 && !me.transit && !me.activity) {
      last = now;
      const objs = v.objects.filter((o) => o.carriage === me.carriage && !o.searched && !o.locked);
      const roll = Math.random();
      if (roll < 0.5 && objs.length) s.emit('game:act', { objectId: rnd(objs).id }, () => undefined);
      else if (roll < 0.62 && v.conductor?.carriage === me.carriage && !v.questionAsked) s.emit('game:ask', { question: rnd(['where', 'board'] as const) }, () => undefined);
      else if (me.carriage) {
        const i = CARRIAGES.indexOf(me.carriage);
        const to = CARRIAGES[i + (Math.random() < 0.5 ? 1 : -1)];
        if (to) s.emit('game:move', { to }, () => undefined);
      }
      if (Math.random() < 0.15) s.emit('chat:send', { text: rnd(LINES) });
    }
    if (v.phase === 'dining') {
      if (v.dining?.subphase === 'talk' && now - last > 6000 + Math.random() * 6000) {
        last = now;
        s.emit('chat:send', { text: rnd(LINES) });
        if (v.clues.length && Math.random() < 0.4) s.emit('game:reveal', { clueId: rnd(v.clues).id }, () => undefined);
      }
      if (v.dining?.subphase === 'vote' && !v.dining.myVote) setTimeout(() => s.emit('game:diningVote', { optionId: Math.random() < 0.85 ? rnd(v.dining!.options).id : 'skip' }), 1000 + Math.random() * 6000);
    }
    if (v.phase === 'finalVote' && v.final && !v.final.myVote) {
      const c = rnd(v.final.candidates.filter((x) => x.id !== v.youId));
      setTimeout(() => s.emit('game:finalVote', { playerId: c.id }), 1500 + Math.random() * 8000);
    }
  }, 700);
}

for (let i = 0; i < COUNT; i++) {
  bot(`${NAMES[i]}`);
  await sleep(250);
}
console.log(`${COUNT} bots running against ${URL}. Ctrl+C to stop.`);
