(function () {
  /* ==========================================================================
     CORE CONFIG & STATE SYSTEM
     ========================================================================== */
  
  // Active Character State for Squad Section
  let activeChar = "chiikawa";
  
  // Database of Squad Characters with Wardrobe Animation Videos (Green Screen)
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
      video: "assets/chiikawa/chiikawa_character_animation.mp4"
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
      video: "hachiware-lobby.mp4"
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
      video: "assets/usagi/usagi_character_animation.mp4"
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
      video: "assets/momonga/momonga_character_animation.mp4"
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

  // Chime arpeggio for item collection
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
     SNAP SCROLL & SIDEBAR NAVIGATION OBSERVER
     ========================================================================== */
  const sections = document.querySelectorAll(".section");
  const navLinks = document.querySelectorAll(".nav-link");
  const snapContainer = document.querySelector(".snap-container");

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
      }
    });
  }, obsOptions);

  sections.forEach((sec) => observer.observe(sec));

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      initAudio();
      
      const targetId = link.getAttribute("href");
      const targetSec = document.querySelector(targetId);
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  /* ==========================================================================
     HOME PAGE: ACCURATE ONLINE PLAYERS COUNTER
     ========================================================================== */
  const regCounterEl = document.getElementById("reg-counter");

  function updateOnlinePlayers() {
    if (!regCounterEl) return;
    
    // Fetch live connections from server endpoint
    fetch("/api/online-players")
      .then(res => res.json())
      .then(data => {
        let count = data.count || 0;
        // Make sure it displays at least 1 (the visitor themselves)
        regCounterEl.textContent = Math.max(1, count).toLocaleString();
      })
      .catch(err => {
        // Fallback placeholder counter increment
        console.warn("Could not retrieve live player counts, showing fallback", err);
        let fallbackVal = 1248506 + Math.floor(Math.random() * 10);
        regCounterEl.textContent = fallbackVal.toLocaleString();
      });
  }

  if (regCounterEl) {
    updateOnlinePlayers();
    setInterval(updateOnlinePlayers, 3000); // refresh every 3s
  }

  /* ==========================================================================
     SQUAD SECTION: DYNAMIC CHROMA-KEY VIDEO TRANSITIONS (WARDROBE STYLE)
     ========================================================================== */
  const selectorTabs = document.querySelectorAll(".selector-tab");
  const charCanvas = document.getElementById("char-canvas");
  const charVideo = document.getElementById("char-video");
  const charCard = document.querySelector(".char-details-card");
  const charBgBlock = document.getElementById("char-bg-block");
  let ctx = charCanvas ? charCanvas.getContext("2d", { willReadFrequently: true }) : null;
  let chromaLoopId = null;

  // Greenscreen Keying Formula
  function keyGreenPixels(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      
      const greenDominance = green - Math.max(red, blue);
      // Key green screen pixels
      const isGreenScreen = green > 70 && greenDominance > 22 && green > red * 1.15 && green > blue * 1.1;

      if (isGreenScreen) {
        // Smooth margins
        const softness = Math.min(255, Math.max(0, (greenDominance - 15) * 8));
        data[i + 3] = 255 - softness;
      } else if (greenDominance > 8 && green > 65) {
        // Remove green fringes
        data[i + 1] = Math.max(0, green - greenDominance * 0.5);
      }
    }
    return imageData;
  }

  // Chroma Canvas Render loop
  function startChromaVideo(videoUrl) {
    if (!charCanvas || !charVideo || !ctx) return;

    if (chromaLoopId) {
      cancelAnimationFrame(chromaLoopId);
      chromaLoopId = null;
    }

    charVideo.src = videoUrl;
    charVideo.load();
    
    // Play video
    charVideo.play().catch(err => {
      console.warn("Autoplay blocked or load error on video:", err);
    });

    function drawChromaFrame() {
      if (charVideo.paused || charVideo.ended) {
        chromaLoopId = requestAnimationFrame(drawChromaFrame);
        return;
      }

      const w = charCanvas.width;
      const h = charCanvas.height;

      ctx.clearRect(0, 0, w, h);

      // Cover drawing calculations
      const sW = charVideo.videoWidth || w;
      const sH = charVideo.videoHeight || h;
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

        // Swapping details
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

        // Load new character video and update background block
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

  // Mount First character video on startup
  startChromaVideo(charactersData.chiikawa.video);

  /* ==========================================================================
     ARENA SECTION: INTERACTIVE GAME ENGINE
     ========================================================================== */
  
  let mapData = [];
  const mapRows = 6;
  const mapCols = 9;

  let playerRow = 3;
  let playerCol = 4;
  let playerMaxBombs = 2;
  let playerBombsPlaced = 0;
  let playerFireRange = 2;
  let playerSpeed = "NORMAL"; // NORMAL, BOOSTED
  let isMoving = false;
  let playerHP = 1;

  let activeBombs = [];
  let blastZones = new Set();

  function initMap() {
    mapData = [
      [1, 0, 2, 2, 1, 2, 2, 0, 1],
      [0, 2, 0, 0, 2, 0, 0, 2, 0],
      [2, 0, 1, 2, 0, 2, 1, 0, 2],
      [2, 0, 1, 0, 0, 0, 1, 0, 2],
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

        if (cellType === 1) {
          cell.classList.add("cell-wall");
          cell.textContent = "🧱";
        } else if (cellType === 2) {
          cell.classList.add("cell-crate");
          cell.textContent = "📦";
        } else {
          cell.classList.add("cell-floor");
        }

        const key = `${r},${c}`;
        if (blastZones.has(key)) {
          cell.classList.add("cell-fire");
          cell.textContent = "🔥";
        }

        const activeBomb = activeBombs.find((b) => b.row === r && b.col === c);
        if (activeBomb && !blastZones.has(key)) {
          const bombToken = document.createElement("div");
          bombToken.classList.add("bomb-token");
          bombToken.textContent = "💣";
          cell.appendChild(bombToken);
        }

        if (r === playerRow && c === playerCol && playerHP > 0) {
          const playerToken = document.createElement("div");
          playerToken.classList.add("player-token");
          playerToken.style.backgroundImage = "url('assets/cards/hachiware.png')";
          cell.appendChild(playerToken);
        }

        // Floating powerup items
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
      placeBomb();
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
        if (tileType === 6) {
          playerFireRange++;
        } else if (tileType === 7) {
          playerMaxBombs++;
        } else if (tileType === 8) {
          playerSpeed = "BOOSTED";
        }
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

  function placeBomb() {
    if (playerHP <= 0 || playerBombsPlaced >= playerMaxBombs) {
      soundError();
      return;
    }

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

    bomb.fuseTimer = setTimeout(() => {
      explodeBomb(bomb);
    }, 1500);
  }

  function explodeBomb(bomb) {
    activeBombs = activeBombs.filter((b) => b !== bomb);
    playerBombsPlaced = Math.max(0, playerBombsPlaced - 1);
    soundExplode();

    const affectedCells = [[bomb.row, bomb.col]];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    directions.forEach(([dr, dc]) => {
      for (let i = 1; i <= bomb.range; i++) {
        const checkR = bomb.row + dr * i;
        const checkC = bomb.col + dc * i;

        if (checkR < 0 || checkR >= mapRows || checkC < 0 || checkC >= mapCols) break;

        const tile = mapData[checkR][checkC];
        if (tile === 1) break; // walls stop blasts

        affectedCells.push([checkR, checkC]);
        if (tile === 2) break; // crates absorb blast
      }
    });

    affectedCells.forEach(([r, c]) => {
      const key = `${r},${c}`;
      blastZones.add(key);

      const tile = mapData[r][c];
      if (tile === 2) {
        if (Math.random() < 0.45) {
          const rand = Math.random();
          if (rand < 0.33) {
            mapData[r][c] = 6;
          } else if (rand < 0.66) {
            mapData[r][c] = 7;
          } else {
            mapData[r][c] = 8;
          }
        } else {
          mapData[r][c] = 0;
        }
      } else if (tile >= 6) {
        mapData[r][c] = 0;
      }

      if (r === playerRow && c === playerCol) {
        eliminatePlayer();
      }
    });

    renderBoard();

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
    
    setTimeout(() => {
      resetGame();
    }, 1800);
  }

  function resetGame() {
    initMap();
    renderBoard();
  }

  /* ==========================================================================
     ARENA KEYBOARD INTERACTIVE CONTROLS (SAME GAMEPLAY CONTROLS AS ACTUAL GAME)
     ========================================================================== */
  window.addEventListener("keydown", (e) => {
    // Only capture keyboard inputs when the Arena section is active
    const arenaSection = document.getElementById("arena");
    if (!arenaSection || !arenaSection.classList.contains("active")) return;
    
    if (playerHP <= 0 || isMoving) return;
    initAudio();

    let targetR = playerRow;
    let targetC = playerCol;
    let isMoveKey = false;

    // Movement: WASD or Arrow Keys
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
      // Space bar: Place bomb
      e.preventDefault();
      placeBomb();
      return;
    }

    if (isMoveKey) {
      e.preventDefault(); // Stop window from scrolling while playing
      
      // Coordinate validity check
      if (targetR >= 0 && targetR < mapRows && targetC >= 0 && targetC < mapCols) {
        const cellType = mapData[targetR][targetC];
        const hasBomb = activeBombs.some((b) => b.row === targetR && b.col === targetC);
        const isWalkable = (cellType === 0 || cellType >= 6) && !hasBomb;

        if (isWalkable) {
          playerRow = targetR;
          playerCol = targetC;

          // Check item pickups
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
            mapData[playerRow][playerCol] = 0;
          } else {
            soundWalk();
          }

          // Check fire damage
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
     PAGE MOUNT INITIALIZATION
     ========================================================================== */
  
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

  resetGame();

  document.querySelectorAll(".cta-action, .dl-btn").forEach((btn) => {
    btn.addEventListener("mousedown", () => {
      initAudio();
    });
  });

}());
