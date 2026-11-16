/**
 * Generative background music. No audio files: everything is synthesised with the Web Audio API,
 * so there is nothing to license, download or host.
 *
 * Each station has a mood (key, scale, chord loop, timbre, reverb). A mood is a slow pad + soft bass + a sparse,
 * randomly walking bell melody, so it never loops audibly. The phase of the game (roam / event / dinner / ballot)
 * is a "layer" that tilts the same music: tense and dim at events and ballots, warmer with a soft bass at dinner.
 * Changing station crossfades to a new track over a few seconds.
 */

export type Theme = 'forest' | 'flood' | 'burning' | 'snow' | 'dark' | 'title' | 'ending';
export type Layer = 'roam' | 'event' | 'dining' | 'vote';

interface ThemeCfg {
  label: string;
  /** MIDI note of the tonic (pad register) */
  root: number;
  scale: number[];
  /** chord roots as scale degrees (0-based) */
  prog: number[];
  chordSec: number;
  stepSec: number;
  melodyP: number;
  /** semitones above the root for the melody register */
  melOct: number;
  padWave: OscillatorType;
  cutoff: number;
  /** pad detune in cents */
  detune: number;
  padGain: number;
  bellDecay: number;
  bellGain: number;
  /** reverb send 0-1 */
  reverb: number;
  /** echo send 0-1 */
  echo: number;
  /** a very quiet low pulse (embers) */
  pulse?: boolean;
  /** chord voicing: suspended (2nd instead of 3rd) for a cold, open sound */
  sus?: boolean;
  /** loudness trim so every station sits at about the same level */
  level: number;
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];

export const THEMES: Record<Theme, ThemeCfg> = {
  title: { label: 'Platform 9: a slow, warm drift', root: 50, scale: DORIAN, prog: [0, 3, 0, 4], chordSec: 10, stepSec: 1.7, melodyP: 0.4, melOct: 24, padWave: 'triangle', cutoff: 1800, detune: 6, padGain: 1, bellDecay: 4, bellGain: 0.5, reverb: 0.55, echo: 0.25, level: 1.0 },
  forest: { label: 'Harrow Wood: sunlit and wistful', root: 55, scale: IONIAN, prog: [0, 4, 5, 3], chordSec: 10, stepSec: 1.5, melodyP: 0.45, melOct: 24, padWave: 'triangle', cutoff: 2200, detune: 5, padGain: 1, bellDecay: 3.2, bellGain: 0.55, reverb: 0.5, echo: 0.3, level: 1.1 },
  flood: { label: 'The Vell Ford: water and violet light', root: 52, scale: LYDIAN, prog: [0, 1, 0, 4], chordSec: 12, stepSec: 2, melodyP: 0.3, melOct: 24, padWave: 'sine', cutoff: 1400, detune: 12, padGain: 1.15, bellDecay: 5, bellGain: 0.5, reverb: 0.8, echo: 0.45, level: 1.05 },
  burning: { label: 'Calder: embers, low and uneasy', root: 48, scale: PHRYGIAN, prog: [0, 0, 1, 0], chordSec: 9, stepSec: 2.2, melodyP: 0.22, melOct: 12, padWave: 'sawtooth', cutoff: 650, detune: 8, padGain: 0.6, bellDecay: 3, bellGain: 0.5, reverb: 0.5, echo: 0.3, pulse: true, level: 1.1 },
  snow: { label: 'Harrow Pass: cold, clear and still', root: 57, scale: AEOLIAN, prog: [0, 5, 2, 4], chordSec: 14, stepSec: 2.4, melodyP: 0.3, melOct: 24, padWave: 'sine', cutoff: 2600, detune: 7, padGain: 1.1, bellDecay: 6, bellGain: 0.5, reverb: 0.85, echo: 0.4, sus: true, level: 0.72 },
  dark: { label: 'The Last Platform: almost silence', root: 40, scale: AEOLIAN, prog: [0, 0, 5, 0], chordSec: 16, stepSec: 3.2, melodyP: 0.16, melOct: 24, padWave: 'sine', cutoff: 800, detune: 5, padGain: 1.2, bellDecay: 7, bellGain: 0.55, reverb: 0.9, echo: 0.4, level: 0.52 },
  ending: { label: 'The doors close: a quiet farewell', root: 53, scale: IONIAN, prog: [0, 5, 3, 4], chordSec: 12, stepSec: 2, melodyP: 0.35, melOct: 24, padWave: 'triangle', cutoff: 1700, detune: 6, padGain: 1, bellDecay: 5, bellGain: 0.5, reverb: 0.75, echo: 0.35, level: 0.78 },
};

interface LayerCfg {
  cutoffMul: number;
  melodyMul: number;
  stepMul: number;
  ext: boolean;
  bassPlucks: boolean;
  tension: boolean;
  heartbeat: boolean;
}
const LAYERS: Record<Layer, LayerCfg> = {
  roam: { cutoffMul: 1, melodyMul: 1, stepMul: 1, ext: false, bassPlucks: false, tension: false, heartbeat: false },
  dining: { cutoffMul: 1.3, melodyMul: 1.25, stepMul: 0.85, ext: true, bassPlucks: true, tension: false, heartbeat: false },
  event: { cutoffMul: 0.6, melodyMul: 0.4, stepMul: 1.2, ext: false, bassPlucks: false, tension: true, heartbeat: false },
  vote: { cutoffMul: 0.7, melodyMul: 0.15, stepMul: 1.3, ext: false, bassPlucks: false, tension: true, heartbeat: true },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ */
/* effects shared by all tracks                                        */
/* ------------------------------------------------------------------ */

interface Fx {
  mix: GainNode;
  reverb: ConvolverNode;
  reverbIn: GainNode;
  echoIn: GainNode;
}

function impulse(ctx: BaseAudioContext, secs = 3.4, decay = 2.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const x = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      y += (x - y) * 0.3; // soften the highs so the tail is warm, not hissy
      d[i] = y;
    }
  }
  return buf;
}

function makeFx(ctx: BaseAudioContext): Fx {
  const mix = ctx.createGain();
  mix.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.ratio.value = 3;
  mix.connect(comp).connect(ctx.destination);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx);
  const reverbIn = ctx.createGain();
  reverbIn.connect(reverb);
  reverb.connect(mix);
  const echoIn = ctx.createGain();
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.46;
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  echoIn.connect(delay);
  delay.connect(lp);
  lp.connect(fb);
  fb.connect(delay);
  lp.connect(mix);
  lp.connect(reverbIn);
  return { mix, reverb, reverbIn, echoIn };
}

/* ------------------------------------------------------------------ */
/* a playing mood                                                      */
/* ------------------------------------------------------------------ */

class Track {
  readonly bus: GainNode;
  private chordIdx = 0;
  private stepIdx = 0;
  private nextChord: number;
  private nextStep: number;
  private nextBeat: number;
  private melIdx = 4;
  private layer: LayerCfg = LAYERS.roam;

  constructor(
    private ctx: BaseAudioContext,
    private fx: Fx,
    readonly cfg: ThemeCfg,
    t0: number,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(fx.mix);
    const rs = ctx.createGain();
    rs.gain.value = cfg.reverb;
    this.bus.connect(rs).connect(fx.reverbIn);
    const es = ctx.createGain();
    es.gain.value = cfg.echo * 0.7;
    this.bus.connect(es).connect(fx.echoIn);
    this.nextChord = t0 + 0.1;
    this.nextStep = t0 + 2.5;
    this.nextBeat = t0 + 1;
  }

  setLayer(name: Layer) {
    this.layer = LAYERS[name];
  }

  /** Queue everything that should start before `until` (audio-clock seconds). */
  schedule(until: number) {
    while (this.nextChord < until) {
      this.playChord(this.nextChord);
      this.nextChord += this.cfg.chordSec;
      this.chordIdx++;
    }
    while (this.nextStep < until) {
      this.step(this.nextStep);
      this.nextStep += this.cfg.stepSec * this.layer.stepMul * rnd(0.9, 1.15);
      this.stepIdx++;
    }
    while (this.layer.heartbeat && this.nextBeat < until) {
      this.thump(this.nextBeat);
      this.nextBeat += 1.05;
    }
    if (!this.layer.heartbeat && this.nextBeat < until) this.nextBeat = until + 0.5;
  }

  private degNote(d: number): number {
    const s = this.cfg.scale;
    const o = Math.floor(d / 7);
    return s[((d % 7) + 7) % 7] + 12 * o;
  }

  private chordNotes(d: number): number[] {
    const n = this.cfg.sus ? [d, d + 1, d + 4] : [d, d + 2, d + 4];
    if (this.layer.ext) n.push(d + 6, d + 8);
    return n.map((x) => this.cfg.root + this.degNote(x));
  }

  private playChord(t: number) {
    const { ctx, cfg } = this;
    const d = cfg.prog[this.chordIdx % cfg.prog.length];
    const dur = cfg.chordSec;
    const rel = dur * 0.4;
    const att = Math.min(3, dur * 0.3);
    const end = t + dur + rel;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cfg.cutoff * this.layer.cutoffMul;
    filt.Q.value = 0.3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.05 * cfg.padGain, t + att);
    env.gain.setValueAtTime(0.05 * cfg.padGain, t + dur);
    env.gain.linearRampToValueAtTime(0.0001, end);
    filt.connect(env).connect(this.bus);
    const notes = this.chordNotes(d);
    for (const m of notes) {
      for (const sign of [-1, 1]) {
        const o = ctx.createOscillator();
        o.type = cfg.padWave;
        o.frequency.value = mtof(m);
        o.detune.value = sign * cfg.detune;
        const g = ctx.createGain();
        g.gain.value = 1 / notes.length;
        o.connect(g).connect(filt);
        o.start(t);
        o.stop(end + 0.1);
      }
    }
    // soft bass on the chord root
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = mtof(cfg.root + this.degNote(d) - 12);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.07, t + att);
    bg.gain.setValueAtTime(0.07, t + dur);
    bg.gain.linearRampToValueAtTime(0.0001, end);
    b.connect(bg).connect(this.bus);
    b.start(t);
    b.stop(end + 0.1);
    // tension: a quiet minor second a octave below the root, beating slowly
    if (this.layer.tension) {
      for (const semi of [0, 1]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = mtof(cfg.root - 12 + semi);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.022, t + att);
        g.gain.setValueAtTime(0.022, t + dur);
        g.gain.linearRampToValueAtTime(0.0001, end);
        o.connect(g).connect(this.bus);
        o.start(t);
        o.stop(end + 0.1);
      }
    }
  }

  private step(t: number) {
    const { cfg } = this;
    const d = cfg.prog[this.chordIdx % cfg.prog.length];
    if (Math.random() < cfg.melodyP * this.layer.melodyMul) {
      // random walk on the scale, leaning toward chord tones
      const chord = [d, d + 2, d + 4].map((x) => ((x % 7) + 7) % 7);
      let i = this.melIdx + Math.round(rnd(-2.2, 2.2));
      i = Math.max(0, Math.min(11, i));
      if (Math.random() < 0.55) {
        let best = i;
        for (let k = 0; k <= 11; k++) if (chord.includes(k % 7) && Math.abs(k - i) < Math.abs(best - i)) best = k;
        i = best;
      }
      if (i === this.melIdx && Math.random() < 0.6) i = Math.max(0, Math.min(11, i + (Math.random() < 0.5 ? 1 : -1)));
      this.melIdx = i;
      this.bell(t + rnd(0, 0.12), cfg.root + cfg.melOct + this.degNote(i - 4));
    }
    if (this.layer.bassPlucks && this.stepIdx % 2 === 0) {
      const m = cfg.root - 12 + this.degNote(Math.random() < 0.65 ? d : d + 4);
      this.pluck(t, m);
    }
  }

  private bell(t: number, midi: number) {
    const { ctx, cfg } = this;
    const dec = cfg.bellDecay;
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.55, 0.55);
    pan.connect(this.bus);
    for (const [mul, gain] of [[1, 1], [2.005, 0.25], [3.01, 0.07]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = mtof(midi) * mul;
      const g = ctx.createGain();
      const peak = 0.11 * cfg.bellGain * gain;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec / mul);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + dec / mul + 0.1);
    }
  }

  private pluck(t: number, midi: number) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 1.2);
  }

  private thump(t: number) {
    const { ctx } = this;
    for (const dt of [0, 0.3]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(70, t + dt);
      o.frequency.exponentialRampToValueAtTime(42, t + dt + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.linearRampToValueAtTime(dt ? 0.03 : 0.05, t + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.22);
      o.connect(g).connect(this.bus);
      o.start(t + dt);
      o.stop(t + dt + 0.3);
    }
  }

  fade(to: number, secs: number, now: number) {
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.linearRampToValueAtTime(to, now + secs);
  }

  dispose() {
    try {
      this.bus.disconnect();
    } catch {
      /* already gone */
    }
  }
}

/* ------------------------------------------------------------------ */
/* the engine                                                          */
/* ------------------------------------------------------------------ */

const FADE_IN = 3.5;
const FADE_OUT = 4;
const AHEAD = 2.5; // seconds scheduled ahead. Generous because background tabs throttle timers to ~1 s.

class MusicEngine {
  private ctx: AudioContext | null = null;
  private fx: Fx | null = null;
  private track: Track | null = null;
  private theme: Theme | null = null;
  private layer: Layer = 'roam';
  private want: { theme: Theme; layer: Layer } | null = null;
  private vol = 0.6;
  private on = true;
  private duck = false;
  private timer: number | null = null;
  /** For the settings panel */
  onLabel: ((label: string) => void) | null = null;

  /** Must be called from a user gesture the first time (autoplay policy). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.fx = makeFx(this.ctx);
      this.applyGain(true);
      this.timer = window.setInterval(() => this.tick(), 400);
    }
    if (this.on && this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.want) this.setMood(this.want.theme, this.want.layer);
  }

  private tick() {
    if (!this.ctx || !this.track || this.ctx.state !== 'running') return;
    this.track.schedule(this.ctx.currentTime + AHEAD);
  }

  setMood(theme: Theme, layer: Layer) {
    this.want = { theme, layer };
    this.layer = layer;
    if (!this.ctx || !this.fx) return;
    if (this.track && this.theme === theme) {
      this.track.setLayer(layer);
      return;
    }
    const now = this.ctx.currentTime;
    const old = this.track;
    if (old) {
      old.fade(0, FADE_OUT, now);
      window.setTimeout(() => old.dispose(), (FADE_OUT + 4) * 1000);
    }
    const t = new Track(this.ctx, this.fx, THEMES[theme], now);
    t.setLayer(layer);
    t.fade(THEMES[theme].level, old ? FADE_IN : 2, now);
    this.track = t;
    this.theme = theme;
    this.onLabel?.(THEMES[theme].label);
    t.schedule(now + AHEAD);
  }

  get label(): string {
    return this.theme ? THEMES[this.theme].label : '';
  }

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    this.applyGain(false);
  }

  setEnabled(on: boolean) {
    this.on = on;
    this.applyGain(false);
    if (!this.ctx) return;
    if (on) {
      void this.ctx.resume();
    } else {
      // stop burning CPU once the fade-out has finished
      const ctx = this.ctx;
      window.setTimeout(() => {
        if (!this.on) void ctx.suspend();
      }, 600);
    }
  }

  /** Lower the music while someone is talking so voice chat stays clear. */
  setDuck(d: boolean) {
    if (this.duck === d) return;
    this.duck = d;
    this.applyGain(false);
  }

  private applyGain(immediate: boolean) {
    if (!this.ctx || !this.fx) return;
    const g = this.on ? Math.pow(this.vol, 1.6) * (this.duck ? 0.45 : 1) : 0;
    const p = this.fx.mix.gain;
    if (immediate) p.value = g;
    else p.setTargetAtTime(g, this.ctx.currentTime, 0.25);
  }

  /**
   * Debug/QA: render `secs` seconds of a mood offline and report peak and RMS (so levels can be checked without ears).
   * Available in the console as __music.measure('forest', 'roam').
   */
  async measure(theme: Theme, layer: Layer = 'roam', secs = 40) {
    const sr = 22050;
    const ctx = new OfflineAudioContext(2, sr * secs, sr);
    const fx = makeFx(ctx);
    const tr = new Track(ctx, fx, THEMES[theme], 0);
    tr.setLayer(layer);
    tr.bus.gain.value = THEMES[theme].level;
    tr.schedule(secs);
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0;
    let sum = 0;
    let n = 0;
    for (let i = sr * 8; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      sum += a * a;
      n++;
    }
    return { theme, layer, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4), rmsDb: +(20 * Math.log10(Math.sqrt(sum / n) || 1e-6)).toFixed(1) };
  }
}

export const music = new MusicEngine();
(window as unknown as { __music?: MusicEngine }).__music = music;
