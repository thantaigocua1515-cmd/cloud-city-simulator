# Repository guide

## Commands

Use Node 22+. `npm ci` installs the lockfile. Run `npm test` and `npm run build` for changes. For interactions, storage, or rendering changes also run `npx playwright install --with-deps chromium` and `npm run test:e2e`.

## Boundaries

- Keep `src/simulation` deterministic and independent of React, Babylon, browser/native APIs, storage, and timers. Test domain rules with Vitest.
- Route persistence through `SaveStore` in `src/platform`. Validate all loaded snapshots and version the format; never silently replace corrupt or unsupported saves.
- Render domain snapshots in `src/rendering`; send coordinates/commands outward. Never mutate simulation state from mesh metadata.
- Dispose engines, scene resources, observers, event listeners, and timers on unmount. Avoid rebuilding all meshes on economy ticks.
- Keep touch controls, keyboard alternatives, visible focus, responsive HUD, and WebGL failure feedback working.
- Use procedural placeholder assets until asset licensing and budgets are established.

## Mobile preparation

The Capacitor config is preparatory only. Do not generate native projects, add permissions, signing material, or release workflows unless requested. Preserve the storage and lifecycle seams for future native adapters.

## Delivery

Keep generated bundles, browser reports, credentials, and node_modules out of git. Describe behavior changes and actual verification results in PRs, including remaining limitations. Never report a blocked test or unpublished PR as complete.
