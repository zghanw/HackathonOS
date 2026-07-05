// Hackathon OS — core engine. No DOM, no React. `node src/lib/core.js` runs the self-test.
// The generative work (ideas, decks, code) is Claude's job — this module keeps the clock
// and compiles your context into precision prompts. Deterministic bits (milestones, pace,
// rubric pre-score) stay local so they work offline and instantly.
'use strict';
const H = 3600e3, MIN = 60e3;

// ---------- sponsor / prize-track map (powers the prompt's prize mapping) ----------
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

// ---------- Deadline Guardian: milestone engine (local + real-time, never Claude's job) ----------
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

// escalating reminder cadence for an overdue milestone, by time left in the window
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

// ---------- consensus judging rubric (shared by the local pre-score and every prompt) ----------
export const RUBRIC = { innovation: 0.275, technical: 0.25, impact: 0.25, design: 0.15, presentation: 0.075 };
export const RUBRIC_LINE = 'Innovation 27.5% · Technical execution 25% · Impact/feasibility 25% · Design 15% · Presentation 7.5%';
export const RUBRIC_TIPS = {
  innovation: 'Name what you do that the obvious alternative doesn\'t — one "unlike X, we Y" sentence.',
  technical: 'Say the hard part out loud: the pipeline, the auth model, the scan. Judges can\'t score what you don\'t mention.',
  impact: 'Add ONE number: hours saved, % faster, $ at risk. Any real number beats adjectives.',
  design: 'Add 2 screenshots and mention the UI flow — design points are the cheapest points on the board.',
  presentation: 'Cut to ≤4 features. One wow demoed beats six described.',
};

// local, instant, offline README pre-score — spend Claude tokens on a draft that already scores
export function rubricScore(text, features = [], idea = null) {
  const t = (text || '').toLowerCase();
  const hits = re => (t.match(re) || []).length;
  const cl = v => Math.max(20, Math.min(98, Math.round(v)));
  const sub = {
    innovation: cl(55 + (idea ? 15 : 0) + hits(/unlike|first|only|novel|instead of|no one/g) * 6 - hits(/chatbot|gpt wrapper|ai[- ]powered assistant/g) * 10),
    technical: cl(45 + Math.min(30, hits(/\bapi\b|auth|oauth|websocket|pipeline|ci\/cd|database|encrypt|token|webhook|sandbox|scan/g) * 4) + (features.length >= 2 ? 8 : 0)),
    impact: cl(40 + Math.min(35, hits(/\d+\s?%|\$\d|\b\d+x\b|hours? saved|per (week|day|month)|users?|teams?|companies/g) * 7)),
    design: cl(50 + hits(/screenshot|\bui\b|\bux\b|design|dark mode|responsive|figma/g) * 6),
    presentation: cl(60 + (features.length > 0 && features.length <= 4 ? 15 : features.length > 6 ? -10 : 5)),
  };
  const total = Math.round(Object.entries(RUBRIC).reduce((a, [k, w]) => a + sub[k] * w, 0));
  const tips = Object.keys(sub).sort((a, b) => sub[a] - sub[b]).slice(0, 2).map(k => ({ cat: k, tip: RUBRIC_TIPS[k] }));
  return { sub, total, tips };
}

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

// ============================================================================
// PROMPT COMPILERS — the app's voice to Claude. Everything the old hardcoded
// generators knew (prize mapping, feasibility honesty, one-wow scoping, the
// rubric, the gates) is compiled into the prompt instead of faked locally.
// ============================================================================

export function buildIdeaPrompt({ tracks = [], problem = '', stack = 'React, Tailwind, FastAPI', budgetH = 24 } = {}) {
  const trackLines = tracks.length
    ? tracks.map(k => SPONSORS[k]).filter(Boolean).map(s => `- ${s.name}: ${s.apis.join(', ')} — prize: "${s.prize}"`).join('\n')
    : '- (none listed — optimize for the overall grand prize instead)';
  return `You are my hackathon strategist. I need project ideas I can actually win with — not a brainstorm dump.

## My constraints
- Team stack: ${stack} (anything outside it costs extra hours — price that in)
- Realistic build budget: ${budgetH} hours of hands-on-keyboard time
- Problem statement / theme: ${problem.trim() || '(open theme — pick the strongest wedge)'}

## Sponsor prize tracks at this event
${trackLines}

## Non-negotiables for every idea
1. A real product in a real workflow — no thin AI-wrapper demos.
2. Lean into DevSecOps / security angles wherever a track allows; that is my edge.
3. ONE wow feature scoped as the whole MVP — demoable in under 90 seconds.
4. Name the sponsor APIs each idea genuinely qualifies for (no prize-bait stretches).
5. A one-sentence differentiator in the form "unlike X, we Y".

## Judges score on (weight your picks accordingly)
${RUBRIC_LINE}

## Output — exactly 5 ideas, this format per idea
### <n>. <Name> — feasibility <score>/100 (<Safe bet | Doable | Stretch | Trap>)
- **Wow MVP:** <the one feature, described as a demo moment>
- **Differentiator:** unlike <X>, we <Y>
- **Qualifies for:** <sponsor → the specific API used>
- **Hour split:** <h> build / <h> integrate / <h> polish — must fit ${budgetH}h with slack
- **Dies if:** <the single riskiest assumption>

Be brutally honest on feasibility — a "Trap" label saves my hackathon. Rank by expected-prize-fit × feasibility, then close with the ONE you would build and the first file you would create.`;
}

export function buildKickoffPrompt({ idea = null, stack = 'React 18 + Vite + Tailwind CSS v4 frontend · Python FastAPI backend', run = null, budgetH = 24 } = {}) {
  // live run → absolute gate times; otherwise a relative T-minus plan for the budget
  const W = run ? run.end - run.start : budgetH * H;
  const ms = run?.milestones?.length ? run.milestones : genMilestones(0, W);
  const endAt = run ? run.end : W;
  const gates = ms.map(m =>
    `- [${m.hard ? 'HARD' : 'soft'}] T-${fmtShort(endAt - m.at)}${run ? ' (' + new Date(m.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ')' : ''} — ${m.label}${m.done ? ' [DONE]' : ''}`
  ).join('\n');
  return `You are my hackathon pair programmer. The clock is running — we ship or we lose.

## Project
${idea ? `${idea.name} — ${idea.diff || ''}\nWow feature (this IS the MVP): ${idea.wow || '(ask me)'}` : '(idea not locked yet — ask me for it before writing any code)'}

## Stack (do not deviate, do not add dependencies without asking)
${stack}

## Deadline plan — hold me to every gate${run ? ` (submission closes ${new Date(run.end).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })})` : ` (${budgetH}h window, times relative to submission)`}
${gates}

## Rules of engagement
1. Scaffold first: frontend/ (Vite + React + Tailwind v4), backend/ (FastAPI with /api/health), .gitignore + .env from commit one, GitHub Actions CI, README with run instructions. Hello-world must run end-to-end before any feature work.
2. Build the wow feature FIRST, ugly. Polish only after the full demo path clicks through.
3. After the CODE FREEZE gate passes: refuse my feature requests — bugfixes only. Quote the gate back at me when I try.
4. Every commit leaves the demo path working. If a change breaks it, revert before continuing.
5. Security hygiene by default: no secrets in the client, validate inputs at the API boundary, least-privilege keys.
6. If I fall behind pace, propose what to CUT — never how to "catch up".

Start now: scaffold the repo, then state the first gate and what "done" looks like for it.`;
}

export function buildPitchPrompt({ readme = '', idea = null, run = null } = {}) {
  return `You are my pitch engineer. Build my complete hackathon pitch kit from the README below. Optimize every word against the judging rubric — not for completeness.

## Judging rubric (the only thing that matters)
${RUBRIC_LINE}

## Deliverables — all three, in one pass
1. **7-slide deck** — title (with differentiator) → problem → solution → live demo → under the hood → impact → ask. Max 4 bullets per slide. The impact slide MUST carry at least one real number. Then generate it as an actual dark-themed .pptx using python-pptx.
2. **Time-coded 3:00 demo script** — 0:00 hook (pain + a number) / 0:15 problem / 0:35 WOW demo / 1:35 how it works + the security angle / 2:05 impact / 2:35 ask + prize tracks / 3:00 end, under time. Narrate outcomes, not clicks.
3. **Recording checklist** — tailor this baseline to my project:
${RECORD_CHECKLIST.map(c => '   - ' + c).join('\n')}
${idea ? `\n## Locked idea context\n${idea.name} — ${idea.diff || ''}\nWow: ${idea.wow || ''}\n` : ''}${run ? `\n## Time pressure\nSubmission closes ${new Date(run.end).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })} — one pass, keep it tight.\n` : ''}
## My README
"""
${readme.trim()}
"""

If the README has no number for the impact slide, ask me for ONE number and nothing else; otherwise produce everything without questions.`;
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
  const hard = ms.find(m => m.hard);
  A(paceState(ms, hard.at + 1) === 'danger', 'hard gate miss = danger');
  A(remindEvery(10 * MIN) < remindEvery(2 * H) && remindEvery(2 * H) < remindEvery(10 * H), 'reminder cadence escalates');
  A(fmtDur(-61000) === '-00:01:01' && fmtShort(90 * MIN) === '1h30m', 'formatters');

  const r1 = rubricScore('a tool', ['f1'], null);
  const r2 = rubricScore('saves 10 hours saved per week for 500 users, 40 % faster, api auth pipeline encrypt webhook', ['f1', 'f2'], { name: 'x' });
  A(r2.total > r1.total, 'better content scores higher');
  A(r1.total >= 0 && r2.total <= 100, 'rubric in bounds');

  const ip = buildIdeaPrompt({ tracks: ['github', 'snyk'], problem: 'ci security', stack: 'React, Tailwind, FastAPI', budgetH: 36 });
  A(ip.includes('Best use of GitHub') && ip.includes('Best security hack'), 'idea prompt maps prize tracks');
  A(ip.includes('36 hours') && ip.includes('React, Tailwind, FastAPI'), 'idea prompt embeds constraints');
  A(ip.includes('exactly 5 ideas') && ip.includes(RUBRIC_LINE), 'idea prompt fixes format + rubric');
  A(buildIdeaPrompt({}).includes('open theme'), 'idea prompt handles empty problem');

  const idea = { name: 'PR Tripwire', wow: 'revoke a leaked key in 10s', diff: 'guards the merge' };
  const kp = buildKickoffPrompt({ idea, budgetH: 24 });
  A(kp.includes('PR Tripwire') && kp.includes('CODE FREEZE'), 'kickoff embeds idea + freeze gate');
  A((kp.match(/- \[(HARD|soft)\]/g) || []).length === 11, 'kickoff embeds all 11 gates');
  const run = { start: t0, end: t1, milestones: ms };
  A(buildKickoffPrompt({ idea, run }).includes('submission closes'), 'kickoff uses live run when present');
  A(buildKickoffPrompt({}).includes('not locked yet'), 'kickoff handles missing idea');

  const pp = buildPitchPrompt({ readme: '# My Proj\n- does a thing', idea, run });
  A(pp.includes('# My Proj') && pp.includes(RUBRIC_LINE), 'pitch prompt embeds readme + rubric');
  A(pp.includes('python-pptx') && pp.includes('3:00 demo script'), 'pitch prompt demands real deliverables');
  A(pp.includes('PR Tripwire') && pp.includes('Submission closes'), 'pitch prompt carries idea + deadline context');

  console.log('PASS — core selftest (' + ms.length + ' milestones, 3 prompt compilers, rubric ' + r2.total + '/100)');
}

if (typeof window === 'undefined') selftest();
