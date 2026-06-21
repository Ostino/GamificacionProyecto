import { BASE_SPEED } from './config.js';

export const state = {
  miRol: null,
  gameRunning: false,
  gamePaused: false,
  gameLoop: null,
  lastTime: 0,
  gameStartTime: 0,
  pauseStartTime: 0,
  totalPausedMs: 0,
  winnerData: null,
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
