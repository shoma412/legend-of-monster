import * as Phaser from 'phaser';
import { ROOM, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, FONTS, hex } from '../data/theme.js';
import { chooseImplant } from '../game/build.js';
import { useItem } from '../game/consumables.js';
import { interact, useKit } from '../game/objects.js';
import { NEXT_AREA, createRun, currentArea, enterRoom, finishRun, handleEvents, hasNextArea, leaveRoom, skipToBoss } from '../game/run.js';
import { getSave, persist } from '../game/saveStore.js';
import { updateWorld } from '../game/world.js';
import { nodeState } from '../logic/areaGen.js';
import { xpToNext } from '../logic/level.js';
import {
  ITEM_SLOT_POS, drawArena, drawBolts, drawBossBar, drawGearIcons, drawBossTelegraph, drawEnemies, drawFloor, drawFx, drawHazards, drawHud, drawLoot, drawPlayer, drawPlayerShots, drawShots,
  drawZones,
} from '../render/draw.js';
import { drawAreaMap, nodePosition } from '../render/areaMap.js';
import { drawObjects, focusGear, focusPrompt, objectLabels } from '../render/objects.js';
import { createBuildList, createChoicePanel, createCommLog, createComparePanel, createToasts } from './battleUi.js';
import { MenuOverlay } from './menuOverlay.js';

const MAX_STEP = 1 / 30; // 処理落ちしても1コマでこれ以上は進めない
const CHOICE_LOCK = 450; // 3択が出てから選べるようになるまで（ミリ秒）。攻撃の連打で誤って選ばないため
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 戦闘画面。1部屋ごとに作り直し、ラン（src/game/run.js）が部屋をまたいで進行を持つ。
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  // run: 続きのラン。省略すると、weaponId の武器で新しいランを始める
  init(data) {
    this.fresh = !data?.run;
    this.run = data?.run ?? createRun({ weaponId: data?.weaponId ?? 'greatsword', save: getSave() });
  }

  create() {
    const { width: W, height: H } = SCREEN;
    const run = this.run;
    this.area = currentArea(run);
    this.world = enterRoom(run);
    this.roomDef = DATA.rooms.get(this.world.room.type);
    if (import.meta.env.DEV) window.__world = this.world;

    this.floor = this.add.graphics();
    drawFloor(this.floor, this.area.theme);
    this.gfx = this.add.graphics();
    this.hud = this.add.graphics().setScrollFactor(0);
    this.floatTexts = [];
    this.labelTexts = [];
    this.addBloom();

    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,ENTER,E,Q,M,ONE,TWO,THREE,B,N');
    this.dashPressed = false;
    this.attackPressed = false;
    this.specialPressed = false;
    this.choiceShownAt = 0;
    this.keys.SHIFT.on('down', () => { this.dashPressed = true; });
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (this.world.choice || this.menu.isOpen) return;
      if (pointer.leftButtonDown()) this.attackPressed = true;
      if (pointer.rightButtonDown()) this.specialPressed = true;
    });
    // ポーズ画面が開いている間は、ゲームの操作を受け付けない
    const playing = () => !this.menu.isOpen;
    this.keys.E.on('down', () => playing() && interact(this.world));
    this.keys.Q.on('down', () => playing() && useKit(this.world));
    this.keys.M.on('down', () => playing() && this.bigMap.setVisible(!this.bigMap.visible));
    // 1・2・3：レベルアップの3択が出ていればその選択、出ていなければ 1・2 で消耗品を使う
    ['ONE', 'TWO', 'THREE'].forEach((name, i) => this.keys[name].on('down', () => {
      if (this.menu.isOpen) return;
      if (this.world.choice) this.choose(i);
      else if (i < this.world.player.build.items.length) {
        const pointer = this.input.activePointer;
        useItem(this.world, i, { x: pointer.worldX, y: pointer.worldY });
      }
    }));
    this.keys.ENTER.on('down', () => {
      const world = this.world;
      if (world.choice || this.menu.isOpen) return;
      // ランが終わっていたら、リザルトを見てから隠れ家へ帰る
      if (!this.run.outcome) return;
      if (this.overlay.visible) this.scene.start('Hideout');
      else this.showResult();
    });
    // Esc（または Tab）：ポーズ画面。ステータスや装備の詳細を見られる。隠れ家に戻るのもここから
    this.menu = new MenuOverlay(this, {
      title: 'PAUSE',
      tabs: ['status', 'upgrade', 'record', 'fragment', 'achievement'],
      readOnlyUpgrades: true,
      actions: [
        { label: '再開する（Esc）', color: COLORS.green, run: () => this.menu.close() },
        {
          label: '隠れ家に戻る',
          color: COLORS.amber,
          run: () => this.menu.confirm('今回の進捗はリセットされますが、よろしいですか？\n（装備・レベル・インプラント・クレジットを失います）', () => this.scene.start('Hideout')),
        },
      ],
      context: () => ({ save: this.run.save, player: this.world.player }),
      // レベルアップの3択が出ているときと、リザルトが出ているときは開かない
      canOpen: () => !this.world.choice && !this.overlay.visible,
    });
    // 確認用のキー（開発中の画面だけ。公開版では効かない）：ボス部屋へ飛ぶ
    if (import.meta.env.DEV) {
      this.keys.B.on('down', () => {
        if (run.plan.current === 'boss' || this.menu.isOpen) return;
        skipToBoss(run, this.world);
        this.scene.restart({ run });
      });
      // 確認用：次のエリアへ飛ぶ
      this.keys.N.on('down', () => {
        if (!hasNextArea(run) || this.menu.isOpen) return;
        leaveRoom(run, this.world, NEXT_AREA);
        this.scene.restart({ run });
      });
    }

    const label = { fontFamily: FONTS.display, fontStyle: '500', fontSize: '11px', color: COLORS.dim };
    this.add.text(40, 4, 'HP', label);
    this.hpText = this.add.text(250, 4, '', { ...label, color: COLORS.ink });
    // 経験値ゲージの左にレベル、右に数字
    this.levelText = this.add.text(40, 17, '', { ...label, color: COLORS.magenta, fontStyle: '700' });
    this.xpText = this.add.text(250, 17, '', { ...label, fontSize: '10px' });
    this.add.text(326, 9, 'DASH', label);
    const weapon = this.world.player.weapon;
    // 特殊アクションの名前（長い名前は縮めて、クールダウンの棒に重ならないようにする）
    this.add.text(510, 8, weapon.special.name, { ...label, fontFamily: FONTS.body }).setOrigin(1, 0);
    this.kitText = this.add.text(600, 8, '', { ...label, fontFamily: FONTS.body, color: COLORS.green });
    // 消耗品の枠：キーの番号と個数
    this.itemTexts = this.world.player.build.items.map((_, i) => {
      const bx = ITEM_SLOT_POS.x + i * ITEM_SLOT_POS.gap;
      this.add.text(bx + 2, ITEM_SLOT_POS.y, `${i + 1}`, { ...label, fontSize: '10px', color: COLORS.dim }).setDepth(6);
      return this.add.text(bx + ITEM_SLOT_POS.size - 2, ITEM_SLOT_POS.y + ITEM_SLOT_POS.size - 1, '', { ...label, fontSize: '10px', color: COLORS.ink, fontStyle: '700' }).setOrigin(1, 1).setDepth(6);
    });
    this.creditText = this.add.text(700, 9, '', { ...label, color: COLORS.amber, fontStyle: '700' });
    this.waveText = this.add.text(W - 40, H - 46, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '12px', color: COLORS.cyan }).setOrigin(1, 0).setAlpha(0.85);
    const devHelp = import.meta.env.DEV ? '　｜　確認用：B ボス部屋　N 次のエリア' : '';
    const help = this.add.text(W / 2, H - 14, `WASD 移動　左クリック 攻撃　${weapon.special.hint}　Shift ダッシュ　E 調べる・拾う　Q 修復キット　1・2 アイテム　M 地図　Esc ポーズ${devHelp}`, {
      fontFamily: FONTS.body, fontSize: '12px', color: COLORS.dim,
    }).setOrigin(0.5);
    // 長くて画面からはみ出すときは、収まるように縮める
    if (help.width > W - 24) help.setScale((W - 24) / help.width);

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
    this.toasts = createToasts(this);
    // 出撃した時点で解除された実績など、ラン開始時の通知
    if (this.fresh) {
      this.run.gained.notes.forEach((note) => this.toasts.push(note));
      persist();
    }
    this.createBigMap();
    this.countText = this.add.text(W / 2, H / 2 - 20, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '110px', color: COLORS.cyan })
      .setOrigin(0.5).setShadow(0, 0, COLORS.cyan, 24, false, true).setDepth(9).setVisible(false);
    this.countWasOn = false;
    this.showSectorBanner();
    this.createBossWarning();
    this.bossIntroDone = false;
    this.clearShown = false;

    // リザルト（死亡したとき、最後まで進んだとき）
    this.overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.7).setVisible(false).setDepth(10);
    this.resultTitle = this.add.text(W / 2, H / 2 - 40, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '44px' }).setOrigin(0.5).setVisible(false).setDepth(11);
    this.resultTitle.setY(96);
    this.resultSub = this.add.text(W / 2, 150, '', { fontFamily: FONTS.body, fontSize: '15px', color: COLORS.ink, align: 'center', lineSpacing: 9 }).setOrigin(0.5, 0).setVisible(false).setDepth(11);
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
    const banner = this.add.text(W / 2, ROOM.wallTop + 18, text, { fontFamily: FONTS.body, fontStyle: '700', fontSize: '15px', color })
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
    if (this.menu.isOpen) return;
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
      specialPressed: this.specialPressed,
      dashPressed: this.dashPressed,
    };
    this.dashPressed = false;
    this.attackPressed = false;
    this.specialPressed = false;
    return input;
  }

  update(_time, delta) {
    const world = this.world;
    // ポーズ画面が開いている間は、ゲームを止める
    if (this.menu.isOpen) {
      this.readInput();
      return;
    }
    const hadChoice = !!world.choice;
    updateWorld(world, Math.min(delta / 1000, MAX_STEP), this.readInput());
    if (world.choice && !hadChoice) this.choiceShownAt = this.time.now;

    // ボス素材・データ片・実績。手に入った時点でセーブする
    const notes = handleEvents(this.run, world);
    if (notes.length > 0) {
      notes.forEach((note) => this.toasts.push(note));
      persist();
    }
    this.toasts.update(delta);

    // 扉を選んだら次の部屋へ
    if (world.exit) {
      leaveRoom(this.run, world, world.exit);
      this.scene.restart({ run: this.run });
      return;
    }

    const g = this.gfx;
    g.clear();
    drawArena(g, world);
    drawBossTelegraph(g, world);
    drawZones(g, world);
    drawObjects(g, world);
    drawLoot(g, world);
    drawFx(g, world);
    drawHazards(g, world);
    drawEnemies(g, world);
    drawPlayerShots(g, world);
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
    this.levelText.setText(`Lv ${p.build.level}`);
    this.xpText.setText(`${p.build.xp} / ${xpToNext(p.build.level)}`);
    p.build.items.forEach((slot, i) => this.itemTexts[i].setText(slot && slot.count > 1 ? `×${slot.count}` : ''));
    drawGearIcons(this.hud, world, SCREEN.width - 44, ROOM.wallTop + 15, 15);
    this.kitText.setText(`修復キット ×${p.build.kits}`);
    this.creditText.setText(`${p.build.credits} c`);
    const fighting = world.mode === 'play' && !boss && world.waves.length > 0 && world.countdown <= 0;
    this.waveText.setVisible(fighting).setText(`WAVE ${Math.max(1, world.wave + 1)}/${world.waves.length}　敵 ${world.enemies.length}`);

    this.buildList.update(p.build);
    this.comparePanel.update(world.choice ? null : focusGear(world), p.build.gear);
    this.choicePanel.update(world.choice, p.build);
    const prompt = world.choice ? null : focusPrompt(world);
    this.promptText.setVisible(!!prompt);
    if (prompt) this.promptText.setText(prompt.text).setColor(prompt.color);

    this.updateCountdown();
    this.updateBossPresentation(boss);
    this.commLog.update(delta);

    const shake = reduceMotion ? 0 : world.fx.shake;
    this.cameras.main.setScroll((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (world.mode === 'dead' && !this.run.outcome) {
      finishRun(this.run, world, 'dead');
      persist();
      this.showResult();
    }
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
      if (hasNextArea(this.run)) {
        // 次のエリアへの扉が開く
        this.clearText.setText(`${boss.def.name} 撃破 — ${this.area.code} CLEAR\nHP全回復。右の扉から次のエリアへ`).setVisible(true);
      } else {
        // 今あるエリアを最後まで進んだ
        finishRun(this.run, world, this.area.final ? 'clear' : 'areaClear');
        persist();
        const note = this.area.final ? '' : '（この先のエリアは準備中）';
        this.clearText.setText(`${boss.def.name} 撃破 — ${this.area.code} CLEAR\n装備を見終わったら ENTER：帰還する${note}`).setVisible(true);
      }
    } else if (world.room.waves.length > 0) {
      const bonus = world.room.clearCredits > 0 ? `　+${Math.round(world.room.clearCredits * world.player.stats.creditMul)} c` : '';
      this.clearText.setText(`区画制圧${bonus}　｜　右の扉を選んで進め`).setVisible(true);
      this.tweens.add({ targets: this.clearText, alpha: 0, delay: 3500, duration: 600 });
    }
  }

  // エリアの地図（右上）。線でつながった部屋にだけ進める。白い枠が今いる部屋
  drawRoomMap() {
    const plan = this.run.plan;
    const colGap = 22;
    drawAreaMap(this.hud, plan, { x: SCREEN.width - 44 - (plan.columns - 1) * colGap, y: 15.5, colGap, rowGap: 14, icon: 4, line: 1, bg: 0x16122a });
  }

  // M キーで出す大きい地図。部屋の中では地図は変わらないので、最初に1回だけ描く
  createBigMap() {
    const { width: W, height: H } = SCREEN;
    const plan = this.run.plan;
    const bg = 0x110f1d;
    const layout = { x: W / 2 - ((plan.columns - 1) * 120) / 2, y: H / 2 + 6, colGap: 120, rowGap: 120, icon: 13, line: 2, bg };
    const c = this.add.container(0, 0).setDepth(15).setVisible(false);
    const panel = this.add.rectangle(W / 2, H / 2, 660, 330, bg, 0.96).setStrokeStyle(1, hex(COLORS.cyan));
    const g = this.add.graphics();
    drawAreaMap(g, plan, layout);
    const title = this.add.text(W / 2, H / 2 - 146, `${this.area.code} // ${this.area.name} — MAP`, { fontFamily: FONTS.body, fontStyle: '700', fontSize: '15px', color: COLORS.cyan }).setOrigin(0.5);
    const note = this.add.text(W / 2, H / 2 + 146, '白い枠＝今いる部屋　明るい線＝進める道　暗い部屋＝もう行けない　｜　M で閉じる', { fontFamily: FONTS.body, fontSize: '12px', color: COLORS.dim }).setOrigin(0.5);
    c.add([panel, g, title, note]);
    for (const node of Object.values(plan.nodes)) {
      const pos = nodePosition(node, layout);
      const room = DATA.rooms.get(node.type);
      // 通った部屋と、もう行けない部屋の名前は暗くする
      const state = nodeState(plan, node.id);
      const color = state === 'off' ? '#4a4470' : state === 'done' ? '#2f6b4c' : COLORS[room.color];
      c.add(this.add.text(pos.x, pos.y + 26, room.label, { fontFamily: FONTS.body, fontStyle: '700', fontSize: '12px', color }).setOrigin(0.5));
    }
    this.bigMap = c;
  }

  // ランの最初の部屋のカウントダウン（3, 2, 1）
  updateCountdown() {
    const left = this.world.countdown;
    if (left > 0) {
      const step = ROOM.startCountdown.step;
      const n = Math.ceil(left / step);
      const k = (left % step) / step; // 1→0 で1つぶん進む
      this.countText.setVisible(true).setText(`${n}`).setScale(1 + 0.5 * k).setAlpha(0.35 + 0.65 * k);
      this.countWasOn = true;
    } else if (this.countWasOn) {
      this.countWasOn = false;
      this.countText.setText('GO').setScale(1).setAlpha(1);
      this.tweens.add({ targets: this.countText, alpha: 0, scale: 1.6, duration: 450, onComplete: () => this.countText.setVisible(false) });
    }
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

  // リザルト：到達した場所、撃破数、持ち帰ったもの
  showResult() {
    const run = this.run;
    const dead = run.outcome === 'dead';
    const color = dead ? COLORS.red : COLORS.green;
    const g = run.gained;
    const names = (ids, registry, key) => (ids.length > 0 ? ids.map((id) => registry.get(id)[key]).join('、') : 'なし');
    const materials = Object.entries(g.materials).map(([id, n]) => `${DATA.materials.get(id).name} ×${n}`).join('　') || 'なし';
    const lines = [
      `到達　${this.area.code}-${run.plan.step + 1}（${this.area.name}／${this.roomDef.label}）`,
      `撃破数　${run.kills}`,
      '',
      `持ち帰ったボス素材　${materials}`,
      `新しいデータ片　${names(g.fragments, DATA.fragments, 'title')}`,
      `解除した実績　${names(g.achievements, DATA.achievements, 'name')}`,
      '',
      dead ? '装備・レベル・インプラント・クレジットは失われた' : 'ラン中の装備・レベル・インプラント・クレジットは持ち帰れない',
      'ENTER：隠れ家へ',
    ];
    this.bigMap.setVisible(false);
    this.overlay.setVisible(true).setFillStyle(0x07060d, 0.86);
    this.clearText.setVisible(false);
    this.resultTitle.setText(dead ? 'SIGNAL LOST' : 'MISSION COMPLETE').setColor(color).setShadow(0, 0, color, 16, false, true).setVisible(true);
    this.resultSub.setText(lines.join('\n')).setVisible(true);
  }
}
