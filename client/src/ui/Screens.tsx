import { useEffect, useState } from 'react';
import { normaliseCode, NAME_MAX_LEN } from '@tlt/shared';
import { net } from '../net';
import { load, save, toast, ui, useUI } from '../store';
import { voice } from '../voice';
import { CHAR_COLOR, Countdown, Swatch, useView } from './bits';

export function MicCheck() {
  const mic = useUI((s) => s.mic);
  const level = useUI((s) => s.micLevel);
  const muted = useUI((s) => s.micMuted);
  return (
    <div className="card">
      <div className="label">Voice</div>
      <p style={{ margin: '6px 0 12px', fontSize: 14, color: '#cfc8d8' }}>
        You talk to each other out loud at dinner. While you roam the train, voice is switched off for everyone. Use headphones to avoid echo.
      </p>
      {mic === 'off' && (
        <button className="btn brass" onClick={() => void voice.enable()}>
          Enable microphone
        </button>
      )}
      {mic === 'asking' && <span className="pill">Waiting for permission…</span>}
      {mic === 'denied' && <span className="err">Microphone blocked. Allow it in the address bar, then try again.</span>}
      {mic === 'unsupported' && <span className="err">This browser has no microphone support. Use desktop Chrome or Firefox over https or localhost.</span>}
      {mic === 'on' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="meter">
            <b style={{ width: `${Math.round((muted ? 0 : level) * 100)}%` }} />
          </div>
          <div className="row">
            <span className="pill">{muted ? 'Muted' : 'Say something: the bar should move'}</span>
            <button className="btn ghost small" onClick={() => voice.setMuted(!muted)}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button className="btn ghost small" onClick={() => voice.disable()}>
              Turn off
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Landing() {
  const session = useUI((s) => s.session);
  const conn = useUI((s) => s.conn);
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(() => String(load<string>('tlt.name', '')).replace(/^"+|"+$/g, ''));
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (code) setTab('join');
  }, []);

  const go = async () => {
    setErr('');
    const n = name.trim();
    if (!n) return setErr('Tell the conductor your name.');
    if (tab === 'join' && normaliseCode(code).length !== 4) return setErr('Room codes are four letters.');
    setBusy(true);
    save('tlt.name', n);
    const r = tab === 'create' ? await net.create(n) : await net.join(code, n);
    setBusy(false);
    if (!r.ok) setErr(r.error ?? 'Could not board.');
  };

  if (session && conn !== 'offline') {
    return (
      <div className="screen landing">
        <div className="title">
          <h1>
            The Last <span>Train</span>
          </h1>
          <p>Finding your seat…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen landing">
      <div className="title">
        <h1>
          The Last <span>Train</span>
        </h1>
        <p>One of you does not belong. One of you must stay.</p>
      </div>
      <div className="card">
        <div className="tabs2">
          <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}>
            Host a train
          </button>
          <button className={tab === 'join' ? 'on' : ''} onClick={() => setTab('join')}>
            Join a train
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="label" style={{ marginBottom: 5 }}>
              Your name
            </div>
            <input className="field" value={name} maxLength={NAME_MAX_LEN} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" onKeyDown={(e) => e.key === 'Enter' && void go()} autoFocus />
          </div>
          {tab === 'join' && (
            <div>
              <div className="label" style={{ marginBottom: 5 }}>
                Room code
              </div>
              <input className="field code-in" value={code} maxLength={4} onChange={(e) => setCode(normaliseCode(e.target.value))} placeholder="ABCD" onKeyDown={(e) => e.key === 'Enter' && void go()} />
            </div>
          )}
          {err && <div className="err">{err}</div>}
          <button className="btn brass" disabled={busy || conn !== 'online'} onClick={() => void go()}>
            {conn !== 'online' ? 'Connecting…' : tab === 'create' ? 'Open a new room' : 'Board the train'}
          </button>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn ghost small" onClick={() => ui.set({ rules: true })}>
              How to play
            </button>
            <span className="pill">4–6 friends · desktop Chrome or Firefox</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Lobby() {
  const view = useView();
  const isHost = view.hostId === view.youId;
  const [busy, setBusy] = useState(false);
  const seats = Array.from({ length: view.maxPlayers });
  const link = `${location.origin}/?room=${view.code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('info', 'Invite link copied.');
    } catch {
      toast('info', link);
    }
  };
  const start = async () => {
    setBusy(true);
    const r = await net.start();
    setBusy(false);
    if (!r.ok && r.error) toast('error', r.error);
  };
  const n = view.players.length;
  return (
    <div className="screen lobby">
      <div className="col">
        <div className="title" style={{ textAlign: 'left' }}>
          <h1 style={{ fontSize: 40 }}>
            The Last <span>Train</span>
          </h1>
        </div>
        <div className="ticket">
          <small>Platform 9 · Room code</small>
          <div className="code">{view.code}</div>
          <small>Tell your friends this code</small>
        </div>
        <div className="row">
          <button className="btn ghost small" onClick={() => void copy()}>
            Copy invite link
          </button>
          <button className="btn ghost small" onClick={() => ui.set({ rules: true })}>
            How to play
          </button>
          <button className="btn ghost small" onClick={() => net.leave()}>
            Leave
          </button>
        </div>
        <div className="card">
          <div className="label" style={{ marginBottom: 8 }}>
            Passengers ({n}/{view.maxPlayers})
          </div>
          <div className="plist">
            {seats.map((_, i) => {
              const p = view.players[i];
              if (!p)
                return (
                  <div key={i} className="prow empty-seat">
                    empty seat
                  </div>
                );
              return (
                <div key={p.id} className={'prow' + (p.connected ? '' : ' off')}>
                  <Swatch />
                  <span className="nm">{p.name}</span>
                  {p.isHost && <span className="crown">♛ host</span>}
                  {p.id === view.youId && <span className="pill">you</span>}
                  <span className="grow" />
                  {p.voiceOn && <span className="pill">🎙</span>}
                  {!p.connected && <span className="sub">away</span>}
                  {isHost && p.id !== view.youId && (
                    <button className="btn ghost small" onClick={() => net.kick(p.id)}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="col">
        <MicCheck />
        <div className="card">
          {isHost ? (
            <>
              <button className="btn brass" style={{ width: '100%', padding: 14 }} disabled={!view.canStart || busy} onClick={() => void start()}>
                Start the journey
              </button>
              <p className="sub" style={{ font: '13px var(--sans)', color: 'var(--mute)', margin: '10px 0 0' }}>
                {n < view.minPlayers ? `Waiting for ${view.minPlayers - n} more passenger${view.minPlayers - n > 1 ? 's' : ''} (need ${view.minPlayers}–${view.maxPlayers}).` : view.canStart ? 'Everyone is aboard. Start when you are ready; it takes about 45 minutes.' : 'Someone is away. Wait for them to return.'}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: '#cfc8d8' }}>Waiting for the host to start the journey…</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Briefing() {
  const view = useView();
  const me = view.me;
  const meP = view.players.find((p) => p.id === view.youId)!;
  if (!me) return null;
  const conn = view.players.filter((p) => p.connected);
  const readyN = conn.filter((p) => p.ready).length;
  return (
    <div className="screen briefing">
      <div className="cards">
        <div className="label">Your private card · do not show anyone</div>
        <div className="paper tilt1">
          <div className="idcard">
            <div className="face">
              <i style={{ background: CHAR_COLOR[me.characterId] }} />
            </div>
            <div>
              <div className="ti">{me.characterTitle}</div>
              <div className="nm">{me.characterName}</div>
              <div style={{ fontSize: 12 }}>{me.blurb}</div>
            </div>
          </div>
        </div>
        <div className="paper tilt2">
          <h4>Your memory of that night</h4>
          <p>{me.memory}</p>
        </div>
        <div className="paper tilt3">
          <span className="stamp">SAY THIS</span>
          <h4>Your lie</h4>
          <p>{me.lie}</p>
        </div>
        <div className="paper tilt1">
          <h4>Your goal at the last platform</h4>
          <p>{me.goalText}</p>
        </div>
      </div>
      <div className="side">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="big-premise">{view.premise}</div>
          <p style={{ color: '#bdb5c8', fontSize: 14, margin: 0 }}>{view.briefingTip}</p>
        </div>
        <div className="card">
          <div className="row">
            <div className="grow">
              <div className="label">The train leaves in</div>
              <div style={{ font: '700 30px var(--mono)' }}>
                <Countdown endsAt={view.phaseEndsAt} />
              </div>
            </div>
            <button className={'btn ' + (meP.ready ? 'on' : 'brass')} onClick={() => net.ready(!meP.ready)}>
              {meP.ready ? 'Ready ✓' : "I'm ready"}
            </button>
          </div>
          <div className="sub" style={{ font: '12px var(--sans)', color: 'var(--mute)', marginTop: 8 }}>
            {readyN}/{conn.length} ready. The train leaves early when everyone is.
          </div>
        </div>
        <MicCheck />
      </div>
    </div>
  );
}
