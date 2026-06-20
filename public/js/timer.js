import { state } from './state.js';

export function getElapsedMs() {
  if (!state.gameRunning) return 0;
  return performance.now() - state.gameStartTime - state.totalPausedMs;
}

export function formatTime(ms) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const tenth = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenth}`;
}

export function updateTimer() {
  if (!state.gameRunning || state.gamePaused) return;
  document.getElementById('timer-display').textContent = formatTime(getElapsedMs());
}
