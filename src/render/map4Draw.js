// マップ4のボスの固有の攻撃の絵（動きは src/game/map4Bosses.js）。
import { COLORS, hex } from '../data/theme.js';
import { ringTelegraph } from './map1Draw.js';

const WHITE = 0xffffff;
const RED = () => hex(COLORS.red);

export const HAZARD_DRAWS_MAP4 = {
  // 扇形の刃：予告の扇と、閉じる2本の刃
  wedge(g, h, world) {
    if (h.phase === 'wait') return;
    const body = hex(h.color);
    const half = h.arc / 2;
    const slice = (r, from, to) => g.slice(h.x, h.y, r, from, to, false);
    if (h.phase === 'warn') {
      const k = 1 - h.warn / h.warnMax;
      g.fillStyle(RED(), 0.08 + 0.18 * k);
      slice(h.radius, h.angle - half, h.angle + half).fillPath();
      g.lineStyle(2, RED(), 0.5 + 0.4 * k);
      // 閉じていく刃（扇の両端から、真ん中へ）
      const close = half * (1 - k);
      for (const side of [-1, 1]) {
        const a = h.angle + side * close;
        g.lineStyle(3, body, 0.9).lineBetween(h.x, h.y, h.x + Math.cos(a) * h.radius, h.y + Math.sin(a) * h.radius);
      }
      return;
    }
    g.fillStyle(body, 0.45 * (1 - h.t / 0.25));
    slice(h.radius, h.angle - half, h.angle + half).fillPath();
    g.lineStyle(4, WHITE, 0.9).lineBetween(h.x, h.y, h.x + Math.cos(h.angle) * h.radius, h.y + Math.sin(h.angle) * h.radius);
  },

  // 探照の掃き：2つの光と、重なる点
  crossbeams(g, h, world) {
    const body = hex(h.color);
    const warm = h.t < h.warm;
    for (const [from, dir] of [[h.A, h.dirA], [h.B, h.dirB]]) {
      g.lineStyle(warm ? 1.5 : 5, body, warm ? 0.4 : 0.25).lineBetween(from.x, from.y, from.x + dir.x * 1300, from.y + dir.y * 1300);
      g.lineStyle(1.5, WHITE, warm ? 0.3 : 0.6).lineBetween(from.x, from.y, from.x + dir.x * 1300, from.y + dir.y * 1300);
      g.fillStyle(0x0a0814, 1).fillCircle(from.x, from.y, 9);
      g.lineStyle(3, body, 1).strokeCircle(from.x, from.y, 9);
    }
    if (h.I) {
      const k = Math.min(1, h.acc / h.interval);
      g.lineStyle(2, RED(), 0.4 + 0.5 * k).strokeCircle(h.I.x, h.I.y, h.strike.radius * (1.1 - 0.4 * k));
      g.fillStyle(WHITE, 0.8).fillCircle(h.I.x, h.I.y, 4);
    }
  },

  // 閃光の輪
  flashring(g, h, world) {
    if (h.wait > 0) return;
    const body = hex(h.color);
    g.lineStyle(h.width + 10, body, 0.18).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(h.width * 0.6, body, 0.9).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(3, WHITE, 0.9).strokeCircle(h.x, h.y, h.r);
  },
};

export const BOSS_TELEGRAPHS_MAP4 = {
  // 灯り目がけ：いま狙っている目標（灯り）への線
  lamptarget: (g, b, act, world) => {
    if (act.phase === 'telegraph' && act.target) {
      g.lineStyle(3, RED(), 0.4 + 0.3 * Math.abs(Math.sin(world.time * 16))).lineBetween(b.x, b.y, act.target.x, act.target.y);
      g.lineStyle(2, RED(), 0.8).strokeCircle(act.target.x, act.target.y, act.target.lamp ? 30 : 20);
    }
  },
  windflap: ringTelegraph,
  glowscales: ringTelegraph,
  sweeplights: ringTelegraph,
  flashring: ringTelegraph,
  // 短絡：光る交差点をつなぐ道
  shortout: (g, b, act, world) => {
    if (act.phase === 'telegraph') return ringTelegraph(g, b, act, world);
    if (!act.route) return;
    g.lineStyle(1.5, hex(b.color), 0.35).strokePoints(act.route.map((q) => ({ x: q.x, y: q.y })), false, false);
  },
  cutterarm: ringTelegraph,
  // 過負荷突進：入口から出口までの線
  railrush: (g, b, act, world) => {
    if (act.phase !== 'hide' || act.x1 == null) return;
    const locked = act.t <= act.def.lockTime;
    g.lineStyle(b.r * 1.4, RED(), locked ? 0.3 : 0.1).lineBetween(act.x1, act.y1, act.x2, act.y2);
    g.lineStyle(2, RED(), locked ? 0.9 : 0.5).lineBetween(act.x1, act.y1, act.x2, act.y2);
    g.lineStyle(3, hex(b.color), 0.9).strokeCircle(act.x1, act.y1, b.r * 0.8);
  },
  leadblade: ringTelegraph,
  shadowring: ringTelegraph,
  afterwing: (g, b, act, world) => {
    if (act.phase === 'telegraph') {
      ringTelegraph(g, b, act, world);
      // これまでの道（影が、ここから出る）
      for (const s of act.samples ?? []) g.lineStyle(1.5, hex(b.color), 0.35).strokeCircle(s.x, s.y, 10);
    }
  },
};
