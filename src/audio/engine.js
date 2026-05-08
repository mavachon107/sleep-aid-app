// AudioContext partagé + master gain. Tous les sons s'y branchent.

let ctx = null;
let master = null;
let currentSource = null; // { stop(t) }
let userVolume = 0.6;
let stopToken = 0; // incrémenté à chaque play/stop pour invalider les setTimeout en cours.

export function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = userVolume;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function getMaster() {
  getContext();
  return master;
}

export async function ensureRunning() {
  const c = getContext();
  if (c.state === "suspended") await c.resume();
}

export function setVolume(v) {
  userVolume = Math.max(0, Math.min(1, v));
  if (master) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.linearRampToValueAtTime(userVolume, t + 0.05);
  }
}

export function isPlaying() {
  return currentSource !== null;
}

// Démarre un son. `factory` reçoit (ctx, dest) et retourne { stop(at) }.
export async function play(factory) {
  await ensureRunning();
  // Coupure immédiate du son courant (fondu très court anti-clic).
  killCurrent(0.05);
  stopToken++;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(userVolume, t + 0.4);
  currentSource = factory(ctx, master);
}

function killCurrent(fadeSec) {
  if (!currentSource || !ctx) return;
  const src = currentSource;
  currentSource = null;
  const myToken = ++stopToken;
  const t = ctx.currentTime;
  const end = t + Math.max(0.02, fadeSec);
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(0.0001, end);
  setTimeout(() => {
    try { src.stop(0); } catch {}
    // Ne touche au master que si aucun nouveau son n'a démarré entre-temps.
    if (myToken === stopToken && ctx) {
      const tt = ctx.currentTime;
      master.gain.cancelScheduledValues(tt);
      master.gain.setValueAtTime(0, tt);
    }
  }, (end - t) * 1000 + 50);
}

// Arrêt avec fondu sortant (secondes).
export function stop(fadeSec = 0.3) {
  killCurrent(fadeSec);
}

// Programme un fondu de coupure final piloté par le minuteur.
export function fadeOutAndStop(fadeSec) {
  killCurrent(fadeSec);
}
