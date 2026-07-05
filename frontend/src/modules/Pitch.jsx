import { useState } from 'react'
import { rubricScore, buildPitchPrompt } from '../lib/core.js'
import { Ic, toast, PromptCard } from '../lib/ui.jsx'

const W = { innovation: '27.5%', technical: '25%', impact: '25%', design: '15%', presentation: '7.5%' }

export default function Pitch({ S, update }) {
  const [raw, setRaw] = useState('')
  const [score, setScore] = useState(null)
  const [prompt, setPrompt] = useState('')

  const prefill = () => {
    if (!S.idea) return toast('Lock an idea first (Ideas tab), or just paste your README.', 'warn')
    setRaw(`# ${S.idea.name}\n${S.idea.diff || ''}\n- ${S.idea.wow || ''}\n- Security-first: least privilege, no secrets in the client`)
  }

  const gen = () => {
    const text = raw.trim()
    if (!text) return toast('Paste your README or feature list first.', 'warn')
    const lines = text.split('\n')
    let features = lines.filter(l => /^\s*[-*+]\s+/.test(l)).map(l => l.replace(/^\s*[-*+]\s+/, '').trim()).slice(0, 8)
    if (!features.length) features = lines.slice(1).filter(l => l.trim() && !l.startsWith('#')).slice(0, 3)
    const s = rubricScore(text, features, S.idea || null)
    setScore(s)
    setPrompt(buildPitchPrompt({ readme: text, idea: S.idea || null, run: S.run || null }))
    update({ pitch: { at: Date.now() } })
    toast(`Pre-score ${s.total}/100 — fix the weak spots before spending Claude tokens.`, s.total >= 70 ? 'ok' : 'warn')
  }

  return (
    <>
      <div className="glass mb-4 p-6">
        <h2>Pitch Brief</h2>
        <p className="text-mut">Paste your README → an instant local rubric pre-score (fix weaknesses for free), plus a pitch-engineer prompt that has Claude produce the deck (real .pptx via python-pptx), the 3:00 time-coded demo script, and a tailored recording checklist. Rubric: Innovation 27.5% · Technical 25% · Impact 25% · Design 15% · Presentation 7.5%.</p>
        <textarea value={raw} onChange={e => setRaw(e.target.value)}
          placeholder={'# Project Name\nOne-line description\n- feature one\n- feature two'} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={prefill}><Ic n="reply" />Prefill from locked idea</button>
          <button className="btn btn-primary" onClick={gen}><Ic n="mic" />Pre-score + compose prompt</button>
        </div>
      </div>

      {score && (
        <div className="glass mb-4 p-6">
          <h2>Local pre-score: {score.total}/100</h2>
          {Object.entries(score.sub).map(([k, v]) => (
            <div key={k} className="my-1.5 flex items-center gap-2.5">
              <div className="w-[170px] text-[13px] text-mut">{k[0].toUpperCase() + k.slice(1)} ({W[k]})</div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#4ade80] transition-[width] duration-700" style={{ width: v + '%' }} />
              </div>
              <div className="w-9 text-right tabular-nums">{v}</div>
            </div>
          ))}
          <p className="mt-3 font-bold">Fix first (free, before Claude sees it):</p>
          <ul className="ml-5 list-disc text-sm">
            {score.tips.map(t => <li key={t.cat}><b>{t.cat}:</b> {t.tip}</li>)}
          </ul>
        </div>
      )}

      <PromptCard title="Pitch-engineer prompt" prompt={prompt} />
    </>
  )
}
