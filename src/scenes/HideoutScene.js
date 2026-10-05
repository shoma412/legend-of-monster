import * as Phaser from 'phaser';
import { playBgm, playSe, unlockAudio } from '../audio/audio.js';
import { ROOM, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { brief } from '../data/story.js';
import { COLORS, ELEMENT_COLORS, FONTS, hex } from '../data/theme.js';
import { weaponUnlocks } from '../data/upgrades.js';
import { recalcStats } from '../game/build.js';
import { floatText, ring } from '../game/fx.js';
import { interact } from '../game/objects.js';
import { currentSlot, getSave, persist } from '../game/saveStore.js';
import { createWorld, updateWorld } from '../game/world.js';
import { canAfford, permanentBonuses, unlockWeapon } from '../logic/meta.js';
import { createBuild } from '../logic/stats.js';
import { drawFloor, drawFrame, drawFx, drawPlayer, drawPlayerShots } from '../render/draw.js';
import { drawMaterialIcon } from '../render/metaIcons.js';
import { drawObjects, focusPrompt, objectLabels } from '../render/objects.js';
import { renderScale, setupView } from '../render/view.js';
import { MenuOverlay, costText } from './menuOverlay.js';

const W = SCREEN.width;
const H = SCREEN.height;
const MAX_STEP = 1 / 30;
const LOCKED = '#4a4470';

// 隠れ家（拠点）。歩き回れる部屋で、置いてあるものに近づいて E で使う。
//   武器ラック：出撃する武器を選ぶ（未解放ならボス素材で解放）
//   強化端末：恒久強化を買う / 記録端末：記録・データ片・実績を見る
//   出撃ゲート：依頼文を確かめて出撃する
export class HideoutScene extends Phaser.Scene {
  constructor() {
    super('Hideout');
  }

  create() {
    this.save = getSave();
    // 選んでいた武器がまだ使えるか確かめる
    if (!this.usable(this.save.selected)) this.save.selected = 'greatsword';

    const bonus = permanentBonuses(this.save);
    const room = { type: 'hideout', waves: [], objects: this.buildStations(), doors: [], clearCredits: 0 };
    this.world = createWorld({ weaponId: this.save.selected, room, carry: { hp: null, build: createBuild(bonus) } });
    if (import.meta.env.DEV) window.__world = this.world;
    setupView(this);
    this.cameras.main.fadeIn(200, 7, 6, 13);
    unlockAudio(this);
    playBgm('hideout');

    drawFloor(this.add.graphics(), 'hideout', 7);
    this.gfx = this.add.graphics();
    this.frame = this.add.graphics();
    this.labelTexts = [];
    this.floatTexts = [];
    try {
      const bloom = this.gfx.enableFilters().filters.internal.addParallelFilters();
      bloom.top.addBlur(1, 2 * renderScale(), 2 * renderScale(), 1.4);
      bloom.blend.blendMode = Phaser.BlendModes.ADD;
    } catch (err) {
      console.warn('bloom unavailable', err);
    }

    drawFrame(this.frame, 'hideout');
    this.materialGfx = this.add.graphics();

    const body = (size, color, extra = {}) => ({ fontFamily: FONTS.body, fontSize: `${size}px`, color, ...extra });
    this.add.text(40, 7, 'HIDEOUT // 隠れ家', body(13, COLORS.cyan, { fontStyle: '700' }));
    this.materialText = this.add.text(W - 40, 7, '', body(13, COLORS.ink, { fontStyle: '700' })).setOrigin(1, 0);
    this.refreshStations();
    this.add.text(W / 2, H - 14, `WASD 移動　E 調べる・選ぶ　左クリック 攻撃・右クリック 特殊（試し斬り）　Shift ダッシュ　Esc メニュー${import.meta.env.DEV ? '　｜　確認用：U 武器を全解放' : ''}`, body(12, COLORS.dim)).setOrigin(0.5);
    this.promptText = this.add.text(W / 2, H - 50, '', body(14, COLORS.ink, { fontStyle: '700' })).setOrigin(0.5).setDepth(7).setVisible(false);

    // 依頼文（出撃ゲートに近づくと出る）
    this.briefPanel = this.add.container(W - 330, 60).setDepth(8).setVisible(false);
    const briefText = this.add.text(14, 38, brief.lines.join('\n'), body(12, COLORS.ink, { lineSpacing: 8, wordWrap: { width: 250, useAdvancedWrap: true } }));
    this.briefPanel.add([
      this.add.rectangle(0, 0, 278, briefText.height + 54, 0x110f1d, 0.94).setOrigin(0).setStrokeStyle(1, hex(COLORS.amber)),
      this.add.text(14, 12, brief.title, body(15, COLORS.amber, { fontStyle: '700' })),
      briefText,
    ]);

    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,U');
    this.dashPressed = false;
    this.attackPressed = false;
    this.specialPressed = false;
    // 確認用のキー（開発中の画面だけ。公開版では効かない）：武器をすべて解放する
    if (import.meta.env.DEV) {
      this.keys.U.on('down', () => {
        for (const w of weaponUnlocks) if (!this.save.weapons.includes(w.weapon)) this.save.weapons.push(w.weapon);
        persist();
        this.refreshStations();
      });
    }
    this.keys.SHIFT.on('down', () => { this.dashPressed = true; });
    this.keys.E.on('down', () => {
      if (!this.menu.isOpen) interact(this.world);
    });
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (this.menu.isOpen) return;
      if (pointer.leftButtonDown()) this.attackPressed = true;
      if (pointer.rightButtonDown()) this.specialPressed = true;
    });

    this.menu = new MenuOverlay(this, {
      title: 'HIDEOUT',
      tabs: ['upgrade', 'record', 'fragment', 'achievement', 'controls', 'settings'],
      actions: [
        { label: '閉じる（Esc）', run: () => this.menu.close() },
        {
          label: 'タイトルへ戻る',
          color: COLORS.dim,
          // 進行状況は自動で保存されているが、戻る前に一度確かめる
          run: () => this.menu.confirm(`タイトルに戻りますか？\n進行状況は DATA ${currentSlot()} に保存されています。`, () => this.scene.start('Title')),
        },
      ],
      context: () => ({ save: this.save, player: this.world.player }),
      onBuy: () => {
        persist();
        this.applyUpgrades();
      },
      onClose: () => this.refreshStations(),
    });

    // このセーブデータで初めて隠れ家に来たときは、操作説明を出す
    if (!this.save.tutorialSeen) {
      this.save.tutorialSeen = true;
      persist();
      this.time.delayedCall(350, () => this.menu.open('controls'));
    }
  }

  usable(weaponId) {
    return this.save.weapons.includes(weaponId) && DATA.weapons.has(weaponId);
  }

  // 部屋に置くもの。見た目と名前は refreshStations で今の状態に合わせる
  buildStations() {
    const stations = weaponUnlocks.map((w, i) => ({ kind: 'station', id: `weapon:${w.weapon}`, icon: 'weapon', weapon: w.weapon, x: 240 + i * 150, y: 150, r: 52 }));
    stations.push({ kind: 'station', id: 'menu:upgrade', icon: 'terminal', color: COLORS.green, label: '強化端末', sub: '恒久強化', prompt: 'E：恒久強化を買う', x: 240, y: 400, r: 52 });
    stations.push({ kind: 'station', id: 'menu:record', icon: 'terminal', color: COLORS.magenta, label: '記録端末', sub: '記録・データ片・実績', prompt: 'E：記録・データ片・実績を見る', x: 440, y: 400, r: 52 });
    stations.push({ kind: 'station', id: 'sortie', icon: 'gate', color: COLORS.amber, label: '出撃', x: W - ROOM.wall, y: H / 2, r: 62 });
    return stations;
  }

  // 武器ラックと出撃ゲートの表示を、今のセーブデータに合わせる
  refreshStations() {
    const save = this.save;
    for (const o of this.world.objects) {
      if (o.icon === 'weapon') {
        const def = weaponUnlocks.find((w) => w.weapon === o.weapon);
        const owned = save.weapons.includes(o.weapon);
        const ready = def.ready !== false;
        o.label = def.name;
        o.selected = save.selected === o.weapon;
        if (o.selected) Object.assign(o, { color: COLORS.cyan, sub: '選択中', prompt: `${def.name}：${def.note}（選択中）` });
        else if (owned) Object.assign(o, { color: COLORS.ink, sub: '使える', prompt: `E：${def.name}を選ぶ（${def.note}）` });
        else if (!ready) Object.assign(o, { color: LOCKED, sub: '準備中', prompt: `${def.name}（${def.note}）：準備中。解放には ${costText(def.cost)}` });
        else Object.assign(o, { color: canAfford(save, def.cost) ? COLORS.amber : LOCKED, sub: costText(def.cost), prompt: `E：${def.name}を解放する（${costText(def.cost)}）` });
      } else if (o.icon === 'gate') {
        o.prompt = `E：出撃する（${weaponUnlocks.find((w) => w.weapon === save.selected).name}）`;
      }
    }
    // 持っているボス素材（アイコンつき）。右から順に並べる
    this.materialText.setText('');
    this.materialLabels?.forEach((t) => t.destroy());
    this.materialLabels = [];
    const mg = this.materialGfx;
    mg.clear();
    let mx = W - 40;
    for (const m of [...DATA.materials.all()].reverse()) {
      const color = materialColor(m);
      const t = this.add.text(mx, 8, `${m.name} ×${save.materials[m.id] ?? 0}`, { fontFamily: FONTS.body, fontSize: '13px', fontStyle: '700', color }).setOrigin(1, 0);
      this.materialLabels.push(t);
      drawMaterialIcon(mg, m.id, mx - t.width - 12, 16, 7, hex(color));
      mx -= t.width + 38;
    }
  }

  // 買った恒久強化を、隠れ家の中のキャラにもすぐ反映する（二重ダッシュなどを試せる）
  applyUpgrades() {
    const p = this.world.player;
    p.build.permanent = permanentBonuses(this.save).effects;
    recalcStats(p);
    p.hp = p.stats.maxHp;
    p.dashCharges = p.stats.dashCharges;
  }

  // E で調べたものの処理
  handleRequest(id) {
    const world = this.world;
    const p = world.player;
    if (id === 'sortie') {
      playSe('door');
      this.scene.start('Battle', { weaponId: this.save.selected });
      return;
    }
    if (id.startsWith('menu:')) {
      this.menu.open(id.slice(5));
      return;
    }
    const weaponId = id.slice('weapon:'.length);
    const def = weaponUnlocks.find((w) => w.weapon === weaponId);
    if (!this.save.weapons.includes(weaponId)) {
      if (def.ready === false) {
        floatText(world, p.x, p.y - 30, '準備中', COLORS.dim, 14);
        playSe('deny');
        return;
      }
      if (!unlockWeapon(this.save, weaponId)) {
        floatText(world, p.x, p.y - 30, '素材が足りない', COLORS.red, 14);
        playSe('deny');
        return;
      }
      floatText(world, p.x, p.y - 30, `${def.name}を解放した`, COLORS.amber, 14);
    }
    if (this.usable(weaponId)) {
      this.save.selected = weaponId;
      p.weapon = DATA.weapons.get(weaponId);
      p.attack = null;
      p.charge = null;
      p.guard = null;
      p.comboStep = 0;
      ring(world, p.x, p.y, 44, COLORS.cyan);
      floatText(world, p.x, p.y - 48, `${def.name}を選んだ`, COLORS.cyan, 14);
      playSe('equip');
    }
    persist();
    this.refreshStations();
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
    if (this.menu.isOpen) {
      this.readInput(); // 開いている間の入力は捨てる
      return;
    }
    updateWorld(world, Math.min(delta / 1000, MAX_STEP), this.readInput());
    world.events.length = 0;
    for (const name of world.fx.sounds.splice(0)) playSe(name);
    if (world.request) {
      const id = world.request;
      world.request = null;
      this.handleRequest(id);
      if (!this.scene.isActive()) return;
    }

    const g = this.gfx;
    g.clear();
    drawObjects(g, world);
    drawFx(g, world);
    drawPlayerShots(g, world);
    drawPlayer(g, world);
    this.syncTexts(this.floatTexts, world.fx.texts, 5);
    this.syncTexts(this.labelTexts, objectLabels(world), 6);

    const prompt = focusPrompt(world);
    this.promptText.setVisible(!!prompt);
    if (prompt) this.promptText.setText(prompt.text).setColor(prompt.color);
    this.briefPanel.setVisible(world.focusObject?.id === 'sortie');
  }

  syncTexts(pool, items, depth) {
    while (pool.length < items.length) {
      pool.push(this.add.text(0, 0, '', { fontFamily: FONTS.body, fontStyle: '700' }).setOrigin(0.5).setDepth(depth));
    }
    pool.forEach((obj, i) => {
      const t = items[i];
      if (!t) return obj.setVisible(false);
      const alpha = t.max ? Math.min(1, (t.life / t.max) * 2) : 1;
      obj.setVisible(true).setText(t.text).setColor(t.color).setFontSize(t.size).setAlpha(alpha);
      const half = obj.width / 2 + 32;
      obj.setPosition(Math.max(half, Math.min(W - half, t.x)), t.y);
    });
  }
}

// 素材の色（HUD などで使う）
export function materialColor(def) {
  return ELEMENT_COLORS[def.color] ?? COLORS[def.color];
}
