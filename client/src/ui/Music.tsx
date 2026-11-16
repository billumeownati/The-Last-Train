import { useEffect, useRef, useState } from 'react';
import type { GameView } from '@tlt/shared';
import { music, THEMES, type Layer, type Theme } from '../audio';
import { setMusic, useUI } from '../store';

/** Which mood fits the game right now: the station's scenery theme, tilted by the phase. */
function moodFor(view: GameView | null): { theme: Theme; layer: Layer } {
  if (!view || view.phase === 'lobby' || view.phase === 'briefing') return { theme: 'title', layer: 'roam' };
  if (view.phase === 'ending') return { theme: 'ending', layer: 'roam' };
  const theme = (view.stations[Math.max(0, view.station - 1)]?.theme ?? 'forest') as Theme;
  const layer: Layer = view.phase === 'event' ? 'event' : view.phase === 'finalVote' ? 'vote' : view.phase === 'dining' ? (view.dining?.subphase === 'vote' ? 'vote' : 'dining') : 'roam';
  return { theme, layer };
}

/** Renders nothing; keeps the music engine in step with the game and the settings. */
export function MusicController() {
  const view = useUI((s) => s.view);
  const m = useUI((s) => s.music);
  const speaking = useUI((s) => s.speaking);

  // browsers only allow audio after a click or key press
  useEffect(() => {
    const go = () => music.unlock();
    window.addEventListener('pointerdown', go, { once: false });
    window.addEventListener('keydown', go, { once: false });
    return () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    };
  }, []);

  useEffect(() => {
    music.setVolume(m.vol);
    music.setEnabled(m.on);
  }, [m.vol, m.on]);

  useEffect(() => {
    music.setDuck(speaking.length > 0);
  }, [speaking]);

  const mood = moodFor(view);
  useEffect(() => {
    music.setMood(mood.theme, mood.layer);
  }, [mood.theme, mood.layer]);

  return null;
}

/** A small ♪ button with a popover: on/off and a volume slider. */
export function MusicControl() {
  const m = useUI((s) => s.music);
  const view = useUI((s) => s.view);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  const mood = moodFor(view);
  return (
    <div className="musicctl" ref={box}>
      <button className={'btn ghost small' + (m.on ? '' : ' muted')} title="Music settings" onClick={() => setOpen(!open)}>
        {m.on && m.vol > 0 ? '♪' : '♪̸'} Music
      </button>
      {open && (
        <div className="musicpop">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label">Music</span>
            <button className={'btn small ' + (m.on ? 'on' : 'ghost')} onClick={() => setMusic({ on: !m.on })}>
              {m.on ? 'On' : 'Off'}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(m.vol * 100)}
            aria-label="Music volume"
            onChange={(e) => setMusic({ vol: Number(e.target.value) / 100, on: true })}
          />
          <div className="row" style={{ justifyContent: 'space-between', font: '11px var(--sans)', color: 'var(--mute)' }}>
            <span>Quiet</span>
            <span>{Math.round(m.vol * 100)}%</span>
            <span>Loud</span>
          </div>
          <div className="nowplaying">{m.on ? `Now playing: ${THEMES[mood.theme].label}` : 'Music is off'}</div>
          <div className="nowplaying">Music ducks automatically while someone is talking.</div>
        </div>
      )}
    </div>
  );
}
