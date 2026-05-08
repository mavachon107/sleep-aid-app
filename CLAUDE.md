# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

Static, dependency-free PWA that synthesises calming sounds in the browser via the Web Audio API. No `package.json`, no bundler, no test runner — `index.html` loads `src/main.js` as a native ES module and the rest is wired through `import` statements. UI strings, source comments, and commit messages are in French; match that style when editing.

## Running locally

The app must be served over HTTP (not `file://`) for ES modules and the service worker to load. Any static server works:

```sh
python3 -m http.server 8000        # → http://localhost:8000
# or
npx serve .
```

Note that the service worker (`service-worker.js`) aggressively caches the shell. When iterating, either bump `CACHE` to a new version, unregister the worker in DevTools → Application, or hard-reload with "Bypass for network".

## Regenerating PWA icons

`scripts/gen-icons.mjs` writes `icons/icon-192.png` and `icons/icon-512.png` from a manual RGBA → PNG encoder (no deps). Run it after changing the icon design:

```sh
node scripts/gen-icons.mjs
```

The SVG source (`icons/icon.svg`) is independent — keep it in sync by hand if you change the moon/star layout.

## Audio architecture

Everything funnels through a single shared `AudioContext` and master `GainNode` owned by `src/audio/engine.js`. The engine exposes `play(factory)`, `stop(fadeSec)`, `setVolume(v)`, and `fadeOutAndStop(fadeSec)`; it is the only module that touches the context.

**Factory pattern.** Each sound module (`coloredNoise.js`, `binaural.js`, `nature.js`, `tones.js`) exports a function returning `(ctx, dest) => { stop(t) }`. The factory builds its own graph, connects to `dest` (the engine's master gain), starts its sources, and returns a stop handle. Adding a new sound = write a factory + register an entry in `src/data/sounds.js` (with `id`, `label`, `evidence` level, `blurb`, and `factory`). The picker UI and the info dialog are both data-driven from that array.

**Anti-click crossfade.** `engine.js` uses a `stopToken` counter to invalidate pending `setTimeout`-driven gain resets when a new sound starts mid-fadeout. If you edit `play()` / `killCurrent()`, preserve the token check — without it, switching sounds quickly can zero the master gain after the new sound has already started.

**Buffer caching.** Colored-noise buffers (~30 s stereo) are cached per-`AudioContext` via a `WeakMap` in `coloredNoise.js`. Don't recreate buffers on every play; reuse the cache helper.

## Timer & sleep fade

`src/ui/timer.js` runs a `requestAnimationFrame` countdown. When `remaining ≤ FADE_SEC * 1000` (currently 30 s), it fires `onFadeStart(FADE_SEC)` exactly once, which `main.js` wires to `fadeOutAndStop` so the audio gracefully tapers before the timer hits zero. Presets cycle through `[15, 30, 45, 60, 90]` minutes via the timer button.

## Service worker asset list

`service-worker.js` precaches an explicit `ASSETS` array. When you add a file under `src/` or `icons/`, append it to `ASSETS` **and** bump the `CACHE` constant (e.g. `sommeil-v1` → `sommeil-v2`) — otherwise existing installs keep serving the old shell and never fetch the new file.

## Evidence labels

Sounds in `src/data/sounds.js` carry an `evidence` field with one of: `solid`, `modere`, `faible`, `aucune`. These drive the colored chip in the picker and the info dialog. The blurbs cite primary sources; if you adjust a claim, update the citation rather than removing it — keeping the science honest is part of the app's premise.
