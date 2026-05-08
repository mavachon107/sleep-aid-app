// Minuteur d'arrêt automatique avec fondu sortant final.

const PRESETS = [15, 30, 45, 60, 90]; // minutes
const FADE_SEC = 30;

export function createTimer({ onTick, onFadeStart, onEnd }) {
  let durationMin = 30;
  let endAt = 0;
  let raf = 0;
  let fadeTriggered = false;
  let running = false;

  function format(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function tick() {
    if (!running) return;
    const remaining = endAt - performance.now();
    onTick?.(format(remaining), remaining);
    if (!fadeTriggered && remaining <= FADE_SEC * 1000) {
      fadeTriggered = true;
      onFadeStart?.(FADE_SEC);
    }
    if (remaining <= 0) {
      running = false;
      cancelAnimationFrame(raf);
      onEnd?.();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  return {
    presets: PRESETS,
    fadeSec: FADE_SEC,
    getDuration: () => durationMin,
    setDuration(min) {
      durationMin = min;
    },
    cyclePreset() {
      const i = PRESETS.indexOf(durationMin);
      durationMin = PRESETS[(i + 1) % PRESETS.length];
      return durationMin;
    },
    start() {
      fadeTriggered = false;
      running = true;
      endAt = performance.now() + durationMin * 60 * 1000;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    isRunning: () => running,
  };
}
