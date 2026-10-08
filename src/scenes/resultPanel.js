// リザルト画面（死亡したとき、最後まで進んだとき）。
// 持ち帰ったものを「ボス素材・データ片・実績」の3つの欄に分け、それぞれアイコンつきで並べる。
// 「隠れ家に戻る」は画面のボタン（攻撃の連打で誤って押さないよう、出てから少しの間は押せない）。
import { SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { AREA_THEMES, COLORS, ELEMENT_COLORS, FONTS, hex } from '../data/theme.js';
import { drawAchievementIcon, drawFragmentIcon, drawMaterialIcon } from '../render/metaIcons.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL = 0x110f1d;
const BUTTON_LOCK = 700; // 出てからボタンが押せるようになるまで（ミリ秒）
const MAX_ROWS = 7; // 1つの欄に並べる数。これより多いぶんは「ほか n 件」

export function createResultPanel(scene) {
  const root = scene.add.container(0, 0).setDepth(20).setVisible(false);
  const body = (size, color, extra = {}) => ({ fontFamily: FONTS.body, fontSize: `${size}px`, color, ...extra });
  const text = (x, y, str, size, color, extra) => {
    const t = scene.add.text(x, y, str, body(size, color, extra));
    root.add(t);
    return t;
  };

  // 1つの欄。rows: [{ draw(g, x, y), text, color }]
  const column = (g, x, title, color, rows) => {
    const y = 158;
    const box = scene.add.rectangle(x, y, 280, 232, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, hex(rows.length > 0 ? color : COLORS.line));
    root.add(box);
    text(x + 14, y + 10, title, 14, rows.length > 0 ? color : COLORS.dim, { fontStyle: '700' });
    text(x + 266, y + 12, rows.length > 0 ? `${rows.length} 件` : '', 12, COLORS.dim).setOrigin(1, 0);
    if (rows.length === 0) {
      text(x + 140, y + 120, 'なし', 14, '#4a4470', { fontStyle: '700' }).setOrigin(0.5);
      return;
    }
    rows.slice(0, MAX_ROWS).forEach((row, i) => {
      const ry = y + 44 + i * 25;
      row.draw(g, x + 24, ry + 9);
      text(x + 44, ry, row.text, 13, row.color ?? COLORS.ink, { fontStyle: '700' });
    });
    if (rows.length > MAX_ROWS) text(x + 44, y + 44 + MAX_ROWS * 25, `ほか ${rows.length - MAX_ROWS} 件`, 12, COLORS.dim);
  };

  let done = null; // 「隠れ家に戻る」が押せるようになったら、その働き
  return {
    get visible() {
      return root.visible;
    },

    // ゲームパッドの A：「隠れ家に戻る」（押せるようになるまでは、何もしない）
    confirm() {
      done?.();
    },

    // info: { title, color, reach, kills, gained: { materials, fragments, achievements }, note, onDone }
    show(info) {
      root.removeAll(true);
      done = null;
      root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.9).setInteractive());
      const title = text(W / 2, 62, info.title, 44, info.color, { fontFamily: FONTS.display, fontStyle: '700' }).setOrigin(0.5);
      title.setShadow(0, 0, info.color, 16, false, true);
      text(W / 2, 112, `到達　${info.reach}　　　撃破数　${info.kills}`, 15, COLORS.ink, { fontStyle: '700' }).setOrigin(0.5);
      text(W / 2, 138, '持ち帰ったもの', 12, COLORS.dim).setOrigin(0.5);

      const g = scene.add.graphics();
      root.add(g);
      const gained = info.gained;
      const materials = Object.entries(gained.materials).map(([id, n]) => {
        const def = DATA.materials.get(id);
        const color = ELEMENT_COLORS[def.color] ?? COLORS[def.color];
        return { draw: (gg, x, y) => drawMaterialIcon(gg, id, x, y, 8, hex(color)), text: `${def.name} ×${n}`, color };
      });
      const fragments = gained.fragments.map((id) => {
        const def = DATA.fragments.get(id);
        const color = AREA_THEMES[DATA.areas.get(def.area).theme].edge;
        return { draw: (gg, x, y) => drawFragmentIcon(gg, x, y, 8, hex(color)), text: def.title };
      });
      const achievements = gained.achievements.map((id) => {
        const def = DATA.achievements.get(id);
        const color = ELEMENT_COLORS[def.color] ?? COLORS.amber;
        return { draw: (gg, x, y) => drawAchievementIcon(gg, def.icon, x, y, 8, hex(color)), text: def.name, color: COLORS.amber };
      });
      column(g, 40, 'ボス素材', ELEMENT_COLORS.shock, materials);
      column(g, 340, 'データ片', COLORS.cyan, fragments);
      column(g, 640, '実績', COLORS.amber, achievements);

      root.bringToTop(g); // アイコンが欄の枠に隠れないように
      text(W / 2, 404, info.note, 12, COLORS.dim).setOrigin(0.5);

      // 隠れ家に戻るボタン
      const button = scene.add.rectangle(W / 2, 452, 280, 44, PANEL, 0.95).setStrokeStyle(2, hex(COLORS.amber)).setAlpha(0.35);
      const label = text(W / 2, 452, '隠れ家に戻る', 17, COLORS.amber, { fontStyle: '700' }).setOrigin(0.5).setAlpha(0.35);
      root.add(button);
      root.bringToTop(label);
      scene.time.delayedCall(BUTTON_LOCK, () => {
        if (!button.active) return;
        button.setAlpha(1).setInteractive({ useHandCursor: true });
        label.setAlpha(1);
        button.on('pointerover', () => button.setFillStyle(0x2a2546, 1));
        button.on('pointerout', () => button.setFillStyle(PANEL, 0.95));
        button.on('pointerdown', () => info.onDone());
        done = info.onDone;
      });
      root.setVisible(true);
    },
  };
}
