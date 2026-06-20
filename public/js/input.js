import { HIT_TOLERANCE, HIT_ZONE_X, P1_KEYS, P2_KEYS } from './config.js';
import { togglePause } from './game.js';
import { onHit } from './notes.js';
import { usePower } from './powers.js';
import { state } from './state.js';

// Asumimos que inicializas el socket en el objeto window desde main.js o una variable global.
// Si prefieres importarlo de un archivo de red independiente, puedes cambiar esta línea.
const socket = window.socket;

function handleKey(e) {
  const key = e.key;

  // El control de pausa sigue siendo global o puedes limitarlo si lo deseas
// Dentro de handleKey(e) en input.js
  if (key === 'Escape') {
    togglePause(false); // Le pasamos false indicando que es una pausa nativa local
    return;
  }

  if (document.getElementById('win-screen').classList.contains('visible')) return;
  if (!state.gameRunning || state.gamePaused) return;

  // --- FILTRO DE SEGURIDAD PARA MULTIJUGADOR LAN ---
  // Si no se ha asignado rol todavía, no permitimos interactuar con el juego
  if (!state.miRol) return;

  // Si soy el Jugador 1, solo proceso mis teclas de notas y poderes
  if (state.miRol === 1) {
    // Validación de Notas P1
    if (P1_KEYS.includes(key.toLowerCase())) {
      procesarNotaLocal(1, key.toLowerCase());
      return;
    }
    // Validación de Poderes P1
    if (key === 'z' || key === 'Z') { usePowerLocal(1, 1); return; }
    if (key === 'x' || key === 'X') { usePowerLocal(1, 2); return; }
    if (key === 'c' || key === 'C') { usePowerLocal(1, 3); return; }
  }

  // Si soy el Jugador 2, solo proceso mis teclas de notas y poderes
  if (state.miRol === 2) {
    // Validación de Notas P2
    if (P2_KEYS.includes(key)) {
      procesarNotaLocal(2, key);
      return;
    }
    // Validación de Poderes P2 (Numpad)
    if (key === '1' && e.code === 'Numpad1') { usePowerLocal(2, 1); return; }
    if (key === '2' && e.code === 'Numpad2') { usePowerLocal(2, 2); return; }
    if (key === '3' && e.code === 'Numpad3') { usePowerLocal(2, 3); return; }
  }
}

// Función auxiliar para procesar los aciertos locales y enviarlos a la red
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
    
    // 1. Aplicamos el efecto en nuestra pantalla de inmediato
    onHit(pid);
    
    // 2. Le avisamos a la otra computadora por LAN que acertamos una nota
    if (socket) {
      socket.emit('player_action', { 
        tipo: 'HIT', 
        pid: pid,
        noteKey: actualKey // Enviamos cuál tecla fue por si necesitas más precisión visual en el rival
      });
    }
  }
}

// Función auxiliar para activar poderes localmente y sincronizarlos por red
function usePowerLocal(pid, powId) {
  const p = state.players[pid];
  const cost = p.powerCosts ? p.powerCosts[powId - 1] : 0; // O la lógica de coste que tengas en powers.js
  
  // Guardamos los puntos actuales para verificar si realmente se puede ejecutar el poder
  const puntosAntes = p.pts;
  
  // Ejecutamos el poder localmente
  usePower(pid, powId);
  
  // Si los puntos disminuyeron, significa que el poder se lanzó con éxito (tenías maná/puntos suficientes)
  if (p.pts < puntosAntes) {
    if (socket) {
      socket.emit('player_action', {
        tipo: 'POWER',
        pid: pid,
        powId: powId
      });
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
  // Manejo de clicks en botones de reintentar/guardar si existen en el DOM
  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (window.resetGame) window.resetGame();
      if (socket) socket.emit('player_action', { tipo: 'RESTART' });
    });
  }
}