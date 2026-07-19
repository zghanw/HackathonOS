import { useState } from 'react'
import { Ic } from '../lib/ui.jsx'
import { Avatar, liveState } from '../App.jsx'

// quest states are UI labels only — status values stay todo/doing/done
const COLS = [['todo', 'Available'], ['doing', 'In progress'], ['done', 'Completed']]
const NEXT = { todo: 'doing', doing: 'done' }
const PREV = { doing: 'todo', done: 'doing' }

// optional seed: the old hardcoded recording checklist, reborn as real editable quests
const CHECKLIST = [
  'Record in one take at final resolution (1080p), no post edits at 3am',
  'Kill notifications, Slack, and the dock before recording',
  'First 10 seconds show the wow feature, not the login page',
  'Narrate outcomes, not clicks ("the key is revoked" not "now I click here")',
  'Real data on screen, zero lorem ipsum',
  'Stay under the time limit minus 10 seconds',
  'Upload EARLY: YouTube processing time is real (unlisted, not private)',
  'Test the link in an incognito window',
  'Put a 30-second backup GIF in the repo README',
]

export default function Tasks({ tasks, members, presence, myId, api }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(myId || '')
  const memberOf = id => members.find(m => m.id === id)

  const add = () => {
    if (!title.trim()) return
    api.addTask(title, assignee || null)
    setTitle('')
  }

  // idempotent enough: the button disables once any checklist item exists on the board
  const seeded = tasks.some(t => t.title === CHECKLIST[0])
  const seed = async () => { for (const c of CHECKLIST) await api.addTask(c, null) }

  return (
    <div className="grid gap-4">
      <div className="panel animate-rise flex flex-wrap items-center gap-2.5 p-4">
        <input className="min-w-52 grow" value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()} placeholder="New quest… (Enter to post)" maxLength={140} />
        <select value={assignee} onChange={e => setAssignee(e.target.value)} className="cursor-pointer">
          <option value="">unassigned</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id === myId ? ' (you)' : ''}</option>)}
        </select>
        <button className="btn btn-primary" onClick={add}><Ic n="plus" s={12} />Post quest</button>
        <button className="btn" disabled={seeded} onClick={seed} title="Adds the 9 demo-recording tips as editable quests">
          <Ic n="mic" s={12} />{seeded ? 'Checklist loaded' : 'Load submission checklist'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {COLS.map(([st, label], ci) => {
          const col = tasks.filter(t => t.status === st)
          return (
            <div key={st} className="panel animate-rise p-4" style={{ animationDelay: `${0.06 + ci * 0.06}s` }}>
              <h4 className="tile-label">{label} <span className="text-mut/70">· {col.length}</span></h4>
              {!col.length && <p className="text-[13px] italic text-mut">no quests here</p>}
              <ul className="grid gap-2.5">
                {col.map(t => {
                  const m = memberOf(t.assignee)
                  return (
                    <li key={t.id} className={`slab group p-3 ${st === 'done' ? 'opacity-60' : ''}`}>
                      <div className={`text-sm ${st === 'done' ? 'line-through' : ''}`}>{t.title}</div>
                      <div className="mt-2 flex items-center gap-1.5">
                        {m ? (
                          <span className="flex items-center gap-1.5 text-[11.5px] text-mut">
                            <Avatar m={m} live={liveState(presence, m)} size={18} />{m.name}{m.id === myId && ' (you)'}
                          </span>
                        ) : (
                          <span className="text-[11.5px] italic text-mut">unassigned</span>
                        )}
                        <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
                          {PREV[st] && <button className="btn !px-1.5 !py-1" title={'Move to ' + PREV[st]} onClick={() => api.setTask(t.id, { status: PREV[st] })}><Ic n="chevL" s={12} /></button>}
                          {NEXT[st] && <button className="btn !px-1.5 !py-1" title={'Move to ' + NEXT[st]} onClick={() => api.setTask(t.id, { status: NEXT[st] })}><Ic n="chevR" s={12} /></button>}
                          <button className="btn btn-danger !px-1.5 !py-1" title="Delete" onClick={() => api.delTask(t.id)}><Ic n="trash" s={12} /></button>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
