// マップを選ぶ画面。隠れ家の出撃ゲートを調べると開く。
//   A・D（← →）：マップを選ぶ　　W・S（↑ ↓）：周を選ぶ（2周目以降が選べるとき）　　Q・E：持ち込みの種族を選ぶ
//   Enter：出撃　　Esc：やめる　　クリックでも選べる
// 開いている間は、使う側がゲームの進行を止める（isOpen を見る）。
import { playSe } from '../audio/audio.js';
import { SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, FONTS, hex } from '../data/theme.js';
import { species } from '../data/implants.js';
import { canSortieCycle, clearedCycle, cycleNotes, mapState } from '../logic/maps.js';
import { permanentBonuses } from '../logic/meta.js';
import { carryOptions, mapSpecies } from '../logic/stats.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL = 0x110f1d;
const LOCKED = '#4a4470';
const CARD_W = 116;
const CARD_H = 132;
const CARD_GAP = 8;
const GUARD_MS = 180; // 閉じた直後に、同じキーやクリックがゲーム側に効かないようにする時間

const STATE_LABELS = { notReady: '準備中', locked: '未解放', open: '出撃できる', done: '完了' };

// options: { save: () => セーブデータ, onStart: (mapId, cycle, carry) => void, onChange: () => void（選んだマップや周を保存する） }
export function createMapSelect(scene, options) {
  const root = scene.add.container(0, 0).setDepth(35).setVisible(false);
  let closedAt = -Infinity;
  let index = 0; // 選んでいるマップ
  let cycle = 1; // 選んでいる周
  const maps = DATA.maps.all();

  const box = {
    isOpen: false,
    get blocking() {
      return box.isOpen || performance.now() - closedAt < GUARD_MS;
    },
    open() {
      const save = options.save();
      index = Math.max(0, maps.findIndex((m) => m.id === save.selectedMap));
      cycle = Math.max(1, Math.min(save.cycle, save.selectedCycle ?? 1));
      box.isOpen = true;
      root.setVisible(true);
      render();
    },
    close() {
      box.isOpen = false;
      closedAt = performance.now();
      root.setVisible(false);
    },
  };

  const text = (x, y, str, size, color, extra = {}) => {
    const t = scene.add.text(x, y, str, { fontFamily: FONTS.body, fontSize: `${size}px`, color, ...extra });
    root.add(t);
    return t;
  };
  const button = (x, y, w, h, label, color, onClick) => {
    const bg = scene.add.rectangle(x, y, w, h, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, hex(color)).setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    root.add(bg);
    text(x + w / 2, y + h / 2, label, 14, color, { fontStyle: '700' }).setOrigin(0.5);
  };

  function remember() {
    const save = options.save();
    save.selectedMap = maps[index].id;
    save.selectedCycle = cycle;
    options.onChange?.();
  }

  function move(delta) {
    index = (index + delta + maps.length) % maps.length;
    playSe('select');
    remember();
    render();
  }

  function changeCycle(delta) {
    const save = options.save();
    const next = Math.max(1, Math.min(save.cycle, cycle + delta));
    if (next === cycle) return;
    cycle = next;
    playSe('select');
    remember();
    render();
  }

  // 持ち込みの枠（セーブデータの項目の名前）。枠の数は、恒久強化で増える
  const CARRY_KEYS = ['carrySpecies', 'carrySpecies2'];
  const carrySlots = (save) => Math.min(CARRY_KEYS.length, permanentBonuses(save).carrySlots);

  // 選んでいる持ち込みの種族（枠ごと。そのマップで選べないものや、ほかの枠と同じものは null）
  function currentCarry(save, map) {
    const ok = carryOptions(save, map);
    const picked = [];
    for (let slot = 0; slot < carrySlots(save); slot++) {
      const id = save[CARRY_KEYS[slot]];
      picked.push(ok.includes(id) && !picked.includes(id) ? id : null);
    }
    return picked;
  }

  // 持ち込みの種族を切り替える（なし → 1つ目 → 2つ目 → … → なし）。ほかの枠で選んでいるものは飛ばす
  function changeCarry(delta, slot = 0) {
    const save = options.save();
    if (slot >= carrySlots(save)) return;
    const now = currentCarry(save, maps[index]);
    const others = now.filter((id, i) => i !== slot && id);
    const list = [null, ...carryOptions(save, maps[index]).filter((id) => !others.includes(id))];
    if (list.length <= 1) return;
    const at = Math.max(0, list.indexOf(now[slot]));
    save[CARRY_KEYS[slot]] = list[(at + delta + list.length) % list.length];
    playSe('select');
    options.onChange?.();
    render();
  }

  function start() {
    const save = options.save();
    const map = maps[index];
    if (!canSortieCycle(save, map, cycle)) {
      playSe('deny');
      return;
    }
    playSe('confirm');
    box.close();
    options.onStart(map.id, cycle, currentCarry(save, map).filter(Boolean));
  }

  function render() {
    root.removeAll(true);
    const save = options.save();
    const cover = scene.add.rectangle(0, 0, W, H, 0x07060d, 0.86).setOrigin(0).setInteractive();
    root.add(cover);
    text(W / 2, 46, 'SORTIE // 出撃先を選ぶ', 24, COLORS.amber, { fontFamily: FONTS.display, fontStyle: '700' }).setOrigin(0.5).setShadow(0, 0, COLORS.amber, 12, false, true);

    // マップのカード（7つ）
    const left = (W - maps.length * CARD_W - (maps.length - 1) * CARD_GAP) / 2;
    maps.forEach((map, i) => {
      const x = left + i * (CARD_W + CARD_GAP);
      const y = 84;
      const state = mapState(save, map);
      const on = i === index;
      const usable = state === 'open' || state === 'done';
      const color = !usable ? LOCKED : state === 'done' ? COLORS.green : COLORS.cyan;
      const card = scene.add.rectangle(x, y, CARD_W, CARD_H, on ? 0x1b1631 : PANEL, 0.95).setOrigin(0).setStrokeStyle(on ? 2 : 1, hex(on ? COLORS.amber : usable ? color : COLORS.line));
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (index !== i) move(i - index);
      });
      root.add(card);
      text(x + CARD_W / 2, y + 16, map.code, 15, on ? COLORS.amber : color, { fontFamily: FONTS.display, fontStyle: '700' }).setOrigin(0.5);
      text(x + CARD_W / 2, y + 52, usable ? map.name : '？？？', 16, usable ? COLORS.ink : LOCKED, { fontStyle: '700' }).setOrigin(0.5);
      text(x + CARD_W / 2, y + 84, STATE_LABELS[state], 12, color, { fontStyle: '700' }).setOrigin(0.5);
      const clears = save.maps[map.id]?.clears ?? 0;
      if (clears > 0) text(x + CARD_W / 2, y + 108, `クリア ${clears} 回`, 11, COLORS.dim).setOrigin(0.5);
    });

    // 選んでいるマップのくわしい中身
    const map = maps[index];
    const state = mapState(save, map);
    const usable = state === 'open' || state === 'done';
    const py = 232;
    const panel = scene.add.rectangle(60, py, W - 120, 186, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, hex(COLORS.line));
    root.add(panel);
    if (usable) {
      const areas = map.areas.map((id) => DATA.areas.get(id));
      text(80, py + 14, `${map.code}　${map.name}`, 18, COLORS.ink, { fontStyle: '700' });
      text(80, py + 46, `エリア：${areas.map((a) => a.name).join(' → ')}`, 13, COLORS.ink);
      text(80, py + 70, `標的：${areas.map((a) => DATA.bosses.get(a.boss).name).join(' → ')}`, 13, COLORS.ink);
      const best = clearedCycle(save, map.id);
      text(W - 80, py + 18, best > 0 ? `完了済み（最高 ${best}周目）` : 'まだ完了していない', 12, best > 0 ? COLORS.green : COLORS.dim).setOrigin(1, 0);
      // 出る種族：そのマップの種族と、持ち込みの種族（1つ）
      const names = mapSpecies(map).map((id) => species[id].name).join('・');
      text(80, py + 94, `出る種族：${names}`, 13, COLORS.ink);
      const carryList = carryOptions(save, map);
      const carry = currentCarry(save, map);
      const tx = 80 + 300;
      text(tx, py + 94, '持ち込み', 13, COLORS.dim, { fontStyle: '700' });
      if (carryList.length === 0) {
        text(tx + 70, py + 95, 'なし（ほかのマップのボスを倒すと、その種族を持ち込める）', 12, LOCKED);
      } else {
        // 枠ごとに ◀ 名前 ▶（枠は、恒久強化で2つまで増える）
        carry.forEach((id, slot) => {
          const sx = tx + 70 + slot * 190;
          button(sx, py + 88, 26, 26, '◀', COLORS.ink, () => changeCarry(-1, slot));
          text(sx + 80, py + 101, id ? species[id].name : 'なし', 15, id ? COLORS.amber : COLORS.dim, { fontStyle: '700' }).setOrigin(0.5);
          button(sx + 134, py + 88, 26, 26, '▶', COLORS.ink, () => changeCarry(1, slot));
        });
        text(W - 80, py + 72, carry.length > 1 ? 'Q・E：1つ目　Z・C：2つ目' : 'Q・E で切り替え', 11, COLORS.dim).setOrigin(1, 0);
      }

      // 周の選択（2周目以降が選べるときだけ）
      if (save.cycle > 1) {
        const cx = 80;
        const cy = py + 124;
        text(cx, cy + 4, '周回', 13, COLORS.dim, { fontStyle: '700' });
        button(cx + 50, cy, 30, 26, '◀', cycle > 1 ? COLORS.ink : LOCKED, () => changeCycle(-1));
        text(cx + 130, cy + 13, `${cycle}周目`, 16, COLORS.amber, { fontStyle: '700' }).setOrigin(0.5);
        button(cx + 180, cy, 30, 26, '▶', cycle < save.cycle ? COLORS.ink : LOCKED, () => changeCycle(1));
        const notes = cycleNotes(cycle);
        text(cx + 230, cy - 2, notes.length > 0 ? notes.join('\n') : '敵の強さは、最初と同じ', 12, notes.length > 0 ? COLORS.red : COLORS.dim, { lineSpacing: 4 });
      } else {
        text(80, py + 128, 'いま選べるマップをすべて完了すると、次の周（敵が強くなる）に進めるようになる', 12, COLORS.dim);
      }
    } else {
      const why = state === 'notReady' ? 'このマップは、まだ準備中' : '前のマップを完了すると、選べるようになる';
      text(W / 2, py + 93, why, 15, LOCKED, { fontStyle: '700' }).setOrigin(0.5);
    }

    const weapon = DATA.weapons.get(save.selected);
    button(W / 2 - 230, 438, 220, 38, `出撃する（Enter）`, usable ? COLORS.amber : LOCKED, start);
    button(W / 2 + 10, 438, 220, 38, 'やめる（Esc）', COLORS.ink, () => box.close());
    text(W / 2, 498, `武器：${weapon.name}　　A・D：マップ${save.cycle > 1 ? '　W・S：周回' : ''}　Enter：出撃　Esc：やめる`, 12, COLORS.dim).setOrigin(0.5);
  }

  const kb = scene.input.keyboard;
  const on = (keys, run) => keys.forEach((key) => kb.on(`keydown-${key}`, () => box.isOpen && run()));
  on(['A', 'LEFT'], () => move(-1));
  on(['D', 'RIGHT'], () => move(1));
  on(['W', 'UP'], () => changeCycle(1));
  on(['S', 'DOWN'], () => changeCycle(-1));
  on(['Q'], () => changeCarry(-1, 0));
  on(['E'], () => changeCarry(1, 0));
  on(['Z'], () => changeCarry(-1, 1));
  on(['C'], () => changeCarry(1, 1));
  on(['ENTER'], start);
  on(['ESC'], () => box.close());

  return box;
}
