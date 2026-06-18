const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// CONFIGURATION: Set this to your Supabase project credentials
const SUPABASE_URL = "https://ccwcifnddnwotrnutanp.supabase.co"; // Pre-populated with your project ID
const SUPABASE_ANON_KEY = ""; // PASTE YOUR PUBLIC ANON KEY HERE

// Initialize Supabase Client (wrapped in try/catch to prevent script block if credentials/library fail)
let supabaseClient = null;
try {
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err) {
  console.error("Supabase client initialization failed:", err);
}

// Screen DOM elements
const loginScreen = document.getElementById("loginScreen");
const introScreen = document.getElementById("introScreen");
const menuScreen = document.getElementById("menuScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const gameScreen = document.getElementById("gameScreen");

// Auth and Intro Elements
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMessage = document.getElementById("authMessage");
const btnLogin = document.getElementById("btnLogin");
const btnSignup = document.getElementById("btnSignup");

const usernameForm = document.getElementById("usernameForm");
const introUsernameInput = document.getElementById("introUsernameInput");
const usernameMessage = document.getElementById("usernameMessage");
const btnConfirmUsername = document.getElementById("btnConfirmUsername");
const introSpeechBubble = document.getElementById("introSpeechBubble");

// Studio Splash and Title Screen Elements
const studioSplashScreen = document.getElementById("studioSplashScreen");
const titleScreen = document.getElementById("titleScreen");
const titlePlayBtn = document.getElementById("titlePlayBtn");
const titleLoadingSection = document.getElementById("titleLoadingSection");
const titlePlayBtnContainer = document.getElementById("titlePlayBtnContainer");
const titleLoadingStatus = document.getElementById("titleLoadingStatus");
const titleProgressBarFill = document.getElementById("titleProgressBarFill");

// Lobby Menu Tab elements
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Matchmaking Dialog Elements
const lobbyPlayBtn = document.getElementById("lobbyPlayBtn");
const matchmakingDialog = document.getElementById("matchmakingDialog");
const closeDialogBtn = document.getElementById("closeDialogBtn");

// New Offline Matchmaking/VS Screen Elements
const matchmakingPopup = document.getElementById("matchmakingPopup");
const matchmakingTimer = document.getElementById("matchmakingTimer");
const cancelMatchmakingBtn = document.getElementById("cancelMatchmakingBtn");
const lobbyMatchBtn = document.getElementById("lobbyMatchBtn");

const vsLoadingScreen = document.getElementById("vsLoadingScreen");
const vsLoadingStatus = document.getElementById("vsLoadingStatus");
const vsProgressBarFill = document.getElementById("vsProgressBarFill");

// Menu Matchmaking inputs
const usernameInput = document.getElementById("usernameInput");
const joinCodeInput = document.getElementById("joinCodeInput");
const quickMatchBtn = document.getElementById("quickMatchBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");

// Lobby room screen elements
const lobbyRoomCode = document.getElementById("lobbyRoomCode");
const lobbyPlayersList = document.getElementById("lobbyPlayersList");
const addBotBtn = document.getElementById("addBotBtn");
const startGameBtn = document.getElementById("startGameBtn");
const readyBtn = document.getElementById("readyBtn");
const leaveLobbyBtn = document.getElementById("leaveLobbyBtn");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const lobbyChatForm = document.getElementById("lobbyChatForm");

// Game HUD elements
const timerEl = document.getElementById("roundTimer");
const stateEl = document.getElementById("roundState");
const gameRoomCode = document.getElementById("gameRoomCode");
const hudPlayersList = document.getElementById("hudPlayersList");
const leaveGameBtn = document.getElementById("leaveGameBtn");

// Emotes buttons
const emoteSmileBtn = document.getElementById("emoteSmileBtn");
const emoteCryBtn = document.getElementById("emoteCryBtn");
const emoteAngryBtn = document.getElementById("emoteAngryBtn");
const emoteShockBtn = document.getElementById("emoteShockBtn");
const emoteYayBtn = document.getElementById("emoteYayBtn");

// PWA Install Button
const installBtn = document.getElementById("installBtn");

// Spotlight canvas in lobby
const spotlightCanvas = document.getElementById("spotlightCanvas");
const spotlightCtx = spotlightCanvas ? spotlightCanvas.getContext("2d") : null;
const spotlightVideo = document.getElementById("spotlightVideo");
const characterSelectVideo = document.getElementById("characterSelectVideo");
const characterSelectCanvas = document.getElementById("characterSelectCanvas");
const characterSelectCtx = characterSelectCanvas ? characterSelectCanvas.getContext("2d") : null;
const characterSelectName = document.getElementById("characterSelectName");
const characterSelectState = document.getElementById("characterSelectState");
const confirmCharacterBtn = document.getElementById("confirmCharacterBtn");
const selectCardGrid = document.getElementById("selectCardGrid");
const wardrobeTabs = document.querySelectorAll(".wardrobe-tab");

// Settings Indicators
const connectionStatusIndicator = document.getElementById("connectionStatusIndicator");
const playerUuidLabel = document.getElementById("playerUuidLabel");

// Game settings
const TILE = 48;
const COLS = 15;
const ROWS = 13;
const OFFSET_X = (canvas.width - COLS * TILE) / 2;
const OFFSET_Y = 72;
const SUDDEN_DEATH_TIME = 60;
const ZONE_STEP_SECONDS = 4;
const MAX_ZONE_LAYER = 4;

const starts = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: ROWS - 2 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
];

// Character styles
const characterStyle = {
  hachiware: { body: "#ffffff", accent: "#80b2c9", blush: "#ffb5c6", label: "Hachiware" },
  usagi: { body: "#fff1bc", accent: "#ff9d57", blush: "#ffaac1", label: "Usagi" },
  chiikawa: { body: "#ffffff", accent: "#ff8ab1", blush: "#ffb6c9", label: "Chiikawa" },
  momonga: { body: "#f6fbff", accent: "#b9def2", blush: "#ffb3c5", label: "Momonga" },
  shisa: { body: "#fff2ce", accent: "#ffac79", blush: "#ffafc2", label: "Shisa" },
};

// Load Hachiware Images
const hachiwareImages = {
  idle: new Image(),
  walk_front1: new Image(),
  walk_front2: new Image(),
  walk_back1: new Image(),
  walk_back2: new Image()
};
hachiwareImages.idle.src = "assets/hachiware/hachiware_idle.png";
hachiwareImages.walk_front1.src = "assets/hachiware/hachiware_walk_front1.png";
hachiwareImages.walk_front2.src = "assets/hachiware/hachiware_walk_front2.png";
hachiwareImages.walk_back1.src = "assets/hachiware/hachiware_walk_back1.png";
hachiwareImages.walk_back2.src = "assets/hachiware/hachiware_walk_back2.png";

// Load Usagi Images
const usagiImages = {
  idle: new Image(),
  walk_front1: new Image(),
  walk_front2: new Image(),
  walk_back1: new Image(),
  walk_back2: new Image()
};
usagiImages.idle.src = "assets/usagi/usagi_idle.png";
usagiImages.walk_front1.src = "assets/usagi/usagi_walk_front1.png";
usagiImages.walk_front2.src = "assets/usagi/usagi_walk_front2.png";
usagiImages.walk_back1.src = "assets/usagi/usagi_walk_back1.png";
usagiImages.walk_back2.src = "assets/usagi/usagi_walk_back2.png";

// Load Chiikawa Images
const chiikawaImages = {
  idle: new Image(),
  walk_front1: new Image(),
  walk_front2: new Image(),
  walk_back1: new Image(),
  walk_back2: new Image()
};
chiikawaImages.idle.src = "assets/chiikawa/chiikawa_idle.png";
chiikawaImages.walk_front1.src = "assets/chiikawa/chiikawa_walk_front1.png";
chiikawaImages.walk_front2.src = "assets/chiikawa/chiikawa_walk_front2.png";
chiikawaImages.walk_back1.src = "assets/chiikawa/chiikawa_walk_back1.png";
chiikawaImages.walk_back2.src = "assets/chiikawa/chiikawa_walk_back2.png";

// Load Momonga Images
const momongaImages = {
  idle: new Image(),
  walk_front1: new Image(),
  walk_front2: new Image(),
  walk_back1: new Image(),
  walk_back2: new Image()
};
momongaImages.idle.src = "assets/momonga/momonga_idle.png";
momongaImages.walk_front1.src = "assets/momonga/momonga_walk_front1.png";
momongaImages.walk_front2.src = "assets/momonga/momonga_walk_front2.png";
momongaImages.walk_back1.src = "assets/momonga/momonga_walk_back1.png";
momongaImages.walk_back2.src = "assets/momonga/momonga_walk_back2.png";


// Emote symbols
const emoteSymbols = {
  smile: "😊",
  cry: "😭",
  angry: "😡",
  shock: "😮",
  yay: "🎉",
};

// Progression State
let crownCount = 0;
let gemsCount = 2830;
let seasonLevel = 4;
let seasonXp = 609;
let seasonXpToNext = 800;

// Client Network State
let socket = null;
let roomCode = null;
let hostId = null;
let localPlayerId = null;
let players = [];
let selectedCharacter = "chiikawa";
let previewCharacter = selectedCharacter;
let readyState = false;
let localMode = false;
let localBombId = 0;

// Tournament Overlay & Confetti Variables
let roundCountdownInterval = null;
let confettiActive = false;
let confettiParticles = [];
const confettiCanvas = document.getElementById("victoryConfettiCanvas");
const confettiCtx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
const yellowConsoleEl = document.querySelector(".yellow-console");

// Custom Map & Voting States
let currentMapType = "classic";
let myLastVote = null;

// Game World State
let map = [];
let bombs = [];
let blasts = [];
let pickups = [];
let particles = [];
let roundTime = 150;
let running = false;
let gameMessage = "";
let last = performance.now();
let shakeTimer = 0;
let zoneActive = false;
let zoneLayer = 0;
let zoneStepTimer = 0;
let localMatchRewarded = false;

// Setup Keyboard inputs
const keys = new Set();

// ----------------------------------------------------------------
// TAB SWITCHING LOGIC
// ----------------------------------------------------------------

tabButtons.forEach((btn) => {
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    const tabName = btn.getAttribute("data-tab");
    
    // Switch active classes on buttons
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    
    // Switch active classes on tab contents
    tabContents.forEach((content) => content.classList.remove("active"));
    const targetContent = document.getElementById(`tabContent_${tabName}`);
    if (targetContent) {
      targetContent.classList.add("active");
    }
    
    // Toggle squad lobby styling on console
    const consoleEl = document.querySelector(".yellow-console");
    if (consoleEl) {
      if (tabName === "squad") {
        consoleEl.classList.add("squad-lobby-active");
      } else {
        consoleEl.classList.remove("squad-lobby-active");
      }
      consoleEl.classList.toggle("character-select-active", tabName === "look");
    }
    cancelMatchmaking();
  });
});

// Back button handler inside the squad lobby to switch back to play tab
const lobbyBackBtn = document.getElementById("lobbyBackBtn");
if (lobbyBackBtn) {
  lobbyBackBtn.addEventListener("click", () => {
    const playTabBtn = document.querySelector('.tab-btn[data-tab="play"]');
    if (playTabBtn) {
      playTabBtn.click();
    }
  });
}

document.querySelector(".select-back-btn")?.addEventListener("click", () => {
  document.querySelector('.tab-btn[data-tab="play"]')?.click();
});

// Matchmaking dialog visibility triggers
lobbyPlayBtn.addEventListener("click", () => {
  const squadTabBtn = document.querySelector('.tab-btn[data-tab="squad"]');
  if (squadTabBtn) {
    squadTabBtn.click();
  }
});

closeDialogBtn?.addEventListener("click", () => {
  matchmakingDialog.classList.add("hidden");
});

matchmakingDialog?.addEventListener("click", (e) => {
  if (e.target === matchmakingDialog) {
    matchmakingDialog.classList.add("hidden");
  }
});

if (spotlightVideo) {
  spotlightVideo.muted = true;
  spotlightVideo.loop = true;
  spotlightVideo.playsInline = true;
  spotlightVideo.addEventListener("loadeddata", () => {
    spotlightVideo.play().catch(() => {});
  });
  spotlightVideo.play().catch(() => {});
}

const characterSelectVideos = {
  chiikawa: "assets/chiikawa/chiikawa_character_animation.mp4",
  hachiware: "hachiware-lobby.mp4",
  usagi: "assets/usagi/usagi_character_animation.mp4",
  momonga: "assets/momonga/momonga_character_animation.mp4",
};

function playMutedLoop(video) {
  if (!video) return;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.play().catch(() => {});
}

document.querySelectorAll(".character-card video").forEach((video) => {
  video.addEventListener("loadeddata", () => playMutedLoop(video), { once: true });
  playMutedLoop(video);
});

function syncCharacterSelectPreview(kind) {
  if (!characterSelectVideo || !characterSelectVideos[kind]) return;
  if (!characterSelectVideo.src.endsWith(characterSelectVideos[kind])) {
    characterSelectVideo.src = characterSelectVideos[kind];
    characterSelectVideo.load();
  }
  playMutedLoop(characterSelectVideo);
  if (characterSelectName) {
    characterSelectName.textContent = characterStyle[kind]?.label || kind;
  }
  if (characterSelectState) {
    characterSelectState.textContent = kind === selectedCharacter ? "Selected" : "Ready to select";
  }

  // Dynamic premium background theme changes for Look / Wardrobe tab
  const selectScreenEl = document.querySelector(".character-select-screen");
  if (selectScreenEl) {
    let swirlColor = "#242528";
    let darkColor = "#131417";
    let glowColor = "rgba(255, 255, 255, 0.1)";
    
    if (kind === "chiikawa") {
      swirlColor = "#3d1424"; // Rich deep pink-purple
      darkColor = "#1f0710";  // Very dark plum
      glowColor = "rgba(255, 138, 177, 0.32)";
    } else if (kind === "hachiware") {
      swirlColor = "#10233b"; // Rich deep blue-navy
      darkColor = "#060f1c";  // Very dark navy
      glowColor = "rgba(128, 178, 201, 0.35)";
    } else if (kind === "usagi") {
      swirlColor = "#3d270f"; // Rich bronze brown
      darkColor = "#1c0f04";  // Very dark brown
      glowColor = "rgba(255, 157, 87, 0.35)";
    } else if (kind === "momonga") {
      swirlColor = "#172733"; // Rich slate gray-blue
      darkColor = "#0a131a";  // Very dark charcoal
      glowColor = "rgba(185, 222, 242, 0.32)";
    }
    
    selectScreenEl.style.setProperty("--char-swirl", swirlColor);
    selectScreenEl.style.setProperty("--char-dark", darkColor);
    selectScreenEl.style.setProperty("--char-glow", glowColor);
  }
}

function syncLobbySpotlightVideo(kind) {
  if (!spotlightVideo || !characterSelectVideos[kind]) return;
  if (!spotlightVideo.src.endsWith(characterSelectVideos[kind])) {
    spotlightVideo.src = characterSelectVideos[kind];
    spotlightVideo.load();
  }
  playMutedLoop(spotlightVideo);
}

function confirmCharacterSelection() {
  selectedCharacter = previewCharacter;
  syncCharacterSelectPreview(selectedCharacter);
  syncLobbySpotlightVideo(selectedCharacter);
  syncSquadLobbyInterface();
}

playMutedLoop(characterSelectVideo);
syncCharacterSelectPreview(selectedCharacter);
syncLobbySpotlightVideo(selectedCharacter);
syncSquadLobbyInterface();

// Setup wardrobe character selection click handlers
const characterCards = document.querySelectorAll(".character-card");
characterCards.forEach((card) => {
  card.addEventListener("click", () => {
    characterCards.forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    previewCharacter = card.getAttribute("data-kind");
    syncCharacterSelectPreview(previewCharacter);
  });
});

confirmCharacterBtn?.addEventListener("click", confirmCharacterSelection);

wardrobeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.getAttribute("data-wardrobe-mode") || "characters";
    wardrobeTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    if (selectCardGrid) {
      selectCardGrid.dataset.mode = mode;
    }
  });
});

// PWA Installation handling
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the install prompt");
      }
      deferredPrompt = null;
      installBtn.classList.add("hidden");
    });
  }
});

// ----------------------------------------------------------------
// NETWORK SOCKET HANDLING (WITH SAFE FILE:// FALLBACKS)
// ----------------------------------------------------------------

// CONFIGURATION: Set this to your deployed Render WebSocket URL (e.g., "wss://chiikawa-royale.onrender.com")
// if you choose to host the frontend separately on Vercel. Leave it as null if hosting together on Render.
const BACKEND_WS_URL = null;

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = BACKEND_WS_URL || `${protocol}//${window.location.host}`;

  console.log("Connecting to WebSocket server:", wsUrl);
  if (connectionStatusIndicator) {
    connectionStatusIndicator.textContent = "Connecting...";
    connectionStatusIndicator.className = "connection-status connecting";
  }

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connected successfully.");
      if (connectionStatusIndicator) {
        connectionStatusIndicator.textContent = "Online";
        connectionStatusIndicator.className = "connection-status online";
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error("Error handling server message:", err);
      }
    };

    socket.onclose = (event) => {
      console.log("WebSocket disconnected.");
      if (connectionStatusIndicator) {
        connectionStatusIndicator.textContent = "Offline";
        connectionStatusIndicator.className = "connection-status offline";
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  } catch (e) {
    console.error("Failed to establish WebSocket connection:", e);
    if (connectionStatusIndicator) {
      connectionStatusIndicator.textContent = "Offline";
      connectionStatusIndicator.className = "connection-status offline";
    }
  }
}


function sendServerMessage(type, data = {}) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, data }));
  }
}

function handleServerMessage(msg) {
  const { type, data } = msg;

  switch (type) {
    case "error":
      alert(data.message);
      break;

    case "room_joined":
      roomCode = data.roomCode;
      localPlayerId = data.playerId;
      localMode = false;
      
      // Close matchmaking dialog
      matchmakingDialog.classList.add("hidden");
      
      // Transition screen
      switchScreen(lobbyScreen);
      
      lobbyRoomCode.textContent = roomCode;
      gameRoomCode.textContent = roomCode;
      chatMessages.innerHTML = ""; // Clear chat
      addChatMessage("System", `Joined Room ${roomCode}!`, true);
      
      readyState = false;
      readyBtn.textContent = "Ready Up!";
      readyBtn.classList.remove("btn-primary");
      readyBtn.classList.add("btn-accent");

      if (playerUuidLabel) {
        playerUuidLabel.textContent = localPlayerId;
      }
      break;

    case "lobby_updated":
      hostId = data.hostId;
      players = data.players;
      updateLobbyUI();
      break;

    case "game_started":
      map = data.map;
      currentMapType = data.mapType || "classic";
      players = data.players.map((p) => ({
        ...p,
        targetX: p.x,
        targetY: p.y,
        invuln: 1.4,
        emote: null,
        emoteTimer: 0,
        radius: 13,
      }));

      bombs = [];
      blasts = [];
      pickups = [];
      particles = [];
      running = true;
      shakeTimer = 0;
      gameMessage = "";

      // Hide results overlay and pause victory video
      document.getElementById("tournamentOverlay").classList.add("hidden");
      stopConfetti();
      const startVideo = document.getElementById("victoryVideo");
      if (startVideo) {
        startVideo.pause();
      }
      if (roundCountdownInterval) {
        clearInterval(roundCountdownInterval);
        roundCountdownInterval = null;
      }

      stateEl.textContent = "Battle!";
      switchScreen(gameScreen);
      updateHudSidebar();
      break;

    case "state_update":
      roundTime = data.roundTime;
      data.players.forEach((serverPlayer) => {
        const localP = players.find((p) => p.id === serverPlayer.id);
        if (localP) {
          localP.alive = serverPlayer.alive;
          localP.speed = serverPlayer.speed;
          localP.bombs = serverPlayer.bombs;
          localP.range = serverPlayer.range;

          if (serverPlayer.id !== localPlayerId) {
            localP.targetX = serverPlayer.x;
            localP.targetY = serverPlayer.y;
            localP.dx = serverPlayer.dx;
            localP.dy = serverPlayer.dy;
          } else {
            // Check desync
            const dist = Math.hypot(localP.x - serverPlayer.x, localP.y - serverPlayer.y);
            if (dist > 36) {
              localP.x = serverPlayer.x;
              localP.y = serverPlayer.y;
            }
          }
        }
      });
      updateHudSidebar();
      break;

    case "bomb_placed":
      bombs.push({
        id: data.bomb.id,
        x: data.bomb.x,
        y: data.bomb.y,
        ownerId: data.bomb.ownerId,
        range: data.bomb.range,
        timer: data.bomb.timer,
        pulse: 0,
        passableFor: new Set(players.map((p) => p.id)),
      });
      break;

    case "bomb_exploded":
      bombs = bombs.filter((b) => b.id !== data.bombId);
      blasts.push({
        cells: data.cells,
        timer: 0.48,
        age: 0,
      });

      data.destroyedCrates.forEach((crate) => {
        if (map[crate.y]) map[crate.y][crate.x] = "grass";
        burstCrate(crate.x, crate.y);
      });

      data.spawnedPickups.forEach((pickup) => {
        pickups.push(pickup);
      });

      data.deadPlayers.forEach((pid) => {
        const p = players.find((p) => p.id === pid);
        if (p) p.alive = false;
      });

      shakeTimer = 0.35;
      updateHudSidebar();
      break;

    case "pickup_collected":
      const [pickupX, pickupY] = data.pickupId.split("_").map(Number);
      pickups = pickups.filter((p) => p.x !== pickupX || p.y !== pickupY);

      const collector = players.find((p) => p.id === data.playerId);
      if (collector) {
        collector.range = data.playerStats.range;
        collector.bombs = data.playerStats.bombs;
        collector.speed = data.playerStats.speed;
        burstSparkles(collector.x, collector.y);
      }
      updateHudSidebar();
      break;

    case "emote_triggered":
      const emoter = players.find((p) => p.id === data.playerId);
      if (emoter) {
        emoter.emote = data.emote;
        emoter.emoteTimer = 2.0;
      }
      break;

    case "chat_received":
      const isSystem = !data.playerId;
      const isMe = data.playerId === localPlayerId;
      addChatMessage(data.senderName, data.text, isSystem, isMe);
      break;

    case "game_over": {
      running = false;
      gameMessage = data.message;
      stateEl.textContent = data.message;
      keys.clear();

      // Give progression rewards
      const isWinner = data.winnerId === localPlayerId;
      if (isWinner) {
        if (data.tournamentFinished) {
          crownCount += 2;
          gemsCount += 300;
          addChatMessage("System", "TOURNAMENT VICTORY! You earned 300 gems and 2 crowns! 👑🏆", true);
        } else {
          crownCount += 1;
          gemsCount += 100;
          addChatMessage("System", "ROUND VICTORY! You earned 100 gems and 1 crown! 👑", true);
        }
      } else {
        if (data.tournamentFinished) {
          gemsCount += 50;
          addChatMessage("System", "Tournament Finished. You earned 50 gems! 💎", true);
        } else {
          gemsCount += 20;
          addChatMessage("System", "Round Finished. You earned 20 gems! 💎", true);
        }
      }

      // Update UI counters & save progression
      document.getElementById("crownCount").textContent = crownCount;
      document.getElementById("gemsCount").textContent = gemsCount;
      saveProgression();

      // Show tournament overlay
      showTournamentResults(data.players, data.winnerId, data.tournamentFinished);
      break;
    }

    case "bomb_punched": {
      const punchedBomb = bombs.find((b) => b.id === data.bombId);
      if (punchedBomb) {
        punchedBomb.vx = data.vx;
        punchedBomb.vy = data.vy;
        punchedBomb.slideX = punchedBomb.x;
        punchedBomb.slideY = punchedBomb.y;
      }
      break;
    }

    case "map_votes_updated": {
      const votes = data.votes || {};
      const classicEl = document.getElementById("voteCount_classic");
      const checkeredEl = document.getElementById("voteCount_checkered");
      const colosseumEl = document.getElementById("voteCount_colosseum");
      if (classicEl) classicEl.textContent = `${votes.classic || 0} votes`;
      if (checkeredEl) checkeredEl.textContent = `${votes.checkered || 0} votes`;
      if (colosseumEl) colosseumEl.textContent = `${votes.colosseum || 0} votes`;
      break;
    }
  }
}

// ----------------------------------------------------------------
// UI RENDERING & COMPONENT REFRESHES
// ----------------------------------------------------------------

function switchScreen(targetScreen) {
  [loginScreen, introScreen, titleScreen, menuScreen, lobbyScreen, gameScreen].forEach((s) => {
    if (s) s.classList.remove("active");
  });
  if (targetScreen) targetScreen.classList.add("active");
}

function startLocalGame() {
  localMode = true;
  roomCode = "LOCAL";
  localPlayerId = "local_player";
  hostId = localPlayerId;
  localBombId = 0;
  
  const mapSelect = document.getElementById("localMapSelect");
  currentMapType = mapSelect ? mapSelect.value : "classic";
  map = buildLocalMap(currentMapType);

  players = [
    makeLocalPlayer("local_player", "You", selectedCharacter, starts[0], false),
    makeLocalPlayer("cpu_usagi", "Usagi CPU", "usagi", starts[1], true),
    makeLocalPlayer("cpu_momonga", "Momonga CPU", "momonga", starts[2], true),
    makeLocalPlayer("cpu_chiikawa", "Chiikawa CPU", "chiikawa", starts[3], true),
  ];
  players.forEach((p) => {
    p.trophies = 0;
    p.hasPunch = false;
  });
  bombs = [];
  blasts = [];
  pickups = [];
  particles = [];
  roundTime = 150;
  running = true;
  shakeTimer = 0;
  zoneActive = false;
  zoneLayer = 0;
  zoneStepTimer = 0;
  localMatchRewarded = false;
  gameMessage = "";
  timerEl.textContent = formatTime(roundTime);
  stateEl.textContent = "Battle!";
  gameRoomCode.textContent = roomCode;
  updateHudSidebar();
  switchScreen(gameScreen);
}

function makeLocalPlayer(id, name, kind, spawn, ai) {
  const x = spawn.x * TILE + TILE / 2;
  const y = spawn.y * TILE + TILE / 2;
  return {
    id,
    name,
    kind,
    ready: true,
    ai,
    x,
    y,
    targetX: x,
    targetY: y,
    dx: 0,
    dy: 0,
    alive: true,
    speed: 142,
    bombs: 1,
    range: 2,
    cooldown: 0,
    invuln: 1.2,
    emote: null,
    emoteTimer: 0,
    radius: 13,
    trophies: 0,
    hasPunch: false,
    aiThink: 0,
    aiDir: { x: 0, y: 0 },
    moveTarget: null,
    moveFrom: null,
    moveDir: null,
  };
}

function buildLocalMap(mapType = "classic") {
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

  starts.forEach((s) => {
    const clearSafe = (x, y) => {
      if (nextMap[y] && nextMap[y][x] && nextMap[y][x] !== "wall") nextMap[y][x] = "grass";
    };
    clearSafe(s.x, s.y);
    clearSafe(s.x + Math.sign(COLS / 2 - s.x), s.y);
    clearSafe(s.x, s.y + Math.sign(ROWS / 2 - s.y));
  });

  return nextMap;
}

function updateLobbyUI() {
  lobbyPlayersList.innerHTML = "";
  const isHost = localPlayerId === hostId;

  if (isHost) {
    addBotBtn.classList.remove("hidden");
    startGameBtn.classList.remove("hidden");
  } else {
    addBotBtn.classList.add("hidden");
    startGameBtn.classList.add("hidden");
  }

  players.forEach((p) => {
    const card = document.createElement("div");
    card.className = `lobby-player-card ${p.ready ? "ready" : ""} ${p.ai ? "bot" : ""} ${p.id === hostId ? "host" : ""}`;

    const style = characterStyle[p.kind];
    const avatarCanvasId = `lobby_avatar_${p.id}`;

    card.innerHTML = `
      <div class="avatar-box">
        <canvas id="${avatarCanvasId}" width="60" height="60"></canvas>
      </div>
      <div class="player-info">
        <div class="name-tag">${escapeHTML(p.name)}</div>
        <div class="status-tag">${p.ready ? "READY" : "WAITING..."}</div>
      </div>
      ${p.id === hostId ? '<span class="host-tag">HOST</span>' : ""}
      ${isHost && p.ai ? `<button class="btn-remove-bot" data-bot-id="${p.id}">Remove</button>` : ""}
    `;

    lobbyPlayersList.appendChild(card);

    const avatarCanvas = document.getElementById(avatarCanvasId);
    if (avatarCanvas) {
      const actx = avatarCanvas.getContext("2d");
      actx.translate(avatarCanvas.width / 2, avatarCanvas.height / 2 + 6);
      drawCharacterOnContext(actx, p.kind, style, 0);
    }

    if (isHost && p.ai) {
      card.querySelector(".btn-remove-bot").addEventListener("click", () => {
        sendServerMessage("remove_bot", { botId: p.id });
      });
    }
  });
}

function updateHudSidebar() {
  hudPlayersList.innerHTML = "";

  players.forEach((p) => {
    const card = document.createElement("div");
    card.className = `hud-player-card ${p.alive ? "" : "dead"}`;
    card.setAttribute("data-kind", p.kind);

    const style = characterStyle[p.kind];
    const canvasId = `hud_avatar_${p.id}`;

    card.innerHTML = `
      <div class="hud-avatar-box">
        <canvas id="${canvasId}" width="40" height="40"></canvas>
      </div>
      <div class="hud-wins-count">${p.trophies || 0}</div>
    `;

    hudPlayersList.appendChild(card);

    const hudCanvas = document.getElementById(canvasId);
    if (hudCanvas) {
      const hctx = hudCanvas.getContext("2d");
      hctx.translate(hudCanvas.width / 2, hudCanvas.height / 2 + 4);
      hctx.scale(0.8, 0.8);
      drawCharacterOnContext(hctx, p.kind, style, performance.now() / 1200);
    }
  });
}

function localPlaceBomb(player) {
  if (!localMode || !player || !player.alive || player.cooldown > 0) return;
  const tile = gridAt(player.x, player.y);
  const activeBombsCount = bombs.filter((b) => b.ownerId === player.id).length;
  const tileHasBomb = bombs.some((b) => b.x === tile.x && b.y === tile.y);
  if (activeBombsCount >= player.bombs || tileHasBomb) return;

  bombs.push({
    id: `local_bomb_${++localBombId}`,
    x: tile.x,
    y: tile.y,
    ownerId: player.id,
    range: player.range,
    timer: 2.25,
    pulse: 0,
    passableFor: new Set([player.id]),
  });
  player.cooldown = 0.25;
}

function localTriggerExplosion(bomb) {
  bombs = bombs.filter((b) => b.id !== bomb.id);
  const cells = [{ x: bomb.x, y: bomb.y, center: true }];
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  dirs.forEach((dir) => {
    for (let i = 1; i <= bomb.range; i += 1) {
      const x = bomb.x + dir.x * i;
      const y = bomb.y + dir.y * i;
      if (!map[y] || !map[y][x] || map[y][x] === "wall") break;
      cells.push({ x, y, dir });
      if (map[y][x] === "crate") {
        map[y][x] = "grass";
        burstCrate(x, y);
        const roll = Math.random();
        if (roll < 0.18) pickups.push({ x, y, type: "flame" });
        else if (roll < 0.32) pickups.push({ x, y, type: "bomb" });
        else if (roll < 0.44) pickups.push({ x, y, type: "speed" });
        else if (roll < 0.50) pickups.push({ x, y, type: "full_fire" });
        else if (roll < 0.56) pickups.push({ x, y, type: "punch" });
        break;
      }
    }
  });

  blasts.push({ cells, timer: 0.48, age: 0 });
  shakeTimer = 0.35;
  cells.forEach((cell) => {
    players.forEach((p) => {
      if (!p.alive || p.invuln > 0) return;
      const tile = gridAt(p.x, p.y);
      if (tile.x === cell.x && tile.y === cell.y) {
        p.alive = false;
        p.moveTarget = null;
        p.moveFrom = null;
        p.moveDir = null;
      }
    });
  });

  bombs.forEach((other) => {
    if (cells.some((cell) => cell.x === other.x && cell.y === other.y)) other.timer = Math.min(other.timer, 0.04);
  });
  updateHudSidebar();
  localCheckGameEnd();
}

function localCheckPickup(player) {
  const tile = gridAt(player.x, player.y);
  const index = pickups.findIndex((p) => p.x === tile.x && p.y === tile.y);
  if (index === -1) return;
  const [pickup] = pickups.splice(index, 1);
  if (pickup.type === "flame") player.range = Math.min(5, player.range + 1);
  else if (pickup.type === "bomb") player.bombs = Math.min(4, player.bombs + 1);
  else if (pickup.type === "speed") player.speed = Math.min(202, player.speed + 18);
  else if (pickup.type === "full_fire") player.range = 15;
  else if (pickup.type === "punch") player.hasPunch = true;
  burstSparkles(player.x, player.y);
  updateHudSidebar();
}

function localCheckGameEnd() {
  if (!localMode || !running) return;
  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length > 1) return;
  
  running = false;
  const winner = alivePlayers[0] || null;
  const winnerId = winner ? winner.id : null;
  
  gameMessage = winner ? `${winner.name} wins this round!` : "Draw!";
  stateEl.textContent = gameMessage;
  
  awardLocalMatchProgress(winnerId === localPlayerId);
  
  if (winner) {
    winner.trophies = (winner.trophies || 0) + 1;
  }
  
  const grandWinner = players.find((p) => (p.trophies || 0) >= 8);
  const tournamentFinished = !!grandWinner;
  
  if (tournamentFinished && grandWinner) {
    stateEl.textContent = `${grandWinner.name} wins the Match! 🏆`;
  }
  
  showTournamentResults(players, winnerId, tournamentFinished);
}

function awardLocalMatchProgress(playerWon) {
  if (localMatchRewarded) return;
  localMatchRewarded = true;

  const gainedXp = playerWon ? 120 : 45;
  const gainedGems = playerWon ? 85 : 25;
  seasonXp += gainedXp;
  gemsCount += gainedGems;
  if (playerWon) crownCount += 1;

  while (seasonXp >= seasonXpToNext) {
    seasonXp -= seasonXpToNext;
    seasonLevel += 1;
    seasonXpToNext += 100;
    gemsCount += 50;
  }

  saveProgression();
  updateProgressionUI();
}

function updateProgressionUI() {
  document.getElementById("crownCount").textContent = crownCount;
  document.getElementById("gemsCount").textContent = gemsCount;
  document.getElementById("seasonLevel").textContent = seasonLevel;
  document.getElementById("seasonProgressText").textContent = `${seasonXp}/${seasonXpToNext}`;
  document.getElementById("seasonProgressFill").style.width = `${Math.min(100, (seasonXp / seasonXpToNext) * 100)}%`;
}

async function loadProgression() {
  // If Supabase is not active, fallback to localStorage
  if (!supabaseClient) {
    try {
      const saved = JSON.parse(localStorage.getItem("chiikawaProgress") || "{}");
      crownCount = Number.isFinite(saved.crownCount) ? saved.crownCount : crownCount;
      gemsCount = Number.isFinite(saved.gemsCount) ? saved.gemsCount : gemsCount;
      seasonLevel = Number.isFinite(saved.seasonLevel) ? saved.seasonLevel : seasonLevel;
      seasonXp = Number.isFinite(saved.seasonXp) ? saved.seasonXp : seasonXp;
      seasonXpToNext = Number.isFinite(saved.seasonXpToNext) ? saved.seasonXpToNext : seasonXpToNext;
    } catch {
      saveProgression();
    }
    return;
  }

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('crown_count, gems_count, season_level, season_xp')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    if (data) {
      crownCount = data.crown_count ?? 0;
      gemsCount = data.gems_count ?? 100;
      seasonLevel = data.season_level ?? 1;
      seasonXp = data.season_xp ?? 0;
      updateProgressionUI();
    }
  } catch (err) {
    console.error("Error loading progression from Supabase:", err);
  }
}

async function saveProgression() {
  // If Supabase is not active, fallback to localStorage
  if (!supabaseClient) {
    localStorage.setItem(
      "chiikawaProgress",
      JSON.stringify({ crownCount, gemsCount, seasonLevel, seasonXp, seasonXpToNext })
    );
    return;
  }

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { error } = await supabaseClient
      .from('profiles')
      .update({
        crown_count: crownCount,
        gems_count: gemsCount,
        season_level: seasonLevel,
        season_xp: seasonXp,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) throw error;
  } catch (err) {
    console.error("Error saving progression to Supabase:", err);
  }
}

function updateSuddenDeathZone(dt) {
  if (!localMode || !running) return;
  if (roundTime > SUDDEN_DEATH_TIME || zoneLayer >= MAX_ZONE_LAYER) return;

  if (!zoneActive) {
    zoneActive = true;
    zoneStepTimer = 0;
    stateEl.textContent = "Danger Zone!";
  }

  zoneStepTimer -= dt;
  if (zoneStepTimer > 0) return;

  zoneLayer += 1;
  applyZoneLayer(zoneLayer);
  stateEl.textContent = `Danger Zone ${zoneLayer}/${MAX_ZONE_LAYER}`;
  zoneStepTimer = ZONE_STEP_SECONDS;
}

function applyZoneLayer(layer) {
  const left = layer;
  const right = COLS - 1 - layer;
  const top = layer;
  const bottom = ROWS - 1 - layer;

  for (let x = left; x <= right; x += 1) {
    setZoneTile(x, top);
    setZoneTile(x, bottom);
  }

  for (let y = top; y <= bottom; y += 1) {
    setZoneTile(left, y);
    setZoneTile(right, y);
  }

  pickups = pickups.filter((pickup) => map[pickup.y]?.[pickup.x] !== "zone");
  bombs = bombs.filter((bomb) => map[bomb.y]?.[bomb.x] !== "zone");
  players.forEach((player) => {
    if (!player.alive) return;
    const tile = gridAt(player.x, player.y);
    const targetTile = player.moveTarget ? gridAt(player.moveTarget.x, player.moveTarget.y) : null;
    const caughtCurrent = map[tile.y]?.[tile.x] === "zone";
    const caughtTarget = targetTile && map[targetTile.y]?.[targetTile.x] === "zone";
    if (caughtCurrent || caughtTarget) {
      player.alive = false;
      player.moveTarget = null;
      player.moveFrom = null;
      player.moveDir = null;
    }
  });

  shakeTimer = 0.25;
  localCheckGameEnd();
}

function setZoneTile(x, y) {
  if (!map[y] || !map[y][x]) return;
  if (map[y][x] === "wall") return;
  map[y][x] = "zone";
  burstSparkles(x * TILE + TILE / 2, y * TILE + TILE / 2);
}

function addChatMessage(sender, text, isSystem = false, isMe = false) {
  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg ${isSystem ? "system" : ""} ${isMe ? "me" : ""}`;

  if (isSystem) {
    msgEl.textContent = text;
  } else {
    msgEl.innerHTML = `<span class="sender">${escapeHTML(sender)}:</span><span class="text">${escapeHTML(text)}</span>`;
  }

  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag)
  );
}

// ----------------------------------------------------------------
// CLIENT GAME PHYSICS & COLLISION SIMULATION
// ----------------------------------------------------------------

function gridAt(px, py) {
  return {
    x: Math.floor(px / TILE),
    y: Math.floor(py / TILE),
  };
}

function centerOf(tileX, tileY) {
  return {
    x: tileX * TILE + TILE / 2,
    y: tileY * TILE + TILE / 2,
  };
}

function isMapSolid(tileX, tileY) {
  if (!map[tileY] || !map[tileY][tileX]) return true;
  return map[tileY][tileX] === "wall" || map[tileY][tileX] === "crate" || map[tileY][tileX] === "zone";
}

function isSolid(tileX, tileY, actor = null) {
  if (isMapSolid(tileX, tileY)) return true;
  return bombs.some((bomb) => {
    if (canPassBomb(actor, bomb)) return false;
    return bomb.x === tileX && bomb.y === tileY;
  });
}

function canPassBomb(actor, bomb) {
  return actor && bomb.passableFor && bomb.passableFor.has(actor.id);
}

function overlapsBomb(actor, bomb) {
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

function isTileSolidForBombLocal(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
  const cellType = map[ty]?.[tx];
  if (cellType === "wall" || cellType === "crate" || cellType === "zone") return true;
  const hasBomb = bombs.some((b) => b.x === tx && b.y === ty && (!b.vx || (b.vx === 0 && b.vy === 0)));
  if (hasBomb) return true;
  const hasPlayer = players.some((p) => p.alive && Math.floor(p.x / TILE) === tx && Math.floor(p.y / TILE) === ty);
  if (hasPlayer) return true;
  return false;
}

function triggerLocalPunch(player) {
  if (!player || !player.hasPunch || !player.alive) return;
  const dir = player.lastFacingDir || { x: 0, y: 1 };
  const faceX = Math.sign(dir.x);
  const faceY = Math.sign(dir.y);
  if (faceX === 0 && faceY === 0) return;
  if (faceX !== 0 && faceY !== 0) return; // Must be cardinal
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  const targetX = px + faceX;
  const targetY = py + faceY;
  const bomb = bombs.find((b) => b.x === targetX && b.y === targetY && (!b.vx || (b.vx === 0 && b.vy === 0)));
  if (bomb) {
    bomb.vx = faceX;
    bomb.vy = faceY;
    bomb.slideX = bomb.x;
    bomb.slideY = bomb.y;
  }
}

function isBlockedByBomb(px, py, radius, actor) {
  return bombs.some((bomb) => {
    if (canPassBomb(actor, bomb)) return false;

    const tileLeft = bomb.x * TILE;
    const tileTop = bomb.y * TILE;
    const overlapsNext =
      px + radius > tileLeft &&
      px - radius < tileLeft + TILE &&
      py + radius > tileTop &&
      py - radius < tileTop + TILE;

    if (overlapsNext && overlapsBomb(actor, bomb)) {
      const bombCenter = centerOf(bomb.x, bomb.y);
      const currentDistance = Math.hypot(actor.x - bombCenter.x, actor.y - bombCenter.y);
      const nextDistance = Math.hypot(px - bombCenter.x, py - bombCenter.y);
      return nextDistance < currentDistance - 0.2;
    }

    return overlapsNext;
  });
}

function canMoveTo(px, py, actor) {
  const radius = actor.radius || 13;
  const points = [
    [px - radius, py - radius],
    [px + radius, py - radius],
    [px - radius, py + radius],
    [px + radius, py + radius],
  ];
  const mapClear = points.every(([x, y]) => {
    const g = gridAt(x, y);
    return !isMapSolid(g.x, g.y);
  });
  return mapClear && !isBlockedByBomb(px, py, radius, actor);
}

function moveActor(actor, dx, dy, dt) {
  if (actor.moveTarget) {
    return stepTowardTarget(actor, dt);
  }

  const current = gridAt(actor.x, actor.y);
  actor.x = current.x * TILE + TILE / 2;
  actor.y = current.y * TILE + TILE / 2;

  if (dx === 0 && dy === 0) {
    actor.dx = 0;
    actor.dy = 0;
    return false;
  }

  const dir = Math.abs(dx) > 0 ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  const targetTile = { x: current.x + dir.x, y: current.y + dir.y };
  const target = centerOf(targetTile.x, targetTile.y);
  if (!canMoveTo(target.x, target.y, actor)) {
    actor.dx = 0;
    actor.dy = 0;
    return false;
  }

  actor.dx = dir.x;
  actor.dy = dir.y;
  actor.moveFrom = centerOf(current.x, current.y);
  actor.moveDir = dir;
  actor.moveTarget = target;
  return stepTowardTarget(actor, dt);
}

function stepTowardTarget(actor, dt) {
  const target = actor.moveTarget;
  const from = actor.moveFrom || { x: actor.x, y: actor.y };
  const dir = actor.moveDir || { x: Math.sign(target.x - actor.x), y: Math.sign(target.y - actor.y) };
  const distance = Math.abs(target.x - actor.x) + Math.abs(target.y - actor.y);
  const step = actor.speed * dt;

  if (distance <= step) {
    actor.x = target.x;
    actor.y = target.y;
    actor.moveTarget = null;
    actor.moveFrom = null;
    actor.moveDir = null;
    actor.dx = 0;
    actor.dy = 0;
    return true;
  }

  if (dir.x !== 0) {
    actor.x += dir.x * step;
    actor.y = from.y;
  } else {
    actor.x = from.x;
    actor.y += dir.y * step;
  }
  return true;
}


// ----------------------------------------------------------------
// HOST CPU BOT PROCESS
// ----------------------------------------------------------------

function updateAi(bot, dt) {
  bot.aiThink = (bot.aiThink || 0) - dt;
  const here = gridAt(bot.x, bot.y);
  const danger = isDanger(here.x, here.y);

  if (danger || bot.aiThink <= 0) {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
    ];
    const useful = dirs
      .map((d) => ({ ...d, score: scoreAiMove(bot, here.x + d.x, here.y + d.y) }))
      .sort((a, b) => b.score - a.score);
    bot.aiDir = useful[0];
    bot.aiThink = 0.24 + Math.random() * 0.35;
  }

  moveActor(bot, bot.aiDir.x, bot.aiDir.y, dt);

  if (localMode) {
    localCheckPickup(bot);
  } else {
    sendServerMessage("move", {
      id: bot.id,
      x: bot.x,
      y: bot.y,
      dx: bot.aiDir.x,
      dy: bot.aiDir.y,
    });
  }

  const tile = gridAt(bot.x, bot.y);
  const nearbyCrate = neighbors(tile.x, tile.y).some((n) => map[n.y]?.[n.x] === "crate");
  const nearbyEnemy = players.some((other) => other !== bot && other.alive && distanceTiles(tile, gridAt(other.x, other.y)) <= 2);
  
  if ((nearbyCrate || nearbyEnemy) && Math.random() < 0.012) {
    if (localMode) localPlaceBomb(bot);
    else sendServerMessage("place_bomb", { id: bot.id });
  }
}

function scoreAiMove(bot, x, y) {
  if (isSolid(x, y, bot)) return -999;
  let score = Math.random();
  if (isDanger(x, y)) score -= 8;
  if (pickups.some((p) => p.x === x && p.y === y)) score += 3;
  if (neighbors(x, y).some((n) => map[n.y]?.[n.x] === "crate")) score += 0.8;
  
  const target = players.find((other) => other !== bot && other.alive);
  if (target) {
    score -= distanceTiles({ x, y }, gridAt(target.x, target.y)) * 0.08;
  }
  return score;
}

function neighbors(x, y) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

function distanceTiles(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isDanger(x, y) {
  if (blasts.some((blast) => blast.cells.some((cell) => cell.x === x && cell.y === y))) return true;
  return bombs.some((bomb) => {
    if (bomb.x === x && bomb.y === y) return true;
    if (bomb.x !== x && bomb.y !== y) return false;
    const distance = Math.abs(bomb.x - x) + Math.abs(bomb.y - y);
    if (distance > bomb.range) return false;
    const stepX = Math.sign(x - bomb.x);
    const stepY = Math.sign(y - bomb.y);
    for (let i = 1; i <= distance; i += 1) {
      const tile = map[bomb.y + stepY * i]?.[bomb.x + stepX * i];
      if (tile === "wall" || tile === "crate") return false;
    }
    return bomb.timer < 1.2;
  });
}

// ----------------------------------------------------------------
// CLIENT PARTICLE GENERATORS
// ----------------------------------------------------------------

function burstCrate(x, y) {
  const c = centerOf(x, y);
  for (let i = 0; i < 10; i += 1) {
    particles.push({
      x: c.x,
      y: c.y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      life: 0.45 + Math.random() * 0.25,
      color: ["#f9b26b", "#8cd79c", "#ffd86f"][i % 3],
      size: 4 + Math.random() * 3,
    });
  }
}

function burstSparkles(px, py) {
  for (let i = 0; i < 12; i += 1) {
    particles.push({
      x: px,
      y: py,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.5) * 120,
      life: 0.35 + Math.random() * 0.2,
      color: "#fffaec",
      size: 3 + Math.random() * 3,
    });
  }
}

// ----------------------------------------------------------------
// CHARACTER RENDER CODE
// ----------------------------------------------------------------

function drawCharacterOnContext(actx, kind, style, t, isWalking = false, dx = 0, dy = 1, tilesWalked = 0, walkDistance = 0) {
  if (kind === "hachiware" || kind === "usagi" || kind === "chiikawa" || kind === "momonga") {
    actx.save();
    
    const spriteSet = kind === "momonga" ? momongaImages : (kind === "chiikawa" ? chiikawaImages : (kind === "usagi" ? usagiImages : hachiwareImages));
    
    // Determine the image to draw and orientation
    let img = spriteSet.idle;
    let rotation = 0;
    
    // Check if we are drawing on the main game board canvas vs a UI canvas
    const isGameboard = (actx === ctx);
    const isBackPose = (dy < 0);
    
    let size;
    if (isGameboard) {
      size = 80;
    } else {
      const canvasWidth = (actx.canvas && actx.canvas.width) ? actx.canvas.width : 70;
      size = canvasWidth * 0.92;
    }
    
    if (isWalking) {
      // Walking animation
      let frame1, frame2;
      if (isBackPose) {
        // Walking UP (back) - keep at good size
        frame1 = spriteSet.walk_back1;
        frame2 = spriteSet.walk_back2;
      } else {
        // Walking DOWN or SIDEWARDS (front) - make bigger
        frame1 = spriteSet.walk_front1;
        frame2 = spriteSet.walk_front2;
        if (dx < 0) {
          rotation = Math.PI / 2;
        } else if (dx > 0) {
          rotation = -Math.PI / 2;
        }
      }
      
      img = (tilesWalked % 2 === 0) ? frame1 : frame2;
      
      // Jiggly walking bounce rig (synchronized with walk distance for smooth footstep timing)
      const walkAngle = walkDistance * (Math.PI / 48); // One full tile is Math.PI (half cycle)
      const bobFactor = Math.abs(Math.sin(walkAngle)); // 0 at tile boundaries, 1 at mid-tile
      const bounceScaleY = 0.99 + 0.02 * bobFactor; // squashes slightly on ground, stretches in air
      const bounceScaleX = 1.005 - 0.01 * bobFactor;
      const bobY = -bobFactor * 1.8; // gentle bob up to 1.8px
      const wiggleAngle = 0; // remove tilting sway to eliminate any stiff wiggles
      
      if (rotation !== 0) {
        actx.rotate(rotation);
      }
      actx.translate(0, bobY);
      actx.rotate(wiggleAngle);
      actx.scale(bounceScaleX, bounceScaleY);
      
    } else {
      // Idle animation - always return to the normal/front-facing pose
      img = spriteSet.idle;
      
      // Idle breathing jiggle
      const bobY = Math.sin(t * 6) * 0.8;
      const scaleX = 1 + Math.sin(t * 6) * 0.03;
      const scaleY = 1 - Math.sin(t * 6) * 0.03;
      const wiggleAngle = Math.cos(t * 3) * 0.02;
      
      if (rotation !== 0) {
        actx.rotate(rotation);
      }
      actx.translate(0, bobY);
      actx.rotate(wiggleAngle);
      actx.scale(scaleX, scaleY);
    }
    
    // Draw the Hachiware image (centered at 0,0 with calculated size)
    const half = size / 2;
    if (img && img.complete && img.naturalWidth > 0) {
      actx.drawImage(img, -half, -half, size, size);
    } else {
      // Fallback
      actx.fillStyle = style.accent;
      actx.beginPath();
      actx.arc(0, 0, 18, 0, Math.PI * 2);
      actx.fill();
    }
    
    actx.restore();
    return;
  }

  const animTime = isWalking ? t : 0;
  const bob = Math.sin(animTime * 8) * 1.4;
  actx.save();
  actx.translate(0, bob);
  actx.lineWidth = 4;
  actx.strokeStyle = "#18161a";
  actx.fillStyle = style.body;
  
  // Base Body
  actx.beginPath();
  actx.ellipse(0, 1, 18, 22, 0, 0, Math.PI * 2);
  actx.fill();
  actx.stroke();

  if (kind === "usagi") {
    earOnContext(actx, -8, -22, -0.12, style.body, "#ffc2d4");
    earOnContext(actx, 7, -23, 0.1, style.body, "#ffc2d4");
  } else if (kind === "momonga") {
    roundEarOnContext(actx, -13, -17, style.body);
    roundEarOnContext(actx, 13, -17, style.body);
    tailOnContext(actx, 17, 4, style.accent, 15);
  } else if (kind === "shisa") {
    maneOnContext(actx, -20, -6, style.accent);
    maneOnContext(actx, 20, -6, style.accent);
    pointEarOnContext(actx, -11, -17, style.body);
    pointEarOnContext(actx, 11, -17, style.body);
  } else {
    roundEarOnContext(actx, -10, -18, style.body);
    roundEarOnContext(actx, 10, -18, style.body);
  }

  armOnContext(actx, -17, 3);
  armOnContext(actx, 17, 3);
  footOnContext(actx, -8, 20);
  footOnContext(actx, 8, 20);
  faceOnContext(actx, style.blush, kind);
  actx.restore();
}

function faceOnContext(actx, blush, kind) {
  actx.fillStyle = "#111";
  eyeOnContext(actx, -7, -5);
  eyeOnContext(actx, 7, -5);
  actx.fillStyle = blush;
  actx.beginPath();
  actx.ellipse(-14, 4, 5, 4, 0, 0, Math.PI * 2);
  actx.ellipse(14, 4, 5, 4, 0, 0, Math.PI * 2);
  actx.fill();
  actx.strokeStyle = "#111";
  actx.lineWidth = 2;
  actx.beginPath();
  actx.moveTo(-4, 4);
  actx.quadraticCurveTo(0, 9, 4, 4);
  if (kind === "usagi" || kind === "hachiware") {
    actx.moveTo(0, 3);
    actx.lineTo(0, 10);
  }
  actx.stroke();
}

function eyeOnContext(actx, x, y) {
  actx.beginPath();
  actx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2);
  actx.fill();
  actx.fillStyle = "#fff";
  actx.beginPath();
  actx.arc(x + 1, y - 2, 1.4, 0, Math.PI * 2);
  actx.fill();
  actx.fillStyle = "#111";
}

function earOnContext(actx, x, y, rot, outer, inner) {
  actx.save();
  actx.translate(x, y);
  actx.rotate(rot);
  actx.fillStyle = outer;
  actx.beginPath();
  actx.ellipse(0, 0, 6, 18, 0, 0, Math.PI * 2);
  actx.fill();
  actx.stroke();
  actx.fillStyle = inner;
  actx.beginPath();
  actx.ellipse(0, 1, 2.4, 12, 0, 0, Math.PI * 2);
  actx.fill();
  actx.restore();
}

function roundEarOnContext(actx, x, y, color) {
  actx.fillStyle = color;
  actx.beginPath();
  actx.arc(x, y, 6, 0, Math.PI * 2);
  actx.fill();
  actx.stroke();
}

function pointEarOnContext(actx, x, y, color) {
  actx.fillStyle = color;
  actx.beginPath();
  actx.moveTo(x - 6, y + 4);
  actx.lineTo(x, y - 8);
  actx.lineTo(x + 7, y + 3);
  actx.closePath();
  actx.fill();
  actx.stroke();
}

function maneOnContext(actx, x, y, color) {
  actx.fillStyle = color;
  actx.beginPath();
  actx.arc(x, y - 8, 6, 0, Math.PI * 2);
  actx.arc(x, y + 4, 6, 0, Math.PI * 2);
  actx.arc(x, y + 16, 5, 0, Math.PI * 2);
  actx.fill();
  actx.stroke();
}

function armOnContext(actx, x, y) {
  actx.strokeStyle = "#18161a";
  actx.lineWidth = 4;
  actx.beginPath();
  actx.moveTo(x, y);
  actx.quadraticCurveTo(x + Math.sign(x) * 8, y + 8, x + Math.sign(x) * 3, y + 13);
  actx.stroke();
}

function footOnContext(actx, x, y) {
  actx.strokeStyle = "#18161a";
  actx.lineWidth = 4;
  actx.beginPath();
  actx.moveTo(x, y - 2);
  actx.lineTo(x + Math.sign(x) * 2, y + 6);
  actx.stroke();
}

function tailOnContext(actx, x, y, color, size = 8) {
  actx.fillStyle = color;
  actx.beginPath();
  actx.ellipse(x, y, size, 5, -0.5, 0, Math.PI * 2);
  actx.fill();
  actx.stroke();
}

// ----------------------------------------------------------------
// CANVAS DRAWING (GAME BOARD)
// ----------------------------------------------------------------

function drawBackground() {
  ctx.fillStyle = "#fdf1b9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = "rgba(255, 127, 174, 0.45)";
  for (let i = 0; i < 34; i += 1) {
    const x = (i * 137) % canvas.width;
    const y = 22 + ((i * 79) % (canvas.height - 44));
    ctx.fillRect(x, y, 8, 8);
  }
  
  ctx.strokeStyle = "#221f25";
  ctx.lineWidth = 3;
  drawBunting(28, 38, 250);
  drawBunting(690, 42, 250);
}

function drawBunting(x, y, w) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w / 2, y + 42, x + w, y);
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const px = x + 20 + i * 28;
    const py = y + 5 + Math.sin(i / 7 * Math.PI) * 28;
    ctx.fillStyle = ["#ff9fc3", "#a9ead0", "#a7d7ff", "#fff27c"][i % 4];
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 18, py + 5);
    ctx.lineTo(px + 7, py + 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawMap() {
  ctx.fillStyle = currentMapType === "checkered" ? "#80e1fe" : currentMapType === "colosseum" ? "#df9376" : "#9fe39e";
  roundedRect(0, 0, COLS * TILE, ROWS * TILE, 12, true, false);
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (map[y] && map[y][x]) {
        drawTile(x, y, map[y][x]);
      }
    }
  }
}

function drawTile(x, y, type) {
  const px = x * TILE;
  const py = y * TILE;
  
  // 1. FLOOR TILES SKINNED TEXTURE
  if (currentMapType === "checkered") {
    // Ice Floor
    const isLight = (x + y) % 2 === 0;
    ctx.fillStyle = isLight ? "#b0ecff" : "#8adcf8";
    ctx.fillRect(px, py, TILE, TILE);
    
    // Draw ice sheen highlights
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 8);
    ctx.lineTo(px + 12, py + 4);
    ctx.stroke();
    
    // Subtle ice crack detail in darker tiles
    if (!isLight && (x * y) % 7 === 0) {
      ctx.strokeStyle = "rgba(12, 100, 160, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 8, py + 12);
      ctx.lineTo(px + 18, py + 22);
      ctx.lineTo(px + 28, py + 20);
      ctx.stroke();
    }
  } else if (currentMapType === "colosseum") {
    // Clay / Terracotta Floor
    const isLight = (x + y) % 2 === 0;
    ctx.fillStyle = isLight ? "#e8a88e" : "#d4927a";
    ctx.fillRect(px, py, TILE, TILE);
    
    // Draw terracotta tile lines
    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, TILE, TILE);
    
    // Faint sand pebbles/grains
    if ((x + y) % 3 === 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(px + 10, py + 15, 2, 2);
      ctx.fillRect(px + 32, py + 25, 2, 2);
    }
  } else {
    // Classic Grass / Garden Floor
    const isLight = (x + y) % 2 === 0;
    ctx.fillStyle = isLight ? "#a8e8a4" : "#93dc99";
    ctx.fillRect(px, py, TILE, TILE);
    
    // Draw grass blades details
    if ((x + y) % 3 === 0) {
      ctx.strokeStyle = isLight ? "#88c984" : "#79be7f";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // Blade 1
      ctx.moveTo(px + 14, py + 18);
      ctx.lineTo(px + 12, py + 10);
      // Blade 2
      ctx.moveTo(px + 16, py + 18);
      ctx.lineTo(px + 20, py + 8);
      ctx.stroke();
    }
    // Tiny flowers in light grass
    if (isLight && (x * y) % 13 === 4) {
      // White petals
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px + 30, py + 30, 2.5, 0, Math.PI * 2);
      ctx.arc(px + 33, py + 33, 2.5, 0, Math.PI * 2);
      ctx.arc(px + 27, py + 33, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Yellow center
      ctx.fillStyle = "#ffdc5a";
      ctx.beginPath();
      ctx.arc(px + 30, py + 32, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // 2. WALLS
  if (type === "wall") {
    ctx.save();
    // Skinned Wall 3D Block
    if (currentMapType === "checkered") {
      // Golden Treasure Wall Block
      ctx.fillStyle = "#d1a31d"; // Dark Gold border
      roundedRect(px + 3, py + 3, TILE - 6, TILE - 6, 8, true, true);
      
      ctx.fillStyle = "#ffd84a"; // Bright Gold center
      roundedRect(px + 6, py + 6, TILE - 12, TILE - 12, 6, true, true);
      
      // Specular shine highlight
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(px + 9, py + 8, TILE - 18, 5);
      
      // Star emblem in center
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(px + TILE/2, py + 14);
      ctx.lineTo(px + TILE/2 + 3, py + TILE/2 - 3);
      ctx.lineTo(px + TILE - 14, py + TILE/2);
      ctx.lineTo(px + TILE/2 + 3, py + TILE/2 + 3);
      ctx.lineTo(px + TILE/2, py + TILE - 14);
      ctx.lineTo(px + TILE/2 - 3, py + TILE/2 + 3);
      ctx.lineTo(px + 14, py + TILE/2);
      ctx.lineTo(px + TILE/2 - 3, py + TILE/2 - 3);
      ctx.closePath();
      ctx.fill();
    } else if (currentMapType === "colosseum") {
      // Heavy Stone Brick Block
      ctx.fillStyle = "#555562"; // Dark grey mortar
      roundedRect(px + 3, py + 3, TILE - 6, TILE - 6, 8, true, true);
      
      ctx.fillStyle = "#8a8a9a"; // Slate stone face
      roundedRect(px + 6, py + 6, TILE - 12, TILE - 12, 6, true, true);
      
      // Brick texture lines (procedural brick pattern)
      ctx.strokeStyle = "#40404c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Horizontal joint
      ctx.moveTo(px + 6, py + TILE/2);
      ctx.lineTo(px + TILE - 6, py + TILE/2);
      // Vertical joints (staggered)
      ctx.moveTo(px + TILE/2, py + 6);
      ctx.lineTo(px + TILE/2, py + TILE/2);
      ctx.moveTo(px + 14, py + TILE/2);
      ctx.lineTo(px + 14, py + TILE - 6);
      ctx.moveTo(px + TILE - 14, py + TILE/2);
      ctx.lineTo(px + TILE - 14, py + TILE - 6);
      ctx.stroke();
      
      // Highlight edges
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(px + 8, py + 8, TILE - 16, 3);
    } else {
      // Classic Cyber Blue-Teal block
      ctx.fillStyle = "#49889d"; // Dark cyan border
      roundedRect(px + 3, py + 3, TILE - 6, TILE - 6, 8, true, true);
      
      ctx.fillStyle = "#82c3d8"; // Cyan center
      roundedRect(px + 6, py + 6, TILE - 12, TILE - 12, 6, true, true);
      
      // Neon Cyber corner lines
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 10, py + 10, TILE - 20, TILE - 20);
      
      // Shiny reflection
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(px + 12, py + 12, TILE - 24, 4);
    }
    ctx.restore();
  } else if (type === "zone") {
    // Sudden death zone
    ctx.fillStyle = "#372f48";
    roundedRect(px + 3, py + 3, TILE - 6, TILE - 6, 8, true, true);
    ctx.fillStyle = "#ff4fa8";
    ctx.beginPath();
    ctx.moveTo(px + TILE / 2, py + 10);
    ctx.lineTo(px + TILE - 10, py + TILE / 2);
    ctx.lineTo(px + TILE / 2, py + TILE - 10);
    ctx.lineTo(px + 10, py + TILE / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff06d";
    ctx.fillRect(px + 21, py + 14, 6, 22);
    ctx.fillRect(px + 21, py + 39, 6, 5);
  } else if (type === "crate") {
    // 3D Wooden Crate texture
    ctx.save();
    ctx.fillStyle = "#865827"; // Dark wood border
    roundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 6, true, true);
    
    ctx.fillStyle = "#f7b86d"; // Crate wood body
    roundedRect(px + 7, py + 7, TILE - 14, TILE - 14, 4, true, true);
    
    // Draw wood plank lines
    ctx.strokeStyle = "#aa773f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 7, py + 15);
    ctx.lineTo(px + TILE - 7, py + 15);
    ctx.moveTo(px + 7, py + 33);
    ctx.lineTo(px + TILE - 7, py + 33);
    ctx.stroke();
    
    // Draw crossed wood brackets (3D outline "X")
    ctx.strokeStyle = "#5a3a19";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 12);
    ctx.lineTo(px + TILE - 12, py + TILE - 12);
    ctx.moveTo(px + TILE - 12, py + 12);
    ctx.lineTo(px + 12, py + TILE - 12);
    ctx.stroke();
    
    // Highlights on wood brackets
    ctx.strokeStyle = "#ffd19c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 13, py + 10);
    ctx.lineTo(px + TILE - 10, py + TILE - 13);
    ctx.stroke();
    
    // Corner brackets / bolts
    ctx.fillStyle = "#4a4a5a";
    ctx.fillRect(px + 9, py + 9, 3, 3);
    ctx.fillRect(px + TILE - 12, py + 9, 3, 3);
    ctx.fillRect(px + 9, py + TILE - 12, 3, 3);
    ctx.fillRect(px + TILE - 12, py + TILE - 12, 3, 3);
    ctx.restore();
  } else {
    // Minor background details
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(px + 6, py + 6, 3, 3);
    ctx.fillRect(px + TILE - 9, py + TILE - 9, 3, 3);
  }
}

function drawPickup(pickup) {
  const c = centerOf(pickup.x, pickup.y);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.fillStyle = pickup.type === "flame" ? "#ff7c55" : pickup.type === "bomb" ? "#7466e8" : pickup.type === "full_fire" ? "#ffe140" : pickup.type === "punch" ? "#ff69b4" : "#ffdc5a";
  ctx.strokeStyle = "#221f25";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    const r = i % 2 === 0 ? 17 : 11;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px Fredoka";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pickup.type === "flame" ? "F" : pickup.type === "bomb" ? "B" : pickup.type === "full_fire" ? "M" : pickup.type === "punch" ? "P" : "S", 0, 1);
  ctx.restore();
}

function drawBomb(bomb) {
  const bx = (bomb.slideX !== undefined) ? bomb.slideX : bomb.x;
  const by = (bomb.slideY !== undefined) ? bomb.slideY : bomb.y;
  const c = centerOf(bx, by);
  const scale = 1 + Math.sin(bomb.pulse) * 0.08;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#25212a";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 3, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#f9d86a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, -12);
  ctx.quadraticCurveTo(18, -26, 31, -15);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-6, -5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBlast(blast) {
  const alpha = Math.max(0, blast.timer / 0.48);
  blast.cells.forEach((cell) => {
    const c = centerOf(cell.x, cell.y);
    ctx.save();
    ctx.globalAlpha = 0.9 * alpha + 0.1;
    ctx.fillStyle = "#fff06d";
    ctx.strokeStyle = "#ff6f4f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 23 + Math.sin(blast.age * 38) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPlayer(player) {
  const style = characterStyle[player.kind];
  ctx.save();
  ctx.translate(player.x, player.y);
  if (!player.alive) ctx.globalAlpha = 0.34;
  if (player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0) ctx.globalAlpha = 0.55;
  
  const isWalking = Math.hypot(player.dx, player.dy) > 0.1;
  const timeSec = performance.now() / 1000;
  
  const drawDx = isWalking ? player.dx : (player.lastFacingDir?.x || 0);
  const drawDy = isWalking ? player.dy : (player.lastFacingDir?.y || 1);
  
  drawCharacterOnContext(ctx, player.kind, style, timeSec, isWalking, drawDx, drawDy, player.totalTilesWalked || 0, player.walkDistance || 0);
  
  // Draw name tag
  ctx.fillStyle = "#221f25";
  ctx.font = "900 12px Fredoka";
  ctx.textAlign = "center";
  ctx.fillText(player.name, 0, -28);

  // Draw speech bubble emote
  if (player.emote && player.emoteTimer > 0) {
    drawEmoteBubble(player.emote, player.emoteTimer);
  }

  ctx.restore();
}

function drawEmoteBubble(emoteKey, timer) {
  const emote = emoteSymbols[emoteKey] || "😊";
  const driftY = -52 - (2.0 - timer) * 16;
  const bobScale = 1 + Math.sin(timer * 12) * 0.08;

  ctx.save();
  ctx.translate(0, driftY);
  ctx.scale(bobScale, bobScale);

  // bubble circle
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#221f25";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // little triangle arrow pointer
  ctx.beginPath();
  ctx.moveTo(-6, 13);
  ctx.lineTo(0, 20);
  ctx.lineTo(6, 13);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(-5, 12);
  ctx.lineTo(0, 19);
  ctx.lineTo(5, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#000";
  ctx.font = "16px Apple Color Emoji, Segoe UI Emoji, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emote, 0, 0);

  ctx.restore();
}

function drawParticle(p) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, p.life * 2.4);
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  ctx.restore();
}

function drawMessage(message) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  roundedRect(244, 278, 472, 122, 12, true, true);
  ctx.fillStyle = "#ff7dae";
  ctx.font = "900 42px Fredoka";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, canvas.width / 2, 326);
  ctx.fillStyle = "#221f25";
  ctx.font = "900 18px Fredoka";
  ctx.fillText("Round Over! Returning to lobby...", canvas.width / 2, 366);
  ctx.restore();
}

function roundedRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  if (fill) ctx.fill();
  if (stroke) {
    ctx.strokeStyle = "#221f25";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function formatTime(seconds) {
  const s = Math.ceil(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ----------------------------------------------------------------
// LOBBY MENU SPOTLIGHT ANIMATIONS
// ----------------------------------------------------------------

function drawSpotlightCharacter() {
  if (!spotlightCtx || !spotlightCanvas) return;

  if (!spotlightVideo || spotlightVideo.readyState < 2) {
    return;
  }

  // Only clear the canvas when we are about to draw the new frame.
  // This prevents blank flashes when the video loops/seeks.
  spotlightCtx.clearRect(0, 0, spotlightCanvas.width, spotlightCanvas.height);

  const scale = Math.min(spotlightCanvas.width / spotlightVideo.videoWidth, spotlightCanvas.height / spotlightVideo.videoHeight) * 1.75;
  const drawW = spotlightVideo.videoWidth * scale;
  const drawH = spotlightVideo.videoHeight * scale;
  const drawX = (spotlightCanvas.width - drawW) / 2;
  const drawY = spotlightCanvas.height - drawH * 0.868;

  spotlightCtx.drawImage(spotlightVideo, drawX, drawY, drawW, drawH);
  const frame = spotlightCtx.getImageData(0, 0, spotlightCanvas.width, spotlightCanvas.height);
  const data = frame.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const greenDominance = g - Math.max(r, b);
    const isGreenScreen = g > 48 && (greenDominance > 14 || (g > r * 1.12 && g > b * 1.08));
    if (isGreenScreen) {
      const softness = Math.min(1, Math.max(0.62, (greenDominance - 10) / 38));
      data[i + 3] = Math.max(0, data[i + 3] * (1 - softness));
    }
  }

  spotlightCtx.putImageData(frame, 0, 0);
}

function removeGreenScreenFromCanvas(targetCtx, width, height) {
  const frame = targetCtx.getImageData(0, 0, width, height);
  const data = frame.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const greenDominance = g - Math.max(r, b);
    const isGreenScreen = g > 48 && (greenDominance > 14 || (g > r * 1.12 && g > b * 1.08));
    if (isGreenScreen) {
      const softness = Math.min(1, Math.max(0.62, (greenDominance - 10) / 38));
      data[i + 3] = Math.max(0, data[i + 3] * (1 - softness));
    }
  }

  targetCtx.putImageData(frame, 0, 0);
}

function drawCharacterSelectPreview() {
  if (!characterSelectCtx || !characterSelectCanvas || !characterSelectVideo || characterSelectVideo.readyState < 2) return;

  const width = characterSelectCanvas.width;
  const height = characterSelectCanvas.height;
  characterSelectCtx.clearRect(0, 0, width, height);

  const scale = Math.min(width / characterSelectVideo.videoWidth, height / characterSelectVideo.videoHeight) * 1.76;
  const drawW = characterSelectVideo.videoWidth * scale;
  const drawH = characterSelectVideo.videoHeight * scale;
  const drawX = (width - drawW) / 2;
  const drawY = height - drawH * 1.03;

  characterSelectCtx.drawImage(characterSelectVideo, drawX, drawY, drawW, drawH);
  removeGreenScreenFromCanvas(characterSelectCtx, width, height);
}

function drawCharacterCardPreviews() {
  characterCards.forEach((card) => {
    const video = card.querySelector("video");
    const previewCanvas = card.querySelector(".card-preview-canvas");
    if (!video || !previewCanvas || video.readyState < 2) return;

    const previewCtx = previewCanvas.getContext("2d");
    const width = previewCanvas.width;
    const height = previewCanvas.height;
    previewCtx.clearRect(0, 0, width, height);

    const kind = card.getAttribute("data-kind");
    const scaleBoost = kind === "hachiware" ? 1.58 : kind === "momonga" ? 1.66 : 1.5;
    const scale = Math.min(width / video.videoWidth, height / video.videoHeight) * scaleBoost;
    const drawW = video.videoWidth * scale;
    const drawH = video.videoHeight * scale;
    const drawX = (width - drawW) / 2;
    const drawY = height - drawH * (kind === "momonga" ? 0.98 : 0.93);

    previewCtx.drawImage(video, drawX, drawY, drawW, drawH);
    removeGreenScreenFromCanvas(previewCtx, width, height);
  });
}

// ----------------------------------------------------------------
// CLIENT LOOP & TICK ENGINE
// ----------------------------------------------------------------

function update(dt) {
  if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);

  if (running) {
    if (localMode) {
      roundTime = Math.max(0, roundTime - dt);
      if (roundTime <= 0) {
        running = false;
        gameMessage = "Time up!";
        stateEl.textContent = gameMessage;
        awardLocalMatchProgress(false);
        showTournamentResults(players, null, false);
      }
      updateSuddenDeathZone(dt);
    }

    timerEl.textContent = formatTime(roundTime);

    const localPlayer = players.find((p) => p.id === localPlayerId);
    if (localPlayer && localPlayer.alive) {
      if (localPlayer.invuln > 0) localPlayer.invuln = Math.max(0, localPlayer.invuln - dt);

      let dx = 0;
      let dy = 0;
      
      // Enforce straight movement: prevent diagonals by prioritizing key presses
      if (keys.has("ArrowLeft") || keys.has("a")) {
        dx = -1;
      } else if (keys.has("ArrowRight") || keys.has("d")) {
        dx = 1;
      } else if (keys.has("ArrowUp") || keys.has("w")) {
        dy = -1;
      } else if (keys.has("ArrowDown") || keys.has("s")) {
        dy = 1;
      }

      const moved = moveActor(localPlayer, dx, dy, dt);

      if (moved || dx !== 0 || dy !== 0) {
        if (localMode) {
          localCheckPickup(localPlayer);
        } else {
          sendServerMessage("move", {
            x: localPlayer.x,
            y: localPlayer.y,
            dx: dx,
            dy: dy,
          });
        }
      }
    }

    const isHost = localPlayerId === hostId;
    if (isHost) {
      players.forEach((p) => {
        if (p.ai && p.alive) {
          updateAi(p, dt);
        }
      });
    }

    players.forEach((p) => {
      if (!localMode && p.id !== localPlayerId) {
        p.x += (p.targetX - p.x) * 0.3;
        p.y += (p.targetY - p.y) * 0.3;
      }

      // Track distance traveled, tile steps, and facing direction for animations
      const isWalking = Math.hypot(p.dx, p.dy) > 0.1;
      if (isWalking) {
        if (p.lastX !== undefined && p.lastY !== undefined) {
          const dist = Math.hypot(p.x - p.lastX, p.y - p.lastY);
          if (dist > 0.01) {
            p.walkDistance = (p.walkDistance || 0) + dist;
          }
        }
        
        const gridX = Math.floor(p.x / 48);
        const gridY = Math.floor(p.y / 48);
        if (p.lastGridX !== undefined && p.lastGridY !== undefined) {
          if (gridX !== p.lastGridX || gridY !== p.lastGridY) {
            p.totalTilesWalked = (p.totalTilesWalked || 0) + 1;
          }
        }
        p.lastGridX = gridX;
        p.lastGridY = gridY;
        
        p.lastFacingDir = { x: p.dx, y: p.dy };
      } else {
        p.lastGridX = Math.floor(p.x / 48);
        p.lastGridY = Math.floor(p.y / 48);
      }
      p.wasWalking = isWalking;
      p.lastX = p.x;
      p.lastY = p.y;

      if (p.emoteTimer > 0) {
        p.emoteTimer = Math.max(0, p.emoteTimer - dt);
        if (p.emoteTimer <= 0) p.emote = null;
      }
    });

    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);

    blasts.forEach((blast) => {
      blast.age += dt;
      blast.timer -= dt;
    });
    blasts = blasts.filter((blast) => blast.timer > 0);

    bombs.forEach((bomb) => {
      bomb.pulse += dt * 8;
      bomb.timer = Math.max(0, bomb.timer - dt);

      if (bomb.passableFor) {
        players.forEach((player) => {
          if (bomb.passableFor.has(player.id) && !overlapsBomb(player, bomb)) {
            bomb.passableFor.delete(player.id);
          }
        });
      }
    });

    // Update sliding bombs (local + online)
    bombs.forEach((bomb) => {
      if (bomb.vx !== undefined && bomb.vy !== undefined && (bomb.vx !== 0 || bomb.vy !== 0)) {
        if (bomb.slideX === undefined) bomb.slideX = bomb.x;
        if (bomb.slideY === undefined) bomb.slideY = bomb.y;
        bomb.slideX += bomb.vx * 6.0 * dt;
        bomb.slideY += bomb.vy * 6.0 * dt;
        if (bomb.vx > 0 && bomb.slideX >= bomb.x + 1) {
          if (isTileSolidForBombLocal(bomb.x + 2, bomb.y)) { bomb.x++; bomb.slideX = bomb.x; bomb.vx = 0; }
          else { bomb.x++; }
        } else if (bomb.vx < 0 && bomb.slideX <= bomb.x - 1) {
          if (isTileSolidForBombLocal(bomb.x - 2, bomb.y)) { bomb.x--; bomb.slideX = bomb.x; bomb.vx = 0; }
          else { bomb.x--; }
        } else if (bomb.vy > 0 && bomb.slideY >= bomb.y + 1) {
          if (isTileSolidForBombLocal(bomb.x, bomb.y + 2)) { bomb.y++; bomb.slideY = bomb.y; bomb.vy = 0; }
          else { bomb.y++; }
        } else if (bomb.vy < 0 && bomb.slideY <= bomb.y - 1) {
          if (isTileSolidForBombLocal(bomb.x, bomb.y - 2)) { bomb.y--; bomb.slideY = bomb.y; bomb.vy = 0; }
          else { bomb.y--; }
        }
      }
    });

    if (localMode) {
      players.forEach((p) => {
        if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
        if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
        if (p.alive) localCheckPickup(p);
      });
      bombs.filter((bomb) => bomb.timer <= 0).forEach(localTriggerExplosion);
      localCheckGameEnd();
    }
  }
}

function render() {
  ctx.save();

  if (shakeTimer > 0) {
    const shakeIntensity = 5;
    const dx = (Math.random() - 0.5) * shakeIntensity;
    const dy = (Math.random() - 0.5) * shakeIntensity;
    ctx.translate(dx, dy);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  ctx.save();
  ctx.translate(OFFSET_X, OFFSET_Y);

  if (running || gameMessage) {
    drawMap();
    pickups.forEach(drawPickup);
    bombs.forEach(drawBomb);
    blasts.forEach(drawBlast);
    players.forEach(drawPlayer);
    particles.forEach(drawParticle);
  }

  ctx.restore();

  if (!running && gameMessage) {
    drawMessage(gameMessage);
  }

  ctx.restore();
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  
  update(dt);
  render();
  
  // Smoothly animate the yellow-console swirls background on active console screens
  document.querySelectorAll(".yellow-console").forEach((el) => {
    const offset = (now / 50) % 40;
    el.style.setProperty('--grad-offset', `${offset}px`);
  });
  
  // Update spotlight character animation frame in lobby
  if (menuScreen.classList.contains("active")) {
    drawSpotlightCharacter();
    drawCharacterSelectPreview();
    drawCharacterCardPreviews();
    drawCardAvatars();
  }
  if (lobbyScreen.classList.contains("active")) {
    drawLobbyAvatars();
  }

  // Draw and animate character cards in the results overlay if visible
  const overlay = document.getElementById("tournamentOverlay");
  if (overlay && !overlay.classList.contains("hidden")) {
    drawResultsAvatars();
  }
  
  requestAnimationFrame(loop);
}

// ----------------------------------------------------------------
// CARD PREVIEWS & TRIGGERS
// ----------------------------------------------------------------

function drawCardAvatars() {
  Object.keys(characterStyle).forEach((kind) => {
    const avatarCanvas = document.getElementById(`avatar_${kind}`);
    if (avatarCanvas) {
      const actx = avatarCanvas.getContext("2d");
      // Clear canvas
      actx.clearRect(0, 0, avatarCanvas.width, avatarCanvas.height);
      actx.save();
      actx.translate(avatarCanvas.width / 2, avatarCanvas.height / 2 + 8);
      drawCharacterOnContext(actx, kind, characterStyle[kind], performance.now() / 1000);
      actx.restore();
    }
  });
}

function drawLobbyAvatars() {
  players.forEach((p) => {
    const avatarCanvasId = `lobby_avatar_${p.id}`;
    const avatarCanvas = document.getElementById(avatarCanvasId);
    if (avatarCanvas) {
      const actx = avatarCanvas.getContext("2d");
      // Clear canvas
      actx.setTransform(1, 0, 0, 1, 0, 0);
      actx.clearRect(0, 0, avatarCanvas.width, avatarCanvas.height);
      actx.save();
      actx.translate(avatarCanvas.width / 2, avatarCanvas.height / 2 + 6);
      drawCharacterOnContext(actx, p.kind, characterStyle[p.kind], performance.now() / 1000);
      actx.restore();
    }
  });
}

function drawResultsAvatars() {
  players.forEach((p) => {
    const avatarCanvasId = `result_avatar_${p.id}`;
    const avatarCanvas = document.getElementById(avatarCanvasId);
    if (avatarCanvas) {
      const actx = avatarCanvas.getContext("2d");
      actx.setTransform(1, 0, 0, 1, 0, 0);
      actx.clearRect(0, 0, avatarCanvas.width, avatarCanvas.height);
      actx.save();
      actx.translate(avatarCanvas.width / 2, avatarCanvas.height / 2 + 6);
      drawCharacterOnContext(actx, p.kind, characterStyle[p.kind], performance.now() / 1000);
      actx.restore();
    }
  });
}

const lobbyCharacters = ["chiikawa", "hachiware", "usagi", "momonga"];

function changeSquadLobbyCharacter(direction) {
  let currentIndex = lobbyCharacters.indexOf(selectedCharacter);
  if (currentIndex === -1) currentIndex = 0;

  let newIndex;
  if (direction === "next") {
    newIndex = (currentIndex + 1) % lobbyCharacters.length;
  } else {
    newIndex = (currentIndex - 1 + lobbyCharacters.length) % lobbyCharacters.length;
  }

  const nextCharacter = lobbyCharacters[newIndex];
  
  // Set preview and select
  previewCharacter = nextCharacter;
  selectedCharacter = nextCharacter;

  // Trigger sliding animation & update image
  const img = document.getElementById("squadLobbyCharImg");
  if (img) {
    // Add slide out class
    img.className = direction === "next" ? "slide-out-left" : "slide-out-right";

    setTimeout(() => {
      // Update src to new character card image
      img.src = `assets/cards/${nextCharacter}.png`;
      // Run slide in animation
      img.className = direction === "next" ? "slide-in-right" : "slide-in-left";
    }, 120);
  }

  // Update selection globally in the wardrobe too
  syncCharacterSelectPreview(selectedCharacter);
  syncLobbySpotlightVideo(selectedCharacter);
  syncSquadLobbyInterface();
}

function syncSquadLobbyInterface() {
  const charNameEl = document.getElementById("squadLobbyCharName");
  if (charNameEl) {
    charNameEl.textContent = characterStyle[selectedCharacter]?.label || selectedCharacter;
  }
  const userNameEl = document.getElementById("squadLobbyUserName");
  if (userNameEl && usernameInput) {
    userNameEl.textContent = usernameInput.value.trim() || "Friend";
  }
  // Keep squad lobby image synced with selectedCharacter
  const img = document.getElementById("squadLobbyCharImg");
  if (img && !img.src.endsWith(`/${selectedCharacter}.png`)) {
    img.src = `assets/cards/${selectedCharacter}.png`;
  }
}

// Quick Match
quickMatchBtn?.addEventListener("click", () => {
  const name = usernameInput.value.trim() || "Friend";
  sendServerMessage("quick_match", { name, kind: selectedCharacter });
});

// Create Room
createRoomBtn?.addEventListener("click", () => {
  const name = usernameInput.value.trim() || "Friend";
  sendServerMessage("create_room", { name, kind: selectedCharacter });
});

// Join Room
joinRoomBtn?.addEventListener("click", () => {
  const name = usernameInput.value.trim() || "Friend";
  const code = joinCodeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    alert("Please enter a 4-character room code!");
    return;
  }
  sendServerMessage("join_room", { name, kind: selectedCharacter, roomCode: code });
});

// Add Bot
addBotBtn?.addEventListener("click", () => {
  sendServerMessage("add_bot");
});

// Start Match
startGameBtn?.addEventListener("click", () => {
  sendServerMessage("start_game");
});

// Ready Up toggle
readyBtn?.addEventListener("click", () => {
  readyState = !readyState;
  if (readyState) {
    readyBtn.textContent = "Unready";
    readyBtn.classList.remove("btn-accent");
    readyBtn.classList.add("btn-primary");
  } else {
    readyBtn.textContent = "I'm Ready!";
    readyBtn.classList.remove("btn-primary");
    readyBtn.classList.add("btn-accent");
  }
  sendServerMessage("player_ready", { ready: readyState });
});

// Leave Lobby
leaveLobbyBtn?.addEventListener("click", () => {
  if (socket) socket.close();
  if (window.location.protocol === "http:" || window.location.protocol === "https:") connectWebSocket();
  switchScreen(menuScreen);
});

// Exit Match
leaveGameBtn?.addEventListener("click", () => {
  running = false;
  localMode = false;
  
  // Hide results overlay and clean up victory video/confetti/countdown
  document.getElementById("tournamentOverlay").classList.add("hidden");
  stopConfetti();
  const vVideo = document.getElementById("victoryVideo");
  if (vVideo) {
    vVideo.pause();
  }
  if (roundCountdownInterval) {
    clearInterval(roundCountdownInterval);
    roundCountdownInterval = null;
  }

  if (socket) socket.close();
  if (window.location.protocol === "http:" || window.location.protocol === "https:") connectWebSocket();
  switchScreen(menuScreen);
});

// Return to Lobby after Victory
document.getElementById("victoryLobbyBtn")?.addEventListener("click", () => {
  document.getElementById("tournamentOverlay").classList.add("hidden");
  stopConfetti();
  const vVideo = document.getElementById("victoryVideo");
  if (vVideo) {
    vVideo.pause();
  }
  if (roundCountdownInterval) {
    clearInterval(roundCountdownInterval);
    roundCountdownInterval = null;
  }

  if (localMode) {
    switchScreen(menuScreen);
  } else {
    switchScreen(lobbyScreen);
  }
});

// Send Chat Message
lobbyChatForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    sendServerMessage("send_chat", { text });
    chatInput.value = "";
  }
});

// Copy Code
document.getElementById("copyCodeBtn")?.addEventListener("click", () => {
  if (roomCode) {
    navigator.clipboard.writeText(roomCode).then(() => {
      addChatMessage("System", `Copied room code "${roomCode}" to clipboard!`, true);
    });
  }
});

// In-Game Emote Buttons
[emoteSmileBtn, emoteCryBtn, emoteAngryBtn, emoteShockBtn, emoteYayBtn].forEach((btn) => {
  btn?.addEventListener("click", () => {
    const emote = btn.getAttribute("data-emote");
    sendServerMessage("trigger_emote", { emote });
  });
});

// Map Voting Card Listeners
document.querySelectorAll(".map-vote-card").forEach((card) => {
  card.addEventListener("click", () => {
    const mapChoice = card.getAttribute("data-map");
    if (!mapChoice) return;
    myLastVote = mapChoice;
    document.querySelectorAll(".map-vote-card").forEach((c) => c.classList.remove("voted"));
    card.classList.add("voted");
    sendServerMessage("vote_map", { map: mapChoice });
  });
});

// Squad Cards & Friends Popup UI Handlers
const squadCardPink = document.getElementById("squadCard_pink");
if (squadCardPink) {
  squadCardPink.addEventListener("click", () => {
    const wardrobeTabBtn = document.querySelector('.tab-btn[data-tab="look"]');
    if (wardrobeTabBtn) {
      wardrobeTabBtn.click();
    }
  });
}

const friendsPopup = document.getElementById("friendsPopup");
const openFriendsPopup = (e) => {
  e.stopPropagation();
  if (friendsPopup) {
    friendsPopup.classList.remove("hidden");
  }
};

const squadCardYellow = document.getElementById("squadCard_yellow");
const squadCardBlue = document.getElementById("squadCard_blue");
if (squadCardYellow) squadCardYellow.addEventListener("click", openFriendsPopup);
if (squadCardBlue) squadCardBlue.addEventListener("click", openFriendsPopup);

const closeFriendsBtn = document.getElementById("closeFriendsBtn");
if (closeFriendsBtn) {
  closeFriendsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (friendsPopup) {
      friendsPopup.classList.add("hidden");
    }
  });
}

// Close dialog when clicking overlay background
if (friendsPopup) {
  friendsPopup.addEventListener("click", (e) => {
    if (e.target === friendsPopup) {
      friendsPopup.classList.add("hidden");
    }
  });
}

document.querySelectorAll(".btn-invite-friend").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const friendName = btn.getAttribute("data-friend");
    if (!friendName) return;
    btn.textContent = "Invited!";
    btn.disabled = true;
    btn.style.background = "#adb5bd";
    btn.style.color = "#fff";
    btn.style.borderColor = "#868e96";
    btn.style.boxShadow = "none";
    
    setTimeout(() => {
      if (friendsPopup) {
        friendsPopup.classList.add("hidden");
      }
      setTimeout(() => {
        btn.textContent = "Invite";
        btn.disabled = false;
        btn.style.background = "";
        btn.style.color = "";
        btn.style.borderColor = "";
        btn.style.boxShadow = "";
      }, 500);
    }, 500);
  });
});

// Squad Lobby Tab Card Handlers
const squadCardUser = document.getElementById("squadCard_user");
if (squadCardUser) {
  squadCardUser.addEventListener("click", (e) => {
    if (e.target.classList.contains("selector-arrow")) return;
    const wardrobeTabBtn = document.querySelector('.tab-btn[data-tab="look"]');
    if (wardrobeTabBtn) {
      wardrobeTabBtn.click();
    }
  });
}

const prevCharBtn = document.querySelector(".btn-prev-char");
const nextCharBtn = document.querySelector(".btn-next-char");
if (prevCharBtn) {
  prevCharBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    changeSquadLobbyCharacter("prev");
  });
}
if (nextCharBtn) {
  nextCharBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    changeSquadLobbyCharacter("next");
  });
}

const openFriendsList = (e) => {
  e.stopPropagation();
  const popup = document.getElementById("friendsPopup");
  if (popup) popup.classList.remove("hidden");
};

const squadInviteLeft = document.getElementById("squadInviteCard_left");
const squadInviteRight = document.getElementById("squadInviteCard_right");
if (squadInviteLeft) squadInviteLeft.addEventListener("click", openFriendsList);
if (squadInviteRight) squadInviteRight.addEventListener("click", openFriendsList);

// Nickname synchronization
const squadLobbyUserNameEl = document.getElementById("squadLobbyUserName");
if (usernameInput && squadLobbyUserNameEl) {
  squadLobbyUserNameEl.textContent = usernameInput.value.trim() || "Friend";
  usernameInput.addEventListener("input", () => {
    squadLobbyUserNameEl.textContent = usernameInput.value.trim() || "Friend";
  });
}

// ----------------------------------------------------------------
// OFFLINE MATCHMAKING SIMULATION & VS SCREEN LOGIC
// ----------------------------------------------------------------
let matchmakingTimerInterval = null;
let matchmakingTimeouts = [];
let matchmakingSeconds = 0;
let matchedBots = [];
let vsProgressInterval = null;

function startMatchmakingSearch() {
  if (!matchmakingPopup) return;
  
  // Show matchmaking popup
  matchmakingPopup.classList.remove("hidden");
  matchmakingPopup.classList.add("active");
  
  // Reset UI status/timer
  matchmakingSeconds = 0;
  if (matchmakingTimer) matchmakingTimer.textContent = "00:00";
  
  const titleEl = matchmakingPopup.querySelector(".matchmaking-title");
  if (titleEl) titleEl.textContent = "MATCHMAKING...";
  
  if (cancelMatchmakingBtn) {
    cancelMatchmakingBtn.style.display = "block";
    cancelMatchmakingBtn.disabled = false;
  }
  
  // Set player slot 1 to player's current character
  const img1 = document.getElementById("matchmakerImg_1");
  const name1 = document.getElementById("matchmakerName_1");
  if (img1) img1.src = `assets/cards/${selectedCharacter}.png`;
  if (name1) {
    name1.textContent = (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "You";
  }
  
  // Reset other slots to searching
  for (let i = 2; i <= 4; i++) {
    const slot = document.getElementById(`matchmakerSlot_${i}`);
    if (slot) {
      slot.className = "matchmaking-card empty-slot";
      slot.innerHTML = `
        <div class="card-inner">
          <div class="searching-pulse"></div>
          <div class="slot-status-text">SEARCHING...</div>
        </div>
      `;
    }
  }
  
  // Clear any old intervals/timeouts
  clearInterval(matchmakingTimerInterval);
  matchmakingTimeouts.forEach(clearTimeout);
  matchmakingTimeouts = [];
  
  // Start timer count up
  matchmakingTimerInterval = setInterval(() => {
    matchmakingSeconds++;
    const m = String(Math.floor(matchmakingSeconds / 60)).padStart(2, "0");
    const s = String(matchmakingSeconds % 60).padStart(2, "0");
    if (matchmakingTimer) matchmakingTimer.textContent = `${m}:${s}`;
  }, 1000);
  
  // Choose 3 unique random bots from available characters (excluding player's character if possible)
  const pool = ["chiikawa", "hachiware", "usagi", "momonga"];
  const poolFiltered = pool.filter(c => c !== selectedCharacter);
  
  // Shuffle filtered pool, or if empty use default pool
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
  const selectedBots = shuffle(poolFiltered.length >= 3 ? poolFiltered : pool).slice(0, 3);
  matchedBots = selectedBots;
  
  // Stagger bot findings
  // Bot 1 found after 0.8s
  matchmakingTimeouts.push(setTimeout(() => {
    revealMatchedBot(2, selectedBots[0], characterStyle[selectedBots[0]].label + " CPU");
  }, 800));
  
  // Bot 2 found after 1.6s
  matchmakingTimeouts.push(setTimeout(() => {
    revealMatchedBot(3, selectedBots[1], characterStyle[selectedBots[1]].label + " CPU");
  }, 1600));
  
  // Bot 3 found after 2.4s
  matchmakingTimeouts.push(setTimeout(() => {
    revealMatchedBot(4, selectedBots[2], characterStyle[selectedBots[2]].label + " CPU");
    
    // All found!
    if (titleEl) titleEl.textContent = "MATCH FOUND!";
    if (cancelMatchmakingBtn) cancelMatchmakingBtn.style.display = "none";
    
    // Transition to VS screen after 1s
    matchmakingTimeouts.push(setTimeout(() => {
      // Hide matchmaking popup
      matchmakingPopup.classList.remove("active");
      matchmakingPopup.classList.add("hidden");
      clearInterval(matchmakingTimerInterval);
      
      // Start VS Screen
      startVsScreen();
    }, 1000));
  }, 2400));
}

function revealMatchedBot(slotNum, charKind, botName) {
  const slot = document.getElementById(`matchmakerSlot_${slotNum}`);
  if (!slot) return;
  
  slot.className = "matchmaking-card active pop-found";
  slot.innerHTML = `
    <div class="card-inner">
      <span class="slot-badge badge-bot">CPU</span>
      <div class="slot-image-container">
        <img src="assets/cards/${charKind}.png" alt="${botName}" />
      </div>
      <div class="slot-name">${botName}</div>
    </div>
  `;
}

function cancelMatchmaking() {
  if (matchmakingPopup) {
    matchmakingPopup.classList.remove("active");
    matchmakingPopup.classList.add("hidden");
  }
  if (vsLoadingScreen) {
    vsLoadingScreen.classList.remove("active");
    vsLoadingScreen.classList.add("hidden");
  }
  clearInterval(matchmakingTimerInterval);
  clearInterval(vsProgressInterval);
  matchmakingTimeouts.forEach(clearTimeout);
  matchmakingTimeouts = [];
}

function startVsScreen() {
  if (!vsLoadingScreen) return;
  
  // Show VS Loading Screen
  vsLoadingScreen.classList.remove("hidden");
  vsLoadingScreen.classList.add("active");
  
  // Set players inside the VS cards:
  // Card 1: Player
  const vsName1 = document.getElementById("vsName_1");
  const vsImg1 = document.getElementById("vsImg_1");
  if (vsName1) vsName1.textContent = (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "You";
  if (vsImg1) vsImg1.src = `assets/cards/${selectedCharacter}.png`;
  
  // Card 2, 3, 4: CPU Bots
  const bot1 = matchedBots[0] || "usagi";
  const bot2 = matchedBots[1] || "momonga";
  const bot3 = matchedBots[2] || "chiikawa";
  
  const vsName2 = document.getElementById("vsName_2");
  const vsImg2 = document.getElementById("vsImg_2");
  if (vsName2) vsName2.textContent = characterStyle[bot1].label + " CPU";
  if (vsImg2) vsImg2.src = `assets/cards/${bot1}.png`;
  
  const vsName3 = document.getElementById("vsName_3");
  const vsImg3 = document.getElementById("vsImg_3");
  if (vsName3) vsName3.textContent = characterStyle[bot2].label + " CPU";
  if (vsImg3) vsImg3.src = `assets/cards/${bot2}.png`;
  
  const vsName4 = document.getElementById("vsName_4");
  const vsImg4 = document.getElementById("vsImg_4");
  if (vsName4) vsName4.textContent = characterStyle[bot3].label + " CPU";
  if (vsImg4) vsImg4.src = `assets/cards/${bot3}.png`;
  
  // Set card themes based on characters
  setVsCardTheme(1, selectedCharacter);
  setVsCardTheme(2, bot1);
  setVsCardTheme(3, bot2);
  setVsCardTheme(4, bot3);
  
  // Reset slide-in animations on VS cards
  const cardsLeft = vsLoadingScreen.querySelectorAll(".card-slide-left");
  const cardsRight = vsLoadingScreen.querySelectorAll(".card-slide-right");
  const vsLogo = vsLoadingScreen.querySelector(".vs-logo-img");
  
  cardsLeft.forEach(c => {
    c.style.animation = 'none';
    c.offsetHeight; // trigger reflow
    c.style.animation = '';
  });
  cardsRight.forEach(c => {
    c.style.animation = 'none';
    c.offsetHeight; // trigger reflow
    c.style.animation = '';
  });
  if (vsLogo) {
    vsLogo.style.animation = 'none';
    vsLogo.offsetHeight; // trigger reflow
    vsLogo.style.animation = 'vsImpact 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.25) forwards, vsPulse 1.8s infinite ease-in-out 0.5s';
  }
  
  // Reset progress bar
  let progress = 0;
  if (vsProgressBarFill) vsProgressBarFill.style.width = "0%";
  if (vsLoadingStatus) vsLoadingStatus.textContent = "PREPARING ARENA... 0%";
  
  // Load steps
  const statusTexts = [
    "LOADING ARENA...",
    "SUMMONING BOMBS...",
    "COMMUNING WITH BOT SPIRITS...",
    "READY TO BATTLE!"
  ];
  
  clearInterval(vsProgressInterval);
  vsProgressInterval = setInterval(() => {
    progress += Math.floor(Math.random() * 8) + 4;
    if (progress >= 100) {
      progress = 100;
      clearInterval(vsProgressInterval);
      
      // Complete! Launch game after 0.5s delay
      setTimeout(() => {
        // Hide VS screen
        vsLoadingScreen.classList.remove("active");
        vsLoadingScreen.classList.add("hidden");
        
        // Launch actual offline game
        startLocalGameWithMatchedBots();
      }, 500);
    }
    
    if (vsProgressBarFill) vsProgressBarFill.style.width = `${progress}%`;
    const textIndex = Math.min(statusTexts.length - 1, Math.floor((progress / 100) * statusTexts.length));
    if (vsLoadingStatus) vsLoadingStatus.textContent = `${statusTexts[textIndex]} ${progress}%`;
  }, 150);
}

function setVsCardTheme(slotNum, charKind) {
  const cardInner = document.querySelector(`#vsCard_${slotNum} .vs-card-inner`);
  if (!cardInner) return;
  
  cardInner.classList.remove("card-pink", "card-yellow", "card-blue", "card-purple");
  if (charKind === "chiikawa") {
    cardInner.classList.add("card-pink");
  } else if (charKind === "usagi") {
    cardInner.classList.add("card-yellow");
  } else if (charKind === "hachiware") {
    cardInner.classList.add("card-blue");
  } else if (charKind === "momonga") {
    cardInner.classList.add("card-purple");
  } else {
    cardInner.classList.add("card-pink");
  }
}

function startLocalGameWithMatchedBots() {
  localMode = true;
  roomCode = "LOCAL";
  localPlayerId = "local_player";
  hostId = localPlayerId;
  localBombId = 0;
  
  const mapSelect = document.getElementById("localMapSelect");
  currentMapType = mapSelect ? mapSelect.value : "classic";
  map = buildLocalMap(currentMapType);
  
  const cpu1 = matchedBots[0] || "usagi";
  const cpu2 = matchedBots[1] || "momonga";
  const cpu3 = matchedBots[2] || "chiikawa";
  
  players = [
    makeLocalPlayer("local_player", (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "You", selectedCharacter, starts[0], false),
    makeLocalPlayer("cpu_1", characterStyle[cpu1].label + " CPU", cpu1, starts[1], true),
    makeLocalPlayer("cpu_2", characterStyle[cpu2].label + " CPU", cpu2, starts[2], true),
    makeLocalPlayer("cpu_3", characterStyle[cpu3].label + " CPU", cpu3, starts[3], true),
  ];
  
  players.forEach((p) => {
    p.trophies = 0;
    p.hasPunch = false;
  });
  
  bombs = [];
  blasts = [];
  pickups = [];
  particles = [];
  roundTime = 150;
  running = true;
  shakeTimer = 0;
  zoneActive = false;
  zoneLayer = 0;
  zoneStepTimer = 0;
  localMatchRewarded = false;
  gameMessage = "";
  
  switchScreen(gameScreen);
}

// Hook up matchmaking buttons
if (lobbyMatchBtn) {
  lobbyMatchBtn.addEventListener("click", () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (matchmakingDialog) {
        matchmakingDialog.classList.remove("hidden");
      }
    } else {
      startMatchmakingSearch();
    }
  });
}
if (cancelMatchmakingBtn) {
  cancelMatchmakingBtn.addEventListener("click", () => {
    cancelMatchmaking();
  });
}

// Keyboard event listeners
window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.add(key);

  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
  }

  if (running) {
    const localPlayer = players.find((p) => p.id === localPlayerId);
    if (localPlayer && localPlayer.alive) {
      if (key === " " || key === "enter") {
        if (localMode) localPlaceBomb(localPlayer);
        else sendServerMessage("place_bomb");
      }
      if (key === "x" || key === "shift") {
        if (localMode) {
          triggerLocalPunch(localPlayer);
        } else if (localPlayer.hasPunch) {
          const dir = localPlayer.lastFacingDir || { x: 0, y: 1 };
          sendServerMessage("punch_bomb", { faceX: Math.sign(dir.x), faceY: Math.sign(dir.y) });
        }
      }
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});

// Mobile Touch Gamepad Event Listeners
function bindTouchGamepadBtn(elementId, keyToSimulate) {
  const btn = document.getElementById(elementId);
  if (!btn) return;

  const handleStart = (e) => {
    e.preventDefault();
    keys.add(keyToSimulate);
    btn.classList.add("pressed");
  };

  const handleEnd = (e) => {
    e.preventDefault();
    keys.delete(keyToSimulate);
    btn.classList.remove("pressed");
  };

  btn.addEventListener("touchstart", handleStart, { passive: false });
  btn.addEventListener("touchend", handleEnd, { passive: false });
  btn.addEventListener("touchcancel", handleEnd, { passive: false });

  // Fallback for mouse testing
  btn.addEventListener("mousedown", (e) => {
    keys.add(keyToSimulate);
    btn.classList.add("pressed");
  });
  btn.addEventListener("mouseup", (e) => {
    keys.delete(keyToSimulate);
    btn.classList.remove("pressed");
  });
  btn.addEventListener("mouseleave", (e) => {
    keys.delete(keyToSimulate);
    btn.classList.remove("pressed");
  });
}

function initTouchControls() {
  bindTouchGamepadBtn("btnTouchUp", "w");
  bindTouchGamepadBtn("btnTouchLeft", "a");
  bindTouchGamepadBtn("btnTouchDown", "s");
  bindTouchGamepadBtn("btnTouchRight", "d");

  const btnBomb = document.getElementById("btnTouchBomb");
  if (btnBomb) {
    const handlePlaceBomb = (e) => {
      e.preventDefault();
      btnBomb.classList.add("pressed");
      if (running) {
        const localPlayer = players.find((p) => p.id === localPlayerId);
        if (localPlayer && localPlayer.alive) {
          if (localMode) localPlaceBomb(localPlayer);
          else sendServerMessage("place_bomb");
        }
      }
    };
    const handleBombEnd = (e) => {
      e.preventDefault();
      btnBomb.classList.remove("pressed");
    };
    btnBomb.addEventListener("touchstart", handlePlaceBomb, { passive: false });
    btnBomb.addEventListener("touchend", handleBombEnd, { passive: false });
    btnBomb.addEventListener("mousedown", handlePlaceBomb);
    btnBomb.addEventListener("mouseup", handleBombEnd);
    btnBomb.addEventListener("mouseleave", handleBombEnd);
  }

  const btnPunch = document.getElementById("btnTouchPunch");
  if (btnPunch) {
    const handlePunch = (e) => {
      e.preventDefault();
      btnPunch.classList.add("pressed");
      if (running) {
        const localPlayer = players.find((p) => p.id === localPlayerId);
        if (localPlayer && localPlayer.alive) {
          if (localMode) {
            triggerLocalPunch(localPlayer);
          } else if (localPlayer.hasPunch) {
            const dir = localPlayer.lastFacingDir || { x: 0, y: 1 };
            sendServerMessage("punch_bomb", { faceX: Math.sign(dir.x), faceY: Math.sign(dir.y) });
          }
        }
      }
    };
    const handlePunchEnd = (e) => {
      e.preventDefault();
      btnPunch.classList.remove("pressed");
    };
    btnPunch.addEventListener("touchstart", handlePunch, { passive: false });
    btnPunch.addEventListener("touchend", handlePunchEnd, { passive: false });
    btnPunch.addEventListener("mousedown", handlePunch);
    btnPunch.addEventListener("mouseup", handlePunchEnd);
    btnPunch.addEventListener("mouseleave", handlePunchEnd);
  }
}

// Automatically enter fullscreen on first user touch/click for mobile devices
function autoEnterFullscreen() {
  if (document.fullscreenElement) return;
  const docEl = document.documentElement;
  const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
  if (requestFS) {
    requestFS.call(docEl).then(() => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
    }).catch(() => {});
  }
  document.removeEventListener("touchstart", autoEnterFullscreen);
  document.removeEventListener("click", autoEnterFullscreen);
}

// Setup listeners for mobile auto fullscreen
if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
  document.addEventListener("touchstart", autoEnterFullscreen, { once: true });
  document.addEventListener("click", autoEnterFullscreen, { once: true });
}

// Call touch controls initialization on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTouchControls);
} else {
  initTouchControls();
}

// ----------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------

// Initialize WebSocket only when served through the local server.
if (window.location.protocol === "http:" || window.location.protocol === "https:") {
  connectWebSocket();
}

// Fullscreen Toggle Event Listener
const fullscreenToggleBtn = document.getElementById("fullscreenToggleBtn");
if (fullscreenToggleBtn) {
  fullscreenToggleBtn.addEventListener("click", () => {
    const consoleEl = document.querySelector(".yellow-console");
    if (consoleEl) {
      if (!document.fullscreenElement) {
        consoleEl.requestFullscreen().then(() => {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch((err) => {
              console.log("Landscape lock not supported/allowed:", err);
            });
          }
        }).catch((err) => {
          console.warn(`Fullscreen error: ${err.message}`);
          document.documentElement.requestFullscreen().catch(() => {});
        });
      } else {
        document.exitFullscreen().then(() => {
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          }
        }).catch(() => {});
      }
    }
  });
}

// Draw card previews
drawCardAvatars();
loadProgression();
updateProgressionUI();

// Start ticks and render loops
requestAnimationFrame(loop);

// Start Intro Sequence (Studio logo and Title loading)
initIntroSequence();

// ----------------------------------------------------------------
// BACKGROUND MUSIC AND AUDIO VOLUME CONTROLLER
// ----------------------------------------------------------------
const bgMusic = new Audio("uwauwa.mp3");
bgMusic.loop = true;

// Load persisted settings
let sfxVolume = localStorage.getItem("sfxVolume") !== null ? parseInt(localStorage.getItem("sfxVolume")) : 80;
let bgMusicEnabled = localStorage.getItem("bgMusicEnabled") !== null ? localStorage.getItem("bgMusicEnabled") === "true" : true;
let bgMusicVolume = localStorage.getItem("bgMusicVolume") !== null ? parseInt(localStorage.getItem("bgMusicVolume")) : 50;

bgMusic.volume = bgMusicVolume / 100;

function initAudioSettings() {
  const sfxVolumeSlider = document.getElementById("sfxVolumeSlider");
  const bgMusicToggle = document.getElementById("bgMusicToggle");
  const bgMusicVolumeSlider = document.getElementById("bgMusicVolumeSlider");
  
  if (sfxVolumeSlider) {
    sfxVolumeSlider.value = sfxVolume;
    sfxVolumeSlider.addEventListener("input", (e) => {
      sfxVolume = parseInt(e.target.value);
      localStorage.setItem("sfxVolume", sfxVolume);
    });
  }
  
  if (bgMusicToggle) {
    bgMusicToggle.checked = bgMusicEnabled;
    const label = document.querySelector('label[for="bgMusicToggle"]');
    if (label) label.textContent = bgMusicEnabled ? "On" : "Off";
    
    bgMusicToggle.addEventListener("change", (e) => {
      bgMusicEnabled = e.target.checked;
      localStorage.setItem("bgMusicEnabled", bgMusicEnabled);
      const label = document.querySelector('label[for="bgMusicToggle"]');
      if (label) label.textContent = bgMusicEnabled ? "On" : "Off";
      
      if (bgMusicEnabled) {
        bgMusic.play().catch(() => {});
      } else {
        bgMusic.pause();
      }
    });
  }
  
  if (bgMusicVolumeSlider) {
    bgMusicVolumeSlider.value = bgMusicVolume;
    bgMusicVolumeSlider.addEventListener("input", (e) => {
      bgMusicVolume = parseInt(e.target.value);
      localStorage.setItem("bgMusicVolume", bgMusicVolume);
      bgMusic.volume = bgMusicVolume / 100;
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudioSettings);
} else {
  initAudioSettings();
}

// Browser Autoplay Policy: start music on first user interaction
let musicStarted = false;
function tryPlayMusic() {
  if (bgMusicEnabled && !musicStarted) {
    bgMusic.play().then(() => {
      musicStarted = true;
      document.removeEventListener("click", tryPlayMusic);
      document.removeEventListener("keydown", tryPlayMusic);
    }).catch((err) => {
      console.log("Audio autoplay waiting for user interaction...", err);
    });
  }
}
document.addEventListener("click", tryPlayMusic);
document.addEventListener("keydown", tryPlayMusic);

// =================================================================
// TOURNAMENT OVERLAYS, CONFETTI & NEXT ROUND SYSTEM
// =================================================================

function showTournamentResults(playersList, winnerId, tournamentFinished) {
  const overlay = document.getElementById("tournamentOverlay");
  const roundCard = document.getElementById("roundResultsCard");
  const victoryCard = document.getElementById("grandVictoryCard");
  const victoryVideo = document.getElementById("victoryVideo");

  if (!overlay || !roundCard || !victoryCard) return;

  // Sync global players list for drawing avatars
  if (playersList && playersList.length > 0) {
    players = playersList;
  }

  // Show the overlay
  overlay.classList.remove("hidden");

  if (tournamentFinished) {
    // Show Grand Victory Screen
    roundCard.classList.add("hidden");
    victoryCard.classList.remove("hidden");

    // Clear any active countdown
    if (roundCountdownInterval) {
      clearInterval(roundCountdownInterval);
      roundCountdownInterval = null;
    }

    // Identify grand winner
    const grandWinner = players.find(p => p.id === winnerId || (p.trophies || 0) >= 8);
    const winnerName = grandWinner ? grandWinner.name : "Winner";
    const winnerMsgEl = document.getElementById("grandWinnerMessage");
    if (winnerMsgEl) {
      winnerMsgEl.textContent = `${winnerName} wins the Tournament! 🏆`;
    }

    // Play Victory Video
    if (victoryVideo) {
      victoryVideo.currentTime = 0;
      victoryVideo.muted = true;
      victoryVideo.loop = true;
      victoryVideo.playsInline = true;
      victoryVideo.play().catch(err => console.warn("Victory video failed to play:", err));
    }

    // Start confetti particle physics
    startConfetti();
  } else {
    // Show Intermediate Round Results
    victoryCard.classList.add("hidden");
    roundCard.classList.remove("hidden");

    const roundWinner = players.find(p => p.id === winnerId);
    const roundMsgEl = document.getElementById("roundSummaryMessage");
    if (roundMsgEl) {
      roundMsgEl.textContent = roundWinner ? `${roundWinner.name} wins this round!` : "Draw!";
    }

    // Populate players list with cards
    const resultsRow = document.getElementById("resultsPlayersRow");
    if (resultsRow) {
      resultsRow.innerHTML = "";

      players.forEach((p) => {
        const card = document.createElement("div");
        const isWinner = p.id === winnerId;
        card.className = `result-player-card ${isWinner ? 'winner' : ''}`;

        let trophiesHtml = "";
        const trophiesCount = p.trophies || 0;
        for (let i = 1; i <= 8; i++) {
          if (i < trophiesCount) {
            trophiesHtml += `<span class="trophy-slot active">🏆</span>`;
          } else if (i === trophiesCount && isWinner) {
            // Animate new trophy
            trophiesHtml += `<span class="trophy-slot new-active">🏆</span>`;
          } else {
            trophiesHtml += `<span class="trophy-slot">🏆</span>`;
          }
        }

        card.innerHTML = `
          <canvas id="result_avatar_${p.id}" class="result-avatar-canvas" width="60" height="60"></canvas>
          <div class="result-player-name">${p.name}</div>
          <div class="result-trophies-container">
            ${trophiesHtml}
          </div>
        `;
        resultsRow.appendChild(card);
      });
    }

    // Start transition countdown
    let secondsLeft = 8;
    const countdownMsg = document.getElementById("nextRoundCountdown");
    if (countdownMsg) {
      countdownMsg.textContent = `Next round starts in ${secondsLeft}s...`;
    }

    if (roundCountdownInterval) {
      clearInterval(roundCountdownInterval);
    }

    roundCountdownInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(roundCountdownInterval);
        roundCountdownInterval = null;

        // If local mode, transition round automatically
        if (localMode) {
          overlay.classList.add("hidden");
          localStartNextRound();
        }
      } else {
        if (countdownMsg) {
          countdownMsg.textContent = `Next round starts in ${secondsLeft}s...`;
        }
      }
    }, 1000);
  }
}

function localStartNextRound() {
  map = buildLocalMap(currentMapType);
  
  // Reposition players and reset alive state while preserving trophies
  players.forEach((p, index) => {
    const spawn = starts[index % starts.length];
    p.x = spawn.x * TILE + TILE / 2;
    p.y = spawn.y * TILE + TILE / 2;
    p.targetX = p.x;
    p.targetY = p.y;
    p.dx = 0;
    p.dy = 0;
    p.alive = true;
    p.speed = 142;
    p.bombs = 1;
    p.range = 2;
    p.cooldown = 0;
    p.invuln = 1.2;
    p.hasPunch = false;
    p.emote = null;
    p.emoteTimer = 0;
    
    // Fully reset movement grid targets, steps, and AI thinking states
    p.moveTarget = null;
    p.moveFrom = null;
    p.moveDir = null;
    p.walkDistance = 0;
    p.totalTilesWalked = 0;
    p.aiThink = 0;
    p.aiDir = { x: 0, y: 0 };
    // p.trophies stays unchanged!
  });

  // Clear any inputs pressed during overlays
  keys.clear();

  bombs = [];
  blasts = [];
  pickups = [];
  particles = [];
  roundTime = 150;
  running = true;
  shakeTimer = 0;
  zoneActive = false;
  zoneLayer = 0;
  zoneStepTimer = 0;
  localMatchRewarded = false;
  gameMessage = "";

  timerEl.textContent = formatTime(roundTime);
  stateEl.textContent = "Battle!";
  updateHudSidebar();
  switchScreen(gameScreen);
}

// ----------------------------------------------------------------
// CONFETTI CANVAS EFFECT
// ----------------------------------------------------------------

function resizeConfettiCanvas() {
  if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
}

function startConfetti() {
  confettiActive = true;
  confettiParticles = [];
  resizeConfettiCanvas();
  
  // Create 120 colorful falling confetti particles
  for (let i = 0; i < 120; i++) {
    confettiParticles.push(createConfettiParticle());
  }
  requestAnimationFrame(updateConfetti);
}

function stopConfetti() {
  confettiActive = false;
  confettiParticles = [];
  if (confettiCtx && confettiCanvas) {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

function createConfettiParticle() {
  const colors = ["#ffd338", "#ff2fa7", "#2ecc71", "#3498db", "#9b59b6", "#e67e22"];
  const width = confettiCanvas ? confettiCanvas.width : window.innerWidth;
  return {
    x: Math.random() * width,
    y: Math.random() * -100 - 20,
    r: Math.random() * 6 + 4,
    d: Math.random() * 100 + 40,
    color: colors[Math.floor(Math.random() * colors.length)],
    tilt: Math.random() * 10 - 5,
    tiltAngleIncremental: Math.random() * 0.07 + 0.02,
    tiltAngle: 0
  };
}

function updateConfetti() {
  if (!confettiActive) return;
  if (!confettiCtx || !confettiCanvas) return;

  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  for (let i = 0; i < confettiParticles.length; i++) {
    const p = confettiParticles[i];
    p.tiltAngle += p.tiltAngleIncremental;
    p.y += (Math.cos(p.tiltAngle) + 3 + p.r / 2) / 2;
    p.x += Math.sin(p.tiltAngle);
    p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

    confettiCtx.beginPath();
    confettiCtx.lineWidth = p.r;
    confettiCtx.strokeStyle = p.color;
    confettiCtx.moveTo(p.x + p.tilt + p.r / 2, p.y);
    confettiCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
    confettiCtx.stroke();

    // Reset particle if it leaves the bottom or sides of the viewport
    if (p.y > confettiCanvas.height || p.x > confettiCanvas.width || p.x < -30) {
      confettiParticles[i] = createConfettiParticle();
      confettiParticles[i].y = -20;
    }
  }

  requestAnimationFrame(updateConfetti);
}

window.addEventListener("resize", resizeConfettiCanvas);

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// SUPABASE AUTHENTICATION & LOGIN LOGIC
// ----------------------------------------------------------------

async function checkAuthSession() {
  if (!supabaseClient) {
    // If Supabase is not configured, skip to main menu
    switchScreen(menuScreen);
    tryPlayMusic();
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      await handleAuthenticatedUser(session.user);
    } else {
      switchScreen(loginScreen);
    }
  } catch (err) {
    console.error("Error checking session:", err);
    switchScreen(loginScreen);
  }
}

async function handleAuthenticatedUser(user) {
  try {
    // Load progression
    await loadProgression();

    // Check if user has a username
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is empty result

    if (data && data.username) {
      // User has a username, proceed to main menu
      switchScreen(menuScreen);
      tryPlayMusic();
    } else {
      // No username, show intro registration screen
      startUsernameIntroFlow();
    }
  } catch (err) {
    console.error("Error handling authenticated user:", err);
    startUsernameIntroFlow(); // fallback to intro
  }
}

// Bouncing character introduction dialogue typewriter effect
let introTypewriterInterval = null;
function startUsernameIntroFlow() {
  switchScreen(introScreen);
  if (usernameForm) usernameForm.classList.add("hidden");

  const characterNames = ["Hachiware", "Chiikawa", "Usagi", "Momonga"];
  const chosenGuide = characterNames[Math.floor(Math.random() * characterNames.length)];
  
  // Set guide avatar image dynamically
  const guideImg = document.querySelector(".intro-guide-character");
  if (guideImg) {
    guideImg.src = `assets/cards/${chosenGuide.toLowerCase()}.png`;
  }

  const welcomeMessage = `Hello there! I am ${chosenGuide}, your arena guide. Welcome to Chiikawa Royale! Let's choose a cool username for you so we can start matching with friends online!`;
  
  if (introSpeechBubble) {
    introSpeechBubble.textContent = "";
    let i = 0;
    clearInterval(introTypewriterInterval);
    introTypewriterInterval = setInterval(() => {
      if (i < welcomeMessage.length) {
        introSpeechBubble.textContent += welcomeMessage.charAt(i);
        i++;
      } else {
        clearInterval(introTypewriterInterval);
        // Show username form when typewriter finishes
        if (usernameForm) {
          usernameForm.classList.remove("hidden");
          usernameForm.style.opacity = "0";
          setTimeout(() => {
            usernameForm.style.transition = "opacity 0.5s ease";
            usernameForm.style.opacity = "1";
          }, 50);
        }
      }
    }, 35); // 35ms per character
  }
}

// Hook up Auth Form submissions
if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;

    const email = authEmail.value.trim();
    const password = authPassword.value;
    
    if (authMessage) {
      authMessage.textContent = "Logging in...";
      authMessage.className = "auth-message success";
      authMessage.classList.remove("hidden");
    }

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (authMessage) authMessage.classList.add("hidden");
      await handleAuthenticatedUser(data.user);
    } catch (err) {
      console.error("Login error:", err);
      if (authMessage) {
        authMessage.textContent = err.message || "Failed to log in.";
        authMessage.className = "auth-message error";
        authMessage.classList.remove("hidden");
      }
    }
  });
}

if (btnSignup) {
  btnSignup.addEventListener("click", async () => {
    if (!supabaseClient) return;

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {
      if (authMessage) {
        authMessage.textContent = "Please enter both email and password.";
        authMessage.className = "auth-message error";
        authMessage.classList.remove("hidden");
      }
      return;
    }

    if (authMessage) {
      authMessage.textContent = "Creating account...";
      authMessage.className = "auth-message success";
      authMessage.classList.remove("hidden");
    }

    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;

      if (authMessage) {
        authMessage.textContent = "Account created! Logging in...";
        authMessage.className = "auth-message success";
        authMessage.classList.remove("hidden");
      }

      // Automatically sign in or check user
      if (data.user) {
        setTimeout(async () => {
          await handleAuthenticatedUser(data.user);
        }, 1500);
      }
    } catch (err) {
      console.error("Signup error:", err);
      if (authMessage) {
        authMessage.textContent = err.message || "Failed to sign up.";
        authMessage.className = "auth-message error";
        authMessage.classList.remove("hidden");
      }
    }
  });
}

// Hook up Username Form submission
if (usernameForm) {
  usernameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;

    const username = introUsernameInput.value.trim();
    if (username.length < 3) {
      if (usernameMessage) {
        usernameMessage.textContent = "Username must be at least 3 characters!";
        usernameMessage.className = "username-message error";
        usernameMessage.classList.remove("hidden");
      }
      return;
    }

    if (usernameMessage) {
      usernameMessage.textContent = "Saving username...";
      usernameMessage.className = "username-message success";
      usernameMessage.classList.remove("hidden");
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error("No authenticated user session.");

      // Check if username is taken
      const { data: takenCheck, error: checkError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('username', username);

      if (checkError) throw checkError;
      if (takenCheck && takenCheck.length > 0) {
        throw new Error("Username already taken! Try another one.");
      }

      // Update username in profiles
      const { error } = await supabaseClient
        .from('profiles')
        .update({ username: username })
        .eq('id', user.id);

      if (error) throw error;

      if (usernameMessage) usernameMessage.classList.add("hidden");
      
      // Update UI nicknames
      if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = username;
      if (usernameInput) usernameInput.value = username;

      // Go to main menu
      switchScreen(menuScreen);
      tryPlayMusic();
    } catch (err) {
      console.error("Username registration error:", err);
      if (usernameMessage) {
        usernameMessage.textContent = err.message || "Failed to save username.";
        usernameMessage.className = "username-message error";
        usernameMessage.classList.remove("hidden");
      }
    }
  });
}

// Hook up Log Out button in Settings
const btnLogoutAccount = document.getElementById("btnLogoutAccount");
if (btnLogoutAccount) {
  btnLogoutAccount.addEventListener("click", async () => {
    if (!supabaseClient) return;
    try {
      await supabaseClient.auth.signOut();
      
      // Reset progression locally
      crownCount = 0;
      gemsCount = 100;
      seasonLevel = 1;
      seasonXp = 0;
      updateProgressionUI();

      // Go back to login screen
      switchScreen(loginScreen);
    } catch (err) {
      console.error("Logout error:", err);
    }
  });
}

// INTRO SPLASH & TITLE SCREEN SEQUENCE
// ----------------------------------------------------------------

function initIntroSequence() {
  // Ensure title screen starts active under the splash overlay
  if (titleScreen) {
    switchScreen(titleScreen);
  }

  // 1. Studio Logo Animation
  if (studioSplashScreen) {
    // Make sure the splash overlay starts active
    studioSplashScreen.classList.add("active");
    
    // Fade it out after 2 seconds
    setTimeout(() => {
      studioSplashScreen.classList.remove("active");
      
      // Completely remove it from layout after transition completes
      setTimeout(() => {
        studioSplashScreen.style.display = "none";
        
        // 2. Start Title Screen Loading
        startTitleScreenLoading();
      }, 500); // matches the 0.5s transition in CSS
    }, 2000);
  } else {
    // If no splash screen, start loading immediately
    startTitleScreenLoading();
  }

  // Hook up the Play Button click handler
  if (titlePlayBtn) {
    titlePlayBtn.addEventListener("click", () => {
      checkAuthSession();
    });
  }
}

function startTitleScreenLoading() {
  if (!titleLoadingSection || !titleProgressBarFill || !titleLoadingStatus) return;
  
  let progress = 0;
  const statusMessages = [
    { limit: 20, text: "CONNECTING TO CHIHUA NETWORK..." },
    { limit: 40, text: "SUMMONING CHIIKAWA & FRIENDS..." },
    { limit: 60, text: "CHARGING BOMB FUSES..." },
    { limit: 85, text: "BUILDING ARCADE CABINET..." },
    { limit: 100, text: "READY TO BLAST!" }
  ];

  const interval = setInterval(() => {
    // Progress increment between 2% and 6% for organic feel
    progress += Math.floor(Math.random() * 5) + 2;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      
      // Update loading visual to 100%
      titleProgressBarFill.style.width = "100%";
      titleLoadingStatus.textContent = "READY TO BLAST! 100%";
      
      // Transition out loading section and transition in Play button
      setTimeout(() => {
        titleLoadingSection.classList.add("hidden");
        if (titlePlayBtnContainer) {
          titlePlayBtnContainer.classList.remove("hidden");
        }
      }, 600);
    } else {
      titleProgressBarFill.style.width = `${progress}%`;
      
      // Determine message based on current progress
      const msgObj = statusMessages.find(m => progress <= m.limit) || statusMessages[statusMessages.length - 1];
      titleLoadingStatus.textContent = `${msgObj.text} ${progress}%`;
    }
  }, 100); // 100ms ticks for a total duration of around 2-3 seconds
}
