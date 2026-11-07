# Cloud City Simulator · Sprint 02: Living Sky City

A playable, local-first floating-island city builder made with Vite, React, TypeScript, and Babylon.js. All world assets are procedural placeholder geometry.

## Run

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. For a production preview, run `npm run build` then `npm run preview`.

## Play

- Select one of ten buildings and click or tap a free tile on the 12×12 island.
- Rotate the selected blueprint using **R** or **Rotate**. Apartments and markets occupy two cells; rotation changes their footprint. Green previews are valid; red previews explain why placement fails.
- Choose **Remove** and tap any part of a building for a 50% refund. **Explore** / **Escape** disables building. **Delete** selects removal.
- Drag to pan, scroll or pinch to zoom, and use the camera buttons to orbit or recenter.
- Earn the displayed income every 10 seconds. Pause using the bottom button. Simulation pauses in background tabs; There is no offline income.
- The **?** panel includes instructions and keyboard-accessible row/column placement controls.

The starter island has 1,200 Cloud Coins, 120 Wood, 40 Sky Crystal, and 12 residents in 26 housing spaces. Its wind keeper supplies 12 power against 9 demand. There is no win condition in this sandbox sprint.

## Living economy

All rates are deterministic, integer amounts per **10-second tick**. Edit the data-only `CATALOG` and `ECONOMY` in `src/simulation/catalog.ts` to tune costs, rates, caps and growth. All six original building keys, IDs in saves, coin costs and footprints remain compatible. Material costs are new in v2.

| Building            | Coins | Wood / Crystal cost | Power supplied / used | Output or benefit per tick  |
| ------------------- | ----: | ------------------: | --------------------: | --------------------------- |
| Cloud cottage       |    80 |               8 / 0 |                 0 / 1 | 4 housing; 6 coins          |
| Sky apartments      |   240 |              20 / 2 |                 0 / 4 | 16 housing; 18 coins        |
| Pocket garden       |    40 |               2 / 0 |                 0 / 0 | +4 Happiness; 1 coin        |
| Wind keeper         |   140 |               8 / 2 |                12 / 0 | 10 coins; no fuel           |
| Corner market       |   180 |              10 / 0 |                 0 / 3 | 2 housing; 16 coins         |
| Garden path         |     5 |               0 / 0 |                 0 / 0 | Decorative                  |
| Sky Lumber Mill     |   120 |              10 / 0 |                 0 / 2 | +8 Wood                     |
| Crystal Harvester   |   160 |              12 / 4 |                 0 / 4 | Uses 1 Wood; +3 Sky Crystal |
| Crystal Power Plant |   260 |              16 / 8 |                24 / 0 | Uses 1 Sky Crystal as fuel  |
| Cloud Plaza         |   150 |              10 / 2 |                 0 / 2 | +12 Happiness while active  |

- Construction charges all three costs atomically. Insufficient funds/materials or overlapping/out-of-bounds footprints reject the entire command. Removal refunds half of each cost, rounded down and capped; housing removal immediately relocates residents beyond remaining capacity.
- Storage caps: **1,000,000 coins, 500 Wood, 250 Sky Crystal**. Excess production is discarded. Legacy coin balances above the new cap are preserved, but cannot grow until spent below the cap. HUD material deltas show actual next-tick changes after caps.
- Generators reserve fuel first, in ascending building-ID order. Plants with no crystal produce no electricity. Power demand includes every consumer. If supply is less than demand, **all power consumers pause**: no output, input consumption, coin income or plaza bonus. Unpowered buildings such as gardens and fueled generators continue running. There is no partial allocation, battery or spatial power network yet.
- Eligible consumers reserve inputs in ID order next. Insufficient inputs pause that building. All production arrives at tick end, so new Wood cannot feed a harvester and new Crystal cannot fuel a plant until the next tick. Fuel is consumed even if storage is full; remove/pause the whole simulation to stop it.
- Happiness = **55 base + gardens (4 each, max 20) + active plazas (12 each, max 24) − 30 for power shortage − 10 when housing is over 90% occupied**, bounded to 0–100. Click Happiness for the live breakdown, shortage and missing-input counts.
- With enough power and Happiness ≥60, up to **2 residents per tick** move into available housing. Otherwise growth stops. Below 60, each active building's coin income is halved and rounded down. Existing residents do not disappear during a brownout. Building income is independent of occupied housing except through the crowding penalty.
- A full day is **24 ticks** (12 day, 12 night). Lighting and the HUD follow saved simulation time; clouds drift cosmetically. Pause stops both tick progression and cloud drift. Reduced-motion preference disables drift. Hidden tabs do not earn offline income.

## Saves

IndexedDB database `cloud-city-simulator`, database schema version 1, holds a validated **v2 city payload** in `saves/primary`. Edits autosave after 350 ms; visibility/page lifecycle events also attempt a save. A completed transaction is required before the HUD reports success. Reload restores the last committed snapshot.

Saves are per browser profile and origin; changing the dev port changes the save location. Storage denial, corruption, or an unsupported version shows an error and allows play in memory. Explicitly enabling saving replaces the previous snapshot. The app does not silently overwrite an unreadable save. Closing the browser before a transaction finishes can lose the latest edit. Multiple open tabs use last-writer-wins behavior; use one tab per city. There is no cloud sync. Valid v1 payloads migrate automatically to v2: buildings, their IDs/rotations, coins, tick and nextId are preserved exactly; 120 Wood and 40 Sky Crystal are granted, and population starts at the former derived resident count. Validation runs before migration. The database name, store and key stay unchanged, so existing saves are found. Unsupported versions and corrupt v1/v2 payloads remain untouched unless the player explicitly selects Enable / retry saving.

## Architecture

```text
src/simulation/catalog.ts    Data-only building definitions, costs, rates, caps and balance knobs
src/simulation/city.ts       Pure state, commands, economy forecast, ticks, migration/validation
src/platform/storage.ts      SaveStore port + IndexedDB implementation
src/rendering/IslandScene.ts Babylon scene, procedural models, picking, pointer camera controls
src/ui/EconomyHUD.tsx        Resource indicators and explainable economy/happiness
src/main.tsx                React lifecycle, clock, commands and persistence wiring
```

The domain imports no React, Babylon, DOM, timer, or storage APIs. Commands return new state; rejected commands preserve the old state. Population is saved state; capacity, happiness, power, active buildings, income and resource forecasts derive from each snapshot. The renderer receives snapshots and emits grid coordinates; it never owns economy or occupancy. A future worker or headless simulator can use the same domain.

## Verification

```sh
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Vitest covers placement, rotated footprints, atomic resource charging/refunds, capped production, input ordering, power/fuel shortages, growth, Happiness effects, deterministic long runs, v1→v2 validation/migration, and IndexedDB round trips/error handling. Playwright runs the original Sprint 01 flows plus industrial construction, resource accounting, power recovery, population growth, v2 save/reload, v1 migration, day/night changes, no new building GPU buffers on ticks, and unsupported-save protection on desktop and mobile Chromium. CI runs these commands plus `npm run format:check`.

Reviewed screenshots: [desktop](docs/screenshots/sprint-02-desktop.png), [night](docs/screenshots/sprint-02-night.png), [mobile](docs/screenshots/sprint-02-mobile.png). These are browser screenshots, not real-device captures.

## Future Android / iOS

`capacitor.config.ts` defines the app identity and points to Vite's `dist` directory. Relative Vite asset paths and viewport/safe-area CSS support a future embedded WebView. `SaveStore` is the seam for native storage, and clock/page-lifecycle wiring can be replaced with Capacitor App lifecycle events. `@capacitor/core` and the CLI are development dependencies only for this preparatory sprint.

When native development is authorized: move core to runtime dependencies if native APIs are imported; install the matching Android/iOS packages, build the web app, add/sync the platforms, then test on real devices. Establish signing, permissions, native back handling, lifecycle durability, save migration, and device performance budgets before release. **No native project, signing, store upload, or release was attempted in either sprint.**

## Current limits

Procedural placeholder geometry and a small deterministic economy: no roads/connectivity rules, resource networks, pathfinding, residents walking, undo, cloud sync, audio, or native integrations. The Babylon entry bundle triggers Vite's size advisory; mobile device profiling and asset optimization remain future work. WebGL is required. Typography uses optional Google Fonts with local sans-serif fallbacks; gameplay and placeholder assets need no external service once the web bundle is loaded. This sprint is not an offline-installable PWA.

Sprint 02 was based on updated `main` after PR #1 was merged. No real Android/iOS hardware, native WebView, battery use, or device FPS has been verified; browser mobile emulation is not device testing. The renderer caches building meshes by ID, animates only 8 clouds (24 low-poly puffs), uses shared materials, and changes lighting without rebuilding geometry.
