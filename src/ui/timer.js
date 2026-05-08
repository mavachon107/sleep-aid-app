// Minuteur d'arrêt automatique avec fondu sortant final.
//
// Utilise setTimeout (et non requestAnimationFrame) pour continuer à tourner
// quand l'écran est verrouillé — rAF est suspendu en arrière-plan. setTimeout
// reste actif (throttlé à ~1 s) tant que l'élément <audio> joue.

const PRESETS = [15, 30, 45, 60, 90]; // minutes
const FADE_SEC = 30;
const TICK_MS = 500;

export function createTimer({ onTick, onFadeStart, onEnd }) {
  let durationMin = 30;
  let endAt = 0;
  let timer = 0;
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
    const remaining = endAt - Date.now();
    onTick?.(format(remaining), remaining);
    if (!fadeTriggered && remaining <= FADE_SEC * 1000) {
      fadeTriggered = true;
      onFadeStart?.(FADE_SEC);
    }
    if (remaining <= 0) {
      running = false;
      clearTimeout(timer);
      onEnd?.();
      return;
    }
    timer = setTimeout(tick, TICK_MS);
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
      // Date.now() (et non performance.now()) car les horloges monotones se
      // gèlent parfois en arrière-plan ; Date.now() reste cohérent au réveil.
      endAt = Date.now() + durationMin * 60 * 1000;
      timer = setTimeout(tick, 0);
    },
    stop() {
      running = false;
      clearTimeout(timer);
    },
    isRunning: () => running,
  };
}
