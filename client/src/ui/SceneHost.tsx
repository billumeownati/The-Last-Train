import { useEffect, useRef } from 'react';
import { toast, ui, useUI } from '../store';
import { net } from '../net';
import { voice } from '../voice';
import { createTrainScene } from '../scene/TrainScene';

type SceneApi = ReturnType<typeof createTrainScene>;

let sceneSingleton: SceneApi | null = null;
export const getScene = () => sceneSingleton;

const THEME_FALLBACK = ['forest', 'flood', 'burning', 'snow', 'dark'];

/** Scenery for the current station (the lobby and briefing show station 1's forest). */
function themeFor(view: ReturnType<typeof ui.get>['view']): string {
  if (!view) return 'forest';
  const idx = Math.max(0, view.station - 1);
  return view.stations[idx]?.theme ?? THEME_FALLBACK[idx] ?? 'forest';
}

/** The persistent 3D stage behind every screen. */
export function SceneHost() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const view = useUI((s) => s.view);
  const low = useUI((s) => s.lowGfx);
  const overview = useUI((s) => s.overview);
  const speaking = useUI((s) => s.speaking);
  const painted = useUI((s) => s.sceneStation);
  const wanted = themeFor(view);
  const ready = painted === wanted;
  const ingame = !!view && ['roam', 'event', 'dining', 'finalVote'].includes(view.phase);

  useEffect(() => {
    if (!canvasRef.current || !layerRef.current) return;
    let scene: SceneApi;
    try {
      scene = createTrainScene(canvasRef.current, layerRef.current, {
        onHotspot: async (id: string) => {
          const v = ui.get().view;
          const mine = v?.players.find((p) => p.id === v.youId);
          if (mine?.activity?.objectId === id) {
            net.cancel();
            return;
          }
          const r = await net.act(id);
          if (!r.ok && r.error) toast('error', r.error);
        },
      });
    } catch (e) {
      console.error(e);
      toast('error', 'This browser could not start WebGL, so the train cannot be drawn.');
      return;
    }
    sceneSingleton = scene;
    scene.setQuality(ui.get().lowGfx);
    const v = ui.get().view;
    const first = themeFor(v);
    void scene.setStation(first).then(() => ui.set({ sceneStation: first }));
    (window as unknown as { __scene?: SceneApi }).__scene = scene; // handy when debugging in the console
    if (v) scene.sync(v, ui.get().offset);
    return () => {
      scene.dispose();
      sceneSingleton = null;
    };
  }, []);

  useEffect(() => {
    const s = sceneSingleton;
    if (!s || !view) return;
    s.sync(view, ui.get().offset);
    voice.sync(view);
    const me = view.players.find((p) => p.id === view.youId);
    // camera
    if (['roam', 'event', 'dining', 'finalVote'].includes(view.phase) && me) {
      const car = me.carriage ?? me.transit?.to ?? 'sleepers';
      s.setMode(overview ? { kind: 'overview' } : { kind: 'car', car });
    } else if (view.phase === 'ending') s.setMode({ kind: 'overview' });
    else s.setMode({ kind: 'title' });
    s.setLabels(['roam', 'event', 'dining', 'finalVote', 'ending'].includes(view.phase));
    // scenery for this station; paint the next one while there is time
    const themes = view.stations.map((x) => x.theme);
    const idx = Math.max(0, view.station - 1);
    const theme = themeFor(view);
    const next = themes[idx + 1];
    if (ui.get().sceneStation !== theme) void s.setStation(theme).then(() => ui.set({ sceneStation: theme }));
    if (next && ['event', 'dining'].includes(view.phase)) void s.prepareStation(next);
    s.keepOnly(next && ['event', 'dining'].includes(view.phase) ? [theme, next] : [theme]);
  }, [view, overview]);

  useEffect(() => {
    sceneSingleton?.setQuality(low);
  }, [low]);
  // a gentle, one-time nudge if the machine is struggling
  useEffect(() => {
    let slow = 0;
    let told = false;
    const id = setInterval(() => {
      const st = sceneSingleton?.stats;
      if (!st || ui.get().lowGfx || told || document.hidden) return;
      slow = st.fps < 22 && ui.get().sceneStation ? slow + 1 : 0;
      if (slow >= 6) {
        told = true;
        toast('info', 'Choppy? Try the "Low gfx" button in the top bar.');
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    sceneSingleton?.setSpeaking(new Set(speaking));
  }, [speaking]);

  return (
    <div className={'scene' + (ingame ? ' ingame' : '')}>
      <canvas ref={canvasRef} />
      <div className="layer" ref={layerRef} />
      <div className="vignette" />
      <div className="grain" />
      <div className={'loading' + (ready ? ' done' : '')}>
        <b>THE LAST TRAIN</b>
        <span>Painting scenery…</span>
      </div>
    </div>
  );
}
