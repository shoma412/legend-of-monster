import * as Phaser from 'phaser';
import { SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { brief } from '../data/story.js';
import { COLORS, ELEMENT_COLORS, FONTS, hex } from '../data/theme.js';
import { weaponUnlocks } from '../data/upgrades.js';
import { AREA_ORDER } from '../game/run.js';
import { getSave, persist, resetSave } from '../game/saveStore.js';
import { buyUpgrade, canAfford, nextUpgradeCost, unlockWeapon, upgradeLevel } from '../logic/meta.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL = 0x110f1d;
const LOCKED = '#4a4470';

const TABS = [
  { id: 'sortie', label: '出撃' },
  { id: 'upgrade', label: '恒久強化' },
  { id: 'record', label: '記録' },
  { id: 'fragment', label: 'データ片' },
  { id: 'achievement', label: '実績' },
];

function materialColor(def) {
  return ELEMENT_COLORS[def.color] ?? COLORS[def.color];
}

function costText(cost) {
  return Object.entries(cost).map(([id, n]) => `${DATA.materials.get(id).name} ×${n}`).join('　');
}

// 隠れ家（拠点）。出撃、恒久強化、記録、データ片、実績。
export class HideoutScene extends Phaser.Scene {
  constructor() {
    super('Hideout');
  }

  init() {
    this.tab = 0;
    this.cursor = 0; // タブの中で選んでいる行
    this.weapon = 'greatsword';
    this.confirmReset = false;
  }

  create() {
    this.save = getSave();
    if (!this.save.weapons.includes(this.weapon)) this.weapon = this.save.weapons[0];

    const g = this.add.graphics();
    g.lineStyle(1, hex(COLORS.line), 0.45);
    for (let x = 0; x <= W; x += 48) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 48) g.lineBetween(0, y, W, y);
    g.lineStyle(2, hex(COLORS.magenta), 0.8).strokeRect(14, 14, W - 28, H - 28);

    this.add.text(40, 30, 'HIDEOUT', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '28px', color: COLORS.cyan }).setShadow(0, 0, COLORS.cyan, 12, false, true);
    this.add.text(170, 40, '// 隠れ家', this.style(14, COLORS.dim));
    this.add.text(W / 2, H - 28, '1〜5 / A・D：切り替え　W・S：選ぶ　Enter：決定　Esc：タイトルへ', this.style(12, COLORS.dim)).setOrigin(0.5);

    this.header = this.add.container(0, 0); // 素材とタブ（買い物で変わるので描き直す）
    this.content = this.add.container(0, 0);

    const kb = this.input.keyboard;
    kb.on('keydown', (event) => this.onKey(event));
    this.render();
  }

  style(size, color = COLORS.ink, extra = {}) {
    return { fontFamily: FONTS.body, fontSize: `${size}px`, color, ...extra };
  }

  // 文字を足す。onClick を渡すと押せるようになる
  text(parent, x, y, str, size, color, extra = {}, onClick = null) {
    const t = this.add.text(x, y, str, this.style(size, color, extra));
    if (onClick) t.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    parent.add(t);
    return t;
  }

  panel(parent, x, y, w, h, stroke = COLORS.line) {
    const r = this.add.rectangle(x, y, w, h, PANEL, 0.92).setOrigin(0).setStrokeStyle(1, hex(stroke));
    parent.add(r);
    return r;
  }

  onKey(event) {
    if (event.repeat) return null; // 押しっぱなしで勝手に進まないようにする
    const code = event.code;
    const digit = /^Digit([1-5])$/.exec(code);
    if (digit) return this.setTab(Number(digit[1]) - 1);
    if (code === 'KeyA' || code === 'ArrowLeft') return this.setTab((this.tab + TABS.length - 1) % TABS.length);
    if (code === 'KeyD' || code === 'ArrowRight') return this.setTab((this.tab + 1) % TABS.length);
    if (code === 'KeyW' || code === 'ArrowUp') return this.moveCursor(-1);
    if (code === 'KeyS' || code === 'ArrowDown') return this.moveCursor(1);
    if (code === 'Enter' || code === 'KeyE') return this.confirm();
    if (code === 'Escape') return this.scene.start('Title');
    return null;
  }

  setTab(index) {
    this.tab = index;
    this.cursor = 0;
    this.confirmReset = false;
    this.render();
  }

  rowCount() {
    const id = TABS[this.tab].id;
    if (id === 'sortie') return weaponUnlocks.length;
    if (id === 'upgrade') return DATA.upgrades.all().length;
    if (id === 'fragment') return DATA.fragments.all().length;
    return 0;
  }

  moveCursor(delta) {
    const n = this.rowCount();
    if (n === 0) return;
    this.cursor = (this.cursor + delta + n) % n;
    this.render();
  }

  confirm() {
    const id = TABS[this.tab].id;
    if (id === 'sortie') this.sortie();
    else if (id === 'upgrade') this.buy(DATA.upgrades.all()[this.cursor].id);
  }

  sortie() {
    // 選んでいる武器が未解放なら、解放済みの武器で出る
    const picked = weaponUnlocks[this.cursor]?.weapon;
    if (this.save.weapons.includes(picked)) this.weapon = picked;
    this.scene.start('Battle', { weaponId: this.weapon });
  }

  buy(id) {
    if (buyUpgrade(this.save, id)) persist();
    this.render();
  }

  render() {
    this.header.removeAll(true);
    this.content.removeAll(true);
    this.renderHeader();
    const id = TABS[this.tab].id;
    if (id === 'sortie') this.renderSortie();
    else if (id === 'upgrade') this.renderUpgrades();
    else if (id === 'record') this.renderRecords();
    else if (id === 'fragment') this.renderFragments();
    else this.renderAchievements();
  }

  renderHeader() {
    const c = this.header;
    // 持っているボス素材
    let x = W - 40;
    for (const def of [...DATA.materials.all()].reverse()) {
      const t = this.text(c, x, 38, `${def.name} ×${this.save.materials[def.id] ?? 0}`, 14, materialColor(def), { fontStyle: '700' }).setOrigin(1, 0);
      x -= t.width + 22;
    }
    // タブ
    TABS.forEach((tab, i) => {
      const on = i === this.tab;
      const tx = 40 + i * 150;
      const r = this.add.rectangle(tx, 78, 140, 30, on ? 0x1b1631 : PANEL, 0.92).setOrigin(0).setStrokeStyle(on ? 2 : 1, hex(on ? COLORS.cyan : COLORS.line));
      r.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setTab(i));
      c.add(r);
      this.text(c, tx + 70, 93, `${i + 1}  ${tab.label}`, 14, on ? COLORS.cyan : COLORS.dim, { fontStyle: '700' }).setOrigin(0.5);
    });
  }

  // ---- 出撃：依頼文と武器選択 ----
  renderSortie() {
    const c = this.content;
    this.panel(c, 40, 126, 430, 250);
    this.text(c, 58, 140, brief.title, 16, COLORS.amber, { fontStyle: '700' });
    this.text(c, 58, 172, brief.lines.join('\n'), 13, COLORS.ink, { lineSpacing: 10, wordWrap: { width: 396, useAdvancedWrap: true } });

    this.text(c, 490, 126, '武器', 13, COLORS.dim);
    weaponUnlocks.forEach((w, i) => {
      const y = 150 + i * 76;
      const owned = this.save.weapons.includes(w.weapon);
      const selected = i === this.cursor;
      const box = this.panel(c, 490, y, 430, 66, selected ? COLORS.cyan : COLORS.line);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.cursor = i;
        if (!owned && unlockWeapon(this.save, w.weapon)) persist();
        this.render();
      });
      this.text(c, 506, y + 10, w.name, 16, owned ? COLORS.ink : LOCKED, { fontStyle: '700' });
      this.text(c, 506, y + 36, w.note, 12, owned ? COLORS.dim : LOCKED);
      let status = '使える';
      let color = COLORS.green;
      if (!owned) {
        status = w.ready === false ? `未解放（${costText(w.cost)}）— 準備中` : `未解放（${costText(w.cost)}）クリックで解放`;
        color = w.ready !== false && canAfford(this.save, w.cost) ? COLORS.amber : LOCKED;
      }
      this.text(c, 906, y + 12, status, 12, color).setOrigin(1, 0);
    });

    const go = this.text(c, W / 2, 440, 'ENTER：出撃', 22, COLORS.amber, { fontFamily: FONTS.display, fontStyle: '700' }, () => this.sortie()).setOrigin(0.5);
    go.setShadow(0, 0, COLORS.amber, 10, false, true);
  }

  // ---- 恒久強化 ----
  renderUpgrades() {
    const c = this.content;
    this.text(c, 40, 122, 'ボス素材で、死んでも残る強化を買う。行をクリックするか、W・S で選んで Enter', 12, COLORS.dim);
    DATA.upgrades.all().forEach((def, i) => {
      const y = 146 + i * 56;
      const level = upgradeLevel(this.save, def.id);
      const cost = nextUpgradeCost(this.save, def);
      const ready = def.ready !== false;
      const buyable = ready && cost && canAfford(this.save, cost);
      const selected = i === this.cursor;
      const box = this.panel(c, 40, y, 880, 48, selected ? COLORS.cyan : COLORS.line);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.cursor = i;
        this.buy(def.id);
      });
      this.text(c, 56, y + 6, def.name, 15, ready ? COLORS.ink : LOCKED, { fontStyle: '700' });
      this.text(c, 56, y + 27, def.desc, 12, ready ? COLORS.dim : LOCKED);
      // 段階
      for (let k = 0; k < def.max; k++) {
        const pip = this.add.rectangle(430 + k * 20, y + 24, 14, 14, k < level ? hex(COLORS.green) : PANEL, 1).setStrokeStyle(1, hex(k < level ? COLORS.green : COLORS.dim));
        c.add(pip);
      }
      let status = '';
      let color = COLORS.dim;
      if (!ready) status = '準備中';
      else if (!cost) [status, color] = ['最大', COLORS.green];
      else [status, color] = [`${costText(cost)}${buyable ? '　— 買える' : ''}`, buyable ? COLORS.amber : COLORS.red];
      this.text(c, 904, y + 15, status, 13, color, { fontStyle: '700' }).setOrigin(1, 0);
    });
  }

  // ---- 記録 ----
  renderRecords() {
    const c = this.content;
    const r = this.save.records;
    const best = r.runs > 0 ? `${DATA.areas.get(AREA_ORDER[Math.min(r.bestArea, AREA_ORDER.length - 1)]).code}-${r.bestStep + 1}` : 'なし';
    const bosses = DATA.bosses.all().map((b) => `${b.name} ×${this.save.bossKills[b.id] ?? 0}`).join('　');
    const rows = [
      ['出撃した回数', `${r.runs}`],
      ['クリアした回数', `${r.clears}`],
      ['最高到達', best],
      ['倒した敵の数（累計）', `${r.kills}`],
      ['ボス撃破', bosses],
      ['データ片', `${this.save.fragments.length} / ${DATA.fragments.all().length}`],
      ['実績', `${this.save.achievements.length} / ${DATA.achievements.all().length}`],
    ];
    this.panel(c, 40, 126, 880, 40 + rows.length * 36);
    rows.forEach(([label, value], i) => {
      this.text(c, 60, 146 + i * 36, label, 14, COLORS.dim);
      this.text(c, 300, 146 + i * 36, value, 14, COLORS.ink, { fontStyle: '700' });
    });
    const label = this.confirmReset ? 'もう一度クリックすると、セーブデータをすべて消す' : 'セーブデータを消す';
    this.text(c, 40, 452, label, 12, this.confirmReset ? COLORS.red : COLORS.dim, {}, () => {
      if (this.confirmReset) {
        this.save = resetSave();
        this.confirmReset = false;
      } else {
        this.confirmReset = true;
      }
      this.render();
    });
  }

  // ---- データ片 ----
  renderFragments() {
    const c = this.content;
    const list = DATA.fragments.all();
    this.panel(c, 40, 126, 300, 330);
    list.forEach((f, i) => {
      const have = this.save.fragments.includes(f.id);
      const selected = i === this.cursor;
      const color = selected ? COLORS.cyan : have ? COLORS.ink : LOCKED;
      this.text(c, 56, 140 + i * 30, `${selected ? '▶ ' : '　 '}${have ? f.title : '？？？'}`, 14, color, { fontStyle: have ? '700' : '400' }, () => {
        this.cursor = i;
        this.render();
      });
    });
    this.panel(c, 356, 126, 564, 330);
    const f = list[this.cursor];
    if (!f) return;
    if (this.save.fragments.includes(f.id)) {
      this.text(c, 376, 144, f.title, 16, COLORS.cyan, { fontStyle: '700' });
      this.text(c, 376, 180, f.text, 14, COLORS.ink, { lineSpacing: 10, wordWrap: { width: 524, useAdvancedWrap: true } });
    } else {
      const where = f.source === 'boss' ? 'ボスを倒すと手に入る' : 'データ金庫で見つかる';
      this.text(c, 376, 144, '未回収', 16, LOCKED, { fontStyle: '700' });
      this.text(c, 376, 180, `${DATA.areas.get(f.area).name}の${where}。`, 14, COLORS.dim);
    }
  }

  // ---- 実績 ----
  renderAchievements() {
    const c = this.content;
    const list = DATA.achievements.all();
    this.text(c, 40, 122, `解除 ${this.save.achievements.length} / ${list.length}`, 12, COLORS.dim);
    list.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 40 + col * 445;
      const y = 146 + row * 62;
      const done = this.save.achievements.includes(def.id);
      this.panel(c, x, y, 435, 54, done ? COLORS.amber : COLORS.line);
      this.text(c, x + 14, y + 8, `${done ? '◆' : '◇'} ${def.name}`, 15, done ? COLORS.amber : COLORS.dim, { fontStyle: '700' });
      this.text(c, x + 14, y + 31, def.desc, 12, done ? COLORS.ink : LOCKED);
    });
  }
}
