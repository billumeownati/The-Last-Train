import { useEffect, useState } from 'react';
import { CARRIAGE_NAMES, type CarriageId, type CharacterId, type GameView, type PublicPlayer } from '@tlt/shared';
import { serverNow, useUI } from '../store';

/** Coat colours of the six fashion-plate passengers (match scene/cast.ts). */
export const CHAR_COLOR: Record<CharacterId, string> = {
  fedora: '#b58b5a',
  cloche: '#5b2a55',
  bowler: '#3a3d46',
  flatcap: '#4e5a3a',
  widebrim: '#7a1f2a',
  tophat: '#1f2f55',
};

export const carName = (c: CarriageId | null | undefined) => (c ? CARRIAGE_NAMES[c] : 'between carriages');

export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const i = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
}

export function fmtTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Countdown({ endsAt, className }: { endsAt: number; className?: string }) {
  useTick(250);
  const left = endsAt - serverNow();
  return <span className={(className ?? '') + (left < 15000 && left > 0 ? ' low' : '')}>{endsAt ? fmtTime(left) : '--:--'}</span>;
}

export function Swatch({ id, label }: { id?: CharacterId; label?: string }) {
  return (
    <span className="sw" style={{ background: id ? CHAR_COLOR[id] : '#4a4655' }}>
      {label}
    </span>
  );
}

export function useView(): GameView {
  return useUI((s) => s.view)!;
}

export function me(view: GameView): PublicPlayer {
  return view.players.find((p) => p.id === view.youId)!;
}

export function myCarriage(view: GameView): CarriageId | null {
  const m = me(view);
  return m.carriage ?? m.transit?.to ?? null;
}

export function ordinal(n: number) {
  return ['', 'first', 'second', 'third', 'fourth', 'fifth'][n] ?? String(n);
}
