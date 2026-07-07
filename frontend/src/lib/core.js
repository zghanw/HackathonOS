// Hackathon OS — deterministic core. No DOM, no React, no network.
// `node src/lib/core.js` runs the self-test.
// This is the OS's spine: the clock, the gates, the pace engine, and offline
// fallbacks for every agent — so the app works with zero API key and never
// dies mid-demo. The agents (lib/agents.js) make it smart; this keeps it alive.
'use strict';
const H = 3600e3, MIN = 60e3;

// ---------- sponsor knowledge base — offline fallback for the scout agent ----------
export const SPONSORS = {
  aws:        { name: 'AWS',          apis: ['Bedrock', 'Lambda', 'S3'],             prize: 'Best use of AWS' },
  gcloud:     { name: 'Google Cloud', apis: ['Vertex AI', 'Firebase', 'Cloud Run'],  prize: 'Best use of Google Cloud' },
  github:     { name: 'GitHub',       apis: ['Actions', 'Webhooks', 'REST API'],     prize: 'Best use of GitHub' },
  mongodb:    { name: 'MongoDB',      apis: ['Atlas', 'Vector Search'],              prize: 'Best use of MongoDB Atlas' },
  auth0:      { name: 'Auth0/Okta',   apis: ['Auth0 SDK', 'FGA'],                    prize: 'Best use of Auth0' },
  twilio:     { name: 'Twilio',       apis: ['SMS', 'Verify', 'SendGrid'],           prize: 'Best use of Twilio' },
  snyk:       { name: 'Snyk',         apis: ['Snyk API', 'Code/SCA scans'],          prize: 'Best security hack' },
  stripe:     { name: 'Stripe',       apis: ['Payments', 'Webhooks'],                prize: 'Best use of Stripe' },
  cloudflare: { name: 'Cloudflare',   apis: ['Workers', 'Turnstile', 'R2'],          prize: 'Best use of Cloudflare' },
  anthropic:  { name: 'Anthropic',    apis: ['Claude API', 'Tool use'],              prize: 'Best use of Claude' },
};

// loose name→key matcher so free-typed sponsor names hit the built-in map
const sponsorKeyFor = raw => {
  const n = String(raw).trim().toLowerCase();
  if (!n) return null;
  return Object.keys(SPONSORS).find(k => {
    const s = SPONSORS[k].name.toLowerCase();
    return n === k || n.includes(k) || n.includes(s) || s.includes(n);
  }) || null;
};

// offline sponsor briefing: known names get real intel, unknown ones an honest stub
export function fallbackScout(names = []) {
  return names.filter(n => String(n).trim()).map(n => {
    const k = sponsorKeyFor(n);
    const s = k ? SPONSORS[k] : null;
    return {
      name: s ? s.name : String(n).trim(),
      apis: s ? s.apis : [],
      prize: s ? s.prize : 'Best use of ' + String(n).trim(),
      angle: s
        ? `Integrate ${s.apis[0]} visibly in the demo path — judges must see it working.`
        : 'Not in the offline map — check their docs for a hackathon-friendly API and demo it visibly.',
    };
  });
}

// ---------- milestone engine ----------
export function genMilestones(start, end, reqs = { devpost: true, video: true, repo: true }) {
  const W = end - start;
  // ponytail: linear squeeze for short windows, floor 0.5 — good for 12–48h; sub-12h windows need a custom plan anyway
  const s = Math.max(0.5, Math.min(1, W / (24 * H)));
  const M = [
    [start + 0.05 * W, 'Idea locked, repo scaffolded, hello-world deployed', 0, null],
    [start + 0.15 * W, 'Scope frozen: ONE wow feature, named out loud', 1, null],
    [start + 0.40 * W, 'Wow feature works end-to-end (ugly is fine)', 0, null],
    [start + 0.60 * W, 'Full demo path clickable, start to finish', 0, null],
    [end - 6 * H * s, 'Stable build deployed — freeze candidate', 0, null],
    [end - 4 * H * s, 'CODE FREEZE — bugfixes only, no new features', 1, null],
    [end - 2 * H * s, 'Demo video recorded and uploaded', 1, 'video'],
    [end - 1.5 * H * s, 'Devpost draft: title, tagline, screenshots in', 0, 'devpost'],
    [end - 45 * MIN * s, 'Submission form COMPLETE — every required field', 1, null],
    [end - 20 * MIN * s, 'Repo public, README says how to run it', 0, 'repo'],
    [end - 10 * MIN, 'SUBMIT NOW. Polish is a trap.', 1, null],
  ];
  return M.filter(m => !m[3] || reqs[m[3]])
    .map(([at, label, hard], i) => ({ id: i, at: Math.round(at), label, hard: !!hard, done: false }))
    .sort((a, b) => a.at - b.at);
}

export function paceState(milestones, now) {
  const missed = milestones.filter(m => !m.done && m.at <= now);
  if (missed.some(m => m.hard) || missed.length >= 2) return 'danger';
  return missed.length ? 'behind' : 'ok';
}

export function remindEvery(msLeft) {
  if (msLeft < 15 * MIN) return MIN;
  if (msLeft < H) return 5 * MIN;
  if (msLeft < 4 * H) return 10 * MIN;
  return 30 * MIN;
}

export function fmtDur(ms) {
  const neg = ms < 0; ms = Math.abs(ms);
  const p = n => String(n).padStart(2, '0');
  return (neg ? '-' : '') + p(Math.floor(ms / H)) + ':' + p(Math.floor(ms % H / MIN)) + ':' + p(Math.floor(ms % MIN / 1000));
}
export function fmtShort(ms) {
  ms = Math.max(0, ms);
  const h = Math.floor(ms / H), m = Math.round(ms % H / MIN);
  return h ? h + 'h' + (m ? m + 'm' : '') : m + 'm';
}

// ---------- judging rubric ----------
export const RUBRIC_LINE = 'Innovation 27.5% · Technical execution 25% · Impact/feasibility 25% · Design 15% · Presentation 7.5%';

export const RECORD_CHECKLIST = [
  'Record in one take at final resolution (1080p) — no post edits at 3am',
  'Kill notifications, Slack, and the dock before recording',
  'First 10 seconds show the wow feature, not the login page',
  'Narrate outcomes, not clicks ("the key is revoked" not "now I click here")',
  'Real data on screen, zero lorem ipsum',
  'Stay under the time limit minus 10 seconds',
  'Upload EARLY — YouTube processing time is real (unlisted, not private)',
  'Test the link in an incognito window',
  'Put a 30-second backup GIF in the repo README',
];

// ---------- tolerant JSON extraction (agent responses) ----------
export function extractJson(text) {
  const t = String(text).replace(/```(?:json)?/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON in response');
  return JSON.parse(t.slice(a, b + 1));
}

// ============================================================================
// DETERMINISTIC FALLBACKS — every agent has one, so no key / no wifi / a bad
// API day never kills the OS. Same output shapes as the agents produce.
// ============================================================================

// ponytail: curated bank — the offline floor, not the ceiling; the strategist agent replaces it when a key exists
const IDEA_BANK = [
  { name: 'PR Tripwire', baseH: 14, kw: ['secret', 'ci', 'leak', 'security', 'code', 'devops', 'pipeline', 'git'],
    sponsors: ['github', 'snyk', 'aws'],
    wow: 'Commit a live AWS key in a PR — bot revokes it and comments the fix within 10 seconds.',
    diff: 'unlike repo scanners, we guard the merge itself' },
  { name: 'IAM X-Ray', baseH: 18, kw: ['cloud', 'security', 'access', 'audit', 'iam', 'permission'],
    sponsors: ['aws', 'gcloud'],
    wow: 'Time-slider showing exactly who gained prod access this week, and via which policy.',
    diff: 'unlike policy dumps, we answer "what changed"' },
  { name: 'Postmortem Autopilot', baseH: 12, kw: ['incident', 'sre', 'slack', 'ops', 'outage', 'postmortem'],
    sponsors: ['anthropic', 'mongodb'],
    wow: 'Paste a raw Slack incident export — publishable postmortem with timeline in 30 seconds.',
    diff: 'unlike incident tools, we work on the messy chat you already have' },
  { name: 'Consent Ledger', baseH: 20, kw: ['health', 'privacy', 'data', 'gdpr', 'consent', 'patient', 'medical'],
    sponsors: ['auth0', 'mongodb', 'gcloud'],
    wow: 'Revoke consent in the UI — watch downstream data access flip off, live.',
    diff: 'unlike consent PDFs, we enforce consent at runtime' },
  { name: 'Webhook Notary', baseH: 10, kw: ['payment', 'api', 'fintech', 'integration', 'webhook', 'stripe'],
    sponsors: ['stripe', 'cloudflare'],
    wow: 'Replay a tampered Stripe webhook — rejected with a signed audit entry, next to the real one.',
    diff: 'unlike API tooling, we treat webhooks as a security boundary' },
  { name: 'SBOM Sentinel', baseH: 12, kw: ['supply', 'dependency', 'security', 'cve', 'vuln', 'package'],
    sponsors: ['snyk', 'github', 'twilio'],
    wow: 'New CVE drops — SMS naming the exact affected service in under a minute.',
    diff: 'unlike scanners, we map CVEs to your deployed services' },
  { name: 'Evidence Robot', baseH: 16, kw: ['compliance', 'audit', 'soc2', 'enterprise', 'evidence', 'iso'],
    sponsors: ['aws', 'gcloud', 'github'],
    wow: 'One click — this week\'s access reviews, backup proofs and scan results land in an audit folder.',
    diff: 'unlike GRC suites, engineers take zero screenshots' },
  { name: 'Phish Triage', baseH: 15, kw: ['email', 'phishing', 'smb', 'security', 'scam', 'fraud'],
    sponsors: ['anthropic', 'twilio', 'cloudflare'],
    wow: 'Forward a live phish — defanged verdict card back by SMS in 20 seconds.',
    diff: 'unlike enterprise sec-ops, we serve companies with no security team' },
  { name: 'Drift Watch', baseH: 22, kw: ['terraform', 'infra', 'cloud', 'devops', 'iac', 'config'],
    sponsors: ['aws', 'gcloud'],
    wow: 'Someone click-ops an S3 bucket public — a red diff appears on the dashboard, live.',
    diff: 'unlike terraform plan, we catch the console cowboy in minutes' },
  { name: 'On-Call Brief', baseH: 11, kw: ['oncall', 'sre', 'ops', 'alert', 'handoff', 'pager'],
    sponsors: ['mongodb', 'anthropic', 'twilio'],
    wow: 'Shift change — one-page brief with the three things most likely to page you tonight.',
    diff: 'unlike dashboards, we optimize the handoff minute' },
];

export function fallbackIdeas({ tracks = [], theme = '', budgetH = 24 } = {}) {
  const p = (theme || '').toLowerCase();
  const trackKeys = new Set((tracks || []).map(sponsorKeyFor).filter(Boolean)); // tracks are free-typed names
  return IDEA_BANK.map(idea => {
    const kwHits = idea.kw.filter(k => p.includes(k)).length;
    const trackHits = idea.sponsors.filter(k => trackKeys.has(k)).length;
    const ratio = budgetH / idea.baseH;
    const feasibility = Math.max(5, Math.min(97, Math.round(39 + 40 * Math.min(ratio, 1.5))));
    const rel = kwHits * 6 + trackHits * 10 + feasibility * 0.3;
    return {
      name: idea.name, feasibility, rel,
      label: feasibility >= 75 ? 'Safe bet' : feasibility >= 60 ? 'Doable' : feasibility >= 45 ? 'Stretch' : 'Trap',
      wow: idea.wow, differentiator: idea.diff,
      sponsors: idea.sponsors.filter(k => SPONSORS[k]).map(k => ({ name: SPONSORS[k].name, api: SPONSORS[k].apis[0], prize: SPONSORS[k].prize })),
      hours: { build: Math.round(idea.baseH * 0.6), integrate: Math.round(idea.baseH * 0.25), polish: Math.round(idea.baseH * 0.15) },
      diesIf: 'the sponsor API integration takes longer than one evening',
      buildPlan: ['Scaffold repo, hello-world deployed end-to-end', `Build the wow path: ${idea.wow}`, 'Wire real data through the full demo path', 'Record the demo, then (and only then) polish'],
    };
  }).sort((a, b) => b.rel - a.rel).slice(0, 5).map(({ rel, ...i }) => i);
}

export function fallbackIntervention(milestones, now, end) {
  const missed = milestones.filter(m => !m.done && m.at <= now);
  const first = missed[0];
  return {
    diagnosis: `${missed.length} gate${missed.length === 1 ? '' : 's'} overdue with ${fmtShort(end - now)} left on the clock.`,
    cut: ['Any feature not on the demo path', 'Polish, styling passes, refactors', 'Extra integrations beyond the prize track you\'re targeting'],
    keep: ['The wow feature demo path, end to end', 'The submission requirements: video, Devpost, public repo'],
    nextAction: first ? `Clear "${first.label}" right now — do it or consciously cut it. Not deciding is the trap.` : 'Re-check the plan against the clock.',
  };
}

export function fallbackPitch({ name = 'Project', theme = '', pick = null, readme = '' } = {}) {
  const title = pick?.name || name;
  const wow = pick?.wow || 'the core flow, live';
  const diff = pick?.differentiator || 'built in one hackathon window';
  const prizes = (pick?.sponsors || []).map(s => s.prize);
  const lines = readme.split('\n');
  const features = lines.filter(l => /^\s*[-*+]\s+/.test(l)).map(l => l.replace(/^\s*[-*+]\s+/, '').trim()).slice(0, 4);
  // no README → distinct copy per section instead of repeating the wow line everywhere
  const solution = features.length ? features : [diff[0].toUpperCase() + diff.slice(1), 'One focused product, one wow feature'];
  const built = features.length ? features : ['One wow feature, built end-to-end before any polish', 'React + Tailwind frontend, FastAPI backend', 'Security-first: least privilege, no secrets in the client'];
  return {
    devpost: {
      title,
      tagline: diff[0].toUpperCase() + diff.slice(1),
      description: `## What it does\n${wow}\n\n## Why it matters\n${theme || 'The status quo is manual, slow, and error-prone'} — ${diff}.\n\n## How we built it\n${built.map(f => '- ' + f).join('\n')}\n\n## What's next\nPilot with one real team.`,
    },
    deck: [
      { title: title + ' — ' + diff, bullets: [] },
      { title: 'The problem', bullets: ['The status quo is manual, slow, and error-prone', 'Who feels it: the person on the hook when it breaks', 'Replace this bullet with a number'] },
      { title: 'The solution', bullets: solution },
      { title: 'Live demo', bullets: ['WOW: ' + wow, 'Pre-recorded — no live-demo roulette', 'Backup GIF in the repo README'] },
      { title: 'Under the hood', bullets: ['React + Tailwind + FastAPI', 'Security-first: least privilege, no secrets in the client'] },
      { title: 'Impact', bullets: ['Put ONE number here: hours saved / % faster / $ protected', ...(prizes.length ? ['Qualifies for: ' + prizes.join(' · ')] : [])] },
      { title: 'The ask', bullets: ['Judges: score us on the demo — it\'s real', 'Next: pilot with one real team', 'Repo + video linked on Devpost'] },
    ],
    script: [
      ['0:00', 'Hook — one sentence of pain, with a number in it'],
      ['0:15', 'Problem — who bleeds, how often, what it costs'],
      ['0:35', 'WOW — ' + wow + ' (pre-recorded; narrate outcomes, not clicks)'],
      ['1:35', 'How — stack in one breath; name the hard part and the security angle'],
      ['2:05', 'Impact — the number, before/after, who wants this on Monday'],
      ['2:35', 'Ask — prize tracks you qualify for + what you\'d build next'],
      ['3:00', 'END — under time. Stop talking.'],
    ],
  };
}

// ---------- self-test (node src/lib/core.js) ----------
export function selftest() {
  const A = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
  const t0 = Date.parse('2026-01-01T09:00:00Z'), t1 = t0 + 24 * H;
  const ms = genMilestones(t0, t1, { devpost: true, video: true, repo: true });
  A(ms.length === 11, '11 milestones for full reqs');
  A(ms.every((m, i) => i === 0 || ms[i - 1].at <= m.at), 'milestones sorted');
  A(ms.filter(m => m.hard).length === 5, '5 hard gates');
  A(ms[ms.length - 1].at === t1 - 10 * MIN, 'submit gate at T-10m');
  A(genMilestones(t0, t1, { devpost: false, video: false, repo: false }).length === 8, 'req-tied milestones drop');
  A(paceState(ms, t0) === 'ok', 'fresh run is ok');
  A(paceState(ms, ms[0].at + 1) === 'behind', 'one soft miss = behind');
  A(paceState(ms, ms.find(m => m.hard).at + 1) === 'danger', 'hard gate miss = danger');
  A(remindEvery(10 * MIN) < remindEvery(2 * H) && remindEvery(2 * H) < remindEvery(10 * H), 'reminder cadence escalates');
  A(fmtDur(-61000) === '-00:01:01' && fmtShort(90 * MIN) === '1h30m', 'formatters');

  A(extractJson('```json\n{"a":1}\n```').a === 1, 'extractJson strips fences');
  A(extractJson('prose before {"a":{"b":2}} prose after').a.b === 2, 'extractJson tolerates prose');
  let threw = false; try { extractJson('no json here'); } catch { threw = true; }
  A(threw, 'extractJson throws on garbage');

  const ideas = fallbackIdeas({ tracks: ['GitHub', 'Snyk'], theme: 'ci security secrets leak', budgetH: 36 });
  A(ideas.length === 5, 'fallback returns 5 ideas');
  A(ideas[0].name === 'PR Tripwire', 'fallback relevance ranking works with free-typed sponsor names');
  A(ideas.every(i => i.feasibility >= 5 && i.feasibility <= 97 && i.buildPlan.length && i.sponsors.length), 'fallback idea shape complete');
  const tight = fallbackIdeas({ budgetH: 6 });
  A(Math.max(...tight.map(i => i.feasibility)) < Math.max(...ideas.map(i => i.feasibility)), 'tight budget lowers feasibility');

  const sc = fallbackScout(['github', 'Google Cloud', 'TotallyNewCo', '  ']);
  A(sc.length === 3, 'scout drops blank names');
  A(sc[0].name === 'GitHub' && sc[0].apis.length > 0, 'scout maps known sponsor loosely');
  A(sc[1].name === 'Google Cloud' && sc[1].prize.includes('Google'), 'scout matches multi-word names');
  A(sc[2].apis.length === 0 && sc[2].prize === 'Best use of TotallyNewCo' && sc[2].angle.includes('offline map'), 'scout is honest about unknown sponsors');

  const iv = fallbackIntervention(ms, ms.find(m => m.hard).at + 1, t1);
  A(iv.diagnosis.includes('overdue') && iv.cut.length >= 2 && iv.nextAction.includes(ms[0].label), 'fallback intervention targets first overdue gate');

  const pk = fallbackPitch({ pick: ideas[0], theme: 'ci security', readme: '# x\n- feat one\n- feat two' });
  A(pk.deck.length === 7 && pk.script.length === 7, 'fallback pitch: 7 slides + 7 beats');
  A(pk.devpost.title === 'PR Tripwire' && pk.devpost.description.includes('feat one'), 'fallback devpost carries pick + readme');
  const pk2 = fallbackPitch({ pick: ideas[0] }); // no README — the QA-flagged duplication case
  const builtSection = pk2.devpost.description.split('How we built it')[1].split('##')[0];
  A(!builtSection.includes(ideas[0].wow), 'no wow duplication in devpost sections');
  A(!pk2.deck[2].bullets.includes(ideas[0].wow), 'solution slide is not the wow line again');

  console.log('PASS — core selftest (engine + extractJson + 3 agent fallbacks)');
}

if (typeof window === 'undefined') selftest();
