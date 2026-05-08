// Câblage de l'interface : sélection du son, bouton play/pause, volume, dialogue d'info.

import { SOUNDS, EVIDENCE_LABEL } from "../data/sounds.js";

export function setupSoundPicker({ onSelect, initialId }) {
  const btn = document.getElementById("sound-btn");
  const label = document.getElementById("sound-label");
  const list = document.getElementById("sound-list");

  let currentId = initialId;

  function render() {
    list.innerHTML = "";
    for (const s of SOUNDS) {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.id = s.id;
      li.setAttribute("aria-selected", s.id === currentId ? "true" : "false");
      li.innerHTML = `<span>${s.label}</span><span class="ev ${s.evidence}">${EVIDENCE_LABEL[s.evidence]}</span>`;
      li.addEventListener("click", () => {
        currentId = s.id;
        label.textContent = s.label;
        close();
        onSelect(s);
      });
      list.appendChild(li);
    }
  }

  function open() {
    render();
    list.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  function close() {
    list.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }
  function toggle() {
    list.hidden ? open() : close();
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });
  document.addEventListener("click", (e) => {
    if (!list.contains(e.target) && e.target !== btn) close();
  });

  const initial = SOUNDS.find((s) => s.id === initialId) ?? SOUNDS[0];
  label.textContent = initial.label;

  return {
    setSelected(id) {
      currentId = id;
      const s = SOUNDS.find((x) => x.id === id);
      if (s) label.textContent = s.label;
    },
  };
}

export function setupPlayButton({ onToggle, onPress }) {
  const btn = document.getElementById("play-btn");
  const icon = document.getElementById("play-icon");
  let playing = false;

  btn.addEventListener("click", () => {
    // onPress doit s'exécuter de façon synchrone dans le geste utilisateur
    // (nécessaire pour débloquer l'élément <audio> sur iOS).
    onPress?.();
    playing = !playing;
    setVisual(playing);
    onToggle(playing);
  });

  function setVisual(p) {
    btn.classList.toggle("playing", p);
    btn.setAttribute("aria-label", p ? "Pause" : "Lecture");
    // Pause icon vs play triangle
    icon.setAttribute(
      "d",
      p
        ? "M6 5h4v14H6zM14 5h4v14h-4z"
        : "M8 5v14l11-7z"
    );
  }

  return {
    setPlaying(p) {
      playing = p;
      setVisual(p);
    },
    setLoading(l) {
      btn.classList.toggle("loading", !!l);
      btn.disabled = !!l;
    },
    isPlaying: () => playing,
  };
}

export function setupVolume({ onChange, initial = 0.6 }) {
  const input = document.getElementById("volume");
  input.value = String(Math.round(initial * 100));
  input.addEventListener("input", () => {
    onChange(Number(input.value) / 100);
  });
}

export function setupTimerButton({ timer, onPresetChange }) {
  const btn = document.getElementById("timer-btn");
  const valEl = document.getElementById("timer-value");
  const cd = document.getElementById("countdown");

  function refresh() {
    valEl.textContent = String(timer.getDuration());
  }
  refresh();

  btn.addEventListener("click", () => {
    timer.cyclePreset();
    refresh();
    onPresetChange?.();
  });

  return {
    showCountdown(text) {
      cd.hidden = false;
      cd.textContent = text;
    },
    hideCountdown() {
      cd.hidden = true;
      cd.textContent = "";
    },
    refresh,
  };
}

export function setupInfoDialog() {
  const btn = document.getElementById("info-btn");
  const dlg = document.getElementById("info-dialog");
  const body = document.getElementById("info-body");

  btn.addEventListener("click", () => {
    body.innerHTML = SOUNDS.map(
      (s) => `
        <h3>${s.label} <span class="ev ${s.evidence}">— ${EVIDENCE_LABEL[s.evidence]}</span></h3>
        <p>${s.blurb}</p>`
    ).join("");
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  });
}
