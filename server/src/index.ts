import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import {
  CARRIAGES,
  cleanName,
  normaliseCode,
  type ClientToServer,
  type ConductorQuestion,
  type ServerToClient,
} from '@tlt/shared';
import { loadStory } from './content.js';
import { RoomRegistry } from './rooms.js';
import { buildView } from './game/views.js';
import type { PlayerState } from './game/state.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const TIME_SCALE = Number(process.env.TIME_SCALE ?? 1);
const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = resolve(process.env.CLIENT_DIST ?? join(here, '../../client/dist'));

const story = loadStory();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const http = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: registry.size }));
    return;
  }
  if (!existsSync(CLIENT_DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('The Last Train server is running. The client has not been built yet: run `npm run build`, or use `npm run dev` and open the Vite URL.');
    return;
  }
  let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (rel.includes('..')) rel = '';
  let file = join(CLIENT_DIST, rel);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(CLIENT_DIST, 'index.html');
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(readFileSync(file));
});

const io = new Server<ClientToServer, ServerToClient>(http, {
  cors: { origin: true },
  maxHttpBufferSize: 64 * 1024,
});

/* ------------------------------------------------------------------ */
/* broadcasting                                                        */
/* ------------------------------------------------------------------ */

const pending = new Set<string>();
function scheduleBroadcast(code: string) {
  if (pending.has(code)) return;
  pending.add(code);
  queueMicrotask(() => {
    pending.delete(code);
    broadcast(code);
  });
}

function broadcast(code: string) {
  const entry = registry.get(code);
  if (!entry) return;
  for (const [playerId, socketId] of entry.sockets) {
    const view = buildView(entry.room, playerId);
    if (view) io.to(socketId).emit('state', view);
  }
}

const registry = new RoomRegistry(story, TIME_SCALE, {
  onChange: scheduleBroadcast,
  onToast: (code, playerId, kind, text) => {
    const sid = registry.get(code)?.sockets.get(playerId);
    if (sid) io.to(sid).emit('toast', { kind, text });
  },
});

setInterval(() => {
  for (const e of registry.all()) e.room.tick();
}, 250);
setInterval(() => registry.sweep(30 * 60_000), 60_000);

/* ------------------------------------------------------------------ */
/* sockets                                                             */
/* ------------------------------------------------------------------ */

interface SocketData {
  code?: string;
  playerId?: string;
}

type Ack = (r: { ok: boolean; error?: string; data?: unknown }) => void;
const noAck: Ack = () => undefined;

function bind(socket: Socket<ClientToServer, ServerToClient>, code: string, p: PlayerState) {
  const entry = registry.get(code)!;
  // a second tab or a rejoin replaces the old socket
  const old = entry.sockets.get(p.id);
  if (old && old !== socket.id) io.sockets.sockets.get(old)?.disconnect(true);
  entry.sockets.set(p.id, socket.id);
  (socket.data as SocketData).code = code;
  (socket.data as SocketData).playerId = p.id;
  socket.join(code);
  entry.room.setConnected(p.id, true);
  scheduleBroadcast(code);
}

io.on('connection', (socket) => {
  const ctx = () => {
    const d = socket.data as SocketData;
    if (!d.code || !d.playerId) return null;
    const entry = registry.get(d.code);
    const player = entry?.room.player(d.playerId);
    if (!entry || !player) return null;
    return { entry, room: entry.room, player, code: d.code };
  };
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

  socket.on('room:create', (p, cb = noAck) => {
    if (ctx()) return cb({ ok: false, error: 'Already in a room.' });
    const name = cleanName(str(p?.name, 40));
    if (!name) return cb({ ok: false, error: 'Pick a name.' });
    const entry = registry.create();
    const r = entry.room.addPlayer(name);
    if (!r.ok) return cb({ ok: false, error: r.error });
    bind(socket, entry.room.s.code, r.data);
    cb({ ok: true, data: { code: entry.room.s.code, playerId: r.data.id, token: r.data.token } });
  });

  socket.on('room:join', (p, cb = noAck) => {
    if (ctx()) return cb({ ok: false, error: 'Already in a room.' });
    const code = normaliseCode(str(p?.code, 10));
    const name = cleanName(str(p?.name, 40));
    const entry = registry.get(code);
    if (!entry) return cb({ ok: false, error: `No train with code ${code || '????'}.` });
    if (!name) return cb({ ok: false, error: 'Pick a name.' });
    const room = entry.room;
    const returning = room.findDisconnectedByName(name);
    if (returning) {
      bind(socket, code, returning);
      return cb({ ok: true, data: { code, playerId: returning.id, token: returning.token } });
    }
    if (room.nameInUse(name)) return cb({ ok: false, error: 'That name is already aboard. If it is you, close your other tab first.' });
    const r = room.addPlayer(name);
    if (!r.ok) return cb({ ok: false, error: r.error });
    bind(socket, code, r.data);
    cb({ ok: true, data: { code, playerId: r.data.id, token: r.data.token } });
  });

  socket.on('room:rejoin', (p, cb = noAck) => {
    const code = normaliseCode(str(p?.code, 10));
    const entry = registry.get(code);
    const player = entry?.room.findByToken(str(p?.token, 64));
    if (!entry || !player) return cb({ ok: false, error: 'That seat is gone.' });
    bind(socket, code, player);
    cb({ ok: true, data: { code, playerId: player.id, token: player.token } });
  });

  socket.on('room:leave', () => {
    const c = ctx();
    if (!c) return;
    if (c.room.s.phase === 'lobby') {
      c.room.removePlayer(c.player.id);
      c.entry.sockets.delete(c.player.id);
      (socket.data as SocketData).code = undefined;
      (socket.data as SocketData).playerId = undefined;
      socket.leave(c.code);
      scheduleBroadcast(c.code);
    } else {
      socket.disconnect(true);
    }
  });

  socket.on('room:kick', (p) => {
    const c = ctx();
    if (!c || c.room.s.phase !== 'lobby' || c.player.id !== c.room.s.hostId) return;
    const targetId = str(p?.playerId, 40);
    if (targetId === c.player.id) return;
    const sid = c.entry.sockets.get(targetId);
    c.room.removePlayer(targetId);
    c.entry.sockets.delete(targetId);
    if (sid) {
      const s = io.sockets.sockets.get(sid);
      s?.emit('kicked');
      if (s) {
        (s.data as SocketData).code = undefined;
        (s.data as SocketData).playerId = undefined;
        s.leave(c.code);
      }
    }
    scheduleBroadcast(c.code);
  });

  socket.on('game:start', (cb = noAck) => {
    const c = ctx();
    if (!c) return cb({ ok: false, error: 'Not in a room.' });
    const r = c.room.start(c.player.id);
    cb(r.ok ? { ok: true } : { ok: false, error: r.error });
  });

  socket.on('game:ready', (p) => {
    const c = ctx();
    if (c) c.room.setReady(c.player.id, !!p?.ready);
  });

  socket.on('game:move', (p, cb = noAck) => {
    const c = ctx();
    if (!c) return cb({ ok: false, error: 'Not in a room.' });
    const to = str(p?.to, 20) as (typeof CARRIAGES)[number];
    const r = c.room.move(c.player.id, to);
    cb(r.ok ? { ok: true } : { ok: false, error: r.error });
  });

  socket.on('game:act', (p, cb = noAck) => {
    const c = ctx();
    if (!c) return cb({ ok: false, error: 'Not in a room.' });
    const r = c.room.act(c.player.id, str(p?.objectId, 60));
    cb(r.ok ? { ok: true } : { ok: false, error: r.error });
  });

  socket.on('game:cancel', () => {
    const c = ctx();
    if (c) c.room.cancel(c.player.id);
  });

  socket.on('game:ask', (p, cb = noAck) => {
    const c = ctx();
    if (!c) return cb({ ok: false, error: 'Not in a room.' });
    const r = c.room.ask(c.player.id, str(p?.question, 20) as ConductorQuestion, p?.target ? str(p.target, 40) : undefined);
    cb(r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error });
  });

  socket.on('game:reveal', (p, cb = noAck) => {
    const c = ctx();
    if (!c) return cb({ ok: false, error: 'Not in a room.' });
    const r = c.room.reveal(c.player.id, str(p?.clueId, 40));
    cb(r.ok ? { ok: true } : { ok: false, error: r.error });
  });

  socket.on('game:diningVote', (p) => {
    const c = ctx();
    if (c) c.room.diningVote(c.player.id, p?.optionId == null ? null : str(p.optionId, 20));
  });

  socket.on('game:finalVote', (p) => {
    const c = ctx();
    if (c) c.room.finalVote(c.player.id, p?.playerId == null ? null : str(p.playerId, 40));
  });

  socket.on('game:endingNext', () => {
    const c = ctx();
    if (c) c.room.endingNext(c.player.id);
  });

  socket.on('game:playAgain', () => {
    const c = ctx();
    if (c) c.room.playAgain(c.player.id);
  });

  socket.on('chat:send', (p) => {
    const c = ctx();
    if (!c) return;
    const r = c.room.chat(c.player.id, str(p?.text, 600));
    if (!r.ok) io.to(socket.id).emit('toast', { kind: 'error', text: r.error });
  });

  socket.on('voice:join', (p) => {
    const c = ctx();
    if (c) c.room.setVoice(c.player.id, !!p?.on);
  });

  socket.on('voice:signal', (p) => {
    const c = ctx();
    if (!c || !p || typeof p.to !== 'string') return;
    if (JSON.stringify(p.data ?? null).length > 20_000) return;
    const sid = c.entry.sockets.get(p.to);
    if (sid && c.room.player(p.to)) io.to(sid).emit('voice:signal', { from: c.player.id, data: p.data });
  });

  socket.on('disconnect', () => {
    const c = ctx();
    if (!c) return;
    if (c.entry.sockets.get(c.player.id) === socket.id) {
      c.entry.sockets.delete(c.player.id);
      c.room.setConnected(c.player.id, false);
    }
  });
});

http.listen(PORT, HOST, () => {
  console.log(`The Last Train — server listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  story: ${story.meta.title}, ${story.roles.length} roles, ${story.clues.length} clues, time scale ${TIME_SCALE}`);
  console.log(`  client: ${existsSync(CLIENT_DIST) ? CLIENT_DIST : '(not built — use npm run dev, or npm run build)'}`);
});
