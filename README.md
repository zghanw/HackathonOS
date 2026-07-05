# Hackathon OS

The clock + your voice to Claude. A serverless (fully static) copilot for competitive hackathoners:
**React 18 + Tailwind CSS v4 (Vite). No backend — state lives in localStorage.**

**The split of labor:** anything real-time and deterministic stays local (the countdown, hard gates, escalating alarms, rubric pre-score); anything generative is Claude's job — the app compiles your full context into precision prompts instead of faking generation with hardcoded banks.

## Run

```sh
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Deploy: `vercel` from the repo root (vercel.json builds the static site). No server to run, ever.

## Self-test

```sh
node frontend/src/lib/core.js    # milestones, pace, rubric, 3 prompt compilers → PASS
```

## Modules

| Module | What it does | Local or Claude? |
|---|---|---|
| **Deadline Guardian** (centerpiece) | Bento-grid live countdown, T-gated milestones (5 hard gates), behind-pace/danger states, escalating alarms: notification + audio + title flash + screen flash | 100% local, real-time |
| **Ideas** | Compiles tracks + theme + stack + budget into a strategist prompt: sponsor-API prize mapping, brutal feasibility scoring, one-wow MVP scoping, "dies if" risk per idea. Lock the winner back in — it feeds everything else | Prompt → Claude |
| **Kickoff** | One prompt to start Claude Code on the actual build — scaffold order, wow-feature-first, security hygiene, and **your live Guardian gates as rules Claude enforces** (after code freeze, Claude refuses new features) | Prompt → Claude Code |
| **Pitch** | Instant local rubric pre-score of your README (fix weaknesses for free), then a pitch-engineer prompt: 7-slide deck as real .pptx (python-pptx), 3:00 time-coded demo script, tailored recording checklist | Pre-score local · kit → Claude |

Shared state: lock an idea → it names the Guardian run, anchors the Kickoff prompt, prefills the Pitch brief.

## Structure

```
frontend/
├── src/lib/core.js       engine: milestones/pace/rubric + 3 prompt compilers (node-testable)
├── src/lib/ui.jsx        SVG icons, alarm utils, shared PromptCard
├── src/App.jsx           tabs, localStorage state hook, global alarm loop
└── src/modules/          Guardian / Ideas / Kickoff / Pitch
```

## Defaults chosen (noted inline with `ponytail:` comments)

- **Serverless on purpose** — static site, zero infra. Add a sync backend only if multi-device ever matters.
- **Prompts over API calls** — no key management, works with Claude Code/claude.ai/API alike; you stay in the loop on every generation.
- **Rubric pre-score stays deterministic** — instant, offline, free; it's a linter, not a judge.
- Milestone offsets scale linearly for windows under 24h (floor at 0.5×); reminder cadence 30m → 10m → 5m → 1m.

Non-goals (on purpose): team matchmaking, organizer dashboard, mobile app, multi-user collab, API marketplace.
