// Rend une factory audio dans un OfflineAudioContext, encode en WAV 16-bit PCM,
// renvoie une URL Blob lisible par un <audio> — nécessaire pour qu'iOS garde le
// son actif quand l'app passe en arrière-plan ou que l'écran se verrouille.

const SAMPLE_RATE = 44100;

export async function renderToBlobUrl(buildFn, durationSec) {
  const ctx = new OfflineAudioContext(2, Math.round(SAMPLE_RATE * durationSec), SAMPLE_RATE);
  buildFn(ctx, ctx.destination);
  const buffer = await ctx.startRendering();
  const wav = audioBufferToWav(buffer);
  return URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
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
