import Phaser from '../../lib/phaser.js';
import { BaseScene } from '../base-scene.js';
import { SCENE_KEYS } from '../scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../../assets/font-keys.js';
import { dataManager } from '../../utils/data-manager.js';
import { runState } from '../../state/run-state.js';

const TILE_SIZE = 16;
const MAZE_COLS = 28;
const MAZE_ROWS = 26;
const OFFSET_X = Math.floor((1024 - MAZE_COLS * TILE_SIZE) / 2); // 288
const OFFSET_Y = 88; // Center vertically below HUD
const TOTAL_TIME = 120; // 2:00 in seconds
const FRIGHTENED_DURATION = 6000; // 6 seconds

// Maze Layout definition
// '#' = Wall
// '.' = Pellet (+10)
// 'O' = Big BTC Power Coin (+50)
// ' ' = Empty Path
// 'V' = Vault (Ghost home)
// '-' = Vault Door
const MAZE_GRID = [
  '############################',
  '#............##............#',
  '#O####.#####.##.#####.####O#',
  '# ####.#####.##.#####.#### #',
  '#............##............#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##          ##.#     ',
  '######.## ###--### ##.######',
  '      .   # VVVV #   .      ',
  '######.## # VVVV # ##.######',
  '     #.## ######## ##.#     ',
  '######.##    ##    ##.######',
  '...... .  ########  . ......',
  '######.##    ##    ##.######',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#O..##................##..O#',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

export class VaultRunScene extends BaseScene {
  /** @type {object} */
  _data = {};

  // Player state
  /** @type {{x: number, y: number, col: number, row: number, dirX: number, dirY: number, nextDirX: number, nextDirY: number, speed: number}} */
  #player = {
    x: 0,
    y: 0,
    col: 14,
    row: 18,
    dirX: -1,
    dirY: 0,
    nextDirX: -1,
    nextDirY: 0,
    speed: 2.0,
  };

  /** @type {Phaser.GameObjects.Image} */
  #catSprite;

  /** @type {Phaser.GameObjects.Graphics} */
  #catTrailGraphics;

  /** @type {Array<{x: number, y: number, alpha: number}>} */
  #catTrail = [];

  // Pellets & Power Coins
  /** @type {Array<{col: number, row: number, x: number, y: number, isBig: boolean, sprite: Phaser.GameObjects.GameObject}>} */
  #pellets = [];

  /** @type {number} */
  #pelletsLeft = 0;

  // Apes (Ghosts)
  /** @type {Array<{
   *   id: number,
   *   name: string,
   *   assetKey: string,
   *   x: number,
   *   y: number,
   *   col: number,
   *   row: number,
   *   dirX: number,
   *   dirY: number,
   *   speed: number,
   *   isChaser: boolean,
   *   sprite: Phaser.GameObjects.Image
   * }>} */
  #apes = [];

  /** @type {boolean} */
  #isFrightened = false;

  /** @type {number} */
  #frightenedTimer = 0;

  // Game state
  /** @type {number} */
  #miniScore = 0;

  /** @type {number} */
  #timeLeft = TOTAL_TIME;

  /** @type {boolean} */
  #isPlaying = false;

  /** @type {boolean} */
  #isGameOver = false;

  /** @type {boolean} */
  #hasWon = false;

  // Visuals & HUD
  /** @type {Phaser.GameObjects.Graphics} */
  #mazeGraphics;

  /** @type {Phaser.GameObjects.Text} */
  #pelletsText;

  /** @type {Phaser.GameObjects.Text} */
  #scoreText;

  /** @type {Phaser.GameObjects.Text} */
  #timerText;

  /** @type {Phaser.Time.TimerEvent | null} */
  #clockTimerEvent = null;

  constructor() {
    super({ key: SCENE_KEYS.VAULT_RUN_SCENE });
  }

  init(data) {
    super.init(data);
    this._data = data || {};
    this.#player = {
      x: 0,
      y: 0,
      col: 14,
      row: 18,
      dirX: -1,
      dirY: 0,
      nextDirX: -1,
      nextDirY: 0,
      speed: 2.0,
    };
    this.#catTrail = [];
    this.#pellets = [];
    this.#pelletsLeft = 0;
    this.#apes = [];
    this.#isFrightened = false;
    this.#frightenedTimer = 0;
    this.#miniScore = 0;
    this.#timeLeft = TOTAL_TIME;
    this.#isPlaying = false;
    this.#isGameOver = false;
    this.#hasWon = false;
  }

  create() {
    super.create();
    this.cameras.main.setBackgroundColor('#050110');
    this.cameras.main.fadeIn(300);

    // 1. Draw Arcade Side Marquee & Neon Grid Background
    this.#drawBackgroundDetails();

    // 2. Draw Maze Walls with Cyan + Magenta Double Neon Glow
    this.#drawMazeWalls();

    // 3. Spawn Pellets & Power Coins
    this.#spawnPellets();

    // 4. Cat Trail Layer
    this.#catTrailGraphics = this.add.graphics().setDepth(15);

    // 5. Spawn Player Cat
    const catChoice = runState.hunter || dataManager.getPlayerCat() || 'cat-1';
    const catKey = this.textures.exists(catChoice) ? catChoice : 'PLAYER';
    this.#player.x = OFFSET_X + this.#player.col * TILE_SIZE + TILE_SIZE / 2;
    this.#player.y = OFFSET_Y + this.#player.row * TILE_SIZE + TILE_SIZE / 2;

    this.#catSprite = this.add.image(this.#player.x, this.#player.y, catKey)
      .setDepth(20)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(18, 18);

    // 6. Spawn 4 Hacker Apes in Vault
    this.#spawnApes();

    // 7. Setup HUD
    this.#createHUD();

    // 8. Setup Controls
    this.#setupControls();

    // 9. Start 3-2-1 Countdown
    this.#startCountdown();
  }

  update(time, delta) {
    this.#updateTrail();

    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;

    // Update Frightened Timer
    if (this.#isFrightened) {
      this.#frightenedTimer -= delta;
      if (this.#frightenedTimer <= 0) {
        this.#endFrightenedMode();
      } else if (this.#frightenedTimer < 1800) {
        // Flash between blue and white to warn expiration
        const isBlink = Math.floor(time / 150) % 2 === 0;
        this.#apes.forEach((ape) => {
          ape.sprite.setTint(isBlink ? 0xFFFFFF : 0x00B0FF);
        });
      }
    }

    // Step Player
    this.#updatePlayer();

    // Step Apes
    this.#updateApes();

    // Check Collisions between Player and Apes
    this.#checkApeCollisions();
  }

  // ==========================================
  // BACKGROUND & NEON MAZE RENDERING
  // ==========================================
  #drawBackgroundDetails() {
    const bg = this.add.graphics().setDepth(1);

    // Deep space backdrop
    bg.fillStyle(0x060212, 1);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);

    // Grid dots across background
    bg.fillStyle(0x1a1236, 0.6);
    for (let x = 16; x < this.scale.width; x += 32) {
      for (let y = 16; y < this.scale.height; y += 32) {
        bg.fillCircle(x, y, 1);
      }
    }

    // Side Marquee Borders (Left & Right Arcade Panels)
    const panelW = OFFSET_X - 24;
    // Left decorative card
    this.add.rectangle(OFFSET_X / 2 - 2, this.scale.height / 2 + 10, panelW, 440, 0x090518, 0.85)
      .setStrokeStyle(2, 0x00E5FF, 0.7)
      .setDepth(2);

    this.add.text(OFFSET_X / 2 - 2, 120, '// VAULT PROTOCOL //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    this.add.text(OFFSET_X / 2 - 2, 160, 'CRYPTOGRAPHIC\nLEDGER RUN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#FFFFFF',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    this.add.text(OFFSET_X / 2 - 2, 240, 'RULES:\n• EAT ALL PELLETS\n• 4 CORNER COINS\n  OVERCLOCK APES\n• EAT VULNERABLE\n  APES FOR +200\n• AVOID APES', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(3);

    // Right decorative card
    const rightCenterX = this.scale.width - OFFSET_X / 2 + 2;
    this.add.rectangle(rightCenterX, this.scale.height / 2 + 10, panelW, 440, 0x090518, 0.85)
      .setStrokeStyle(2, 0xFF00FF, 0.7)
      .setDepth(2);

    this.add.text(rightCenterX, 120, '// INTRUDER APES //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#FF00FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    this.add.text(rightCenterX, 170, 'HACKER DAEMONS\nIN VAULT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#FFD700',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    this.add.text(rightCenterX, 250, '• APE 1: CHASER\n• APE 2: CHASER\n• APE 3: WANDERER\n• APE 4: WANDERER\n\nSTATUS:\nMONITORING ACTIVE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(3);
  }

  #drawMazeWalls() {
    this.#mazeGraphics = this.add.graphics().setDepth(5);

    // Maze Floor Dark Fill
    this.#mazeGraphics.fillStyle(0x0a051d, 0.95);
    this.#mazeGraphics.fillRect(OFFSET_X, OFFSET_Y, MAZE_COLS * TILE_SIZE, MAZE_ROWS * TILE_SIZE);

    // Render Walls with Cyan + Magenta Double Neon Lines
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const char = MAZE_GRID[r][c];
        const x = OFFSET_X + c * TILE_SIZE;
        const y = OFFSET_Y + r * TILE_SIZE;

        if (char === '#') {
          // Double neon line wall block
          // Outer cyan line
          this.#mazeGraphics.fillStyle(0x0c0722, 1);
          this.#mazeGraphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // Outer stroke (Cyan)
          this.#mazeGraphics.lineStyle(1.5, 0x00E5FF, 0.85);
          this.#mazeGraphics.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

          // Inner stroke (Magenta)
          this.#mazeGraphics.lineStyle(1, 0xFF00FF, 0.65);
          this.#mazeGraphics.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else if (char === '-') {
          // Vault Door (Horizontal cyan laser gate)
          this.#mazeGraphics.fillStyle(0x00E5FF, 0.85);
          this.#mazeGraphics.fillRect(x, y + 6, TILE_SIZE, 4);
        }
      }
    }

    // Vault Center Text & Label
    const vaultCenterX = OFFSET_X + 14 * TILE_SIZE;
    const vaultCenterY = OFFSET_Y + 9 * TILE_SIZE - 2;

    this.add.text(vaultCenterX, vaultCenterY, 'VAULT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);
  }

  // ==========================================
  // PELLETS & POWER COINS
  // ==========================================
  #spawnPellets() {
    this.#pellets = [];
    this.#pelletsLeft = 0;

    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const char = MAZE_GRID[r][c];
        const px = OFFSET_X + c * TILE_SIZE + TILE_SIZE / 2;
        const py = OFFSET_Y + r * TILE_SIZE + TILE_SIZE / 2;

        if (char === '.') {
          // Regular Gold "B" pellet (+10)
          const pellet = this.add.text(px, py, 'B', {
            fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
            fontSize: '9px',
            color: '#FFD700',
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(7);

          this.#pellets.push({
            col: c,
            row: r,
            x: px,
            y: py,
            isBig: false,
            sprite: pellet,
          });
          this.#pelletsLeft++;
        } else if (char === 'O') {
          // Big Glowing BTC Coin in 4 Corners (+50)
          const coin = this.add.image(px, py, 'coin-btc-gold')
            .setOrigin(0.5, 0.5)
            .setDisplaySize(20, 20)
            .setDepth(8);

          // Pulsing rotation tween
          this.tweens.add({
            targets: coin,
            scaleX: { from: coin.scaleX, to: coin.scaleX * 0.2 },
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });

          this.#pellets.push({
            col: c,
            row: r,
            x: px,
            y: py,
            isBig: true,
            sprite: coin,
          });
          this.#pelletsLeft++;
        }
      }
    }
  }

  // ==========================================
  // HACKER APES (GHOSTS) SPAWNING & AI
  // ==========================================
  #spawnApes() {
    this.#apes = [];

    // 4 Apes inside/around vault
    const apeConfigs = [
      { id: 1, name: 'SHADOW APE', asset: 'HACKER_APE_1', col: 13, row: 10, isChaser: true },
      { id: 2, name: 'CYBER APE', asset: 'HACKER_APE_2', col: 14, row: 10, isChaser: true },
      { id: 3, name: 'ROGUE APE', asset: 'HACKER_APE_3', col: 13, row: 11, isChaser: false },
      { id: 4, name: 'GLITCH APE', asset: 'ape-4', col: 14, row: 11, isChaser: false },
    ];

    apeConfigs.forEach((cfg) => {
      const ax = OFFSET_X + cfg.col * TILE_SIZE + TILE_SIZE / 2;
      const ay = OFFSET_Y + cfg.row * TILE_SIZE + TILE_SIZE / 2;
      const key = this.textures.exists(cfg.asset) ? cfg.asset : 'HACKER_APE_1';

      const sprite = this.add.image(ax, ay, key)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(18, 18)
        .setDepth(18);

      this.#apes.push({
        id: cfg.id,
        name: cfg.name,
        assetKey: key,
        x: ax,
        y: ay,
        col: cfg.col,
        row: cfg.row,
        dirX: 0,
        dirY: -1,
        speed: 1.6,
        isChaser: cfg.isChaser,
        sprite,
      });
    });
  }

  // ==========================================
  // HUD
  // ==========================================
  #createHUD() {
    const hudY = 28;
    const width = this.scale.width;

    this.add.rectangle(width / 2, hudY, width - 40, 48, 0x090518, 0.95)
      .setStrokeStyle(2, 0x00E5FF, 0.85)
      .setDepth(50);

    // Left info
    this.add.text(35, hudY - 12, '// VAULT RUN // CRYPTOGRAPHIC MAZE //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setDepth(51);

    this.add.text(35, hudY + 4, `OPERATIVE: ${runState.name || 'HUNTER'} • UNIT: ${runState.hunter?.toUpperCase() || 'CYAN'}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
    }).setDepth(51);

    // Center: Pellets Left
    this.#pelletsText = this.add.text(width * 0.42, hudY, `PELLETS: ${this.#pelletsLeft}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '17px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    // Right-Center: Score
    this.#scoreText = this.add.text(width * 0.68, hudY, `SCORE: ${this.#miniScore} BIT`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '17px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    // Right: Timer
    this.#timerText = this.add.text(width - 45, hudY, 'TIME: 02:00', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(51);
  }

  #updateHUD() {
    if (!this.#pelletsText?.scene || !this.#scoreText?.scene) return;
    this.#pelletsText.setText(`PELLETS: ${this.#pelletsLeft}`);
    this.#scoreText.setText(`SCORE: ${this.#miniScore} BIT`);
  }

  #updateTimerDisplay() {
    if (!this.#timerText?.scene) return;
    const minutes = Math.floor(this.#timeLeft / 60);
    const seconds = this.#timeLeft % 60;
    const formatted = `TIME: 0${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    this.#timerText.setText(formatted);

    if (this.#timeLeft <= 10) {
      this.#timerText.setColor('#FF3366');
      this.tweens.add({
        targets: this.#timerText,
        alpha: { from: 1, to: 0.3 },
        duration: 250,
        yoyo: true,
        repeat: 1,
      });
    }
  }

  // ==========================================
  // CONTROLS & STEERING
  // ==========================================
  #setupControls() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    keyboard.on('keydown-UP', () => this.#setNextDirection(0, -1));
    keyboard.on('keydown-DOWN', () => this.#setNextDirection(0, 1));
    keyboard.on('keydown-LEFT', () => this.#setNextDirection(-1, 0));
    keyboard.on('keydown-RIGHT', () => this.#setNextDirection(1, 0));

    keyboard.on('keydown-W', () => this.#setNextDirection(0, -1));
    keyboard.on('keydown-S', () => this.#setNextDirection(0, 1));
    keyboard.on('keydown-A', () => this.#setNextDirection(-1, 0));
    keyboard.on('keydown-D', () => this.#setNextDirection(1, 0));
  }

  #setNextDirection(dx, dy) {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;
    this.#player.nextDirX = dx;
    this.#player.nextDirY = dy;
  }

  // ==========================================
  // 3-2-1 COUNTDOWN
  // ==========================================
  #startCountdown() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const overlay = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05020d, 0.75)
      .setDepth(100);

    const bannerText = this.add.text(cx, cy - 60, '// VAULT INFILTRATION PROTOCOL //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const countText = this.add.text(cx, cy + 10, '3', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '76px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const steps = [
      { text: '3', color: '#00E5FF', scale: 1.5 },
      { text: '2', color: '#3FF0FF', scale: 1.5 },
      { text: '1', color: '#FFD700', scale: 1.5 },
      { text: 'BREACH VAULT!', color: '#00FF66', scale: 1.2 },
    ];

    let currentStep = 0;

    const runStep = () => {
      if (currentStep >= steps.length) {
        this.tweens.add({
          targets: [overlay, bannerText, countText],
          alpha: 0,
          duration: 250,
          onComplete: () => {
            overlay.destroy();
            bannerText.destroy();
            countText.destroy();
            this.#startGameplay();
          },
        });
        return;
      }

      const item = steps[currentStep];
      countText.setText(item.text);
      countText.setColor(item.color);
      countText.setScale(item.scale);
      countText.setAlpha(1);

      this.tweens.add({
        targets: countText,
        scale: 1,
        alpha: 0.8,
        duration: 550,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          currentStep++;
          runStep();
        },
      });
    };

    runStep();
  }

  #startGameplay() {
    this.#isPlaying = true;

    // 1-second countdown clock for 2:00
    this.#clockTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;
        this.#timeLeft--;
        this.#updateTimerDisplay();

        if (this.#timeLeft <= 0) {
          this.#triggerDefeat('TIMEOUT: SECURITY CONTAINMENT LOCKED');
        }
      },
    });
  }

  // ==========================================
  // PLAYER GRID MOVEMENT & PELLET COLLECTION
  // ==========================================
  #updatePlayer() {
    const p = this.#player;

    // Check if player is near center of current tile
    const currentTileCenterX = OFFSET_X + p.col * TILE_SIZE + TILE_SIZE / 2;
    const currentTileCenterY = OFFSET_Y + p.row * TILE_SIZE + TILE_SIZE / 2;
    const distToCenter = Phaser.Math.Distance.Between(p.x, p.y, currentTileCenterX, currentTileCenterY);

    if (distToCenter < 2.5) {
      // Snap to tile center
      p.x = currentTileCenterX;
      p.y = currentTileCenterY;

      // Try turning into queued direction if unblocked
      if (this.#canMove(p.col + p.nextDirX, p.row + p.nextDirY)) {
        p.dirX = p.nextDirX;
        p.dirY = p.nextDirY;
      }

      // Check if continuing in current direction is valid
      if (!this.#canMove(p.col + p.dirX, p.row + p.dirY)) {
        p.dirX = 0;
        p.dirY = 0;
      }
    }

    // Move player
    p.x += p.dirX * p.speed;
    p.y += p.dirY * p.speed;

    // Wrap around horizontal warp tunnel (Row 14)
    if (p.row === 14) {
      if (p.x < OFFSET_X) {
        p.x = OFFSET_X + (MAZE_COLS - 1) * TILE_SIZE;
      } else if (p.x > OFFSET_X + MAZE_COLS * TILE_SIZE) {
        p.x = OFFSET_X;
      }
    }

    // Update current tile col/row
    p.col = Math.floor((p.x - OFFSET_X) / TILE_SIZE);
    p.row = Math.floor((p.y - OFFSET_Y) / TILE_SIZE);

    // Update sprite
    this.#catSprite.setPosition(p.x, p.y);
    if (p.dirX < 0) {
      this.#catSprite.setFlipX(true);
    } else if (p.dirX > 0) {
      this.#catSprite.setFlipX(false);
    }

    // Check pellet collection at player's current tile
    this.#checkPelletCollection(p.col, p.row);
  }

  #canMove(col, row, isApe = false) {
    // Warp tunnel bounds are walkable
    if (row === 14 && (col < 0 || col >= MAZE_COLS)) return true;
    if (col < 0 || col >= MAZE_COLS || row < 0 || row >= MAZE_ROWS) return false;

    const char = MAZE_GRID[row][col];
    if (char === '#') return false;
    // Vault door '-' is only passable by apes exiting vault
    if (char === '-' && !isApe) return false;

    return true;
  }

  #checkPelletCollection(col, row) {
    for (let i = this.#pellets.length - 1; i >= 0; i--) {
      const pellet = this.#pellets[i];
      if (pellet.col === col && pellet.row === row) {
        pellet.sprite.destroy();
        this.#pellets.splice(i, 1);
        this.#pelletsLeft--;

        if (pellet.isBig) {
          // Big Corner Coin: +50 score & trigger 6s Frightened Mode
          this.#miniScore += 50;
          runState.addScore(50);
          this.#showFloatingText(pellet.x, pellet.y - 10, '+50 OVERCLOCK!', '#FFD700');
          this.#startFrightenedMode();
        } else {
          // Regular "B" Pellet: +10 score
          this.#miniScore += 10;
          runState.addScore(10);
        }

        this.#updateHUD();

        // Win condition: All pellets eaten
        if (this.#pelletsLeft <= 0) {
          this.#triggerVictory();
          return;
        }
        break;
      }
    }
  }

  // ==========================================
  // FRIGHTENED MODE (VULNERABLE APES)
  // ==========================================
  #startFrightenedMode() {
    this.#isFrightened = true;
    this.#frightenedTimer = FRIGHTENED_DURATION;

    // Tint all apes neon blue and reduce speed
    this.#apes.forEach((ape) => {
      ape.sprite.setTint(0x00B0FF);
      ape.speed = 1.1; // Slower when vulnerable
    });
  }

  #endFrightenedMode() {
    this.#isFrightened = false;
    this.#frightenedTimer = 0;

    // Clear tints and restore speed
    this.#apes.forEach((ape) => {
      ape.sprite.clearTint();
      ape.speed = 1.6;
    });
  }

  // ==========================================
  // APES (GHOSTS) AI & MOVEMENT
  // ==========================================
  #updateApes() {
    const targetCol = this.#player.col;
    const targetRow = this.#player.row;

    this.#apes.forEach((ape) => {
      const tileCenterX = OFFSET_X + ape.col * TILE_SIZE + TILE_SIZE / 2;
      const tileCenterY = OFFSET_Y + ape.row * TILE_SIZE + TILE_SIZE / 2;
      const dist = Phaser.Math.Distance.Between(ape.x, ape.y, tileCenterX, tileCenterY);

      if (dist < 2.5) {
        ape.x = tileCenterX;
        ape.y = tileCenterY;

        // Choose next direction at grid intersection
        const dirs = [
          { x: 0, y: -1 }, // Up
          { x: 0, y: 1 },  // Down
          { x: -1, y: 0 }, // Left
          { x: 1, y: 0 },  // Right
        ];

        // Valid directions excluding reverse (unless stuck)
        const validDirs = dirs.filter((d) => {
          if (d.x === -ape.dirX && d.y === -ape.dirY) return false;
          return this.#canMove(ape.col + d.x, ape.row + d.y, true);
        });

        const choices = validDirs.length > 0 ? validDirs : dirs.filter((d) => this.#canMove(ape.col + d.x, ape.row + d.y, true));

        if (choices.length > 0) {
          if (this.#isFrightened) {
            // Frightened mode: RUN AWAY (choose direction that maximizes distance to player)
            let maxDist = -1;
            let bestDir = choices[0];
            choices.forEach((d) => {
              const nc = ape.col + d.x;
              const nr = ape.row + d.y;
              const dToPlayer = Phaser.Math.Distance.Between(nc, nr, targetCol, targetRow);
              if (dToPlayer > maxDist) {
                maxDist = dToPlayer;
                bestDir = d;
              }
            });
            ape.dirX = bestDir.x;
            ape.dirY = bestDir.y;
          } else if (ape.isChaser) {
            // Chaser Apes (Ape 1 & 2): Choose direction that minimizes distance to player
            let minDist = 999999;
            let bestDir = choices[0];
            choices.forEach((d) => {
              const nc = ape.col + d.x;
              const nr = ape.row + d.y;
              const dToPlayer = Phaser.Math.Distance.Between(nc, nr, targetCol, targetRow);
              if (dToPlayer < minDist) {
                minDist = dToPlayer;
                bestDir = d;
              }
            });
            ape.dirX = bestDir.x;
            ape.dirY = bestDir.y;
          } else {
            // Random Wanderer Apes (Ape 3 & 4): Pick random valid direction
            const randomDir = Phaser.Utils.Array.GetRandom(choices);
            ape.dirX = randomDir.x;
            ape.dirY = randomDir.y;
          }
        }
      }

      // Move Ape
      ape.x += ape.dirX * ape.speed;
      ape.y += ape.dirY * ape.speed;

      // Wrap tunnel
      if (ape.row === 14) {
        if (ape.x < OFFSET_X) ape.x = OFFSET_X + (MAZE_COLS - 1) * TILE_SIZE;
        else if (ape.x > OFFSET_X + MAZE_COLS * TILE_SIZE) ape.x = OFFSET_X;
      }

      ape.col = Math.floor((ape.x - OFFSET_X) / TILE_SIZE);
      ape.row = Math.floor((ape.y - OFFSET_Y) / TILE_SIZE);
      ape.sprite.setPosition(ape.x, ape.y);
    });
  }

  #checkApeCollisions() {
    const px = this.#player.x;
    const py = this.#player.y;

    for (let i = 0; i < this.#apes.length; i++) {
      const ape = this.#apes[i];
      const dist = Phaser.Math.Distance.Between(px, py, ape.x, ape.y);

      if (dist < 14) {
        if (this.#isFrightened) {
          // Player eats vulnerable ape: +200 score & respawn ape in center VAULT
          this.#miniScore += 200;
          runState.addScore(200);
          this.#showFloatingText(ape.x, ape.y - 12, '+200 BUSTED!', '#00FF66');
          this.#updateHUD();

          // Respawn ape in center vault
          ape.col = 14;
          ape.row = 10;
          ape.x = OFFSET_X + ape.col * TILE_SIZE + TILE_SIZE / 2;
          ape.y = OFFSET_Y + ape.row * TILE_SIZE + TILE_SIZE / 2;
          ape.dirX = 0;
          ape.dirY = -1;
          ape.sprite.setPosition(ape.x, ape.y);
        } else {
          // Ape caught player -> DEFEAT
          this.#triggerDefeat('SECURITY BREACH: INTRUDER APE INTERCEPTION');
          return;
        }
      }
    }
  }

  // ==========================================
  // NEON STREAM TRAIL
  // ==========================================
  #updateTrail() {
    if (!this.#catTrailGraphics?.scene) return;
    this.#catTrailGraphics.clear();

    if (this.#catSprite?.scene) {
      this.#catTrail.push({
        x: this.#player.x - this.#player.dirX * 8,
        y: this.#player.y - this.#player.dirY * 8,
        alpha: 0.9,
      });
    }

    for (let i = this.#catTrail.length - 1; i >= 0; i--) {
      const pt = this.#catTrail[i];
      pt.alpha -= 0.05;

      if (pt.alpha <= 0) {
        this.#catTrail.splice(i, 1);
        continue;
      }

      this.#catTrailGraphics.fillStyle(0x00E5FF, pt.alpha);
      this.#catTrailGraphics.fillCircle(pt.x, pt.y, 3);
      this.#catTrailGraphics.fillStyle(0xFFFFFF, pt.alpha * 0.8);
      this.#catTrailGraphics.fillCircle(pt.x, pt.y, 1.5);
    }
  }

  #showFloatingText(x, y, message, color = '#00FF66') {
    const txt = this.add.text(x, y, message, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80);

    this.tweens.add({
      targets: txt,
      y: y - 28,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // ==========================================
  // WIN & DEFEAT OUTCOMES
  // ==========================================
  #triggerVictory() {
    if (this.#hasWon || this.#isGameOver) return;
    this.#hasWon = true;
    this.#isPlaying = false;

    this.cameras.main.flash(350, 0, 255, 100);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, 640, 160, 0x072818, 0.96)
      .setStrokeStyle(3, 0x00FF66, 1)
      .setDepth(150);

    this.add.text(cx, cy - 40, '// VAULT PROTOCOL SUCCESS //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy - 5, 'VAULT SECURED!', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '36px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy + 38, 'ALL LEDGER BLOCKS DRAINED • RETURNING TO BATTLE PROTOCOL...', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#A8FFD0',
    }).setOrigin(0.5).setDepth(151);

    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.APE_BATTLE_SCENE, {
          ...this._data,
          mode: 'win',
        });
      });
    });
  }

  #triggerDefeat(reason = 'SECURITY BREACH') {
    if (this.#isGameOver || this.#hasWon) return;
    this.#isGameOver = true;
    this.#isPlaying = false;

    this.cameras.main.shake(400, 0.025);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, 640, 160, 0x2e0617, 0.96)
      .setStrokeStyle(3, 0xFF0055, 1)
      .setDepth(150);

    this.add.text(cx, cy - 40, '// EXCEPTION: VAULT SECURITY //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FF6688',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy - 5, 'VAULT LOCKDOWN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '38px',
      color: '#FF0055',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy + 38, `${reason} • LOSING OPERATIVE LIFE...`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#FFC0D0',
    }).setOrigin(0.5).setDepth(151);

    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.APE_BATTLE_SCENE, {
          ...this._data,
          mode: 'lose',
        });
      });
    });
  }

  // ==========================================
  // DEBUG / TESTING METHODS
  // ==========================================
  getPelletsLeft() {
    return this.#pelletsLeft;
  }

  triggerFrightenedDebug() {
    this.#startFrightenedMode();
  }

  eatAllPelletsDebug() {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;
    this.#pellets.forEach((p) => p.sprite.destroy());
    this.#pellets = [];
    this.#pelletsLeft = 0;
    this.#miniScore += 500;
    runState.addScore(500);
    this.#updateHUD();
    this.#triggerVictory();
  }
}

