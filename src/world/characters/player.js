import { CHARACTER_ASSET_KEYS } from '../../assets/asset-keys.js';
import { DIRECTION } from '../../common/direction.js';
import { Character } from './character.js';
import { getTargetPositionFromGameObjectPositionAndDirection } from '../../utils/grid-utils.js';
import { TILE_SIZE } from '../../config.js';
import { dataManager } from '../../utils/data-manager.js';

/**
 * @typedef PlayerConfigProps
 * @type {object}
 * @property {Phaser.Tilemaps.TilemapLayer} collisionLayer
 * @property {Phaser.Tilemaps.ObjectLayer} [entranceLayer]
 * @property {(entranceName: string, entranceId: string, isBuildingEntrance: boolean) => void} enterEntranceCallback
 */

/**
 * @typedef {Omit<import('./character').CharacterConfig, 'assetKey' | 'idleFrameConfig'> & PlayerConfigProps} PlayerConfig
 */

export class Player extends Character {
  /** @type {Phaser.Tilemaps.ObjectLayer | undefined} */
  #entranceLayer;
  /** @type {(entranceName: string, entranceId: string, isBuildingEntrance: boolean) => void} */
  #enterEntranceCallback;
  /** @type {Phaser.GameObjects.Image} */
  #catVisual;
  /** @type {Phaser.GameObjects.Ellipse} */
  #shadow;

  /**
   * @param {PlayerConfig} config
   */
  constructor(config) {
    super({
      ...config,
      assetKey: CHARACTER_ASSET_KEYS.PLAYER,
      origin: { x: 0, y: 0.2 },
      idleFrameConfig: {
        DOWN: 7,
        UP: 1,
        NONE: 7,
        LEFT: 10,
        RIGHT: 4,
      },
    });
    this.#entranceLayer = config.entranceLayer;
    this.#enterEntranceCallback = config.enterEntranceCallback;

    // Hide original humanoid spritesheet
    this._phaserGameObject.setAlpha(0);

    // Chosen cat single-frame unit (crisp 46px tall, inside 64px tile, feet at bottom-centre)
    const catAssetKey = dataManager.getPlayerCat();
    this.#catVisual = this._scene.add
      .image(config.position.x + 32, config.position.y + 62, catAssetKey)
      .setOrigin(0.5, 1.0)
      .setScale(1 / 3)
      .setDepth(this._phaserGameObject.depth + 2);

    if (this.#catVisual.texture) {
      this.#catVisual.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // Soft oval shadow under character: ~28x8 px, black at 35% opacity
    this.#shadow = this._scene.add
      .ellipse(config.position.x + 32, config.position.y + 62, 28, 8, 0x000000, 0.35)
      .setDepth(this._phaserGameObject.depth - 1);

    // Ensure visual and shadow are cleaned up if base object is destroyed
    this._phaserGameObject.on(Phaser.GameObjects.Events.DESTROY, () => {
      if (this.#catVisual && this.#catVisual.scene) {
        this.#catVisual.destroy();
      }
      if (this.#shadow && this.#shadow.scene) {
        this.#shadow.destroy();
      }
    });
  }

  /**
   * @param {import('../../common/direction.js').Direction} direction
   * @param {boolean} [isRunning=false]
   * @returns {void}
   */
  moveCharacter(direction, isRunning = false) {
    super.moveCharacter(direction, isRunning);

    // Flip cat horizontally for left/right motion
    if (this._direction === DIRECTION.LEFT) {
      this.#catVisual.setFlipX(true);
    } else if (this._direction === DIRECTION.RIGHT) {
      this.#catVisual.setFlipX(false);
    }

    // Validate entrance collision if not moving
    if (!this._isMoving && this.#entranceLayer !== undefined) {
      const targetPosition = getTargetPositionFromGameObjectPositionAndDirection(
        { x: this._phaserGameObject.x, y: this._phaserGameObject.y },
        this._direction
      );
      const nearbyEntrance = this.#entranceLayer.objects.find((object) => {
        if (!object.x || !object.y) {
          return false;
        }
        return object.x === targetPosition.x && object.y - TILE_SIZE === targetPosition.y;
      });

      if (!nearbyEntrance) {
        return;
      }

      const entranceName = nearbyEntrance.properties.find((property) => property.name === 'connects_to').value;
      const entranceId = nearbyEntrance.properties.find((property) => property.name === 'entrance_id').value;
      const isBuildingEntrance =
        nearbyEntrance.properties.find((property) => property.name === 'is_building')?.value || false;
      this.#enterEntranceCallback(entranceName, entranceId, isBuildingEntrance);
    }
  }

  /** @type {Phaser.GameObjects.Image} */
  get catVisual() {
    return this.#catVisual;
  }

  /**
   * @param {DOMHighResTimeStamp} time
   * @returns {void}
   */
  update(time) {
    // 1px bob while moving, stationary when idle
    const bobOffset = this._isMoving ? (Math.floor(time / 140) % 2 === 0 ? -1 : 0) : 0;

    this.#catVisual.setPosition(
      this._phaserGameObject.x + 32,
      this._phaserGameObject.y + 62 + bobOffset
    );
    this.#shadow.setPosition(
      this._phaserGameObject.x + 32,
      this._phaserGameObject.y + 62
    );
    this.#catVisual.setDepth(this._phaserGameObject.depth + 2);
    this.#shadow.setDepth(this._phaserGameObject.depth - 1);

    // Maintain flip state
    if (this._direction === DIRECTION.LEFT) {
      this.#catVisual.setFlipX(true);
    } else if (this._direction === DIRECTION.RIGHT) {
      this.#catVisual.setFlipX(false);
    }
  }
}
