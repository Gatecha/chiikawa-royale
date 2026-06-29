// Check if this window was opened as an OAuth login popup redirect
const oauthRedirectParams = new URLSearchParams(window.location.search);
const oauthHashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const oauthError =
  oauthRedirectParams.get("error_description") ||
  oauthHashParams.get("error_description") ||
  oauthRedirectParams.get("error") ||
  oauthHashParams.get("error");
let pendingOAuthError = oauthError ? decodeURIComponent(oauthError) : "";
let isOAuthPopup = false;
if (window.opener && (window.location.hash.includes("access_token=") || window.location.search.includes("code=") || pendingOAuthError)) {
  isOAuthPopup = true;
}

if (pendingOAuthError && window.history?.replaceState) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// CONFIGURATION: Set this to your Supabase project credentials
const SUPABASE_URL = "https://ccwcifnddnwotrnutanp.supabase.co"; // Pre-populated with your project ID
const SUPABASE_ANON_KEY = "sb_publishable_-CxUNw_KVKIPaZMtjsURgg_QbufGANy"; // PASTE YOUR PUBLIC ANON KEY HERE

// Initialize Supabase Client (wrapped in try/catch to prevent script block if credentials/library fail)
let supabaseClient = null;
try {
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Listen for auth state changes (e.g. when OAuth login completes in a popup)
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session && session.user) {
        if (isOAuthPopup) {
          // If we are in the popup window, wait a brief moment for storage write, then close
          setTimeout(() => {
            window.close();
          }, 800);
        } else {
          // If we are in the main game tab, transition to the game
          const loginScreenActive = document.getElementById("loginScreen")?.classList.contains("active");
          if (loginScreenActive) {
            await handleAuthenticatedUser(session.user);
          }
        }
      }
    });

    // Listen for localStorage changes to sync auth state across tabs instantly
    window.addEventListener("storage", async (e) => {
      if (e.key && e.key.includes("-auth-token")) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
          const loginScreenActive = document.getElementById("loginScreen")?.classList.contains("active");
          if (loginScreenActive) {
            await handleAuthenticatedUser(session.user);
          }
        }
      }
    });

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== "oauth_error") return;
      switchScreen(loginScreen);
      if (authMessage) {
        authMessage.textContent = `Login failed: ${event.data.message || "OAuth provider returned an error."}`;
        authMessage.className = "auth-message error";
        authMessage.classList.remove("hidden");
      }
    });

    // Check if session is already present for the popup, and handle auto-close
    if (isOAuthPopup) {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setTimeout(() => {
            window.close();
          }, 800);
        }
      });
      // Safety timeout to prevent popup from hanging indefinitely
      setTimeout(() => {
        window.close();
      }, 5000);
    }
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
let localBotsDifficulty = "pro";

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
const ingameChatForm = document.getElementById("ingameChatForm");
const ingameChatInput = document.getElementById("ingameChatInput");

// Game HUD elements
const timerEl = document.getElementById("roundTimer");
const stateEl = document.getElementById("roundState");
const gameRoomCode = document.getElementById("gameRoomCode");
const hudPlayersList = document.getElementById("hudPlayersList");
const leaveGameBtn = document.getElementById("leaveGameBtn");
const surrenderVotePopup = document.getElementById("surrenderVotePopup");
const surrenderVoteStatus = document.getElementById("surrenderVoteStatus");
const surrenderYesBtn = document.getElementById("surrenderYesBtn");
const surrenderNoBtn = document.getElementById("surrenderNoBtn");

// Emotes buttons
const emoteSmileBtn = document.getElementById("emoteSmileBtn");
const emoteCryBtn = document.getElementById("emoteCryBtn");
const emoteAngryBtn = document.getElementById("emoteAngryBtn");
const emoteShockBtn = document.getElementById("emoteShockBtn");
const emoteYayBtn = document.getElementById("emoteYayBtn");


// Spotlight canvas in lobby
const spotlightCanvas = document.getElementById("spotlightCanvas");
const spotlightCtx = spotlightCanvas ? spotlightCanvas.getContext("2d") : null;
const spotlightVideo = document.getElementById("spotlightVideo");
const characterSelectVideo = document.getElementById("characterSelectVideo");
const characterSelectCanvas = document.getElementById("characterSelectCanvas");
const characterSelectCtx = characterSelectCanvas ? characterSelectCanvas.getContext("2d") : null;
const squadLobbyVideo = document.getElementById("squadLobbyVideo");
const squadLobbyCanvas = document.getElementById("squadLobbyCanvas");
const squadLobbyCtx = squadLobbyCanvas ? squadLobbyCanvas.getContext("2d") : null;
const characterSelectName = document.getElementById("characterSelectName");
const characterSelectState = document.getElementById("characterSelectState");
const confirmCharacterBtn = document.getElementById("confirmCharacterBtn");
const selectCardGrid = document.getElementById("selectCardGrid");
const wardrobeTabs = document.querySelectorAll(".wardrobe-tab");

const victoryVideo = document.getElementById("victoryVideo");
const victoryVideoCanvas = document.getElementById("victoryVideoCanvas");
const victoryVideoCtx = victoryVideoCanvas ? victoryVideoCanvas.getContext("2d") : null;
const characterSelectVideos = {
  chiikawa: "assets/chiikawa/chiikawa_character_animation.mp4",
  hachiware: "hachiware-lobby.mp4",
  usagi: "assets/usagi/usagi_character_animation.mp4",
  momonga: "assets/momonga/momonga_character_animation.mp4",
};
let selectedCharacter = localStorage.getItem("equipped_character") || "chiikawa";
let previewCharacter = selectedCharacter;
let brmVideoEl = null;
let brmActive = false;

// Settings Indicators
const connectionStatusIndicator = document.getElementById("connectionStatusIndicator");
const playerUuidLabel = document.getElementById("playerUuidLabel");

// Game settings
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const TILE = 48;
const COLS = 15;
const ROWS = 13;
const OFFSET_X = (CANVAS_WIDTH - COLS * TILE) / 2;
const OFFSET_Y = 72;
const SUDDEN_DEATH_TIME = 90;
const ZONE_STEP_SECONDS = 10;
const MAX_ZONE_LAYER = 4;
const STANDARD_MAX_PLAYERS = 4;
const TEAM_MAX_PLAYERS = 6;

const graphicsProfiles = {
  high: { fps: 60, menuFps: 30, effectDensity: 1, animateMenus: true },
  medium: { fps: 45, menuFps: 24, effectDensity: 0.55, animateMenus: true },
  low: { fps: 30, menuFps: 20, effectDensity: 0.25, animateMenus: true },
};

let graphicsQuality = "high";
let renderScale = 1.0;

// Detect and auto-configure graphics quality based on device capabilities
function initGraphicsDefaults() {
  const savedQuality = localStorage.getItem("graphicsQuality");
  const savedScale = localStorage.getItem("renderScale");

  if (savedQuality === null || savedScale === null) {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || (window.matchMedia?.("(pointer: coarse)")?.matches);
    const isApp = window.location.protocol === "file:" || /Android/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;

    let autoQuality = "high";
    let autoScale = 1.0;

    if (isMobileDevice) {
      if (isApp) {
        if (cores <= 4) {
          autoQuality = "low";
          autoScale = 0.7;
        } else {
          autoQuality = "medium";
          autoScale = 0.85;
        }
      } else {
        autoQuality = "medium";
        autoScale = 0.85;
      }
    } else {
      autoQuality = "high";
      autoScale = 1.0;
    }

    if (savedQuality === null) {
      localStorage.setItem("graphicsQuality", autoQuality);
    }
    if (savedScale === null) {
      localStorage.setItem("renderScale", String(autoScale));
    }
  }
  
  graphicsQuality = localStorage.getItem("graphicsQuality") || "high";
  renderScale = Number(localStorage.getItem("renderScale") || 1.0);
}

initGraphicsDefaults();

let activeGraphics = graphicsProfiles[graphicsQuality] || graphicsProfiles.high;
let lastFrameTime = 0;
let lastMenuDrawTime = 0;

function getVideoSrc(baseSrc, forceHighQuality = false) {
  if (!baseSrc) return "";
  if (graphicsQuality === "high" || forceHighQuality) {
    return baseSrc.replace(".mp4", "_high.mp4");
  }
  return baseSrc;
}

function reloadActiveVideosSettings() {
  // Update character select video
  if (characterSelectVideo) {
    const baseSrc = characterSelectVideos[previewCharacter || selectedCharacter];
    if (baseSrc) {
      const targetSrc = getVideoSrc(baseSrc, true); // Force high quality for wardrobe
      if (!characterSelectVideo.src.endsWith(targetSrc)) {
        characterSelectVideo.src = targetSrc;
        characterSelectVideo.load();
        playMutedLoop(characterSelectVideo);
      }
    }
  }
  
  // Update spotlight video
  if (spotlightVideo) {
    const baseSrc = characterSelectVideos[selectedCharacter];
    if (baseSrc) {
      const targetSrc = getVideoSrc(baseSrc);
      if (!spotlightVideo.src.endsWith(targetSrc)) {
        spotlightVideo.src = targetSrc;
        spotlightVideo.load();
        playMutedLoop(spotlightVideo);
      }
    }
  }

  // Update squad lobby video
  if (squadLobbyVideo) {
    const baseSrc = characterSelectVideos[selectedCharacter];
    if (baseSrc) {
      const targetSrc = getVideoSrc(baseSrc);
      if (!squadLobbyVideo.src.endsWith(targetSrc)) {
        squadLobbyVideo.src = targetSrc;
        squadLobbyVideo.load();
        playMutedLoop(squadLobbyVideo);
      }
    }
  }

  // Update matchmaking video disabled (now using static logo icon)
  /*
  if (brmVideoEl && brmActive) {
    const matchmakingVideos = {
      chiikawa: "assets/matchmaking_animations/chiikawa_br_matchmaking_animation.mp4",
      hachiware: "assets/matchmaking_animations/hachiware_br_matchmaking_animation.mp4",
      usagi: "assets/matchmaking_animations/usagi_br_matchmaking_animation.mp4",
      momonga: "assets/matchmaking_animations/momonga_br_matchmaking_animation.mp4"
    };
    const baseSrc = matchmakingVideos[selectedCharacter] || "assets/matchmaking_animations/chiikawa_br_matchmaking_animation.mp4";
    const targetSrc = getVideoSrc(baseSrc);
    if (!brmVideoEl.src.endsWith(targetSrc)) {
      brmVideoEl.src = targetSrc;
      brmVideoEl.load();
      playMutedLoop(brmVideoEl);
    }
  }
  */

  // Update victory video
  if (victoryVideo) {
    const targetSrc = getVideoSrc("hachiware-lobby.mp4");
    if (!victoryVideo.src.endsWith(targetSrc)) {
      victoryVideo.src = targetSrc;
      victoryVideo.load();
      playMutedLoop(victoryVideo);
    }
  }
}

function clampRenderScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0.55, parsed));
}

function applyGraphicsSettings() {
  activeGraphics = graphicsProfiles[graphicsQuality] || graphicsProfiles.high;
  renderScale = clampRenderScale(renderScale);
  const targetWidth = Math.max(1, Math.round(CANVAS_WIDTH * renderScale));
  const targetHeight = Math.max(1, Math.round(CANVAS_HEIGHT * renderScale));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  document.body.classList.toggle("graphics-low", graphicsQuality === "low");
  document.body.classList.toggle("graphics-medium", graphicsQuality === "medium");
  
  if (typeof reloadActiveVideosSettings === "function") {
    reloadActiveVideosSettings();
  }
}

applyGraphicsSettings();

if (window.location.protocol === "file:" && /Android/i.test(navigator.userAgent)) {
  document.body.classList.add("android-apk");
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
  walk_back2: new Image(),
  walk_side1: new Image(),
  walk_side2: new Image()
};
hachiwareImages.idle.src = "assets/hachiware/hachiware_idle.png";
hachiwareImages.walk_front1.src = "assets/hachiware/hachiware_walk_front1.png";
hachiwareImages.walk_front2.src = "assets/hachiware/hachiware_walk_front2.png";
hachiwareImages.walk_back1.src = "assets/hachiware/hachiware_walk_back1.png";
hachiwareImages.walk_back2.src = "assets/hachiware/hachiware_walk_back2.png";
hachiwareImages.walk_side1.src = "assets/hachiware/hachiware_walk_side1.png";
hachiwareImages.walk_side2.src = "assets/hachiware/hachiware_walk_side2.png";

// Load Usagi Images
const usagiImages = {
  idle: new Image(),
  walk_front1: new Image(),
  walk_front2: new Image(),
  walk_back1: new Image(),
  walk_back2: new Image(),
  walk_side1: new Image(),
  walk_side2: new Image()
};
usagiImages.idle.src = "assets/usagi/usagi_idle.png";
usagiImages.walk_front1.src = "assets/usagi/usagi_walk_front1.png";
usagiImages.walk_front2.src = "assets/usagi/usagi_walk_front2.png";
usagiImages.walk_back1.src = "assets/usagi/usagi_walk_back1.png";
usagiImages.walk_back2.src = "assets/usagi/usagi_walk_back2.png";
usagiImages.walk_side1.src = "assets/usagi/usagi_walk_side1.png";
usagiImages.walk_side2.src = "assets/usagi/usagi_walk_side2.png";

// Load Chiikawa Images
const chiikawaImages = {
  idle: new Image(),
  walk_front1: new Image(),
  walk_front2: new Image(),
  walk_back1: new Image(),
  walk_back2: new Image(),
  walk_side1: new Image(),
  walk_side2: new Image()
};
chiikawaImages.idle.src = "assets/chiikawa/chiikawa_idle.png";
chiikawaImages.walk_front1.src = "assets/chiikawa/chiikawa_walk_front1.png";
chiikawaImages.walk_front2.src = "assets/chiikawa/chiikawa_walk_front2.png";
chiikawaImages.walk_back1.src = "assets/chiikawa/chiikawa_walk_back1.png";
chiikawaImages.walk_back2.src = "assets/chiikawa/chiikawa_walk_back2.png";
chiikawaImages.walk_side1.src = "assets/chiikawa/chiikawa_walk_side1.png";
chiikawaImages.walk_side2.src = "assets/chiikawa/chiikawa_walk_sid2.png";

// Load Momonga Images
const momongaImages = {
  idle: new Image(),
  walk_front1: new Image(),
  walk_front2: new Image(),
  walk_back1: new Image(),
  walk_back2: new Image(),
  walk_side1: new Image(),
  walk_side2: new Image()
};
momongaImages.idle.src = "assets/momonga/momonga_idle.png";
momongaImages.walk_front1.src = "assets/momonga/momonga_walk_front1.png";
momongaImages.walk_front2.src = "assets/momonga/momonga_walk_front2.png";
momongaImages.walk_back1.src = "assets/momonga/momonga_walk_back1.png";
momongaImages.walk_back2.src = "assets/momonga/momonga_walk_back2.png";
momongaImages.walk_side1.src = "assets/momonga/momonga_walk_side1.png";
momongaImages.walk_side2.src = "assets/momonga/momonga_walk_side2.png";


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

// Rank System State (RP = Ranking Points)
let rankRp = 0;        // Current RP total
let totalWins = 0;     // Lifetime wins
let totalMatches = 0;  // Lifetime matches played

// Rank tier definitions — ordered from highest to lowest, RP minimums
const RANK_TIERS = [
  { id: 'grandmaster', name: 'GRANDMASTER', div: '',    min: 20000 },
  { id: 'master',      name: 'MASTER',      div: '',    min: 12000 },
  { id: 'diamond',     name: 'DIAMOND',     div: 'III', min: 11000 },
  { id: 'diamond',     name: 'DIAMOND',     div: 'II',  min: 9500  },
  { id: 'diamond',     name: 'DIAMOND',     div: 'I',   min: 8000  },
  { id: 'platinum',    name: 'PLATINUM',    div: 'III', min: 7000  },
  { id: 'platinum',    name: 'PLATINUM',    div: 'II',  min: 6000  },
  { id: 'platinum',    name: 'PLATINUM',    div: 'I',   min: 5000  },
  { id: 'gold',        name: 'GOLD',        div: 'III', min: 4000  },
  { id: 'gold',        name: 'GOLD',        div: 'II',  min: 3200  },
  { id: 'gold',        name: 'GOLD',        div: 'I',   min: 2500  },
  { id: 'silver',      name: 'SILVER',      div: 'III', min: 1900  },
  { id: 'silver',      name: 'SILVER',      div: 'II',  min: 1400  },
  { id: 'silver',      name: 'SILVER',      div: 'I',   min: 1000  },
  { id: 'bronze',      name: 'BRONZE',      div: 'III', min: 500   },
  { id: 'bronze',      name: 'BRONZE',      div: 'II',  min: 200   },
  { id: 'bronze',      name: 'BRONZE',      div: 'I',   min: 0     },
];

function getRankForRp(rp) {
  for (const tier of RANK_TIERS) {
    if (rp >= tier.min) return tier;
  }
  return RANK_TIERS[RANK_TIERS.length - 1];
}

function getNextRankThreshold(rp) {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (RANK_TIERS[i].min > rp) return RANK_TIERS[i].min;
  }
  return null; // Already grandmaster
}

function getRankIconSvg(rankId) {
  const icons = {
    bronze: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="rbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7a4f2d"/><stop offset="100%" stop-color="#cd8f52"/></linearGradient></defs><path d="M20 3 L32 10 L32 30 L20 37 L8 30 L8 10 Z" fill="url(#rbg)" stroke="#a06830" stroke-width="1.5"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="900" font-family="Arial" fill="#fff" opacity="0.9">B</text></svg>`,
    silver: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7f8fa6"/><stop offset="100%" stop-color="#c8d6e5"/></linearGradient></defs><path d="M20 3 L32 10 L32 30 L20 37 L8 30 L8 10 Z" fill="url(#sbg)" stroke="#9fafc0" stroke-width="1.5"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="900" font-family="Arial" fill="#fff" opacity="0.9">S</text></svg>`,
    gold:   `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f9ca24"/><stop offset="100%" stop-color="#f0932b"/></linearGradient></defs><path d="M20 3 L32 10 L32 30 L20 37 L8 30 L8 10 Z" fill="url(#gbg)" stroke="#d4a017" stroke-width="1.5"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="900" font-family="Arial" fill="#fff" opacity="0.9">G</text></svg>`,
    platinum:`<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00b894"/><stop offset="100%" stop-color="#00d4aa"/></linearGradient></defs><path d="M20 3 L32 10 L32 30 L20 37 L8 30 L8 10 Z" fill="url(#pbg)" stroke="#00c9a0" stroke-width="1.5"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="900" font-family="Arial" fill="#fff" opacity="0.9">P</text></svg>`,
    diamond:`<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6c63ff"/><stop offset="100%" stop-color="#a29bfe"/></linearGradient></defs><path d="M20 4 L28 14 L20 36 L12 14 Z" fill="url(#dbg)" stroke="#8c84fe" stroke-width="1.5"/><path d="M12 14 L20 4 L28 14 Z" fill="rgba(255,255,255,0.25)"/></svg>`,
    master: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9b59b6"/><stop offset="100%" stop-color="#e056fd"/></linearGradient></defs><circle cx="20" cy="20" r="16" fill="url(#mbg)" stroke="#c84bef" stroke-width="1.5"/><path d="M20 8 L22.4 15.3 L30 15.3 L23.8 19.7 L26.2 27 L20 22.5 L13.8 27 L16.2 19.7 L10 15.3 L17.6 15.3 Z" fill="#fff" opacity="0.9"/></svg>`,
    grandmaster:`<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gmbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e74c3c"/><stop offset="50%" stop-color="#f0932b"/><stop offset="100%" stop-color="#ffd700"/></linearGradient></defs><path d="M20 2 L24 12 L34 12 L26 19 L29 29 L20 23 L11 29 L14 19 L6 12 L16 12 Z" fill="url(#gmbg)" stroke="#e0a020" stroke-width="1.5"/></svg>`,
  };
  return icons[rankId] || icons.bronze;
}


// Client Network State
let socket = null;
let roomCode = null;
let isCreatingRoom = false;
let currentBRZone = null;
let localOfflineModeChoice = "normal";
let cameraCenterX = 0;
let cameraCenterY = 0;
let cameraX = 0;
let cameraY = 0;
let currentWorldEvent = null;
let spectatedPlayerId = null;
let brPings = [];
let localHealingState = null;
let hostId = null;
let localPlayerId = null;
let reconnectToken = localStorage.getItem("chiikawaReconnectToken") || null;
let players = [];
let readyState = false;
let localMode = false;
let startCountdownTimer = 0;
let startCountdownState = "";
let serverMode = "online"; // "online" or "local"
let pendingLocalConnect = false;

// Social globals moved to top to prevent temporal dead zone ReferenceErrors
let currentSocialUserId = null;
let currentSocialUsername = null;
let myFriendIds = new Set();
let myFriendshipMap = {}; // friendId -> { friendshipId, username, character }
let pendingRequests = []; // incoming friend requests

// Active Player Name Helper and Pending Invite State
let pendingInviteUserId = null;
let pendingInviteUsername = null;

let playerVolumeSettings = {};
let playerMutedSettings = {};
let talkingPlayers = {};
let talkingTimeouts = {};

function getActivePlayerName() {
  const socialName = currentSocialUsername;
  const localName = localStorage.getItem("local_username");
  const inputName = (typeof usernameInput !== 'undefined' && usernameInput) ? usernameInput.value.trim() : "";
  
  if (socialName) return socialName;
  if (localName && localName !== "Friend") return localName;
  if (inputName && inputName !== "Friend") return inputName;
  return "Player";
}
let lanRooms = [];
let lanRoomRefreshTimer = null;
let localBombId = 0;
let localCouchMode = false;
let localFourPlayerLobbyActive = false;
let couchSlots = [];
let couchTouchKeys = new Set();
let couchPlayerTouchKeys = new Map();
let couchTouchPlayerId = null;
const couchCharacters = ["chiikawa", "hachiware", "usagi", "momonga"];
const couchControlSchemes = [
  { id: "couch_p1", label: "P1", up: ["w"], down: ["s"], left: ["a"], right: ["d"], bomb: [" "], punch: ["z"] },
  { id: "couch_p2", label: "P2", up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"], bomb: ["enter"], punch: ["shift"] },
  { id: "couch_p3", label: "P3", up: ["i"], down: ["k"], left: ["j"], right: ["l"], bomb: ["o"], punch: ["p"] },
  { id: "couch_p4", label: "P4", up: ["t"], down: ["g"], left: ["f"], right: ["h"], bomb: ["y"], punch: ["u"] },
];
const singlePlayerControlScheme = {
  up: ["w", "ArrowUp"],
  down: ["s", "ArrowDown"],
  left: ["a", "ArrowLeft"],
  right: ["d", "ArrowRight"],
};

// Tournament Overlay & Confetti Variables
let roundCountdownInterval = null;
let confettiActive = false;
let confettiParticles = [];
const confettiCanvas = document.getElementById("victoryConfettiCanvas");
const confettiCtx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
const yellowConsoleEl = document.querySelector(".yellow-console");

let startupFinished = false;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    })
  ]);
}

function showAppError(message, detail = "") {
  console.error(message, detail);
  let box = document.getElementById("appErrorBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "appErrorBox";
    box.className = "app-error-box";
    document.body.appendChild(box);
  }
  box.innerHTML = `
    <strong>${escapeHTML(message)}</strong>
    ${detail ? `<span>${escapeHTML(String(detail))}</span>` : ""}
  `;
}

function finishStartup() {
  startupFinished = true;
  if (studioSplashScreen) {
    studioSplashScreen.classList.remove("active");
    studioSplashScreen.style.display = "none";
  }
  restoreConnectionPreference();
}

// Custom Map & Voting States
let currentMapType = "classic";
let myLastVote = null;
let currentRoomMode = "standard";
let currentRoomIsChallenge = false;
let currentRoomMaxPlayers = 4;
let currentTeams = { A: [], B: [] };
let currentTeamTrophies = { A: 0, B: 0 };
let currentActiveRoundPlayers = [];
let finalVoteSecondsTotal = 20;
let finalVoteSelection = null;
let pendingLocalMapChoice = null;
let localMapVoteState = null;

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
// -------------------------------------------------
let isTabTransitioning = false;

tabButtons.forEach((btn) => {
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    if (isTabTransitioning) return;
    
    const tabName = btn.getAttribute("data-tab");
    if (btn.classList.contains("active")) return;
    
    isTabTransitioning = true;
    
    const overlay = document.getElementById("tabTransitionOverlay");
    if (overlay) {
      overlay.classList.add("animate-swipe");
    }
    
    setTimeout(() => {
      // Switch active classes on buttons
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Switch active classes on tab contents
      tabContents.forEach((content) => content.classList.remove("active"));
      const targetContent = document.getElementById(`tabContent_${tabName}`);
      if (targetContent) {
        targetContent.classList.add("active");
      }

      // Switch header title text content based on active section
      const consoleTitle = document.querySelector(".console-title");
      if (consoleTitle) {
        let displayTitle = "LOBBY";
        if (tabName === "play") displayTitle = "LOBBY";
        else if (tabName === "look") displayTitle = "WARDROBE";
        else if (tabName === "squad") displayTitle = "SQUAD";
        else if (tabName === "quests") displayTitle = "ERRANDS";
        else if (tabName === "shop") displayTitle = "SHOP";
        else if (tabName === "gear") displayTitle = "SETTINGS";
        consoleTitle.textContent = displayTitle;
      }

      if (typeof updateFooterColor === "function") {
        updateFooterColor(tabName);
      }

      if (tabName === "quests") {
        if (typeof syncQuestsUI === "function") syncQuestsUI();
        if (typeof syncLevelTabUI === "function") syncLevelTabUI();
      }
      
      // Toggle squad lobby styling on console
      const consoleEl = document.querySelector(".yellow-console");
      if (consoleEl) {
        if (tabName === "squad") {
          consoleEl.classList.add("squad-lobby-active");
          if (currentSocialUserId) updateMyPresenceStatus("in-lobby");
        } else {
          consoleEl.classList.remove("squad-lobby-active");
          if (currentSocialUserId) updateMyPresenceStatus("menu");
        }
        consoleEl.classList.toggle("character-select-active", tabName === "look");
      }
    }, 300);
    
    setTimeout(() => {
      if (overlay) {
        overlay.classList.remove("animate-swipe");
      }
      isTabTransitioning = false;
    }, 800);
    
    cancelMatchmaking();
  });
});

// Back button handler inside the squad lobby to switch back to play tab
const lobbyBackBtn = document.getElementById("lobbyBackBtn");
if (lobbyBackBtn) {
  lobbyBackBtn.addEventListener("click", () => {
    if (roomCode) {
      sendServerMessage("leave_room");
      localStorage.removeItem("chiikawaRoomCode");
      localStorage.removeItem("chiikawaPlayerId");
      localStorage.removeItem("chiikawaReconnectToken");
      roomCode = null;
      isCreatingRoom = false;
      talkingPlayers = {};
      updateAllMicIndicators();
      localPlayerId = null;
      reconnectToken = null;
      hostId = null;
      readyState = false;
      syncSquadLobbyInterface();
    }
    const playTabBtn = document.querySelector('.tab-btn[data-tab="play"]');
    if (playTabBtn) {
      playTabBtn.click();
    }
  });
}

document.querySelector(".select-back-btn")?.addEventListener("click", () => {
  document.querySelector('.tab-btn[data-tab="play"]')?.click();
});

// Server Selection Dialog triggers
const serverSelectionDialog = document.getElementById("serverSelectionDialog");
const btnOnlineServer = document.getElementById("btnOnlineServer");
const btnLocalServer = document.getElementById("btnLocalServer");
const closeServerSelectionBtn = document.getElementById("closeServerSelectionBtn");
const btnPlayOffline = document.getElementById("btnPlayOffline");

if (lobbyPlayBtn) {
  lobbyPlayBtn.addEventListener("click", () => {
    if (serverSelectionDialog) {
      serverSelectionDialog.classList.remove("hidden");
    }
  });
}

if (closeServerSelectionBtn) {
  closeServerSelectionBtn.addEventListener("click", () => {
    if (serverSelectionDialog) serverSelectionDialog.classList.add("hidden");
  });
}

if (serverSelectionDialog) {
  serverSelectionDialog.addEventListener("click", (e) => {
    if (e.target === serverSelectionDialog) {
      serverSelectionDialog.classList.add("hidden");
    }
  });
}

// Online Server Selection
btnOnlineServer?.addEventListener("click", () => {
  if (serverSelectionDialog) serverSelectionDialog.classList.add("hidden");
  serverMode = "online";
  
  // If not logged in and Supabase exists, go to login Screen
  if (supabaseClient) {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user) {
        connectWebSocket(true);
        const squadTabBtn = document.querySelector('.tab-btn[data-tab="squad"]');
        if (squadTabBtn) squadTabBtn.click();
      } else {
        switchScreen(loginScreen);
      }
    }).catch(() => {
      switchScreen(loginScreen);
    });
  } else {
    connectWebSocket(true);
    const squadTabBtn = document.querySelector('.tab-btn[data-tab="squad"]');
    if (squadTabBtn) squadTabBtn.click();
  }
});

// Local Server Selection
btnLocalServer?.addEventListener("click", () => {
  if (serverSelectionDialog) serverSelectionDialog.classList.add("hidden");
  serverMode = "local";
  
  const savedLocalName = localStorage.getItem("local_username");
  if (!savedLocalName || savedLocalName === "Friend") {
    // Show account/username creation screen
    pendingLocalConnect = true;
    startUsernameIntroFlow();
  } else {
    // We already have a nickname! Connect directly
    if (usernameInput) usernameInput.value = savedLocalName;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = savedLocalName;
    connectWebSocket(true);
    const squadTabBtn = document.querySelector('.tab-btn[data-tab="squad"]');
    if (squadTabBtn) squadTabBtn.click();
  }
});

// Play Offline / Bypass Login Screen Button
btnPlayOffline?.addEventListener("click", () => {
  const localPlaySetupDialog = document.getElementById("localPlaySetupDialog");
  resetLobbyMapSelectToNormal();
  if (localPlaySetupDialog) {
    const localNicknameInput = document.getElementById("localNicknameInput");
    if (localNicknameInput) {
      localNicknameInput.value = localStorage.getItem("local_username") || "Friend";
    }
    localPlaySetupDialog.classList.remove("hidden");
  } else {
    serverMode = "local";
    const savedLocalName = localStorage.getItem("local_username");
    if (savedLocalName) {
      if (usernameInput) usernameInput.value = savedLocalName;
      if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = savedLocalName;
    }
    switchScreen(menuScreen);
    tryPlayMusic();
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

function playMutedLoop(video) {
  if (!video) return;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.play().catch(() => {});
}

document.querySelectorAll(".character-card video").forEach((video) => {
  video.addEventListener("loadeddata", () => playMutedLoop(video), { once: true });
  playMutedLoop(video);
});

function syncCharacterSelectPreview(kind) {
  const bombSelectPreviewImg = document.getElementById("bombSelectPreviewImg");
  const characterSelectCanvas = document.getElementById("characterSelectCanvas");
  if (bombSelectPreviewImg && characterSelectCanvas) {
    characterSelectCanvas.style.display = "block";
    bombSelectPreviewImg.style.display = "none";
  }

  if (characterSelectName) {
    characterSelectName.textContent = characterStyle[kind]?.label || kind;
  }
  if (characterSelectState) {
    characterSelectState.textContent = kind === selectedCharacter ? "Selected" : "Ready to select";
  }

  if (characterSelectVideo && characterSelectVideos[kind]) {
    const targetSrc = getVideoSrc(characterSelectVideos[kind], true); // Force high quality for wardrobe
    if (!characterSelectVideo.src.endsWith(targetSrc)) {
      characterSelectVideo.src = targetSrc;
      characterSelectVideo.load();
    }
    playMutedLoop(characterSelectVideo);
  }

  // Dynamic premium background theme changes for Look / Wardrobe tab
  const selectScreenEl = document.querySelector(".character-select-screen");
  if (selectScreenEl) {
    let swirlColor = "#15131b"; // Match lobby background swirly color
    let darkColor = "#0b0a0e";  // Match lobby background dark color
    let glowColor = "rgba(255, 255, 255, 0.1)";
    
    if (kind === "chiikawa") {
      glowColor = "rgba(255, 138, 177, 0.32)";
    } else if (kind === "hachiware") {
      glowColor = "rgba(128, 178, 201, 0.35)";
    } else if (kind === "usagi") {
      glowColor = "rgba(255, 157, 87, 0.35)";
    } else if (kind === "momonga") {
      glowColor = "rgba(185, 222, 242, 0.32)";
    }
    
    selectScreenEl.style.setProperty("--char-swirl", swirlColor);
    selectScreenEl.style.setProperty("--char-dark", darkColor);
    selectScreenEl.style.setProperty("--char-glow", glowColor);
  }
}

function syncLobbySpotlightVideo(kind) {
  if (!spotlightVideo || !characterSelectVideos[kind]) return;
  const targetSrc = getVideoSrc(characterSelectVideos[kind]);
  if (!spotlightVideo.src.endsWith(targetSrc)) {
    spotlightVideo.src = targetSrc;
    spotlightVideo.load();
  }
  playMutedLoop(spotlightVideo);
}

function syncSquadLobbyVideo(kind) {
  if (!squadLobbyVideo || !characterSelectVideos[kind]) return;
  const targetSrc = getVideoSrc(characterSelectVideos[kind]);
  if (!squadLobbyVideo.src.endsWith(targetSrc)) {
    squadLobbyVideo.src = targetSrc;
    squadLobbyVideo.load();
  }
  playMutedLoop(squadLobbyVideo);
}

function confirmCharacterSelection() {
  const mode = selectCardGrid ? selectCardGrid.dataset.mode : "characters";
  if (mode === "bombs") {
    const equippedBomb = previewBombColor || "default";
    localStorage.setItem("equipped_bomb", equippedBomb);
    syncBombWardrobe();
    syncBombSelectPreview(equippedBomb);
    showToastMsg(`Equipped ${equippedBomb.toUpperCase()} bomb skin!`);
    return;
  }
  if (mode === "effects") {
    const equippedEffect = previewEffectColor || "default";
    localStorage.setItem("equipped_effect", equippedEffect);
    syncEffectWardrobe();
    syncEffectSelectPreview(equippedEffect);
    showToastMsg(`Equipped ${equippedEffect.toUpperCase()} explosion effect!`);
    return;
  }

  selectedCharacter = previewCharacter;
  syncCharacterSelectPreview(selectedCharacter);
  syncLobbySpotlightVideo(selectedCharacter);
  syncSquadLobbyVideo(selectedCharacter);
  syncSquadLobbyInterface();
  if (socket && socket.readyState === WebSocket.OPEN) {
    sendServerMessage("select_character", { kind: selectedCharacter });
  }
  updateProgressionUI();
}

playMutedLoop(characterSelectVideo);
syncCharacterSelectPreview(selectedCharacter);
syncLobbySpotlightVideo(selectedCharacter);
syncSquadLobbyVideo(selectedCharacter);
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
    
    // Hide/show the appropriate preview slots
    const characterSelectCanvas = document.getElementById("characterSelectCanvas");
    const bombSelectPreviewImg = document.getElementById("bombSelectPreviewImg");
    const effectSelectPreviewContainer = document.getElementById("effectSelectPreviewContainer");
    
    if (mode === "bombs") {
      if (characterSelectCanvas) characterSelectCanvas.style.display = "none";
      if (effectSelectPreviewContainer) effectSelectPreviewContainer.style.display = "none";
      if (bombSelectPreviewImg) bombSelectPreviewImg.style.display = "block";
      
      previewBombColor = localStorage.getItem("equipped_bomb") || "default";
      if (typeof syncBombWardrobe === "function") syncBombWardrobe();
      if (typeof syncBombSelectPreview === "function") syncBombSelectPreview(previewBombColor);
    } else if (mode === "effects") {
      if (characterSelectCanvas) characterSelectCanvas.style.display = "none";
      if (bombSelectPreviewImg) bombSelectPreviewImg.style.display = "none";
      if (effectSelectPreviewContainer) effectSelectPreviewContainer.style.display = "flex";
      
      previewEffectColor = localStorage.getItem("equipped_effect") || "default";
      if (typeof syncEffectWardrobe === "function") syncEffectWardrobe();
      if (typeof syncEffectSelectPreview === "function") syncEffectSelectPreview(previewEffectColor);
    } else {
      // characters or clothes
      if (bombSelectPreviewImg) bombSelectPreviewImg.style.display = "none";
      if (effectSelectPreviewContainer) effectSelectPreviewContainer.style.display = "none";
      if (characterSelectCanvas) characterSelectCanvas.style.display = "block";
      
      if (mode === "characters") {
        if (typeof syncCharacterSelectPreview === "function") syncCharacterSelectPreview(previewCharacter);
      }
    }
  });
});


// ----------------------------------------------------------------
// NETWORK SOCKET HANDLING (WITH SAFE FILE:// FALLBACKS)
// ----------------------------------------------------------------

// CONFIGURATION: Set this to your deployed Render WebSocket URL (e.g., "wss://chiikawa-royale.onrender.com")
// if you choose to host the frontend separately on Vercel. Leave it as null if hosting together on Render.
const BACKEND_WS_URL = null;

function isLanLikeHostname(hostname = window.location.hostname) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$)/i.test(hostname || "");
}

if (window.location.protocol === "http:" && isLanLikeHostname()) {
  serverMode = "local";
}

function normalizeWebSocketTarget(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  let cleaned = raw.replace(/^https?:\/\//i, "").replace(/^wss?:\/\//i, "").replace(/\/.*$/, "");
  if (!cleaned.includes(":")) cleaned += ":3000";
  return cleaned;
}

function promptForLocalServerAddress() {
  const saved = localStorage.getItem("local_server_ip") || "";
  const defaultHost = saved || "192.168.1.50:3000";
  const targetIP = prompt("Enter the LAN server IP on your Wi-Fi (example: 192.168.1.50:3000):", defaultHost);
  const normalized = normalizeWebSocketTarget(targetIP);
  if (normalized) localStorage.setItem("local_server_ip", normalized);
  return normalized;
}

function connectWebSocket(forceReconnect = false) {
  if (socket) {
    if (forceReconnect) {
      try { socket.close(); } catch(e) {}
      socket = null;
    } else if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      return;
    }
  }

  let wsUrl;
  if (serverMode === "local") {
    const isLocalPageHost = isLanLikeHostname(window.location.hostname);
    if (window.location.protocol === "file:" || !isLocalPageHost) {
      const targetIP = promptForLocalServerAddress();
      if (targetIP) {
        if (window.location.protocol === "https:") {
          const redirectUrl = `http://${targetIP}`;
          const msg = `Secure websites (HTTPS) block local network connections.\n\nYou must play via an insecure HTTP connection. Would you like to redirect to:\n${redirectUrl} ?\n\nIf the page does not open automatically, copy this URL and paste it into your browser.`;
          if (confirm(msg)) {
            window.location.href = redirectUrl;
          }
          return;
        }
        wsUrl = `ws://${targetIP}`;
      } else {
        return;
      }
    } else {
      wsUrl = `ws://${window.location.host}`;
    }
  } else {
    wsUrl = BACKEND_WS_URL || "wss://chiikawa-royale.onrender.com";
  }

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
        connectionStatusIndicator.textContent = serverMode === "local" ? "LAN" : "Online";
        connectionStatusIndicator.className = "connection-status online";
      }
      if (serverMode === "local") {
        startLanRoomRefresh();
      }
      const savedRoomCode = localStorage.getItem("chiikawaRoomCode");
      const savedPlayerId = localStorage.getItem("chiikawaPlayerId");
      const savedToken = localStorage.getItem("chiikawaReconnectToken");
      if (serverMode !== "local" && savedRoomCode && savedPlayerId && savedToken) {
        sendServerMessage("reconnect_player", {
          roomCode: savedRoomCode,
          playerId: savedPlayerId,
          reconnectToken: savedToken,
        });
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error("Error handling server message:", err);
        reportAppError("Server Message Error", err.message, { source: "websocket", stack: err.stack });
      }
    };

    socket.onclose = (event) => {
      console.log("WebSocket disconnected.");
      isCreatingRoom = false;
      talkingPlayers = {};
      updateAllMicIndicators();
      stopLanRoomRefresh();
      if (isMicActive) {
        stopMicCapture();
      }
      if (connectionStatusIndicator) {
        connectionStatusIndicator.textContent = "Offline";
        connectionStatusIndicator.className = "connection-status offline";
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      isCreatingRoom = false;
      talkingPlayers = {};
      updateAllMicIndicators();
      if (isMicActive) {
        stopMicCapture();
      }
      const msg = serverMode === "local"
        ? "LAN connection failed. Make sure the local server is running, both devices are on the same Wi-Fi, and the IP/port is correct."
        : "WebSocket connection failed. The online server may be offline or blocked.";
      showToastMsg(msg, 5000);
    };
  } catch (e) {
    console.error("Failed to establish WebSocket connection:", e);
    reportAppError("Connection Error", e.message, { source: "websocket", stack: e.stack });
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

function requestLanRooms() {
  if (serverMode === "local" && socket && socket.readyState === WebSocket.OPEN) {
    sendServerMessage("list_rooms");
  }
}

function startLanRoomRefresh() {
  requestLanRooms();
  if (lanRoomRefreshTimer) clearInterval(lanRoomRefreshTimer);
  lanRoomRefreshTimer = setInterval(requestLanRooms, 2500);
}

function stopLanRoomRefresh() {
  if (lanRoomRefreshTimer) {
    clearInterval(lanRoomRefreshTimer);
    lanRoomRefreshTimer = null;
  }
}

function reportAppError(title, message, options = {}) {
  if (window.ChiikawaErrorUI && typeof window.ChiikawaErrorUI.report === "function") {
    window.ChiikawaErrorUI.report(title, message, options);
  } else {
    console.error(title, message, options);
  }
}

function handleServerMessage(msg) {
  const { type, data } = msg;

  switch (type) {
    case "error":
      isCreatingRoom = false;
      talkingPlayers = {};
      updateAllMicIndicators();
      reportAppError("Server Error", data.message || "Unknown server error", { source: "server" });
      break;

    case "reconnect_failed":
      localStorage.removeItem("chiikawaRoomCode");
      localStorage.removeItem("chiikawaPlayerId");
      localStorage.removeItem("chiikawaReconnectToken");
      reconnectToken = null;
      isCreatingRoom = false;
      talkingPlayers = {};
      updateAllMicIndicators();
      break;

    case "lan_rooms_updated":
      lanRooms = data.rooms || [];
      if (serverMode === "local") renderLanRoomsTab();
      break;

    case "room_joined":
      isCreatingRoom = false;
      talkingPlayers = {};
      updateAllMicIndicators();
      roomCode = data.roomCode;
      localPlayerId = data.playerId;
      reconnectToken = data.reconnectToken || reconnectToken;
      if (roomCode && localPlayerId && reconnectToken) {
        localStorage.setItem("chiikawaRoomCode", roomCode);
        localStorage.setItem("chiikawaPlayerId", localPlayerId);
        localStorage.setItem("chiikawaReconnectToken", reconnectToken);
      }
      localMode = false;
      
      // Close matchmaking dialog
      matchmakingDialog?.classList.add("hidden");
      
      switchScreen(menuScreen);
      if (!isOnlineMatchmakingActive) {
        document.querySelector('.tab-btn[data-tab="squad"]')?.click();
      }
      refreshSocialData();
      
      if (lobbyRoomCode) lobbyRoomCode.textContent = roomCode;
      if (gameRoomCode) gameRoomCode.textContent = roomCode;
      if (chatMessages) chatMessages.innerHTML = ""; // Clear chat
      addChatMessage("System", `Joined Room ${roomCode}!`, true);
      if (serverMode === "local") {
        showToastMsg(`LAN room <strong>${escapeHTML(roomCode)}</strong> ready. Same-WiFi players can join with this code.`);
      }

      // Auto-send pending room invite if we just created this room
      if (pendingInviteUserId) {
        const targetId = pendingInviteUserId;
        const targetName = pendingInviteUsername;
        pendingInviteUserId = null;
        pendingInviteUsername = null;
        
        const sendInviteOnPresenceChannel = () => {
          if (presenceChannel) {
            presenceChannel.send({
              type: "broadcast",
              event: "room_invite",
              payload: { targetId, fromId: currentSocialUserId, fromName: currentSocialUsername, roomCode }
            });
            showToastMsg(`Invite sent to ${targetName}! 📨`);
          } else {
            setTimeout(sendInviteOnPresenceChannel, 500);
          }
        };
        setTimeout(sendInviteOnPresenceChannel, 300);
      }
      
      readyState = false;
      if (readyBtn) {
        readyBtn.textContent = "Ready Up!";
        readyBtn.classList.remove("btn-primary");
        readyBtn.classList.add("btn-accent");
      }

      if (playerUuidLabel) {
        playerUuidLabel.textContent = localPlayerId;
      }
      break;

    case "lobby_updated":
      hostId = data.hostId;
      players = data.players;
      // Store team info globally
      if (data.mode) currentRoomMode = data.mode;
      if (data.teams) currentTeams = data.teams;
      if (data.teamTrophies) currentTeamTrophies = data.teamTrophies;
      if (data.isChallenge !== undefined) currentRoomIsChallenge = data.isChallenge;
      if (data.maxPlayers !== undefined) currentRoomMaxPlayers = data.maxPlayers;
      updateLobbyUI();

      if (isBattleRoyale(currentRoomMode) && brmActive) {
        const pCount = document.getElementById("brmPlayerCount");
        if (pCount) pCount.textContent = players.length;
        
        const brmStartBtn = document.getElementById("brmStartBtn");
        if (brmStartBtn) {
          const isHost = localPlayerId === hostId;
          if (serverMode === "local" && isHost) {
            brmStartBtn.style.display = "block";
          } else {
            brmStartBtn.style.display = "none";
          }
        }
      }

      if (socket && socket.readyState === WebSocket.OPEN) {
        if (isOnlineMatchmakingActive && data.state === "lobby") {
          if (isBattleRoyale(currentRoomMode)) {
            // Already handled by showBRMatchmakingScreen
          } else {
            showOnlineMatchmakingSearch();
            startOnlineMatchmakingTimer();
            updateOnlineMatchmakingPopup();
          }
        } else if (!data.isPrivate && data.state === "lobby") {
          if (isBattleRoyale(currentRoomMode)) {
            // Already handled by showBRMatchmakingScreen
          } else {
            startOnlineMatchmakingTimer();
            updateOnlineMatchmakingPopup();
          }
        } else {
          stopOnlineMatchmakingTimer();
          if (matchmakingPopup) {
            matchmakingPopup.classList.remove("active");
            matchmakingPopup.classList.add("hidden");
          }
        }
      }
      break;
    case "map_voting_started": {
      stopOnlineMatchmakingTimer();
      if (matchmakingPopup) {
        matchmakingPopup.classList.remove("active");
        matchmakingPopup.classList.add("hidden");
      }
      
      const mapVoteOverlay = document.getElementById("mapVoteOverlay");
      if (mapVoteOverlay) {
        mapVoteOverlay.classList.remove("hidden");
        mapVoteOverlay.classList.add("active");
      }
      
      const timerEl = document.getElementById("mapVoteTimer");
      if (timerEl) timerEl.textContent = data.timer;
      
      document.querySelectorAll(".map-vote-card").forEach(c => {
        c.classList.remove("voted", "winning-map");
        const countEl = c.querySelector(".map-vote-count");
        if (countEl) countEl.textContent = "0";
        const votersEl = c.querySelector(".map-vote-voters");
        if (votersEl) votersEl.innerHTML = "";
      });
      break;
    }

    case "map_vote_timer_update": {
      const timerEl = document.getElementById("mapVoteTimer");
      if (timerEl) timerEl.textContent = data.timer;
      break;
    }

    case "map_votes_updated": {
      const { votes, voterMap } = data;
      for (const [mapType, count] of Object.entries(votes)) {
        const countEl = document.getElementById(`mapVoteCount_${mapType}`);
        if (countEl) countEl.textContent = count;
        
        const votersEl = document.getElementById(`mapVoteVoters_${mapType}`);
        if (votersEl) {
          votersEl.innerHTML = "";
          if (voterMap) {
            Object.entries(voterMap).forEach(([voterId, chosenMap]) => {
              if (chosenMap === mapType) {
                const voter = players.find(p => p.id === voterId);
                if (voter) {
                  const img = document.createElement("img");
                  img.src = `assets/cards/${voter.kind}.png`;
                  img.style.width = "24px";
                  img.style.height = "24px";
                  img.style.borderRadius = "50%";
                  img.style.border = "2px solid var(--ink)";
                  img.style.boxShadow = "1px 1px 0 var(--ink)";
                  img.title = voter.name;
                  votersEl.appendChild(img);
                }
              }
            });
          }
        }
      }
      
      if (voterMap && voterMap[localPlayerId]) {
        const myVote = voterMap[localPlayerId];
        document.querySelectorAll(".map-vote-card").forEach(c => {
          if (c.getAttribute("data-map") === myVote) {
            c.classList.add("voted");
          } else {
            c.classList.remove("voted");
          }
        });
      }
      break;
    }

    case "map_voting_ended": {
      const winningMap = data.winningMap;
      document.querySelectorAll(".map-vote-card").forEach(c => {
        if (c.getAttribute("data-map") === winningMap) {
          c.classList.add("winning-map");
        } else {
          c.classList.remove("winning-map");
        }
      });
      
      setTimeout(() => {
        const mapVoteOverlay = document.getElementById("mapVoteOverlay");
        if (mapVoteOverlay) {
          mapVoteOverlay.classList.remove("active");
          mapVoteOverlay.classList.add("hidden");
        }
      }, 2500);
      break;
    }

    case "challenge_received": {
      const challengerName = data.challengerName;
      const chCode = data.roomCode;
      const chMode = data.mode;
      
      const inviteOverlay = document.getElementById("roomInviteOverlay");
      const titleEl = document.getElementById("inviteOverlayTitle");
      const textEl = document.getElementById("inviteOverlayText");
      const acceptBtn = document.getElementById("inviteOverlayAccept");
      const declineBtn = document.getElementById("inviteOverlayDecline");
      
      if (inviteOverlay && titleEl && textEl && acceptBtn && declineBtn) {
        titleEl.textContent = "BATTLE CHALLENGE!";
        textEl.innerHTML = `<strong>${escapeHTML(challengerName)}</strong> has challenged you to a <strong>${chMode.toUpperCase()}</strong> match!`;
        
        const newAccept = acceptBtn.cloneNode(true);
        const newDecline = declineBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);
        declineBtn.parentNode.replaceChild(newDecline, declineBtn);
        
        newAccept.addEventListener("click", () => {
          inviteOverlay.classList.remove("active");
          inviteOverlay.classList.add("hidden");
          const name = usernameInput?.value.trim() || currentSocialUsername || "Friend";
          sendServerMessage("join_room", { name, kind: selectedCharacter, roomCode: chCode });
        });
        
        newDecline.addEventListener("click", () => {
          inviteOverlay.classList.remove("active");
          inviteOverlay.classList.add("hidden");
        });
        
        inviteOverlay.classList.remove("hidden");
        inviteOverlay.classList.add("active");
      }
      break;
    }

    case "game_started":
      if (shouldShowVsBeforeGameStart(data)) {
        showServerVsThenStart(data);
        break;
      }
      if (isMicActive) {
        stopMicCapture();
      }
      map = data.map;
      currentMapType = data.mapType || "classic";
      // Store team mode info
      if (data.mode) currentRoomMode = data.mode;
      if (data.teams) currentTeams = data.teams;
      if (data.teamTrophies) currentTeamTrophies = data.teamTrophies;
      if (data.activeRoundPlayers) currentActiveRoundPlayers = data.activeRoundPlayers;
      players = data.players.map((p) => ({
        ...p,
        targetX: p.x,
        targetY: p.y,
        invuln: p.id === localPlayerId && p.alive ? 1.0 : 0,
        emote: null,
        emoteTimer: 0,
        radius: 13,
      }));

      bombs = (data.bombs || []).map((bomb) => {
        const color = (bomb.ownerId === localPlayerId)
          ? (localStorage.getItem("equipped_bomb") || "default")
          : (bomb.color || "default");
        const effectColor = (bomb.ownerId === localPlayerId)
          ? (localStorage.getItem("equipped_effect") || "default")
          : (bomb.effectColor || "default");
        return {
          ...bomb,
          pulse: 0,
          passableFor: new Set(players.map((p) => p.id)),
          color: color,
          effectColor: effectColor
        };
      });
      blasts = [];
      pickups = data.pickups || [];
      particles = [];
      roundTime = typeof data.roundTime === "number" ? data.roundTime : roundTime;
      running = true;
      startCountdownTimer = 3.5;
      startCountdownState = "3";
      isOnlineMatchmakingActive = false;
      shakeTimer = 0;
      gameMessage = "";

      // Hide all overlays
      hideBRMatchmaking();
      document.getElementById("tournamentOverlay").classList.add("hidden");
      document.getElementById("finalVoteOverlay").classList.add("hidden");
      if (matchmakingPopup) {
        matchmakingPopup.classList.remove("active");
        matchmakingPopup.classList.add("hidden");
      }
      stopOnlineMatchmakingTimer();
      stopConfetti();
      const startVideo = document.getElementById("victoryVideo");
      if (startVideo) startVideo.pause();
      if (roundCountdownInterval) {
        clearInterval(roundCountdownInterval);
        roundCountdownInterval = null;
      }

      // Show round header in team mode
      if (isTeamMode(currentRoomMode) && currentActiveRoundPlayers.length >= 2) {
        const teamANames = currentActiveRoundPlayers
          .filter(id => (currentTeams?.A || []).includes(id))
          .map(id => players.find(p => p.id === id)?.name)
          .filter(Boolean)
          .join(" + ");
        const teamBNames = currentActiveRoundPlayers
          .filter(id => (currentTeams?.B || []).includes(id))
          .map(id => players.find(p => p.id === id)?.name)
          .filter(Boolean)
          .join(" + ");
        stateEl.textContent = teamANames && teamBNames ? `${teamANames} vs ${teamBNames}` : "Team Battle!";
        setTimeout(() => { if (running) stateEl.textContent = "Battle!"; }, 3000);
      } else {
        stateEl.textContent = "Battle!";
      }

      switchScreen(gameScreen);
      updateHudSidebar();
      break;

    case "state_update":
      roundTime = data.roundTime;
      if (Array.isArray(data.map)) {
        map = data.map;
      }
      // Filter out players who surrendered or left the room
      players = players.filter((p) => data.players.some((sp) => sp.id === p.id));

      data.players.forEach((serverPlayer) => {
        const localP = players.find((p) => p.id === serverPlayer.id);
        if (localP) {
          localP.alive = serverPlayer.alive;
          localP.speed = serverPlayer.speed;
          localP.bombs = serverPlayer.bombs;
          localP.range = serverPlayer.range;
          localP.hasPunch = !!serverPlayer.hasPunch;
          localP.hasSlide = !!serverPlayer.hasSlide;
          // Sync Battle Royale stats
          localP.hp = serverPlayer.hp;
          localP.shield = serverPlayer.shield;
          localP.knocked = !!serverPlayer.knocked;
          localP.bandageCount = serverPlayer.bandageCount || 0;
          localP.medkitCount = serverPlayer.medkitCount || 0;
          localP.energyDrinkCount = serverPlayer.energyDrinkCount || 0;
          localP.reviveKitCount = serverPlayer.reviveKitCount || 0;
          localP.reviveProgress = serverPlayer.reviveProgress || 0;
          localP.kills = serverPlayer.kills || 0;
          localP.damageDealt = serverPlayer.damageDealt || 0;

          if (serverPlayer.id !== localPlayerId) {
            localP.targetX = serverPlayer.x;
            localP.targetY = serverPlayer.y;
            localP.dx = serverPlayer.dx;
            localP.dy = serverPlayer.dy;
          } else {
            // Check desync with adaptive thresholds to prevent high-latency rubberbanding
            const dist = Math.hypot(localP.x - serverPlayer.x, localP.y - serverPlayer.y);
            const isMoving = (localP.dx !== 0 || localP.dy !== 0) || (serverPlayer.dx !== 0 || serverPlayer.dy !== 0);
            const threshold = isMoving ? 240 : 48; // Large threshold (5 tiles) when moving due to ping delay, small (1 tile) when stopped
            if (dist > threshold) {
              localP.x = serverPlayer.x;
              localP.y = serverPlayer.y;
              localP.moveTarget = null;
              localP.moveFrom = null;
              localP.moveDir = null;
              localP.dx = 0;
              localP.dy = 0;
            }
          }
        }
      });
      updateHudSidebar();
      break;

    case "bomb_placed":
      const placedColor = (data.bomb.ownerId === localPlayerId)
        ? (localStorage.getItem("equipped_bomb") || "default")
        : (data.bomb.color || "default");
      const placedEffectColor = (data.bomb.ownerId === localPlayerId)
        ? (localStorage.getItem("equipped_effect") || "default")
        : (data.bomb.effectColor || "default");
      bombs.push({
        id: data.bomb.id,
        x: data.bomb.x,
        y: data.bomb.y,
        ownerId: data.bomb.ownerId,
        range: data.bomb.range,
        timer: data.bomb.timer,
        pulse: 0,
        passableFor: new Set(players.map((p) => p.id)),
        color: placedColor,
        effectColor: placedEffectColor
      });
      break;

    case "bomb_exploded":
      const explBomb = bombs.find((b) => b.id === data.bombId);
      const explColor = explBomb ? (explBomb.effectColor || "default") : "default";
      bombs = bombs.filter((b) => b.id !== data.bombId);
      blasts.push({
        cells: data.cells,
        timer: 0.48,
        age: 0,
        color: explColor,
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

      // In BR mode only shake for MY own bomb; in classic mode always shake
      if (!isBattleRoyale(currentRoomMode) || data.ownerId === localPlayerId) {
        shakeTimer = 0.35;
      }
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
        collector.hasPunch = !!data.playerStats.hasPunch;
        collector.hasSlide = !!data.playerStats.hasSlide;
        // Sync item counts on pickup collected
        collector.hp = data.playerStats.hp;
        collector.shield = data.playerStats.shield;
        collector.bandageCount = data.playerStats.bandageCount || 0;
        collector.medkitCount = data.playerStats.medkitCount || 0;
        collector.energyDrinkCount = data.playerStats.energyDrinkCount || 0;
        collector.reviveKitCount = data.playerStats.reviveKitCount || 0;
        collector.activeBombType = data.playerStats.activeBombType || "normal";

        if (data.playerId === localPlayerId) {
          let collected = parseInt(localStorage.getItem("quest_pickups_progress") || "0");
          localStorage.setItem("quest_pickups_progress", Math.min(3, collected + 1).toString());
          
          let lifetimePickups = parseInt(localStorage.getItem("lifetime_pickups_collected") || "0");
          localStorage.setItem("lifetime_pickups_collected", (lifetimePickups + 1).toString());
        }

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

      // Update team trophies if present
      if (data.teamTrophies) currentTeamTrophies = data.teamTrophies;
      if (data.teams) currentTeams = data.teams;

      // Progress daily match quest
      localStorage.setItem("quest_match_completed", "true");

      // Give progression rewards
      const isWinner = data.winnerId === localPlayerId;
      if (isWinner) {
        // Progress weekly win quest
        let wins = parseInt(localStorage.getItem("quest_win3_progress") || "0");
        localStorage.setItem("quest_win3_progress", Math.min(3, wins + 1).toString());
        totalWins += 1; // Increment totalWins for online victory

        if (data.tournamentFinished) {
          crownCount += 2; gemsCount += 5;
          addChatMessage("System", "TOURNAMENT VICTORY! You earned 5 gems and 2 crowns! 👑🏆", true);
        } else {
          crownCount += 1; gemsCount += 5;
          addChatMessage("System", "ROUND VICTORY! You earned 5 gems and 1 crown! 👑", true);
        }
      } else {
        if (data.tournamentFinished) {
          addChatMessage("System", "Tournament Finished! 🏆", true);
        } else {
          addChatMessage("System", "Round Finished! 🏁", true);
        }
      }
      document.getElementById("crownCount").textContent = crownCount;
      document.getElementById("gemsCount").textContent = gemsCount;
      saveProgression();

      // Show team score banner in round results
      if (isTeamMode(currentRoomMode) && data.teamTrophies) {
        const banner = document.getElementById("teamScoreBanner");
        if (banner) {
          banner.classList.remove("hidden");
          document.getElementById("teamScoreA").textContent = data.teamTrophies.A || 0;
          document.getElementById("teamScoreB").textContent = data.teamTrophies.B || 0;
        }
      }

      showTournamentResults(data.players, data.winnerId, data.tournamentFinished);
      break;
    }

    case "pre_match_started": {
      const countdown = data.countdown;
      readyState = false;
      
      const logoEl = document.querySelector(".brm-logo");
      if (logoEl) {
        logoEl.textContent = "PRE MATCH";
        logoEl.style.color = "#ffffff";
      }
      const badge = document.getElementById("brmModeBadge");
      if (badge) badge.style.display = "none";

      const pCountEl = document.querySelector(".brm-player-count");
      if (pCountEl) pCountEl.textContent = "Starting";

      const countdownBox = document.getElementById("brmCountdown");
      if (countdownBox) {
        countdownBox.classList.remove("hidden");
        countdownBox.innerHTML = `Starting in <strong id="brmCountdownNum">${countdown}</strong>`;
      }
      
      const stateEl = document.getElementById("roundState");
      if (stateEl) stateEl.textContent = `PRE-MATCH: ${countdown}s`;
      showToastMsg("Match filled! Pre-match countdown started.");
      break;
    }

    case "pre_match_countdown": {
      const countdown = data.countdown;
      const countdownBox = document.getElementById("brmCountdown");
      if (countdownBox) {
        countdownBox.classList.remove("hidden");
        countdownBox.innerHTML = `Starting in <strong id="brmCountdownNum">${countdown}</strong>`;
      }
      const stateEl = document.getElementById("roundState");
      if (stateEl) stateEl.textContent = `PRE-MATCH: ${countdown}s`;
      break;
    }

    case "voice_chat_audio": {
      if (data.playerId !== localPlayerId) {
        const vol = playerVolumeSettings[data.playerId] !== undefined ? playerVolumeSettings[data.playerId] : 1.0;
        const isMuted = !!playerMutedSettings[data.playerId];
        if (!isMuted) {
          playRawPCMAudio(data.playerId, data.audio, data.sampleRate || 16000, vol);
        }

        if (talkingTimeouts[data.playerId]) clearTimeout(talkingTimeouts[data.playerId]);
        talkingPlayers[data.playerId] = true;
        updateAllMicIndicators();
        talkingTimeouts[data.playerId] = setTimeout(() => {
          delete talkingPlayers[data.playerId];
          updateAllMicIndicators();
        }, 1000);
      }
      break;
    }

    case "healing_started": {
      const { playerId, itemType, duration } = data;
      const p = players.find(p => p.id === playerId);
      if (p) {
        p.healingState = { itemType, duration, timeLeft: duration };
      }
      if (playerId === localPlayerId) {
        localHealingState = { itemType, duration, timeLeft: duration };
        showBRProgressBar("Using " + (itemType === "bandage" ? "Bandage..." : "Med Kit..."), duration);
      }
      break;
    }

    case "healing_cancelled": {
      const { playerId } = data;
      const p = players.find(p => p.id === playerId);
      if (p) p.healingState = null;
      if (playerId === localPlayerId) {
        localHealingState = null;
        hideBRProgressBar();
        showToastMsg("Healing Cancelled!");
      }
      break;
    }

    case "player_healed": {
      const { playerId, hp } = data;
      const p = players.find(p => p.id === playerId);
      if (p) {
        p.hp = hp;
        p.healingState = null;
        if (data.bandageCount !== undefined) p.bandageCount = data.bandageCount;
        if (data.medkitCount !== undefined) p.medkitCount = data.medkitCount;
      }
      if (playerId === localPlayerId) {
        localHealingState = null;
        hideBRProgressBar();
        showToastMsg("Healed! HP: " + hp);
      }
      break;
    }

    case "item_used": {
      const { playerId, itemType } = data;
      const p = players.find(p => p.id === playerId);
      if (p) {
        p.healingState = null;
        if (itemType === "energy_drink") {
          if (data.shield !== undefined) p.shield = data.shield;
          if (data.energyDrinkCount !== undefined) p.energyDrinkCount = data.energyDrinkCount;
          showToastMsg(p.name + " used an Energy Drink! 🥤");
        }
      }
      break;
    }

    case "revive_progress": {
      const { playerId, progress } = data;
      const targetPlayer = players.find(p => p.id === playerId);
      if (targetPlayer) {
        targetPlayer.reviveProgress = progress;
      }
      
      const localPlayer = players.find(p => p.id === localPlayerId);
      if (localPlayer) {
        if (playerId === localPlayerId) {
          showBRProgressBar("Being Revived...", 5.0, progress * 5.0);
        } else if (localPlayer.teamId && targetPlayer && targetPlayer.teamId === localPlayer.teamId) {
          const dist = Math.hypot(localPlayer.x - targetPlayer.x, localPlayer.y - targetPlayer.y);
          if (dist < 48 && progress > 0) {
            showBRProgressBar("Reviving Teammate...", 5.0, progress * 5.0);
          } else if (progress === 0) {
            hideBRProgressBar();
          }
        }
      }
      break;
    }

    case "player_revived": {
      const { playerId } = data;
      const p = players.find(p => p.id === playerId);
      if (p) {
        p.knocked = false;
        p.hp = 30;
        p.reviveProgress = 0;
      }
      if (playerId === localPlayerId) {
        hideBRProgressBar();
      }
      showToastMsg(data.text || "Player revived!");
      break;
    }

    case "player_knocked": {
      const { playerId } = data;
      const p = players.find(p => p.id === playerId);
      if (p) {
        p.knocked = true;
        p.hp = 100;
      }
      showToastMsg(data.text || "Player knocked down!");
      break;
    }

    case "player_damaged": {
      const { playerId, hp, shield } = data;
      const p = players.find(p => p.id === playerId);
      if (p) {
        p.hp = hp;
        p.shield = shield;
      }
      break;
    }

    case "location_pinged": {
      const { playerId, x, y, pingType } = data;
      const localPlayer = players.find(p => p.id === localPlayerId);
      const pinger = players.find(p => p.id === playerId);
      if (currentRoomMode === "br_solo" || (localPlayer && pinger && pinger.teamId === localPlayer.teamId)) {
        addBRPing({ playerId, x, y, pingType });
      }
      break;
    }

    case "br_game_over": {
      running = false;
      gameMessage = data.message;
      stateEl.textContent = data.message;
      keys.clear();
      showBRGameOverScreen(data);
      break;
    }

    case "final_vote_started": {
      if (data.teamTrophies) currentTeamTrophies = data.teamTrophies;
      if (data.teams) currentTeams = data.teams;
      showFinalVoteOverlay(data);
      break;
    }

    case "vote_updated": {
      updateVoteCards(data.votes);
      break;
    }

    case "vote_countdown": {
      updateVoteCountdown(data.secondsLeft);
      break;
    }

    case "final_vote_resolved": {
      const champA = players.find(p => p.id === data.championA);
      const champB = players.find(p => p.id === data.championB);
      const statusEl = document.getElementById("fvStatusRow");
      if (statusEl) {
        statusEl.innerHTML = `⚔️ <strong>${escapeHTML(champA ? champA.name : "?")}</strong> vs <strong>${escapeHTML(champB ? champB.name : "?")}</strong> — FINAL ROUND!`;
      }
      // Hide vote overlay after 3s (when game_started fires)
      setTimeout(() => {
        document.getElementById("finalVoteOverlay").classList.add("hidden");
      }, 2800);
      break;
    }

    case "matchmaking_countdown": {
      if (isBattleRoyale(currentRoomMode) && brmActive) {
        const countdownBox = document.getElementById("brmCountdown");
        const countdownNum = document.getElementById("brmCountdownNum");
        if (countdownBox) {
          if (data.secondsLeft > 0) {
            countdownBox.classList.remove("hidden");
            if (countdownNum) countdownNum.textContent = data.secondsLeft;
          } else {
            countdownBox.classList.add("hidden");
          }
        }
      }

      if (matchmakingPopup && socket && socket.readyState === WebSocket.OPEN) {
        if (!roomCode || players.length === 0) break;
        if (data.secondsLeft <= 0 && matchmakingPopup.classList.contains("hidden")) break;
        if (data.secondsLeft > 0) {
          updateOnlineMatchmakingPopup();
          const titleEl = matchmakingPopup.querySelector(".matchmaking-title");
          if (titleEl) titleEl.textContent = "MATCHMAKING...";
        } else {
          updateOnlineMatchmakingPopup();
        }
      }
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
      const powerzoneEl = document.getElementById("voteCount_powerzone");
      if (classicEl) classicEl.textContent = `${votes.classic || 0} votes`;
      if (checkeredEl) checkeredEl.textContent = `${votes.checkered || 0} votes`;
      if (colosseumEl) colosseumEl.textContent = `${votes.colosseum || 0} votes`;
      if (powerzoneEl) powerzoneEl.textContent = `${votes.powerzone || 0} votes`;
      break;
    }

    case "surrender_vote_updated": {
      showSurrenderVotePopup(data);
      break;
    }

    case "surrender_cancelled": {
      if (surrenderVotePopup) surrenderVotePopup.classList.add("hidden");
      break;
    }

    case "player_surrendered": {
      showToastMsg(`🏳️ <strong>${escapeHTML(data.playerName)}</strong> has surrendered!`);
      break;
    }
  }
}

// ----------------------------------------------------------------
// UI RENDERING & COMPONENT REFRESHES
// ----------------------------------------------------------------

let alphaWelcomeDialogShown = false;

function switchScreen(targetScreen) {
  const tutorialCutsceneScreen = document.getElementById("tutorialCutsceneScreen");
  const screens = [loginScreen, introScreen, titleScreen, menuScreen, lobbyScreen, gameScreen, tutorialCutsceneScreen];
  const previousActiveScreen = screens.find((s) => s && s.classList.contains("active"));

  screens.forEach((s) => {
    if (s) s.classList.remove("active");
  });
  if (targetScreen) targetScreen.classList.add("active");

  if (previousActiveScreen === gameScreen && targetScreen === menuScreen) {
    if (window.tutorialGuideActive) {
      window.tutorialGuideActive = false;
      window.tutorialGuidePaused = false;
      localStorage.setItem("tutorial_status", "tutorial_match_completed");
    }
  }

  if (targetScreen === menuScreen) {
    if (typeof checkMenuTutorialGuide === "function") {
      checkMenuTutorialGuide();
    }
  }
  if (targetScreen !== gameScreen) {
    document.getElementById("couchControlPicker")?.classList.add("hidden");
    document.body.classList.remove("local-couch-active");
    document.getElementById("ingameChatBox")?.classList.add("hidden");
    document.getElementById("ingameChatToggleBtn")?.classList.add("hidden");
    const gameMicBtn = document.getElementById("gameMicBtn");
    if (gameMicBtn) gameMicBtn.style.display = "none";
  } else {
    const chatBox = document.getElementById("ingameChatBox");
    const chatMsgs = document.getElementById("ingameChatMessages");
    const toggleBtn = document.getElementById("ingameChatToggleBtn");
    if (chatBox) {
      chatBox.classList.add("hidden");
    }
    if (toggleBtn) {
      if (serverMode === "online") {
        toggleBtn.classList.remove("hidden");
      } else {
        toggleBtn.classList.add("hidden");
      }
    }
    if (chatMsgs) {
      chatMsgs.innerHTML = "";
    }
    const gameMicBtn = document.getElementById("gameMicBtn");
    if (gameMicBtn) {
      if (serverMode === "online") {
        gameMicBtn.style.display = "block";
        updateMicButtonUI();
      } else {
        gameMicBtn.style.display = "none";
      }
    }
  }

  if (targetScreen === menuScreen) {
    if (previousActiveScreen === gameScreen) {
      restoreConnectionPreference();
    }
    if (!alphaWelcomeDialogShown) {
      alphaWelcomeDialogShown = true;
      const dialog = document.getElementById("alphaWelcomeDialog");
      if (dialog) {
        dialog.classList.remove("hidden");
        dialog.classList.add("active");
      }
    }
  }
}

function startLocalGame() {
  localMode = true;
  localCouchMode = false;
  couchTouchKeys.clear();
  couchPlayerTouchKeys.clear();
  couchTouchPlayerId = null;
  roomCode = "LOCAL";
  localPlayerId = "local_player";
  hostId = localPlayerId;
  localBombId = 0;
  cameraX = 0;
  cameraY = 0;
  currentRoomMode = "classic";
  currentActiveRoundPlayers = [];
  
  const mapSelect = document.getElementById("localMapSelect");
  currentMapType = pendingLocalMapChoice || (mapSelect ? mapSelect.value : "classic");
  pendingLocalMapChoice = null;
  map = buildLocalMap(currentMapType);
  const activeStarts = getStartsForMap(currentMapType);

  const localNickname = localStorage.getItem("local_username") || "You";

  players = [
    makeLocalPlayer("local_player", localNickname, selectedCharacter, activeStarts[0], false),
    makeLocalPlayer("cpu_usagi", "Usagi CPU", "usagi", activeStarts[1], true),
    makeLocalPlayer("cpu_momonga", "Momonga CPU", "momonga", activeStarts[2], true),
    makeLocalPlayer("cpu_chiikawa", "Chiikawa CPU", "chiikawa", activeStarts[3], true),
  ];
  players.forEach((p) => {
    p.trophies = 0;
    p.hasPunch = false;
    p.hasSlide = false;
  });
  bombs = [];
  blasts = [];
  pickups = [];
  seedLocalPowerZonePickups();
  particles = [];
  roundTime = 150;
  running = true;
  startCountdownTimer = 3.5;
  startCountdownState = "3";
  shakeTimer = 0;
  zoneActive = false;
  zoneLayer = 0;
  zoneStepTimer = 0;
  localMatchRewarded = false;
  gameMessage = "";
  timerEl.textContent = formatTime(roundTime);
  stateEl.textContent = localCouchMode ? "4 Player Battle!" : "Battle!";
  if (gameRoomCode) gameRoomCode.textContent = roomCode;
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
    speed: ai ? 178 : 142,
    bombs: 1,
    range: getStartingBombRange(ai),
    cooldown: 0,
    invuln: 1.2,
    emote: null,
    emoteTimer: 0,
    radius: 13,
    trophies: 0,
    hasPunch: false,
    hasSlide: false,
    aiThink: 0,
    aiDir: { x: 0, y: 0 },
    moveTarget: null,
    moveFrom: null,
    moveDir: null,
  };
}

function openLocalFourPlayerLobby() {
  const nickname = localStorage.getItem("local_username") || usernameInput?.value.trim() || "Friend";
  localFourPlayerLobbyActive = true;
  localMode = false;
  roomCode = "4P";
  hostId = "couch_p1";
  localPlayerId = "couch_p1";
  couchSlots = [
    { human: true, name: nickname || "P1", kind: selectedCharacter, playerId: "couch_p1" },
    null,
    null,
    null,
  ];
  currentRoomIsChallenge = true;
  switchScreen(menuScreen);
  document.body.classList.add("local-four-lobby-active");
  document.querySelector('.tab-btn[data-tab="squad"]')?.click();
  renderLocalFourPlayerLobby();
  syncSquadLobbyInterface();
}

function renderLocalFourPlayerLobby() {
  const grid = document.getElementById("fourPlayerCards");
  if (grid) {
    grid.innerHTML = "";
  }
  const cardIds = ["squadCard_user", "squadInviteCard_left", "squadInviteCard_right", "squadInviteCard_fourth"];
  for (let i = 0; i < 4; i += 1) {
    const slot = couchSlots[i];
    const card = document.createElement("button");
    card.type = "button";
    card.className = `four-player-card ${slot ? "added" : ""}`;
    if (slot) {
      const style = characterStyle[slot.kind] || characterStyle.chiikawa;
      card.innerHTML = `
        <img src="assets/lobby cards/${slot.kind} character card.png" alt="${escapeHTML(style.label)}" />
        <strong>P${i + 1} ${escapeHTML(style.label)}</strong>
        <span>Tap to change / hold remove</span>
      `;
      card.addEventListener("click", () => {
        const currentIndex = couchCharacters.indexOf(slot.kind);
        slot.kind = couchCharacters[(currentIndex + 1) % couchCharacters.length];
        renderLocalFourPlayerLobby();
      });
      card.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (i > 0) couchSlots[i] = null;
        renderLocalFourPlayerLobby();
      });
    } else {
      card.innerHTML = `
        <div class="slot-plus">+</div>
        <strong>P${i + 1}</strong>
        <span>Add player</span>
      `;
      card.addEventListener("click", () => {
        const kind = couchCharacters[i % couchCharacters.length];
        couchSlots[i] = { human: true, name: `P${i + 1}`, kind, playerId: `couch_p${i + 1}` };
        renderLocalFourPlayerLobby();
      });
    }
    if (grid) grid.appendChild(card);
    renderLocalFourPlayerSquadCard(cardIds[i], i);
  }
}

function renderLocalFourPlayerSquadCard(cardId, index) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const slot = couchSlots[index];
  card.classList.toggle("local-four-empty", !slot);
  card.classList.toggle("local-four-filled", !!slot);
  if (slot) {
    const style = characterStyle[slot.kind] || characterStyle.chiikawa;
    card.innerHTML = `
      <div class="card-inner-skew">
        <button class="local-four-remove" type="button" aria-label="Remove P${index + 1}" ${index === 0 ? "hidden" : ""}>x</button>
        <div class="squad-card-image-container">
          <img src="assets/lobby cards/${slot.kind} character card.png" alt="${escapeHTML(style.label)}" />
        </div>
      </div>
      <div class="card-footer-bar">
        <div class="avatar-circle">
          <svg viewBox="0 0 24 24" class="avatar-smile-svg"><circle cx="12" cy="12" r="10" fill="#000" stroke="#ffd84a" stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.5" fill="#ffd84a"/><circle cx="15.5" cy="9.5" r="1.5" fill="#ffd84a"/><path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5" stroke="#ffd84a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
        </div>
        <div class="user-info">
          <div class="user-name">P${index + 1} ${escapeHTML(style.label)}</div>
          <div class="user-level">${escapeHTML(slot.name || `Player ${index + 1}`)}</div>
        </div>
      </div>
    `;
    card.onclick = (event) => {
      if (event.target.closest(".local-four-remove")) return;
      const currentIndex = couchCharacters.indexOf(slot.kind);
      slot.kind = couchCharacters[(currentIndex + 1) % couchCharacters.length];
      if (index === 0) {
        selectedCharacter = slot.kind;
        syncCharacterSelectPreview(selectedCharacter);
      }
      renderLocalFourPlayerLobby();
    };
    card.querySelector(".local-four-remove")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (index > 0) {
        couchSlots[index] = null;
        renderLocalFourPlayerLobby();
      }
    });
  } else {
    card.innerHTML = `
      <div class="card-inner-skew">
        <button class="invite-btn" type="button">+</button>
        <div class="local-four-empty-label">P${index + 1}</div>
      </div>
    `;
    const openInvitePanel = (event) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (localFourPlayerLobbyActive) {
        const kind = couchCharacters[index % couchCharacters.length];
        couchSlots[index] = { human: true, name: `P${index + 1}`, kind, playerId: `couch_p${index + 1}` };
        renderLocalFourPlayerLobby();
      } else if (typeof openFriendsList === "function" && socket && socket.readyState === WebSocket.OPEN) {
        openFriendsList(event);
      } else {
        showToastMsg("Invite a friend first. Empty slots stay empty until someone joins.");
      }
    };
    card.onclick = openInvitePanel;
    card.querySelector(".invite-btn")?.addEventListener("click", openInvitePanel);
  }
}

function closeLocalFourPlayerLobby() {
  localFourPlayerLobbyActive = false;
  localCouchMode = false;
  roomCode = null;
  hostId = null;
  localPlayerId = null;
  currentRoomIsChallenge = false;
  document.body.classList.remove("local-four-lobby-active");
  syncSquadLobbyInterface();
}

function getLocalSingleVoteActors() {
  return [
    { id: "local_player", kind: selectedCharacter, name: localStorage.getItem("local_username") || "You" },
    { id: "cpu_usagi", kind: "usagi", name: "Usagi CPU" },
    { id: "cpu_momonga", kind: "momonga", name: "Momonga CPU" },
    { id: "cpu_chiikawa", kind: "chiikawa", name: "Chiikawa CPU" },
  ];
}

function getLocalFourVoteActors() {
  return Array.from({ length: 4 }, (_, index) => {
    const slot = couchSlots[index];
    const kind = slot?.kind || couchCharacters[index % couchCharacters.length];
    return {
      id: slot?.playerId || `couch_cpu_${index + 1}`,
      kind,
      name: slot?.name || `${characterStyle[kind]?.label || "CPU"} CPU`,
    };
  });
}

function startLocalSingleWithMapVote() {
  const voteActors = getLocalSingleVoteActors();
  startLocalMapVote(voteActors, () => {
    showVsLoadingScreen(voteActors, () => {
      startLocalGame();
      tryPlayMusic();
    });
  });
}

function startLocalFourWithMapVote() {
  const voteActors = getLocalFourVoteActors();
  startLocalMapVote(voteActors, () => {
    showVsLoadingScreen(voteActors, () => {
      startLocalFourPlayerGame();
      tryPlayMusic();
    });
  });
}

function shouldShowVsBeforeGameStart(data) {
  const mode = data?.mode || currentRoomMode;
  return !data?.__vsLoadingShown && !isBattleRoyale(mode);
}

function showServerVsThenStart(data) {
  showVsLoadingScreen(data?.players || players, () => {
    handleServerMessage({
      type: "game_started",
      data: {
        ...data,
        __vsLoadingShown: true,
      },
    });
    tryPlayMusic();
  });
}

function startLocalFourPlayerGame() {
  localMode = true;
  localCouchMode = true;
  localFourPlayerLobbyActive = false;
  document.body.classList.remove("local-four-lobby-active");
  roomCode = "4P";
  localPlayerId = "couch_p1";
  hostId = localPlayerId;
  localBombId = 0;
  currentRoomMode = "classic";
  currentActiveRoundPlayers = [];
  couchTouchKeys.clear();
  couchPlayerTouchKeys.clear();
  couchTouchPlayerId = null;

  currentMapType = pendingLocalMapChoice || document.getElementById("localMapSelect")?.value || "classic";
  pendingLocalMapChoice = null;
  map = buildLocalMap(currentMapType);
  const activeStarts = getStartsForMap(currentMapType);

  const usedKinds = [];
  players = Array.from({ length: 4 }, (_, index) => {
    const slot = couchSlots[index];
    const fallbackKind = couchCharacters.find((kind) => !usedKinds.includes(kind)) || couchCharacters[index % couchCharacters.length];
    const kind = slot?.kind || fallbackKind;
    usedKinds.push(kind);
    let player;
    if (slot?.human) {
      player = makeLocalPlayer(`couch_p${index + 1}`, slot.name || `P${index + 1}`, kind, activeStarts[index % activeStarts.length], false);
    } else {
      player = makeLocalPlayer(`couch_cpu_${index + 1}`, `${characterStyle[kind].label} CPU`, kind, activeStarts[index % activeStarts.length], true);
    }
    player.couchSlotIndex = index;
    return player;
  });

  players.forEach((p) => {
    p.trophies = 0;
    p.hasPunch = false;
    p.hasSlide = false;
  });

  const firstHuman = players.find((p) => !p.ai);
  couchTouchPlayerId = firstHuman?.id || players[0]?.id || null;
  localPlayerId = couchTouchPlayerId || "couch_p1";

  bombs = [];
  blasts = [];
  pickups = [];
  seedLocalPowerZonePickups();
  particles = [];
  roundTime = 150;
  running = true;
  startCountdownTimer = 3.5;
  startCountdownState = "3";
  shakeTimer = 0;
  zoneActive = false;
  zoneLayer = 0;
  zoneStepTimer = 0;
  localMatchRewarded = false;
  gameMessage = "";
  timerEl.textContent = formatTime(roundTime);
  stateEl.textContent = "4 Player Battle!";
  if (gameRoomCode) gameRoomCode.textContent = roomCode;
  updateHudSidebar();
  updateCouchControlPicker();
  document.getElementById("localFourPlayerLobbyDialog")?.classList.add("hidden");
  switchScreen(gameScreen);
}

function updateCouchControlPicker() {
  const picker = document.getElementById("couchControlPicker");
  if (!picker) return;
  const humans = localCouchMode ? players.filter((p) => !p.ai) : [];
  picker.classList.toggle("hidden", humans.length === 0);
  document.body.classList.toggle("local-couch-active", localCouchMode && humans.length > 0);
  picker.innerHTML = "";
  humans.forEach((player) => {
    const slotNumber = (player.couchSlotIndex ?? humans.indexOf(player)) + 1;
    const panel = document.createElement("div");
    panel.className = `couch-control-panel slot-${slotNumber}`;
    panel.innerHTML = `
      <div class="couch-player-label" data-kind="${player.kind}">
        <img src="assets/cards/${player.kind}.png" alt="${escapeHTML(player.name)}" />
        <span>${player.trophies || 0}</span>
      </div>
      <div class="couch-joystick" aria-label="P${slotNumber} movement joystick">
        <div class="couch-joystick-knob"></div>
      </div>
      <div class="couch-mini-actions">
        <button class="couch-mini-action punch" type="button" data-action="punch" aria-label="P${slotNumber} punch">PUNCH</button>
        <button class="couch-mini-action bomb" type="button" data-action="bomb" aria-label="P${slotNumber} bomb">BOMB</button>
      </div>
    `;
    bindCouchControlPanel(panel, player);
    picker.appendChild(panel);
  });
}

function getCouchTouchKeys(playerId) {
  if (!couchPlayerTouchKeys.has(playerId)) {
    couchPlayerTouchKeys.set(playerId, new Set());
  }
  return couchPlayerTouchKeys.get(playerId);
}

function bindCouchPress(button, onStart, onEnd) {
  const start = (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.classList.add("pressed");
    onStart();
  };
  const end = (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.classList.remove("pressed");
    onEnd?.();
  };
  button.addEventListener("touchstart", start, { passive: false });
  button.addEventListener("touchend", end, { passive: false });
  button.addEventListener("touchcancel", end, { passive: false });
  button.addEventListener("mousedown", start);
  button.addEventListener("mouseup", end);
  button.addEventListener("mouseleave", end);
}

function bindCouchControlPanel(panel, player) {
  const touchKeys = getCouchTouchKeys(player.id);
  const joystick = panel.querySelector(".couch-joystick");
  if (joystick) bindCouchJoystick(joystick, player, touchKeys);
  const bombBtn = panel.querySelector('[data-action="bomb"]');
  if (bombBtn) {
    bindCouchPress(bombBtn, () => {
      couchTouchPlayerId = player.id;
      localPlayerId = player.id;
      triggerPlayerBomb(player);
    });
  }
  const punchBtn = panel.querySelector('[data-action="punch"]');
  if (punchBtn) {
    bindCouchPress(punchBtn, () => {
      couchTouchPlayerId = player.id;
      localPlayerId = player.id;
      triggerPlayerPunch(player);
    });
  }
}

function bindCouchJoystick(joystick, player, touchKeys) {
  const knob = joystick.querySelector(".couch-joystick-knob");
  let activePointerId = null;

  const setDirectionFromPoint = (clientX, clientY) => {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = rect.width * 0.28;
    const distance = Math.hypot(dx, dy);
    const scale = distance > max ? max / distance : 1;
    const knobX = dx * scale;
    const knobY = dy * scale;
    if (knob) knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    touchKeys.clear();
    if (distance < rect.width * 0.12) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      touchKeys.add(dx < 0 ? "left" : "right");
    } else {
      touchKeys.add(dy < 0 ? "up" : "down");
    }
    couchTouchPlayerId = player.id;
    localPlayerId = player.id;
  };

  const resetJoystick = () => {
    touchKeys.clear();
    if (knob) knob.style.transform = "translate(0, 0)";
    activePointerId = null;
    joystick.classList.remove("active");
  };

  joystick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    activePointerId = event.pointerId;
    joystick.setPointerCapture?.(event.pointerId);
    joystick.classList.add("active");
    setDirectionFromPoint(event.clientX, event.clientY);
  });
  joystick.addEventListener("pointermove", (event) => {
    if (activePointerId !== event.pointerId) return;
    event.preventDefault();
    setDirectionFromPoint(event.clientX, event.clientY);
  });
  joystick.addEventListener("pointerup", resetJoystick);
  joystick.addEventListener("pointercancel", resetJoystick);
  joystick.addEventListener("lostpointercapture", resetJoystick);
}

function buildLocalMap(mapType = "classic") {
  const nextMap = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => {
      // Outer walls
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return "wall";
      
      if (mapType === "powerzone") {
        if (x >= 5 && x <= 9 && y >= 5 && y <= 7) return "grass";
        if ((x === 4 || x === 10) && (y >= 4 && y <= 8)) return "crate";
        if ((y === 4 || y === 8) && (x >= 4 && x <= 10)) return "crate";
        if (x === 1 || y === 1 || x === COLS - 2 || y === ROWS - 2) return "grass";
        if (x % 2 === 0 && y % 2 === 0) return "wall";
        return "grass";
      } else if (mapType === "colosseum") {
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

  getStartsForMap(mapType).forEach((s) => {
    const clearSafe = (x, y) => {
      if (nextMap[y] && nextMap[y][x] && nextMap[y][x] !== "wall") nextMap[y][x] = "grass";
    };
    clearSafe(s.x, s.y);
    clearSafe(s.x + Math.sign(COLS / 2 - s.x), s.y);
    clearSafe(s.x, s.y + Math.sign(ROWS / 2 - s.y));
  });

  return nextMap;
}

function getStartsForMap(mapType = currentMapType) {
  return mapType === "powerzone" ? powerZoneStarts : starts;
}

function getStartingBombRange(ai = false, mapType = currentMapType) {
  return mapType === "powerzone" ? 1 : (ai ? 3 : 2);
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

function seedLocalPowerZonePickups() {
  if (currentMapType !== "powerzone") return;
  pickups = pickups.filter((pickup) => !isPowerZoneLaneTile(pickup.x, pickup.y));
  for (let x = 1; x <= COLS - 2; x += 1) {
    pickups.push({ x, y: 1, type: getPowerZonePickupType(x, 1) });
    pickups.push({ x, y: ROWS - 2, type: getPowerZonePickupType(x, ROWS - 2) });
  }
  for (let y = 1; y <= ROWS - 2; y += 1) {
    if (y === 1 || y === ROWS - 2) continue;
    pickups.push({ x: 1, y, type: getPowerZonePickupType(1, y) });
    pickups.push({ x: COLS - 2, y, type: getPowerZonePickupType(COLS - 2, y) });
  }
}

function isPowerZoneLaneTile(x, y) {
  return x === 1 || y === 1 || x === COLS - 2 || y === ROWS - 2;
}

function updateLobbyUI() {
  if (!lobbyPlayersList) {
    syncSquadLobbyInterface();
    return;
  }

  lobbyPlayersList.innerHTML = "";
  const isHost = localPlayerId === hostId;
  const isTeamModeVal = isTeamMode(currentRoomMode);

  if (isHost) {
    if (!addBotBtn || !startGameBtn) return;
    addBotBtn.classList.remove("hidden");
    startGameBtn.classList.remove("hidden");
  } else {
    addBotBtn?.classList.add("hidden");
    startGameBtn?.classList.add("hidden");
  }

  // In team mode, insert Team A / Team B dividers
  if (isTeamModeVal && currentTeams) {
    // Team score display
    const scoreRow = document.createElement("div");
    scoreRow.className = "lobby-team-score-row";
    scoreRow.innerHTML = `
      <span class="team-a-color" style="font-size:16px">Team A 🔵 <strong>${currentTeamTrophies?.A || 0}</strong>🏆</span>
      <span style="color:#999;font-size:20px">—</span>
      <span class="team-b-color" style="font-size:16px"><strong>${currentTeamTrophies?.B || 0}</strong>🏆 🟠 Team B</span>
    `;
    lobbyPlayersList.appendChild(scoreRow);

    // Team A divider
    const divA = document.createElement("div");
    divA.className = "lobby-team-divider";
    divA.innerHTML = `<span class="lobby-team-label-a">⚔ TEAM A</span>`;
    lobbyPlayersList.appendChild(divA);

    (currentTeams.A || []).forEach(pid => {
      const p = players.find(pl => pl.id === pid);
      if (p) appendLobbyPlayerCard(p, isHost);
    });

    // Team B divider
    const divB = document.createElement("div");
    divB.className = "lobby-team-divider";
    divB.innerHTML = `<span class="lobby-team-label-b">⚔ TEAM B</span>`;
    lobbyPlayersList.appendChild(divB);

    (currentTeams.B || []).forEach(pid => {
      const p = players.find(pl => pl.id === pid);
      if (p) appendLobbyPlayerCard(p, isHost);
    });

    // Any unassigned players
    players.forEach(p => {
      const inA = (currentTeams.A || []).includes(p.id);
      const inB = (currentTeams.B || []).includes(p.id);
      if (!inA && !inB) appendLobbyPlayerCard(p, isHost);
    });
  } else {
    players.forEach((p) => appendLobbyPlayerCard(p, isHost));
  }
  syncSquadLobbyInterface();
}

function appendLobbyPlayerCard(p, isHost) {
  const card = document.createElement("div");
  card.className = `lobby-player-card ${p.ready ? "ready" : ""} ${p.ai ? "bot" : ""} ${p.id === hostId ? "host" : ""}`;
  card.style.position = "relative";

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
    card.querySelector(".btn-remove-bot")?.addEventListener("click", () => {
      sendServerMessage("remove_bot", { botId: p.id });
    });
  }
}

function isTeamMode(mode) {
  return mode === "team" || mode === "duo" || mode === "trio" || mode === "br_duo" || mode === "br_trio";
}

function isBattleRoyale(mode) {
  return mode === "br_solo" || mode === "br_duo" || mode === "br_trio";
}

function updateHudSidebar() {
  hudPlayersList.innerHTML = "";
  if (hudPlayersList) hudPlayersList.style.display = 'none';

  const localPlayer = players.find(p => p.id === localPlayerId);
  const isBR = isBattleRoyale(currentRoomMode);
  const hotbar = document.getElementById("brHealingHotbar");
  if (hotbar) {
    if (isBR && running) {
      hotbar.classList.remove("hidden");
      const bandageEl = document.getElementById("countBandage");
      const medkitEl = document.getElementById("countMedkit");
      const drinkEl = document.getElementById("countEnergyDrink");
      
      if (bandageEl) bandageEl.textContent = localPlayer ? (localPlayer.bandageCount || 0) : 0;
      if (medkitEl) medkitEl.textContent = localPlayer ? (localPlayer.medkitCount || 0) : 0;
      if (drinkEl) drinkEl.textContent = localPlayer ? (localPlayer.energyDrinkCount || 0) : 0;
    } else {
      hotbar.classList.add("hidden");
    }
  }

  const specHud = document.getElementById("brSpectatorHud");
  if (specHud) {
    if (isBR && running && localPlayer && !localPlayer.alive) {
      specHud.classList.remove("hidden");
      if (!spectatedPlayerId) {
        const aliveOne = players.find(p => p.alive);
        if (aliveOne) spectatedPlayerId = aliveOne.id;
      }
      updateSpectatorUI();
    } else {
      specHud.classList.add("hidden");
    }
  }

  // Update Team Trophies Panel
  const teamPanel = document.getElementById("teamTrophiesPanel");
  if (teamPanel) {
    if (isTeamMode(currentRoomMode)) {
      teamPanel.classList.remove("hidden");
      const scoreA = currentTeamTrophies?.A || 0;
      const scoreB = currentTeamTrophies?.B || 0;
      const countA = document.getElementById("teamTrophyCount_A");
      const countB = document.getElementById("teamTrophyCount_B");
      const barA = document.getElementById("teamTrophyBar_A");
      const barB = document.getElementById("teamTrophyBar_B");
      if (countA) countA.textContent = scoreA;
      if (countB) countB.textContent = scoreB;
      if (barA) barA.style.width = `${Math.min(100, (scoreA / 8) * 100)}%`;
      if (barB) barB.style.width = `${Math.min(100, (scoreB / 8) * 100)}%`;
    } else {
      teamPanel.classList.add("hidden");
    }
  }

  players.forEach((p) => {
    const card = document.createElement("div");
    card.className = `hud-player-card ${p.alive ? "" : "dead"}`;
    card.setAttribute("data-kind", p.kind);

    const style = characterStyle[p.kind];
    const canvasId = `hud_avatar_${p.id}`;

    let badgeHTML = `<div class="hud-wins-count">${p.trophies || 0}</div>`;
    if (isTeamMode(currentRoomMode)) {
      const pTeam = (currentTeams?.A || []).includes(p.id) ? "A" : "B";
      const teamColor = pTeam === "A" ? "#3b82f6" : "#f97316";
      badgeHTML = `<div class="hud-wins-count" style="background:${teamColor}; color:#fff; border-radius:50%; width:20px; height:20px; font-size:11px; display:flex; justify-content:center; align-items:center; border:2px solid #000; font-weight:800; font-family:var(--font);">${pTeam}</div>`;
    }

    card.innerHTML = `
      <div class="hud-avatar-box">
        <canvas id="${canvasId}" width="40" height="40"></canvas>
      </div>
      ${badgeHTML}
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

function showSurrenderVotePopup(data = {}) {
  if (!surrenderVotePopup) return;
  const myTeam = getPlayerTeam(localPlayerId);
  if (data.team && myTeam && data.team !== myTeam) return;
  surrenderVotePopup.classList.remove("hidden");
  if (surrenderVoteStatus) {
    const seconds = data.secondsLeft ? ` ${data.secondsLeft}s left.` : "";
    surrenderVoteStatus.textContent = `${data.yesVotes || 0}/${data.threshold || 3} teammates agreed.${seconds}`;
  }
}

function localPlaceBomb(player) {
  if (!localMode || !player || !player.alive || player.cooldown > 0) return;
  const tile = gridAt(player.x, player.y);
  const activeBombsCount = bombs.filter((b) => b.ownerId === player.id).length;
  const tileHasBomb = bombs.some((b) => b.x === tile.x && b.y === tile.y);
  if (activeBombsCount >= player.bombs || tileHasBomb) return;

  // Read equipped bomb skin (only local player gets customization, bots default)
  const color = (player.id === localPlayerId) ? (localStorage.getItem("equipped_bomb") || "default") : "default";
  const effectColor = (player.id === localPlayerId) ? (localStorage.getItem("equipped_effect") || "default") : "default";

  if (player.id === localPlayerId) {
    let bombsPlaced = parseInt(localStorage.getItem("quest_bombs_progress") || "0");
    localStorage.setItem("quest_bombs_progress", Math.min(10, bombsPlaced + 1).toString());
    
    let lifetimeBombs = parseInt(localStorage.getItem("lifetime_bombs_placed") || "0");
    localStorage.setItem("lifetime_bombs_placed", (lifetimeBombs + 1).toString());
  }

  bombs.push({
    id: `local_bomb_${++localBombId}`,
    x: tile.x,
    y: tile.y,
    ownerId: player.id,
    range: player.range,
    timer: 2.25,
    pulse: 0,
    passableFor: new Set([player.id]),
    color: color,
    effectColor: effectColor
  });
  player.cooldown = 0.05;
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
        if (isBattleRoyale(currentRoomMode)) {
          if (roll < 0.15) pickups.push({ x, y, type: "flame" });
          else if (roll < 0.28) pickups.push({ x, y, type: "bomb" });
          else if (roll < 0.40) pickups.push({ x, y, type: "speed" });
          else if (roll < 0.45) pickups.push({ x, y, type: "full_fire" });
          else if (roll < 0.50) pickups.push({ x, y, type: "punch" });
          else if (roll < 0.55) pickups.push({ x, y, type: "slide" });
          else if (roll < 0.70) pickups.push({ x, y, type: "bandage" });
          else if (roll < 0.80) pickups.push({ x, y, type: "medkit" });
          else if (roll < 0.90) pickups.push({ x, y, type: "energy_drink" });
        } else {
          if (roll < 0.18) pickups.push({ x, y, type: "flame" });
          else if (roll < 0.32) pickups.push({ x, y, type: "bomb" });
          else if (roll < 0.44) pickups.push({ x, y, type: "speed" });
          else if (roll < 0.50) pickups.push({ x, y, type: "full_fire" });
          else if (roll < 0.56) pickups.push({ x, y, type: "punch" });
          else if (roll < 0.64) pickups.push({ x, y, type: "slide" });
        }
        break;
      }
    }
  });

  blasts.push({ cells, timer: 0.48, age: 0, color: bomb.effectColor || "default" });
  // In BR mode only shake for MY own bomb; in classic mode always shake
  if (!isBattleRoyale(currentRoomMode) || bomb.ownerId === localPlayerId) {
    shakeTimer = 0.35;
  }
  cells.forEach((cell) => {
    players.forEach((p) => {
      if (!p.alive || p.invuln > 0) return;
      const tile = gridAt(p.x, p.y);
      if (tile.x === cell.x && tile.y === cell.y) {
        if (isBattleRoyale(currentRoomMode)) {
          const hpBefore = p.hp;
          damageLocalPlayerFromBomb(p, 60);
          if (p.hp <= 0 && hpBefore > 0 && p.id !== localPlayerId && bomb.ownerId === localPlayerId) {
            let kills = parseInt(localStorage.getItem("quest_kills_progress") || "0");
            localStorage.setItem("quest_kills_progress", Math.min(5, kills + 1).toString());
            
            let lifetimeKills = parseInt(localStorage.getItem("lifetime_kills") || "0");
            localStorage.setItem("lifetime_kills", (lifetimeKills + 1).toString());
          }
        } else {
          p.alive = false;
          p.moveTarget = null;
          p.moveFrom = null;
          p.moveDir = null;
          if (p.id !== localPlayerId && bomb.ownerId === localPlayerId) {
            let kills = parseInt(localStorage.getItem("quest_kills_progress") || "0");
            localStorage.setItem("quest_kills_progress", Math.min(5, kills + 1).toString());
            
            let lifetimeKills = parseInt(localStorage.getItem("lifetime_kills") || "0");
            localStorage.setItem("lifetime_kills", (lifetimeKills + 1).toString());
          }
        }
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
  else if (pickup.type === "slide") player.hasSlide = true;
  else if (pickup.type === "bandage") player.bandageCount = (player.bandageCount || 0) + 1;
  else if (pickup.type === "medkit") player.medkitCount = (player.medkitCount || 0) + 1;
  else if (pickup.type === "energy_drink") player.energyDrinkCount = (player.energyDrinkCount || 0) + 1;

  if (player.id === localPlayerId) {
    let collected = parseInt(localStorage.getItem("quest_pickups_progress") || "0");
    localStorage.setItem("quest_pickups_progress", Math.min(3, collected + 1).toString());
    
    let lifetimePickups = parseInt(localStorage.getItem("lifetime_pickups_collected") || "0");
    localStorage.setItem("lifetime_pickups_collected", (lifetimePickups + 1).toString());
  }

  burstSparkles(player.x, player.y);
  updateHudSidebar();
}

function localCheckGameEnd() {
  if (!localMode || !running) return;
  const isBR = isBattleRoyale(currentRoomMode);
  if (isBR) {
    localCheckBRGameEnd();
    return;
  }
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

  // Progress daily match quest
  localStorage.setItem("quest_match_completed", "true");

  // Progress weekly win quest
  if (playerWon) {
    let wins = parseInt(localStorage.getItem("quest_win3_progress") || "0");
    localStorage.setItem("quest_win3_progress", Math.min(3, wins + 1).toString());
  }

  const gainedXp = playerWon ? 120 : 45;
  const gainedGems = playerWon ? 5 : 0;
  seasonXp += gainedXp;
  gemsCount += gainedGems;
  if (playerWon) crownCount += 1;

  // RP gain/loss — Bronze I is floor (RP never goes below 0)
  const rpGain = playerWon ? 50 : -15;
  rankRp = Math.max(0, rankRp + rpGain);
  totalMatches += 1;
  if (playerWon) totalWins += 1;

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
  // Header currency stats
  const crownEl = document.getElementById("crownCount");
  const gemsEl  = document.getElementById("gemsCount");
  if (crownEl) crownEl.textContent = crownCount;
  if (gemsEl)  gemsEl.textContent  = gemsCount;

  // Season XP bar (hidden text span kept for compat)
  const slEl  = document.getElementById("seasonLevel");
  const spfEl = document.getElementById("seasonProgressFill");
  const sptEl = document.getElementById("seasonProgressText");
  if (slEl)  slEl.textContent  = seasonLevel;
  if (sptEl) sptEl.textContent = `${seasonXp}/${seasonXpToNext}`;
  if (spfEl) spfEl.style.width = `${Math.min(100, (seasonXp / seasonXpToNext) * 100)}%`;

  // ========= Player Profile Card =========
  const card = document.getElementById("playerProfileCard");
  const rank = getRankForRp(rankRp);
  const nextThreshold = getNextRankThreshold(rankRp);

  if (card) card.dataset.rank = rank.id;

  const rankIconEl = document.getElementById("profileRankIcon");
  if (rankIconEl) rankIconEl.innerHTML = getRankIconSvg(rank.id);

  const tierEl = document.getElementById("profileRankTier");
  const divEl  = document.getElementById("profileRankDiv");
  if (tierEl) tierEl.textContent = rank.name;
  if (divEl)  divEl.textContent  = rank.div || '';

  const lvNumEl = document.getElementById("profileLevelNum");
  if (lvNumEl) lvNumEl.textContent = seasonLevel;

  // Sync player name from username input or localStorage
  const nameEl = document.getElementById("profilePlayerName");
  if (nameEl) {
    const uname = (typeof usernameInput !== 'undefined' && usernameInput && usernameInput.value && usernameInput.value.trim())
      || localStorage.getItem("local_username")
      || "Player";
    nameEl.textContent = uname;
  }

  // Sync character avatar
  const avatarImg = document.getElementById("profileCharAvatar");
  if (avatarImg) {
    const src = `assets/cards/${selectedCharacter || 'hachiware'}.png`;
    if (!avatarImg.getAttribute('src') || !avatarImg.getAttribute('src').endsWith(src.split('/').pop())) {
      avatarImg.src = src;
    }
  }

  // RP bar
  const rpCurrentEl = document.getElementById("profileRpCurrent");
  const rpNextEl    = document.getElementById("profileRpNext");
  const rpFillEl    = document.getElementById("profileRpBarFill");
  if (rpCurrentEl) rpCurrentEl.textContent = rankRp;
  if (nextThreshold !== null) {
    if (rpNextEl) rpNextEl.textContent = nextThreshold;
    const curMin = rank.min;
    const pct = nextThreshold > curMin
      ? Math.min(100, ((rankRp - curMin) / (nextThreshold - curMin)) * 100)
      : 100;
    if (rpFillEl) rpFillEl.style.width = `${pct}%`;
  } else {
    if (rpNextEl) rpNextEl.textContent = '\u221e';
    if (rpFillEl) rpFillEl.style.width = '100%';
  }

  // Stats
  const winsEl      = document.getElementById("statWins");
  const matchesEl   = document.getElementById("statMatches");
  const statCrownEl = document.getElementById("statCrowns");
  if (winsEl)      winsEl.textContent      = totalWins;
  if (matchesEl)   matchesEl.textContent   = totalMatches;
  if (statCrownEl) statCrownEl.textContent = crownCount;

  // Centered Premium Play Card updates
  const playCardImg = document.getElementById("playCharacterCardImg");
  if (playCardImg) {
    const src = `assets/lobby cards/${selectedCharacter} character card.png`;
    if (!playCardImg.src.endsWith(src)) {
      playCardImg.src = src;
    }
  }
  const playCharName = document.getElementById("playCharName");
  if (playCharName) {
    playCharName.textContent = characterStyle[selectedCharacter]?.label || selectedCharacter;
  }
  const playUserName = document.getElementById("playUserName");
  if (playUserName) {
    playUserName.textContent = getActivePlayerName();
  }
  const playLevelNum = document.getElementById("playLevelNum");
  if (playLevelNum) {
    playLevelNum.textContent = seasonLevel;
  }
  const playRankIcon = document.getElementById("playRankIcon");
  if (playRankIcon) {
    playRankIcon.innerHTML = getRankIconSvg(rank.id);
  }
  const playRankTier = document.getElementById("playRankTier");
  const playRankDiv = document.getElementById("playRankDiv");
  if (playRankTier) playRankTier.textContent = rank.name;
  if (playRankDiv) playRankDiv.textContent = rank.div || '';

  const playXpBarFill = document.getElementById("playXpBarFill");
  const playXpText = document.getElementById("playXpText");
  if (playXpBarFill) {
    playXpBarFill.style.width = `${Math.min(100, (seasonXp / seasonXpToNext) * 100)}%`;
  }
  if (playXpText) {
    playXpText.textContent = `${seasonXp} / ${seasonXpToNext}`;
  }
}

async function loadProgression() {
  // If Supabase is not active, fallback to localStorage
  if (!supabaseClient) {
    try {
      const saved = JSON.parse(localStorage.getItem("chiikawaProgress") || "{}");
      crownCount = Number.isFinite(saved.crownCount) ? saved.crownCount : crownCount;
      gemsCount = Number.isFinite(saved.gemsCount) ? saved.gemsCount : gemsCount;
      seasonLevel    = Number.isFinite(saved.seasonLevel)    ? saved.seasonLevel    : seasonLevel;
      seasonXp       = Number.isFinite(saved.seasonXp)       ? saved.seasonXp       : seasonXp;
      seasonXpToNext = Number.isFinite(saved.seasonXpToNext) ? saved.seasonXpToNext : seasonXpToNext;
      rankRp         = Number.isFinite(saved.rankRp)         ? saved.rankRp         : rankRp;
      totalWins      = Number.isFinite(saved.totalWins)      ? saved.totalWins      : totalWins;
      totalMatches   = Number.isFinite(saved.totalMatches)   ? saved.totalMatches   : totalMatches;
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
      crownCount   = data.crown_count   ?? 0;
      gemsCount    = data.gems_count    ?? 100;
      seasonLevel  = data.season_level  ?? 1;
      seasonXp     = data.season_xp     ?? 0;
      rankRp       = data.rank_rp       ?? rankRp;
      totalWins    = data.total_wins    ?? totalWins;
      totalMatches = data.total_matches ?? totalMatches;
      updateProgressionUI();
    }
  } catch (err) {
    console.error("Error loading progression from Supabase:", err);
  }
}

async function saveProgression() {
  if (typeof updateShopWalletDisplay === "function") {
    updateShopWalletDisplay();
  }
  // If Supabase is not active, fallback to localStorage
  if (!supabaseClient) {
    localStorage.setItem(
      "chiikawaProgress",
      JSON.stringify({ crownCount, gemsCount, seasonLevel, seasonXp, seasonXpToNext, rankRp, totalWins, totalMatches })
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
        season_level:  seasonLevel,
        season_xp:     seasonXp,
        rank_rp:       rankRp,
        total_wins:    totalWins,
        total_matches: totalMatches,
        updated_at:    new Date().toISOString()
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
  if (typeof addKnockRoomChatMessage === "function") {
    addKnockRoomChatMessage(sender, text, isSystem, isMe);
  }

  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg ${isSystem ? "system" : ""} ${isMe ? "me" : ""}`;

  if (isSystem) {
    msgEl.textContent = text;
  } else {
    msgEl.innerHTML = `<span class="sender">${escapeHTML(sender)}:</span><span class="text">${escapeHTML(text)}</span>`;
  }

  if (chatMessages) {
    chatMessages.appendChild(msgEl.cloneNode(true));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  const lobbyChatMessages = document.getElementById("lobbyChatMessages");
  if (lobbyChatMessages) {
    lobbyChatMessages.appendChild(msgEl.cloneNode(true));
    lobbyChatMessages.scrollTop = lobbyChatMessages.scrollHeight;
  }

  const ingameChatMessages = document.getElementById("ingameChatMessages");
  if (ingameChatMessages) {
    const ingameMsg = document.createElement("div");
    ingameMsg.className = `ingame-chat-msg ${isSystem ? "system" : ""} ${isMe ? "me" : ""}`;
    if (isSystem) {
      ingameMsg.textContent = text;
    } else {
      ingameMsg.innerHTML = `<span class="sender">${escapeHTML(sender)}:</span><span class="text">${escapeHTML(text)}</span>`;
    }
    ingameChatMessages.appendChild(ingameMsg);
    ingameChatMessages.scrollTop = ingameChatMessages.scrollHeight;

    // Fade out after 5 seconds
    setTimeout(() => {
      ingameMsg.classList.add("fade-out");
    }, 5000);
  }
}

function escapeHTML(str) {
  // Safe check: If str is null, undefined, or not a string, return an empty string
  if (!str) return ""; 
  return String(str).replace(/[&<>'"]/g, 
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
  const cellType = map[tileY][tileX];
  return cellType === "wall" || cellType === "crate" || cellType === "zone" || cellType === "supply_crate" || cellType === "golden_crate";
}

function isSolid(tileX, tileY, actor = null) {
  if (isMapSolid(tileX, tileY)) return true;
  return bombs.some((bomb) => {
    if (canPassBomb(actor, bomb)) return false;
    if (actor && overlapsBomb(actor, bomb)) return false;

    // AI slide/kick pathfinding integration
    if (actor && actor.hasSlide && bomb.x === tileX && bomb.y === tileY) {
      const ax = Math.floor(actor.x / TILE);
      const ay = Math.floor(actor.y / TILE);
      const dx = tileX - ax;
      const dy = tileY - ay;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        if (!isTileSolidForBombLocal(bomb.x + dx, bomb.y + dy)) {
          return false; // Can kick it, so not solid for AI pathfinding
        }
      }
    }

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
  const mapCols = map[0] ? map[0].length : COLS;
  const mapRows = map ? map.length : ROWS;
  if (tx < 0 || tx >= mapCols || ty < 0 || ty >= mapRows) return true;
  const cellType = map[ty]?.[tx];
  if (cellType === "wall" || cellType === "crate" || cellType === "zone" || cellType === "supply_crate" || cellType === "golden_crate") return true;
  const hasBomb = bombs.some((b) => b.x === tx && b.y === ty && (!b.vx || (b.vx === 0 && b.vy === 0)));
  if (hasBomb) return true;
  const hasPlayer = players.some((p) => p.alive && Math.floor(p.x / TILE) === tx && Math.floor(p.y / TILE) === ty);
  if (hasPlayer) return true;
  return false;
}

function tryKickBombLocal(actor, dir) {
  if (!actor?.hasSlide || !actor.alive || !dir || (dir.x === 0 && dir.y === 0)) return false;
  const current = gridAt(actor.x, actor.y);
  const bomb = bombs.find((b) => b.x === current.x + dir.x && b.y === current.y + dir.y && (!b.vx || (b.vx === 0 && b.vy === 0)));
  if (!bomb) return false;
  if (isTileSolidForBombLocal(bomb.x + dir.x, bomb.y + dir.y)) return false;
  bomb.vx = dir.x;
  bomb.vy = dir.y;
  bomb.slideX = bomb.x;
  bomb.slideY = bomb.y;
  if (!bomb.passableFor) bomb.passableFor = new Set();
  bomb.passableFor.add(actor.id);
  return true;
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
    stepTowardTarget(actor, dt);
    if (actor.moveTarget) {
      return true;
    }
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
    if (tryKickBombLocal(actor, dir) && canMoveTo(target.x, target.y, actor)) {
      actor.dx = dir.x;
      actor.dy = dir.y;
      actor.moveFrom = centerOf(current.x, current.y);
      actor.moveDir = dir;
      actor.moveTarget = target;
      return stepTowardTarget(actor, dt);
    }
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

function isCrateTile(cell) {
  return cell === "crate" || cell === "supply_crate" || cell === "golden_crate";
}

function isTileOutsideNextZone(tx, ty) {
  if (!isBattleRoyale(currentRoomMode) || !currentBRZone) return false;
  const px = tx * TILE + TILE / 2;
  const py = ty * TILE + TILE / 2;
  return Math.hypot(px - currentBRZone.nextX, py - currentBRZone.nextY) > currentBRZone.nextRadius;
}

function isPixelOutsideNextZone(px, py) {
  if (!isBattleRoyale(currentRoomMode) || !currentBRZone) return false;
  return Math.hypot(px - currentBRZone.nextX, py - currentBRZone.nextY) > currentBRZone.nextRadius;
}

function isCrateOnPathToTarget(bot, tile, target) {
  if (!target) return false;
  const currentDist = Math.abs(target.x - tile.x) + Math.abs(target.y - tile.y);
  const rows = map ? map.length : ROWS;
  const cols = map && map[0] ? map[0].length : COLS;
  return neighbors(tile.x, tile.y).some((n) => {
    if (n.x < 1 || n.x >= cols - 1 || n.y < 1 || n.y >= rows - 1) return false;
    if (!isCrateTile(map[n.y]?.[n.x])) return false;
    const nDist = Math.abs(target.x - n.x) + Math.abs(target.y - n.y);
    return nDist < currentDist;
  });
}

let botsWhoThoughtThisFrame = 0;

function updateAi(bot, dt) {
  // Handle bot healing casting progress
  if (bot.healingState) {
    const here = gridAt(bot.x, bot.y);
    if (isBombOrBlastDanger(here.x, here.y) || getLocalBotThreatScore(here.x, here.y) > 0) {
      showToastMsg(`${bot.name}'s healing was interrupted!`);
      bot.healingState = null;
    } else {
      bot.healingState.timeLeft -= dt;
      bot.aiDir = { x: 0, y: 0 };
      bot.dx = 0;
      bot.dy = 0;
      if (bot.healingState.timeLeft <= 0) {
        const itemType = bot.healingState.itemType;
        bot.healingState = null;
        if (itemType === "medkit") {
          bot.medkitCount = Math.max(0, (bot.medkitCount || 0) - 1);
          bot.hp = 100;
          showToastMsg(`${bot.name} used a Med Kit!`);
        } else if (itemType === "bandage") {
          bot.bandageCount = Math.max(0, (bot.bandageCount || 0) - 1);
          bot.hp = Math.min(75, bot.hp + 15);
          showToastMsg(`${bot.name} used a Bandage!`);
        } else if (itemType === "energy_drink") {
          bot.energyDrinkCount = Math.max(0, (bot.energyDrinkCount || 0) - 1);
          bot.shield = Math.min(100, (bot.shield || 0) + 50);
          showToastMsg(`${bot.name} drank an Energy Drink!`);
        }
        updateHudSidebar();
      }
      moveActor(bot, 0, 0, dt);
      return;
    }
  }

  // Trigger bot healing behavior in BR mode
  if (isBattleRoyale(currentRoomMode) && bot.alive && !bot.healingState) {
    const here = gridAt(bot.x, bot.y);
    const inStorm = isPixelOutsideZone(bot.x, bot.y);
    const hasBombDanger = isBombOrBlastDanger(here.x, here.y) || getLocalBotThreatScore(here.x, here.y) > 0;
    if (!hasBombDanger) {
      // If in storm, only heal if HP is dangerously low (<= 40)
      // If in safe zone, heal if HP < 75 or shield < 50
      const shouldHeal = inStorm ? (bot.hp <= 40) : (bot.hp < 75 || (bot.shield || 0) < 50);
      if (shouldHeal) {
        let itemType = null;
        let duration = 2.0;
        
        if (bot.hp <= 40 && (bot.medkitCount || 0) > 0) {
          itemType = "medkit";
        } else if ((bot.bandageCount || 0) > 0 && bot.hp < 75) {
          itemType = "bandage";
        } else if ((bot.energyDrinkCount || 0) > 0 && (bot.shield || 0) < 50) {
          itemType = "energy_drink";
        }
        
        if (itemType) {
          bot.healingState = { itemType, duration, timeLeft: duration };
          bot.aiDir = { x: 0, y: 0 };
          bot.dx = 0;
          bot.dy = 0;
          moveActor(bot, 0, 0, dt);
          return;
        }
      }
    }
  }

  bot.aiThink = (bot.aiThink || 0) - dt;
  const here = gridAt(bot.x, bot.y);
  const danger = isDanger(here.x, here.y);
  const threatScore = getLocalBotThreatScore(here.x, here.y);
  const isThreatened = threatScore > 0 || danger;
  const isBombThreat = isBombOrBlastDanger(here.x, here.y) || threatScore > 0;

  // Human-like movement constraint:
  // If the bot is mid-tile (bot.moveTarget is set), only allow a new decision if threatened by a bomb/blast.
  // Otherwise, wait until the bot reaches the center of the tile.
  let shouldThink = false;
  if (!bot.moveTarget) {
    shouldThink = (isThreatened || bot.aiThink <= 0);
  } else {
    shouldThink = isBombThreat;
  }

  if (shouldThink) {
    bot.aiTarget = findLocalBotTarget(bot, here);
    if (botsWhoThoughtThisFrame >= 3 && !isThreatened) {
      bot.aiThink = 0.01; // try next frame
    } else {
      if (!isThreatened) {
        botsWhoThoughtThisFrame++;
      }

      if (bot.hasSlide && tryLocalBotKickStrategic(bot, here)) {
        return;
      }

      if (bot.hasPunch && tryLocalBotPunchStrategic(bot, here)) {
        bot.aiThink = 0;
        return;
      }

      const safetyDir = getSafetyStepLocal(bot, here);
      if (safetyDir) {
        bot.aiDir = safetyDir;
        // Make reaction time slightly slower on easy/hard
        if (localBotsDifficulty === "easy") {
          bot.aiThink = 0.20;
        } else if (localBotsDifficulty === "hard") {
          bot.aiThink = 0.15;
        } else if (localBotsDifficulty === "expert") {
          bot.aiThink = 0.08;
        } else {
          bot.aiThink = 0.10; // pro
        }
      } else {
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

        // Adjust direction selection based on difficulty
        let selectedDir = useful[0];
        if (localBotsDifficulty === "easy" && Math.random() < 0.50) {
          // 50% chance of random direction on Easy
          selectedDir = dirs[Math.floor(Math.random() * dirs.length)];
        } else if (localBotsDifficulty === "hard" && Math.random() < 0.15) {
          // 15% chance of picking second best choice on Hard
          selectedDir = useful[1] || useful[0];
        }

        bot.aiDir = selectedDir;

        // Adjust thinking intervals (reaction speed)
        if (localBotsDifficulty === "easy") {
          bot.aiThink = danger ? 0.25 : 0.35 + Math.random() * 0.25;
        } else if (localBotsDifficulty === "hard") {
          bot.aiThink = danger ? 0.18 : 0.22 + Math.random() * 0.15;
        } else if (localBotsDifficulty === "expert") {
          bot.aiThink = danger ? 0.08 : 0.12 + Math.random() * 0.10;
        } else {
          // pro (default)
          bot.aiThink = danger ? 0.12 : 0.16 + Math.random() * 0.12;
        }
      }
    }
  }

  const moved = moveActor(bot, bot.aiDir.x, bot.aiDir.y, dt);
  if (!moved) bot.aiThink = 0;

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
  const nearbyEnemy = getLocalBotEnemies(bot).some((other) => other.alive && distanceTiles(tile, gridAt(other.x, other.y)) <= Math.max(2, bot.range || 2));
  const canAttackEnemy = hasEnemyInBombLineLocal(bot, tile);
  // Consider bombing adjacent crates if they lie on path to enemy or on path to bot's current target
  const target = bot.aiTarget;
  const strategicCrate = !canAttackEnemy && !nearbyEnemy
    ? (isCrateOnPathToEnemy(bot, tile) || isCrateOnPathToTarget(bot, tile, target))
    : neighbors(tile.x, tile.y).some((n) => isCrateTile(map[n.y]?.[n.x]));
  
  if ((canAttackEnemy || strategicCrate || nearbyEnemy) && !danger && hasEscapeTileLocal(bot, tile) && shouldLocalBotBomb(bot, tile, canAttackEnemy, strategicCrate, nearbyEnemy)) {
    if (localMode) localPlaceBomb(bot);
    else sendServerMessage("place_bomb", { id: bot.id });
    
    const activeBombsCount = bombs.filter(b => b.ownerId === bot.id).length;
    if (activeBombsCount < bot.bombs && (nearbyEnemy || canAttackEnemy)) {
      bot.aiBombCooldown = 0.08 + Math.random() * 0.08;
    } else {
      bot.aiBombCooldown = 0.7 + Math.random() * 0.5;
    }
    bot.aiThink = 0;
  }
}

function tryLocalBotPunchStrategic(bot, tile) {
  if (!bot.hasPunch || !bot.alive) return false;
  if (localBotsDifficulty === "easy") return false;

  const roll = Math.random();
  if (localBotsDifficulty === "hard" && roll > 0.50) return false;
  if (localBotsDifficulty === "pro" && roll > 0.85) return false;

  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  for (const d of dirs) {
    const tx = tile.x + d.x;
    const ty = tile.y + d.y;
    const bomb = bombs.find((b) => b.x === tx && b.y === ty && (!b.vx || (b.vx === 0 && b.vy === 0)));
    if (!bomb) continue;
    if (isTileSolidForBombLocal(bomb.x + d.x, bomb.y + d.y)) continue;
    
    const enemies = getLocalBotEnemies(bot);
    const targetsEnemy = enemies.some((enemy) => {
      const enemyTile = gridAt(enemy.x, enemy.y);
      return (d.x !== 0 && enemyTile.y === bomb.y && Math.sign(enemyTile.x - bomb.x) === d.x) ||
             (d.y !== 0 && enemyTile.x === bomb.x && Math.sign(enemyTile.y - bomb.y) === d.y);
    });
    const threatensUs = localBombThreatensTileAnyTimer(bomb, tile.x, tile.y);
    const inDanger = getLocalBotThreatScore(tile.x, tile.y) > 0 || isDanger(tile.x, tile.y);
    
    if (targetsEnemy || threatensUs || inDanger) {
      bot.lastFacingDir = d;
      triggerLocalPunch(bot);
      return true;
    }
  }
  return false;
}

function getSafetyStepLocal(bot, here) {
  if (getLocalBotThreatScore(here.x, here.y) === 0 && !isDanger(here.x, here.y)) {
    return null;
  }
  let maxDepth = 10;
  if (localBotsDifficulty === "easy") maxDepth = 4;
  else if (localBotsDifficulty === "pro") maxDepth = 14;
  else if (localBotsDifficulty === "expert") maxDepth = 18;

  const queue = [{ x: here.x, y: here.y, path: [] }];
  const seen = new Set([`${here.x},${here.y}`]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (getLocalBotThreatScore(current.x, current.y) === 0 && !isDanger(current.x, current.y)) {
      if (current.path.length > 0) {
        return current.path[0];
      }
      return null;
    }
    if (current.path.length >= maxDepth) continue;
    const dirs = neighbors(current.x, current.y);
    for (const dir of dirs) {
      const key = `${dir.x},${dir.y}`;
      if (seen.has(key)) continue;
      if (isSolid(dir.x, dir.y, bot)) continue;
      seen.add(key);
      queue.push({
        x: dir.x,
        y: dir.y,
        path: current.path.concat({ x: dir.x - current.x, y: dir.y - current.y })
      });
    }
  }
  return null;
}

// Returns true when a crate adjacent to the bot is on a direct path toward the nearest enemy
function isCrateOnPathToEnemy(bot, tile) {
  const enemies = getLocalBotEnemies(bot);
  if (!enemies.length) return false;
  const nearest = enemies
    .map(e => ({ e, dist: distanceTiles(tile, gridAt(e.x, e.y)) }))
    .sort((a, b) => a.dist - b.dist)[0];
  if (!nearest) return false;
  const et = gridAt(nearest.e.x, nearest.e.y);
  return neighbors(tile.x, tile.y).some(n => {
    if (!isCrateTile(map[n.y]?.[n.x])) return false;
    // The crate is "on path" if it sits between bot and enemy in the same row or column
    const dx = Math.sign(et.x - tile.x);
    const dy = Math.sign(et.y - tile.y);
    return (dx !== 0 && n.y === tile.y && n.x === tile.x + dx) ||
           (dy !== 0 && n.x === tile.x && n.y === tile.y + dy);
  });
}

function shouldLocalBotBomb(bot, tile, canAttackEnemy, strategicCrate, nearbyEnemy) {
  if ((bot.aiBombCooldown || 0) > 0) return false;

  // Always bomb when we have a clean shot at an enemy
  if (canAttackEnemy) return true;

  // Enemy is adjacent/very close — high aggression
  if (nearbyEnemy) {
    const enemies = getLocalBotEnemies(bot);
    const nearestDist = enemies.reduce((min, enemy) => {
      return Math.min(min, distanceTiles(tile, gridAt(enemy.x, enemy.y)));
    }, 999);
    // Difficulty-scaled aggression when enemy is close
    if (nearestDist <= 1) {
      if (localBotsDifficulty === "easy")   return Math.random() < 0.40;
      if (localBotsDifficulty === "hard")   return Math.random() < 0.65;
      if (localBotsDifficulty === "expert") return Math.random() < 0.95;
      return Math.random() < 0.82; // pro
    }
    if (nearestDist <= 2) {
      if (localBotsDifficulty === "easy")   return Math.random() < 0.20;
      if (localBotsDifficulty === "hard")   return Math.random() < 0.45;
      if (localBotsDifficulty === "expert") return Math.random() < 0.80;
      return Math.random() < 0.65; // pro
    }
    return false;
  }

  // Only bomb a strategic crate if we have safe exits (don't trap ourselves)
  // We reduce safe exits requirement to >= 1 to allow escaping corridors of width 1, as escapeTile BFS ensures safety.
  if (strategicCrate && countLocalSafeExits(bot, tile.x, tile.y) >= 1) {
    const urgent = isPixelOutsideNextZone(bot.x, bot.y);
    if (urgent) return Math.random() < 0.85; // high urgency if outside safe zone!
    if (localBotsDifficulty === "easy")   return Math.random() < 0.12;
    if (localBotsDifficulty === "hard")   return Math.random() < 0.25;
    if (localBotsDifficulty === "expert") return Math.random() < 0.55;
    return Math.random() < 0.38; // pro
  }

  return false;
}

function scoreAiMove(bot, x, y) {
  if (isSolid(x, y, bot)) return -9999;
  // Small random jitter so bots don't always pick the same path
  let score = Math.random() * 1.5;
  const here = gridAt(bot.x, bot.y);
  // Discourage standing still
  if (x === here.x && y === here.y) score -= 80;

  const threat = getLocalBotThreatScore(x, y);
  score -= threat;
  if (threat >= 1200) return score;

  const safeExits = countLocalSafeExits(bot, x, y);
  score += safeExits * 38;
  if (safeExits === 0) score -= 320;

  // Storm/safe zone penalty for Battle Royale with difficulty scaling
  if (isBattleRoyale(currentRoomMode) && currentBRZone) {
    const tx = x * TILE + TILE / 2;
    const ty = y * TILE + TILE / 2;
    const distToZoneCenter = Math.hypot(tx - currentBRZone.x, ty - currentBRZone.y);
    const botInStorm = isPixelOutsideZone(bot.x, bot.y);
    
    if (distToZoneCenter > currentBRZone.radius) {
      // Massive penalty if we step into/stay in the storm
      let stormPenalty = botInStorm ? 1500 : 300;
      if (localBotsDifficulty === "hard") stormPenalty = botInStorm ? 2000 : 500;
      else if (localBotsDifficulty === "pro") stormPenalty = botInStorm ? 3000 : 700;
      else if (localBotsDifficulty === "expert") stormPenalty = botInStorm ? 4000 : 900;
      
      score -= stormPenalty;
      
      // If the bot is already in the storm, prioritize moving closer to the next safe zone center
      if (botInStorm) {
        const nextDist = Math.hypot(tx - currentBRZone.nextX, ty - currentBRZone.nextY);
        const botNextDist = Math.hypot(bot.x - currentBRZone.nextX, bot.y - currentBRZone.nextY);
        if (nextDist < botNextDist) {
          score += 1000;
        } else {
          score -= 1000;
        }
      }
    } else {
      score += 150;
      // If bot is in the storm and this tile is in the safe zone, give it a massive bonus!
      if (botInStorm) {
        score += 2000;
      }
      const nextDist = Math.hypot(tx - currentBRZone.nextX, ty - currentBRZone.nextY);
      score += Math.max(0, 100 - (nextDist / TILE) * 3);
    }
    
    // Also prioritize next safe zone if bot is outside it (even if not in storm yet)
    const botInNextStorm = isPixelOutsideNextZone(bot.x, bot.y);
    if (botInNextStorm) {
      const nextDist = Math.hypot(tx - currentBRZone.nextX, ty - currentBRZone.nextY);
      const botNextDist = Math.hypot(bot.x - currentBRZone.nextX, bot.y - currentBRZone.nextY);
      if (nextDist < botNextDist) {
        score += 800;
      } else {
        score -= 800;
      }
    }
  }

  // Pickups are attractive
  const pickup = pickups.find((p) => p.x === x && p.y === y);
  if (pickup) score += pickup.type === "full_fire" || pickup.type === "punch" || pickup.type === "slide" ? 200 : 140;

  // Crate adjacency is only useful if we can safely escape after bombing
  if (neighbors(x, y).some((n) => isCrateTile(map[n.y]?.[n.x]))) {
    score += hasEscapeTileLocal(bot, { x, y }) ? 30 : -120;
  }

  const enemies = getLocalBotEnemies(bot);
  if (enemies.length) {
    const nearest = enemies
      .map((enemy) => ({ enemy, dist: distanceTiles({ x, y }, gridAt(enemy.x, enemy.y)) }))
      .sort((a, b) => a.dist - b.dist)[0];
    const nearestDist = nearest.dist;
    // Strong pull toward enemy: closer is better
    score += Math.max(0, 160 - nearestDist * 18);

    const enemyTile = gridAt(nearest.enemy.x, nearest.enemy.y);
    // Big bonus for being in the same row/col as enemy within bomb range — this is the attack position
    if (nearestDist <= (bot.range || 2) + 1) {
      if (x === enemyTile.x || y === enemyTile.y) {
        // Check no wall/crate is blocking the line
        const lineBlocked = (() => {
          const dx = Math.sign(enemyTile.x - x);
          const dy = Math.sign(enemyTile.y - y);
          for (let i = 1; i < nearestDist; i++) {
            const cell = map[y + dy * i]?.[x + dx * i];
            if (cell === "wall" || cell === "crate" || cell === "supply_crate" || cell === "golden_crate") return true;
          }
          return false;
        })();
        if (!lineBlocked && hasEscapeTileLocal(bot, { x, y })) {
          score += 180; // This tile lets us shoot the enemy — strongly preferred
        }
      }
    }

    // Mild penalty for moving away from all enemies (avoid pure retreat unless threatened)
    const curDist = distanceTiles(here, enemyTile);
    if (nearestDist > curDist + 1 && getLocalBotThreatScore(here.x, here.y) === 0) {
      score -= 30;
    }
  }

  // High-priority target tracking using cached target (enemies > pickups > crates)
  const target = bot.aiTarget;
  if (target) {
    let dist;
    if (localBotsDifficulty === "easy") {
      dist = Math.abs(target.x - x) + Math.abs(target.y - y);
    } else {
      dist = getDijkstraPathDistance({ x, y }, target);
      if (dist === 999) {
        // Fallback to Manhattan + penalty for unreachable
        dist = 1000 + (Math.abs(target.x - x) + Math.abs(target.y - y));
      }
    }
    score += Math.max(0, 140 - dist * 15);
  }

  return score;
}

function getLocalBotEnemies(bot) {
  return players.filter((other) => other !== bot && other.alive);
}

function getLocalBotThreatScore(x, y) {
  if (map[y]?.[x] === "zone") return 2200;
  if (blasts.some((blast) => blast.cells.some((cell) => cell.x === x && cell.y === y))) return 2600;
  let score = 0;
  bombs.forEach((bomb) => {
    if (!localBombThreatensTileAnyTimer(bomb, x, y)) return;
    if (bomb.timer < 0.75) score = Math.max(score, 2400);
    else if (bomb.timer < 1.35) score = Math.max(score, 1500);
    else score = Math.max(score, 420);
  });
  return score;
}

function localBombThreatensTileAnyTimer(bomb, x, y) {
  if (bomb.x === x && bomb.y === y) return true;
  if (bomb.x !== x && bomb.y !== y) return false;
  const distance = Math.abs(bomb.x - x) + Math.abs(bomb.y - y);
  if (distance > bomb.range) return false;
  const stepX = Math.sign(x - bomb.x);
  const stepY = Math.sign(y - bomb.y);
  for (let i = 1; i <= distance; i += 1) {
    const tile = map[bomb.y + stepY * i]?.[bomb.x + stepX * i];
    if (tile === "wall") return false;
    if (tile === "crate" || tile === "supply_crate" || tile === "golden_crate") return i === distance;
  }
  return true;
}

function countLocalSafeExits(bot, x, y) {
  return neighbors(x, y).filter((n) => !isSolid(n.x, n.y, bot) && getLocalBotThreatScore(n.x, n.y) < 1000).length;
}

function findLocalBotTarget(bot, here) {
  const enemies = getLocalBotEnemies(bot).map((enemy) => ({ ...gridAt(enemy.x, enemy.y), weight: 4 }));
  const loot = pickups.map((pickup) => ({
    x: pickup.x,
    y: pickup.y,
    weight: pickup.type === "full_fire" || pickup.type === "punch" || pickup.type === "slide" ? 5 : 3,
  }));
  
  const rows = map ? map.length : ROWS;
  const cols = map && map[0] ? map[0].length : COLS;
  const crates = [];
  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < cols - 1; x += 1) {
      if (isCrateTile(map[y][x])) crates.push({ x, y, weight: 1 });
    }
  }

  let targets = [...loot, ...enemies, ...crates];
  if (isBattleRoyale(currentRoomMode) && currentBRZone) {
    // Filter out targets that are outside the next safe zone, so bots prioritize moving into/staying in the next safe zone
    targets = targets.filter((target) => !isTileOutsideNextZone(target.x, target.y));

    // If bot is outside the next safe zone, add the next safe zone center as a top-priority target
    if (isPixelOutsideNextZone(bot.x, bot.y)) {
      const targetX = Math.floor(currentBRZone.nextX / TILE);
      const targetY = Math.floor(currentBRZone.nextY / TILE);
      if (targetX > 0 && targetX < cols - 1 && targetY > 0 && targetY < rows - 1) {
        let tx = targetX;
        let ty = targetY;
        if (isSolid(tx, ty, bot)) {
          let found = false;
          const searchRadius = 5;
          for (let r = 1; r <= searchRadius && !found; r++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              for (let dy = -r; dy <= r && !found; dy++) {
                if (Math.abs(dx) === r || Math.abs(dy) === r) {
                  const nx = targetX + dx;
                  const ny = targetY + dy;
                  if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && !isSolid(nx, ny, bot)) {
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

  let validTargets = targets.filter((target) => getLocalBotThreatScore(target.x, target.y) < 1000);
  
  if (validTargets.length === 0) {
    // Fallback: wander to a random walkable tile inside the safe zone (if BR) or the whole map (if not BR)
    let foundWanderTarget = false;
    let attempts = 0;
    while (!foundWanderTarget && attempts < 30) {
      attempts++;
      const rx = Math.floor(1 + Math.random() * (cols - 2));
      const ry = Math.floor(1 + Math.random() * (rows - 2));
      if (!isSolid(rx, ry, bot)) {
        if (isBattleRoyale(currentRoomMode) && currentBRZone) {
          if (isTileOutsideNextZone(rx, ry)) continue;
        }
        validTargets.push({ x: rx, y: ry, weight: 1 });
        foundWanderTarget = true;
      }
    }
  }

  return validTargets
    .map((target) => {
      let dist;
      if (localBotsDifficulty === "easy") {
        dist = Math.abs(target.x - here.x) + Math.abs(target.y - here.y);
      } else {
        dist = getDijkstraPathDistance(here, target);
        if (dist === 999) {
          dist = 1000 + (Math.abs(target.x - here.x) + Math.abs(target.y - here.y));
        }
      }
      return { ...target, dist };
    })
    .filter((target) => target.dist < 9999)
    .sort((a, b) => (b.weight * 24 - b.dist) - (a.weight * 24 - a.dist))[0] || null;
}

function hasEnemyInBombLineLocal(bot, tile) {
  return players.some((enemy) => {
    if (enemy === bot || !enemy.alive) return false;
    const enemyTile = gridAt(enemy.x, enemy.y);
    if (enemyTile.x !== tile.x && enemyTile.y !== tile.y) return false;
    const dx = Math.sign(enemyTile.x - tile.x);
    const dy = Math.sign(enemyTile.y - tile.y);
    const distance = Math.abs(enemyTile.x - tile.x) + Math.abs(enemyTile.y - tile.y);
    if (distance > (bot.range || 2)) return false;
    for (let i = 1; i < distance; i += 1) {
      if (isMapSolid(tile.x + dx * i, tile.y + dy * i)) return false;
    }
    return true;
  });
}

function hasEscapeTileLocal(bot, tile) {
  const queue = [{ x: tile.x, y: tile.y, depth: 0 }];
  const seen = new Set([`${tile.x},${tile.y}`]);
  const dirs = neighbors(0, 0);
  while (queue.length) {
    const current = queue.shift();
    if (current.depth > 0 && !wouldLocalBombThreatenTile(tile, current.x, current.y, bot.range || 2) && !isDanger(current.x, current.y)) {
      return true;
    }
    if (current.depth >= 6) continue;
    dirs.forEach((dir) => {
      const x = current.x + dir.x;
      const y = current.y + dir.y;
      const key = `${x},${y}`;
      if (seen.has(key) || isSolid(x, y, bot)) return;
      seen.add(key);
      queue.push({ x, y, depth: current.depth + 1 });
    });
  }
  return false;
}

function wouldLocalBombThreatenTile(bombTile, x, y, range) {
  if (bombTile.x === x && bombTile.y === y) return true;
  if (bombTile.x !== x && bombTile.y !== y) return false;
  const dx = Math.sign(x - bombTile.x);
  const dy = Math.sign(y - bombTile.y);
  const distance = Math.abs(x - bombTile.x) + Math.abs(y - bombTile.y);
  if (distance > range) return false;
  for (let i = 1; i <= distance; i += 1) {
    const cell = map[bombTile.y + dy * i]?.[bombTile.x + dx * i];
    if (!cell || cell === "wall" || cell === "crate") return false;
  }
  return true;
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

function getDijkstraPathDistance(start, end) {
  const dists = {};
  const visited = new Set();
  const startKey = `${start.x},${start.y}`;
  dists[startKey] = 0;
  
  const queue = [{ x: start.x, y: start.y, dist: 0 }];
  
  while (queue.length > 0) {
    queue.sort((a, b) => a.dist - b.dist);
    const current = queue.shift();
    const currentKey = `${current.x},${current.y}`;
    
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    
    if (current.x === end.x && current.y === end.y) {
      return current.dist;
    }
    
    if (current.dist >= 40) continue;
    
    const dirs = neighbors(current.x, current.y);
    for (const dir of dirs) {
      if (dir.x < 1 || dir.x >= COLS - 1 || dir.y < 1 || dir.y >= ROWS - 1) continue;
      
      const cell = map[dir.y]?.[dir.x];
      if (cell === "wall" || cell === "zone") continue;
      
      let stepCost = 1;
      if (cell === "crate" || cell === "supply_crate" || cell === "golden_crate") {
        stepCost = 7;
      }
      
      const nextDist = current.dist + stepCost;
      const key = `${dir.x},${dir.y}`;
      if (!(key in dists) || nextDist < dists[key]) {
        dists[key] = nextDist;
        queue.push({ x: dir.x, y: dir.y, dist: nextDist });
      }
    }
  }
  
  return 999;
}

function tryLocalBotKickStrategic(bot, tile) {
  if (!bot.hasSlide || !bot.alive) return false;
  if (localBotsDifficulty === "easy") return false;
  
  const roll = Math.random();
  if (localBotsDifficulty === "hard" && roll > 0.50) return false;
  if (localBotsDifficulty === "pro" && roll > 0.85) return false;
  
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  for (const d of dirs) {
    const tx = tile.x + d.x;
    const ty = tile.y + d.y;
    const bomb = bombs.find((b) => b.x === tx && b.y === ty && (!b.vx || (b.vx === 0 && b.vy === 0)));
    if (!bomb) continue;
    if (isTileSolidForBombLocal(bomb.x + d.x, bomb.y + d.y)) continue;
    
    const enemies = getLocalBotEnemies(bot);
    const targetsEnemy = enemies.some((enemy) => {
      const enemyTile = gridAt(enemy.x, enemy.y);
      return (d.x !== 0 && enemyTile.y === bomb.y && Math.sign(enemyTile.x - bomb.x) === d.x) ||
             (d.y !== 0 && enemyTile.x === bomb.x && Math.sign(enemyTile.y - bomb.y) === d.y);
    });
    const threatensUs = localBombThreatensTileAnyTimer(bomb, tile.x, tile.y);
    const inDanger = getLocalBotThreatScore(tile.x, tile.y) > 0 || isDanger(tile.x, tile.y);
    
    if (targetsEnemy || threatensUs || inDanger) {
      bot.aiDir = d;
      bot.aiThink = 0.08;
      return true;
    }
  }
  return false;
}

function isTileOutsideZone(tx, ty) {
  if (!isBattleRoyale(currentRoomMode) || !currentBRZone) return false;
  const px = tx * TILE + TILE / 2;
  const py = ty * TILE + TILE / 2;
  return Math.hypot(px - currentBRZone.x, py - currentBRZone.y) > currentBRZone.radius;
}

function isPixelOutsideZone(px, py) {
  if (!isBattleRoyale(currentRoomMode) || !currentBRZone) return false;
  return Math.hypot(px - currentBRZone.x, py - currentBRZone.y) > currentBRZone.radius;
}

function isBombOrBlastDanger(x, y) {
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

function isDanger(x, y) {
  if (isBombOrBlastDanger(x, y)) return true;
  if (isTileOutsideZone(x, y)) return true;
  return false;
}

// ----------------------------------------------------------------
// CLIENT PARTICLE GENERATORS
// ----------------------------------------------------------------

function burstCrate(x, y) {
  brMinimapCacheDirty = true;
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
    const isBackPose = dy < 0 && Math.abs(dy) >= Math.abs(dx);
    const isSidePose = Math.abs(dx) > Math.abs(dy);
    
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
      if (isSidePose && spriteSet.walk_side1 && spriteSet.walk_side2) {
        frame1 = spriteSet.walk_side1;
        frame2 = spriteSet.walk_side2;
      } else if (isBackPose) {
        // Walking UP (back) - keep at good size
        frame1 = spriteSet.walk_back1;
        frame2 = spriteSet.walk_back2;
      } else {
        // Walking DOWN - make bigger
        frame1 = spriteSet.walk_front1;
        frame2 = spriteSet.walk_front2;
      }
      
      // Time-based walking cycle for smooth constant leg-switch and bounce timing
      const walkAngle = t * 18.6;
      img = (Math.floor(walkAngle / Math.PI) % 2 === 0) ? frame1 : frame2;
      
      const bobFactor = Math.abs(Math.sin(walkAngle)); 
      const bounceScaleY = 0.99 + 0.02 * bobFactor; 
      const bounceScaleX = 1.005 - 0.01 * bobFactor;
      const bobY = -bobFactor * 1.8; 
      const wiggleAngle = 0; 
      
      actx.translate(0, bobY);
      actx.rotate(wiggleAngle);
      if (isSidePose && dx > 0) {
        actx.scale(-1, 1);
      } else if (rotation !== 0) {
        actx.rotate(rotation);
      }
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
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawMiniMapPreview(canvas, mapType) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cols = 15;
  const rows = 13;
  const tw = canvas.width / cols;
  const th = canvas.height / rows;

  // Clear background
  ctx.fillStyle = "#221f25";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * tw;
      const py = y * th;
      const isWall = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;

      // 1. Draw floor
      let floorColor = "#93dc99";
      const isLight = (x + y) % 2 === 0;
      if (mapType === "classic") {
        floorColor = isLight ? "#a8e8a4" : "#93dc99";
      } else if (mapType === "checkered") {
        floorColor = isLight ? "#b0ecff" : "#8adcf8";
      } else if (mapType === "colosseum") {
        floorColor = isLight ? "#e8a88e" : "#d4927a";
      } else if (mapType === "powerzone") {
        floorColor = isLight ? "#80e1fe" : "#00bfff";
      }

      ctx.fillStyle = floorColor;
      ctx.fillRect(px, py, tw, th);

      // 2. Draw wall blocks
      let drawWall = false;

      if (isWall) {
        drawWall = true;
      } else if (mapType === "colosseum") {
        if ((x === 3 || x === cols - 4) && (y === 3 || y === rows - 4)) {
          drawWall = true;
        }
      } else if (mapType === "powerzone") {
        const isPowerLane = x === 1 || y === 1 || x === cols - 2 || y === rows - 2;
        const isCrateRing = x === 2 || y === 2 || x === cols - 3 || y === rows - 3;
        if (!isPowerLane && !isCrateRing && x % 2 === 0 && y % 2 === 0) {
          drawWall = true;
        }
      } else {
        if (x % 2 === 0 && y % 2 === 0) {
          drawWall = true;
        }
      }

      if (drawWall) {
        if (mapType === "checkered" || mapType === "powerzone") {
          ctx.fillStyle = "#d1a31d";
          ctx.fillRect(px, py, tw, th);
          ctx.fillStyle = "#ffd84a";
          ctx.fillRect(px + 1, py + 1, tw - 2, th - 2);
        } else if (mapType === "colosseum") {
          ctx.fillStyle = "#555562";
          ctx.fillRect(px, py, tw, th);
          ctx.fillStyle = "#8a8a9a";
          ctx.fillRect(px + 1, py + 1, tw - 2, th - 2);
        } else {
          ctx.fillStyle = "#5c3d24";
          ctx.fillRect(px, py, tw, th);
          ctx.fillStyle = "#8b5e3c";
          ctx.fillRect(px + 1, py + 1, tw - 2, th - 2);
        }
      } else {
        // 3. Draw soft blocks (crates) / items / spawn areas
        let isCrate = false;
        if (mapType === "powerzone") {
          const isPowerLane = x === 1 || y === 1 || x === cols - 2 || y === rows - 2;
          const isCrateRing = x === 2 || y === 2 || x === cols - 3 || y === rows - 3;
          if (!isPowerLane) {
            if (isCrateRing) isCrate = true;
          } else {
            // Draw mini power-ups around the full perimeter power lane.
            let itemColor = null;
            if ((x + y) % 4 === 0) itemColor = "#ff7c55"; // Flame
            else if ((x + y) % 4 === 1) itemColor = "#7466e8"; // Bomb
            else if ((x + y) % 4 === 2) itemColor = "#ffe140"; // Speed
            else itemColor = "#ff69b4"; // Punch

            ctx.fillStyle = itemColor;
            ctx.beginPath();
            ctx.moveTo(px + tw / 2, py + th * 0.12);
            ctx.lineTo(px + tw * 0.88, py + th / 2);
            ctx.lineTo(px + tw / 2, py + th * 0.88);
            ctx.lineTo(px + tw * 0.12, py + th / 2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#221f25";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } else {
          const isSpawn = (x <= 2 && y <= 2) || (x >= cols - 3 && y <= 2) || (x <= 2 && y >= rows - 3) || (x >= cols - 3 && y >= rows - 3);
          if (!isSpawn && (x * y) % 2 === 0) {
            isCrate = true;
          }
        }

        if (isCrate) {
          if (mapType === "powerzone" || mapType === "checkered") {
            ctx.fillStyle = "#9a2a2a";
            ctx.fillRect(px + 1, py + 1, tw - 2, th - 2);
            ctx.fillStyle = "#d9534f";
            ctx.fillRect(px + 2, py + 2, tw - 4, th - 4);
          } else {
            ctx.fillStyle = "#8c6239";
            ctx.fillRect(px + 1, py + 1, tw - 2, th - 2);
            ctx.fillStyle = "#c69c6d";
            ctx.fillRect(px + 2, py + 2, tw - 4, th - 4);
          }
        }
      }
    }
  }
}

function isPixelVisible(px, py, margin = 48) {
  if (!isBattleRoyale(currentRoomMode)) return true;
  const zoom = 1.6;
  const visibleWidth = CANVAS_WIDTH / zoom;
  const visibleHeight = CANVAS_HEIGHT / zoom;
  return px >= cameraCenterX - visibleWidth / 2 - margin &&
         px <= cameraCenterX + visibleWidth / 2 + margin &&
         py >= cameraCenterY - visibleHeight / 2 - margin &&
         py <= cameraCenterY + visibleHeight / 2 + margin;
}

function isTileVisible(tx, ty, margin = 1) {
  if (!isBattleRoyale(currentRoomMode)) return true;
  const zoom = 1.6;
  const visibleWidth = CANVAS_WIDTH / zoom;
  const visibleHeight = CANVAS_HEIGHT / zoom;
  const px = tx * TILE + TILE / 2;
  const py = ty * TILE + TILE / 2;
  return px >= cameraCenterX - visibleWidth / 2 - margin * TILE &&
         px <= cameraCenterX + visibleWidth / 2 + margin * TILE &&
         py >= cameraCenterY - visibleHeight / 2 - margin * TILE &&
         py <= cameraCenterY + visibleHeight / 2 + margin * TILE;
}

function drawMap() {
  const cols = map[0] ? map[0].length : COLS;
  const rows = map ? map.length : ROWS;
  ctx.fillStyle = (currentMapType === "checkered" || currentMapType === "powerzone") ? "#80e1fe" : currentMapType === "colosseum" ? "#df9376" : "#9fe39e";
  roundedRect(0, 0, cols * TILE, rows * TILE, 12, true, false);

  if (isBattleRoyale(currentRoomMode)) {
    const zoom = 1.6;
    const visibleWidth = CANVAS_WIDTH / zoom;
    const visibleHeight = CANVAS_HEIGHT / zoom;
    const minX = cameraCenterX - visibleWidth / 2;
    const minY = cameraCenterY - visibleHeight / 2;
    const maxX = cameraCenterX + visibleWidth / 2;
    const maxY = cameraCenterY + visibleHeight / 2;

    const startX = Math.max(0, Math.floor(minX / TILE) - 1);
    const endX = Math.min(cols - 1, Math.floor(maxX / TILE) + 1);
    const startY = Math.max(0, Math.floor(minY / TILE) - 1);
    const endY = Math.min(rows - 1, Math.floor(maxY / TILE) + 1);

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        if (map[y] && map[y][x]) {
          drawTile(x, y, map[y][x]);
        }
      }
    }
  } else {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (map[y] && map[y][x]) {
          drawTile(x, y, map[y][x]);
        }
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
  } else if (currentMapType === "powerzone") {
    // Cyan / Blue Checkered Floor
    const isLight = (x + y) % 2 === 0;
    const isPowerLane = isPowerZoneLaneTile(x, y);
    ctx.fillStyle = isPowerLane ? (isLight ? "#b8f3ff" : "#45dfff") : (isLight ? "#80e1fe" : "#00bfff");
    ctx.fillRect(px, py, TILE, TILE);
    if (isPowerLane) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
      roundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 8, true, false);
      ctx.strokeStyle = "rgba(255, 216, 111, 0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 5, py + 5, TILE - 10, TILE - 10);
      ctx.restore();
    }
    
    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, TILE, TILE);
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
    if (currentMapType === "checkered" || currentMapType === "powerzone") {
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
  } else if (type === "supply_crate") {
    ctx.save();
    ctx.fillStyle = "#2c3e50"; // Dark blue-gray border
    roundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 6, true, true);
    ctx.fillStyle = "#34495e"; // Lighter body
    roundedRect(px + 7, py + 7, TILE - 14, TILE - 14, 4, true, true);
    
    // Draw cross straps (bright yellow/orange)
    ctx.strokeStyle = "#e67e22";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 10);
    ctx.lineTo(px + TILE - 10, py + TILE - 10);
    ctx.moveTo(px + TILE - 10, py + 10);
    ctx.lineTo(px + 10, py + TILE - 10);
    ctx.stroke();
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 12px Fredoka";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DROP", px + TILE / 2, py + TILE / 2);
    ctx.restore();
  } else if (type === "golden_crate") {
    ctx.save();
    ctx.fillStyle = "#b78a0c"; // Golden border
    roundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 6, true, true);
    ctx.fillStyle = "#f39c12"; // Golden body
    roundedRect(px + 7, py + 7, TILE - 14, TILE - 14, 4, true, true);
    
    // Shiny gold accents
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 4;
    ctx.strokeRect(px + 10, py + 10, TILE - 20, TILE - 20);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 16px Fredoka";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", px + TILE / 2, py + TILE / 2);
    ctx.restore();
  } else {
    // Minor background details
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(px + 6, py + 6, 3, 3);
    ctx.fillRect(px + TILE - 9, py + TILE - 9, 3, 3);
  }
}

function drawPickup(pickup) {
  if (!isTileVisible(pickup.x, pickup.y)) return;
  const c = centerOf(pickup.x, pickup.y);
  const isPowerZonePickup = currentMapType === "powerzone" && isPowerZoneLaneTile(pickup.x, pickup.y);
  const outerRadius = isPowerZonePickup ? 22 : 17;
  const innerRadius = isPowerZonePickup ? 14 : 11;
  ctx.save();
  ctx.translate(c.x, c.y);
  if (isPowerZonePickup) {
    ctx.save();
    ctx.fillStyle = "rgba(180, 255, 190, 0.55)";
    roundedRect(-23, -23, 46, 46, 4, true, false);
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  let color = "#35c77b";
  let label = "+";
  switch(pickup.type) {
    case "flame": color = "#ff7c55"; label = "F"; break;
    case "bomb": color = "#7466e8"; label = "B"; break;
    case "full_fire": color = "#ffe140"; label = "M"; break;
    case "punch": color = "#ff69b4"; label = "P"; break;
    case "slide": color = "#ffcf33"; label = "S"; break;
    case "speed": color = "#35c77b"; label = "SP"; break;
    case "bandage": color = "#ff5555"; label = "🩹"; break;
    case "medkit": color = "#ff2222"; label = "📦"; break;
    case "energy_drink": color = "#55dfff"; label = "🥤"; break;
    case "shield": color = "#3498db"; label = "🛡️"; break;
    case "full_armor": color = "#2ecc71"; label = "👕"; break;
    case "revive_kit": color = "#f1c40f"; label = "RV"; break;
    case "backpack": color = "#9b59b6"; label = "🎒"; break;
    case "remote_bomb": color = "#e67e22"; label = "RB"; break;
    case "mega_bomb": color = "#e74c3c"; label = "MB"; break;
    case "golden_bomb": color = "#ffd84a"; label = "GB"; break;
    case "teleport_bomb": color = "#9b59b6"; label = "TB"; break;
    case "nuke_bomb": color = "#34495e"; label = "NB"; break;
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = "#221f25";
  ctx.lineWidth = isPowerZonePickup ? 4 : 3;
  ctx.beginPath();
  if (isPowerZonePickup) {
    ctx.moveTo(0, -outerRadius);
    ctx.lineTo(outerRadius, 0);
    ctx.lineTo(0, outerRadius);
    ctx.lineTo(-outerRadius, 0);
  } else {
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (isPowerZonePickup) {
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -outerRadius + 7);
    ctx.lineTo(outerRadius - 7, 0);
    ctx.lineTo(0, outerRadius - 7);
    ctx.lineTo(-outerRadius + 7, 0);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#221f25";
  ctx.lineWidth = isPowerZonePickup ? 4 : 3;
  const isEmoji = ["🩹","📦","🥤","🛡️","👕","🎒","RV"].includes(label);
  ctx.font = `900 ${isPowerZonePickup ? (isEmoji ? 16 : 21) : (isEmoji ? 14 : 18)}px Fredoka`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(label, 0, 1);
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function drawBomb(bomb) {
  const bx = (bomb.slideX !== undefined) ? bomb.slideX : bomb.x;
  const by = (bomb.slideY !== undefined) ? bomb.slideY : bomb.y;
  if (!isTileVisible(bx, by)) return;
  const c = centerOf(bx, by);
  const scale = 1 + Math.sin(bomb.pulse) * 0.08;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(scale, scale);
  
  // Custom bomb skin colors
  let bombColor = "#25212a";
  let fuseColor = "#f9d86a";
  if (bomb.color === "pink") {
    bombColor = "#ff2f73";
    fuseColor = "#ffd86f";
  } else if (bomb.color === "blue") {
    bombColor = "#18baff";
    fuseColor = "#ffffff";
  } else if (bomb.color === "green") {
    bombColor = "#39d98a";
    fuseColor = "#ffffff";
  } else if (bomb.color === "gold") {
    bombColor = "#ffd86f";
    fuseColor = "#ffffff";
  } else if (bomb.color === "purple") {
    bombColor = "#b94cff";
    fuseColor = "#ffd86f";
  }

  ctx.fillStyle = bombColor;
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 3, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = fuseColor;
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
  
  // Custom blast skin colors
  let innerColor = "#fff06d";
  let outerColor = "#ff6f4f";
  if (blast.color === "pink") {
    outerColor = "#ff2f73";
    innerColor = "#ff9ebb";
  } else if (blast.color === "blue") {
    outerColor = "#1852e0";
    innerColor = "#18baff";
  } else if (blast.color === "green") {
    outerColor = "#1b854f";
    innerColor = "#39d98a";
  } else if (blast.color === "gold") {
    outerColor = "#d35400";
    innerColor = "#ffd86f";
  } else if (blast.color === "purple") {
    outerColor = "#5e1b85";
    innerColor = "#b94cff";
  }

  blast.cells.forEach((cell) => {
    if (!isTileVisible(cell.x, cell.y)) return;
    const c = centerOf(cell.x, cell.y);
    ctx.save();
    ctx.globalAlpha = 0.9 * alpha + 0.1;
    ctx.fillStyle = innerColor;
    ctx.strokeStyle = outerColor;
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
  // Hide spectators in team mode
  if (isTeamMode(currentRoomMode) && !currentActiveRoundPlayers.includes(player.id)) {
    return;
  }
  if (!isPixelVisible(player.x, player.y, 60)) {
    return;
  }
  const style = characterStyle[player.kind];
  ctx.save();
  ctx.translate(player.x, player.y);
  if (!player.alive) ctx.globalAlpha = 0.34;
  if (player.id === localPlayerId && player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0) ctx.globalAlpha = 0.55;
  
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

  // Draw floating HP/Shield bars in Battle Royale
  const isBR = isBattleRoyale(currentRoomMode);
  if (isBR && player.alive) {
    const hp = player.hp !== undefined ? player.hp : 100;
    const maxHp = player.maxHp || 100;
    const shield = player.shield || 0;
    const maxShield = player.maxShield || 100;
    
    // Position of bars
    const barWidth = 36;
    const barHeight = 4;
    const startY = -38;
    
    // Draw HP background bar
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(-barWidth / 2, startY, barWidth, barHeight);
    
    // Draw HP (Green)
    const hpPercent = Math.max(0, Math.min(1, hp / maxHp));
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(-barWidth / 2, startY, barWidth * hpPercent, barHeight);
    
    // Shield bar (Blue) above HP bar
    if (shield > 0) {
      const shieldPercent = Math.max(0, Math.min(1, shield / maxShield));
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(-barWidth / 2, startY - 5, barWidth, barHeight);
      
      ctx.fillStyle = "#3498db";
      ctx.fillRect(-barWidth / 2, startY - 5, barWidth * shieldPercent, barHeight);
    }
    
    // Draw knocked text / icon if knocked
    if (player.knocked) {
      ctx.fillStyle = "#e74c3c";
      ctx.font = "900 10px Fredoka";
      ctx.textAlign = "center";
      ctx.fillText("KNOCKED!", 0, startY - 12);
    }
  }

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
  if (!isPixelVisible(p.x, p.y, p.size || 10)) return;
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
  ctx.fillText(message, CANVAS_WIDTH / 2, 326);
  ctx.fillStyle = "#221f25";
  ctx.font = "900 18px Fredoka";
  ctx.fillText("Round Over! Returning to lobby...", CANVAS_WIDTH / 2, 366);
  ctx.restore();
}

function drawStartCountdown(state) {
  if (!state) {
    // Hide the fullscreen overlay when there's no state
    const fsOverlay = document.getElementById('fullscreenCountdownOverlay');
    if (fsOverlay) fsOverlay.classList.add('hidden');
    return;
  }
  ctx.save();
  
  // Draw a semi-transparent dark backdrop overlay across the entire canvas to focus attention
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // ── Fullscreen HTML overlay (covers areas outside the canvas too) ──
  const fsOverlay = document.getElementById('fullscreenCountdownOverlay');
  const fsNum = document.getElementById('fullscreenCountdownNum');
  if (fsOverlay && fsNum) {
    fsOverlay.classList.remove('hidden');
    const displayText = state;
    // Only re-trigger animation if the number changed
    if (fsNum.dataset.lastState !== state) {
      fsNum.dataset.lastState = state;
      // Set text and color class
      fsNum.className = 'fullscreen-countdown-num';
      if (state === '3') fsNum.classList.add('color-3');
      else if (state === '2') fsNum.classList.add('color-2');
      else if (state === '1') fsNum.classList.add('color-1');
      else if (state === 'START') fsNum.classList.add('color-start');
      fsNum.textContent = displayText;
      // Re-trigger CSS animation by forcing reflow
      void fsNum.offsetWidth;
    }
  }
  
  // Animate size of text based on the remainder of the fractional second
  const fraction = startCountdownTimer % 1.0;
  let scale = 1.0;
  if (state === "START") {
    // START pops and grows
    scale = 1.0 + (1.0 - startCountdownTimer / 0.5) * 0.5;
  } else {
    // 3, 2, 1 shrinks and fades
    scale = 0.5 + fraction * 1.2;
  }
  
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.scale(scale, scale);
  
  // Shadow/Outline glow
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  
  // Choose beautiful, premium arcade color schemes for countdown numbers
  let color = "#ff3399"; // default hot pink
  let fontSize = "110px";
  if (state === "3") {
    color = "#ff3366"; // vibrant coral red
  } else if (state === "2") {
    color = "#ffcc00"; // golden yellow
  } else if (state === "1") {
    color = "#33ccff"; // electric blue
  } else if (state === "START") {
    color = "#39ff14"; // neon green
    fontSize = "130px";
  }
  
  ctx.fillStyle = color;
  ctx.font = `900 ${fontSize} Fredoka`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Stroke outline for comic/arcade feel
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(state, 0, 0);
  
  ctx.fillText(state, 0, 0);
  
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

function drawSquadLobbyCharacter() {
  if (!squadLobbyCtx || !squadLobbyCanvas || !squadLobbyVideo || squadLobbyVideo.readyState < 2) return;

  const width = squadLobbyCanvas.width;
  const height = squadLobbyCanvas.height;
  squadLobbyCtx.clearRect(0, 0, width, height);

  const scale = Math.min(width / squadLobbyVideo.videoWidth, height / squadLobbyVideo.videoHeight) * 2.1;
  const drawW = squadLobbyVideo.videoWidth * scale;
  const drawH = squadLobbyVideo.videoHeight * scale;
  const drawX = (width - drawW) / 2 + 65;
  const drawY = height - drawH * 0.93;

  squadLobbyCtx.drawImage(squadLobbyVideo, drawX, drawY, drawW, drawH);
  removeGreenScreenFromCanvas(squadLobbyCtx, width, height);
}

function drawVictoryPreview() {
  const victoryCard = document.getElementById("grandVictoryCard");
  if (!victoryCard || victoryCard.classList.contains("hidden")) return;
  if (!victoryVideoCtx || !victoryVideoCanvas || !victoryVideo || victoryVideo.readyState < 2) return;

  const width = victoryVideoCanvas.width;
  const height = victoryVideoCanvas.height;
  victoryVideoCtx.clearRect(0, 0, width, height);

  const scale = Math.min(width / victoryVideo.videoWidth, height / victoryVideo.videoHeight) * 1.5;
  const drawW = victoryVideo.videoWidth * scale;
  const drawH = victoryVideo.videoHeight * scale;
  const drawX = (width - drawW) / 2;
  const drawY = height - drawH * 0.95;

  victoryVideoCtx.drawImage(victoryVideo, drawX, drawY, drawW, drawH);
  removeGreenScreenFromCanvas(victoryVideoCtx, width, height);
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

function getDirectionFromKeys(sourceSet, scheme) {
  let dx = 0;
  let dy = 0;
  if (scheme.left.some((key) => sourceSet.has(key))) {
    dx = -1;
  } else if (scheme.right.some((key) => sourceSet.has(key))) {
    dx = 1;
  } else if (scheme.up.some((key) => sourceSet.has(key))) {
    dy = -1;
  } else if (scheme.down.some((key) => sourceSet.has(key))) {
    dy = 1;
  }
  return { dx, dy };
}

function getCouchPlayerDirection(player, index) {
  const scheme = couchControlSchemes[index] || couchControlSchemes[0];
  const keyboardDir = getDirectionFromKeys(keys, scheme);
  if (keyboardDir.dx !== 0 || keyboardDir.dy !== 0) return keyboardDir;
  const touchDir = getDirectionFromKeys(getCouchTouchKeys(player.id), {
    up: ["up"],
    down: ["down"],
    left: ["left"],
    right: ["right"],
  });
  if (touchDir.dx !== 0 || touchDir.dy !== 0) return touchDir;
  if (player.id === couchTouchPlayerId) {
    return getDirectionFromKeys(couchTouchKeys, couchControlSchemes[0]);
  }
  return { dx: 0, dy: 0 };
}

function updateControlledPlayer(player, dx, dy, dt) {
  if (!player || !player.alive) return;
  
  if (player.id === localPlayerId && localHealingState && (dx !== 0 || dy !== 0)) {
    localHealingState = null;
    hideBRProgressBar();
    sendServerMessage("use_item", { itemType: "cancel" });
  }
  
  if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);

  moveActor(player, dx, dy, dt);

  if (!player.lastSentMove) {
    player.lastSentMove = { x: 0, y: 0, dx: 0, dy: 0 };
  }
  const lastMove = player.lastSentMove;
  const hasChanged = dx !== lastMove.dx || dy !== lastMove.dy || Math.abs(player.x - lastMove.x) > 1 || Math.abs(player.y - lastMove.y) > 1;

  if (hasChanged) {
    if (localMode) {
      localCheckPickup(player);
    } else {
      sendServerMessage("move", {
        x: player.x,
        y: player.y,
        dx,
        dy,
      });
    }
    player.lastSentMove = { x: player.x, y: player.y, dx, dy };
  }
}

function update(dt) {
  if (window.tutorialGuideActive && window.tutorialGuidePaused) {
    return;
  }

  if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);

  if (running && startCountdownTimer > 0) {
    startCountdownTimer -= dt;
    if (startCountdownTimer <= 0) {
      startCountdownTimer = 0;
      startCountdownState = "";
      if (window.tutorialGuideActive && window.tutorialGuideStep === 0) {
        showTutorialGuideStep(0);
      }
    } else if (startCountdownTimer > 2.5) {
      startCountdownState = "3";
    } else if (startCountdownTimer > 1.5) {
      startCountdownState = "2";
    } else if (startCountdownTimer > 0.5) {
      startCountdownState = "1";
    } else {
      startCountdownState = "START";
    }
    return;
  }

  // Tick BR pings
  if (brPings && brPings.length > 0) {
    brPings.forEach(p => { p.timer -= dt; });
    brPings = brPings.filter(p => p.timer > 0);
  }

  // Tick local healing progress
  if (localHealingState) {
    localHealingState.timeLeft -= dt;
    if (localHealingState.timeLeft <= 0) {
      const p = players.find(x => x.id === localHealingState.playerId);
      const itemType = localHealingState.itemType;
      localHealingState = null;
      hideBRProgressBar();
      
      if (p && p.alive) {
        if (localMode) {
          if (itemType === "bandage") {
            p.bandageCount = Math.max(0, (p.bandageCount || 0) - 1);
            p.hp = Math.min(75, p.hp + 15);
            showToastMsg("Used Bandage! HP: " + p.hp);
          } else if (itemType === "medkit") {
            p.medkitCount = Math.max(0, (p.medkitCount || 0) - 1);
            p.hp = 100;
            showToastMsg("Used Med Kit! HP: " + p.hp);
          } else if (itemType === "energy_drink") {
            p.energyDrinkCount = Math.max(0, (p.energyDrinkCount || 0) - 1);
            p.shield = Math.min(100, (p.shield || 0) + 50);
            showToastMsg("Used Energy Drink! Shield: " + p.shield);
          }
          updateHudSidebar();
        }
      }
    } else {
      updateBRProgressBar(localHealingState.timeLeft / localHealingState.duration);
    }
  }

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
      
      if (isBattleRoyale(currentRoomMode)) {
        updateLocalBRZone(dt);
        updateLocalBRZoneDamage(dt);
      } else {
        updateSuddenDeathZone(dt);
      }
    }

    timerEl.textContent = formatTime(roundTime);

    if (localMode && localCouchMode) {
      players.forEach((player, index) => {
        if (player.ai) return;
        const dir = getCouchPlayerDirection(player, index);
        updateControlledPlayer(player, dir.dx, dir.dy, dt);
      });
    } else {
      const localPlayer = players.find((p) => p.id === localPlayerId);
      const dir = getDirectionFromKeys(keys, singlePlayerControlScheme);
      updateControlledPlayer(localPlayer, dir.dx, dir.dy, dt);
    }

    const isHost = localPlayerId === hostId;
    if (localMode && isHost) {
      botsWhoThoughtThisFrame = 0;
      players.forEach((p) => {
        if (p.ai && p.alive) {
          updateAi(p, dt);
        }
      });
    }

    players.forEach((p) => {
      if (!localMode && p.id !== localPlayerId) {
        if (p.targetX !== undefined) {
          const dist = Math.hypot(p.targetX - p.x, p.targetY - p.y);
          if (dist > 96) {
            // Snap position instantly on teleport, spawn, or huge desync
            p.x = p.targetX;
            p.y = p.targetY;
          } else {
            // Smoothly glide position using exponential decay interpolation
            const rate = 18; // smooth but responsive (converges within ~100-150ms)
            const alpha = 1 - Math.exp(-rate * dt);
            p.x += (p.targetX - p.x) * alpha;
            p.y += (p.targetY - p.y) * alpha;
          }
        }
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
        
        const cols = COLS;
        const rows = ROWS;
        
        if (bomb.vx > 0 && bomb.slideX >= bomb.x + 1) {
          bomb.x++;
          if (bomb.x === cols - 1) {
            if (!isTileSolidForBombLocal(1, bomb.y)) {
              bomb.x = 1;
              bomb.slideX = 1;
            } else {
              bomb.x = cols - 2;
              bomb.slideX = bomb.x;
              bomb.vx = 0;
            }
          } else {
            if (isTileSolidForBombLocal(bomb.x + 1, bomb.y) && bomb.x + 1 !== cols - 1) {
              bomb.slideX = bomb.x;
              bomb.vx = 0;
            }
          }
        } else if (bomb.vx < 0 && bomb.slideX <= bomb.x - 1) {
          bomb.x--;
          if (bomb.x === 0) {
            if (!isTileSolidForBombLocal(cols - 2, bomb.y)) {
              bomb.x = cols - 2;
              bomb.slideX = cols - 2;
            } else {
              bomb.x = 1;
              bomb.slideX = bomb.x;
              bomb.vx = 0;
            }
          } else {
            if (isTileSolidForBombLocal(bomb.x - 1, bomb.y) && bomb.x - 1 !== 0) {
              bomb.slideX = bomb.x;
              bomb.vx = 0;
            }
          }
        } else if (bomb.vy > 0 && bomb.slideY >= bomb.y + 1) {
          bomb.y++;
          if (bomb.y === rows - 1) {
            if (!isTileSolidForBombLocal(bomb.x, 1)) {
              bomb.y = 1;
              bomb.slideY = 1;
            } else {
              bomb.y = rows - 2;
              bomb.slideY = bomb.y;
              bomb.vy = 0;
            }
          } else {
            if (isTileSolidForBombLocal(bomb.x, bomb.y + 1) && bomb.y + 1 !== rows - 1) {
              bomb.slideY = bomb.y;
              bomb.vy = 0;
            }
          }
        } else if (bomb.vy < 0 && bomb.slideY <= bomb.y - 1) {
          bomb.y--;
          if (bomb.y === 0) {
            if (!isTileSolidForBombLocal(bomb.x, rows - 2)) {
              bomb.y = rows - 2;
              bomb.slideY = rows - 2;
            } else {
              bomb.y = 1;
              bomb.slideY = bomb.y;
              bomb.vy = 0;
            }
          } else {
            if (isTileSolidForBombLocal(bomb.x, bomb.y - 1) && bomb.y - 1 !== 0) {
              bomb.slideY = bomb.y;
              bomb.vy = 0;
            }
          }
        }
      }
    });

    if (localMode) {
      players.forEach((p) => {
        if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
        if (p.aiBombCooldown > 0) p.aiBombCooldown = Math.max(0, p.aiBombCooldown - dt);
        if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
        if (p.alive) localCheckPickup(p);
      });
      bombs.filter((bomb) => bomb.timer <= 0).forEach(localTriggerExplosion);
      localCheckGameEnd();
    }
  }
}

function render(dt) {
  ctx.save();
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

  if (shakeTimer > 0) {
    const shakeIntensity = 5;
    const dx = (Math.random() - 0.5) * shakeIntensity;
    const dy = (Math.random() - 0.5) * shakeIntensity;
    ctx.translate(dx, dy);
  }

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground();

  ctx.save();
  const isBR = isBattleRoyale(currentRoomMode);
  if (isBR) {
    const activeSpec = players.find((p) => p.id === (spectatedPlayerId || localPlayerId)) || players.find((p) => p.alive);
    let targetCx = (map[0] ? map[0].length : COLS) * TILE / 2;
    let targetCy = (map ? map.length : ROWS) * TILE / 2;
    if (activeSpec) {
      targetCx = activeSpec.x;
      targetCy = activeSpec.y;
    }
    
    if (cameraX === 0 && cameraY === 0) {
      cameraX = targetCx;
      cameraY = targetCy;
    } else {
      const lerpSpeed = 0.12; 
      const dtFactor = 1 - Math.pow(1 - lerpSpeed, (dt || 0.016) * 60);
      cameraX += (targetCx - cameraX) * dtFactor;
      cameraY += (targetCy - cameraY) * dtFactor;
    }
    cameraCenterX = cameraX;
    cameraCenterY = cameraY;
    
    const zoom = 1.6;
    ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraCenterX, -cameraCenterY);
  } else {
    cameraCenterX = (map[0] ? map[0].length : COLS) * TILE / 2;
    cameraCenterY = (map ? map.length : ROWS) * TILE / 2;
    const cols = map[0] ? map[0].length : COLS;
    const rows = map ? map.length : ROWS;
    const dynamicOffsetX = (CANVAS_WIDTH - cols * TILE) / 2;
    const dynamicOffsetY = (CANVAS_HEIGHT - rows * TILE) / 2;
    ctx.translate(dynamicOffsetX, dynamicOffsetY);
  }

  if (running || gameMessage) {
    drawMap();
    pickups.forEach(drawPickup);
    bombs.forEach(drawBomb);
    blasts.forEach(drawBlast);
    players.forEach(drawPlayer);
    
    // Draw Safe Zone / Storm boundary overlay in BR mode
    if (isBR && currentBRZone) {
      ctx.save();
      ctx.fillStyle = "rgba(128, 0, 128, 0.22)";
      ctx.beginPath();
      const mapCols = map[0] ? map[0].length : COLS;
      const mapRows = map ? map.length : ROWS;
      ctx.rect(0, 0, mapCols * TILE, mapRows * TILE);
      ctx.arc(currentBRZone.x, currentBRZone.y, currentBRZone.radius, 0, Math.PI * 2, true);
      ctx.fill();
      
      ctx.strokeStyle = "rgba(180, 0, 220, 0.85)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(currentBRZone.x, currentBRZone.y, currentBRZone.radius, 0, Math.PI * 2);
      ctx.stroke();
      
      if (currentBRZone.isShrinking || currentBRZone.timeLeft < 30) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(currentBRZone.nextX, currentBRZone.nextY, currentBRZone.nextRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
    
    particles.forEach(drawParticle);
  }

  ctx.restore();

  if (running && startCountdownTimer > 0) {
    drawStartCountdown(startCountdownState);
  } else {
    // Ensure fullscreen overlay is hidden when countdown is not active
    const fsOverlay = document.getElementById('fullscreenCountdownOverlay');
    if (fsOverlay && !fsOverlay.classList.contains('hidden')) {
      fsOverlay.classList.add('hidden');
    }
  }

  if (!running && gameMessage) {
    drawMessage(gameMessage);
  }

  if (isBR) {
    drawBRMinimap();
    const modal = document.getElementById("brFullscreenMapModal");
    if (modal && !modal.classList.contains("hidden")) {
      drawBRFullscreenMap();
    }
  }

  ctx.restore();
}

function loop(now) {
  const targetInterval = 1000 / activeGraphics.fps;
  if (lastFrameTime && now - lastFrameTime < targetInterval) {
    requestAnimationFrame(loop);
    return;
  }
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  lastFrameTime = now;
  const gameVisible = gameScreen?.classList.contains("active");
  if (gameVisible || running || gameMessage) {
    update(dt);
    render(dt);
  }
  
  const shouldDrawMenu = now - lastMenuDrawTime >= 1000 / activeGraphics.menuFps;
  if (shouldDrawMenu) {
    lastMenuDrawTime = now;
  }

  // Smoothly animate the yellow-console swirls background on active console screens
  if (activeGraphics.animateMenus && shouldDrawMenu) {
    document.querySelectorAll(".yellow-console, .shop-animated-bg").forEach((el) => {
      const offset = (now / 90) % 240;
      el.style.setProperty('--grad-offset', `${offset}px`);
    });
  }

  // Update spotlight character animation frame in lobby
  if (menuScreen.classList.contains("active")) {
    if (shouldDrawMenu) {
      drawSpotlightCharacter();
      drawCharacterSelectPreview();
      drawSquadLobbyCharacter();
      if (activeGraphics.animateMenus) {
        drawCharacterCardPreviews();
        drawCardAvatars();
      }
    }
  }
  if (lobbyScreen && lobbyScreen.classList.contains("active") && shouldDrawMenu) {
    drawLobbyAvatars();
  }

  // Draw and animate character cards in the results overlay if visible
  const overlay = document.getElementById("tournamentOverlay");
  if (overlay && !overlay.classList.contains("hidden") && shouldDrawMenu) {
    drawResultsAvatars();
    drawVictoryPreview();
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

  // Update selection globally in the wardrobe too
  syncCharacterSelectPreview(selectedCharacter);
  syncSquadLobbyInterface();
  if (socket && socket.readyState === WebSocket.OPEN) {
    sendServerMessage("select_character", { kind: selectedCharacter });
  }
}

function syncSquadLobbyInterface() {
  if (localFourPlayerLobbyActive) {
    renderLocalFourPlayerLobby();
    const lobbyMatchBtn = document.getElementById("lobbyMatchBtn");
    const squadAddBotBtn = document.getElementById("squadAddBotBtn");
    const squadStartGameBtn = document.getElementById("squadStartGameBtn");
    const squadReadyBtn = document.getElementById("squadReadyBtn");
    const squadLeaveLobbyBtn = document.getElementById("leaveLobbyBtn");
    const squadLobbyRoomCodeBadge = document.getElementById("squadLobbyRoomCodeBadge");
    const squadLobbyRoomCodeText = document.getElementById("squadLobbyRoomCodeText");
    if (lobbyMatchBtn) lobbyMatchBtn.style.display = "none";
    if (squadAddBotBtn) squadAddBotBtn.style.display = "none";
    if (squadReadyBtn) squadReadyBtn.style.display = "none";
    if (squadStartGameBtn) {
      squadStartGameBtn.style.display = "inline-block";
      squadStartGameBtn.textContent = "START";
    }
    if (squadLeaveLobbyBtn) squadLeaveLobbyBtn.style.display = "inline-block";
    if (squadLobbyRoomCodeBadge) squadLobbyRoomCodeBadge.style.display = "inline-flex";
    if (squadLobbyRoomCodeText) squadLobbyRoomCodeText.textContent = "4P";
    return;
  }

  // Center Card (User)
  const charNameEl = document.getElementById("squadLobbyCharName");
  if (charNameEl) {
    charNameEl.textContent = characterStyle[selectedCharacter]?.label || selectedCharacter;
  }
  const userNameEl = document.getElementById("squadLobbyUserName");
  if (userNameEl) {
    userNameEl.textContent = getActivePlayerName();
  }
  const img = document.getElementById("squadLobbyCharImg");
  if (img && !img.src.endsWith(`/lobby cards/${selectedCharacter} character card.png`)) {
    img.src = `assets/lobby cards/${selectedCharacter} character card.png`;
  }

  // Teammates-only filtering: must share the same squadCode and not be bots
  const localPlayer = players.find(p => p.id === localPlayerId);
  const localSquadCode = localPlayer ? localPlayer.squadCode : null;
  const otherTeammates = players.filter(p => p.id !== localPlayerId && localSquadCode && p.squadCode === localSquadCode && !p.ai);

  const isChallenge = currentRoomIsChallenge;

  // Left Card
  const leftWrapper = document.getElementById("wrapper_squadInviteCard_left");
  const leftCard = document.getElementById("squadInviteCard_left");
  if (leftWrapper && leftCard) {
    leftWrapper.style.display = "block";
    if (otherTeammates[0]) {
      const p = otherTeammates[0];
      leftCard.innerHTML = `
        <div class="card-inner-skew">
          <div class="squad-card-image-container">
            <img src="assets/lobby cards/${p.kind} character card.png" alt="Character Art" />
          </div>
        </div>
        <div class="card-footer-bar">
          <div class="avatar-circle">
            <svg viewBox="0 0 24 24" class="avatar-smile-svg"><circle cx="12" cy="12" r="10" fill="#000" stroke="#ffd84a" stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.5" fill="#ffd84a"/><circle cx="15.5" cy="9.5" r="1.5" fill="#ffd84a"/><path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5" stroke="#ffd84a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
          </div>
          <div class="user-info">
            <div class="user-name">${characterStyle[p.kind]?.label || p.kind}</div>
            <div class="user-level">${escapeHTML(p.name)}</div>
          </div>
        </div>
      `;
      leftCard.onclick = (e) => {
        e.stopPropagation();
        showPlayerVoiceSettings(p.id, p.name);
      };
    } else {
      leftCard.innerHTML = `
        <div class="card-inner-skew">
          <button class="invite-btn" type="button">+</button>
        </div>
      `;
      leftCard.onclick = (e) => {
        e.stopPropagation();
        openFriendsList(e);
      };
    }
  }

  // Right Card
  const rightWrapper = document.getElementById("wrapper_squadInviteCard_right");
  const rightCard = document.getElementById("squadInviteCard_right");
  if (rightWrapper && rightCard) {
    rightWrapper.style.display = "block";
    if (otherTeammates[1]) {
      const p = otherTeammates[1];
      rightCard.innerHTML = `
        <div class="card-inner-skew">
          <div class="squad-card-image-container">
            <img src="assets/lobby cards/${p.kind} character card.png" alt="Character Art" />
          </div>
        </div>
        <div class="card-footer-bar">
          <div class="avatar-circle">
            <svg viewBox="0 0 24 24" class="avatar-smile-svg"><circle cx="12" cy="12" r="10" fill="#000" stroke="#ffd84a" stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.5" fill="#ffd84a"/><circle cx="15.5" cy="9.5" r="1.5" fill="#ffd84a"/><path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5" stroke="#ffd84a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
          </div>
          <div class="user-info">
            <div class="user-name">${characterStyle[p.kind]?.label || p.kind}</div>
            <div class="user-level">${escapeHTML(p.name)}</div>
          </div>
        </div>
      `;
      rightCard.onclick = (e) => {
        e.stopPropagation();
        showPlayerVoiceSettings(p.id, p.name);
      };
    } else {
      rightCard.innerHTML = `
        <div class="card-inner-skew">
          <button class="invite-btn" type="button">+</button>
        </div>
      `;
      rightCard.onclick = (e) => {
        e.stopPropagation();
        openFriendsList(e);
      };
    }
  }

  // Fourth Card
  const fourthWrapper = document.getElementById("wrapper_squadInviteCard_fourth");
  const fourthCard = document.getElementById("squadInviteCard_fourth");
  if (fourthWrapper && fourthCard) {
    if (isChallenge) {
      fourthWrapper.style.display = "block";
      if (otherTeammates[2]) {
        const p = otherTeammates[2];
        fourthCard.innerHTML = `
          <div class="card-inner-skew">
            <div class="squad-card-image-container">
              <img src="assets/lobby cards/${p.kind} character card.png" alt="Character Art" />
            </div>
          </div>
          <div class="card-footer-bar">
            <div class="avatar-circle">
              <svg viewBox="0 0 24 24" class="avatar-smile-svg"><circle cx="12" cy="12" r="10" fill="#000" stroke="#ffd84a" stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.5" fill="#ffd84a"/><circle cx="15.5" cy="9.5" r="1.5" fill="#ffd84a"/><path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5" stroke="#ffd84a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
            </div>
            <div class="user-info">
              <div class="user-name">${characterStyle[p.kind]?.label || p.kind}</div>
              <div class="user-level">${escapeHTML(p.name)}</div>
            </div>
          </div>
        `;
        fourthCard.onclick = (e) => {
          e.stopPropagation();
          showPlayerVoiceSettings(p.id, p.name);
        };
      } else {
        fourthCard.innerHTML = `
          <div class="card-inner-skew">
            <button class="invite-btn" type="button">+</button>
          </div>
        `;
        fourthCard.onclick = (e) => {
          e.stopPropagation();
          openFriendsList(e);
        };
      }
    } else {
      fourthWrapper.style.display = "none";
      fourthCard.onclick = null;
    }
  }

  // Private Room Sync Logic
  const lobbyMatchBtn = document.getElementById("lobbyMatchBtn");
  const squadAddBotBtn = document.getElementById("squadAddBotBtn");
  const squadStartGameBtn = document.getElementById("squadStartGameBtn");
  const squadReadyBtn = document.getElementById("squadReadyBtn");
  const squadLeaveLobbyBtn = document.getElementById("leaveLobbyBtn");
  const squadLobbyRoomCodeBadge = document.getElementById("squadLobbyRoomCodeBadge");
  const squadLobbyRoomCodeText = document.getElementById("squadLobbyRoomCodeText");

  if (roomCode) {
    // We are in a private lobby room
    if (lobbyMatchBtn) lobbyMatchBtn.style.display = "none";
    if (squadLeaveLobbyBtn) {
      squadLeaveLobbyBtn.style.display = "inline-block";
    }
    if (squadLobbyRoomCodeBadge) squadLobbyRoomCodeBadge.style.display = "inline-flex";
    if (squadLobbyRoomCodeText) squadLobbyRoomCodeText.textContent = roomCode;

    // Check if host
    if (localPlayerId === hostId) {
      if (squadAddBotBtn) squadAddBotBtn.style.display = "inline-block";
      if (squadStartGameBtn) squadStartGameBtn.style.display = "inline-block";
      if (squadReadyBtn) squadReadyBtn.style.display = "none";
    } else {
      if (squadAddBotBtn) squadAddBotBtn.style.display = "none";
      if (squadStartGameBtn) squadStartGameBtn.style.display = "none";
      if (squadReadyBtn) {
        squadReadyBtn.style.display = "inline-block";
        const me = players.find(p => p.id === localPlayerId);
        if (me && me.ready) {
          squadReadyBtn.textContent = "UNREADY";
          squadReadyBtn.style.background = "#ff3399";
        } else {
          squadReadyBtn.textContent = "READY";
          squadReadyBtn.style.background = "#3b9dfb";
        }
      }
    }
  } else {
    // Normal / Out of room state
    if (lobbyMatchBtn) lobbyMatchBtn.style.display = "inline-block";
    if (squadLobbyRoomCodeBadge) squadLobbyRoomCodeBadge.style.display = "none";
    if (squadAddBotBtn) squadAddBotBtn.style.display = "none";
    if (squadStartGameBtn) squadStartGameBtn.style.display = "none";
    if (squadReadyBtn) squadReadyBtn.style.display = "none";
    if (squadLeaveLobbyBtn) squadLeaveLobbyBtn.style.display = "none";
  }

  // Lobby Mode buttons sync
  const btnLobbyModeTeam = document.getElementById("btnLobbyModeTeam");
  const btnLobbyModeChallenge = document.getElementById("btnLobbyModeChallenge");
  if (btnLobbyModeTeam && btnLobbyModeChallenge) {
    if (currentRoomIsChallenge) {
      btnLobbyModeChallenge.classList.add("active");
      btnLobbyModeTeam.classList.remove("active");
    } else {
      btnLobbyModeTeam.classList.add("active");
      btnLobbyModeChallenge.classList.remove("active");
    }
    // Only host can modify
    if (!roomCode || roomCode === "LOCAL" || roomCode === "4P" || roomCode === "LOCAL_BR" || localPlayerId === hostId || hostId === null) {
      btnLobbyModeTeam.disabled = false;
      btnLobbyModeChallenge.disabled = false;
      btnLobbyModeTeam.style.opacity = "1";
      btnLobbyModeChallenge.style.opacity = "1";
      btnLobbyModeTeam.style.pointerEvents = "auto";
      btnLobbyModeChallenge.style.pointerEvents = "auto";
    } else {
      btnLobbyModeTeam.disabled = true;
      btnLobbyModeChallenge.disabled = true;
      btnLobbyModeTeam.style.opacity = "0.5";
      btnLobbyModeChallenge.style.opacity = "0.5";
      btnLobbyModeTeam.style.pointerEvents = "none";
      btnLobbyModeChallenge.style.pointerEvents = "none";
    }
  }
}

// Quick Match
quickMatchBtn?.addEventListener("click", () => {
  const name = usernameInput.value.trim() || "Friend";
  sendServerMessage("quick_match", { name, kind: selectedCharacter });
});

// Create Room
createRoomBtn?.addEventListener("click", () => {
  if (isCreatingRoom) return;
  isCreatingRoom = true;
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
  if (localFourPlayerLobbyActive) {
    closeLocalFourPlayerLobby();
    switchScreen(menuScreen);
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
    return;
  }
  if (isMicActive) {
    stopMicCapture();
  }
  if (roomCode && socket && socket.readyState === WebSocket.OPEN) {
    sendServerMessage("leave_room");
  } else if (socket) {
    socket.close();
  }
  localStorage.removeItem("chiikawaRoomCode");
  localStorage.removeItem("chiikawaPlayerId");
  localStorage.removeItem("chiikawaReconnectToken");
  roomCode = null;
  isCreatingRoom = false;
  talkingPlayers = {};
  updateAllMicIndicators();
  localPlayerId = null;
  reconnectToken = null;
  hostId = null;
  players = [];
  readyState = false;
  syncSquadLobbyInterface();
  switchScreen(menuScreen);
});

// Exit Match
leaveGameBtn?.addEventListener("click", () => {
  if (!localMode && running && socket && socket.readyState === WebSocket.OPEN) {
    if (isTeamMode(currentRoomMode)) {
      sendServerMessage("request_surrender");
      showSurrenderVotePopup({
        team: getPlayerTeam(localPlayerId),
        yesVotes: 1,
        threshold: 3,
        secondsLeft: 15,
      });
      return;
    } else {
      sendServerMessage("player_surrender");
    }
  }

  running = false;
  localMode = false;
  resetCouchControls();
  players = [];

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
  if (serverMode !== "local") connectWebSocket();
  resetLobbyMapSelectToNormal();
  switchScreen(menuScreen);
});

surrenderYesBtn?.addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    sendServerMessage("submit_surrender_vote", { agree: true });
  }
});

surrenderNoBtn?.addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    sendServerMessage("submit_surrender_vote", { agree: false });
  }
  surrenderVotePopup?.classList.add("hidden");
});

// Return to Lobby after Victory
document.getElementById("victoryLobbyBtn")?.addEventListener("click", () => {
  players = [];
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
    roomCode = null;
    localPlayerId = null;
    hostId = null;
    localMode = false;
    resetCouchControls();
    resetLobbyMapSelectToNormal();
    switchScreen(menuScreen);
  } else {
    switchScreen(menuScreen);
    document.querySelector('.tab-btn[data-tab="squad"]')?.click();
  }
});

// Squad Lobby Private Room Bot Button
document.getElementById("squadAddBotBtn")?.addEventListener("click", () => {
  sendServerMessage("add_bot");
});

// Squad Lobby Private Room Start Button
document.getElementById("squadStartGameBtn")?.addEventListener("click", () => {
  if (localFourPlayerLobbyActive) {
    startLocalFourWithMapVote();
    return;
  }
  sendServerMessage("start_game");
});

// Squad Lobby Private Room Ready Button
document.getElementById("squadReadyBtn")?.addEventListener("click", () => {
  readyState = !readyState;
  sendServerMessage("player_ready", { ready: readyState });
});

// Squad Lobby Room Code Badge clipboard copy
document.getElementById("squadLobbyRoomCodeBadge")?.addEventListener("click", () => {
  if (roomCode) {
    navigator.clipboard.writeText(roomCode).then(() => {
      showToastMsg("Room Code copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy room code: ", err);
    });
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

ingameChatForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!ingameChatInput) return;
  const text = ingameChatInput.value.trim();
  if (text) {
    sendServerMessage("send_chat", { text });
    ingameChatInput.value = "";
  }
  ingameChatInput.blur();
});

document.getElementById("lobbyChatFormPopup")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("lobbyChatInputPopup");
  const text = (input?.value || "").trim();
  if (text) {
    sendServerMessage("send_chat", { text });
    input.value = "";
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
    if (localMapVoteState) {
      submitLocalMapVote(mapChoice);
      return;
    }
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

function openFriendsList(e) {
  if (e) e.stopPropagation();
  if (serverMode === "local") {
    if (!roomCode && !isCreatingRoom && socket && socket.readyState === WebSocket.OPEN) {
      isCreatingRoom = true;
      const name = usernameInput?.value.trim() || localStorage.getItem("local_username") || "Friend";
      sendServerMessage("create_room", { name, kind: selectedCharacter, isPrivate: true });
      showToastMsg("LAN room created. Share the room code with players on your Wi-Fi.");
    } else if (roomCode) {
      showToastMsg(`LAN invite: ask players on your Wi-Fi to join room <strong>${escapeHTML(roomCode)}</strong>.`);
    } else {
      showToastMsg("Connect to the LAN server first, then invite players by room code.");
    }
    return;
  }
  // Auto-create room if not in one yet
  if (!roomCode && !isCreatingRoom && socket && socket.readyState === WebSocket.OPEN) {
    isCreatingRoom = true;
    const name = usernameInput?.value.trim() || "Friend";
    sendServerMessage("create_room", { name, kind: selectedCharacter, isPrivate: true });
  }
  openSocialModal();
  setTimeout(() => {
    document.querySelector('.social-tab-btn[data-social-tab="friends"]')?.click();
  }, 100);
}

const squadInviteLeft = document.getElementById("squadInviteCard_left");
const squadInviteRight = document.getElementById("squadInviteCard_right");
if (squadInviteLeft) {
  squadInviteLeft.onclick = (e) => {
    if (squadInviteLeft.querySelector(".invite-btn")) {
      openFriendsList(e);
    }
  };
}
if (squadInviteRight) {
  squadInviteRight.onclick = (e) => {
    if (squadInviteRight.querySelector(".invite-btn")) {
      openFriendsList(e);
    }
  };
}

// Nickname synchronization
const squadLobbyUserNameEl = document.getElementById("squadLobbyUserName");
if (usernameInput && squadLobbyUserNameEl) {
  squadLobbyUserNameEl.textContent = getActivePlayerName();
  usernameInput.addEventListener("input", () => {
    const val = usernameInput.value.trim();
    squadLobbyUserNameEl.textContent = val || "Friend";
    localStorage.setItem("local_username", val);
    updateProgressionUI();
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
let vsCompletionTimeout = null;

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
  for (let i = 2; i <= TEAM_MAX_PLAYERS; i++) {
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
  
  // Choose bots from available characters (excluding player's character if possible)
  const pool = ["chiikawa", "hachiware", "usagi", "momonga"];
  const poolFiltered = pool.filter(c => c !== selectedCharacter);
  
  // Shuffle filtered pool, or if empty use default pool
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
  const selectedBots = Array.from({ length: TEAM_MAX_PLAYERS - 1 }, (_, index) => {
    const source = shuffle(poolFiltered.length ? [...poolFiltered] : [...pool]);
    return source[index % source.length];
  });
  matchedBots = selectedBots;

  selectedBots.forEach((botKind, index) => {
    matchmakingTimeouts.push(setTimeout(() => {
      revealMatchedBot(index + 2, botKind, characterStyle[botKind].label + " CPU");
      if (index === selectedBots.length - 1) {
        if (titleEl) titleEl.textContent = "MATCH FOUND!";
        if (cancelMatchmakingBtn) cancelMatchmakingBtn.style.display = "none";
        matchmakingTimeouts.push(setTimeout(() => {
          matchmakingPopup.classList.remove("active");
          matchmakingPopup.classList.add("hidden");
          clearInterval(matchmakingTimerInterval);
          startVsScreen();
        }, 1000));
      }
    }, 700 + index * 450));
  });
}

function showOnlineMatchmakingSearch() {
  if (!matchmakingPopup) return;

  isOnlineMatchmakingActive = true;
  matchmakingDialog?.classList.add("hidden");
  clearInterval(matchmakingTimerInterval);
  matchmakingTimeouts.forEach(clearTimeout);
  matchmakingTimeouts = [];

  matchmakingPopup.classList.remove("hidden");
  matchmakingPopup.classList.add("active");
  if (matchmakingTimer && !onlineMatchmakingInterval) matchmakingTimer.textContent = "00:00";
  const titleEl = matchmakingPopup.querySelector(".matchmaking-title");
  if (titleEl) titleEl.textContent = "MATCHMAKING...";
  if (cancelMatchmakingBtn) {
    cancelMatchmakingBtn.style.display = "block";
    cancelMatchmakingBtn.disabled = false;
  }

  const playerName = usernameInput?.value.trim() || currentSocialUsername || "Friend";
  for (let i = 1; i <= TEAM_MAX_PLAYERS; i++) {
    const slot = document.getElementById(`matchmakerSlot_${i}`);
    if (!slot) continue;
    if (i === 1) {
      slot.className = "matchmaking-card player-slot active";
      slot.innerHTML = `
        <div class="card-inner">
          <span class="slot-badge badge-you">YOU</span>
          <div class="slot-image-container">
            <img src="assets/cards/${selectedCharacter}.png" alt="${escapeHTML(playerName)}" />
          </div>
          <div class="slot-name">${escapeHTML(playerName)}</div>
        </div>
      `;
    } else {
      slot.className = "matchmaking-card empty-slot";
      slot.innerHTML = `
        <div class="card-inner">
          <div class="searching-pulse"></div>
          <div class="slot-status-text">SEARCHING...</div>
        </div>
      `;
    }
  }
  startOnlineMatchmakingTimer();
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

let onlineMatchmakingInterval = null;
let isOnlineMatchmakingActive = false;

function startOnlineMatchmakingTimer() {
  if (onlineMatchmakingInterval) return;
  let elapsedSeconds = 0;
  let botsFilled = false;
  if (matchmakingTimer) matchmakingTimer.textContent = "00:00";
  onlineMatchmakingInterval = setInterval(() => {
    elapsedSeconds++;
    const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const s = String(elapsedSeconds % 60).padStart(2, "0");
    if (matchmakingTimer) matchmakingTimer.textContent = `${m}:${s}`;

    // After 20 seconds, fill remaining empty slots with bots
    if (elapsedSeconds >= 20 && !botsFilled && isOnlineMatchmakingActive) {
      botsFilled = true;
      const maxPlayers = currentRoomMaxPlayers;
      const currentCount = players.length;
      const slotsNeeded = maxPlayers - currentCount;
      if (slotsNeeded > 0 && socket && socket.readyState === WebSocket.OPEN) {
        const titleEl = matchmakingPopup ? matchmakingPopup.querySelector(".matchmaking-title") : null;
        if (titleEl) titleEl.textContent = "FILLING WITH BOTS...";
        // Send one add_bot per missing slot with small stagger
        for (let i = 0; i < slotsNeeded; i++) {
          setTimeout(() => {
            if (isOnlineMatchmakingActive && socket && socket.readyState === WebSocket.OPEN) {
              sendServerMessage("add_bot");
            }
          }, i * 400);
        }
      }
    }
  }, 1000);
}


function stopOnlineMatchmakingTimer() {
  if (onlineMatchmakingInterval) {
    clearInterval(onlineMatchmakingInterval);
    onlineMatchmakingInterval = null;
  }
}

function updateOnlineMatchmakingPopup() {
  if (!matchmakingPopup) return;

  if (matchmakingPopup.classList.contains("hidden")) {
    matchmakingPopup.classList.remove("hidden");
    matchmakingPopup.classList.add("active");
  }

  const titleEl = matchmakingPopup.querySelector(".matchmaking-title");
  
  const localPlayer = players.find(p => p.id === localPlayerId);
  const localSquadCode = localPlayer ? localPlayer.squadCode : null;

  const teammates = players.filter(p => p.id !== localPlayerId && p.squadCode === localSquadCode && !p.ai);
  const enemies = players.filter(p => p.squadCode !== localSquadCode && !p.ai);
  const bots = players.filter(p => p.ai);

  const sortedPlayers = [];
  if (localPlayer) {
    sortedPlayers.push({ player: localPlayer, type: "YOU" });
  }
  teammates.forEach(p => sortedPlayers.push({ player: p, type: "MEMBER" }));
  enemies.forEach(p => sortedPlayers.push({ player: p, type: "ENEMY" }));
  bots.forEach(p => sortedPlayers.push({ player: p, type: "CPU" }));

  const displayPlayers = sortedPlayers.slice(0, TEAM_MAX_PLAYERS);

  for (let i = 1; i <= TEAM_MAX_PLAYERS; i++) {
    const slotIndex = i - 1;
    const slot = document.getElementById(`matchmakerSlot_${i}`);
    if (!slot) continue;

    if (slotIndex < displayPlayers.length) {
      const { player, type } = displayPlayers[slotIndex];
      slot.className = `matchmaking-card active pop-found`;
      
      let badgeClass = "badge-bot";
      if (type === "YOU") badgeClass = "badge-you";
      else if (type === "MEMBER") badgeClass = "badge-member";
      else if (type === "ENEMY") badgeClass = "badge-enemy";

      slot.innerHTML = `
        <div class="card-inner">
          <span class="slot-badge ${badgeClass}">${type}</span>
          <div class="slot-image-container">
            <img src="assets/cards/${player.kind}.png" alt="${player.name}" />
          </div>
          <div class="slot-name">${escapeHTML(player.name)}</div>
        </div>
      `;
    } else {
      slot.className = "matchmaking-card empty-slot";
      slot.innerHTML = `
        <div class="card-inner">
          <div class="searching-pulse"></div>
          <div class="slot-status-text">SEARCHING...</div>
        </div>
      `;
    }
  }

  const isHost = localPlayerId === hostId;
  const realPlayersCount = players.filter(p => !p.ai).length;

  if (cancelMatchmakingBtn) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      cancelMatchmakingBtn.style.display = isHost ? "block" : "none";
    } else {
      cancelMatchmakingBtn.style.display = "block";
    }
  }

  const startMatchEarlyBtn = document.getElementById("startMatchEarlyBtn");
  if (startMatchEarlyBtn) {
    if (socket && socket.readyState === WebSocket.OPEN && serverMode === "local" && isHost) {
      startMatchEarlyBtn.style.display = "block";
    } else {
      startMatchEarlyBtn.style.display = "none";
    }
  }

  const maxPlayers = currentRoomMaxPlayers;
  if (players.length >= maxPlayers) {
    if (titleEl) titleEl.textContent = "MATCH FOUND!";
    if (cancelMatchmakingBtn) cancelMatchmakingBtn.style.display = "none";
  } else {
    if (titleEl) titleEl.textContent = "MATCHMAKING...";
  }
}

function cancelMatchmaking() {
  if (isOnlineMatchmakingActive) {
    isOnlineMatchmakingActive = false;
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendServerMessage("cancel_matchmaking");
      sendServerMessage("leave_room");
    }
    // Reset local room state so the player fully leaves matchmaking
    roomCode = null;
    isCreatingRoom = false;
    localPlayerId = null;
    hostId = null;
    players = [];
    stopOnlineMatchmakingTimer();
  }
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
  clearTimeout(vsCompletionTimeout);
  matchmakingTimeouts.forEach(clearTimeout);
  matchmakingTimeouts = [];
}

function startVsScreen() {
  const playerName = (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "You";
  const bot1 = matchedBots[0] || "usagi";
  const bot2 = matchedBots[1] || "momonga";
  const bot3 = matchedBots[2] || "chiikawa";
  showVsLoadingScreen([
    { id: "local_player", name: playerName, kind: selectedCharacter },
    { id: "cpu_1", name: characterStyle[bot1].label + " CPU", kind: bot1 },
    { id: "cpu_2", name: characterStyle[bot2].label + " CPU", kind: bot2 },
    { id: "cpu_3", name: characterStyle[bot3].label + " CPU", kind: bot3 },
  ], startLocalGameWithMatchedBots);
}

function getVsFallbackCombatants() {
  return [
    { id: "fallback_player", name: "You", kind: selectedCharacter },
    { id: "fallback_usagi", name: "Usagi CPU", kind: "usagi" },
    { id: "fallback_momonga", name: "Momonga CPU", kind: "momonga" },
    { id: "fallback_chiikawa", name: "Chiikawa CPU", kind: "chiikawa" },
  ];
}

function normalizeVsCombatants(combatants) {
  const fallback = getVsFallbackCombatants();
  const source = Array.isArray(combatants) && combatants.length ? combatants : fallback;
  return Array.from({ length: 4 }, (_, index) => {
    const item = source[index] || fallback[index];
    const kind = item?.kind || fallback[index].kind;
    const fallbackName = index === 0 ? "You" : `${characterStyle[kind]?.label || "CPU"} CPU`;
    return {
      kind,
      name: item?.name || fallbackName,
    };
  });
}

function showVsLoadingScreen(combatants, onComplete, durationMs = 5000) {
  if (!vsLoadingScreen) {
    onComplete?.();
    return;
  }

  const lineup = normalizeVsCombatants(combatants);
  if (vsLoadingScreen.parentElement !== document.body) {
    document.body.appendChild(vsLoadingScreen);
  }
  const mapVoteOverlay = document.getElementById("mapVoteOverlay");
  if (mapVoteOverlay) {
    mapVoteOverlay.classList.remove("active");
    mapVoteOverlay.classList.add("hidden");
  }

  vsLoadingScreen.classList.remove("hidden");
  vsLoadingScreen.classList.add("active");

  lineup.forEach((fighter, index) => {
    const slot = index + 1;
    const nameEl = document.getElementById(`vsName_${slot}`);
    const imgEl = document.getElementById(`vsImg_${slot}`);
    if (nameEl) nameEl.textContent = fighter.name;
    if (imgEl) imgEl.src = `assets/cards/${fighter.kind}.png`;
    setVsCardTheme(slot, fighter.kind);
  });

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
  
  const startedAt = performance.now();
  if (vsProgressBarFill) vsProgressBarFill.style.width = "0%";
  if (vsLoadingStatus) vsLoadingStatus.textContent = "PREPARING ARENA... 0%";

  const statusTexts = [
    "LOADING ARENA...",
    "SUMMONING BOMBS...",
    "LOCKING IN RIVALS...",
    "READY TO BATTLE!"
  ];

  clearInterval(vsProgressInterval);
  clearTimeout(vsCompletionTimeout);
  vsProgressInterval = setInterval(() => {
    const elapsed = performance.now() - startedAt;
    const progress = Math.min(99, Math.floor((elapsed / durationMs) * 100));
    if (vsProgressBarFill) vsProgressBarFill.style.width = `${progress}%`;
    const textIndex = Math.min(statusTexts.length - 1, Math.floor((progress / 100) * statusTexts.length));
    if (vsLoadingStatus) vsLoadingStatus.textContent = `${statusTexts[textIndex]} ${progress}%`;
  }, 150);

  vsCompletionTimeout = setTimeout(() => {
    clearInterval(vsProgressInterval);
    vsProgressInterval = null;
    if (vsProgressBarFill) vsProgressBarFill.style.width = "100%";
    if (vsLoadingStatus) vsLoadingStatus.textContent = "READY TO BATTLE! 100%";
    setTimeout(() => {
      vsLoadingScreen.classList.remove("active");
      vsLoadingScreen.classList.add("hidden");
      onComplete?.();
    }, 220);
  }, durationMs);
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
  localCouchMode = false;
  couchTouchKeys.clear();
  couchPlayerTouchKeys.clear();
  couchTouchPlayerId = null;
  roomCode = "LOCAL";
  localPlayerId = "local_player";
  hostId = localPlayerId;
  localBombId = 0;
  
  const mapSelect = document.getElementById("localMapSelect");
  currentMapType = pendingLocalMapChoice || (mapSelect ? mapSelect.value : "classic");
  pendingLocalMapChoice = null;
  map = buildLocalMap(currentMapType);
  const activeStarts = getStartsForMap(currentMapType);
  
  const cpu1 = matchedBots[0] || "usagi";
  const cpu2 = matchedBots[1] || "momonga";
  const cpu3 = matchedBots[2] || "chiikawa";
  
  players = [
    makeLocalPlayer("local_player", (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "You", selectedCharacter, activeStarts[0], false),
    makeLocalPlayer("cpu_1", characterStyle[cpu1].label + " CPU", cpu1, activeStarts[1], true),
    makeLocalPlayer("cpu_2", characterStyle[cpu2].label + " CPU", cpu2, activeStarts[2], true),
    makeLocalPlayer("cpu_3", characterStyle[cpu3].label + " CPU", cpu3, activeStarts[3], true),
  ];
  
  players.forEach((p) => {
    p.trophies = 0;
    p.hasPunch = false;
  });
  
  bombs = [];
  blasts = [];
  pickups = [];
  seedLocalPowerZonePickups();
  particles = [];
  roundTime = 150;
  running = true;
  startCountdownTimer = 3.5;
  startCountdownState = "3";
  shakeTimer = 0;
  zoneActive = false;
  zoneLayer = 0;
  zoneStepTimer = 0;
  localMatchRewarded = false;
  gameMessage = "";
  
  switchScreen(gameScreen);
}

// Hook up matchmaking buttons
const matchmakingModeSelectDialog = document.getElementById("matchmakingModeSelectDialog");
const btnModeSelectSolo = document.getElementById("btnModeSelectSolo");
const btnModeSelectDuo = document.getElementById("btnModeSelectDuo");
const btnModeSelectTrio = document.getElementById("btnModeSelectTrio");
const btnModeSelectBRSolo = document.getElementById("btnModeSelectBRSolo");
const btnModeSelectBRDuo = document.getElementById("btnModeSelectBRDuo");
const btnModeSelectBRTrio = document.getElementById("btnModeSelectBRTrio");
const closeMatchmakingModeBtn = document.getElementById("closeMatchmakingModeBtn");

function showMatchmakingModeSelection() {
  if (!matchmakingModeSelectDialog) return;

  const localPlayer = players.find(p => p.id === localPlayerId);
  const localSquadCode = localPlayer ? localPlayer.squadCode : null;
  const squadSize = players.filter(p => (localSquadCode ? p.squadCode === localSquadCode : p.id === localPlayerId) && !p.ai).length;

  const toggleBtn = (btn, limit) => {
    if (!btn) return;
    if (squadSize > limit) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  };

  toggleBtn(btnModeSelectSolo, 1);
  toggleBtn(btnModeSelectBRSolo, 1);
  toggleBtn(btnModeSelectDuo, 2);
  toggleBtn(btnModeSelectBRDuo, 2);
  toggleBtn(btnModeSelectTrio, 3);
  toggleBtn(btnModeSelectBRTrio, 3);

  // Hide BR mode buttons completely if in local 4-player couch lobby mode
  if (localFourPlayerLobbyActive) {
    if (btnModeSelectBRSolo) btnModeSelectBRSolo.style.setProperty("display", "none", "important");
    if (btnModeSelectBRDuo) btnModeSelectBRDuo.style.setProperty("display", "none", "important");
    if (btnModeSelectBRTrio) btnModeSelectBRTrio.style.setProperty("display", "none", "important");
  } else {
    if (btnModeSelectBRSolo) btnModeSelectBRSolo.style.setProperty("display", "flex", "important");
    if (btnModeSelectBRDuo) btnModeSelectBRDuo.style.setProperty("display", "flex", "important");
    if (btnModeSelectBRTrio) btnModeSelectBRTrio.style.setProperty("display", "flex", "important");
  }

  matchmakingModeSelectDialog.classList.remove("hidden");
  matchmakingModeSelectDialog.classList.add("active");
}

function handleModeSelection(chosenMode) {
  if (matchmakingModeSelectDialog) {
    matchmakingModeSelectDialog.classList.remove("active");
    matchmakingModeSelectDialog.classList.add("hidden");
  }

  const isBR = isBattleRoyale(chosenMode);
  if (isBR) {
    showBRMatchmakingScreen(chosenMode);
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (roomCode) {
        if (localPlayerId === hostId) {
          showOnlineMatchmakingSearch();
          sendServerMessage("start_matchmaking", { mode: chosenMode });
        } else {
          alert("Only the room host can start matchmaking!");
        }
      } else {
        showOnlineMatchmakingSearch();
        const name = usernameInput?.value.trim() || currentSocialUsername || "Friend";
        sendServerMessage("quick_match", { name, kind: selectedCharacter, mode: chosenMode });
      }
    } else {
      startMatchmakingSearch();
    }
  }
}

if (lobbyMatchBtn) {
  lobbyMatchBtn.addEventListener("click", () => {
    showMatchmakingModeSelection();
  });
}

if (btnModeSelectSolo) btnModeSelectSolo.addEventListener("click", () => handleModeSelection("solo"));
if (btnModeSelectDuo) btnModeSelectDuo.addEventListener("click", () => handleModeSelection("duo"));
if (btnModeSelectTrio) btnModeSelectTrio.addEventListener("click", () => handleModeSelection("trio"));
if (btnModeSelectBRSolo) btnModeSelectBRSolo.addEventListener("click", () => handleModeSelection("br_solo"));
if (btnModeSelectBRDuo) btnModeSelectBRDuo.addEventListener("click", () => handleModeSelection("br_duo"));
if (btnModeSelectBRTrio) btnModeSelectBRTrio.addEventListener("click", () => handleModeSelection("br_trio"));

if (closeMatchmakingModeBtn) {
  closeMatchmakingModeBtn.addEventListener("click", () => {
    matchmakingModeSelectDialog?.classList.remove("active");
    matchmakingModeSelectDialog?.classList.add("hidden");
  });
}
if (cancelMatchmakingBtn) {
  cancelMatchmakingBtn.addEventListener("click", () => {
    cancelMatchmaking();
  });
}
const startMatchEarlyBtn = document.getElementById("startMatchEarlyBtn");
if (startMatchEarlyBtn) {
  startMatchEarlyBtn.addEventListener("click", () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendServerMessage("start_game");
    }
  });
}

function normalizeInputKey(event) {
  if (!event || !event.key) return;
  if (event.key.startsWith("Arrow")) return event.key;
  return event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
}

function triggerPlayerBomb(player) {
  if (!player || !player.alive) return;
  if (localMode) localPlaceBomb(player);
  else sendServerMessage("place_bomb");
}

function triggerPlayerPunch(player) {
  if (!player || !player.alive) return;
  if (localMode) {
    triggerLocalPunch(player);
  } else if (player.hasPunch) {
    const dir = player.lastFacingDir || { x: 0, y: 1 };
    sendServerMessage("punch_bomb", { faceX: Math.sign(dir.x), faceY: Math.sign(dir.y) });
  }
}

function getTouchControlledPlayer() {
  return players.find((p) => p.id === (couchTouchPlayerId || localPlayerId)) || players.find((p) => p.id === localPlayerId);
}

function getTouchKeySet() {
  return localMode && localCouchMode ? couchTouchKeys : keys;
}

function resetCouchControls() {
  localCouchMode = false;
  couchTouchKeys.clear();
  couchPlayerTouchKeys.clear();
  couchTouchPlayerId = null;
  document.getElementById("couchControlPicker")?.classList.add("hidden");
  document.body.classList.remove("local-couch-active");
}

// Keyboard event listeners
window.addEventListener("keydown", (event) => {
  const ingameChatInput = document.getElementById("ingameChatInput");
  if (document.activeElement === ingameChatInput) {
    if (event.key === "Escape") {
      ingameChatInput.blur();
    }
    return;
  }
  
  if (event.key === "Enter" && serverMode === "online" && running) {
    if (ingameChatInput) {
      event.preventDefault();
      const chatBox = document.getElementById("ingameChatBox");
      const toggleBtn = document.getElementById("ingameChatToggleBtn");
      if (chatBox) chatBox.classList.remove("hidden");
      if (toggleBtn) toggleBtn.classList.add("hidden");
      setTimeout(() => {
        ingameChatInput.focus();
      }, 50);
      return;
    }
  }

  const key = normalizeInputKey(event);
  if (!key) return;
  keys.add(key);

  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
  }

  if (running) {
    if (localMode && localCouchMode) {
      players.forEach((player, index) => {
        if (player.ai) return;
        const scheme = couchControlSchemes[index] || couchControlSchemes[0];
        if (scheme.bomb.includes(key)) triggerPlayerBomb(player);
        if (scheme.punch.includes(key)) triggerPlayerPunch(player);
      });
    } else {
      const localPlayer = players.find((p) => p.id === localPlayerId);
      if (key === " " || key === "enter") triggerPlayerBomb(localPlayer);
      if (key === "z" || key === "x" || key === "shift") triggerPlayerPunch(localPlayer);
      
      if (isBattleRoyale(currentRoomMode)) {
        if (key === "1") useHealingItemLocal("bandage");
        if (key === "2") useHealingItemLocal("medkit");
        if (key === "3") useHealingItemLocal("energy_drink");
        if (key === "m") toggleBRFullscreenMap();
      }
    }
  }
});

window.addEventListener("keyup", (event) => {
  const ingameChatInput = document.getElementById("ingameChatInput");
  if (document.activeElement === ingameChatInput) return;
  const key = normalizeInputKey(event);
  if (!key) return;
  keys.delete(key);
});

// Mobile Touch Gamepad Event Listeners
function bindTouchGamepadBtn(elementId, keyToSimulate) {
  const btn = document.getElementById(elementId);
  if (!btn) return;

  const handleStart = (e) => {
    e.preventDefault();
    getTouchKeySet().add(keyToSimulate);
    btn.classList.add("pressed");
  };

  const handleEnd = (e) => {
    e.preventDefault();
    getTouchKeySet().delete(keyToSimulate);
    btn.classList.remove("pressed");
  };

  btn.addEventListener("touchstart", handleStart, { passive: false });
  btn.addEventListener("touchend", handleEnd, { passive: false });
  btn.addEventListener("touchcancel", handleEnd, { passive: false });

  // Fallback for mouse testing
  btn.addEventListener("mousedown", (e) => {
    getTouchKeySet().add(keyToSimulate);
    btn.classList.add("pressed");
  });
  btn.addEventListener("mouseup", (e) => {
    getTouchKeySet().delete(keyToSimulate);
    btn.classList.remove("pressed");
  });
  btn.addEventListener("mouseleave", (e) => {
    getTouchKeySet().delete(keyToSimulate);
    btn.classList.remove("pressed");
  });
}

function bindMobileJoystick(joystick) {
  if (!joystick) return;
  const knob = joystick.querySelector(".couch-joystick-knob");
  let activePointerId = null;

  const setDirectionFromPoint = (clientX, clientY) => {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    // Position relative to pad center
    const dx = clientX - cx;
    const dy = clientY - cy;
    
    let knobX, knobY;
    if (preferredMobileControls === "joystick") {
      // Circular clamping
      const max = rect.width * 0.4;
      const distance = Math.hypot(dx, dy);
      const scale = distance > max ? max / distance : 1;
      knobX = dx * scale;
      knobY = dy * scale;
    } else {
      // Finger pad square clamping
      const halfWidth = rect.width / 2;
      const halfHeight = rect.height / 2;
      const padPadding = 12; // margin from border
      const maxKnobX = halfWidth - padPadding;
      const maxKnobY = halfHeight - padPadding;
      knobX = Math.max(-maxKnobX, Math.min(maxKnobX, dx));
      knobY = Math.max(-maxKnobY, Math.min(maxKnobY, dy));
    }
    
    if (knob) knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    const touchKeys = getTouchKeySet();
    touchKeys.delete("w");
    touchKeys.delete("a");
    touchKeys.delete("s");
    touchKeys.delete("d");

    // Deadzone to prevent accidental movement on tiny touches near the center
    const deadzone = rect.width * 0.12;
    if (Math.abs(knobX) < deadzone && Math.abs(knobY) < deadzone) return;

    // Map to direction based on dominant offset
    if (Math.abs(knobX) > Math.abs(knobY)) {
      touchKeys.add(knobX < 0 ? "a" : "d");
    } else {
      touchKeys.add(knobY < 0 ? "w" : "s");
    }
  };

  const resetJoystick = () => {
    const touchKeys = getTouchKeySet();
    touchKeys.delete("w");
    touchKeys.delete("a");
    touchKeys.delete("s");
    touchKeys.delete("d");
    if (knob) knob.style.transform = "translate(0, 0)";
    activePointerId = null;
    joystick.classList.remove("active");
  };

  joystick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    activePointerId = event.pointerId;
    joystick.setPointerCapture?.(event.pointerId);
    joystick.classList.add("active");
    setDirectionFromPoint(event.clientX, event.clientY);
  });
  joystick.addEventListener("pointermove", (event) => {
    if (activePointerId !== event.pointerId) return;
    event.preventDefault();
    setDirectionFromPoint(event.clientX, event.clientY);
  });
  joystick.addEventListener("pointerup", resetJoystick);
  joystick.addEventListener("pointercancel", resetJoystick);
  joystick.addEventListener("lostpointercapture", resetJoystick);
}

function initTouchControls() {
  const mobileJoystick = document.getElementById("mobileJoystick");
  if (mobileJoystick) {
    bindMobileJoystick(mobileJoystick);
  }

  // Bind D-pad Buttons
  const bindDpadButton = (btnId, keyToSimulate) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    const handleStart = (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      getTouchKeySet().add(keyToSimulate);
      btn.classList.add("pressed");
    };
    const handleEnd = (e) => {
      e.preventDefault();
      getTouchKeySet().delete(keyToSimulate);
      btn.classList.remove("pressed");
    };
    
    btn.addEventListener("pointerdown", handleStart);
    btn.addEventListener("pointerup", handleEnd);
    btn.addEventListener("pointercancel", handleEnd);
    btn.addEventListener("lostpointercapture", handleEnd);
  };
  
  bindDpadButton("btnTouchUp", "w");
  bindDpadButton("btnTouchLeft", "a");
  bindDpadButton("btnTouchRight", "d");
  bindDpadButton("btnTouchDown", "s");
  
  const btnBomb = document.getElementById("btnTouchBomb");
  if (btnBomb) {
    const handlePlaceBomb = (e) => {
      e.preventDefault();
      btnBomb.classList.add("pressed");
      if (running) {
        const localPlayer = localMode && localCouchMode ? getTouchControlledPlayer() : players.find((p) => p.id === localPlayerId);
        triggerPlayerBomb(localPlayer);
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
        const localPlayer = localMode && localCouchMode ? getTouchControlledPlayer() : players.find((p) => p.id === localPlayerId);
        triggerPlayerPunch(localPlayer);
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

// Cross-browser safe fullscreen request helper
function isFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
}

function getFullscreenTarget() {
  return document.querySelector(".app-container") || document.documentElement;
}

function safeRequestFullscreen(el) {
  return Promise.resolve().then(() => {
    const target = el || getFullscreenTarget();
    const requestFS = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen || target.msRequestFullscreen;
    if (requestFS) {
      return requestFS.call(target);
    }
    throw new Error("Fullscreen API not supported");
  }).then(() => {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch(() => {});
    }
    return isFullscreenActive();
  }).catch((err) => {
    console.warn("Fullscreen request warning/error:", err);
    return false;
  });
}

// Automatically enter fullscreen on first user touch/click for mobile/tablet devices
function autoEnterFullscreen() {
  if (/iPhone|iPod/.test(navigator.userAgent)) return;
  if (isFullscreenActive()) return;
  safeRequestFullscreen();
  document.removeEventListener("touchstart", autoEnterFullscreen);
  document.removeEventListener("click", autoEnterFullscreen);
}

// Setup listeners for mobile/tablet auto fullscreen
if (/Mobi|Android|iPhone|iPad|Tablet/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth <= 1366)) {
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

// Initialize WebSocket if online.
if (navigator.onLine) {
  connectWebSocket();
} else {
  console.log("Device is offline. Skipping initial WebSocket connection.");
}

// Fullscreen Toggle Event Listener
const fullscreenToggleBtn = document.getElementById("fullscreenToggleBtn");
if (fullscreenToggleBtn) {
  fullscreenToggleBtn.addEventListener("click", () => {
    if (!isFullscreenActive()) {
      safeRequestFullscreen();
    } else {
      const exitFS = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exitFS) {
        Promise.resolve(exitFS.call(document)).then(() => {
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

// Start Intro Sequence (Check active session, otherwise trigger logo and Title loading)
checkInitialSession();
setTimeout(() => {
  if (startupFinished) return;
  showAppError("Startup took too long. Loading title screen instead.");
  initIntroSequence();
}, 8000);

// ----------------------------------------------------------------
// BACKGROUND MUSIC AND AUDIO VOLUME CONTROLLER
// ----------------------------------------------------------------
const bgMusic = new Audio("uwauwa.mp3");
bgMusic.loop = true;

// Load persisted settings
let sfxVolume = localStorage.getItem("sfxVolume") !== null ? parseInt(localStorage.getItem("sfxVolume")) : 80;
let bgMusicEnabled = localStorage.getItem("bgMusicEnabled") !== null ? localStorage.getItem("bgMusicEnabled") === "true" : true;
let bgMusicVolume = localStorage.getItem("bgMusicVolume") !== null ? parseInt(localStorage.getItem("bgMusicVolume")) : 50;

// Preferred connection mode setting (online vs offline)
let preferredConnectionMode = localStorage.getItem("chiikawaConnectionMode") !== null ? localStorage.getItem("chiikawaConnectionMode") : "online";

// Preferred mobile controls style (joystick, fingerpad, arrows)
let preferredMobileControls = localStorage.getItem("chiikawaMobileControls") !== null ? localStorage.getItem("chiikawaMobileControls") : "fingerpad";

// Preferred in-game UI layout (default, lefty, compact)
let preferredUiLayout = localStorage.getItem("chiikawaUiLayout") !== null ? localStorage.getItem("chiikawaUiLayout") : "default";

bgMusic.volume = bgMusicVolume / 100;

function initAudioSettings() {
  const sfxVolumeSlider = document.getElementById("sfxVolumeSlider");
  const bgMusicToggle = document.getElementById("bgMusicToggle");
  const bgMusicVolumeSlider = document.getElementById("bgMusicVolumeSlider");
  const graphicsQualitySelect = document.getElementById("graphicsQualitySelect");
  const renderScaleSelect = document.getElementById("renderScaleSelect");
  const connectionModeToggle = document.getElementById("connectionModeToggle");
  const connectionModeLabel = document.getElementById("connectionModeLabel");
  
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

  if (graphicsQualitySelect) {
    graphicsQualitySelect.value = graphicsProfiles[graphicsQuality] ? graphicsQuality : "high";
    graphicsQualitySelect.addEventListener("change", (e) => {
      graphicsQuality = graphicsProfiles[e.target.value] ? e.target.value : "high";
      localStorage.setItem("graphicsQuality", graphicsQuality);
      applyGraphicsSettings();
    });
  }

  if (renderScaleSelect) {
    renderScaleSelect.value = String(renderScale);
    if (!Array.from(renderScaleSelect.options).some((option) => option.value === renderScaleSelect.value)) {
      renderScaleSelect.value = "1";
    }
    renderScaleSelect.addEventListener("change", (e) => {
      renderScale = clampRenderScale(e.target.value);
      localStorage.setItem("renderScale", String(renderScale));
      applyGraphicsSettings();
    });
  }

  if (connectionModeToggle) {
    connectionModeToggle.checked = preferredConnectionMode === "online";
    if (connectionModeLabel) connectionModeLabel.textContent = preferredConnectionMode === "online" ? "Online" : "Offline";
    
    connectionModeToggle.addEventListener("change", (e) => {
      preferredConnectionMode = e.target.checked ? "online" : "offline";
      localStorage.setItem("chiikawaConnectionMode", preferredConnectionMode);
      if (connectionModeLabel) connectionModeLabel.textContent = preferredConnectionMode === "online" ? "Online" : "Offline";
      
      restoreConnectionPreference();
    });
  }

  const mobileControlsSelect = document.getElementById("mobileControlsSelect");
  const uiLayoutSelect = document.getElementById("uiLayoutSelect");

  if (mobileControlsSelect) {
    mobileControlsSelect.value = preferredMobileControls;
    mobileControlsSelect.addEventListener("change", (e) => {
      preferredMobileControls = e.target.value;
      localStorage.setItem("chiikawaMobileControls", preferredMobileControls);
      applyMobileSettings();
    });
  }

  if (uiLayoutSelect) {
    uiLayoutSelect.value = preferredUiLayout;
    uiLayoutSelect.addEventListener("change", (e) => {
      preferredUiLayout = e.target.value;
      localStorage.setItem("chiikawaUiLayout", preferredUiLayout);
      applyMobileSettings();
    });
  }

  applyMobileSettings();
}

function applyMobileSettings() {
  const selectControls = localStorage.getItem("chiikawaMobileControls") || "fingerpad";
  const selectLayout = localStorage.getItem("chiikawaUiLayout") || "default";

  const joyContainer = document.getElementById("mobileJoystickContainer");
  const dpadContainer = document.getElementById("mobileDpadContainer");
  if (joyContainer && dpadContainer) {
    if (selectControls === "arrows") {
      joyContainer.classList.add("hidden");
      dpadContainer.classList.remove("hidden");
    } else {
      joyContainer.classList.remove("hidden");
      dpadContainer.classList.add("hidden");
      
      const joystickEl = document.getElementById("mobileJoystick");
      if (joystickEl) {
        if (selectControls === "joystick") {
          joystickEl.classList.add("mode-circular");
          joystickEl.classList.remove("mode-square");
        } else {
          joystickEl.classList.add("mode-square");
          joystickEl.classList.remove("mode-circular");
        }
      }
    }
  }

  const gamepad = document.getElementById("mobileGamepad");
  if (gamepad) {
    gamepad.classList.remove("layout-lefty", "layout-compact");
    if (selectLayout === "lefty") {
      gamepad.classList.add("layout-lefty");
    } else if (selectLayout === "compact") {
      gamepad.classList.add("layout-compact");
    }
  }
}

function restoreConnectionPreference() {
  const pref = localStorage.getItem("chiikawaConnectionMode") || "online";
  const toggle = document.getElementById("connectionModeToggle");
  const label = document.getElementById("connectionModeLabel");
  if (toggle) {
    toggle.checked = pref === "online";
  }
  if (label) {
    label.textContent = pref === "online" ? "Online" : "Offline";
  }

  if (pref === "online" && navigator.onLine) {
    serverMode = "online";
    connectWebSocket(false);
  } else {
    serverMode = "local";
    if (socket) {
      try { socket.close(); } catch (e) {}
      socket = null;
    }
    if (connectionStatusIndicator) {
      connectionStatusIndicator.textContent = "Offline";
      connectionStatusIndicator.className = "connection-status offline";
    }
  }
}

// Auto-reconnect listeners
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("App visible, checking connection preference...");
    if (!running) {
      restoreConnectionPreference();
    } else if (serverMode === "online" && (!socket || socket.readyState === WebSocket.CLOSED)) {
      connectWebSocket(false);
    }
  }
});

window.addEventListener("focus", () => {
  console.log("App focused, checking connection preference...");
  if (!running) {
    restoreConnectionPreference();
  } else if (serverMode === "online" && (!socket || socket.readyState === WebSocket.CLOSED)) {
    connectWebSocket(false);
  }
});

window.addEventListener("online", () => {
  console.log("System came online.");
  restoreConnectionPreference();
});

window.addEventListener("offline", () => {
  console.log("System went offline.");
  serverMode = "local";
  if (socket) {
    try { socket.close(); } catch (e) {}
    socket = null;
  }
  if (connectionStatusIndicator) {
    connectionStatusIndicator.textContent = "Offline";
    connectionStatusIndicator.className = "connection-status offline";
  }
});

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

function getPlayerTeam(playerId) {
  if ((currentTeams.A || []).includes(playerId)) return "A";
  if ((currentTeams.B || []).includes(playerId)) return "B";
  return null;
}

function getVoteCounts(votes = {}) {
  const counts = {};
  Object.values(votes).forEach((votedId) => {
    counts[votedId] = (counts[votedId] || 0) + 1;
  });
  return counts;
}

function showFinalVoteOverlay(data) {
  const overlay = document.getElementById("finalVoteOverlay");
  const cardsA = document.getElementById("fvCardsA");
  const cardsB = document.getElementById("fvCardsB");
  if (!overlay || !cardsA || !cardsB) return;

  currentTeams = data.teams || currentTeams || { A: [], B: [] };
  currentTeamTrophies = data.teamTrophies || currentTeamTrophies || { A: 0, B: 0 };
  players = data.players || players;
  finalVoteSecondsTotal = data.secondsLeft || 20;
  finalVoteSelection = null;
  window.__finalVoteSnapshot = {};

  document.getElementById("tournamentOverlay")?.classList.add("hidden");
  document.getElementById("fvTrophyA").textContent = currentTeamTrophies.A || 0;
  document.getElementById("fvTrophyB").textContent = currentTeamTrophies.B || 0;
  cardsA.innerHTML = "";
  cardsB.innerHTML = "";

  const localTeam = getPlayerTeam(localPlayerId);
  const renderTeam = (team, container) => {
    (currentTeams[team] || []).forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return;
      const card = document.createElement("button");
      card.type = "button";
      card.className = `fv-player-card ${player.id === localPlayerId ? "is-me" : ""}`;
      card.dataset.playerId = player.id;
      card.disabled = localTeam !== team;
      card.innerHTML = `
        <img class="fv-card-avatar" src="assets/cards/${player.kind || "chiikawa"}.png" alt="">
        <div class="fv-card-info">
          <div class="fv-card-name">${escapeHTML(player.name)}</div>
          <div class="fv-card-votes" data-vote-count-for="${player.id}">0 votes</div>
        </div>
        <div class="fv-vote-check">OK</div>
      `;
      card.addEventListener("click", () => {
        if (card.disabled) return;
        finalVoteSelection = player.id;
        sendServerMessage("submit_vote", { votedPlayerId: player.id });
        updateVoteCards({ [localPlayerId]: player.id });
        const statusEl = document.getElementById("fvStatusRow");
        if (statusEl) statusEl.textContent = `Vote locked for ${player.name}. Waiting for the teams...`;
      });
      container.appendChild(card);
    });
  };

  renderTeam("A", cardsA);
  renderTeam("B", cardsB);

  const statusEl = document.getElementById("fvStatusRow");
  if (statusEl) {
    statusEl.textContent = localTeam
      ? "Pick one player from your team for the final round."
      : "Spectating the team champion vote.";
  }

  updateVoteCards({});
  updateVoteCountdown(finalVoteSecondsTotal);
  overlay.classList.remove("hidden");
}

function updateVoteCards(votes = {}) {
  const mergedVotes = { ...(window.__finalVoteSnapshot || {}), ...votes };
  window.__finalVoteSnapshot = mergedVotes;
  const counts = getVoteCounts(mergedVotes);

  document.querySelectorAll(".fv-player-card").forEach((card) => {
    const playerId = card.dataset.playerId;
    const selectedByMe = finalVoteSelection === playerId || mergedVotes[localPlayerId] === playerId;
    card.classList.toggle("selected", selectedByMe);
    card.classList.toggle("my-vote", selectedByMe);
    const countEl = card.querySelector("[data-vote-count-for]");
    const count = counts[playerId] || 0;
    if (countEl) countEl.textContent = `${count} vote${count === 1 ? "" : "s"}`;
  });
}

function updateVoteCountdown(secondsLeft) {
  const countEl = document.getElementById("voteCountdownNum");
  const ring = document.getElementById("voteRingFill");
  const seconds = Math.max(0, Number(secondsLeft) || 0);
  if (countEl) countEl.textContent = seconds;
  if (ring) {
    const circumference = 163.4;
    const progress = finalVoteSecondsTotal > 0 ? seconds / finalVoteSecondsTotal : 0;
    ring.style.strokeDashoffset = String(circumference * (1 - progress));
  }
}

function startLocalMapVote(voters, onResolved) {
  const maps = ["classic", "checkered", "colosseum", "powerzone"];
  const overlay = document.getElementById("mapVoteOverlay");
  const timerEl = document.getElementById("mapVoteTimer");
  const voteActors = voters && voters.length ? voters : [{ id: "local_player", kind: selectedCharacter, name: "You" }];
  localMapVoteState = {
    voters: voteActors,
    votes: {},
    secondsLeft: 8,
    onResolved,
    interval: null,
  };
  myLastVote = null;

  document.querySelectorAll(".map-vote-card").forEach((card) => {
    card.classList.remove("voted", "winning-map");
    const mapType = card.getAttribute("data-map");
    const countEl = card.querySelector(".map-vote-count");
    const votersEl = card.querySelector(".map-vote-voters");
    if (countEl) countEl.textContent = "0";
    if (votersEl) votersEl.innerHTML = "";
    if (mapType) drawMiniMapPreview(card.querySelector(".map-vote-preview-canvas"), mapType);
  });

  overlay?.classList.remove("hidden");
  overlay?.classList.add("active");
  if (timerEl) timerEl.textContent = localMapVoteState.secondsLeft;

  voteActors.slice(1).forEach((voter, index) => {
    const mapChoice = maps[(index + Math.floor(Math.random() * maps.length)) % maps.length];
    localMapVoteState.votes[voter.id] = mapChoice;
  });
  updateLocalMapVoteUI();

  localMapVoteState.interval = setInterval(() => {
    if (!localMapVoteState) return;
    localMapVoteState.secondsLeft -= 1;
    if (timerEl) timerEl.textContent = localMapVoteState.secondsLeft;
    if (localMapVoteState.secondsLeft <= 0) {
      finishLocalMapVote();
    }
  }, 1000);
}

function submitLocalMapVote(mapChoice) {
  if (!localMapVoteState || !mapChoice) return;
  const voterId = localMapVoteState.voters[0]?.id || localPlayerId || "local_player";
  localMapVoteState.votes[voterId] = mapChoice;
  myLastVote = mapChoice;
  updateLocalMapVoteUI();
}

function updateLocalMapVoteUI() {
  if (!localMapVoteState) return;
  const counts = { classic: 0, checkered: 0, colosseum: 0, powerzone: 0 };
  Object.values(localMapVoteState.votes).forEach((mapType) => {
    counts[mapType] = (counts[mapType] || 0) + 1;
  });
  Object.keys(counts).forEach((mapType) => {
    const countEl = document.getElementById(`mapVoteCount_${mapType}`);
    const votersEl = document.getElementById(`mapVoteVoters_${mapType}`);
    if (countEl) countEl.textContent = String(counts[mapType]);
    if (votersEl) {
      votersEl.innerHTML = "";
      localMapVoteState.voters.forEach((voter) => {
        if (localMapVoteState.votes[voter.id] !== mapType) return;
        const img = document.createElement("img");
        img.src = `assets/cards/${voter.kind || "chiikawa"}.png`;
        img.style.width = "24px";
        img.style.height = "24px";
        img.style.borderRadius = "50%";
        img.style.border = "2px solid var(--ink)";
        img.style.boxShadow = "1px 1px 0 var(--ink)";
        img.title = voter.name || voter.id;
        votersEl.appendChild(img);
      });
    }
  });
  document.querySelectorAll(".map-vote-card").forEach((card) => {
    card.classList.toggle("voted", card.getAttribute("data-map") === myLastVote);
  });
}

function finishLocalMapVote() {
  if (!localMapVoteState) return;
  clearInterval(localMapVoteState.interval);
  const maps = ["classic", "checkered", "colosseum", "powerzone"];
  if (!localMapVoteState.votes[localMapVoteState.voters[0]?.id || "local_player"]) {
    submitLocalMapVote(document.getElementById("localMapSelect")?.value || "classic");
  }
  const counts = maps.map((mapType) => ({
    mapType,
    count: Object.values(localMapVoteState.votes).filter((vote) => vote === mapType).length,
  }));
  const maxVotes = Math.max(...counts.map((entry) => entry.count));
  const winners = counts.filter((entry) => entry.count === maxVotes).map((entry) => entry.mapType);
  const winningMap = winners[Math.floor(Math.random() * winners.length)] || "classic";
  pendingLocalMapChoice = winningMap;
  document.querySelectorAll(".map-vote-card").forEach((card) => {
    card.classList.toggle("winning-map", card.getAttribute("data-map") === winningMap);
  });
  const callback = localMapVoteState.onResolved;
  localMapVoteState = null;
  setTimeout(() => {
    const overlay = document.getElementById("mapVoteOverlay");
    overlay?.classList.remove("active");
    overlay?.classList.add("hidden");
    callback?.(winningMap);
  }, 650);
}

function resetLobbyMapSelectToNormal() {
  const mapSelect = document.getElementById("localMapSelect");
  if (mapSelect) mapSelect.value = "classic";
}

function showTournamentResults(playersList, winnerId, tournamentFinished) {
  // Sync global players list for drawing avatars
  if (playersList && playersList.length > 0) {
    players = playersList;
  }

  // Delay showing the tournament results overlay by 2.5 seconds
  setTimeout(() => {
    // If the player has already left the game screen (e.g. exited), abort showing results
    if (!gameScreen || !gameScreen.classList.contains("active")) return;

    const overlay = document.getElementById("tournamentOverlay");
    const roundCard = document.getElementById("roundResultsCard");
    const victoryCard = document.getElementById("grandVictoryCard");
    const victoryVideo = document.getElementById("victoryVideo");

    if (!overlay || !roundCard || !victoryCard) return;

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
        const targetSrc = getVideoSrc("hachiware-lobby.mp4");
        if (!victoryVideo.src.endsWith(targetSrc)) {
          victoryVideo.src = targetSrc;
          victoryVideo.load();
        }
        victoryVideo.currentTime = 0;
        playMutedLoop(victoryVideo);
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
        
        if (isTeamMode(currentRoomMode)) {
          // Render 2 big team cards instead of individual player cards
          const teamA = currentTeams?.A || [];
          const teamB = currentTeams?.B || [];
          const scoreA = currentTeamTrophies?.A || 0;
          const scoreB = currentTeamTrophies?.B || 0;
          
          const renderTeamCard = (teamTag, members, score) => {
            const card = document.createElement("div");
            const isWinner = score >= 8 || (winnerId && members.includes(winnerId));
            card.className = `result-team-card ${teamTag.toLowerCase()}-theme ${isWinner ? 'winner' : ''}`;
            
            let trophiesHtml = "";
            for (let i = 1; i <= 8; i++) {
              if (i < score) {
                trophiesHtml += `<span class="trophy-slot active"><svg class="svg-trophy-icon" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.21 1.79 4 4 4h1.09c.72 1.86 2.32 3.18 4.29 3.44V19H9v2h6v-2h-3.38v-2.56c1.97-.26 3.57-1.58 4.29-3.44H17c2.21 0 4-1.79 4-4V7c0-1.1-.9-2-2-2zM5 10V7h2v3H5zm14 0h-2V7h2v3z"/></svg></span>`;
              } else if (i === score && isWinner) {
                trophiesHtml += `<span class="trophy-slot new-active"><svg class="svg-trophy-icon" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.21 1.79 4 4 4h1.09c.72 1.86 2.32 3.18 4.29 3.44V19H9v2h6v-2h-3.38v-2.56c1.97-.26 3.57-1.58 4.29-3.44H17c2.21 0 4-1.79 4-4V7c0-1.1-.9-2-2-2zM5 10V7h2v3H5zm14 0h-2V7h2v3z"/></svg></span>`;
              } else {
                trophiesHtml += `<span class="trophy-slot"><svg class="svg-trophy-icon" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.21 1.79 4 4 4h1.09c.72 1.86 2.32 3.18 4.29 3.44V19H9v2h6v-2h-3.38v-2.56c1.97-.26 3.57-1.58 4.29-3.44H17c2.21 0 4-1.79 4-4V7c0-1.1-.9-2-2-2zM5 10V7h2v3H5zm14 0h-2V7h2v3z"/></svg></span>`;
              }
            }
            
            const memberNames = members.map(id => {
              const p = players.find(player => player.id === id);
              return p ? escapeHTML(p.name) : "Unknown";
            }).join(", ");
            
            card.innerHTML = `
              <div class="result-team-name">${teamTag}</div>
              <div class="result-team-members">${memberNames}</div>
              <div class="result-trophies-container">
                ${trophiesHtml}
              </div>
            `;
            return card;
          };
          
          resultsRow.appendChild(renderTeamCard("Team A", teamA, scoreA));
          resultsRow.appendChild(renderTeamCard("Team B", teamB, scoreB));
          
        } else {
          // Normal individual rendering
          players.forEach((p, idx) => {
            const card = document.createElement("div");
            const isWinner = p.id === winnerId;
            card.className = `result-player-card ${isWinner ? 'winner' : ''}`;
            
            // Staggered entrance animation
            card.style.animation = "resultCardEntrance 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both";
            card.style.animationDelay = `${idx * 150}ms`;

            let trophiesHtml = "";
            const trophiesCount = p.trophies || 0;
            for (let i = 1; i <= 8; i++) {
              if (i < trophiesCount) {
                trophiesHtml += `<span class="trophy-slot active"><svg class="svg-trophy-icon" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.21 1.79 4 4 4h1.09c.72 1.86 2.32 3.18 4.29 3.44V19H9v2h6v-2h-3.38v-2.56c1.97-.26 3.57-1.58 4.29-3.44H17c2.21 0 4-1.79 4-4V7c0-1.1-.9-2-2-2zM5 10V7h2v3H5zm14 0h-2V7h2v3z"/></svg></span>`;
              } else if (i === trophiesCount && isWinner) {
                // Animate new trophy
                trophiesHtml += `<span class="trophy-slot new-active"><svg class="svg-trophy-icon" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.21 1.79 4 4 4h1.09c.72 1.86 2.32 3.18 4.29 3.44V19H9v2h6v-2h-3.38v-2.56c1.97-.26 3.57-1.58 4.29-3.44H17c2.21 0 4-1.79 4-4V7c0-1.1-.9-2-2-2zM5 10V7h2v3H5zm14 0h-2V7h2v3z"/></svg></span>`;
              } else {
                trophiesHtml += `<span class="trophy-slot"><svg class="svg-trophy-icon" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.21 1.79 4 4 4h1.09c.72 1.86 2.32 3.18 4.29 3.44V19H9v2h6v-2h-3.38v-2.56c1.97-.26 3.57-1.58 4.29-3.44H17c2.21 0 4-1.79 4-4V7c0-1.1-.9-2-2-2zM5 10V7h2v3H5zm14 0h-2V7h2v3z"/></svg></span>`;
              }
            }

            card.style.position = "relative";
            const crownBadge = isWinner ? `<div class="result-crown-badge" style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); font-size: 20px; filter: drop-shadow(1.5px 1.5px 0 #000); animation: crownFloat 0.8s ease-in-out infinite alternate; z-index: 10;">👑</div>` : "";

            card.innerHTML = `
              ${crownBadge}
              <canvas id="result_avatar_${p.id}" class="result-avatar-canvas" width="60" height="60"></canvas>
              <div class="result-player-name">${escapeHTML(p.name)}</div>
              <div class="result-trophies-container">
                ${trophiesHtml}
              </div>
            `;
            resultsRow.appendChild(card);
          });
        }
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
  }, 2500);
}

function localStartNextRound() {
  map = buildLocalMap(currentMapType);
  const activeStarts = getStartsForMap(currentMapType);
  
  // Reposition players and reset alive state while preserving trophies
  players.forEach((p, index) => {
    const spawn = activeStarts[index % activeStarts.length];
    p.x = spawn.x * TILE + TILE / 2;
    p.y = spawn.y * TILE + TILE / 2;
    p.targetX = p.x;
    p.targetY = p.y;
    p.dx = 0;
    p.dy = 0;
    p.alive = true;
    p.speed = p.ai ? 178 : 142;
    p.bombs = 1;
    p.range = getStartingBombRange(p.ai);
    p.cooldown = 0;
    p.invuln = 1.2;
    p.hasPunch = false;
    p.hasSlide = false;
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
  couchTouchKeys.clear();
  couchPlayerTouchKeys.clear();

  bombs = [];
  blasts = [];
  pickups = [];
  seedLocalPowerZonePickups();
  particles = [];
  roundTime = 150;
  running = true;
  startCountdownTimer = 3.5;
  startCountdownState = "3";
  shakeTimer = 0;
  zoneActive = false;
  zoneLayer = 0;
  zoneStepTimer = 0;
  localMatchRewarded = false;
  gameMessage = "";

  timerEl.textContent = formatTime(roundTime);
  stateEl.textContent = "Battle!";
  updateHudSidebar();
  updateCouchControlPicker();
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
    const { data: { session } } = await withTimeout(supabaseClient.auth.getSession(), 6000, "Auth session check");
    if (session && session.user) {
      await handleAuthenticatedUser(session.user);
    } else {
      switchScreen(loginScreen);
    }
  } catch (err) {
    console.error("Error checking session:", err);
    serverMode = "local";
    const savedLocalName = localStorage.getItem("local_username") || "Friend";
    if (usernameInput) usernameInput.value = savedLocalName;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = savedLocalName;
    finishStartup();
    switchScreen(menuScreen);
    tryPlayMusic();
  }
}

async function handleAuthenticatedUser(user) {
  try {
    // Load progression
    try {
      await withTimeout(loadProgression(), 6000, "Progression load");
    } catch (progressErr) {
      console.warn("Progression load skipped:", progressErr);
    }

    // Check if user has a username
    const { data, error } = await withTimeout(supabaseClient
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single(), 6000, "Profile load");

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is empty result

    if (data && data.username) {
      currentSocialUsername = data.username;
      if (usernameInput) usernameInput.value = data.username;
      localStorage.setItem("local_username", data.username);
      updateProgressionUI();
      
      const status = localStorage.getItem("tutorial_status") || "not_started";
      if (status === "not_started" || status === "vs_screen" || status === "tutorial_match") {
        localStorage.setItem("tutorial_status", "tutorial_match_completed");
      }

      // User has a username, proceed to main menu
      finishStartup();
      switchScreen(menuScreen);
      tryPlayMusic();
    } else {
      // No username, show intro registration screen
      finishStartup();
      startUsernameIntroFlow();
    }
  } catch (err) {
    console.error("Error handling authenticated user:", err);
    finishStartup();
    const isNetworkError = !navigator.onLine || 
                           err.message?.includes("Failed to fetch") || 
                           err.message?.includes("NetworkError") || 
                           err.message?.includes("timeout") || 
                           err.name === "TimeoutError";
    if (isNetworkError) {
      serverMode = "local";
      const savedLocalName = localStorage.getItem("local_username") || "Friend";
      if (usernameInput) usernameInput.value = savedLocalName;
      if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = savedLocalName;
      switchScreen(menuScreen);
      tryPlayMusic();
    } else {
      showAppError("Profile load failed. You can still choose a username.", err.message || err);
      startUsernameIntroFlow(); // fallback to intro
    }
  }
}

// Bouncing character introduction dialogue typewriter effect
let introTypewriterInterval = null;
function startUsernameIntroFlow() {
  const tutorialStatus = localStorage.getItem("tutorial_status") || "not_started";
  const savedLocalName = localStorage.getItem("local_username");

  if (tutorialStatus === "not_started" && !savedLocalName) {
    startInteractiveCutscene();
    return;
  }

  if (!navigator.onLine) {
    serverMode = "local";
    const fallbackName = savedLocalName || "Friend";
    if (usernameInput) usernameInput.value = fallbackName;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = fallbackName;
    switchScreen(menuScreen);
    tryPlayMusic();
    return;
  }

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

      // Automatically sign in or check user if a session is immediately established (i.e. email confirmation disabled)
      if (data.session) {
        setTimeout(async () => {
          await handleAuthenticatedUser(data.user);
        }, 1500);
      } else {
        if (authMessage) {
          authMessage.textContent = "Account created! Please check your email to verify your account, then log in.";
          authMessage.className = "auth-message success";
          authMessage.classList.remove("hidden");
        }
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

// Hook up Google & Discord OAuth logins
const btnGoogleLogin = document.getElementById("btnGoogleLogin");
if (btnGoogleLogin) {
  btnGoogleLogin.addEventListener("click", async () => {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data && data.url) {
        // Open the OAuth screen in a popup window so it doesn't reload the game tab
        window.open(data.url, "OAuthSignIn", "width=600,height=800,resizable=yes,scrollbars=yes");
      }
    } catch (err) {
      console.error("Google login error:", err);
      if (authMessage) {
        authMessage.textContent = err.message || "Failed to log in with Google.";
        authMessage.className = "auth-message error";
        authMessage.classList.remove("hidden");
      }
    }
  });
}

const btnDiscordLogin = document.getElementById("btnDiscordLogin");
if (btnDiscordLogin) {
  btnDiscordLogin.addEventListener("click", async () => {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data && data.url) {
        // Open the OAuth screen in a popup window so it doesn't reload the game tab
        window.open(data.url, "OAuthSignIn", "width=600,height=800,resizable=yes,scrollbars=yes");
      }
    } catch (err) {
      console.error("Discord login error:", err);
      if (authMessage) {
        authMessage.textContent = err.message || "Failed to log in with Discord.";
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

    if (serverMode === "local" || !supabaseClient) {
      const username = introUsernameInput.value.trim();
      if (username.length < 3) {
        if (usernameMessage) {
          usernameMessage.textContent = "Username must be at least 3 characters!";
          usernameMessage.className = "username-message error";
          usernameMessage.classList.remove("hidden");
        }
        return;
      }
      localStorage.setItem("local_username", username);
      if (usernameInput) usernameInput.value = username;
      if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = username;
      updateProgressionUI();

      if (usernameMessage) usernameMessage.classList.add("hidden");
      
      const tutorialStatus = localStorage.getItem("tutorial_status");
      if (tutorialStatus === "vs_screen") {
        localStorage.setItem("tutorial_status", "tutorial_match");
        startTutorialLocalMatch();
        return;
      }

      switchScreen(menuScreen);
      tryPlayMusic();

      if (pendingLocalConnect) {
        pendingLocalConnect = false;
        connectWebSocket(true);
        const squadTabBtn = document.querySelector('.tab-btn[data-tab="squad"]');
        if (squadTabBtn) squadTabBtn.click();
      }
      return;
    }

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

      // Create or update username in profiles
      const { error } = await supabaseClient
        .from('profiles')
        .upsert({
          id: user.id,
          username: username,
          character: selectedCharacter || "chiikawa",
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (error) throw error;

      if (usernameMessage) usernameMessage.classList.add("hidden");
      
      // Update UI nicknames
      if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = username;
      if (usernameInput) usernameInput.value = username;
      currentSocialUsername = username;
      localStorage.setItem("local_username", username);
      updateProgressionUI();

      // Go to main menu
      const tutorialStatus = localStorage.getItem("tutorial_status");
      if (tutorialStatus === "vs_screen") {
        localStorage.setItem("tutorial_status", "tutorial_match");
        startTutorialLocalMatch();
        return;
      }

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

// Hook up Exit Game button in Settings (PC only)
const btnExitGame = document.getElementById("btnExitGame");
if (btnExitGame) {
  const isPC = typeof window.electronAPI !== 'undefined';
  if (isPC) {
    // Show the exit game button container row
    const pcExitRow = document.getElementById("pcExitRow");
    if (pcExitRow) pcExitRow.style.display = "flex";
    
    btnExitGame.addEventListener("click", () => {
      window.electronAPI.exitToLauncher();
    });
  }
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
      currentSocialUsername = "";
      localStorage.removeItem("local_username");
      if (usernameInput) usernameInput.value = "Friend";
      if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = "Friend";
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
  if (pendingOAuthError) {
    finishStartup();
    switchScreen(loginScreen);
    if (authMessage) {
      authMessage.textContent = `Login failed: ${pendingOAuthError}`;
      authMessage.className = "auth-message error";
      authMessage.classList.remove("hidden");
    }
    pendingOAuthError = "";
    return;
  }

  // Ensure title screen starts active under the splash overlay
  finishStartup();
  if (titleScreen) {
    switchScreen(titleScreen);
  }

  // 1. Studio Logo Animation
  if (studioSplashScreen) {
    // Make sure the splash overlay starts active
    studioSplashScreen.style.display = "";
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
      const startModeSelectionDialog = document.getElementById("startModeSelectionDialog");
      if (startModeSelectionDialog) {
        startModeSelectionDialog.classList.remove("hidden");
      } else {
        checkAuthSession();
      }
    });
  }
}

function initMobileFullscreenPrompt() {
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const isMobileOrTablet = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|Tablet/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth <= 1366) || isCoarsePointer;
  
  const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
  if (isIPhone) {
    document.body.classList.add("is-iphone");
  }
  
  if (isMobileOrTablet) {
    document.body.classList.add("is-mobile");
    
    // iPhones do not support fullscreen API for elements, so we skip the fullscreen prompt
    if (isIPhone) {
      document.getElementById("mobileFullscreenReminder")?.classList.add("hidden");
      return;
    }
    
    // Only show fullscreen prompt in web browser (not in Android APK where protocol is file:)
    if (window.location.protocol !== "file:") {
      const reminder = document.getElementById("mobileFullscreenReminder");
      const btn = document.getElementById("btnMobileFullscreenYes");
      
      const updatePrompt = () => {
        if (isFullscreenActive()) {
          reminder?.classList.add("hidden");
        } else {
          reminder?.classList.remove("hidden");
        }
      };
      
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = "true";
        btn.addEventListener("click", () => {
          safeRequestFullscreen().then(updatePrompt);
        });
      }
      
      // Listen to fullscreen changes
      document.addEventListener("fullscreenchange", updatePrompt);
      document.addEventListener("webkitfullscreenchange", updatePrompt);
      document.addEventListener("mozfullscreenchange", updatePrompt);
      document.addEventListener("MSFullscreenChange", updatePrompt);
      
      // Run initial check
      updatePrompt();
    } else {
      document.getElementById("mobileFullscreenReminder")?.classList.add("hidden");
    }
  } else {
    document.getElementById("mobileFullscreenReminder")?.classList.add("hidden");
  }
}

async function checkInitialSession() {
  initMobileFullscreenPrompt();

  // If the device is offline, skip trying to connect online and bypass Supabase checks
  if (!navigator.onLine) {
    console.log("Offline mode detected. Skipping online connection and Supabase check.");
    serverMode = "local";
    initIntroSequence();
    return;
  }

  if (serverMode === "local") {
    initIntroSequence();
    return;
  }

  if (pendingOAuthError) {
    if (isOAuthPopup) {
      try {
        window.opener?.postMessage({ type: "oauth_error", message: pendingOAuthError }, window.location.origin);
      } catch (err) {
        console.warn("Unable to notify opener about OAuth error:", err);
      }
      setTimeout(() => window.close(), 800);
      return;
    }

    initIntroSequence();
    return;
  }

  if (isOAuthPopup) {
    // Popup window will handle its own closing, don't trigger intro transitions
    return;
  }

  if (!supabaseClient) {
    initIntroSequence();
    return;
  }

  try {
    const { data: { session } } = await withTimeout(supabaseClient.auth.getSession(), 6000, "Initial auth session check");
    if (session && session.user) {
      // User is already authenticated! Bypass splash screen and go directly to main menu
      await handleAuthenticatedUser(session.user);
    } else {
      // No active session, display normal intro splash and title screens
      initIntroSequence();
    }
  } catch (err) {
    console.warn("Initial session check failed (likely offline or network issue):", err);
    initIntroSequence();
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

// ================================================================
// SOCIAL SYSTEM — Online Presence, Friends, Chat, Invites
// ================================================================

// State
let presenceChannel = null;
let onlinePresenceMap = {}; // userId -> { username, character, status }
let challengeTargetUserId = null;

// ----------------------------------------------------------------
// Open/Close Social Modal
// ----------------------------------------------------------------

function openSocialModal() {
  const modal = document.getElementById("socialModal");
  if (modal) {
    modal.classList.remove("hidden");
    if (serverMode === "local") {
      document.querySelector('.social-tab-btn[data-social-tab="online"]')?.click();
      requestLanRooms();
      renderLanRoomsTab();
    } else {
      refreshSocialData();
    }
  }
}

function closeSocialModal() {
  const modal = document.getElementById("socialModal");
  if (modal) modal.classList.add("hidden");
}

document.getElementById("closeSocialModal")?.addEventListener("click", closeSocialModal);
document.getElementById("socialModal")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("socialModal")) closeSocialModal();
});

// Social tab switching
document.querySelectorAll(".social-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".social-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tabName = btn.getAttribute("data-social-tab");
    document.querySelectorAll(".social-tab-content").forEach((c) => c.classList.remove("active"));
    const target = document.getElementById(`socialTab_${tabName}`);
    if (target) target.classList.add("active");
  });
});

// Wire FRIENDS button in squad lobby
document.querySelector(".friends-btn")?.addEventListener("click", () => {
  openFriendsList();
});

// ----------------------------------------------------------------
// Open/Close Global Chat Popup
// ----------------------------------------------------------------

function openGlobalChat() {
  const popup = document.getElementById("globalChatPopup");
  if (popup) popup.classList.remove("hidden");
}

function closeGlobalChat() {
  const popup = document.getElementById("globalChatPopup");
  if (popup) popup.classList.add("hidden");
}

document.getElementById("closeGlobalChat")?.addEventListener("click", closeGlobalChat);
document.getElementById("globalChatPopup")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("globalChatPopup")) closeGlobalChat();
});

function closeLobbyChat() {
  const popup = document.getElementById("lobbyChatPopup");
  if (popup) popup.classList.add("hidden");
}

document.getElementById("closeLobbyChat")?.addEventListener("click", closeLobbyChat);
document.getElementById("lobbyChatPopup")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("lobbyChatPopup")) closeLobbyChat();
});

// Wire CHAT button in squad lobby to open ZZZ Chat
document.querySelector(".chat-btn")?.addEventListener("click", () => {
  openKnockChat();
});

// Global chat form submit
document.getElementById("globalChatForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("globalChatInput");
  const text = (input?.value || "").trim();
  if (!text || !supabaseClient || !currentSocialUsername) return;
  input.value = "";

  if (presenceChannel) {
    presenceChannel.send({
      type: "broadcast",
      event: "global_chat",
      payload: {
        senderId: currentSocialUserId,
        senderName: currentSocialUsername,
        text,
        ts: Date.now()
      }
    });
  }
  appendGlobalChatMessage(currentSocialUsername, text, true, false);
});

function appendGlobalChatMessage(sender, text, isMe, isSystem) {
  const msgs = document.getElementById("globalChatMessages");
  if (!msgs) return;
  const div = document.createElement("div");
  div.className = `global-chat-msg${isMe ? " me" : ""}${isSystem ? " system" : ""}`;
  if (isSystem) {
    div.innerHTML = `<span class="gchat-text">${escapeHTML(text)}</span>`;
  } else {
    div.innerHTML = `<span class="gchat-sender">${escapeHTML(sender)}</span><span class="gchat-text">${escapeHTML(text)}</span>`;
  }
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

// ----------------------------------------------------------------
// Supabase Realtime Presence
// ----------------------------------------------------------------

async function joinOnlinePresence() {
  if (!supabaseClient || !currentSocialUserId) return;
  if (presenceChannel) {
    try { await supabaseClient.removeChannel(presenceChannel); } catch(e) {}
    presenceChannel = null;
  }

  presenceChannel = supabaseClient.channel("chiikawa-royale-lobby", {
    config: { presence: { key: currentSocialUserId } }
  });

  presenceChannel
    .on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      onlinePresenceMap = {};
      for (const [userId, presences] of Object.entries(state)) {
        if (presences[0]) onlinePresenceMap[userId] = presences[0];
      }
      renderOnlineUsersTab();
      renderFriendsTab();
      updateOnlinePill();
    })
    .on("presence", { event: "join" }, ({ key, newPresences }) => {
      onlinePresenceMap[key] = newPresences[0];
      renderOnlineUsersTab();
      renderFriendsTab();
      updateOnlinePill();
    })
    .on("presence", { event: "leave" }, ({ key }) => {
      delete onlinePresenceMap[key];
      renderOnlineUsersTab();
      renderFriendsTab();
      updateOnlinePill();
    })
    .on("broadcast", { event: "global_chat" }, ({ payload }) => {
      if (payload.senderId === currentSocialUserId) return;
      appendGlobalChatMessage(payload.senderName, payload.text, false, false);
    })
    .on("broadcast", { event: "room_invite" }, ({ payload }) => {
      if (payload.targetId !== currentSocialUserId) return;
      showInviteToast(payload.fromName, payload.roomCode);
    })
    .on("broadcast", { event: "direct_message" }, ({ payload }) => {
      if (payload.recipientId === currentSocialUserId) {
        if (typeof receiveKnockDirectMessage === "function") {
          receiveKnockDirectMessage(payload.senderId, payload.senderName, payload.text, payload.ts);
        }
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          userId: currentSocialUserId,
          username: currentSocialUsername,
          character: selectedCharacter,
          status: "menu"
        });
      }
    });
}

async function updateMyPresenceStatus(newStatus) {
  if (presenceChannel && currentSocialUserId) {
    try {
      await presenceChannel.track({
        userId: currentSocialUserId,
        username: currentSocialUsername,
        character: selectedCharacter,
        status: newStatus
      });
    } catch(e) {}
  }
}

function updateOnlinePill() {
  const count = Object.keys(onlinePresenceMap).length;
  const pill = document.querySelector(".lobby-online-pill");
  if (pill) {
    pill.innerHTML = `<span class="online-dot"></span> ONLINE ${count}`;
  }
  const label = document.getElementById("onlineCountLabel");
  if (label) {
    label.textContent = `${count} player${count !== 1 ? "s" : ""} online`;
  }
}

// ----------------------------------------------------------------
// Fetch Friends & Pending Requests
// ----------------------------------------------------------------

async function fetchFriends() {
  if (!supabaseClient || !currentSocialUserId) return;
  try {
    const { data, error } = await supabaseClient
      .from("friendships")
      .select("id, requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(id, username, character), addressee:profiles!friendships_addressee_id_fkey(id, username, character)")
      .or(`requester_id.eq.${currentSocialUserId},addressee_id.eq.${currentSocialUserId}`)
      .eq("status", "accepted");
    if (error) throw error;
    myFriendIds = new Set();
    myFriendshipMap = {};
    (data || []).forEach((f) => {
      const fp = f.requester_id === currentSocialUserId ? f.addressee : f.requester;
      if (fp) {
        myFriendIds.add(fp.id);
        myFriendshipMap[fp.id] = { friendshipId: f.id, username: fp.username, character: fp.character || "chiikawa" };
      }
    });
  } catch (err) { console.error("fetchFriends:", err); }
}

async function fetchPendingRequests() {
  if (!supabaseClient || !currentSocialUserId) return;
  try {
    const { data, error } = await supabaseClient
      .from("friendships")
      .select("id, requester_id, requester:profiles!friendships_requester_id_fkey(id, username, character)")
      .eq("addressee_id", currentSocialUserId)
      .eq("status", "pending");
    if (error) throw error;
    pendingRequests = data || [];
    const badge = document.getElementById("pendingBadge");
    if (badge) {
      if (pendingRequests.length > 0) {
        badge.textContent = pendingRequests.length;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }
  } catch (err) { console.error("fetchPendingRequests:", err); }
}

async function sendFriendRequest(targetUserId) {
  if (!supabaseClient || !currentSocialUserId) return;
  try {
    const { data: existing } = await supabaseClient
      .from("friendships")
      .select("id, status")
      .or(`and(requester_id.eq.${currentSocialUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentSocialUserId})`)
      .maybeSingle();

    if (existing) {
      showToastMsg(existing.status === "accepted" ? "Already friends! 💚" : "Request already sent! ⏳");
      return;
    }
    const { error } = await supabaseClient
      .from("friendships")
      .insert({ requester_id: currentSocialUserId, addressee_id: targetUserId });
    if (error) throw error;
    showToastMsg("Friend request sent! 🎉");
    await refreshSocialData();
  } catch (err) {
    console.error("sendFriendRequest:", err);
    showToastMsg("Could not send request.");
  }
}

async function acceptFriendRequest(friendshipId) {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    if (error) throw error;
    showToastMsg("Friend request accepted! 💚");
    await refreshSocialData();
  } catch (err) { console.error("acceptFriendRequest:", err); }
}

async function declineFriendRequest(friendshipId) {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.from("friendships").delete().eq("id", friendshipId);
    if (error) throw error;
    showToastMsg("Request declined.");
    await refreshSocialData();
  } catch (err) { console.error("declineFriendRequest:", err); }
}

async function searchUsers(query) {
  if (!supabaseClient || !query || query.trim().length < 2) return [];
  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, username, character")
      .ilike("username", `%${query.trim()}%`)
      .neq("id", currentSocialUserId)
      .limit(12);
    if (error) throw error;
    return data || [];
  } catch (err) { console.error("searchUsers:", err); return []; }
}

async function refreshSocialData() {
  await Promise.all([fetchFriends(), fetchPendingRequests()]);
  renderOnlineUsersTab();
  renderFriendsTab();
  renderPendingTab();
}

// ----------------------------------------------------------------
// Render Social Tabs
// ----------------------------------------------------------------

function makeStatusInfo(userId) {
  const p = onlinePresenceMap[userId];
  if (!p) return { dot: "offline", text: "Offline" };
  if (p.status === "in-game")  return { dot: "ingame", text: "In-game" };
  if (p.status === "in-lobby") return { dot: "ingame", text: "In a room" };
  return { dot: "online", text: "Online" };
}

function buildSocialUserItem(userId, username, character, statusInfo, isFriend, showInvite) {
  const isOnline = statusInfo.dot !== "offline";
  const li = document.createElement("li");
  li.className = "social-user-item";
  li.innerHTML = `
    <div class="knock-avatar friend-avatar">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white" style="display: block; opacity: 0.95; margin: auto;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    </div>
    <div class="social-user-info">
      <div class="social-user-name">${escapeHTML(username)}</div>
      <div class="social-user-status"><span class="status-dot ${statusInfo.dot}"></span> ${statusInfo.text}</div>
    </div>
    <div class="social-action-btns">
      ${isFriend ? `<span class="btn-friend-already">✓ Friend</span>` : `<button class="btn-add-friend" data-uid="${userId}">+ Add</button>`}
      ${showInvite ? `<button class="btn-invite-to-room" data-uid="${userId}" data-uname="${escapeHTML(username)}">Invite</button>` : ""}
    </div>
  `;
  li.querySelector(".btn-add-friend")?.addEventListener("click", () => sendFriendRequest(userId));
  li.querySelector(".btn-invite-to-room")?.addEventListener("click", () => sendRoomInvite(userId, username));
  return li;
}

function renderOnlineUsersTab() {
  if (serverMode === "local") {
    renderLanRoomsTab();
    return;
  }
  const list = document.getElementById("onlineUsersList");
  if (!list) return;
  const entries = Object.entries(onlinePresenceMap).filter(([uid]) => uid !== currentSocialUserId);
  if (!entries.length) {
    list.innerHTML = `<li class="social-empty-state">No other players online right now.</li>`;
    return;
  }
  list.innerHTML = "";
  entries.forEach(([userId, p]) => {
    const isFriend = myFriendIds.has(userId);
    const statusInfo = makeStatusInfo(userId);
    const isInvitable = (serverMode === "online" && statusInfo.dot !== "offline");
    const li = buildSocialUserItem(userId, p.username || userId, p.character || "chiikawa", statusInfo, isFriend, isInvitable);
    list.appendChild(li);
  });
}

function renderFriendsTab() {
  const list = document.getElementById("friendsList");
  if (!list) return;
  if (!myFriendIds.size) {
    list.innerHTML = `<li class="social-empty-state">No friends yet. Search for players to add!</li>`;
    return;
  }
  list.innerHTML = "";
  myFriendIds.forEach((friendId) => {
    const info = myFriendshipMap[friendId];
    if (!info) return;
    const presence = onlinePresenceMap[friendId];
    const statusInfo = makeStatusInfo(friendId);
    const isOnline = statusInfo.dot !== "offline";
    const li = document.createElement("li");
    li.className = "social-user-item";
    li.innerHTML = `
      <div class="knock-avatar friend-avatar">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="white" style="display: block; opacity: 0.95; margin: auto;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </div>
      <div class="social-user-info">
        <div class="social-user-name">${escapeHTML(info.username)}</div>
        <div class="social-user-status"><span class="status-dot ${statusInfo.dot}"></span> ${statusInfo.text}</div>
      </div>
      <div class="social-action-btns">
        ${(serverMode === "online" && statusInfo.dot !== "offline") ? `<button class="btn-invite-to-room" data-uid="${friendId}" data-uname="${escapeHTML(info.username)}">Invite</button>` : ""}
      </div>
    `;
    li.querySelector(".btn-invite-to-room")?.addEventListener("click", () => sendRoomInvite(friendId, info.username));
    list.appendChild(li);
  });
}

function renderLanRoomsTab() {
  const list = document.getElementById("onlineUsersList");
  const label = document.getElementById("onlineCountLabel");
  if (!list) return;
  if (label) label.textContent = `${lanRooms.length} LAN room${lanRooms.length === 1 ? "" : "s"} found`;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    list.innerHTML = `<li class="social-empty-state">Connect to your LAN server first.</li>`;
    return;
  }
  if (!lanRooms.length) {
    list.innerHTML = `<li class="social-empty-state">No LAN rooms yet. Create a room, then friends on the same Wi-Fi can join it.</li>`;
    return;
  }
  list.innerHTML = "";
  lanRooms.forEach((room) => {
    const isCurrentRoom = room.roomCode === roomCode;
    const li = document.createElement("li");
    li.className = "social-user-item";
    const playerNames = (room.players || []).map((p) => p.ai ? "CPU" : escapeHTML(p.name)).join(", ");
    li.innerHTML = `
      <div class="knock-avatar room-avatar">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="white" style="display: block; opacity: 0.95; margin: auto;"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      </div>
      <div class="social-user-info">
        <div class="social-user-name">Room ${escapeHTML(room.roomCode)} ${isCurrentRoom ? "(your room)" : ""}</div>
        <div class="social-user-status"><span class="status-dot online"></span> ${escapeHTML(room.mode || "standard").toUpperCase()} - ${room.playerCount}/${room.maxPlayers} - ${escapeHTML(room.state)}</div>
        <div class="social-user-status">${playerNames || "Waiting for players"}</div>
      </div>
      <div class="social-action-btns">
        ${isCurrentRoom ? `<span class="btn-friend-already">Joined</span>` : `<button class="btn-invite-to-room" data-room="${escapeHTML(room.roomCode)}">Join</button>`}
      </div>
    `;
    li.querySelector(".btn-invite-to-room")?.addEventListener("click", () => {
      const name = usernameInput?.value.trim() || localStorage.getItem("local_username") || "Friend";
      sendServerMessage("join_room", { name, kind: selectedCharacter, roomCode: room.roomCode });
      closeSocialModal();
    });
    list.appendChild(li);
  });
}

function renderPendingTab() {
  const list = document.getElementById("pendingRequestsList");
  if (!list) return;
  if (!pendingRequests.length) {
    list.innerHTML = `<li class="social-empty-state">No pending friend requests.</li>`;
    return;
  }
  list.innerHTML = "";
  pendingRequests.forEach((req) => {
    const rp = req.requester;
    if (!rp) return;
    const li = document.createElement("li");
    li.className = "social-user-item";
    li.innerHTML = `
      <div class="knock-avatar friend-avatar">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="white" style="display: block; opacity: 0.95; margin: auto;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </div>
      <div class="social-user-info">
        <div class="social-user-name">${escapeHTML(rp.username || "Unknown")}</div>
        <div class="social-user-status">Wants to be your friend!</div>
      </div>
      <div class="social-action-btns">
        <button class="btn-accept-req" data-fid="${req.id}">✓ Accept</button>
        <button class="btn-decline-req" data-fid="${req.id}">✗ Decline</button>
      </div>
    `;
    li.querySelector(".btn-accept-req")?.addEventListener("click", () => acceptFriendRequest(req.id));
    li.querySelector(".btn-decline-req")?.addEventListener("click", () => declineFriendRequest(req.id));
    list.appendChild(li);
  });
}

// ----------------------------------------------------------------
// Search
// ----------------------------------------------------------------

let searchDebounceTimer = null;
document.getElementById("socialSearchInput")?.addEventListener("input", (e) => {
  clearTimeout(searchDebounceTimer);
  const q = e.target.value.trim();
  if (!q) { renderOnlineUsersTab(); return; }
  searchDebounceTimer = setTimeout(() => runUserSearch(q), 400);
});
document.getElementById("socialSearchBtn")?.addEventListener("click", () => {
  const q = document.getElementById("socialSearchInput")?.value.trim();
  if (q) runUserSearch(q);
});

async function runUserSearch(q) {
  const list = document.getElementById("onlineUsersList");
  if (!list) return;
  document.querySelector('[data-social-tab="online"]')?.click();
  list.innerHTML = `<li class="social-empty-state">Searching...</li>`;
  const results = await searchUsers(q);
  if (!results.length) {
    list.innerHTML = `<li class="social-empty-state">No players found matching "${escapeHTML(q)}".</li>`;
    return;
  }
  list.innerHTML = "";
  results.forEach((user) => {
    const isFriend = myFriendIds.has(user.id);
    const statusInfo = makeStatusInfo(user.id);
    const isInvitable = (serverMode === "online" && statusInfo.dot !== "offline");
    const li = buildSocialUserItem(user.id, user.username, user.character, statusInfo, isFriend, isInvitable);
    list.appendChild(li);
  });
}

// ----------------------------------------------------------------
// Room Invites
// ----------------------------------------------------------------

function sendRoomInvite(targetUserId, targetUsername) {
  if (serverMode !== "online" || !socket || socket.readyState !== WebSocket.OPEN) {
    showToastMsg("You must be connected to an online server to invite players.");
    return;
  }
  if (!roomCode || roomCode === "LOCAL" || roomCode === "4P" || roomCode === "LOCAL_BR") {
    pendingInviteUserId = targetUserId;
    pendingInviteUsername = targetUsername;
    if (!isCreatingRoom) {
      isCreatingRoom = true;
      const name = getActivePlayerName();
      sendServerMessage("create_room", { name, kind: selectedCharacter, isPrivate: true });
    }
    showToastMsg("Creating online room and inviting...");
    return;
  }
  if (!presenceChannel) {
    showToastMsg("Establishing connection to room, please try again in a moment.");
    return;
  }
  presenceChannel.send({
    type: "broadcast",
    event: "room_invite",
    payload: { targetId: targetUserId, fromId: currentSocialUserId, fromName: currentSocialUsername, roomCode }
  });
  showToastMsg(`Invite sent to ${targetUsername}! 📨`);
}

let inviteToastTimeout = null;
function showInviteToast(fromName, code) {
  const overlay = document.getElementById("roomInviteOverlay");
  const textEl = document.getElementById("inviteOverlayText");
  if (!overlay || !textEl) return;
  
  textEl.innerHTML = `🎮 <strong>${escapeHTML(fromName)}</strong> invites you to room <strong style="color:var(--yellow);font-size:20px;">${escapeHTML(code)}</strong>`;
  overlay.classList.remove("hidden");
  
  const acceptBtn = document.getElementById("inviteOverlayAccept");
  const declineBtn = document.getElementById("inviteOverlayDecline");
  
  // Clear old listeners by cloning
  const newAccept = acceptBtn.cloneNode(true);
  acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);
  const newDecline = declineBtn.cloneNode(true);
  declineBtn.parentNode.replaceChild(newDecline, declineBtn);
  
  newAccept.addEventListener("click", () => {
    overlay.classList.add("hidden");
    if (joinCodeInput) joinCodeInput.value = code;
    // Switch to squad tab
    document.querySelector('.tab-btn[data-tab="squad"]')?.click();
    const name = usernameInput?.value.trim() || currentSocialUsername || "Friend";
    sendServerMessage("join_room", { name, kind: selectedCharacter, roomCode: code });
    matchmakingDialog?.classList.add("hidden");
  });
  
  newDecline.addEventListener("click", () => {
    overlay.classList.add("hidden");
  });
}

function showToastMsg(msg) {
  let toast = document.getElementById("feedbackToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "feedbackToast";
    toast.className = "invite-toast";
    toast.style.bottom = "90px";
    document.body.appendChild(toast);
  }
  toast.innerHTML = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function showGemClaimRewardModal(amount, description) {
  const modal = document.getElementById("gemRewardModal");
  if (!modal) return;
  
  const subEl = document.getElementById("gemRewardSub");
  if (subEl) {
    if (description) {
      subEl.innerHTML = `${description}<br><span style="font-size: 22px; color: #ffd86f; display: block; margin-top: 8px;">💎 +${amount} Gems</span>`;
    } else {
      subEl.textContent = `💎 +${amount} Gems`;
    }
  }
  
  modal.style.display = "flex";
  modal.classList.remove("hidden");
  
  const confirmBtn = document.getElementById("gemRewardConfirmBtn");
  if (confirmBtn) {
    const handleClose = () => {
      modal.style.display = "none";
      modal.classList.add("hidden");
      confirmBtn.removeEventListener("click", handleClose);
    };
    confirmBtn.addEventListener("click", handleClose);
  }
}

// ----------------------------------------------------------------
// Update presence status on screen changes
// ----------------------------------------------------------------

const _baseSwitchScreen = switchScreen;
switchScreen = function(screen) {
  _baseSwitchScreen(screen);
  if (screen === gameScreen) {
    const isBR = isBattleRoyale(currentRoomMode);
    if (isBR) {
      document.body.classList.add("br-mode-active");
    } else {
      document.body.classList.remove("br-mode-active");
    }
  } else {
    document.body.classList.remove("br-mode-active");
  }
  if (!currentSocialUserId) return;
  if (screen === gameScreen) {
    updateMyPresenceStatus("in-game");
  } else if (screen === menuScreen) {
    const consoleEl = document.querySelector(".yellow-console");
    if (consoleEl && consoleEl.classList.contains("squad-lobby-active")) {
      updateMyPresenceStatus("in-lobby");
    } else {
      updateMyPresenceStatus("menu");
    }
  }
};

// ----------------------------------------------------------------
// Initialize Social System (called from handleAuthenticatedUser)
// ----------------------------------------------------------------

let socialSystemInitialized = false;
let socialInboxChannel = null;

async function initSocialSystem(user) {
  if (socialSystemInitialized) return;
  socialSystemInitialized = true;
  currentSocialUserId = user.id;
  try {
    const { data } = await supabaseClient
      .from("profiles")
      .select("username, character")
      .eq("id", user.id)
      .single();
    if (data) {
      currentSocialUsername = data.username;
      if (usernameInput && data.username) usernameInput.value = data.username;
      localStorage.setItem("local_username", data.username || "Friend");
      updateProgressionUI();
      if (data.character && characterStyle[data.character]) {
        selectedCharacter = data.character;
        previewCharacter = selectedCharacter;
        syncCharacterSelectPreview(selectedCharacter);
        syncLobbySpotlightVideo(selectedCharacter);
        syncSquadLobbyInterface();
      }
    }
  } catch(e) { console.warn("Profile load for social:", e); }

  await joinOnlinePresence();
  await refreshSocialData();

  // Realtime listener for incoming friend requests
  socialInboxChannel = supabaseClient.channel(`fr_inbox_${currentSocialUserId}`);
  socialInboxChannel
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "friendships", filter: `addressee_id=eq.${currentSocialUserId}` },
      async () => { await fetchPendingRequests(); renderPendingTab(); })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "friendships" },
      async () => { await refreshSocialData(); })
    .subscribe();
}

// Patch handleAuthenticatedUser to also init social
const _origHandleAuth = handleAuthenticatedUser;
handleAuthenticatedUser = async function(user) {
  await _origHandleAuth(user);
  if (supabaseClient && user) {
    setTimeout(() => initSocialSystem(user), 500);
  }
};

// Clean up presence on logout
document.getElementById("btnLogoutAccount")?.addEventListener("click", async () => {
  if (presenceChannel && supabaseClient) {
    try { await presenceChannel.untrack(); await supabaseClient.removeChannel(presenceChannel); } catch(e) {}
    presenceChannel = null;
  }
  if (socialInboxChannel && supabaseClient) {
    try { await supabaseClient.removeChannel(socialInboxChannel); } catch(e) {}
    socialInboxChannel = null;
  }
  socialSystemInitialized = false;
  currentSocialUserId = null;
  currentSocialUsername = null;
  onlinePresenceMap = {};
  myFriendIds = new Set();
  myFriendshipMap = {};
  pendingRequests = [];
}, { capture: false });

// ----------------------------------------------------------------
// START MODE SELECTION & LOCAL PLAY SETUP DIALOGS
// ----------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const startModeSelectionDialog = document.getElementById("startModeSelectionDialog");
  const localPlaySetupDialog = document.getElementById("localPlaySetupDialog");
  const alphaWelcomeDialog = document.getElementById("alphaWelcomeDialog");
  const closeAlphaWelcomeBtn = document.getElementById("closeAlphaWelcomeBtn");

  closeAlphaWelcomeBtn?.addEventListener("click", () => {
    alphaWelcomeDialog?.classList.remove("active");
    alphaWelcomeDialog?.classList.add("hidden");
  });
  const btnSelectOnline = document.getElementById("btnSelectOnline");
  const btnSelectLocal = document.getElementById("btnSelectLocal");
  const closeStartModeBtn = document.getElementById("closeStartModeBtn");
  const closeLocalSetupBtn = document.getElementById("closeLocalSetupBtn");
  const btnLocalSinglePlayer = document.getElementById("btnLocalSinglePlayer");
  const btnLocalFourPlayers = document.getElementById("btnLocalFourPlayers");
  const btnLocalMultiplayer = document.getElementById("btnLocalMultiplayer");
  const localFourPlayerLobbyDialog = document.getElementById("localFourPlayerLobbyDialog");
  const closeFourPlayerLobbyBtn = document.getElementById("closeFourPlayerLobbyBtn");
  const startFourPlayerMatchBtn = document.getElementById("startFourPlayerMatchBtn");
  const localNicknameInput = document.getElementById("localNicknameInput");

  // Close Mode Selection Dialog
  closeStartModeBtn?.addEventListener("click", () => {
    startModeSelectionDialog?.classList.add("hidden");
  });

  // Online Play Selected
  btnSelectOnline?.addEventListener("click", () => {
    if (!navigator.onLine) {
      alert("You are currently offline. Please connect to the internet to play online mode.");
      return;
    }
    startModeSelectionDialog?.classList.add("hidden");
    checkAuthSession();
  });

  // LAN Mode Selected directly from startup dialog
  const btnSelectLan = document.getElementById("btnSelectLan");
  btnSelectLan?.addEventListener("click", () => {
    startModeSelectionDialog?.classList.add("hidden");
    
    // Prompt for nickname
    const savedName = localStorage.getItem("local_username") || "Friend";
    const nickname = prompt("Enter your nickname for LAN mode:", savedName);
    if (nickname === null) {
      // Cancelled, go back
      startModeSelectionDialog?.classList.remove("hidden");
      return;
    }
    const cleanName = nickname.trim() || "Friend";
    localStorage.setItem("local_username", cleanName);
    if (usernameInput) usernameInput.value = cleanName;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = cleanName;
    
    serverMode = "local";
    updateProgressionUI();
    switchScreen(menuScreen);
    connectWebSocket(true);
    tryPlayMusic();
  });

  // Local Play Selected
  btnSelectLocal?.addEventListener("click", () => {
    startModeSelectionDialog?.classList.add("hidden");
    resetLobbyMapSelectToNormal();
    if (localPlaySetupDialog) {
      if (localNicknameInput) {
        localNicknameInput.value = localStorage.getItem("local_username") || "Friend";
      }
      localPlaySetupDialog.classList.remove("hidden");
    }
  });

  // Close Local Play Setup Dialog (go back to Mode Selection)
  closeLocalSetupBtn?.addEventListener("click", () => {
    localPlaySetupDialog?.classList.add("hidden");
    startModeSelectionDialog?.classList.remove("hidden");
  });

  // Local Single Player (Offline Solo against bots, with local map voting)
  btnLocalSinglePlayer?.addEventListener("click", () => {
    const nickname = (localNicknameInput?.value.trim()) || "Friend";
    localStorage.setItem("local_username", nickname);
    if (usernameInput) usernameInput.value = nickname;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = nickname;

    serverMode = "local";
    localPlaySetupDialog?.classList.add("hidden");
    startLocalSingleWithMapVote();
  });

  // Local 4 Players (same screen couch battle with empty slots filled by bots)
  btnLocalFourPlayers?.addEventListener("click", () => {
    const nickname = (localNicknameInput?.value.trim()) || "Friend";
    localStorage.setItem("local_username", nickname);
    if (usernameInput) usernameInput.value = nickname;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = nickname;

    serverMode = "local";
    localPlaySetupDialog?.classList.add("hidden");
    openLocalFourPlayerLobby();
    tryPlayMusic();
  });

  closeFourPlayerLobbyBtn?.addEventListener("click", () => {
    localFourPlayerLobbyDialog?.classList.add("hidden");
    localPlaySetupDialog?.classList.remove("hidden");
  });

  startFourPlayerMatchBtn?.addEventListener("click", () => {
    startLocalFourWithMapVote();
  });

  // Local Multiplayer (LAN mode, connects to server and goes to menu lobby)
  btnLocalMultiplayer?.addEventListener("click", () => {
    const nickname = (localNicknameInput?.value.trim()) || "Friend";
    localStorage.setItem("local_username", nickname);
    if (usernameInput) usernameInput.value = nickname;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = nickname;

    serverMode = "local";
    updateProgressionUI();
    localPlaySetupDialog?.classList.add("hidden");
    switchScreen(menuScreen);
    connectWebSocket(true);
    tryPlayMusic();
  });

  // New Main Play Tab Gamemode Selector click handlers
  const localBotsDifficultyDialog = document.getElementById("localBotsDifficultyDialog");
  const btnLocalModeNormal = document.getElementById("btnLocalModeNormal");
  const btnLocalModeBR = document.getElementById("btnLocalModeBR");

  if (btnLocalModeNormal && btnLocalModeBR) {
    btnLocalModeNormal.addEventListener("click", () => {
      localOfflineModeChoice = "normal";
      btnLocalModeNormal.classList.add("btn-primary");
      btnLocalModeNormal.classList.remove("btn-secondary");
      btnLocalModeBR.classList.add("btn-secondary");
      btnLocalModeBR.classList.remove("btn-primary");
    });
    btnLocalModeBR.addEventListener("click", () => {
      localOfflineModeChoice = "br";
      btnLocalModeBR.classList.add("btn-primary");
      btnLocalModeBR.classList.remove("btn-secondary");
      btnLocalModeNormal.classList.add("btn-secondary");
      btnLocalModeNormal.classList.remove("btn-primary");
    });
  }

  const isApp = window.location.protocol === "file:" || /Android/i.test(navigator.userAgent);
  if (isApp) {
    const modeSelector = document.querySelector(".mode-options-grid");
    if (modeSelector) modeSelector.style.display = "none";
    const divider = modeSelector?.nextElementSibling;
    if (divider && divider.tagName === "DIV") divider.style.display = "none";
  }

  document.getElementById("btnPlayOfflineSingle")?.addEventListener("click", () => {
    const nickname = (usernameInput?.value.trim()) || localStorage.getItem("local_username") || "Friend";
    localStorage.setItem("local_username", nickname);
    if (usernameInput) usernameInput.value = nickname;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = nickname;

    serverMode = "local";
    localOfflineModeChoice = "normal";
    if (btnLocalModeNormal && btnLocalModeBR) {
      btnLocalModeNormal.classList.add("btn-primary");
      btnLocalModeNormal.classList.remove("btn-secondary");
      btnLocalModeBR.classList.add("btn-secondary");
      btnLocalModeBR.classList.remove("btn-primary");
    }

    if (localBotsDifficultyDialog) {
      localBotsDifficultyDialog.classList.remove("hidden");
      localBotsDifficultyDialog.classList.add("active");
    } else {
      startLocalSingleWithMapVote();
    }
  });

  document.getElementById("closeBotsDifficultyBtn")?.addEventListener("click", () => {
    localBotsDifficultyDialog?.classList.remove("active");
    localBotsDifficultyDialog?.classList.add("hidden");
  });

  const selectBotsDifficulty = (diff) => {
    localBotsDifficulty = diff;
    localBotsDifficultyDialog?.classList.remove("active");
    localBotsDifficultyDialog?.classList.add("hidden");
    if (localOfflineModeChoice === "br") {
      showBRMatchmakingScreen("br_solo");
    } else {
      startLocalSingleWithMapVote();
    }
  };

  document.getElementById("btnDiffEasy")?.addEventListener("click", () => selectBotsDifficulty("easy"));
  document.getElementById("btnDiffHard")?.addEventListener("click", () => selectBotsDifficulty("hard"));
  document.getElementById("btnDiffPro")?.addEventListener("click", () => selectBotsDifficulty("pro"));
  document.getElementById("btnDiffExpert")?.addEventListener("click", () => selectBotsDifficulty("expert"));

  document.getElementById("btnPlayOfflineFour")?.addEventListener("click", () => {
    const nickname = (usernameInput?.value.trim()) || localStorage.getItem("local_username") || "Friend";
    localStorage.setItem("local_username", nickname);
    if (usernameInput) usernameInput.value = nickname;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = nickname;

    serverMode = "local";
    openLocalFourPlayerLobby();
    tryPlayMusic();
  });

  document.getElementById("btnPlayOfflineBots")?.addEventListener("click", () => {
    const nickname = (usernameInput?.value.trim()) || localStorage.getItem("local_username") || "Friend";
    localStorage.setItem("local_username", nickname);
    if (usernameInput) usernameInput.value = nickname;
    if (squadLobbyUserNameEl) squadLobbyUserNameEl.textContent = nickname;

    serverMode = "local";
    updateProgressionUI();
    connectWebSocket(true);
    document.querySelector('.tab-btn[data-tab="squad"]')?.click();
    tryPlayMusic();
  });

  const triggerOnlineSessionLobby = () => {
    serverMode = "online";
    if (supabaseClient) {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user) {
          connectWebSocket(true);
          document.querySelector('.tab-btn[data-tab="squad"]')?.click();
        } else {
          switchScreen(loginScreen);
        }
      }).catch(() => {
        switchScreen(loginScreen);
      });
    } else {
      connectWebSocket(true);
      document.querySelector('.tab-btn[data-tab="squad"]')?.click();
    }
  };

  document.getElementById("btnPlayOnlineMultiplayer")?.addEventListener("click", () => {
    triggerOnlineSessionLobby();
  });

  document.getElementById("btnPlayOnlineBR")?.addEventListener("click", () => {
    triggerOnlineSessionLobby();
  });

  // Render mini map previews onto the voting canvasses
  document.querySelectorAll(".map-vote-preview-canvas").forEach(canvas => {
    const mapType = canvas.getAttribute("data-map");
    drawMiniMapPreview(canvas, mapType);
  });
  
  initBRClient();
});

// =================================================================
// BATTLE ROYALE HELPER FUNCTIONS
// =================================================================

function showBRProgressBar(labelText, duration, initialTimePassed = 0) {
  const container = document.getElementById("brProgressBarContainer");
  const fill = document.getElementById("brProgressBarFill");
  const label = document.getElementById("brProgressBarLabel");
  if (!container || !fill || !label) return;
  
  label.textContent = labelText;
  fill.style.width = ((initialTimePassed / duration) * 100) + "%";
  container.classList.remove("hidden");
}

function updateBRProgressBar(ratio) {
  const fill = document.getElementById("brProgressBarFill");
  if (fill) {
    fill.style.width = (Math.max(0, Math.min(1, ratio)) * 100) + "%";
  }
}

function hideBRProgressBar() {
  const container = document.getElementById("brProgressBarContainer");
  if (container) container.classList.add("hidden");
}

function addBRPing(ping) {
  ping.timer = 5.0;
  brPings.push(ping);
  
  const player = players.find(p => p.id === ping.playerId);
  const name = player ? player.name : "Teammate";
  showToastMsg(`📍 <strong>${escapeHTML(name)}</strong> pinged location (${ping.x}, ${ping.y})!`);
}

function useHealingItemLocal(itemType) {
  const localPlayer = players.find(p => p.id === localPlayerId);
  if (!localPlayer || !localPlayer.alive || localPlayer.knocked) return;
  
  if (itemType === "bandage" && (localPlayer.bandageCount || 0) <= 0) {
    showToastMsg("No bandages left! 🩹");
    return;
  }
  if (itemType === "medkit" && (localPlayer.medkitCount || 0) <= 0) {
    showToastMsg("No Med Kits left! 📦");
    return;
  }
  if (itemType === "energy_drink" && (localPlayer.energyDrinkCount || 0) <= 0) {
    showToastMsg("No Energy Drinks left! 🥤");
    return;
  }
  
  if (localMode) {
    startLocalHealing(localPlayer, itemType);
  } else {
    sendServerMessage("use_item", { itemType });
  }
}

function toggleBRFullscreenMap() {
  const modal = document.getElementById("brFullscreenMapModal");
  if (!modal) return;
  if (modal.classList.contains("hidden")) {
    modal.classList.remove("hidden");
    modal.classList.add("active");
    drawBRFullscreenMap();
  } else {
    modal.classList.remove("active");
    modal.classList.add("hidden");
  }
}

function handleBRMapClick(event) {
  const canvas = document.getElementById("brFullscreenMapCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;
  
  const cols = map[0] ? map[0].length : COLS;
  const rows = map ? map.length : ROWS;
  const tileX = Math.floor(clickX / (canvas.width / cols));
  const tileY = Math.floor(clickY / (canvas.height / rows));
  
  const pingType = event.shiftKey ? "danger" : "generic";
  
  sendServerMessage("ping_location", {
    x: tileX,
    y: tileY,
    pingType: pingType
  });
}

function spectateNextPlayer() {
  const alivePlayers = players.filter(p => p.alive);
  if (alivePlayers.length === 0) return;
  let currentIndex = alivePlayers.findIndex(p => p.id === spectatedPlayerId);
  if (currentIndex === -1) {
    currentIndex = 0;
  } else {
    currentIndex = (currentIndex + 1) % alivePlayers.length;
  }
  spectatedPlayerId = alivePlayers[currentIndex].id;
  updateSpectatorUI();
}

function spectatePrevPlayer() {
  const alivePlayers = players.filter(p => p.alive);
  if (alivePlayers.length === 0) return;
  let currentIndex = alivePlayers.findIndex(p => p.id === spectatedPlayerId);
  if (currentIndex === -1) {
    currentIndex = 0;
  } else {
    currentIndex = (currentIndex - 1 + alivePlayers.length) % alivePlayers.length;
  }
  spectatedPlayerId = alivePlayers[currentIndex].id;
  updateSpectatorUI();
}

function updateSpectatorUI() {
  const label = document.getElementById("spectatedPlayerLabel");
  if (!label) return;
  const activeSpec = players.find(p => p.id === spectatedPlayerId);
  label.textContent = activeSpec ? `Spectating: ${activeSpec.name}` : "Spectating: None";
}

function showBRGameOverScreen(data) {
  const overlay = document.getElementById("brGameOverOverlay");
  const msgEl = document.getElementById("brGameOverMessage");
  const placementEl = document.getElementById("brYourPlacement");
  const killsEl = document.getElementById("brYourKills");
  const damageEl = document.getElementById("brYourDamage");
  const listEl = document.getElementById("brStandingsList");
  
  if (!overlay || !msgEl || !placementEl || !killsEl || !damageEl || !listEl) return;
  
  msgEl.textContent = data.message;
  
  const localPlayer = data.players.find(p => p.id === localPlayerId);
  if (localPlayer) {
    placementEl.textContent = localPlayer.placement ? `#${localPlayer.placement}` : "#??";
    killsEl.textContent = localPlayer.kills || 0;
    damageEl.textContent = localPlayer.damageDealt || 0;
  }
  
  // Populate standings list
  listEl.innerHTML = "";
  // Sort players by placement
  const sorted = [...data.players].sort((a, b) => (a.placement || 99) - (b.placement || 99));
  sorted.forEach(p => {
    const item = document.createElement("div");
    item.className = "br-standing-item" + (p.placement === 1 ? " winner" : "");
    item.innerHTML = `
      <span class="br-standing-rank">#${p.placement || "??"}</span>
      <span class="br-standing-name">${escapeHTML(p.name)}</span>
      <span class="br-standing-kills">💀 ${p.kills || 0}</span>
    `;
    listEl.appendChild(item);
  });
  
  overlay.classList.remove("hidden");
  overlay.classList.add("active");
  startConfetti();
}

let brMinimapCacheCanvas = null;
let brMinimapCacheDirty = true;

function drawBRMinimap() {
  const container = document.getElementById("brMinimapContainer");
  if (!container) return;
  
  if (!running || !isBattleRoyale(currentRoomMode)) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  
  const canvas = document.getElementById("brMinimapCanvas");
  if (!canvas) return;
  const mctx = canvas.getContext("2d");
  if (!mctx) return;
  
  const cols = map[0] ? map[0].length : COLS;
  const rows = map ? map.length : ROWS;
  
  if (!brMinimapCacheCanvas || brMinimapCacheCanvas.width !== canvas.width || brMinimapCacheCanvas.height !== canvas.height) {
    brMinimapCacheCanvas = document.createElement("canvas");
    brMinimapCacheCanvas.width = canvas.width;
    brMinimapCacheCanvas.height = canvas.height;
    brMinimapCacheDirty = true;
  }
  
  if (brMinimapCacheDirty) {
    const cctx = brMinimapCacheCanvas.getContext("2d");
    if (cctx) {
      cctx.fillStyle = "#1e222a";
      cctx.fillRect(0, 0, brMinimapCacheCanvas.width, brMinimapCacheCanvas.height);
      
      const tileW = brMinimapCacheCanvas.width / cols;
      const tileH = brMinimapCacheCanvas.height / rows;
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const type = map[y]?.[x];
          if (type === "wall") {
            cctx.fillStyle = "#8a8a9a";
            cctx.fillRect(x * tileW, y * tileH, tileW, tileH);
          } else if (type === "crate" || type === "supply_crate" || type === "golden_crate") {
            cctx.fillStyle = "#865827";
            cctx.fillRect(x * tileW, y * tileH, tileW, tileH);
          }
        }
      }
    }
    brMinimapCacheDirty = false;
  }
  
  mctx.clearRect(0, 0, canvas.width, canvas.height);
  mctx.drawImage(brMinimapCacheCanvas, 0, 0);
  
  const tileW = canvas.width / cols;
  const tileH = canvas.height / rows;
  
  if (currentBRZone) {
    mctx.strokeStyle = "rgba(180, 0, 220, 0.85)";
    mctx.lineWidth = 2;
    mctx.beginPath();
    const zx = (currentBRZone.x / (cols * TILE)) * canvas.width;
    const zy = (currentBRZone.y / (rows * TILE)) * canvas.height;
    const zr = (currentBRZone.radius / (cols * TILE)) * canvas.width;
    mctx.arc(zx, zy, zr, 0, Math.PI * 2);
    mctx.stroke();
    
    if (currentBRZone.isShrinking || currentBRZone.timeLeft < 30) {
      mctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      mctx.lineWidth = 1;
      mctx.setLineDash([2, 2]);
      mctx.beginPath();
      const nzx = (currentBRZone.nextX / (cols * TILE)) * canvas.width;
      const nzy = (currentBRZone.nextY / (rows * TILE)) * canvas.height;
      const nzr = (currentBRZone.nextRadius / (cols * TILE)) * canvas.width;
      mctx.arc(nzx, nzy, nzr, 0, Math.PI * 2);
      mctx.stroke();
      mctx.setLineDash([]);
    }
  }
  
  const localPlayer = players.find(p => p.id === localPlayerId);
  players.forEach(p => {
    if (!p.alive) return;
    const px = (p.x / (cols * TILE)) * canvas.width;
    const py = (p.y / (rows * TILE)) * canvas.height;
    
    if (p.id === localPlayerId) {
      mctx.fillStyle = "#ffd84a";
      mctx.beginPath();
      mctx.arc(px, py, 3, 0, Math.PI * 2);
      mctx.fill();
    } else if (localPlayer && p.teamId && p.teamId === localPlayer.teamId) {
      mctx.fillStyle = "#3498db";
      mctx.beginPath();
      mctx.arc(px, py, 2.5, 0, Math.PI * 2);
      mctx.fill();
    } else {
      mctx.fillStyle = "#e74c3c";
      mctx.beginPath();
      mctx.arc(px, py, 2, 0, Math.PI * 2);
      mctx.fill();
    }
  });

  if (brPings) {
    brPings.forEach(ping => {
      const px = (ping.x / cols) * canvas.width;
      const py = (ping.y / rows) * canvas.height;
      mctx.fillStyle = ping.pingType === "danger" ? "#e74c3c" : "#2ecc71";
      mctx.beginPath();
      mctx.arc(px, py, 4, 0, Math.PI * 2);
      mctx.fill();
    });
  }
}

function drawBRFullscreenMap() {
  const canvas = document.getElementById("brFullscreenMapCanvas");
  if (!canvas) return;
  const fctx = canvas.getContext("2d");
  if (!fctx) return;
  
  fctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const cols = map[0] ? map[0].length : COLS;
  const rows = map ? map.length : ROWS;
  const tileW = canvas.width / cols;
  const tileH = canvas.height / rows;
  
  fctx.fillStyle = "#161820";
  fctx.fillRect(0, 0, canvas.width, canvas.height);
  
  fctx.strokeStyle = "rgba(255,255,255,0.05)";
  fctx.lineWidth = 1;
  for (let i = 0; i <= cols; i++) {
    fctx.beginPath();
    fctx.moveTo(i * tileW, 0);
    fctx.lineTo(i * tileW, canvas.height);
    fctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    fctx.beginPath();
    fctx.moveTo(0, j * tileH);
    fctx.lineTo(canvas.width, j * tileH);
    fctx.stroke();
  }
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const type = map[y]?.[x];
      if (type === "wall") {
        fctx.fillStyle = "#4a4a58";
        fctx.fillRect(x * tileW, y * tileH, tileW - 0.5, tileH - 0.5);
      } else if (type === "crate") {
        fctx.fillStyle = "#663e14";
        fctx.fillRect(x * tileW, y * tileH, tileW - 0.5, tileH - 0.5);
      } else if (type === "supply_crate") {
        fctx.fillStyle = "#1e2c3c";
        fctx.fillRect(x * tileW, y * tileH, tileW - 0.5, tileH - 0.5);
      } else if (type === "golden_crate") {
        fctx.fillStyle = "#9a7c10";
        fctx.fillRect(x * tileW, y * tileH, tileW - 0.5, tileH - 0.5);
      }
    }
  }
  
  if (currentBRZone) {
    fctx.strokeStyle = "purple";
    fctx.lineWidth = 4;
    fctx.beginPath();
    const zx = (currentBRZone.x / (cols * TILE)) * canvas.width;
    const zy = (currentBRZone.y / (rows * TILE)) * canvas.height;
    const zr = (currentBRZone.radius / (cols * TILE)) * canvas.width;
    fctx.arc(zx, zy, zr, 0, Math.PI * 2);
    fctx.stroke();
    
    fctx.strokeStyle = "white";
    fctx.lineWidth = 2;
    fctx.setLineDash([6, 6]);
    fctx.beginPath();
    const nzx = (currentBRZone.nextX / (cols * TILE)) * canvas.width;
    const nzy = (currentBRZone.nextY / (rows * TILE)) * canvas.height;
    const nzr = (currentBRZone.nextRadius / (cols * TILE)) * canvas.width;
    fctx.arc(nzx, nzy, nzr, 0, Math.PI * 2);
    fctx.stroke();
    fctx.setLineDash([]);
  }
  
  const localPlayer = players.find(p => p.id === localPlayerId);
  players.forEach(p => {
    if (!p.alive) return;
    const px = (p.x / (cols * TILE)) * canvas.width;
    const py = (p.y / (rows * TILE)) * canvas.height;
    
    if (p.id === localPlayerId) {
      fctx.fillStyle = "#ffd84a";
      fctx.beginPath();
      fctx.arc(px, py, 6, 0, Math.PI * 2);
      fctx.fill();
      fctx.strokeStyle = "#fff";
      fctx.stroke();
    } else if (localPlayer && p.teamId && p.teamId === localPlayer.teamId) {
      fctx.fillStyle = "#3498db";
      fctx.beginPath();
      fctx.arc(px, py, 5, 0, Math.PI * 2);
      fctx.fill();
    } else {
      fctx.fillStyle = "#e74c3c";
      fctx.beginPath();
      fctx.arc(px, py, 4, 0, Math.PI * 2);
      fctx.fill();
    }
  });

  if (brPings) {
    brPings.forEach(ping => {
      const px = (ping.x / cols) * canvas.width;
      const py = (ping.y / rows) * canvas.height;
      const scale = 1 + Math.sin(performance.now() / 150) * 0.15;
      
      fctx.save();
      fctx.translate(px, py);
      fctx.scale(scale, scale);
      
      fctx.fillStyle = ping.pingType === "danger" ? "#e74c3c" : "#2ecc71";
      fctx.strokeStyle = "#fff";
      fctx.lineWidth = 2;
      fctx.beginPath();
      fctx.arc(0, 0, 8, 0, Math.PI * 2);
      fctx.fill();
      fctx.stroke();
      
      fctx.restore();
    });
  }
}

function initBRClient() {
  const minimap = document.getElementById("brMinimapContainer");
  if (minimap) {
    minimap.addEventListener("click", toggleBRFullscreenMap);
  }
  
  const closeMap = document.getElementById("closeBRFullscreenMapBtn");
  if (closeMap) {
    closeMap.addEventListener("click", toggleBRFullscreenMap);
  }
  
  const mapCanvas = document.getElementById("brFullscreenMapCanvas");
  if (mapCanvas) {
    mapCanvas.addEventListener("click", handleBRMapClick);
  }
  
  document.getElementById("btnUseBandage")?.addEventListener("click", () => useHealingItemLocal("bandage"));
  document.getElementById("btnUseMedkit")?.addEventListener("click", () => useHealingItemLocal("medkit"));
  document.getElementById("btnUseEnergyDrink")?.addEventListener("click", () => useHealingItemLocal("energy_drink"));
  
  document.getElementById("btnSpectatePrev")?.addEventListener("click", spectatePrevPlayer);
  document.getElementById("btnSpectateNext")?.addEventListener("click", spectateNextPlayer);
  document.getElementById("btnLeaveSpectate")?.addEventListener("click", () => {
    sendServerMessage("leave_room");
    switchScreen(menuScreen);
    document.getElementById("brSpectatorHud")?.classList.add("hidden");
  });
  
  document.getElementById("brReturnLobbyBtn")?.addEventListener("click", () => {
    document.getElementById("brGameOverOverlay")?.classList.add("hidden");
    document.getElementById("brGameOverOverlay")?.classList.remove("active");
    stopConfetti();
    if (localMode) {
      roomCode = null;
      localPlayerId = null;
      hostId = null;
      localMode = false;
      resetCouchControls();
      resetLobbyMapSelectToNormal();
      switchScreen(menuScreen);
    } else {
      switchScreen(menuScreen);
      document.querySelector('.tab-btn[data-tab="squad"]')?.click();
    }
  });
}

// =================================================================
// BATTLE ROYALE LOCAL MATCH HELPERS & MATCHMAKING SCREEN
// =================================================================

function localCheckBRGameEnd() {
  const alivePlayers = players.filter((p) => p.alive);
  
  players.forEach(p => {
    if (!p.alive && p.placement === null) {
      p.placement = alivePlayers.length + 1;
    }
  });

  if (alivePlayers.length > 1) {
    const localPlayer = players.find(p => p.id === localPlayerId);
    if (localPlayer && !localPlayer.alive) {
      running = false;
      showBRResultsLocal();
    }
    return;
  }
  
  running = false;
  const winner = alivePlayers[0] || null;
  if (winner) {
    winner.placement = 1;
  }
  
  showBRResultsLocal();
}

function updateLocalBRZone(dt) {
  if (!currentBRZone) return;
  currentBRZone.timeLeft -= dt;
  
  if (currentBRZone.timeLeft <= 0) {
    if (!currentBRZone.isShrinking) {
      currentBRZone.isShrinking = true;
      currentBRZone.timeLeft = 60;
      currentBRZone.startX = currentBRZone.x;
      currentBRZone.startY = currentBRZone.y;
      currentBRZone.startRadius = currentBRZone.radius;
      
      const phase = currentBRZone.phase + 1;
      const cols = 61;
      let nextRad = currentBRZone.radius;
      if (phase === 1) nextRad = Math.floor(cols * TILE * 0.35);
      else if (phase === 2) nextRad = Math.floor(cols * TILE * 0.18);
      else if (phase === 3) nextRad = Math.floor(cols * TILE * 0.10);
      else if (phase === 4) nextRad = Math.floor(cols * TILE * 0.05);
      else nextRad = 40;
      
      const maxOffset = currentBRZone.radius - nextRad;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * maxOffset;
      currentBRZone.nextX = currentBRZone.x + Math.cos(angle) * dist;
      currentBRZone.nextY = currentBRZone.y + Math.sin(angle) * dist;
      currentBRZone.nextRadius = nextRad;
      
      showToastMsg("ZONE SHRINKING! Run to safe circle.");
    } else {
      currentBRZone.isShrinking = false;
      currentBRZone.phase += 1;
      currentBRZone.x = currentBRZone.nextX;
      currentBRZone.y = currentBRZone.nextY;
      currentBRZone.radius = currentBRZone.nextRadius;
      currentBRZone.timeLeft = 60;
      
      showToastMsg(`Phase ${currentBRZone.phase} completed.`);
    }
  } else if (currentBRZone.isShrinking) {
    const t = 1 - (currentBRZone.timeLeft / 60);
    currentBRZone.x = currentBRZone.startX + (currentBRZone.nextX - currentBRZone.startX) * t;
    currentBRZone.y = currentBRZone.startY + (currentBRZone.nextY - currentBRZone.startY) * t;
    currentBRZone.radius = currentBRZone.startRadius + (currentBRZone.nextRadius - currentBRZone.startRadius) * t;
  }
}

let localBRZoneDamageTimer = 0;
function updateLocalBRZoneDamage(dt) {
  localBRZoneDamageTimer += dt;
  if (localBRZoneDamageTimer >= 1.0) {
    localBRZoneDamageTimer = 0;
    players.forEach((p) => {
      if (p.alive && currentBRZone) {
        const dist = Math.hypot(p.x - currentBRZone.x, p.y - currentBRZone.y);
        if (dist > currentBRZone.radius) {
          const phase = currentBRZone.phase;
          const damage = phase === 1 ? 2 : phase === 2 ? 5 : phase === 3 ? 8 : phase === 4 ? 12 : 20;
          damageLocalPlayerFromStorm(p, damage);
        }
      }
    });
  }
}

function damageLocalPlayerFromStorm(player, amount) {
  if (!player.alive) return;
  
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
  
  if (player.hp <= 0) {
    player.alive = false;
    const aliveCount = players.filter(p => p.alive).length;
    player.placement = aliveCount + 1;
    
    showToastMsg(`${player.name} died in the storm.`);
    
    if (player.id === localPlayerId) {
      running = false;
      awardLocalMatchProgress(false);
      showBRResultsLocal();
    }
  }
}

function damageLocalPlayerFromBomb(player, amount) {
  if (!player.alive || player.invuln > 0) return;
  
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
  
  player.invuln = 0.5;
  
  if (player.hp <= 0) {
    player.alive = false;
    player.moveTarget = null;
    player.moveFrom = null;
    player.moveDir = null;
    
    const aliveCount = players.filter(p => p.alive).length;
    player.placement = aliveCount + 1;
    
    showToastMsg(`${player.name} was blown up.`);
    
    if (player.id === localPlayerId) {
      running = false;
      awardLocalMatchProgress(false);
      showBRResultsLocal();
    }
  } else {
    showToastMsg(`${player.name} took bomb damage! HP: ${player.hp}`);
  }
}

function startLocalHealing(player, itemType) {
  if (localHealingState) return;
  
  let duration = 2.0;
  
  showBRProgressBar();
  updateBRProgressBar(1.0);
  
  localHealingState = {
    playerId: player.id,
    itemType: itemType,
    duration: duration,
    timeLeft: duration
  };
}

function buildLocalBRMap(startPositions) {
  const cols = 61;
  const rows = 61;
  const nextMap = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) return "wall";
      if (x % 2 === 0 && y % 2 === 0) return "wall";
      return Math.random() < 0.75 ? "crate" : "grass";
    })
  );

  startPositions.forEach((s) => {
    const clearSafe = (cx, cy) => {
      if (nextMap[cy] && nextMap[cy][cx] && nextMap[cy][cx] !== "wall") {
        nextMap[cy][cx] = "grass";
      }
    };
    clearSafe(s.x, s.y);
    clearSafe(s.x + 1, s.y);
    clearSafe(s.x - 1, s.y);
    clearSafe(s.x, s.y + 1);
    clearSafe(s.x, s.y - 1);
  });

  return nextMap;
}

function getBRStartPositions(cols, rows, count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 150) {
      const px = 1 + 2 * Math.floor(Math.random() * ((cols - 2) / 2));
      const py = 1 + 2 * Math.floor(Math.random() * ((rows - 2) / 2));
      if (!positions.some(pos => pos.x === px && pos.y === py)) {
        positions.push({ x: px, y: py });
        placed = true;
      }
      attempts++;
    }
    if (!placed) {
      positions.push({ x: 1, y: 1 });
    }
  }
  return positions;
}

function startLocalBRGame() {
  localMode = true;
  localCouchMode = false;
  couchTouchKeys.clear();
  couchPlayerTouchKeys.clear();
  couchTouchPlayerId = null;
  roomCode = "LOCAL_BR";
  localPlayerId = "local_player";
  hostId = localPlayerId;
  localBombId = 0;
  cameraX = 0;
  cameraY = 0;
  currentRoomMode = "br_solo";
  
  currentMapType = "classic";
  
  const cols = 61;
  const rows = 61;
  const startPositions = getBRStartPositions(cols, rows, 20);
  map = buildLocalBRMap(startPositions);
  
  const pool = ["chiikawa", "hachiware", "usagi", "momonga"];
  players = [
    makeLocalPlayer("local_player", (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "You", selectedCharacter, startPositions[0], false)
  ];
  
  players[0].hp = 100;
  players[0].shield = 0;
  players[0].bandageCount = 3;
  players[0].medkitCount = 1;
  players[0].energyDrinkCount = 1;
  
  for (let i = 1; i < 20; i++) {
    const char = pool[i % pool.length];
    const name = characterStyle[char].label + " CPU " + i;
    const bot = makeLocalPlayer("cpu_" + i, name, char, startPositions[i], true);
    bot.hp = 100;
    bot.shield = 0;
    bot.bandageCount = Math.floor(Math.random() * 3);
    bot.medkitCount = Math.floor(Math.random() * 2);
    bot.energyDrinkCount = Math.floor(Math.random() * 2);
    players.push(bot);
  }
  
  players.forEach((p) => {
    p.trophies = 0;
    p.hasPunch = false;
    p.alive = true;
    p.placement = null;
    p.kills = 0;
    p.damageDealt = 0;
  });
  
  bombs = [];
  blasts = [];
  pickups = [];
  particles = [];
  roundTime = 600;
  running = true;
  startCountdownTimer = 3.5;
  startCountdownState = "3";
  shakeTimer = 0;
  localMatchRewarded = false;
  gameMessage = "";
  
  const zoneStartRad = Math.floor(cols * TILE * 0.65);
  currentBRZone = {
    x: (cols * TILE) / 2,
    y: (rows * TILE) / 2,
    radius: zoneStartRad,
    nextX: (cols * TILE) / 2,
    nextY: (rows * TILE) / 2,
    nextRadius: zoneStartRad,
    timeLeft: 60,
    isShrinking: false,
    phase: 0
  };
  
  brMinimapCacheCanvas = null;
  brMinimapCacheDirty = true;
  
  updateHudSidebar();
  switchScreen(gameScreen);
}

function showBRResultsLocal() {
  const localPlayer = players.find(p => p.id === localPlayerId);
  const playerWon = localPlayer && localPlayer.alive;
  
  players.forEach(p => {
    if (p.alive) {
      p.placement = 1;
    }
  });

  awardLocalMatchProgress(playerWon);

  showBRGameOverScreen({
    message: playerWon ? "VICTORY ROYALE!" : "GAME OVER",
    players: players
  });
}

let brmCanvasEl = null;
let brmCtx = null;
let brmTempCanvas = null;
let brmIconImage = new Image();
brmIconImage.src = "assets/chiikawa-royale-characters.png";
let brmTempCtx = null;
let brmAnimationId = null;
let brmPlayerCountVal = 1;
let brmSimulateInterval = null;
let brmCountdownInterval = null;

function initBRMatchmakingUI() {
  brmVideoEl = document.getElementById("brmCharVideo");
  brmCanvasEl = document.getElementById("brmCharCanvas");
  if (brmCanvasEl) brmCtx = brmCanvasEl.getContext("2d");
  
  brmTempCanvas = document.createElement("canvas");
  brmTempCtx = brmTempCanvas.getContext("2d");

  const cancelBtn = document.getElementById("brmCancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      cancelBRMatchmaking();
    });
  }
  
  const brmStartBtn = document.getElementById("brmStartBtn");
  if (brmStartBtn) {
    brmStartBtn.addEventListener("click", () => {
      if (socket && socket.readyState === WebSocket.OPEN && localOfflineModeChoice !== "br") {
        sendServerMessage("start_game");
      } else {
        if (brmSimulateInterval) clearInterval(brmSimulateInterval);
        if (brmCountdownInterval) clearInterval(brmCountdownInterval);
        hideBRMatchmaking();
        startLocalBRGame();
      }
    });
  }
  
  const returnLobbyBtn = document.getElementById("brReturnLobbyBtn");
  if (returnLobbyBtn) {
    returnLobbyBtn.addEventListener("click", () => {
      hideBRMatchmaking();
    });
  }
}

function showBRMatchmakingScreen(chosenMode) {
  if (!brmVideoEl) initBRMatchmakingUI();
  
  brmActive = true;
  brmPlayerCountVal = 1;
  currentRoomMode = chosenMode;
  
  const logoEl = document.querySelector(".brm-logo");
  if (logoEl) {
    logoEl.textContent = "";
  }
  const badge = document.getElementById("brmModeBadge");
  if (badge) {
    badge.style.display = "block";
    badge.textContent = chosenMode.replace("br_", "").toUpperCase();
  }
  const pCountContainer = document.querySelector(".brm-player-count");
  if (pCountContainer) {
    pCountContainer.innerHTML = `<span id="brmPlayerCount">1</span>/20 PLAYERS`;
  }
  
  const brmStartBtn = document.getElementById("brmStartBtn");
  if (brmStartBtn) {
    const isHost = localPlayerId === hostId;
    if (localOfflineModeChoice === "br" || (serverMode === "local" && isHost)) {
      brmStartBtn.style.display = "block";
    } else {
      brmStartBtn.style.display = "none";
    }
  }
  
  const screen = document.getElementById("brMatchmakingScreen");
  if (screen) {
    screen.classList.remove("hidden");
    screen.classList.add("active");
  }
  
  const pCount = document.getElementById("brmPlayerCount");
  if (pCount) pCount.textContent = "1";
  
  const countdownBox = document.getElementById("brmCountdown");
  if (countdownBox) countdownBox.classList.add("hidden");
  
  if (brmCanvasEl) {
    brmCanvasEl.classList.remove("falling");
    void brmCanvasEl.offsetWidth;
    brmCanvasEl.classList.add("falling");
  }
  
  /*
  const matchmakingVideos = {
    chiikawa: "assets/matchmaking_animations/chiikawa_br_matchmaking_animation.mp4",
    hachiware: "assets/matchmaking_animations/hachiware_br_matchmaking_animation.mp4",
    usagi: "assets/matchmaking_animations/usagi_br_matchmaking_animation.mp4",
    momonga: "assets/matchmaking_animations/momonga_br_matchmaking_animation.mp4"
  };
  const videoSrc = matchmakingVideos[selectedCharacter] || "assets/matchmaking_animations/chiikawa_br_matchmaking_animation.mp4";
  brmVideoEl.src = getVideoSrc(videoSrc);
  brmVideoEl.load();
  playMutedLoop(brmVideoEl);
  */
  
  if (brmAnimationId) cancelAnimationFrame(brmAnimationId);
  renderBRMVideo();
  
  if (socket && socket.readyState === WebSocket.OPEN && localOfflineModeChoice !== "br") {
    isOnlineMatchmakingActive = true;
    if (roomCode) {
      if (localPlayerId === hostId) {
        sendServerMessage("start_matchmaking", { mode: chosenMode });
      }
    } else {
      const name = usernameInput?.value.trim() || currentSocialUsername || "Friend";
      sendServerMessage("quick_match", { name, kind: selectedCharacter, mode: chosenMode });
    }
  } else {
    startOfflineBRMatchmaking(chosenMode);
  }
}

function renderBRMVideo() {
  if (!brmActive) return;
  
  if (brmCanvasEl && brmCtx) {
    brmCtx.clearRect(0, 0, brmCanvasEl.width, brmCanvasEl.height);
    
    if (brmIconImage && brmIconImage.complete) {
      const vw = brmIconImage.width;
      const vh = brmIconImage.height;
      
      if (vw && vh) {
        // Compute slow smooth floating animation offset
        const floatOffset = Math.sin(Date.now() / 400) * 15;
        
        // Scale to fit 85% of canvas width
        const targetWidth = brmCanvasEl.width * 0.85;
        const scale = targetWidth / vw;
        const dw = vw * scale;
        const dh = vh * scale;
        
        const dx = (brmCanvasEl.width - dw) / 2;
        // Position in the upper-middle of the canvas with float offset
        const dy = (brmCanvasEl.height - dh) / 2 + 10 + floatOffset;
        
        brmCtx.drawImage(brmIconImage, dx, dy, dw, dh);
      }
    }
  }
  
  brmAnimationId = requestAnimationFrame(renderBRMVideo);
}

function startOfflineBRMatchmaking(chosenMode) {
  brmPlayerCountVal = 1;
  const pCount = document.getElementById("brmPlayerCount");
  const countdownBox = document.getElementById("brmCountdown");
  const countdownNum = document.getElementById("brmCountdownNum");
  
  if (pCount) pCount.textContent = "1";
  if (countdownBox) countdownBox.classList.add("hidden");
  
  if (brmSimulateInterval) clearInterval(brmSimulateInterval);
  if (brmCountdownInterval) clearInterval(brmCountdownInterval);
  
  brmSimulateInterval = setInterval(() => {
    if (!brmActive) {
      clearInterval(brmSimulateInterval);
      return;
    }
    
    brmPlayerCountVal += Math.floor(Math.random() * 3) + 1;
    if (brmPlayerCountVal >= 20) {
      brmPlayerCountVal = 20;
      clearInterval(brmSimulateInterval);
      
      if (countdownBox) countdownBox.classList.remove("hidden");
      let secondsLeft = 5;
      if (countdownNum) countdownNum.textContent = secondsLeft;
      
      brmCountdownInterval = setInterval(() => {
        if (!brmActive) {
          clearInterval(brmCountdownInterval);
          return;
        }
        secondsLeft--;
        if (countdownNum) countdownNum.textContent = secondsLeft;
        
        if (secondsLeft <= 0) {
          clearInterval(brmCountdownInterval);
          hideBRMatchmaking();
          startLocalBRGame();
        }
      }, 1000);
    }
    
    if (pCount) {
      pCount.textContent = brmPlayerCountVal;
    }
  }, 250 + Math.random() * 300);
}

function cancelBRMatchmaking() {
  cancelMatchmaking();
  hideBRMatchmaking();
}

function hideBRMatchmaking() {
  brmActive = false;
  if (brmAnimationId) {
    cancelAnimationFrame(brmAnimationId);
    brmAnimationId = null;
  }
  if (brmVideoEl) {
    try {
      brmVideoEl.pause();
      brmVideoEl.src = "";
    } catch(e) {}
  }
  if (brmSimulateInterval) clearInterval(brmSimulateInterval);
  if (brmCountdownInterval) clearInterval(brmCountdownInterval);
  
  const screen = document.getElementById("brMatchmakingScreen");
  if (screen) {
    screen.classList.remove("active");
    screen.classList.add("hidden");
  }
}

// ==========================================================================
// PEER VOICE CHAT SYSTEM & LOBBY MODE HANDLERS
// ==========================================================================

let recordProcessor = null;
let recordSource = null;
let dummyGainNode = null;
let audioCtxRecord = null;
let audioStream = null;
let isMicActive = false;
let playerVoiceQueues = {}; // playerId -> nextPlayTime

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }
  if (inputSampleRate < outputSampleRate) {
    return buffer;
  }
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

async function startMicCapture() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    audioCtxRecord = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioCtxRecord.sampleRate;
    recordSource = audioCtxRecord.createMediaStreamSource(audioStream);
    
    // Buffer size 8192 (~185ms at 44.1kHz, ~170ms at 48kHz)
    recordProcessor = audioCtxRecord.createScriptProcessor(8192, 1, 1);
    
    // dummyGainNode set to 0 to prevent local loopback to output speakers
    dummyGainNode = audioCtxRecord.createGain();
    dummyGainNode.gain.value = 0.0;
    
    recordProcessor.onaudioprocess = (e) => {
      // Clear output buffer to be absolutely sure there is no leak/feedback loop
      const outputBuffer = e.outputBuffer;
      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
        outputBuffer.getChannelData(channel).fill(0);
      }
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0); // Float32Array
        const targetSampleRate = 16000;
        const downsampledData = downsampleBuffer(inputData, sampleRate, targetSampleRate);
        
        // Convert Float32 to Int16 to save bandwidth
        const buffer = new ArrayBuffer(downsampledData.length * 2);
        const view = new DataView(buffer);
        let sum = 0;
        for (let i = 0; i < downsampledData.length; i++) {
          let s = Math.max(-1, Math.min(1, downsampledData[i]));
          sum += s * s;
          view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        // Convert to base64 safely
        const uint8 = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
        }
        const base64data = btoa(binary);
        sendServerMessage("voice_chat_audio", { audio: base64data, sampleRate: targetSampleRate });
        
        // Local player talking indicator based on volume threshold
        if (localPlayerId) {
          let rms = Math.sqrt(sum / downsampledData.length);
          if (rms > 0.015) { // Voice active threshold
            if (talkingTimeouts[localPlayerId]) clearTimeout(talkingTimeouts[localPlayerId]);
            talkingPlayers[localPlayerId] = true;
            updateAllMicIndicators();
            talkingTimeouts[localPlayerId] = setTimeout(() => {
              delete talkingPlayers[localPlayerId];
              updateAllMicIndicators();
            }, 1000);
          }
        }
      }
    };
    
    recordSource.connect(recordProcessor);
    recordProcessor.connect(dummyGainNode);
    dummyGainNode.connect(audioCtxRecord.destination);
    
    isMicActive = true;
    updateMicButtonUI();
    showToastMsg("Microphone ON 🎙️");
  } catch (err) {
    console.error("Failed to access microphone:", err);
    showToastMsg("Microphone Access Denied! ❌");
    isMicActive = false;
    updateMicButtonUI();
  }
}

function stopMicCapture() {
  if (recordProcessor) {
    try { recordProcessor.disconnect(); } catch (e) {}
    recordProcessor.onaudioprocess = null;
  }
  if (recordSource) {
    try { recordSource.disconnect(); } catch (e) {}
  }
  if (dummyGainNode) {
    try { dummyGainNode.disconnect(); } catch (e) {}
  }
  if (audioCtxRecord) {
    try { audioCtxRecord.close(); } catch (e) {}
  }
  if (audioStream) {
    try {
      audioStream.getTracks().forEach(track => track.stop());
    } catch (e) {}
  }
  recordProcessor = null;
  recordSource = null;
  dummyGainNode = null;
  audioCtxRecord = null;
  audioStream = null;
  isMicActive = false;
  updateMicButtonUI();
  showToastMsg("Microphone OFF 🔇");
}

function toggleLobbyMic() {
  if (serverMode !== "online" || !roomCode) {
    showToastMsg("Voice chat is only available in online matches and lobbies! ⚠️");
    return;
  }
  if (isMicActive) {
    stopMicCapture();
  } else {
    startMicCapture();
  }
}

function updateMicButtonUI() {
  const micBtn = document.getElementById("lobbyMicBtn");
  const gameMicBtn = document.getElementById("gameMicBtn");
  
  if (micBtn) {
    if (isMicActive) {
      micBtn.classList.add("active");
      micBtn.style.background = "var(--green)";
      micBtn.style.color = "#fff";
    } else {
      micBtn.classList.remove("active");
      micBtn.style.background = "";
      micBtn.style.color = "";
    }
  }
  
  if (gameMicBtn) {
    if (isMicActive) {
      gameMicBtn.classList.add("active");
      gameMicBtn.style.background = "var(--green)";
      gameMicBtn.style.color = "#fff";
      gameMicBtn.innerHTML = "🎙️ Mic: ON";
    } else {
      gameMicBtn.classList.remove("active");
      gameMicBtn.style.background = "var(--red)";
      gameMicBtn.style.color = "#fff";
      gameMicBtn.innerHTML = "🎙️ Mic: OFF";
    }
  }
}

let audioCtxVoice = null;
function playRawPCMAudio(playerId, base64Data, sampleRate = 16000, volume = 1.0) {
  try {
    if (!audioCtxVoice) {
      audioCtxVoice = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxVoice.state === "suspended") {
      audioCtxVoice.resume();
    }
    
    // Decode base64 to array buffer of Int16
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    
    // Create Float32 audio buffer at the sender's sample rate
    const audioBuffer = audioCtxVoice.createBuffer(1, int16Array.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16Array.length; i++) {
      channelData[i] = int16Array[i] / 32768.0;
    }
    
    // Sequential scheduling using jitter buffer queue
    let nextPlayTime = playerVoiceQueues[playerId] || 0;
    const now = audioCtxVoice.currentTime;
    const lookahead = 0.05; // 50ms buffer to absorb network jitter
    
    if (nextPlayTime < now || nextPlayTime - now > 0.3) {
      nextPlayTime = now + lookahead;
    }
    
    const source = audioCtxVoice.createBufferSource();
    source.buffer = audioBuffer;
    
    const gainNode = audioCtxVoice.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(audioCtxVoice.destination);
    
    source.start(nextPlayTime);
    playerVoiceQueues[playerId] = nextPlayTime + audioBuffer.duration;
  } catch (e) {
    console.error("Failed to play raw PCM audio chunk:", e);
  }
}

function initVoiceChatAndLobbyModeUI() {
  const micBtn = document.getElementById("lobbyMicBtn");
  if (micBtn && !micBtn.dataset.bound) {
    micBtn.dataset.bound = "true";
    micBtn.addEventListener("click", toggleLobbyMic);
  }
  const gameMicBtn = document.getElementById("gameMicBtn");
  if (gameMicBtn && !gameMicBtn.dataset.bound) {
    gameMicBtn.dataset.bound = "true";
    gameMicBtn.addEventListener("click", toggleLobbyMic);
  }

  const btnLobbyModeTeam = document.getElementById("btnLobbyModeTeam");
  if (btnLobbyModeTeam && !btnLobbyModeTeam.dataset.bound) {
    btnLobbyModeTeam.dataset.bound = "true";
    btnLobbyModeTeam.addEventListener("click", () => {
      if (roomCode && roomCode !== "LOCAL" && roomCode !== "4P" && roomCode !== "LOCAL_BR") {
        if (localPlayerId === hostId) {
          sendServerMessage("set_lobby_mode", { isChallenge: false });
        }
      } else {
        currentRoomIsChallenge = false;
        syncSquadLobbyInterface();
      }
    });
  }

  const btnLobbyModeChallenge = document.getElementById("btnLobbyModeChallenge");
  if (btnLobbyModeChallenge && !btnLobbyModeChallenge.dataset.bound) {
    btnLobbyModeChallenge.dataset.bound = "true";
    btnLobbyModeChallenge.addEventListener("click", () => {
      if (roomCode && roomCode !== "LOCAL" && roomCode !== "4P" && roomCode !== "LOCAL_BR") {
        if (localPlayerId === hostId) {
          sendServerMessage("set_lobby_mode", { isChallenge: true });
        }
      } else {
        currentRoomIsChallenge = true;
        syncSquadLobbyInterface();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", initVoiceChatAndLobbyModeUI);
initVoiceChatAndLobbyModeUI();

// Voice settings popups and speaker indicator controls
function showPlayerVoiceSettings(playerId, playerName) {
  const dialog = document.getElementById("playerVoiceSettingsDialog");
  const nameLabel = document.getElementById("voiceSettingsPlayerName");
  const slider = document.getElementById("voiceSettingsVolumeSlider");
  const label = document.getElementById("voiceSettingsVolumeLabel");
  const muteBtn = document.getElementById("voiceSettingsMuteBtn");
  const closeBtn = document.getElementById("closeVoiceSettingsBtn");
  
  if (!dialog || !nameLabel || !slider || !label || !muteBtn || !closeBtn) return;
  
  nameLabel.textContent = `Adjust settings for ${escapeHTML(playerName)}`;
  
  const vol = playerVolumeSettings[playerId] !== undefined ? playerVolumeSettings[playerId] : 1.0;
  slider.value = Math.round(vol * 100);
  label.textContent = `${slider.value}%`;
  
  const updateMuteBtnUI = () => {
    if (playerMutedSettings[playerId]) {
      muteBtn.textContent = "UNMUTE";
      muteBtn.className = "btn btn-primary";
      muteBtn.style.background = "var(--green)";
      muteBtn.style.color = "#fff";
      muteBtn.style.borderColor = "#22c55e";
    } else {
      muteBtn.textContent = "MUTE";
      muteBtn.className = "btn btn-danger";
      muteBtn.style.background = "";
      muteBtn.style.color = "";
      muteBtn.style.borderColor = "";
    }
  };
  
  updateMuteBtnUI();
  
  const newSlider = slider.cloneNode(true);
  slider.parentNode.replaceChild(newSlider, slider);
  newSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    label.textContent = `${val}%`;
    playerVolumeSettings[playerId] = val / 100;
  });
  
  const newMuteBtn = muteBtn.cloneNode(true);
  muteBtn.parentNode.replaceChild(newMuteBtn, muteBtn);
  newMuteBtn.addEventListener("click", () => {
    playerMutedSettings[playerId] = !playerMutedSettings[playerId];
    updateMuteBtnUI();
  });
  
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener("click", () => {
    dialog.classList.remove("active");
    dialog.classList.add("hidden");
  });
  
  dialog.classList.remove("hidden");
  dialog.classList.add("active");
}

function updateAllMicIndicators() {
  document.querySelectorAll(".lobby-card-mic-indicator").forEach(el => el.classList.add("hidden"));

  if (talkingPlayers[localPlayerId]) {
    const indicator = document.getElementById("mic_squadCard_user");
    if (indicator) indicator.classList.remove("hidden");
  }

  const localPlayer = players.find(p => p.id === localPlayerId);
  const localSquadCode = localPlayer ? localPlayer.squadCode : null;
  if (localSquadCode) {
    const otherTeammates = players.filter(p => p.id !== localPlayerId && p.squadCode === localSquadCode && !p.ai);
    if (otherTeammates[0] && talkingPlayers[otherTeammates[0].id]) {
      const indicator = document.getElementById("mic_squadInviteCard_left");
      if (indicator) indicator.classList.remove("hidden");
    }
    if (otherTeammates[1] && talkingPlayers[otherTeammates[1].id]) {
      const indicator = document.getElementById("mic_squadInviteCard_right");
      if (indicator) indicator.classList.remove("hidden");
    }
    if (otherTeammates[2] && talkingPlayers[otherTeammates[2].id]) {
      const indicator = document.getElementById("mic_squadInviteCard_fourth");
      if (indicator) indicator.classList.remove("hidden");
    }
  }
}


// =================================================================
// ZZZ 'KNOCK KNOCK' CHAT SYSTEM LOGIC
// =================================================================

let knockActiveTab = "all";
let knockActiveContactId = null;
let knockChats = {};
let knockListenersBound = false;


function getMinimalistLogoSvg(val) {
  if (val === "👥" || val === "room" || val === "squad") {
    // Room chat double person icon (plain white minimalist)
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="white" style="display: block; opacity: 0.95; margin: auto;"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`;
  }
  // Single person avatar icon (plain white minimalist)
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="white" style="display: block; opacity: 0.95; margin: auto;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
}

function initKnockChats() {
  if (Object.keys(knockChats).length > 0) return;

  // Initialize Room Chat
  knockChats["room"] = {
    id: "room",
    name: "Room Chat",
    avatar: "👥",
    type: "room",
    history: [
      { sender: "System", text: "Joined squad chat room. Messages sent here will broadcast to your squad teammates.", isSystem: true, ts: Date.now() }
    ],
    preview: "Join a room to chat",
    unread: false
  };
}

function openKnockChat() {
  initKnockChats();
  syncKnockFriends();
  bindKnockListenersOnce();

  const popup = document.getElementById("lobbyChatPopup");
  if (popup) {
    popup.classList.remove("hidden");
    
    const codeLabel = document.getElementById("lobbyChatRoomCode");
    if (codeLabel) {
      if (roomCode) {
        codeLabel.textContent = "Room " + roomCode;
        codeLabel.style.display = "inline-block";
      } else {
        codeLabel.style.display = "none";
      }
    }

    renderKnockChatList();

    if (!knockActiveContactId) {
      if (roomCode) {
        selectKnockContact("room");
      } else {
        const friendIds = Object.keys(knockChats).filter(id => id !== "room");
        if (friendIds.length > 0) {
          selectKnockContact(friendIds[0]);
        } else {
          selectKnockContact("room");
        }
      }
    } else {
      selectKnockContact(knockActiveContactId);
    }
  }
}

function syncKnockFriends() {
  if (typeof myFriendIds === "undefined" || typeof myFriendshipMap === "undefined") return;
  if (!myFriendIds || !myFriendshipMap) return;

  myFriendIds.forEach(friendId => {
    const friendInfo = myFriendshipMap[friendId];
    if (!friendInfo) return;

    if (!knockChats[friendId]) {
      let charEmoji = "🐹";
      if (friendInfo.character === "hachiware") charEmoji = "🐱";
      else if (friendInfo.character === "usagi") charEmoji = "🐰";
      else if (friendInfo.character === "momonga") charEmoji = "🐿️";

      knockChats[friendId] = {
        id: friendId,
        name: friendInfo.username,
        avatar: charEmoji,
        type: "friend",
        history: [
          { sender: "System", text: "Start of private message history with " + friendInfo.username, isSystem: true, ts: Date.now() }
        ],
        preview: "No messages yet",
        unread: false
      };
    }
  });
}

function renderKnockChatList() {
  const listContainer = document.getElementById("knockChatList");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  Object.values(knockChats).forEach(c => {
    if (knockActiveTab === "friends" && c.type === "room") return;
    if (knockActiveTab === "rooms" && c.type !== "room") return;

    const item = document.createElement("div");
    item.className = "knock-chat-item" + (knockActiveContactId === c.id ? " active" : "");
    item.setAttribute("data-chat-id", c.id);

    let avatarClass = "zzz-unknown";
    if (c.type === "friend") avatarClass = "friend-avatar";
    else if (c.type === "room") avatarClass = "room-avatar";

    const badgeHTML = c.unread ? `<span class="knock-chat-dot"></span>` : `<span class="knock-chat-dots">...</span>`;

    item.innerHTML = `
      <div class="knock-avatar ${avatarClass}">${getMinimalistLogoSvg(c.avatar)}</div>
      <div class="knock-chat-info">
        <div class="knock-chat-name">${escapeHTML(c.name)}</div>
        <div class="knock-chat-preview">${escapeHTML(c.preview)}</div>
      </div>
      ${badgeHTML}
    `;

    item.addEventListener("click", () => {
      selectKnockContact(c.id);
    });

    listContainer.appendChild(item);
  });
}

function selectKnockContact(chatId) {
  knockActiveContactId = chatId;
  if (!knockChats[chatId]) return;

  knockChats[chatId].unread = false;

  const emptyState = document.getElementById("knockEmptyState");
  const chatArea = document.getElementById("knockChatArea");
  if (emptyState) emptyState.classList.add("hidden");
  if (chatArea) chatArea.classList.remove("hidden");

  const titleEl = document.getElementById("knockActiveChatName");
  if (titleEl) titleEl.textContent = knockChats[chatId].name;

  renderKnockChatList();
  renderKnockMessages();

  const inputArea = document.getElementById("knockInputArea");
  const choicesPanel = document.getElementById("knockChoicesPanel");

  choicesPanel.classList.add("hidden");
  inputArea.classList.remove("hidden");
}

function renderKnockMessages() {
  const container = document.getElementById("knockMessagesContainer");
  if (!container) return;
  container.innerHTML = "";

  const chat = knockChats[knockActiveContactId];
  if (!chat) return;

  chat.history.forEach(m => {
    const row = document.createElement("div");
    if (m.isSystem) {
      row.className = "knock-msg-row system";
      row.innerHTML = `<span class="knock-system-bubble">&lt;span class="knock-system-bubble"&gt;${escapeHTML(m.text)}&lt;/span&gt;</span>`; // fix nested string
      row.innerHTML = `<span class="knock-system-bubble">${escapeHTML(m.text)}</span>`;
    } else {
      const isMe = m.sender === "Me" || m.sender === currentSocialUsername;
      row.className = "knock-msg-row " + (isMe ? "outgoing" : "incoming");

      let avatarContent = "🐹";
      let avatarClass = "friend-avatar";

      if (isMe) {
        let charEmoji = "🐹";
        if (selectedCharacter === "hachiware") charEmoji = "🐱";
        else if (selectedCharacter === "usagi") charEmoji = "🐰";
        else if (selectedCharacter === "momonga") charEmoji = "🐿️";
        avatarContent = charEmoji;
        avatarClass = "friend-avatar";
      } else if (chat.type === "room") {
        avatarContent = "👤";
        avatarClass = "friend-avatar";
      } else {
        avatarContent = chat.avatar;
        avatarClass = "friend-avatar";
      }

      row.innerHTML = `
        <div class="knock-msg-avatar ${avatarClass}">${getMinimalistLogoSvg(avatarContent)}</div>
        <div class="knock-bubble-wrapper">
          <div class="knock-bubble-sender">${escapeHTML(m.sender)}</div>
          <div class="knock-bubble">${escapeHTML(m.text)}</div>
        </div>
      `;
    }
    container.appendChild(row);
  });

  container.scrollTop = container.scrollHeight;
}

function addKnockRoomChatMessage(sender, text, isSystem, isMe) {
  initKnockChats();

  const chat = knockChats["room"];
  if (!chat) return;

  chat.history.push({
    sender: sender,
    text: text,
    isSystem: isSystem,
    ts: Date.now()
  });

  if (!isSystem) {
    chat.preview = sender + ": " + text;
  } else {
    chat.preview = text;
  }

  if (knockActiveContactId === "room") {
    renderKnockMessages();
  } else {
    chat.unread = true;
    renderKnockChatList();
  }
}

function receiveKnockDirectMessage(senderId, senderName, text, ts) {
  initKnockChats();
  syncKnockFriends();

  if (!knockChats[senderId]) {
    knockChats[senderId] = {
      id: senderId,
      name: senderName,
      avatar: "🐹",
      type: "friend",
      history: [
        { sender: "System", text: "Start of private message history with " + senderName, isSystem: true, ts: Date.now() }
      ],
      preview: "No messages yet",
      unread: false
    };
  }

  const chat = knockChats[senderId];
  chat.history.push({
    sender: senderName,
    text: text,
    isSystem: false,
    ts: ts
  });
  chat.preview = text;

  if (knockActiveContactId === senderId) {
    renderKnockMessages();
  } else {
    chat.unread = true;
    renderKnockChatList();
    if (typeof showToastMsg === "function") {
      showToastMsg("New message from " + senderName + "! 💬");
    }
  }
}

function sendKnockChatMessage(text) {
  const chatId = knockActiveContactId;
  const chat = knockChats[chatId];
  if (!chat || !text) return;

  const senderName = currentSocialUsername || "Me";
  chat.history.push({ sender: senderName, text: text, isSystem: false, ts: Date.now() });
  chat.preview = text;

  if (chat.type === "room") {
    sendServerMessage("send_chat", { text });
  } else if (chat.type === "friend") {
    if (presenceChannel) {
      presenceChannel.send({
        type: "broadcast",
        event: "direct_message",
        payload: {
          senderId: currentSocialUserId,
          senderName: currentSocialUsername,
          recipientId: chatId,
          text: text,
          ts: Date.now()
        }
      });
    } else {
      if (typeof showToastMsg === "function") {
        showToastMsg("Cannot send. Offline ⚠️");
      }
    }
  }

  renderKnockMessages();
  renderKnockChatList();
}

function bindKnockListenersOnce() {
  if (knockListenersBound) return;
  knockListenersBound = true;

  document.querySelectorAll(".knock-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".knock-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      knockActiveTab = btn.getAttribute("data-knock-tab");
      renderKnockChatList();
    });
  });

  document.getElementById("knockChatForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("knockChatInput");
    const text = (input?.value || "").trim();
    if (text) {
      sendKnockChatMessage(text);
      input.value = "";
    }
  });
}


// =================================================================
// GAMEMODES POPUP MODAL LOGIC
// =================================================================

function closeGamemodesPopup() {
  const popup = document.getElementById("gamemodesPopup");
  if (popup) popup.classList.add("hidden");
}

function openGamemodesPopup() {
  const popup = document.getElementById("gamemodesPopup");
  if (popup) popup.classList.remove("hidden");
}

function bindGamemodesPopupListeners() {
  document.getElementById("btnOpenGamemodesPopup")?.addEventListener("click", openGamemodesPopup);
  document.getElementById("closeGamemodesBtn")?.addEventListener("click", closeGamemodesPopup);
  document.getElementById("gamemodesPopup")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("gamemodesPopup")) {
      closeGamemodesPopup();
    }
  });

  const modeButtons = [
    "btnPlayOfflineSingle",
    "btnPlayOfflineFour",
    "btnPlayOfflineBots",
    "btnPlayOnlineMultiplayer",
    "btnPlayOnlineBR"
  ];
  modeButtons.forEach(id => {
    document.getElementById(id)?.addEventListener("click", () => {
      closeGamemodesPopup();
    });
  });
}

// Bind immediately (or wait for DOM if not fully loaded)
if (document.readyState === "complete" || document.readyState === "interactive") {
  bindGamemodesPopupListeners();
} else {
  document.addEventListener("DOMContentLoaded", bindGamemodesPopupListeners);
}


// =================================================================
// IN-GAME CHAT TOGGLE LOGIC
// =================================================================

function bindIngameChatToggleListeners() {
  const toggleBtn = document.getElementById("ingameChatToggleBtn");
  const minBtn = document.getElementById("minimizeIngameChatBtn");
  const chatInput = document.getElementById("ingameChatInput");
  const chatBox = document.getElementById("ingameChatBox");

  if (!chatInput) return;

  toggleBtn?.addEventListener("click", () => {
    chatBox?.classList.remove("hidden");
    toggleBtn?.classList.add("hidden");
    setTimeout(() => {
      chatInput.focus();
    }, 50);
  });

  minBtn?.addEventListener("click", () => {
    chatInput.blur();
  });

  chatInput.addEventListener("focus", () => {
    chatBox?.classList.remove("hidden");
    toggleBtn?.classList.add("hidden");
  });

  chatInput.addEventListener("blur", () => {
    chatBox?.classList.add("hidden");
    if (serverMode === "online" && running) {
      toggleBtn?.classList.remove("hidden");
    }
  });
}

// Bind immediately or wait for DOM
if (document.readyState === "complete" || document.readyState === "interactive") {
  bindIngameChatToggleListeners();
} else {
  document.addEventListener("DOMContentLoaded", bindIngameChatToggleListeners);
}

// =================================================================
// GACHA SHOP & BOMB WARDROBE SYSTEM LOGIC
// =================================================================

const gachaPool = [
  { id: "pink-bomb", name: "Pink Bomb", color: "pink", type: "bomb", file: "assets/shop/pink-bomb.svg", chance: "10% Chance" },
  { id: "blue-bomb", name: "Blue Bomb", color: "blue", type: "bomb", file: "assets/shop/blue-bomb.svg", chance: "10% Chance" },
  { id: "green-bomb", name: "Green Bomb", color: "green", type: "bomb", file: "assets/shop/green-bomb.svg", chance: "10% Chance" },
  { id: "gold-bomb", name: "Gold Bomb", color: "gold", type: "bomb", file: "assets/shop/gold-bomb.svg", chance: "10% Chance" },
  { id: "purple-bomb", name: "Purple Bomb", color: "purple", type: "bomb", file: "assets/shop/purple-bomb.svg", chance: "10% Chance" },
  { id: "pink-effect", name: "Pink Flame", color: "pink", type: "effect", isSvgMarkup: true, chance: "10% Chance" },
  { id: "blue-effect", name: "Blue Flame", color: "blue", type: "effect", isSvgMarkup: true, chance: "10% Chance" },
  { id: "green-effect", name: "Green Flame", color: "green", type: "effect", isSvgMarkup: true, chance: "10% Chance" },
  { id: "gold-effect", name: "Golden Blast", color: "gold", type: "effect", isSvgMarkup: true, chance: "10% Chance" },
  { id: "purple-effect", name: "Shadow Blast", color: "purple", type: "effect", isSvgMarkup: true, chance: "10% Chance" }
];

function getGachaItemImageHtml(item, size = 44) {
  if (item.isSvgMarkup) {
    let outerColor = "#ff6f4f";
    let innerColor = "#fff06d";
    if (item.color === "pink") { outerColor = "#ff2f73"; innerColor = "#ff9ebb"; }
    else if (item.color === "blue") { outerColor = "#1852e0"; innerColor = "#18baff"; }
    else if (item.color === "green") { outerColor = "#1b854f"; innerColor = "#39d98a"; }
    else if (item.color === "gold") { outerColor = "#d35400"; innerColor = "#ffd86f"; }
    else if (item.color === "purple") { outerColor = "#5e1b85"; innerColor = "#b94cff"; }

    return `
      <svg viewBox="0 0 100 100" style="width: ${size}px; height: ${size}px; margin: auto; display: block; filter: drop-shadow(2px 2px 0 #000);">
        <path d="M50 10 L60 35 L85 35 L65 50 L75 75 L50 60 L25 75 L35 50 L15 35 L40 35 Z" fill="${outerColor}" stroke="#000" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M50 25 L55 40 L70 40 L58 50 L63 65 L50 55 L37 65 L42 50 L30 40 L45 40 Z" fill="${innerColor}" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      </svg>
    `;
  } else {
    return `<img src="${item.file}" style="width: ${size}px; height: ${size}px; transform: scale(1.1); filter: drop-shadow(0 2px 0 #000);" alt="${item.name}">`;
  }
}

let gachaDrawing = false;
let previewBombColor = localStorage.getItem("equipped_bomb") || "default";
let previewEffectColor = localStorage.getItem("equipped_effect") || "default";

function syncBombSelectPreview(color) {
  const bombNameMap = {
    default: "Default Bomb",
    pink: "Pink Bomb",
    blue: "Blue Bomb",
    green: "Green Bomb",
    gold: "Gold Bomb",
    purple: "Purple Bomb",
  };
  
  if (characterSelectName) {
    characterSelectName.textContent = bombNameMap[color] || (color.toUpperCase() + " Bomb");
  }
  
  if (characterSelectState) {
    const equipped = localStorage.getItem("equipped_bomb") || "default";
    characterSelectState.textContent = color === equipped ? "Selected" : "Select";
  }

  const bombSelectPreviewImg = document.getElementById("bombSelectPreviewImg");
  const characterSelectCanvas = document.getElementById("characterSelectCanvas");
  const effectSelectPreviewContainer = document.getElementById("effectSelectPreviewContainer");
  if (bombSelectPreviewImg && characterSelectCanvas && effectSelectPreviewContainer) {
    characterSelectCanvas.style.display = "none";
    effectSelectPreviewContainer.style.display = "none";
    bombSelectPreviewImg.style.display = "block";
    bombSelectPreviewImg.src = `assets/shop/${color}-bomb.svg`;
    
    // Trigger bounce pop & floating reflow
    bombSelectPreviewImg.classList.remove("active-preview");
    void bombSelectPreviewImg.offsetWidth;
    bombSelectPreviewImg.classList.add("active-preview");
  }
}

function updateWardrobeTabBadges() {
  const bombColors = ["pink", "blue", "green", "gold", "purple"];
  const hasNewBomb = bombColors.some(color => localStorage.getItem("new_bomb_" + color) === "true");
  
  const effectColors = ["pink", "blue", "green", "gold", "purple"];
  const hasNewEffect = effectColors.some(color => localStorage.getItem("new_effect_" + color) === "true");

  const bombsTab = document.querySelector('.wardrobe-tab[data-wardrobe-mode="bombs"]');
  if (bombsTab) {
    bombsTab.classList.toggle("has-new", hasNewBomb);
  }
  const effectsTab = document.querySelector('.wardrobe-tab[data-wardrobe-mode="effects"]');
  if (effectsTab) {
    effectsTab.classList.toggle("has-new", hasNewEffect);
  }
  
  const charactersTab = document.querySelector('.wardrobe-tab[data-wardrobe-mode="characters"]');
  if (charactersTab) {
    charactersTab.classList.remove("has-new");
  }
  const clothesTab = document.querySelector('.wardrobe-tab[data-wardrobe-mode="clothes"]');
  if (clothesTab) {
    clothesTab.classList.remove("has-new");
  }
}

function syncBombWardrobe() {
  const ownedBombs = {
    pink: localStorage.getItem("owned_bomb_pink") === "true",
    blue: localStorage.getItem("owned_bomb_blue") === "true",
    green: localStorage.getItem("owned_bomb_green") === "true",
    gold: localStorage.getItem("owned_bomb_gold") === "true",
    purple: localStorage.getItem("owned_bomb_purple") === "true",
  };
  
  const bombCards = document.querySelectorAll(".bomb-card");
  bombCards.forEach((card) => {
    const color = card.getAttribute("data-bomb-color");
    if (color === "default" || ownedBombs[color]) {
      card.classList.remove("locked");
    } else {
      card.classList.add("locked");
    }
    
    if (color === previewBombColor) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
}

function syncEffectSelectPreview(color) {
  const effectNameMap = {
    default: "Default Blast",
    pink: "Pink Flame",
    blue: "Blue Flame",
    green: "Green Flame",
    gold: "Golden Blast",
    purple: "Shadow Blast",
  };
  
  if (characterSelectName) {
    characterSelectName.textContent = effectNameMap[color] || (color.toUpperCase() + " Blast");
  }
  
  if (characterSelectState) {
    const equipped = localStorage.getItem("equipped_effect") || "default";
    characterSelectState.textContent = color === equipped ? "Selected" : "Select";
  }

  const bombSelectPreviewImg = document.getElementById("bombSelectPreviewImg");
  const characterSelectCanvas = document.getElementById("characterSelectCanvas");
  const effectSelectPreviewContainer = document.getElementById("effectSelectPreviewContainer");
  if (bombSelectPreviewImg && characterSelectCanvas && effectSelectPreviewContainer) {
    characterSelectCanvas.style.display = "none";
    bombSelectPreviewImg.style.display = "none";
    effectSelectPreviewContainer.style.display = "flex";
    
    let outerColor = "#ff6f4f";
    let innerColor = "#fff06d";
    if (color === "pink") { outerColor = "#ff2f73"; innerColor = "#ff9ebb"; }
    else if (color === "blue") { outerColor = "#1852e0"; innerColor = "#18baff"; }
    else if (color === "green") { outerColor = "#1b854f"; innerColor = "#39d98a"; }
    else if (color === "gold") { outerColor = "#d35400"; innerColor = "#ffd86f"; }
    else if (color === "purple") { outerColor = "#5e1b85"; innerColor = "#b94cff"; }

    effectSelectPreviewContainer.innerHTML = `
      <svg viewBox="0 0 100 100" style="width: 280px; height: 280px; filter: drop-shadow(4px 4px 0 #000); animation: selectFloat 2.5s ease-in-out infinite alternate;">
        <path d="M50 10 L60 35 L85 35 L65 50 L75 75 L50 60 L25 75 L35 50 L15 35 L40 35 Z" fill="${outerColor}" stroke="#000" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M50 25 L55 40 L70 40 L58 50 L63 65 L50 55 L37 65 L42 50 L30 40 L45 40 Z" fill="${innerColor}" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      </svg>
    `;
    
    effectSelectPreviewContainer.classList.remove("active-preview");
    void effectSelectPreviewContainer.offsetWidth;
    effectSelectPreviewContainer.classList.add("active-preview");
  }
}

function syncEffectWardrobe() {
  const ownedEffects = {
    pink: localStorage.getItem("owned_effect_pink") === "true",
    blue: localStorage.getItem("owned_effect_blue") === "true",
    green: localStorage.getItem("owned_effect_green") === "true",
    gold: localStorage.getItem("owned_effect_gold") === "true",
    purple: localStorage.getItem("owned_effect_purple") === "true",
  };
  
  const effectCards = document.querySelectorAll(".effect-card");
  effectCards.forEach((card) => {
    const color = card.getAttribute("data-effect-color");
    if (color === "default" || ownedEffects[color]) {
      card.classList.remove("locked");
    } else {
      card.classList.add("locked");
    }
    
    if (color === previewEffectColor) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
}

function updateShopWalletDisplay() {
  const shopWallet = document.getElementById("shopGemsDisplay");
  if (shopWallet) shopWallet.textContent = gemsCount.toLocaleString();
  const gachaWallet = document.getElementById("gachaWalletGems");
  if (gachaWallet) gachaWallet.textContent = gemsCount.toLocaleString();
}

function initGachaShop() {
  const shopBtn = document.getElementById("magicalChiikawaBannerBtn");
  if (shopBtn) {
    shopBtn.addEventListener("click", () => {
      openGachaModal();
    });
  }
  
  // Set wallet display initially
  updateShopWalletDisplay();

  // Close gacha modal
  document.getElementById("closeGachaModalBtn")?.addEventListener("click", closeGachaModal);
  
  // Draw button
  document.getElementById("gachaDrawBtn")?.addEventListener("click", handleGachaDraw);

  // Claim button
  document.getElementById("gachaWinClaimBtn")?.addEventListener("click", () => {
    const winIndicator = document.getElementById("gachaWinIndicator");
    if (winIndicator) {
      winIndicator.style.opacity = "0";
      setTimeout(() => winIndicator.classList.add("hidden"), 300);
    }
  });

  // Phone sub-tab click listeners
  const subTabButtons = document.querySelectorAll(".shop-nav-btn");
  subTabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const subTabName = btn.getAttribute("data-shop-subtab");
      
      // Remove active class from other buttons
      subTabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Hide all subtab contents
      document.querySelectorAll(".shop-subtab-content").forEach((content) => {
        content.classList.remove("active");
        content.style.display = "none";
      });
      
      // Show targeted subtab content
      const target = document.getElementById(`shopSubTabContent_${subTabName}`);
      if (target) {
        target.classList.add("active");
        target.style.display = "flex";
      }
    });
  });

  // Tab click wallet updates
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-tab");
      if (tabName === "shop") {
        updateShopWalletDisplay();
        // Reset subtab to Gacha on main shop tab click
        const firstSubtab = document.querySelector('.shop-nav-btn[data-shop-subtab="gacha"]');
        if (firstSubtab) firstSubtab.click();
      }
    });
  });
}

function openGachaModal() {
  const modal = document.getElementById("gachaModalOverlay");
  if (!modal) return;
  modal.classList.remove("hidden");
  
  updateShopWalletDisplay();
  renderGachaPool();
  resetGachaReel();
}

function closeGachaModal() {
  if (gachaDrawing) return; // Prevent closing while drawing!
  const modal = document.getElementById("gachaModalOverlay");
  if (modal) modal.classList.add("hidden");
}

function renderGachaPool() {
  const grid = document.getElementById("gachaPoolGrid");
  if (!grid) return;
  grid.innerHTML = "";
  
  let unownedCount = 0;
  
  gachaPool.forEach(item => {
    const ownedKey = item.type === "effect" ? `owned_effect_${item.color}` : `owned_bomb_${item.color}`;
    const owned = localStorage.getItem(ownedKey) === "true";
    if (!owned) unownedCount++;
    
    const div = document.createElement("div");
    div.className = `gacha-pool-item ${owned ? "owned" : ""}`;
    div.innerHTML = `
      ${getGachaItemImageHtml(item, 44)}
      <span>${item.type.toUpperCase()}</span>
      <strong>${item.name}</strong>
      <small>${owned ? "OWNED" : item.chance}</small>
    `;
    grid.appendChild(div);
  });
  
  const leftText = document.getElementById("gachaRewardsLeftText");
  if (leftText) leftText.textContent = `${unownedCount} rewards left`;
  
  const drawBtn = document.getElementById("gachaDrawBtn");
  if (drawBtn) {
    if (unownedCount === 0) {
      drawBtn.textContent = "COMPLETE";
      drawBtn.disabled = true;
    } else {
      drawBtn.innerHTML = `Draw <svg viewBox="0 0 24 24" width="14" height="14" fill="#000" style="display: inline-block; vertical-align: middle; margin-left: 2px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> 300`;
      drawBtn.disabled = false;
    }
  }
}

function resetGachaReel() {
  const reel = document.getElementById("gachaReel");
  if (!reel) return;
  
  reel.style.transition = "none";
  reel.style.transform = "translateX(0)";
  
  // Fill the reel with random items initially
  reel.innerHTML = "";
  for (let i = 0; i < 15; i++) {
    const item = gachaPool[Math.floor(Math.random() * gachaPool.length)];
    const tile = document.createElement("div");
    tile.className = "gacha-reel-tile";
    tile.innerHTML = getGachaItemImageHtml(item, 44);
    reel.appendChild(tile);
  }
}

function handleGachaDraw() {
  if (gachaDrawing) return;
  
  // Check gem count
  if (gemsCount < 300) {
    showToastMsg("Not enough Gems!");
    return;
  }
  
  // Find unowned pool items
  const unowned = gachaPool.filter(item => {
    const ownedKey = item.type === "effect" ? `owned_effect_${item.color}` : `owned_bomb_${item.color}`;
    return localStorage.getItem(ownedKey) !== "true";
  });
  if (unowned.length === 0) {
    showToastMsg("You own all rewards!");
    return;
  }
  
  // Deduct gems
  gemsCount -= 300;
  const gemsEl = document.getElementById("gemsCount");
  if (gemsEl) gemsEl.textContent = gemsCount;
  updateShopWalletDisplay();

  // Progress daily gems spent quest
  let dailyGemsSpent = parseInt(localStorage.getItem("quest_gems_progress") || "0");
  localStorage.setItem("quest_gems_progress", Math.min(300, dailyGemsSpent + 300).toString());

  // Progress weekly spin quest
  let weeklySpins = parseInt(localStorage.getItem("quest_spin3_progress") || "0");
  localStorage.setItem("quest_spin3_progress", Math.min(3, weeklySpins + 1).toString());

  // Progress weekly spend quest
  let weeklySpend = parseInt(localStorage.getItem("quest_spend1000_progress") || "0");
  localStorage.setItem("quest_spend1000_progress", Math.min(1000, weeklySpend + 300).toString());

  saveProgression();
  
  gachaDrawing = true;
  document.getElementById("gachaDrawBtn").disabled = true;
  document.getElementById("closeGachaModalBtn").disabled = true;
  
  // Select a random unowned item as the winner
  const winner = unowned[Math.floor(Math.random() * unowned.length)];
  
  // Construct the gacha reel items list:
  // We want to generate around 40 items. The winner goes at index 32.
  const totalReelLength = 40;
  const winnerIndex = 32;
  
  const reel = document.getElementById("gachaReel");
  reel.style.transition = "none";
  reel.style.transform = "translateX(0)";
  reel.innerHTML = "";
  
  const generatedReelItems = [];
  for (let i = 0; i < totalReelLength; i++) {
    let item;
    if (i === winnerIndex) {
      item = winner;
    } else {
      // Pick random item
      item = gachaPool[Math.floor(Math.random() * gachaPool.length)];
    }
    generatedReelItems.push(item);
    
    const tile = document.createElement("div");
    tile.className = `gacha-reel-tile ${i === winnerIndex ? "is-result" : ""}`;
    tile.innerHTML = getGachaItemImageHtml(item, 44);
    reel.appendChild(tile);
  }
  
  // Force reflow
  void reel.offsetWidth;
  
  // Calculate stop offset
  const stageWidth = document.getElementById("gachaStage").getBoundingClientRect().width;
  const tileWidth = 96;
  const gap = 14;
  const pad = 24; // padding left of the reel
  
  // Center of winning tile relative to start of reel
  const tileCenter = pad + winnerIndex * (tileWidth + gap) + tileWidth / 2;
  const stopOffset = stageWidth / 2 - tileCenter;
  
  // Start animation
  reel.style.transition = "transform 5s cubic-bezier(0.1, 0.8, 0.1, 1)";
  reel.style.transform = `translateX(${stopOffset}px)`;
  
  setTimeout(() => {
    // Reveal winner
    gachaDrawing = false;
    document.getElementById("closeGachaModalBtn").disabled = false;
    
    // Save to owned
    const ownedKey = winner.type === "effect" ? `owned_effect_${winner.color}` : `owned_bomb_${winner.color}`;
    localStorage.setItem(ownedKey, "true");
    
    // Mark as new / untried
    const newKey = winner.type === "effect" ? `new_effect_${winner.color}` : `new_bomb_${winner.color}`;
    localStorage.setItem(newKey, "true");
    updateWardrobeTabBadges();
    
    // Sync pool and wardrobe
    renderGachaPool();
    syncBombWardrobe();
    syncEffectWardrobe();
    
    // Show win indicator
    const winItemAvatar = document.getElementById("gachaWinItemAvatar");
    winItemAvatar.innerHTML = getGachaItemImageHtml(winner, 52);
    
    document.getElementById("gachaWinItemName").textContent = winner.name;
    const winIndicator = document.getElementById("gachaWinIndicator");
    if (winIndicator) {
      winIndicator.classList.remove("hidden");
      // Trigger smooth fade in
      winIndicator.style.opacity = "0";
      setTimeout(() => winIndicator.style.opacity = "1", 50);
    }
    
    showToastMsg(`You unlocked the ${winner.name}!`);
  }, 5200);
}

// Bind bomb skin wardrobe clicks and gacha init on page load
document.addEventListener("DOMContentLoaded", () => {
  // Ensure default items are marked as owned
  localStorage.setItem("owned_bomb_default", "true");
  localStorage.setItem("owned_effect_default", "true");

  const bombCards = document.querySelectorAll(".bomb-card");
  bombCards.forEach((card) => {
    card.addEventListener("click", () => {
      if (card.classList.contains("locked")) {
        showToastMsg("Unlock this bomb skin in the Gacha Shop first!");
        return;
      }
      const bombColor = card.getAttribute("data-bomb-color");
      previewBombColor = bombColor;
      
      // Clear new status
      localStorage.removeItem(`new_bomb_${bombColor}`);
      updateWardrobeTabBadges();
      
      // Update card active states
      bombCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      
      // Update nameplate preview
      syncBombSelectPreview(previewBombColor);
    });
  });

  const effectCards = document.querySelectorAll(".effect-card");
  effectCards.forEach((card) => {
    card.addEventListener("click", () => {
      if (card.classList.contains("locked")) {
        showToastMsg("Unlock this explosion effect in the Gacha Shop first!");
        return;
      }
      const effectColor = card.getAttribute("data-effect-color");
      previewEffectColor = effectColor;
      
      // Clear new status
      localStorage.removeItem(`new_effect_${effectColor}`);
      updateWardrobeTabBadges();
      
      // Update card active states
      effectCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      
      // Update nameplate preview
      syncEffectSelectPreview(previewEffectColor);
    });
  });
  
  // Initial syncs
  syncBombWardrobe();
  syncEffectWardrobe();
  updateWardrobeTabBadges();
  initGachaShop();
  initQuestsSystem();
  if (typeof updateFooterColor === "function") updateFooterColor("play");
});

// =================================================================
// ZZZ-STYLE QUESTS & ERRANDS SYSTEM
// =================================================================

function initQuestsSystem() {
  // Bind quests top binder tabs
  const questsTabs = document.querySelectorAll(".quests-tab-btn");
  questsTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.getAttribute("data-quests-tab");
      
      // Toggle button active classes
      questsTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      
      // Hide all quests pages
      document.querySelectorAll(".quests-page").forEach((page) => {
        page.classList.remove("active");
        page.style.display = "none";
      });
      
      // Show target page
      const targetPage = document.getElementById(`questsTabContent_${targetTab}`);
      if (targetPage) {
        targetPage.classList.add("active");
        targetPage.style.display = "flex";
      }

      // Specific tab sync
      if (targetTab === "level") {
        syncLevelTabUI();
      } else {
        syncQuestsUI();
      }
    });
  });

  // Automatically mark login quest as completed on load
  localStorage.setItem("quest_login_completed", "true");

  // Bind quest card action buttons (Claim buttons)
  bindQuestClaimButton("qbtn_login", "quest_login_completed", "quest_login_claimed", 100);
  bindQuestClaimButton("qbtn_match", "quest_match_completed", "quest_match_claimed", 100, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });
  bindQuestClaimButton("qbtn_pickups", "quest_pickups_completed", "quest_pickups_claimed", 100, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });
  bindQuestClaimButton("qbtn_bombs", "quest_bombs_completed", "quest_bombs_claimed", 100, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });


  bindWeeklyQuestClaimButton("qbtn_win3", "quest_win3_completed", "quest_win3_claimed", 100, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });
  bindWeeklyQuestClaimButton("qbtn_spin3", "quest_spin3_completed", "quest_spin3_claimed", 100, () => {
    document.querySelector('.tab-btn[data-tab="shop"]')?.click();
  });
  bindWeeklyQuestClaimButton("qbtn_kills", "quest_kills_completed", "quest_kills_claimed", 100, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });
  bindWeeklyQuestClaimButton("qbtn_spend1000", "quest_spend1000_completed", "quest_spend1000_claimed", 100, () => {
    document.querySelector('.tab-btn[data-tab="shop"]')?.click();
  });

  // Bind Weekly progress milestones
  bindWeeklyMilestoneNode("weekly_chk_100", 100);
  bindWeeklyMilestoneNode("weekly_chk_200", 200);
  bindWeeklyMilestoneNode("weekly_chk_300", 300);
  bindWeeklyMilestoneNode("weekly_chk_400", 400);

  // Bind gameplay milestone quests (awarding direct gems)
  bindGameplayQuestClaimButton("qbtn_total_bombs", "quest_total_bombs_completed", "quest_total_bombs_claimed", 15, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });
  bindGameplayQuestClaimButton("qbtn_win5", "quest_win5_completed", "quest_win5_claimed", 10, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });
  bindGameplayQuestClaimButton("qbtn_total_pickups", "quest_total_pickups_completed", "quest_total_pickups_claimed", 5, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });
  bindGameplayQuestClaimButton("qbtn_total_kills", "quest_total_kills_completed", "quest_total_kills_claimed", 20, () => {
    document.querySelector('.tab-btn[data-tab="play"]')?.click();
  });

  // Bind engagement progress milestones
  bindMilestoneNode("chk_100", 100);
  bindMilestoneNode("chk_200", 200);
  bindMilestoneNode("chk_300", 300);
  bindMilestoneNode("chk_400", 400);

  syncQuestsUI();
  syncLevelTabUI();
}

function bindQuestClaimButton(btnId, compKey, claimKey, pointsVal, goAction) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  btn.addEventListener("click", () => {
    const completed = localStorage.getItem(compKey) === "true";
    const claimed = localStorage.getItem(claimKey) === "true";
    
    if (completed && !claimed) {
      localStorage.setItem(claimKey, "true");
      
      // Add engagement points
      let engagement = parseInt(localStorage.getItem("daily_engagement") || "0");
      engagement = Math.min(400, engagement + pointsVal);
      localStorage.setItem("daily_engagement", engagement.toString());
      
      showToastMsg(`Claimed ${pointsVal} Engagement Points!`);
      syncQuestsUI();
    } else if (!completed && !claimed && typeof goAction === "function") {
      goAction();
    }
  });
}

function bindGameplayQuestClaimButton(btnId, compKey, claimKey, gemsVal, goAction) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  btn.addEventListener("click", () => {
    const completed = localStorage.getItem(compKey) === "true";
    const claimed = localStorage.getItem(claimKey) === "true";
    
    if (completed && !claimed) {
      localStorage.setItem(claimKey, "true");
      
      // Add gems directly
      gemsCount += gemsVal;
      const gemsEl = document.getElementById("gemsCount");
      if (gemsEl) gemsEl.textContent = gemsCount;
      updateShopWalletDisplay();
      saveProgression();
      
      showGemClaimRewardModal(gemsVal, "Quest Reward Claimed!");
      syncQuestsUI();
    } else if (!completed && !claimed && typeof goAction === "function") {
      goAction();
    }
  });
}

function bindWeeklyQuestClaimButton(btnId, compKey, claimKey, pointsVal, goAction) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  btn.addEventListener("click", () => {
    const completed = localStorage.getItem(compKey) === "true";
    const claimed = localStorage.getItem(claimKey) === "true";
    
    if (completed && !claimed) {
      localStorage.setItem(claimKey, "true");
      
      // Add weekly engagement points
      let engagement = parseInt(localStorage.getItem("weekly_engagement") || "0");
      engagement = Math.min(400, engagement + pointsVal);
      localStorage.setItem("weekly_engagement", engagement.toString());
      
      showToastMsg(`Claimed ${pointsVal} Weekly Engagement Points!`);
      syncQuestsUI();
    } else if (!completed && !claimed && typeof goAction === "function") {
      goAction();
    }
  });
}

function bindWeeklyMilestoneNode(nodeId, milestoneVal) {
  const node = document.getElementById(nodeId);
  if (!node) return;
  
  node.addEventListener("click", () => {
    const engagement = parseInt(localStorage.getItem("weekly_engagement") || "0");
    const claimed = localStorage.getItem(`claimed_weekly_milestone_${milestoneVal}`) === "true";
    
    if (engagement >= milestoneVal && !claimed) {
      localStorage.setItem(`claimed_weekly_milestone_${milestoneVal}`, "true");
      
      // Grant reward of 20 gems
      gemsCount += 20;
      const gemsEl = document.getElementById("gemsCount");
      if (gemsEl) gemsEl.textContent = gemsCount;
      updateShopWalletDisplay();
      saveProgression();
      
      showGemClaimRewardModal(20, "Weekly Milestone Claimed!");
      syncQuestsUI();
    }
  });
}

function bindMilestoneNode(nodeId, milestoneVal) {
  const node = document.getElementById(nodeId);
  if (!node) return;
  
  node.addEventListener("click", () => {
    const engagement = parseInt(localStorage.getItem("daily_engagement") || "0");
    const claimed = localStorage.getItem(`claimed_milestone_${milestoneVal}`) === "true";
    
    if (engagement >= milestoneVal && !claimed) {
      localStorage.setItem(`claimed_milestone_${milestoneVal}`, "true");
      
      // Grant reward of 10 gems
      gemsCount += 10;
      const gemsEl = document.getElementById("gemsCount");
      if (gemsEl) gemsEl.textContent = gemsCount;
      updateShopWalletDisplay();
      saveProgression();
      
      showGemClaimRewardModal(10, "Milestone Reward Claimed!");
      syncQuestsUI();
    }
  });
}

function syncQuestsUI() {
  // Sync daily engagement
  const engagement = parseInt(localStorage.getItem("daily_engagement") || "0");
  const currentValEl = document.getElementById("currentEngagementVal");
  if (currentValEl) currentValEl.textContent = engagement;
  
  const progressBar = document.getElementById("engagementProgressBar");
  if (progressBar) {
    const pct = (engagement / 400) * 100;
    progressBar.style.width = `${pct}%`;
  }
  
  // Milestone node updates
  updateMilestoneNode("chk_100", 100, engagement);
  updateMilestoneNode("chk_200", 200, engagement);
  updateMilestoneNode("chk_300", 300, engagement);
  updateMilestoneNode("chk_400", 400, engagement);

  // Sync weekly engagement
  const weeklyEngagement = parseInt(localStorage.getItem("weekly_engagement") || "0");
  const weeklyValEl = document.getElementById("currentWeeklyEngagementVal");
  if (weeklyValEl) weeklyValEl.textContent = weeklyEngagement;
  
  const weeklyProgressBar = document.getElementById("weeklyEngagementProgressBar");
  if (weeklyProgressBar) {
    const pct = (weeklyEngagement / 400) * 100;
    weeklyProgressBar.style.width = `${pct}%`;
  }
  
  // Weekly Milestone node updates
  updateMilestoneNode("weekly_chk_100", 100, weeklyEngagement);
  updateMilestoneNode("weekly_chk_200", 200, weeklyEngagement);
  updateMilestoneNode("weekly_chk_300", 300, weeklyEngagement);
  updateMilestoneNode("weekly_chk_400", 400, weeklyEngagement);

  // Sync Card 1: Login
  updateQuestCardUI("qprog_login", "qbtn_login", "quest_login_completed", "quest_login_claimed", 1, 1);
  
  // Sync Card 2: Match
  const matchCompleted = localStorage.getItem("quest_match_completed") === "true";
  updateQuestCardUI("qprog_match", "qbtn_match", "quest_match_completed", "quest_match_claimed", matchCompleted ? 1 : 0, 1);
  
  // Sync Card 3: Pickups collected
  const pickupsCollected = parseInt(localStorage.getItem("quest_pickups_progress") || "0");
  if (pickupsCollected >= 3) localStorage.setItem("quest_pickups_completed", "true");
  updateQuestCardUI("qprog_pickups", "qbtn_pickups", "quest_pickups_completed", "quest_pickups_claimed", pickupsCollected, 3);
  
  // Sync Card 4: Bombs placed
  const bombsPlaced = parseInt(localStorage.getItem("quest_bombs_progress") || "0");
  if (bombsPlaced >= 10) localStorage.setItem("quest_bombs_completed", "true");
  updateQuestCardUI("qprog_bombs", "qbtn_bombs", "quest_bombs_completed", "quest_bombs_claimed", bombsPlaced, 10);

  // Sync Weekly Quests
  // Weekly 1: Win 3
  const wins = parseInt(localStorage.getItem("quest_win3_progress") || "0");
  if (wins >= 3) localStorage.setItem("quest_win3_completed", "true");
  updateQuestCardUI("qprog_win3", "qbtn_win3", "quest_win3_completed", "quest_win3_claimed", wins, 3);

  // Weekly 2: Spin 3
  const spins = parseInt(localStorage.getItem("quest_spin3_progress") || "0");
  if (spins >= 3) localStorage.setItem("quest_spin3_completed", "true");
  updateQuestCardUI("qprog_spin3", "qbtn_spin3", "quest_spin3_completed", "quest_spin3_claimed", spins, 3);

  // Weekly 3: Kills
  const kills = parseInt(localStorage.getItem("quest_kills_progress") || "0");
  if (kills >= 5) localStorage.setItem("quest_kills_completed", "true");
  updateQuestCardUI("qprog_kills", "qbtn_kills", "quest_kills_completed", "quest_kills_claimed", kills, 5);

  // Weekly 4: Spend 1000
  const spend = parseInt(localStorage.getItem("quest_spend1000_progress") || "0");
  if (spend >= 1000) localStorage.setItem("quest_spend1000_completed", "true");
  updateQuestCardUI("qprog_spend1000", "qbtn_spend1000", "quest_spend1000_completed", "quest_spend1000_claimed", spend, 1000);

  // Sync Gameplay Quests
  // 1. Place 100 Bombs
  const lifetimeBombs = parseInt(localStorage.getItem("lifetime_bombs_placed") || "0");
  if (lifetimeBombs >= 100) localStorage.setItem("quest_total_bombs_completed", "true");
  updateQuestCardUI("qprog_total_bombs", "qbtn_total_bombs", "quest_total_bombs_completed", "quest_total_bombs_claimed", lifetimeBombs, 100);

  // 2. Win 5 Matches
  if (totalWins >= 5) localStorage.setItem("quest_win5_completed", "true");
  updateQuestCardUI("qprog_win5", "qbtn_win5", "quest_win5_completed", "quest_win5_claimed", totalWins, 5);

  // 3. Collect 15 Power-ups
  const lifetimePickups = parseInt(localStorage.getItem("lifetime_pickups_collected") || "0");
  if (lifetimePickups >= 15) localStorage.setItem("quest_total_pickups_completed", "true");
  updateQuestCardUI("qprog_total_pickups", "qbtn_total_pickups", "quest_total_pickups_completed", "quest_total_pickups_claimed", lifetimePickups, 15);

  // 4. Defeat 15 Enemies
  const lifetimeKills = parseInt(localStorage.getItem("lifetime_kills") || "0");
  if (lifetimeKills >= 15) localStorage.setItem("quest_total_kills_completed", "true");
  updateQuestCardUI("qprog_total_kills", "qbtn_total_kills", "quest_total_kills_completed", "quest_total_kills_claimed", lifetimeKills, 15);
}

function updateMilestoneNode(nodeId, milestoneVal, currentEngagement) {
  const node = document.getElementById(nodeId);
  if (!node) return;
  
  const isWeekly = nodeId.startsWith("weekly_");
  const key = isWeekly ? `claimed_weekly_milestone_${milestoneVal}` : `claimed_milestone_${milestoneVal}`;
  const claimed = localStorage.getItem(key) === "true";
  
  node.className = "checkpoint-node";
  if (claimed) {
    node.classList.add("claimed");
  } else if (currentEngagement >= milestoneVal) {
    node.classList.add("unlocked");
  }
}

function updateQuestCardUI(progElId, btnId, compKey, claimKey, currentVal, targetVal) {
  const progEl = document.getElementById(progElId);
  const btn = document.getElementById(btnId);
  if (!progEl || !btn) return;
  
  progEl.textContent = `${currentVal}/${targetVal}`;
  
  const completed = localStorage.getItem(compKey) === "true";
  const claimed = localStorage.getItem(claimKey) === "true";

  // Set card sub-footer text
  const card = btn.closest(".quest-card");
  if (card) {
    const subFooter = card.querySelector(".quest-card-sub-footer");
    if (subFooter) {
      if (claimed) {
        subFooter.innerHTML = "<span>● Errand Completed</span>";
        subFooter.className = "quest-card-sub-footer claimed-copy";
      } else if (completed) {
        subFooter.innerHTML = "<span>● Errand Complete!</span>";
        subFooter.className = "quest-card-sub-footer unclaimed-copy";
      } else {
        subFooter.innerHTML = "<span>● Errand in progress</span>";
        subFooter.className = "quest-card-sub-footer";
      }
    }
  }
  
  btn.className = "quest-card-action-btn";
  if (claimed) {
    btn.textContent = "Claimed";
    btn.classList.add("disabled");
    btn.disabled = true;
  } else if (completed) {
    btn.textContent = "Claim";
    btn.classList.add("claimable");
    btn.disabled = false;
  } else {
    btn.textContent = "Go";
    btn.classList.add("go-btn");
    btn.disabled = false;
  }
}

function syncLevelTabUI() {
  const questsTabLevelVal = document.getElementById("questsTabLevelVal");
  const questsTabXpVal = document.getElementById("questsTabXpVal");
  const questsTabXpProgressBar = document.getElementById("questsTabXpProgressBar");
  
  if (questsTabLevelVal) questsTabLevelVal.textContent = seasonLevel;
  if (questsTabXpVal) questsTabXpVal.textContent = `${seasonXp} / ${seasonXpToNext} XP`;
  if (questsTabXpProgressBar) {
    const pct = (seasonXp / seasonXpToNext) * 100;
    questsTabXpProgressBar.style.width = `${Math.min(100, pct)}%`;
  }

  const list = document.getElementById("levelRewardsScrollList");
  if (!list) return;
  list.innerHTML = "";
  
  const maxLevelToShow = 100;
  for (let lvl = 2; lvl <= maxLevelToShow; lvl++) {
    const reached = seasonLevel >= lvl;
    const claimed = localStorage.getItem(`level_reward_claimed_${lvl}`) === "true";
    
    const card = document.createElement("div");
    card.style.background = "#212224";
    card.style.border = "3px solid #000";
    card.style.borderRadius = "12px";
    card.style.padding = "10px 16px";
    card.style.display = "flex";
    card.style.alignItems = "center";
    card.style.justifyContent = "space-between";
    card.style.boxShadow = "2px 2px 0 #000";
    
    let titleColor = reached ? "#fff" : "#555";
    let badgeBg = reached ? "#ffd86f" : "#36363b";
    let badgeText = reached ? "#000" : "#888";
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="background: ${badgeBg}; color: ${badgeText}; font-family: var(--font); font-size: 12px; font-weight: 900; padding: 4px 10px; border-radius: 8px; border: 2px solid #000;">LVL ${lvl}</div>
        <span style="font-family: var(--font); font-size: 13px; color: ${titleColor}; text-shadow: 1px 1px 0 #000;">Level ${lvl} Milestone</span>
      </div>
      
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="font-family: var(--font); font-size: 12px; color: #ffd86f; font-weight: 900; display: flex; align-items: center; gap: 3px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#ffd86f" style="display: inline-block; vertical-align: middle;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> 5
        </span>
        
        <button class="level-claim-btn" data-level-milestone="${lvl}" type="button" style="padding: 4px 12px; font-family: var(--font); font-size: 11px; font-weight: 900; text-transform: uppercase; border-radius: 8px; border: 2.5px solid #000; box-shadow: 1.5px 1.5px 0 #000; cursor: pointer; transition: transform 0.1s;"></button>
      </div>
    `;
    
    const btn = card.querySelector(".level-claim-btn");
    if (claimed) {
      btn.textContent = "Claimed";
      btn.style.background = "#444";
      btn.style.color = "#888";
      btn.style.borderColor = "#000";
      btn.style.boxShadow = "none";
      btn.style.cursor = "not-allowed";
      btn.disabled = true;
    } else if (reached) {
      btn.textContent = "Claim";
      btn.style.background = "#83cf00";
      btn.style.color = "#000";
      btn.classList.add("claimable");
      btn.disabled = false;
      
      btn.addEventListener("click", () => {
        localStorage.setItem(`level_reward_claimed_${lvl}`, "true");
        
        // Grant 5 gems
        gemsCount += 5;
        const gemsEl = document.getElementById("gemsCount");
        if (gemsEl) gemsEl.textContent = gemsCount;
        updateShopWalletDisplay();
        saveProgression();
        
        showGemClaimRewardModal(5, `Level ${lvl} Reward Claimed!`);
        syncLevelTabUI();
      });
    } else {
      btn.textContent = "Locked";
      btn.style.background = "#444";
      btn.style.color = "#666";
      btn.style.borderColor = "#000";
      btn.style.boxShadow = "none";
      btn.style.cursor = "not-allowed";
      btn.disabled = true;
    }
    
    list.appendChild(card);
  }
}

function updateFooterColor(tabName) {
  const footer = document.getElementById("lobbyConsoleFooter");
  if (!footer) return;
  const badgeText = footer.querySelector(".badge-text");
  
  if (tabName === "look") {
    footer.style.background = "#101215";
    footer.style.borderColor = "#000000";
    if (badgeText) badgeText.style.color = "#ffffff";
  } else if (tabName === "quests") {
    footer.style.background = "#111215";
    footer.style.borderColor = "#000000";
    if (badgeText) badgeText.style.color = "#ffffff";
  } else if (tabName === "shop") {
    footer.style.background = "#4a0080";
    footer.style.borderColor = "#000000";
    if (badgeText) badgeText.style.color = "#ffffff";
  } else {
    // Default yellow screens (play, squad, gear)
    footer.style.background = "rgba(0, 0, 0, 0.15)";
    footer.style.borderColor = "";
    if (badgeText) badgeText.style.color = "#000000";
  }
}

// =================================================================
// INTERACTIVE TUTORIAL GUIDE SYSTEM
// =================================================================

window.tutorialGuideActive = false;
window.tutorialGuidePaused = false;
window.tutorialGuideStep = 0;

let cutsceneTimeListener = null;

function startInteractiveCutscene() {
  const cutsceneScreen = document.getElementById("tutorialCutsceneScreen");
  const video = document.getElementById("tutorialCutsceneVideo");
  const title = document.getElementById("tutorialCutsceneTitle");
  const chooseBtn = document.getElementById("tutorialChooseBtn");
  const prevBtn = document.getElementById("tutorialPrevBtn");
  const nextBtn = document.getElementById("tutorialNextBtn");
  
  if (!cutsceneScreen || !video) {
    localStorage.setItem("tutorial_status", "vs_screen");
    startUsernameIntroFlow();
    return;
  }
  
  switchScreen(cutsceneScreen);
  
  // Reset and play
  video.currentTime = 0;
  video.play().catch(e => console.warn("Video play blocked:", e));
  
  let tutorialState = 0; // 0: Usagi, 1: Chiikawa, 2: Hachiware
  const characterKeys = ["usagi", "chiikawa", "hachiware"];
  
  if (cutsceneTimeListener) {
    video.removeEventListener("timeupdate", cutsceneTimeListener);
  }
  
  cutsceneTimeListener = () => {
    if (video.currentTime >= 1.0 && video.paused === false && tutorialState === 0) {
      video.pause();
      video.currentTime = 1.0;
      showCutsceneUI();
    }
  };
  video.addEventListener("timeupdate", cutsceneTimeListener);
  
  function showCutsceneUI() {
    if (title) title.classList.add("visible");
    if (chooseBtn) chooseBtn.classList.add("visible");
    updateNavButtons();
  }
  
  function updateNavButtons() {
    if (tutorialState === 0) {
      if (prevBtn) { prevBtn.classList.remove("visible"); prevBtn.disabled = true; }
      if (nextBtn) { nextBtn.classList.add("visible"); nextBtn.disabled = false; }
    } else if (tutorialState === 1) {
      if (prevBtn) { prevBtn.classList.add("visible"); prevBtn.disabled = false; }
      if (nextBtn) { nextBtn.classList.add("visible"); nextBtn.disabled = false; }
    } else if (tutorialState === 2) {
      if (prevBtn) { prevBtn.classList.add("visible"); prevBtn.disabled = false; }
      if (nextBtn) { nextBtn.classList.remove("visible"); nextBtn.disabled = true; }
    }
  }
  
  if (prevBtn && nextBtn && chooseBtn) {
    const newPrev = prevBtn.cloneNode(true);
    const newNext = nextBtn.cloneNode(true);
    const newChoose = chooseBtn.cloneNode(true);
    
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);
    chooseBtn.parentNode.replaceChild(newChoose, chooseBtn);
    
    newPrev.addEventListener("click", () => {
      if (tutorialState > 0) {
        tutorialState--;
        video.currentTime = tutorialState === 0 ? 1.0 : 2.0;
        updateNavButtons();
      }
    });
    
    newNext.addEventListener("click", () => {
      if (tutorialState < 2) {
        tutorialState++;
        video.currentTime = tutorialState === 1 ? 2.0 : 3.0;
        updateNavButtons();
      }
    });
    
    newChoose.addEventListener("click", () => {
      selectedCharacter = characterKeys[tutorialState];
      previewCharacter = selectedCharacter;
      localStorage.setItem("equipped_character", selectedCharacter);
      
      syncCharacterSelectPreview(selectedCharacter);
      syncLobbySpotlightVideo(selectedCharacter);
      syncSquadLobbyVideo(selectedCharacter);
      syncSquadLobbyInterface();
      
      localStorage.setItem("tutorial_status", "vs_screen");
      
      video.pause();
      if (cutsceneTimeListener) {
        video.removeEventListener("timeupdate", cutsceneTimeListener);
        cutsceneTimeListener = null;
      }
      
      startUsernameIntroFlowAfterCutscene();
    });
  }
}

function startUsernameIntroFlowAfterCutscene() {
  switchScreen(introScreen);
  if (usernameForm) usernameForm.classList.add("hidden");

  const chosenGuide = selectedCharacter || "chiikawa";
  const guideImg = document.querySelector(".intro-guide-character");
  if (guideImg) {
    guideImg.src = `assets/cards/${chosenGuide.toLowerCase()}.png`;
  }

  const welcomeMessage = `Hello there! I am ${characterStyle[chosenGuide]?.label || chosenGuide}, your starter character. Welcome to Chiikawa Royale! Let's choose a cool username for you so we can start matching with friends online!`;
  
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
        if (usernameForm) {
          usernameForm.classList.remove("hidden");
          usernameForm.style.opacity = "0";
          setTimeout(() => {
            usernameForm.style.transition = "opacity 0.5s ease";
            usernameForm.style.opacity = "1";
          }, 50);
        }
      }
    }, 35);
  }
}

function startTutorialLocalMatch() {
  const playerName = (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "You";
  showVsLoadingScreen([
    { id: "local_player", name: playerName, kind: selectedCharacter },
    { id: "cpu_1", name: "Usagi CPU", kind: "usagi" },
    { id: "cpu_2", name: "Momonga CPU", kind: "momonga" },
    { id: "cpu_3", name: "Chiikawa CPU", kind: "chiikawa" },
  ], () => {
    window.tutorialGuideActive = true;
    window.tutorialGuidePaused = false;
    window.tutorialGuideStep = 0;
    startLocalGame();
  }, 4000);
}

function showTutorialGuideStep(step) {
  window.tutorialGuideStep = step;
  window.tutorialGuidePaused = true;
  
  const overlay = document.getElementById("tutorialGuideOverlay");
  const textEl = document.getElementById("tutorialGuideText");
  const avatarEl = document.getElementById("tutorialGuideAvatar");
  
  if (!overlay || !textEl) return;
  
  if (avatarEl) {
    avatarEl.src = `assets/cards/${selectedCharacter}.png`;
  }
  
  if (step === 0) {
    textEl.innerHTML = "Welcome to the battlefield! Use <strong>WASD</strong> or <strong>ARROW KEYS</strong> to move your character. Avoid standing near explosive bombs! Click OKAY to begin.";
  } else if (step === 1) {
    textEl.innerHTML = "Press <strong>SPACEBAR</strong> to place a bomb! You can use bombs to destroy wooden crates and find power-up items. Be sure to run away to safety before the bomb explodes!";
  } else if (step === 2) {
    textEl.innerHTML = "Awesome! Items like speed boots, extra bombs, and fire potions will make you stronger. Defeat all CPU players to win the match!";
  }
  
  overlay.classList.add("active");
  overlay.classList.remove("hidden");
}

document.getElementById("tutorialGuideOkBtn")?.addEventListener("click", () => {
  const overlay = document.getElementById("tutorialGuideOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.classList.add("hidden");
  }
  
  window.tutorialGuidePaused = false;
  keys.clear(); // Clear any pressed key queues
  
  if (window.tutorialGuideStep === 0) {
    setTimeout(() => {
      if (window.tutorialGuideActive && running) {
        showTutorialGuideStep(1);
      }
    }, 3000);
  } else if (window.tutorialGuideStep === 1) {
    setTimeout(() => {
      if (window.tutorialGuideActive && running) {
        showTutorialGuideStep(2);
      }
    }, 7000);
  } else if (window.tutorialGuideStep === 2) {
    window.tutorialGuideStep = 3;
  }
});

function addLobbyPulseOverlay(element) {
  removeLobbyPulseOverlay();
  const pulse = document.createElement("div");
  pulse.className = "menu-guide-pulse-overlay";
  element.style.position = "relative";
  element.appendChild(pulse);
}

function removeLobbyPulseOverlay() {
  const existing = document.querySelectorAll(".menu-guide-pulse-overlay");
  existing.forEach(el => el.remove());
}

function checkMenuTutorialGuide() {
  const status = localStorage.getItem("tutorial_status");
  if (status !== "tutorial_match_completed") {
    const guideEl = document.getElementById("menuTutorialGuide");
    if (guideEl) guideEl.classList.remove("active");
    removeLobbyPulseOverlay();
    return;
  }
  
  const guideEl = document.getElementById("menuTutorialGuide");
  const textEl = document.getElementById("menuTutorialGuideText");
  const avatarEl = document.getElementById("menuTutorialGuideAvatar");
  
  if (guideEl && textEl) {
    if (avatarEl) {
      avatarEl.src = `assets/cards/${selectedCharacter}.png`;
    }
    textEl.innerHTML = "Great job completing your training match! Now let's try an <strong>Online Multiplayer Match</strong> to battle against other players!";
    guideEl.classList.add("active");
  }
  
  const selectBtn = document.getElementById("btnOpenGamemodesPopup");
  if (selectBtn) {
    addLobbyPulseOverlay(selectBtn);
  }
}

// Hook gamemodes popup listeners for tutorial flow
const _origOpenGamemodesPopup = openGamemodesPopup;
openGamemodesPopup = function() {
  _origOpenGamemodesPopup();
  const status = localStorage.getItem("tutorial_status");
  if (status === "tutorial_match_completed") {
    const textEl = document.getElementById("menuTutorialGuideText");
    if (textEl) {
      textEl.innerHTML = "Great! Now select <strong>Multiplayer Match</strong> to find other players online!";
    }
    removeLobbyPulseOverlay();
    const multiBtn = document.getElementById("btnPlayOnlineMultiplayer");
    if (multiBtn) {
      addLobbyPulseOverlay(multiBtn);
    }
  }
};

const _origCloseGamemodesPopup = closeGamemodesPopup;
closeGamemodesPopup = function() {
  _origCloseGamemodesPopup();
  const status = localStorage.getItem("tutorial_status");
  if (status === "tutorial_match_completed") {
    const textEl = document.getElementById("menuTutorialGuideText");
    if (textEl) {
      textEl.innerHTML = "Great job completing your training match! Now let's try an <strong>Online Multiplayer Match</strong> to battle against other players!";
    }
    removeLobbyPulseOverlay();
    const selectBtn = document.getElementById("btnOpenGamemodesPopup");
    if (selectBtn) {
      addLobbyPulseOverlay(selectBtn);
    }
  }
};

// Hook Multiplayer Match selection to complete the tutorial
document.getElementById("btnPlayOnlineMultiplayer")?.addEventListener("click", () => {
  const status = localStorage.getItem("tutorial_status");
  if (status === "tutorial_match_completed") {
    localStorage.setItem("tutorial_status", "online_match_guided");
    const guideEl = document.getElementById("menuTutorialGuide");
    if (guideEl) guideEl.classList.remove("active");
    removeLobbyPulseOverlay();
  }
});
