import { useSyncExternalStore } from 'react';
import type { GameView } from '@tlt/shared';

export type Panel = 'case' | 'card' | 'people' | 'chat' | 'log';

export interface Toast {
  id: number;
  kind: 'info' | 'error';
  text: string;
}

export interface UIState {
  view: GameView | null;
  conn: 'connecting' | 'online' | 'offline';
  session: { code: string; playerId: string; token: string } | null;
  /** serverNow - Date.now(), refreshed on every state push */
  offset: number;
  toasts: Toast[];
  panel: Panel;
  overview: boolean;
  lowGfx: boolean;
  rules: boolean;
  sceneReady: boolean;
  sceneStation: string | null;
  mic: 'off' | 'asking' | 'on' | 'denied' | 'unsupported';
  micMuted: boolean;
  micLevel: number;
  speaking: string[];
  conductorMenu: boolean;
  /** station number whose event / banner the player has already dismissed */
  seenEvent: number;
  seenBanner: number;
  unread: number;
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. */
  }
}

let state: UIState = {
  view: null,
  conn: 'connecting',
  session: load('tlt.session', null),
  offset: 0,
  toasts: [],
  panel: 'case',
  overview: false,
  lowGfx: load('tlt.low', false),
  rules: false,
  sceneReady: false,
  sceneStation: null,
  mic: 'off',
  micMuted: false,
  micLevel: 0,
  speaking: [],
  conductorMenu: false,
  seenEvent: 0,
  seenBanner: 0,
  unread: 0,
};

const listeners = new Set<() => void>();
export const ui = {
  get: () => state,
  set(patch: Partial<UIState> | ((s: UIState) => Partial<UIState>)) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...p };
    listeners.forEach((l) => l());
  },
  sub(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useUI<R>(sel: (s: UIState) => R): R {
  return useSyncExternalStore(ui.sub, () => sel(state));
}

let toastId = 1;
export function toast(kind: 'info' | 'error', text: string) {
  const id = toastId++;
  ui.set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
  setTimeout(() => ui.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 4200 : 3000);
}

export const serverNow = () => Date.now() + state.offset;
