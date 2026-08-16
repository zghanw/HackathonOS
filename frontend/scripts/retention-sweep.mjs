// Storage half of the retention system.
//
// Why this exists as a script instead of a cron job: storage.objects carries a
// protect_objects_delete trigger, so SQL cannot delete files. Only the Storage
// API can. The SQL side (hackos_purge_expired) clears rows; this clears the
// files those rows used to own.
//
// Self-healing by construction: an orphan is derived from current state (a file
// prefix with no surviving team), not from a delete queue. A half-failed purge,
// a manual row delete or a missed run all converge on the next pass.
//
// Usage, from frontend/:
//   node scripts/retention-sweep.mjs          # dry run, prints what it would delete
//   node scripts/retention-sweep.mjs --apply  # actually deletes
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BUCKET = 'hackos-files'
const apply = process.argv.includes('--apply')

// ponytail: 3-line .env parse beats adding dotenv for one script
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const fail = (msg, e) => { console.error(`${msg}: ${e?.message || e}`); process.exit(1) }

const { data: teams, error: teamErr } = await supabase.from('hackos_teams').select('id')
if (teamErr) fail('Could not read teams (is the project paused?)', teamErr)
const live = new Set(teams.map(t => t.id))

const { data: entries, error: listErr } = await supabase.storage.from(BUCKET).list('', { limit: 1000 })
if (listErr) fail('Could not list bucket', listErr)

// files are stored at {team_id}/{filename}, so top-level entries are team prefixes
const orphans = entries.filter(e => e.id === null && !live.has(e.name))

if (!orphans.length) {
  console.log(`Nothing to sweep. ${live.size} live team(s), 0 orphaned prefixes.`)
  process.exit(0)
}

let files = 0, bytes = 0, removed = 0
for (const o of orphans) {
  const { data: contents, error } = await supabase.storage.from(BUCKET).list(o.name, { limit: 1000 })
  if (error) { console.error(`  skip ${o.name}: ${error.message}`); continue }
  if (!contents.length) continue

  files += contents.length
  bytes += contents.reduce((n, f) => n + (f.metadata?.size || 0), 0)
  console.log(`${apply ? 'deleting' : 'would delete'} ${o.name}/  (${contents.length} file(s))`)
  for (const f of contents) console.log(`    ${f.name}  ${Math.round((f.metadata?.size || 0) / 1024)}KB`)

  if (apply) {
    const paths = contents.map(f => `${o.name}/${f.name}`)
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
    if (rmErr) console.error(`  FAILED ${o.name}: ${rmErr.message}`)
    else removed += paths.length
  }
}

const mb = (bytes / 1048576).toFixed(2)
console.log(
  apply
    ? `\nSwept ${removed}/${files} file(s) across ${orphans.length} dead team(s), ~${mb}MB reclaimed.`
    : `\nDry run: ${files} file(s) across ${orphans.length} dead team(s), ~${mb}MB reclaimable. Re-run with --apply.`,
)
