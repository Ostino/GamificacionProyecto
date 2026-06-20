import { state } from './state.js';

// Consulta el ranking a la API del servidor LAN (Se exporta correctamente)
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

// Renderiza el ranking en el DOM limitado estrictamente a un Top 10
export async function renderRanking(highlightIdx) {
  const ranking = await getRanking();
  const tbody = document.getElementById('ranking-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  // Cortamos estrictamente a los mejores 10 puestos
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

// Guarda la puntuación personal calculada en cada pantalla independiente
export async function saveScore() {
// 1. Capturar las iniciales
  const i1 = document.getElementById('init1')?.value.toUpperCase() || '_';
  const i2 = document.getElementById('init2')?.value.toUpperCase() || '_';
  const i3 = document.getElementById('init3')?.value.toUpperCase() || '_';
  const initials = i1 + i2 + i3;
  
  // 2. EXTRAER PUNTOS Y TIEMPO (Priorizando las variables del juego sobre el texto del DOM)
 // Dentro de saveScore()...
  let finalPts = 0;
  let finalTime = "00:00.00";

  // Leemos directamente los respaldos numéricos de la ventana
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

    // Buscar en qué posición del top 10 quedó para resaltarlo
    const highlightIdx = resultado.ranking.findIndex(
      r => r.initials === entry.initials && r.pts === entry.pts && r.time === entry.time
    );

    // Ocultar la caja de guardar
    const saveBox = document.getElementById('save-box');
    if (saveBox) saveBox.style.setProperty('display', 'none', 'important');
    
    // Renderizar localmente el nuevo Top 10
    await renderRanking(highlightIdx);

    // ¡CRÍTICO! Avisar al rival por WebSockets para que su pantalla actualice el ranking automáticamente
    if (window.socket) {
      window.socket.emit('player_action', { tipo: 'UPDATE_RANKING' });
    }

  } catch (err) {
    console.error('Error al guardar puntuación en el servidor LAN:', err);
    alert('No se pudo comunicar con el servidor para guardar el puntaje.');
  }
}

// Borra por completo el archivo json mediante la API
export async function clearRanking() {
  try {
    const response = await fetch('/api/ranking/clear', { method: 'POST' });
    if (response.ok) await renderRanking();
  } catch (err) {
    console.error('Error al limpiar el ranking:', err);
  }
}