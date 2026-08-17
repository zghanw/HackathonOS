import { useEffect, useRef, useState } from 'react'
import { fmtDur, fmtShort } from '../lib/core.js'
import { Ic } from '../lib/ui.jsx'

// Arcade title-screen / boot-sequence landing. The pixel game world is the app's
// pinned identity; this surface amplifies it into a bootable title screen. Demo
// data (the hero countdown, the party lineup) is illustrative and labelled; every
// factual claim below is true of the shipped product.

const PARTY = [
  { n: 'Hao Wen', c: '#4ade80', s: 'wiring the realtime channel', live: 'online', you: true },
  { n: 'Mei', c: '#38bdf8', s: 'recording the demo video', live: 'online' },
  { n: 'Arjun', c: '#fbbf24', s: 'stuck on the OAuth redirect', live: 'idle' },
  { n: 'Sofia', c: '#c084fc', s: 'writing the Devpost draft', live: 'online' },
]
const LIVE_RING = { online: 'border-ok', idle: 'border-warn', offline: 'border-white/20' }
const LIVE_TXT = { online: 'text-ok', idle: 'text-warn', offline: 'text-mut' }

function Portrait({ m, size = 44, blink = false }) {
  return (
    <span title={`${m.n} — ${m.s}`}
      className={`grid shrink-0 place-items-center border-2 font-bold uppercase shadow-[3px_3px_0_rgba(0,0,0,.5)] ${LIVE_RING[m.live]} ${blink ? 'lp-portrait' : ''}`}
      style={{ width: size, height: size, background: m.c + '2e', color: m.c, fontSize: size * 0.34 }}>
      {m.n.slice(0, 2)}
    </span>
  )
}

// mini quest log shown inside the Boss Timer system panel
const DEMO_GATES = [
  { label: 'Wow feature works end to end', t: '14h24m', hard: false, by: 'Mei' },
  { label: 'CODE FREEZE: bugfixes only', t: '4h', hard: true },
  { label: 'Demo video recorded and uploaded', t: '2h', hard: true },
  { label: 'Submission form COMPLETE', t: '45m', hard: true },
]

export default function Landing({ onEnter }) {
  // live demo countdown to a plausible submission gate, ticking like the real app
  const target = useRef(Date.now() + (5 * 3600 + 27 * 60 + 41) * 1000)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, target.current - now)
  const windowMs = 24 * 3600 * 1000
  const prog = Math.min(100, 100 * (1 - left / windowMs))

  return (
    <div className="min-h-screen">
      {/* ---------- title-screen nav ---------- */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b-[3px] border-edge bg-[#1c1730] px-4 py-2.5 shadow-[0_3px_0_rgba(0,0,0,.4)] sm:px-6">
        <img src="/logo.png" alt="" className="h-7 w-7 object-contain [image-rendering:pixelated]" />
        <span className="font-pixel text-[11px] text-acc sm:text-[13px]">HACKATHON OS</span>
        <span className="chip ml-2 hidden sm:inline-flex">real-time team space</span>
        <nav className="ml-auto flex items-center gap-2">
          <a href="https://github.com/zghanw/HackathonOS" target="_blank" rel="noreferrer"
            className="btn !hidden !px-3 sm:!inline-flex" title="Source on GitHub">
            <Ic n="terminal" s={12} />GitHub
          </a>
          <button className="btn btn-primary !px-4" onClick={onEnter}><Ic n="play" s={12} />Start</button>
        </nav>
      </header>

      {/* ---------- HERO: the title screen ---------- */}
      <section className="lp-crt lp-crt-edge relative overflow-hidden border-b-[3px] border-edge">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* left: wordmark + hook + press start */}
          <div>
            <h1 className="lp-wordmark lp-power text-[clamp(34px,7vw,76px)]">
              HACKATHON<br /><span className="g">OS</span>
            </h1>
            <p className="lp-rise mt-6 max-w-[46ch] text-[15px] leading-relaxed text-ink/90 sm:text-base">
              The shared clock your whole party keeps open, from kickoff to submission.
              Presence, quests, notes and files, all rendered against the same countdown
              to the same hard gates.
            </p>
            <div className="lp-rise mt-8 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary !px-6 !py-3.5 !text-[11px]" onClick={onEnter}>
                <Ic n="play" s={14} /><span className="lp-blink">PRESS START</span>
              </button>
              <button className="btn !px-5 !py-3.5" onClick={onEnter}>Have a code? Join a party</button>
            </div>
            <p className="mt-4 font-pixel text-[8px] leading-relaxed text-mut">FREE · OPEN SOURCE · NO LOGIN · LIVE IN UNDER A MINUTE</p>
          </div>

          {/* right: the live boss timer, the product's actual centerpiece */}
          <div className="panel lp-rise p-6">
            <div className="flex items-center justify-between">
              <h4 className="tile-label !mb-0">Boss timer</h4>
              <span className="chip !border-warn/50 !text-warn">DEMO</span>
            </div>
            <div className="mt-4 text-xs text-mut">NEXT HARD GATE</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <span className="gate">HARD</span>Final submission COMPLETE
            </div>
            <div className="mt-4 font-pixel leading-none tabular-nums text-bad text-[clamp(30px,6vw,46px)]">
              {fmtDur(left)}
            </div>
            <div className="pixbar my-4">
              <i style={{ width: prog + '%', '--pixbar-c': '#e05252' }} />
              {[68, 83, 92].map(p => (
                <span key={p} className="absolute -top-[2px] h-[16px] w-[3px] bg-bad" style={{ left: p + '%' }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-mut">
              <span>window 24h</span><span>5 hard gates</span><span className="text-warn">2 overdue soon</span>
            </div>
          </div>
        </div>

        {/* title-screen party lineup */}
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-end gap-4 px-5 pb-14">
          {PARTY.map((m, i) => (
            <div key={m.n} className="flex items-center gap-2.5">
              <Portrait m={m} blink={i === 2} />
              <div className="leading-tight">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {m.n}{m.you && <span className="font-pixel text-[7px] text-acc">1P</span>}
                </div>
                <div className={`text-[11px] ${m.live === 'idle' ? 'text-warn' : 'text-mut'}`}>{m.s}</div>
              </div>
            </div>
          ))}
          <div className="ml-auto hidden items-center gap-1.5 self-center font-pixel text-[8px] text-mut lg:flex">
            SCROLL TO BOOT <Ic n="chevR" s={12} className="rotate-90" />
          </div>
        </div>
      </section>

      {/* ---------- THE REAL BOSS: the differentiation POV ---------- */}
      <section className="border-b-[3px] border-edge px-5 py-20">
        <div className="mx-auto max-w-[900px]">
          <h2 className="font-pixel text-[clamp(16px,3.4vw,26px)] leading-relaxed text-ink">
            Your real boss<br />is <span className="text-bad">the clock.</span>
          </h2>
          <div className="lp-rule my-7 w-40" />
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink/90 sm:text-lg">
            Notion, Trello and Slack treat time as metadata: a due date on a card, a reminder
            in a thread. A hackathon is not a project. It is a fixed window with hard gates,
            and missing the submission deadline deletes everything you built.
          </p>
          <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-mut sm:text-lg">
            HackathonOS makes the countdown the surface itself. Every teammate's live status
            renders against the same clock and the same gates, so <span className="text-ok">presence and
            deadlines are one feature, not two tabs.</span> That is the view no kanban board gives you:
            who is stuck, on what, right now, with the deadline draining behind them.
          </p>

          {/* the deadline as a boss HP bar */}
          <div className="slab mt-10 p-5">
            <div className="mb-2 flex items-center justify-between font-pixel text-[9px]">
              <span className="text-bad">THE SUBMISSION DEADLINE</span><span className="text-mut">HP 22%</span>
            </div>
            <div className="pixbar" style={{ height: '18px' }}>
              <i style={{ width: '22%', '--pixbar-c': '#e05252' }} />
              {[40, 62, 78, 90].map(p => <span key={p} className="absolute -top-[2px] h-[20px] w-[3px] bg-[#2b0810]" style={{ left: p + '%' }} />)}
            </div>
            <p className="mt-3 text-xs text-mut">Notches are hard gates. When one passes unchecked, the whole party's screen flashes.</p>
          </div>
        </div>
      </section>

      {/* ---------- SYSTEM SELECT: five systems, varied treatments ---------- */}
      <section className="lp-band border-b-[3px] border-edge px-5 py-20">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="font-pixel text-[clamp(15px,3vw,24px)] leading-relaxed text-ink">Five systems, one screen.</h2>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-mut">
            The whole team keeps this open on a second monitor. Everything below is live and
            shared: change it on one machine, the party sees it instantly.
          </p>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {/* Boss Timer — big, live quest log */}
            <div className="lp-tile lp-tile-hover p-6">
              <div className="flex items-center gap-2.5">
                <Ic n="clock" s={18} className="text-acc" />
                <h3 className="font-pixel text-[11px] text-ink">Boss Timer</h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-mut">
                A shared countdown to every hard gate. Any teammate adds, edits or removes a gate;
                check one off and it syncs to the whole party, with alarms escalating as it nears.
              </p>
              <ul className="mt-4 grid gap-2">
                {DEMO_GATES.map(g => (
                  <li key={g.label} className="slab flex items-center gap-2.5 p-2.5">
                    <span className={`grid h-4 w-4 place-items-center border-2 border-edge ${g.by ? 'bg-acc' : 'bg-panel2'}`}>
                      {g.by && <Ic n="check" s={10} className="text-[#062812]" />}
                    </span>
                    <span className={`text-[12.5px] ${g.by ? 'text-mut line-through' : 'font-semibold'}`}>
                      {g.hard && <span className="gate">HARD</span>}{g.label}
                    </span>
                    <span className="ml-auto shrink-0 font-pixel text-[7px] text-mut">T-{g.t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Party Presence — big, portraits + status lines */}
            <div className="lp-tile lp-tile-hover p-6">
              <div className="flex items-center gap-2.5">
                <Ic n="users" s={18} className="text-acc" />
                <h3 className="font-pixel text-[11px] text-ink">Party Presence</h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-mut">
                Online, idle, or offline for every teammate, plus a free-text line of what each
                one is doing right now. Set your own with a click. This is the wedge.
              </p>
              <ul className="mt-4 grid gap-2">
                {PARTY.map(m => (
                  <li key={m.n} className="slab flex items-center gap-3 p-2.5">
                    <Portrait m={m} size={30} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold">{m.n}{m.you && <span className="ml-1 text-[10px] font-normal text-mut">(you)</span>}</div>
                      <div className={`truncate text-[11.5px] ${m.live === 'idle' ? 'text-warn' : 'text-ink/70'}`}>{m.s}</div>
                    </div>
                    <span className={`ml-auto shrink-0 font-pixel text-[7px] uppercase ${LIVE_TXT[m.live]}`}>{m.live}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* small row: Quests / Tome / Chest */}
            <div className="lp-tile lp-tile-hover p-6">
              <div className="flex items-center gap-2.5"><Ic n="check" s={16} className="text-acc" /><h3 className="font-pixel text-[10px] text-ink">Quest Board</h3></div>
              <p className="mt-3 text-[13px] leading-relaxed text-mut">Assign tasks and move them todo → doing → done, synced live.</p>
              <div className="mt-4 grid grid-cols-3 gap-1.5 text-center font-pixel text-[7px]">
                {[['TODO', 3, 'text-mut'], ['DOING', 2, 'text-warn'], ['DONE', 5, 'text-ok']].map(([l, n, c]) => (
                  <div key={l} className="slab py-2.5"><div className={c}>{l}</div><div className="mt-1 text-[13px] font-bold text-ink">{n}</div></div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:contents">
              <div className="lp-tile lp-tile-hover p-6 lg:col-start-1">
                <div className="flex items-center gap-2.5"><Ic n="terminal" s={16} className="text-acc" /><h3 className="font-pixel text-[10px] text-ink">The Tome</h3></div>
                <p className="mt-3 text-[13px] leading-relaxed text-mut">One shared notepad. Last write wins, with a live "who is editing" indicator.</p>
                <div className="slab mt-4 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5"><Ic n="pencil" s={10} className="text-warn" /><span className="font-pixel text-[7px] text-warn">MEI IS WRITING…</span></div>
                  <div className="text-[12px] leading-relaxed text-ink/75">Pitch: one shared clock for the whole team.<br />Demo URL · backup GIF · who submits.</div>
                </div>
              </div>

              <div className="lp-tile lp-tile-hover p-6">
                <div className="flex items-center gap-2.5"><Ic n="file" s={16} className="text-acc" /><h3 className="font-pixel text-[10px] text-ink">The Chest</h3></div>
                <p className="mt-3 text-[13px] leading-relaxed text-mut">The deck, the demo GIF, design assets. Private per team, signed-URL downloads.</p>
                <ul className="mt-4 grid gap-1.5">
                  {[['deck-v3.pdf', '2.1 MB'], ['backup-demo.gif', '8.4 MB'], ['logo.png', '21 KB']].map(([f, s]) => (
                    <li key={f} className="slab flex items-center gap-2 p-2 text-[11.5px]">
                      <Ic n="file" s={13} className="shrink-0 text-acc" /><span className="truncate">{f}</span>
                      <span className="ml-auto shrink-0 text-mut tabular-nums">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- HOW TO START ---------- */}
      <section className="border-b-[3px] border-edge px-5 py-20">
        <div className="mx-auto max-w-[1000px]">
          <h2 className="font-pixel text-[clamp(15px,3vw,24px)] leading-relaxed text-ink">Boot a run in three moves.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['play', 'Create the space', 'Set the hackathon name, the window, and your gates once. Pick the classic 11-gate plan or start empty and build your own timeline.'],
              ['copy', 'Share the code', 'Every space gets a 6-character code. Drop it in your team chat. That code is the only thing a teammate needs.'],
              ['users', 'The party joins', 'Teammates open the link, punch the code, pick a name. Anonymous sign-in means they are in within seconds. No accounts, no email, no wall.'],
            ].map(([icon, title, body], i) => (
              <div key={title} className="lp-tile p-6">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center border-2 border-edge bg-acc font-pixel text-[11px] text-[#062812] shadow-[2px_2px_0_rgba(0,0,0,.45)]">{i + 1}</span>
                  <Ic n={icon} s={16} className="text-acc" />
                </div>
                <h3 className="font-pixel text-[10px] leading-relaxed text-ink">{title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-mut">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- UNDER THE HOOD: real, informative ---------- */}
      <section className="lp-band border-b-[3px] border-edge px-5 py-20">
        <div className="mx-auto max-w-[1000px]">
          <h2 className="font-pixel text-[clamp(15px,3vw,24px)] leading-relaxed text-ink">No mocked multiplayer.</h2>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-mut">
            The collaboration is genuinely real. Every claim here is something you can read in the source.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              ['zap', 'Real-time by Supabase', 'Gates, tasks, notes and every presence beat propagate live over Postgres change streams and presence channels. Not polled, not simulated.'],
              ['lock', 'Membership-scoped security', 'Anonymous auth plus row-level security. A non-member cannot read, write, or even enumerate your team. Files sit in a private bucket behind signed URLs.'],
              ['clock', 'A deadline engine you can trust', 'The pace and milestone core is deterministic and unit-tested: the same window produces identical gates on every machine, so the clock never disagrees.'],
              ['terminal', 'Open source, no gimmicks', 'MIT licensed. React, Tailwind and Supabase. No AI features, no telemetry theatre, no growth loops. A tool that does one job for the length of one event.'],
            ].map(([icon, title, body]) => (
              <div key={title} className="lp-tile p-6">
                <div className="mb-3 flex items-center gap-2.5"><Ic n={icon} s={17} className="text-acc" /><h3 className="font-pixel text-[10px] text-ink">{title}</h3></div>
                <p className="text-[13.5px] leading-relaxed text-mut">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FINAL START SCREEN ---------- */}
      <section className="lp-crt lp-crt-edge border-b-[3px] border-edge px-5 py-24 text-center">
        <h2 className="lp-wordmark mx-auto text-[clamp(24px,5vw,52px)]">READY<span className="g"> PLAYER?</span></h2>
        <p className="mx-auto mt-6 max-w-[44ch] text-[15px] leading-relaxed text-ink/90">
          Get the whole team on the same clock before the next hackathon starts.
          It takes under a minute and there is nothing to install.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button className="btn btn-primary !px-7 !py-4 !text-[12px]" onClick={onEnter}>
            <Ic n="play" s={15} /><span className="lp-blink">PRESS START</span>
          </button>
          <button className="btn !px-6 !py-4" onClick={onEnter}>Join with a code</button>
        </div>
        <p className="mt-5 font-pixel text-[8px] text-mut">CREATE A TEAM SPACE · FREE · OPEN SOURCE</p>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="px-5 py-10">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-6 w-6 object-contain [image-rendering:pixelated]" />
            <span className="font-pixel text-[10px] text-acc">HACKATHON OS</span>
          </div>
          <p className="text-[12px] text-mut sm:ml-2">A deadline-discipline tool for hackathon teams.</p>
          <nav className="flex items-center gap-4 text-[12px] text-mut sm:ml-auto">
            <button className="hover:text-acc" onClick={onEnter}>Launch app</button>
            <a className="hover:text-acc" href="https://github.com/zghanw/HackathonOS" target="_blank" rel="noreferrer">GitHub</a>
            <a className="hover:text-acc" href="https://github.com/zghanw/HackathonOS/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT License</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
