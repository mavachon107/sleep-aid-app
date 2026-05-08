// Pipeline audio orienté <audio> : seul moyen sur iOS de garder le son actif
// quand l'app passe en arrière-plan ou que l'écran se verrouille.
//
// Flux : factory du son -> rendu offline (WAV) -> Blob URL -> <audio loop>.
// L'élément <audio> est l'unique sortie son ; volume/fade pilotés via audio.volume.

import { renderToBlobUrl } from "./render.js";

let audio = null;
let currentUrl = null;
let userVolume = 0.6;
let stopToken = 0; // invalide tout fade en cours quand un nouveau play() arrive
let fadeRaf = 0;
let unlocked = false;

// Petit WAV silencieux 8 kHz mono — sert à débloquer l'élément <audio> sur iOS
// dès le premier geste utilisateur (la lecture programmatique ne fonctionne
// qu'après un play() initialement déclenché par l'utilisateur).
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAAAA";

function getAudio() {
  if (audio) return audio;
  audio = document.getElementById("audio");
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = "audio";
    audio.setAttribute("playsinline", "");
    audio.preload = "auto";
    document.body.appendChild(audio);
  }
  audio.loop = true;
  audio.volume = userVolume;
  return audio;
}

// À appeler dans le gestionnaire de clic du bouton lecture (geste utilisateur)
// AVANT tout await — débloque l'élément pour les futures lectures programmatiques.
export function unlockAudio() {
  const a = getAudio();
  if (unlocked) return;
  try {
    a.src = SILENT_WAV;
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        a.pause();
        a.muted = false;
        unlocked = true;
      }).catch(() => {});
    } else {
      a.pause();
      a.muted = false;
      unlocked = true;
    }
  } catch {}
}

export function setVolume(v) {
  userVolume = Math.max(0, Math.min(1, v));
  if (audio) {
    cancelFade();
    audio.volume = userVolume;
  }
}

export function isPlaying() {
  return !!audio && !audio.paused;
}

// Démarre un son. `sound` = entrée du catalogue (avec factory + loopDuration).
export async function play(sound) {
  const a = getAudio();
  cancelFade();
  const myToken = ++stopToken;

  const buildFn = sound.factory(sound.loopDuration);
  const url = await renderToBlobUrl(buildFn, sound.loopDuration);
  if (myToken !== stopToken) {
    URL.revokeObjectURL(url);
    return;
  }

  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = url;

  a.src = url;
  a.loop = true;
  a.muted = false;
  a.volume = userVolume;
  try {
    await a.play();
  } catch (e) {
    // Si la lecture est refusée (souvent : geste utilisateur perdu), on tente
    // un play() différé après le prochain geste — sans bloquer l'appelant.
    console.warn("audio.play refusé :", e);
  }

  setMediaSession(sound, a);
}

// Arrêt avec fondu sortant (secondes).
export function stop(fadeSec = 0.3) {
  // Invalide tout rendu encore en cours : si l'utilisateur clique pause pendant
  // qu'un son est en train d'être rendu, le résultat sera ignoré au lieu de
  // démarrer la lecture après coup.
  ++stopToken;
  if (!audio) return;
  if (audio.paused || !audio.src) return;
  rampVolumeTo(0, Math.max(0.05, fadeSec), () => {
    if (!audio) return;
    audio.pause();
    audio.volume = userVolume;
  });
}

// Programme un fondu de coupure final piloté par le minuteur.
export function fadeOutAndStop(fadeSec) {
  stop(fadeSec);
}

function cancelFade() {
  if (fadeRaf) {
    clearTimeout(fadeRaf);
    fadeRaf = 0;
  }
}

// Ramp manuel sur audio.volume — l'élément <audio> n'a pas d'AudioParam.
// On utilise setTimeout plutôt que rAF : rAF est suspendu quand l'écran est
// verrouillé, alors que setTimeout continue de s'exécuter (throttlé ~1 s) tant
// que l'élément audio joue. Indispensable pour que le fondu de fin du minuteur
// fonctionne quand l'utilisateur s'est endormi écran éteint.
function rampVolumeTo(target, durationSec, onDone) {
  if (!audio) return;
  cancelFade();
  const startV = audio.volume;
  const startT = performance.now();
  const myToken = stopToken;

  const tick = () => {
    if (myToken !== stopToken || !audio) return;
    const t = (performance.now() - startT) / 1000;
    const k = Math.min(1, t / durationSec);
    audio.volume = startV + (target - startV) * k;
    if (k < 1) {
      fadeRaf = setTimeout(tick, 250);
    } else {
      fadeRaf = 0;
      onDone?.();
    }
  };
  fadeRaf = setTimeout(tick, 0);
}

function setMediaSession(sound, a) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: sound.label,
      artist: "Sommeil",
      artwork: [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () => a.play());
    navigator.mediaSession.setActionHandler("pause", () => a.pause());
  } catch {}
}
