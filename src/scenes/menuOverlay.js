// 画面いっぱいに重ねるメニュー。戦闘中のポーズ画面と、隠れ家の端末で同じものを使う。
//   タブ：ステータス／装備／地図／恒久強化／記録／データ片／実績／操作／設定（どれを出すかは使う側が選ぶ）
//   下のボタン：再開、隠れ家に戻る、など（使う側が渡す）
// 開いている間は、使う側がゲームの進行を止める（isOpen を見る）。
import { applyVolume, playSe } from '../audio/audio.js';
import { BAG, LOOT, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { families } from '../data/implants.js';
import { AREA_THEMES, COLORS, ELEMENT_COLORS, FONTS, RARITY_COLORS, hex } from '../data/theme.js';
import { discardFromBag, equipFromBag, unequipToBag } from '../game/build.js';
import { AREA_ORDER } from '../game/run.js';
import { applyDisplaySize, applyFrameRate, canFullscreen, getSettings, isFullscreen, saveSettings, toggleFullscreen } from '../game/settingsStore.js';
import { nodeState } from '../logic/areaGen.js';
import { xpToNext } from '../logic/level.js';
import { ELEMENT_NAMES, describeItem } from '../logic/loot.js';
import { buyUpgrade, canAfford, nextUpgradeCost, upgradeLevel } from '../logic/meta.js';
import { DISPLAY_SIZES, FRAME_RATES, QUALITIES, VOLUME_STEPS, stepVolume } from '../logic/settings.js';
import { activeFamilyBonuses, implantDesc } from '../logic/stats.js';
import { drawAreaMap, nodePosition } from '../render/areaMap.js';
import { drawSlotIcon } from '../render/icons.js';
import { drawAchievementIcon, drawFragmentIcon, drawMaterialIcon } from '../render/metaIcons.js';
import { renderControls } from './controlsPanel.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL = 0x110f1d;
const LOCKED = '#4a4470';

const TAB_LABELS = {
  status: 'ステータス', gear: '装備', map: '地図', upgrade: '恒久強化', record: '記録',
  fragment: 'データ片', achievement: '実績', controls: '操作', settings: '設定',
};

export function materialColor(def) {
  return ELEMENT_COLORS[def.color] ?? COLORS[def.color];
}

export function costText(cost) {
  return Object.entries(cost).map(([id, n]) => `${DATA.materials.get(id).name} ×${n}`).join('　');
}

const percent = (v) => `${Math.round(v * 100)}%`;
const rarityColor = (item) => RARITY_COLORS[LOOT.rarities[item.rarity].id];

export class MenuOverlay {
  // options: {
  //   title, tabs: ['status', ...], actions: [{ label, color, run }],
  //   context: () => ({ save, player, world, run }),  今のセーブデータ・プレイヤー・部屋・ラン（使うタブに必要なものだけ）
  //   canOpen: () => boolean,              Esc・Tab で開いてよいか
  //   readOnlyUpgrades: true,              恒久強化を見るだけにする
  //   onBuy: () => void,                   恒久強化を買ったあとに呼ぶ
  //   onClose: () => void,
  // }
  constructor(scene, options) {
    this.scene = scene;
    this.options = options;
    this.isOpen = false;
    this.tab = 0;
    this.cursor = 0;
    this.dialog = null; // 確認の案内 { message, yes }
    this.iconLayers = [];
    this.root = scene.add.container(0, 0).setDepth(30).setVisible(false);
    scene.input.keyboard.addCapture('TAB');
    scene.input.keyboard.on('keydown', (event) => this.onKey(event));
  }

  get tabId() {
    return this.options.tabs[this.tab];
  }

  open(tabId = this.options.tabs[0]) {
    this.isOpen = true;
    this.tab = Math.max(0, this.options.tabs.indexOf(tabId));
    this.cursor = 0;
    this.dialog = null;
    this.root.setVisible(true);
    this.render();
  }

  close() {
    this.isOpen = false;
    this.dialog = null;
    this.root.setVisible(false);
    this.root.removeAll(true);
    this.options.onClose?.();
  }

  // 「はい／いいえ」の確認を出す
  confirm(message, yes) {
    this.dialog = { message, yes };
    this.render();
  }

  onKey(event) {
    if (event.repeat) return;
    const code = event.code;
    if (!this.isOpen) {
      const can = this.options.canOpen?.() ?? true;
      if (can && code === 'Escape') this.open();
      else if (can && code === 'Tab' && this.options.tabs.includes('status')) this.open('status');
      return;
    }
    if (this.dialog) {
      if (code === 'Enter') {
        const { yes } = this.dialog;
        this.dialog = null;
        yes();
      } else if (code === 'Escape') {
        this.dialog = null;
        this.render();
      }
      return;
    }
    const tabs = this.options.tabs;
    const digit = /^Digit([1-9])$/.exec(code);
    if (digit && Number(digit[1]) <= tabs.length) this.setTab(Number(digit[1]) - 1);
    else if (code === 'KeyA' || code === 'ArrowLeft') this.setTab((this.tab + tabs.length - 1) % tabs.length);
    else if (code === 'KeyD' || code === 'ArrowRight') this.setTab((this.tab + 1) % tabs.length);
    else if (code === 'KeyW' || code === 'ArrowUp') this.moveCursor(-1);
    else if (code === 'KeyS' || code === 'ArrowDown') this.moveCursor(1);
    else if (code === 'Enter' || code === 'KeyE') this.confirmRow();
    else if (code === 'Escape' || code === 'Tab') this.close();
  }

  setTab(index) {
    playSe('select');
    this.tab = index;
    this.cursor = 0;
    this.render();
  }

  rowCount() {
    if (this.tabId === 'upgrade') return DATA.upgrades.all().length;
    if (this.tabId === 'fragment') return DATA.fragments.all().length;
    return 0;
  }

  moveCursor(delta) {
    const n = this.rowCount();
    if (n === 0) return;
    this.cursor = (this.cursor + delta + n) % n;
    playSe('select');
    this.render();
  }

  confirmRow() {
    if (this.tabId === 'upgrade') this.buy(DATA.upgrades.all()[this.cursor].id);
  }

  buy(id) {
    if (this.options.readOnlyUpgrades) return;
    const { save } = this.options.context();
    if (buyUpgrade(save, id)) {
      playSe('buy');
      this.options.onBuy?.();
    } else {
      playSe('deny');
    }
    this.render();
  }

  // ---- 描画の部品 ----

  style(size, color = COLORS.ink, extra = {}) {
    return { fontFamily: FONTS.body, fontSize: `${size}px`, color, ...extra };
  }

  text(x, y, str, size, color, extra = {}, onClick = null) {
    const t = this.scene.add.text(x, y, str, this.style(size, color, extra));
    if (onClick) t.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.root.add(t);
    return t;
  }

  panel(x, y, w, h, stroke = COLORS.line, onClick = null) {
    const r = this.scene.add.rectangle(x, y, w, h, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, hex(stroke));
    if (onClick) r.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.root.add(r);
    return r;
  }

  // 押せるボタン（枠と文字）
  button(x, y, w, h, label, color, onClick, size = 12) {
    this.panel(x, y, w, h, color, onClick);
    return this.text(x + w / 2, y + h / 2, label, size, color, { fontStyle: '700' }).setOrigin(0.5);
  }

  // アイコンなどを描くための Graphics（メニューを描き直すたびに作り直す）
  graphics() {
    const g = this.scene.add.graphics();
    this.root.add(g);
    this.iconLayers.push(g);
    return g;
  }

  render() {
    const ctx = this.options.context();
    const { save } = ctx;
    this.root.removeAll(true);
    this.iconLayers = [];
    // 後ろの画面を暗くして、クリックも通さない
    const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.92).setInteractive();
    this.root.add(dim);

    this.text(40, 28, this.options.title, 26, COLORS.cyan, { fontFamily: FONTS.display, fontStyle: '700' }).setShadow(0, 0, COLORS.cyan, 12, false, true);
    // 持っているボス素材（アイコンつき）
    const g = this.graphics();
    let x = W - 40;
    for (const def of [...DATA.materials.all()].reverse()) {
      const color = materialColor(def);
      const t = this.text(x, 38, `${def.name} ×${save.materials[def.id] ?? 0}`, 13, color, { fontStyle: '700' }).setOrigin(1, 0);
      drawMaterialIcon(g, def.id, x - t.width - 12, 47, 7, hex(color));
      x -= t.width + 38;
    }
    // タブ（数が多いときは幅を詰める）
    const tabs = this.options.tabs;
    const gap = 6;
    const tw = Math.min(140, Math.floor((W - 80 - gap * (tabs.length - 1)) / tabs.length));
    tabs.forEach((id, i) => {
      const on = i === this.tab;
      const tx = 40 + i * (tw + gap);
      const r = this.scene.add.rectangle(tx, 78, tw, 30, on ? 0x1b1631 : PANEL, 0.95).setOrigin(0).setStrokeStyle(on ? 2 : 1, hex(on ? COLORS.cyan : COLORS.line));
      r.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setTab(i));
      this.root.add(r);
      this.text(tx + tw / 2, 93, `${i + 1} ${TAB_LABELS[id]}`, tw < 110 ? 12 : 14, on ? COLORS.cyan : COLORS.dim, { fontStyle: '700' }).setOrigin(0.5);
    });

    const id = this.tabId;
    if (id === 'status') this.renderStatus(ctx.player);
    else if (id === 'gear') this.renderGear(ctx.world);
    else if (id === 'map') this.renderMap(ctx.run);
    else if (id === 'upgrade') this.renderUpgrades(save);
    else if (id === 'record') this.renderRecords(save);
    else if (id === 'fragment') this.renderFragments(save);
    else if (id === 'achievement') this.renderAchievements(save);
    else if (id === 'controls') renderControls(this, ctx.player?.weapon ?? null);
    else if (id === 'settings') this.renderSettings();

    // アイコンは、あとから足した枠に隠れないよう、いちばん手前に出す
    for (const layer of this.iconLayers) this.root.bringToTop(layer);

    // 下のボタン
    const actions = this.options.actions;
    actions.forEach((action, i) => {
      const bx = W / 2 + (i - (actions.length - 1) / 2) * 226;
      this.button(bx - 105, 470, 210, 34, action.label, action.color ?? COLORS.ink, action.run, 14);
    });
    this.text(W / 2, H - 20, `1〜${tabs.length} / A・D：切り替え　W・S：選ぶ　Enter：決定　Esc：閉じる`, 12, COLORS.dim).setOrigin(0.5);

    if (this.dialog) this.renderDialog();
  }

  renderDialog() {
    const cover = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.8).setInteractive();
    this.root.add(cover);
    this.panel(W / 2 - 270, H / 2 - 90, 540, 180, COLORS.amber);
    this.text(W / 2, H / 2 - 42, this.dialog.message, 15, COLORS.ink, { fontStyle: '700', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    const yes = () => {
      const run = this.dialog.yes;
      this.dialog = null;
      run();
    };
    const no = () => {
      this.dialog = null;
      this.render();
    };
    this.button(W / 2 - 190, H / 2 + 30, 170, 36, 'はい（Enter）', COLORS.amber, yes, 14);
    this.button(W / 2 + 20, H / 2 + 30, 170, 36, 'いいえ（Esc）', COLORS.ink, no, 14);
  }

  // ---- ステータス：数値、装備の詳細、インプラント ----
  renderStatus(player) {
    if (!player) return;
    const s = player.stats;
    const b = player.build;
    const elements = s.elements.length > 0 ? s.elements.map((e) => ELEMENT_NAMES[e]).join('・') : 'なし';
    const rows = [
      ['レベル', `${b.level}（次まで ${xpToNext(b.level) - b.xp}）`],
      ['HP', `${Math.ceil(player.hp)} / ${s.maxHp}`],
      ['攻撃力', percent(s.attackMul)],
      ['会心率', percent(s.critChance)],
      ['会心ダメージ', percent(s.critMul)],
      ['攻撃速度', percent(1 + s.attackSpeed)],
      ['移動速度', percent(s.moveSpeedMul)],
      ['被ダメージ', percent(s.damageTaken)],
      ['近接の範囲／角度', `${percent(s.meleeRange)} ／ ${percent(s.meleeArc)}`],
      ['撃破時HP回復', `${s.killHeal}`],
      ['属性', elements],
      ['クレジット', `${b.credits} c（獲得 ${percent(s.creditMul)}）`],
      ['修復キット', `${b.kits}`],
      ...(b.ougi.includes(player.weapon.id) ? [['奥義', b.ougiUsed ? 'このエリアでは使用済み' : 'HP20%以下で使える']] : []),
      ['消耗品', b.items.filter(Boolean).map((it) => `${DATA.consumables.get(it.id).name}×${it.count}`).join('、') || 'なし'],
    ];
    this.panel(40, 122, 270, 336);
    this.text(54, 130, `${player.weapon.name}`, 14, COLORS.cyan, { fontStyle: '700' });
    rows.forEach(([label, value], i) => {
      this.text(54, 154 + i * 20, label, 12, COLORS.dim);
      this.text(296, 154 + i * 20, value, value.length > 14 ? 10 : 12, COLORS.ink, { fontStyle: '700' }).setOrigin(1, 0);
    });

    // 装備（付け替えは「装備」タブで）
    this.panel(322, 122, 290, 336);
    this.text(336, 130, '装備', 14, COLORS.cyan, { fontStyle: '700' });
    const g = this.graphics();
    let y = 156;
    for (const slot of LOOT.slots) {
      const item = b.gear[slot.id];
      drawSlotIcon(g, slot.id, 344, y + 8, 6, item ? hex(rarityColor(item)) : 0x4a4470);
      this.text(358, y, slot.name, 11, COLORS.dim);
      if (item) {
        this.text(336, y + 17, item.name, 13, rarityColor(item), { fontStyle: '700' });
        const lines = this.text(336, y + 35, describeItem(item).join('\n'), 11, COLORS.ink, { lineSpacing: 2, wordWrap: { width: 262, useAdvancedWrap: true } });
        y += 42 + lines.height;
      } else {
        this.text(336, y + 17, 'なし', 13, LOCKED);
        y += 42;
      }
    }

    // インプラント
    this.panel(624, 122, 296, 336);
    this.text(638, 130, 'インプラント', 14, COLORS.cyan, { fontStyle: '700' });
    const entries = Object.entries(b.implants);
    if (entries.length === 0) this.text(638, 156, 'なし', 13, LOCKED);
    // 数が多いときは説明を省いて、名前だけ並べる
    const compact = entries.length > 7;
    let iy = 156;
    for (const [id, n] of entries) {
      const def = DATA.implants.get(id);
      const fam = families[def.family];
      const color = ELEMENT_COLORS[fam.color] ?? COLORS[fam.color];
      this.text(638, iy, `${def.name}　Lv${n}`, 12, color, { fontStyle: '700' });
      if (compact) {
        iy += 17;
      } else {
        const desc = this.text(638, iy + 15, implantDesc(def, n), 10, COLORS.dim, { wordWrap: { width: 270, useAdvancedWrap: true } });
        iy += 20 + desc.height;
      }
    }
    for (const f of activeFamilyBonuses(b)) {
      this.text(638, iy + 2, `◆ ${families[f].name}系統：${families[f].bonus.desc}`, 11, COLORS.amber, { fontStyle: '700', wordWrap: { width: 270, useAdvancedWrap: true } });
      iy += 18;
    }
  }

  // ---- 装備：身につけている装備と、バッグの中身。付ける・外す・捨てる ----
  renderGear(world) {
    if (!world) return;
    const p = world.player;
    const b = p.build;
    const g = this.graphics();
    const act = (fn, ok = 'equip') => () => {
      playSe(fn() ? ok : 'deny');
      this.render();
    };

    this.panel(40, 122, 420, 336);
    this.text(54, 130, '身につけている装備', 14, COLORS.cyan, { fontStyle: '700' });
    LOOT.slots.forEach((slot, i) => {
      const y = 158 + i * 98;
      const item = b.gear[slot.id];
      drawSlotIcon(g, slot.id, 66, y + 12, 9, item ? hex(rarityColor(item)) : 0x4a4470);
      this.text(86, y, slot.name, 11, COLORS.dim);
      if (item) {
        this.text(86, y + 15, item.name, 14, rarityColor(item), { fontStyle: '700' });
        this.text(54, y + 38, describeItem(item).join('　'), 11, COLORS.ink, { lineSpacing: 3, wordWrap: { width: 390, useAdvancedWrap: true } });
        const full = b.bag.length >= BAG.size;
        this.button(380, y, 66, 24, '外す', full ? LOCKED : COLORS.amber, act(() => unequipToBag(world, slot.id), 'pickup'));
      } else {
        this.text(86, y + 15, 'なし', 14, LOCKED);
      }
    });

    this.panel(472, 122, 448, 336);
    this.text(486, 130, `バッグ　${b.bag.length} / ${BAG.size}`, 14, COLORS.cyan, { fontStyle: '700' });
    this.text(906, 132, '「付ける」で今の装備と入れ替え。「捨てる」と足元に落ちる', 10, COLORS.dim).setOrigin(1, 0);
    if (b.bag.length === 0) this.text(486, 162, '空。落ちている装備の上で F を押すと、ここに入る', 12, LOCKED);
    b.bag.forEach((item, i) => {
      const y = 156 + i * 50;
      this.panel(482, y, 428, 46, COLORS.line);
      drawSlotIcon(g, item.slot, 500, y + 23, 8, hex(rarityColor(item)));
      this.text(518, y + 4, item.name, 13, rarityColor(item), { fontStyle: '700' });
      this.text(518, y + 24, describeItem(item).join('　'), 10, COLORS.ink, { wordWrap: { width: 262, useAdvancedWrap: true }, maxLines: 2 });
      this.button(790, y + 11, 54, 24, '付ける', COLORS.green, act(() => equipFromBag(world, i)));
      this.button(850, y + 11, 54, 24, '捨てる', COLORS.dim, act(() => discardFromBag(world, i), 'pickup'));
    });
  }

  // ---- 地図：今のエリアの全体 ----
  renderMap(run) {
    if (!run) return;
    const plan = run.plan;
    const area = DATA.areas.get(run.map.areas[run.areaIndex]);
    this.panel(40, 122, 880, 336);
    this.text(W / 2, 140, `${area.code} // ${area.name} — MAP`, 15, AREA_THEMES[area.theme].edge, { fontStyle: '700' }).setOrigin(0.5);
    const colGap = Math.min(150, 780 / (plan.columns - 1));
    const layout = { x: W / 2 - ((plan.columns - 1) * colGap) / 2, y: 290, colGap, rowGap: 130, icon: 14, line: 2, bg: PANEL };
    drawAreaMap(this.graphics(), plan, layout);
    for (const node of Object.values(plan.nodes)) {
      const pos = nodePosition(node, layout);
      const room = DATA.rooms.get(node.type);
      // 通った部屋と、もう行けない部屋の名前は暗くする
      const state = nodeState(plan, node.id);
      const color = state === 'off' ? LOCKED : state === 'done' ? '#2f6b4c' : COLORS[room.color];
      this.text(pos.x, pos.y + 28, room.label, 12, color, { fontStyle: '700' }).setOrigin(0.5);
    }
    this.text(W / 2, 440, '白い枠＝今いる部屋　明るい線＝進める道　暗い部屋＝もう行けない', 12, COLORS.dim).setOrigin(0.5);
  }

  // ---- 恒久強化 ----
  renderUpgrades(save) {
    const readOnly = this.options.readOnlyUpgrades;
    this.text(40, 114, readOnly ? '買った恒久強化（買うのは隠れ家の強化端末で）' : 'ボス素材で、死んでも残る強化を買う。行をクリックするか、W・S で選んで Enter', 12, COLORS.dim);
    DATA.upgrades.all().forEach((def, i) => {
      const y = 134 + i * 54;
      const level = upgradeLevel(save, def.id);
      const cost = nextUpgradeCost(save, def);
      const ready = def.ready !== false;
      const buyable = ready && cost && canAfford(save, cost);
      const selected = i === this.cursor && !readOnly;
      this.panel(40, y, 880, 46, selected ? COLORS.cyan : COLORS.line, () => {
        this.cursor = i;
        this.buy(def.id);
      });
      this.text(56, y + 5, def.name, 15, ready ? COLORS.ink : LOCKED, { fontStyle: '700' });
      this.text(56, y + 26, def.desc, 12, ready ? COLORS.dim : LOCKED);
      for (let k = 0; k < def.max; k++) {
        const pip = this.scene.add.rectangle(560 + k * 20, y + 23, 14, 14, k < level ? hex(COLORS.green) : PANEL, 1).setStrokeStyle(1, hex(k < level ? COLORS.green : COLORS.dim));
        this.root.add(pip);
      }
      let status = '';
      let color = COLORS.dim;
      if (!ready) status = '準備中';
      else if (!cost) [status, color] = ['最大', COLORS.green];
      else if (readOnly) status = `次：${costText(cost)}`;
      else [status, color] = [`${costText(cost)}${buyable ? '　— 買える' : ''}`, buyable ? COLORS.amber : COLORS.red];
      this.text(904, y + 14, status, 13, color, { fontStyle: '700' }).setOrigin(1, 0);
    });
  }

  // ---- 記録 ----
  renderRecords(save) {
    const r = save.records;
    const best = r.runs > 0 ? `${DATA.areas.get(AREA_ORDER[Math.min(r.bestArea, AREA_ORDER.length - 1)]).code}-${r.bestStep + 1}` : 'なし';
    const bosses = DATA.bosses.all().map((b) => `${b.name} ×${save.bossKills[b.id] ?? 0}`).join('　');
    const rows = [
      ['出撃した回数', `${r.runs}`],
      ['クリアした回数', `${r.clears}`],
      ['最高到達', best],
      ['倒した敵の数（累計）', `${r.kills}`],
      ['ボス撃破', bosses],
      ['データ片', `${save.fragments.length} / ${DATA.fragments.all().length}`],
      ['実績', `${save.achievements.length} / ${DATA.achievements.all().length}`],
    ];
    this.panel(40, 122, 880, 40 + rows.length * 36);
    rows.forEach(([label, value], i) => {
      this.text(60, 142 + i * 36, label, 14, COLORS.dim);
      this.text(300, 142 + i * 36, value, 14, COLORS.ink, { fontStyle: '700' });
    });
  }

  // ---- データ片 ----
  renderFragments(save) {
    const list = DATA.fragments.all();
    const g = this.graphics();
    this.panel(40, 122, 300, 336);
    list.forEach((f, i) => {
      const have = save.fragments.includes(f.id);
      const selected = i === this.cursor;
      const color = selected ? COLORS.cyan : have ? COLORS.ink : LOCKED;
      // エリアの色のアイコン。未回収は中身のない暗いアイコン
      drawFragmentIcon(g, 60, 141 + i * 26, 6, have ? hex(AREA_THEMES[DATA.areas.get(f.area).theme].edge) : 0x4a4470, !have);
      this.text(76, 132 + i * 26, have ? f.title : '？？？', 13, color, { fontStyle: have ? '700' : '400' }, () => {
        this.cursor = i;
        this.render();
      });
      if (selected) this.text(46, 132 + i * 26, '▶', 9, COLORS.cyan).setY(135 + i * 26);
    });
    this.panel(356, 122, 564, 336);
    const f = list[this.cursor];
    if (!f) return;
    const area = DATA.areas.get(f.area);
    if (save.fragments.includes(f.id)) {
      drawFragmentIcon(g, 388, 152, 12, hex(AREA_THEMES[area.theme].edge));
      this.text(412, 140, f.title, 16, COLORS.cyan, { fontStyle: '700' });
      this.text(376, 182, f.text, 14, COLORS.ink, { lineSpacing: 10, wordWrap: { width: 524, useAdvancedWrap: true } });
    } else {
      const where = f.source === 'boss' ? 'ボスを倒すと手に入る' : 'データ金庫で見つかる';
      drawFragmentIcon(g, 388, 152, 12, 0x4a4470, true);
      this.text(412, 140, '未回収', 16, LOCKED, { fontStyle: '700' });
      this.text(376, 182, `${area.name}の${where}。`, 14, COLORS.dim);
    }
  }

  // ---- 実績 ----
  renderAchievements(save) {
    const list = DATA.achievements.all();
    const g = this.graphics();
    this.text(40, 114, `解除 ${save.achievements.length} / ${list.length}`, 12, COLORS.dim);
    list.forEach((def, i) => {
      // 3列に並べる
      const x = 40 + (i % 3) * 297;
      const y = 134 + Math.floor(i / 3) * 47;
      const done = save.achievements.includes(def.id);
      const color = done ? (ELEMENT_COLORS[def.color] ?? COLORS.amber) : LOCKED;
      this.panel(x, y, 287, 42, done ? COLORS.amber : COLORS.line);
      drawAchievementIcon(g, def.icon, x + 21, y + 21, 10, hex(color));
      this.text(x + 42, y + 4, def.name, 13, done ? COLORS.amber : COLORS.dim, { fontStyle: '700' });
      this.text(x + 42, y + 24, def.desc, 10, done ? COLORS.ink : LOCKED);
    });
  }

  // ---- 設定：音量、表示の大きさ、画質 ----
  renderSettings() {
    const s = getSettings();
    const game = this.scene.game;
    const changed = () => {
      saveSettings();
      applyVolume();
      this.render();
    };
    this.panel(40, 122, 880, 336);

    // 音量のゲージ。[−][＋] か、ゲージを直接クリックして変える
    const volumeRow = (y, label, key) => {
      const value = s.volume[key];
      this.text(64, y + 4, label, 14, COLORS.ink, { fontStyle: '700' });
      const set = (v) => () => {
        s.volume[key] = v;
        changed();
        playSe('select');
      };
      this.button(220, y, 30, 26, '−', COLORS.ink, set(stepVolume(value, -1)), 16);
      const filled = Math.round(value * VOLUME_STEPS);
      for (let i = 0; i < VOLUME_STEPS; i++) {
        const cell = this.scene.add.rectangle(262 + i * 24, y + 3, 20, 20, i < filled ? hex(COLORS.cyan) : PANEL, 1).setOrigin(0).setStrokeStyle(1, hex(i < filled ? COLORS.cyan : COLORS.dim));
        cell.setInteractive({ useHandCursor: true }).on('pointerdown', set((i + 1) / VOLUME_STEPS));
        this.root.add(cell);
      }
      this.button(510, y, 30, 26, '＋', COLORS.ink, set(stepVolume(value, 1)), 16);
      this.text(556, y + 4, `${Math.round(value * 100)}%`, 14, COLORS.dim);
    };
    this.text(64, 134, '音', 12, COLORS.cyan, { fontStyle: '700' });
    volumeRow(156, '全体の音量', 'master');
    volumeRow(190, 'BGM', 'bgm');
    volumeRow(224, '効果音', 'se');
    this.button(660, 156, 150, 26, s.muted ? '消音：ON' : '消音：OFF', s.muted ? COLORS.red : COLORS.dim, () => {
      s.muted = !s.muted;
      changed();
    });

    // 選択肢を横に並べる
    const choiceRow = (y, label, options, current, pick) => {
      this.text(64, y + 4, label, 14, COLORS.ink, { fontStyle: '700' });
      options.forEach((opt, i) => {
        const on = opt.id === current;
        this.button(220 + i * 156, y, 148, 26, opt.label, on ? COLORS.cyan : COLORS.dim, () => pick(opt));
      });
    };
    this.text(64, 270, '画面', 12, COLORS.cyan, { fontStyle: '700' });
    choiceRow(292, '表示の大きさ', DISPLAY_SIZES, s.displaySize, (opt) => {
      s.displaySize = opt.id;
      saveSettings();
      applyDisplaySize(game);
      playSe('select');
      this.render();
    });
    choiceRow(326, '画質', QUALITIES, s.quality, (opt) => {
      if (opt.id === s.quality) return;
      // 画質は起動時に決まるので、変えるには読み込み直す必要がある
      this.confirm('画質を変えるには、ゲームを読み込み直します。\nランの途中なら、今回の進捗は失われます。よろしいですか？', () => {
        s.quality = opt.id;
        saveSettings();
        window.location.reload();
      });
    });
    this.text(696, 331, '上げるほどくっきりするが、重くなる', 11, COLORS.dim);
    choiceRow(360, 'フレームレート', FRAME_RATES, s.frameRate, (opt) => {
      s.frameRate = opt.id;
      saveSettings();
      applyFrameRate(game);
      playSe('select');
      this.render();
    });
    this.text(64, 398, 'フルスクリーン', 14, COLORS.ink, { fontStyle: '700' });
    if (canFullscreen()) {
      this.button(220, 394, 148, 26, isFullscreen() ? '解除する' : '切り替える', COLORS.dim, () => {
        toggleFullscreen().then((ok) => {
          if (!ok) playSe('deny');
          this.scene.time.delayedCall(200, () => this.isOpen && this.render());
        });
      });
    } else {
      // アプリに埋め込まれた画面などでは、フルスクリーンにできない
      this.button(220, 394, 148, 26, '使えない', LOCKED, () => playSe('deny'));
      this.text(380, 399, 'この画面ではフルスクリーンにできない（Chrome などのブラウザで開くと使える）', 11, COLORS.dim);
    }
    this.text(64, 432, '設定は、セーブデータとは別に、このブラウザに保存される。', 11, COLORS.dim);
  }
}
