import { io, type Socket } from 'socket.io-client';
import type { Ack, CarriageId, ClientToServer, ConductorQuestion, JoinResult, ServerToClient } from '@tlt/shared';
import { save, toast, ui } from './store';

export type GameSocket = Socket<ServerToClient, ClientToServer>;

const url = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;
export const socket: GameSocket = io(url ?? '/', { transports: ['websocket', 'polling'], autoConnect: false, reconnectionDelay: 500, reconnectionDelayMax: 3000 });

function remember(r: JoinResult) {
  const session = { code: r.code, playerId: r.playerId, token: r.token };
  save('tlt.session', session);
  ui.set({ session });
}

function forget() {
  save('tlt.session', null);
  ui.set({ session: null, view: null, seenEvent: 0, seenBanner: 0 });
}

function tryRejoin() {
  const s = ui.get().session;
  if (!s) return;
  socket.emit('room:rejoin', { code: s.code, token: s.token }, (r: Ack<JoinResult>) => {
    if (!r.ok) forget();
  });
}

socket.on('connect', () => {
  ui.set({ conn: 'online' });
  tryRejoin();
});
socket.on('disconnect', () => ui.set({ conn: 'offline' }));
socket.on('connect_error', () => ui.set({ conn: 'offline' }));
socket.on('state', (view) => {
  const prev = ui.get().view;
  const patch: Partial<ReturnType<typeof ui.get>> = { view, offset: view.serverNow - Date.now() };
  // a fresh game (play again) must show its banners and event cards again
  if (view.phase === 'lobby' || view.phase === 'briefing') Object.assign(patch, { seenEvent: 0, seenBanner: 0, overview: false, conductorMenu: false });
  // count unread chat while on another tab
  if (prev && view.chat.length > prev.chat.length && ui.get().panel !== 'chat') {
    const mine = view.youId;
    const fresh = view.chat.slice(prev.chat.length).filter((m) => m.fromId !== mine && m.kind !== 'system').length;
    if (fresh) patch.unread = ui.get().unread + fresh;
  }
  ui.set(patch);
});
socket.on('toast', (t) => toast(t.kind, t.text));
socket.on('kicked', () => {
  forget();
  toast('error', 'The host removed you from the room.');
});

export function connect() {
  if (!socket.connected && !socket.active) socket.connect();
}

function call<T = unknown>(event: string, payload?: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'No answer from the server.' }), 8000);
    const cb = (r: Ack<T>) => {
      clearTimeout(timer);
      resolve(r);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (payload === undefined) (socket as any).emit(event, cb);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else (socket as any).emit(event, payload, cb);
  });
}

export const net = {
  async create(name: string) {
    const r = await call<JoinResult>('room:create', { name });
    if (r.ok && r.data) remember(r.data);
    return r;
  },
  async join(code: string, name: string) {
    const r = await call<JoinResult>('room:join', { code, name });
    if (r.ok && r.data) remember(r.data);
    return r;
  },
  leave() {
    socket.emit('room:leave');
    forget();
    socket.disconnect();
    socket.connect();
  },
  kick: (playerId: string) => socket.emit('room:kick', { playerId }),
  start: () => call('game:start'),
  ready: (ready: boolean) => socket.emit('game:ready', { ready }),
  move: (to: CarriageId) => call('game:move', { to }),
  act: (objectId: string) => call('game:act', { objectId }),
  cancel: () => socket.emit('game:cancel'),
  ask: (question: ConductorQuestion, target?: string) => call<string>('game:ask', { question, target }),
  reveal: (clueId: string) => call('game:reveal', { clueId }),
  diningVote: (optionId: string | null) => socket.emit('game:diningVote', { optionId }),
  finalVote: (playerId: string | null) => socket.emit('game:finalVote', { playerId }),
  endingNext: () => socket.emit('game:endingNext'),
  playAgain: () => socket.emit('game:playAgain'),
  chat: (text: string) => socket.emit('chat:send', { text }),
  voiceJoin: (on: boolean) => socket.emit('voice:join', { on }),
  voiceSignal: (to: string, data: unknown) => socket.emit('voice:signal', { to, data }),
};
