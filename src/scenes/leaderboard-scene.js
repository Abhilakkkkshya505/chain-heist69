import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { runState } from '../state/run-state.js';
import { dataManager } from '../utils/data-manager.js';
import { DATA_MANAGER_STORE_KEYS } from '../utils/data-manager.js';

const HUNTER_COLORS = {
  'cat-1': '#00FFFF', // Cyan
  'cat-2': '#FF00FF', // Magenta
  'cat-3': '#B366FF', // Violet
  'cat-4': '#FFD700', // Gold
};

const DEFAULT_SEEDS = [
  { name: 'SATOSHI', hunter: 'cat-4', score: 8500, badge: 'GOLD', runCode: '#0000-B1TC', cleared: 3 },
  { name: 'HAL_FINNEY', hunter: 'cat-1', score: 7100, badge: 'GOLD', runCode: '#4A21-F900', cleared: 3 },
  { name: 'NICK_SZABO', hunter: 'cat-3', score: 5800, badge: 'SILVER', runCode: '#7BC3-A1E2', cleared: 3 },
  { name: 'VITALIK', hunter: 'cat-2', score: 4950, badge: 'SILVER', runCode: '#E701-44B8', cleared: 3 },
  { name: 'CYPHERPUNK', hunter: 'cat-1', score: 3850, badge: 'BRONZE', runCode: '#C982-10F3', cleared: 3 },
];

export class LeaderboardScene extends BaseScene {
  /** @type {boolean} */
  #isConfirmed = false;

  constructor() {
    super({
      key: SCENE_KEYS.LEADERBOARD_SCENE,
    });
  }

  create() {
    super.create();
    this.#isConfirmed = false;

    this.cameras.main.setBackgroundColor('#060412');
    this.cameras.main.fadeIn(500);

    const width = this.scale.width;
    const height = this.scale.height;

    // Background Grid
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1b1435, 0.4);
    for (let x = 0; x < width; x += 32) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 32) {
      grid.lineBetween(0, y, width, y);
    }

    // Top Header
    const headerBox = this.add.rectangle(width / 2, 48, 860, 56, 0x09051c, 0.96)
      .setStrokeStyle(2, 0x3FF0FF, 1);

    this.add.text(width / 2, 38, 'THE LEDGER', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '28px',
      color: '#3FF0FF',
      fontStyle: 'bold',
      stroke: '#04020a',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(width / 2, 60, 'IMMUTABLE CONSENSUS ARCHIVE // TOP 10 OPERATIVE RUNS', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#A8A4C4',
    }).setOrigin(0.5);

    // Retrieve and prepare leaderboard data
    const lastRunCode = (typeof localStorage !== 'undefined')
      ? localStorage.getItem('CHAIN_HEIST_LAST_RUN_CODE')
      : null;

    let entries = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('CHAIN_HEIST_LEADERBOARD');
        entries = raw ? JSON.parse(raw) : [];
      } catch {
        entries = [];
      }
    }

    // Merge seed entries if total count is small
    if (entries.length < 5) {
      DEFAULT_SEEDS.forEach((seed) => {
        if (!entries.some((e) => e.name === seed.name)) {
          entries.push(seed);
        }
      });
    }

    entries.sort((a, b) => b.score - a.score);
    const top10 = entries.slice(0, 10);

    // Table Container
    const tableX = width / 2;
    const tableStartY = 110;
    const tableW = 860;
    const rowH = 34;

    // Table Header Row
    const headY = tableStartY;
    this.add.rectangle(tableX, headY, tableW, 28, 0x110b2e, 0.9)
      .setStrokeStyle(1.5, 0x3FF0FF, 0.6);

    const cols = [
      { text: 'RANK', x: tableX - 390, align: 0 },
      { text: 'OPERATIVE', x: tableX - 290, align: 0 },
      { text: 'HUNTER', x: tableX - 110, align: 0 },
      { text: 'SCORE', x: tableX + 70, align: 1 },
      { text: 'BADGE', x: tableX + 210, align: 0.5 },
      { text: 'RUN CODE', x: tableX + 380, align: 1 },
    ];

    cols.forEach((c) => {
      this.add.text(c.x, headY, c.text, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '12px',
        color: '#FFD700',
        fontStyle: 'bold',
      }).setOrigin(c.align, 0.5);
    });

    // Table Data Rows
    top10.forEach((entry, idx) => {
      const ry = tableStartY + 32 + idx * rowH;
      const isNewRun = lastRunCode && entry.runCode === lastRunCode;

      // Row background
      const rowBgCol = isNewRun ? 0x22134a : (idx % 2 === 0 ? 0x0c0722 : 0x080418);
      const rowBorderCol = isNewRun ? 0x00FFFF : 0x1b1435;
      const rowBorderWidth = isNewRun ? 2 : 1;

      const rowBox = this.add.rectangle(tableX, ry, tableW, rowH - 4, rowBgCol, 0.95)
        .setStrokeStyle(rowBorderWidth, rowBorderCol, isNewRun ? 1.0 : 0.6);

      if (isNewRun) {
        // Pulsing glow on the newly completed run row
        this.tweens.add({
          targets: rowBox,
          alpha: { from: 0.82, to: 1.0 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // 1. Rank (#1 gets crown 👑)
      let rankText = `#${idx + 1}`;
      let rankColor = '#A8A4C4';
      if (idx === 0) {
        rankText = `👑 #1`;
        rankColor = '#FFD700';
      } else if (idx === 1) {
        rankText = ` #2`;
        rankColor = '#D9E2EC';
      } else if (idx === 2) {
        rankText = ` #3`;
        rankColor = '#CD7F32';
      }

      this.add.text(tableX - 390, ry, rankText, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: idx === 0 ? '15px' : '13px',
        color: rankColor,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      // 2. Operative Name in hunter colour
      const hunterColor = HUNTER_COLORS[entry.hunter] || '#00FFFF';
      const nameStr = (entry.name || 'ANON').toUpperCase();
      this.add.text(tableX - 290, ry, nameStr, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '14px',
        color: hunterColor,
        fontStyle: 'bold',
        stroke: '#050210',
        strokeThickness: 2,
      }).setOrigin(0, 0.5);

      // 3. Hunter unit code
      const unitKey = (entry.hunter || 'cat-1').toUpperCase();
      this.add.text(tableX - 110, ry, unitKey, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '11px',
        color: '#8E8AAB',
      }).setOrigin(0, 0.5);

      // 4. Score in gold
      const scoreStr = String(entry.score).padStart(6, '0');
      this.add.text(tableX + 70, ry, scoreStr, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '15px',
        color: '#FFD700',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      // 5. Badge
      const badgeColors = {
        GOLD: '#FFD700',
        SILVER: '#D9E2EC',
        BRONZE: '#CD7F32',
      };
      const badgeText = entry.badge && entry.badge !== 'NONE' ? entry.badge : '—';
      const badgeColor = badgeColors[entry.badge] || '#555566';

      this.add.text(tableX + 210, ry, badgeText, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '12px',
        color: badgeColor,
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);

      // 6. Run Code
      const codeStr = entry.runCode || '#0000-0000';
      this.add.text(tableX + 380, ry, codeStr, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '12px',
        color: '#00E5FF',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      // New run tag
      if (isNewRun) {
        const newBadge = this.add.text(tableX - 215, ry, '▶ NEW', {
          fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
          fontSize: '9px',
          color: '#00FF66',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.tweens.add({
          targets: newBadge,
          alpha: { from: 0.3, to: 1 },
          duration: 400,
          yoyo: true,
          repeat: -1,
        });
      }
    });

    // Footer instruction: ENTER = new player (resets the run and goes back to the title)
    const btnY = 510;
    const newPlayerBtn = this.add.rectangle(tableX, btnY, 480, 42, 0x140e32, 0.95)
      .setStrokeStyle(2, 0x3FF0FF, 1)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(tableX, btnY, '[ENTER] NEW PLAYER · RESET RUN & RETURN TO TITLE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    newPlayerBtn.on('pointerdown', () => this.#resetAndReturnToTitle());

    this.tweens.add({
      targets: btnText,
      alpha: { from: 0.8, to: 1.0 },
      scale: { from: 0.98, to: 1.02 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update() {
    super.update();
    if (this.#isConfirmed || this._controls.isInputLocked) {
      return;
    }

    if (this._controls.wasEnterKeyPressed() || this._controls.wasSpaceKeyPressed()) {
      this.#resetAndReturnToTitle();
    }
  }

  /**
   * Resets run state and transitions cleanly back to Title Scene for a new player
   * @returns {void}
   */
  #resetAndReturnToTitle() {
    this.#isConfirmed = true;

    // Reset global run state to defaults
    runState.resetToDefaults();
    runState.save();

    // Reset game started flag so new game flow triggers fresh name/hunter selection
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.GAME_STARTED, false);

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.TITLE_SCENE);
    });
  }
}

