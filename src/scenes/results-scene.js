import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { runState } from '../state/run-state.js';
import { dataManager } from '../utils/data-manager.js';

/**
 * Generates a deterministic short hash from player credentials and final score
 * Formatted like #A7F3-91C2
 * @param {string} name
 * @param {number} runStart
 * @param {number} score
 * @returns {string}
 */
export function generateRunCode(name, runStart, score) {
  const str = `${name}_${runStart}_${score}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const p1 = ((h1 ^ (h1 >>> 16)) >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
  const p2 = ((h2 ^ (h2 >>> 16)) >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
  return `#${p1}-${p2}`;
}

export class ResultsScene extends BaseScene {
  /** @type {boolean} */
  #isConfirmed = false;
  /** @type {boolean} */
  #isVictory = false;
  /** @type {number} */
  #baseScore = 0;
  /** @type {number} */
  #finalScore = 0;
  /** @type {number} */
  #displayedScore = 0;
  /** @type {string} */
  #badge = 'NONE';
  /** @type {string} */
  #runCode = '#0000-0000';
  /** @type {Phaser.GameObjects.Text | undefined} */
  #scoreText;
  /** @type {Array<{ container: Phaser.GameObjects.Container, baseAngle: number }>} */
  #orbitBadges = [];
  /** @type {Phaser.GameObjects.Image | undefined} */
  #catSprite;

  constructor() {
    super({
      key: SCENE_KEYS.RESULTS_SCENE,
    });
  }

  create() {
    super.create();
    this.#isConfirmed = false;
    this.#orbitBadges = [];
    runState.load();

    this.cameras.main.setBackgroundColor('#060412');
    this.cameras.main.fadeIn(500);

    // 1. Victory check: all 3 districts cleared
    this.#isVictory = runState.cleared.length >= 3;
    this.#baseScore = runState.score;

    // Bonuses: victory only (+10 per second left, +300 per life left)
    const timeLeft = Math.max(0, Math.floor(runState.timeRemaining));
    const livesLeft = Math.max(0, runState.lives);
    const timeBonus = this.#isVictory ? timeLeft * 10 : 0;
    const lifeBonus = this.#isVictory ? livesLeft * 300 : 0;

    this.#finalScore = this.#baseScore + timeBonus + lifeBonus;
    this.#displayedScore = this.#baseScore;

    // Badge calculation
    if (this.#isVictory) {
      if (this.#finalScore >= 6500) {
        this.#badge = 'GOLD';
      } else if (this.#finalScore >= 4000) {
        this.#badge = 'SILVER';
      } else {
        this.#badge = 'BRONZE';
      }
    } else {
      this.#badge = 'NONE';
    }

    // Generate short hash run code
    this.#runCode = generateRunCode(runState.name, runState.runStart, this.#finalScore);

    // Save to localStorage leaderboard
    this.#saveToLeaderboard(timeLeft);

    // Decorative grid background
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1b1435, 0.4);
    for (let x = 0; x < this.scale.width; x += 32) {
      grid.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 32) {
      grid.lineBetween(0, y, this.scale.width, y);
    }

    // Top Header Banner
    const bannerBorderCol = this.#isVictory ? 0x00FF66 : 0xFF2A6D;
    const bannerHeaderCol = this.#isVictory ? '#00FF66' : '#FF2A6D';
    const bannerHeaderText = this.#isVictory ? 'NETWORK SECURED!' : 'GAME OVER';
    const bannerSubtext = this.#isVictory
      ? 'ALL 3 DISTRICT CONSENSUS NODES DEFENDED · OVERRIDE PREVENTED'
      : 'INSUFFICIENT LIVES OR TIME EXPIRED · DISTRICT INTEGRITY COMPROMISED';

    const headerBox = this.add.rectangle(this.scale.width / 2, 54, 860, 64, 0x0a061c, 0.95)
      .setStrokeStyle(2, bannerBorderCol, 1);

    this.add.text(this.scale.width / 2, 42, bannerHeaderText, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '28px',
      color: bannerHeaderCol,
      fontStyle: 'bold',
      stroke: '#04020a',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(this.scale.width / 2, 68, bannerSubtext, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#A8A4C4',
    }).setOrigin(0.5);

    // LEFT: Pedestal & Cat with spinning badges
    this.#createPedestalAndCat();

    // RIGHT: Results Card & Score Breakdown
    this.#createResultsCard(timeBonus, lifeBonus, timeLeft, livesLeft);

    // Score Counting Up Animation (if victory and bonus added)
    if (this.#finalScore > this.#baseScore) {
      this.tweens.addCounter({
        from: this.#baseScore,
        to: this.#finalScore,
        duration: 1200,
        ease: 'Power1',
        onUpdate: (tween) => {
          this.#displayedScore = Math.floor(tween.getValue());
          if (this.#scoreText) {
            this.#scoreText.setText(String(this.#displayedScore).padStart(6, '0'));
          }
        },
      });
    }

    // Bottom Action Prompt
    const actionBtn = this.add.rectangle(this.scale.width / 2, 535, 420, 42, 0x140e32, 0.95)
      .setStrokeStyle(2, 0x3FF0FF, 1)
      .setInteractive({ useHandCursor: true });

    const actionText = this.add.text(this.scale.width / 2, 535, 'VIEW THE LEDGER  ▶  [SPACE / ENTER]', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    actionBtn.on('pointerdown', () => this.#goToLeaderboard());

    this.tweens.add({
      targets: actionText,
      alpha: { from: 0.8, to: 1.0 },
      scale: { from: 0.98, to: 1.02 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(time, delta) {
    super.update(time);

    // Spin the 3 badges around the cat on the pedestal
    if (this.#isVictory && this.#orbitBadges.length > 0 && this.#catSprite) {
      const centerX = 230;
      const centerY = 315;
      const radiusX = 92;
      const radiusY = 28;
      const speed = 0.0022;

      this.#orbitBadges.forEach((item) => {
        const currentAngle = item.baseAngle + time * speed;
        const bx = centerX + Math.cos(currentAngle) * radiusX;
        const by = centerY + Math.sin(currentAngle) * radiusY;

        item.container.setPosition(bx, by);

        // 3D Depth illusion: in front of or behind the cat
        const sinVal = Math.sin(currentAngle);
        if (sinVal < 0) {
          item.container.setDepth(this.#catSprite.depth - 1);
        } else {
          item.container.setDepth(this.#catSprite.depth + 1);
        }

        // Slight scaling based on orbital depth
        const scale = 0.88 + ((sinVal + 1) / 2) * 0.24;
        item.container.setScale(scale);
      });
    }

    if (this.#isConfirmed || this._controls.isInputLocked) {
      return;
    }

    if (this._controls.wasSpaceKeyPressed() || this._controls.wasEnterKeyPressed()) {
      this.#goToLeaderboard();
    }
  }

  /**
   * Builds the podium and player cat on the left
   * @returns {void}
   */
  #createPedestalAndCat() {
    const pedX = 230;
    const pedY = 385;

    // Upward neon beam glow
    const beam = this.add.graphics();
    beam.fillStyle(this.#isVictory ? 0x00FF66 : 0xFF2A6D, 0.08);
    beam.fillTriangle(pedX - 50, pedY, pedX + 50, pedY, pedX, pedY - 180);

    // Multi-tier Pedestal
    const baseEllipse = this.add.ellipse(pedX, pedY + 12, 170, 44, 0x0b0722, 0.95)
      .setStrokeStyle(2, 0x3FF0FF, 0.9);

    const midEllipse = this.add.ellipse(pedX, pedY, 138, 36, 0x140c3c, 0.95)
      .setStrokeStyle(2, this.#isVictory ? 0x00FF66 : 0xFF3366, 1);

    const topEllipse = this.add.ellipse(pedX, pedY - 10, 106, 28, 0x1e1254, 0.95)
      .setStrokeStyle(1.5, 0x3FF0FF, 0.8);

    // Pedestal text badge
    const pedLabel = this.add.text(pedX, pedY + 14, this.#isVictory ? 'NODE SECURED' : 'SYSTEM HALT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '10px',
      color: this.#isVictory ? '#00FF66' : '#FF2A6D',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Chosen Cat on pedestal
    const catAssetKey = dataManager.getPlayerCat() || runState.hunter || 'cat-1';
    this.#catSprite = this.add.image(pedX, pedY - 10, catAssetKey)
      .setOrigin(0.5, 1.0)
      .setScale(0.5) // ~69px tall
      .setDepth(15);

    if (this.#catSprite.texture) {
      this.#catSprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    if (this.#isVictory) {
      // Gentle idle breathing
      this.tweens.add({
        targets: this.#catSprite,
        y: pedY - 13,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // 3 Spinning Badges
      const badgeData = [
        { label: 'BLOCK', color: 0x00E5FF, colorHex: '#00E5FF', symbol: '■' },
        { label: 'VAULT', color: 0xFFD700, colorHex: '#FFD700', symbol: '★' },
        { label: 'CHAIN', color: 0x00FF66, colorHex: '#00FF66', symbol: '◆' },
      ];

      badgeData.forEach((b, idx) => {
        const badgeCont = this.add.container(0, 0);

        // Glowing outer circle
        const bgCircle = this.add.circle(0, 0, 14, 0x070414, 0.95)
          .setStrokeStyle(2, b.color, 1);

        const symText = this.add.text(0, -1, b.symbol, {
          fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
          fontSize: '13px',
          color: b.colorHex,
          fontStyle: 'bold',
        }).setOrigin(0.5);

        const bTag = this.add.text(0, 17, b.label, {
          fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
          fontSize: '9px',
          color: b.colorHex,
          fontStyle: 'bold',
          stroke: '#050210',
          strokeThickness: 2,
        }).setOrigin(0.5);

        badgeCont.add([bgCircle, symText, bTag]);

        this.#orbitBadges.push({
          container: badgeCont,
          baseAngle: (idx * Math.PI * 2) / 3,
        });
      });
    } else {
      // Defeated tint
      this.#catSprite.setTint(0xFF3366).setAlpha(0.65);
    }
  }

  /**
   * Builds the results breakdown card on the right
   * @param {number} timeBonus
   * @param {number} lifeBonus
   * @param {number} timeLeft
   * @param {number} livesLeft
   * @returns {void}
   */
  #createResultsCard(timeBonus, lifeBonus, timeLeft, livesLeft) {
    const cardX = 660;
    const cardY = 300;
    const cardW = 540;
    const cardH = 370;

    // Card frame
    const cardBg = this.add.rectangle(cardX, cardY, cardW, cardH, 0x09061c, 0.96)
      .setStrokeStyle(2, 0x3FF0FF, 0.9);

    const cornerDecor = this.add.graphics();
    cornerDecor.lineStyle(1.5, this.#isVictory ? 0x00FF66 : 0xFF2A6D, 0.6);
    cornerDecor.strokeRect(cardX - cardW / 2 + 4, cardY - cardH / 2 + 4, cardW - 8, cardH - 8);

    // Final Score title
    this.add.text(cardX, cardY - 145, 'FINAL PROTOCOL SCORE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Large Gold Score Text
    const initialScoreStr = String(this.#displayedScore).padStart(6, '0');
    this.#scoreText = this.add.text(cardX, cardY - 110, initialScoreStr, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '44px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#06020c',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Divider
    const div1 = this.add.graphics();
    div1.lineStyle(1, 0x3FF0FF, 0.35);
    div1.lineBetween(cardX - 230, cardY - 75, cardX + 230, cardY - 75);

    // Breakdown Stats Rows
    const rows = [
      { label: 'BASE MISSION SCORE', value: `${this.#baseScore}` },
      { label: `TIME BONUS (+10/s · ${timeLeft}s LEFT)`, value: `+${timeBonus}` },
      { label: `LIFE BONUS (+300/♥ · ${livesLeft} LEFT)`, value: `+${lifeBonus}` },
      { label: 'DISTRICTS CLEARED', value: `${runState.cleared.length} / 3` },
      { label: 'HIDDEN TOKENS FOUND', value: `${runState.tokensFound} / 10` },
    ];

    rows.forEach((r, idx) => {
      const ry = cardY - 52 + idx * 23;
      this.add.text(cardX - 220, ry, r.label, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '12px',
        color: '#A8A4C4',
      }).setOrigin(0, 0.5);

      this.add.text(cardX + 220, ry, r.value, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '13px',
        color: '#3FF0FF',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    });

    // Divider 2
    const div2 = this.add.graphics();
    div2.lineStyle(1, 0x3FF0FF, 0.35);
    div2.lineBetween(cardX - 230, cardY + 70, cardX + 230, cardY + 70);

    // Badge Display Pill
    const badgeColors = {
      GOLD: { bg: 0x332605, border: 0xFFD700, text: '#FFD700', icon: '★ GOLD BADGE' },
      SILVER: { bg: 0x1f242d, border: 0xD9E2EC, text: '#D9E2EC', icon: '★ SILVER BADGE' },
      BRONZE: { bg: 0x2b1c13, border: 0xCD7F32, text: '#CD7F32', icon: '★ BRONZE BADGE' },
      NONE: { bg: 0x15121e, border: 0x555566, text: '#777292', icon: '— NO BADGE EARNED' },
    };
    const bInfo = badgeColors[this.#badge] || badgeColors.NONE;

    const badgePill = this.add.rectangle(cardX - 115, cardY + 115, 205, 40, bInfo.bg, 0.95)
      .setStrokeStyle(2, bInfo.border, 1);

    this.add.text(cardX - 115, cardY + 115, bInfo.icon, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: bInfo.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Run Code Monospace Box
    const codeBox = this.add.rectangle(cardX + 115, cardY + 115, 205, 40, 0x0c0822, 0.95)
      .setStrokeStyle(1.5, 0x00E5FF, 0.8);

    this.add.text(cardX + 115, cardY + 106, 'RUN VERIFICATION', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '9px',
      color: '#8E8AAB',
    }).setOrigin(0.5);

    this.add.text(cardX + 115, cardY + 124, this.#runCode, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#00FFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  /**
   * Persists run results into localStorage leaderboard
   * @param {number} timeLeft
   * @returns {void}
   */
  #saveToLeaderboard(timeLeft) {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('CHAIN_HEIST_LEADERBOARD');
      const leaderboard = raw ? JSON.parse(raw) : [];

      const entry = {
        name: runState.name || 'ANON_HUNTER',
        hunter: runState.hunter || 'cat-1',
        score: this.#finalScore,
        cleared: runState.cleared.length,
        timeLeft: timeLeft,
        badge: this.#badge,
        runCode: this.#runCode,
        date: new Date().toISOString(),
      };

      leaderboard.push(entry);
      leaderboard.sort((a, b) => b.score - a.score);

      localStorage.setItem('CHAIN_HEIST_LEADERBOARD', JSON.stringify(leaderboard.slice(0, 50)));
      localStorage.setItem('CHAIN_HEIST_LAST_RUN_CODE', this.#runCode);
    } catch (err) {
      console.warn('[ResultsScene] Failed to save to leaderboard', err);
    }
  }

  /**
   * Transitions to Leaderboard scene
   * @returns {void}
   */
  #goToLeaderboard() {
    this.#isConfirmed = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.LEADERBOARD_SCENE);
    });
  }
}
