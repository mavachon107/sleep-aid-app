// Fréquence pure (Solfège). Sinus simple à faible amplitude.

export function makeTone(freq) {
  return (ctx, dest) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    osc.connect(g).connect(dest);
    osc.start();
    return { stop: (t = 0) => { try { osc.stop(t); } catch {} } };
  };
}
