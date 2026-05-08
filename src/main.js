// Point d'entrée : câble UI ↔ moteur audio ↔ minuteur.

import { play, stop, setVolume, fadeOutAndStop, unlockAudio } from "./audio/engine.js";
import { SOUNDS } from "./data/sounds.js";
import { createTimer } from "./ui/timer.js";
import {
  setupSoundPicker,
  setupPlayButton,
  setupVolume,
  setupTimerButton,
  setupInfoDialog,
} from "./ui/controls.js";

const INITIAL_ID = "pink";
let currentSound = SOUNDS.find((s) => s.id === INITIAL_ID);

const timer = createTimer({
  onTick: (text) => timerUI.showCountdown(text),
  onFadeStart: (sec) => fadeOutAndStop(sec),
  onEnd: () => {
    playUI.setPlaying(false);
    timerUI.hideCountdown();
    timerUI.refresh();
  },
});

const picker = setupSoundPicker({
  initialId: INITIAL_ID,
  onSelect: async (s) => {
    currentSound = s;
    if (playUI.isPlaying()) {
      playUI.setLoading(true);
      try {
        await play(s);
      } finally {
        playUI.setLoading(false);
      }
    }
  },
});

const playUI = setupPlayButton({
  onPress: () => unlockAudio(), // synchronously, within the user gesture
  onToggle: async (shouldPlay) => {
    if (shouldPlay) {
      playUI.setLoading(true);
      try {
        await play(currentSound);
        timer.start();
      } finally {
        playUI.setLoading(false);
      }
    } else {
      timer.stop();
      stop(0.5);
      timerUI.hideCountdown();
      timerUI.refresh();
    }
  },
});

setupVolume({
  initial: 0.6,
  onChange: (v) => setVolume(v),
});

const timerUI = setupTimerButton({ timer });

setupInfoDialog();

// Service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
