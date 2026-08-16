import { createClient } from '@supabase/supabase-js'

// ?fresh (or a tab already marked guest) gets its own anonymous identity in
// sessionStorage, so two tabs in one browser act as two different teammates.
// Everyone else persists to localStorage and keeps ONE stable anonymous identity
// across reloads — which is exactly what membership RLS keys on (auth.uid()).
const guest = (() => {
  try {
    if (new URLSearchParams(location.search).has('fresh')) sessionStorage.setItem('hackos-guest', '1')
    return !!sessionStorage.getItem('hackos-guest')
  } catch { return false }
})()

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storage: guest ? window.sessionStorage : window.localStorage, persistSession: true, autoRefreshToken: true } },
)

// Resolves once this browser holds an anonymous session. Every data path awaits
// it first, so auth.uid() is present before the initial query and realtime
// subscribe — without it, membership RLS denies everything. Memoized: one
// sign-in per tab, reused by every caller.
let pending
export function ensureSession() {
  if (!pending) pending = (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    const { data: signed, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    return signed.session
  })()
  return pending
}
