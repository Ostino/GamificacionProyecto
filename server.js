const express = require('express');
const path = require('path');
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 3000,   
  pingInterval: 1000   
});
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const RANKING_FILE = path.join(__dirname, 'ranking.json');

function leerRanking() {
  try {
    if (!fs.existsSync(RANKING_FILE)) fs.writeFileSync(RANKING_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8') || '[]');
  } catch (err) { return []; }
}

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'CRitmo.html')); });
app.get('/api/ranking', (req, res) => { res.json(leerRanking()); });
app.post('/api/ranking', (req, res) => {
  try {
    const newEntry = req.body; 
    
    // Asegurar que los puntos se procesen como números enteros
    newEntry.pts = parseInt(newEntry.pts) || 0;
    
    let ranking = leerRanking();
    ranking.push(newEntry);
    
    // ORDENAMIENTO COMPUESTO: Prioriza Puntos, desempata por Tiempo
    ranking.sort((a, b) => {
      // 1. Si los puntos son distintos, el que tenga más puntos va primero
      if (b.pts !== a.pts) {
        return b.pts - a.pts;
      }
      // 2. Si tienen los mismos puntos, el que tenga MENOR tiempo va primero
      // (Compara las cadenas de texto "00:45.20" < "00:52.10")
      return a.time.localeCompare(b.time);
    });
    
    // Cortar estrictamente al Top 10
    ranking = ranking.slice(0, 10);
    
    fs.writeFileSync(RANKING_FILE, JSON.stringify(ranking, null, 2));
    res.json({ success: true, ranking });
  } catch (error) {
    console.error("Error al guardar en ranking:", error);
    res.status(500).json({ error: "No se pudo guardar la puntuación" });
  }
});
// --- CONTROL ROBUSTO DE JUGADORES ---
let conectados = { p1: null, p2: null };

io.on('connection', (socket) => {
  // Verificamos si este socket id ya fue registrado para evitar duplicados extravagantes
  if (conectados.p1 === socket.id || conectados.p2 === socket.id) return;

  let rol = null;

  // Asignación estricta de ranuras libres
  if (!conectados.p1) {
    conectados.p1 = socket.id;
    rol = 1;
    console.log(`[SERVER] Jugador 1 asignado a: ${socket.id}`);
  } else if (!conectados.p2) {
    conectados.p2 = socket.id;
    rol = 2;
    console.log(`[SERVER] Jugador 2 asignado a: ${socket.id}`);
  } else {
    console.log(`[SERVER] Espectador conectado: ${socket.id}`);
  }

  // Le respondemos de inmediato su rol
  socket.emit('init_role', { role: rol });

  // Si con esta conexión logramos tener a ambos, avisamos a la sala
  if (conectados.p1 && conectados.p2) {
    io.emit('both_players_ready');
  }

  socket.on('host_start_game', () => {
    if (socket.id === conectados.p1) {
      io.emit('start_game_signal');
    }
  });

  socket.on('player_action', (data) => {
    socket.broadcast.emit('rival_action', data);
  });

  socket.on('disconnect', () => {
    if (conectados.p1 === socket.id) {
      conectados.p1 = null;
      console.log(`[SERVER] Libera ranura Jugador 1`);
    } else if (conectados.p2 === socket.id) {
      conectados.p2 = null;
      console.log(`[SERVER] Libera ranura Jugador 2`);
    }
    io.emit('player_disconnected');
  });
});

// ZeroTier

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  let zeroTierIP = null;

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Solo nos interesan direcciones IPv4 que no sean internas (localhost)
      if (iface.family === 'IPv4' && !iface.internal) {
        // Si el nombre de la interfaz contiene 'zerotier' o 'zt', la priorizamos inmediatamente
        if (name.toLowerCase().includes('zerotier') || name.toLowerCase().includes('zt')) {
          zeroTierIP = iface.address;
        } else {
          localIP = iface.address; // Guardamos la IP LAN normal como respaldo
        }
      }
    }
  }

  // Si encontramos una IP de ZeroTier, usamos esa; si no, usamos la de la red local normal
  return zeroTierIP ? zeroTierIP : localIP;
}

// Escuchar en el puerto 3000 apuntando a '0.0.0.0' 
// Esto permite que el servidor acepte conexiones de CUALQUIER interfaz de red (LAN, Local y ZeroTier)
// Escuchar en el puerto 3000 apuntando a '0.0.0.0' usando SERVER.LISTEN (vital para Socket.io)
const HOST_IP = getLocalIP();

server.listen(PORT, '0.0.0.0', () => {
  console.log('===================================================');
  console.log(`🚀 SERVIDOR RHYTHM RACE CORRIENDO EN RED VIRTUAL`);
  console.log(`🏠 IP local/LAN de respaldo: http://localhost:${PORT}`);
  console.log(`🌐 DIRECCIÓN PARA TU RIVAL (ZeroTier): http://${HOST_IP}:${PORT}`);
  console.log('===================================================');
  console.log('Asegúrate de que ambos estén unidos y autorizados en el panel de ZeroTier.');
});
//red local normal sin zerotier
/*
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }

  // Prioriza interfaces que no sean ZeroTier
  const preferred = candidates.find(c => !c.name.toLowerCase().includes('zerotier'));
  return preferred ? preferred.address : (candidates[0]?.address || 'localhost');
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('========================================');
  console.log('  RHYTHM RACE - MULTIPLAYER LAN ACTIVE');
  console.log('========================================');
  console.log(`  Local:  http://localhost:${PORT}`);
  console.log(`  Red:    http://${ip}:${PORT}`);
  console.log('========================================');
});
*/