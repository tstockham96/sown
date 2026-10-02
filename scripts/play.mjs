// End-to-end verification in headless Chromium at 390x844 with real touch input (CDP touch events).
// Usage: npm run build && node scripts/play.mjs   -> shots/*.png, shots/play.mp4, shots/e2e.json
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SHOTS = resolve('shots');
mkdirSync(SHOTS, { recursive: true });
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const report = { steps: [], errors: [], asserts: 0, failed: 0 };
const log = (k, v) => { report.steps.push({ k, v }); console.log('•', k, typeof v === 'string' ? v : JSON.stringify(v)); };
const assert = (c, msg) => { report.asserts++; if (!c) { report.failed++; report.errors.push('ASSERT ' + msg); console.log('✗', msg); } else console.log('✓', msg); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const device = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function player(label, url) {
  const ctx = await browser.newContext(device);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${label} pageerror ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && report.errors.push(`${label} console ${m.text()}`));
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => !!window.__sown);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, t0, label };
}
const touch = (P, type, x, y) => P.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 9, radiusY: 9, force: 1 }] });
const shot = async (P, name) => { await P.page.screenshot({ path: `${SHOTS}/${name}` }); log('screenshot', name); };
const S = (P) => P.page.evaluate(() => ({ mode: window.__sown.mode, busy: window.__sown.busy, score: window.__sown.score, moves: window.__sown.moves, row: window.__sown.row }));
const idle = (P) => P.page.waitForFunction(() => !window.__sown.busy, null, { timeout: 15000 });
const DIRV = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Drag a pot with a finger: press on its centre, slide ~0.7 pot in the direction, (optionally pause), release. */
async function dragSow(P, m, { onHold } = {}) {
  const c = m >> 2, d = m & 3;
  const pc = await P.page.evaluate((c) => window.__sown.potCenter(c), c);
  const jx = (Math.random() - 0.5) * 6, jy = (Math.random() - 0.5) * 6;
  await touch(P, 'touchStart', pc.x + jx, pc.y + jy);
  await P.page.waitForTimeout(50);
  for (let i = 1; i <= 8; i++) {
    const t = (i / 8) * 0.75 * pc.size;
    await touch(P, 'touchMove', pc.x + jx + DIRV[d][0] * t + (Math.random() - 0.5) * 3, pc.y + jy + DIRV[d][1] * t + (Math.random() - 0.5) * 3);
    await P.page.waitForTimeout(16);
  }
  if (onHold) { await P.page.waitForTimeout(250); await onHold(); }
  await touch(P, 'touchEnd', 0, 0);
  await P.page.waitForTimeout(60);
  await idle(P);
}
/** Tap a pot, then tap one of the four arrow buttons. */
async function tapSow(P, m, { onArrows } = {}) {
  const c = m >> 2, d = m & 3;
  const pc = await P.page.evaluate((c) => window.__sown.potCenter(c), c);
  await touch(P, 'touchStart', pc.x, pc.y); await P.page.waitForTimeout(60); await touch(P, 'touchEnd', 0, 0);
  await P.page.waitForSelector(`.dirbtn[data-dir="${d}"]`);
  if (onArrows) await onArrows();
  const b = await P.page.evaluate((d) => { const r = document.querySelector(`.dirbtn[data-dir="${d}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, d);
  await touch(P, 'touchStart', b.x, b.y); await P.page.waitForTimeout(120); await touch(P, 'touchEnd', 0, 0);
  await P.page.waitForTimeout(60);
  await idle(P);
}
const greedyMove = (P) => P.page.evaluate(() => {
  const G = window.__sown; let best = -1, bm = -1;
  for (const m of G.legal()) { const r = G.preview(m); const v = r.points * 100 - r.lost * 2 + Math.random(); if (v > best) { best = v; bm = m; } }
  return bm;
});

// ============================================================ Player A: first open, plays by dragging
const A = await player('A', FILE + '?reset');
const info = await A.page.evaluate(() => ({ n: window.__sown.puzzle.n, best: window.__sown.puzzle.best, bestLine: window.__sown.puzzle.bestLine, board: window.__sown.board }));
log('puzzle', { n: info.n, best: info.best });
await A.page.waitForTimeout(1600);
assert(await A.page.isVisible('[data-testid=example]'), 'first visit shows the one-line example');
const cap = await A.page.textContent('[data-testid=caption]');
assert(/exactly\s*4/.test(cap), 'caption states the rule in one sentence');
await shot(A, '01-start.png');
const firstTouchMs = Date.now() - A.t0;

// Plan: follow the best-known line for 7 scoops, then play greedily (a strong but imperfect human).
const plan = info.bestLine.slice(0, 7);
let decisionLogged = false;
for (let i = 0; i < 10; i++) {
  const m = i < plan.length ? plan[i] : await greedyMove(A);
  const before = await S(A);
  const pv = await A.page.evaluate((m) => window.__sown.preview(m), m);
  await dragSow(A, m, i === 0 ? { onHold: async () => {
    const g = await greedyMove(A);
    const gp = await A.page.evaluate((m) => window.__sown.preview(m), g);
    const ui = await A.page.evaluate(() => ({ gain: document.querySelector('#fly .gain')?.textContent, will: document.querySelectorAll('.pot.will').length, path: document.querySelectorAll('.pot.path').length }));
    log('decision on scoop 1', { chosen: m, chosenPoints: pv.points, chosenHarvest: pv.harvested.length, greedyAlt: g, greedyPoints: gp.points, previewUI: ui });
    assert(ui.path === pv.path.length && ui.will === pv.harvested.length, 'drag preview shows the path and the pots that will hit 4');
    await shot(A, '02-decision.png');
    decisionLogged = true;
  } } : {});
  const after = await S(A);
  assert(after.moves.length === before.moves.length + 1 && after.score === before.score + pv.points, `scoop ${i + 1}: committed, +${pv.points}`);
  if (i === 4) await shot(A, '03-midgame.png');
  if (after.mode !== 'playing') break;
}
assert(decisionLogged, 'decision screenshot taken');
const fin = await S(A);
assert(fin.mode === 'done' && fin.moves.length === 10, 'game ends after 10 scoops');
await A.page.waitForSelector('#sheet-results.open', { timeout: 6000 });
await A.page.waitForTimeout(900);
const finalScore = Number(await A.page.textContent('[data-testid=final-score]'));
assert(finalScore === fin.score, `results show the score (${finalScore})`);
log('A result', { score: fin.score, best: info.best, pct: Math.round((fin.score / info.best) * 100), row: fin.row, secs: Math.round((Date.now() - A.t0) / 1000) });
await shot(A, '04-results.png');

await A.page.click('[data-testid=share]');
await A.page.waitForTimeout(400);
const shareTxt = await A.page.textContent('[data-testid=share-preview]');
log('share text', shareTxt);
assert(shareTxt.includes('https://tstockham96.github.io/sown/#c='), 'share link points at the published URL');
assert(shareTxt.startsWith(`SOWN #${info.n}`) && shareTxt.includes(`${fin.score} / ${info.best}`), 'share text has puzzle number and score');
assert(!/right|left|up|down/i.test(shareTxt.split('\n').slice(0, 3).join(' ')), 'share text is spoiler-free');
assert([...shareTxt.split('\n')[2]].filter((ch) => /[▫🌱🌿🌻]/u.test(ch)).length === 10, 'share has one glyph per scoop');

await A.page.click('[data-testid=challenge]');
await A.page.fill('[data-testid=name]', 'Thomas');
await A.page.click('[data-testid=challenge]');
await A.page.waitForTimeout(400);
const chTxt = await A.page.textContent('[data-testid=share-preview]');
const chLink = chTxt.match(/#c=[\w-]+/)?.[0];
assert(!!chLink, 'challenge link generated');
log('challenge text', chTxt);
await A.page.evaluate(() => { const el = document.querySelector('[data-testid=crowd]'); document.querySelector('#sheet-results').scrollTop = el.offsetTop - 60; });
await A.page.waitForTimeout(300);
await shot(A, '05-results-crowd.png');

await A.page.goto(FILE);
await A.page.waitForFunction(() => !!window.__sown);
await A.page.waitForTimeout(500);
const after = await S(A);
assert(after.mode === 'done' && after.score === fin.score, 'result persists across reload');
await A.page.waitForSelector('#sheet-results.open', { timeout: 5000 });
await A.page.click('#sheet-results [data-close]');
await A.page.waitForTimeout(400);
await A.page.click('[data-testid=stats-btn]');
await A.page.waitForTimeout(500);
const streak = await A.page.evaluate(() => document.querySelector('#sheet-stats .statgrid div:nth-child(3) b').textContent);
assert(streak === '1', 'streak = 1');
await shot(A, '06-stats.png');
await A.page.click('#sheet-stats [data-archive]');
await A.page.waitForTimeout(500);
assert(await A.page.isVisible('[data-testid=paywall]'), 'archive is behind the SOWN+ flag');

// ============================================================ Player B: opens the challenge link, plays with tap + arrows, greedily
const B = await player('B', FILE + '?reset' + chLink);
await B.page.waitForTimeout(700);
const banner = await B.page.textContent('[data-testid=challenge-banner]');
log('friend banner', banner);
assert(/Thomas/.test(banner) && banner.includes(String(fin.score)), 'challenge banner names the sender and score');
await shot(B, '07-challenge.png');
for (let i = 0; i < 10; i++) {
  const m = await greedyMove(B);
  await tapSow(B, m, i === 1 ? { onArrows: () => shot(B, '08-tap-arrows.png') } : {});
  if ((await S(B)).mode !== 'playing') break;
}
const fb = await S(B);
assert(fb.mode === 'done', 'tap+arrow input completes a game');
log('B (greedy) result', { score: fb.score, row: fb.row });
await B.page.waitForSelector('#sheet-results.open', { timeout: 8000 });
await B.page.waitForTimeout(800);
const vs = await B.page.textContent('[data-testid=vs]');
log('friend vs card', vs.replace(/\s+/g, ' '));
assert(/win|wins|heat/i.test(vs), 'friend sees the head-to-head verdict');
await B.page.evaluate(() => { const el = document.querySelector('[data-testid=vs]'); document.querySelector('#sheet-results').scrollTop = el.offsetTop - 80; });
await B.page.waitForTimeout(300);
await shot(B, '09-vs.png');

// ============================================================ Video of a full play (CDP screencast -> ffmpeg)
try {
  const V = await player('V', FILE + '?reset');
  const frameDir = resolve(SHOTS, 'frames');
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });
  const frames = [];
  V.cdp.on('Page.screencastFrame', async (f) => { frames.push({ data: f.data, t: f.metadata.timestamp }); try { await V.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
  await V.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  await V.page.waitForTimeout(1500);
  const line = await V.page.evaluate(() => window.__sown.puzzle.bestLine);
  for (const m of line) { await dragSow(V, m, { onHold: () => V.page.waitForTimeout(350) }); await V.page.waitForTimeout(250); }
  await V.page.waitForTimeout(3200);
  await V.cdp.send('Page.stopScreencast');
  const T0 = frames[0].t, T1 = frames[frames.length - 1].t;
  let k = 0;
  for (let t = T0, out = 0; t <= T1; t += 1 / 30, out++) {
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
    writeFileSync(`${frameDir}/${String(out).padStart(5, '0')}.jpg`, Buffer.from(frames[k].data, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${frameDir}/%05d.jpg`, '-vf', 'scale=390:-2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '24', `${SHOTS}/play.mp4`]);
  log('video', { rawFrames: frames.length, seconds: +(T1 - T0).toFixed(1), out: 'shots/play.mp4', resampledFrames: readdirSync(frameDir).length });
  rmSync(frameDir, { recursive: true, force: true });
} catch (e) { log('video skipped', String(e)); }

report.firstTouchMs = firstTouchMs;
writeFileSync(`${SHOTS}/e2e.json`, JSON.stringify(report, null, 1));
console.log(`\n${report.asserts - report.failed}/${report.asserts} assertions passed; errors: ${report.errors.length}`);
report.errors.forEach((e) => console.log('  !', e));
await browser.close();
process.exit(report.failed || report.errors.length ? 1 : 0);
