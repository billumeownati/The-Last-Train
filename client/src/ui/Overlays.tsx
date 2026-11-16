import { useEffect, useState } from 'react';
import { CARRIAGES, CARRIAGE_NAMES, type ConductorQuestion, type EndingStep } from '@tlt/shared';
import { net } from '../net';
import { toast, ui, useUI } from '../store';
import { CHAR_COLOR, Countdown, Swatch, me, useView } from './bits';

/* ------------------------------------------------------------------ */
/* banner + event                                                      */
/* ------------------------------------------------------------------ */

export function StationBanner() {
  const view = useView();
  const seen = useUI((s) => s.seenBanner);
  const show = view.phase === 'roam' && seen < view.station;
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => ui.set({ seenBanner: view.station }), 4300);
    return () => clearTimeout(id);
  }, [show, view.station]);
  if (!show) return null;
  const st = view.stations[view.station - 1];
  return (
    <div className="banner" key={view.station}>
      <div className="a">Station {view.station} of {view.stations.length}</div>
      <div className="b">{st.name}</div>
      <div className="c">{st.blurb}</div>
    </div>
  );
}

export function EventModal() {
  const view = useView();
  const seen = useUI((s) => s.seenEvent);
  const ev = view.event;
  if (view.phase !== 'event' || !ev || seen >= ev.station) return null;
  return (
    <div className="veil light stage">
      <div className={'modal event-card' + (ev.worse ? ' worse' : '')}>
        <div className="kicker">Station {ev.station} · something happens</div>
        <h2>{ev.title}</h2>
        <p>{ev.text}</p>
        <p style={{ fontSize: 13, color: 'var(--mute)' }}>You have about a minute before dinner is called. This is in the Log if you want to read it again.</p>
        <button className="btn brass" onClick={() => ui.set({ seenEvent: ev.station })}>
          Carry on
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the conductor                                                       */
/* ------------------------------------------------------------------ */

export function ConductorMenu() {
  const view = useView();
  const open = useUI((s) => s.conductorMenu);
  const [pick, setPick] = useState<ConductorQuestion | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) {
      setPick(null);
      setAnswer(null);
    }
  }, [open]);
  if (!open) return null;
  const close = () => ui.set({ conductorMenu: false });
  const ask = async (q: ConductorQuestion, target?: string) => {
    setBusy(true);
    const r = await net.ask(q, target);
    setBusy(false);
    if (!r.ok) {
      toast('error', r.error ?? 'No answer.');
      return;
    }
    setAnswer(String(r.data ?? ''));
  };
  const others = view.players.filter((p) => p.id !== view.youId && p.characterId);
  return (
    <div className="veil light stage" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ borderColor: 'var(--brass)' }}>
        <div className="kicker">The Conductor</div>
        {answer ? (
          <>
            <h2>His answer</h2>
            <div className="paper conductor" style={{ margin: '10px 0 16px', fontSize: 14 }}>
              <p>{answer}</p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--mute)' }}>It is saved in your case file under Private notes. Nobody else heard it.</p>
            <button className="btn brass" onClick={close}>Thank him</button>
          </>
        ) : (
          <>
            <h2>One question per station</h2>
            <p>He answers what is true, not what is kind. Choose carefully: you only get one.</p>
            <div className="menu-q">
              {view.conductorQuestions.map((q) => (
                <div key={q.id}>
                  <button className={'opt' + (pick === q.id ? ' sel' : '')} disabled={busy} onClick={() => (q.id === 'where' || q.id === 'board' ? void ask(q.id) : setPick(q.id))}>
                    {q.label}
                  </button>
                  {pick === q.id && q.id === 'who' && (
                    <div className="menu-sub">
                      {others.map((p) => (
                        <button key={p.id} className="btn ghost small" disabled={busy} onClick={() => void ask('who', p.id)}>
                          {p.characterName} ({p.name})
                        </button>
                      ))}
                    </div>
                  )}
                  {pick === q.id && q.id === 'carriage' && (
                    <div className="menu-sub">
                      {CARRIAGES.map((c) => (
                        <button key={c} className="btn ghost small" disabled={busy} onClick={() => void ask('carriage', c)}>
                          {CARRIAGE_NAMES[c]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="btn ghost small" style={{ marginTop: 14 }} onClick={close}>
              Never mind
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ballots                                                             */
/* ------------------------------------------------------------------ */

export function DiningVoteModal() {
  const view = useView();
  const d = view.dining;
  if (view.phase !== 'dining' || !d || (d.subphase !== 'vote' && !d.result)) return null;
  const done = !!d.result;
  return (
    <div className="veil stage">
      <div className="modal">
        <div className="kicker">{done ? 'The table has chosen' : 'Secret ballot'}</div>
        <h2>{done ? (d.result!.skipped ? 'Nothing happens' : 'It is done') : 'What should the train do?'}</h2>
        {!done && <p style={{ fontStyle: 'italic' }}>{d.prompt}</p>}
        {done ? (
          <>
            <p>{d.result!.text}</p>
            <div className="paper" style={{ margin: '8px 0' }}>
              <h4>The tally (nobody sees who voted for what)</h4>
              {d.options.map((o) => (
                <div key={o.id} style={{ margin: '5px 0' }}>
                  <b>{d.result!.counts[o.id] ?? 0}</b> · {o.text}
                </div>
              ))}
              <div style={{ margin: '5px 0' }}>
                <b>{d.result!.counts.skip ?? 0}</b> · Do nothing
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="opts">
              {d.options.map((o) => (
                <button key={o.id} className={'opt' + (d.myVote === o.id ? ' sel' : '')} onClick={() => net.diningVote(o.id)}>
                  {o.text}
                </button>
              ))}
              <button className={'opt' + (d.myVote === 'skip' ? ' sel' : '')} onClick={() => net.diningVote('skip')} style={{ fontStyle: 'italic' }}>
                Do nothing. (If nothing wins, the next stop gets worse for everybody.)
              </button>
            </div>
            <div className="vote-bar">
              <span>
                {d.voted}/{d.total} have voted. You can change your vote until the clock runs out.
              </span>
              <Countdown endsAt={view.phaseEndsAt} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function FinalVoteModal() {
  const view = useView();
  const f = view.final;
  if (view.phase !== 'finalVote' || !f) return null;
  return (
    <div className="veil stage">
      <div className="modal">
        <div className="kicker">The Last Platform · secret ballot</div>
        <h2>Who stays aboard?</h2>
        <p style={{ fontStyle: 'italic' }}>The doors are open. All but one of you may step down. You cannot vote for yourself. Ties are settled by the conductor's cap.</p>
        <div className="opts">
          {f.candidates
            .filter((c) => c.id !== view.youId)
            .map((c) => {
              const p = view.players.find((x) => x.id === c.id);
              return (
                <button key={c.id} className={'opt' + (f.myVote === c.id ? ' sel' : '')} onClick={() => net.finalVote(c.id)}>
                  <div className="cand">
                    <Swatch id={p?.characterId} />
                    <div>
                      <div className="nm">{c.characterName}</div>
                      <div className="sub">{c.name}</div>
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
        <div className="vote-bar">
          <span>
            {f.voted}/{f.total} votes in. You can change yours until the clock runs out.
          </span>
          <Countdown endsAt={view.phaseEndsAt} />
        </div>
      </div>
    </div>
  );
}

export function PendingRevealModal() {
  const view = useView();
  if (!view.pendingReveal) return null;
  return (
    <div className="veil">
      <div className="modal" style={{ borderColor: 'var(--ox2)' }}>
        <div className="kicker">Your suitcase was searched</div>
        <h2>Show the table one clue</h2>
        <p>The table voted to search your suitcase. Pick one of the clues you hold to lay on the table. If you wait, the conductor picks for you.</p>
        <div className="opts">
          {view.clues.map((c) => (
            <button key={c.id} className="opt" onClick={async () => {
              const r = await net.reveal(c.id);
              if (!r.ok && r.error) toast('error', r.error);
            }}>
              <b>{c.title}</b>
              <div style={{ fontSize: 13, color: 'var(--mute)' }}>{c.text.slice(0, 110)}…</div>
            </button>
          ))}
        </div>
        <div className="vote-bar">
          <span />
          <Countdown endsAt={view.pendingReveal.until} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ending                                                              */
/* ------------------------------------------------------------------ */

function StepCard({ s, last }: { s: EndingStep; last: boolean }) {
  if (s.kind === 'tally') {
    const max = Math.max(1, ...s.counts.map((c) => c.votes));
    return (
      <div className="endcard">
        <div className="paper tilt1">
          <h4>The ballot</h4>
          {s.counts.map((c) => (
            <div key={c.playerId} className="tallyrow">
              <span style={{ width: 150 }}>{c.characterName}</span>
              <span className="bar"><b style={{ width: `${(c.votes / max) * 100}%` }} /></span>
              <b>{c.votes}</b>
            </div>
          ))}
          {s.absent.length > 0 && <p style={{ marginTop: 8 }}>Someone was not aboard when the vote was called. They stay behind.</p>}
        </div>
      </div>
    );
  }
  if (s.kind === 'left')
    return (
      <div className="endcard">
        <div className="paper tilt2" style={{ background: '#d9b9b0' }}>
          <h4>Left aboard</h4>
          <div className="nm" style={{ font: '700 26px var(--serif)' }}>{s.names.join(' and ')}</div>
          <p>The doors close. Everyone else steps down onto the Last Platform.</p>
        </div>
      </div>
    );
  if (s.kind === 'player')
    return (
      <div className="endcard">
        <div className="paper tilt3">
          <div className="idcard">
            <div className="face"><i style={{ background: CHAR_COLOR[s.characterId] }} /></div>
            <div>
              <div className="ti">{s.name}</div>
              <div className="nm">{s.characterName}</div>
            </div>
          </div>
          <div className="stamps">
            <span className={'stampx ' + (s.gotOff ? 'good' : 'dark')}>{s.gotOff ? 'STEPPED DOWN' : 'LEFT ABOARD'}</span>
            <span className={'stampx ' + (s.won ? 'good' : '')}>{s.won ? 'GOAL MET' : 'GOAL FAILED'}</span>
            {s.wasStowaway && last && <span className="stampx dark">STOWAWAY</span>}
          </div>
          <p style={{ opacity: .75 }}>Goal: {s.goalText}</p>
          {s.lines.map((l, i) => <p key={i} className="ep">{l}</p>)}
        </div>
      </div>
    );
  return (
    <div className="endcard">
      <div className="paper hint tilt1">
        <span className="stamp">THE TRUTH</span>
        <h4>Who did not belong</h4>
        <p style={{ fontSize: 14 }}>{s.text}</p>
      </div>
    </div>
  );
}

export function Ending() {
  const view = useView();
  const e = view.ending;
  if (!e) return null;
  const isHost = view.hostId === view.youId;
  const players = e.steps.filter((s): s is Extract<EndingStep, { kind: 'player' }> => s.kind === 'player');
  const latest = e.steps[e.steps.length - 1];
  return (
    <div className="ending">
      <div className="title"><h1 style={{ fontSize: 40 }}>The <span>Last</span> Platform</h1></div>
      <div className="endstack">
        <StepCard key={e.steps.length} s={latest} last={e.done} />
      </div>
      {players.length > 1 && (
        <div className="pastend">
          {players.map((p) => (
            <span key={p.playerId} className={'chip ' + (p.won ? 'won' : 'lost')}>
              {p.characterName}: {p.won ? 'won' : 'lost'}
            </span>
          ))}
        </div>
      )}
      <div className="row">
        {!e.done && isHost && <button className="btn ghost" onClick={() => net.endingNext()}>Next</button>}
        {!e.done && !isHost && <span className="pill">The host is turning the pages…</span>}
        {e.done && isHost && <button className="btn brass" onClick={() => net.playAgain()}>Play again</button>}
        {e.done && !isHost && <span className="pill">Waiting for the host to start another journey…</span>}
        <button className="btn ghost" onClick={() => net.leave()}>Leave</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* misc                                                                */
/* ------------------------------------------------------------------ */

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>
      ))}
    </div>
  );
}

export function ConnBanner() {
  const conn = useUI((s) => s.conn);
  const hasView = useUI((s) => !!s.view);
  if (conn === 'online' || (!hasView && conn === 'connecting')) return null;
  return <div className="connbanner">{conn === 'offline' ? 'Connection lost. Trying to get back aboard…' : 'Connecting…'}</div>;
}

export function Rules() {
  const open = useUI((s) => s.rules);
  if (!open) return null;
  return (
    <div className="veil" onClick={() => ui.set({ rules: false })} style={{ zIndex: 60 }}>
      <div className="modal rules" onClick={(e) => e.stopPropagation()}>
        <div className="kicker">How to play</div>
        <h2>The Last Train</h2>
        <p>A night train carries {'4–6'} passengers through the memory of a car crash. <b>One of you does not belong</b>, and <b>one of you must stay aboard</b> at the last stop. Everyone else steps down. You each have a private goal for that moment.</p>
        <h3>Your card</h3>
        <ul>
          <li><b>Memory</b>: what you believe happened. It is true, unless you are the Stowaway, whose memory is false.</li>
          <li><b>Lie</b>: something you have agreed to claim. Clues in the world can prove it false, and being caught lying does not make you the Stowaway.</li>
          <li><b>Goal</b>: what you need to be true when the last vote is counted.</li>
        </ul>
        <h3>The journey: 5 stations</h3>
        <ul>
          <li><b>Roam (3 min)</b>: walk between carriages (next door only, about 2 seconds) and search glowing objects (about 5 seconds, visible to others in the car). The first to finish keeps the clue; nobody else can have it. Voice is off.</li>
          <li><b>Event (1 min)</b>: something changes on the train: a carriage goes dark, floods, locks or unlocks.</li>
          <li><b>Dinner (3 min)</b>: everyone sits in the Dining Car. Talk out loud. Describe your clues (you may lie) or lay them on the table to show the real thing. Then a 20-second secret ballot decides what the train does next. Vote for nothing and the next event gets worse.</li>
        </ul>
        <h3>The carriages</h3>
        <ul>
          <li>Engine · Observation · Dining · Sleepers (one cabin each) · Luggage, in that order. The engine is locked until station 4. The luggage van holds two at a time.</li>
          <li>Stand at the viewing glass in the Observation Car for 10 seconds to see a vision of the station. Half-truths.</li>
          <li>The Conductor walks one carriage per station. If he is with you, ask him one question per station. He tells the truth, cryptically.</li>
        </ul>
        <h3>The Stowaway</h3>
        <p>One passenger is the Stowaway and does not know it. Their card looks like yours. Private hints arrive each station, and some innocents get false alarms. At station 4 the conductor tells them privately. Then they may deceive.</p>
        <h3>The last vote</h3>
        <p>Secret ballot: who stays aboard? No self-votes. Most votes stays; ties are drawn by the conductor. Endings are then revealed one by one: did your goal come true?</p>
        <h3>If you drop out</h3>
        <p>Your character falls asleep in their cabin. Rejoin with the same room code and name. Missed votes count as abstentions. If you are missing at the final vote, you stay aboard and cannot win.</p>
        <button className="btn brass" style={{ marginTop: 16 }} onClick={() => ui.set({ rules: false })}>Got it</button>
      </div>
    </div>
  );
}
