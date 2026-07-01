const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve downloads page at root /
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "download.html"));
});

// Redirect old /downloads to /
app.get(["/downloads", "/downloads/"], (_req, res) => {
  res.redirect(301, "/");
});

// Serve emulator game client at /emulator
app.get(["/emulator", "/emulator/"], (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Redirect direct index.html requests to /emulator
app.get("/index.html", (_req, res) => {
  res.redirect(301, "/emulator");
});

app.get("/api/online-players", (_req, res) => {
  res.json({ count: wss.clients.size });
});

const fs = require("fs");
const downloadsFilePath = path.join(__dirname, "downloads.json");
let totalDownloads = 1248604;

try {
  if (fs.existsSync(downloadsFilePath)) {
    const data = JSON.parse(fs.readFileSync(downloadsFilePath, "utf8"));
    if (data && typeof data.count === "number") {
      totalDownloads = data.count;
    }
  } else {
    fs.writeFileSync(downloadsFilePath, JSON.stringify({ count: totalDownloads }), "utf8");
  }
} catch (err) {
  console.error("Failed to read/write downloads file:", err);
}

app.get("/api/total-downloads", (_req, res) => {
  res.json({ count: totalDownloads });
});

app.get("/api/track-download", (_req, res) => {
  totalDownloads++;
  try {
    fs.writeFileSync(downloadsFilePath, JSON.stringify({ count: totalDownloads }), "utf8");
  } catch (err) {
    console.error("Failed to write downloads file:", err);
  }
  res.json({ success: true, count: totalDownloads });
});

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
  if (mode === "br_solo" || mode === "br_duo" || mode === "br_trio") return 20;
  if (isChallenge && mode === "solo") return 6; // Allow up to 6 players in solo challenge free-for-all
  if (mode === "trio" || mode === "team") return 6;
  return 4; // solo, duo, standard
}

function getLobbyCapacity(mode) {
  if (mode === "solo" || mode === "br_solo") return 1;
  if (mode === "duo" || mode === "br_duo") return 2;
  if (mode === "trio" || mode === "br_trio") return 3;
  return 3; // default
}

function isTeamMode(mode) {
  return mode === "team" || mode === "duo" || mode === "trio" || mode === "br_duo" || mode === "br_trio";
}

function isBattleRoyale(mode) {
  return mode === "br_solo" || mode === "br_duo" || mode === "br_trio";
}

function getCols(mode) {
  if (isBattleRoyale(mode)) return 61;
  return 15;
}

function getRows(mode) {
  if (isBattleRoyale(mode)) return 61;
  return 13;
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

      if (room.isChallenge) {
        console.log(`Challenge Mode: Starting map voting immediately for room ${room.code}`);
        startMapVoting(room);
      } else {
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
      }
      break;
    }

    case "set_lobby_mode": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      room.isChallenge = !!data.isChallenge;
      if (room.isChallenge) {
        room.mode = "solo";
      } else {
        room.mode = "trio";
      }
      broadcastLobbyUpdate(room);
      break;
    }
    case "voice_chat_audio": {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      // Broadcast voice packet to all other players in the room
      const payload = JSON.stringify({
        type: "voice_chat_audio",
        data: {
          playerId: ws.id,
          audio: data.audio,
          sampleRate: data.sampleRate
        }
      });
      wss.clients.forEach((client) => {
        if (client.roomCode === room.code && client.id !== ws.id && client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
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
      const lobbyCap = room.isChallenge ? 4 : getLobbyCapacity(room.mode);
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
      const maxPlayers = getMatchMaxPlayers(room.mode, room.isChallenge);
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

    case "fill_match_with_bots": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.hostId !== ws.id || room.state !== "lobby") return;
      clearMatchmakingTimers(room);
      fillAllRemainingWithBots(room);
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
      if (room.matchmakingInterval) { clearInterval(room.matchmakingInterval); room.matchmakingInterval = null; }

      if (!isOnlineServer()) {
        fillAllRemainingWithBots(room);
      } else {
        if (isBattleRoyale(room.mode)) {
          startBRPreMatch(room);
        } else {
          broadcastLobbyUpdate(room);
          startMapVoting(room);
        }
      }
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

    case "player_surrender": {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      const player = room.players.find(p => p.id === ws.id);
      if (!player) return;

      broadcastToRoom(room, {
        type: "player_surrendered",
        data: {
          playerId: player.id,
          playerName: player.name,
        },
      });

      leaveRoom(ws, true);
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
        if (player.healingState && (dx !== 0 || dy !== 0)) {
          player.healingState = null;
          broadcastToRoom(room, { type: "healing_cancelled", data: { playerId: player.id } });
        }
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

    case "use_item": {
      const room = rooms.get(ws.roomCode);
      if (!room || room.state !== "playing") return;
      const player = room.players.find(p => p.id === ws.id);
      if (!player || !player.alive || player.knocked) return;
      
      const itemType = data.itemType;
      if (itemType === "bandage" && (player.bandageCount || 0) > 0) {
        player.healingState = { itemType, timeLeft: 2.0 };
        broadcastToRoom(room, { type: "healing_started", data: { playerId: player.id, itemType, duration: 2.0 } });
      } else if (itemType === "medkit" && (player.medkitCount || 0) > 0) {
        player.healingState = { itemType, timeLeft: 2.0 };
        broadcastToRoom(room, { type: "healing_started", data: { playerId: player.id, itemType, duration: 2.0 } });
      } else if (itemType === "energy_drink" && (player.energyDrinkCount || 0) > 0) {
        player.energyDrinkCount--;
        player.energyDrinkTimeLeft = 10.0;
        player.shield = Math.min(100, (player.shield || 0) + 50);
        broadcastToRoom(room, { type: "item_used", data: { playerId: player.id, itemType, shield: player.shield, energyDrinkCount: player.energyDrinkCount } });
      }
      break;
    }

    case "ping_location": {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      broadcastToRoom(room, {
        type: "location_pinged",
        data: {
          playerId: ws.id,
          x: data.x,
          y: data.y,
          pingType: data.pingType
        }
      });
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
    // Battle Royale specific
    brZone: null,
    supplyDropTimer: 0,
    worldEventTimer: 0,
    activeSupplyDrop: null,
    currentWorldEvent: null,
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
  if (room.activeRoundPlayers) {
    room.activeRoundPlayers = room.activeRoundPlayers.filter(id => id !== ws.id);
  }
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

function isOnlineServer() {
  return process.env.RENDER === "true" || 
         process.env.NODE_ENV === "production" || 
         process.env.ONLINE_SERVER === "true" ||
         (process.env.PORT && process.env.PORT !== "3000" && process.env.PORT !== 3000);
}

function startMatchmakingTimers(room) {
  if (room.matchmakingInterval) return;

  room.matchmakingElapsed = 0;
  room.matchmakingInterval = setInterval(() => {
    room.matchmakingElapsed++;
    
    // Broadcast matchmaking countdown (max 20s)
    broadcastToRoom(room, {
      type: "matchmaking_countdown",
      data: { secondsLeft: Math.max(0, 20 - room.matchmakingElapsed), elapsed: room.matchmakingElapsed }
    });

    // If match exceeds 20 seconds, auto-fill remaining slots with bots and start the match
    if (room.matchmakingElapsed >= 20) {
      console.log(`Matchmaking 20s timeout/fill check for room ${room.code}. Auto-filling bots and starting.`);
      clearMatchmakingTimers(room);
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
  if (room.mode === "solo" || room.mode === "br_solo") {
    while (room.players.length < maxPlayers) {
      addBotToRoom(room);
    }
  } else if (room.mode === "duo") {
    fillTeamToSize(room, "A", 2);
    fillTeamToSize(room, "B", 2);
  } else if (room.mode === "trio" || room.mode === "team") {
    fillTeamToSize(room, "A", 3);
    fillTeamToSize(room, "B", 3);
  } else if (room.mode === "br_duo" || room.mode === "br_trio") {
    while (room.players.length < maxPlayers) {
      addBotToRoom(room);
    }
  }
  
  if (isBattleRoyale(room.mode)) {
    startBRPreMatch(room);
  } else {
    broadcastLobbyUpdate(room);
    startMapVoting(room);
  }
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
  
  const botNames = [
    "ChiikawaFan", "Hachiware_Lover", "UsagiRun", "MomongaGamer", "StarryNight",
    "BombMaster", "BlastHero", "PixelNinja", "GoldenPudding", "PandaChoco",
    "GamerPro_99", "SweetMochi", "BlueSky", "ShadowWalker", "SparkleEyes",
    "SuperChiika", "MelonSoda", "HappyCat", "RabbitJump", "FluffyCloud",
    "CyberPanda", "NeonSpark", "IceCreamCone", "WaffleLover", "Dreamer_01",
    "SpaceBunny", "ChocoMint", "CookieMonster", "SakuraDream", "FireFly",
    "Starlight", "BubbleTea", "HoneyBear", "MatchaGreen", "WinterSnow",
    "AutumnLeaves", "SunsetGlow", "StormChaser", "WindRider", "WaveCatcher",
    "MoonLight", "SunnyDay", "RainbowDash", "LittleStar", "GalaxyExplorer",
    "TimeTraveler", "MagicWand", "LuckyCharm", "PandaRoll", "StrawberryPie"
  ];
  
  const usedNames = room.players.map(p => p.name);
  const availableNames = botNames.filter(n => !usedNames.includes(n));
  const name = availableNames.length > 0 
    ? availableNames[Math.floor(Math.random() * availableNames.length)] 
    : botNames[Math.floor(Math.random() * botNames.length)] + "_" + Math.floor(Math.random() * 100);

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
    
    // Battle Royale Loot
    else if (pickup.type === "bandage") player.bandageCount = (player.bandageCount || 0) + 1;
    else if (pickup.type === "medkit") player.medkitCount = (player.medkitCount || 0) + 1;
    else if (pickup.type === "energy_drink") player.energyDrinkCount = (player.energyDrinkCount || 0) + 1;
    else if (pickup.type === "revive_kit") player.reviveKitCount = (player.reviveKitCount || 0) + 1;
    else if (pickup.type === "shield") player.shield = Math.min(75, (player.shield || 0) + 25);
    else if (pickup.type === "full_armor") player.shield = 75;
    else if (pickup.type === "backpack") {
      player.maxBombsLimit = 6;
      player.bombs = Math.min(6, player.bombs + 1);
    }
    else if (["remote_bomb", "mega_bomb", "golden_bomb", "teleport_bomb", "nuke_bomb"].includes(pickup.type)) {
      player.activeBombType = pickup.type;
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
          hasSlide: !!player.hasSlide,
          hp: player.hp,
          shield: player.shield,
          bandageCount: player.bandageCount || 0,
          medkitCount: player.medkitCount || 0,
          energyDrinkCount: player.energyDrinkCount || 0,
          reviveKitCount: player.reviveKitCount || 0,
          activeBombType: player.activeBombType || "normal",
        },
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
    if (isBattleRoyale(room.mode)) {
      checkBRGameEnd(room);
    } else {
      endRound(room, null);
    }
    return;
  }

  room.players.forEach((p) => {
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.aiBombCooldown > 0) p.aiBombCooldown = Math.max(0, p.aiBombCooldown - dt);
  });

  if (isBattleRoyale(room.mode)) {
    room.players.forEach((p) => {
      if (p.healingState) {
        p.healingState.timeLeft -= dt;
        if (p.healingState.timeLeft <= 0) {
          const finishedType = p.healingState.itemType;
          p.healingState = null;
          if (finishedType === "bandage" && (p.bandageCount || 0) > 0) {
            p.bandageCount--;
            p.hp = Math.min(100, p.hp + 25);
          } else if (finishedType === "medkit" && (p.medkitCount || 0) > 0) {
            p.medkitCount--;
            p.hp = 100;
          }
          broadcastToRoom(room, {
            type: "player_healed",
            data: {
              playerId: p.id,
              hp: p.hp,
              bandageCount: p.bandageCount || 0,
              medkitCount: p.medkitCount || 0
            }
          });
        }
      }
      if (p.energyDrinkTimeLeft > 0) {
        p.energyDrinkTimeLeft = Math.max(0, p.energyDrinkTimeLeft - dt);
      }
      if (p.alive && p.knocked) {
        p.bleedoutTimer = (p.bleedoutTimer || 0) + dt;
        if (p.bleedoutTimer >= 1.0) {
          p.bleedoutTimer = 0;
          p.hp = Math.max(0, p.hp - 2);
          broadcastToRoom(room, {
            type: "player_damaged",
            data: { playerId: p.id, hp: p.hp, shield: p.shield }
          });
          if (p.hp <= 0) {
            eliminatePlayer(room, p, "bleedout");
          }
        }
      }
    });

    checkBRRevives(room, dt);
    updateBRSupplyDrops(room, dt);
    updateBRWorldEvents(room, dt);
    updateBRZone(room, dt);

    room.zoneDamageTimer = (room.zoneDamageTimer || 0) + dt;
    if (room.zoneDamageTimer >= 1.0) {
      room.zoneDamageTimer = 0;
      room.players.forEach((p) => {
        if (p.alive && !p.knocked && room.brZone) {
          const dist = Math.hypot(p.x - room.brZone.x, p.y - room.brZone.y);
          if (dist > room.brZone.radius) {
            const phase = room.brZone.phase;
            const damage = phase === 1 ? 2 : phase === 2 ? 5 : phase === 3 ? 8 : phase === 4 ? 12 : 20;
            damagePlayer(room, p, damage, "storm");
          }
        }
      });
    }
  }

  updateServerBots(room, dt);
  
  if (!isBattleRoyale(room.mode)) {
    updateServerZone(room, dt);
  }

  const cols = room.map[0] ? room.map[0].length : COLS;
  const rows = room.map ? room.map.length : ROWS;

  room.bombs.forEach((bomb) => {
    if (bomb.vx !== undefined && bomb.vy !== undefined && (bomb.vx !== 0 || bomb.vy !== 0)) {
      if (bomb.slideX === undefined) bomb.slideX = bomb.x;
      if (bomb.slideY === undefined) bomb.slideY = bomb.y;
      bomb.slideX += bomb.vx * 6.0 * dt;
      bomb.slideY += bomb.vy * 6.0 * dt;
      
      if (bomb.vx > 0 && bomb.slideX >= bomb.x + 1) {
        bomb.x++;
        if (bomb.x === cols - 1) {
          if (!isTileSolidForBombServer(room, 1, bomb.y)) {
            bomb.x = 1;
            bomb.slideX = 1;
          } else {
            bomb.x = cols - 2;
            bomb.slideX = bomb.x;
            bomb.vx = 0;
          }
        } else {
          if (isTileSolidForBombServer(room, bomb.x + 1, bomb.y) && bomb.x + 1 !== cols - 1) {
            bomb.slideX = bomb.x;
            bomb.vx = 0;
          }
        }
      } else if (bomb.vx < 0 && bomb.slideX <= bomb.x - 1) {
        bomb.x--;
        if (bomb.x === 0) {
          if (!isTileSolidForBombServer(room, cols - 2, bomb.y)) {
            bomb.x = cols - 2;
            bomb.slideX = cols - 2;
          } else {
            bomb.x = 1;
            bomb.slideX = bomb.x;
            bomb.vx = 0;
          }
        } else {
          if (isTileSolidForBombServer(room, bomb.x - 1, bomb.y) && bomb.x - 1 !== 0) {
            bomb.slideX = bomb.x;
            bomb.vx = 0;
          }
        }
      } else if (bomb.vy > 0 && bomb.slideY >= bomb.y + 1) {
        bomb.y++;
        if (bomb.y === rows - 1) {
          if (!isTileSolidForBombServer(room, bomb.x, 1)) {
            bomb.y = 1;
            bomb.slideY = 1;
          } else {
            bomb.y = rows - 2;
            bomb.slideY = bomb.y;
            bomb.vy = 0;
          }
        } else {
          if (isTileSolidForBombServer(room, bomb.x, bomb.y + 1) && bomb.y + 1 !== rows - 1) {
            bomb.slideY = bomb.y;
            bomb.vy = 0;
          }
        }
      } else if (bomb.vy < 0 && bomb.slideY <= bomb.y - 1) {
        bomb.y--;
        if (bomb.y === 0) {
          if (!isTileSolidForBombServer(room, bomb.x, rows - 2)) {
            bomb.y = rows - 2;
            bomb.slideY = rows - 2;
          } else {
            bomb.y = 1;
            bomb.slideY = bomb.y;
            bomb.vy = 0;
          }
        } else {
          if (isTileSolidForBombServer(room, bomb.x, bomb.y - 1) && bomb.y - 1 !== 0) {
            bomb.slideY = bomb.y;
            bomb.vy = 0;
          }
        }
      }
    }
  });

  const exploded = [];
  room.bombs.forEach((bomb) => { bomb.timer -= dt; if (bomb.timer <= 0) exploded.push(bomb); });
  exploded.forEach((bomb) => triggerExplosion(room, bomb));

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
        speed: p.speed + (p.energyDrinkTimeLeft > 0 ? 50 : 0),
        bombs: p.bombs,
        range: p.range,
        hasPunch: !!p.hasPunch,
        hasSlide: !!p.hasSlide,
        hp: p.hp,
        shield: p.shield,
        knocked: !!p.knocked,
        bandageCount: p.bandageCount || 0,
        medkitCount: p.medkitCount || 0,
        energyDrinkCount: p.energyDrinkCount || 0,
        reviveKitCount: p.reviveKitCount || 0,
        reviveProgress: p.reviveProgress || 0,
        kills: p.kills || 0,
        damageDealt: p.damageDealt || 0,
      })),
      map: room.map,
      roundTime: room.roundTime,
      brZone: room.brZone ? {
        x: room.brZone.x,
        y: room.brZone.y,
        radius: room.brZone.radius,
        nextX: room.brZone.nextX,
        nextY: room.brZone.nextY,
        nextRadius: room.brZone.nextRadius,
        timeLeft: room.brZone.timeLeft,
        isShrinking: room.brZone.isShrinking,
        phase: room.brZone.phase,
      } : null,
      worldEvent: room.currentWorldEvent ? {
        type: room.currentWorldEvent.type,
        duration: room.currentWorldEvent.duration
      } : null,
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
      const cellType = room.map[y][x];
      if (cellType === "crate" || cellType === "golden_crate" || cellType === "supply_crate") {
        room.map[y][x] = "grass";
        destroyedCrates.push({ x, y });
        let type = null;
        if (cellType === "golden_crate") {
          const list = ["golden_bomb", "teleport_bomb", "nuke_bomb", "full_armor", "revive_kit", "backpack"];
          type = list[Math.floor(Math.random() * list.length)];
        } else if (cellType === "supply_crate") {
          const list = ["nuke_bomb", "full_armor", "revive_kit", "golden_bomb", "medkit", "punch", "slide"];
          for (let k = 0; k < 4; k++) {
            const t = list[Math.floor(Math.random() * list.length)];
            const neighbors = [{x: 0, y: 0}, {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
            const n = neighbors[k % neighbors.length];
            if (room.map[y + n.y]?.[x + n.x] === "grass") {
              const p = { x: x + n.x, y: y + n.y, type: t };
              room.pickups.push(p);
              spawnedPickups.push(p);
            }
          }
        } else {
          const roll = Math.random();
          if (roll < 0.18) type = "flame"; else if (roll < 0.32) type = "bomb";
          else if (roll < 0.44) type = "speed"; else if (roll < 0.50) type = "full_fire";
          else if (roll < 0.56) type = "punch"; else if (roll < 0.64) type = "slide";
        }
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
      if (gx === cell.x && gy === cell.y) {
        if (isBattleRoyale(room.mode)) {
          let damage = 25;
          if (bomb.bombType === "power_bomb" || bomb.bombType === "teleport_bomb") damage = 40;
          else if (bomb.bombType === "mega_bomb") damage = 60;
          else if (bomb.bombType === "golden_bomb") damage = 80;
          else if (bomb.bombType === "nuke_bomb") damage = 100;
          if (cell.center) damage += 15;
          
          damagePlayer(room, p, damage, bomb.ownerId);
          
          if (bomb.bombType === "teleport_bomb" && p.alive && !p.knocked) {
            const cols = getCols(room.mode);
            const rows = getRows(room.mode);
            for (let attempt = 0; attempt < 100; attempt++) {
              const tx = 2 + Math.floor(Math.random() * (cols - 4));
              const ty = 2 + Math.floor(Math.random() * (rows - 4));
              if (room.map[ty]?.[tx] === "grass") {
                p.x = tx * TILE + TILE / 2;
                p.y = ty * TILE + TILE / 2;
                break;
              }
            }
          }
        } else {
          p.alive = false;
          deadPlayers.push(p.id);
        }
      }
    });
  });

  room.bombs.forEach((other) => {
    if (cells.some((cell) => cell.x === other.x && cell.y === other.y)) other.timer = Math.min(other.timer, 0.04);
  });

  broadcastToRoom(room, {
    type: "bomb_exploded",
    data: { bombId: bomb.id, ownerId: bomb.ownerId, cells, destroyedCrates, spawnedPickups, deadPlayers, map: room.map },
  });

  if (isBattleRoyale(room.mode)) {
    checkBRGameEnd(room);
  } else {
    checkGameEnd(room);
  }
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
  if (isBattleRoyale(room.mode)) {
    startBRGame(room);
    return;
  }
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
  if (!player || !player.alive || player.cooldown > 0 || player.knocked) return false;
  const tileX = Math.floor(player.x / TILE);
  const tileY = Math.floor(player.y / TILE);
  const activeBombsCount = room.bombs.filter((b) => b.ownerId === player.id).length;
  const tileHasBomb = room.bombs.some((b) => b.x === tileX && b.y === tileY);
  if (activeBombsCount >= player.bombs || tileHasBomb) return false;

  const bombType = player.activeBombType || "normal";
  const timer = bombType === "nuke_bomb" ? 3.5 : bombType === "teleport_bomb" ? 2.0 : 2.25;
  const range = bombType === "nuke_bomb" ? Math.max(player.range, 6) : player.range;

  const bomb = {
    id: "bomb_" + Math.random().toString(36).substr(2, 9),
    x: tileX, y: tileY,
    ownerId: player.id,
    range: range,
    timer: timer,
    bombType: bombType
  };
  room.bombs.push(bomb);
  player.cooldown = 0.05;
  
  if (bombType !== "normal") {
    player.activeBombType = "normal";
  }

  broadcastToRoom(room, { type: "bomb_placed", data: { bomb } });
  return true;
}

function updateServerBots(room, dt) {
  if (!room.map || room.map.length === 0) return;
  const activeSet = new Set(room.mode === "team" ? room.activeRoundPlayers : room.players.map(p => p.id));
  room.players.forEach((bot) => {
    if (!bot.ai || !bot.alive || !activeSet.has(bot.id)) return;

    if (bot.knocked) {
      const teammate = room.players.find(p => p.id !== bot.id && p.teamId === bot.teamId && p.alive && !p.knocked);
      if (teammate) {
        const dx = Math.sign(teammate.x - bot.x);
        const dy = Math.sign(teammate.y - bot.y);
        moveServerActor(room, bot, dx, dy, dt);
      }
      return;
    }

    if (isBattleRoyale(room.mode) && bot.hp < 60 && !bot.healingState) {
      if ((bot.medkitCount || 0) > 0) {
        bot.medkitCount--;
        bot.healingState = { itemType: "medkit", timeLeft: 2.0 };
        broadcastToRoom(room, { type: "healing_started", data: { playerId: bot.id, itemType: "medkit", duration: 2.0 } });
        return;
      } else if ((bot.bandageCount || 0) > 0) {
        bot.bandageCount--;
        bot.healingState = { itemType: "bandage", timeLeft: 2.0 };
        broadcastToRoom(room, { type: "healing_started", data: { playerId: bot.id, itemType: "bandage", duration: 2.0 } });
        return;
      }
    }
    if (bot.healingState) return;



    bot.aiThink = (bot.aiThink || 0) - dt;
    const tile = gridAtServer(bot.x, bot.y);
    const danger = isDangerTileServer(room, tile.x, tile.y);
    const threatScore = getServerBotThreatScore(room, tile.x, tile.y);
    const isBombThreat = room.bombs.some((bomb) => bombThreatensTile(room, bomb, tile.x, tile.y)) || threatScore > 0;

    // Only recalculate immediately if threatened by an active bomb/blast.
    // Otherwise, wait until the think timer expires.
    if (bot.aiThink <= 0 || !bot.aiDir || isBombThreat) {
      bot.aiTarget = findServerBotTarget(room, bot, tile);
      const safetyDir = getSafetyStepServer(room, bot, tile);
      if (safetyDir) {
        bot.aiDir = safetyDir;
        bot.aiThink = 0.10;
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
        bot.aiThink = danger ? 0.08 : 0.16 + Math.random() * 0.12;
      }
    }

    const beforeX = bot.x;
    const beforeY = bot.y;
    moveServerActor(room, bot, bot.aiDir.x, bot.aiDir.y, dt);
    const movedPixels = Math.hypot(bot.x - beforeX, bot.y - beforeY);
    if (movedPixels < 0.1 && (bot.aiDir.x !== 0 || bot.aiDir.y !== 0)) {
      bot.aiStuckFrames = (bot.aiStuckFrames || 0) + 1;
      bot.aiThink = 0;
      const rescueDir = getSafetyStepServer(room, bot, gridAtServer(bot.x, bot.y)) || getServerUnstuckStep(room, bot, gridAtServer(bot.x, bot.y));
      if (rescueDir) bot.aiDir = rescueDir;
    } else {
      bot.aiStuckFrames = 0;
    }
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
    const shouldBomb = bot.aiBombCooldown <= 0 && !isDangerTileServer(room, nowTile.x, nowTile.y) && shouldServerBotBomb(room, bot, nowTile, canAttackEnemy, nearbyCrate, nearbyEnemy, bot.aiTarget);
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

function isCrateTile(cell) {
  return cell === "crate" || cell === "supply_crate" || cell === "golden_crate";
}

function isTileOutsideNextZoneServer(room, tx, ty) {
  if (!room.brZone) return false;
  const px = tx * TILE + TILE / 2;
  const py = ty * TILE + TILE / 2;
  return Math.hypot(px - room.brZone.nextX, py - room.brZone.nextY) > room.brZone.nextRadius;
}

function isPixelOutsideNextZoneServer(room, px, py) {
  if (!room.brZone) return false;
  return Math.hypot(px - room.brZone.nextX, py - room.brZone.nextY) > room.brZone.nextRadius;
}

function isCrateOnPathToTargetServer(room, bot, tile, target) {
  if (!target) return false;
  const currentDist = Math.abs(target.x - tile.x) + Math.abs(target.y - tile.y);
  const rows = getRows(room.mode);
  const cols = getCols(room.mode);
  return [
    { x: tile.x + 1, y: tile.y },
    { x: tile.x - 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x, y: tile.y - 1 },
  ].some((n) => {
    if (n.x < 1 || n.x >= cols - 1 || n.y < 1 || n.y >= rows - 1) return false;
    if (!isCrateTile(room.map[n.y]?.[n.x])) return false;
    const nDist = Math.abs(target.x - n.x) + Math.abs(target.y - n.y);
    return nDist < currentDist;
  });
}

function gridAtServer(px, py) {
  return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) };
}

function isMapSolidServer(room, tileX, tileY) {
  if (!room.map[tileY] || !room.map[tileY][tileX]) return true;
  const cell = room.map[tileY][tileX];
  return cell === "wall" || cell === "crate" || cell === "zone" || cell === "supply_crate" || cell === "golden_crate";
}

function overlapsBombServer(actor, bomb) {
  const radius = actor.radius || 13;
  const tileLeft = bomb.x * TILE;
  const tileTop = bomb.y * TILE;
  return (
    actor.x + radius > tileLeft &&
    actor.x - radius < tileLeft + TILE &&
    actor.y + radius > tileTop &&
    actor.y - radius < tileTop + TILE
  );
}

function isSolidServer(room, tileX, tileY, actor = null) {
  if (isMapSolidServer(room, tileX, tileY)) return true;
  return room.bombs.some((bomb) => {
    if (actor && bomb.passableFor && bomb.passableFor.has(actor.id)) return false;
    if (actor && overlapsBombServer(actor, bomb)) return false;
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

  if (room.brZone) {
    const px = x * TILE + TILE / 2;
    const py = y * TILE + TILE / 2;
    const dist = Math.hypot(px - room.brZone.x, py - room.brZone.y);
    if (dist > room.brZone.radius) {
      score -= 500;
    }
    const currentDist = Math.hypot(bot.x - room.brZone.x, bot.y - room.brZone.y);
    if (dist < currentDist) {
      score += 150;
    }
    
    // Also prioritize next safe zone if bot is outside it (even if not in storm yet)
    const botInNextStorm = isPixelOutsideNextZoneServer(room, bot.x, bot.y);
    if (botInNextStorm) {
      const nextDist = Math.hypot(px - room.brZone.nextX, py - room.brZone.nextY);
      const botNextDist = Math.hypot(bot.x - room.brZone.nextX, bot.y - room.brZone.nextY);
      if (nextDist < botNextDist) {
        score += 800;
      } else {
        score -= 800;
      }
    }
  }

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

  const target = bot.aiTarget;
  if (target) {
    const dist = Math.abs(target.x - x) + Math.abs(target.y - y);
    score += Math.max(0, 110 - dist * 13);
  }
  return score;
}

function shouldServerBotBomb(room, bot, tile, canAttackEnemy, nearbyCrate, nearbyEnemy, target) {
  const escapePlan = getServerEscapePlan(room, bot, tile, tile, 18);
  if (!escapePlan) return false;
  const trapScore = getServerEnemyTrapScore(room, bot, tile);
  if (canAttackEnemy) return true;
  if (nearbyEnemy) {
    const enemies = getServerBotEnemies(room, bot);
    const nearestDist = enemies.reduce((min, enemy) => {
      const enemyTile = gridAtServer(enemy.x, enemy.y);
      const dist = Math.abs(enemyTile.x - tile.x) + Math.abs(enemyTile.y - tile.y);
      return Math.min(min, dist);
    }, 999);
    if (nearestDist <= 2 && trapScore >= 140) return true;
    if (nearestDist <= 2) return Math.random() < 0.85;
    return Math.random() < 0.42;
  }
  
  // Consider bombing adjacent crates if they lie on path to bot's current target
  const strategicCrate = !canAttackEnemy && !nearbyEnemy
    ? isCrateOnPathToTargetServer(room, bot, tile, target)
    : nearbyCrate;

  if (strategicCrate && countServerSafeExits(room, bot, tile.x, tile.y) >= 1) {
    const urgent = isPixelOutsideNextZoneServer(room, bot.x, bot.y);
    if (urgent) return Math.random() < 0.85;
    return Math.random() < 0.34;
  }
  return false;
}

function getServerEnemyTrapScore(room, bot, tile) {
  return getServerBotEnemies(room, bot).reduce((best, enemy) => {
    const enemyTile = gridAtServer(enemy.x, enemy.y);
    const dist = Math.abs(enemyTile.x - tile.x) + Math.abs(enemyTile.y - tile.y);
    if (dist > Math.max(3, bot.range || 2)) return best;
    const enemyExits = [
      { x: enemyTile.x + 1, y: enemyTile.y },
      { x: enemyTile.x - 1, y: enemyTile.y },
      { x: enemyTile.x, y: enemyTile.y + 1 },
      { x: enemyTile.x, y: enemyTile.y - 1 },
    ].filter((n) => !isSolidServer(room, n.x, n.y, enemy) && !wouldBombThreatenTile(room, tile, n.x, n.y, bot.range || 2)).length;
    let score = Math.max(0, 150 - dist * 28);
    if (enemyExits <= 1) score += 110;
    if (enemyTile.x === tile.x || enemyTile.y === tile.y) score += 80;
    return Math.max(best, score);
  }, 0);
}

function getSafetyStepServer(room, bot, here) {
  if (getServerBotThreatScore(room, here.x, here.y) === 0 && !isDangerTileServer(room, here.x, here.y) && (bot.aiStuckFrames || 0) < 2) {
    return null;
  }
  const plan = getServerEscapePlan(room, bot, here);
  return plan ? plan.firstStep : null;
}

function getServerEscapePlan(room, bot, here, projectedBombTile = null, maxDepth = 14) {
  const queue = [{ x: here.x, y: here.y, path: [] }];
  const seen = new Set([`${here.x},${here.y}`]);
  const candidates = [];
  while (queue.length > 0) {
    const current = queue.shift();
    const projectedThreat = getProjectedServerThreatScore(room, bot, current.x, current.y, projectedBombTile);
    if (current.path.length > 0 && projectedThreat === 0 && !isDangerTileServer(room, current.x, current.y)) {
      const safeExits = countServerSafeExits(room, bot, current.x, current.y);
      candidates.push({
        firstStep: current.path[0],
        depth: current.path.length,
        safeExits,
        score: safeExits * 80 - current.path.length * 8
      });
    }
    if (current.path.length >= maxDepth) continue;
    for (const next of getRankedServerEscapeDirs(room, bot, current, projectedBombTile)) {
      const key = `${next.x},${next.y}`;
      if (seen.has(key)) continue;
      if (isSolidServer(room, next.x, next.y, bot)) continue;
      seen.add(key);
      queue.push({
        x: next.x,
        y: next.y,
        path: current.path.concat({ x: next.x - current.x, y: next.y - current.y })
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score)[0] || null;
}

function getRankedServerEscapeDirs(room, bot, current, projectedBombTile) {
  return [
    { x: current.x + 1, y: current.y },
    { x: current.x - 1, y: current.y },
    { x: current.x, y: current.y + 1 },
    { x: current.x, y: current.y - 1 },
  ]
    .map((next) => ({
      ...next,
      threat: getProjectedServerThreatScore(room, bot, next.x, next.y, projectedBombTile),
      exits: countServerSafeExits(room, bot, next.x, next.y)
    }))
    .sort((a, b) => (a.threat - b.threat) || (b.exits - a.exits));
}

function getProjectedServerThreatScore(room, bot, x, y, projectedBombTile = null) {
  let score = getServerBotThreatScore(room, x, y);
  if (projectedBombTile && wouldBombThreatenTile(room, projectedBombTile, x, y, bot.range || 2)) {
    score = Math.max(score, 1700);
  }
  return score;
}

function getServerUnstuckStep(room, bot, here) {
  const best = [
    { x: here.x + 1, y: here.y },
    { x: here.x - 1, y: here.y },
    { x: here.x, y: here.y + 1 },
    { x: here.x, y: here.y - 1 },
  ]
    .map((next) => ({
      x: next.x - here.x,
      y: next.y - here.y,
      score: scoreServerBotMove(room, bot, next.x, next.y)
    }))
    .sort((a, b) => b.score - a.score)[0];
  return best && best.score > -9000 ? { x: best.x, y: best.y } : null;
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
    if (isCrateTile(cell)) return i === distance;
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
  
  const rows = getRows(room.mode);
  const cols = getCols(room.mode);
  const crates = [];
  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < cols - 1; x += 1) {
      const cell = room.map[y]?.[x];
      if (isCrateTile(cell)) {
        crates.push({ x, y, weight: 1 });
      }
    }
  }

  let targets = [...loot, ...enemies, ...crates];
  if (isBattleRoyale(room.mode) && room.brZone) {
    // Filter out targets that are outside the next safe zone
    targets = targets.filter((target) => !isTileOutsideNextZoneServer(room, target.x, target.y));

    // If bot is outside the next safe zone, add the next safe zone center as a top-priority target
    if (isPixelOutsideNextZoneServer(room, bot.x, bot.y)) {
      const targetX = Math.floor(room.brZone.nextX / TILE);
      const targetY = Math.floor(room.brZone.nextY / TILE);
      if (targetX > 0 && targetX < cols - 1 && targetY > 0 && targetY < rows - 1) {
        let tx = targetX;
        let ty = targetY;
        if (isSolidServer(room, tx, ty, bot)) {
          let found = false;
          const searchRadius = 5;
          for (let r = 1; r <= searchRadius && !found; r++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              for (let dy = -r; dy <= r && !found; dy++) {
                if (Math.abs(dx) === r || Math.abs(dy) === r) {
                  const nx = targetX + dx;
                  const ny = targetY + dy;
                  if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && !isSolidServer(room, nx, ny, bot)) {
                    tx = nx;
                    ty = ny;
                    found = true;
                  }
                }
              }
            }
          }
        }
        targets.push({ x: tx, y: ty, weight: 100 });
      }
    }
  }

  let validTargets = targets.filter(target => getServerBotThreatScore(room, target.x, target.y) < 1000);
  
  if (validTargets.length === 0) {
    // Fallback: wander to a random walkable tile inside the safe zone (if BR) or the whole map (if not BR)
    let foundWanderTarget = false;
    let attempts = 0;
    while (!foundWanderTarget && attempts < 30) {
      attempts++;
      const rx = Math.floor(1 + Math.random() * (cols - 2));
      const ry = Math.floor(1 + Math.random() * (rows - 2));
      if (!isSolidServer(room, rx, ry, bot)) {
        if (isBattleRoyale(room.mode) && room.brZone) {
          if (isTileOutsideNextZoneServer(room, rx, ry)) continue;
        }
        validTargets.push({ x: rx, y: ry, weight: 1 });
        foundWanderTarget = true;
      }
    }
  }

  return validTargets
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
  ].some(dir => isCrateTile(room.map[y + dir.y]?.[x + dir.x]));
}

function hasEscapeTile(room, bot, tile) {
  return !!getServerEscapePlan(room, bot, tile, tile, 14);
}

function isDangerTileServer(room, x, y) {
  if (room.map[y]?.[x] === "zone") return true;
  if (room.brZone) {
    const px = x * TILE + TILE / 2;
    const py = y * TILE + TILE / 2;
    const dist = Math.hypot(px - room.brZone.x, py - room.brZone.y);
    if (dist > room.brZone.radius - TILE) return true;
  }
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
    if (isCrateTile(cell)) return i === distance;
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
    if (!cell || cell === "wall" || isCrateTile(cell)) return false;
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
  // Top center: 1 slide skill powerup
  if (y === 1 && x === 7) return "slide";
  // Bottom center: 1 slide skill powerup
  if (y === ROWS - 2 && x === 7) return "slide";
  // Left center: 1 punch powerup
  if (x === 1 && y === 6) return "punch";
  // Right center: 1 punch powerup
  if (x === COLS - 2 && y === 6) return "punch";

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

function generateMap(mapType, mode = "standard") {
  const cols = getCols(mode);
  const rows = getRows(mode);
  const nextMap = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) return "wall";
      
      if (isBattleRoyale(mode)) {
        // Safe centers or clearings for players/supply drops
        // Random sparse checkered blocks (40% probability)
        if (x % 2 === 0 && y % 2 === 0 && Math.random() < 0.40) return "wall";
        // Buildings (clumped walls)
        if ((x % 7 === 0 || y % 7 === 0) && (x + y) % 3 === 0) return "wall";
        // Crate cover - filled with high-density brown crates (80% probability)
        return Math.random() < 0.80 ? "crate" : "grass";
      }
      
      if (mapType === "powerzone") {
        if (x >= 5 && x <= 9 && y >= 5 && y <= 7) return "grass";
        if ((x === 4 || x === 10) && (y >= 4 && y <= 8)) return "crate";
        if ((y === 4 || y === 8) && (x >= 4 && x <= 10)) return "crate";
        if (x === 1 || y === 1 || x === cols - 2 || y === rows - 2) return "grass";
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        return "grass";
      } else if (mapType === "colosseum") {
        if ((x === 3 || x === cols - 4) && (y === 3 || y === rows - 4)) return "wall";
        return Math.random() < 0.5 ? "crate" : "grass";
      } else if (mapType === "checkered") {
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        if ((x === 3 || x === cols - 4) && (y === 3 || y === rows - 4)) return "wall";
        return Math.random() < 0.6 ? "crate" : "grass";
      } else {
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        return Math.random() < 0.66 ? "crate" : "grass";
      }
    })
  );
  
  if (!isBattleRoyale(mode)) {
    getStartsForMap(mapType).forEach((s) => {
      const clearSafe = (x, y) => { if (nextMap[y] && nextMap[y][x] && nextMap[y][x] !== "wall") nextMap[y][x] = "grass"; };
      clearSafe(s.x, s.y);
      clearSafe(s.x + Math.sign(cols / 2 - s.x), s.y);
      clearSafe(s.x, s.y + Math.sign(rows / 2 - s.y));
    });
  }
  
  return nextMap;
}

function isTileSolidForBombServer(room, tx, ty) {
  const cols = room.map[0] ? room.map[0].length : COLS;
  const rows = room.map ? room.map.length : ROWS;
  if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) return true;
  const cellType = room.map[ty][tx];
  if (cellType === "wall" || cellType === "crate" || cellType === "zone" || cellType === "supply_crate" || cellType === "golden_crate") return true;
  const hasBomb = room.bombs.some((b) => b.x === tx && b.y === ty && (!b.vx || (b.vx === 0 && b.vy === 0)));
  if (hasBomb) return true;
  const hasPlayer = room.players.some((p) => p.alive && Math.floor(p.x / TILE) === tx && Math.floor(p.y / TILE) === ty);
  return hasPlayer;
}

// ----------------------------------------------------------------
// BATTLE ROYALE HELPERS
// ----------------------------------------------------------------

function assignBRTeams(room) {
  if (room.mode === "br_solo") {
    room.teams = { A: [], B: [] };
    room.players.forEach((p) => {
      p.teamId = p.id;
    });
    return;
  }
  
  // Group players by squadCode first (preserved parties)
  const squads = {};
  room.players.forEach((p) => {
    const code = p.squadCode || p.id;
    if (!squads[code]) squads[code] = [];
    squads[code].push(p);
  });

  const teamSize = room.mode === "br_duo" ? 2 : 3;
  let teams = [];
  let currentTeam = [];

  Object.values(squads).forEach((squad) => {
    if (squad.length === teamSize) {
      teams.push(squad);
    } else {
      squad.forEach((p) => {
        currentTeam.push(p);
        if (currentTeam.length === teamSize) {
          teams.push(currentTeam);
          currentTeam = [];
        }
      });
    }
  });

  if (currentTeam.length > 0) {
    teams.push(currentTeam);
  }

  // Assign teamIds and record them in room teams
  room.teams = {};
  teams.forEach((team, teamIndex) => {
    const teamId = `team_${teamIndex + 1}`;
    room.teams[teamId] = team.map(p => p.id);
    team.forEach((p) => {
      p.teamId = teamId;
    });
  });
}

function positionBRPlayers(room) {
  const cols = getCols(room.mode);
  const rows = getRows(room.mode);
  
  // Group players by teamId
  const teamGroups = {};
  room.players.forEach((p) => {
    const tId = p.teamId || p.id;
    if (!teamGroups[tId]) teamGroups[tId] = [];
    teamGroups[tId].push(p);
  });

  const spawnedCenters = [];

  Object.values(teamGroups).forEach((team) => {
    let spawnX = 2 + Math.floor(Math.random() * (cols - 4));
    let spawnY = 2 + Math.floor(Math.random() * (rows - 4));
    
    for (let attempt = 0; attempt < 200; attempt++) {
      const tx = 2 + Math.floor(Math.random() * (cols - 4));
      const ty = 2 + Math.floor(Math.random() * (rows - 4));
      
      if (room.map[ty]?.[tx] && room.map[ty][tx] !== "wall") {
        let far = true;
        for (const center of spawnedCenters) {
          const dist = Math.hypot(center.x - tx, center.y - ty);
          if (dist < 8) {
            far = false;
            break;
          }
        }
        if (far) {
          spawnX = tx;
          spawnY = ty;
          break;
        }
      }
    }

    spawnedCenters.push({ x: spawnX, y: spawnY });

    // Clear 2-tile radius of non-walls around the spawn center to grass so players/bots aren't immediately blocked
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cx = spawnX + dx;
        const cy = spawnY + dy;
        if (room.map[cy] && room.map[cy][cx] && room.map[cy][cx] !== "wall") {
          room.map[cy][cx] = "grass";
        }
      }
    }

    const offsets = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}];
    team.forEach((p, index) => {
      const offset = offsets[index % offsets.length];
      let px = spawnX + offset.x;
      let py = spawnY + offset.y;
      if (!room.map[py] || room.map[py][px] === "wall") {
        px = spawnX;
        py = spawnY;
      }
      p.x = px * TILE + TILE / 2;
      p.y = py * TILE + TILE / 2;
      p.dx = 0; p.dy = 0;
      p.alive = true;
    });
  });
}

function getRandomBRLootType() {
  const roll = Math.random();
  if (roll < 0.60) {
    const list = ["bandage", "flame", "bomb", "speed", "shield"];
    return list[Math.floor(Math.random() * list.length)];
  } else if (roll < 0.90) {
    const list = ["punch", "slide", "remote_bomb", "mega_bomb", "energy_drink", "medkit"];
    return list[Math.floor(Math.random() * list.length)];
  } else {
    const list = ["golden_bomb", "teleport_bomb", "nuke_bomb", "full_armor", "revive_kit", "backpack"];
    return list[Math.floor(Math.random() * list.length)];
  }
}

function spawnInitialLoot(room) {
  const cols = getCols(room.mode);
  const rows = getRows(room.mode);
  room.pickups = [];
  
  const grassTiles = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (room.map[y]?.[x] === "grass") {
        grassTiles.push({ x, y });
      }
    }
  }

  const shuffled = shuffleArray(grassTiles);
  // Scale initial loot count dynamically with the map size (approx 12% of total cells)
  const spawnCount = Math.min(shuffled.length, Math.floor(cols * rows * 0.12));
  for (let i = 0; i < spawnCount; i++) {
    const tile = shuffled[i];
    room.pickups.push({
      x: tile.x,
      y: tile.y,
      type: getRandomBRLootType()
    });
  }
}

function startBRPreMatch(room) {
  clearMatchmakingTimers(room);
  room.state = "pre_match";
  assignBRTeams(room);
  
  let countdown = 10;
  broadcastToRoom(room, {
    type: "pre_match_started",
    data: {
      players: room.players,
      teams: room.teams,
      countdown
    }
  });

  room.preMatchInterval = setInterval(() => {
    countdown--;
    broadcastToRoom(room, {
      type: "pre_match_countdown",
      data: { countdown }
    });
    
    if (countdown <= 0) {
      clearInterval(room.preMatchInterval);
      room.preMatchInterval = null;
      startBRGame(room);
    }
  }, 1000);
}

function startBRGame(room) {
  room.roundNumber = 1;
  room.currentMapType = "classic";
  room.map = generateMap("classic", room.mode);
  positionBRPlayers(room);
  
  room.players.forEach((p) => {
    p.alive = true;
    p.knocked = false;
    p.hp = 100;
    p.shield = 0;
    p.bandageCount = 0;
    p.medkitCount = 0;
    p.energyDrinkCount = 0;
    p.reviveKitCount = 0;
    p.kills = 0;
    p.damageDealt = 0;
    p.survivalTime = 0;
    p.activeBombType = "normal";
    p.speed = 142;
    p.bombs = 1;
    p.range = 2;
    p.cooldown = 0;
    p.hasPunch = false;
    p.hasSlide = false;
  });
  
  spawnInitialLoot(room);
  
  const cols = getCols(room.mode);
  const rows = getRows(room.mode);
  let goldenSpawned = 0;
  for (let attempt = 0; attempt < 500 && goldenSpawned < 5; attempt++) {
    const tx = 2 + Math.floor(Math.random() * (cols - 4));
    const ty = 2 + Math.floor(Math.random() * (rows - 4));
    if (room.map[ty]?.[tx] === "grass") {
      room.map[ty][tx] = "golden_crate";
      goldenSpawned++;
    }
  }

  const zoneStartRad = Math.floor(cols * TILE * 0.65);
  room.brZone = {
    x: cols * TILE / 2,
    y: rows * TILE / 2,
    radius: zoneStartRad,
    nextX: cols * TILE / 2,
    nextY: rows * TILE / 2,
    nextRadius: zoneStartRad,
    timeLeft: 60,
    isShrinking: false,
    phase: 0
  };

  room.roundTime = 900;
  room.state = "playing";
  room.supplyDropTimer = 0;
  room.worldEventTimer = 0;
  
  broadcastToRoom(room, {
    type: "game_started",
    data: {
      map: room.map,
      players: room.players,
      pickups: room.pickups,
      mapType: "classic",
      mode: room.mode,
      brZone: room.brZone
    }
  });

  if (room.tickInterval) clearInterval(room.tickInterval);
  room.tickInterval = setInterval(() => tickRoom(room), 50);
}

function updateBRZone(room, dt) {
  if (!room.brZone) return;
  room.brZone.timeLeft -= dt;
  
  if (room.brZone.timeLeft <= 0) {
    if (!room.brZone.isShrinking) {
      room.brZone.isShrinking = true;
      room.brZone.timeLeft = 60;
      room.brZone.startX = room.brZone.x;
      room.brZone.startY = room.brZone.y;
      room.brZone.startRadius = room.brZone.radius;
      
      const phase = room.brZone.phase + 1;
      const cols = getCols(room.mode);
      let nextRad = room.brZone.radius;
      if (phase === 1) nextRad = Math.floor(cols * TILE * 0.35);
      else if (phase === 2) nextRad = Math.floor(cols * TILE * 0.18);
      else if (phase === 3) nextRad = Math.floor(cols * TILE * 0.10);
      else if (phase === 4) nextRad = Math.floor(cols * TILE * 0.05);
      else nextRad = 40;
      
      const maxOffset = room.brZone.radius - nextRad;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * maxOffset;
      room.brZone.nextX = room.brZone.x + Math.cos(angle) * dist;
      room.brZone.nextY = room.brZone.y + Math.sin(angle) * dist;
      room.brZone.nextRadius = nextRad;
      
      broadcastToRoom(room, {
        type: "announcement",
        data: { text: "ZONE SHRINKING! Run to safe circle." }
      });
    } else {
      room.brZone.isShrinking = false;
      room.brZone.phase += 1;
      room.brZone.x = room.brZone.nextX;
      room.brZone.y = room.brZone.nextY;
      room.brZone.radius = room.brZone.nextRadius;
      room.brZone.timeLeft = 60;
      
      broadcastToRoom(room, {
        type: "announcement",
        data: { text: `SAFE ZONE ESTABLISHED. Phase ${room.brZone.phase} completed.` }
      });
    }
  } else if (room.brZone.isShrinking) {
    const t = 1 - (room.brZone.timeLeft / 60);
    room.brZone.x = room.brZone.startX + (room.brZone.nextX - room.brZone.startX) * t;
    room.brZone.y = room.brZone.startY + (room.brZone.nextY - room.brZone.startY) * t;
    room.brZone.radius = room.brZone.startRadius + (room.brZone.nextRadius - room.brZone.startRadius) * t;
  }
}

function damagePlayer(room, player, amount, sourceId) {
  if (!player.alive || player.knocked) return;
  
  if (player.healingState) {
    player.healingState = null;
    broadcastToRoom(room, { type: "healing_cancelled", data: { playerId: player.id } });
  }
  
  let damageLeft = amount;
  if (player.shield > 0) {
    if (player.shield >= damageLeft) {
      player.shield -= damageLeft;
      damageLeft = 0;
    } else {
      damageLeft -= player.shield;
      player.shield = 0;
    }
  }
  
  if (damageLeft > 0) {
    player.hp = Math.max(0, player.hp - damageLeft);
  }
  
  if (sourceId && sourceId !== "storm" && sourceId !== "bleedout") {
    const sourcePlayer = room.players.find(p => p.id === sourceId);
    if (sourcePlayer) {
      sourcePlayer.damageDealt = (sourcePlayer.damageDealt || 0) + amount;
    }
  }

  broadcastToRoom(room, {
    type: "player_damaged",
    data: {
      playerId: player.id,
      hp: player.hp,
      shield: player.shield
    }
  });

  if (player.hp <= 0) {
    if (room.mode !== "br_solo") {
      const teammates = room.players.filter(p => p.id !== player.id && p.teamId === player.teamId && p.alive && !p.knocked);
      if (teammates.length > 0) {
        player.knocked = true;
        player.hp = 100; // Knocked crawling/bleedout HP
        player.speed = 40;
        broadcastToRoom(room, {
          type: "player_knocked",
          data: { playerId: player.id }
        });
        broadcastToRoom(room, {
          type: "announcement",
          data: { text: `${player.name} is knocked down!` }
        });
        return;
      }
    }
    eliminatePlayer(room, player, sourceId);
  }
}

function eliminatePlayer(room, player, sourceId) {
  player.alive = false;
  player.knocked = false;
  player.hp = 0;
  player.shield = 0;
  
  if (isBattleRoyale(room.mode)) {
    const aliveTeams = new Set(room.players.filter(p => p.alive).map(p => p.teamId || p.id));
    player.placement = aliveTeams.size + 1;
  }
  
  const tx = Math.floor(player.x / TILE);
  const ty = Math.floor(player.y / TILE);
  const dropItem = (type) => {
    let dropX = tx;
    let dropY = ty;
    if (room.map[dropY]?.[dropX] !== "grass") {
      const neighbors = [{x: 0, y: 0}, {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
      for (const n of neighbors) {
        if (room.map[ty + n.y]?.[tx + n.x] === "grass") {
          dropX = tx + n.x;
          dropY = ty + n.y;
          break;
        }
      }
    }
    room.pickups.push({ x: dropX, y: dropY, type });
  };

  for (let i = 0; i < (player.bandageCount || 0); i++) dropItem("bandage");
  for (let i = 0; i < (player.medkitCount || 0); i++) dropItem("medkit");
  for (let i = 0; i < (player.energyDrinkCount || 0); i++) dropItem("energy_drink");
  
  if (player.hasPunch) dropItem("punch");
  if (player.hasSlide) dropItem("slide");
  if (player.activeBombType && player.activeBombType !== "normal") {
    dropItem(player.activeBombType);
  } else {
    dropItem("bomb");
  }

  if (sourceId && sourceId !== "storm" && sourceId !== "bleedout" && sourceId !== player.id) {
    const killer = room.players.find(p => p.id === sourceId);
    if (killer) {
      killer.kills = (killer.kills || 0) + 1;
    }
  }

  broadcastToRoom(room, {
    type: "player_eliminated",
    data: {
      playerId: player.id,
      killerId: sourceId,
      pickups: room.pickups
    }
  });

  checkBRGameEnd(room);
}

function checkBRGameEnd(room) {
  if (room.state !== "playing") return;
  
  const alivePlayers = room.players.filter(p => p.alive && !p.knocked);
  const activeTeamIds = new Set(alivePlayers.map(p => p.teamId || p.id));
  
  if (activeTeamIds.size <= 1) {
    const winningTeamId = activeTeamIds.values().next().value;
    let winningTeamPlayers = [];
    if (winningTeamId) {
      winningTeamPlayers = room.players.filter(p => (p.teamId === winningTeamId || p.id === winningTeamId));
    }
    const winnerName = winningTeamPlayers.length > 0
      ? winningTeamPlayers.map(p => p.name).join(" & ")
      : "No one";

    room.state = "lobby";
    if (room.tickInterval) { clearInterval(room.tickInterval); room.tickInterval = null; }
    
    room.players.forEach(p => {
      if (p.alive) p.placement = 1;
      p.ready = p.ai; p.alive = true; p.knocked = false;
    });
    
    broadcastToRoom(room, {
      type: "br_game_over",
      data: {
        message: `${winnerName} wins the Battle Royale! 🏆`,
        players: room.players,
        winnerTeamId: winningTeamId
      }
    });
    
    broadcastLobbyUpdate(room);
  }
}

function checkBRRevives(room, dt) {
  room.players.forEach((player) => {
    if (player.alive && player.knocked) {
      const adjacentTeammate = room.players.find(p =>
        p.id !== player.id &&
        p.teamId === player.teamId &&
        p.alive &&
        !p.knocked &&
        Math.hypot(p.x - player.x, p.y - player.y) < TILE * 1.5
      );
      
      if (adjacentTeammate) {
        player.reviveProgress = (player.reviveProgress || 0) + dt;
        broadcastToRoom(room, {
          type: "revive_progress",
          data: { playerId: player.id, progress: player.reviveProgress / 5.0 }
        });
        
        if (player.reviveProgress >= 5.0) {
          player.knocked = false;
          player.hp = 30;
          player.speed = 142;
          player.reviveProgress = 0;
          broadcastToRoom(room, {
            type: "player_revived",
            data: { playerId: player.id }
          });
          broadcastToRoom(room, {
            type: "announcement",
            data: { text: `${player.name} was revived by ${adjacentTeammate.name}!` }
          });
        }
      } else {
        if (player.reviveProgress > 0) {
          player.reviveProgress = 0;
          broadcastToRoom(room, {
            type: "revive_progress",
            data: { playerId: player.id, progress: 0 }
          });
        }
      }
    }
  });
}

function updateBRSupplyDrops(room, dt) {
  if (room.activeSupplyDrop) {
    room.activeSupplyDrop.timer -= dt;
    if (room.activeSupplyDrop.timer <= 0) {
      const x = room.activeSupplyDrop.x;
      const y = room.activeSupplyDrop.y;
      if (room.map[y] && (room.map[y][x] === "grass" || room.map[y][x] === "crate")) {
        room.map[y][x] = "supply_crate";
      }
      broadcastToRoom(room, {
        type: "supply_drop_landed",
        data: { x, y, map: room.map }
      });
      room.activeSupplyDrop = null;
    }
  } else {
    room.supplyDropTimer = (room.supplyDropTimer || 0) + dt;
    if (room.supplyDropTimer >= 90.0) {
      room.supplyDropTimer = 0;
      
      const cols = getCols(room.mode);
      const rows = getRows(room.mode);
      let dropX = 3 + Math.floor(Math.random() * (cols - 6));
      let dropY = 3 + Math.floor(Math.random() * (rows - 6));
      
      for (let attempt = 0; attempt < 200; attempt++) {
        const tx = 3 + Math.floor(Math.random() * (cols - 6));
        const ty = 3 + Math.floor(Math.random() * (rows - 6));
        if (room.map[ty]?.[tx] === "grass" || room.map[ty]?.[tx] === "crate") {
          const px = tx * TILE + TILE / 2;
          const py = ty * TILE + TILE / 2;
          const dist = Math.hypot(px - room.brZone.x, py - room.brZone.y);
          if (dist < room.brZone.radius) {
            dropX = tx;
            dropY = ty;
            break;
          }
        }
      }
      
      room.activeSupplyDrop = { x: dropX, y: dropY, timer: 8.0 };
      broadcastToRoom(room, {
        type: "supply_drop_incoming",
        data: { x: dropX, y: dropY, timer: 8.0 }
      });
    }
  }
}

function updateBRWorldEvents(room, dt) {
  room.worldEventTimer = (room.worldEventTimer || 0) + dt;
  
  if (room.currentWorldEvent) {
    room.currentWorldEvent.duration -= dt;
    
    if (room.currentWorldEvent.type === "bomb_rain") {
      room.bombRainTimer = (room.bombRainTimer || 0) + dt;
      if (room.bombRainTimer >= 1.5) {
        room.bombRainTimer = 0;
        const targetPlayer = room.players.filter(p => p.alive)[Math.floor(Math.random() * room.players.filter(p => p.alive).length)];
        if (targetPlayer) {
          const tx = Math.floor(targetPlayer.x / TILE) + (Math.floor(Math.random() * 3) - 1);
          const ty = Math.floor(targetPlayer.y / TILE) + (Math.floor(Math.random() * 3) - 1);
          if (room.map[ty]?.[tx] === "grass") {
            const bomb = {
              id: "rain_" + Math.random().toString(36).substr(2, 9),
              x: tx, y: ty,
              ownerId: "sky",
              range: 2,
              timer: 1.5,
              bombType: "normal"
            };
            room.bombs.push(bomb);
            broadcastToRoom(room, { type: "bomb_placed", data: { bomb } });
          }
        }
      }
    } else if (room.currentWorldEvent.type === "meteor_shower") {
      room.meteorTimer = (room.meteorTimer || 0) + dt;
      if (room.meteorTimer >= 1.0) {
        room.meteorTimer = 0;
        const cols = getCols(room.mode);
        const rows = getRows(room.mode);
        const tx = 2 + Math.floor(Math.random() * (cols - 4));
        const ty = 2 + Math.floor(Math.random() * (rows - 4));
        if (room.map[ty]?.[tx] === "grass") {
          const bomb = {
            id: "meteor_" + Math.random().toString(36).substr(2, 9),
            x: tx, y: ty,
            ownerId: "meteor",
            range: 3,
            timer: 0.1,
            bombType: "normal"
          };
          room.bombs.push(bomb);
        }
      }
    }
    
    if (room.currentWorldEvent.duration <= 0) {
      const endedType = room.currentWorldEvent.type;
      room.currentWorldEvent = null;
      broadcastToRoom(room, {
        type: "announcement",
        data: { text: `WORLD EVENT: ${endedType.toUpperCase().replace("_", " ")} ENDED.` }
      });
    }
  } else if (room.worldEventTimer >= 120.0) {
    room.worldEventTimer = 0;
    const events = ["bomb_rain", "meteor_shower", "power_surge", "double_loot"];
    const chosenEvent = events[Math.floor(Math.random() * events.length)];
    room.currentWorldEvent = { type: chosenEvent, duration: 20.0 };
    room.bombRainTimer = 0;
    room.meteorTimer = 0;
    
    broadcastToRoom(room, {
      type: "world_event_started",
      data: { event: chosenEvent }
    });
  }
}

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
