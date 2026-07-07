import { useState } from 'react'
import { RECORD_CHECKLIST } from '../lib/core.js'
import { Ic, copyText } from '../lib/ui.jsx'

// pitchsmith output: auto-drafted when the video/devpost gate approaches, or on demand
export default function Pitch({ S, draft }) {
  const [readme, setReadme] = useState('')
  const p = S.pitch

  if (!S.mission) {
    return <div className="glass p-6"><h2>Pitch</h2><p className="text-mut">Launch a mission first — the pitchsmith drafts your submission kit automatically as the demo-video gate approaches.</p></div>
  }

  const deckText = p ? p.deck.map((s, i) => `${i + 1}. ${s.title}\n${(s.bullets || []).map(b => '   - ' + b).join('\n')}`).join('\n') : ''
  const scriptText = p ? p.script.map(([t, s]) => `${t}  ${s}`).join('\n') : ''

  return (
    <>
      <div className="glass mb-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2>Pitchsmith</h2>
            <p className="mb-0 text-mut">
              {p
                ? <>Kit drafted {new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · source: <b className={p.source === 'claude' ? 'text-acc' : 'text-warn'}>{p.source}</b></>
                : 'Drafts itself as the demo-video gate approaches — or run it now. Paste your README below for sharper output.'}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => draft(readme)}><Ic n="mic" />{p ? 'Re-draft' : 'Draft now'}</button>
        </div>
        <textarea className="mt-3 min-h-[90px]" value={readme} onChange={e => setReadme(e.target.value)}
          placeholder="(optional) paste your README or feature notes — the pitchsmith works from the mission + pick without it" />
      </div>

      {p && (
        <>
          <div className="glass mb-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="mb-0">Devpost draft</h2>
              <button className="btn" onClick={() => copyText(`# ${p.devpost.title}\n> ${p.devpost.tagline}\n\n${p.devpost.description}`, 'Devpost draft')}><Ic n="copy" />Copy</button>
            </div>
            <p className="mt-2 text-lg font-bold">{p.devpost.title}</p>
            <p className="italic text-acc">{p.devpost.tagline}</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[.03] p-4 font-sans text-[13px] leading-relaxed text-mut">{p.devpost.description}</pre>
          </div>

          <div className="glass mb-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="mb-0">Deck — {p.deck.length} slides</h2>
              <button className="btn" onClick={() => copyText(deckText, 'Deck outline')}><Ic n="copy" />Copy</button>
            </div>
            <div className="mt-2">
              {p.deck.map((s, i) => (
                <div key={i} className="mb-2 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3">
                  <b className="text-acc">{i + 1}. {s.title}</b>
                  {(s.bullets || []).length > 0 && (
                    <ul className="ml-5 mt-1.5 list-disc text-[13px] text-mut">
                      {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass mb-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="mb-0">Demo script — 3:00, time-coded</h2>
              <button className="btn" onClick={() => copyText(scriptText, 'Demo script')}><Ic n="copy" />Copy</button>
            </div>
            <table className="mt-2 w-full border-collapse">
              <tbody>
                {p.script.map(([t, s], i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap border-b border-white/10 px-2.5 py-2 font-bold text-acc">{t}</td>
                    <td className="border-b border-white/10 px-2.5 py-2 text-sm">{s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass p-6">
            <h2>Record the demo. Don't run it live.</h2>
            <ul>
              {RECORD_CHECKLIST.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5 py-1 text-sm">
                  <Ic n="check" className="mt-0.5 text-acc" /><span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  )
}
