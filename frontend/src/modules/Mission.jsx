import { useRef, useState } from 'react'
import { genMilestones, paceState, fmtDur, fmtShort } from '../lib/core.js'
import { Ic, toast, notify, flash, audioInit } from '../lib/ui.jsx'

// free-text sponsor tags: type + Enter to add, X (or Backspace on empty input) to remove
function TagInput({ tags, onChange, placeholder }) {
  const [txt, setTxt] = useState('')
  const inputRef = useRef(null)
  const commit = () => {
    const v = txt.trim().replace(/,+$/, '')
    if (v && !tags.some(t => t.toLowerCase() === v.toLowerCase())) onChange([...tags, v])
    setTxt('')
  }
  const onKey = e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
    else if (e.key === 'Backspace' && !txt && tags.length) onChange(tags.slice(0, -1))
  }
  return (
    <div className="my-2 flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] px-2 py-1.5 transition focus-within:border-acc focus-within:ring-[3px] focus-within:ring-acc/20"
      onClick={() => inputRef.current?.focus()}>
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 rounded-lg border border-acc/30 bg-acc/10 px-2 py-0.5 text-[13px] text-acc">
          {t}
          <button type="button" aria-label={`Remove ${t}`}
            className="cursor-pointer rounded p-0.5 transition hover:bg-acc/25"
            onClick={e => { e.stopPropagation(); onChange(tags.filter(x => x !== t)) }}>
            <Ic n="x" s={11} />
          </button>
        </span>
      ))}
      <input ref={inputRef} value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={onKey} onBlur={commit}
        placeholder={tags.length ? 'add another…' : placeholder}
        className="min-w-[150px] grow border-0 bg-transparent px-1 py-0.5 text-sm focus:ring-0" />
    </div>
  )
}

const toLocal = d => {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const PACE_TXT = {
  ok: () => 'ON PACE — keep shipping',
  behind: n => `BEHIND PACE — ${n} gate overdue. Guardian is on it.`,
  danger: n => `DANGER — ${n} overdue. Guardian triage in the console below.`,
}
const PACE_C = {
  ok: 'border-ok/35 bg-ok/10 text-ok',
  behind: 'border-warn/35 bg-warn/10 text-warn',
  danger: 'border-bad bg-bad/15 text-bad animate-pulse2',
}
const COUNT_C = { ok: 'text-ok', behind: 'text-warn', danger: 'text-bad animate-pulse2' }
const REQS = [['devpost', 'Devpost link'], ['video', 'Demo video'], ['repo', 'Public repo']]
const AGENT_C = {
  scout: 'text-warn border-warn/40',
  strategist: 'text-[#38bdf8] border-[#38bdf8]/40',
  guardian: 'text-bad border-bad/40',
  pitchsmith: 'text-[#c084fc] border-[#c084fc]/40',
  system: 'text-mut border-white/15',
}
const KIND_BAR = { info: 'border-l-white/20', action: 'border-l-ok', warn: 'border-l-warn', danger: 'border-l-bad' }

export default function Mission({ S, update, now, onLaunch, onEnd }) {
  const mission = S.mission
  const [name, setName] = useState('')
  const [theme, setTheme] = useState('')
  const [tracks, setTracks] = useState([])
  const [stack, setStack] = useState('React, Tailwind, FastAPI')
  const [start, setStart] = useState(() => toLocal(new Date()))
  const [end, setEnd] = useState(() => toLocal(new Date(Date.now() + 24 * 36e5)))
  const [reqs, setReqs] = useState({ devpost: true, video: true, repo: true })

  const preset = h => setEnd(toLocal(new Date(+new Date(start) + h * 36e5)))

  const launch = () => {
    const s = +new Date(start), e = +new Date(end)
    if (!s || !e) return toast('Set start and end times first.', 'warn')
    if (e <= Date.now() + 30 * 60e3) return toast('End must be at least 30 minutes in the future.', 'bad')
    try { window.Notification && Notification.requestPermission() } catch { /* denied */ }
    audioInit()
    onLaunch({ name: name.trim(), theme: theme.trim(), tracks, stack: stack.trim(), start: s, end: e, reqs, milestones: genMilestones(s, e, reqs) })
  }

  const toggle = id => {
    const m = mission.milestones.find(x => x.id === id)
    update(prev => ({ mission: { ...prev.mission, milestones: prev.mission.milestones.map(x => x.id === id ? { ...x, done: !x.done } : x) } }))
    if (!m.done) toast('Gate cleared — ' + m.label, 'ok')
  }
  const testAlarm = () => {
    try { window.Notification && Notification.requestPermission() } catch { /* denied */ }
    audioInit()
    notify('Alarm test', 'This is what a hard-gate miss looks like.', true)
    flash()
  }

  // ---------------- setup: the ONE manual step ----------------
  if (!mission) {
    return (
      <div className="glass p-6">
        <h2>Launch a mission</h2>
        <p className="text-mut">Describe the hackathon once. The strategist picks your project, the guardian runs triage when you slip, the pitchsmith drafts your submission before the gate. You build and check off gates — agents do the rest.</p>
        <div className="my-3 grid gap-3 sm:grid-cols-2">
          <label>Hackathon name (optional)<br /><input className="w-full" value={name} onChange={e => setName(e.target.value)} placeholder="ImagineHack 2026" /></label>
          <label>Team stack<br /><input className="w-full" value={stack} onChange={e => setStack(e.target.value)} /></label>
        </div>
        <label>Theme / problem statement (optional):</label>
        <textarea className="min-h-[70px]" value={theme} onChange={e => setTheme(e.target.value)}
          placeholder="e.g. 'improve developer security and CI pipelines' — leave blank for an open theme" />
        <label>Sponsors at this hackathon — type a company, press Enter. The scout studies each one at launch:</label>
        <TagInput tags={tracks} onChange={setTracks} placeholder="e.g. AWS, Grab, Maybank — any company, not just the big clouds" />
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
        <button className="btn btn-primary px-7 py-3 text-base" onClick={launch}><Ic n="play" />Launch mission</button>
        {!S.settings?.key && <p className="mt-2 text-xs text-warn">No API key set — agents will run on the deterministic fallback. Add one in Settings for generative agents.</p>}
      </div>
    )
  }

  // ---------------- live mission: bento + agent console ----------------
  const left = mission.end - now
  const pace = paceState(mission.milestones, now)
  const missed = mission.milestones.filter(m => !m.done && m.at <= now).length
  const done = mission.milestones.filter(m => m.done).length
  const total = mission.milestones.length
  const pct = total ? Math.round(100 * done / total) : 0
  const prog = Math.min(100, 100 * (now - mission.start) / (mission.end - mission.start))
  const next = mission.milestones.find(m => !m.done)
  const pick = S.ideas?.list?.[S.ideas.pickIdx]
  const feed = S.feed || []

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">

      {/* hero countdown */}
      <div className="glass animate-rise flex flex-col border-ok/20 p-6 sm:col-span-2 lg:row-span-2"
        style={{ boxShadow: '0 10px 34px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.1), 0 0 60px rgba(34,197,94,.06)' }}>
        <h4 className="tile-label">Time remaining</h4>
        <div className={`mb-1.5 mt-auto font-bold leading-none tracking-wide tabular-nums text-[clamp(34px,4.8vw,60px)] ${COUNT_C[pace]}`}>
          {left > 0 ? fmtDur(left) : '00:00:00'}
        </div>
        <div className="relative my-2 h-3 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-green-500 via-amber-400 to-rose-400 shadow-[0_0_12px_rgba(74,222,128,.4)] transition-[width] duration-1000 ease-linear"
            style={{ width: prog + '%' }} />
          {mission.milestones.filter(m => m.hard).map(m => (
            <span key={m.id} className="absolute -top-[3px] h-[18px] w-0.5 rounded bg-bad opacity-75"
              style={{ left: (100 * (m.at - mission.start) / (mission.end - mission.start)) + '%' }} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-mut">
          <span>ends {new Date(mission.end).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {pick && <span>building: <b className="text-acc">{pick.name}</b></span>}
          <span>reqs: {Object.keys(mission.reqs).filter(k => mission.reqs[k]).join(', ')}</span>
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
            <div className={`text-sm font-semibold ${next.at <= now ? 'text-bad' : ''}`}>
              {next.hard && <span className="gate">HARD</span>}{next.label}
            </div>
            <div className="mt-1.5 text-xs text-mut tabular-nums">
              {next.at > now ? `due in ${fmtShort(next.at - now)}` : `OVERDUE by ${fmtShort(now - next.at)}`} · T-{fmtShort(mission.end - next.at)}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold">All gates cleared</div>
            <div className="mt-1.5 text-xs text-mut">Submit and breathe.</div>
          </>
        )}
      </div>

      {/* progress + controls */}
      <div className="glass animate-rise p-6" style={{ animationDelay: '.2s' }}>
        <h4 className="tile-label">Progress</h4>
        <div className="flex items-center gap-3.5">
          <div className="ring" style={{ '--p': pct }}><b>{pct}%</b></div>
          <div className="text-[13px] text-mut">
            <div><span className="font-semibold text-ink">{done}</span>/{total} done</div>
            <div><span className="font-semibold text-ink">{mission.milestones.filter(m => m.hard && !m.done).length}</span> hard gates left</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={testAlarm}><Ic n="bell" />Test alarm</button>
          <button className="btn btn-danger" onClick={onEnd}><Ic n="x" />End</button>
        </div>
      </div>

      {/* agent console — the OS heartbeat */}
      <div className="glass animate-rise p-6 sm:col-span-2 lg:col-span-4" style={{ animationDelay: '.26s' }}>
        <h4 className="tile-label">Agent console</h4>
        {!feed.length && <p className="text-sm text-mut">Agents report here as they act.</p>}
        <ul className="grid gap-2">
          {feed.map(e => (
            <li key={e.id} className={`rounded-xl border border-white/10 border-l-4 bg-white/[.03] p-3 ${KIND_BAR[e.kind] || KIND_BAR.info}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${AGENT_C[e.agent] || AGENT_C.system}`}>{e.agent}</span>
                <span className="text-xs text-mut tabular-nums">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-sm font-semibold">{e.title}</span>
              </div>
              {e.body && <pre className="mt-1.5 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-mut">{e.body}</pre>}
            </li>
          ))}
        </ul>
      </div>

      {/* milestones */}
      <div className="glass animate-rise p-6 sm:col-span-2 lg:col-span-4" style={{ animationDelay: '.32s' }}>
        <h4 className="tile-label">Gates — your only job besides building</h4>
        <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
          {mission.milestones.map(m => {
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
                    T-{fmtShort(mission.end - m.at)} · {new Date(m.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
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
