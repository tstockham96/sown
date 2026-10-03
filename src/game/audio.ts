/** Synthesized sound (WebAudio, no assets). Starts on the first gesture. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export function setSound(on: boolean) { enabled = on; if (master && ctx) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.02); }
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC(); } catch { return; }
  master = ctx.createGain(); master.gain.value = enabled ? 0.8 : 0; master.connect(ctx.destination);
}
function tone(freq: number, t0: number, dur: number, gain: number, type: OscillatorType = 'sine', glideTo?: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
const hz = (semi: number) => 392 * Math.pow(2, semi / 12);
/** A tile ticking up +1; pitch rises along the line. */
export function tick(i: number) { if (!ctx) return; const t = ctx.currentTime; const f = hz(PENTA[Math.min(PENTA.length - 1, 3 + i * 2)]); tone(f, t, 0.18, 0.12, 'triangle'); tone(f * 2, t, 0.09, 0.04); }
export function lift() { if (!ctx) return; tone(220, ctx.currentTime, 0.12, 0.12, 'sine', 330); }
export function lost() { if (!ctx) return; tone(300, ctx.currentTime, 0.25, 0.08, 'sine', 120); }
/** Clear chime; brighter and fuller for combos. */
export function clear(n: number) {
  if (!ctx) return; const t = ctx.currentTime;
  for (let k = 0; k < n; k++) { const f = hz(PENTA[4 + k * 2]); tone(f, t + k * 0.07, 1.1, 0.16); tone(f * 2, t + k * 0.07, 0.6, 0.05); }
  if (n >= 2) tone(hz(24), t + n * 0.07, 0.9, 0.06);
}
export function thud() { if (!ctx) return; tone(150, ctx.currentTime, 0.14, 0.15, 'triangle', 90); }
export function fanfare() { if (!ctx) return; const t = ctx.currentTime; [0, 4, 7, 12, 16].forEach((s, i) => { tone(hz(s), t + i * 0.09, 1.4, 0.12); tone(hz(s) * 2, t + i * 0.09, 0.7, 0.04); }); }
