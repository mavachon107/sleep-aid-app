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

Sound is **not** played from a live `AudioContext` — on iOS that gets suspended the moment the screen locks, killing playback. Instead `src/audio/engine.js` renders each sound offline to a WAV blob (`src/audio/render.js`, via `OfflineAudioContext`) and plays it back through HTML `<audio>` elements, the only output that survives backgrounding/lock on iOS. The engine exposes `play(sound)`, `stop(fadeSec)`, `setVolume(v)`, `fadeOutAndStop(fadeSec)`, `isPlaying()`, and `unlockAudio()`; it is the only module that touches the elements.

**Factory pattern.** Each sound module (`coloredNoise.js`, `binaural.js`, `nature.js`, `tones.js`) exports a function returning `(ctx, dest) => { stop(t) }`. During rendering, `render.js` hands the factory a fresh `OfflineAudioContext` as `ctx` and its `destination` as `dest`. The factory builds its graph, connects to `dest`, starts its sources, and returns a stop handle. **No `setTimeout`/`requestAnimationFrame` in the graph build** — it must run to completion under `OfflineAudioContext.startRendering()` (e.g. `nature.js` pre-schedules its rain drops via `AudioParam`). Adding a new sound = write a factory + register an entry in `src/data/sounds.js` (with `id`, `label`, `evidence` level, `blurb`, `loopDuration`, and `factory(loopDuration)`). The picker UI and the info dialog are both data-driven from that array.

**Gapless looping.** Native `<audio loop>` stalls and inserts a silent gap at the wrap (audible on iOS) — so the engine uses **two `<audio>` elements that ping-pong**. The idle element is started `CROSSFADE_SEC` before the active one ends; their overlap cross-fades via an **equal-power fade baked into the WAV's head and tail** by `render.js` (`applyEdgeFades`, gain `sin(π/2·i/n)` from each edge, so tail² + head² = 1). Baking the fade into the audio means the relay needs **no per-frame volume automation** — essential, since while the screen is locked only throttled `setTimeout` runs. `loopDuration` is kept an integer multiple of each sound's internal periods so head and tail meet in phase. The handoff is scheduled by a single `setTimeout` (`scheduleSwap`), recomputed from the live `currentTime` each cycle.

**`stopToken`.** A counter that invalidates anything still in flight — a pending render, a running fade ramp, or a scheduled swap — when a new `play()`/`stop()` arrives. `play()` and `stop()` bump it; `fadeOutAndStop()` keeps the relay running through the long sleep fade and only bumps it once the fade completes. Preserve these token checks, or a stale render/swap can resume audio after the user has stopped it.

**Buffer caching.** Noise buffers are generated to span the **full render duration** (no internal loop seam → no mid-cycle click) and cached per-`OfflineAudioContext` via a `WeakMap` keyed by `color:seconds` in `coloredNoise.js`. Since each render uses a fresh throwaway context the cache rarely hits in practice; it mainly guards against rebuilding within a single render.

## Timer & sleep fade

`src/ui/timer.js` runs a `setTimeout` countdown (not `requestAnimationFrame`, which is suspended in the background; `setTimeout` keeps firing — throttled to ~1 s — while an `<audio>` element plays). It tracks the deadline with `Date.now()` so a frozen background clock can't drift it. When `remaining ≤ FADE_SEC * 1000` (currently 30 s), it fires `onFadeStart(FADE_SEC)` exactly once, which `main.js` wires to `fadeOutAndStop` so the audio gracefully tapers before the timer hits zero. Presets cycle through `[15, 30, 45, 60, 90]` minutes via the timer button.

## Service worker asset list

`service-worker.js` precaches an explicit `ASSETS` array. When you add a file under `src/` or `icons/`, append it to `ASSETS` **and** bump the `CACHE` constant (e.g. `sommeil-v1` → `sommeil-v2`) — otherwise existing installs keep serving the old shell and never fetch the new file.

## Evidence labels

Sounds in `src/data/sounds.js` carry an `evidence` field with one of: `solid`, `modere`, `faible`, `aucune`. These drive the colored chip in the picker and the info dialog. The blurbs cite primary sources; if you adjust a claim, update the citation rather than removing it — keeping the science honest is part of the app's premise.
