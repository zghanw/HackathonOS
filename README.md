# Hackathon OS

**A real-time collaboration space for hackathon teams — the one screen your whole team keeps open on a second monitor for the entire event.**

Notion, Trello, and Slack treat time as metadata: a due date on a card, a reminder in a thread. A hackathon is a fixed window with hard gates — miss the submission deadline and nothing else you built matters. Hackathon OS makes the countdown the surface itself: every teammate's live status (who's online, who's stuck, on what, *right now*) renders against the same shared clock and the same hard submission gates. Presence and deadlines are one feature, not two tabs.

## What it does

- **Team space** — create a space once, teammates join with a 6-character code. One shared mission (name, theme, tracks, stack, window) per team, not per browser.
- **Presence** — live avatars with online / idle / offline state, a free-text *"what I'm doing right now"* line per teammate (Figma-cursor-label style), and last-active timestamps. Realtime, not polled.
- **Shared Deadline Guardian** — the live countdown, the deterministic hard-gate milestone engine, and escalating alarms (notification + audio + title flash + screen flash) on *every teammate's machine*. Check off a gate and everyone's screen updates live, with attribution ("✓ Ben").
- **Task board** — todo / doing / done, assign to teammates, syncs live.
- **Team notes** — one shared scratchpad, last-write-wins with a live *"X is editing…"* indicator so collisions are visible before they happen.
- **Shared files** — upload/list/download small files (≤10 MB) per team: deck drafts, design assets, the backup demo GIF.

## Pixel skin (v2 look)

The glassmorphism SaaS look is gone; the app now reads as a 16-bit game the team plays together — Guardian is the **Boss Timer**, Tasks the **Quest Board**, Notes the **Tome**, Files the **Chest**. Visual layer only: engine, data layer, realtime wiring, and every behavior are byte-identical.

- **Panels**: chunky pixel bevels via layered 0-blur `box-shadow` + hard offset drop shadows. `backdrop-filter` removed entirely (it was real GPU cost), along with the three infinitely-animating blurred background blobs — the backdrop is now a static dither + vignette, painted once.
- **Type**: Press Start 2P for chrome only (headings, labels, buttons, the countdown digits); body copy stays JetBrains Mono — a full page of pixel font is a readability failure.
- **Motion**: `steps()` easing everywhere it animates; buttons press 2–3px down-right on `:active` in pure CSS; the continuous-animation budget is two small pulsing chips in danger state, opacity-only. The countdown tick is a plain text update, the timer bar has no width transition. `prefers-reduced-motion` honored as strictly as before.
- **Icons**: same inline SVGs, de-rounded with square caps + miter joins. Zero new asset fetches (one extra Google-Fonts family on the existing link).
- **Measured, not asserted** (rAF frame sampling, 1440×900): glass build idle — avg 7.5 ms/frame, worst 66.6 ms; pixel build *while* switching all four tabs and toggling gates — avg 6.1 ms, worst 36.1 ms, one frame >25 ms in 6 s. Before/after in [docs/](docs/).
- **Copy style**: no em-dashes in UI copy, ever. Rendered strings use periods, commas, or colons (middots for metadata separators are fine).

## Architecture

React 18 + Tailwind v4 (Vite) static frontend, **Supabase** backend — Postgres + Realtime + Storage, no server code to host.

```
frontend/src/
├── lib/core.js       deterministic spine: milestone engine, pace state, alarm cadence.
│                     Pure + node-testable. Same team window ⇒ identical milestones on
│                     every machine, so the backend only syncs WHICH gates are checked.
├── lib/supabase.js   client init from .env
├── lib/team.js       the data layer: one hook owns the session, shared state, and all
│                     realtime subscriptions; components get plain state + mutations
├── lib/ui.jsx        SVG icons, alarm/toast utils
├── App.jsx           shell: header (code, countdown, avatars, status line), guardian
│                     alarm loop, tab routing
└── modules/          Join / Guardian / Tasks / Notes / Files
supabase/migrations/  full schema — apply to any Supabase project to rehost
```

**Sync design** (all tables prefixed `hackos_`):

| Surface | Mechanism |
|---|---|
| Milestones (label/time/hard + check-offs), tasks, notes, statuses, idle/editing flags | `postgres_changes` on `hackos_*` tables, filtered per team |
| Online/offline | Realtime presence channel — join/leave only (presence *meta updates* proved unreliable in testing, so mutable flags live on the member row instead) |
| File list changes; gate-removal attribution | Realtime broadcast on the team channel (RLS strips DELETE payloads to the pk, so "who removed it" can't ride the DB event) |

The timeline is fully team-managed: any member adds, edits (label, T-minus time, HARD flag), or removes gates inline in the quest log, with an undo toast on delete and attribution toasts on remote changes. `core.js`'s `genMilestones` survives as the optional "Classic plan (11 gates)" seed at team creation.

Identity is deliberately lightweight: no accounts. Joining creates a member row; the session (team + member id) lives in localStorage. Append `?fresh` to the URL to act as a second teammate in another tab of the same browser (handy for demos).

## Run it

```sh
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Self-test the engine: `node frontend/src/lib/core.js` → PASS.

### Supabase setup

`frontend/.env` (gitignored) needs two values — both are publishable-by-design, safe in a client bundle:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

The backend is the standalone **`HackathonOS`** Supabase project (free tier, `ap-southeast-1`). To rehost anywhere: create a project, run [supabase/migrations/001_hackos_team_space.sql](supabase/migrations/001_hackos_team_space.sql) in the SQL editor, and swap the two `.env` values. Nothing else changes.

Deploy: `vercel` from the repo root; set the two `VITE_*` env vars in Vercel project settings.

### Security model (deliberate v1 tradeoff)

RLS is enabled but permissive: the join code is the only secret, and anyone with the publishable key could technically read/write `hackos_*` rows. That's an accepted tradeoff for a weekend tool holding weekend-lived data — the upgrade path is Supabase Auth + membership-scoped policies, and the migration file marks the spot.

## What was removed, and why

The previous version was a single-player AI copilot. This version is a multiplayer team surface — the AI layer went away entirely:

- **`lib/agents.js`** (Scout, Strategist, Guardian's AI triage, Pitchsmith, `callClaude`) — all four agents, the browser-side Anthropic API client, and every call site.
- **Settings tab** — existed only for API key management.
- **Ideas & Pitch tabs** — AI-generation surfaces (idea scoring, submission-kit drafting). Kept from Pitch's scaffolding: the **recording checklist** and **judging-rubric weights**, now a static reference tile at the bottom of the Guardian tab — they're genuinely useful and needed no AI.
- **`core.js` fallback bank** (`SPONSORS`, `IDEA_BANK`, `fallback*`, `extractJson`) — these were the AI layer's offline shadow, not the engine. The engine (milestones / pace / reminders / formatters) is untouched and still self-tested.

Non-goals, still: organizer views across teams, video/voice, native apps, public team discovery, CRDT-grade collaborative editing.
