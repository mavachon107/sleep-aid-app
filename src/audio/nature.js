// Sons de la nature, synthétisés (aucun fichier audio).
// - Pluie : bruit rose passe-bas + bursts haute fréquence (gouttes) pré-planifiés via AudioParam.
// - Vagues : bruit rose modulé par un LFO basse fréquence (~0,08 Hz).
// Compatibles OfflineAudioContext : aucun setTimeout dans la construction du graphe.

function makePinkLoop(ctx, seconds = 30) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random()*2-1;
      b0=0.99886*b0+w*0.0555179;
      b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520;
      b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522;
      b5=-0.7616*b5-w*0.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
      b6 = w*0.115926;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function makeWhiteLoop(ctx, seconds = 5) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

export function makeRain(duration = 60) {
  return (ctx, dest) => {
    // Lit de pluie : rose → passe-bas.
    const bed = makePinkLoop(ctx, duration);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.9;
    bed.connect(lp).connect(bedGain).connect(dest);
    bed.start();

    // Gouttes : blanc → passe-bande haute, modulé par enveloppes pré-planifiées.
    const drops = makeWhiteLoop(ctx, Math.min(5, duration));
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 4500;
    bp.Q.value = 0.8;
    const dropGain = ctx.createGain();
    dropGain.gain.setValueAtTime(0, 0);
    drops.connect(bp).connect(dropGain).connect(dest);
    drops.start();

    // Pré-planification d'un processus de Poisson (~12 gouttes/s) sur [0, duration].
    let t = 0;
    while (true) {
      t += -Math.log(1 - Math.random()) / 12;
      if (t >= duration) break;
      const peak = 0.04 + Math.random() * 0.06;
      const decay = 0.05 + Math.random() * 0.05;
      dropGain.gain.setValueAtTime(0, t);
      dropGain.gain.linearRampToValueAtTime(peak, t + 0.005);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    }

    return {
      stop: (at = 0) => {
        try { bed.stop(at); } catch {}
        try { drops.stop(at); } catch {}
      },
    };
  };
}

export function makeWaves() {
  return (ctx, dest) => {
    const bed = makePinkLoop(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800;
    const amp = ctx.createGain();
    amp.gain.value = 0;

    // LFO + offset constant additionnés sur amp.gain pour créer une enveloppe lente.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.08; // cycle ~12 s
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.45;

    const lfoOffset = ctx.createConstantSource();
    lfoOffset.offset.value = 0.5;

    lfo.connect(lfoDepth).connect(amp.gain);
    lfoOffset.connect(amp.gain);

    bed.connect(lp).connect(amp).connect(dest);
    bed.start();
    lfo.start();
    lfoOffset.start();

    return {
      stop: (t = 0) => {
        try { bed.stop(t); } catch {}
        try { lfo.stop(t); } catch {}
        try { lfoOffset.stop(t); } catch {}
      },
    };
  };
}
