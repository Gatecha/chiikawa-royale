(function () {
  /* ==========================================================================
     CORE CONFIG & STATE SYSTEM
     ========================================================================== */
  
  // Active Character State for Squad Section
  let activeChar = "chiikawa";
  
  // Database of Squad Characters
  const charactersData = {
    chiikawa: {
      role: "Starter",
      name: "Chiikawa",
      quote: '"Small, brave, and full of heart!"',
      bio: "Small, brave, and quick to weave through tight lanes for critical item pick-ups. Ideal for sneaky, defensive tactics!",
      themeColor: "#ffd214",
      skills: [
        { icon: "🛡️", name: "Dash Shield", desc: "Creates a brief bubble to block bomb explosions." },
        { icon: "🍬", name: "Sweet Candy", desc: "Gains speed buffs from picking up candies." }
      ],
      img: "assets/cards/chiikawa.png"
    },
    hachiware: {
      role: "Balanced",
      name: "Hachiware",
      quote: '"Calculated, calm, and tactical!"',
      bio: "Calculated and calm, great for executing clean tactical bomb placements, kicked bombs, and swift escapes.",
      themeColor: "#3ea6ff",
      skills: [
        { icon: "👟", name: "Bomb Kick", desc: "Kicks placed bombs away in a straight line." },
        { icon: "🍀", name: "Lucky Charm", desc: "Has a small chance to survive a blast with 1 HP." }
      ],
      img: "assets/cards/hachiware.png"
    },
    usagi: {
      role: "Speedster",
      name: "Usagi",
      quote: '"Yaha! Ura! Fast and chaotic!"',
      bio: "Loud, hyper-energetic, and incredibly fast. Built for players who love rushing tiles and cornering opponents.",
      themeColor: "#ff6097",
      skills: [
        { icon: "🐰", name: "Super Jump", desc: "Jumps over a crate or single-tile wall block." },
        { icon: "💥", name: "Mad Laugh", desc: "Instantly increases placed bomb range for 3 seconds." }
      ],
      img: "assets/cards/usagi.png"
    },
    momonga: {
      role: "Trickster",
      name: "Momonga",
      quote: '"Slippery and cute, but dangerous!"',
      bio: "Slippery movement styles make it easy to dodge explosions, sneak up on rivals, and swap places with bombs.",
      themeColor: "#ac5cff",
      skills: [
        { icon: "🌀", name: "Teleport Swap", desc: "Swaps positions with your last active bomb." },
        { icon: "🎀", name: "Cute Charm", desc: "Briefly slows down nearby rivals on activation." }
      ],
      img: "assets/cards/momonga.png"
    }
  };

  /* ==========================================================================
     WEB AUDIO SYNTHESIZER (RETRO GAME SOUND EFFECTS)
     ========================================================================== */
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSynthNotes(notes) {
    try {
      initAudio();
      let time = audioCtx.currentTime;
      notes.forEach(note => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = note.type || 'sine';
        osc.frequency.setValueAtTime(note.freq, time);
        
        gain.gain.setValueAtTime(note.volume || 0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + note.duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(time);
        osc.stop(time + note.duration);
        
        time += note.delay || 0;
      });
    } catch (e) {
      console.warn("Audio play blocked or unsupported:", e);
    }
  }

  // Synthesized Sound Triggers
  function soundWalk() {
    playSynthNotes([{ freq: 160, duration: 0.08, type: 'triangle', volume: 0.04 }]);
  }

  function soundPlaceBomb() {
    playSynthNotes([{ freq: 380, duration: 0.15, type: 'sine', volume: 0.08 }]);
  }

  function soundExplode() {
    // Low frequency rumble to simulate boom
    playSynthNotes([
      { freq: 80, duration: 0.35, type: 'sawtooth', volume: 0.2 },
      { freq: 120, duration: 0.25, type: 'triangle', volume: 0.1, delay: 0.05 }
    ]);
  }

  function soundGrabItem() {
    // Cute 8-bit chime arpeggio
    playSynthNotes([
      { freq: 523.25, duration: 0.1, type: 'sine', volume: 0.07 },
      { freq: 659.25, duration: 0.08, type: 'sine', volume: 0.07, delay: 0.05 },
      { freq: 783.99, duration: 0.2, type: 'sine', volume: 0.07, delay: 0.05 }
    ]);
  }

  function soundError() {
    playSynthNotes([{ freq: 120, duration: 0.25, type: 'sawtooth', volume: 0.05 }]);
  }

  function soundGameOver() {
    playSynthNotes([
      { freq: 300, duration: 0.15, type: 'sawtooth', volume: 0.08 },
      { freq: 220, duration: 0.2, type: 'sawtooth', volume: 0.08, delay: 0.1 },
      { freq: 150, duration: 0.4, type: 'sawtooth', volume: 0.08, delay: 0.15 }
    ]);
  }

  function playCharSound(char) {
    if (char === "chiikawa") {
      // High cute chirpy melody
      playSynthNotes([
        { freq: 659.25, duration: 0.08, type: 'sine', volume: 0.06 },
        { freq: 783.99, duration: 0.12, type: 'sine', volume: 0.06, delay: 0.04 }
      ]);
    } else if (char === "hachiware") {
      // Warm major chime
      playSynthNotes([
        { freq: 523.25, duration: 0.1, type: 'sine', volume: 0.06 },
        { freq: 659.25, duration: 0.15, type: 'sine', volume: 0.06, delay: 0.06 }
      ]);
    } else if (char === "usagi") {
      // Fast pitch bounce
      playSynthNotes([
        { freq: 783.99, duration: 0.06, type: 'sine', volume: 0.06 },
        { freq: 1046.50, duration: 0.15, type: 'sine', volume: 0.06, delay: 0.03 }
      ]);
    } else if (char === "momonga") {
      // Mystic scale arpeggio
      playSynthNotes([
        { freq: 440.00, duration: 0.08, type: 'sine', volume: 0.06 },
        { freq: 554.37, duration: 0.08, type: 'sine', volume: 0.06, delay: 0.04 },
        { freq: 659.25, duration: 0.18, type: 'sine', volume: 0.06, delay: 0.04 }
      ]);
    }
  }

  /* ==========================================================================
     SNAP SCROLL & SIDEBAR NAVIGATION OBSERVER
     ========================================================================== */
  const sections = document.querySelectorAll(".section");
  const navLinks = document.querySelectorAll(".nav-link");
  const snapContainer = document.querySelector(".snap-container");

  // Track scrolling snapping points to update state
  const obsOptions = {
    root: snapContainer,
    threshold: 0.45
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Toggle entry animations
        entry.target.classList.add("active");
        
        // Update nav links highlights
        const activeId = entry.target.getAttribute("id");
        navLinks.forEach((link) => {
          if (link.getAttribute("data-sec") === activeId) {
            link.classList.add("active");
          } else {
            link.classList.remove("active");
          }
        });
      }
    });
  }, obsOptions);

  sections.forEach((sec) => observer.observe(sec));

  // Click handler for smooth navigation
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      initAudio(); // Warm up audio context on click
      
      const targetId = link.getAttribute("href");
      const targetSec = document.querySelector(targetId);
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  /* ==========================================================================
     HOME PAGE: REGISTRATION LIVE COUNTER
     ========================================================================== */
  let regCount = 1248506;
  const regCounterEl = document.getElementById("reg-counter");
  
  if (regCounterEl) {
    setInterval(() => {
      regCount += Math.floor(Math.random() * 3) + 1;
      regCounterEl.textContent = regCount.toLocaleString();
    }, 2500);
  }

  /* ==========================================================================
     SQUAD SECTION: DYNAMIC CHARACTER SELECTOR & TRANSITIONS
     ========================================================================== */
  const selectorTabs = document.querySelectorAll(".selector-tab");
  const charPortrait = document.getElementById("char-portrait");
  const charCard = document.querySelector(".char-details-card");
  const charBgBlock = document.getElementById("char-bg-block");

  selectorTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const charName = tab.getAttribute("data-char");
      if (charName === activeChar) return;

      // Update selector tabs active class
      selectorTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Trigger exit animations
      charPortrait.classList.remove("active");
      charCard.style.opacity = "0";
      charCard.style.transform = "translateX(-20px)";
      charBgBlock.style.transform = "scale(0.8) rotate(0deg)";

      setTimeout(() => {
        // Fetch new data
        const data = charactersData[charName];
        activeChar = charName;

        // Populate card details
        document.getElementById("char-role").textContent = data.role;
        document.getElementById("char-name").textContent = data.name;
        document.getElementById("char-quote").textContent = data.quote;
        document.getElementById("char-bio").textContent = data.bio;

        // Custom style role pill
        const rolePill = document.getElementById("char-role");
        rolePill.style.background = data.themeColor;

        // Populate Skills
        document.getElementById("skill-icon-1").textContent = data.skills[0].icon;
        document.getElementById("skill-name-1").textContent = data.skills[0].name;
        document.getElementById("skill-desc-1").textContent = data.skills[0].desc;

        document.getElementById("skill-icon-2").textContent = data.skills[1].icon;
        document.getElementById("skill-name-2").textContent = data.skills[1].name;
        document.getElementById("skill-desc-2").textContent = data.skills[1].desc;

        // Swap portrait src & background colors
        charPortrait.src = data.img;
        charBgBlock.style.backgroundColor = data.themeColor;

        // Trigger entry animations
        setTimeout(() => {
          charPortrait.classList.add("active");
          charCard.style.opacity = "1";
          charCard.style.transform = "translateX(0)";
          charBgBlock.style.transform = "scale(1) rotate(-15deg)";
        }, 50);

        // Play character chime sound
        playCharSound(charName);

      }, 250);
    });
  });

  /* ==========================================================================
     ARENA SECTION: INTERACTIVE GAME ENGINE
     ========================================================================== */
  
  // Game Map Matrix
  // 0: Floor, 1: Wall (Indestructible), 2: Crate (Destructible), 
  // 6: Fire Up Item, 7: Bomb Up Item, 8: Speed Up Item
  let mapData = [];
  const mapRows = 6;
  const mapCols = 9;

  // Player Game States (Hachiware is the playable hero)
  let playerRow = 3;
  let playerCol = 4;
  let playerMaxBombs = 2;
  let playerBombsPlaced = 0;
  let playerFireRange = 2;
  let playerSpeed = "NORMAL"; // NORMAL, BOOSTED
  let isMoving = false;
  let playerHP = 1;

  // Active Bombs list
  let activeBombs = [];
  // Active blast zones
  let blastZones = new Set();

  function initMap() {
    mapData = [
      [1, 0, 2, 2, 1, 2, 2, 0, 1],
      [0, 2, 0, 0, 2, 0, 0, 2, 0],
      [2, 0, 1, 2, 0, 2, 1, 0, 2],
      [2, 0, 1, 0, 0, 0, 1, 0, 2], // row 3, col 4 is player starting area
      [0, 2, 0, 0, 2, 0, 0, 2, 0],
      [1, 0, 2, 2, 1, 2, 2, 0, 1]
    ];
    playerRow = 3;
    playerCol = 4;
    playerMaxBombs = 2;
    playerBombsPlaced = 0;
    playerFireRange = 2;
    playerSpeed = "NORMAL";
    playerHP = 1;
    activeBombs = [];
    blastZones.clear();
    isMoving = false;
  }

  // Draw board grid
  const boardEl = document.getElementById("interactive-board");

  function renderBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = "";

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const cellType = mapData[r][c];
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Apply grid classes
        if (cellType === 1) {
          cell.classList.add("cell-wall");
          cell.textContent = "🧱";
        } else if (cellType === 2) {
          cell.classList.add("cell-crate");
          cell.textContent = "📦";
        } else {
          cell.classList.add("cell-floor");
        }

        // Apply fire blast styling
        const key = `${r},${c}`;
        if (blastZones.has(key)) {
          cell.classList.add("cell-fire");
          cell.textContent = "🔥";
        }

        // Render placed bomb
        const activeBomb = activeBombs.find((b) => b.row === r && b.col === c);
        if (activeBomb && !blastZones.has(key)) {
          const bombToken = document.createElement("div");
          bombToken.classList.add("bomb-token");
          bombToken.textContent = "💣";
          cell.appendChild(bombToken);
        }

        // Render player (Hachiware) if coords match
        if (r === playerRow && c === playerCol && playerHP > 0) {
          const playerToken = document.createElement("div");
          playerToken.classList.add("player-token");
          playerToken.style.backgroundImage = "url('assets/cards/hachiware.png')";
          cell.appendChild(playerToken);
        }

        // Render floating powerup items
        if (cellType === 6 && !blastZones.has(key)) {
          const item = document.createElement("div");
          item.classList.add("item-token");
          item.textContent = "🔥";
          cell.appendChild(item);
        } else if (cellType === 7 && !blastZones.has(key)) {
          const item = document.createElement("div");
          item.classList.add("item-token");
          item.textContent = "💣";
          cell.appendChild(item);
        } else if (cellType === 8 && !blastZones.has(key)) {
          const item = document.createElement("div");
          item.classList.add("item-token");
          item.textContent = "👟";
          cell.appendChild(item);
        }

        // Add Click interactions to cells
        cell.addEventListener("click", () => handleCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }

    updateDashboard();
  }

  // Update game statistics panel
  function updateDashboard() {
    const hpEl = document.getElementById("game-hp");
    const bombsEl = document.getElementById("game-bombs");
    const fireEl = document.getElementById("game-fire");
    const speedEl = document.getElementById("game-speed");

    if (hpEl) hpEl.textContent = playerHP > 0 ? "1 / 1" : "☠️ ELIMINATED";
    if (bombsEl) bombsEl.textContent = `${playerMaxBombs - playerBombsPlaced} / ${playerMaxBombs}`;
    if (fireEl) fireEl.textContent = `${playerFireRange} Tiles`;
    if (speedEl) speedEl.textContent = playerSpeed;
  }

  // BFS Pathfinding (Moves player character along floor tiles)
  function findShortestPath(startR, startC, endR, endC) {
    const queue = [[startR, startC, []]];
    const visited = new Set();
    visited.add(`${startR},${startC}`);

    while (queue.length > 0) {
      const [r, c, path] = queue.shift();
      if (r === endR && c === endC) return path;

      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= 0 && nr < mapRows && nc >= 0 && nc < mapCols) {
          // Walkable if it's floor (0) or items (6, 7, 8). Avoid walls (1), crates (2) & active bombs
          const cellType = mapData[nr][nc];
          const hasBomb = activeBombs.some((b) => b.row === nr && b.col === nc);
          const isWalkable = (cellType === 0 || cellType >= 6) && !hasBomb;

          if (isWalkable) {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
              visited.add(key);
              queue.push([nr, nc, [...path, [nr, nc]]]);
            }
          }
        }
      }
    }
    return null;
  }

  // Handle cell movements or bomb drop on player click
  function handleCellClick(targetR, targetC) {
    if (playerHP <= 0 || isMoving) return;
    initAudio(); // Initialize audio context on click

    // If player clicked on their own space, place a bomb!
    if (targetR === playerRow && targetC === playerCol) {
      placeBomb();
      return;
    }

    const path = findShortestPath(playerRow, playerCol, targetR, targetC);
    if (!path || path.length === 0) {
      soundError();
      return;
    }

    // Execute walk action step-by-step
    isMoving = true;
    let stepIndex = 0;
    const stepInterval = playerSpeed === "BOOSTED" ? 130 : 200;

    function walkStep() {
      if (stepIndex >= path.length || playerHP <= 0) {
        isMoving = false;
        return;
      }

      const [nextR, nextC] = path[stepIndex];
      playerRow = nextR;
      playerCol = nextC;
      stepIndex++;

      // Check for item collisions
      const tileType = mapData[playerRow][playerCol];
      if (tileType >= 6) {
        soundGrabItem();
        if (tileType === 6) {
          playerFireRange++;
        } else if (tileType === 7) {
          playerMaxBombs++;
        } else if (tileType === 8) {
          playerSpeed = "BOOSTED";
        }
        mapData[playerRow][playerCol] = 0; // Clear item from map
      } else {
        soundWalk();
      }

      // Check if player walked into an active blast zone
      const key = `${playerRow},${playerCol}`;
      if (blastZones.has(key)) {
        eliminatePlayer();
      }

      renderBoard();
      setTimeout(walkStep, stepInterval);
    }

    walkStep();
  }

  // Drop Bomb Function
  function placeBomb() {
    if (playerHP <= 0 || playerBombsPlaced >= playerMaxBombs) {
      soundError();
      return;
    }

    // Prevent placing bomb on top of another bomb
    const alreadyHasBomb = activeBombs.some((b) => b.row === playerRow && b.col === playerCol);
    if (alreadyHasBomb) return;

    soundPlaceBomb();
    
    const bomb = {
      row: playerRow,
      col: playerCol,
      range: playerFireRange,
      fuseTimer: null
    };

    activeBombs.push(bomb);
    playerBombsPlaced++;
    renderBoard();

    // Trigger fuse timer (1.5 seconds)
    bomb.fuseTimer = setTimeout(() => {
      explodeBomb(bomb);
    }, 1500);
  }

  // Explode Bomb Function
  function explodeBomb(bomb) {
    // Remove bomb from active list
    activeBombs = activeBombs.filter((b) => b !== bomb);
    playerBombsPlaced = Math.max(0, playerBombsPlaced - 1);
    soundExplode();

    const affectedCells = [[bomb.row, bomb.col]]; // Bomb center
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    directions.forEach(([dr, dc]) => {
      for (let i = 1; i <= bomb.range; i++) {
        const checkR = bomb.row + dr * i;
        const checkC = bomb.col + dc * i;

        // Check grid boundary limits
        if (checkR < 0 || checkR >= mapRows || checkC < 0 || checkC >= mapCols) break;

        const tile = mapData[checkR][checkC];
        if (tile === 1) break; // Walls stop blasts completely

        affectedCells.push([checkR, checkC]);

        if (tile === 2) {
          // Destructible crates stop the blast from moving further
          break;
        }
      }
    });

    // Populate active blast zones
    affectedCells.forEach(([r, c]) => {
      const key = `${r},${c}`;
      blastZones.add(key);

      // Handle item pickups and crate destruction
      const tile = mapData[r][c];
      if (tile === 2) {
        // Crate is destroyed. Spawn random item with 40% probability
        if (Math.random() < 0.45) {
          const rand = Math.random();
          if (rand < 0.33) {
            mapData[r][c] = 6; // Fire Up
          } else if (rand < 0.66) {
            mapData[r][c] = 7; // Bomb Up
          } else {
            mapData[r][c] = 8; // Speed Up
          }
        } else {
          mapData[r][c] = 0; // Empty floor
        }
      } else if (tile >= 6) {
        // Items in blast zones are destroyed
        mapData[r][c] = 0;
      }

      // Check if Player is hit by the explosion blast
      if (r === playerRow && c === playerCol) {
        eliminatePlayer();
      }
    });

    renderBoard();

    // Clear blast flame effects after 500ms
    setTimeout(() => {
      affectedCells.forEach(([r, c]) => {
        const key = `${r},${c}`;
        blastZones.delete(key);
      });
      renderBoard();
    }, 500);
  }

  function eliminatePlayer() {
    playerHP = 0;
    soundGameOver();
    updateDashboard();
    
    // Auto-restart game after 1.8 seconds
    setTimeout(() => {
      resetGame();
    }, 1800);
  }

  function resetGame() {
    initMap();
    renderBoard();
  }

  /* ==========================================================================
     PAGE MOUNT INITIALIZATION
     ========================================================================== */
  
  // Attach DOM Listeners on Load
  const placeBombBtn = document.getElementById("place-bomb-btn");
  const resetGameBtn = document.getElementById("reset-game-btn");

  if (placeBombBtn) {
    placeBombBtn.addEventListener("click", () => {
      initAudio();
      placeBomb();
    });
  }

  if (resetGameBtn) {
    resetGameBtn.addEventListener("click", () => {
      initAudio();
      resetGame();
    });
  }

  // Initialize Game Map
  resetGame();

  // Pulse animation and micro-interactions on cta buttons
  document.querySelectorAll(".cta-action, .dl-btn").forEach((btn) => {
    btn.addEventListener("mousedown", () => {
      initAudio();
    });
  });

}());
