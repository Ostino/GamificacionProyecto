import { state } from './state.js';

export function getEffectiveSpeed(pid) {
  const p = state.players[pid];
  let s = p.baseSpeed * p.penaltySpeed;
  if (p.comboActive) s = Math.min(s * 1.5, 3.0);
  s += p.bonusSpeed;
  return Math.max(0.2, s);
}
