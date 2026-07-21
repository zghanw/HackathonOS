import { useRef, useState } from 'react'
import { genMilestones } from '../lib/core.js'
import { Ic, toast, audioInit } from '../lib/ui.jsx'
import { createTeam, joinTeam } from '../lib/team.js'

// free-text sponsor/track tags: type + Enter to add, X (or Backspace on empty input) to remove
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
    <div className="my-2 flex min-h-11 cursor-text flex-wrap items-center gap-1.5 border-2 border-edge bg-panel2 px-2 py-1.5 shadow-[inset_2px_2px_0_rgba(0,0,0,.4)] focus-within:border-acc"
      onClick={() => inputRef.current?.focus()}>
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 border-2 border-acc/40 bg-acc/10 px-2 py-0.5 text-[13px] text-acc">
          {t}
          <button type="button" aria-label={`Remove ${t}`}
            className="cursor-pointer p-0.5 hover:bg-acc/25"
            onClick={e => { e.stopPropagation(); onChange(tags.filter(x => x !== t)) }}>
            <Ic n="x" s={11} />
          </button>
        </span>
      ))}
      <input ref={inputRef} value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={onKey} onBlur={commit}
        placeholder={tags.length ? 'add another…' : placeholder}
        className="min-w-[150px] grow !border-0 bg-transparent px-1 py-0.5 text-sm !shadow-none" />
    </div>
  )
}

const toLocal = d => {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const REQS = [['devpost', 'Devpost link'], ['video', 'Demo video'], ['repo', 'Public repo']]

export default function Join({ onDone }) {
  const [userName, setUserName] = useState('')
  const [busy, setBusy] = useState(false)
  // join
  const [code, setCode] = useState('')
  // create
  const [name, setName] = useState('')
  const [theme, setTheme] = useState('')
  const [tracks, setTracks] = useState([])
  const [stack, setStack] = useState('')
  const [start, setStart] = useState(() => toLocal(new Date()))
  const [end, setEnd] = useState(() => toLocal(new Date(Date.now() + 24 * 36e5)))
  const [reqs, setReqs] = useState({ devpost: true, video: true, repo: true })
  const [plan, setPlan] = useState('classic') // starting preset; everything is editable after creation
  const preset = h => setEnd(toLocal(new Date(+new Date(start) + h * 36e5)))

  const needName = () => { toast('First, tell the team who you are. Name is required.', 'warn'); return false }

  const run = async fn => {
    if (busy) return
    setBusy(true)
    try {
      try { window.Notification && Notification.requestPermission() } catch { /* denied */ }
      audioInit()
      onDone(await fn())
    } catch (e) {
      toast(e.message || 'Something failed. Try again.', 'bad')
    } finally { setBusy(false) }
  }

  const join = () => {
    if (!userName.trim()) return needName()
    if (!code.trim()) return toast('Enter the 6-character team code.', 'warn')
    run(() => joinTeam(code, userName))
  }
  const create = () => {
    if (!userName.trim()) return needName()
    const s = +new Date(start), e = +new Date(end)
    if (!s || !e) return toast('Set start and end times first.', 'warn')
    if (e <= Date.now() + 30 * 60e3) return toast('End must be at least 30 minutes in the future.', 'bad')
    const milestones = plan === 'classic' ? genMilestones(s, e, reqs) : []
    run(() => createTeam({ name: name.trim(), theme: theme.trim(), tracks, stack: stack.trim(), start: s, end: e, reqs, milestones }, userName))
  }

  return (
    <main className="mx-auto max-w-[1080px] px-5 pb-24 pt-10">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2.5">
          <Ic n="clock" s={24} className="text-acc" />
          <span className="font-pixel text-[20px] text-acc">HACKATHON OS</span>
        </div>
        <p className="text-mut">The one screen your whole party keeps open. Presence, quests, the tome and the chest,<br />all against the same countdown to the same hard gates.</p>
      </div>

      <div className="mx-auto mb-6 max-w-md">
        <div className="panel p-5">
          <label>Your name (what your party sees)<br />
            <input className="w-full" value={userName} onChange={e => setUserName(e.target.value)} placeholder="e.g. Jalen" maxLength={24} />
          </label>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* join */}
        <div className="panel animate-rise p-6">
          <h2><Ic n="users" s={15} className="mr-2 inline align-[-2px] text-acc" />Join the party</h2>
          <p className="text-mut">Someone already made the space? Grab the 6-character code from them.</p>
          <input className="my-3 w-full text-center font-pixel text-[15px] uppercase tracking-[6px]" maxLength={6}
            value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3"
            onKeyDown={e => e.key === 'Enter' && join()} />
          <button className="btn btn-primary w-full py-3" onClick={join} disabled={busy}>
            <Ic n="play" s={12} />{busy ? 'Joining…' : 'Join party'}
          </button>
        </div>

        {/* create */}
        <div className="panel animate-rise p-6" style={{ animationDelay: '.08s' }}>
          <h2><Ic n="zap" s={15} className="mr-2 inline align-[-2px] text-acc" />Start a new run</h2>
          <p className="text-mut">Set up the mission once for the whole party. Everyone else just joins with the code.</p>
          <div className="my-3 grid gap-3 sm:grid-cols-2">
            <label>Hackathon name<br /><input className="w-full" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 'MyHack'" /></label>
            <label>Team stack<br /><input className="w-full" value={stack} onChange={e => setStack(e.target.value)} placeholder="e.g. 'Vue, FastAPI'" /></label>
          </div>
          <label>Theme / problem statement (optional):</label>
          <textarea className="min-h-[60px]" value={theme} onChange={e => setTheme(e.target.value)}
            placeholder="e.g. 'improve developer security and CI pipelines'" />
          <label>Sponsor tracks (optional): type a company, press Enter</label>
          <TagInput tags={tracks} onChange={setTracks} placeholder="e.g. AWS, Grab, Maybank" />
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
          <div className="my-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-mut">Quest log starts with:</span>
            {[['classic', 'Classic plan (11 gates)'], ['empty', 'Start empty']].map(([v, lbl]) => (
              <label key={v} className="flex cursor-pointer items-center gap-1.5 text-ink">
                <input type="radio" name="plan" checked={plan === v} onChange={() => setPlan(v)} /> {lbl}
              </label>
            ))}
          </div>
          <button className="btn btn-primary w-full py-3" onClick={create} disabled={busy}>
            <Ic n="play" s={12} />{busy ? 'Creating…' : 'Create + get invite code'}
          </button>
        </div>
      </div>
    </main>
  )
}
