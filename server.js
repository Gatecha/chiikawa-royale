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
const SUDDEN_DEATH_TIME = 90;
const ZONE_STEP_SECONDS = 10;
const MAX_ZONE_LAYER = 4;

// Tournament config
const TROPHIES_TO_WIN = 8;        // Team trophies needed to win (or trigger final vote)
const STANDARD_MAX_PLAYERS = 4;   // Quick match / standard mode cap
const TEAM_MAX_PLAYERS = 6;        // Team mode cap (3v3)
const MATCHMAKING_FILL_ALONE = 5; // Seconds alone before CPU fill
const MATCHMAKING_FILL_PARTIAL = 5; // Seconds with 1-2 players before fill
const FINAL_VOTE_SECONDS = 20;     // Vote timer duration
const RECONNECT_GRACE_MS = 10 * 60 * 1000;
const SURRENDER_THRESHOLD = 3;

function getMatchMaxPlayers(mode, isChallenge = false) {
  if (isChallenge && mode === "solo") return 2; // Solo challenges are 1v1
  if (mode === "trio" || mode === "team") return 6;
  return 4; // solo, duo, standard
}

function getLobbyCapacity(mode) {
  if (mode === "solo") return 1;
  if (mode === "duo") return 2;
  if (mode === "trio") return 3;
  return 3; // default
}

function isTeamMode(mode) {
  return mode === "team" || mode === "duo" || mode === "trio";
}

const starts = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: ROWS - 2 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
];

const powerZoneStarts = [
  { x: 5, y: 5 },
  { x: COLS - 6, y: ROWS - 6 },
  { x: COLS - 6, y: 5 },
  { x: 5, y: ROWS - 6 },
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
    markPlayerDisconnected(ws);
  });
});

function handleMessage(ws, msg) {
  const { type, data } = msg;

  switch (type) {
    case "reconnect_player": {
      const roomCode = String(data.roomCode || "").toUpperCase();
      const playerId = data.playerId;
      const reconnectToken = data.reconnectToken;
      const room = rooms.get(roomCode);
      if (!room || !playerId || !reconnectToken) {
        ws.send(JSON.stringify({ type: "reconnect_failed", data: { message: "Saved match was not found." } }));
        return;
      }
      const player = room.players.find(p => p.id === playerId && p.reconnectToken === reconnectToken);
      if (!player) {
        ws.send(JSON.stringify({ type: "reconnect_failed", data: { message: "Saved player slot was not found." } }));
        return;
      }

      ws.id = player.id;
      ws.roomCode = room.code;
      player.disconnected = false;
      if (room.disconnectTimers[player.id]) {
        clearTimeout(room.disconnectTimers[player.id]);
        delete room.disconnectTimers[player.id];
      }
      ws.send(JSON.stringify({
        type: "room_joined",
        data: { roomCode: room.code, playerId: player.id, reconnectToken: player.reconnectToken, reconnected: true },
      }));
      broadcastLobbyUpdate(room);
      sendRoomStateToClient(ws, room);
      break;
    }

    case "list_rooms": {
      sendLanRoomList(ws);
      break;
    }

    case "create_room": {
      leaveRoom(ws);
      const roomCode = generateRoomCode();
      const room = createRoomObject(roomCode, ws.id, data.mode || "trio");
      room.isPrivate = data.isPrivate !== false;
      rooms.set(roomCode, room);
      joinPlayerToRoom(ws, room, data.name, data.kind);
      break;
    }

    case "start_matchmaking": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;

      const chosenMode = data.mode || room.mode || "trio";
      room.mode = chosenMode;
      room.isPrivate = false;

      // Try to find another open lobby room that is public and has space for all human players of this room
      const humanCount = room.players.filter(p => !p.ai).length;
      let targetRoom = null;
      for (const [code, r] of rooms.entries()) {
        if (r.code === room.code) continue;
        const maxPlayers = getMatchMaxPlayers(chosenMode, r.isChallenge);
        if (r.state === "lobby" && !r.isPrivate && r.mode === chosenMode && (r.players.length + humanCount) <= maxPlayers) {
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
        broadcastLobbyUpdate(room);
        startMatchmakingTimers(room);
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
      clearMatchmakingTimers(room);
      broadcastToRoom(room, {
        type: "matchmaking_countdown",
        data: { secondsLeft: 0 }
      });
      broadcastLobbyUpdate(room);
      break;
    }

    case "leave_room": {
      leaveRoom(ws, true);
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
      const lobbyCap = getLobbyCapacity(room.mode);
      const humanCount = room.players.filter(p => !p.ai).length;
      if (humanCount >= lobbyCap) {
        ws.send(JSON.stringify({ type: "error", data: { message: `Squad is full for ${room.mode.toUpperCase()} mode!` } }));
        return;
      }

      leaveRoom(ws);
      joinPlayerToRoom(ws, room, data.name, data.kind);
      break;
    }

    case "quick_match": {
      leaveRoom(ws);
      const chosenMode = data.mode || "solo";
      let foundRoom = null;
      for (const [code, r] of rooms.entries()) {
        const maxPlayers = getMatchMaxPlayers(chosenMode, r.isChallenge);
        if (r.state === "lobby" && !r.isPrivate && r.mode === chosenMode && r.players.length < maxPlayers) {
          foundRoom = r;
          break;
        }
      }

      if (foundRoom) {
        joinPlayerToRoom(ws, foundRoom, data.name, data.kind);
        // Reset matchmaking ticker elapsed time when a new player joins
        if (foundRoom.matchmakingInterval) {
          foundRoom.matchmakingElapsed = 0;
        }
      } else {
        const roomCode = generateRoomCode();
        const room = createRoomObject(roomCode, ws.id, chosenMode);
        room.isPrivate = false;
        rooms.set(roomCode, room);
        joinPlayerToRoom(ws, room, data.name, data.kind);
        startMatchmakingTimers(room);
      }
      break;
    }

    case "challenge_player": {
      const targetId = data.targetId;
      const challengeMode = data.mode || "solo";

      let targetClient = null;
      wss.clients.forEach(c => {
        if (c.id === targetId) targetClient = c;
      });
      if (!targetClient) {
        ws.send(JSON.stringify({ type: "error", data: { message: "Player is offline!" } }));
        return;
      }

      leaveRoom(ws);
      const roomCode = generateRoomCode();
      const room = createRoomObject(roomCode, ws.id, challengeMode);
      room.isPrivate = true;
      room.isChallenge = true;
      rooms.set(roomCode, room);
      joinPlayerToRoom(ws, room, data.name, data.kind);

      targetClient.send(JSON.stringify({
        type: "challenge_received",
        data: {
          challengerName: data.name || "A player",
          challengerId: ws.id,
          roomCode: roomCode,
          mode: challengeMode
        }
      }));
      break;
    }

    case "add_bot": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      const maxPlayers = room.mode === "team" ? TEAM_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
      if (room.players.length >= maxPlayers) return;
      addBotToRoom(room);
      broadcastLobbyUpdate(room);
      if (room.players.length >= maxPlayers) {
        setTimeout(() => {
          if (room.state === "lobby") startMapVoting(room);
        }, 1200);
      }
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

      startMapVoting(room);
      break;
    }

    case "request_surrender": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "playing" || room.mode !== "team") return;
      const team = getPlayerTeam(room, ws.id);
      if (!team) return;
      startOrUpdateSurrenderVote(room, team, ws.id);
      break;
    }

    case "submit_surrender_vote": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "playing" || room.mode !== "team") return;
      const team = getPlayerTeam(room, ws.id);
      if (!team || !room.surrenderVotes?.[team]) return;
      if (data.agree) {
        room.surrenderDeclines[team].delete(ws.id);
        room.surrenderVotes[team].add(ws.id);
      } else {
        room.surrenderVotes[team].delete(ws.id);
        room.surrenderDeclines[team].add(ws.id);
      }
      broadcastSurrenderUpdate(room, team);
      checkSurrenderResolved(room, team);
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
        const fromTile = gridAtServer(player.x, player.y);
        const dx = Math.sign(data.dx || 0);
        const dy = Math.sign(data.dy || 0);
        if ((dx !== 0 || dy !== 0) && (dx === 0 || dy === 0)) {
          tryKickBombServer(room, player, fromTile, { x: dx, y: dy });
        }
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
      placeServerBomb(room, player);
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
      if (!room || room.state !== "map_voting") return;
      const mapChoice = data.map;
      if (["classic", "checkered", "colosseum", "powerzone"].includes(mapChoice)) {
        if (!room.mapVotes) room.mapVotes = {};
        room.mapVotes[ws.id] = mapChoice;
        const votes = { classic: 0, checkered: 0, colosseum: 0, powerzone: 0 };
        Object.values(room.mapVotes).forEach((v) => { if (votes[v] !== undefined) votes[v]++; });
        broadcastToRoom(room, { type: "map_votes_updated", data: { votes, voterMap: room.mapVotes } });
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
    zoneActive: false,
    zoneLayer: 0,
    zoneStepTimer: 0,
    tickInterval: null,
    nextRoundTimeout: null,
    hostId,
    mapVotes: {},
    currentMapType: "classic",
    // Team mode fields
    teams: { A: [], B: [] },
    teamTrophies: { A: 0, B: 0 },
    rotationQueues: { A: [], B: [] },
    roundPairQueues: { A: [], B: [] },
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
    surrenderVotes: { A: null, B: null },
    surrenderDeclines: { A: null, B: null },
    surrenderTimers: { A: null, B: null },
    surrenderVoteExpiresAt: { A: 0, B: 0 },
    disconnectTimers: {},
  };
}

function dataToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ----------------------------------------------------------------
// PLAYER JOIN
// ----------------------------------------------------------------

function joinPlayerToRoom(ws, room, name, kind, squadCode = null) {
  const maxPlayers = getMatchMaxPlayers(room.mode, room.isChallenge);
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
    hasSlide: false,
    cooldown: 0,
    trophies: 0,
    disconnected: false,
  };
  Object.defineProperty(player, "reconnectToken", {
    value: dataToken(),
    enumerable: false,
    writable: true,
  });

  room.players.push(player);
  console.log(`Player ${ws.id} joined room ${room.code} (${room.players.length} players)`);

  if (isTeamMode(room.mode)) {
    assignPlayerToTeam(room, player);
  }

  ws.send(JSON.stringify({
    type: "room_joined",
    data: { roomCode: room.code, playerId: ws.id, reconnectToken: player.reconnectToken },
  }));

  broadcastLobbyUpdate(room);

  // Auto-start map voting if lobby is full of real players and we are in public matchmaking
  if (!room.isPrivate && room.players.length >= maxPlayers) {
    clearMatchmakingTimers(room);
    setTimeout(() => {
      if (room.state === "lobby") {
        startMapVoting(room);
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
  room.rotationQueues = {
    A: shuffleArray([...room.teams.A]),
    B: shuffleArray([...room.teams.B])
  };
  room.roundPairQueues = {
    A: buildPairQueue(room.teams.A),
    B: buildPairQueue(room.teams.B),
  };
  room.usedThisCycle = { A: [], B: [] };
}

function buildPairQueue(teamIds) {
  const ids = shuffleArray([...teamIds]);
  if (ids.length <= 2) return ids.length ? [ids] : [];
  const pairs = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return shuffleArray(pairs);
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

function leaveRoom(ws, intentional = false) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  if (intentional && room.state === "lobby" && room.hostId === ws.id) {
    room.isPrivate = true;
    room.matchmakingFillSecondsLeft = 0;
    if (room.matchmakingTimer) {
      clearTimeout(room.matchmakingTimer);
      room.matchmakingTimer = null;
    }
    if (room.matchmakingCountdownInterval) {
      clearInterval(room.matchmakingCountdownInterval);
      room.matchmakingCountdownInterval = null;
    }
    broadcastToRoom(room, {
      type: "matchmaking_countdown",
      data: { secondsLeft: 0 }
    });
  }

  if (room.disconnectTimers?.[ws.id]) {
    clearTimeout(room.disconnectTimers[ws.id]);
    delete room.disconnectTimers[ws.id];
  }
  room.players = room.players.filter((p) => p.id !== ws.id);
  // Remove from team arrays
  removePlayerFromTeams(room, ws.id);
  if (room.mapVotes) {
    delete room.mapVotes[ws.id];
    if (room.state === "lobby") {
      const votes = { classic: 0, checkered: 0, colosseum: 0, powerzone: 0 };
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

function markPlayerDisconnected(ws) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  const player = room.players.find((p) => p.id === ws.id);
  if (!player) return;

  player.disconnected = true;
  player.dx = 0;
  player.dy = 0;
  if (room.disconnectTimers?.[player.id]) clearTimeout(room.disconnectTimers[player.id]);
  room.disconnectTimers[player.id] = setTimeout(() => {
    if (!rooms.has(room.code) || !player.disconnected) return;
    if (room.state === "playing" || room.state === "round_over" || room.state === "final_vote") {
      delete room.disconnectTimers[player.id];
      return;
    }
    const fakeSocket = { id: player.id, roomCode: room.code };
    leaveRoom(fakeSocket, true);
  }, RECONNECT_GRACE_MS);
  broadcastLobbyUpdate(room);
}

function destroyRoom(room) {
  if (room.tickInterval) clearInterval(room.tickInterval);
  if (room.nextRoundTimeout) clearTimeout(room.nextRoundTimeout);
  if (room.matchmakingTimer) clearTimeout(room.matchmakingTimer);
  if (room.matchmakingCountdownInterval) clearInterval(room.matchmakingCountdownInterval);
  if (room.voteTimer) clearTimeout(room.voteTimer);
  if (room.voteCountdownInterval) clearInterval(room.voteCountdownInterval);
  Object.values(room.surrenderTimers || {}).forEach((timer) => { if (timer) clearTimeout(timer); });
  Object.values(room.disconnectTimers || {}).forEach((timer) => { if (timer) clearTimeout(timer); });
  rooms.delete(room.code);
  console.log(`Room ${room.code} destroyed`);
  broadcastLanRoomList();
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
      isChallenge: room.isChallenge || false,
      maxPlayers: getMatchMaxPlayers(room.mode, room.isChallenge),
    },
  });
  broadcastLanRoomList();
}

function getLanRoomSummaries() {
  return Array.from(rooms.values())
    .filter((room) => room.state === "lobby" || room.state === "map_voting")
    .map((room) => ({
      roomCode: room.code,
      hostId: room.hostId,
      hostName: room.players.find((p) => p.id === room.hostId)?.name || "Host",
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        ai: !!p.ai,
      })),
      playerCount: room.players.length,
      maxPlayers: getMatchMaxPlayers(room.mode, room.isChallenge),
      mode: room.mode,
      state: room.state,
      isPrivate: room.isPrivate,
    }));
}

function sendLanRoomList(ws) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: "lan_rooms_updated",
    data: { rooms: getLanRoomSummaries() },
  }));
}

function broadcastLanRoomList() {
  const payload = JSON.stringify({
    type: "lan_rooms_updated",
    data: { rooms: getLanRoomSummaries() },
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
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

function sendRoomStateToClient(ws, room) {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (room.state === "playing") {
    ws.send(JSON.stringify({
      type: "game_started",
      data: {
        map: room.map,
        players: room.players,
        bombs: room.bombs,
        pickups: room.pickups,
        roundTime: room.roundTime,
        mapType: room.currentMapType || "classic",
        mode: room.mode,
        teams: room.teams,
        teamTrophies: room.teamTrophies,
        activeRoundPlayers: room.activeRoundPlayers,
        roundNumber: room.roundNumber,
        isFinalRound: room.finalRoundActive,
        reconnected: true,
      },
    }));
  } else if (room.state === "final_vote") {
    ws.send(JSON.stringify({
      type: "final_vote_started",
      data: {
        teams: room.teams,
        players: room.players,
        teamTrophies: room.teamTrophies,
        secondsLeft: FINAL_VOTE_SECONDS,
      },
    }));
  } else {
    broadcastLobbyUpdate(room);
  }
}

function getPlayerTeam(room, playerId) {
  if ((room.teams.A || []).includes(playerId)) return "A";
  if ((room.teams.B || []).includes(playerId)) return "B";
  return null;
}

function resetSurrenderVotes(room) {
  Object.values(room.surrenderTimers || {}).forEach((timer) => { if (timer) clearTimeout(timer); });
  room.surrenderVotes = { A: null, B: null };
  room.surrenderDeclines = { A: null, B: null };
  room.surrenderTimers = { A: null, B: null };
  room.surrenderVoteExpiresAt = { A: 0, B: 0 };
}

function startOrUpdateSurrenderVote(room, team, playerId) {
  if (!room.surrenderVotes[team]) {
    room.surrenderVotes[team] = new Set();
    room.surrenderDeclines[team] = new Set();
    if (room.surrenderTimers[team]) clearTimeout(room.surrenderTimers[team]);
    room.surrenderVoteExpiresAt[team] = Date.now() + 15000;
    room.surrenderTimers[team] = setTimeout(() => {
      if (room.surrenderVotes[team]) {
        room.surrenderVotes[team] = null;
        room.surrenderDeclines[team] = null;
        room.surrenderVoteExpiresAt[team] = 0;
        broadcastToRoom(room, { type: "surrender_cancelled", data: { team } });
      }
    }, 15000);
  }
  room.surrenderVotes[team].add(playerId);
  room.surrenderDeclines[team].delete(playerId);
  room.teams[team].forEach((id) => {
    const teammate = room.players.find((p) => p.id === id);
    if (teammate?.ai) room.surrenderVotes[team].add(id);
  });
  broadcastSurrenderUpdate(room, team);
  checkSurrenderResolved(room, team);
}

function broadcastSurrenderUpdate(room, team) {
  const yesVotes = room.surrenderVotes[team] ? room.surrenderVotes[team].size : 0;
  const noVotes = room.surrenderDeclines[team] ? room.surrenderDeclines[team].size : 0;
  const threshold = Math.min(SURRENDER_THRESHOLD, room.teams[team]?.length || SURRENDER_THRESHOLD);
  const secondsLeft = Math.max(0, Math.ceil(((room.surrenderVoteExpiresAt?.[team] || Date.now()) - Date.now()) / 1000));
  broadcastToRoom(room, {
    type: "surrender_vote_updated",
    data: { team, yesVotes, noVotes, threshold, secondsLeft },
  });
}

function checkSurrenderResolved(room, team) {
  if (!room.surrenderVotes[team]) return;
  const threshold = Math.min(SURRENDER_THRESHOLD, room.teams[team]?.length || SURRENDER_THRESHOLD);
  if (room.surrenderVotes[team].size < threshold) return;

  if (room.surrenderTimers[team]) {
    clearTimeout(room.surrenderTimers[team]);
    room.surrenderTimers[team] = null;
  }
  room.surrenderVotes[team] = null;
  room.surrenderDeclines[team] = null;
  room.surrenderVoteExpiresAt[team] = 0;
  const winnerTeam = team === "A" ? "B" : "A";
  const winnerId = (room.teams[winnerTeam] || []).find(id => room.players.find(p => p.id === id)) || null;
  endMatchBySurrender(room, winnerTeam, winnerId);
}

function endMatchBySurrender(room, winnerTeam, winnerId) {
  if (room.tickInterval) { clearInterval(room.tickInterval); room.tickInterval = null; }
  if (room.nextRoundTimeout) { clearTimeout(room.nextRoundTimeout); room.nextRoundTimeout = null; }
  room.state = "lobby";
  room.finalRoundActive = false;
  room.finalVoteActive = false;
  room.activeRoundPlayers = [];
  room.players.forEach((p) => {
    p.ready = p.ai;
    p.alive = true;
    p.dx = 0;
    p.dy = 0;
  });
  broadcastToRoom(room, {
    type: "game_over",
    data: {
      message: `Team ${winnerTeam} wins by surrender!`,
      players: room.players,
      tournamentFinished: true,
      winnerId,
      winnerTeam,
      teamTrophies: room.teamTrophies,
      teams: room.teams,
      surrendered: true,
    },
  });
  broadcastLobbyUpdate(room);
}

// ----------------------------------------------------------------
// MATCHMAKING FILL TIMERS
// ----------------------------------------------------------------

function startMatchmakingTimers(room) {
  if (room.matchmakingInterval) return;

  room.matchmakingElapsed = 0;
  room.matchmakingInterval = setInterval(() => {
    room.matchmakingElapsed++;
    
    // Broadcast matchmaking countdown (max 40s)
    broadcastToRoom(room, {
      type: "matchmaking_countdown",
      data: { secondsLeft: Math.max(0, 40 - room.matchmakingElapsed), elapsed: room.matchmakingElapsed }
    });

    const maxPlayers = getMatchMaxPlayers(room.mode, room.isChallenge);

    // 30 seconds incomplete check
    if (room.matchmakingElapsed === 30) {
      console.log(`Matchmaking 30s check for room ${room.code}. Filling incomplete squad.`);
      fillIncompleteMatchWithBots(room);
    }
    
    // 40 seconds regardless check
    if (room.matchmakingElapsed >= 40) {
      console.log(`Matchmaking 40s timeout for room ${room.code}. Filling remaining slots.`);
      fillAllRemainingWithBots(room);
    }
  }, 1000);
}

function clearMatchmakingTimers(room) {
  if (room.matchmakingInterval) {
    clearInterval(room.matchmakingInterval);
    room.matchmakingInterval = null;
  }
}

function fillIncompleteMatchWithBots(room) {
  if (room.state !== "lobby") return;
  
  if (room.mode === "solo") {
    const realCount = room.players.filter(p => !p.ai).length;
    if (realCount >= 2) {
      while (room.players.length < 4) {
        addBotToRoom(room);
      }
      broadcastLobbyUpdate(room);
      startMapVoting(room);
    }
  } else if (room.mode === "duo") {
    const realA = room.teams.A.filter(id => !room.players.find(p => p.id === id)?.ai).length;
    const realB = room.teams.B.filter(id => !room.players.find(p => p.id === id)?.ai).length;
    
    if (realA > 0 && TeamBIsEmptyOrCPUsOnly(room)) {
      addCPUTeamToTeam(room, "B", 2);
      broadcastLobbyUpdate(room);
      startMapVoting(room);
    } else if (realB > 0 && TeamAIsEmptyOrCPUsOnly(room)) {
      addCPUTeamToTeam(room, "A", 2);
      broadcastLobbyUpdate(room);
      startMapVoting(room);
    }
  } else if (room.mode === "trio") {
    const realA = room.teams.A.filter(id => !room.players.find(p => p.id === id)?.ai).length;
    const realB = room.teams.B.filter(id => !room.players.find(p => p.id === id)?.ai).length;
    
    if (realA > 0 && TeamBIsEmptyOrCPUsOnly(room)) {
      addCPUTeamToTeam(room, "B", 3);
      broadcastLobbyUpdate(room);
      startMapVoting(room);
    } else if (realB > 0 && TeamAIsEmptyOrCPUsOnly(room)) {
      addCPUTeamToTeam(room, "A", 3);
      broadcastLobbyUpdate(room);
      startMapVoting(room);
    }
  }
}

function fillAllRemainingWithBots(room) {
  if (room.state !== "lobby") return;

  const maxPlayers = getMatchMaxPlayers(room.mode, room.isChallenge);
  if (room.mode === "solo") {
    while (room.players.length < maxPlayers) {
      addBotToRoom(room);
    }
  } else if (room.mode === "duo") {
    fillTeamToSize(room, "A", 2);
    fillTeamToSize(room, "B", 2);
  } else if (room.mode === "trio" || room.mode === "team") {
    fillTeamToSize(room, "A", 3);
    fillTeamToSize(room, "B", 3);
  }
  broadcastLobbyUpdate(room);
  startMapVoting(room);
}

function TeamBIsEmptyOrCPUsOnly(room) {
  if (room.teams.B.length === 0) return true;
  return room.teams.B.every(id => {
    const p = room.players.find(pl => pl.id === id);
    return !p || p.ai;
  });
}

function TeamAIsEmptyOrCPUsOnly(room) {
  if (room.teams.A.length === 0) return true;
  return room.teams.A.every(id => {
    const p = room.players.find(pl => pl.id === id);
    return !p || p.ai;
  });
}

function addCPUTeamToTeam(room, team, size) {
  room.teams[team] = room.teams[team].filter(id => {
    const p = room.players.find(pl => pl.id === id);
    return p && !p.ai;
  });
  room.players = room.players.filter(p => !p.ai || !room.teams[team].includes(p.id));

  while (room.teams[team].length < size) {
    const bot = createBotObject(room);
    room.players.push(bot);
    room.teams[team].push(bot.id);
  }
  resetRotationQueues(room);
}

function fillTeamToSize(room, team, size) {
  while (room.teams[team].length < size) {
    const bot = createBotObject(room);
    room.players.push(bot);
    room.teams[team].push(bot.id);
  }
  resetRotationQueues(room);
}

function createBotObject(room) {
  const botKinds = ["momonga", "chiikawa", "usagi", "hachiware"];
  const usedKinds = room.players.map((p) => p.kind);
  const kind = botKinds.find((k) => !usedKinds.includes(k)) || botKinds[Math.floor(Math.random() * botKinds.length)];
  const botId = "bot_" + Math.random().toString(36).substr(2, 9);
  const botNames = ["Momonga Bot", "Chiikawa Bot", "Hachiware Bot", "Usagi Bot"];
  const name = botNames[Math.floor(Math.random() * botNames.length)] + " (CPU)";

  return {
    id: botId, name, kind,
    ready: true, ai: true,
    x: 0, y: 0, dx: 0, dy: 0,
    alive: true, speed: 142, bombs: 1, range: 2, cooldown: 0, trophies: 0,
    hasPunch: false, hasSlide: false,
    aiThink: 0, aiDir: { x: 0, y: 0 }, aiTarget: null, aiBombCooldown: 0,
  };
}

function addBotToRoom(room) {
  const bot = createBotObject(room);
  room.players.push(bot);
  if (isTeamMode(room.mode)) {
    assignPlayerToTeam(room, bot);
  }
}

function startMapVoting(room) {
  clearMatchmakingTimers(room);
  room.state = "map_voting";
  room.mapVotes = {};

  let timeLeft = 10;
  broadcastToRoom(room, {
    type: "map_voting_started",
    data: { timer: timeLeft }
  });

  if (room.mapVoteInterval) clearInterval(room.mapVoteInterval);
  room.mapVoteInterval = setInterval(() => {
    timeLeft--;
    broadcastToRoom(room, {
      type: "map_vote_timer_update",
      data: { timer: timeLeft }
    });

    if (timeLeft <= 0) {
      clearInterval(room.mapVoteInterval);
      room.mapVoteInterval = null;
      resolveMapVote(room);
    }
  }, 1000);
}

function resolveMapVote(room) {
  if (room.mapVoteInterval) {
    clearInterval(room.mapVoteInterval);
    room.mapVoteInterval = null;
  }

  const votes = { classic: 0, checkered: 0, colosseum: 0, powerzone: 0 };
  Object.values(room.mapVotes || {}).forEach((v) => { if (votes[v] !== undefined) votes[v]++; });

  let maxVotes = -1;
  let candidates = [];
  for (const [mapType, count] of Object.entries(votes)) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [mapType];
    } else if (count === maxVotes) {
      candidates.push(mapType);
    }
  }

  const winningMap = candidates[Math.floor(Math.random() * candidates.length)] || "classic";
  room.currentMapType = winningMap;
  room.mapVotes = {};

  broadcastToRoom(room, {
    type: "map_voting_ended",
    data: { winningMap }
  });

  setTimeout(() => {
    if (room.state === "map_voting") {
      startRound(room, false);
    }
  }, 3000);
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
    else if (pickup.type === "slide") player.hasSlide = true;

    broadcastToRoom(room, {
      type: "pickup_collected",
      data: {
        pickupId: `${pickup.x}_${pickup.y}`,
        playerId: player.id,
        pickups: room.pickups,
        playerStats: { id: player.id, range: player.range, bombs: player.bombs, speed: player.speed, hasPunch: !!player.hasPunch, hasSlide: !!player.hasSlide },
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
    if (p.aiBombCooldown > 0) p.aiBombCooldown = Math.max(0, p.aiBombCooldown - dt);
  });

  updateServerBots(room, dt);
  updateServerZone(room, dt);

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
      players: room.players.map((p) => ({ id: p.id, x: p.x, y: p.y, dx: p.dx, dy: p.dy, alive: p.alive, speed: p.speed, bombs: p.bombs, range: p.range, hasPunch: !!p.hasPunch, hasSlide: !!p.hasSlide })),
      map: room.map,
      roundTime: room.roundTime,
    },
  });
}

function updateServerZone(room, dt) {
  if (room.roundTime > SUDDEN_DEATH_TIME || room.zoneLayer >= MAX_ZONE_LAYER) return;

  if (!room.zoneActive) {
    room.zoneActive = true;
    room.zoneStepTimer = 0;
  }

  room.zoneStepTimer -= dt;
  if (room.zoneStepTimer > 0) return;

  room.zoneLayer += 1;
  applyServerZoneLayer(room, room.zoneLayer);
  room.zoneStepTimer = ZONE_STEP_SECONDS;
  checkGameEnd(room);
}

function applyServerZoneLayer(room, layer) {
  const left = layer;
  const right = COLS - 1 - layer;
  const top = layer;
  const bottom = ROWS - 1 - layer;

  for (let x = left; x <= right; x += 1) {
    setServerZoneTile(room, x, top);
    setServerZoneTile(room, x, bottom);
  }

  for (let y = top; y <= bottom; y += 1) {
    setServerZoneTile(room, left, y);
    setServerZoneTile(room, right, y);
  }

  room.pickups = room.pickups.filter((pickup) => room.map[pickup.y]?.[pickup.x] !== "zone");
  room.bombs = room.bombs.filter((bomb) => room.map[bomb.y]?.[bomb.x] !== "zone");
  room.players.forEach((player) => {
    if (!player.alive) return;
    const tile = gridAtServer(player.x, player.y);
    if (room.map[tile.y]?.[tile.x] === "zone") {
      player.alive = false;
      player.dx = 0;
      player.dy = 0;
    }
  });
}

function setServerZoneTile(room, x, y) {
  if (!room.map[y] || !room.map[y][x]) return;
  if (room.map[y][x] === "wall") return;
  room.map[y][x] = "zone";
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
        else if (roll < 0.56) type = "punch"; else if (roll < 0.64) type = "slide";
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
    const activePlayers = room.players.filter(p => room.activeRoundPlayers.includes(p.id));
    const alive = activePlayers.filter(p => p.alive);
    const aliveA = alive.filter(p => room.teams.A.includes(p.id));
    const aliveB = alive.filter(p => room.teams.B.includes(p.id));
    if (aliveA.length === 0 || aliveB.length === 0) {
      const winner = aliveA.length > 0 ? aliveA[0] : aliveB.length > 0 ? aliveB[0] : null;
      endRound(room, winner ? winner.id : null);
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

  if (isTeamMode(room.mode)) {
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

    if (room.mode === "trio" && (scoreA >= 7 || scoreB >= 7)) {
      // Trigger Final Round Vote in Trio mode at 7 trophies
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
      room.nextRoundTimeout = setTimeout(() => {
        startFinalVote(room);
      }, 5000);
    } else if ((room.mode === "duo" || room.mode === "team") && (scoreA >= 8 || scoreB >= 8)) {
      // Direct victory for team mode / duo mode at 8 trophies
      const winningTeam = scoreA >= 8 ? "A" : "B";
      room.state = "lobby";
      room.players.forEach((p) => { p.ready = p.ai; });
      broadcastToRoom(room, {
        type: "game_over",
        data: {
          message: `Team ${winningTeam} wins the match! 🏆`,
          players: room.players,
          tournamentFinished: true,
          winnerId: winner ? winner.id : null,
          teamTrophies: room.teamTrophies,
          teams: room.teams,
        },
      });
      broadcastLobbyUpdate(room);
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
  resetSurrenderVotes(room);
  if (isNewTournament) {
    // Determine winning map from votes
    const votes = { classic: 0, checkered: 0, colosseum: 0, powerzone: 0 };
    Object.values(room.mapVotes || {}).forEach((v) => { if (votes[v] !== undefined) votes[v]++; });
    let winningMap = "classic";
    let maxVotes = votes.classic;
    if (votes.checkered > maxVotes) { winningMap = "checkered"; maxVotes = votes.checkered; }
    if (votes.colosseum > maxVotes) { winningMap = "colosseum"; maxVotes = votes.colosseum; }
    if (votes.powerzone > maxVotes) { winningMap = "powerzone"; maxVotes = votes.powerzone; }
    room.currentMapType = winningMap;
    room.mapVotes = {};
    room.roundNumber = 0;
    if (isTeamMode(room.mode)) {
      room.teamTrophies = { A: 0, B: 0 };
      resetRotationQueues(room);
    }
  }

  room.roundNumber = (room.roundNumber || 0) + 1;

  // --- Pick active round players in team mode ---
  if (isTeamMode(room.mode) && !room._isFinalRound) {
    if (room.mode === "trio") {
      // 1v1 rotation for Trio mode
      const pickSingle = (team) => {
        if (!room.rotationQueues[team] || room.rotationQueues[team].length === 0) {
          room.rotationQueues[team] = shuffleArray([...room.teams[team]]);
        }
        let nextId = null;
        while (room.rotationQueues[team].length > 0) {
          const id = room.rotationQueues[team].shift();
          if (room.teams[team].includes(id)) {
            nextId = id;
            break;
          }
        }
        if (!nextId && room.teams[team].length > 0) {
          room.rotationQueues[team] = shuffleArray([...room.teams[team]]);
          nextId = room.rotationQueues[team].shift();
        }
        return nextId;
      };
      
      const pA = pickSingle("A");
      const pB = pickSingle("B");
      room.activeRoundPlayers = [];
      if (pA) room.activeRoundPlayers.push(pA);
      if (pB) room.activeRoundPlayers.push(pB);
    } else if (room.mode === "duo") {
      // All players active in Duo mode
      room.activeRoundPlayers = [...room.teams.A, ...room.teams.B];
    } else {
      // Original 2v2 rotation for old Team mode
      const pickPair = (team) => {
        if (!room.roundPairQueues[team] || room.roundPairQueues[team].length === 0) {
          room.roundPairQueues[team] = buildPairQueue(room.teams[team]);
        }
        return (room.roundPairQueues[team].shift() || []).filter(id => room.teams[team].includes(id));
      };
      room.activeRoundPlayers = [
        ...pickPair("A"),
        ...pickPair("B"),
      ];
    }
  }
  room._isFinalRound = false;

  const mapType = room.currentMapType || "classic";
  room.map = generateMap(mapType);

  // Position players (only active ones at the main spawn corners; spectators off-map or same spawn)
  room.players.forEach((p, index) => {
    const isActive = !isTeamMode(room.mode) || room.activeRoundPlayers.includes(p.id);
    const spawnIndex = isTeamMode(room.mode)
      ? room.activeRoundPlayers.indexOf(p.id)
      : index;
    const activeStarts = getStartsForMap(mapType);
    const spawn = activeStarts[(spawnIndex >= 0 ? spawnIndex : index) % activeStarts.length];
    p.x = spawn.x * TILE + TILE / 2;
    p.y = spawn.y * TILE + TILE / 2;
    p.dx = 0; p.dy = 0;
    p.alive = isActive; // spectators start dead
    p.speed = 142;
    p.bombs = 1;
    p.range = getStartingBombRange(p.ai, mapType);
    p.cooldown = 0; p.hasPunch = false; p.hasSlide = false;
    if (isNewTournament) p.trophies = 0;
  });

  room.bombs = []; room.blasts = []; room.pickups = [];
  if (mapType === "powerzone") {
    spawnPowerZonePickups(room);
  }
  room.roundTime = ROUND_SECONDS;
  room.zoneActive = false;
  room.zoneLayer = 0;
  room.zoneStepTimer = 0;
  room.state = "playing";

  broadcastToRoom(room, {
    type: "game_started",
    data: {
      map: room.map,
      players: room.players,
      pickups: room.pickups,
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
// SERVER CPU BOT AI
// ----------------------------------------------------------------

function placeServerBomb(room, player) {
  if (!player || !player.alive || player.cooldown > 0) return false;
  const tileX = Math.floor(player.x / TILE);
  const tileY = Math.floor(player.y / TILE);
  const activeBombsCount = room.bombs.filter((b) => b.ownerId === player.id).length;
  const tileHasBomb = room.bombs.some((b) => b.x === tileX && b.y === tileY);
  if (activeBombsCount >= player.bombs || tileHasBomb) return false;

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
  return true;
}

function updateServerBots(room, dt) {
  if (!room.map || room.map.length === 0) return;
  const activeSet = new Set(room.mode === "team" ? room.activeRoundPlayers : room.players.map(p => p.id));
  room.players.forEach((bot) => {
    if (!bot.ai || !bot.alive || !activeSet.has(bot.id)) return;

    bot.aiThink = (bot.aiThink || 0) - dt;
    const tile = gridAtServer(bot.x, bot.y);
    const danger = isDangerTileServer(room, tile.x, tile.y);
    const threatScore = getServerBotThreatScore(room, tile.x, tile.y);
    const isThreatened = threatScore > 0 || danger;

    if (isThreatened || bot.aiThink <= 0 || !bot.aiDir) {
      const safetyDir = getSafetyStepServer(room, bot, tile);
      if (safetyDir) {
        bot.aiDir = safetyDir;
        bot.aiThink = 0.05;
      } else {
        const dirs = [
          { x: 0, y: -1 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: -1, y: 0 },
          { x: 0, y: 0 },
        ];
        const ranked = dirs
          .map((dir) => ({ ...dir, score: scoreServerBotMove(room, bot, tile.x + dir.x, tile.y + dir.y) }))
          .sort((a, b) => b.score - a.score);
        bot.aiDir = { x: ranked[0].x, y: ranked[0].y };
        bot.aiThink = danger ? 0.04 : 0.08 + Math.random() * 0.10;
      }
    }

    const before = gridAtServer(bot.x, bot.y);
    moveServerActor(room, bot, bot.aiDir.x, bot.aiDir.y, dt);
    const after = gridAtServer(bot.x, bot.y);
    if (before.x === after.x && before.y === after.y && (bot.aiDir.x !== 0 || bot.aiDir.y !== 0)) bot.aiThink = 0;
    checkPickupCollision(room, bot);

    const nowTile = gridAtServer(bot.x, bot.y);
    if (bot.hasPunch && tryServerBotPunch(room, bot, nowTile)) {
      bot.aiThink = 0;
      return;
    }

    const canAttackEnemy = hasEnemyInBombLine(room, bot, nowTile);
    const nearbyCrate = hasAdjacentCrate(room, nowTile.x, nowTile.y);
    const nearbyEnemy = getServerBotEnemies(room, bot).some((enemy) => {
      const enemyTile = gridAtServer(enemy.x, enemy.y);
      return Math.abs(enemyTile.x - nowTile.x) + Math.abs(enemyTile.y - nowTile.y) <= Math.max(2, bot.range || 2);
    });
    const shouldBomb = bot.aiBombCooldown <= 0 && !isDangerTileServer(room, nowTile.x, nowTile.y) && shouldServerBotBomb(room, bot, nowTile, canAttackEnemy, nearbyCrate, nearbyEnemy);
    if (shouldBomb && hasEscapeTile(room, bot, nowTile)) {
      if (placeServerBomb(room, bot)) {
        const activeBombsCount = room.bombs.filter(b => b.ownerId === bot.id).length;
        if (activeBombsCount < bot.bombs && (nearbyEnemy || canAttackEnemy)) {
          bot.aiBombCooldown = 0.1 + Math.random() * 0.1;
        } else {
          bot.aiBombCooldown = 0.55 + Math.random() * 0.35;
        }
        bot.aiThink = 0;
      }
    }
  });
}

function gridAtServer(px, py) {
  return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) };
}

function isMapSolidServer(room, tileX, tileY) {
  if (!room.map[tileY] || !room.map[tileY][tileX]) return true;
  const cell = room.map[tileY][tileX];
  return cell === "wall" || cell === "crate" || cell === "zone";
}

function isSolidServer(room, tileX, tileY, actor = null) {
  if (isMapSolidServer(room, tileX, tileY)) return true;
  const actorTile = actor ? gridAtServer(actor.x, actor.y) : null;
  return room.bombs.some((bomb) => {
    if (actor && bomb.passableFor && bomb.passableFor.has(actor.id)) return false;
    if (actorTile && bomb.x === actorTile.x && bomb.y === actorTile.y) return false;
    return bomb.x === tileX && bomb.y === tileY;
  });
}

function canMoveServer(room, px, py, actor) {
  const radius = 13;
  const points = [
    [px - radius, py - radius],
    [px + radius, py - radius],
    [px - radius, py + radius],
    [px + radius, py + radius],
  ];
  return points.every(([x, y]) => {
    const tile = gridAtServer(x, y);
    return !isSolidServer(room, tile.x, tile.y, actor);
  });
}

function moveServerActor(room, actor, dx, dy, dt) {
  if (dx !== 0 && dy !== 0) dy = 0;
  const speed = actor.speed || 142;
  let nextX = actor.x + dx * speed * dt;
  let nextY = actor.y + dy * speed * dt;

  if (dx !== 0 && canMoveServer(room, nextX, actor.y, actor)) {
    actor.x = nextX;
  } else if (dx !== 0) {
    const tile = gridAtServer(actor.x, actor.y);
    if (tryKickBombServer(room, actor, tile, { x: Math.sign(dx), y: 0 }) && canMoveServer(room, nextX, actor.y, actor)) {
      actor.x = nextX;
    } else {
      dx = 0;
    }
  }
  if (dy !== 0 && canMoveServer(room, actor.x, nextY, actor)) {
    actor.y = nextY;
  } else if (dy !== 0) {
    const tile = gridAtServer(actor.x, actor.y);
    if (tryKickBombServer(room, actor, tile, { x: 0, y: Math.sign(dy) }) && canMoveServer(room, actor.x, nextY, actor)) {
      actor.y = nextY;
    } else {
      dy = 0;
    }
  }
  actor.dx = dx;
  actor.dy = dy;
}

function tryKickBombServer(room, actor, tile, dir) {
  if (!actor?.hasSlide || !actor.alive || !dir || (dir.x === 0 && dir.y === 0)) return false;
  const bomb = room.bombs.find((b) => b.x === tile.x + dir.x && b.y === tile.y + dir.y && (!b.vx || (b.vx === 0 && b.vy === 0)));
  if (!bomb) return false;
  if (isTileSolidForBombServer(room, bomb.x + dir.x, bomb.y + dir.y)) return false;
  bomb.vx = dir.x;
  bomb.vy = dir.y;
  bomb.slideX = bomb.x;
  bomb.slideY = bomb.y;
  if (!bomb.passableFor) bomb.passableFor = new Set();
  bomb.passableFor.add(actor.id);
  broadcastToRoom(room, { type: "bomb_punched", data: { bombId: bomb.id, vx: dir.x, vy: dir.y } });
  return true;
}

function scoreServerBotMove(room, bot, x, y) {
  if (isSolidServer(room, x, y, bot)) return -9999;
  let score = Math.random() * 2;
  const here = gridAtServer(bot.x, bot.y);
  if (x === here.x && y === here.y) score -= 56;

  const threat = getServerBotThreatScore(room, x, y);
  score -= threat;
  if (threat >= 1200) return score;

  const safeExits = countServerSafeExits(room, bot, x, y);
  score += safeExits * 34;
  if (safeExits === 0) score -= 280;

  const pickup = room.pickups.find(p => p.x === x && p.y === y);
  if (pickup) score += pickup.type === "full_fire" || pickup.type === "punch" || pickup.type === "slide" ? 190 : 135;
  if (hasAdjacentCrate(room, x, y)) score += hasEscapeTile(room, bot, { x, y }) ? 42 : -80;

  const enemies = getServerBotEnemies(room, bot);
  if (enemies.length > 0) {
    const nearest = enemies
      .map(enemy => ({ enemy, dist: Math.abs(gridAtServer(enemy.x, enemy.y).x - x) + Math.abs(gridAtServer(enemy.x, enemy.y).y - y) }))
      .sort((a, b) => a.dist - b.dist)[0];
    score += Math.max(0, 125 - nearest.dist * 14);
    if (nearest.dist <= (bot.range || 2) && (x === gridAtServer(nearest.enemy.x, nearest.enemy.y).x || y === gridAtServer(nearest.enemy.x, nearest.enemy.y).y) && hasEscapeTile(room, bot, { x, y })) {
      score += 62;
    }
  }

  const target = findServerBotTarget(room, bot, here);
  if (target) {
    const dist = Math.abs(target.x - x) + Math.abs(target.y - y);
    score += Math.max(0, 110 - dist * 13);
  }
  return score;
}

function shouldServerBotBomb(room, bot, tile, canAttackEnemy, nearbyCrate, nearbyEnemy) {
  if (canAttackEnemy) return true;
  if (nearbyEnemy) {
    const enemies = getServerBotEnemies(room, bot);
    const nearestDist = enemies.reduce((min, enemy) => {
      const enemyTile = gridAtServer(enemy.x, enemy.y);
      const dist = Math.abs(enemyTile.x - tile.x) + Math.abs(enemyTile.y - tile.y);
      return Math.min(min, dist);
    }, 999);
    if (nearestDist <= 2) return Math.random() < 0.85;
    return Math.random() < 0.42;
  }
  if (nearbyCrate && countServerSafeExits(room, bot, tile.x, tile.y) >= 2) return Math.random() < 0.34;
  return false;
}

function getSafetyStepServer(room, bot, here) {
  if (getServerBotThreatScore(room, here.x, here.y) === 0 && !isDangerTileServer(room, here.x, here.y)) {
    return null;
  }
  const queue = [{ x: here.x, y: here.y, path: [] }];
  const seen = new Set([`${here.x},${here.y}`]);
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
  while (queue.length > 0) {
    const current = queue.shift();
    if (getServerBotThreatScore(room, current.x, current.y) === 0 && !isDangerTileServer(room, current.x, current.y)) {
      if (current.path.length > 0) {
        return current.path[0];
      }
      return null;
    }
    if (current.path.length >= 10) continue;
    for (const d of dirs) {
      const tx = current.x + d.x;
      const ty = current.y + d.y;
      const key = `${tx},${ty}`;
      if (seen.has(key)) continue;
      if (isSolidServer(room, tx, ty, bot)) continue;
      seen.add(key);
      queue.push({
        x: tx,
        y: ty,
        path: current.path.concat({ x: d.x, y: d.y })
      });
    }
  }
  return null;
}

function getServerBotThreatScore(room, x, y) {
  if (room.map[y]?.[x] === "zone") return 2200;
  let score = 0;
  room.blasts.forEach((blast) => {
    if (blast.cells?.some((cell) => cell.x === x && cell.y === y)) score = Math.max(score, 2600);
  });
  room.bombs.forEach((bomb) => {
    if (!bombThreatensTileAnyTimer(room, bomb, x, y)) return;
    if (bomb.timer < 0.75) score = Math.max(score, 2400);
    else if (bomb.timer < 1.35) score = Math.max(score, 1500);
    else score = Math.max(score, 420);
  });
  return score;
}

function bombThreatensTileAnyTimer(room, bomb, x, y) {
  if (bomb.x === x && bomb.y === y) return true;
  if (bomb.x !== x && bomb.y !== y) return false;
  const dx = Math.sign(x - bomb.x);
  const dy = Math.sign(y - bomb.y);
  const distance = Math.abs(x - bomb.x) + Math.abs(y - bomb.y);
  if (distance > bomb.range) return false;
  for (let i = 1; i <= distance; i += 1) {
    const cell = room.map[bomb.y + dy * i]?.[bomb.x + dx * i];
    if (!cell || cell === "wall") return false;
    if (cell === "crate") return i === distance;
  }
  return true;
}

function countServerSafeExits(room, bot, x, y) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter((n) => !isSolidServer(room, n.x, n.y, bot) && getServerBotThreatScore(room, n.x, n.y) < 1000).length;
}

function findServerBotTarget(room, bot, here) {
  const enemies = getServerBotEnemies(room, bot).map(enemy => ({ ...gridAtServer(enemy.x, enemy.y), weight: 3 }));
  const loot = room.pickups.map(pickup => ({ x: pickup.x, y: pickup.y, weight: pickup.type === "punch" || pickup.type === "full_fire" || pickup.type === "slide" ? 5 : 3 }));
  const crates = [];
  for (let y = 1; y < ROWS - 1; y += 1) {
    for (let x = 1; x < COLS - 1; x += 1) {
      if (room.map[y][x] === "crate") crates.push({ x, y, weight: 1 });
    }
  }
  return [...loot, ...enemies, ...crates]
    .filter(target => getServerBotThreatScore(room, target.x, target.y) < 1000)
    .map(target => ({ ...target, dist: Math.abs(target.x - here.x) + Math.abs(target.y - here.y) }))
    .sort((a, b) => (b.weight * 24 - b.dist) - (a.weight * 24 - a.dist))[0] || null;
}

function tryServerBotPunch(room, bot, tile) {
  const enemies = getServerBotEnemies(room, bot);
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const dir = dirs.find((d) => {
    const bomb = room.bombs.find((b) => b.x === tile.x + d.x && b.y === tile.y + d.y && (!b.vx || (b.vx === 0 && b.vy === 0)));
    if (!bomb || isTileSolidForBombServer(room, bomb.x + d.x, bomb.y + d.y)) return false;
    return enemies.some((enemy) => {
      const enemyTile = gridAtServer(enemy.x, enemy.y);
      return (d.x !== 0 && enemyTile.y === bomb.y && Math.sign(enemyTile.x - bomb.x) === d.x) ||
        (d.y !== 0 && enemyTile.x === bomb.x && Math.sign(enemyTile.y - bomb.y) === d.y);
    });
  });
  if (!dir) return false;
  const bomb = room.bombs.find((b) => b.x === tile.x + dir.x && b.y === tile.y + dir.y && (!b.vx || (b.vx === 0 && b.vy === 0)));
  if (!bomb) return false;
  bomb.vx = dir.x;
  bomb.vy = dir.y;
  bomb.slideX = bomb.x;
  bomb.slideY = bomb.y;
  broadcastToRoom(room, { type: "bomb_punched", data: { bombId: bomb.id, vx: dir.x, vy: dir.y } });
  return true;
}

function getServerBotEnemies(room, bot) {
  if (room.mode !== "team") {
    return room.players.filter(p => p.id !== bot.id && p.alive);
  }
  const botTeam = room.teams.A.includes(bot.id) ? "A" : "B";
  const enemyTeam = botTeam === "A" ? room.teams.B : room.teams.A;
  const activeSet = new Set(room.activeRoundPlayers || []);
  return room.players.filter(p => p.alive && activeSet.has(p.id) && enemyTeam.includes(p.id));
}

function hasEnemyInBombLine(room, bot, tile) {
  return getServerBotEnemies(room, bot).some((enemy) => {
    const enemyTile = gridAtServer(enemy.x, enemy.y);
    if (enemyTile.x !== tile.x && enemyTile.y !== tile.y) return false;
    const dx = Math.sign(enemyTile.x - tile.x);
    const dy = Math.sign(enemyTile.y - tile.y);
    const distance = Math.abs(enemyTile.x - tile.x) + Math.abs(enemyTile.y - tile.y);
    if (distance > (bot.range || 2)) return false;
    for (let i = 1; i < distance; i += 1) {
      if (isMapSolidServer(room, tile.x + dx * i, tile.y + dy * i)) return false;
    }
    return true;
  });
}

function hasAdjacentCrate(room, x, y) {
  return [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ].some(dir => room.map[y + dir.y]?.[x + dir.x] === "crate");
}

function hasEscapeTile(room, bot, tile) {
  const queue = [{ x: tile.x, y: tile.y, depth: 0 }];
  const seen = new Set([`${tile.x},${tile.y}`]);
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  while (queue.length) {
    const current = queue.shift();
    if (current.depth > 0 && !wouldBombThreatenTile(room, tile, current.x, current.y, bot.range || 2) && !isDangerTileServer(room, current.x, current.y)) {
      return true;
    }
    if (current.depth >= 6) continue;
    dirs.forEach((dir) => {
      const x = current.x + dir.x;
      const y = current.y + dir.y;
      const key = `${x},${y}`;
      if (seen.has(key) || isSolidServer(room, x, y, bot)) return;
      seen.add(key);
      queue.push({ x, y, depth: current.depth + 1 });
    });
  }
  return false;
}

function isDangerTileServer(room, x, y) {
  if (room.map[y]?.[x] === "zone") return true;
  return room.bombs.some((bomb) => bombThreatensTile(room, bomb, x, y));
}

function bombThreatensTile(room, bomb, x, y) {
  if (bomb.x === x && bomb.y === y) return true;
  if (bomb.x !== x && bomb.y !== y) return false;
  const dx = Math.sign(x - bomb.x);
  const dy = Math.sign(y - bomb.y);
  const distance = Math.abs(x - bomb.x) + Math.abs(y - bomb.y);
  if (distance > bomb.range) return false;
  for (let i = 1; i <= distance; i += 1) {
    const cell = room.map[bomb.y + dy * i]?.[bomb.x + dx * i];
    if (!cell || cell === "wall") return false;
    if (cell === "crate") return i === distance;
  }
  return true;
}

function wouldBombThreatenTile(room, bombTile, x, y, range) {
  if (bombTile.x === x && bombTile.y === y) return true;
  if (bombTile.x !== x && bombTile.y !== y) return false;
  const dx = Math.sign(x - bombTile.x);
  const dy = Math.sign(y - bombTile.y);
  const distance = Math.abs(x - bombTile.x) + Math.abs(y - bombTile.y);
  if (distance > range) return false;
  for (let i = 1; i <= distance; i += 1) {
    const cell = room.map[bombTile.y + dy * i]?.[bombTile.x + dx * i];
    if (!cell || cell === "wall" || cell === "crate") return false;
  }
  return true;
}

// ----------------------------------------------------------------
// MAP GENERATION
// ----------------------------------------------------------------

function getStartsForMap(mapType) {
  return mapType === "powerzone" ? powerZoneStarts : starts;
}

function getStartingBombRange(ai = false, mapType = "classic") {
  return mapType === "powerzone" ? 1 : 2;
}

function getPowerZonePickupType(x, y) {
  const types = ["bomb", "flame", "bomb", "speed", "bomb", "flame", "speed", "bomb"];
  let perimeterIndex = 0;
  if (y === 1) perimeterIndex = x - 1;
  else if (x === COLS - 2) perimeterIndex = (COLS - 2) + (y - 2);
  else if (y === ROWS - 2) perimeterIndex = (COLS - 2) + (ROWS - 3) + (COLS - 2 - x);
  else perimeterIndex = (COLS - 2) * 2 + (ROWS - 3) + (ROWS - 2 - y);
  return types[((perimeterIndex % types.length) + types.length) % types.length];
}

function spawnPowerZonePickups(room) {
  room.pickups = room.pickups.filter((pickup) => !isPowerZoneLaneTile(pickup.x, pickup.y));
  for (let x = 1; x <= COLS - 2; x++) {
    room.pickups.push({ x, y: 1, type: getPowerZonePickupType(x, 1) });
    room.pickups.push({ x, y: ROWS - 2, type: getPowerZonePickupType(x, ROWS - 2) });
  }
  for (let y = 1; y <= ROWS - 2; y++) {
    if (y === 1 || y === ROWS - 2) continue;
    room.pickups.push({ x: 1, y, type: getPowerZonePickupType(1, y) });
    room.pickups.push({ x: COLS - 2, y, type: getPowerZonePickupType(COLS - 2, y) });
  }
}

function isPowerZoneLaneTile(x, y) {
  return x === 1 || y === 1 || x === COLS - 2 || y === ROWS - 2;
}

function generateMap(mapType) {
  const nextMap = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return "wall";
      
      if (mapType === "powerzone") {
        if (x >= 5 && x <= 9 && y >= 5 && y <= 7) return "grass";
        if ((x === 4 || x === 10) && (y >= 4 && y <= 8)) return "crate";
        if ((y === 4 || y === 8) && (x >= 4 && x <= 10)) return "crate";
        if (x === 1 || y === 1 || x === COLS - 2 || y === ROWS - 2) return "grass";
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        return "grass";
      } else if (mapType === "colosseum") {
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
  getStartsForMap(mapType).forEach((s) => {
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
