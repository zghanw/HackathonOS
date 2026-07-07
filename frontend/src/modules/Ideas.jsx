import { fmtShort } from '../lib/core.js'
import { Ic } from '../lib/ui.jsx'

const SCORE_C = f => (f >= 75 ? 'text-ok' : f >= 55 ? 'text-warn' : 'text-bad')

// the strategist's board: auto-populated on mission launch, one-click override
export default function Ideas({ S, update, push, rerun }) {
  const ideas = S.ideas

  if (!S.mission) {
    return <div className="glass p-6"><h2>Ideas</h2><p className="text-mut">Launch a mission first — the strategist generates and picks ideas automatically.</p></div>
  }

  const pickIt = i => {
    update(prev => ({ ideas: { ...prev.ideas, pickIdx: i } }))
    push('system', 'action', `Pick overridden — building "${ideas.list[i].name}"`)
  }

  return (
    <>
      <div className="glass mb-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2>Strategist's board</h2>
            <p className="mb-0 text-mut">
              {ideas
                ? <>Generated {new Date(ideas.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · source: <b className={ideas.source === 'claude' ? 'text-acc' : 'text-warn'}>{ideas.source}</b> · the pick feeds the guardian and pitchsmith. Disagree? Override with one click.</>
                : 'The strategist is generating ideas…'}
            </p>
          </div>
          <button className="btn" onClick={rerun}><Ic n="sparkles" />Re-run strategist</button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
        {(ideas?.list || []).map((i, idx) => {
          const picked = idx === ideas.pickIdx
          return (
            <div key={idx} className={`glass p-5 transition hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,0,0,.5)] ${picked ? 'border-ok/50' : ''}`}
              style={picked ? { boxShadow: '0 10px 34px rgba(0,0,0,.45), 0 0 40px rgba(34,197,94,.1)' } : undefined}>
              <div className={`float-right text-[32px] font-extrabold leading-none ${SCORE_C(i.feasibility)}`}>{i.feasibility}</div>
              <h3 className="mb-1 flex flex-wrap items-center gap-2 font-bold">
                {i.name}
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-mut">{i.label}</span>
                {picked && <span className="rounded-full border border-ok/50 bg-ok/10 px-2 py-0.5 text-[11px] font-bold text-ok">PICKED</span>}
              </h3>
              <p className="italic text-mut">“{i.differentiator}”</p>
              <p className="my-2 text-sm"><b>Wow MVP:</b> {i.wow}</p>
              {i.hours && (
                <p className="text-[13px] text-mut tabular-nums">hours: {i.hours.build ?? '?'} build · {i.hours.integrate ?? '?'} integrate · {i.hours.polish ?? '?'} polish</p>
              )}
              {i.diesIf && <p className="text-[13px] text-warn">dies if: {i.diesIf}</p>}
              <div className="my-2 flex flex-wrap gap-1.5">
                {(i.sponsors || []).map((s, j) => (
                  <span key={j} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[.03] px-2 py-0.5 text-[11px] text-mut">
                    <Ic n="trophy" s={12} /> <b>{s.name}</b> · {s.api} · {s.prize}
                  </span>
                ))}
              </div>
              {Array.isArray(i.buildPlan) && i.buildPlan.length > 0 && (
                <ol className="my-2 ml-5 list-decimal text-[13px] text-mut">
                  {i.buildPlan.map((p, j) => <li key={j}>{p}</li>)}
                </ol>
              )}
              {!picked && <button className="btn mt-1" onClick={() => pickIt(idx)}><Ic n="check" />Build this instead</button>}
            </div>
          )
        })}
      </div>
    </>
  )
}
