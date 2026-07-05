import { useState } from 'react'
import { genMilestones, paceState, fmtDur, fmtShort } from '../lib/core.js'
import { Ic, toast, notify, flash, audioInit } from '../lib/ui.jsx'

const toLocal = d => {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const PACE_TXT = {
  ok: () => 'ON PACE — keep shipping',
  behind: n => `BEHIND PACE — ${n} gate overdue. Cut scope, not the deadline.`,
  danger: n => `DANGER — ${n} overdue. Clear the hard gate NOW.`,
}
const PACE_C = {
  ok: 'border-ok/35 bg-ok/10 text-ok',
  behind: 'border-warn/35 bg-warn/10 text-warn',
  danger: 'border-bad bg-bad/15 text-bad animate-pulse2',
}
const COUNT_C = { ok: 'text-ok', behind: 'text-warn', danger: 'text-bad animate-pulse2' }
const REQS = [['devpost', 'Devpost link'], ['video', 'Demo video'], ['repo', 'Public repo']]

export default function Guardian({ S, update, now }) {
  const run = S.run
  const [start, setStart] = useState(() => toLocal(new Date()))
  const [end, setEnd] = useState(() => toLocal(new Date(Date.now() + 24 * 36e5)))
  const [reqs, setReqs] = useState({ devpost: true, video: true, repo: true })

  const preset = h => setEnd(toLocal(new Date(+new Date(start) + h * 36e5)))

  const startRun = () => {
    const s = +new Date(start), e = +new Date(end)
    if (!s || !e) return toast('Set start and end times first.', 'warn')
    if (e <= Date.now() + 30 * 60e3) return toast('End must be at least 30 minutes in the future.', 'bad')
    const milestones = genMilestones(s, e, reqs)
    update({ run: { start: s, end: e, reqs, milestones } })
    try { window.Notification && Notification.requestPermission() } catch { /* denied */ }
    audioInit()
    toast(`Clock started. ${milestones.length} milestones, ${milestones.filter(m => m.hard).length} hard gates. Go build.`, 'ok')
  }
  const endRun = () => {
    if (!confirm('End this run? Milestone state will be cleared.')) return
    update({ run: undefined })
    document.title = 'Hackathon OS'
  }
  const toggle = id => {
    const m = run.milestones.find(x => x.id === id)
    update({ run: { ...run, milestones: run.milestones.map(x => x.id === id ? { ...x, done: !x.done } : x) } })
    if (!m.done) toast('Done — ' + m.label, 'ok')
  }
  const testAlarm = () => {
    try { window.Notification && Notification.requestPermission() } catch { /* denied */ }
    audioInit()
    notify('Alarm test', 'This is what a hard-gate miss looks like.', true)
    flash()
  }

  if (!run) {
    return (
      <div className="glass p-6">
        <h2>Deadline Guardian</h2>
        <p className="text-mut">Fixed window, hard gates, alarms you can't ignore. Missing the deadline is the one unforced error — this module exists so it never happens again.</p>
        <div className="my-3 flex flex-wrap items-center gap-3">
          <label>Start<br /><input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
          <label>End<br /><input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label>
          <span className="text-sm text-mut">presets:</span>
          {[24, 36, 48].map(h => <button key={h} className="btn" onClick={() => preset(h)}>{h}h</button>)}
        </div>
        <div className="my-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-mut">Submission requires:</span>
          {REQS.map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-1.5 text-ink">
              <input type="checkbox" checked={reqs[k]} onChange={e => setReqs({ ...reqs, [k]: e.target.checked })} /> {lbl}
            </label>
          ))}
        </div>
        <button className="btn btn-primary px-7 py-3 text-base" onClick={startRun}><Ic n="play" />Start the clock</button>
      </div>
    )
  }

  const left = run.end - now
  const pace = paceState(run.milestones, now)
  const missed = run.milestones.filter(m => !m.done && m.at <= now).length
  const done = run.milestones.filter(m => m.done).length
  const total = run.milestones.length
  const pct = total ? Math.round(100 * done / total) : 0
  const prog = Math.min(100, 100 * (now - run.start) / (run.end - run.start))
  const next = run.milestones.find(m => !m.done)

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">

      {/* hero countdown — 2x2 bento tile */}
      <div className="glass animate-rise flex flex-col border-ok/20 p-6 sm:col-span-2 lg:row-span-2"
        style={{ boxShadow: '0 10px 34px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.1), 0 0 60px rgba(34,197,94,.06)' }}>
        <h4 className="tile-label">Time remaining</h4>
        <div className={`mb-1.5 mt-auto font-bold leading-none tracking-wide tabular-nums text-[clamp(34px,4.8vw,60px)] ${COUNT_C[pace]}`}>
          {left > 0 ? fmtDur(left) : '00:00:00'}
        </div>
        <div className="relative my-2 h-3 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-green-500 via-amber-400 to-rose-400 shadow-[0_0_12px_rgba(74,222,128,.4)] transition-[width] duration-1000 ease-linear"
            style={{ width: prog + '%' }} />
          {run.milestones.filter(m => m.hard).map(m => (
            <span key={m.id} className="absolute -top-[3px] h-[18px] w-0.5 rounded bg-bad opacity-75"
              style={{ left: (100 * (m.at - run.start) / (run.end - run.start)) + '%' }} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-mut">
          <span>ends {new Date(run.end).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {S.idea && <span>building: <b className="text-acc">{S.idea.name}</b></span>}
          <span>reqs: {Object.keys(run.reqs).filter(k => run.reqs[k]).join(', ')}</span>
        </div>
      </div>

      {/* pace */}
      <div className="glass animate-rise p-6 sm:col-span-2" style={{ animationDelay: '.08s' }}>
        <h4 className="tile-label">Pace</h4>
        <div className={`flex min-h-16 items-center justify-center rounded-xl border p-4 text-center font-extrabold tracking-wide ${PACE_C[pace]}`}>
          {left > 0 ? PACE_TXT[pace](missed) : 'WINDOW CLOSED — did you submit?'}
        </div>
      </div>

      {/* next gate */}
      <div className="glass animate-rise p-6" style={{ animationDelay: '.14s' }}>
        <h4 className="tile-label">Next gate</h4>
        {next ? (
          <>
            <div className={`text-sm font-semibold ${!next.done && next.at <= now ? 'text-bad' : ''}`}>
              {next.hard && <span className="gate">HARD</span>}{next.label}
            </div>
            <div className="mt-1.5 text-xs text-mut tabular-nums">
              {next.at > now ? `due in ${fmtShort(next.at - now)}` : `OVERDUE by ${fmtShort(now - next.at)}`} · T-{fmtShort(run.end - next.at)}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold">All milestones cleared</div>
            <div className="mt-1.5 text-xs text-mut">Submit and breathe.</div>
          </>
        )}
      </div>

      {/* progress ring + controls */}
      <div className="glass animate-rise p-6" style={{ animationDelay: '.2s' }}>
        <h4 className="tile-label">Progress</h4>
        <div className="flex items-center gap-3.5">
          <div className="ring" style={{ '--p': pct }}><b>{pct}%</b></div>
          <div className="text-[13px] text-mut">
            <div><span className="font-semibold text-ink">{done}</span>/{total} done</div>
            <div><span className="font-semibold text-ink">{run.milestones.filter(m => m.hard && !m.done).length}</span> hard gates left</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={testAlarm}><Ic n="bell" />Test alarm</button>
          <button className="btn btn-danger" onClick={endRun}><Ic n="x" />End run</button>
        </div>
      </div>

      {/* milestones — full-width bento tile */}
      <div className="glass animate-rise p-6 sm:col-span-2 lg:col-span-4" style={{ animationDelay: '.26s' }}>
        <h4 className="tile-label">Milestones</h4>
        <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
          {run.milestones.map(m => {
            const over = !m.done && m.at <= now
            return (
              <li key={m.id}
                className={`flex items-start gap-3 rounded-xl border p-3 transition hover:-translate-y-px hover:border-white/20
                  ${over ? 'border-bad/50 bg-bad/10' : 'border-white/10 bg-white/[.03]'}
                  ${m.hard ? 'border-l-[3px] border-l-bad' : ''} ${m.done ? 'opacity-50' : ''}`}>
                <input type="checkbox" className="mt-0.5 cursor-pointer" checked={m.done} onChange={() => toggle(m.id)} />
                <div>
                  <div className={`text-sm font-semibold ${m.done ? 'line-through' : ''}`}>
                    {m.hard && <span className="gate">HARD GATE</span>}{m.label}
                  </div>
                  <div className="mt-0.5 text-xs text-mut tabular-nums">
                    T-{fmtShort(run.end - m.at)} · {new Date(m.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    {over && <b className="text-bad"> · OVERDUE</b>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
