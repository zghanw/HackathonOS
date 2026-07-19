// Team data layer. One hook owns the session, the loaded shared state, and every
// realtime subscription (postgres_changes for durable state, a presence channel
// for liveness + "is editing" + file-change pings). Components get plain state
// and an `api` of mutations — no component talks to supabase directly except
// Files.jsx (storage calls need no shared state).
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { toast } from './ui.jsx'

const SKEY = 'hackos-team-v3'
// ?fresh turns this tab into a separate person (sessionStorage-scoped session) —
// lets one machine run two teammates side by side without the tabs fighting
// over the one localStorage session. Handy for demos; documented in the README.
const isGuestTab = () => {
  try {
    if (new URLSearchParams(location.search).has('fresh')) sessionStorage.setItem('hackos-guest', '1')
    return !!sessionStorage.getItem('hackos-guest')
  } catch { return false }
}
const store = () => (isGuestTab() ? sessionStorage : localStorage)
const loadSess = () => { try { return JSON.parse(store().getItem(SKEY)) } catch { return null } }
const saveSess = s => { s ? store().setItem(SKEY, JSON.stringify(s)) : store().removeItem(SKEY) }

const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L — codes get read out loud
const genCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_ALPHA[b % CODE_ALPHA.length]).join('')
const COLORS = ['#4ade80', '#38bdf8', '#c084fc', '#fbbf24', '#fb7185', '#34d399', '#f472b6', '#a3e635']

async function addMember(teamId, name, idx) {
  const { data, error } = await supabase.from('hackos_members')
    .insert({ team_id: teamId, name: name.trim(), color: COLORS[idx % COLORS.length], last_active: Date.now() })
    .select().single()
  if (error) throw error
  return data
}

export async function createTeam(form, userName) {
  const { data: team, error } = await supabase.from('hackos_teams').insert({
    code: genCode(), name: form.name, theme: form.theme, tracks: form.tracks,
    stack: form.stack, starts_at: form.start, ends_at: form.end, reqs: form.reqs,
  }).select().single()
  if (error) throw error
  const me = await addMember(team.id, userName, 0)
  // optional starting preset (classic plan); after creation everything is editable
  if (form.milestones?.length) {
    const { error: mErr } = await supabase.from('hackos_milestones').insert(
      form.milestones.map(m => ({ team_id: team.id, label: m.label, at: m.at, hard: m.hard, updated_by: me.id })))
    if (mErr) throw mErr
  }
  return { teamId: team.id, memberId: me.id }
}

export async function joinTeam(code, userName) {
  const { data: team, error } = await supabase.from('hackos_teams').select('id')
    .eq('code', code.trim().toUpperCase()).maybeSingle()
  if (error) throw error
  if (!team) throw new Error('No team found for that code')
  const { count } = await supabase.from('hackos_members')
    .select('*', { count: 'exact', head: true }).eq('team_id', team.id)
  const me = await addMember(team.id, userName, count || 0)
  return { teamId: team.id, memberId: me.id }
}

const err = ({ error }) => { if (error) toast('Sync failed: ' + error.message, 'bad') }

export function useTeam() {
  const [sess, setSessState] = useState(loadSess)
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [milestones, setMilestones] = useState([])
  const [tasks, setTasks] = useState([])
  const [note, setNote] = useState(null)
  const [presence, setPresence] = useState({})     // memberId -> true (connected). Flags live on the member row.
  const [filesVersion, setFilesVersion] = useState(0) // bumped by broadcast -> Files refetches
  const [ready, setReady] = useState(false)
  const presChan = useRef(null)
  const membersRef = useRef([]); membersRef.current = members
  const milestonesRef = useRef([]); milestonesRef.current = milestones

  const setSess = s => { saveSess(s); setSessState(s); if (!s) { setTeam(null); setReady(false) } }

  const teamId = sess?.teamId, myId = sess?.memberId

  // ---- load + subscribe (torn down and rebuilt whenever the session changes) ----
  useEffect(() => {
    if (!teamId) { setReady(true); return }
    let dead = false

    async function load() {
      const [t, m, g, k, n] = await Promise.all([
        supabase.from('hackos_teams').select('*').eq('id', teamId).maybeSingle(),
        supabase.from('hackos_members').select('*').eq('team_id', teamId).order('created_at'),
        supabase.from('hackos_milestones').select('*').eq('team_id', teamId),
        supabase.from('hackos_tasks').select('*').eq('team_id', teamId).order('created_at'),
        supabase.from('hackos_notes').select('*').eq('team_id', teamId).maybeSingle(),
      ])
      if (dead) return
      if (!t.data || !(m.data || []).some(x => x.id === myId)) {
        toast('That team space no longer exists.', 'warn')
        setSess(null); setReady(true); return
      }
      setTeam(t.data); setMembers(m.data); setMilestones(g.data || []); setTasks(k.data || []); setNote(n.data || null)
      setReady(true)
    }
    load()

    // generic row reducer. DELETE events are not team-filtered by realtime, so
    // guard on old.team_id (present: pk on gates/notes, replica identity full on tasks/members)
    const apply = (setter, key) => ({ eventType, new: nw, old }) => setter(prev => {
      if (eventType === 'DELETE') {
        if (old.team_id && old.team_id !== teamId) return prev
        return prev.filter(r => key(r) !== key(old))
      }
      if (nw.team_id !== teamId) return prev
      const i = prev.findIndex(r => key(r) === key(nw))
      if (i < 0) return [...prev, nw]
      const next = prev.slice(); next[i] = nw; return next
    })
    const F = f => ({ event: '*', schema: 'public', ...f })

    // timeline attribution: toast teammates' adds/edits (check-offs stay silent, the
    // row itself shows them). Under RLS, `old` payloads are stripped to the pk, so
    // edit-vs-checkoff is detected against the local row, and remove attribution
    // rides the broadcast channel instead of the DELETE event.
    const announce = ({ eventType, new: nw }) => {
      if (eventType === 'DELETE') return
      if (nw.team_id !== teamId || nw.updated_by === myId) return
      if (eventType === 'UPDATE') {
        const cur = milestonesRef.current.find(r => r.id === nw.id)
        if (cur && cur.label === nw.label && Number(cur.at) === Number(nw.at) && cur.hard === nw.hard) return
      }
      const who = membersRef.current.find(x => x.id === nw.updated_by)?.name || 'A teammate'
      toast(`${who} ${eventType === 'INSERT' ? 'added' : 'edited'} gate: ${nw.label}`, 'ok')
    }
    const db = supabase.channel('db-' + teamId)
      .on('postgres_changes', F({ table: 'hackos_milestones', filter: `team_id=eq.${teamId}` }),
        p => { announce(p); apply(setMilestones, r => r.id)(p) })
      .on('postgres_changes', F({ table: 'hackos_tasks', filter: `team_id=eq.${teamId}` }), apply(setTasks, r => r.id))
      .on('postgres_changes', F({ table: 'hackos_members', filter: `team_id=eq.${teamId}` }), apply(setMembers, r => r.id))
      .on('postgres_changes', F({ table: 'hackos_notes', filter: `team_id=eq.${teamId}` }),
        p => { if (p.eventType !== 'DELETE') setNote(p.new); else if (p.old.team_id === teamId) setNote(null) })
      .on('postgres_changes', F({ event: 'UPDATE', table: 'hackos_teams', filter: `id=eq.${teamId}` }), p => setTeam(p.new))
      .subscribe()

    // presence meta is deliberately empty: join/leave is the only signal this
    // channel carries reliably (meta re-tracks don't propagate to peers)
    const pres = supabase.channel('presence-' + teamId, { config: { presence: { key: myId } } })
      .on('presence', { event: 'sync' }, () => {
        setPresence(Object.fromEntries(Object.keys(pres.presenceState()).map(k => [k, true])))
      })
      .on('broadcast', { event: 'files' }, () => setFilesVersion(v => v + 1))
      .on('broadcast', { event: 'gate-removed' }, ({ payload }) => {
        if (!payload || payload.by === myId) return
        const who = membersRef.current.find(x => x.id === payload.by)?.name || 'A teammate'
        toast(`${who} removed gate: ${payload.label}`, 'ok')
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') pres.track({})
      })
    presChan.current = pres

    return () => { dead = true; supabase.removeChannel(db); supabase.removeChannel(pres); presChan.current = null }
  }, [teamId, myId]) // eslint-disable-line react-hooks/exhaustive-deps

  // my liveness flags — on the member row so postgres_changes fans them out
  const setFlags = patch => {
    setMembers(prev => prev.map(m => m.id === myId ? { ...m, ...patch } : m))
    supabase.from('hackos_members').update({ ...patch, last_active: Date.now() }).eq('id', myId).then(err)
  }
  const flagsRef = useRef(setFlags); flagsRef.current = setFlags
  const idleRef = useRef(false)

  // ---- liveness: idle detection + last_active heartbeat ----
  useEffect(() => {
    if (!teamId || !team) return
    const flag = idle => { if (idleRef.current !== idle) { idleRef.current = idle; flagsRef.current({ idle }) } }
    let idleT
    const activity = () => {
      flag(false)
      clearTimeout(idleT)
      idleT = setTimeout(() => flag(true), 5 * 60e3)
    }
    const onVis = () => { document.hidden ? flag(true) : activity() }
    window.addEventListener('mousemove', activity)
    window.addEventListener('keydown', activity)
    document.addEventListener('visibilitychange', onVis)
    // reset any stale flags from a previous session, then heartbeat
    supabase.from('hackos_members').update({ idle: false, editing: false, last_active: Date.now() }).eq('id', myId).then(err)
    clearTimeout(idleT); idleT = setTimeout(() => flag(true), 5 * 60e3)
    const touch = () => supabase.from('hackos_members').update({ last_active: Date.now() }).eq('id', myId).then(err)
    const hb = setInterval(touch, 60e3)
    return () => {
      clearTimeout(idleT); clearInterval(hb)
      window.removeEventListener('mousemove', activity)
      window.removeEventListener('keydown', activity)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [teamId, myId, !!team]) // eslint-disable-line react-hooks/exhaustive-deps

  const api = useMemo(() => ({
    // idle / "editing notes" flags
    setFlags: patch => flagsRef.current(patch),
    // my free-text "what I'm doing right now" line — persisted so offline members keep theirs
    setStatus: text => {
      setMembers(prev => prev.map(m => m.id === myId ? { ...m, status_text: text } : m))
      supabase.from('hackos_members').update({ status_text: text, last_active: Date.now() }).eq('id', myId).then(err)
    },
    // optimistic: apply locally now, realtime echo is deduped by the reducer
    toggleGate: m => {
      const patch = m.done ? { done_by: null, done_at: 0 } : { done_by: myId, done_at: Date.now() }
      setMilestones(prev => prev.map(r => r.id === m.id ? { ...r, ...patch } : r))
      supabase.from('hackos_milestones').update(patch).eq('id', m.id).then(err)
    },
    addMilestone: async ({ label, at, hard }) => {
      const r = await supabase.from('hackos_milestones')
        .insert({ team_id: teamId, label: label.trim(), at, hard, updated_by: myId }).select().single()
      err(r)
      if (r.data) setMilestones(prev => prev.some(x => x.id === r.data.id) ? prev : [...prev, r.data])
    },
    updateMilestone: (id, patch) => {
      setMilestones(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
      supabase.from('hackos_milestones').update({ ...patch, updated_by: myId }).eq('id', id).then(err)
    },
    // fully await the delete before returning the undo row: an undo re-INSERT that
    // races an in-flight delete hits the still-live primary key and dies
    removeMilestone: async m => {
      setMilestones(prev => prev.filter(r => r.id !== m.id))
      err(await supabase.from('hackos_milestones').delete().eq('id', m.id))
      presChan.current?.send({ type: 'broadcast', event: 'gate-removed', payload: { by: myId, label: m.label } })
      return m
    },
    // whitelist real columns: callers hand back mapped rows that carry derived
    // fields (done/doneBy), and PostgREST rejects inserts with unknown columns
    restoreMilestone: row => {
      const clean = {
        id: row.id, team_id: row.team_id, label: row.label, at: row.at,
        hard: !!row.hard, done_by: row.done_by || null, done_at: row.done_at || 0, updated_by: myId,
      }
      setMilestones(prev => prev.some(r => r.id === row.id) ? prev : [...prev, clean])
      supabase.from('hackos_milestones').insert(clean).then(err)
    },
    addTask: async (title, assignee) => {
      const r = await supabase.from('hackos_tasks')
        .insert({ team_id: teamId, title: title.trim(), assignee: assignee || null }).select().single()
      err(r)
      if (r.data) setTasks(prev => prev.some(t => t.id === r.data.id) ? prev : [...prev, r.data])
    },
    setTask: (id, patch) => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
      supabase.from('hackos_tasks').update(patch).eq('id', id).then(err)
    },
    delTask: id => {
      setTasks(prev => prev.filter(t => t.id !== id))
      supabase.from('hackos_tasks').delete().eq('id', id).then(err)
    },
    // notes: last-write-wins upsert; the "X is editing" chip is the merge strategy
    saveNote: content => {
      const row = { team_id: teamId, content, updated_by: myId, updated_at: Date.now() }
      setNote(row)
      supabase.from('hackos_notes').upsert(row, { onConflict: 'team_id' }).then(err)
    },
    pingFiles: () => presChan.current?.send({ type: 'broadcast', event: 'files', payload: {} }),
    leave: () => { saveSess(null); location.reload() }, // ponytail: reload tears down every channel in one line
  }), [teamId, myId])

  return { sess, setSess, ready, team, members, milestones, tasks, note, presence, filesVersion, myId, api }
}
