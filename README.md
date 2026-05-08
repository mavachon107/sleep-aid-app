# Sommeil — sons calmes

Petite PWA qui synthétise, directement dans le navigateur, des sons destinés à favoriser l'endormissement. Aucune dépendance, aucun fichier audio : tout est généré en temps réel via la Web Audio API.

## Sons disponibles

Chaque son est étiqueté avec un niveau de preuve scientifique (solide / modéré / faible / aucune) et accompagné d'une courte explication accessible via le bouton « i ».

- **Bruits colorés** — blanc, rose, brun
- **Sons de la nature** — pluie, vagues (synthèse procédurale)
- **Battements binauraux** — delta (2 Hz), theta (6 Hz) — *casque obligatoire*
- **Fréquences pures** — 432 Hz, 528 Hz (Solfège, sans preuve clinique)

## Fonctionnement

- Sélection du son, lecture/pause, volume.
- Minuteur d'arrêt automatique (15, 30, 45, 60 ou 90 min) avec fondu sortant de 30 s avant la fin.
- Installable comme application (PWA) et utilisable hors-ligne après la première visite.

## Lancer en local

L'application doit être servie en HTTP (pas en `file://`) pour que les modules ES et le service worker fonctionnent :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Régénérer les icônes

```sh
node scripts/gen-icons.mjs
```

## Structure

```
index.html              point d'entrée
styles.css              thème sombre
service-worker.js       cache hors-ligne
manifest.webmanifest    métadonnées PWA
src/
  main.js               câblage UI ↔ moteur audio ↔ minuteur
  audio/                moteur partagé + générateurs (bruits, nature, binaural, tones)
  ui/                   contrôles et minuteur
  data/sounds.js        catalogue des sons + références scientifiques
scripts/gen-icons.mjs   génération des PNG d'icône
```
