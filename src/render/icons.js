// ひと目で種類が分かるためのアイコン。装備のスロット（武器モッド・防具・アクセ）と、消耗品。
// どれも (g, x, y, s, c) で描く。s は大きさ、c は色（数値）。

function glowLine(g, color, width, draw) {
  g.lineStyle(width + 4, color, 0.16);
  draw();
  g.lineStyle(width, color, 1);
  draw();
}

const BODY_FILL = 0x0a0814;

// 装備のスロット
export const SLOT_ICONS = {
  // 武器モッド：斜めの刃と鍔
  mod(g, x, y, s, c) {
    glowLine(g, c, 2.5, () => g.lineBetween(x - s * 0.75, y + s * 0.75, x + s * 0.85, y - s * 0.85));
    glowLine(g, c, 2.5, () => g.lineBetween(x - s * 0.85, y + s * 0.15, x - s * 0.15, y + s * 0.85));
  },
  // 防具：盾
  armor(g, x, y, s, c) {
    const pts = [
      { x: x - s * 0.8, y: y - s * 0.8 },
      { x: x + s * 0.8, y: y - s * 0.8 },
      { x: x + s * 0.8, y: y + s * 0.1 },
      { x, y: y + s },
      { x: x - s * 0.8, y: y + s * 0.1 },
    ];
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    glowLine(g, c, 2.5, () => g.strokePoints(pts, true, true));
    g.lineStyle(2, c, 0.8).lineBetween(x, y - s * 0.45, x, y + s * 0.45);
  },
  // アクセ：石のついた指輪
  acc(g, x, y, s, c) {
    g.fillStyle(BODY_FILL, 0.85).fillCircle(x, y + s * 0.15, s * 0.72);
    glowLine(g, c, 2.5, () => g.strokeCircle(x, y + s * 0.15, s * 0.72));
    const gem = [
      { x, y: y - s * 1.05 },
      { x: x + s * 0.38, y: y - s * 0.62 },
      { x, y: y - s * 0.2 },
      { x: x - s * 0.38, y: y - s * 0.62 },
    ];
    g.fillStyle(c, 1).fillPoints(gem, true);
  },
};

export function drawSlotIcon(g, slot, x, y, s, c) {
  SLOT_ICONS[slot](g, x, y, s, c);
}

// 消耗品
export const ITEM_ICONS = {
  // 手榴弾：丸い本体と、上のピン
  grenade(g, x, y, s, c) {
    g.fillStyle(BODY_FILL, 0.85).fillCircle(x, y + s * 0.15, s * 0.75);
    glowLine(g, c, 2.5, () => g.strokeCircle(x, y + s * 0.15, s * 0.75));
    glowLine(g, c, 2.5, () => g.lineBetween(x, y - s * 0.6, x, y - s * 1.05).lineBetween(x, y - s * 1.05, x + s * 0.55, y - s * 1.05));
    g.fillStyle(c, 1).fillCircle(x, y + s * 0.15, s * 0.22);
  },
  // スプレー缶
  spray(g, x, y, s, c) {
    g.fillStyle(BODY_FILL, 0.85).fillRect(x - s * 0.5, y - s * 0.45, s, s * 1.4);
    glowLine(g, c, 2.5, () => g.strokeRect(x - s * 0.5, y - s * 0.45, s, s * 1.4));
    glowLine(g, c, 2.5, () => g.lineBetween(x - s * 0.2, y - s * 0.45, x - s * 0.2, y - s * 0.9).lineBetween(x - s * 0.2, y - s * 0.9, x + s * 0.5, y - s * 0.9));
    g.fillStyle(c, 1).fillCircle(x + s * 0.85, y - s * 0.9, 1.5);
  },
  // 注射器
  syringe(g, x, y, s, c) {
    glowLine(g, c, 4, () => g.lineBetween(x - s * 0.5, y + s * 0.5, x + s * 0.45, y - s * 0.45));
    glowLine(g, c, 1.5, () => g.lineBetween(x - s * 0.5, y + s * 0.5, x - s * 0.95, y + s * 0.95));
    glowLine(g, c, 2.5, () => g.lineBetween(x + s * 0.2, y - s * 0.75, x + s * 0.75, y - s * 0.2).lineBetween(x + s * 0.45, y - s * 0.45, x + s * 0.85, y - s * 0.85));
  },
  // 煙
  cloud(g, x, y, s, c) {
    g.fillStyle(BODY_FILL, 0.85);
    glowLine(g, c, 2, () => g.strokeCircle(x - s * 0.45, y + s * 0.2, s * 0.5));
    glowLine(g, c, 2, () => g.strokeCircle(x + s * 0.45, y + s * 0.2, s * 0.5));
    glowLine(g, c, 2, () => g.strokeCircle(x, y - s * 0.3, s * 0.55));
  },
};

export function drawItemIcon(g, icon, x, y, s, c) {
  ITEM_ICONS[icon](g, x, y, s, c);
}
