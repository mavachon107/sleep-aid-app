// Catalogue des sons. `evidence` = niveau de preuve scientifique.
// solid | modere | faible | aucune
// Chaque entrée fournit un `factory(loopDuration)` retournant un constructeur (ctx, dest) -> { stop }.
// `loopDuration` est choisie comme multiple entier des périodicités internes pour
// que la tête et la queue du rendu coïncident en phase : le relais à fondu
// enchaîné des deux <audio> (voir engine.js) reboucle alors sans clic ni à-coup.

import { makeColoredNoise } from "../audio/coloredNoise.js";
import { makeBinaural } from "../audio/binaural.js";
import { makeRain, makeWaves } from "../audio/nature.js";
import { makeTone } from "../audio/tones.js";

export const SOUNDS = [
  {
    id: "pink",
    label: "Bruit rose",
    evidence: "solid",
    loopDuration: 60,
    blurb:
      "Spectre en -3 dB/octave. Papalambros et al. (2017) ont montré qu'une stimulation acoustique rose en phase avec les ondes lentes améliore le sommeil profond et la mémoire chez l'adulte.",
    factory: (dur) => makeColoredNoise("pink", dur),
  },
  {
    id: "brown",
    label: "Bruit brun",
    evidence: "modere",
    loopDuration: 60,
    blurb:
      "Plus grave que le rose (-6 dB/octave), souvent perçu comme apaisant. Effet de masquage des bruits ambiants documenté ; preuves cliniques de qualité limitée mais effet plausible.",
    factory: (dur) => makeColoredNoise("brown", dur),
  },
  {
    id: "white",
    label: "Bruit blanc",
    evidence: "modere",
    loopDuration: 60,
    blurb:
      "Spectre plat, masque efficacement les bruits parasites. La revue Cochrane 2021 (Riedy) note des preuves limitées mais cohérentes pour la réduction du temps d'endormissement en milieu bruyant.",
    factory: (dur) => makeColoredNoise("white", dur),
  },
  {
    id: "rain",
    label: "Pluie",
    evidence: "modere",
    loopDuration: 60,
    blurb:
      "Sons naturels associés à une activation parasympathique (Gould van Praag et al., 2017). Synthèse procédurale : aucun fichier audio.",
    factory: (dur) => makeRain(dur),
  },
  {
    id: "waves",
    label: "Vagues",
    evidence: "modere",
    loopDuration: 50, // 4 cycles complets du LFO 0.08 Hz (période 12.5 s)
    blurb:
      "Modulation lente d'amplitude qui rappelle la respiration calme. Mêmes effets parasympathiques que les sons naturels en général.",
    factory: (dur) => makeWaves(dur),
  },
  {
    id: "binaural-delta",
    label: "Binaural delta (2 Hz)",
    evidence: "faible",
    loopDuration: 60,
    blurb:
      "Casque obligatoire. 200 Hz à gauche, 202 Hz à droite : battement perçu de 2 Hz, dans la bande delta du sommeil profond. Méta-analyse Garcia-Argibay et al. (2019) : petit effet sur l'anxiété, preuves sommeil mitigées.",
    factory: () => makeBinaural({ carrier: 200, beat: 2 }),
  },
  {
    id: "binaural-theta",
    label: "Binaural theta (6 Hz)",
    evidence: "faible",
    loopDuration: 60,
    blurb:
      "Casque obligatoire. Battement perçu de 6 Hz (bande theta, somnolence/REM). Mêmes réserves méthodologiques que le delta.",
    factory: () => makeBinaural({ carrier: 200, beat: 6 }),
  },
  {
    id: "solfege-528",
    label: "528 Hz (Solfège)",
    evidence: "aucune",
    loopDuration: 60,
    blurb:
      "Fréquence dite « de la transformation ». Aucune preuve clinique solide. Inclus pour exploration personnelle uniquement.",
    factory: () => makeTone(528),
  },
  {
    id: "solfege-432",
    label: "432 Hz (Solfège)",
    evidence: "aucune",
    loopDuration: 60,
    blurb:
      "Accord alternatif souvent décrit comme « plus naturel ». Aucune preuve clinique solide.",
    factory: () => makeTone(432),
  },
];

export const EVIDENCE_LABEL = {
  solid: "Solide",
  modere: "Modéré",
  faible: "Faible",
  aucune: "Aucune preuve",
};
