import { useState } from 'react'
import { paceState, fmtDur, fmtShort, fmtAgo } from '../lib/core.js'
import { Ic, notify, flash, audioInit, toast } from '../lib/ui.jsx'
import { Avatar, liveState } from '../App.jsx'

const PACE_TXT = {
  ok: () => 'BUFF · ON PACE. Keep shipping.',
  behind: n => `DEBUFF · BEHIND. ${n} gate overdue: do it or cut it. Not deciding is the trap.`,
  danger: n => `DEBUFF · DANGER. ${n} overdue. Rally the party and cut scope NOW.`,
}
const PACE_C = {
  ok: 'border-ok/50 bg-ok/10 text-ok',
  behind: 'border-warn/50 bg-warn/10 text-warn',
  danger: 'border-bad bg-bad/15 text-bad animate-pulse2',
}
// danger countdown is red but not pulsed: the big digits are the largest element on
// screen, and the continuous-animation budget goes to the two small status chips
const COUNT_C = { ok: 'text-ok', behind: 'text-warn', danger: 'text-bad' }
const BAR_C = { ok: '#2fbf5c', behind: '#e09b2d', danger: '#e05252' }
const LIVE_TXT = { online: 'text-ok', idle: 'text-warn', offline: 'text-mut' }

// gate times are entered as T-minus from the deadline ("2h30m", "T-45m") because
// that's how hackathon schedules are spoken; the list shows both renderings
export const parseTmin = str => {
  const m = String(str).trim().match(/^t?-?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i)
  if (!m || (!m[1] && !m[2])) return null
  return (Number(m[1] || 0) * 3600e3) + (Number(m[2] || 0) * 60e3)
}

function GateEditor({ initial, end, onSave, onCancel }) {
  const [label, setLabel] = useState(initial?.label || '')
  const [tmin, setTmin] = useState(initial ? fmtShort(end - initial.at) : '')
  const [hard, setHard] = useState(initial?.hard || false)
  const off = parseTmin(tmin)
  const valid = label.trim() && off !== null
  const at = off !== null ? end - off : null
  const save = () => valid && onSave({ label: label.trim(), at, hard })
  return (
    <li className="slab grid gap-2 p-3 !border-acc/60">
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Gate label" maxLength={90} autoFocus
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }} />
      <div className="flex flex-wrap items-center gap-2.5">
        <input className="w-28 tabular-nums" value={tmin} onChange={e => setTmin(e.target.value)} placeholder="T-2h30m"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }} />
        <span className={`text-xs ${at ? 'text-mut' : 'text-bad'}`}>
          {at !== null
            ? new Date(at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
            : 'time before deadline, like 2h30m or 45m'}
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
          <input type="checkbox" checked={hard} onChange={e => setHard(e.target.checked)} /> HARD gate
        </label>
        <span className="ml-auto flex gap-1.5">
          <button className="btn btn-primary !px-2.5 !py-1.5" disabled={!valid} onClick={save}><Ic n="check" s={12} />Save</button>
          <button className="btn !px-2.5 !py-1.5" onClick={onCancel}><Ic n="x" s={12} /></button>
        </span>
      </div>
    </li>
  )
}

export default function Guardian({ team, members, milestones, presence, now, myId, api, onInvite }) {
  const start = Number(team.starts_at), end = Number(team.ends_at)
  const left = end - now
  const pace = paceState(milestones, now)
  const missed = milestones.filter(m => !m.done && m.at <= now).length
  const done = milestones.filter(m => m.done).length
  const total = milestones.length
  const pct = total ? Math.round(100 * done / total) : 0
  const prog = Math.min(100, 100 * (now - start) / (end - start))
  const next = milestones.find(m => !m.done)
  const nameOf = id => members.find(m => m.id === id)?.name
  const [edit, setEdit] = useState(null) // null | 'new' | gate id

  const testAlarm = () => {
    try { window.Notification && Notification.requestPermission() } catch { /* denied */ }
    audioInit()
    notify('Alarm test', 'This is what a hard-gate miss looks like.', true)
    flash()
  }

  const remove = async m => {
    const row = await api.removeMilestone(m)
    toast('Removed gate: ' + m.label, 'warn', { label: 'Undo', fn: () => api.restoreMilestone(row) })
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {/* boss timer: the same clock on every party member's screen */}
      <div className="panel animate-rise flex flex-col p-6 sm:col-span-2 lg:row-span-2">
        <h4 className="tile-label">Boss timer</h4>
        <div className={`mb-2 mt-auto font-pixel leading-none tabular-nums text-[clamp(24px,3.6vw,46px)] ${COUNT_C[pace]}`}>
          {left > 0 ? fmtDur(left) : '00:00:00'}
        </div>
        {/* elapsed-window bar: width set per render, no transition */}
        <div className="pixbar my-2">
          <i style={{ width: prog + '%', '--pixbar-c': BAR_C[pace] }} />
          {milestones.filter(m => m.hard).map(m => (
            <span key={m.id} className="absolute -top-[2px] h-[16px] w-[3px] bg-bad"
              style={{ left: Math.max(0, Math.min(100, 100 * (m.at - start) / (end - start))) + '%' }} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-mut">
          <span>ends {new Date(end).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {team.stack && <span>stack: <b className="text-acc">{team.stack}</b></span>}
          <span>reqs: {Object.keys(team.reqs).filter(k => team.reqs[k]).join(', ') || 'none'}</span>
          {team.tracks?.length > 0 && <span>tracks: {team.tracks.join(', ')}</span>}
        </div>
      </div>

      {/* pace = status effect */}
      <div className="panel animate-rise p-6 sm:col-span-2" style={{ animationDelay: '.06s' }}>
        <h4 className="tile-label">Status effect</h4>
        <div className={`flex min-h-16 items-center justify-center border-2 p-4 text-center font-pixel text-[10px] leading-relaxed ${PACE_C[pace]}`}>
          {left > 0 ? PACE_TXT[pace](missed) : 'WINDOW CLOSED. Did you submit?'}
        </div>
      </div>

      {/* next gate */}
      <div className="panel animate-rise p-6" style={{ animationDelay: '.12s' }}>
        <h4 className="tile-label">Next gate</h4>
        {next ? (
          <>
            <div className={`text-sm font-semibold ${next.at <= now ? 'text-bad' : ''}`}>
              {next.hard && <span className="gate">HARD</span>}{next.label}
            </div>
            <div className="mt-1.5 text-xs text-mut tabular-nums">
              {next.at > now ? `due in ${fmtShort(next.at - now)}` : `OVERDUE by ${fmtShort(now - next.at)}`} · T-{fmtShort(end - next.at)}
            </div>
          </>
        ) : total ? (
          <>
            <div className="text-sm font-semibold">All gates cleared</div>
            <div className="mt-1.5 text-xs text-mut">Submit and breathe.</div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold">No gates yet</div>
            <div className="mt-1.5 text-xs text-mut">Add the first one in the quest log below.</div>
          </>
        )}
      </div>

      {/* progress + controls */}
      <div className="panel animate-rise p-6" style={{ animationDelay: '.18s' }}>
        <h4 className="tile-label">Quest progress</h4>
        <div className="pixbar"><i style={{ width: pct + '%' }} /></div>
        <div className="mt-2 flex items-baseline gap-3 text-[13px] text-mut">
          <b className="font-pixel text-[13px] text-ink">{pct}%</b>
          <span><b className="text-ink">{done}</b>/{total} done</span>
          <span><b className="text-ink">{milestones.filter(m => m.hard && !m.done).length}</b> hard left</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={testAlarm}><Ic n="bell" s={12} />Alarm</button>
          <button className="btn" onClick={onInvite}><Ic n="copy" s={12} />Invite</button>
        </div>
      </div>

      {/* party: who's on what, right now. The reason this app exists. */}
      <div className="panel animate-rise p-6 sm:col-span-2 lg:col-span-4" style={{ animationDelay: '.24s' }}>
        <h4 className="tile-label"><Ic n="users" s={11} className="mr-1.5 inline align-[-2px]" />Party: who's on what, right now</h4>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {members.map(m => {
            const live = liveState(presence, m)
            return (
              <li key={m.id} className="slab flex items-center gap-3 p-3">
                <Avatar m={m} live={live} size={34} />
                <div className="min-w-0 grow">
                  <div className="flex items-baseline gap-2 text-sm font-semibold">
                    <span className="truncate">{m.name}</span>
                    {m.id === myId && <span className="text-[10px] font-normal text-mut">(you)</span>}
                    {m.editing && presence[m.id] && <span className="text-[10px] font-normal text-warn"><Ic n="pencil" s={9} className="mr-0.5 inline" />editing tome</span>}
                  </div>
                  <div className={`truncate text-[12.5px] ${m.status_text ? 'text-ink/80' : 'italic text-mut'}`}>
                    {m.status_text || 'no status set'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`font-pixel text-[8px] uppercase ${LIVE_TXT[live]}`}>{live}</div>
                  <div className="text-[11px] text-mut tabular-nums">{live === 'offline' ? fmtAgo(Number(m.last_active)) : 'now'}</div>
                </div>
              </li>
            )
          })}
        </ul>
        {members.length === 1 && (
          <p className="mt-3 text-sm text-mut">Flying solo so far. <button className="cursor-pointer text-acc underline" onClick={onInvite}>Copy the invite code</button> and get your party in here.</p>
        )}
      </div>

      {/* quest log: team-managed timeline, every change syncs live */}
      <div className="panel animate-rise p-6 sm:col-span-2 lg:col-span-4" style={{ animationDelay: '.3s' }}>
        <div className="mb-3 flex items-center gap-3">
          <h4 className="tile-label !mb-0">Quest log: team-managed, synced live</h4>
          <button className="btn ml-auto !px-2.5 !py-1.5" onClick={() => setEdit('new')}><Ic n="plus" s={12} />Add gate</button>
        </div>
        {!total && edit !== 'new' && (
          <p className="text-sm italic text-mut">No gates yet. Add your first deadline gate, or start the classic plan on your next run.</p>
        )}
        <ul className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
          {milestones.map(m => {
            if (edit === m.id) {
              return <GateEditor key={m.id} initial={m} end={end}
                onCancel={() => setEdit(null)}
                onSave={patch => { api.updateMilestone(m.id, patch); setEdit(null) }} />
            }
            const over = !m.done && m.at <= now
            return (
              <li key={m.id}
                className={`slab group flex items-start gap-3 p-3 ${over ? '!border-bad/60 !bg-bad/10' : ''}
                  ${m.hard ? 'border-l-4 !border-l-bad' : ''} ${m.done ? 'opacity-50' : ''}`}>
                <input type="checkbox" className="mt-0.5" checked={m.done} onChange={() => api.toggleGate(m)} />
                <div className="min-w-0 grow">
                  <div className={`text-sm font-semibold ${m.done ? 'line-through' : ''}`}>
                    {m.hard && <span className="gate">HARD GATE</span>}{m.label}
                  </div>
                  <div className="mt-0.5 text-xs text-mut tabular-nums">
                    T-{fmtShort(end - m.at)} · {new Date(m.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    {over && <b className="text-bad"> · OVERDUE</b>}
                    {m.done && nameOf(m.doneBy) && <b className="text-ok"> · ✓ {nameOf(m.doneBy)}</b>}
                  </div>
                </div>
                <span className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                  <button className="btn !px-1.5 !py-1" title="Edit gate" onClick={() => setEdit(m.id)}><Ic n="pencil" s={12} /></button>
                  <button className="btn btn-danger !px-1.5 !py-1" title="Remove gate" onClick={() => remove(m)}><Ic n="trash" s={12} /></button>
                </span>
              </li>
            )
          })}
          {edit === 'new' && (
            <GateEditor end={end}
              onCancel={() => setEdit(null)}
              onSave={patch => { api.addMilestone(patch); setEdit(null) }} />
          )}
        </ul>
      </div>
    </div>
  )
}
