import * as Phaser from 'phaser';
import { SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, FONTS, hex } from '../data/theme.js';
import { chooseImplant } from '../game/build.js';
import { interact, useKit } from '../game/objects.js';
import { createRun, currentArea, enterRoom, leaveRoom } from '../game/run.js';
import { updateWorld } from '../game/world.js';
import { xpToNext } from '../logic/level.js';
import {
  drawBolts, drawBossBar, drawBossTelegraph, drawEnemies, drawFloor, drawFx, drawHazards, drawHud, drawLoot, drawPlayer, drawShots, drawZones,
} from '../render/draw.js';
import { drawObjects, drawRoomIcon, focusGear, focusPrompt, objectLabels } from '../render/objects.js';
import { areaOverview } from '../logic/areaGen.js';
import { createBuildList, createChoicePanel, createCommLog, createComparePanel } from './battleUi.js';

const MAX_STEP = 1 / 30; // 処理落ちしても1コマでこれ以上は進めない
const CHOICE_LOCK = 450; // 3択が出てから選べるようになるまで（ミリ秒）。攻撃の連打で誤って選ばないため
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 戦闘画面。1部屋ごとに作り直し、ラン（src/game/run.js）が部屋をまたいで進行を持つ。
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  // run: 続きのラン。省略すると新しいランを始める
  init(data) {
    this.run = data?.run ?? createRun();
  }

  create() {
    const { width: W, height: H } = SCREEN;
    const run = this.run;
    this.area = currentArea(run);
    this.world = enterRoom(run);
    this.roomDef = DATA.rooms.get(this.world.room.type);
    if (import.meta.env.DEV) window.__world = this.world;

    this.floor = this.add.graphics();
    drawFloor(this.floor);
    this.gfx = this.add.graphics();
    this.hud = this.add.graphics().setScrollFactor(0);
    this.floatTexts = [];
    this.labelTexts = [];
    this.addBloom();

    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,ENTER,ESC,E,Q,ONE,TWO,THREE,B');
    this.dashPressed = false;
    this.attackPressed = false;
    this.choiceShownAt = 0;
    this.keys.SHIFT.on('down', () => { this.dashPressed = true; });
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown() && !this.world.choice) this.attackPressed = true;
    });
    this.keys.E.on('down', () => interact(this.world));
    this.keys.Q.on('down', () => useKit(this.world));
    ['ONE', 'TWO', 'THREE'].forEach((name, i) => this.keys[name].on('down', () => this.choose(i)));
    this.keys.ENTER.on('down', () => {
      const world = this.world;
      if (world.choice) return;
      // 死んだとき、エリアの最後までクリアしたときは、新しいランを始める
      if (world.mode === 'dead' || (world.mode === 'clear' && world.boss)) this.scene.restart({});
    });
    this.keys.ESC.on('down', () => this.scene.start('Title'));
    // 確認用のキー（開発中の画面だけ。公開版では効かない）：ボス部屋へ飛ぶ
    if (import.meta.env.DEV) {
      this.keys.B.on('down', () => {
        if (run.plan.current === 'boss') return;
        run.plan.pool = [];
        leaveRoom(run, this.world, 'boss');
        this.scene.restart({ run });
      });
    }

    const label = { fontFamily: FONTS.display, fontStyle: '500', fontSize: '11px', color: COLORS.dim };
    this.add.text(40, 7, 'HP', label);
    this.hpText = this.add.text(250, 7, '', { ...label, color: COLORS.ink });
    this.add.text(326, 7, 'DASH', label);
    this.add.text(446, 6, '溜め斬り', { ...label, fontFamily: FONTS.body });
    this.levelText = this.add.text(580, 7, '', { ...label, color: COLORS.magenta, fontStyle: '700' });
    this.kitText = this.add.text(690, 6, '', { ...label, fontFamily: FONTS.body, color: COLORS.green });
    this.creditText = this.add.text(782, 7, '', { ...label, color: COLORS.amber, fontStyle: '700' });
    this.waveText = this.add.text(W - 40, H - 46, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '12px', color: COLORS.cyan }).setOrigin(1, 0).setAlpha(0.85);
    const devHelp = import.meta.env.DEV ? '　｜　確認用：B ボス部屋へ' : '';
    this.add.text(W / 2, H - 14, `WASD 移動　左クリック 攻撃／長押しで溜め斬り　Shift ダッシュ　E 調べる・拾う・進む　Q 修復キット　Esc タイトル${devHelp}`, {
      fontFamily: FONTS.body, fontSize: '12px', color: COLORS.dim,
    }).setOrigin(0.5);

    this.bossName = this.add.text(W / 2, H - 66, '', { fontFamily: FONTS.body, fontStyle: '700', fontSize: '14px', color: COLORS.ink }).setOrigin(0.5).setVisible(false);
    // 近くのものを調べるときの案内
    this.promptText = this.add.text(W / 2, H - 50, '', { fontFamily: FONTS.body, fontStyle: '700', fontSize: '14px', color: COLORS.ink })
      .setOrigin(0.5).setDepth(7).setVisible(false);
    // 部屋をクリアしたあとの案内。装備を拾えるように、画面は止めない
    this.clearText = this.add.text(W / 2, 64, '', { fontFamily: FONTS.body, fontStyle: '700', fontSize: '16px', color: COLORS.green, align: 'center', lineSpacing: 6 })
      .setOrigin(0.5, 0).setShadow(0, 0, COLORS.green, 10, false, true).setDepth(7).setVisible(false);

    this.buildList = createBuildList(this);
    this.comparePanel = createComparePanel(this);
    this.choicePanel = createChoicePanel(this, (i) => this.choose(i));
    this.commLog = createCommLog(this);
    this.showSectorBanner();
    this.createBossWarning();
    this.bossIntroDone = false;
    this.clearShown = false;

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

  // 部屋に入ったときの区画名（例：SECTOR 01-2 // 下層スラム // 闇市）
  showSectorBanner() {
    const { width: W } = SCREEN;
    const color = COLORS[this.roomDef.color];
    const text = `${this.area.code}-${this.run.plan.step + 1} // ${this.area.name} // ${this.roomDef.tag}`;
    const banner = this.add.text(W / 2, 46, text, { fontFamily: FONTS.body, fontStyle: '700', fontSize: '15px', color })
      .setOrigin(0.5).setShadow(0, 0, color, 10, false, true).setDepth(7).setAlpha(0);
    this.tweens.chain({
      targets: banner,
      tweens: [
        { alpha: 1, duration: 200 },
        { alpha: 1, duration: 1800 },
        { alpha: 0, duration: 600 },
      ],
    });
  }

  // ボス登場の警告と異名
  createBossWarning() {
    this.bossWarning = null;
    const bossId = this.world.room.waves[0]?.boss;
    if (!bossId) return;
    const { width: W, height: H } = SCREEN;
    const def = DATA.bosses.get(bossId);
    const title = this.add.text(W / 2, H / 2 - 44, 'WARNING', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '56px', color: COLORS.red })
      .setOrigin(0.5).setShadow(0, 0, COLORS.red, 18, false, true).setDepth(9);
    const sub = this.add.text(W / 2, H / 2 + 14, `大型反応：${def.name} — ${def.alias}`, { fontFamily: FONTS.body, fontStyle: '700', fontSize: '18px', color: COLORS.ink })
      .setOrigin(0.5).setDepth(9);
    if (!reduceMotion) this.tweens.add({ targets: title, alpha: 0.3, duration: 220, yoyo: true, repeat: -1 });
    this.bossWarning = [title, sub];
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

    // 扉を選んだら次の部屋へ
    if (world.exit) {
      leaveRoom(this.run, world, world.exit);
      this.scene.restart({ run: this.run });
      return;
    }

    const g = this.gfx;
    g.clear();
    drawBossTelegraph(g, world);
    drawZones(g, world);
    drawObjects(g, world);
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
    this.drawRoomMap();
    this.syncTexts(this.floatTexts, world.fx.texts, 5);
    this.syncTexts(this.labelTexts, objectLabels(world), 6);

    const p = world.player;
    const boss = world.boss;
    this.hpText.setText(`${Math.ceil(p.hp)} / ${p.stats.maxHp}`);
    this.levelText.setText(`Lv ${p.build.level}　${p.build.xp}/${xpToNext(p.build.level)}`);
    this.kitText.setText(`修復キット ×${p.build.kits}`);
    this.creditText.setText(`${p.build.credits} c`);
    const fighting = world.mode === 'play' && !boss && world.waves.length > 0;
    this.waveText.setVisible(fighting).setText(`WAVE ${Math.max(1, world.wave + 1)}/${world.waves.length}　敵 ${world.enemies.length}`);

    this.buildList.update(p.build);
    this.comparePanel.update(world.choice ? null : focusGear(world), p.build.gear);
    this.choicePanel.update(world.choice, p.build);
    const prompt = world.choice ? null : focusPrompt(world);
    this.promptText.setVisible(!!prompt);
    if (prompt) this.promptText.setText(prompt.text).setColor(prompt.color);

    this.updateBossPresentation(boss);
    this.commLog.update(delta);

    const shake = reduceMotion ? 0 : world.fx.shake;
    this.cameras.main.setScroll((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (world.mode === 'dead' && !this.overlay.visible) this.showDeath();
    if (world.mode === 'clear' && !this.clearShown) this.showClear(boss);
  }

  // ボスの登場（警告を消して名前と通信を出す）と撃破
  updateBossPresentation(boss) {
    if (!boss || this.bossIntroDone || boss.spawnT > 0) return;
    this.bossIntroDone = true;
    this.bossWarning?.forEach((t) => t.destroy());
    this.bossName.setText(`${boss.def.name} — ${boss.def.alias}`).setVisible(true);
    this.commLog.play(this.area.comms.bossIntro);
  }

  showClear(boss) {
    this.clearShown = true;
    const world = this.world;
    if (boss) {
      this.commLog.play(this.area.comms.bossDefeated);
      this.clearText.setText(`${boss.def.name} 撃破 — ${this.area.code} CLEAR\nENTER：新しいランを始める（この先のエリアは準備中）`).setVisible(true);
    } else if (world.room.waves.length > 0) {
      const bonus = world.room.clearCredits > 0 ? `　+${Math.round(world.room.clearCredits * world.player.stats.creditMul)} c` : '';
      this.clearText.setText(`区画制圧${bonus}　｜　右の扉を選んで進め`).setVisible(true);
      this.tweens.add({ targets: this.clearText, alpha: 0, delay: 3500, duration: 600 });
    }
  }

  // エリアのマップ（右上）。通った部屋は暗い緑、今いる部屋は枠つき、この先の部屋は種類の色で出す。
  // この先の部屋は好きな順に通れる。最後がボス
  drawRoomMap() {
    const g = this.hud;
    const nodes = areaOverview(this.run.plan);
    const gap = 21;
    const x0 = SCREEN.width - 44 - (nodes.length - 1) * gap;
    const y = 14;
    nodes.forEach((node, i) => {
      const x = x0 + i * gap;
      if (node.state === 'current') g.lineStyle(1, hex(COLORS.ink), 0.9).strokeRect(x - 9, y - 9, 18, 18);
      drawRoomIcon(g, node.type, x, y, 5, node.state === 'done' ? 0x2f6b4c : null);
    });
  }

  // 文字の一覧を画面に出す。Text を使い回す。items: [{ x, y, text, color, size, life?, max? }]
  syncTexts(pool, items, depth) {
    while (pool.length < items.length) {
      pool.push(this.add.text(0, 0, '', { fontFamily: FONTS.body, fontStyle: '700' }).setOrigin(0.5).setDepth(depth));
    }
    pool.forEach((obj, i) => {
      const t = items[i];
      if (!t) return obj.setVisible(false);
      const alpha = t.max ? Math.min(1, (t.life / t.max) * 2) : 1;
      obj.setVisible(true).setText(t.text).setColor(t.color).setFontSize(t.size).setAlpha(alpha);
      // 画面の端で文字が切れないように寄せる
      const half = obj.width / 2 + 32;
      obj.setPosition(Math.max(half, Math.min(SCREEN.width - half, t.x)), t.y);
    });
  }

  showDeath() {
    this.overlay.setVisible(true);
    this.resultTitle.setText('SIGNAL LOST').setColor(COLORS.red).setShadow(0, 0, COLORS.red, 16, false, true).setVisible(true);
    this.resultSub.setText('装備・レベル・インプラントは失われた\nENTER：新しいランを始める　　ESC：タイトルへ').setVisible(true);
  }
}
