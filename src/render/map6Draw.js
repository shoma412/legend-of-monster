// マップ6のボスの固有の攻撃の絵（動きは src/game/map6Bosses.js）。
import { COLORS, hex } from '../data/theme.js';
import { lineTelegraph, ringTelegraph } from './map1Draw.js';

const WHITE = 0xffffff;
const RED = () => hex(COLORS.red);

export const HAZARD_DRAWS_MAP6 = {
  // 風の刃：すき間のある、走る刃
  windblade(g, h, world) {
    const body = hex(h.color);
    const x = h.x + h.dx * h.s;
    const y = h.y + h.dy * h.s;
    const segs = h.wait > 0 ? [] : [[-h.half, h.gap - h.gapHalf], [h.gap + h.gapHalf, h.half]];
    for (const [from, to] of segs) {
      if (to <= from) continue;
      const ax = x + h.px * from;
      const ay = y + h.py * from;
      const bx = x + h.px * to;
      const by = y + h.py * to;
      g.lineStyle(h.width + 8, body, 0.2).lineBetween(ax, ay, bx, by);
      g.lineStyle(h.width * 0.6, body, 0.9).lineBetween(ax, ay, bx, by);
      g.lineStyle(2, WHITE, 0.8).lineBetween(ax, ay, bx, by);
    }
    // 出る前：すき間の位置を、開始の壁ぎわに示す
    if (h.wait > 0) {
      const gx = h.x + h.dx * 30 + h.px * h.gap;
      const gy = h.y + h.dy * 30 + h.py * h.gap;
      g.lineStyle(3, hex(COLORS.cyan), 0.6).strokeCircle(gx, gy, h.gapHalf * 0.6);
    }
  },

  // 吸気の輪：縮む輪
  closering(g, h, world) {
    if (h.wait > 0) return;
    const body = hex(h.color);
    g.lineStyle(h.width + 10, body, 0.18).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(h.width * 0.6, body, 0.9).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(2, WHITE, 0.8).strokeCircle(h.x, h.y, h.r);
  },

  // 管の振動：通気口から広がる輪
  ventring(g, h, world) {
    if (h.wait > 0) return;
    const body = hex(h.color);
    g.lineStyle(h.width + 8, body, 0.2).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(h.width * 0.6, body, 0.9).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(2, WHITE, 0.8).strokeCircle(h.x, h.y, h.r);
  },
};

export const BOSS_TELEGRAPHS_MAP6 = {
  bladevolley: ringTelegraph,
  suctionring: ringTelegraph,
  downdraft: ringTelegraph,
  spinevolley: ringTelegraph,
  ductquake: ringTelegraph,
  compass: (g, b, act, world) => {
    if (act.phase !== 'telegraph') return;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineStyle(i % 2 === 0 ? 2.5 : 1.5, RED(), i % 2 === 0 ? 0.5 : 0.25).lineBetween(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, b.x + Math.cos(a) * 420, b.y + Math.sin(a) * 420);
    }
    ringTelegraph(g, b, act, world);
  },
  // 突風：盾の正面に、押される範囲の扇
  gust: (g, b, act, world) => {
    const def = act.def;
    const a = act.angle ?? b.facing ?? b.angle;
    const half = (def.arc * Math.PI) / 360;
    if (act.phase === 'telegraph' || act.phase === 'active') {
      const k = act.phase === 'active' ? 0.3 : 0.1 + 0.15 * Math.abs(Math.sin(world.time * 14));
      g.fillStyle(hex(COLORS.cyan), k);
      g.slice(b.x, b.y, def.range, a - half, a + half, false).fillPath();
      g.lineStyle(2, hex(COLORS.cyan), 0.6);
      g.lineBetween(b.x, b.y, b.x + Math.cos(a - half) * def.range, b.y + Math.sin(a - half) * def.range);
      g.lineBetween(b.x, b.y, b.x + Math.cos(a + half) * def.range, b.y + Math.sin(a + half) * def.range);
    }
  },
  windseed: ringTelegraph,
  windturn: ringTelegraph,
  // 向かい風突進：走る道（反対側の壁から、風上の壁まで）
  windrush: (g, b, act, world) => {
    if (act.phase !== 'telegraph' || !act.lane) return;
    const bd = world.bounds;
    const horizontal = act.dirX !== 0;
    const locked = act.t <= act.def.lockTime;
    const x1 = act.lane.x;
    const y1 = act.lane.y;
    const x2 = horizontal ? (act.dirX > 0 ? bd.right : bd.left) : x1;
    const y2 = horizontal ? y1 : act.dirY > 0 ? bd.bottom : bd.top;
    g.lineStyle(b.r * 1.5, RED(), locked ? 0.25 : 0.08).lineBetween(x1, y1, x2, y2);
    g.lineStyle(3, RED(), locked ? 0.9 : 0.5).lineBetween(x1, y1, x2, y2);
  },
  stormfury: ringTelegraph,
  ductbite: (g, b, act, world) => {
    if (act.phase !== 'telegraph') return;
    const locked = act.t <= act.def.lockTime;
    g.lineStyle(b.r * 1.4, RED(), locked ? 0.18 : 0.06).lineBetween(b.x, b.y, b.x + act.dirX * 900, b.y + act.dirY * 900);
    lineTelegraph(900)(g, b, act, world);
  },
};
