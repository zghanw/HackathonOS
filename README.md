# Hackathon OS

**A real-time collaboration space for hackathon teams. The single dashboard your entire team keeps open on a second monitor throughout the event.**

Notion, Trello, and Slack treat time as metadata: a due date on a card or a reminder in a thread. A hackathon is a fixed window governed by hard deadlines: missing the submission deadline invalidates everything else built. Hackathon OS makes the countdown the central interface surface: every teammate's live status (who is online, who is stuck, and on what, right now) renders against a shared clock and unified submission milestones. Presence and deadlines operate as a single cohesive feature.

## Features

- **Team Space**: Create a space once; teammates join via a 6-character code. Establishes one shared mission (name, theme, tracks, tech stack, timeframe) per team rather than per browser.
- **Real-Time Presence**: Live avatars with online, idle, and offline states, plus a free-text status line per teammate (Figma cursor-label style) and last-active timestamps powered by Supabase Realtime.
- **Shared Deadline Guardian**: Synchronized countdown timer, deterministic milestone engine, and escalating alarms (browser notification, audio alert, tab title flashing, and screen flash) across all teammates' devices. Checking off a gate updates everyone's screen instantly with member attribution (e.g., Ben).
- **Task Board**: Interactive Kanban board (To Do, Doing, Done) with member assignment and live state synchronization.
- **Team Notes**: Shared collaborative scratchpad with a live edit indicator ("X is editing...") to prevent edit collisions.
- **Shared Files**: Cloud file sharing for assets up to 10 MB per team (presentation decks, design assets, backup demo GIFs).

## Pixel Skin (v2 UI)

The interface uses a 16-bit retro aesthetic designed for hackathon focus. UI modules are stylized as game elements: Guardian acts as the **Boss Timer**, Tasks as the **Quest Board**, Notes as the **Tome**, and Files as the **Chest**. This is a pure presentation layer: the core engine, data layer, real-time sync, and application logic remain byte-identical.

- **Panels**: Chunky pixel bevels using layered zero-blur `box-shadow` styles and hard drop shadows. Removed `backdrop-filter` and animated background blobs to eliminate GPU overhead, replacing them with a static dither and vignette.
- **Typography**: Press Start 2P for chrome elements (headings, labels, buttons, countdown digits) paired with JetBrains Mono for body copy to preserve legibility.
- **Motion**: `steps()` animation timing function, CSS active state button press-down effects (2 to 3 px), and strictly budgeted continuous animations (two subtle pulsing chips for danger states). Full support for `prefers-reduced-motion`.
- **Icons**: Inline SVGs styled with square caps and miter joins, requiring zero additional asset network requests.
- **Performance Benchmarks**: Frame sampling at 1440x900 resolution showed average frame rendering times of 6.1 ms during active tab switches and gate toggles (compared to 7.5 ms baseline in the legacy glass build). Frame capture documentation is available in [docs/](docs/).
- **Copy Guidelines**: Strict exclusion of em dashes in UI copy. Rendered strings use periods, colons, commas, or middle dots for metadata.

## Architecture

React 18 + Tailwind CSS v4 (Vite) static frontend with a **Supabase** backend (Postgres, Realtime, Storage) requiring zero custom server infrastructure.

```
frontend/src/
├── lib/core.js       Deterministic engine: milestones, pace calculations, and alarm cadence.
│                     Pure JavaScript and node-testable. Identical milestones are derived on
│                     every client from team window inputs, avoiding database sync overhead.
├── lib/supabase.js   Supabase client initialization.
├── lib/team.js       Centralized data layer hook owning session state, shared state, and
│                     real-time subscriptions.
├── lib/ui.jsx        SVG icons, alarm handlers, and toast utilities.
├── App.jsx           Main application shell: header, countdown display, avatars, guardian alarm loop, and tab routing.
└── modules/          Join, Guardian, Tasks, Notes, and Files modules.
supabase/migrations/  Database schema migrations for self-hosting on any Supabase project.
```

### Sync Architecture

Tables use the `hackos_` prefix:

| Surface | Sync Mechanism |
|---|---|
| Milestones, Tasks, Notes, Member Status, Idle/Editing flags | Supabase `postgres_changes` on `hackos_*` tables, filtered per team |
| Online / Offline Presence | Supabase Realtime Presence channel (join and leave events) |
| File List Changes & Gate Removals | Supabase Realtime broadcast on the team channel |

The timeline is fully team-managed: members can add, edit (label, target time, hard-gate status), or remove gates inline with full undo capability and remote attribution toasts.

Identity is lightweight and session-based without mandatory account registration: joining creates a team member record stored in `localStorage`. Append `?fresh` to the URL to simulate additional teammates in separate tabs of the same browser.

## Getting Started

### Local Development

1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   Access the app at `http://localhost:5173`.

3. Run the core engine tests:
   ```bash
   npm test
   ```
   Or directly: `node frontend/src/lib/core.js` (expected output: `PASS`).

### Supabase Configuration

Create `frontend/.env` with your project credentials:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

To rehost the backend:
1. Create a new Supabase project.
2. Run the database migration script [supabase/migrations/001_hackos_team_space.sql](supabase/migrations/001_hackos_team_space.sql) in the Supabase SQL Editor.
3. Update `frontend/.env` with your new project credentials.

### Deployment

Deploy to Vercel from the repository root:

```bash
vercel
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your Vercel project environment settings.

### Security Model

Row Level Security (RLS) is enabled across all `hackos_*` tables. Access is scoped by the shared 6-character team join code. For production environments requiring strict user isolation, the system can be upgraded to Supabase Auth with authenticated user RLS policies as outlined in the database migration file.

## Evolution and Simplification

The architecture was deliberately refactored from a single-player AI copilot to a real-time multiplayer team workspace. Non-essential AI code was removed:

- **`lib/agents.js`**: Removed AI agents (Scout, Strategist, Guardian triage, Pitchsmith) and Anthropic API client code.
- **Settings Tab**: Removed key management interfaces.
- **Ideas & Pitch Tabs**: AI generation interfaces were replaced with static reference tiles (Recording Checklist and Judging Rubric Weights) embedded in the Guardian tab.
- **Core Engine Clean Up**: Removed offline AI shadow data (`SPONSORS`, `IDEA_BANK`) while preserving the deterministic core milestone engine.

