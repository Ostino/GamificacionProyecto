import { COMBO_MAX, FINISH_OFFSET } from './config.js';
import { state } from './state.js';
import { getEffectiveSpeed } from './speed.js';

export function showFeedback(pid, txt, color) {
  const canvas = state.players[pid].canvas;
  const el = document.createElement('div');
  el.className = 'feedback-text';
  el.style.color = color;
  el.textContent = txt;
  canvas.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 600);
}

export function updatePowerButtons(pid) {
  const costs = [50, 30, 25];
  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`p${pid}-pow${i}`);
    btn.classList.toggle('active', state.players[pid].pts >= costs[i - 1]);
  }
}

export function updateUI(pid) {
  const p = state.players[pid];
  document.getElementById(`p${pid}-pts`).textContent = p.pts;
  document.getElementById(`p${pid}-combo`).textContent = p.combo;
  document.getElementById(`p${pid}-speed`).textContent = getEffectiveSpeed(pid).toFixed(1) + 'x';
  document.getElementById(`p${pid}-combo-fill`).style.width =
    Math.min(100, (p.combo / COMBO_MAX) * 100) + '%';
  updatePowerButtons(pid);
}

export function updateRacer(pid) {
  const p = state.players[pid];
  const trackEl = p.racer.parentElement;
  const trackW = trackEl.offsetWidth - FINISH_OFFSET - 20;
  p.racer.style.left = 20 + Math.min(1, p.progress) * trackW + 'px';
  p.racer.classList.toggle('turbo', p.comboActive);
}
