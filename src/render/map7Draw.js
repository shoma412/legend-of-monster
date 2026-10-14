// マップ7のボスの固有の攻撃の絵（動きは src/game/map7Bosses.js）。
import { COLORS, hex } from '../data/theme.js';
import { lineTelegraph, ringTelegraph } from './map1Draw.js';

const WHITE = 0xffffff;
const RED = () => hex(COLORS.red);

// 門板の、いまの長方形（[x, y, w, h] の2枚）。trav は 0〜1（最後まで閉じた割合）
function slabRects(world, h, trav) {
  const bd = world.bounds;
  const a = h.maxA * trav;
  const b = h.maxB * trav;
  if (h.axis === 'x') return [[bd.left, bd.top, a, bd.bottom - bd.top], [bd.right - b, bd.top, b, bd.bottom - bd.top]];
  return [[bd.left, bd.top, bd.right - bd.left, a], [bd.left, bd.bottom - b, bd.right - bd.left, b]];
}

export const HAZARD_DRAWS_MAP7 = {
  // 門板：予告（閉まりきったときの位置を、赤く示す）→ 閉まる板
  gateslab(g, h, world) {
    if (h.wait > 0) return;
    const body = hex(h.color);
    if (h.phase === 'warn') {
      const k = 1 - h.warn / h.warnMax;
      for (const [x, y, w, hh] of slabRects(world, h, 1)) {
        g.fillStyle(RED(), 0.06 + 0.16 * k).fillRect(x, y, w, hh);
        g.lineStyle(2, RED(), 0.4 + 0.5 * k).strokeRect(x, y, w, hh);
      }
      return;
    }
    for (const [x, y, w, hh] of slabRects(world, h, h.trav)) {
      if (w <= 0 || hh <= 0) continue;
      g.fillStyle(0x0a0814, 0.95).fillRect(x, y, w, hh);
      g.fillStyle(body, 0.25).fillRect(x, y, w, hh);
      g.lineStyle(3, body, 0.95).strokeRect(x, y, w, hh);
      g.lineStyle(1.5, WHITE, 0.6).strokeRect(x + 4, y + 4, Math.max(0, w - 8), Math.max(0, hh - 8));
    }
  },

  // 検問弾：浮かんで止まっている間は輪が縮み、飛ぶときは尾を引く
  holdshot(g, h, world) {
    if (h.age < 0 && h.phase === 'hold') {
      g.lineStyle(1.5, hex(h.color), 0.3).strokeCircle(h.x, h.y, h.r);
      return;
    }
    const body = hex(h.color);
    if (h.phase === 'hold') {
      const k = Math.min(1, h.age / h.hold);
      g.lineStyle(2, RED(), 0.4 + 0.5 * k).strokeCircle(h.x, h.y, h.r * (2.2 - 1.2 * k));
    }
    g.fillStyle(body, 0.3).fillCircle(h.x, h.y, h.r * 1.6);
    g.fillStyle(body, 0.95).fillCircle(h.x, h.y, h.r);
    g.fillStyle(WHITE, 0.8).fillCircle(h.x, h.y, h.r * 0.4);
    if (h.phase === 'fly') g.lineStyle(2, body, 0.5).lineBetween(h.x, h.y, h.x - Math.cos(h.ang) * h.r * 3.5, h.y - Math.sin(h.ang) * h.r * 3.5);
  },

  // 裂け目：細い赤い線 → 太く光る
  fissure(g, h, world) {
    const x2 = h.x + Math.cos(h.ang) * h.len;
    const y2 = h.y + Math.sin(h.ang) * h.len;
    if (h.phase === 'warn') {
      const k = 1 - h.warn / h.warnMax;
      g.lineStyle(h.width * 0.9, RED(), 0.05 + 0.15 * k).lineBetween(h.x, h.y, x2, y2);
      g.lineStyle(2, RED(), 0.4 + 0.5 * k).lineBetween(h.x, h.y, x2, y2);
      return;
    }
    const body = hex(h.color);
    g.lineStyle(h.width + 10, body, 0.25).lineBetween(h.x, h.y, x2, y2);
    g.lineStyle(h.width * 0.6, body, 0.95).lineBetween(h.x, h.y, x2, y2);
    g.lineStyle(3, WHITE, 0.9).lineBetween(h.x, h.y, x2, y2);
  },

  // 尾行爆弾：導火線が減るほど、点滅が速くなる
  tailbomb(g, h, world) {
    if (h.wait > 0) return;
    const left = Math.max(0, 1 - h.age / h.fuse);
    const blink = Math.sin(world.time * (8 + 24 * (1 - left))) > 0;
    g.lineStyle(1.5, RED(), 0.25).strokeCircle(h.x, h.y, h.blast);
    g.fillStyle(0x0a0814, 1).fillCircle(h.x, h.y, h.r);
    g.lineStyle(3, blink ? RED() : hex(h.color), 0.95).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(3, WHITE, 0.8);
    g.beginPath();
    g.arc(h.x, h.y, h.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left, false);
    g.strokePath();
  },
};

export const BOSS_TELEGRAPHS_MAP7 = {
  gateclose: ringTelegraph,
  holdshots: ringTelegraph,
  callguards: ringTelegraph,
  fissure: lineTelegraph(900),
  tailbomb: ringTelegraph,
  lockdown: ringTelegraph,
};
