import { randomBytes } from 'node:crypto';

export type Rng = () => number;

/** Small deterministic PRNG so tests (and bug reports) can replay a deal. */
export function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: T[], rng: Rng): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

export function newToken(): string {
  return randomBytes(18).toString('base64url');
}

export function newPlayerId(): string {
  return 'p' + randomBytes(5).toString('hex');
}

const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}
