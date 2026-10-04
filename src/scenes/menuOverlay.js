// 画面いっぱいに重ねるメニュー。戦闘中のポーズ画面と、隠れ家の端末で同じものを使う。
//   タブ：ステータス／恒久強化／記録／データ片／実績（どれを出すかは使う側が選ぶ）
//   下のボタン：再開、隠れ家に戻る、など（使う側が渡す）
// 開いている間は、使う側がゲームの進行を止める（isOpen を見る）。
import { LOOT, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { families } from '../data/implants.js';
import { COLORS, ELEMENT_COLORS, FONTS, RARITY_COLORS, hex } from '../data/theme.js';
import { AREA_ORDER } from '../game/run.js';
import { xpToNext } from '../logic/level.js';
import { ELEMENT_NAMES, describeItem } from '../logic/loot.js';
import { buyUpgrade, canAfford, nextUpgradeCost, upgradeLevel } from '../logic/meta.js';
import { activeFamilyBonuses } from '../logic/stats.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL = 0x110f1d;
const LOCKED = '#4a4470';

const TAB_LABELS = { status: 'ステータス', upgrade: '恒久強化', record: '記録', fragment: 'データ片', achievement: '実績' };

function materialColor(def) {
  return ELEMENT_COLORS[def.color] ?? COLORS[def.color];
}

export function costText(cost) {
  return Object.entries(cost).map(([id, n]) => `${DATA.materials.get(id).name} ×${n}`).join('　');
}

const percent = (v) => `${Math.round(v * 100)}%`;

export class MenuOverlay {
  // options: {
  //   title, tabs: ['status', ...], actions: [{ label, color, run }],
  //   context: () => ({ save, player }),   今のセーブデータと（ステータス用の）プレイヤー
  //   canOpen: () => boolean,              Esc・Tab で開いてよいか
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
    this.render();
  }

  confirmRow() {
    if (this.tabId === 'upgrade') this.buy(DATA.upgrades.all()[this.cursor].id);
  }

  buy(id) {
    if (this.options.readOnlyUpgrades) return;
    const { save } = this.options.context();
    if (buyUpgrade(save, id)) this.options.onBuy?.();
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

  render() {
    const { save, player } = this.options.context();
    this.root.removeAll(true);
    // 後ろの画面を暗くして、クリックも通さない
    const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.9).setInteractive();
    this.root.add(dim);

    this.text(40, 28, this.options.title, 26, COLORS.cyan, { fontFamily: FONTS.display, fontStyle: '700' }).setShadow(0, 0, COLORS.cyan, 12, false, true);
    // 持っているボス素材
    let x = W - 40;
    for (const def of [...DATA.materials.all()].reverse()) {
      const t = this.text(x, 38, `${def.name} ×${save.materials[def.id] ?? 0}`, 14, materialColor(def), { fontStyle: '700' }).setOrigin(1, 0);
      x -= t.width + 22;
    }
    // タブ
    this.options.tabs.forEach((id, i) => {
      const on = i === this.tab;
      const tx = 40 + i * 150;
      const r = this.scene.add.rectangle(tx, 78, 140, 30, on ? 0x1b1631 : PANEL, 0.95).setOrigin(0).setStrokeStyle(on ? 2 : 1, hex(on ? COLORS.cyan : COLORS.line));
      r.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setTab(i));
      this.root.add(r);
      this.text(tx + 70, 93, `${i + 1}  ${TAB_LABELS[id]}`, 14, on ? COLORS.cyan : COLORS.dim, { fontStyle: '700' }).setOrigin(0.5);
    });

    if (this.tabId === 'status') this.renderStatus(player);
    else if (this.tabId === 'upgrade') this.renderUpgrades(save);
    else if (this.tabId === 'record') this.renderRecords(save);
    else if (this.tabId === 'fragment') this.renderFragments(save);
    else this.renderAchievements(save);

    // 下のボタン
    const actions = this.options.actions;
    actions.forEach((action, i) => {
      const bx = W / 2 + (i - (actions.length - 1) / 2) * 230;
      const color = action.color ?? COLORS.ink;
      this.panel(bx - 105, 470, 210, 34, color, action.run);
      this.text(bx, 487, action.label, 14, color, { fontStyle: '700' }).setOrigin(0.5);
    });
    this.text(W / 2, H - 20, `1〜${this.options.tabs.length} / A・D：切り替え　W・S：選ぶ　Enter：決定　Esc：閉じる`, 12, COLORS.dim).setOrigin(0.5);

    if (this.dialog) this.renderDialog();
  }

  renderDialog() {
    const cover = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.8).setInteractive();
    this.root.add(cover);
    this.panel(W / 2 - 250, H / 2 - 80, 500, 160, COLORS.amber);
    this.text(W / 2, H / 2 - 40, this.dialog.message, 16, COLORS.ink, { fontStyle: '700', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    const yes = () => {
      const run = this.dialog.yes;
      this.dialog = null;
      run();
    };
    const no = () => {
      this.dialog = null;
      this.render();
    };
    this.panel(W / 2 - 190, H / 2 + 20, 170, 36, COLORS.amber, yes);
    this.text(W / 2 - 105, H / 2 + 38, 'はい（Enter）', 14, COLORS.amber, { fontStyle: '700' }).setOrigin(0.5);
    this.panel(W / 2 + 20, H / 2 + 20, 170, 36, COLORS.dim, no);
    this.text(W / 2 + 105, H / 2 + 38, 'いいえ（Esc）', 14, COLORS.ink, { fontStyle: '700' }).setOrigin(0.5);
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
    ];
    this.panel(40, 122, 270, 336);
    this.text(54, 130, `${player.weapon.name}`, 14, COLORS.cyan, { fontStyle: '700' });
    rows.forEach(([label, value], i) => {
      this.text(54, 154 + i * 23, label, 12, COLORS.dim);
      this.text(296, 154 + i * 23, value, 12, COLORS.ink, { fontStyle: '700' }).setOrigin(1, 0);
    });

    // 装備
    this.panel(322, 122, 290, 336);
    this.text(336, 130, '装備', 14, COLORS.cyan, { fontStyle: '700' });
    let y = 156;
    for (const slot of LOOT.slots) {
      const item = b.gear[slot.id];
      this.text(336, y, slot.name, 11, COLORS.dim);
      if (item) {
        this.text(336, y + 15, item.name, 13, RARITY_COLORS[LOOT.rarities[item.rarity].id], { fontStyle: '700' });
        const lines = this.text(336, y + 33, describeItem(item).join('\n'), 11, COLORS.ink, { lineSpacing: 2, wordWrap: { width: 262, useAdvancedWrap: true } });
        y += 40 + lines.height;
      } else {
        this.text(336, y + 15, 'なし', 13, LOCKED);
        y += 40;
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
      this.text(638, iy, `${def.name}${n > 1 ? ` ×${n}` : ''}`, 12, color, { fontStyle: '700' });
      if (compact) {
        iy += 17;
      } else {
        const desc = this.text(638, iy + 15, def.desc, 10, COLORS.dim, { wordWrap: { width: 270, useAdvancedWrap: true } });
        iy += 20 + desc.height;
      }
    }
    for (const f of activeFamilyBonuses(b)) {
      this.text(638, iy + 2, `◆ ${families[f].name}系統：${families[f].bonus.desc}`, 11, COLORS.amber, { fontStyle: '700', wordWrap: { width: 270, useAdvancedWrap: true } });
      iy += 18;
    }
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
        const pip = this.scene.add.rectangle(430 + k * 20, y + 23, 14, 14, k < level ? hex(COLORS.green) : PANEL, 1).setStrokeStyle(1, hex(k < level ? COLORS.green : COLORS.dim));
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
    this.panel(40, 122, 300, 336);
    list.forEach((f, i) => {
      const have = save.fragments.includes(f.id);
      const selected = i === this.cursor;
      const color = selected ? COLORS.cyan : have ? COLORS.ink : LOCKED;
      this.text(56, 136 + i * 30, `${selected ? '▶ ' : '　 '}${have ? f.title : '？？？'}`, 14, color, { fontStyle: have ? '700' : '400' }, () => {
        this.cursor = i;
        this.render();
      });
    });
    this.panel(356, 122, 564, 336);
    const f = list[this.cursor];
    if (!f) return;
    if (save.fragments.includes(f.id)) {
      this.text(376, 140, f.title, 16, COLORS.cyan, { fontStyle: '700' });
      this.text(376, 176, f.text, 14, COLORS.ink, { lineSpacing: 10, wordWrap: { width: 524, useAdvancedWrap: true } });
    } else {
      const where = f.source === 'boss' ? 'ボスを倒すと手に入る' : 'データ金庫で見つかる';
      this.text(376, 140, '未回収', 16, LOCKED, { fontStyle: '700' });
      this.text(376, 176, `${DATA.areas.get(f.area).name}の${where}。`, 14, COLORS.dim);
    }
  }

  // ---- 実績 ----
  renderAchievements(save) {
    const list = DATA.achievements.all();
    this.text(40, 114, `解除 ${save.achievements.length} / ${list.length}`, 12, COLORS.dim);
    list.forEach((def, i) => {
      const x = 40 + (i % 2) * 445;
      const y = 134 + Math.floor(i / 2) * 60;
      const done = save.achievements.includes(def.id);
      this.panel(x, y, 435, 52, done ? COLORS.amber : COLORS.line);
      this.text(x + 14, y + 7, `${done ? '◆' : '◇'} ${def.name}`, 15, done ? COLORS.amber : COLORS.dim, { fontStyle: '700' });
      this.text(x + 14, y + 30, def.desc, 12, done ? COLORS.ink : LOCKED);
    });
  }
}
