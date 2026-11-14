---
name: run
description: Launch MMA Master locally in the browser so a change can be seen working, not only tested. Use when asked to run, start, preview, play or screenshot the game. Local only — there is no backend.
---

# Run (local)

MMA Master v1 is offline: no Supabase, no Docker. Running it is the Vite dev server.

## Preconditions
- Node 22 and pnpm (`corepack enable` picks the pinned version from `package.json`).
- Dependencies installed: `pnpm install --frozen-lockfile`.

## Steps
1. `pnpm dev` in the background. The game is at `http://localhost:5173`.
2. Open it in the built-in browser or Chrome tools if available and exercise the change. Size the window
   landscape (for example 960×540, or 844×390 for a phone) — portrait shows the "turn your device" screen.
3. Keyboard on the web build: arrows or WASD move, Space guards, J punch, K kick, U elbow, I knee,
   E energy drink, Esc pauses.
4. To watch a level without playing it, open `http://localhost:5173/?demo=<townId>` — the scripted bot plays
   that town and nothing is saved. Town ids are in `src/content/towns/stLouis.ts` (`fenton`, `chesterfield`,
   `kirkwood`, `st-charles`, `east-st-louis`, `downtown`, `soulard`, `the-hill`, `central-west-end`,
   `st-louis`).
5. For hitboxes, state names and level skip, turn on **Settings → Debug overlay**; the fight screen then
   shows "KO all", "Skip to leader" and an invincibility toggle.
6. Screenshot what you exercised, or report the URL and the exact steps for the person to try.
7. Sanity check without the browser: `pnpm lint && pnpm test && pnpm build`. `pnpm test` includes a headless
   run of every level.

## On a phone
`pnpm build && pnpm cap:sync && pnpm cap:ios` (after `npx cap add ios` once). `cap:sync` also applies the
orientation from `capacitor.config.ts`. Device builds need Xcode and a signing identity — that is the
Product Architect's step.

## Rules
- Local only. Nothing here deploys anywhere.
- Don't commit `ios/` or `android/` build output, `dist/`, or `.env.local`.
