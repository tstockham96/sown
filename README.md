# FOURS: a daily number puzzle

**Play:** https://tstockham96.github.io/sown/

**Rule:** Drag a tile to spread its number across the line, +1 each. Any tile that hits exactly 4 clears.

- 5×5 board of tiles valued 0–3, and 10 moves. Everyone gets the same board each day: puzzle #1 = Fri Oct 2, 2026, and the board flips at local midnight.
- Dragging a tile drops it to 0 and adds +1 to each of the next N tiles in that direction, where N is its number. Anything past the edge is lost.
- Points per move: 1 clear = 4, 2 clears = 16, 3 clears = 36. A tile that reaches 4 clears at once, so tiles never go above 3. Every 3 is one away from clearing.
- Your score is compared with the best-known line, which a beam search found. Tiers: Warm-up <50%, Fair 50%, Good 70%, Great 85%, Max ≥100%. You can beat the solver.
- The share is spoiler-free: `FOURS #1 · 84 / 88`, then one square per move (⬛ 0 clears, 🟨 1, 🟧 2, 🟥 3) and the tier.
- A challenge link (`#c=`) carries only your score, the per-move row and your name.

The repo and URL keep the original working title `sown`, so existing links and saved streaks keep working. The internal rule code still uses the original names (`sow`, `harvested`, `scoops`).

## Commands
```
npm run dev        # local dev server
npm test           # vitest: rules, puzzles/par table, share, challenge, stats, crowd, dates
npm run build      # dist/ (static site, base /sown/) + dist-single/index.html (one file, opens from disk)
npm run e2e        # Playwright (playwright-core + system Chrome) touch e2e at 390x844 -> shots/, shots/e2e.json, shots/play.mp4
npx tsx scripts/depth.ts 60     # bot ladder on the real daily puzzles
npx tsx scripts/par.ts 1 50 out.json      # (re)build par entries; scripts/improve.ts tightens best lines
```
URL flags: `?reset` (wipe local data), `?debug&n=12` (open puzzle #12), `#c=<code>` (challenge).

## Layout
- `src/core/`: rules, solver bots, daily puzzle + `par.json` (400 days of board choice and best-known line), share, challenge, stats, crowd estimate, dates
- `src/ui/`: DOM board, drag/tap input, animations, sheets
- `scripts/`: par builder, par tightener, depth audit, e2e

## Deploy
Pushing to `main` runs `.github/workflows/pages.yml`: `npm ci`, then `npm run build` with `VITE_BASE=/sown/` and `VITE_PUBLIC_URL=https://tstockham96.github.io/sown/`, then deploys `dist/` to GitHub Pages.
