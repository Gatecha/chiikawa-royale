(function () {
  /* ==========================================================================
     CORE CONFIG & STATE SYSTEM
     ========================================================================== */
  
  // Active Character State for Squad Section
  let activeChar = "chiikawa";
  
  // Database of Squad Characters with Wardrobe Animation Videos (High Resolution)
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
      video: "assets/chiikawa/chiikawa_character_animation_high.mp4"
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
      video: "hachiware-lobby_high.mp4"
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
      video: "assets/usagi/usagi_character_animation_high.mp4"
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
      video: "assets/momonga/momonga_character_animation_high.mp4"
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
    playSynthNotes([
      { freq: 80, duration: 0.35, type: 'sawtooth', volume: 0.2 },
      { freq: 120, duration: 0.25, type: 'triangle', volume: 0.1, delay: 0.05 }
    ]);
  }

  function soundGrabItem() {
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
      playSynthNotes([
        { freq: 659.25, duration: 0.08, type: 'sine', volume: 0.06 },
        { freq: 783.99, duration: 0.12, type: 'sine', volume: 0.06, delay: 0.04 }
      ]);
    } else if (char === "hachiware") {
      playSynthNotes([
        { freq: 523.25, duration: 0.1, type: 'sine', volume: 0.06 },
        { freq: 659.25, duration: 0.15, type: 'sine', volume: 0.06, delay: 0.06 }
      ]);
    } else if (char === "usagi") {
      playSynthNotes([
        { freq: 783.99, duration: 0.06, type: 'sine', volume: 0.06 },
        { freq: 1046.50, duration: 0.15, type: 'sine', volume: 0.06, delay: 0.03 }
      ]);
    } else if (char === "momonga") {
      playSynthNotes([
        { freq: 440.00, duration: 0.08, type: 'sine', volume: 0.06 },
        { freq: 554.37, duration: 0.08, type: 'sine', volume: 0.06, delay: 0.04 },
        { freq: 659.25, duration: 0.18, type: 'sine', volume: 0.06, delay: 0.04 }
      ]);
    }
  }

  /* ==========================================================================
     LOBBY-STYLE SHUTTER SECTION TRANSITION & OBSERVATION
     ========================================================================== */
  const sections = document.querySelectorAll(".section");
  const navLinks = document.querySelectorAll(".nav-link");
  const snapContainer = document.querySelector(".snap-container");
  const transitionShutter = document.getElementById("transition-shutter");

  const obsOptions = {
    root: snapContainer,
    threshold: 0.45
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        
        const activeId = entry.target.getAttribute("id");
        navLinks.forEach((link) => {
          if (link.getAttribute("data-sec") === activeId) {
            link.classList.add("active");
          } else {
            link.classList.remove("active");
          }
        });

        // Start/Stop arena bots interval to save CPU when scrolled away
        if (activeId === "arena") {
          startBotLoop();
        } else {
          stopBotLoop();
        }
      }
    });
  }, obsOptions);

  sections.forEach((sec) => observer.observe(sec));

  // Shutter Curtain transition logic
  function triggerShutterTransition(targetId) {
    if (!transitionShutter) {
      // Fallback scroll
      const targetSec = document.querySelector(targetId);
      if (targetSec) targetSec.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Play curtain closing swoop noise
    playSynthNotes([
      { freq: 300, duration: 0.15, type: 'sawtooth', volume: 0.06 },
      { freq: 150, duration: 0.25, type: 'sawtooth', volume: 0.06, delay: 0.05 }
    ]);

    transitionShutter.classList.add("shutter-active");

    setTimeout(() => {
      // Scroll instantly underneath the shutter curtain
      const targetSec = document.querySelector(targetId);
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: "auto" });
      }

      setTimeout(() => {
        transitionShutter.classList.remove("shutter-active");
        
        // Play curtain opening swoosh
        playSynthNotes([
          { freq: 150, duration: 0.12, type: 'sawtooth', volume: 0.06 },
          { freq: 350, duration: 0.18, type: 'sawtooth', volume: 0.06, delay: 0.04 }
        ]);
      }, 150);
    }, 400); // 400ms is the shutter speed transition
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      initAudio();
      
      const targetId = link.getAttribute("href");
      triggerShutterTransition(targetId);
    });
  });

  /* ==========================================================================
     HOME PAGE: TOTAL DOWNLOADS COUNTER (TICKING ACTIVE DOWNLOADS)
     ========================================================================== */
  let regCount = 1248604;
  const regCounterEl = document.getElementById("reg-counter");
  
  if (regCounterEl) {
    regCounterEl.textContent = regCount.toLocaleString();
    setInterval(() => {
      // Simulate live ticking downloads
      regCount += Math.floor(Math.random() * 2) + 1;
      regCounterEl.textContent = regCount.toLocaleString();
    }, 2000);
  }

  /* ==========================================================================
     SQUAD SECTION: DYNAMIC CHROMA-KEY VIDEO TRANSITIONS (HIGH RES)
     ========================================================================== */
  const selectorTabs = document.querySelectorAll(".selector-tab");
  const charCanvas = document.getElementById("char-canvas");
  const charVideo = document.getElementById("char-video");
  const charCard = document.querySelector(".char-details-card");
  const charBgBlock = document.getElementById("char-bg-block");
  let ctx = charCanvas ? charCanvas.getContext("2d", { willReadFrequently: true }) : null;
  let chromaLoopId = null;

  // Greenscreen Keying logic (Chroma Key)
  function keyGreenPixels(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      
      const greenDominance = green - Math.max(red, blue);
      const isGreenScreen = green > 70 && greenDominance > 22 && green > red * 1.15 && green > blue * 1.1;

      if (isGreenScreen) {
        // Blend edge softness
        const softness = Math.min(255, Math.max(0, (greenDominance - 15) * 8));
        data[i + 3] = 255 - softness;
      } else if (greenDominance > 8 && green > 65) {
        // De-saturate green fringe
        data[i + 1] = Math.max(0, green - greenDominance * 0.5);
      }
    }
    return imageData;
  }

  // Chroma Canvas Draw loop
  function startChromaVideo(videoUrl) {
    if (!charCanvas || !charVideo || !ctx) return;

    if (chromaLoopId) {
      cancelAnimationFrame(chromaLoopId);
      chromaLoopId = null;
    }

    charVideo.src = videoUrl;
    charVideo.load();
    
    charVideo.play().catch(err => {
      console.warn("Autoplay blocked or video loading error:", err);
    });

    function drawChromaFrame() {
      if (charVideo.paused || charVideo.ended) {
        chromaLoopId = requestAnimationFrame(drawChromaFrame);
        return;
      }

      // Draw high resolution internal canvas size (800x800) for sharp crisp display
      const w = charCanvas.width;
      const h = charCanvas.height;

      ctx.clearRect(0, 0, w, h);

      const sW = charVideo.videoWidth || w;
      const sH = charVideo.videoHeight || h;
      
      // Scale up video to fit canvas frame
      const scale = Math.max(w / sW, h / sH);
      const dW = sW * scale;
      const dH = sH * scale;
      const dx = (w - dW) / 2;
      const dy = (h - dH) / 2;

      ctx.drawImage(charVideo, dx, dy, dW, dH);

      try {
        const imgData = ctx.getImageData(0, 0, w, h);
        const keyed = keyGreenPixels(imgData);
        ctx.putImageData(keyed, 0, 0);
      } catch (err) {
        // Ignore cross-origin error in file:// schemes
      }

      chromaLoopId = requestAnimationFrame(drawChromaFrame);
    }

    charVideo.onloadeddata = () => {
      drawChromaFrame();
    };

    if (charVideo.readyState >= 2) {
      drawChromaFrame();
    }
  }

  selectorTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const charName = tab.getAttribute("data-char");
      if (charName === activeChar) return;

      selectorTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Trigger exit animations
      charCanvas.classList.remove("active");
      charCard.style.opacity = "0";
      charCard.style.transform = "translateX(-20px)";
      charBgBlock.style.transform = "scale(0.8) rotate(0deg)";

      setTimeout(() => {
        const data = charactersData[charName];
        activeChar = charName;

        // Swapping details text
        document.getElementById("char-role").textContent = data.role;
        document.getElementById("char-name").textContent = data.name;
        document.getElementById("char-quote").textContent = data.quote;
        document.getElementById("char-bio").textContent = data.bio;

        const rolePill = document.getElementById("char-role");
        rolePill.style.background = data.themeColor;

        // Swapping Skills
        document.getElementById("skill-icon-1").textContent = data.skills[0].icon;
        document.getElementById("skill-name-1").textContent = data.skills[0].name;
        document.getElementById("skill-desc-1").textContent = data.skills[0].desc;

        document.getElementById("skill-icon-2").textContent = data.skills[1].icon;
        document.getElementById("skill-name-2").textContent = data.skills[1].name;
        document.getElementById("skill-desc-2").textContent = data.skills[1].desc;

        // Start playing the high-res chroma video
        startChromaVideo(data.video);
        charBgBlock.style.backgroundColor = data.themeColor;

        // Trigger entry animations
        setTimeout(() => {
          charCanvas.classList.add("active");
          charCard.style.opacity = "1";
          charCard.style.transform = "translateX(0)";
          charBgBlock.style.transform = "scale(1) rotate(-15deg)";
        }, 50);

        playCharSound(charName);

      }, 250);
    });
  });

  // Load Chiikawa video on initial mount
  startChromaVideo(charactersData.chiikawa.video);

  /* ==========================================================================
     ARENA SECTION: ACCURATE 15x13 CHECKERED GRID BATTLE SIMULATOR (WITH BOTS)
     ========================================================================== */
  
  let mapData = [];
  const mapRows = 13;
  const mapCols = 15;

  // Player States (Hachiware is the player controlled sprite)
  let playerRow = 1;
  let playerCol = 1;
  let playerMaxBombs = 2;
  let playerBombsPlaced = 0;
  let playerFireRange = 2;
  let playerSpeed = "NORMAL";
  let isMoving = false;
  let playerHP = 1;

  // CPU Bots list
  let bots = [];
  let activeBombs = [];
  let blastZones = new Set();
  let botIntervalId = null;

  // Initialize Bomberman layout: border walls, alternate grid wall blocks, corners clear
  function initMap() {
    mapData = [];
    for (let r = 0; r < mapRows; r++) {
      let row = [];
      for (let c = 0; c < mapCols; c++) {
        if (r === 0 || r === mapRows - 1 || c === 0 || c === mapCols - 1) {
          row.push(1); // indestructible border walls
        } else if (r % 2 === 0 && c % 2 === 0) {
          row.push(1); // internal indestructible block pillars
        } else {
          // Clear starting spaces in corners for Hachiware, Chiikawa, Usagi, Momonga
          const isCornerSafeZone =
            (r <= 2 && c <= 2) ||   // Top-Left (Player corner)
            (r <= 2 && c >= 12) ||  // Top-Right (Momonga CPU)
            (r >= 10 && c <= 2) ||  // Bottom-Left (Chiikawa CPU)
            (r >= 10 && c >= 12);   // Bottom-Right (Usagi CPU)

          if (isCornerSafeZone) {
            row.push(0);
          } else {
            // Scatter destructible crates (60% spawn density)
            row.push(Math.random() < 0.60 ? 2 : 0);
          }
        }
      }
      mapData.push(row);
    }

    // Reset Player coordinates
    playerRow = 1;
    playerCol = 1;

    // Reset CPU Bot states (located at the other corners)
    bots = [
      { name: "Chiikawa CPU", r: 11, c: 1, type: "chiikawa", hp: 1, bombsPlaced: 0, maxBombs: 1, fireRange: 2, lastMoveTime: 0, avatar: "assets/cards/chiikawa.png" },
      { name: "Momonga CPU", r: 1, c: 13, type: "momonga", hp: 1, bombsPlaced: 0, maxBombs: 1, fireRange: 2, lastMoveTime: 0, avatar: "assets/cards/momonga.png" },
      { name: "Usagi CPU", r: 11, c: 13, type: "usagi", hp: 1, bombsPlaced: 0, maxBombs: 1, fireRange: 2, lastMoveTime: 0, avatar: "assets/cards/usagi.png" }
    ];

    // Reset game dashboard stats
    playerMaxBombs = 2;
    playerBombsPlaced = 0;
    playerFireRange = 2;
    playerSpeed = "NORMAL";
    playerHP = 1;
    
    activeBombs = [];
    blastZones.clear();
    isMoving = false;
  }

  const boardEl = document.getElementById("interactive-board");

  // Re-draw board cells
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

        // Grid brick wall pillars
        if (cellType === 1) {
          cell.classList.add("cell-wall");
        } else if (cellType === 2) {
          // Destructible crates
          cell.classList.add("cell-crate");
        } else {
          // Checkered floor styling
          cell.classList.add("cell-floor");
          if ((r + c) % 2 === 0) {
            cell.classList.add("checkered-light");
          } else {
            cell.classList.add("checkered-dark");
          }
        }

        // Fire explosion overlays
        const key = `${r},${c}`;
        if (blastZones.has(key)) {
          cell.classList.add("cell-fire");
          cell.textContent = "🔥";
        }

        // Bombs
        const activeBomb = activeBombs.find((b) => b.row === r && b.col === c);
        if (activeBomb && !blastZones.has(key)) {
          const bombToken = document.createElement("div");
          bombToken.classList.add("bomb-token");
          bombToken.textContent = "💣";
          cell.appendChild(bombToken);
        }

        // Player (Hachiware) circular avatar
        if (r === playerRow && c === playerCol && playerHP > 0) {
          const playerToken = document.createElement("div");
          playerToken.classList.add("player-token");
          playerToken.style.backgroundImage = "url('assets/cards/hachiware.png')";
          
          const label = document.createElement("span");
          label.classList.add("char-label");
          label.textContent = "Player";
          playerToken.appendChild(label);
          
          cell.appendChild(playerToken);
        }

        // CPU Bots circular avatars
        const activeBot = bots.find(b => b.hp > 0 && b.r === r && b.c === c);
        if (activeBot && !(r === playerRow && c === playerCol)) {
          const botToken = document.createElement("div");
          botToken.classList.add("bot-token", `bot-${activeBot.type}`);
          botToken.style.backgroundImage = `url('${activeBot.avatar}')`;
          
          const label = document.createElement("span");
          label.classList.add("char-label");
          label.textContent = activeBot.name;
          botToken.appendChild(label);
          
          cell.appendChild(botToken);
        }

        // Items floating pick-ups
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

        cell.addEventListener("click", () => handleCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }

    updateDashboard();
  }

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

  // BFS search pathfinder
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

  function handleCellClick(targetR, targetC) {
    if (playerHP <= 0 || isMoving) return;
    initAudio();

    if (targetR === playerRow && targetC === playerCol) {
      dropBombAt(playerRow, playerCol, playerFireRange, "player");
      return;
    }

    const path = findShortestPath(playerRow, playerCol, targetR, targetC);
    if (!path || path.length === 0) {
      soundError();
      return;
    }

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

      const tileType = mapData[playerRow][playerCol];
      if (tileType >= 6) {
        soundGrabItem();
        if (tileType === 6) playerFireRange++;
        else if (tileType === 7) playerMaxBombs++;
        else if (tileType === 8) playerSpeed = "BOOSTED";
        mapData[playerRow][playerCol] = 0;
      } else {
        soundWalk();
      }

      const key = `${playerRow},${playerCol}`;
      if (blastZones.has(key)) {
        eliminatePlayer();
      }

      renderBoard();
      setTimeout(walkStep, stepInterval);
    }

    walkStep();
  }

  // Unified Bomb Drop & Explosion System
  function dropBombAt(row, col, range, owner) {
    // Check if space already has bomb
    const alreadyHasBomb = activeBombs.some((b) => b.row === row && b.col === col);
    if (alreadyHasBomb) return;

    if (owner === "player") {
      if (playerHP <= 0 || playerBombsPlaced >= playerMaxBombs) {
        soundError();
        return;
      }
      playerBombsPlaced++;
      soundPlaceBomb();
    } else {
      owner.bombsPlaced++;
    }

    const bomb = {
      row: row,
      col: col,
      range: range,
      owner: owner,
      fuseTimer: null
    };

    activeBombs.push(bomb);
    renderBoard();

    bomb.fuseTimer = setTimeout(() => {
      // Detonate
      activeBombs = activeBombs.filter((b) => b !== bomb);
      if (owner === "player") {
        playerBombsPlaced = Math.max(0, playerBombsPlaced - 1);
      } else {
        owner.bombsPlaced = Math.max(0, owner.bombsPlaced - 1);
      }
      
      soundExplode();

      const affectedCells = [[row, col]];
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      directions.forEach(([dr, dc]) => {
        for (let i = 1; i <= range; i++) {
          const checkR = row + dr * i;
          const checkC = col + dc * i;

          if (checkR < 0 || checkR >= mapRows || checkC < 0 || checkC >= mapCols) break;

          const tile = mapData[checkR][checkC];
          if (tile === 1) break; // indestructible blocks absorb/stop blasts

          affectedCells.push([checkR, checkC]);
          if (tile === 2) break; // crates stop blast propagation
        }
      });

      affectedCells.forEach(([r, c]) => {
        const key = `${r},${c}`;
        blastZones.add(key);

        const tile = mapData[r][c];
        if (tile === 2) {
          // Destructible crates break. 45% item spawn chance
          if (Math.random() < 0.45) {
            const rand = Math.random();
            if (rand < 0.33) mapData[r][c] = 6;      // range up
            else if (rand < 0.66) mapData[r][c] = 7; // bomb limit up
            else mapData[r][c] = 8;                  // speed boot
          } else {
            mapData[r][c] = 0;
          }
        } else if (tile >= 6) {
          mapData[r][c] = 0; // items disintegrate in fire
        }

        // Damage Player
        if (r === playerRow && c === playerCol) {
          eliminatePlayer();
        }

        // Damage Bots
        bots.forEach(bot => {
          if (bot.hp > 0 && bot.r === r && bot.c === c) {
            eliminateBot(bot);
          }
        });
      });

      renderBoard();

      // Clear fire cells
      setTimeout(() => {
        affectedCells.forEach(([r, c]) => {
          const key = `${r},${c}`;
          blastZones.delete(key);
        });
        renderBoard();
      }, 500);

    }, 1500);
  }

  function eliminatePlayer() {
    playerHP = 0;
    soundGameOver();
    updateDashboard();
    
    setTimeout(() => {
      resetGame();
    }, 1800);
  }

  function eliminateBot(bot) {
    bot.hp = 0;
    playSynthNotes([{ freq: 220, duration: 0.15, type: 'sawtooth', volume: 0.05 }]);
    renderBoard();

    // Respawn bot after 5 seconds
    setTimeout(() => {
      if (playerHP > 0) {
        bot.hp = 1;
        bot.bombsPlaced = 0;
        
        // Return to original corners
        if (bot.type === "chiikawa") { bot.r = 11; bot.c = 1; }
        else if (bot.type === "momonga") { bot.r = 1; bot.c = 13; }
        else if (bot.type === "usagi") { bot.r = 11; bot.c = 13; }
        
        renderBoard();
      }
    }, 5000);
  }

  // CPU Bots AI Logic Loop (walk, drop bomb next to crates, escape fires)
  function updateBots() {
    if (playerHP <= 0) return;

    bots.forEach((bot) => {
      if (bot.hp <= 0) return;

      const now = Date.now();
      if (now - bot.lastMoveTime < 1300) return; // limit CPU move frequency (1.3s)
      bot.lastMoveTime = now;

      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      // Check if any crate is adjacent to CPU bot
      let adjacentCrate = false;
      directions.forEach(([dr, dc]) => {
        const nr = bot.r + dr;
        const nc = bot.c + dc;
        if (nr >= 0 && nr < mapRows && nc >= 0 && nc < mapCols) {
          if (mapData[nr][nc] === 2) adjacentCrate = true;
        }
      });

      // 25% chance to drop bomb next to crates
      if (adjacentCrate && Math.random() < 0.25 && bot.bombsPlaced < bot.maxBombs) {
        dropBombAt(bot.r, bot.c, bot.fireRange, bot);
        return;
      }

      // Check walkable adjacent options
      const options = [];
      directions.forEach(([dr, dc]) => {
        const nr = bot.r + dr;
        const nc = bot.c + dc;
        if (nr >= 0 && nr < mapRows && nc >= 0 && nc < mapCols) {
          const tile = mapData[nr][nc];
          const hasBomb = activeBombs.some(b => b.row === nr && b.col === nc);
          const anotherBot = bots.some(b => b.hp > 0 && b.r === nr && b.c === nc);
          const isPlayer = (playerRow === nr && playerCol === nc);
          
          if ((tile === 0 || tile >= 6) && !hasBomb && !anotherBot && !isPlayer) {
            options.push([nr, nc]);
          }
        }
      });

      // Walk to random option
      if (options.length > 0) {
        const [nextR, nextC] = options[Math.floor(Math.random() * options.length)];
        bot.r = nextR;
        bot.c = nextC;

        // Check item collection
        const itemType = mapData[bot.r][bot.c];
        if (itemType >= 6) {
          if (itemType === 6) bot.fireRange++;
          else if (itemType === 7) bot.maxBombs++;
          mapData[bot.r][bot.c] = 0;
        }

        // Damage check
        const key = `${bot.r},${bot.c}`;
        if (blastZones.has(key)) {
          eliminateBot(bot);
        }

        renderBoard();
      }
    });
  }

  function startBotLoop() {
    if (botIntervalId) clearInterval(botIntervalId);
    botIntervalId = setInterval(updateBots, 300);
  }

  function stopBotLoop() {
    if (botIntervalId) {
      clearInterval(botIntervalId);
      botIntervalId = null;
    }
  }

  function resetGame() {
    initMap();
    renderBoard();
  }

  /* ==========================================================================
     ARENA KEYBOARD INTERACTIVE CONTROLS (WASD / ARROW KEYS + SPACE BAR)
     ========================================================================== */
  window.addEventListener("keydown", (e) => {
    const arenaSection = document.getElementById("arena");
    if (!arenaSection || !arenaSection.classList.contains("active")) return;
    
    if (playerHP <= 0 || isMoving) return;
    initAudio();

    let targetR = playerRow;
    let targetC = playerCol;
    let isMoveKey = false;

    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      targetR = playerRow - 1;
      isMoveKey = true;
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      targetR = playerRow + 1;
      isMoveKey = true;
    } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      targetC = playerCol - 1;
      isMoveKey = true;
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      targetC = playerCol + 1;
      isMoveKey = true;
    } else if (e.key === " ") {
      // Space bar bomb drop
      e.preventDefault();
      dropBombAt(playerRow, playerCol, playerFireRange, "player");
      return;
    }

    if (isMoveKey) {
      e.preventDefault(); // prevent native scroll
      
      if (targetR >= 0 && targetR < mapRows && targetC >= 0 && targetC < mapCols) {
        const cellType = mapData[targetR][targetC];
        const hasBomb = activeBombs.some((b) => b.row === targetR && b.col === targetC);
        const isWalkable = (cellType === 0 || cellType >= 6) && !hasBomb;

        if (isWalkable) {
          playerRow = targetR;
          playerCol = targetC;

          // Pickup item
          const tileType = mapData[playerRow][playerCol];
          if (tileType >= 6) {
            soundGrabItem();
            if (tileType === 6) playerFireRange++;
            else if (tileType === 7) playerMaxBombs++;
            else if (tileType === 8) playerSpeed = "BOOSTED";
            mapData[playerRow][playerCol] = 0;
          } else {
            soundWalk();
          }

          // Damage check
          const key = `${playerRow},${playerCol}`;
          if (blastZones.has(key)) {
            eliminatePlayer();
          }

          renderBoard();
        } else {
          soundError();
        }
      }
    }
  });

  /* ==========================================================================
     PARALLAX TILT EFFECT (PREMIUM LOCAL 3D CURSOR INTERACTIVITY IN ALL SECTIONS)
     ========================================================================== */
  const tiltElements = document.querySelectorAll(".tilt-element");

  tiltElements.forEach((el) => {
    // Add smooth transition on enter
    el.addEventListener("pointerenter", () => {
      el.style.transition = "transform 0.1s ease-out, box-shadow 0.15s ease-out";
    });

    el.addEventListener("pointermove", (e) => {
      const rect = el.getBoundingClientRect();
      
      // Calculate cursor position relative to the element
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Normalized offset (-0.5 to 0.5) from the card center
      const relX = (x / rect.width) - 0.5;
      const relY = (y / rect.height) - 0.5;
      
      // Rotation degrees (up to 15 degrees tilt in any direction)
      const rotateY = relX * 24; 
      const rotateX = -relY * 24;
      
      // Set 3D rotation, slight scale, and translate depth
      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02) translateZ(15px)`;
    });

    el.addEventListener("pointerleave", () => {
      // Eases smoothly back to flat state on mouse leave
      el.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s";
      el.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1) translateZ(0px)";
    });
  });

  /* ==========================================================================
     PAGE MOUNT INITIALIZATION
     ========================================================================== */
  const placeBombBtn = document.getElementById("place-bomb-btn");
  const resetGameBtn = document.getElementById("reset-game-btn");

  if (placeBombBtn) {
    placeBombBtn.addEventListener("click", () => {
      initAudio();
      dropBombAt(playerRow, playerCol, playerFireRange, "player");
    });
  }

  if (resetGameBtn) {
    resetGameBtn.addEventListener("click", () => {
      initAudio();
      resetGame();
    });
  }

  resetGame();

  document.querySelectorAll(".cta-action, .dl-btn").forEach((btn) => {
    btn.addEventListener("mousedown", () => {
      initAudio();
    });
  });

}());
