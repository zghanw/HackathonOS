import { useState } from 'react'
import { SPONSORS, buildIdeaPrompt } from '../lib/core.js'
import { Ic, toast, PromptCard } from '../lib/ui.jsx'

export default function Ideas({ S, update }) {
  const [tracks, setTracks] = useState([])
  const [problem, setProblem] = useState('')
  const [stack, setStack] = useState('React, Tailwind, FastAPI')
  const [budget, setBudget] = useState(24)
  const [prompt, setPrompt] = useState('')
  // lock-your-pick: paste back the winner from Claude's answer
  const [pick, setPick] = useState({ name: '', wow: '', diff: '' })

  const toggleTrack = k => setTracks(t => (t.includes(k) ? t.filter(x => x !== k) : [...t, k]))
  const compose = () => setPrompt(buildIdeaPrompt({ tracks, problem, stack, budgetH: +budget || 24 }))
  const lock = () => {
    if (!pick.name.trim()) return toast('Give the idea a name first.', 'warn')
    const idea = {
      id: pick.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'hack-project',
      name: pick.name.trim(), wow: pick.wow.trim(), diff: pick.diff.trim(),
    }
    update({ idea })
    toast(`Locked: ${idea.name}. It now feeds the Guardian, Kickoff, and Pitch.`, 'ok')
  }

  return (
    <>
      <div className="glass mb-4 p-6">
        <h2>Idea Brief</h2>
        <p className="text-mut">Compiles your tracks, theme, stack and time budget into a strategist prompt for Claude — prize-track mapping, brutal feasibility scoring and one-wow MVP scoping baked in. Claude generates; you pick; lock the winner below.</p>
        <label>Sponsor tracks at this hackathon:</label>
        <div className="my-2.5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-1.5">
          {Object.entries(SPONSORS).map(([k, s]) => (
            <label key={k} className="flex items-center gap-1.5 text-[13px] text-ink">
              <input type="checkbox" checked={tracks.includes(k)} onChange={() => toggleTrack(k)} /> {s.name}
            </label>
          ))}
        </div>
        <label>Problem statement / theme (optional):</label>
        <textarea value={problem} onChange={e => setProblem(e.target.value)}
          placeholder="e.g. 'improve developer security and CI pipelines' — leave blank for an open theme" />
        <div className="my-3 flex flex-wrap items-center gap-3">
          <label>Team stack<br /><input value={stack} onChange={e => setStack(e.target.value)} size={28} /></label>
          <label>Time budget (hours of actual building)<br />
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min={4} max={72} /></label>
        </div>
        <button className="btn btn-primary" onClick={compose}><Ic n="sparkles" />Compose idea prompt</button>
      </div>

      <PromptCard title="Strategist prompt" prompt={prompt} />

      <div className="glass p-6">
        <h2>Lock your pick</h2>
        <p className="text-mut">When Claude answers, bring the winner back — it feeds the Guardian header, the Build Kickoff prompt, and the Pitch brief.</p>
        <div className="my-3 grid gap-3 sm:grid-cols-2">
          <label>Idea name<br /><input className="w-full" value={pick.name} onChange={e => setPick({ ...pick, name: e.target.value })} placeholder="PR Tripwire" /></label>
          <label>One-wow MVP<br /><input className="w-full" value={pick.wow} onChange={e => setPick({ ...pick, wow: e.target.value })} placeholder="commit a live key → revoked + PR comment in 10s" /></label>
          <label className="sm:col-span-2">Differentiator<br /><input className="w-full" value={pick.diff} onChange={e => setPick({ ...pick, diff: e.target.value })} placeholder="unlike repo scanners, we guard the merge itself" /></label>
        </div>
        <button className="btn" onClick={lock}><Ic n="lock" />Lock this idea</button>
        {S.idea && <span className="ml-3 text-sm text-mut">currently locked: <b className="text-acc">{S.idea.name}</b></span>}
      </div>
    </>
  )
}
