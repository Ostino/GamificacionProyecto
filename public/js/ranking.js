import { state } from './state.js';

export async function getRanking() {
  try {
    const response = await fetch('/api/ranking');
    if (!response.ok) throw new Error('Error al obtener ranking');
    return await response.json();
  } catch (err) {
    console.error('No se pudo conectar con el servidor de ranking:', err);
    return [];
  }
}

export async function renderRanking(highlightIdx) {
  const ranking = await getRanking();
  const tbody = document.getElementById('ranking-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';

ranking.slice(0, 10).forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIdx) tr.classList.add('new-entry');
    
    tr.innerHTML = `
      <td class="rank-pos">${i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : i + 1}</td>
      <td class="rank-initials" style="color:${entry.color || '#ffffff'}">${entry.initials}</td>
      <td style="color:#555577;font-size:11px">P${entry.player}</td>
      <td class="rank-time">${entry.time || '00:00.00'}</td>
      <td class="rank-pts">${entry.pts || 0} pts</td>`;
      
    tbody.appendChild(tr);
  });

  if (ranking.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:#333355;padding:16px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:3px">SIN ENTRADAS AÚN</td></tr>';
  }
}

export async function saveScore() {
  const i1 = document.getElementById('init1')?.value.toUpperCase() || '_';
  const i2 = document.getElementById('init2')?.value.toUpperCase() || '_';
  const i3 = document.getElementById('init3')?.value.toUpperCase() || '_';
  const initials = i1 + i2 + i3;
  
  let finalPts = 0;
  let finalTime = "00:00.00";

  if (typeof window.scoreDeRespaldo !== 'undefined' && window.scoreDeRespaldo !== null) {
    finalPts = parseInt(window.scoreDeRespaldo);
    finalTime = window.tiempoDeRespaldo || "00:00.00";
  }

  const winTitle = document.getElementById('win-title');
  let miColor = winTitle ? winTitle.style.color : "#ffffff";
  const miRolActual = window.miRolSignificado || 1;

  const entry = {
    initials: initials,
    player: miRolActual, 
    time: finalTime,
    pts: finalPts,       
    color: miColor
  };

  console.log("[SOCKET] Enviando este puntaje al servidor:", entry);

  try {
    const response = await fetch('/api/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });

    if (!response.ok) throw new Error('Error al guardar score');
    const resultado = await response.json();

    const highlightIdx = resultado.ranking.findIndex(
      r => r.initials === entry.initials && r.pts === entry.pts && r.time === entry.time
    );

    const saveBox = document.getElementById('save-box');
    if (saveBox) saveBox.style.setProperty('display', 'none', 'important');
    
    await renderRanking(highlightIdx);

    if (window.socket) {
      window.socket.emit('player_action', { tipo: 'UPDATE_RANKING' });
    }

  } catch (err) {
    console.error('Error al guardar puntuación en el servidor LAN:', err);
    alert('No se pudo comunicar con el servidor para guardar el puntaje.');
  }
}

export async function clearRanking() {
  try {
    const response = await fetch('/api/ranking/clear', { method: 'POST' });
    if (response.ok) await renderRanking();
  } catch (err) {
    console.error('Error al limpiar el ranking:', err);
  }
}