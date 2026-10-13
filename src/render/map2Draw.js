// マップ2のボス3体の固有の攻撃の絵（動きは src/game/map2Bosses.js）。
// HAZARD_DRAWS_MAP2 は、残る攻撃（hazard）の種類ごとの描き方。BOSS_TELEGRAPHS_MAP2 は、ボスが構えている間の絵。
import { COLORS, hex } from '../data/theme.js';
import { HAZARDS_MAP2 } from '../game/map2Bosses.js';
import { lineTelegraph, ringTelegraph } from './map1Draw.js';

const WHITE = 0xffffff;
const RED = () => hex(COLORS.red);

// 壁の側（'left' など）から数えた、波の向き：[原点の辺, 進む向きのベクトル]
function waveGeometry(bd, side) {
  if (side.id === 'left') return { x: bd.left, y: bd.top, w: 0, h: bd.bottom - bd.top, dx: 1, dy: 0 };
  if (side.id === 'right') return { x: bd.right, y: bd.top, w: 0, h: bd.bottom - bd.top, dx: -1, dy: 0 };
  if (side.id === 'top') return { x: bd.left, y: bd.top, w: bd.right - bd.left, h: 0, dx: 0, dy: 1 };
  return { x: bd.left, y: bd.bottom, w: bd.right - bd.left, h: 0, dx: 0, dy: -1 };
}

// 波（または水位）の帯を、壁から depth ぶん描く（壁側を基準にした矩形）
function bandRect(bd, id, from, to) {
  if (id === 'left') return [bd.left + from, bd.top, to - from, bd.bottom - bd.top];
  if (id === 'right') return [bd.right - to, bd.top, to - from, bd.bottom - bd.top];
  if (id === 'top') return [bd.left, bd.top + from, bd.right - bd.left, to - from];
  return [bd.left, bd.bottom - to, bd.right - bd.left, to - from];
}

export const HAZARD_DRAWS_MAP2 = {
  // とぐろ締め：体の輪（隙間つき）
  coil(g, h, world) {
    const body = hex(h.color);
    const arc = (r, from, to) => {
      g.beginPath();
      g.arc(h.cx, h.cy, r, from, to, false);
      g.strokePath();
    };
    const start = h.gapAngle + h.gap / 2;
    const end = h.gapAngle - h.gap / 2 + Math.PI * 2;
    if (h.phase === 'warn') {
      const k = 1 - h.warn / h.warnMax;
      g.lineStyle(3, RED(), 0.3 + 0.5 * k);
      arc(h.r, start, end);
      g.lineStyle(4, hex(COLORS.cyan), 0.9);
      arc(h.r, h.gapAngle - h.gap / 2, h.gapAngle + h.gap / 2);
      g.lineBetween(h.cx + Math.cos(h.gapAngle) * (h.r - 18), h.cy + Math.sin(h.gapAngle) * (h.r - 18), h.cx + Math.cos(h.gapAngle) * (h.r + 18), h.cy + Math.sin(h.gapAngle) * (h.r + 18));
      return;
    }
    g.lineStyle(h.width + 10, body, 0.2);
    arc(h.r, start, end);
    g.lineStyle(h.width, body, 0.95);
    arc(h.r, start, end);
    g.lineStyle(2, WHITE, 0.7);
    arc(h.r, start, end);
    g.lineStyle(2, hex(COLORS.cyan), 0.6);
    arc(h.r, h.gapAngle - h.gap / 2, h.gapAngle + h.gap / 2);
  },

  // 配管破裂：漏れている口、予告の線、水柱
  jet(g, h, world) {
    if (h.phase === 'wait' || h.t < h.wait) return;
    const body = hex(h.color);
    const water = hex(COLORS.cyan);
    if (h.phase === 'leak') {
      for (let i = 0; i < 3; i++) g.fillStyle(water, 0.8).fillCircle(h.x1 + Math.sin(world.time * 12 + i * 2) * 8, h.y1 + Math.cos(world.time * 9 + i) * 8, 3);
      g.lineStyle(2, RED(), 0.5 + 0.4 * Math.abs(Math.sin(world.time * 14))).strokeCircle(h.x1, h.y1, 14);
    } else if (h.phase === 'aim') {
      g.lineStyle(h.width, RED(), 0.12).lineBetween(h.x1, h.y1, h.x2, h.y2);
      g.lineStyle(1.5, RED(), 0.8).lineBetween(h.x1, h.y1, h.x2, h.y2);
      g.lineStyle(2, RED(), 0.9).strokeCircle(h.x1, h.y1, 14);
    } else if (h.phase === 'fire') {
      g.lineStyle(h.width + 14, water, 0.25).lineBetween(h.x1, h.y1, h.x2, h.y2);
      g.lineStyle(h.width, body, 0.9).lineBetween(h.x1, h.y1, h.x2, h.y2);
      g.lineStyle(h.width * 0.35, WHITE, 0.9).lineBetween(h.x1, h.y1, h.x2, h.y2);
    }
  },

  // 濁流：柱と、柱の後ろの安全な帯（lee）、水の壁
  mudtide(g, h, world) {
    const bd = world.bounds;
    const w = h.waves[h.i];
    const water = hex(COLORS.cyan);
    if (!w) return;
    const geo = waveGeometry(bd, w);
    // 柱の後ろ（水が避けて通る帯）
    for (const pl of h.pillars) {
      const half = pl.r + 8;
      if (w.axis === 'x') {
        const x0 = w.sign > 0 ? pl.x : bd.left;
        const x1 = w.sign > 0 ? bd.right : pl.x;
        g.fillStyle(water, 0.07).fillRect(x0, pl.y - half, x1 - x0, half * 2);
      } else {
        const y0 = w.sign > 0 ? pl.y : bd.top;
        const y1 = w.sign > 0 ? bd.bottom : pl.y;
        g.fillStyle(water, 0.07).fillRect(pl.x - half, y0, half * 2, y1 - y0);
      }
    }
    for (const pl of h.pillars) {
      g.fillStyle(0x0a0814, 1).fillCircle(pl.x, pl.y, pl.r);
      g.lineStyle(3, water, 0.95).strokeCircle(pl.x, pl.y, pl.r);
      g.lineStyle(2, water, 0.5).strokeCircle(pl.x, pl.y, pl.r * 0.55);
    }
    if (h.phase === 'warn') {
      const k = 1 - h.t / h.warn;
      const [x, y, rw, rh] = bandRect(bd, w.id, 0, h.thick);
      g.fillStyle(RED(), 0.05 + 0.14 * k).fillRect(x, y, rw, rh);
      g.lineStyle(2, RED(), 0.5 + 0.4 * k).strokeRect(x, y, rw, rh);
      // 進む向きの矢印
      for (let i = 0; i < 5; i++) {
        const cross = (w.axis === 'x' ? bd.top : bd.left) + ((i + 0.5) * (w.axis === 'x' ? bd.bottom - bd.top : bd.right - bd.left)) / 5;
        const base = 20 + h.thick + ((world.time * 120) % 40);
        const px = w.axis === 'x' ? geo.x + geo.dx * base : cross;
        const py = w.axis === 'x' ? cross : geo.y + geo.dy * base;
        const pts = w.axis === 'x'
          ? [{ x: px - geo.dx * 10, y: py - 10 }, { x: px, y: py }, { x: px - geo.dx * 10, y: py + 10 }]
          : [{ x: px - 10, y: py - geo.dy * 10 }, { x: px, y: py }, { x: px + 10, y: py - geo.dy * 10 }];
        g.lineStyle(2, RED(), 0.4 + 0.4 * k).strokePoints(pts, false, false);
      }
      return;
    }
    const front = Math.min(h.s, (w.axis === 'x' ? bd.right - bd.left : bd.bottom - bd.top) + h.thick);
    const from = Math.max(0, front - h.thick);
    const to = Math.min(w.axis === 'x' ? bd.right - bd.left : bd.bottom - bd.top, front);
    if (to > from) {
      const [x, y, rw, rh] = bandRect(bd, w.id, from, to);
      g.fillStyle(water, 0.3).fillRect(x, y, rw, rh);
      g.lineStyle(3, water, 0.9).strokeRect(x, y, rw, rh);
      // 波頭の白い線
      const edge = to;
      if (w.axis === 'x') {
        const ex = w.sign > 0 ? bd.left + edge : bd.right - edge;
        g.lineStyle(3, WHITE, 0.8).lineBetween(ex, bd.top, ex, bd.bottom);
      } else {
        const ey = w.sign > 0 ? bd.top + edge : bd.bottom - edge;
        g.lineStyle(3, WHITE, 0.8).lineBetween(bd.left, ey, bd.right, ey);
      }
    }
  },

  // はさみ打ち：左右の爪と、閉じる先の線
  claws(g, h, world) {
    const px = -h.uy;
    const py = h.ux;
    const body = hex(h.color);
    if (h.phase === 'warn') {
      const k = 1 - h.warn / h.warnMax;
      g.lineStyle(2, RED(), 0.3 + 0.5 * k).lineBetween(h.cx + px * h.dist0, h.cy + py * h.dist0, h.cx - px * h.dist0, h.cy - py * h.dist0);
      for (const sign of [-1, 1]) {
        const cx = h.cx + px * sign * h.dist0;
        const cy = h.cy + py * sign * h.dist0;
        const pts = [
          { x: cx + h.ux * h.len / 2 + px * h.thick / 2, y: cy + h.uy * h.len / 2 + py * h.thick / 2 },
          { x: cx + h.ux * h.len / 2 - px * h.thick / 2, y: cy + h.uy * h.len / 2 - py * h.thick / 2 },
          { x: cx - h.ux * h.len / 2 - px * h.thick / 2, y: cy - h.uy * h.len / 2 - py * h.thick / 2 },
          { x: cx - h.ux * h.len / 2 + px * h.thick / 2, y: cy - h.uy * h.len / 2 + py * h.thick / 2 },
        ];
        g.lineStyle(2, RED(), 0.3 + 0.4 * k).strokePoints(pts, true, true);
      }
      return;
    }
    for (const sign of [-1, 1]) {
      const cx = h.cx + px * sign * h.s;
      const cy = h.cy + py * sign * h.s;
      const pts = [
        { x: cx + h.ux * h.len / 2 + px * h.thick / 2, y: cy + h.uy * h.len / 2 + py * h.thick / 2 },
        { x: cx + h.ux * h.len / 2 - px * h.thick / 2, y: cy + h.uy * h.len / 2 - py * h.thick / 2 },
        { x: cx - h.ux * h.len / 2 - px * h.thick / 2, y: cy - h.uy * h.len / 2 - py * h.thick / 2 },
        { x: cx - h.ux * h.len / 2 + px * h.thick / 2, y: cy - h.uy * h.len / 2 + py * h.thick / 2 },
      ];
      g.fillStyle(0x0a0814, 0.95).fillPoints(pts, true);
      g.lineStyle(3.5, body, 1).strokePoints(pts, true, true);
      // はさみの先（内側へ向いた刃）
      const tip = { x: cx - px * sign * (h.thick / 2 + 14), y: cy - py * sign * (h.thick / 2 + 14) };
      g.lineStyle(3, body, 1).lineBetween(cx + h.ux * h.len / 2, cy + h.uy * h.len / 2, tip.x, tip.y).lineBetween(cx - h.ux * h.len / 2, cy - h.uy * h.len / 2, tip.x, tip.y);
    }
  },

  // 満潮：水位と、高台
  tide(g, h, world) {
    const bd = world.bounds;
    const pulse = h.pulses[h.i];
    const water = hex(COLORS.cyan);
    if (!pulse) return;
    const level = HAZARDS_MAP2.tide.level(h);
    if (h.phase === 'warn') {
      const k = Math.min(1, h.t / h.warn);
      const [x, y, rw, rh] = bandRect(bd, pulse.id, 0, pulse.depth);
      g.lineStyle(2, RED(), 0.3 + 0.5 * k).strokeRect(x, y, rw, rh);
      g.fillStyle(RED(), 0.04 + 0.05 * k).fillRect(x, y, rw, rh);
    } else if (level > 0) {
      const [x, y, rw, rh] = bandRect(bd, pulse.id, 0, level);
      g.fillStyle(water, 0.26).fillRect(x, y, rw, rh);
      g.lineStyle(3, water, 0.85).strokeRect(x, y, rw, rh);
      for (let i = 0; i < 6; i++) {
        const t = world.time * 2 + i * 1.7;
        g.lineStyle(1.5, WHITE, 0.35).lineBetween(x + ((t * 50) % rw), y + (i * rh) / 6, x + ((t * 50) % rw) + 14, y + (i * rh) / 6);
      }
    }
    for (const s of h.islands) {
      g.fillStyle(hex(COLORS.amber), 0.14).fillCircle(s.x, s.y, s.r);
      g.lineStyle(2.5, hex(COLORS.amber), 0.9).strokeCircle(s.x, s.y, s.r);
      g.lineStyle(2, hex(COLORS.amber), 0.5).strokeCircle(s.x, s.y, s.r * 0.6);
    }
  },

  // 首の掃射：首から伸びる線
  headbeams(g, h, world) {
    const body = hex(h.color);
    for (const beam of h.beams) {
      if (beam.head.dead) continue;
      if (h.warn > 0) {
        const a = beam.base - h.arc * 0.5 * beam.dir;
        const k = 1 - h.warn / h.warnMax;
        g.lineStyle(1.5, RED(), 0.3 + 0.5 * k).lineBetween(beam.head.x, beam.head.y, beam.head.x + Math.cos(a) * 1100, beam.head.y + Math.sin(a) * 1100);
        continue;
      }
      const x2 = beam.head.x + Math.cos(beam.angle) * 1100;
      const y2 = beam.head.y + Math.sin(beam.angle) * 1100;
      g.lineStyle(h.width + 10, body, 0.2).lineBetween(beam.head.x, beam.head.y, x2, y2);
      g.lineStyle(h.width, body, 0.95).lineBetween(beam.head.x, beam.head.y, x2, y2);
      g.lineStyle(2, WHITE, 0.8).lineBetween(beam.head.x, beam.head.y, x2, y2);
    }
  },

  // 泥沼：渦を巻く円
  bog(g, h, world) {
    const body = hex(h.color);
    if (h.arm > 0) {
      const k = 1 - h.arm / h.armMax;
      g.fillStyle(RED(), 0.05 + 0.1 * k).fillCircle(h.x, h.y, h.r);
      g.lineStyle(2, RED(), 0.8).strokeCircle(h.x, h.y, h.r);
      g.lineStyle(2, body, 0.9).strokeCircle(h.x, h.y, h.r * k);
      return;
    }
    const fade = Math.min(1, h.life / 0.8);
    g.fillStyle(body, 0.16 * fade).fillCircle(h.x, h.y, h.r);
    g.lineStyle(2, body, 0.8 * fade).strokeCircle(h.x, h.y, h.r);
    for (let ring = 1; ring <= 3; ring++) {
      const r = (h.r * ring) / 3.4;
      g.lineStyle(1.5, body, 0.5 * fade);
      g.beginPath();
      g.arc(h.x, h.y, r, world.time * (3 - ring) + ring, world.time * (3 - ring) + ring + 4, false);
      g.strokePath();
    }
    g.fillStyle(0x000000, 0.6 * fade).fillCircle(h.x, h.y, h.core);
    g.lineStyle(2, body, 0.9 * fade).strokeCircle(h.x, h.y, h.core);
  },
};

export const BOSS_TELEGRAPHS_MAP2 = {
  coilcrush: ringTelegraph,
  pipeburst: ringTelegraph,
  sludgeglob: ringTelegraph,
  grapple: (g, b, act, world) => {
    const p = world.player;
    if (act.phase === 'hold' && p.held) {
      // 巻きつかれている間：プレイヤーのまわりに、体の輪
      const body = hex(b.color);
      g.lineStyle(5, body, 0.9).strokeCircle(p.x, p.y, p.r + 6);
      g.lineStyle(2, WHITE, 0.6).strokeCircle(p.x, p.y, p.r + 6);
      g.lineStyle(3, body, 0.7).lineBetween(b.x, b.y, p.x, p.y);
      return;
    }
    lineTelegraph(act.def.speed * act.def.duration)(g, b, act, world);
  },
  mudflow: ringTelegraph,
  pincerclose: ringTelegraph,
  bubbleswarm: ringTelegraph,
  sidestep: ringTelegraph,
  jetcross: ringTelegraph,
  rollshell: (g, b, act, world) => lineTelegraph(900)(g, b, act, world),
  hightide: ringTelegraph,
  sludgefount: ringTelegraph,
  headsweep: ringTelegraph,
  bogs: ringTelegraph,
  // 首の絡み：絡みつく首から、プレイヤーへの線
  entangle: (g, b, act, world) => {
    const head = act.head;
    if (!head || head.dead) return;
    const p = world.player;
    if (act.phase === 'telegraph') {
      g.lineStyle(2, RED(), 0.4 + 0.4 * Math.abs(Math.sin(world.time * 16))).lineBetween(head.x, head.y, p.x, p.y);
    } else if (act.phase === 'active') {
      const body = hex(b.color);
      const th = p.tether;
      const k = th ? 1 - Math.max(0, th.t) / act.def.hold : 1;
      g.lineStyle(6, body, 0.8).lineBetween(head.x, head.y, p.x, p.y);
      g.lineStyle(2, WHITE, 0.6).lineBetween(head.x, head.y, p.x, p.y);
      g.lineStyle(3, RED(), 0.5 + 0.5 * k);
      g.beginPath();
      g.arc(p.x, p.y, p.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false);
      g.strokePath();
    }
  },
  regrowth: (g, b, act, world) => {
    if (act.phase === 'telegraph') return ringTelegraph(g, b, act, world);
    if (act.phase !== 'active') return;
    // 根元ごとの、再生までの輪
    for (const r of act.roots ?? []) {
      if (r.done) continue;
      const k = Math.min(1, act.clock / r.due);
      g.lineStyle(3, hex(b.color), 0.9);
      g.beginPath();
      g.arc(r.enemy.x, r.enemy.y, r.enemy.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false);
      g.strokePath();
    }
  },
};
