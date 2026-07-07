// Icons + imperative alarm utils + shared prompt UI.
// ponytail: toast/flash/beep stay DOM-based on purpose — they're fire-and-forget side
// effects triggered from event handlers and effects; routing them through React state
// would add a store for zero benefit.

// Lucide icon paths, stroke=currentColor — no emoji anywhere
const PATHS = {
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22"/><path d="M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 4.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
};

export function Ic({ n, s = 16, className = '' }) {
  return (
    <svg className={'shrink-0 ' + className} width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[n] || '' }} />
  );
}

let AC = null;
export function audioInit() {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume && AC.resume(); } catch { /* no audio */ }
}
export function beep(n = 1) {
  if (!AC) return;
  let t = AC.currentTime;
  for (let i = 0; i < n; i++) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    o.frequency.value = i % 2 ? 660 : 880;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.start(t); o.stop(t + 0.3); t += 0.35;
  }
}
export function flash() {
  const f = document.getElementById('flash');
  if (!f) return;
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}
export function toast(msg, type = 'ok') {
  const c = document.getElementById('toasts');
  if (!c) return;
  const d = document.createElement('div');
  d.className = 'toast ' + type;
  d.textContent = msg;
  c.appendChild(d);
  setTimeout(() => d.remove(), 7000);
}
export function notify(title, body, urgent) {
  try { if (window.Notification && Notification.permission === 'granted') new Notification(title, { body }); } catch { /* denied */ }
  toast(title + ' — ' + body, urgent ? 'bad' : 'warn');
  beep(urgent ? 3 : 1);
}

export function copyText(txt, what = 'Text') {
  navigator.clipboard.writeText(txt).then(
    () => toast(what + ' copied.', 'ok'),
    () => toast('Clipboard blocked — select the text manually.', 'warn'),
  );
}
