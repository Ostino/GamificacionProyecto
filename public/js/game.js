import { BASE_SPEED, PROGRESS_PASSIVE, META } from './config.js';
import { state } from './state.js';
import { spawnNote, updateNotes } from './notes.js';
import { renderRanking, getRanking } from './ranking.js';
import { getEffectiveSpeed } from './speed.js';
import { formatTime, getElapsedMs, updateTimer } from './timer.js';
import { updateRacer, updateUI } from './ui.js';
import { startAudio, pauseAudio, resumeAudio, stopAudio, getAudioBeat } from './audio.js';

export function initRefs() {
  state.players[1].canvas = document.getElementById('p1-canvas');
  state.players[2].canvas = document.getElementById('p2-canvas');
  state.players[1].racer = document.getElementById('p1-racer');
  state.players[2].racer = document.getElementById('p2-racer');
}

function checkWin(pid) {
  if (state.players[pid].progress >= META && state.miRol === pid) {
    const finalTimeStr = formatTime(getElapsedMs());
    
    endGame(pid, { time: finalTimeStr, pts: state.players[pid].pts });
    
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

export function endGame(winPid) {
  state.gameRunning = false;
  clearInterval(state.gameInterval);

  const winScreen = document.getElementById('win-screen');
  const winTitle = document.getElementById('win-title');
  
  const winStats = document.getElementById('win-stats') || document.getElementById('win-time');
  const saveBox = document.getElementById('save-box') || document.getElementById('initials-form');

  if (!winScreen) return;

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

const misDatos = state.players[state.miRol];
  let puntosFinales = 0;
  
  if (misDatos) {
    console.log("[DEBUG FIN DE JUEGO] Datos de mi jugador:", misDatos);
    puntosFinales = misDatos.pts ?? 0; 
  }

  const tiempoFinal = document.getElementById('timer')?.textContent || 
                      document.getElementById('timer-display')?.textContent || "00:00.00";

  window.scoreDeRespaldo = parseInt(puntosFinales) || 0;
  window.tiempoDeRespaldo = tiempoFinal;
  window.miRolSignificado = state.miRol;

  if (winStats) {
    winStats.innerHTML = `TU TIEMPO: ${tiempoFinal} | TUS PUNTOS: ${window.scoreDeRespaldo} pts`;
  }

  stopAudio();
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

  // Spawn en cada beat de la canción; si el audio no cargó, fallback por timer
  const beat = getAudioBeat();
  if (beat >= 0) {
    if (beat > state.lastBeatIndex) {
      state.lastBeatIndex = beat;
      spawnNote(1);
      spawnNote(2);
    }
  } else {
    // Fallback: resta el tiempo pausado para que no quede por delante del audio
    const elapsed = performance.now() - state.gameStartTime - state.totalPausedMs;
    const fallbackBeat = Math.floor(Math.max(0, elapsed) / 510);
    if (fallbackBeat > state.lastBeatIndex) {
      state.lastBeatIndex = fallbackBeat;
      spawnNote(1);
      spawnNote(2);
    }
  }

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

  for (let pid = 1; pid <= 2; pid++) {
    updateNotes(pid, dt, pid === state.miRol);
    updateRacer(pid);
    updateUI(pid);
    checkWin(pid);
  }

  if (state.gameRunning) {
    state.gameLoop = requestAnimationFrame(gameFrame);
  }
}

// Aplica un estado de pausa concreto (true/false). No emite nada.
export function applyPauseState(shouldPause) {
  if (!state.gameRunning) return;
  if (state.gamePaused === shouldPause) return; // ya está en el estado correcto
  state.gamePaused = shouldPause;
  const overlay = document.getElementById('pause-overlay');
  if (shouldPause) {
    state.pauseStartTime = performance.now();
    try { pauseAudio(); } catch (_) {}
    if (overlay) overlay.classList.add('visible');
  } else {
    state.totalPausedMs += performance.now() - state.pauseStartTime;
    state.lastTime = performance.now();
    try { resumeAudio(); } catch (_) {}
    if (overlay) overlay.classList.remove('visible');
  }
}

// Toggle local: calcula el nuevo estado, lo aplica y lo envía al rival.
export function togglePause() {
  if (!state.gameRunning) return;
  const newPaused = !state.gamePaused;
  applyPauseState(newPaused);
  if (window.socket) {
    window.socket.emit('player_action', { tipo: 'PAUSE', paused: newPaused });
  }
}

export function startGame() {
  if (state.gameRunning) return;
  const startScreen = document.getElementById('start-screen');
  if (startScreen) startScreen.style.display = 'none';
  
  state.gameRunning = true;
  state.gamePaused = false;
  state.totalPausedMs = 0;
  state.lastBeatIndex = -1;
  initRefs();
  state.lastTime = performance.now();
  state.gameStartTime = performance.now();
  startAudio();
  state.gameLoop = requestAnimationFrame(gameFrame);
}

export function resetGame() {
  const winScreen = document.getElementById('win-screen');
  const pauseOverlay = document.getElementById('pause-overlay');
  if (winScreen) { winScreen.classList.remove('visible'); winScreen.style.display = 'none'; }
  if (pauseOverlay) pauseOverlay.classList.remove('visible');
  
  state.gamePaused = false;
  stopAudio();
  state.lastBeatIndex = -1;

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