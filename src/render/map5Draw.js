// マップ5のボスの固有の攻撃の絵（動きは src/game/map5Bosses.js）。
import { COLORS, hex } from '../data/theme.js';
import { lineTelegraph, ringTelegraph } from './map1Draw.js';

const WHITE = 0xffffff;
const RED = () => hex(COLORS.red);

export const HAZARD_DRAWS_MAP5 = {
  // 錆の波：広がる錆の帯
  rustband(g, h, world) {
    const body = hex(h.color);
    g.lineStyle(h.width + 10, body, 0.18).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(h.width * 0.7, body, 0.85).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(2, WHITE, 0.6).strokeCircle(h.x, h.y, h.r);
  },

  // 中和の渦：2つの渦と、そのあいだの線
  vortex(g, h, world) {
    const body = hex(h.color);
    if (h.arm > 0) {
      g.lineStyle(2, RED(), 0.5).strokeCircle(h.x, h.y, h.r * (1 + 0.4 * (h.arm / h.armMax)));
      return;
    }
    const t = world.time * 5;
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3;
      g.lineStyle(3, body, 0.7).lineBetween(h.x + Math.cos(a) * h.r * 1.3, h.y + Math.sin(a) * h.r * 1.3, h.x + Math.cos(a + 0.9) * h.r * 0.5, h.y + Math.sin(a + 0.9) * h.r * 0.5);
    }
    g.lineStyle(2, body, 0.5).strokeCircle(h.x, h.y, h.r * 1.4);
    g.fillStyle(body, 0.6).fillCircle(h.x, h.y, h.core);
    if (h.mate && !h.mate.dead && h.lead) g.lineStyle(1.5, WHITE, 0.25).lineBetween(h.x, h.y, h.mate.x, h.mate.y);
  },

  // 雷の網：予告の細い線 → 太い電撃
  netline(g, h, world) {
    const warn = h.phase === 'warn';
    const k = warn ? 1 - h.warn / h.warnMax : 1;
    for (const s of h.segs) {
      if (warn) g.lineStyle(2, RED(), 0.25 + 0.5 * k).lineBetween(s[0].x, s[0].y, s[1].x, s[1].y);
      else {
        g.lineStyle(h.width + 8, hex(h.color), 0.3).lineBetween(s[0].x, s[0].y, s[1].x, s[1].y);
        g.lineStyle(h.width * 0.5, WHITE, 0.95).lineBetween(s[0].x, s[0].y, s[1].x, s[1].y);
      }
    }
    for (const q of h.points) g.fillStyle(hex(h.color), 0.9).fillCircle(q.x, q.y, 8);
  },

  // 降雨の波：雨の帯
  rainfront(g, h, world) {
    const bd = world.bounds;
    const w = h.waves[h.i];
    if (!w) return;
    const horizontal = w.axis === 'x';
    const len = horizontal ? bd.bottom - bd.top : bd.right - bd.left;
    const rect = (from, to) => {
      const a = Math.max(0, Math.min(from, to));
      const d = Math.abs(to - from);
      if (horizontal) return w.sign > 0 ? [bd.left + a, bd.top, d, len] : [bd.right - a - d, bd.top, d, len];
      return w.sign > 0 ? [bd.left, bd.top + a, len, d] : [bd.left, bd.bottom - a - d, len, d];
    };
    if (h.phase === 'warn') {
      const k = 1 - h.t / h.warn;
      // 始まる壁ぎわに、赤い印
      const r = rect(0, 18);
      g.fillStyle(RED(), 0.2 + 0.4 * k).fillRect(r[0], r[1], r[2], r[3]);
      return;
    }
    const from = Math.max(0, h.s - h.thick);
    const r = rect(from, h.s);
    g.fillStyle(hex(h.color), 0.3).fillRect(r[0], r[1], r[2], r[3]);
    g.lineStyle(2, WHITE, 0.5).strokeRect(r[0], r[1], r[2], r[3]);
  },

  // 写し身の波：属性の色の輪
  elemring(g, h, world) {
    if (h.wait > 0) return;
    const body = hex(h.color);
    g.lineStyle(h.width + 10, body, 0.18).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(h.width * 0.6, body, 0.9).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(2, WHITE, 0.8).strokeCircle(h.x, h.y, h.r);
  },

  // 属性追尾：光の玉
  homer(g, h, world) {
    if (h.wait > 0) return;
    const body = hex(h.color);
    g.fillStyle(body, 0.25).fillCircle(h.x, h.y, h.r * 1.8);
    g.fillStyle(body, 0.95).fillCircle(h.x, h.y, h.r);
    g.fillStyle(WHITE, 0.8).fillCircle(h.x, h.y, h.r * 0.4);
  },
};

export const BOSS_TELEGRAPHS_MAP5 = {
  scrapfling: lineTelegraph(420),
  rustwave: ringTelegraph,
  jawsnap: ringTelegraph,
  flushring: ringTelegraph,
  colorjets: ringTelegraph,
  emberpools: ringTelegraph,
  acidpools: ringTelegraph,
  frostspiral: ringTelegraph,
  neutralvortex: ringTelegraph,
  // 槽の突進：通る道（壁ぎわの折れ線）
  tankrun: (g, b, act, world) => {
    if (act.phase !== 'telegraph' || !act.route) return;
    const pts = [{ x: b.x, y: b.y }, ...act.route];
    g.lineStyle(b.r * 1.3, RED(), 0.08).strokePoints(pts, false, false);
    g.lineStyle(2, RED(), 0.5 + 0.3 * Math.abs(Math.sin(world.time * 16))).strokePoints(pts, false, false);
  },
  thundernet: ringTelegraph,
  rainfront: ringTelegraph,
  lightningline: ringTelegraph,
  wavecopy: ringTelegraph,
  homers: ringTelegraph,
};
