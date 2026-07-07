// Hackathon OS — agent layer. Direct browser → Anthropic API (still serverless).
// Every agent: try Claude, fall back to the deterministic engine in core.js on
// any failure (no key, no wifi, bad JSON). ctx = { latest, update, push } where
// latest() returns current state, update() patches it, push() writes the feed.
import { RUBRIC_LINE, extractJson, fmtShort, fallbackScout, fallbackIdeas, fallbackIntervention, fallbackPitch } from './core.js'

export const MODELS = ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001']

export async function callClaude(settings, system, prompt, maxTokens = 4096) {
  if (!settings?.key) throw new Error('no-key')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', // ponytail: key lives in this browser only; there is no server to proxy through
    },
    body: JSON.stringify({
      model: settings.model || MODELS[0],
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) {
    // surface the API's human message, not the raw JSON body (QA ISSUE-002)
    let msg = 'HTTP ' + r.status
    try { msg = (await r.json())?.error?.message || msg } catch { /* non-JSON error body */ }
    throw new Error(msg)
  }
  const d = await r.json()
  return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
}

const noKeyHint = e => (e.message === 'no-key'
  ? 'Running on the deterministic fallback — add an API key in Settings for generative agents.'
  : 'Claude call failed (' + e.message + ') — used the deterministic fallback.')

const missionBrief = (m, intel) => {
  const tracks = intel?.sponsors?.length
    ? intel.sponsors.map(s => `${s.name} (APIs: ${(s.apis || []).join(', ') || 'unknown'} — likely prize: "${s.prize}"${s.angle ? '; angle: ' + s.angle : ''})`).join('; ')
    : (m.tracks || []).join(', ') || 'none — optimize for the grand prize'
  const budgetH = Math.round((m.end - m.start) / 3600e3)
  return `Hackathon: ${m.name || 'unnamed'}\nTheme: ${m.theme || 'open'}\nSponsor tracks: ${tracks}\nTeam stack: ${m.stack}\nWindow: ${budgetH} hours\nJudging rubric: ${RUBRIC_LINE}`
}

// ---------------- Scout: studies the typed sponsors at mission launch ----------------
const SYS_SCOUT = `You are a hackathon sponsor scout. For each company, produce a briefing from your knowledge: the developer APIs/products a team could integrate within hours, the prize track they typically sponsor at hackathons, and the winning angle. If you don't know a company, say so honestly and give your best inference from the name. Respond with STRICT JSON only.`

const scoutPrompt = names => `Sponsors at this hackathon: ${names.join(', ')}

JSON schema:
{"sponsors": [{"name": "...", "apis": ["2-4 APIs/products integratable in a hackathon"], "prize": "likely prize track name", "angle": "one sentence: how to actually win this track"}]}`

export async function runScout(ctx, missionArg = null) {
  const S = ctx.latest()
  const m = missionArg || S.mission
  if (!m) return null
  const names = (m.tracks || []).filter(n => String(n).trim())
  if (!names.length) return null
  ctx.push('scout', 'info', `Studying ${names.length} sponsor${names.length > 1 ? 's' : ''}: ${names.join(', ')}…`)
  let intel, kind = 'action', note = ''
  try {
    const out = extractJson(await callClaude(S.settings, SYS_SCOUT, scoutPrompt(names), 2048))
    const sponsors = (out.sponsors || []).filter(s => s && s.name)
    if (!sponsors.length) throw new Error('thin response')
    intel = { sponsors, source: 'claude', at: Date.now() }
  } catch (e) {
    intel = { sponsors: fallbackScout(names), source: 'fallback', at: Date.now() }
    kind = 'warn'; note = noKeyHint(e)
  }
  ctx.update({ intel })
  ctx.push('scout', kind, 'Sponsor briefing ready',
    intel.sponsors.map(s => `${s.name}: ${(s.apis || []).join(', ') || 'APIs unknown'} — ${s.prize}`).join('\n') + (note ? '\n(' + note + ')' : ''))
  return intel
}

// ---------------- Strategist: runs automatically on mission launch ----------------
const SYS_STRATEGIST = `You are a hackathon strategist for a DevSecOps-focused builder. Real products in real workflows — never thin AI-wrapper demos. Lean into security angles where tracks allow. Be brutally honest on feasibility; a "Trap" label saves the hackathon. Respond with STRICT JSON only — no prose outside the JSON.`

const strategistPrompt = (m, intel) => `${missionBrief(m, intel)}

Generate exactly 5 project ideas and pick the single best one by expected-prize-fit × feasibility.

JSON schema (respond with exactly this shape):
{
  "ideas": [{
    "name": "...",
    "feasibility": 0-100,
    "label": "Safe bet|Doable|Stretch|Trap",
    "wow": "the ONE feature that is the whole MVP, described as a demo moment",
    "differentiator": "unlike X, we Y",
    "sponsors": [{"name": "...", "api": "the specific API used", "prize": "..."}],
    "hours": {"build": n, "integrate": n, "polish": n},
    "diesIf": "the single riskiest assumption",
    "buildPlan": ["step 1", "step 2", "step 3", "step 4"]
  }],
  "pick": <index of the winner>,
  "rationale": "2 sentences on why the winner wins"
}`

// missionArg/intelArg: pass explicitly when calling right after launch —
// ctx.latest() would still see the pre-launch state until React commits.
export async function runStrategist(ctx, missionArg = null, intelArg = null) {
  const S = ctx.latest()
  const m = missionArg || S.mission
  const intel = intelArg || S.intel || null
  if (!m) return
  ctx.push('strategist', 'info', 'Scoring the field — generating 5 ideas…')
  try {
    const out = extractJson(await callClaude(S.settings, SYS_STRATEGIST, strategistPrompt(m, intel)))
    const list = (out.ideas || []).filter(i => i && i.name).slice(0, 5)
    if (list.length < 3) throw new Error('thin response')
    const pickIdx = Math.min(Math.max(+out.pick || 0, 0), list.length - 1)
    ctx.update({ ideas: { list, pickIdx, source: 'claude', at: Date.now() } })
    ctx.push('strategist', 'action', `Locked "${list[pickIdx].name}" — feasibility ${list[pickIdx].feasibility}/100`,
      (out.rationale || '') + '\nOverride the pick in the Ideas tab if you disagree.')
  } catch (e) {
    const budgetH = Math.round((m.end - m.start) / 3600e3)
    const list = fallbackIdeas({ tracks: m.tracks, theme: m.theme, budgetH })
    ctx.update({ ideas: { list, pickIdx: 0, source: 'fallback', at: Date.now() } })
    ctx.push('strategist', 'warn', `Locked "${list[0].name}" — feasibility ${list[0].feasibility}/100 (fallback)`, noKeyHint(e))
  }
}

// ---------------- Guardian: fires itself when pace degrades ----------------
const SYS_GUARDIAN = `You are the deadline guardian of a hackathon team that is slipping. Your job is triage, not encouragement: decide what to CUT so the demo ships. Respond with STRICT JSON only.`

const guardianPrompt = (m, pick, now, intel) => {
  const gates = m.milestones.map(g =>
    `- [${g.hard ? 'HARD' : 'soft'}][${g.done ? 'done' : g.at <= now ? 'OVERDUE' : 'pending'}] T-${fmtShort(m.end - g.at)} ${g.label}`).join('\n')
  return `${missionBrief(m, intel)}
Building: ${pick ? `${pick.name} — wow: ${pick.wow}` : 'not decided yet'}
Time left: ${fmtShort(m.end - now)}
Gates:
${gates}

We are behind. Produce a triage plan.
JSON schema: {"diagnosis": "1 sentence, the real problem", "cut": ["specific thing to cut", ...], "keep": ["what must survive", ...], "nextAction": "the single next physical action, imperative"}`
}

export async function runGuardian(ctx, pace) {
  const S = ctx.latest()
  const m = S.mission
  if (!m) return
  const now = Date.now()
  const pick = S.ideas?.list?.[S.ideas.pickIdx]
  ctx.push('guardian', 'info', `Pace dropped to ${pace.toUpperCase()} — computing triage…`)
  let iv, warn = null
  try {
    iv = extractJson(await callClaude(S.settings, SYS_GUARDIAN, guardianPrompt(m, pick, now, S.intel || null), 1024))
    if (!iv.diagnosis || !iv.nextAction) throw new Error('thin response')
  } catch (e) {
    iv = fallbackIntervention(m.milestones, now, m.end)
    warn = noKeyHint(e)
  }
  ctx.push('guardian', pace === 'danger' ? 'danger' : 'warn', 'Triage: ' + iv.diagnosis,
    `CUT:\n${(iv.cut || []).map(c => '  - ' + c).join('\n')}\nKEEP:\n${(iv.keep || []).map(k => '  - ' + k).join('\n')}\nNEXT: ${iv.nextAction}${warn ? '\n(' + warn + ')' : ''}`)
  return iv
}

// ---------------- Pitchsmith: fires itself at the demo-video gate ----------------
const SYS_PITCH = `You are a hackathon pitch engineer. Optimize every word against the judging rubric, not for completeness. Impact needs at least one real number (mark it clearly if you must estimate). Respond with STRICT JSON only.`

const pitchPrompt = (m, pick, readme, intel) => `${missionBrief(m, intel)}
Building: ${pick ? `${pick.name} — ${pick.differentiator}\nWow: ${pick.wow}` : 'see README'}
${readme.trim() ? `README / feature notes:\n"""\n${readme.trim()}\n"""` : 'No README provided — work from the idea context.'}

Produce the full submission kit.
JSON schema:
{
  "devpost": {"title": "...", "tagline": "≤10 words", "description": "markdown, 150-250 words, sections: What it does / Why it matters / How we built it / What's next"},
  "deck": [{"title": "...", "bullets": ["≤4 per slide"]}]  // exactly 7 slides: title(+differentiator), problem, solution, live demo, under the hood, impact(with the number), ask
  ,"script": [["0:00","..."], ["0:15","..."], ["0:35","..."], ["1:35","..."], ["2:05","..."], ["2:35","..."], ["3:00","..."]]
}`

export async function runPitch(ctx, readme = '', auto = false) {
  const S = ctx.latest()
  const m = S.mission
  if (!m) return
  const pick = S.ideas?.list?.[S.ideas.pickIdx]
  ctx.push('pitchsmith', 'info', auto ? 'Demo-video gate approaching — drafting the submission kit…' : 'Drafting the submission kit…')
  try {
    const out = extractJson(await callClaude(S.settings, SYS_PITCH, pitchPrompt(m, pick, readme, S.intel || null)))
    if (!out.devpost?.title || !Array.isArray(out.deck) || !Array.isArray(out.script)) throw new Error('thin response')
    ctx.update({ pitch: { ...out, source: 'claude', at: Date.now() } })
    ctx.push('pitchsmith', 'action', `Submission kit ready: "${out.devpost.title}" — deck, script and Devpost draft in the Pitch tab`)
  } catch (e) {
    const out = fallbackPitch({ name: m.name, theme: m.theme, pick, readme })
    ctx.update({ pitch: { ...out, source: 'fallback', at: Date.now() } })
    ctx.push('pitchsmith', 'warn', `Submission kit drafted (fallback): "${out.devpost.title}"`, noKeyHint(e))
  }
}

// ---------------- connection test (Settings) ----------------
export async function testConnection(settings) {
  const t = await callClaude(settings, 'Reply with exactly one word.', 'Say: pong', 16)
  if (!/pong/i.test(t)) throw new Error('unexpected reply: ' + t.slice(0, 40))
}
