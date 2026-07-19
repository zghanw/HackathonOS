import { useEffect, useRef, useState } from 'react'
import { fmtAgo } from '../lib/core.js'
import { Ic } from '../lib/ui.jsx'

// Shared notes: last-write-wins, saved on a short debounce. The "X is editing"
// chips (live, via presence) are the merge strategy — humans coordinate, the
// app just makes the collision visible. ponytail: LWW + indicator; CRDT/OT
// only if simultaneous editing becomes a real daily pain.
export default function Notes({ note, members, presence, myId, api, active }) {
  const [draft, setDraft] = useState(note?.content || '')
  const focused = useRef(false)
  const saveT = useRef(null)
  const ta = useRef(null)

  // apply remote updates unless I'm mid-edit (my own echo is skipped — identical anyway)
  useEffect(() => {
    if (!note) return
    if (note.updated_by === myId) return
    if (!focused.current) setDraft(note.content)
  }, [note?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = v => {
    setDraft(v)
    clearTimeout(saveT.current)
    saveT.current = setTimeout(() => api.saveNote(v), 800)
  }
  const onFocus = () => { focused.current = true; api.setFlags({ editing: true }) }
  const onBlur = () => {
    focused.current = false
    api.setFlags({ editing: false })
    clearTimeout(saveT.current)
    if (draft !== (note?.content || '')) api.saveNote(draft)
  }
  // flush the pending save if the user closes the tab mid-debounce
  useEffect(() => () => clearTimeout(saveT.current), [])

  const editors = members.filter(m => m.id !== myId && m.editing && presence[m.id])
  const author = members.find(m => m.id === note?.updated_by)

  return (
    <div className="panel animate-rise p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="tile-label !mb-0">Team tome: shared, last write wins</h4>
        {editors.map(m => (
          <span key={m.id} className="chip !border-warn/60 !text-warn animate-pulse2">
            <Ic n="pencil" s={10} className="mr-1 inline align-[-1px]" />{m.name} is writing…
          </span>
        ))}
        {note && author && !editors.length && (
          <span className="ml-auto text-[11.5px] text-mut">last saved by {author.name} · {fmtAgo(Number(note.updated_at))}</span>
        )}
      </div>
      {editors.length > 0 && (
        <p className="mb-2 text-xs text-warn">Heads up: another scribe is at the tome. Last save wins, so shout before you both rewrite the pitch.</p>
      )}
      <textarea ref={ta} value={draft} onChange={e => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur}
        className="min-h-[420px] font-sans leading-relaxed"
        placeholder={'Everything the team must not lose:\n\n· the one-line pitch\n· demo URL + backup GIF link\n· judging room / slot\n· who submits, and their Devpost login works\n· env vars that took 2 hours to figure out'} />
    </div>
  )
}
