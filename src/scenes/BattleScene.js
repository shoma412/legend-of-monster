import * as Phaser from 'phaser';
import { M1_ROOM, SCREEN } from '../data/balance.js';
import { COLORS, FONTS } from '../data/theme.js';
import { createWorld, updateWorld } from '../game/world.js';
import { drawEnemies, drawFloor, drawFx, drawHud, drawPlayer, drawShots } from '../render/draw.js';

const MAX_STEP = 1 / 30; // 処理落ちしても1コマでこれ以上は進めない
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 戦闘画面。M1 では確認用の1部屋だけ。
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    const { width: W, height: H } = SCREEN;
    this.world = createWorld({ weaponId: 'greatsword', waves: M1_ROOM.waves });
    if (import.meta.env.DEV) window.__world = this.world;

    this.floor = this.add.graphics();
    drawFloor(this.floor);
    this.gfx = this.add.graphics();
    this.hud = this.add.graphics().setScrollFactor(0);
    this.floatTexts = [];
    this.addBloom();

    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,ENTER,ESC');
    this.dashPressed = false;
    this.attackPressed = false;
    this.keys.SHIFT.on('down', () => { this.dashPressed = true; });
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown()) this.attackPressed = true;
    });
    this.keys.ENTER.on('down', () => {
      if (this.world.mode !== 'play') this.scene.restart();
    });
    this.keys.ESC.on('down', () => this.scene.start('Title'));

    const label = { fontFamily: FONTS.display, fontStyle: '500', fontSize: '11px', color: COLORS.dim };
    this.add.text(40, 7, 'HP', label);
    this.hpText = this.add.text(250, 7, '', { ...label, color: COLORS.ink });
    this.add.text(326, 7, 'DASH', label);
    this.add.text(446, 6, '溜め斬り', { ...label, fontFamily: FONTS.body });
    this.waveText = this.add.text(W - 40, 5, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '14px', color: COLORS.cyan }).setOrigin(1, 0);
    this.add.text(W / 2, H - 14, 'WASD 移動　マウス 向き　左クリック 攻撃　左クリック長押し 溜め斬り　Shift ダッシュ　Esc タイトルへ', {
      fontFamily: FONTS.body, fontSize: '12px', color: COLORS.dim,
    }).setOrigin(0.5);

    // 死亡・クリアの表示
    this.overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.7).setVisible(false);
    this.resultTitle = this.add.text(W / 2, H / 2 - 40, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '44px' }).setOrigin(0.5).setVisible(false);
    this.resultSub = this.add.text(W / 2, H / 2 + 24, '', { fontFamily: FONTS.body, fontSize: '16px', color: COLORS.ink, align: 'center', lineSpacing: 8 }).setOrigin(0.5).setVisible(false);
  }

  // 線画をぼかして重ね、ネオンがにじんで光るように見せる。対応していない環境ではそのまま描く
  addBloom() {
    try {
      const bloom = this.gfx.enableFilters().filters.internal.addParallelFilters();
      bloom.top.addBlur(1, 2, 2, 1.4);
      bloom.blend.blendMode = Phaser.BlendModes.ADD;
    } catch (err) {
      console.warn('bloom unavailable', err);
    }
  }

  readInput() {
    const k = this.keys;
    const pointer = this.input.activePointer;
    const input = {
      mx: (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0),
      my: (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0),
      aimX: pointer.worldX,
      aimY: pointer.worldY,
      attack: pointer.leftButtonDown(),
      attackPressed: this.attackPressed,
      dashPressed: this.dashPressed,
    };
    this.dashPressed = false;
    this.attackPressed = false;
    return input;
  }

  update(_time, delta) {
    const world = this.world;
    updateWorld(world, Math.min(delta / 1000, MAX_STEP), this.readInput());

    const g = this.gfx;
    g.clear();
    drawFx(g, world);
    drawEnemies(g, world);
    drawShots(g, world);
    drawPlayer(g, world);
    this.hud.clear();
    drawHud(this.hud, world);
    this.syncFloatTexts(world.fx.texts);

    const p = world.player;
    this.hpText.setText(`${Math.ceil(p.hp)} / ${p.stats.maxHp}`);
    const wave = Math.max(1, world.wave + 1);
    this.waveText.setText(`WAVE ${wave}/${world.waves.length}　敵 ${world.enemies.length}　撃破 ${world.kills}`);

    const shake = reduceMotion ? 0 : world.fx.shake;
    this.cameras.main.setScroll((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (world.mode !== 'play' && !this.overlay.visible) this.showResult(world);
  }

  // ダメージ数字。Text を使い回す
  syncFloatTexts(texts) {
    while (this.floatTexts.length < texts.length) {
      this.floatTexts.push(this.add.text(0, 0, '', { fontFamily: FONTS.display, fontStyle: '700' }).setOrigin(0.5).setDepth(5));
    }
    this.floatTexts.forEach((obj, i) => {
      const t = texts[i];
      if (!t) return obj.setVisible(false);
      obj.setVisible(true).setText(t.text).setColor(t.color).setFontSize(t.size).setPosition(t.x, t.y).setAlpha(Math.min(1, (t.life / t.max) * 2));
    });
  }

  showResult(world) {
    const dead = world.mode === 'dead';
    const color = dead ? COLORS.red : COLORS.green;
    this.overlay.setVisible(true).setDepth(10);
    this.resultTitle.setText(dead ? 'SIGNAL LOST' : '区画制圧').setColor(color).setShadow(0, 0, color, 16, false, true).setVisible(true).setDepth(11);
    this.resultSub.setText(`撃破 ${world.kills}\nENTER：もう一度　　ESC：タイトルへ`).setVisible(true).setDepth(11);
  }
}
