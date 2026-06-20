import { BASE_SPEED, PROGRESS_PASSIVE } from './config.js';
import { state } from './state.js';
import { spawnTimers, updateNotes } from './notes.js';
import { renderRanking, getRanking } from './ranking.js';
import { getEffectiveSpeed } from './speed.js';
import { formatTime, getElapsedMs, updateTimer } from './timer.js';
import { updateRacer, updateUI } from './ui.js';

export function initRefs() {
  state.players[1].canvas = document.getElementById('p1-canvas');
  state.players[2].canvas = document.getElementById('p2-canvas');
  state.players[1].racer = document.getElementById('p1-racer');
  state.players[2].racer = document.getElementById('p2-racer');
  state.players[1].keyEls = {
    a: document.getElementById('kt-a'),
    s: document.getElementById('kt-s'),
    d: document.getElementById('kt-d'),
    w: document.getElementById('kt-w')
  };
  state.players[2].keyEls = {
    ArrowLeft: document.getElementById('kt-left'),
    ArrowDown: document.getElementById('kt-down'),
    ArrowRight: document.getElementById('kt-right'),
    ArrowUp: document.getElementById('kt-up')
  };
}

function checkWin(pid) {
  // Solo la computadora que controla a su propio jugador puede dictaminar su victoria
  if (state.players[pid].progress >= 1.0 && state.miRol === pid) {
    const finalTimeStr = formatTime(getElapsedMs());
    
    // 1. Ejecuta su fin de juego local
    endGame(pid, { time: finalTimeStr, pts: state.players[pid].pts });
    
    // 2. Le avisa inmediatamente al rival y le manda el tiempo congelado
    if (window.socket) {
      window.socket.emit('player_action', {
        tipo: 'FORCE_END_GAME',
        winPid: pid,
        time: finalTimeStr,
        pts: state.players[pid].pts
      });
    }
  }
}

// Función expuesta globalmente para que main.js pueda forzar el fin desde la red
export function endGame(winPid) {
  state.gameRunning = false;
  clearInterval(state.gameInterval);

  const winScreen = document.getElementById('win-screen');
  const winTitle = document.getElementById('win-title');
  
  // 1. DECLARACIÓN ÚNICA: Buscamos ambos nombres posibles desde el inicio
  const winStats = document.getElementById('win-stats') || document.getElementById('win-time');
  const saveBox = document.getElementById('save-box') || document.getElementById('initials-form');

  if (!winScreen) return;

  // Determinar si mi pantalla local es la que ganó o perdió
  const soyGanador = (state.miRol === winPid);
  window.miRolSignificado = state.miRol; 

  if (winTitle) {
    if (soyGanador) {
      winTitle.textContent = "¡VICTORIA!";
      winTitle.style.color = state.miRol === 1 ? "#00f5ff" : "#ff3cac"; 
    } else {
      winTitle.textContent = "DERROTA";
      winTitle.style.color = "#ff1a1a"; 
    }
  }

  // Extraer las estadísticas reales acumuladas con el rastreador de variables
const misDatos = state.players[state.miRol];
  let puntosFinales = 0;
  
  if (misDatos) {
    console.log("[DEBUG FIN DE JUEGO] Datos de mi jugador:", misDatos);
    // Forzamos a que lea directamente .pts que es la que tiene el valor 157
    puntosFinales = misDatos.pts ?? 0; 
  }

  const tiempoFinal = document.getElementById('timer')?.textContent || 
                      document.getElementById('timer-display')?.textContent || "00:00.00";

  // Guardamos con total seguridad en las variables globales que lee ranking.js
  window.scoreDeRespaldo = parseInt(puntosFinales) || 0;
  window.tiempoDeRespaldo = tiempoFinal;
  window.miRolSignificado = state.miRol;

  // Inyectar en el cuadro de texto del HTML
  if (winStats) {
    winStats.innerHTML = `TU TIEMPO: ${tiempoFinal} | TUS PUNTOS: ${window.scoreDeRespaldo} pts`;
  }

  winScreen.classList.add('visible');
  winScreen.style.display = 'flex';

  if (saveBox) {
    saveBox.style.setProperty('display', 'block', 'important');
  }
}

function gameFrame(timestamp) {
  if (!state.gameRunning) return;

  if (state.gamePaused) {
    state.lastTime = timestamp;
    state.gameLoop = requestAnimationFrame(gameFrame);
    return;
  }

  const dt = (timestamp - state.lastTime) / 1000;
  state.lastTime = timestamp;

  updateTimer();

  // Cada cliente procesa y transmite su propio avance
  if (state.gameRunning && (state.miRol === 1 || state.miRol === 2)) {
    const p = state.players[state.miRol];
    const spd = getEffectiveSpeed(state.miRol);
    p.progress += PROGRESS_PASSIVE * spd;
    if (p.progress > 1.0) p.progress = 1.0;

    if (window.socket) {
      window.socket.emit('player_action', {
        tipo: 'PROGRESS',
        pid: state.miRol,
        progress: p.progress
      });
    }
  }

  // Actualizaciones de pistas locales
  for (let pid = 1; pid <= 2; pid++) {
    updateNotes(pid, dt);
    updateRacer(pid);
    updateUI(pid);
    checkWin(pid);
  }

  if (state.gameRunning) {
    state.gameLoop = requestAnimationFrame(gameFrame);
  }
}

export function togglePause(isRemote = false) {
  if (!state.gameRunning) return;
  state.gamePaused = !state.gamePaused;
  const overlay = document.getElementById('pause-overlay');

  if (state.gamePaused) {
    state.pauseStartTime = performance.now();
    if (overlay) overlay.classList.add('visible');
  } else {
    state.totalPausedMs += performance.now() - state.pauseStartTime;
    state.lastTime = performance.now();
    if (overlay) overlay.classList.remove('visible');
  }

  if (!isRemote && window.socket) {
    window.socket.emit('player_action', { tipo: 'PAUSE' });
  }
}

export function startGame() {
  if (state.gameRunning) return;
  const startScreen = document.getElementById('start-screen');
  if (startScreen) startScreen.style.display = 'none';
  
  state.gameRunning = true;
  state.gamePaused = false;
  state.totalPausedMs = 0;
  initRefs();
  state.lastTime = performance.now();
  state.gameStartTime = performance.now();
  setTimeout(spawnTimers, 400);
  state.gameLoop = requestAnimationFrame(gameFrame);
}

export function resetGame() {
  const winScreen = document.getElementById('win-screen');
  const pauseOverlay = document.getElementById('pause-overlay');
  if (winScreen) winScreen.classList.remove('visible');
  if (pauseOverlay) pauseOverlay.classList.remove('visible');
  
  state.gamePaused = false;

  for (let pid = 1; pid <= 2; pid++) {
    const p = state.players[pid];
    p.pts = 0;
    p.combo = 0;
    p.baseSpeed = BASE_SPEED;
    p.bonusSpeed = 0;
    p.penaltySpeed = 1.0;
    p.comboActive = false;
    p.progress = 0;

    for (const n of p.notes) {
      if (n.el && n.el.parentNode) n.el.parentNode.removeChild(n.el);
    }
    p.notes = [];
    Object.values(p.powerTimers).forEach((t) => clearTimeout(t));
    p.powerTimers = {};

    updateRacer(pid);
    updateUI(pid);
  }

  state.gameRunning = false;
  cancelAnimationFrame(state.gameLoop);
}