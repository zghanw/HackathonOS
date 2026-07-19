import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Ic, toast } from '../lib/ui.jsx'

const BUCKET = 'hackos-files'
const fmtBytes = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? Math.round(n / 1024) + ' KB' : (n || 0) + ' B'
// storage keys dislike exotic characters; same name twice = new version replaces old
const safeName = n => n.replace(/[^\w.\-() ]+/g, '_')

// Shared file list per team: repo links belong in Notes — this is for the deck,
// design exports, and the backup demo GIF. ponytail: a flat list, not a DMS.
export default function Files({ teamId, filesVersion, api }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const input = useRef(null)

  const refresh = () => supabase.storage.from(BUCKET)
    .list(teamId, { sortBy: { column: 'created_at', order: 'desc' } })
    .then(({ data, error }) => {
      if (error) toast('File list failed: ' + error.message, 'bad')
      else setFiles(data || [])
    })

  useEffect(() => { refresh() }, [teamId, filesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 10 * 1048576) return toast('Max 10 MB per file. Link big things in the tome instead.', 'warn')
    setBusy(true)
    const { error } = await supabase.storage.from(BUCKET)
      .upload(`${teamId}/${safeName(file.name)}`, file, { upsert: true })
    setBusy(false)
    if (error) return toast('Upload failed: ' + error.message, 'bad')
    toast('Uploaded ' + file.name, 'ok')
    refresh()
    api.pingFiles()
  }

  const del = async f => {
    if (!confirm(`Delete ${f.name} for the whole team?`)) return
    const { error } = await supabase.storage.from(BUCKET).remove([`${teamId}/${f.name}`])
    if (error) return toast('Delete failed: ' + error.message, 'bad')
    refresh()
    api.pingFiles()
  }

  const urlOf = f => supabase.storage.from(BUCKET).getPublicUrl(`${teamId}/${f.name}`).data.publicUrl

  return (
    <div className="panel animate-rise p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h4 className="tile-label !mb-0">Party chest: deck drafts, design assets, the backup demo GIF</h4>
        <button className="btn btn-primary ml-auto" onClick={() => input.current?.click()} disabled={busy}>
          <Ic n="upload" s={12} />{busy ? 'Stashing…' : 'Stash item'}
        </button>
        <input ref={input} type="file" className="hidden" onChange={upload} />
      </div>
      {!files.length && <p className="text-sm italic text-mut">The chest is empty. Max 10 MB per item. Same filename stashes a new version.</p>}
      {/* inventory grid: one slot per item, actions inside the slot */}
      <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
        {files.map(f => (
          <li key={f.name} className="slab flex flex-col items-center gap-1.5 p-3 text-center">
            <Ic n="file" s={22} className="text-acc" />
            <a href={urlOf(f)} target="_blank" rel="noreferrer" className="w-full truncate text-[12.5px] font-semibold hover:text-acc hover:underline"
              title={f.name}>
              {f.name}
            </a>
            <span className="text-[11px] text-mut tabular-nums">
              {fmtBytes(f.metadata?.size)}
              {f.created_at && ' · ' + new Date(f.created_at).toLocaleString([], { month: 'short', day: 'numeric' })}
            </span>
            <span className="mt-1 flex gap-1.5">
              <a href={urlOf(f)} download className="btn !px-2 !py-1.5" title="Download"><Ic n="download" s={13} /></a>
              <button className="btn btn-danger !px-2 !py-1.5" title="Delete for everyone" onClick={() => del(f)}><Ic n="trash" s={13} /></button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
