# Hackathon OS

Agentic mission control for competitive hackathoners. **You do two things: describe the hackathon once, and check off gates as they happen. Agents do everything else, unprompted.**

Serverless: React 18 + Tailwind CSS v4 (Vite) static site. Agents call the Anthropic API **directly from the browser** — no backend, no proxy. State lives in localStorage.

## The agents

| Agent | Fires itself when | Does |
|---|---|---|
| **Scout** | Mission launch (first) | Studies the sponsors you typed — any company, free text — and briefs the team: integratable APIs, likely prize track, winning angle. Feeds every other agent. |
| **Strategist** | Mission launch (after the scout) | Generates 5 scored ideas (prize-track mapping from the scout's intel, feasibility labels incl. "Trap", hour splits, "dies if" risk, build plan) and **auto-picks the winner**. Override with one click. |
| **Guardian** | Pace drops to behind/danger (20-min cooldown) | Doesn't just alarm — produces a triage plan: what to CUT, what to KEEP, the single next action. Posted to the agent console. |
| **Pitchsmith** | T-15min before the demo-video/Devpost gate | Drafts the full submission kit: Devpost title+tagline+description, 7-slide deck, 3:00 time-coded script. Waiting in the Pitch tab before you'd think to ask. |

Deterministic and always-on (no API needed): the countdown, hard gates, pace engine, escalating alarms (notification + audio + title flash + screen flash), and the recording checklist.

**No API key?** Every agent degrades to a deterministic fallback engine — less smart, never dead. Add a key in Settings to go generative (stored in localStorage only; use a scoped key).

## Run

```sh
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Deploy: `vercel` from the repo root. Self-test: `node frontend/src/lib/core.js` → PASS.

## Structure

```
frontend/src/
├── lib/core.js       deterministic spine: gates, pace, alarms cadence + agent fallbacks (node-testable)
├── lib/agents.js     Anthropic API client + strategist / guardian / pitchsmith
├── lib/ui.jsx        SVG icons, alarm utils
├── App.jsx           the OS loop: state, alarms, agent auto-triggers, feed
└── modules/          Mission (bento + agent console) / Ideas / Pitch / Settings
```

## Design decisions (noted inline with `ponytail:` comments)

- **Milestone check-offs stay manual on purpose** — the OS automates everything except the truth about what's actually built.
- **Direct browser→API calls** (`anthropic-dangerous-direct-browser-access`) — the key never leaves your machine; there's no server to protect.
- **Agents are stateless functions over mission state** — every action lands in the feed, nothing happens invisibly.
- Autonomy is one toggle in Settings; off = agents only run on their buttons.

Non-goals (on purpose): team matchmaking, organizer dashboard, mobile app, multi-user collab, API marketplace.
