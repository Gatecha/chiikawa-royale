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

// Tournament config
const TROPHIES_TO_WIN = 8;        // Team trophies needed to win (or trigger final vote)
const STANDARD_MAX_PLAYERS = 4;   // Quick match / standard mode cap
const TEAM_MAX_PLAYERS = 6;        // Team mode cap (3v3)
const MATCHMAKING_FILL_ALONE = 40; // Seconds alone before CPU fill
const MATCHMAKING_FILL_PARTIAL = 40; // Seconds with 1-2 players before fill
const FINAL_VOTE_SECONDS = 20;     // Vote timer duration

const starts = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: ROWS - 2 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
];

// In-memory Room storage
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
      leaveRoom(ws);
      const roomCode = generateRoomCode();
      const room = createRoomObject(roomCode, ws.id, data.mode || "team");
      room.isPrivate = data.isPrivate || false;
      rooms.set(roomCode, room);
      joinPlayerToRoom(ws, room, data.name, data.kind);
      // Start matchmaking fill timer only if not private
      if (!room.isPrivate) {
        scheduleMatchmakingFill(room);
      }
      break;
    }

    case "start_matchmaking": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;

      // Try to find another open lobby room that is public and has space for all human players of this room
      const humanCount = room.players.filter(p => !p.ai).length;
      let targetRoom = null;
      for (const [code, r] of rooms.entries()) {
        if (r.code === room.code) continue;
        const maxPlayers = r.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
        if (r.state === "lobby" && !r.isPrivate && (r.players.length + humanCount) <= maxPlayers) {
          targetRoom = r;
          break;
        }
      }

      if (targetRoom) {
        console.log(`Matching room ${room.code} into existing public room ${targetRoom.code}`);
        const clientsToMove = [];
        wss.clients.forEach((client) => {
          if (client.roomCode === room.code && client.readyState === WebSocket.OPEN) {
            clientsToMove.push(client);
          }
        });

        clientsToMove.forEach((client) => {
          const playerInfo = room.players.find(p => p.id === client.id);
          const name = playerInfo ? playerInfo.name : "Friend";
          const kind = playerInfo ? playerInfo.kind : "hachiware";
          const originalSquadCode = playerInfo && playerInfo.squadCode ? playerInfo.squadCode : room.code;
          leaveRoom(client);
          joinPlayerToRoom(client, targetRoom, name, kind, originalSquadCode);
        });
      } else {
        room.isPrivate = false;
        scheduleMatchmakingFill(room);
      }
      break;
    }

    case "select_character": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "lobby") return;
      const player = room.players.find((p) => p.id === ws.id);
      if (player) {
        player.kind = data.kind;
        broadcastLobbyUpdate(room);
      }
      break;
    }

    case "cancel_matchmaking": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      room.isPrivate = true;
      if (room.matchmakingTimer) {
        clearTimeout(room.matchmakingTimer);
        room.matchmakingTimer = null;
      }
      if (room.matchmakingCountdownInterval) {
        clearInterval(room.matchmakingCountdownInterval);
        room.matchmakingCountdownInterval = null;
      }
      room.matchmakingFillSecondsLeft = 0;
      broadcastToRoom(room, {
        type: "matchmaking_countdown",
        data: { secondsLeft: 0 }
      });
      broadcastLobbyUpdate(room);
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
      const maxPlayers = room.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
      if (room.players.length >= maxPlayers) {
        ws.send(JSON.stringify({ type: "error", data: { message: `Room is full (max ${maxPlayers} players)!` } }));
        return;
      }

      leaveRoom(ws);
      joinPlayerToRoom(ws, room, data.name, data.kind);
      // Reset matchmaking timer to longer window when a real player joins
      if (room.matchmakingTimer) {
        clearTimeout(room.matchmakingTimer);
        room.matchmakingTimer = null;
      }
      if (room.matchmakingCountdownInterval) {
        clearInterval(room.matchmakingCountdownInterval);
        room.matchmakingCountdownInterval = null;
      }
      if (room.players.filter(p => !p.ai).length < maxPlayers) {
        scheduleMatchmakingFill(room);
      }
      break;
    }

    case "quick_match": {
      leaveRoom(ws);
      // Find open lobby room with space (allows team or standard mode)
      let foundRoom = null;
      for (const [code, r] of rooms.entries()) {
        const maxPlayers = r.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
        if (r.state === "lobby" && !r.isPrivate && r.players.length < maxPlayers) {
          foundRoom = r;
          break;
        }
      }

      if (foundRoom) {
        joinPlayerToRoom(ws, foundRoom, data.name, data.kind);
        // Reset fill timer now that another real player joined
        if (foundRoom.matchmakingTimer) {
          clearTimeout(foundRoom.matchmakingTimer);
          foundRoom.matchmakingTimer = null;
        }
        if (foundRoom.matchmakingCountdownInterval) {
          clearInterval(foundRoom.matchmakingCountdownInterval);
          foundRoom.matchmakingCountdownInterval = null;
        }
        const maxPlayers = foundRoom.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
        if (foundRoom.players.filter(p => !p.ai).length < maxPlayers) {
          scheduleMatchmakingFill(foundRoom);
        }
      } else {
        // Create new room
        const roomCode = generateRoomCode();
        const room = createRoomObject(roomCode, ws.id, "standard");
        room.isPrivate = false;
        rooms.set(roomCode, room);
        joinPlayerToRoom(ws, room, data.name, data.kind);
        scheduleMatchmakingFill(room);
      }
      break;
    }

    case "add_bot": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      const maxPlayers = room.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
      if (room.players.length >= maxPlayers) return;
      addBotToRoom(room);
      broadcastLobbyUpdate(room);
      break;
    }

    case "remove_bot": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      room.players = room.players.filter((p) => p.id !== data.botId);
      removePlayerFromTeams(room, data.botId);
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
      if (room.players.length < 1) return;

      // Clear matchmaking timers when game starts manually
      if (room.matchmakingTimer) { clearTimeout(room.matchmakingTimer); room.matchmakingTimer = null; }
      if (room.matchmakingCountdownInterval) { clearInterval(room.matchmakingCountdownInterval); room.matchmakingCountdownInterval = null; }

      startRound(room, true);
      break;
    }

    case "submit_vote": {
      // Team final vote: player submits who they want to represent their team
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "final_vote") return;
      const voter = room.players.find(p => p.id === ws.id && !p.ai);
      if (!voter) return;
      const votedId = data.votedPlayerId;
      // Validate voted player is on same team as voter
      const voterTeam = room.teams.A.includes(ws.id) ? "A" : "B";
      const votedPlayer = room.players.find(p => p.id === votedId);
      if (!votedPlayer) return;
      const votedTeam = room.teams.A.includes(votedId) ? "A" : "B";
      if (voterTeam !== votedTeam) return;

      room.finalVotes[ws.id] = votedId;
      broadcastToRoom(room, {
        type: "vote_updated",
        data: { votes: room.finalVotes }
      });

      // Check if all human players from each team have voted
      const humanA = room.teams.A.filter(id => !room.players.find(p => p.id === id && p.ai));
      const humanB = room.teams.B.filter(id => !room.players.find(p => p.id === id && p.ai));
      const allVoted = [...humanA, ...humanB].every(id => room.finalVotes[id]);
      if (allVoted) {
        if (room.voteTimer) { clearTimeout(room.voteTimer); room.voteTimer = null; }
        resolveFinalVote(room);
      }
      break;
    }

    case "move": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "playing") return;

      const playerId = data.id || ws.id;
      // In team mode, only active round players can move
      if (room.mode === "team" && room.activeRoundPlayers && !room.activeRoundPlayers.includes(playerId)) return;

      const player = room.players.find((p) => p.id === playerId);
      if (player && player.alive) {
        player.x = data.x;
        player.y = data.y;
        player.dx = data.dx;
        player.dy = data.dy;
        checkPickupCollision(room, player);
      }
      break;
    }

    case "place_bomb": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "playing") return;

      const playerId = data.id || ws.id;
      // In team mode, only active round players can place bombs
      if (room.mode === "team" && room.activeRoundPlayers && !room.activeRoundPlayers.includes(playerId)) return;

      const player = room.players.find((p) => p.id === playerId);
      if (player && player.alive && player.cooldown <= 0) {
        const tileX = Math.floor(player.x / TILE);
        const tileY = Math.floor(player.y / TILE);
        const activeBombsCount = room.bombs.filter((b) => b.ownerId === player.id).length;
        const tileHasBomb = room.bombs.some((b) => b.x === tileX && b.y === tileY);
        if (activeBombsCount < player.bombs && !tileHasBomb) {
          const bomb = {
            id: "bomb_" + Math.random().toString(36).substr(2, 9),
            x: tileX, y: tileY,
            ownerId: player.id,
            range: player.range,
            timer: 2.25,
          };
          room.bombs.push(bomb);
          player.cooldown = 0.25;
          broadcastToRoom(room, { type: "bomb_placed", data: { bomb } });
        }
      }
      break;
    }

    case "trigger_emote": {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      broadcastToRoom(room, {
        type: "emote_triggered",
        data: { playerId: ws.id, emote: data.emote },
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
        const votes = { classic: 0, checkered: 0, colosseum: 0 };
        Object.values(room.mapVotes).forEach((v) => { if (votes[v] !== undefined) votes[v]++; });
        broadcastToRoom(room, { type: "map_votes_updated", data: { votes } });
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
          const bomb = room.bombs.find((b) => b.x === px + faceX && b.y === py + faceY && (!b.vx || (b.vx === 0 && b.vy === 0)));
          if (bomb) {
            bomb.vx = faceX; bomb.vy = faceY;
            bomb.slideX = bomb.x; bomb.slideY = bomb.y;
            broadcastToRoom(room, { type: "bomb_punched", data: { bombId: bomb.id, vx: faceX, vy: faceY } });
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
          data: { playerId: ws.id, senderName: player.name, text: data.text },
        });
      }
      break;
    }
  }
}

// ----------------------------------------------------------------
// ROOM CREATION HELPER
// ----------------------------------------------------------------

function createRoomObject(roomCode, hostId, mode = "standard") {
  return {
    code: roomCode,
    state: "lobby",
    mode,   // "standard" | "team"
    players: [],
    map: [],
    bombs: [],
    blasts: [],
    pickups: [],
    roundTime: ROUND_SECONDS,
    tickInterval: null,
    nextRoundTimeout: null,
    hostId,
    mapVotes: {},
    currentMapType: "classic",
    // Team mode fields
    teams: { A: [], B: [] },
    teamTrophies: { A: 0, B: 0 },
    rotationQueues: { A: [], B: [] },
    activeRoundPlayers: [],
    usedThisCycle: { A: [], B: [] },
    roundNumber: 0,
    // Final vote
    finalVoteActive: false,
    finalVotes: {},
    voteTimer: null,
    voteCountdownInterval: null,
    finalRoundActive: false,
    // Matchmaking
    matchmakingTimer: null,
    matchmakingCountdownInterval: null,
    matchmakingFillSecondsLeft: 0,
  };
}

// ----------------------------------------------------------------
// PLAYER JOIN
// ----------------------------------------------------------------

function joinPlayerToRoom(ws, room, name, kind, squadCode = null) {
  const maxPlayers = room.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
  if (room.players.length >= maxPlayers) {
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
    squadCode: squadCode || room.code,
    x: 0, y: 0,
    dx: 0, dy: 0,
    alive: true,
    speed: 142,
    bombs: 1,
    range: 2,
    cooldown: 0,
    trophies: 0,
  };

  room.players.push(player);
  console.log(`Player ${ws.id} joined room ${room.code} (${room.players.length} players)`);

  // Check if this triggers team mode (5th or 6th player joins)
  if (room.players.length >= 5 && room.mode !== "team") {
    activateTeamMode(room);
  } else if (room.mode === "team") {
    assignPlayerToTeam(room, player);
  }

  ws.send(JSON.stringify({
    type: "room_joined",
    data: { roomCode: room.code, playerId: ws.id },
  }));

  broadcastLobbyUpdate(room);

  // Auto-start if lobby is full of real players
  if (room.players.length >= maxPlayers) {
    if (room.matchmakingTimer) {
      clearTimeout(room.matchmakingTimer);
      room.matchmakingTimer = null;
    }
    if (room.matchmakingCountdownInterval) {
      clearInterval(room.matchmakingCountdownInterval);
      room.matchmakingCountdownInterval = null;
    }
    setTimeout(() => {
      if (room.state === "lobby") {
        startRound(room, true);
      }
    }, 2000);
  }
}

// ----------------------------------------------------------------
// TEAM MODE ACTIVATION
// ----------------------------------------------------------------

function activateTeamMode(room) {
  room.mode = "team";
  room.teams = { A: [], B: [] };

  // Assign existing players to teams (first half = A, second half = B)
  room.players.forEach((p, i) => {
    if (i < 3) {
      room.teams.A.push(p.id);
    } else {
      room.teams.B.push(p.id);
    }
  });

  room.teamTrophies = { A: 0, B: 0 };
  resetRotationQueues(room);

  console.log(`Room ${room.code} activated TEAM MODE. Team A: ${room.teams.A}, Team B: ${room.teams.B}`);
}

function assignPlayerToTeam(room, player) {
  // Assign new player to whichever team has fewer members
  if (room.teams.A.length <= room.teams.B.length) {
    room.teams.A.push(player.id);
  } else {
    room.teams.B.push(player.id);
  }
  resetRotationQueues(room);
}

function removePlayerFromTeams(room, playerId) {
  if (!room.teams) return;
  room.teams.A = room.teams.A.filter(id => id !== playerId);
  room.teams.B = room.teams.B.filter(id => id !== playerId);
  resetRotationQueues(room);
}

function resetRotationQueues(room) {
  // Shuffle each team's player order for rotation
  room.rotationQueues = {
    A: shuffleArray([...room.teams.A]),
    B: shuffleArray([...room.teams.B])
  };
  room.usedThisCycle = { A: [], B: [] };
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ----------------------------------------------------------------
// LEAVE ROOM
// ----------------------------------------------------------------

function leaveRoom(ws) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  room.players = room.players.filter((p) => p.id !== ws.id);
  // Remove from team arrays
  removePlayerFromTeams(room, ws.id);
  if (room.mapVotes) {
    delete room.mapVotes[ws.id];
    if (room.state === "lobby") {
      const votes = { classic: 0, checkered: 0, colosseum: 0 };
      Object.values(room.mapVotes).forEach((v) => { if (votes[v] !== undefined) votes[v]++; });
      broadcastToRoom(room, { type: "map_votes_updated", data: { votes } });
    }
  }
  console.log(`Player ${ws.id} left room ${room.code}`);

  if (room.players.length === 0 || room.players.every((p) => p.ai)) {
    destroyRoom(room);
  } else {
    if (room.hostId === ws.id) {
      const humanPlayers = room.players.filter((p) => !p.ai);
      room.hostId = humanPlayers.length > 0 ? humanPlayers[0].id : room.players[0].id;
      console.log(`New host for room ${room.code}: ${room.hostId}`);
    }
    if (room.state === "lobby") broadcastLobbyUpdate(room);
    else if (room.state === "playing") checkGameEnd(room);
  }

  ws.roomCode = null;
}

function destroyRoom(room) {
  if (room.tickInterval) clearInterval(room.tickInterval);
  if (room.nextRoundTimeout) clearTimeout(room.nextRoundTimeout);
  if (room.matchmakingTimer) clearTimeout(room.matchmakingTimer);
  if (room.matchmakingCountdownInterval) clearInterval(room.matchmakingCountdownInterval);
  if (room.voteTimer) clearTimeout(room.voteTimer);
  if (room.voteCountdownInterval) clearInterval(room.voteCountdownInterval);
  rooms.delete(room.code);
  console.log(`Room ${room.code} destroyed`);
}

// ----------------------------------------------------------------
// BROADCAST HELPERS
// ----------------------------------------------------------------

function broadcastLobbyUpdate(room) {
  broadcastToRoom(room, {
    type: "lobby_updated",
    data: {
      roomCode: room.code,
      hostId: room.hostId,
      players: room.players,
      mode: room.mode,
      teams: room.teams,
      teamTrophies: room.teamTrophies,
      isPrivate: room.isPrivate,
      state: room.state,
    },
  });
}

function broadcastToRoom(room, msg) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.roomCode === room.code && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ----------------------------------------------------------------
// MATCHMAKING FILL TIMERS
// ----------------------------------------------------------------

function scheduleMatchmakingFill(room) {
  const humanCount = room.players.filter(p => !p.ai).length;
  const maxPlayers = room.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
  if (humanCount >= maxPlayers) return;

  const waitSeconds = humanCount <= 1 ? MATCHMAKING_FILL_ALONE : MATCHMAKING_FILL_PARTIAL;
  let secondsLeft = waitSeconds;
  room.matchmakingFillSecondsLeft = secondsLeft;

  // Countdown broadcast every second
  if (room.matchmakingCountdownInterval) clearInterval(room.matchmakingCountdownInterval);
  room.matchmakingCountdownInterval = setInterval(() => {
    secondsLeft--;
    room.matchmakingFillSecondsLeft = secondsLeft;
    if (secondsLeft <= 0 || room.state !== "lobby") {
      clearInterval(room.matchmakingCountdownInterval);
      room.matchmakingCountdownInterval = null;
    } else {
      broadcastToRoom(room, {
        type: "matchmaking_countdown",
        data: { secondsLeft }
      });
    }
  }, 1000);

  // Main fill timer
  if (room.matchmakingTimer) clearTimeout(room.matchmakingTimer);
  room.matchmakingTimer = setTimeout(() => {
    if (room.state !== "lobby") return;
    if (room.matchmakingCountdownInterval) {
      clearInterval(room.matchmakingCountdownInterval);
      room.matchmakingCountdownInterval = null;
    }
    broadcastToRoom(room, {
      type: "matchmaking_countdown",
      data: { secondsLeft: 0 }
    });
    fillWithBots(room);
  }, waitSeconds * 1000);
}

function fillWithBots(room) {
  const maxPlayers = room.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
  while (room.players.length < maxPlayers && room.state === "lobby") {
    addBotToRoom(room);
  }
  broadcastLobbyUpdate(room);
  // Auto-start after 2s
  setTimeout(() => {
    if (room.state === "lobby") {
      startRound(room, true);
    }
  }, 2000);
}

function addBotToRoom(room) {
  const botKinds = ["momonga", "chiikawa", "usagi", "hachiware"];
  const usedKinds = room.players.map((p) => p.kind);
  const kind = botKinds.find((k) => !usedKinds.includes(k)) || botKinds[Math.floor(Math.random() * botKinds.length)];
  const botId = "bot_" + Math.random().toString(36).substr(2, 9);
  const botNames = ["Momonga Bot", "Chiikawa Bot", "Hachiware Bot", "Usagi Bot"];
  const name = botNames[Math.floor(Math.random() * botNames.length)] + " (CPU)";

  const bot = {
    id: botId, name, kind,
    ready: true, ai: true,
    x: 0, y: 0, dx: 0, dy: 0,
    alive: true, speed: 142, bombs: 1, range: 2, cooldown: 0, trophies: 0,
  };
  room.players.push(bot);

  // Assign to team if team mode
  if (room.mode === "team") {
    if (room.teams.A.length <= room.teams.B.length) {
      room.teams.A.push(botId);
    } else {
      room.teams.B.push(botId);
    }
    resetRotationQueues(room);
  }
}

// ----------------------------------------------------------------
// PICKUP COLLISION
// ----------------------------------------------------------------

function checkPickupCollision(room, player) {
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  const pickupIdx = room.pickups.findIndex((p) => p.x === px && p.y === py);
  if (pickupIdx !== -1) {
    const pickup = room.pickups[pickupIdx];
    room.pickups.splice(pickupIdx, 1);
    if (pickup.type === "flame") player.range = Math.min(5, player.range + 1);
    else if (pickup.type === "bomb") player.bombs = Math.min(4, player.bombs + 1);
    else if (pickup.type === "speed") player.speed = Math.min(202, player.speed + 18);
    else if (pickup.type === "full_fire") player.range = 15;
    else if (pickup.type === "punch") player.hasPunch = true;

    broadcastToRoom(room, {
      type: "pickup_collected",
      data: {
        pickupId: `${pickup.x}_${pickup.y}`,
        playerId: player.id,
        pickups: room.pickups,
        playerStats: { id: player.id, range: player.range, bombs: player.bombs, speed: player.speed, hasPunch: !!player.hasPunch },
      },
    });
  }
}

// ----------------------------------------------------------------
// TICK ROOM
// ----------------------------------------------------------------

function tickRoom(room) {
  const dt = 0.05;
  room.roundTime = Math.max(0, room.roundTime - dt);
  if (room.roundTime <= 0) {
    endRound(room, null);
    return;
  }

  room.players.forEach((p) => {
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
  });

  // Update sliding bombs
  room.bombs.forEach((bomb) => {
    if (bomb.vx !== undefined && bomb.vy !== undefined && (bomb.vx !== 0 || bomb.vy !== 0)) {
      if (bomb.slideX === undefined) bomb.slideX = bomb.x;
      if (bomb.slideY === undefined) bomb.slideY = bomb.y;
      bomb.slideX += bomb.vx * 6.0 * dt;
      bomb.slideY += bomb.vy * 6.0 * dt;
      if (bomb.vx > 0) {
        if (bomb.slideX >= bomb.x + 1) {
          if (isTileSolidForBombServer(room, bomb.x + 2, bomb.y)) { bomb.x++; bomb.slideX = bomb.x; bomb.vx = 0; }
          else { bomb.x++; }
        }
      } else if (bomb.vx < 0) {
        if (bomb.slideX <= bomb.x - 1) {
          if (isTileSolidForBombServer(room, bomb.x - 2, bomb.y)) { bomb.x--; bomb.slideX = bomb.x; bomb.vx = 0; }
          else { bomb.x--; }
        }
      } else if (bomb.vy > 0) {
        if (bomb.slideY >= bomb.y + 1) {
          if (isTileSolidForBombServer(room, bomb.x, bomb.y + 2)) { bomb.y++; bomb.slideY = bomb.y; bomb.vy = 0; }
          else { bomb.y++; }
        }
      } else if (bomb.vy < 0) {
        if (bomb.slideY <= bomb.y - 1) {
          if (isTileSolidForBombServer(room, bomb.x, bomb.y - 2)) { bomb.y--; bomb.slideY = bomb.y; bomb.vy = 0; }
          else { bomb.y--; }
        }
      }
    }
  });

  // Tick bombs
  const exploded = [];
  room.bombs.forEach((bomb) => { bomb.timer -= dt; if (bomb.timer <= 0) exploded.push(bomb); });
  exploded.forEach((bomb) => triggerExplosion(room, bomb));

  // State update broadcast
  broadcastToRoom(room, {
    type: "state_update",
    data: {
      players: room.players.map((p) => ({ id: p.id, x: p.x, y: p.y, dx: p.dx, dy: p.dy, alive: p.alive, speed: p.speed, bombs: p.bombs, range: p.range })),
      roundTime: room.roundTime,
    },
  });
}

// ----------------------------------------------------------------
// EXPLOSION
// ----------------------------------------------------------------

function triggerExplosion(room, bomb) {
  room.bombs = room.bombs.filter((b) => b.id !== bomb.id);
  const cells = [{ x: bomb.x, y: bomb.y, center: true }];
  const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
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
        const roll = Math.random();
        let type = null;
        if (roll < 0.18) type = "flame"; else if (roll < 0.32) type = "bomb";
        else if (roll < 0.44) type = "speed"; else if (roll < 0.50) type = "full_fire";
        else if (roll < 0.56) type = "punch";
        if (type) { const pickup = { x, y, type }; room.pickups.push(pickup); spawnedPickups.push(pickup); }
        break;
      }
    }
  });

  const deadPlayers = [];
  cells.forEach((cell) => {
    room.players.forEach((p) => {
      if (!p.alive) return;
      const gx = Math.floor(p.x / TILE);
      const gy = Math.floor(p.y / TILE);
      if (gx === cell.x && gy === cell.y) { p.alive = false; deadPlayers.push(p.id); }
    });
  });

  room.bombs.forEach((other) => {
    if (cells.some((cell) => cell.x === other.x && cell.y === other.y)) other.timer = Math.min(other.timer, 0.04);
  });

  broadcastToRoom(room, {
    type: "bomb_exploded",
    data: { bombId: bomb.id, cells, destroyedCrates, spawnedPickups, deadPlayers, map: room.map },
  });

  checkGameEnd(room);
}

// ----------------------------------------------------------------
// CHECK GAME END
// ----------------------------------------------------------------

function checkGameEnd(room) {
  if (room.state !== "playing") return;

  if (room.mode === "team") {
    // In team mode, only active round players matter
    const activePlayers = room.players.filter(p => room.activeRoundPlayers.includes(p.id));
    const alive = activePlayers.filter(p => p.alive);
    if (alive.length <= 1) {
      const winnerId = alive.length === 1 ? alive[0].id : null;
      endRound(room, winnerId);
    }
  } else {
    const alive = room.players.filter((p) => p.alive);
    if (alive.length <= 1) {
      endRound(room, alive.length === 1 ? alive[0].id : null);
    }
  }
}

// ----------------------------------------------------------------
// END ROUND
// ----------------------------------------------------------------

function endRound(room, winnerId) {
  if (room.tickInterval) { clearInterval(room.tickInterval); room.tickInterval = null; }
  if (room.nextRoundTimeout) { clearTimeout(room.nextRoundTimeout); room.nextRoundTimeout = null; }

  let winner = null;
  if (winnerId) {
    winner = room.players.find((p) => p.id === winnerId);
    if (winner) winner.trophies = (winner.trophies || 0) + 1;
  }

  if (room.mode === "team") {
    // Award team trophy
    let winnerTeam = null;
    if (winnerId) {
      winnerTeam = room.teams.A.includes(winnerId) ? "A" : "B";
      room.teamTrophies[winnerTeam] = (room.teamTrophies[winnerTeam] || 0) + 1;
    }

    if (room.finalRoundActive) {
      const winningTeamName = winnerTeam ? `Team ${winnerTeam}` : "No team";
      room.state = "lobby";
      room.finalRoundActive = false;
      room.finalVoteActive = false;
      room.activeRoundPlayers = [];
      room.players.forEach((p) => {
        p.ready = p.ai;
        p.alive = true;
      });
      broadcastToRoom(room, {
        type: "game_over",
        data: {
          message: winner ? `${winningTeamName} wins the final round!` : "Final round ended in a draw!",
          players: room.players,
          tournamentFinished: true,
          winnerId: winner ? winner.id : null,
          teamTrophies: room.teamTrophies,
          teams: room.teams,
        },
      });
      broadcastLobbyUpdate(room);
      return;
    }

    const scoreA = room.teamTrophies.A;
    const scoreB = room.teamTrophies.B;

    // Check if either team reaches the win threshold → Final Vote
    if (scoreA >= TROPHIES_TO_WIN || scoreB >= TROPHIES_TO_WIN) {
      room.state = "round_over";
      broadcastToRoom(room, {
        type: "game_over",
        data: {
          message: winner ? `${winner.name} wins the round for Team ${winnerTeam}!` : "Draw!",
          players: room.players,
          tournamentFinished: false,
          winnerId: winner ? winner.id : null,
          teamTrophies: room.teamTrophies,
          teams: room.teams,
          isFinalVoteTriggered: true,
        },
      });
      // Start final vote after brief delay
      room.nextRoundTimeout = setTimeout(() => {
        startFinalVote(room);
      }, 5000);
    } else {
      // Normal next round
      room.state = "round_over";
      broadcastToRoom(room, {
        type: "game_over",
        data: {
          message: winner ? `${winner.name} wins Round ${room.roundNumber} for Team ${winnerTeam}! 🏆` : "Draw! No points.",
          players: room.players,
          tournamentFinished: false,
          winnerId: winner ? winner.id : null,
          teamTrophies: room.teamTrophies,
          teams: room.teams,
        },
      });
      room.nextRoundTimeout = setTimeout(() => {
        if (room.state === "round_over") startRound(room, false);
      }, 8000);
    }
  } else {
    // Standard mode — original logic
    const grandWinner = room.players.find((p) => (p.trophies || 0) >= 8);
    if (grandWinner) {
      room.state = "lobby";
      room.players.forEach((p) => { p.ready = p.ai; });
      broadcastToRoom(room, {
        type: "game_over",
        data: { message: `${grandWinner.name} wins the Match! 🏆`, players: room.players, tournamentFinished: true, winnerId: grandWinner.id },
      });
    } else {
      room.state = "round_over";
      broadcastToRoom(room, {
        type: "game_over",
        data: { message: winner ? `${winner.name} wins the Round!` : "Draw!", players: room.players, tournamentFinished: false, winnerId: winner ? winner.id : null },
      });
      room.nextRoundTimeout = setTimeout(() => {
        if (room.state === "round_over") startRound(room, false);
      }, 8000);
    }
  }
}

// ----------------------------------------------------------------
// FINAL VOTE SYSTEM
// ----------------------------------------------------------------

function startFinalVote(room) {
  if (room.state !== "round_over") return;
  room.state = "final_vote";
  room.finalVoteActive = true;
  room.finalVotes = {};

  broadcastToRoom(room, {
    type: "final_vote_started",
    data: {
      teams: room.teams,
      players: room.players,
      teamTrophies: room.teamTrophies,
      secondsLeft: FINAL_VOTE_SECONDS,
    },
  });

  // 20-second vote countdown
  let secondsLeft = FINAL_VOTE_SECONDS;
  if (room.voteCountdownInterval) clearInterval(room.voteCountdownInterval);
  room.voteCountdownInterval = setInterval(() => {
    secondsLeft--;
    broadcastToRoom(room, { type: "vote_countdown", data: { secondsLeft } });
    if (secondsLeft <= 0) {
      clearInterval(room.voteCountdownInterval);
      room.voteCountdownInterval = null;
    }
  }, 1000);

  room.voteTimer = setTimeout(() => {
    if (room.voteCountdownInterval) {
      clearInterval(room.voteCountdownInterval);
      room.voteCountdownInterval = null;
    }
    resolveFinalVote(room);
  }, FINAL_VOTE_SECONDS * 1000);
}

function resolveFinalVote(room) {
  if (room.state !== "final_vote") return;
  if (room.voteTimer) {
    clearTimeout(room.voteTimer);
    room.voteTimer = null;
  }
  if (room.voteCountdownInterval) {
    clearInterval(room.voteCountdownInterval);
    room.voteCountdownInterval = null;
  }

  // Tally votes per team — pick most voted, or random if tie
  const pickChampion = (teamIds) => {
    const voteCounts = {};
    teamIds.forEach(id => { voteCounts[id] = 0; });
    Object.entries(room.finalVotes).forEach(([voterId, votedId]) => {
      if (voteCounts[votedId] !== undefined) voteCounts[votedId]++;
    });
    const sorted = teamIds.sort((a, b) => (voteCounts[b] || 0) - (voteCounts[a] || 0));
    return sorted[0]; // highest votes wins; ties broken by original order
  };

  const championA = pickChampion([...room.teams.A]);
  const championB = pickChampion([...room.teams.B]);

  broadcastToRoom(room, {
    type: "final_vote_resolved",
    data: { championA, championB, votes: room.finalVotes },
  });

  room.finalVoteActive = false;
  room.state = "round_over";

  // Start the final decisive round after 3s
  setTimeout(() => {
    startFinalRound(room, championA, championB);
  }, 3000);
}

function startFinalRound(room, championAId, championBId) {
  // Override rotation to use only the champions
  room.activeRoundPlayers = [championAId, championBId];
  room._isFinalRound = true;
  room.finalRoundActive = true;
  startRound(room, false);
}

// ----------------------------------------------------------------
// START ROUND
// ----------------------------------------------------------------

function startRound(room, isNewTournament) {
  if (isNewTournament) {
    // Determine winning map from votes
    const votes = { classic: 0, checkered: 0, colosseum: 0 };
    Object.values(room.mapVotes || {}).forEach((v) => { if (votes[v] !== undefined) votes[v]++; });
    let winningMap = "classic";
    let maxVotes = votes.classic;
    if (votes.checkered > maxVotes) { winningMap = "checkered"; maxVotes = votes.checkered; }
    if (votes.colosseum > maxVotes) winningMap = "colosseum";
    room.currentMapType = winningMap;
    room.mapVotes = {};
    room.roundNumber = 0;
    if (room.mode === "team") {
      room.teamTrophies = { A: 0, B: 0 };
      resetRotationQueues(room);
    }
  }

  room.roundNumber = (room.roundNumber || 0) + 1;

  // --- Pick active round players in team mode ---
  if (room.mode === "team" && !room._isFinalRound) {
    const pickNext = (team) => {
      if (room.rotationQueues[team].length === 0) {
        // Cycle exhausted — reshuffle from full team
        room.rotationQueues[team] = shuffleArray([...room.teams[team]]);
      }
      return room.rotationQueues[team].shift();
    };
    room.activeRoundPlayers = [pickNext("A"), pickNext("B")];
  }
  room._isFinalRound = false;

  const mapType = room.currentMapType || "classic";
  room.map = generateMap(mapType);

  // Position players (only active ones at the main spawn corners; spectators off-map or same spawn)
  room.players.forEach((p, index) => {
    const isActive = room.mode !== "team" || room.activeRoundPlayers.includes(p.id);
    const spawnIndex = room.mode === "team"
      ? room.activeRoundPlayers.indexOf(p.id)
      : index;
    const spawn = starts[(spawnIndex >= 0 ? spawnIndex : index) % starts.length];
    p.x = spawn.x * TILE + TILE / 2;
    p.y = spawn.y * TILE + TILE / 2;
    p.dx = 0; p.dy = 0;
    p.alive = isActive; // spectators start dead
    p.speed = 142; p.bombs = 1; p.range = 2; p.cooldown = 0; p.hasPunch = false;
    if (isNewTournament) p.trophies = 0;
  });

  room.bombs = []; room.blasts = []; room.pickups = [];
  room.roundTime = ROUND_SECONDS;
  room.state = "playing";

  broadcastToRoom(room, {
    type: "game_started",
    data: {
      map: room.map,
      players: room.players,
      mapType,
      mode: room.mode,
      teams: room.teams,
      teamTrophies: room.teamTrophies,
      activeRoundPlayers: room.activeRoundPlayers,
      roundNumber: room.roundNumber,
      isFinalRound: room.finalRoundActive,
    },
  });

  if (room.tickInterval) clearInterval(room.tickInterval);
  room.tickInterval = setInterval(() => tickRoom(room), 50);
}

// ----------------------------------------------------------------
// MAP GENERATION
// ----------------------------------------------------------------

function generateMap(mapType) {
  const nextMap = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return "wall";
      if (mapType === "colosseum") {
        if ((x === 3 || x === COLS - 4) && (y === 3 || y === ROWS - 4)) return "wall";
        return Math.random() < 0.5 ? "crate" : "grass";
      } else if (mapType === "checkered") {
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        if ((x === 3 || x === COLS - 4) && (y === 3 || y === ROWS - 4)) return "wall";
        return Math.random() < 0.6 ? "crate" : "grass";
      } else {
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        return Math.random() < 0.66 ? "crate" : "grass";
      }
    })
  );
  starts.forEach((s) => {
    const clearSafe = (x, y) => { if (nextMap[y] && nextMap[y][x] && nextMap[y][x] !== "wall") nextMap[y][x] = "grass"; };
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
  return hasPlayer;
}

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
