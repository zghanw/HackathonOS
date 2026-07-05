import { useState } from 'react'
import { buildKickoffPrompt } from '../lib/core.js'
import { Ic, PromptCard } from '../lib/ui.jsx'

// replaces the old zip scaffolder: Claude Code does the scaffolding + building,
// with the Guardian's live gates compiled into its instructions
export default function Kickoff({ S }) {
  const [stack, setStack] = useState('React 18 + Vite + Tailwind CSS v4 frontend · Python FastAPI backend')
  const [budget, setBudget] = useState(24)
  const [prompt, setPrompt] = useState('')

  const compose = () => setPrompt(buildKickoffPrompt({ idea: S.idea || null, stack, run: S.run || null, budgetH: +budget || 24 }))

  return (
    <>
      <div className="glass mb-4 p-6">
        <h2>Build Kickoff</h2>
        <p className="text-mut">One prompt to start Claude Code on the actual build: scaffold, wow-feature-first ordering, security hygiene, and your deadline gates as rules it enforces — after code freeze, Claude refuses new features.</p>
        <div className="my-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-mut">idea: {S.idea ? <b className="text-acc">{S.idea.name}</b> : <span className="text-warn">none locked — Claude will ask</span>}</span>
          <span className="text-mut">gates: {S.run ? <b className="text-acc">live run ({S.run.milestones.length} gates, real times)</b> : <span>no active run — using a relative T-minus plan</span>}</span>
        </div>
        <div className="my-3 flex flex-wrap items-end gap-3">
          <label className="grow">Stack<br /><input className="w-full" value={stack} onChange={e => setStack(e.target.value)} /></label>
          {!S.run && (
            <label>Window (hours)<br />
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min={4} max={72} /></label>
          )}
          <button className="btn btn-primary" onClick={compose}><Ic n="terminal" />Compose kickoff prompt</button>
        </div>
      </div>

      <PromptCard title="Claude Code kickoff prompt" prompt={prompt} />
    </>
  )
}
