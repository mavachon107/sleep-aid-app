// Pipeline audio orienté <audio> : seul moyen sur iOS de garder le son actif
// quand l'app passe en arrière-plan ou que l'écran se verrouille.
//
// Flux : factory du son -> rendu offline (WAV avec fondus gravés en tête/queue)
// -> Blob URL -> DEUX éléments <audio> qui se relaient (ping-pong).
//
// Pourquoi deux éléments ? L'attribut `loop` natif n'est PAS sans coupure :
// l'élément cale brièvement au rebouclage et insère un silence (net sur iOS),
// d'où la « coupure » entendue toutes les `loopDuration` secondes. On démarre
// donc le second élément un peu avant la fin du premier ; leur recouvrement
// (CROSSFADE_SEC) se fond grâce aux fondus déjà gravés dans le WAV. Aucune
// automation de volume n'est requise pendant le relais — crucial car écran
// verrouillé, seul setTimeout (throttlé ~1 s) tourne ; le Web Audio est suspendu.

import { renderToBlobUrl, CROSSFADE_SEC } from "./render.js";

let els = null; // [el0, el1]
let active = 0; // index de l'élément qui mène la lecture
let currentUrl = null;
let loopDuration = 0; // durée du WAV courant (s)
let userVolume = 0.6;
let fadeFactor = 1; // multiplicateur 0..1 piloté par les fondus de fin
let stopToken = 0; // invalide rendu / fondu / relais en cours quand un nouveau play()/stop() arrive
let fadeTimer = 0;
let swapTimer = 0;
let unlocked = false;

// Petit WAV silencieux 8 kHz mono — sert à débloquer les éléments <audio> sur
// iOS dès le premier geste utilisateur (la lecture programmatique ne fonctionne
// qu'après un play() initialement déclenché par l'utilisateur).
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAAAA";

function makeEl(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("audio");
    el.id = id;
    el.hidden = true;
    document.body.appendChild(el);
  }
  el.setAttribute("playsinline", "");
  el.preload = "auto";
  el.loop = false; // le relais gère le rebouclage, surtout pas la boucle native
  return el;
}

function getEls() {
  if (els) return els;
  els = [makeEl("audio"), makeEl("audio2")];
  applyVolume();
  return els;
}

function applyVolume() {
  if (!els) return;
  const v = Math.max(0, Math.min(1, userVolume * fadeFactor));
  els[0].volume = v;
  els[1].volume = v;
}

// À appeler dans le gestionnaire de clic du bouton lecture (geste utilisateur)
// AVANT tout await — débloque les DEUX éléments pour les futures lectures
// programmatiques (le relais démarre le second élément hors geste utilisateur).
export function unlockAudio() {
  const list = getEls();
  if (unlocked) return;
  unlocked = true;
  for (const el of list) {
    try {
      el.src = SILENT_WAV;
      el.muted = true;
      const p = el.play();
      const done = () => {
        el.pause();
        el.muted = false;
      };
      if (p && typeof p.then === "function") p.then(done).catch(() => {});
      else done();
    } catch {}
  }
}

export function setVolume(v) {
  userVolume = Math.max(0, Math.min(1, v));
  cancelFade();
  fadeFactor = 1;
  applyVolume();
}

export function isPlaying() {
  return !!els && (!els[0].paused || !els[1].paused);
}

// Démarre un son. `sound` = entrée du catalogue (avec factory + loopDuration).
export async function play(sound) {
  getEls();
  cancelFade();
  cancelSwap();
  fadeFactor = 1;
  const myToken = ++stopToken;

  const buildFn = sound.factory(sound.loopDuration);
  const url = await renderToBlobUrl(buildFn, sound.loopDuration);
  if (myToken !== stopToken) {
    URL.revokeObjectURL(url);
    return;
  }

  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = url;
  loopDuration = sound.loopDuration;

  for (const el of els) {
    try { el.pause(); } catch {}
    el.src = url;
    el.loop = false;
    el.muted = false;
  }
  active = 0;
  applyVolume();

  try {
    await els[active].play();
  } catch (e) {
    // Si la lecture est refusée (souvent : geste utilisateur perdu), on n'a pas
    // de raison de bloquer l'appelant ; l'utilisateur pourra relancer.
    console.warn("audio.play refusé :", e);
  }

  scheduleSwap(myToken);
  setMediaSession(sound);
}

// Programme le démarrage de l'élément en attente juste avant que l'élément
// menant n'atteigne sa fin, pour que leur recouvrement (CROSSFADE_SEC) se fonde
// via les fondus gravés dans le WAV — boucle continue, sans silence ni clic.
function scheduleSwap(token) {
  cancelSwap();
  if (!els) return;
  const current = els[active].currentTime || 0;
  const delay = Math.max(0, (loopDuration - CROSSFADE_SEC - current) * 1000);
  swapTimer = setTimeout(() => {
    swapTimer = 0;
    if (token !== stopToken || !els) return;
    const next = 1 - active;
    const n = els[next];
    try {
      n.currentTime = 0;
      n.volume = Math.max(0, Math.min(1, userVolume * fadeFactor));
      n.play().catch(() => {});
    } catch {}
    active = next;
    // L'ancien élément poursuit sa queue (~CROSSFADE_SEC, en fondu de sortie)
    // puis s'arrête seul (loop=false) ; le nouveau est déjà à plein volume.
    scheduleSwap(token);
  }, delay);
}

// Arrêt immédiat (pause utilisateur) avec fondu sortant court.
export function stop(fadeSec = 0.3) {
  ++stopToken; // invalide rendu / relais en cours
  cancelSwap();
  if (!els) return;
  if (els[0].paused && els[1].paused) return;
  rampFadeTo(0, Math.max(0.05, fadeSec), () => {
    for (const el of els) {
      try { el.pause(); } catch {}
    }
    fadeFactor = 1;
    applyVolume();
  });
}

// Fondu de coupure final piloté par le minuteur. On laisse le relais continuer
// pendant tout le fondu pour garder un son ininterrompu, puis on coupe.
export function fadeOutAndStop(fadeSec) {
  if (!els) return;
  if (els[0].paused && els[1].paused) return;
  rampFadeTo(0, Math.max(0.05, fadeSec), () => {
    ++stopToken; // stoppe tout relais encore programmé
    cancelSwap();
    for (const el of els) {
      try { el.pause(); } catch {}
    }
    fadeFactor = 1;
    applyVolume();
  });
}

function cancelFade() {
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = 0;
  }
}

function cancelSwap() {
  if (swapTimer) {
    clearTimeout(swapTimer);
    swapTimer = 0;
  }
}

// Ramp manuel de fadeFactor — l'élément <audio> n'a pas d'AudioParam.
// On utilise setTimeout plutôt que rAF : rAF est suspendu quand l'écran est
// verrouillé, alors que setTimeout continue de s'exécuter (throttlé ~1 s) tant
// qu'un élément audio joue. Indispensable pour que le fondu de fin du minuteur
// fonctionne quand l'utilisateur s'est endormi écran éteint.
function rampFadeTo(target, durationSec, onDone) {
  cancelFade();
  const startF = fadeFactor;
  const startT = performance.now();
  const myToken = stopToken;

  const tick = () => {
    if (myToken !== stopToken || !els) return;
    const t = (performance.now() - startT) / 1000;
    const k = Math.min(1, t / durationSec);
    fadeFactor = startF + (target - startF) * k;
    applyVolume();
    if (k < 1) {
      fadeTimer = setTimeout(tick, 250);
    } else {
      fadeTimer = 0;
      onDone?.();
    }
  };
  fadeTimer = setTimeout(tick, 0);
}

function setMediaSession(sound) {
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
    navigator.mediaSession.setActionHandler("pause", () => stop(0.3));
    navigator.mediaSession.setActionHandler("play", () => {
      if (!els || !currentUrl) return;
      els[active].play().catch(() => {});
      scheduleSwap(stopToken);
    });
  } catch {}
}
