// Rend une factory audio dans un OfflineAudioContext, encode en WAV 16-bit PCM,
// renvoie une URL Blob lisible par un <audio> — nécessaire pour qu'iOS garde le
// son actif quand l'app passe en arrière-plan ou que l'écran se verrouille.

const SAMPLE_RATE = 44100;

// Durée du recouvrement entre les deux éléments <audio> qui se relaient (cf.
// engine.js). Un fondu enchaîné en puissance constante de cette durée est gravé
// en tête et en queue du WAV : à la jointure, la queue de l'un (cos) et la tête
// de l'autre (sin) s'additionnent à puissance constante (cos²+sin²=1) pour un
// rebouclage sans coupure ni clic, sans aucune automation de volume en JS.
export const CROSSFADE_SEC = 1.5;

export async function renderToBlobUrl(buildFn, durationSec) {
  const ctx = new OfflineAudioContext(2, Math.round(SAMPLE_RATE * durationSec), SAMPLE_RATE);
  buildFn(ctx, ctx.destination);
  const buffer = await ctx.startRendering();
  applyEdgeFades(buffer, CROSSFADE_SEC);
  const wav = audioBufferToWav(buffer);
  return URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
}

// Fondu en puissance constante gravé sur les `fadeSec` premières et dernières
// secondes : gain = sin(π/2 · i/n) depuis chaque bord (0 au bord, 1 à n).
function applyEdgeFades(buffer, fadeSec) {
  const n = Math.min(
    Math.floor(buffer.sampleRate * fadeSec),
    Math.floor(buffer.length / 2)
  );
  if (n <= 0) return;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    const last = d.length - 1;
    for (let i = 0; i < n; i++) {
      const g = Math.sin((Math.PI / 2) * (i / n));
      d[i] *= g; // fondu d'entrée (tête)
      d[last - i] *= g; // fondu de sortie (queue)
    }
  }
}

// PCM 16-bit entrelacé, header RIFF/WAVE/fmt /data minimal.
function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const dataSize = len * numCh * bytesPerSample;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numCh * bytesPerSample, true);
  view.setUint16(32, numCh * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return out;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
