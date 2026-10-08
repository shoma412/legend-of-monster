// ボス素材・データ片・実績のアイコン。どれも (g, x, y, s, c) で描く。s は大きさ、c は色（数値）。
import { ITEM_ICONS, SLOT_ICONS } from './icons.js';

const BODY_FILL = 0x0a0814;

function glowLine(g, color, width, draw) {
  g.lineStyle(width + 4, color, 0.16);
  draw();
  g.lineStyle(width, color, 1);
  draw();
}

function ngon(x, y, r, sides, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return pts;
}

function poly(g, c, pts, width = 2) {
  g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
  glowLine(g, c, width, () => g.strokePoints(pts, true, true));
}

// ボス素材：六角形のコア。中の印で、どのボスのものか分かる
export const MATERIAL_ICONS = {
  // ボアコア：稲妻
  boarCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    const bolt = [{ x: x + s * 0.2, y: y - s * 0.6 }, { x: x - s * 0.3, y: y + s * 0.05 }, { x: x + s * 0.1, y: y + s * 0.05 }, { x: x - s * 0.2, y: y + s * 0.6 }];
    g.lineStyle(2, c, 1).strokePoints(bolt, false, false);
  },
  // クライオコア：雪の結晶
  cryoCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      g.lineBetween(x - Math.cos(a) * s * 0.6, y - Math.sin(a) * s * 0.6, x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6);
    }
  },
  // オーバーコア：熱を持った核
  overCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1).strokeCircle(x, y, s * 0.5);
    g.fillStyle(c, 1).fillCircle(x, y, s * 0.22);
  },
  // サーペントコア：とぐろ
  serpentCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1);
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = i * 0.75;
      const r = s * (0.12 + 0.045 * i);
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    g.strokePoints(pts, false, false);
  },
  // クラブコア：はさみ
  crabCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1);
    g.strokePoints([{ x: x - s * 0.1, y: y + s * 0.55 }, { x: x - s * 0.5, y: y - s * 0.1 }, { x: x - s * 0.2, y: y - s * 0.6 }], false, false);
    g.strokePoints([{ x: x + s * 0.1, y: y + s * 0.55 }, { x: x + s * 0.5, y: y - s * 0.1 }, { x: x + s * 0.2, y: y - s * 0.6 }], false, false);
  },
  // ハイドラコア：三つ首
  hydraCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1);
    for (const dx of [-0.45, 0, 0.45]) {
      g.lineBetween(x, y + s * 0.5, x + dx * s, y - s * 0.25);
      g.fillStyle(c, 1).fillCircle(x + dx * s, y - s * 0.35, s * 0.16);
    }
  },
  // モスコア：羽
  mothCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1);
    for (const side of [-1, 1]) g.strokePoints([{ x, y: y - s * 0.1 }, { x: x + side * s * 0.6, y: y - s * 0.45 }, { x: x + side * s * 0.5, y: y + s * 0.35 }, { x, y: y + s * 0.1 }], false, false);
    g.lineBetween(x, y - s * 0.45, x, y + s * 0.45);
  },
  // レンズコア：レンズと、光の筋
  lensCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1).strokeCircle(x, y, s * 0.42);
    g.fillStyle(c, 1).fillCircle(x, y, s * 0.14);
    for (const a of [-0.5, 0.5]) g.lineBetween(x + Math.cos(a - Math.PI / 2) * s * 0.42, y + Math.sin(a - Math.PI / 2) * s * 0.42, x + Math.cos(a - Math.PI / 2) * s * 0.8, y + Math.sin(a - Math.PI / 2) * s * 0.8);
  },
  // ブレーカーコア：レバーのついたスイッチ
  breakerCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1).strokeRect(x - s * 0.3, y - s * 0.5, s * 0.6, s);
    g.lineBetween(x, y + s * 0.15, x + s * 0.35, y - s * 0.4);
    g.fillStyle(c, 1).fillCircle(x, y + s * 0.15, s * 0.12);
  },
  // アーキテクトコア：方眼と、定規の線
  architectCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.2, c, 1);
    for (const k of [-0.3, 0.3]) {
      g.lineBetween(x + k * s, y - s * 0.55, x + k * s, y + s * 0.55);
      g.lineBetween(x - s * 0.55, y + k * s, x + s * 0.55, y + k * s);
    }
  },
  // ノクターンコア：欠けた月
  nocturneCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1);
    g.beginPath();
    g.arc(x, y, s * 0.5, Math.PI * 0.35, Math.PI * 1.65, false);
    g.strokePath();
    g.beginPath();
    g.arc(x + s * 0.3, y, s * 0.42, Math.PI * 0.62, Math.PI * 1.38, false);
    g.strokePath();
  },
  // ハウンドコア：牙
  houndCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1);
    for (const dx of [-0.3, 0.3]) g.strokePoints([{ x: x + dx * s - s * 0.2, y: y - s * 0.45 }, { x: x + dx * s, y: y + s * 0.5 }, { x: x + dx * s + s * 0.2, y: y - s * 0.45 }], false, false);
  },
  // スパイダーコア：巣
  spiderCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.2, c, 1);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      g.lineBetween(x - Math.cos(a) * s * 0.7, y - Math.sin(a) * s * 0.7, x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7);
    }
    g.strokePoints(ngon(x, y, s * 0.4, 6, Math.PI / 6), true, true);
  },
  // タイタンコア：クレーン
  titanCore(g, x, y, s, c) {
    poly(g, c, ngon(x, y, s, 6, Math.PI / 6));
    g.lineStyle(1.5, c, 1);
    g.lineBetween(x - s * 0.35, y + s * 0.55, x - s * 0.35, y - s * 0.5);
    g.lineBetween(x - s * 0.35, y - s * 0.5, x + s * 0.5, y - s * 0.5);
    g.lineBetween(x + s * 0.35, y - s * 0.5, x + s * 0.35, y + s * 0.1);
    g.strokeRect(x + s * 0.2, y + s * 0.1, s * 0.3, s * 0.25);
  },
};

export function drawMaterialIcon(g, id, x, y, s, c) {
  (MATERIAL_ICONS[id] ?? MATERIAL_ICONS.overCore)(g, x, y, s, c);
}

// データ片：角の折れた記録（文字の行つき）。locked なら中身を描かない
export function drawFragmentIcon(g, x, y, s, c, locked = false) {
  const pts = [
    { x: x - s * 0.7, y: y - s },
    { x: x + s * 0.3, y: y - s },
    { x: x + s * 0.7, y: y - s * 0.6 },
    { x: x + s * 0.7, y: y + s },
    { x: x - s * 0.7, y: y + s },
  ];
  poly(g, c, pts);
  if (locked) return;
  g.lineStyle(1.5, c, 0.9);
  for (let i = 0; i < 3; i++) g.lineBetween(x - s * 0.4, y - s * 0.3 + i * s * 0.45, x + s * 0.4 - (i === 2 ? s * 0.3 : 0), y - s * 0.3 + i * s * 0.45);
}

// 実績：定義（src/data/achievements.js）の icon で選ぶ
export const ACHIEVEMENT_ICONS = {
  // 旗（初めての出撃）
  flag(g, x, y, s, c) {
    glowLine(g, c, 2, () => g.lineBetween(x - s * 0.6, y - s, x - s * 0.6, y + s));
    poly(g, c, [{ x: x - s * 0.6, y: y - s }, { x: x + s * 0.8, y: y - s * 0.55 }, { x: x - s * 0.6, y: y - s * 0.1 }]);
  },
  // 角の生えた頭（ボス撃破）
  skull(g, x, y, s, c) {
    g.fillStyle(BODY_FILL, 0.85).fillCircle(x, y + s * 0.1, s * 0.7);
    glowLine(g, c, 2, () => g.strokeCircle(x, y + s * 0.1, s * 0.7));
    glowLine(g, c, 2, () => g.lineBetween(x - s * 0.5, y - s * 0.4, x - s, y - s).lineBetween(x + s * 0.5, y - s * 0.4, x + s, y - s));
    g.fillStyle(c, 1).fillCircle(x - s * 0.26, y, 1.8).fillCircle(x + s * 0.26, y, 1.8);
  },
  // 盾（無傷）
  shield(g, x, y, s, c) {
    SLOT_ICONS.armor(g, x, y, s, c);
  },
  // 星（エリート）
  star(g, x, y, s, c) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? s : s * 0.45;
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    poly(g, c, pts);
  },
  // チップ（インプラント）
  chip(g, x, y, s, c) {
    poly(g, c, [{ x: x - s * 0.6, y: y - s * 0.6 }, { x: x + s * 0.6, y: y - s * 0.6 }, { x: x + s * 0.6, y: y + s * 0.6 }, { x: x - s * 0.6, y: y + s * 0.6 }]);
    g.lineStyle(1.5, c, 1);
    for (const d of [-0.3, 0.3]) g.lineBetween(x + s * d, y - s, x + s * d, y - s * 0.6).lineBetween(x + s * d, y + s * 0.6, x + s * d, y + s);
  },
  // 王冠（レジェンド）
  crown(g, x, y, s, c) {
    poly(g, c, [{ x: x - s, y: y + s * 0.6 }, { x: x - s, y: y - s * 0.5 }, { x: x - s * 0.4, y: y + s * 0.05 }, { x, y: y - s * 0.8 }, { x: x + s * 0.4, y: y + s * 0.05 }, { x: x + s, y: y - s * 0.5 }, { x: x + s, y: y + s * 0.6 }]);
  },
  // 記録（データ片）
  doc(g, x, y, s, c) {
    drawFragmentIcon(g, x, y, s, c);
  },
  // 重ねた記録（全部集めた）
  docs(g, x, y, s, c) {
    drawFragmentIcon(g, x + s * 0.25, y - s * 0.15, s * 0.8, c, true);
    drawFragmentIcon(g, x - s * 0.2, y + s * 0.15, s * 0.8, c);
  },
  // 数え棒（撃破数）
  tally(g, x, y, s, c) {
    glowLine(g, c, 2, () => {
      for (const d of [-0.6, -0.2, 0.2, 0.6]) g.lineBetween(x + s * d, y - s * 0.8, x + s * d, y + s * 0.8);
    });
    glowLine(g, c, 2, () => g.lineBetween(x - s, y + s * 0.5, x + s, y - s * 0.5));
  },
  // 武器3種
  greatsword(g, x, y, s, c) {
    glowLine(g, c, 4, () => g.lineBetween(x - s * 0.6, y + s * 0.8, x + s * 0.6, y - s * 0.9));
    glowLine(g, c, 2, () => g.lineBetween(x - s * 0.9, y + s * 0.2, x - s * 0.1, y + s * 0.75));
  },
  sword(g, x, y, s, c) {
    SLOT_ICONS.mod(g, x, y, s, c);
  },
  gun(g, x, y, s, c) {
    glowLine(g, c, 3.5, () => g.lineBetween(x - s * 0.8, y - s * 0.3, x + s * 0.9, y - s * 0.3));
    glowLine(g, c, 3.5, () => g.lineBetween(x - s * 0.5, y - s * 0.3, x - s * 0.7, y + s * 0.7));
  },
  // 上向きの矢印（レベル）
  up(g, x, y, s, c) {
    glowLine(g, c, 2.5, () => g.lineBetween(x, y + s, x, y - s * 0.7));
    glowLine(g, c, 2.5, () => g.strokePoints([{ x: x - s * 0.7, y: y - s * 0.1 }, { x, y: y - s }, { x: x + s * 0.7, y: y - s * 0.1 }], false, false));
  },
  // 弧の盾（ジャストガード）
  guard(g, x, y, s, c) {
    glowLine(g, c, 3, () => {
      g.beginPath();
      g.arc(x - s * 0.3, y, s, -1.1, 1.1, false);
      g.strokePath();
    });
    g.fillStyle(c, 1).fillCircle(x - s * 0.3, y, s * 0.22);
  },
  // 広がる輪（奥義）
  burst(g, x, y, s, c) {
    glowLine(g, c, 2, () => g.strokeCircle(x, y, s));
    glowLine(g, c, 2, () => g.strokeCircle(x, y, s * 0.5));
    g.fillStyle(c, 1).fillCircle(x, y, s * 0.16);
  },
  // 硬貨（闇市）
  coin(g, x, y, s, c) {
    g.fillStyle(BODY_FILL, 0.85).fillCircle(x, y, s);
    glowLine(g, c, 2, () => g.strokeCircle(x, y, s));
    glowLine(g, c, 2, () => g.lineBetween(x, y - s * 0.55, x, y + s * 0.55));
  },
  // 手榴弾（消耗品）
  grenade(g, x, y, s, c) {
    ITEM_ICONS.grenade(g, x, y, s * 0.9, c);
  },
  // 回る矢印（何度も出撃）
  repeat(g, x, y, s, c) {
    glowLine(g, c, 2.5, () => {
      g.beginPath();
      g.arc(x, y, s * 0.8, 0.6, Math.PI * 1.9, false);
      g.strokePath();
    });
    const a = Math.PI * 1.9;
    const tx = x + Math.cos(a) * s * 0.8;
    const ty = y + Math.sin(a) * s * 0.8;
    g.fillStyle(c, 1).fillTriangle(tx - s * 0.35, ty - s * 0.3, tx + s * 0.4, ty - s * 0.1, tx - s * 0.05, ty + s * 0.4);
  },
};

export function drawAchievementIcon(g, icon, x, y, s, c) {
  (ACHIEVEMENT_ICONS[icon] ?? ACHIEVEMENT_ICONS.star)(g, x, y, s, c);
}
