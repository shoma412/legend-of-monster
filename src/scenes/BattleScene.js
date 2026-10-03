import * as Phaser from 'phaser';
import { SCREEN, TEST_STAGES } from '../data/balance.js';
import { COLORS, FONTS } from '../data/theme.js';
import { chooseImplant, equipFocusLoot } from '../game/build.js';
import { createWorld, updateWorld } from '../game/world.js';
import { xpToNext } from '../logic/level.js';
import {
  drawBolts, drawBossBar, drawBossTelegraph, drawEnemies, drawFloor, drawFx, drawHazards, drawHud, drawLoot, drawPlayer, drawShots, drawZones,
} from '../render/draw.js';
import { createBuildList, createChoicePanel, createComparePanel } from './battleUi.js';

const MAX_STEP = 1 / 30; // 処理落ちしても1コマでこれ以上は進めない
const CHOICE_LOCK = 450; // 3択が出てから選べるようになるまで（ミリ秒）。攻撃の連打で誤って選ばないため
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 戦闘画面。今は確認用に「雑魚の部屋 → ボス部屋」の2つだけ（M4 で部屋生成に置き換える）。
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  // stage: TEST_STAGES の名前 / carry: 前の部屋から引き継ぐもの { hp, build }
  init(data) {
    this.stage = data.stage ?? 'room';
    this.carry = data.carry ?? null;
  }

  create() {
    const { width: W, height: H } = SCREEN;
    this.world = createWorld({ weaponId: 'greatsword', waves: TEST_STAGES[this.stage].waves, carry: this.carry });
    if (import.meta.env.DEV) window.__world = this.world;

    this.floor = this.add.graphics();
    drawFloor(this.floor);
    this.gfx = this.add.graphics();
    this.hud = this.add.graphics().setScrollFactor(0);
    this.floatTexts = [];
    this.addBloom();

    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,ENTER,ESC,E,ONE,TWO,THREE,B');
    this.dashPressed = false;
    this.attackPressed = false;
    this.choiceShownAt = 0;
    this.keys.SHIFT.on('down', () => { this.dashPressed = true; });
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown() && !this.world.choice) this.attackPressed = true;
    });
    this.keys.E.on('down', () => equipFocusLoot(this.world));
    ['ONE', 'TWO', 'THREE'].forEach((name, i) => this.keys[name].on('down', () => this.choose(i)));
    this.keys.ENTER.on('down', () => {
      const world = this.world;
      if (world.choice) return;
      const p = world.player;
      if (world.mode === 'clear' && this.stage === 'room') this.scene.restart({ stage: 'boss', carry: { hp: p.hp, build: p.build } });
      else if (world.mode !== 'play') this.scene.restart({ stage: 'room' });
    });
    // 確認用のキー（M4 で部屋がつながったら外す）
    this.keys.B.on('down', () => {
      const p = this.world.player;
      this.scene.restart({ stage: 'boss', carry: { hp: p.stats.maxHp, build: p.build } });
    });
    this.keys.ESC.on('down', () => this.scene.start('Title'));

    const label = { fontFamily: FONTS.display, fontStyle: '500', fontSize: '11px', color: COLORS.dim };
    this.add.text(40, 7, 'HP', label);
    this.hpText = this.add.text(250, 7, '', { ...label, color: COLORS.ink });
    this.add.text(326, 7, 'DASH', label);
    this.add.text(446, 6, '溜め斬り', { ...label, fontFamily: FONTS.body });
    this.levelText = this.add.text(580, 7, '', { ...label, color: COLORS.magenta, fontStyle: '700' });
    this.waveText = this.add.text(W - 40, 5, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '14px', color: COLORS.cyan }).setOrigin(1, 0);
    this.add.text(W / 2, H - 14, 'WASD 移動　左クリック 攻撃／長押しで溜め斬り　Shift ダッシュ　E 装備を付け替える　Esc タイトル　｜　確認用：B ボス部屋へ', {
      fontFamily: FONTS.body, fontSize: '12px', color: COLORS.dim,
    }).setOrigin(0.5);

    this.bossName = this.add.text(W / 2, H - 66, '', { fontFamily: FONTS.body, fontStyle: '700', fontSize: '14px', color: COLORS.ink }).setOrigin(0.5).setVisible(false);
    // 部屋をクリアしたあとの案内。装備を拾えるように、画面は止めない
    this.clearText = this.add.text(W / 2, H - 92, '', { fontFamily: FONTS.body, fontStyle: '700', fontSize: '16px', color: COLORS.green })
      .setOrigin(0.5).setShadow(0, 0, COLORS.green, 10, false, true).setDepth(7).setVisible(false);

    this.buildList = createBuildList(this);
    this.comparePanel = createComparePanel(this);
    this.choicePanel = createChoicePanel(this, (i) => this.choose(i));

    // 死亡の表示
    this.overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.7).setVisible(false).setDepth(10);
    this.resultTitle = this.add.text(W / 2, H / 2 - 40, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '44px' }).setOrigin(0.5).setVisible(false).setDepth(11);
    this.resultSub = this.add.text(W / 2, H / 2 + 24, '', { fontFamily: FONTS.body, fontSize: '16px', color: COLORS.ink, align: 'center', lineSpacing: 8 }).setOrigin(0.5).setVisible(false).setDepth(11);
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

  choose(index) {
    if (!this.world.choice || this.time.now - this.choiceShownAt < CHOICE_LOCK) return;
    chooseImplant(this.world, index);
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
    const hadChoice = !!world.choice;
    updateWorld(world, Math.min(delta / 1000, MAX_STEP), this.readInput());
    if (world.choice && !hadChoice) this.choiceShownAt = this.time.now;

    const g = this.gfx;
    g.clear();
    drawBossTelegraph(g, world);
    drawZones(g, world);
    drawLoot(g, world);
    drawFx(g, world);
    drawHazards(g, world);
    drawEnemies(g, world);
    drawShots(g, world);
    drawBolts(g, world);
    drawPlayer(g, world);
    this.hud.clear();
    drawHud(this.hud, world);
    drawBossBar(this.hud, world);
    const boss = world.boss;
    if (boss && boss.spawnT <= 0 && !this.bossName.visible) this.bossName.setText(boss.def.name).setVisible(true);
    this.syncFloatTexts(world.fx.texts);

    const p = world.player;
    this.hpText.setText(`${Math.ceil(p.hp)} / ${p.stats.maxHp}`);
    this.levelText.setText(`Lv ${p.build.level}　${p.build.xp}/${xpToNext(p.build.level)}`);
    const wave = Math.max(1, world.wave + 1);
    this.waveText.setText(boss ? 'BOSS' : `WAVE ${wave}/${world.waves.length}　敵 ${world.enemies.length}　撃破 ${world.kills}`);

    this.buildList.update(p.build);
    this.comparePanel.update(world.choice ? null : world.focusLoot, p.build.gear);
    this.choicePanel.update(world.choice, p.build);

    const shake = reduceMotion ? 0 : world.fx.shake;
    this.cameras.main.setScroll((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (world.mode === 'dead' && !this.overlay.visible) this.showDeath();
    if (world.mode === 'clear' && !this.clearText.visible) {
      const head = boss ? `${boss.def.name} 撃破` : '区画制圧';
      const next = boss ? 'ENTER：最初の部屋へ（装備は失う）' : 'ENTER：ボス部屋へ';
      this.clearText.setText(`${head}　｜　装備を拾ったら ${next}`).setVisible(true);
    }
  }

  // ダメージ数字。Text を使い回す
  syncFloatTexts(texts) {
    while (this.floatTexts.length < texts.length) {
      this.floatTexts.push(this.add.text(0, 0, '', { fontFamily: FONTS.body, fontStyle: '700' }).setOrigin(0.5).setDepth(5));
    }
    this.floatTexts.forEach((obj, i) => {
      const t = texts[i];
      if (!t) return obj.setVisible(false);
      obj.setVisible(true).setText(t.text).setColor(t.color).setFontSize(t.size).setPosition(t.x, t.y).setAlpha(Math.min(1, (t.life / t.max) * 2));
    });
  }

  showDeath() {
    this.overlay.setVisible(true);
    this.resultTitle.setText('SIGNAL LOST').setColor(COLORS.red).setShadow(0, 0, COLORS.red, 16, false, true).setVisible(true);
    this.resultSub.setText('装備・レベル・インプラントは失われた\nENTER：最初の部屋からやり直す　　ESC：タイトルへ').setVisible(true);
  }
}
