// マップ3のボス（スクラップハウンド・ガーダースパイダー・クレーンタイタン・アーキテクト）の固有の攻撃の絵（動きは src/game/map3Bosses.js）。
import { COLORS, hex } from '../data/theme.js';
import { lineTelegraph, ringTelegraph } from './map1Draw.js';

const WHITE = 0xffffff;
const RED = () => hex(COLORS.red);

function rectPoints(cx, cy, angle, length, width) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const px = -uy;
  const py = ux;
  return [
    { x: cx + ux * length / 2 + px * width / 2, y: cy + uy * length / 2 + py * width / 2 },
    { x: cx + ux * length / 2 - px * width / 2, y: cy + uy * length / 2 - py * width / 2 },
    { x: cx - ux * length / 2 - px * width / 2, y: cy - uy * length / 2 - py * width / 2 },
    { x: cx - ux * length / 2 + px * width / 2, y: cy - uy * length / 2 + py * width / 2 },
  ];
}

export const HAZARD_DRAWS_MAP3 = {
  // 跳ね鉄くず：ぎざぎざの歯車
  junk(g, h, world) {
    const col = hex(h.color);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = world.time * 8 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? h.r : h.r * 0.62;
      pts.push({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r });
    }
    g.fillStyle(0x0a0814, 1).fillPoints(pts, true);
    g.lineStyle(2.5, col, 1).strokePoints(pts, true, true);
    g.lineStyle(7, col, 0.15).lineBetween(h.x, h.y, h.x - h.vx * 0.06, h.y - h.vy * 0.06);
  },

  // 鉄くず嵐：列の始まる場所（予告）と、鉄くずの列
  junkstorm(g, h, world) {
    const bd = world.bounds;
    const w = h.waves[h.i];
    const col = hex(h.color);
    if (!w) return;
    const horizontal = w.axis === 'x';
    const edge = w.sign > 0 ? (horizontal ? bd.left : bd.top) : horizontal ? bd.right : bd.bottom;
    const place = (v, along) => (horizontal ? { x: along, y: v } : { x: v, y: along });
    if (h.phase === 'warn') {
      const k = 1 - h.t / h.warn;
      for (const v of w.pieces) {
        const q = place(v, edge);
        g.lineStyle(2, RED(), 0.3 + 0.5 * k).strokeCircle(q.x, q.y, h.pieceRadius);
      }
      for (const gp of w.gaps) {
        const a = place(gp, edge);
        const c = place(gp + 100, edge);
        g.lineStyle(4, hex(COLORS.cyan), 0.8).lineBetween(a.x, a.y, c.x, c.y);
      }
      return;
    }
    const along = w.sign > 0 ? (horizontal ? bd.left : bd.top) + h.s : (horizontal ? bd.right : bd.bottom) - h.s;
    for (const v of w.pieces) {
      const q = place(v, along);
      g.fillStyle(0x0a0814, 1).fillCircle(q.x, q.y, h.pieceRadius);
      g.lineStyle(2.5, col, 1).strokeCircle(q.x, q.y, h.pieceRadius);
      g.lineStyle(1.5, col, 0.6).lineBetween(q.x - h.pieceRadius, q.y, q.x + h.pieceRadius, q.y);
    }
    // ボスのほうへ引かれる、細い線
    const p = world.player;
    if (h.owner) g.lineStyle(1, col, 0.2).lineBetween(p.x, p.y, h.owner.x, h.owner.y);
  },

  // 毒針
  needle(g, h, world) {
    const col = hex(h.color);
    const a = Math.atan2(h.vy, h.vx);
    g.lineStyle(3, col, 1).lineBetween(h.x - Math.cos(a) * 16, h.y - Math.sin(a) * 16, h.x + Math.cos(a) * 6, h.y + Math.sin(a) * 6);
    g.fillStyle(WHITE, 0.9).fillCircle(h.x + Math.cos(a) * 6, h.y + Math.sin(a) * 6, 2.5);
  },

  // 八本脚
  legs(g, h, world) {
    const col = hex(h.color);
    if (h.phase === 'warn') {
      const k = 1 - h.warn / h.warnMax;
      for (const leg of h.legs) g.lineStyle(1.5, RED(), 0.3 + 0.5 * k).lineBetween(h.cx, h.cy, h.cx + Math.cos(leg.angle) * h.length, h.cy + Math.sin(leg.angle) * h.length);
      g.lineStyle(2, RED(), 0.8).strokeCircle(h.cx, h.cy, 8);
      return;
    }
    h.legs.forEach((leg, i) => {
      const start = i * h.gap;
      const x2 = h.cx + Math.cos(leg.angle) * h.length;
      const y2 = h.cy + Math.sin(leg.angle) * h.length;
      if (h.t >= start && h.t < start + h.flash) {
        g.lineStyle(h.width + 10, col, 0.25).lineBetween(h.cx, h.cy, x2, y2);
        g.lineStyle(h.width, col, 0.95).lineBetween(h.cx, h.cy, x2, y2);
        g.lineStyle(3, WHITE, 0.9).lineBetween(h.cx, h.cy, x2, y2);
      } else if (h.t < start) {
        g.lineStyle(1.5, RED(), 0.5 + 0.4 * Math.abs(Math.sin(world.time * 14))).lineBetween(h.cx, h.cy, x2, y2);
      }
    });
  },

  // 鉄骨落とし
  beam(g, h, world) {
    if (h.t < h.wait) return;
    const col = hex(h.color);
    if (h.phase === 'fall') {
      const pts = rectPoints(h.x, h.y, h.angle, h.length, h.width);
      g.fillStyle(col, 0.85).fillPoints(pts, true);
      g.lineStyle(3, WHITE, 0.9).strokePoints(pts, true, true);
      return;
    }
    const k = Math.min(1, (h.t - h.wait) / h.warn);
    const pts = rectPoints(h.x, h.y, h.angle, h.length, h.width);
    g.fillStyle(RED(), 0.06 + 0.16 * k).fillPoints(pts, true);
    g.lineStyle(2, RED(), 0.5 + 0.4 * k).strokePoints(pts, true, true);
    // 落ちてくる鉄骨（だんだん近づく影）
    const lift = (1 - k) * 60;
    const up = rectPoints(h.x, h.y - lift, h.angle, h.length, h.width);
    g.lineStyle(2, col, 0.35 * k).strokePoints(up, true, true);
  },

  // クレーンの腕
  cranearm(g, h, world) {
    const b = h.owner;
    if (!b || b.dead) return;
    const col = hex(h.color);
    const x1 = b.x + Math.cos(h.angle) * h.inner;
    const y1 = b.y + Math.sin(h.angle) * h.inner;
    const x2 = b.x + Math.cos(h.angle) * h.length;
    const y2 = b.y + Math.sin(h.angle) * h.length;
    g.lineStyle(1.5, hex(COLORS.cyan), 0.4).strokeCircle(b.x, b.y, h.inner);
    if (h.warn > 0) {
      const k = 1 - h.warn / h.warnMax;
      g.lineStyle(2, RED(), 0.3 + 0.5 * k).lineBetween(x1, y1, x2, y2);
      g.lineStyle(2, RED(), 0.5).strokeCircle(x2, y2, h.ball);
      return;
    }
    g.lineStyle(h.width + 10, col, 0.2).lineBetween(x1, y1, x2, y2);
    g.lineStyle(h.width, col, 0.95).lineBetween(x1, y1, x2, y2);
    g.lineStyle(3, WHITE, 0.7).lineBetween(x1, y1, x2, y2);
    g.fillStyle(0x0a0814, 1).fillCircle(x2, y2, h.ball);
    g.lineStyle(4, col, 1).strokeCircle(x2, y2, h.ball);
    g.lineStyle(2, WHITE, 0.8).strokeCircle(x2, y2, h.ball * 0.45);
  },

  // 鋲
  rivet(g, h, world) {
    const col = hex(h.color);
    if (h.phase === 'fly') {
      const a = Math.atan2(h.vy, h.vx);
      g.lineStyle(4, col, 1).lineBetween(h.x - Math.cos(a) * 14, h.y - Math.sin(a) * 14, h.x, h.y);
      g.fillStyle(WHITE, 0.9).fillCircle(h.x, h.y, 3);
      return;
    }
    const k = 1 - Math.max(0, h.fuse) / h.fuseT;
    g.fillStyle(RED(), 0.04 + 0.12 * k).fillCircle(h.x, h.y, h.radius);
    g.lineStyle(2, RED(), 0.5 + 0.4 * k).strokeCircle(h.x, h.y, h.radius);
    g.fillStyle(0x0a0814, 1).fillCircle(h.x, h.y, 7);
    g.lineStyle(3, col, 1).strokeCircle(h.x, h.y, 7);
    // 十字の火花が出る向き
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2;
      g.lineStyle(1.5, RED(), 0.4 + 0.4 * k).lineBetween(h.x + Math.cos(a) * 9, h.y + Math.sin(a) * 9, h.x + Math.cos(a) * 26, h.y + Math.sin(a) * 26);
    }
  },

  // 設計図
  plan(g, h, world) {
    const col = hex(h.color);
    const k = 1 - Math.max(0, h.t) / h.warn;
    for (const r of h.rects) {
      const x = r.x - r.w / 2;
      const y = r.y - r.h / 2;
      g.fillStyle(hex(COLORS.cyan), 0.05 + 0.1 * k).fillRect(x, y, r.w, r.h);
      g.lineStyle(2, hex(COLORS.cyan), 0.5 + 0.4 * k).strokeRect(x, y, r.w, r.h);
      // 設計図の斜線と、寸法の線
      for (let q = 0; q < r.w + r.h; q += 22) {
        const x1 = x + Math.min(q, r.w);
        const y1 = y + Math.max(0, q - r.w);
        const x2 = x + Math.max(0, q - r.h);
        const y2 = y + Math.min(q, r.h);
        g.lineStyle(1, hex(COLORS.cyan), 0.25).lineBetween(x1, y1, x2, y2);
      }
      g.lineStyle(2, col, 0.7).lineBetween(x, y - 8, x + r.w, y - 8);
      g.lineStyle(2, RED(), 0.4 + 0.5 * k).strokeRect(x - 3, y - 3, r.w + 6, r.h + 6);
    }
  },

  // 測量：通る道（予告）と、測量の点
  surveyor(g, h, world) {
    if (h.warn > 0) {
      const k = 1 - h.warn / h.warnMax;
      const pts = h.route.map((q) => ({ x: q.x, y: q.y }));
      g.lineStyle(2, RED(), 0.2 + 0.4 * k).strokePoints(pts, false, false);
      for (const q of h.route) g.lineStyle(1.5, RED(), 0.5).strokeCircle(q.x, q.y, 5);
      return;
    }
    g.fillStyle(WHITE, 0.95).fillCircle(h.x, h.y, 6);
    g.lineStyle(2, hex(h.color), 1).strokeCircle(h.x, h.y, 11);
    g.lineStyle(1.5, hex(h.color), 0.5).lineBetween(h.x - 18, h.y, h.x + 18, h.y).lineBetween(h.x, h.y - 18, h.x, h.y + 18);
  },
};

export const BOSS_TELEGRAPHS_MAP3 = {
  junkbounce: lineTelegraph(420),
  triplebite: (g, b, act, world) => lineTelegraph(act.def.speed * act.def.duration)(g, b, act, world),
  junkpile: ringTelegraph,
  junkstorm: ringTelegraph,
  needles: lineTelegraph(520),
  eightlegs: ringTelegraph,
  eggs: ringTelegraph,
  webweave: ringTelegraph,
  beamdrop: ringTelegraph,
  cranespin: ringTelegraph,
  rivetgun: lineTelegraph(420),
  collapse: ringTelegraph,
  plans: ringTelegraph,
  surveyrun: ringTelegraph,
  prototype: ringTelegraph,
};
