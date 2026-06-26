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
app.get('/Guia.png', (req, res) => { res.sendFile(path.join(__dirname, 'Guia.png')); });
app.get('/Pista.mp3', (req, res) => { res.sendFile(path.join(__dirname, 'Pista.mp3')); });
app.get('/api/ranking', (req, res) => { res.json(leerRanking()); });
app.post('/api/ranking', (req, res) => {
  try {
    const newEntry = req.body; 
    
    newEntry.pts = parseInt(newEntry.pts) || 0;
    
    let ranking = leerRanking();
    ranking.push(newEntry);
    
    ranking.sort((a, b) => {
      if (b.pts !== a.pts) {
        return b.pts - a.pts;
      }
      return a.time.localeCompare(b.time);
    });
    
    ranking = ranking.slice(0, 10);
    
    fs.writeFileSync(RANKING_FILE, JSON.stringify(ranking, null, 2));
    res.json({ success: true, ranking });
  } catch (error) {
    console.error("Error al guardar en ranking:", error);
    res.status(500).json({ error: "No se pudo guardar la puntuación" });
  }
});
app.post('/api/ranking/clear', (req, res) => {
  try {
    fs.writeFileSync(RANKING_FILE, JSON.stringify([], null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo borrar el ranking' });
  }
});

let conectados = { p1: null, p2: null };
let activeRows = [1, 2, 3];

io.on('connection', (socket) => {
  if (conectados.p1 === socket.id || conectados.p2 === socket.id) return;

  let rol = null;

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

  socket.emit('init_role', { role: rol });

  if (conectados.p1 && conectados.p2) {
    io.emit('both_players_ready', { activeRows });
  }

  socket.on('host_start_game', () => {
    if (socket.id === conectados.p1) {
      io.emit('start_game_signal');
    }
  });

  socket.on('host_row_change', (data) => {
    if (socket.id === conectados.p1 && Array.isArray(data.rows) && data.rows.length > 0) {
      activeRows = data.rows;
      io.emit('rows_updated', { rows: activeRows });
    }
  });

  socket.on('player_action', (data) => {
    socket.broadcast.emit('rival_action', data);
  });

  socket.on('disconnect', () => {
    if (conectados.p1 === socket.id) {
      conectados.p1 = null;
      activeRows = [1, 2, 3];
      console.log(`[SERVER] Libera ranura Jugador 1`);
    } else if (conectados.p2 === socket.id) {
      conectados.p2 = null;
      console.log(`[SERVER] Libera ranura Jugador 2`);
    }
    io.emit('player_disconnected');
  });
});

function getIPs() {
  const interfaces = os.networkInterfaces();
  let lanIP = null;
  let zeroTierIP = null;

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (name.toLowerCase().includes('zerotier') || name.toLowerCase().includes('zt')) {
          zeroTierIP = iface.address;
        } else {
          lanIP = iface.address;
        }
      }
    }
  }

  return { lanIP, zeroTierIP };
}

server.listen(PORT, '0.0.0.0', () => {
  const { lanIP, zeroTierIP } = getIPs();
  console.log('===================================================');
  console.log('  RHYTHM RACE — SERVIDOR ACTIVO');
  console.log('===================================================');
  console.log(`  Local:      http://localhost:${PORT}`);
  if (lanIP) {
    console.log(`  Red local:  http://${lanIP}:${PORT}  `);
  }
  if (zeroTierIP) {
    console.log(`  ZeroTier:   http://${zeroTierIP}:${PORT} `);
  }
  console.log('===================================================');
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