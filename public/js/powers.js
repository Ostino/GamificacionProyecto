import { POWER_COSTS, POWER_DURATION } from './config.js';
import { state } from './state.js';
import { updateUI } from './ui.js';

export function showPowerNotif(msg) {
  const el = document.getElementById('power-notification');
  el.textContent = msg.toUpperCase();
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.style.opacity = '0';
  }, 2000);
}

export function flashPanel(pid, color) {
  const panel = document.getElementById(`p${pid}-panel`);
  const fl = document.createElement('div');
  fl.className = 'effect-flash';
  fl.style.background = color;
  panel.appendChild(fl);
  setTimeout(() => {
    if (fl.parentNode) fl.parentNode.removeChild(fl);
  }, 300);
}

export function usePower(pid, powId) {
  if (!state.gameRunning || state.gamePaused) return;

  const p = state.players[pid];
  const cost = POWER_COSTS[powId - 1];
  if (p.pts < cost) return;

  const rival = pid === 1 ? 2 : 1;
  p.pts -= cost;
  updateUI(pid);

  if (powId === 1) {
    state.players[rival].bonusSpeed = state.players[rival].baseSpeed;
    showPowerNotif(`P${pid} TURBO RIVAL → P${rival} va a x2!`);
    flashPanel(rival, '#ff1a1a');
    clearTimeout(state.players[rival].powerTimers.p1);
    state.players[rival].powerTimers.p1 = setTimeout(() => {
      state.players[rival].bonusSpeed = 0;
    }, POWER_DURATION);
  } else if (powId === 2) {
    p.bonusSpeed = p.baseSpeed * 0.5;
    showPowerNotif(`P${pid} BOOST! velocidad extra`);
    flashPanel(pid, '#ffd700');
    clearTimeout(p.powerTimers.p2);
    p.powerTimers.p2 = setTimeout(() => {
      p.bonusSpeed = 0;
    }, POWER_DURATION);
  } else if (powId === 3) {
    state.players[rival].penaltySpeed = 0.75;
    showPowerNotif(`P${pid} FRENÓ a P${rival}!`);
    flashPanel(rival, '#ff6600');
    clearTimeout(state.players[rival].powerTimers.p3);
    state.players[rival].powerTimers.p3 = setTimeout(() => {
      state.players[rival].penaltySpeed = 1.0;
    }, POWER_DURATION);
  }
}
