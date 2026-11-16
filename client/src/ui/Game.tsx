import { useEffect, useRef, useState } from 'react';
import { CARRIAGES, CARRIAGE_NAMES, LUGGAGE_CAPACITY, type CarriageId, type GameView } from '@tlt/shared';
import { net } from '../net';
import { serverNow, toast, ui, useUI, type Panel } from '../store';
import { voice } from '../voice';
import { MusicControl } from './Music';
import { CHAR_COLOR, Countdown, Swatch, carName, me, myCarriage, useTick, useView } from './bits';

/* ------------------------------------------------------------------ */
/* top bar                                                             */
/* ------------------------------------------------------------------ */

export function TopBar() {
  const view = useView();
  const overview = useUI((s) => s.overview);
  const low = useUI((s) => s.lowGfx);
  const mic = useUI((s) => s.mic);
  const muted = useUI((s) => s.micMuted);
  const st = view.stations[Math.max(0, view.station - 1)];
  const phaseName =
    view.phase === 'roam' ? 'Roam the train' : view.phase === 'event' ? 'Something happens' : view.phase === 'dining' ? (view.dining?.subphase === 'vote' ? 'The ballot' : 'Dinner') : view.phase === 'finalVote' ? 'The final vote' : '';
  return (
    <div className="topbar">
      <div>
        <div className="badge">
          Station {view.station} of {view.stations.length}
        </div>
        <div className="stname">{st?.name}</div>
        <div className="dots">
          {view.stations.map((_, i) => (
            <i key={i} className={i + 1 < view.station ? 'on' : i + 1 === view.station ? 'cur' : ''} />
          ))}
        </div>
      </div>
      <div className="phase" style={{ marginLeft: 24 }}>
        <div className="pn">{phaseName}</div>
        <div className="tm">
          <Countdown endsAt={view.phaseEndsAt} />
        </div>
      </div>
      <div className="tools">
        <span className={'voice-state ' + (view.voiceAllowed ? 'on' : 'off')}>{view.voiceAllowed ? 'Voice on' : 'Voice off · roaming'}</span>
        {mic === 'on' ? (
          <button className="btn ghost small" onClick={() => voice.setMuted(!muted)}>
            {muted ? '🔇 Unmute' : '🎙 Mute'}
          </button>
        ) : (
          <button className="btn ghost small" onClick={() => void voice.enable()}>
            🎙 Enable mic
          </button>
        )}
        <MusicControl />
        <button className={'btn ghost small' + (overview ? ' on' : '')} onClick={() => ui.set({ overview: !overview })}>
          Whole train
        </button>
        <button className={'btn ghost small' + (low ? ' on' : '')} title="Cheaper graphics for slower computers" onClick={() => { save_low(!low); }}>
          Low gfx
        </button>
        <button className="btn ghost small" onClick={() => ui.set({ rules: true })}>
          ?
        </button>
      </div>
    </div>
  );
}

function save_low(v: boolean) {
  ui.set({ lowGfx: v });
  try {
    localStorage.setItem('tlt.low', JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* walking between carriages                                           */
/* ------------------------------------------------------------------ */

function navState(view: GameView, to: CarriageId): { ok: boolean; why: string } {
  const m = me(view);
  if (!['roam', 'event'].includes(view.phase)) return { ok: false, why: 'dinner is served' };
  if (m.transit) return { ok: false, why: 'walking…' };
  if (m.confined && view.phase === 'roam') return { ok: false, why: 'door locked' };
  if (!m.connected) return { ok: false, why: 'asleep' };
  if (to === 'engine' && !view.effects.engineUnlocked) return { ok: false, why: 'locked' };
  if (view.effects.closed.includes(to)) return { ok: false, why: 'shut' };
  if (to === 'luggage') {
    const n = view.players.filter((p) => p.id !== m.id && ((p.carriage === 'luggage' && !p.transit) || p.transit?.to === 'luggage')).length;
    if (n >= LUGGAGE_CAPACITY) return { ok: false, why: 'full (2 max)' };
  }
  return { ok: true, why: '' };
}

export function NavButtons() {
  const view = useView();
  const car = me(view).carriage;
  if (!car) return null;
  const i = CARRIAGES.indexOf(car);
  const toward = (c: CarriageId | undefined, side: 'left' | 'right') => {
    if (!c) return null;
    const s = navState(view, c);
    return (
      <button
        className={'navbtn ' + side}
        disabled={!s.ok}
        onClick={async () => {
          const r = await net.move(c);
          if (!r.ok && r.error) toast('error', r.error);
        }}
      >
        <span className="dir">{side === 'left' ? '◀' : '▶'}</span>
        <span className="nm">{CARRIAGE_NAMES[c]}</span>
        {!s.ok && s.why && <span className="why">{s.why}</span>}
      </button>
    );
  };
  return (
    <>
      {toward(CARRIAGES[i + 1], 'left')}
      {toward(CARRIAGES[i - 1], 'right')}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* bottom bar                                                          */
/* ------------------------------------------------------------------ */

export function ActionBar() {
  const view = useView();
  const m = me(view);
  const car = myCarriage(view);
  useTick(200);
  const act = m.activity;
  const obj = act ? view.objects.find((o) => o.id === act.objectId) : null;
  const conductorHere = !!view.conductor && !m.transit && view.conductor.carriage === m.carriage && ['roam', 'event', 'dining'].includes(view.phase);
  const canReady = ['roam', 'event'].includes(view.phase) || (view.phase === 'dining' && (!view.dining || view.dining.subphase === 'talk'));
  const conn = view.players.filter((p) => p.connected);
  const readyN = conn.filter((p) => p.ready).length;
  const u = act ? Math.min(1, Math.max(0, (serverNow() - act.startedAt) / Math.max(1, act.endsAt - act.startedAt))) : 0;
  const readyLabel = view.phase === 'dining' ? (view.station >= view.stations.length ? 'Ready for the final vote' : 'Ready for the ballot') : 'Ready to move on';
  return (
    <div className="actionbar">
      {m.transit ? (
        <div className="where">
          Walking to the <b>{carName(m.transit.to)}</b>…
        </div>
      ) : (
        <div className="where">
          You are in the <b>{carName(car)}</b>
          {m.confined && view.phase === 'roam' ? ' · door locked' : ''}
        </div>
      )}
      {act && (
        <div className="progress">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, font: '13px var(--sans)' }}>
            <span>
              {act.kind === 'gaze' ? 'Gazing through' : 'Searching'} <b style={{ fontFamily: 'var(--serif)' }}>{obj?.label ?? '…'}</b>
            </span>
            <button className="btn ghost small" onClick={() => net.cancel()}>
              Stop
            </button>
          </div>
          <div className="bar">
            <b style={{ width: `${u * 100}%` }} />
          </div>
        </div>
      )}
      {conductorHere && (
        <button className="btn brass" disabled={view.questionAsked} onClick={() => ui.set({ conductorMenu: true })}>
          {view.questionAsked ? 'Conductor: no more questions this station' : 'Speak to the Conductor'}
        </button>
      )}
      {canReady && (
        <button className={'btn ' + (m.ready ? 'on' : 'ghost')} onClick={() => net.ready(!m.ready)}>
          {m.ready ? '✓ ' : ''}
          {readyLabel} ({readyN}/{conn.length})
        </button>
      )}
    </div>
  );
}

export function EffectsList() {
  const view = useView();
  const e = view.effects;
  const items: string[] = [];
  if (e.lockedSearch.includes('sleepers')) items.push('The Sleeper Car is dark: nothing can be searched there.');
  for (const c of e.closed) if (c !== 'engine') items.push(`The ${CARRIAGE_NAMES[c]} is shut.`);
  if (e.slowWalk > 1) items.push('The gangways are slow: walking takes longer.');
  if (e.slowSearch > 1) items.push('Numb fingers: searching takes longer.');
  if (e.lockVision) items.push('The viewing glass is frosted over.');
  const m = me(view);
  if (m.confined && view.phase === 'roam') items.push('You are locked in your cabin for this leg. Search only your own cabin.');
  if (view.phase === 'dining' && view.dining && view.dining.subphase === 'talk' && !view.dining.result) return <DiningHint />;
  if (!items.length) return null;
  return (
    <div className="effects">
      {items.map((t) => (
        <div className="effect" key={t}>
          {t}
        </div>
      ))}
    </div>
  );
}

function DiningHint() {
  const view = useView();
  const d = view.dining!;
  if (!d.options.length) return null;
  return (
    <div className="effects" style={{ maxWidth: 330 }}>
      <div className="effect" style={{ background: '#17151df2', borderColor: 'var(--brass)', color: 'var(--ink)' }}>
        <div className="label" style={{ marginBottom: 4 }}>
          Tonight's choices (the ballot opens at the end of dinner)
        </div>
        {d.options.map((o) => (
          <div key={o.id} style={{ margin: '4px 0', fontFamily: 'var(--serif)', fontSize: 13 }}>
            • {o.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* side panel                                                          */
/* ------------------------------------------------------------------ */

const TABS: [Panel, string][] = [
  ['case', 'Case file'],
  ['card', 'My card'],
  ['people', 'People'],
  ['chat', 'Chat'],
  ['log', 'Log'],
];

export function SidePanel() {
  const panel = useUI((s) => s.panel);
  const unread = useUI((s) => s.unread);
  return (
    <div className="side-panel">
      <div className="ptabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={panel === id ? 'on' : ''} onClick={() => ui.set({ panel: id, ...(id === 'chat' ? { unread: 0 } : {}) })}>
            {label}
            {id === 'chat' && unread > 0 && panel !== 'chat' && <span className="dotn">{unread}</span>}
          </button>
        ))}
      </div>
      {panel === 'chat' ? <ChatPanel /> : <div className="pbody">{panel === 'case' ? <CaseTab /> : panel === 'card' ? <CardTab /> : panel === 'people' ? <PeopleTab /> : <LogTab />}</div>}
    </div>
  );
}

function CaseTab() {
  const view = useView();
  const car = myCarriage(view);
  const canShow = car === 'dining' && !me(view).transit && ['roam', 'event', 'dining', 'finalVote'].includes(view.phase);
  const notes = [...view.notes].reverse().filter((n) => n.kind !== 'find');
  return (
    <>
      <div className="sect">
        <span>Clues you hold</span>
        <span>{view.clues.length}</span>
      </div>
      {view.clues.length === 0 && <div className="empty">Nothing yet. Click the glowing rings in a carriage to search. Whatever you find is yours alone, until you choose to show it.</div>}
      {view.clues.map((c, i) => (
        <div key={c.id} className={'paper clue tilt' + ((i % 3) + 1)}>
          {c.revealed && <span className="stamp">SHOWN</span>}
          <h4>{c.title}</h4>
          <p>{c.text}</p>
          <div className="src">
            Found at station {c.foundStation} · {c.source}
          </div>
          <div className="actions">
            <button
              className="btn small"
              disabled={!canShow && !view.pendingReveal}
              title={canShow ? 'Lay it on the table for everyone in the dining car' : 'You can only show a clue in the Dining Car'}
              onClick={async () => {
                const r = await net.reveal(c.id);
                if (!r.ok && r.error) toast('error', r.error);
              }}
            >
              Show to the table
            </button>
          </div>
        </div>
      ))}
      <div className="sect">
        <span>Private notes</span>
        <span>{notes.length}</span>
      </div>
      {notes.length === 0 && <div className="empty">Visions, hints and the conductor's answers will be kept here.</div>}
      {notes.map((n) => (
        <div key={n.id} className={'paper note ' + n.kind}>
          <h4>{n.title}</h4>
          <p>{n.text}</p>
          <div className="when">Station {n.station}</div>
        </div>
      ))}
    </>
  );
}

function CardTab() {
  const view = useView();
  const c = view.me;
  if (!c) return <div className="empty">Your card will be dealt when the journey begins.</div>;
  return (
    <>
      <div className="paper tilt1">
        <div className="idcard">
          <div className="face">
            <i style={{ background: CHAR_COLOR[c.characterId] }} />
          </div>
          <div>
            <div className="ti">{c.characterTitle}</div>
            <div className="nm">{c.characterName}</div>
          </div>
        </div>
        <p style={{ marginTop: 8 }}>{c.blurb}</p>
      </div>
      <div className="paper tilt2">
        <h4>Your memory</h4>
        <p>{c.memory}</p>
      </div>
      <div className="paper tilt3">
        <span className="stamp">SAY THIS</span>
        <h4>Your lie</h4>
        <p>{c.lie}</p>
      </div>
      <div className="paper tilt1">
        <h4>Your goal</h4>
        <p>{c.goalText}</p>
      </div>
      {c.stowawayConfirmed && c.truth && (
        <div className="paper hint tilt2">
          <span className="stamp">THE STOWAWAY</span>
          <h4>What the conductor told you</h4>
          <p>{c.truth}</p>
        </div>
      )}
    </>
  );
}

function PeopleTab() {
  const view = useView();
  const speaking = useUI((s) => s.speaking);
  return (
    <>
      <div className="sect">
        <span>Passengers</span>
        <span>{view.players.length}</span>
      </div>
      {view.players.map((p) => (
        <div key={p.id} className={'who-row' + (p.id === view.youId ? ' me' : '') + (speaking.includes(p.id) ? ' talk' : '')}>
          <Swatch id={p.characterId} label={p.name[0]?.toUpperCase()} />
          <div className="info">
            <div className="nm">
              {p.name}
              {p.id === view.youId ? ' (you)' : ''} {p.isHost && <span className="crown">♛</span>}
            </div>
            <div className="sub">
              {p.characterName}
              {p.characterTitle ? `, ${p.characterTitle}` : ''}
            </div>
            <div className="sub">
              {!p.connected ? 'asleep in their cabin' : p.transit ? `walking to the ${carName(p.transit.to)}` : carName(p.carriage)}
              {p.confined && view.phase === 'roam' ? ' · locked in' : ''}
              {p.voiceOn ? ' · 🎙' : ''}
              {p.ready ? ' · ready' : ''}
            </div>
          </div>
        </div>
      ))}
      {view.conductor && (
        <div className="who-row">
          <span className="sw" style={{ background: '#1d3a30' }}>
            C
          </span>
          <div className="info">
            <div className="nm">The Conductor</div>
            <div className="sub">in the {carName(view.conductor.carriage)}</div>
          </div>
        </div>
      )}
    </>
  );
}

function LogTab() {
  const view = useView();
  const items = [...view.feed].reverse();
  return (
    <>
      <div className="sect">
        <span>What everyone knows</span>
      </div>
      {items.length === 0 && <div className="empty">The public record of the journey will appear here.</div>}
      {items.map((f) => (
        <div key={f.id} className={'logitem ' + f.kind}>
          {f.text}
        </div>
      ))}
    </>
  );
}

function ChatPanel() {
  const view = useView();
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const names = new Map(view.players.map((p) => [p.id, p]));
  const m = me(view);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [view.chat.length]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    net.chat(t);
    setText('');
  };
  const hearing = ['lobby', 'briefing', 'ending'].includes(view.phase) ? 'Everyone can read this.' : m.transit ? 'You are between carriages.' : `Only passengers in the ${carName(m.carriage)} can read this.`;
  return (
    <>
      <div className="chathint">{hearing}</div>
      <div className="chatlog" ref={box}>
        {view.chat.length === 0 && <div className="empty">Nobody has said anything here yet.</div>}
        {view.chat.map((c) => {
          const p = c.fromId ? names.get(c.fromId) : null;
          if (c.kind === 'system') return <div key={c.id} className="msg sys">{c.text}</div>;
          if (c.kind === 'reveal')
            return (
              <div key={c.id} className="msg reveal">
                <span className="who">{c.fromName}</span>
                {c.text}
                {c.clue && (
                  <div className="paper tilt3" style={{ marginTop: 8 }}>
                    <h4>{c.clue.title}</h4>
                    <p>{c.clue.text}</p>
                  </div>
                )}
              </div>
            );
          return (
            <div key={c.id} className={'msg' + (c.fromId === view.youId ? ' me' : '')}>
              <span className="who">{p ? p.name : c.fromName}</span>
              {c.text}
            </div>
          );
        })}
      </div>
      <div className="chatbox">
        <input className="field" value={text} maxLength={280} placeholder="Say something…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn small" onClick={send}>
          Send
        </button>
      </div>
    </>
  );
}
