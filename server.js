const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files from workspace root
app.use(express.static(path.join(__dirname)));

// Game dimensions
const TILE = 48;
const COLS = 15;
const ROWS = 13;
const ROUND_SECONDS = 150;

const starts = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: ROWS - 2 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
];

// In-memory Room storage
// Room code -> Room object
const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

// Generate random socket IDs
let socketIdCounter = 0;

wss.on("connection", (ws) => {
  const socketId = "player_" + (++socketIdCounter);
  ws.id = socketId;
  ws.roomCode = null;

  console.log(`Socket connected: ${socketId}`);

  ws.on("message", (messageStr) => {
    try {
      const msg = JSON.parse(messageStr);
      handleMessage(ws, msg);
    } catch (err) {
      console.error("Error handling ws message:", err);
    }
  });

  ws.on("close", () => {
    console.log(`Socket disconnected: ${ws.id}`);
    leaveRoom(ws);
  });
});

function handleMessage(ws, msg) {
  const { type, data } = msg;

  switch (type) {
    case "create_room": {
      const roomCode = generateRoomCode();
      const room = {
        code: roomCode,
        state: "lobby", // lobby | playing
        players: [],
        map: [],
        bombs: [],
        blasts: [],
        pickups: [],
        roundTime: ROUND_SECONDS,
        tickInterval: null,
        hostId: ws.id,
        mapVotes: {},
        currentMapType: "classic"
      };

      rooms.set(roomCode, room);
      joinPlayerToRoom(ws, room, data.name, data.kind);
      break;
    }

    case "join_room": {
      const code = (data.roomCode || "").toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        ws.send(JSON.stringify({ type: "error", data: { message: "Room not found!" } }));
        return;
      }
      if (room.state !== "lobby") {
        ws.send(JSON.stringify({ type: "error", data: { message: "Game already started in this room!" } }));
        return;
      }
      if (room.players.length >= 4) {
        ws.send(JSON.stringify({ type: "error", data: { message: "Room is full (max 4 players)!" } }));
        return;
      }
      joinPlayerToRoom(ws, room, data.name, data.kind);
      break;
    }

    case "quick_match": {
      // Find open lobby room
      let foundRoom = null;
      for (const [code, r] of rooms.entries()) {
        if (r.state === "lobby" && r.players.length < 4) {
          foundRoom = r;
          break;
        }
      }

      if (foundRoom) {
        joinPlayerToRoom(ws, foundRoom, data.name, data.kind);
      } else {
        // Create new room
        const roomCode = generateRoomCode();
        const room = {
          code: roomCode,
          state: "lobby",
          players: [],
          map: [],
          bombs: [],
          blasts: [],
          pickups: [],
          roundTime: ROUND_SECONDS,
          tickInterval: null,
          hostId: ws.id,
          mapVotes: {},
          currentMapType: "classic"
        };
        rooms.set(roomCode, room);
        joinPlayerToRoom(ws, room, data.name, data.kind);
      }
      break;
    }

    case "add_bot": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      if (room.players.length >= 4) return;

      const botKinds = ["momonga", "shisa", "chiikawa", "usagi", "hachiware"];
      // Pick a kind not heavily used
      const usedKinds = room.players.map((p) => p.kind);
      const kind = botKinds.find((k) => !usedKinds.includes(k)) || botKinds[Math.floor(Math.random() * botKinds.length)];

      const botId = "bot_" + Math.random().toString(36).substr(2, 9);
      const botNames = ["Momonga Bot", "Shisa Bot", "Chiikawa Bot", "Hachiware Bot", "Usagi Bot"];
      const name = botNames[Math.floor(Math.random() * botNames.length)] + " (CPU)";

      room.players.push({
        id: botId,
        name,
        kind,
        ready: true,
        ai: true,
        x: 0,
        y: 0,
        dx: 0,
        dy: 0,
        alive: true,
        speed: 142,
        bombs: 1,
        range: 2,
        cooldown: 0,
      });

      broadcastLobbyUpdate(room);
      break;
    }

    case "remove_bot": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      room.players = room.players.filter((p) => p.id !== data.botId);
      broadcastLobbyUpdate(room);
      break;
    }

    case "player_ready": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "lobby") return;
      const player = room.players.find((p) => p.id === ws.id);
      if (player) {
        player.ready = data.ready;
        broadcastLobbyUpdate(room);
      }
      break;
    }

    case "start_game": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      if (room.players.length < 1) return; // Allow solo testing with bots

      startRound(room, true);
      break;
    }

    case "move": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "playing") return;

      const playerId = data.id || ws.id; // Allow host to move bots
      const player = room.players.find((p) => p.id === playerId);
      if (player && player.alive) {
        player.x = data.x;
        player.y = data.y;
        player.dx = data.dx;
        player.dy = data.dy;

        // Check pickup collisions
        checkPickupCollision(room, player);
      }
      break;
    }

    case "place_bomb": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "playing") return;

      const playerId = data.id || ws.id; // Allow host to place bombs for bots
      const player = room.players.find((p) => p.id === playerId);
      if (player && player.alive && player.cooldown <= 0) {
        const tileX = Math.floor(player.x / TILE);
        const tileY = Math.floor(player.y / TILE);

        // Limit active bombs
        const activeBombsCount = room.bombs.filter((b) => b.ownerId === player.id).length;
        const tileHasBomb = room.bombs.some((b) => b.x === tileX && b.y === tileY);

        if (activeBombsCount < player.bombs && !tileHasBomb) {
          const bomb = {
            id: "bomb_" + Math.random().toString(36).substr(2, 9),
            x: tileX,
            y: tileY,
            ownerId: player.id,
            range: player.range,
            timer: 2.25,
          };
          room.bombs.push(bomb);
          player.cooldown = 0.25;

          broadcastToRoom(room, {
            type: "bomb_placed",
            data: { bomb },
          });
        }
      }
      break;
    }

    case "trigger_emote": {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      broadcastToRoom(room, {
        type: "emote_triggered",
        data: {
          playerId: ws.id,
          emote: data.emote,
        },
      });
      break;
    }

    case "vote_map": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "lobby") return;

      const mapChoice = data.map;
      if (["classic", "checkered", "colosseum"].includes(mapChoice)) {
        if (!room.mapVotes) room.mapVotes = {};
        room.mapVotes[ws.id] = mapChoice;

        // Tally votes
        const votes = { classic: 0, checkered: 0, colosseum: 0 };
        Object.values(room.mapVotes).forEach((v) => {
          if (votes[v] !== undefined) votes[v]++;
        });

        broadcastToRoom(room, {
          type: "map_votes_updated",
          data: { votes },
        });
      }
      break;
    }

    case "punch_bomb": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "playing") return;

      const playerId = data.id || ws.id;
      const player = room.players.find((p) => p.id === playerId);
      if (player && player.alive && player.hasPunch) {
        const faceX = Number.isFinite(data.faceX) ? Math.sign(data.faceX) : 0;
        const faceY = Number.isFinite(data.faceY) ? Math.sign(data.faceY) : 0;

        if ((faceX !== 0 || faceY !== 0) && (faceX === 0 || faceY === 0)) {
          const px = Math.floor(player.x / TILE);
          const py = Math.floor(player.y / TILE);

          const targetX = px + faceX;
          const targetY = py + faceY;

          // Find stationary bomb on that target cell
          const bomb = room.bombs.find((b) => b.x === targetX && b.y === targetY && (!b.vx || (b.vx === 0 && b.vy === 0)));
          if (bomb) {
            bomb.vx = faceX;
            bomb.vy = faceY;
            bomb.slideX = bomb.x;
            bomb.slideY = bomb.y;

            broadcastToRoom(room, {
              type: "bomb_punched",
              data: {
                bombId: bomb.id,
                vx: faceX,
                vy: faceY
              },
            });
          }
        }
      }
      break;
    }

    case "send_chat": {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === ws.id);
      if (player) {
        broadcastToRoom(room, {
          type: "chat_received",
          data: {
            playerId: ws.id,
            senderName: player.name,
            text: data.text,
          },
        });
      }
      break;
    }
  }
}

function joinPlayerToRoom(ws, room, name, kind) {
  // Limit lobby to 4
  if (room.players.length >= 4) {
    ws.send(JSON.stringify({ type: "error", data: { message: "Room is full!" } }));
    return;
  }

  ws.roomCode = room.code;

  const player = {
    id: ws.id,
    name: name || "Friend",
    kind: kind || "hachiware",
    ready: false,
    ai: false,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    alive: true,
    speed: 142,
    bombs: 1,
    range: 2,
    cooldown: 0,
  };

  room.players.push(player);
  console.log(`Player ${ws.id} joined room ${room.code}`);

  ws.send(
    JSON.stringify({
      type: "room_joined",
      data: {
        roomCode: room.code,
        playerId: ws.id,
      },
    })
  );

  broadcastLobbyUpdate(room);
}

function leaveRoom(ws) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  room.players = room.players.filter((p) => p.id !== ws.id);
  if (room.mapVotes) {
    delete room.mapVotes[ws.id];
    if (room.state === "lobby") {
      const votes = { classic: 0, checkered: 0, colosseum: 0 };
      Object.values(room.mapVotes).forEach((v) => {
        if (votes[v] !== undefined) votes[v]++;
      });
      broadcastToRoom(room, {
        type: "map_votes_updated",
        data: { votes },
      });
    }
  }
  console.log(`Player ${ws.id} left room ${room.code}`);

  if (room.players.length === 0 || room.players.every((p) => p.ai)) {
    // Destroy room
    if (room.tickInterval) clearInterval(room.tickInterval);
    if (room.nextRoundTimeout) clearTimeout(room.nextRoundTimeout);
    rooms.delete(room.code);
    console.log(`Room ${room.code} deleted (empty)`);
  } else {
    // Select new host if host disconnected
    if (room.hostId === ws.id) {
      const humanPlayers = room.players.filter((p) => !p.ai);
      if (humanPlayers.length > 0) {
        room.hostId = humanPlayers[0].id;
      } else {
        room.hostId = room.players[0].id;
      }
      console.log(`New host for room ${room.code}: ${room.hostId}`);
    }

    if (room.state === "lobby") {
      broadcastLobbyUpdate(room);
    } else if (room.state === "playing") {
      // Check if game should end
      checkGameEnd(room);
    }
  }

  ws.roomCode = null;
}

function broadcastLobbyUpdate(room) {
  broadcastToRoom(room, {
    type: "lobby_updated",
    data: {
      roomCode: room.code,
      hostId: room.hostId,
      players: room.players,
    },
  });
}

function broadcastToRoom(room, msg) {
  const payload = JSON.stringify(msg);
  // Get all socket clients for this room
  wss.clients.forEach((client) => {
    if (client.roomCode === room.code && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function checkPickupCollision(room, player) {
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);

  const pickupIdx = room.pickups.findIndex((p) => p.x === px && p.y === py);
  if (pickupIdx !== -1) {
    const pickup = room.pickups[pickupIdx];
    room.pickups.splice(pickupIdx, 1);

    if (pickup.type === "flame") {
      player.range = Math.min(5, player.range + 1);
    } else if (pickup.type === "bomb") {
      player.bombs = Math.min(4, player.bombs + 1);
    } else if (pickup.type === "speed") {
      player.speed = Math.min(202, player.speed + 18);
    } else if (pickup.type === "full_fire") {
      player.range = 15;
    } else if (pickup.type === "punch") {
      player.hasPunch = true;
    }

    broadcastToRoom(room, {
      type: "pickup_collected",
      data: {
        pickupId: `${pickup.x}_${pickup.y}`,
        playerId: player.id,
        pickups: room.pickups,
        playerStats: {
          id: player.id,
          range: player.range,
          bombs: player.bombs,
          speed: player.speed,
          hasPunch: !!player.hasPunch,
        },
      },
    });
  }
}

function tickRoom(room) {
  const dt = 0.05; // 50ms tick

  // Update round timer
  room.roundTime = Math.max(0, room.roundTime - dt);
  if (room.roundTime <= 0) {
    endGame(room, "Time up!");
    return;
  }

  // Update player bomb cooldowns
  room.players.forEach((p) => {
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
  });

  // Update sliding bombs on server
  room.bombs.forEach((bomb) => {
    if (bomb.vx !== undefined && bomb.vy !== undefined && (bomb.vx !== 0 || bomb.vy !== 0)) {
      if (bomb.slideX === undefined) bomb.slideX = bomb.x;
      if (bomb.slideY === undefined) bomb.slideY = bomb.y;

      bomb.slideX += bomb.vx * 6.0 * dt;
      bomb.slideY += bomb.vy * 6.0 * dt;

      if (bomb.vx > 0) {
        if (bomb.slideX >= bomb.x + 1) {
          if (isTileSolidForBombServer(room, bomb.x + 2, bomb.y)) {
            bomb.x = bomb.x + 1;
            bomb.slideX = bomb.x;
            bomb.vx = 0;
          } else {
            bomb.x = bomb.x + 1;
          }
        }
      } else if (bomb.vx < 0) {
        if (bomb.slideX <= bomb.x - 1) {
          if (isTileSolidForBombServer(room, bomb.x - 2, bomb.y)) {
            bomb.x = bomb.x - 1;
            bomb.slideX = bomb.x;
            bomb.vx = 0;
          } else {
            bomb.x = bomb.x - 1;
          }
        }
      } else if (bomb.vy > 0) {
        if (bomb.slideY >= bomb.y + 1) {
          if (isTileSolidForBombServer(room, bomb.x, bomb.y + 2)) {
            bomb.y = bomb.y + 1;
            bomb.slideY = bomb.y;
            bomb.vy = 0;
          } else {
            bomb.y = bomb.y + 1;
          }
        }
      } else if (bomb.vy < 0) {
        if (bomb.slideY <= bomb.y - 1) {
          if (isTileSolidForBombServer(room, bomb.x, bomb.y - 2)) {
            bomb.y = bomb.y - 1;
            bomb.slideY = bomb.y;
            bomb.vy = 0;
          } else {
            bomb.y = bomb.y - 1;
          }
        }
      }
    }
  });

  // Tick bombs
  const exploded = [];
  room.bombs.forEach((bomb) => {
    bomb.timer -= dt;
    if (bomb.timer <= 0) {
      exploded.push(bomb);
    }
  });

  exploded.forEach((bomb) => {
    triggerExplosion(room, bomb);
  });

  // Broadcast positions tick
  broadcastToRoom(room, {
    type: "state_update",
    data: {
      players: room.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        dx: p.dx,
        dy: p.dy,
        alive: p.alive,
        speed: p.speed,
        bombs: p.bombs,
        range: p.range,
      })),
      roundTime: room.roundTime,
    },
  });
}

function triggerExplosion(room, bomb) {
  // Remove from bombs
  room.bombs = room.bombs.filter((b) => b.id !== bomb.id);

  const cells = [{ x: bomb.x, y: bomb.y, center: true }];
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  const destroyedCrates = [];
  const spawnedPickups = [];

  dirs.forEach((dir) => {
    for (let i = 1; i <= bomb.range; i++) {
      const x = bomb.x + dir.x * i;
      const y = bomb.y + dir.y * i;
      if (!room.map[y] || !room.map[y][x] || room.map[y][x] === "wall") break;
      cells.push({ x, y, dir });

      if (room.map[y][x] === "crate") {
        room.map[y][x] = "grass";
        destroyedCrates.push({ x, y });

        // Spawn pickups
        const roll = Math.random();
        let type = null;
        if (roll < 0.18) type = "flame";
        else if (roll < 0.32) type = "bomb";
        else if (roll < 0.44) type = "speed";
        else if (roll < 0.50) type = "full_fire";
        else if (roll < 0.56) type = "punch";

        if (type) {
          const pickup = { x, y, type };
          room.pickups.push(pickup);
          spawnedPickups.push(pickup);
        }
        break;
      }
    }
  });

  // Kill players
  const deadPlayers = [];
  cells.forEach((cell) => {
    room.players.forEach((p) => {
      if (!p.alive) return;
      const gx = Math.floor(p.x / TILE);
      const gy = Math.floor(p.y / TILE);
      if (gx === cell.x && gy === cell.y) {
        p.alive = false;
        deadPlayers.push(p.id);
      }
    });
  });

  // Chain reaction with other bombs
  room.bombs.forEach((other) => {
    if (cells.some((cell) => cell.x === other.x && cell.y === other.y)) {
      other.timer = Math.min(other.timer, 0.04);
    }
  });

  // Broadcast explosion event
  broadcastToRoom(room, {
    type: "bomb_exploded",
    data: {
      bombId: bomb.id,
      cells,
      destroyedCrates,
      spawnedPickups,
      deadPlayers,
      map: room.map,
    },
  });

  // Check if round is over
  checkGameEnd(room);
}

function checkGameEnd(room) {
  if (room.state !== "playing") return;

  const alivePlayers = room.players.filter((p) => p.alive);
  if (alivePlayers.length <= 1) {
    let winnerId = null;
    if (alivePlayers.length === 1) {
      winnerId = alivePlayers[0].id;
    }
    endRound(room, winnerId);
  }
}

function endRound(room, winnerId) {
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }

  // Clear any existing next round timeouts
  if (room.nextRoundTimeout) {
    clearTimeout(room.nextRoundTimeout);
    room.nextRoundTimeout = null;
  }

  // Increment trophies
  let winner = null;
  if (winnerId) {
    winner = room.players.find((p) => p.id === winnerId);
    if (winner) {
      winner.trophies = (winner.trophies || 0) + 1;
    }
  }

  // Check tournament victory (8 trophies)
  const grandWinner = room.players.find((p) => (p.trophies || 0) >= 8);

  if (grandWinner) {
    room.state = "lobby";
    room.players.forEach((p) => {
      p.ready = p.ai; // Reset ready states
    });

    broadcastToRoom(room, {
      type: "game_over",
      data: {
        message: `${grandWinner.name} wins the Match! 🏆`,
        players: room.players,
        tournamentFinished: true,
        winnerId: grandWinner.id
      },
    });
  } else {
    room.state = "round_over";
    broadcastToRoom(room, {
      type: "game_over",
      data: {
        message: winner ? `${winner.name} wins the Round!` : "Draw!",
        players: room.players,
        tournamentFinished: false,
        winnerId: winner ? winner.id : null
      },
    });

    // Automatically start next round after 8 seconds (leaving time for clients to animate round results)
    room.nextRoundTimeout = setTimeout(() => {
      if (room.state === "round_over") {
        startRound(room, false);
      }
    }, 8000);
  }
}

function generateMap(mapType) {
  const nextMap = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => {
      // Outer walls
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return "wall";
      
      if (mapType === "colosseum") {
        // Open center, only corner pillars
        if ((x === 3 || x === COLS - 4) && (y === 3 || y === ROWS - 4)) return "wall";
        return Math.random() < 0.5 ? "crate" : "grass";
      } else if (mapType === "checkered") {
        // Checkered pattern walls: if x and y are even
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        // Extra indestructible walls forming a diamond pattern
        if ((x === 3 || x === COLS - 4) && (y === 3 || y === ROWS - 4)) return "wall";
        return Math.random() < 0.6 ? "crate" : "grass";
      } else {
        // Classic: strict grid unbreakable blocks
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        return Math.random() < 0.66 ? "crate" : "grass";
      }
    })
  );
  
  // Clear safe spots for each starting position
  starts.forEach((s) => {
    const clearSafe = (x, y) => {
      if (nextMap[y] && nextMap[y][x] && nextMap[y][x] !== "wall") {
        nextMap[y][x] = "grass";
      }
    };
    clearSafe(s.x, s.y);
    clearSafe(s.x + Math.sign(COLS / 2 - s.x), s.y);
    clearSafe(s.x, s.y + Math.sign(ROWS / 2 - s.y));
  });

  return nextMap;
}

function isTileSolidForBombServer(room, tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
  const cellType = room.map[ty][tx];
  if (cellType === "wall" || cellType === "crate" || cellType === "zone") return true;
  const hasBomb = room.bombs.some((b) => b.x === tx && b.y === ty && (!b.vx || (b.vx === 0 && b.vy === 0)));
  if (hasBomb) return true;
  const hasPlayer = room.players.some((p) => p.alive && Math.floor(p.x / TILE) === tx && Math.floor(p.y / TILE) === ty);
  if (hasPlayer) return true;
  return false;
}

function startRound(room, isNewTournament) {
  if (isNewTournament) {
    // Determine winning map from room.mapVotes
    const votes = { classic: 0, checkered: 0, colosseum: 0 };
    Object.values(room.mapVotes || {}).forEach((v) => {
      if (votes[v] !== undefined) votes[v]++;
    });

    let winningMap = "classic";
    let maxVotes = votes.classic;

    if (votes.checkered > maxVotes) {
      winningMap = "checkered";
      maxVotes = votes.checkered;
    }
    if (votes.colosseum > maxVotes) {
      winningMap = "colosseum";
    } else if (votes.colosseum === maxVotes && maxVotes > 0 && Math.random() < 0.5) {
      if (winningMap === "classic" || (winningMap === "checkered" && Math.random() < 0.5)) {
        winningMap = "colosseum";
      }
    }
    
    room.currentMapType = winningMap;
    // Reset votes for next tournament map choice
    room.mapVotes = {};
  }

  const mapType = room.currentMapType || "classic";
  room.map = generateMap(mapType);

  // Position players
  room.players.forEach((p, index) => {
    const spawn = starts[index % starts.length];
    p.x = spawn.x * TILE + TILE / 2;
    p.y = spawn.y * TILE + TILE / 2;
    p.dx = 0;
    p.dy = 0;
    p.alive = true;
    p.speed = 142;
    p.bombs = 1;
    p.range = 2;
    p.cooldown = 0;
    p.hasPunch = false; // Reset glove at round start
    if (isNewTournament) {
      p.trophies = 0;
    }
  });

  room.bombs = [];
  room.blasts = [];
  room.pickups = [];
  room.roundTime = ROUND_SECONDS;
  room.state = "playing";

  // Broadcast start
  broadcastToRoom(room, {
    type: "game_started",
    data: {
      map: room.map,
      players: room.players,
      mapType: mapType
    },
  });

  // Start tick loop at 20 FPS (every 50ms)
  if (room.tickInterval) clearInterval(room.tickInterval);
  room.tickInterval = setInterval(() => tickRoom(room), 50);
}

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
