import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { paceState, fmtDur, fmtShort, remindEvery } from './lib/core.js'
import { runScout, runStrategist, runGuardian, runPitch } from './lib/agents.js'
import { Ic, notify, flash, audioInit } from './lib/ui.jsx'
import Mission from './modules/Mission.jsx'
import Ideas from './modules/Ideas.jsx'
import Pitch from './modules/Pitch.jsx'
import Settings from './modules/Settings.jsx'

const KEY = 'hackos-v2'
const loadLocal = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }

// shared state — localStorage only. ponytail: serverless on purpose; the agents call
// the Anthropic API straight from the browser, so there is nothing to host.
function useHackState() {
  const [S, setS] = useState(loadLocal)
  const update = useCallback(patch => setS(prev => {
    const p = typeof patch === 'function' ? patch(prev) : patch
    const next = { ...prev, ...p, updatedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(next))
    return next
  }), [])
  return [S, update]
}

const TABS = [
  ['mission', 'Mission Control'],
  ['ideas', 'Ideas'],
  ['pitch', 'Pitch'],
  ['settings', 'Settings'],
]
const MINI_C = { ok: 'text-ok border-ok/50', behind: 'text-warn border-warn/50', danger: 'text-bad border-bad animate-pulse2' }
const PACE_RANK = { ok: 0, behind: 1, danger: 2 }

export default function App() {
  const [S, update] = useHackState()
  const [tab, setTab] = useState('mission')
  const [now, setNow] = useState(Date.now())
  const book = useRef({})            // per-milestone alarm bookkeeping — reset on reload is fine
  const paceRef = useRef('ok')       // last seen pace, for worsening detection
  const guardianLast = useRef(0)     // guardian cooldown
  const pitchAuto = useRef(false)    // pitchsmith fires once per mission
  const sRef = useRef(S)
  sRef.current = S

  const push = useCallback((agent, kind, title, body = '') => update(prev => ({
    feed: [{ id: Date.now() + Math.random(), at: Date.now(), agent, kind, title, body }, ...(prev.feed || [])].slice(0, 50),
  })), [update])

  // agent context: always reads the latest state, never a stale closure
  const ctx = useMemo(() => ({ latest: () => sRef.current, update, push }), [update, push])

  const mission = S.mission
  const auto = S.settings?.auto !== false

  useEffect(() => {
    const h = () => audioInit()
    document.addEventListener('click', h, { once: true })
    return () => document.removeEventListener('click', h)
  }, [])

  useEffect(() => {
    if (!mission) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [!!mission]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the OS loop: alarms + self-triggering agents, alive on every tab ----
  useEffect(() => {
    if (!mission) { document.title = 'Hackathon OS'; return }
    const left = mission.end - now
    const pace = paceState(mission.milestones, now)
    document.title = (pace !== 'ok' && Math.floor(now / 1000) % 2 ? '● ' : '') + (left > 0 ? fmtDur(left) : 'CLOSED') + ' — Hackathon OS'

    // escalating alarms (deterministic, always on)
    for (const m of mission.milestones) {
      if (m.done) continue
      const b = book.current[m.id] || (book.current[m.id] = {})
      if (!b.warned && m.at > now && m.at - now <= 15 * 60e3) {
        b.warned = 1
        notify(`Up next (T-${fmtShort(mission.end - m.at)})`, `${m.label} — due in ${fmtShort(m.at - now)}`, m.hard)
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

    // guardian agent: auto-triage when pace worsens (20min cooldown)
    if (pace !== paceRef.current) {
      if (PACE_RANK[pace] > PACE_RANK[paceRef.current] && auto && left > 0 && now - guardianLast.current > 20 * 60e3) {
        guardianLast.current = now
        runGuardian(ctx, pace)
      }
      paceRef.current = pace
    }

    // pitchsmith agent: auto-draft the kit as the video/devpost gate approaches
    if (auto && !pitchAuto.current && !S.pitch && left > 0) {
      const gate = mission.milestones.find(x => !x.done && /Demo video|Devpost draft|Submission form/.test(x.label))
      if (gate && gate.at - now <= 15 * 60e3) {
        pitchAuto.current = true
        runPitch(ctx, '', true)
      }
    }
  }, [now, mission]) // eslint-disable-line react-hooks/exhaustive-deps

  const left = mission ? mission.end - now : 0
  const pace = mission ? paceState(mission.milestones, now) : 'ok'
  const pick = S.ideas?.list?.[S.ideas.pickIdx]

  const launchMission = m => {
    book.current = {}; paceRef.current = 'ok'; pitchAuto.current = false
    update({ mission: m, ideas: undefined, pitch: undefined, intel: undefined, feed: [] })
    push('system', 'info', `Mission launched — ${fmtShort(m.end - m.start)} window, ${m.milestones.length} gates (${m.milestones.filter(x => x.hard).length} hard)`,
      'Scout studies the sponsors, then the strategist picks. You do two things: build, and check off gates.')
    // scout first, then strategist with the fresh intel (passed explicitly — state may not have committed yet)
    runScout(ctx, m).then(intel => runStrategist(ctx, m, intel))
  }
  const endMission = () => {
    if (!confirm('End this mission? All mission state will be cleared.')) return
    update({ mission: undefined, ideas: undefined, pitch: undefined, intel: undefined, feed: [] })
    document.title = 'Hackathon OS'
  }

  return (
    <>
      <div id="bg" aria-hidden="true"><span /><span /><span /></div>

      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3.5 border-b border-white/10 bg-white/[.055] px-5 py-3 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center gap-2.5 font-extrabold leading-tight tracking-wide">
          <Ic n="clock" s={20} className="text-acc" />
          <span>
            <span className="bg-gradient-to-r from-white via-[#4ade80] to-[#38bdf8] bg-clip-text text-transparent">HACKATHON OS</span>
            <small className="block text-[11px] font-normal tracking-normal text-mut">agentic mission control</small>
          </span>
        </div>
        <span className="chip">{pick ? <>building: <b className="text-acc">{pick.name}</b></> : 'no pick yet'}</span>
        {mission && (
          <button className={`chip cursor-pointer tabular-nums ${MINI_C[pace]}`} onClick={() => setTab('mission')}>
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
        <div className={tab === 'mission' ? '' : 'hidden'}>
          <Mission S={S} update={update} now={now} onLaunch={launchMission} onEnd={endMission} />
        </div>
        <div className={tab === 'ideas' ? '' : 'hidden'}><Ideas S={S} update={update} push={push} rerun={() => runStrategist(ctx)} /></div>
        <div className={tab === 'pitch' ? '' : 'hidden'}><Pitch S={S} draft={readme => runPitch(ctx, readme, false)} /></div>
        <div className={tab === 'settings' ? '' : 'hidden'}><Settings S={S} update={update} /></div>
      </main>

      <div id="flash" />
      <div id="toasts" />
    </>
  )
}
