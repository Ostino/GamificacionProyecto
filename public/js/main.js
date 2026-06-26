import { state, updateActiveRows } from './state.js';
import { startGame, resetGame, endGame, togglePause } from './game.js';
import { setupInput } from './input.js';
import { saveScore, clearRanking, renderRanking } from './ranking.js';
import { usePower } from './powers.js';
import { updateUI } from './ui.js';
import { updateRacer } from './ui.js';

function applyRowUpdate(rows) {
  updateActiveRows(rows);
  document.querySelectorAll('.key-map-row[data-row]').forEach(rowEl => {
    const r = parseInt(rowEl.dataset.row);
    const active = rows.includes(r);
    rowEl.classList.toggle('row-active', active);
    rowEl.classList.toggle('row-inactive', !active);
  });
}

function setupRowSelector() {
  const hint = document.getElementById('row-selector-hint');
  if (hint) hint.classList.add('visible');

  document.querySelectorAll('.key-map-row[data-row]').forEach(rowEl => {
    rowEl.classList.add('row-selectable');
    rowEl.addEventListener('click', () => {
      if (state.gameRunning) return;
      const r = parseInt(rowEl.dataset.row);
      let newRows = [...state.activeRows];
      if (newRows.includes(r)) {
        if (newRows.length === 1) return;
        newRows = newRows.filter(x => x !== r);
      } else {
        newRows.push(r);
        newRows.sort();
      }
      if (window.socket) window.socket.emit('host_row_change', { rows: newRows });
    });
  });
}

function showReadyScreen() {
  const startScreen = document.getElementById('start-screen');
  const subTitle = document.querySelector('.start-sub');
  if (startScreen) startScreen.style.display = '';
  if (!subTitle) return;
  if (state.miRol === 1) {
    subTitle.innerHTML = `
      <span style="color:#39ff14; font-size:18px; font-weight:bold;">¡RIVAL CONECTADO!</span><br><br>
      <button onclick="window.hostSendStart()" style="display:block; margin:0 auto; padding:14px 28px; font-family:'Orbitron',sans-serif; font-size:16px; background:#2bdefe; color:#000000; border:none; cursor:pointer; font-weight:900; box-shadow: 0 0 15px #2bdefe; border-radius:4px; letter-spacing:2px;">INICIAR CARRERA</button>
    `;
  } else if (state.miRol === 2) {
    subTitle.innerHTML = `<span style="display:block; text-align:center; color:#39ff14; font-size:18px; font-weight:bold;">¡CONECTADO AL HOST!</span><br><span style="display:block; text-align:center; color:#2bdefe;">ESPERANDO QUE EL JUGADOR 1 HAGA CLICK EN EMPEZAR...</span>`;
  }
}

window.startGame = startGame;
window.resetGame = function() {
  resetGame();
  if (window.socket) window.socket.emit('player_action', { tipo: 'RESTART' });
  showReadyScreen();
};
window.saveScore = saveScore;
window.clearRanking = clearRanking;
window.usePower = usePower;

window.hostSendStart = function() {
  if (window.socket && state.miRol === 1) {
    window.socket.emit('host_start_game');
  }
};

function startCountdown(onDone) {
  const startScreen = document.getElementById('start-screen');
  if (startScreen) startScreen.style.display = 'none';

  const overlay = document.getElementById('countdown-overlay');
  const numEl = document.getElementById('countdown-number');
  overlay.classList.add('visible');

  const steps = [
    { text: '3', go: false, duration: 1000 },
    { text: '2', go: false, duration: 1000 },
    { text: '1', go: false, duration: 1000 },
    { text: 'GO!', go: true,  duration: 700  },
  ];
  let i = 0;

  function tick() {
    if (i >= steps.length) {
      overlay.classList.remove('visible');
      onDone();
      return;
    }
    const { text, go, duration } = steps[i];
    numEl.className = go ? 'go' : '';
    numEl.textContent = text;
    numEl.style.animationName = 'none';
    void numEl.offsetHeight;
    numEl.style.animationName = '';
    i++;
    setTimeout(tick, duration);
  }
  tick();
}

function setupSocketListeners() {
  const socket = window.socket;
  if (!socket) return;

  socket.on('init_role', (data) => {
    state.miRol = data.role;
    const subTitle = document.querySelector('.start-sub');
    if (subTitle) {
      if (state.miRol === 1) {
        subTitle.innerHTML = `<span style="color:#00f5ff; font-size:20px; font-weight:900;">ERES EL JUGADOR 1 (HOST)</span><br><span style="font-size:12px; color:#666699;">ESPERANDO NUEVO RIVAL EN LA OTRA PC...</span>`;
        setupRowSelector();
      } else if (state.miRol === 2) {
        subTitle.innerHTML = `<span style="color:#ff3cac; font-size:20px; font-weight:900;">ERES EL JUGADOR 2</span><br><span style="font-size:12px; color:#666699;">CONECTADO CON ÉXITO. ESPERANDO QUE EL HOST INICIE...</span>`;
      } else {
        subTitle.innerHTML = `<span style="color:#ff1a1a; font-size:18px; font-weight:900;">SALA LLENA — MODO ESPECTADOR</span>`;
      }
    }
  });

  socket.on('both_players_ready', (data) => {
    showReadyScreen();
    if (data && data.activeRows) applyRowUpdate(data.activeRows);
  });

  socket.on('rows_updated', (data) => {
    if (data && data.rows) applyRowUpdate(data.rows);
  });

  socket.on('start_game_signal', () => {
    startCountdown(() => startGame());
  });

  socket.on('rival_action', (data) => {
    switch (data.tipo) {
      case 'FORCE_END_GAME':
        endGame(data.winPid);
        break;

      case 'PROGRESS':
        if (state.players[data.pid]) {
          state.players[data.pid].progress = data.progress;
          updateRacer(data.pid);
          updateUI(data.pid);
        }
        break;

      case 'POWER':
        if (!state.gameRunning) return;
        usePower(data.pid, data.powId);
        break;

      case 'PAUSE':
        togglePause(true); 
        break;

      case 'RESTART':
        resetGame();
        showReadyScreen();
        break;

      case 'UPDATE_RANKING':
        console.log("[LAN] Ranking actualizado por el ganador. Actualizando pantalla local...");
        renderRanking();
        break;
    }
  });

  socket.on('player_disconnected', () => {
    if (!state.gameRunning) {
      const subTitle = document.querySelector('.start-sub');
      if (state.miRol === 1 && subTitle) {
        subTitle.innerHTML = `<span style="color:#00f5ff; font-size:20px; font-weight:900;">ERES EL JUGADOR 1 (HOST)</span><br><span style="font-size:12px; color:#666699;">EL RIVAL SE DESCONECTÓ. ESPERANDO NUEVO RIVAL...</span>`;
      }
      return;
    }
    if (state.gameRunning && !state.gamePaused) {
      togglePause(true);
    }
    alert("El rival se ha desconectado de la partida.");
  });
}

function init() {
  try {
    setupSocketListeners();
    setupInput();
    updateUI(1);
    updateUI(2);
  } catch (err) {
    console.error('Error al inicializar:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}