# SOWN: a daily sowing puzzle

**Play:** https://tstockham96.github.io/sown/

**Rule (one sentence):** Drag any pot to sow its seeds one per pot in a straight line; every pot that hits exactly 4 is harvested.

- 5×5 field, 10 scoops, the same field for everyone each day (puzzle #1 = Fri Oct 2, 2026; it flips at local midnight).
- Points per scoop: 1 pot harvested = 4, 2 pots = 16, 3 pots = 36. Seeds sown off the edge are lost.
- A pot that reaches 4 is emptied at once, so pots only ever hold 0–3. A 3 is "ripe" (gold ring).
- Your score is compared with the best-known line, found by beam search. Tiers: Thin 🥀 <50%, Fair 🌾 50%, Good 🧺 70%, Golden ✨ 85%, Bumper crop 🏆 ≥100%. You can beat the solver.
- Share is spoiler-free: one glyph per scoop (▫️ none, 🌱 1 pot, 🌿 2, 🌻 3).
- A challenge link (`#c=`) carries only your score, row and name.

## Commands
```
npm run dev        # local dev server
npm test           # vitest: rules, puzzles/par table, share, challenge, stats, crowd, dates
npm run build      # dist/ (static site, base /sown/) + dist-single/index.html (one file, opens from disk)
npm run e2e        # Playwright (playwright-core + system Chrome) touch e2e at 390x844 -> shots/, shots/e2e.json, shots/play.mp4
npx tsx scripts/depth.ts 60     # bot ladder on the real daily seeds
npx tsx scripts/par.ts 1 50 out.json      # (re)build par entries; scripts/improve.ts tightens best lines
```
URL flags: `?reset` (wipe local data), `?debug&n=12` (open puzzle #12), `#c=<code>` (challenge).

## Layout
- `src/core/`: rules, solver bots, daily puzzle + `par.json` (400 days of board choice and best-known line), share, challenge, stats, crowd estimate, dates
- `src/ui/`: DOM board, drag/tap input, animations, sheets
- `scripts/`: par builder, par tightener, depth audit, e2e

## Deploy
Pushing to `main` runs `.github/workflows/pages.yml`: `npm ci`, `npm run build` with `VITE_BASE=/sown/` and `VITE_PUBLIC_URL=https://tstockham96.github.io/sown/`, then deploys `dist/` to GitHub Pages.
