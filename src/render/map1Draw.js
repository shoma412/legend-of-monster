// マップ1のボス3体の固有の攻撃の絵（動きは src/game/map1Bosses.js）。
// HAZARD_DRAWS は、残る攻撃（hazard）の種類ごとの描き方。draw.js の drawHazards から呼ばれる。
// BOSS_TELEGRAPHS_MAP1 は、ボスが構えている間（予告）の絵。draw.js の BOSS_TELEGRAPHS に足される。
import { SCREEN } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS, hex } from '../data/theme.js';
import { DEG } from '../logic/geometry.js';
import { BOARD_COLUMNS, BOARD_ROWS } from '../game/map1Bosses.js';

const WHITE = 0xffffff;
const RED = () => hex(COLORS.red);

// 7セグメントの数字（命令ブロックの番号）。size は数字1文字の高さ
const SEGMENTS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};
function digit(g, ch, cx, cy, size, color, alpha) {
  const w = size * 0.55;
  const h = size / 2;
  const x0 = cx - w / 2;
  const y0 = cy - h;
  const line = {
    a: [x0, y0, x0 + w, y0], b: [x0 + w, y0, x0 + w, cy], c: [x0 + w, cy, x0 + w, cy + h], d: [x0, cy + h, x0 + w, cy + h],
    e: [x0, cy, x0, cy + h], f: [x0, y0, x0, cy], g: [x0, cy, x0 + w, cy],
  };
  g.lineStyle(2.2, color, alpha);
  for (const s of SEGMENTS[ch] ?? '') g.lineBetween(...line[s]);
}
function number(g, n, cx, cy, size, color, alpha) {
  const text = String(n);
  const step = size * 0.8;
  [...text].forEach((ch, i) => digit(g, ch, cx + (i - (text.length - 1) / 2) * step, cy, size, color, alpha));
}

function pole(g, x, y, color, alpha = 1) {
  g.fillStyle(0x0a0814, 1).fillCircle(x, y, 7);
  g.lineStyle(2.5, color, alpha).strokeCircle(x, y, 7);
  g.fillStyle(color, alpha).fillCircle(x, y, 2.5);
}

export const HAZARD_DRAWS = {
  // 電線ひっぱり：両端の電柱と、そのあいだの、しなる電線
  wirepass(g, h, world) {
    const horizontal = h.axis === 'y';
    const a = h.length / 2;
    const col = hex(ELEMENT_COLORS.shock);
    const at = (pos) => (horizontal ? [h.cross - a, pos, h.cross + a, pos] : [pos, h.cross - a, pos, h.cross + a]);
    if (h.phase === 'warn') {
      const k = 1 - h.warn / h.warnMax;
      // 通る範囲（うすい帯）と、始まる場所の電線
      const lo = Math.min(h.from, h.to);
      const hi = Math.max(h.from, h.to);
      g.fillStyle(RED(), 0.04 + 0.06 * k);
      if (horizontal) g.fillRect(h.cross - a, lo, h.length, hi - lo);
      else g.fillRect(lo, h.cross - a, hi - lo, h.length);
      const s = at(h.pos);
      g.lineStyle(2, RED(), 0.4 + 0.5 * k).lineBetween(...s);
      pole(g, s[0], s[1], RED(), 0.9);
      pole(g, s[2], s[3], RED(), 0.9);
      return;
    }
    const s = at(h.pos);
    // しなり：真ん中が、進む向きと逆へ少したわむ
    const dir = Math.sign(h.to - h.from);
    const sag = 14 * Math.sin(world.time * 30) * 0.4 + 12;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const along = h.cross - a + h.length * u;
      const bend = -dir * Math.sin(u * Math.PI) * sag;
      pts.push(horizontal ? { x: along, y: h.pos + bend } : { x: h.pos + bend, y: along });
    }
    g.lineStyle(10, col, 0.22).strokePoints(pts, false, false);
    g.lineStyle(4, col, 0.95).strokePoints(pts, false, false);
    g.lineStyle(1.5, WHITE, 0.9).strokePoints(pts, false, false);
    pole(g, s[0], s[1], col);
    pole(g, s[2], s[3], col);
  },

  // 杭の放電：杭と、杭を結ぶ線（効き始める前は、点線の予告）
  fence(g, h, world) {
    const col = hex(ELEMENT_COLORS.shock);
    if (h.arm > 0) {
      const k = 1 - h.arm / h.armMax;
      for (const s of h.segs) {
        const len = Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y) || 1;
        for (let t = 0; t < len; t += 18) {
          const u0 = t / len;
          const u1 = Math.min(1, (t + 9) / len);
          g.lineStyle(2, RED(), 0.3 + 0.5 * k).lineBetween(s[0].x + (s[1].x - s[0].x) * u0, s[0].y + (s[1].y - s[0].y) * u0, s[0].x + (s[1].x - s[0].x) * u1, s[0].y + (s[1].y - s[0].y) * u1);
        }
      }
    } else {
      const fade = Math.min(1, h.life / 0.5);
      for (const s of h.segs) {
        const jitter = Math.sin(world.time * 40 + s[0].x) * 3;
        const mx = (s[0].x + s[1].x) / 2;
        const my = (s[0].y + s[1].y) / 2;
        const nx = -(s[1].y - s[0].y);
        const ny = s[1].x - s[0].x;
        const nl = Math.hypot(nx, ny) || 1;
        const mid = { x: mx + (nx / nl) * jitter, y: my + (ny / nl) * jitter };
        const pts = [s[0], mid, s[1]];
        g.lineStyle(h.width + 6, col, 0.2 * fade).strokePoints(pts, false, false);
        g.lineStyle(3, col, 0.95 * fade).strokePoints(pts, false, false);
        g.lineStyle(1, WHITE, 0.9 * fade).strokePoints(pts, false, false);
      }
    }
    for (const s of h.stakes) pole(g, s.x, s.y, h.arm > 0 ? RED() : col);
  },

  // 帯電：放射状の稲妻
  rays(g, h, world) {
    const b = h.owner;
    if (!b || b.dead) return;
    const col = hex(ELEMENT_COLORS.shock);
    const live = h.warn <= 0;
    const k = live ? 1 : 1 - h.warn / h.warnMax;
    const fade = live ? Math.min(1, h.live / 0.4) : 1;
    for (let i = 0; i < h.count; i++) {
      const a = h.angle + (i * Math.PI * 2) / h.count;
      const x2 = b.x + Math.cos(a) * 1400;
      const y2 = b.y + Math.sin(a) * 1400;
      if (live) {
        g.lineStyle(h.width + 8, col, 0.2 * fade).lineBetween(b.x, b.y, x2, y2);
        g.lineStyle(h.width * 0.6, col, 0.95 * fade).lineBetween(b.x, b.y, x2, y2);
        g.lineStyle(2, WHITE, 0.9 * fade).lineBetween(b.x, b.y, x2, y2);
      } else {
        g.lineStyle(2, RED(), 0.3 + 0.5 * k).lineBetween(b.x, b.y, x2, y2);
      }
    }
  },

  // 過電圧：壁ぎわの電線（内側へ狭まる）と、安全の円
  squeeze(g, h, world) {
    const bd = world.bounds;
    const col = hex(ELEMENT_COLORS.shock);
    const live = h.phase === 'live';
    const inset = h.steps[Math.min(h.i, h.steps.length - 1)];
    const x0 = bd.left + inset;
    const y0 = bd.top + inset;
    const x1 = bd.right - inset;
    const y1 = bd.bottom - inset;
    // 壁と電線のあいだ（4つの帯）
    const tint = live ? col : RED();
    const alpha = live ? 0.2 + 0.08 * Math.sin(world.time * 20) : 0.06 + 0.1 * (1 - h.t / h.warn);
    g.fillStyle(tint, alpha);
    g.fillRect(bd.left, bd.top, bd.right - bd.left, inset);
    g.fillRect(bd.left, y1, bd.right - bd.left, inset);
    g.fillRect(bd.left, y0, inset, y1 - y0);
    g.fillRect(x1, y0, inset, y1 - y0);
    g.lineStyle(live ? 4 : 2, tint, live ? 0.95 : 0.7).strokeRect(x0, y0, x1 - x0, y1 - y0);
    // 次の線（予告）
    if (h.i + 1 < h.steps.length) {
      const n = h.steps[h.i + 1];
      g.lineStyle(1.5, RED(), 0.35).strokeRect(bd.left + n, bd.top + n, bd.right - bd.left - n * 2, bd.bottom - bd.top - n * 2);
    }
    for (const s of h.safes) {
      g.fillStyle(hex(COLORS.cyan), 0.12).fillCircle(s.x, s.y, s.r);
      g.lineStyle(2.5, hex(COLORS.cyan), 0.9).strokeCircle(s.x, s.y, s.r);
      pole(g, s.x, s.y, hex(COLORS.cyan));
    }
  },

  // 氷の羽根
  feather(g, h, world) {
    const col = hex(ELEMENT_COLORS.cold);
    const c = Math.cos(h.ang);
    const s = Math.sin(h.ang);
    const pts = [
      { x: h.x + c * 16, y: h.y + s * 16 },
      { x: h.x - s * 6, y: h.y + c * 6 },
      { x: h.x - c * 14, y: h.y - s * 14 },
      { x: h.x + s * 6, y: h.y - c * 6 },
    ];
    g.lineStyle(7, col, 0.18).lineBetween(h.x - c * 30, h.y - s * 30, h.x, h.y);
    g.fillStyle(0x0a0814, 1).fillPoints(pts, true);
    g.lineStyle(2.5, col, 1).strokePoints(pts, true, true);
    g.lineStyle(1, WHITE, 0.9).lineBetween(h.x - c * 12, h.y - s * 12, h.x + c * 14, h.y + s * 14);
    if (h.phase === 'back') g.lineStyle(1.5, col, 0.25).lineBetween(h.x, h.y, h.owner.x, h.owner.y);
  },

  // 凍る床
  ice(g, h, world) {
    const col = hex(ELEMENT_COLORS.cold);
    const fade = Math.min(1, h.life / 0.8);
    g.fillStyle(col, 0.16 * fade).fillCircle(h.x, h.y, h.r);
    g.lineStyle(2, col, 0.7 * fade).strokeCircle(h.x, h.y, h.r);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + h.x;
      g.lineStyle(1, WHITE, 0.4 * fade).lineBetween(h.x + Math.cos(a) * h.r * 0.2, h.y + Math.sin(a) * h.r * 0.2, h.x + Math.cos(a) * h.r * 0.8, h.y + Math.sin(a) * h.r * 0.8);
    }
  },

  // 寒空の影
  shadow(g, h, world) {
    const col = hex(ELEMENT_COLORS.cold);
    g.fillStyle(0x000000, 0.45).fillEllipse(h.x, h.y, 90, 40);
    g.lineStyle(2, col, 0.8).strokeEllipse(h.x, h.y, 90, 40);
    if (h.phase === 'land') {
      const k = 1 - Math.max(0, h.t) / h.landT;
      g.fillStyle(RED(), 0.1 + 0.18 * k).fillCircle(h.x, h.y, h.r);
      g.lineStyle(2, RED(), 0.9).strokeCircle(h.x, h.y, h.r);
      g.lineStyle(2, col, 0.9).strokeCircle(h.x, h.y, h.r * k);
    }
  },

  // 絶対零度：焚き火の円と、凍えのゲージ
  coldfield(g, h, world) {
    const warm = hex(COLORS.amber);
    const cold = hex(ELEMENT_COLORS.cold);
    g.fillStyle(cold, 0.05 + 0.07 * h.chill).fillRect(0, 0, SCREEN.width, SCREEN.height);
    for (const f of h.fires) {
      g.fillStyle(warm, 0.14).fillCircle(f.x, f.y, h.r);
      g.lineStyle(2.5, warm, 0.9).strokeCircle(f.x, f.y, h.r);
      for (let i = 0; i < 3; i++) {
        const a = world.time * 4 + i * 2.09;
        g.fillStyle(warm, 0.9).fillCircle(f.x + Math.cos(a) * 10, f.y + Math.sin(a) * 6 - 4, 4 - i);
      }
    }
    // 次の場所（予告）
    if (h.next) for (const f of h.next) g.lineStyle(2, RED(), 0.3 + 0.4 * Math.abs(Math.sin(world.time * 10))).strokeCircle(f.x, f.y, h.r);
    // 凍えのゲージ（プレイヤーの頭の上）
    const p = world.player;
    const w = 46;
    g.fillStyle(0x0a0814, 0.85).fillRect(p.x - w / 2, p.y - p.r - 18, w, 6);
    g.fillStyle(h.chill > 0.75 ? RED() : cold, 1).fillRect(p.x - w / 2, p.y - p.r - 18, w * h.chill, 6);
    g.lineStyle(1, cold, 0.9).strokeRect(p.x - w / 2, p.y - p.r - 18, w, 6);
  },

  // 命令ブロック
  opblocks(g, h, world) {
    const col = hex(ELEMENT_COLORS.shock);
    if (h.dim > 0) g.fillStyle(0x000000, h.dim).fillRect(0, 0, SCREEN.width, SCREEN.height);
    const next = h.blocks.filter((b) => !b.done).sort((a, b) => a.n - b.n)[0];
    const showNumbers = h.hideAfter == null || h.clock < h.hideAfter;
    for (const blk of h.blocks) {
      if (blk.done) continue;
      const isNext = blk === next && h.clock >= h.warn - 0.05;
      const half = 18;
      g.fillStyle(0x0a0814, 0.95).fillRect(blk.x - half, blk.y - half, half * 2, half * 2);
      g.lineStyle(isNext ? 4 : 2, isNext ? WHITE : col, 0.95).strokeRect(blk.x - half, blk.y - half, half * 2, half * 2);
      if (showNumbers) number(g, blk.n, blk.x, blk.y, 18, isNext ? WHITE : col, 1);
      // 爆発の範囲（次のブロックだけ濃く）
      g.lineStyle(1.5, RED(), isNext ? 0.7 : 0.25).strokeCircle(blk.x, blk.y, h.radius);
    }
  },

  // 配線トレース：基板の線（予告のあいだ）と、光の点が通った線
  trace(g, h, world) {
    const col = hex(ELEMENT_COLORS.shock);
    if (h.warn > 0) {
      const k = 1 - h.warn / h.warnMax;
      const pts = h.route.map((q) => ({ x: q.x, y: q.y }));
      g.lineStyle(2, RED(), 0.2 + 0.4 * k).strokePoints(pts, false, false);
      for (const q of h.route) g.lineStyle(1.5, RED(), 0.5).strokeCircle(q.x, q.y, 5);
      return;
    }
    for (const s of h.segs) {
      if (s.f <= 0) continue;
      if (s.life != null && s.life <= 0) continue;
      const fade = s.life != null ? Math.min(1, s.life / 0.5) : 1;
      const x2 = s.x1 + (s.x2 - s.x1) * s.f;
      const y2 = s.y1 + (s.y2 - s.y1) * s.f;
      g.lineStyle(h.width + 6, col, 0.2 * fade).lineBetween(s.x1, s.y1, x2, y2);
      g.lineStyle(h.width * 0.5, col, 0.95 * fade).lineBetween(s.x1, s.y1, x2, y2);
      g.lineStyle(1.5, WHITE, 0.9 * fade).lineBetween(s.x1, s.y1, x2, y2);
    }
    // 先頭の光の点
    if (h.edge < h.route.length - 1) {
      const a = h.route[h.edge];
      const c = h.route[h.edge + 1];
      g.fillStyle(WHITE, 1).fillCircle(a.x + (c.x - a.x) * h.f, a.y + (c.y - a.y) * h.f, 5);
    }
  },
};

// ボスが構えている間の絵（draw.js の BOSS_TELEGRAPHS に足される）
const ringTelegraph = (g, b, act, world) => {
  if (act.phase !== 'telegraph') return;
  const k = 1 - act.t / act.def.telegraph;
  g.lineStyle(2, RED(), 0.4 + 0.4 * Math.abs(Math.sin(world.time * 18))).strokeCircle(b.x, b.y, b.r + 14 + k * 20);
};
const lineTelegraph = (length) => (g, b, act, world) => {
  if (act.phase !== 'telegraph') return;
  const locked = act.t <= (act.def.lockTime ?? 0);
  g.lineStyle(3, RED(), locked ? 0.7 : 0.25 + 0.2 * Math.abs(Math.sin(world.time * 16))).lineBetween(b.x, b.y, b.x + act.dirX * length, b.y + act.dirY * length);
  ringTelegraph(g, b, act, world);
};
const coneTelegraph = (g, b, act, world) => {
  const def = act.def;
  const angle = Math.atan2(act.dirY, act.dirX);
  const half = (def.arc * DEG) / 2;
  if (act.phase === 'telegraph') {
    const locked = act.t <= def.lockTime;
    g.fillStyle(RED(), locked ? 0.34 : 0.14 + 0.12 * Math.abs(Math.sin(world.time * 14)));
    g.slice(b.x, b.y, def.range, angle - half, angle + half, false).fillPath();
  } else if (act.phase === 'active') {
    g.fillStyle(hex(ELEMENT_COLORS.cold), 0.24).slice(b.x, b.y, def.range, angle - half, angle + half, false).fillPath();
  }
};

export const BOSS_TELEGRAPHS_MAP1 = {
  wirepull: ringTelegraph,
  insulators: ringTelegraph,
  stakefence: ringTelegraph,
  statics: ringTelegraph,
  tuskrip: lineTelegraph(520),
  overvolt: ringTelegraph,
  featherbolt: lineTelegraph(360),
  iciclewave: lineTelegraph(560),
  frostbreath: coneTelegraph,
  frostwings: ringTelegraph,
  skyshadow: ringTelegraph,
  absolutezero: ringTelegraph,
  opblocks: ringTelegraph,
  tracepath: ringTelegraph,
  satellites: ringTelegraph,
  shortcircuit: ringTelegraph,
  systemhalt: ringTelegraph,
  // 再起動：放電が来る範囲（部屋の端の安全な帯を除く）が、だんだん赤くなる
  reboot(g, b, act, world) {
    if (act.phase === 'telegraph') return ringTelegraph(g, b, act, world);
    if (act.phase !== 'active') return;
    const def = act.def;
    const bd = world.bounds;
    const k = 1 - Math.max(0, act.t) / def.charge;
    const s = def.safe;
    g.fillStyle(RED(), 0.04 + 0.2 * k).fillRect(bd.left + s, bd.top + s, bd.right - bd.left - s * 2, bd.bottom - bd.top - s * 2);
    g.lineStyle(2, RED(), 0.5 + 0.4 * k).strokeRect(bd.left + s, bd.top + s, bd.right - bd.left - s * 2, bd.bottom - bd.top - s * 2);
    g.lineStyle(3, hex(ELEMENT_COLORS.shock), 0.9);
    g.beginPath();
    g.arc(b.x, b.y, b.r + 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false);
    g.strokePath();
    // 端末をつなぐ線
    const terminals = act.terminals ?? [];
    for (const e of terminals) if (!e.dead) g.lineStyle(1.5, hex(ELEMENT_COLORS.shock), 0.5).lineBetween(b.x, b.y, e.x, e.y);
  },
};

// 基板の線（配線トレース・基板ショートが走る道）の薄い絵。オーバーロードが、この2つの攻撃をしている間だけ、背景の上に出す
export function drawBoard(g, bounds, alpha = 0.12) {
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  g.lineStyle(1, hex(ELEMENT_COLORS.shock), alpha);
  for (const fx of BOARD_COLUMNS) g.lineBetween(bounds.left + w * fx, bounds.top, bounds.left + w * fx, bounds.bottom);
  for (const fy of BOARD_ROWS) g.lineBetween(bounds.left, bounds.top + h * fy, bounds.right, bounds.top + h * fy);
}
