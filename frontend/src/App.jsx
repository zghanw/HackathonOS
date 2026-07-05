import { useCallback, useEffect, useRef, useState } from 'react'
import { paceState, fmtDur, fmtShort, remindEvery } from './lib/core.js'
import { Ic, notify, flash, audioInit } from './lib/ui.jsx'
import Guardian from './modules/Guardian.jsx'
import Ideas from './modules/Ideas.jsx'
import Kickoff from './modules/Kickoff.jsx'
import Pitch from './modules/Pitch.jsx'

const KEY = 'hackos-v1'
const loadLocal = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }

// shared project state — localStorage only. ponytail: serverless on purpose; the app
// is a static site. Add a sync backend only if multi-device ever actually matters.
function useHackState() {
  const [S, setS] = useState(loadLocal)
  const update = useCallback(patch => setS(prev => {
    const next = { ...prev, ...patch, updatedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(next))
    return next
  }), [])
  return [S, update]
}

const TABS = [
  ['guardian', 'Deadline Guardian'],
  ['ideas', 'Ideas'],
  ['kickoff', 'Kickoff'],
  ['pitch', 'Pitch'],
]
const MINI_C = { ok: 'text-ok border-ok/50', behind: 'text-warn border-warn/50', danger: 'text-bad border-bad animate-pulse2' }

export default function App() {
  const [S, update] = useHackState()
  const [tab, setTab] = useState('guardian')
  const [now, setNow] = useState(Date.now())
  const book = useRef({}) // per-milestone alarm bookkeeping {id: {warned, lastN}} — reset on reload is fine
  const run = S.run

  useEffect(() => {
    const h = () => audioInit()
    document.addEventListener('click', h, { once: true })
    return () => document.removeEventListener('click', h)
  }, [])

  useEffect(() => {
    if (!run) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [!!run]) // eslint-disable-line react-hooks/exhaustive-deps

  // alarm loop lives here (not in Guardian) so escalating reminders fire on any tab
  useEffect(() => {
    if (!run) { document.title = 'Hackathon OS'; return }
    const left = run.end - now
    const pace = paceState(run.milestones, now)
    document.title = (pace !== 'ok' && Math.floor(now / 1000) % 2 ? '● ' : '') + (left > 0 ? fmtDur(left) : 'CLOSED') + ' — Hackathon OS'
    for (const m of run.milestones) {
      if (m.done) continue
      const b = book.current[m.id] || (book.current[m.id] = {})
      if (!b.warned && m.at > now && m.at - now <= 15 * 60e3) {
        b.warned = 1
        notify(`Up next (T-${fmtShort(run.end - m.at)})`, `${m.label} — due in ${fmtShort(m.at - now)}`, m.hard)
      }
      if (m.at <= now && left > -36e5) {
        const cad = remindEvery(left)
        if (now - (b.lastN || 0) >= cad) {
          b.lastN = now
          notify(m.hard ? 'HARD GATE MISSED' : 'Overdue', `${m.label} — check it off or cut scope.`, m.hard)
          if (m.hard) flash()
        }
      }
    }
    if (left <= 0 && !book.current.ended) {
      book.current.ended = 1
      notify('WINDOW CLOSED', 'Submission window is over.', true)
      flash()
    }
  }, [now, run])

  const left = run ? run.end - now : 0
  const pace = run ? paceState(run.milestones, now) : 'ok'

  return (
    <>
      <div id="bg" aria-hidden="true"><span /><span /><span /></div>

      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3.5 border-b border-white/10 bg-white/[.055] px-5 py-3 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center gap-2.5 font-extrabold leading-tight tracking-wide">
          <Ic n="clock" s={20} className="text-acc" />
          <span>
            <span className="bg-gradient-to-r from-white via-[#4ade80] to-[#38bdf8] bg-clip-text text-transparent">HACKATHON OS</span>
            <small className="block text-[11px] font-normal tracking-normal text-mut">the clock + your voice to Claude</small>
          </span>
        </div>
        <span className="chip">{S.idea ? <>idea: <b className="text-acc">{S.idea.name}</b></> : 'no idea locked'}</span>
        {run && (
          <button className={`chip cursor-pointer tabular-nums ${MINI_C[pace]}`} onClick={() => setTab('guardian')}>
            {left > 0 ? fmtDur(left) : 'CLOSED'}
          </button>
        )}
        <nav className="ml-auto flex flex-wrap gap-0.5">
          {TABS.map(([id, label]) => (
            <button key={id}
              className={`cursor-pointer rounded-xl px-4 py-2 text-sm transition ${tab === id ? 'bg-acc font-semibold text-[#062812]' : 'text-mut hover:bg-white/10 hover:text-ink'}`}
              onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 pb-24 pt-6">
        <div className={tab === 'guardian' ? '' : 'hidden'}><Guardian S={S} update={update} now={now} /></div>
        <div className={tab === 'ideas' ? '' : 'hidden'}><Ideas S={S} update={update} /></div>
        <div className={tab === 'kickoff' ? '' : 'hidden'}><Kickoff S={S} /></div>
        <div className={tab === 'pitch' ? '' : 'hidden'}><Pitch S={S} update={update} /></div>
      </main>

      <div id="flash" />
      <div id="toasts" />
    </>
  )
}
