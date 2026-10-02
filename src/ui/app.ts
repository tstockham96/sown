import { puzzleFor, Puzzle, GEN } from '../core/puzzle';
import { puzzleNumberFor, formatPuzzleDate, msUntilLocalMidnight, formatCountdown } from '../core/date';
import { SIZE, CELLS, DIRS, sow, mv, cellOf, dirOf, replay, Move, Dir, legalMoves, pointsFor } from '../core/rules';
import { crowdFor, percentile } from '../core/crowd';
import { shareText, glyph, rowText, tierFor, tierIndex, TIERS } from '../core/share';
import { encodeChallenge, decodeChallenge, Challenge } from '../core/challenge';
import { computeStats } from '../core/stats';
import * as sfx from '../game/audio';
import { buzz, setHaptics } from '../game/haptics';
import { load, save, reset } from '../state/storage';
import { CONFIG, baseUrl } from '../config';
import { copyText, nativeShare } from './clipboard';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Where seeds sit inside a pot, as % of the pot, for 1..4 seeds. */
const SEED_POS: [number, number][][] = [[], [[50, 50]], [[37, 40], [63, 60]], [[50, 31], [33, 63], [67, 63]], [[35, 35], [65, 35], [35, 65], [65, 65]]];
const ARROWS = ['→', '←', '↓', '↑'];
type Mode = 'playing' | 'done' | 'replay';

export function startApp() {
  const params = new URLSearchParams(location.search);
  if (params.has('reset')) reset();
  const store = load();
  sfx.setSound(store.sound);
  setHaptics(store.haptics);
  const today = puzzleNumberFor();
  const hashC = location.hash.match(/c=([\w-]+)/)?.[1];
  let challenge: Challenge | null = hashC ? decodeChallenge(hashC) : null;
  if (challenge && (challenge.n < 1 || challenge.n > today)) challenge = null;
  const debugN = params.has('debug') && params.get('n') ? Number(params.get('n')) : 0;

  const field = $('#field');
  const fly = $('#fly');
  const frame = $('#frame');
  const pots: HTMLDivElement[] = [];
  for (let i = 0; i < CELLS; i++) {
    const d = document.createElement('div');
    d.className = 'pot';
    d.dataset.i = String(i);
    d.innerHTML = '<div class="seeds"></div><span class="num"></span>';
    field.appendChild(d);
    pots.push(d);
  }

  let p: Puzzle;
  let board: number[] = [];
  let moves: Move[] = [];
  let row: number[] = [];
  let score = 0;
  let mode: Mode = 'playing';
  let busy = false;
  let startedAt = 0;
  let elapsedBefore = 0;
  let finishedSecs = 0;
  const secs = () => finishedSecs || (elapsedBefore + (startedAt ? Date.now() - startedAt : 0)) / 1000;

  // ------------------------------------------------------------------ layout
  let side = 340, gap = 14, cell = 52;
  function layout() {
    side = Math.floor(Math.min(window.innerWidth - 24 - 18, 430, window.innerHeight * 0.5));
    gap = Math.round(side * 0.045);
    cell = (side - gap * 6) / SIZE;
    field.style.width = field.style.height = side + 'px';
    field.style.setProperty('--gap', gap + 'px');
    fly.style.width = fly.style.height = side + 'px';
    frame.style.setProperty('--cell', cell + 'px');
  }
  const center = (c: number): [number, number] => [gap + (c % SIZE) * (cell + gap) + cell / 2, gap + Math.floor(c / SIZE) * (cell + gap) + cell / 2];

  // ------------------------------------------------------------------ pots
  function setPot(i: number, v: number, ghost = 0) {
    const el = pots[i];
    const total = Math.min(4, v + ghost);
    el.querySelector('.seeds')!.innerHTML = SEED_POS[total].map(([x, y], k) => `<span class="seed${k >= v ? ' ghost' : ''}" style="left:${x}%;top:${y}%"></span>`).join('');
    el.querySelector('.num')!.textContent = String(v);
    el.classList.toggle('empty', v === 0 && !ghost);
    el.classList.toggle('ripe', v === 3 && !ghost);
  }
  function renderBoard(b: number[]) { for (let i = 0; i < CELLS; i++) setPot(i, b[i]); }

  // ------------------------------------------------------------------ lifecycle
  function loadPuzzle(n: number) {
    p = puzzleFor(n);
    const done = store.results[n];
    const prog = store.progress;
    moves = [];
    if (done) moves = done.moves ? done.moves.slice() : [];
    else if (prog && prog.n === n && prog.gen === GEN) { moves = prog.moves.slice(); elapsedBefore = prog.elapsed; }
    const rp = replay(p.board, moves);
    board = rp.board; row = rp.row; score = rp.score;
    startedAt = 0; finishedSecs = 0;
    mode = done ? 'done' : 'playing';
    if (done) { row = done.row; score = done.score; finishedSecs = done.secs || 1; }
    renderBoard(board);
    $('[data-testid=sub]').textContent = `#${n} · ${formatPuzzleDate(n)}`;
    $('[data-testid=title-card]').classList.add('hidden');
    frame.classList.remove('win');
    clearSelection();
    if (mode === 'done') {
      showTitle();
      $('[data-testid=cta-results]').classList.remove('hidden');
      setTimeout(() => openSheet('results'), 650);
    } else $('[data-testid=cta-results]').classList.add('hidden');
    renderExample();
    renderBanner();
    updateTracker();
    caption();
  }

  function persist() {
    if (mode !== 'playing') return;
    store.progress = { n: p.n, gen: GEN, moves: moves.slice(), startedAt, elapsed: secs() * 1000 };
    save();
  }
  function finish() {
    mode = 'done';
    finishedSecs = secs();
    if (!store.results[p.n]) store.results[p.n] = { score, best: p.best, row: row.slice(), moves: moves.slice(), secs: Math.round(finishedSecs), at: Date.now() };
    if (store.progress?.n === p.n) delete store.progress;
    save();
    const t = tierIndex(score, p.best);
    if (t >= 2) { sfx.fanfare(); buzz([20, 60, 20, 60, 40]); }
    frame.classList.remove('win'); void frame.offsetWidth; frame.classList.add('win');
    showTitle();
    $('[data-testid=cta-results]').classList.remove('hidden');
    updateTracker();
    caption();
    setTimeout(() => openSheet('results'), 1500);
  }
  function showTitle() {
    const tc = $('[data-testid=title-card]');
    const res = store.results[p.n];
    const s = res ? res.score : score;
    tc.querySelector('small')!.textContent = `HARVEST IN · ${s} SEEDS`;
    tc.querySelector('b')!.textContent = tierFor(s, p.best).name;
    tc.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ preview & input
  let drag: null | { id: number; cell: number; x0: number; y0: number; dir: Dir | null } = null;
  let selected = -1;
  let previewMove: Move | null = null;

  function clearPreview() {
    previewMove = null;
    for (const el of pots) { el.classList.remove('origin', 'path', 'will'); el.querySelector('.four')?.remove(); }
    fly.querySelectorAll('.arrow,.gain,.lostchip').forEach((e) => e.remove());
    renderBoard(board);
  }
  function showPreview(m: Move) {
    if (previewMove === m) return;
    clearPreview();
    previewMove = m;
    const c = cellOf(m), d = dirOf(m), r = sow(board, m);
    pots[c].classList.add('origin');
    setPot(c, board[c]);
    for (const q of r.path) {
      pots[q].classList.add('path');
      setPot(q, board[q], 1);
      if (r.harvested.includes(q)) { pots[q].classList.add('will'); pots[q].insertAdjacentHTML('beforeend', '<span class="four">4</span>'); }
    }
    const [x0, y0] = center(c);
    const steps = r.path.length + (r.lost ? 0.62 : 0);
    const len = Math.max(steps * (cell + gap) - cell * 0.5, cell * 0.35);
    const ang = Math.atan2(DIRS[d][1], DIRS[d][0]);
    const a = document.createElement('div');
    a.className = 'arrow';
    a.style.left = x0 + Math.cos(ang) * cell * 0.3 + 'px';
    a.style.top = y0 + Math.sin(ang) * cell * 0.3 - 3 + 'px';
    a.style.width = len + 'px';
    a.style.transform = `rotate(${ang}rad)`;
    fly.appendChild(a);
    if (r.lost) {
      const lc = document.createElement('div');
      lc.className = 'lostchip';
      const e = (r.path.length + 0.75) * (cell + gap);
      lc.style.left = x0 + Math.cos(ang) * e + 'px';
      lc.style.top = y0 + Math.sin(ang) * e + 'px';
      lc.textContent = `−${r.lost}`;
      fly.appendChild(lc);
    }
    const g = document.createElement('div');
    g.className = 'gain' + (r.points ? '' : ' zero');
    g.textContent = r.points ? `+${r.points}${r.harvested.length > 1 ? ` · ${r.harvested.length} pots` : ''}` : 'no harvest';
    const gy = d === 3 ? y0 + cell * 0.95 : y0 - cell * 0.85;
    g.style.left = Math.min(side - 50, Math.max(50, x0)) + 'px';
    g.style.top = Math.max(12, gy) + 'px';
    fly.appendChild(g);
  }
  function clearSelection() {
    selected = -1;
    pots.forEach((el) => el.classList.remove('selected'));
    fly.querySelectorAll('.dirbtn').forEach((e) => e.remove());
    clearPreview();
  }
  function select(c: number) {
    clearSelection();
    selected = c;
    pots[c].classList.add('selected');
    const [x, y] = center(c);
    DIRS.forEach(([dx, dy], d) => {
      const b = document.createElement('button');
      b.className = 'dirbtn';
      b.dataset.dir = String(d);
      b.textContent = ARROWS[d];
      const off = cell * 0.5 + gap * 0.5 + 14;
      b.style.left = Math.min(side + 4, Math.max(-4, x + dx * off)) + 'px';
      b.style.top = Math.min(side + 4, Math.max(-4, y + dy * off)) + 'px';
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); showPreview(mv(c, d as Dir)); });
      b.addEventListener('pointerup', (e) => { e.stopPropagation(); if (previewMove === mv(c, d as Dir)) { const m = previewMove; clearSelection(); commit(m); } });
      b.addEventListener('pointerleave', () => { if (previewMove === mv(c, d as Dir)) clearPreview(); });
      fly.appendChild(b);
    });
    toast('Choose a direction', 'M');
  }
  const potAt = (e: PointerEvent): number => {
    const el = (e.target as HTMLElement).closest('.pot') as HTMLElement | null;
    return el && el.parentElement === field ? Number(el.dataset.i) : -1;
  };
  field.addEventListener('pointerdown', (e) => {
    sfx.unlockAudio();
    if (mode !== 'playing' || busy || drag) return;
    const c = potAt(e);
    if (c < 0) return clearSelection();
    e.preventDefault();
    if (!startedAt) startedAt = Date.now();
    if (board[c] === 0) {
      pots[c].classList.remove('nope'); void pots[c].offsetWidth; pots[c].classList.add('nope');
      sfx.thud(); buzz(10);
      toast('That pot is empty — pick one with seeds', 'M');
      clearSelection();
      return;
    }
    field.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, cell: c, x0: e.clientX, y0: e.clientY, dir: null };
    field.classList.add('dragging');
    if (selected !== c) { pots.forEach((el) => el.classList.remove('selected')); fly.querySelectorAll('.dirbtn').forEach((x) => x.remove()); selected = -1; }
    pots[c].classList.add('origin');
    hideExample();
  });
  field.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    const dist = Math.hypot(dx, dy);
    if (dist < cell * 0.28) { if (drag.dir !== null) { drag.dir = null; clearPreview(); pots[drag.cell].classList.add('origin'); } return; }
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 1) : dy > 0 ? 2 : 3;
    if (d !== drag.dir) { drag.dir = d; showPreview(mv(drag.cell, d)); buzz(4); }
  });
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dd = drag;
    drag = null;
    field.classList.remove('dragging');
    if (dd.dir === null) { clearPreview(); select(dd.cell); return; }
    const m = mv(dd.cell, dd.dir);
    clearSelection();
    commit(m);
  };
  field.addEventListener('pointerup', up);
  field.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { drag = null; field.classList.remove('dragging'); clearPreview(); } });

  // ------------------------------------------------------------------ the sow animation
  async function animateSow(m: Move, speed = 1) {
    const c = cellOf(m), d = dirOf(m), r = sow(board, m);
    const n = board[c];
    const live = board.slice();
    live[c] = 0;
    setPot(c, 0);
    sfx.scoop();
    const [x0, y0] = center(c);
    const ss = cell * 0.23;
    const hops: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const q = r.path[i];
      const lostSeed = q === undefined;
      const [tx, ty] = lostSeed ? [x0 + DIRS[d][0] * (r.path.length + 1 + (i - r.path.length) * 0.4) * (cell + gap), y0 + DIRS[d][1] * (r.path.length + 1 + (i - r.path.length) * 0.4) * (cell + gap)] : center(q);
      const s = document.createElement('span');
      s.className = 'seed';
      fly.appendChild(s);
      const delay = (i * 125) / speed, dur = 300 / speed;
      const lift = cell * (0.55 + 0.12 * i);
      const kf = [
        { transform: `translate(${x0 - ss / 2}px, ${y0 - ss / 2}px) scale(1)`, opacity: 1 },
        { transform: `translate(${(x0 + tx) / 2 - ss / 2}px, ${(y0 + ty) / 2 - ss / 2 - lift}px) scale(1.25)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${tx - ss / 2}px, ${ty - ss / 2}px) scale(1)`, opacity: lostSeed ? 0 : 1 },
      ];
      s.style.transform = kf[0].transform;
      hops.push(new Promise<void>((res) => {
        const a = s.animate(kf, { duration: dur, delay, easing: 'cubic-bezier(.35,.1,.45,1)', fill: 'both' });
        a.onfinish = () => {
          s.remove();
          if (lostSeed) { if (i === r.path.length) sfx.lost(); }
          else {
            live[q]++;
            setPot(q, live[q]);
            pots[q].classList.remove('land'); void pots[q].offsetWidth; pots[q].classList.add('land');
            sfx.plink(i);
            buzz(5);
          }
          res();
        };
      }));
    }
    await Promise.all(hops);
    if (r.harvested.length) {
      await sleep(120 / speed);
      for (const q of r.harvested) {
        const [hx, hy] = center(q);
        pots[q].classList.remove('harvest'); void pots[q].offsetWidth; pots[q].classList.add('harvest');
        const ring = document.createElement('div'); ring.className = 'ring'; ring.style.left = hx + 'px'; ring.style.top = hy + 'px'; fly.appendChild(ring);
        const bl = document.createElement('div'); bl.className = 'bloom'; bl.textContent = r.harvested.length >= 3 ? '🌻' : r.harvested.length === 2 ? '🌿' : '🌱'; bl.style.left = hx + 'px'; bl.style.top = hy + 'px'; fly.appendChild(bl);
        setTimeout(() => { ring.remove(); bl.remove(); }, 950);
      }
      sfx.harvest(r.harvested.length);
      buzz(r.harvested.length > 1 ? [18, 40, 18, 40, 30] : 16);
      await sleep(260 / speed);
      for (const q of r.harvested) setPot(q, 0);
    }
    return r;
  }

  async function commit(m: Move) {
    if (busy || mode !== 'playing') return;
    busy = true;
    hideExample();
    const r = await animateSow(m);
    board = r.board;
    moves.push(m);
    row.push(r.harvested.length);
    score += r.points;
    if (!store.seenHint) { store.seenHint = true; save(); }
    const k = r.harvested.length;
    if (k === 0) toast(r.lost ? `No harvest — ${r.lost} seed${r.lost > 1 ? 's' : ''} lost off the edge` : 'No harvest this scoop', 'M');
    else toast(k === 1 ? `+${r.points} · harvested!` : `+${r.points} · ${k === 2 ? 'double' : 'TRIPLE'} harvest! (${k * 4} seeds × ${k})`, 'L');
    persist();
    updateTracker();
    caption();
    busy = false;
    if (moves.length >= p.scoops) finish();
  }

  // ------------------------------------------------------------------ replay of the best-known line
  async function runBest() {
    if (busy) return;
    busy = true;
    const prevMode = mode;
    mode = 'replay';
    const saved = { board, row, score };
    board = p.board.slice();
    renderBoard(board);
    $('[data-testid=title-card]').classList.add('hidden');
    let s = 0;
    const r2: number[] = [];
    $('[data-testid=count]').innerHTML = `0 <small>BEST-KNOWN LINE</small>`;
    await sleep(500);
    for (const m of p.bestLine) {
      showPreview(m);
      await sleep(650);
      clearPreview();
      const r = await animateSow(m, 1.3);
      board = r.board; s += r.points; r2.push(r.harvested.length);
      $('[data-testid=count]').innerHTML = `${s} <small>BEST-KNOWN LINE</small>`;
      renderPips(r2, true);
      await sleep(250);
    }
    await sleep(700);
    board = saved.board; row = saved.row; score = saved.score;
    mode = prevMode;
    busy = false;
    renderBoard(board);
    updateTracker();
    showTitle();
    setTimeout(() => openSheet('results'), 400);
  }

  // ------------------------------------------------------------------ HUD
  function renderPips(r: number[], bestLine = false) {
    const pips = $('[data-testid=pips]');
    pips.innerHTML = '';
    for (let i = 0; i < p.scoops; i++) {
      const d = document.createElement('div');
      if (i < r.length) { d.className = 'pip g'; d.textContent = glyph(r[i]); }
      else d.className = 'pip' + (i === r.length && !bestLine && mode === 'playing' ? ' next' : '');
      pips.appendChild(d);
    }
  }
  function updateTracker() {
    renderPips(row);
    $('[data-testid=count]').innerHTML = `<span data-testid="score">${score}</span> <small>BEST ${p.best}</small>`;
  }
  function caption() {
    const c = $('[data-testid=caption]');
    const left = p.scoops - moves.length;
    if (mode === 'done') c.innerHTML = `Harvested <b>${store.results[p.n]?.score ?? score}</b> seeds. A new field at midnight.`;
    else if (moves.length === 0) c.innerHTML = '<b>Drag a pot</b> to sow its seeds one per pot in a straight line. Every pot that hits exactly <b>4</b> is harvested.';
    else c.innerHTML = `<b>${left}</b> scoop${left === 1 ? '' : 's'} left · 1 pot <b>4</b> · 2 pots <b>16</b> · 3 pots <b>36</b>`;
  }
  let toastTimer = 0;
  function toast(msg: string, cls: string) {
    const t = $('[data-testid=toast]');
    t.textContent = msg;
    t.className = `toast show ${cls}`;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove('show'), 2400);
  }
  function renderBanner() {
    const b = $('[data-testid=challenge-banner]');
    if (!challenge || challenge.n !== p.n) return b.classList.add('hidden');
    b.innerHTML = `🌱 <b>${esc(challenge.by || 'A friend')}</b> harvested <b>${challenge.score}</b> seeds on #${challenge.n}. Can you beat that?`;
    b.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ the one-line example (first visit + help)
  let exTimer = 0;
  function exampleHTML(): string {
    return `<div class="ex-row" data-ex>${[2, 3, 3, 1].map(() => '<div class="pot"><div class="seeds"></div></div>').join('')}</div>`;
  }
  function runExample(root: HTMLElement) {
    const ps = [...root.querySelectorAll<HTMLElement>('.pot')];
    const set = (i: number, v: number, cls = '') => {
      ps[i].className = 'pot ' + cls + (v === 3 && !cls ? ' ripe' : '') + (v === 0 ? ' empty' : '');
      ps[i].querySelector('.seeds')!.innerHTML = SEED_POS[v].map(([x, y]) => `<span class="seed" style="left:${x}%;top:${y}%"></span>`).join('');
    };
    const steps: [number, () => void][] = [
      [0, () => { set(0, 2); set(1, 3); set(2, 3); set(3, 1); }],
      [900, () => set(0, 2, 'origin')],
      [1350, () => { set(0, 0); set(1, 4, 'will'); }],
      [1650, () => set(2, 4, 'will')],
      [2150, () => { set(1, 0, 'harvest'); set(2, 0, 'harvest'); }],
      [3600, () => {}],
    ];
    let t0 = performance.now();
    const tick = () => {
      if (!root.isConnected || root.closest('.hidden')) return;
      const t = performance.now() - t0;
      for (const [at, f] of steps) if (t >= at && !(f as unknown as { done?: boolean }).done) { f(); (f as unknown as { done?: boolean }).done = true; }
      if (t > 3600) { t0 = performance.now(); steps.forEach(([, f]) => ((f as unknown as { done?: boolean }).done = false)); }
      exTimer = window.setTimeout(tick, 60);
    };
    tick();
  }
  function renderExample() {
    const ex = $('[data-testid=example]');
    if (store.seenHint || mode !== 'playing' || moves.length) return ex.classList.add('hidden');
    ex.innerHTML = `${exampleHTML()}<div class="ex-text"><b>Example:</b> sow 2 seeds right → both 3s hit <b>4</b> → 2 pots harvested = <b>+16</b></div><button class="ex-x" aria-label="Hide example">✕</button>`;
    ex.classList.remove('hidden');
    ex.querySelector('.ex-x')!.addEventListener('click', hideExample);
    clearTimeout(exTimer);
    runExample(ex);
  }
  function hideExample() { $('[data-testid=example]').classList.add('hidden'); }

  // ------------------------------------------------------------------ sheets
  const sheets = ['results', 'stats', 'help', 'archive'] as const;
  type SheetName = (typeof sheets)[number];
  function openSheet(name: SheetName) {
    if (name === 'results') renderResults();
    if (name === 'stats') renderStats();
    if (name === 'help') renderHelp();
    if (name === 'archive') renderArchive();
    for (const s of sheets) { const el = $(`#sheet-${s}`); el.classList.toggle('open', s === name); el.setAttribute('aria-hidden', String(s !== name)); }
    $('#scrim').classList.remove('hidden');
  }
  function closeSheets() { for (const s of sheets) $(`#sheet-${s}`).classList.remove('open'); $('#scrim').classList.add('hidden'); }
  $('#scrim').addEventListener('click', closeSheets);
  $('#btn-help').addEventListener('click', () => openSheet('help'));
  $('#btn-stats').addEventListener('click', () => openSheet('stats'));
  $('#btn-results').addEventListener('click', () => openSheet('results'));

  function statsBlock(): string {
    const st = computeStats(store.results, today);
    const max = Math.max(1, ...st.dist);
    const res = store.results[p.n];
    const mine = res ? tierIndex(res.score, res.best) : -1;
    return `<div class="card"><h3>Your stats</h3>
      <div class="statgrid"><div><b>${st.played}</b><small>Played</small></div><div><b>${st.avgPct}%</b><small>Avg of best</small></div><div><b>${st.streak}</b><small>Streak</small></div><div><b>${st.maxStreak}</b><small>Best streak</small></div></div>
      <div class="hist" style="margin-top:12px">${TIERS.map((t, i) => `<div class="bar${i === mine ? ' me' : ''}"><span>${t.emoji}</span><i style="width:${(st.dist[i] / max) * 100}%"></i><span>${st.dist[i]}</span></div>`).join('')}</div></div>`;
  }
  function renderResults() {
    const el = $('#sheet-results');
    const res = store.results[p.n];
    const s = res ? res.score : score;
    const r = res ? res.row : row;
    const t = tierFor(s, p.best);
    const crowd = crowdFor(p);
    const pct = percentile(crowd, s);
    const mine = tierIndex(s, p.best);
    const max = Math.max(...crowd.tiers);
    const streak = computeStats(store.results, today).streak;
    const pots = r.reduce((a, b) => a + b, 0);
    let vs = '';
    if (challenge && challenge.n === p.n) {
      const verdict = s > challenge.score ? 'You win! 🏆' : s < challenge.score ? `${esc(challenge.by || 'They')} wins this one` : 'Dead heat 🤝';
      vs = `<div class="card" data-testid="vs"><h3>Challenge</h3><div class="vs"><div><b>${s}</b><small>You</small><div class="r">${rowText(r)}</div></div><div>vs</div><div><b>${challenge.score}</b><small>${esc(challenge.by || 'Friend')}</small><div class="r">${rowText(challenge.row)}</div></div></div><p class="big-line" style="text-align:center;margin:10px 0 0"><b>${verdict}</b></p></div>`;
    }
    el.innerHTML = `<div class="grab"></div><button class="icon x" data-close>✕</button>
      <div class="kicker">HARVEST · #${p.n} · ${formatPuzzleDate(p.n)}</div>
      <div class="pic-title">${t.name} ${t.emoji}</div>
      <div class="score"><div><b data-testid="final-score" class="${s >= p.best ? 'gold' : ''}">${s}</b><small>Seeds</small></div><div><b>${p.best}</b><small>Best known</small></div><div><b>${pots}</b><small>Pots</small></div></div>
      <span class="badge" data-testid="badge">${Math.round((s / Math.max(1, p.best)) * 100)}% of the best line</span>
      <div class="row" data-testid="row">${rowText(r)}</div>
      <div class="actions"><button class="btn primary" data-testid="share">Share</button><button class="btn ghost" data-testid="challenge">Challenge</button></div>
      <input class="name-in hidden" data-testid="name" maxlength="16" placeholder="Your name (shown to your friend)" value="${esc(store.name)}" />
      <pre class="hidden" data-testid="share-preview"></pre>
      ${vs}
      <div class="card" data-testid="crowd"><h3>Today’s players <span style="opacity:.6">(est.)</span></h3>
        <p class="big-line">You out-harvested <b data-testid="pct">${pct}%</b> of players.</p>
        <div class="hist">${TIERS.map((tt, i) => `<div class="bar${i === mine ? ' me' : ''}"><span>${tt.emoji}</span><i style="width:${(crowd.tiers[i] / max) * 100}%;animation-delay:${i * 60}ms"></i><span>${Math.round((crowd.tiers[i] / crowd.n) * 100)}%</span></div>`).join('')}</div></div>
      <button class="btn ghost wide" data-testid="best">▶ Watch the best-known harvest (${p.best})</button>
      ${statsBlock()}
      <div class="countdown">Next field in <b data-testid="countdown">${formatCountdown(msUntilLocalMidnight())}</b></div>
      ${CONFIG.features.ads && !store.plus ? '<div class="ad-slot" data-testid="ad-slot">Advertisement</div>' : ''}
      ${CONFIG.features.premium ? `<div class="card plus" data-testid="plus"><b>SOWN+</b> · every past field, practice fields, no ads. <button class="btn ghost" style="margin-top:10px;width:100%" data-archive>Open the archive</button></div>` : ''}
      <div class="foot">streak ${streak} · grown in the browser</div>`;
    el.querySelector('[data-close]')!.addEventListener('click', closeSheets);
    el.querySelector('[data-archive]')?.addEventListener('click', () => openSheet('archive'));
    el.querySelector('[data-testid=best]')!.addEventListener('click', () => { closeSheets(); setTimeout(runBest, 350); });
    const link = () => `${baseUrl()}#c=${encodeChallenge({ n: p.n, score: s, row: r, by: store.name })}`;
    el.querySelector('[data-testid=share]')!.addEventListener('click', async () => {
      const text = shareText(p, s, r, link(), streak);
      el.querySelector('[data-testid=share-preview]')!.textContent = text;
      const ok = await nativeShare(text);
      if (ok === false) toast((await copyText(text)) ? 'Result copied — paste it anywhere' : 'Copy failed', 'L');
    });
    const nameIn = el.querySelector('[data-testid=name]') as HTMLInputElement;
    el.querySelector('[data-testid=challenge]')!.addEventListener('click', async () => {
      if (nameIn.classList.contains('hidden') && !store.name) { nameIn.classList.remove('hidden'); nameIn.focus(); return; }
      store.name = nameIn.value.trim().slice(0, 16);
      save();
      const text = `I harvested ${s} seeds on SOWN #${p.n}. Same field, ten scoops — beat me 🌱\n${link()}`;
      el.querySelector('[data-testid=share-preview]')!.textContent = text;
      const ok = await nativeShare(text);
      if (ok === false) toast((await copyText(text)) ? 'Challenge link copied' : 'Copy failed', 'L');
    });
    nameIn.addEventListener('change', () => { store.name = nameIn.value.trim().slice(0, 16); save(); });
    const cd = el.querySelector('[data-testid=countdown]')!;
    const iv = setInterval(() => { if (!el.classList.contains('open')) return clearInterval(iv); cd.textContent = formatCountdown(msUntilLocalMidnight()); }, 1000);
  }
  function renderStats() {
    const el = $('#sheet-stats');
    el.innerHTML = `<div class="grab"></div><button class="icon x" data-close>✕</button><div class="kicker">STATS</div>${statsBlock()}
      <div class="card"><div class="toggle"><span>Sound</span><button class="switch ${store.sound ? 'on' : ''}" data-t="sound"></button></div>
      <div class="toggle"><span>Haptics</span><button class="switch ${store.haptics ? 'on' : ''}" data-t="haptics"></button></div></div>
      ${CONFIG.features.premium ? '<button class="btn ghost wide" data-archive>Archive</button>' : ''}`;
    el.querySelector('[data-close]')!.addEventListener('click', closeSheets);
    el.querySelector('[data-archive]')?.addEventListener('click', () => openSheet('archive'));
    el.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.t as 'sound' | 'haptics';
      store[k] = !store[k]; save(); b.classList.toggle('on', store[k]); sfx.setSound(store.sound); setHaptics(store.haptics);
    }));
  }
  function renderHelp() {
    const el = $('#sheet-help');
    el.innerHTML = `<div class="grab"></div><button class="icon x" data-close>✕</button><div class="kicker">HOW TO PLAY</div>
      <div class="pic-title" style="font-size:24px">Sow it. Harvest the fours.</div>
      <ul class="help-list">
        <li><span class="n">1</span><span><b>Drag any pot</b> right, left, up or down. All its seeds are sown <b>one per pot</b> along that line. Seeds that run off the edge are lost.</span></li>
        <li><span class="n">2</span><span>Every pot that reaches <b>exactly 4</b> is harvested. Pots never hold more than 3, so a pot with 3 is <b>ripe</b> (gold ring).</span></li>
        <li><span class="n">3</span><span>Harvest several pots in one scoop to multiply: <b>1 pot = 4</b>, <b>2 pots = 16</b>, <b>3 pots = 36</b>.</span></li>
        <li><span class="n">4</span><span>You get <b>10 scoops</b>. Everyone gets the same field each day. Line up ripe pots, then cash them in together.</span></li>
      </ul>
      <div class="card"><div class="help-ex example" style="background:none;border:0;padding:0;margin:0 auto">${exampleHTML()}</div><p class="caption" style="margin-top:8px">2 seeds sown right: both 3s hit 4 → 2 pots × 8 seeds = <b>+16</b></p></div>
      <div class="card legend"><span>🌱 1 pot</span><span>🌿 2 pots</span><span>🌻 3 pots</span><span>▫️ no harvest</span></div>
      <p class="caption">“Best known” is the best line our solver found. Beat it for a 🏆 Bumper crop.</p>`;
    el.querySelector('[data-close]')!.addEventListener('click', closeSheets);
    runExample(el.querySelector('[data-ex]')!.parentElement as HTMLElement);
  }
  function renderArchive() {
    const el = $('#sheet-archive');
    const unlocked = store.plus || !CONFIG.features.premium;
    const items: string[] = [];
    for (let n = today; n >= Math.max(1, today - 29); n--) {
      const r = store.results[n];
      items.push(`<button data-n="${n}" class="${unlocked || n === today ? '' : 'locked'}">#${n} ${r ? `${glyph(Math.min(3, Math.round((r.score / Math.max(1, r.best)) * 3)))} ${r.score}` : ''}<small>${formatPuzzleDate(n)}</small></button>`);
    }
    el.innerHTML = `<div class="grab"></div><button class="icon x" data-close>✕</button><div class="kicker">ARCHIVE</div>
      ${unlocked ? '' : `<div class="card plus" data-testid="paywall"><b>SOWN+</b> unlocks every past field. <button class="btn primary" style="width:100%;margin-top:10px" data-unlock>Unlock (demo)</button></div>`}
      <div class="arch">${items.join('')}</div>`;
    el.querySelector('[data-close]')!.addEventListener('click', closeSheets);
    el.querySelector('[data-unlock]')?.addEventListener('click', () => { store.plus = true; save(); renderArchive(); });
    el.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.n);
      if (!(unlocked || n === today)) return toast('Past fields are part of SOWN+', 'M');
      closeSheets();
      loadPuzzle(n);
    }));
  }

  // ------------------------------------------------------------------ boot
  layout();
  window.addEventListener('resize', () => { layout(); clearPreview(); });
  loadPuzzle(debugN || challenge?.n || today);

  (window as unknown as { __sown: unknown }).__sown = {
    get mode() { return mode; },
    get busy() { return busy; },
    get puzzle() { return p; },
    get board() { return board.slice(); },
    get moves() { return moves.slice(); },
    get row() { return row.slice(); },
    get score() { return score; },
    legal: () => legalMoves(board),
    preview: (m: Move) => sow(board, m),
    points: pointsFor,
    /** Client (viewport) coordinates of a pot's centre. */
    potCenter: (c: number) => { const r = pots[c].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width }; },
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
