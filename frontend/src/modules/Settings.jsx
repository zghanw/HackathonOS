import { useState } from 'react'
import { MODELS, testConnection } from '../lib/agents.js'
import { Ic, toast } from '../lib/ui.jsx'

export default function Settings({ S, update }) {
  const st = S.settings || {}
  const [key, setKey] = useState(st.key || '')
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)

  const save = patch => update(prev => ({ settings: { ...prev.settings, ...patch } }))

  const test = async () => {
    setTesting(true)
    try {
      await testConnection({ key, model: st.model })
      toast('Connected — agents are generative.', 'ok')
    } catch (e) {
      toast('Connection failed: ' + e.message, 'bad')
    } finally { setTesting(false) }
  }

  return (
    <div className="glass p-6">
      <h2>Settings</h2>
      <p className="text-mut">Agents call the Anthropic API directly from this browser — no server involved. Without a key, every agent falls back to the deterministic engine (works offline, never fails, less smart).</p>

      <div className="my-4 max-w-xl">
        <label>Anthropic API key</label>
        {/* flex-wrap + min-w-0: a grow input won't shrink below content width without min-w-0 (QA ISSUE-001, 375px overflow) */}
        <div className="mt-1 flex flex-wrap gap-2">
          <input className="min-w-0 grow basis-56 font-sans" type={show ? 'text' : 'password'} value={key}
            onChange={e => { setKey(e.target.value); save({ key: e.target.value.trim() }) }}
            placeholder="sk-ant-…" autoComplete="off" />
          <button className="btn" onClick={() => setShow(x => !x)}>{show ? 'Hide' : 'Show'}</button>
          <button className="btn" onClick={test} disabled={testing || !key}>{testing ? 'Testing…' : 'Test'}</button>
        </div>
        <p className="mt-1 text-xs text-mut">Stored in this browser's localStorage only. Use a scoped key and revoke it after the hackathon.</p>
      </div>

      <div className="my-4 max-w-xl">
        <label>Model</label><br />
        <select className="mt-1" value={st.model || MODELS[0]} onChange={e => save({ model: e.target.value })}>
          {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <label className="my-4 flex max-w-xl items-start gap-2.5 text-ink">
        <input type="checkbox" className="mt-1" checked={st.auto !== false} onChange={e => save({ auto: e.target.checked })} />
        <span>
          <b>Agents act on their own</b>
          <span className="block text-[13px] text-mut">Strategist runs at launch, guardian triages when pace drops, pitchsmith drafts the kit before the video gate. Off = agents only run when you press their buttons.</span>
        </span>
      </label>

      <p className="mt-4 flex items-center gap-2 text-xs text-mut"><Ic n="lock" s={13} />Milestone check-offs stay manual on purpose — the OS automates everything except the truth.</p>
    </div>
  )
}
