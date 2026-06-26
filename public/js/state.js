import { BASE_SPEED, QWERTY_ROWS } from './config.js';

export function updateActiveRows(rows) {
  state.activeRows = rows;
  state.activeKeys = rows.flatMap(r => QWERTY_ROWS[r - 1]);
}

export const state = {
  activeRows: [1, 2, 3],
  activeKeys: [...QWERTY_ROWS[0], ...QWERTY_ROWS[1], ...QWERTY_ROWS[2]],
  miRol: null,
  gameRunning: false,
  gamePaused: false,
  gameLoop: null,
  lastTime: 0,
  gameStartTime: 0,
  pauseStartTime: 0,
  totalPausedMs: 0,
  winnerData: null,
  lastBeatIndex: -1,
  players: {
    1: {
      pts: 0,
      combo: 0,
      baseSpeed: BASE_SPEED,
      bonusSpeed: 0,
      penaltySpeed: 1.0,
      comboActive: false,
      progress: 0,
      notes: [],
      powerTimers: {},
      canvas: null,
      racer: null,
      color: '#00f5ff'
    },
    2: {
      pts: 0,
      combo: 0,
      baseSpeed: BASE_SPEED,
      bonusSpeed: 0,
      penaltySpeed: 1.0,
      comboActive: false,
      progress: 0,
      notes: [],
      powerTimers: {},
      canvas: null,
      racer: null,
      color: '#ff3cac'
    }
  }
};
