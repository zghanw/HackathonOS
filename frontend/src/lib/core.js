// Hackathon OS — deterministic core. No DOM, no React, no network.
// `node src/lib/core.js` runs the self-test.
// This is the OS's spine: the classic-plan gate generator (used as an optional
// seed at team creation; the live timeline is team-edited DB rows after that),
// pace state, and the escalating reminder cadence. Deliberately pure.
'use strict';
const H = 3600e3, MIN = 60e3;

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
    [end - 6 * H * s, 'Stable build deployed: freeze candidate', 0, null],
    [end - 4 * H * s, 'CODE FREEZE: bugfixes only, no new features', 1, null],
    [end - 2 * H * s, 'Demo video recorded and uploaded', 1, 'video'],
    [end - 1.5 * H * s, 'Devpost draft: title, tagline, screenshots in', 0, 'devpost'],
    [end - 45 * MIN * s, 'Submission form COMPLETE, every required field', 1, null],
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
export function fmtAgo(ms) {
  const d = Date.now() - ms;
  if (!ms || d < 0) return '-';
  if (d < MIN) return 'just now';
  if (d < H) return Math.floor(d / MIN) + 'm ago';
  if (d < 24 * H) return Math.floor(d / H) + 'h ago';
  return Math.floor(d / (24 * H)) + 'd ago';
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
  A(fmtAgo(Date.now() - 5 * MIN) === '5m ago' && fmtAgo(0) === '-', 'fmtAgo');
  // determinism is the sync contract: two machines, same window -> identical milestones
  A(JSON.stringify(ms) === JSON.stringify(genMilestones(t0, t1)), 'engine is deterministic');
  console.log('PASS: core selftest (milestone engine + pace + formatters)');
}

if (typeof window === 'undefined') selftest();
