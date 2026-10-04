// 戦闘画面の上に重ねるパネル（装備の比較、インプラント3択、装備とインプラントの一覧）
import { LOOT, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { families } from '../data/implants.js';
import { COLORS, ELEMENT_COLORS, FONTS, RARITY_COLORS, hex } from '../data/theme.js';
import { describeItem } from '../logic/loot.js';
import { activeFamilyBonuses, familyCounts } from '../logic/stats.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL_BG = 0x110f1d;

export function rarityColor(item) {
  return RARITY_COLORS[LOOT.rarities[item.rarity].id];
}

function familyColor(family) {
  const c = families[family].color;
  return ELEMENT_COLORS[c] ?? COLORS[c];
}

function slotName(slotId) {
  return LOOT.slots.find((s) => s.id === slotId).name;
}

const body = (size, color = COLORS.ink, extra = {}) => ({ fontFamily: FONTS.body, fontSize: `${size}px`, color, ...extra });

// ---- 装備の比較（落ちている装備に近づくと出る） ----

export function createComparePanel(scene) {
  const c = scene.add.container(W / 2, 40).setDepth(8).setVisible(false);
  const bg = scene.add.rectangle(0, 0, 500, 100, PANEL_BG, 0.92).setOrigin(0.5, 0).setStrokeStyle(1, hex(COLORS.line));
  const wrap = { wordWrap: { width: 220, useAdvancedWrap: true }, lineSpacing: 3 };
  const col = (x) => ({
    head: scene.add.text(x, 8, '', body(11, COLORS.dim)),
    name: scene.add.text(x, 24, '', body(13, COLORS.ink, { fontStyle: '700' })),
    lines: scene.add.text(x, 44, '', body(12, COLORS.ink, wrap)),
  });
  const left = col(-236);
  const right = col(14);
  const divider = scene.add.rectangle(0, 8, 1, 60, hex(COLORS.line)).setOrigin(0.5, 0);
  const hint = scene.add.text(0, 0, '', body(13, COLORS.amber, { fontStyle: '700' })).setOrigin(0.5, 0);
  c.add([bg, divider, left.head, left.name, left.lines, right.head, right.name, right.lines, hint]);

  let shown = null;
  let shownEquipped = null;
  return {
    // focus: 比べる装備 { item, head, hint }（なければ null）, gear: 今の装備
    update(focus, gear) {
      if (!focus) {
        shown = null;
        c.setVisible(false);
        return;
      }
      const item = focus.item;
      const equipped = gear[item.slot];
      if (item === shown && equipped === shownEquipped) return;
      shown = item;
      shownEquipped = equipped;

      left.head.setText(`${focus.head}（${slotName(item.slot)}）`);
      left.name.setText(item.name).setColor(rarityColor(item));
      left.lines.setText(describeItem(item).join('\n'));
      right.head.setText('今の装備');
      if (equipped) {
        right.name.setText(equipped.name).setColor(rarityColor(equipped));
        right.lines.setText(describeItem(equipped).join('\n'));
      } else {
        right.name.setText('なし').setColor(COLORS.dim);
        right.lines.setText('');
      }
      const bottom = 44 + Math.max(left.lines.height, right.lines.height, 16) + 8;
      divider.setSize(1, bottom - 12);
      const base = focus.hint ?? (equipped ? 'E：付け替える' : 'E：装備する');
      hint.setText(equipped ? `${base}（外した装備はその場に落ちる）` : base).setY(bottom);
      bg.setSize(500, bottom + 26);
      c.setVisible(true);
    },
  };
}

// ---- インプラント3択（レベルアップ時） ----

const CARD_W = 260;
const CARD_H = 220;
const CARD_GAP = 20;

export function createChoicePanel(scene, onChoose) {
  const c = scene.add.container(0, 0).setDepth(20).setVisible(false);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.78);
  const title = scene.add.text(W / 2, 96, '', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '30px', color: COLORS.magenta }).setOrigin(0.5).setShadow(0, 0, COLORS.magenta, 14, false, true);
  const sub = scene.add.text(W / 2, 132, 'インプラントを1つ選ぶ（1・2・3 キー または クリック）', body(13, COLORS.dim)).setOrigin(0.5);
  c.add([dim, title, sub]);

  const total = CARD_W * 3 + CARD_GAP * 2;
  const cards = [0, 1, 2].map((i) => {
    const x = (W - total) / 2 + i * (CARD_W + CARD_GAP);
    const y = 160;
    const bg = scene.add.rectangle(x, y, CARD_W, CARD_H, PANEL_BG, 1).setOrigin(0).setStrokeStyle(2, hex(COLORS.line));
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => onChoose(i));
    const key = scene.add.text(x + 14, y + 12, `${i + 1}`, { fontFamily: FONTS.display, fontStyle: '700', fontSize: '20px', color: COLORS.dim });
    const family = scene.add.text(x + CARD_W - 14, y + 16, '', body(12, COLORS.ink, { fontStyle: '700' })).setOrigin(1, 0);
    const name = scene.add.text(x + 14, y + 50, '', body(18, COLORS.ink, { fontStyle: '700' }));
    const desc = scene.add.text(x + 14, y + 84, '', body(13, COLORS.ink, { wordWrap: { width: CARD_W - 28, useAdvancedWrap: true }, lineSpacing: 5 }));
    const note = scene.add.text(x + 14, y + CARD_H - 14, '', body(12, COLORS.dim, { wordWrap: { width: CARD_W - 28, useAdvancedWrap: true }, lineSpacing: 4 })).setOrigin(0, 1);
    c.add([bg, key, family, name, desc, note]);
    return { bg, key, family, name, desc, note, parts: [bg, key, family, name, desc, note] };
  });

  let shown = null;
  return {
    update(choice, build) {
      if (!choice) {
        shown = null;
        c.setVisible(false);
        return;
      }
      if (choice === shown) return;
      shown = choice;
      title.setText(`LEVEL UP　Lv ${build.level}`);
      const counts = familyCounts(build);
      cards.forEach((card, i) => {
        const def = choice.options[i];
        card.parts.forEach((p) => p.setVisible(!!def));
        if (!def) return;
        const fam = families[def.family];
        const color = familyColor(def.family);
        card.bg.setStrokeStyle(2, hex(color));
        card.family.setText(fam.name).setColor(color);
        card.name.setText(def.name);
        card.desc.setText(def.desc);
        const notes = [];
        const owned = build.implants[def.id] ?? 0;
        if (owned > 0) notes.push(`所持 ×${owned}（重ねがけ）`);
        if (fam.bonus) {
          const have = counts[def.family] ?? 0;
          notes.push(`${fam.name}系統 ${have}→${have + 1} / ${fam.bonus.need}`);
          if (have + 1 === fam.bonus.need) notes.push(`系統ボーナス発動：${fam.bonus.desc}`);
        }
        card.note.setText(notes.join('\n')).setColor(notes.length > 2 || (fam.bonus && (counts[def.family] ?? 0) + 1 === fam.bonus.need) ? COLORS.amber : COLORS.dim);
      });
      c.setVisible(true);
    },
  };
}

// ---- 装備とインプラントの一覧（画面右上） ----

export function createBuildList(scene) {
  const x = W - 56; // 右端にスロットのアイコンが入る
  const gearTexts = LOOT.slots.map((s, i) => scene.add.text(x, 36 + i * 15, '', body(11)).setOrigin(1, 0).setAlpha(0.9).setDepth(6));
  const implantText = scene.add.text(x, 36 + LOOT.slots.length * 15 + 6, '', body(11, COLORS.dim, { align: 'right', lineSpacing: 2 })).setOrigin(1, 0).setAlpha(0.9).setDepth(6);
  let key = '';
  return {
    update(build) {
      // 中身が変わったときだけ書き直す
      const next = JSON.stringify([build.gear, build.implants]);
      if (next === key) return;
      key = next;
      LOOT.slots.forEach((s, i) => {
        const item = build.gear[s.id];
        gearTexts[i].setText(item ? `${s.name}：${item.name}` : `${s.name}：なし`).setColor(item ? rarityColor(item) : '#4a4470');
      });
      const lines = Object.entries(build.implants).map(([id, n]) => DATA.implants.get(id).name + (n > 1 ? ` ×${n}` : ''));
      for (const f of activeFamilyBonuses(build)) lines.push(`◆ ${families[f].name}系統：${families[f].bonus.desc}`);
      implantText.setText(lines.join('\n'));
    },
  };
}

// ---- 通信ログ（画面左上に1文字ずつ流れる。戦闘は止めない） ----

const COMM_SPEED = 38; // 1秒に出す文字数
const COMM_HOLD = 4500; // 出し終わってから消えるまで（ミリ秒）

export function createCommLog(scene) {
  const text = scene.add.text(40, 76, '', body(13, COLORS.amber, { fontStyle: '700', lineSpacing: 5, wordWrap: { width: 460, useAdvancedWrap: true } }))
    .setDepth(7).setShadow(0, 0, '#000000', 4, false, true).setVisible(false);
  let full = '';
  let shown = 0;
  let hold = 0;
  return {
    play(lines) {
      if (!lines?.length) return;
      full = lines.join('\n');
      shown = 0;
      hold = COMM_HOLD;
      text.setText('').setAlpha(1).setVisible(true);
    },
    update(deltaMs) {
      if (!text.visible) return;
      if (shown < full.length) {
        shown = Math.min(full.length, shown + (COMM_SPEED * deltaMs) / 1000);
        text.setText(full.slice(0, Math.floor(shown)));
      } else {
        hold -= deltaMs;
        if (hold < 600) text.setAlpha(Math.max(0, hold / 600));
        if (hold <= 0) text.setVisible(false);
      }
    },
  };
}

// ---- 通知（画面左下に積み上がる：実績解除、ボス素材、データ片） ----

const TOAST_LIFE = 5000; // 出ている時間（ミリ秒）
const TOAST_COLORS = { achievement: COLORS.amber, material: ELEMENT_COLORS.shock, fragment: COLORS.cyan };

export function createToasts(scene) {
  const items = []; // { text: Text, life }
  return {
    push(note) {
      const color = TOAST_COLORS[note.kind] ?? COLORS.ink;
      const text = scene.add.text(40, 0, note.text, body(14, color, { fontStyle: '700' })).setDepth(12).setShadow(0, 0, '#000000', 4, false, true);
      items.push({ text, life: TOAST_LIFE });
    },
    update(deltaMs) {
      for (const item of items) item.life -= deltaMs;
      while (items.length > 0 && items[0].life <= 0) items.shift().text.destroy();
      // 新しいものが下。古いものほど上に押し上げられる
      items.forEach((item, i) => {
        item.text.setY(H - 62 - (items.length - 1 - i) * 22).setAlpha(Math.min(1, item.life / 500));
      });
    },
  };
}
