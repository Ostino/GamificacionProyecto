import {
  COMBO_MAX,
  HIT_TOLERANCE,
  HIT_ZONE_X,
  NOTE_LANES,
  NOTE_SPEED,
  PROGRESS_HIT,
  PROGRESS_MISS
} from './config.js';
import { showPowerNotif } from './powers.js';
import { state } from './state.js';
import { getEffectiveSpeed } from './speed.js';
import { showFeedback, updateRacer, updateUI } from './ui.js';

export function spawnNote(pid) {
  const p = state.players[pid];
  const canvas = p.canvas;
  const canvasW = canvas.offsetWidth;
  const pool = state.activeKeys.length ? state.activeKeys : ['a','s','d','f'];
  const key = pool[Math.floor(Math.random() * pool.length)];
  const lane = Math.floor(Math.random() * NOTE_LANES);
  const NOTE_SIZE = 44;
  const CANVAS_H = 180;
  const y = 8 + lane * Math.floor((CANVAS_H - NOTE_SIZE - 8) / (NOTE_LANES - 1));
  const el = document.createElement('div');
  el.className = 'arrow-note';
  const col = pid === 1 ? '#2bdefe' : '#ff45eb';
  el.style.cssText = `left:${canvasW}px;top:${y}px;width:${NOTE_SIZE}px;height:${NOTE_SIZE}px;background:color-mix(in srgb,${col} 18%,#04040a);border:1.5px solid ${col};color:${col};box-shadow:0 0 8px color-mix(in srgb,${col} 35%,transparent);`;
  el.textContent = key.toUpperCase();
  el.dataset.key = key;
  canvas.appendChild(el);
  p.notes.push({ el, key, x: canvasW, hit: false, missed: false });
}

export function onHit(pid) {
  const p = state.players[pid];
  p.combo++;
  p.pts += 5 + Math.floor(p.combo / 3);
  if (p.combo >= COMBO_MAX) p.comboActive = true;
  p.progress += PROGRESS_HIT * getEffectiveSpeed(pid);
  updateUI(pid);
  showFeedback(pid, 'HIT', '#39ff14');
}

export function onMiss(pid) {
  const p = state.players[pid];
  const hadCombo = p.comboActive;
  p.combo = 0;
  p.comboActive = false;
  p.progress = Math.max(0, p.progress - PROGRESS_MISS * getEffectiveSpeed(pid));
  updateRacer(pid);
  updateUI(pid);
  showFeedback(pid, '✗ MISS', '#ff1a1a');
  if (hadCombo) showPowerNotif('P' + pid + ' perdió el combo!');
}

export function updateNotes(pid, dt, isLocal = true) {
  const p = state.players[pid];
  const speed = getEffectiveSpeed(pid);
  const noteSpd = NOTE_SPEED * speed;
  const toRemove = [];

  for (const n of p.notes) {
    if (n.hit || n.missed) {
      toRemove.push(n);
      continue;
    }
    n.x -= noteSpd * dt;
    n.el.style.left = n.x + 'px';
    if (n.x < HIT_ZONE_X - HIT_TOLERANCE - 14) {
      n.missed = true;
      n.el.style.opacity = '0';
      // Solo penalizar misses para el jugador local; el rival maneja los suyos en su PC
      if (isLocal) onMiss(pid);
      toRemove.push(n);
    }
  }

  for (const n of toRemove) {
    if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
    const idx = p.notes.indexOf(n);
    if (idx > -1) p.notes.splice(idx, 1);
  }
}
