// Battements binauraux : deux sinus différents en oreille gauche/droite.
// Différence de fréquence = battement perçu. Casque obligatoire pour l'effet.

export function makeBinaural({ carrier = 200, beat = 4 }) {
  return (ctx, dest) => {
    const merger = ctx.createChannelMerger(2);

    const oscL = ctx.createOscillator();
    oscL.type = "sine";
    oscL.frequency.value = carrier;

    const oscR = ctx.createOscillator();
    oscR.type = "sine";
    oscR.frequency.value = carrier + beat;

    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.value = 0.3;
    gainR.gain.value = 0.3;

    oscL.connect(gainL).connect(merger, 0, 0);
    oscR.connect(gainR).connect(merger, 0, 1);
    merger.connect(dest);

    oscL.start();
    oscR.start();

    return {
      stop: (t = 0) => {
        try { oscL.stop(t); } catch {}
        try { oscR.stop(t); } catch {}
      },
    };
  };
}
