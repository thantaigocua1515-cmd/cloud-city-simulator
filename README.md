# Cloud City Simulator · Sprint 01

A playable, local-first floating-island city builder made with Vite, React, TypeScript, and Babylon.js. All world assets are procedural placeholder geometry.

## Run

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. For a production preview, run `npm run build` then `npm run preview`.

## Play

- Select one of six buildings and click or tap a free tile on the 12×12 island.
- Rotate the selected blueprint using **R** or **Rotate**. Apartments and markets occupy two cells; rotation changes their footprint. Green previews are valid; red previews explain why placement fails.
- Choose **Remove** and tap any part of a building for a 50% refund. **Explore** / **Escape** disables building. **Delete** selects removal.
- Drag to pan, scroll or pinch to zoom, and use the camera buttons to orbit or recenter.
- Earn the displayed income every 10 seconds. Pause using the bottom button. Simulation pauses in background tabs; Sprint 01 has no offline income.
- The **?** panel includes instructions and keyboard-accessible row/column placement controls.

The starter island has 1,200 coins and a small settlement. There is no win condition in this sandbox sprint.

## Saves

IndexedDB database `cloud-city-simulator`, schema version 1, holds a validated versioned city snapshot in `saves/primary`. Edits autosave after 350 ms; visibility/page lifecycle events also attempt a save. A completed transaction is required before the HUD reports success. Reload restores the last committed snapshot.

Saves are per browser profile and origin; changing the dev port changes the save location. Storage denial, corruption, or an unsupported version shows an error and allows play in memory. Explicitly enabling saving replaces the previous snapshot. The app does not silently overwrite an unreadable save. Closing the browser before a transaction finishes can lose the latest edit. Multiple open tabs use last-writer-wins behavior; use one tab per city. There is no cloud sync or migration beyond v1 yet.

## Architecture

```text
src/simulation/city.ts       Pure deterministic state, commands, footprints, ticks, validation
src/platform/storage.ts      SaveStore port + IndexedDB implementation
src/rendering/IslandScene.ts Babylon scene, procedural models, picking, pointer camera controls
src/main.tsx                React HUD, lifecycle, clock, command and persistence wiring
```

The domain imports no React, Babylon, DOM, timer, or storage APIs. Commands return new state; rejected commands preserve the old state. Population and income derive from buildings. The renderer receives snapshots and emits grid coordinates; it never owns economy or occupancy. A future worker or headless simulator can use the same domain.

## Verification

```sh
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Vitest covers placement, rotated footprints, boundaries, occupancy, insufficient funds, removal/refunds, income, versioned save validation, and IndexedDB round trips/error handling. Playwright runs desktop and mobile Chromium workflows for placement, rotation, overlap rejection, removal, save/reload, real canvas picking, dragging, and viewport overflow. CI runs these same commands.

## Future Android / iOS

`capacitor.config.ts` defines the app identity and points to Vite's `dist` directory. Relative Vite asset paths and viewport/safe-area CSS support a future embedded WebView. `SaveStore` is the seam for native storage, and clock/page-lifecycle wiring can be replaced with Capacitor App lifecycle events. `@capacitor/core` and the CLI are development dependencies only for this preparatory sprint.

When native development is authorized: move core to runtime dependencies if native APIs are imported; install the matching Android/iOS packages, build the web app, add/sync the platforms, then test on real devices. Establish signing, permissions, native back handling, lifecycle durability, save migration, and device performance budgets before release. **No native project, signing, store upload, or release was attempted in Sprint 01.**

## Current limits

Placeholder geometry and simple income only: no roads/connectivity rules, resource networks, pathfinding, residents walking, undo, cloud sync, audio, or native integrations. The Babylon entry bundle triggers Vite's size advisory; mobile device profiling and asset optimization remain future work. WebGL is required. Typography uses optional Google Fonts with local sans-serif fallbacks; gameplay and placeholder assets need no external service once the web bundle is loaded. This sprint is not an offline-installable PWA.
