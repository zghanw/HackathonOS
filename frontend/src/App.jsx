import { useEffect, useMemo, useRef, useState } from 'react'
import { paceState, fmtDur, fmtShort, fmtAgo, remindEvery } from './lib/core.js'
import { useTeam } from './lib/team.js'
import { Ic, notify, flash, audioInit, copyText } from './lib/ui.jsx'
import Join from './modules/Join.jsx'
import Guardian from './modules/Guardian.jsx'
import Tasks from './modules/Tasks.jsx'
import Notes from './modules/Notes.jsx'
import Files from './modules/Files.jsx'

// motif renames are UI labels only — ids/routes/behavior unchanged
const TABS = [['guardian', 'Boss Timer'], ['tasks', 'Quests'], ['notes', 'Tome'], ['files', 'Chest']]
const MINI_C = { ok: 'text-ok !border-ok/60', behind: 'text-warn !border-warn/60', danger: 'text-bad !border-bad animate-pulse2' }

// connected = presence channel; idle flag = member row (postgres_changes)
export const liveState = (presence, m) =>
  presence[m.id] ? (m.idle ? 'idle' : 'online') : 'offline'

// party-member portrait: square pixel frame, border color = liveness
export function Avatar({ m, live, size = 30 }) {
  const edge = live === 'online' ? 'border-ok' : live === 'idle' ? 'border-warn' : 'border-white/20'
  return (
    <span title={`${m.name}${m.status_text ? ': ' + m.status_text : ''} (${live}, ${fmtAgo(m.last_active)})`}
      className={`grid shrink-0 place-items-center border-2 font-bold uppercase shadow-[2px_2px_0_rgba(0,0,0,.45)] ${edge} ${live === 'offline' ? 'opacity-40' : ''}`}
      style={{ width: size, height: size, background: m.color + '2e', color: m.color, fontSize: size * 0.38 }}>
      {m.name.slice(0, 2)}
    </span>
  )
}

// my "what I'm doing right now" line — Figma-cursor-label for the whole team
function StatusInput({ me, api }) {
  const [txt, setTxt] = useState(me?.status_text || '')
  const t = useRef(null)
  useEffect(() => { setTxt(me?.status_text || '') }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const onChange = v => {
    setTxt(v)
    clearTimeout(t.current)
    t.current = setTimeout(() => api.setStatus(v.trim()), 600)
  }
  return (
    <input value={txt} onChange={e => onChange(e.target.value)} maxLength={80}
      placeholder="what are you doing right now?"
      className="w-60 !py-1.5 !text-[13px]" />
  )
}

export default function App() {
  const T = useTeam()
  const { team, members, milestones: mRows, tasks, note, presence, myId, api } = T
  const [tab, setTab] = useState('guardian')
  const [now, setNow] = useState(Date.now())
  const book = useRef({}) // per-milestone alarm bookkeeping — reset on reload is fine

  // shared truth: milestone rows straight from the DB, sorted by time
  const milestones = useMemo(() =>
    mRows.map(r => ({ ...r, at: Number(r.at), done: !!r.done_by, doneBy: r.done_by }))
      .sort((a, b) => a.at - b.at),
  [mRows])

  useEffect(() => {
    const h = () => audioInit()
    document.addEventListener('click', h, { once: true })
    return () => document.removeEventListener('click', h)
  }, [])

  useEffect(() => {
    if (!team) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [!!team]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the guardian loop: escalating alarms on every teammate's machine ----
  useEffect(() => {
    if (!team) { document.title = 'Hackathon OS'; return }
    const left = Number(team.ends_at) - now
    const pace = paceState(milestones, now)
    document.title = (pace !== 'ok' && Math.floor(now / 1000) % 2 ? '● ' : '') + (left > 0 ? fmtDur(left) : 'CLOSED') + ' · Hackathon OS'

    // deleted gates lose their alarm state; a time-edited gate re-arms (b.at mismatch)
    const ids = new Set(milestones.map(m => m.id))
    for (const k of Object.keys(book.current)) if (k !== 'ended' && !ids.has(k)) delete book.current[k]
    for (const m of milestones) {
      if (m.done) { delete book.current[m.id]; continue }
      let b = book.current[m.id]
      if (!b || b.at !== m.at) b = book.current[m.id] = { at: m.at }
      if (!b.warned && m.at > now && m.at - now <= 15 * 60e3) {
        b.warned = 1
        notify(`Up next (T-${fmtShort(Number(team.ends_at) - m.at)})`, `${m.label}, due in ${fmtShort(m.at - now)}`, m.hard)
      }
      if (m.at <= now && left > -36e5) {
        const cad = remindEvery(left)
        if (now - (b.lastN || 0) >= cad) {
          b.lastN = now
          notify(m.hard ? 'HARD GATE MISSED' : 'Overdue', `${m.label}. Check it off or cut scope.`, m.hard)
          if (m.hard) flash()
        }
      }
    }
    if (left <= 0 && !book.current.ended) {
      book.current.ended = 1
      notify('WINDOW CLOSED', 'Submission window is over.', true)
      flash()
    }
  }, [now, team, milestones])

  if (!T.ready) {
    return <div className="grid min-h-screen place-items-center text-mut">connecting…</div>
  }
  if (!team) {
    return (
      <>
        <div id="bg" aria-hidden="true" />
        <Join onDone={T.setSess} />
        <div id="flash" /><div id="toasts" />
      </>
    )
  }

  const left = Number(team.ends_at) - now
  const pace = paceState(milestones, now)
  const me = members.find(m => m.id === myId)
  const invite = () => copyText(
    `Join our Hackathon OS team space. Code: ${team.code}\n${location.origin}${location.pathname}`,
    'Invite (code ' + team.code + ')')

  return (
    <>
      <div id="bg" aria-hidden="true" />

      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b-[3px] border-edge bg-[#1c1730] px-5 py-3 shadow-[0_3px_0_rgba(0,0,0,.4)]">
        <div className="flex items-center gap-2.5 leading-tight">
          <img src="/logo.png" alt="Hackathon OS Logo" className="h-7 w-7 object-contain [image-rendering:pixelated]" />
          <span>
            <span className="font-pixel text-[12px] text-acc">HACKATHON OS</span>
            <small className="block text-[11px] tracking-normal text-mut">{team.name || 'team space'}</small>
          </span>
        </div>
        <button className="chip cursor-pointer hover:text-ink" onClick={invite} title="Copy invite code + link">
          <Ic n="copy" s={11} className="mr-1.5 inline align-[-1px]" />code <b className="ml-1 text-acc tracking-widest">{team.code}</b>
        </button>
        <button className={`chip cursor-pointer tabular-nums ${MINI_C[pace]}`} onClick={() => setTab('guardian')}>
          {left > 0 ? fmtDur(left) : 'CLOSED'}
        </button>
        <span className="flex items-center gap-1">
          {members.map(m => <Avatar key={m.id} m={m} live={liveState(presence, m)} size={28} />)}
        </span>
        <StatusInput me={me} api={api} />
        <nav className="ml-auto flex flex-wrap items-center gap-1">
          {TABS.map(([id, label]) => (
            <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
          <button className="btn ml-1 !px-2.5 !py-2" title="Leave team space (your check-offs stay)"
            onClick={() => confirm('Leave this team space on this device?') && api.leave()}>
            <Ic n="logout" s={14} />
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 pb-24 pt-6">
        <div className={tab === 'guardian' ? '' : 'hidden'}>
          <Guardian team={team} members={members} milestones={milestones} presence={presence} now={now} myId={myId} api={api} onInvite={invite} />
        </div>
        <div className={tab === 'tasks' ? '' : 'hidden'}>
          <Tasks tasks={tasks} members={members} presence={presence} myId={myId} api={api} />
        </div>
        <div className={tab === 'notes' ? '' : 'hidden'}>
          <Notes note={note} members={members} presence={presence} myId={myId} api={api} active={tab === 'notes'} />
        </div>
        <div className={tab === 'files' ? '' : 'hidden'}>
          <Files teamId={team.id} filesVersion={T.filesVersion} api={api} />
        </div>
      </main>

      <div id="flash" />
      <div id="toasts" />
    </>
  )
}
