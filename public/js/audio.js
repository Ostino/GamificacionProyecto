import { BEAT_INTERVAL, BEAT_OFFSET } from './config.js';

let audioCtx = null;
let audioBuffer = null;
let sourceNode = null;
let startContextTime = 0;
let loaded = false;
let started = false;

export async function loadAudio() {
  try {
    const res = await fetch('/Pista.mp3');
    if (!res.ok) { console.warn('[AUDIO] No se encontró /Pista.mp3'); return; }
    const arrayBuf = await res.arrayBuffer();
    audioCtx = new AudioContext();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
    loaded = true;
    console.log('[AUDIO] Pista cargada y decodificada.');
  } catch (e) {
    console.warn('[AUDIO] Error cargando pista:', e);
  }
}

export function startAudio() {
  if (!loaded || !audioCtx || !audioBuffer) {
    console.warn('[AUDIO] Pista no lista aún.');
    return;
  }
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioCtx.destination);
    sourceNode.start(0);
    startContextTime = audioCtx.currentTime;
    started = true;
  } catch (e) {
    console.warn('[AUDIO] Error al iniciar audio:', e);
  }
}

export function pauseAudio() {
  if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
}

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

export function stopAudio() {
  if (sourceNode) {
    try { sourceNode.stop(0); } catch (_) {}
    sourceNode.disconnect();
    sourceNode = null;
  }
  started = false;
}

// Devuelve el índice del beat actual según el reloj del AudioContext.
// Retorna -1 si el audio no ha comenzado.
// Como audioCtx.currentTime se congela al suspender, la pausa funciona sola.
export function getAudioBeat() {
  if (!started || !audioCtx) return -1;
  // Si el contexto sigue suspendido (resume falló o aún no completó), usar fallback
  if (audioCtx.state === 'suspended') return -1;
  const elapsed = audioCtx.currentTime - startContextTime - BEAT_OFFSET;
  if (elapsed < 0) return -1;
  return Math.floor(elapsed / BEAT_INTERVAL);
}
