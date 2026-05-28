// Bruits blanc, rose, brun. Génère un AudioBuffer couvrant toute la durée de
// rendu : aucune boucle interne, donc aucun clic à un raccord intermédiaire.

const DEFAULT_SECONDS = 30;

function makeBuffer(ctx, fill, seconds) {
  const len = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    fill(buf.getChannelData(ch));
  }
  return buf;
}

function fillWhite(data) {
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

// Algorithme Paul Kellet — approxime un bruit rose (-3 dB/octave).
function fillPink(data) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    data[i] = out * 0.11; // normalisation approx
  }
}

// Bruit brun = intégration du bruit blanc (marche aléatoire) avec leak pour rester borné.
function fillBrown(data) {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    data[i] = last * 3.5; // gain de compensation
  }
}

const FILLERS = { white: fillWhite, pink: fillPink, brown: fillBrown };

// Cache par AudioContext + couleur + durée.
const cache = new WeakMap();
function getCached(ctx, color, seconds) {
  let perCtx = cache.get(ctx);
  if (!perCtx) { perCtx = {}; cache.set(ctx, perCtx); }
  const key = `${color}:${seconds}`;
  if (!perCtx[key]) perCtx[key] = makeBuffer(ctx, FILLERS[color], seconds);
  return perCtx[key];
}

export function makeColoredNoise(color, seconds = DEFAULT_SECONDS) {
  return (ctx, dest) => {
    const buffer = getCached(ctx, color, seconds);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true; // sécurité : le buffer couvre déjà toute la durée de rendu
    src.connect(dest);
    src.start();
    return { stop: (t = 0) => src.stop(t) };
  };
}
