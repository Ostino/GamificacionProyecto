import { ALL_KEYS, HIT_TOLERANCE, HIT_ZONE_X } from './config.js';
import { togglePause } from './game.js';
import { onHit } from './notes.js';
import { usePower } from './powers.js';
import { state } from './state.js';

const socket = window.socket;

function handleKey(e) {
  const key = e.key;

  if (key === 'Escape') {
    togglePause(false);
    return;
  }

  if (document.getElementById('win-screen').classList.contains('visible')) return;
  if (!state.gameRunning || state.gamePaused) return;
  if (!state.miRol) return;

  const pid = state.miRol;

  // Notas: cualquier letra A-Z — solo cuenta para el jugador de esta computadora
  if (ALL_KEYS.includes(key.toLowerCase())) {
    procesarNotaLocal(pid, key.toLowerCase());
    return;
  }

  // Poderes: Espacio = poder 1, 4 = poder 2, 7 = poder 3
  if (key === ' ') { e.preventDefault(); usePowerLocal(pid, 1); return; }
  if (key === '4') { usePowerLocal(pid, 2); return; }
  if (key === '7') { usePowerLocal(pid, 3); return; }
}

function procesarNotaLocal(pid, actualKey) {
  const p = state.players[pid];
  let best = null;
  let bestDist = Infinity;

  for (const n of p.notes) {
    if (n.hit || n.missed) continue;
    const dist = Math.abs(n.x - HIT_ZONE_X);
    if (dist < HIT_TOLERANCE + 14 && n.key === actualKey && dist < bestDist) {
      best = n;
      bestDist = dist;
    }
  }

  if (best) {
    best.hit = true;
    best.el.style.opacity = '0';
    onHit(pid);
    if (socket) {
      socket.emit('player_action', {
        tipo: 'HIT',
        pid: pid,
        noteKey: actualKey
      });
    }
  }
}

function usePowerLocal(pid, powId) {
  const p = state.players[pid];
  const puntosAntes = p.pts;
  usePower(pid, powId);
  if (p.pts < puntosAntes) {
    if (socket) {
      socket.emit('player_action', { tipo: 'POWER', pid: pid, powId: powId });
    }
  }
}

export function setupInput() {
  window.addEventListener('keydown', handleKey);
  setupInitialsInputs();
  setupButtons();
}

function setupInitialsInputs() {
  ['init1', 'init2', 'init3'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.value = el.value.toUpperCase();
      if (el.value && idx < 2) {
        const nextEl = document.getElementById(['init1', 'init2', 'init3'][idx + 1]);
        if (nextEl) nextEl.focus();
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !el.value && idx > 0) {
        const prevEl = document.getElementById(['init1', 'init2', 'init3'][idx - 1]);
        if (prevEl) prevEl.focus();
      }
      if (e.key === 'Enter' && window.saveScore) window.saveScore();
      e.stopPropagation();
    });
  });
}

function setupButtons() {
  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (window.resetGame) window.resetGame();
    });
  }
}
