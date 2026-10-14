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
  // 部品の飛来：飛んでいく四角い部品と、組み上がる場所の印
  partflight(g, h, world) {
    const body = hex(h.color);
    g.lineStyle(1.5, RED(), 0.4).strokeCircle(h.tx, h.ty, 24);
    if (h.t < 0) return;
    g.lineStyle(1, body, 0.25).lineBetween(h.sx, h.sy, h.x, h.y);
    g.fillStyle(0x0a0814, 1).fillRect(h.x - 8, h.y - 8, 16, 16);
    g.lineStyle(2.5, body, 0.95).strokeRect(h.x - 8, h.y - 8, 16, 16);
  },

  // ベルト：流れる向きの矢印が動く帯
  belt(g, h, world) {
    const bd = world.bounds;
    const body = hex(h.color);
    const warn = h.warn > 0;
    const alpha = warn ? 0.06 + 0.12 * (1 - h.warn / h.warnMax) : 0.16;
    const x = h.axis === 'h' ? bd.left : h.pos - h.width / 2;
    const y = h.axis === 'h' ? h.pos - h.width / 2 : bd.top;
    const w = h.axis === 'h' ? bd.right - bd.left : h.width;
    const hh = h.axis === 'h' ? h.width : bd.bottom - bd.top;
    g.fillStyle(warn ? RED() : body, alpha).fillRect(x, y, w, hh);
    g.lineStyle(2, warn ? RED() : body, warn ? 0.6 : 0.5).strokeRect(x, y, w, hh);
    if (warn) return;
    const shift = (world.time * h.speed * 0.5) % 60;
    if (h.axis === 'h') {
      for (let px = bd.left - 60; px < bd.right + 60; px += 60) {
        const cx = px + h.dir * shift;
        g.lineStyle(2.5, body, 0.5).lineBetween(cx - h.dir * 10, h.pos - 14, cx + h.dir * 10, h.pos).lineBetween(cx + h.dir * 10, h.pos, cx - h.dir * 10, h.pos + 14);
      }
    } else {
      for (let py = bd.top - 60; py < bd.bottom + 60; py += 60) {
        const cy = py + h.dir * shift;
        g.lineStyle(2.5, body, 0.5).lineBetween(h.pos - 14, cy - h.dir * 10, h.pos, cy + h.dir * 10).lineBetween(h.pos, cy + h.dir * 10, h.pos + 14, cy - h.dir * 10);
      }
    }
  },

  // 再生の影：出る場所に待っている間は、細い輪。動き出したら、プレイヤーの形の影
  replayshade(g, h, world) {
    const body = hex(h.color);
    if (!h.active) {
      const k = Math.min(1, h.age / h.delay);
      g.lineStyle(2, RED(), 0.25 + 0.5 * k).strokeCircle(h.x, h.y, h.r * (1.8 - 0.8 * k));
      return;
    }
    g.fillStyle(body, 0.2).fillCircle(h.x, h.y, h.r * 1.5);
    g.fillStyle(0x0a0814, 0.9).fillCircle(h.x, h.y, h.r);
    g.lineStyle(3, body, 0.95).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(1.5, WHITE, 0.6).strokeCircle(h.x, h.y, h.r * 0.5);
    // しっぽ（通ってきた道）
    const tail = h.buf.slice(Math.max(0, h.i - 12), h.i);
    for (let k = 0; k < tail.length; k++) g.fillStyle(body, 0.08 + 0.3 * (k / tail.length)).fillCircle(tail[k].x, tail[k].y, h.r * 0.5);
  },

  // 検閲帯：黒い帯。予告は赤、当たるときは黒く塗る。ずれる先も、うっすら見える
  censor(g, h, world) {
    const bd = world.bounds;
    const rect = (pos, w) => (h.axis === 'x' ? [pos - w / 2, bd.top, w, bd.bottom - bd.top] : [bd.left, pos - w / 2, bd.right - bd.left, w]);
    const pos = h.steps[h.step];
    if (h.phase === 'warn') {
      const k = 1 - h.warn / h.warnMax;
      const r = rect(pos, h.width);
      g.fillStyle(RED(), 0.06 + 0.16 * k).fillRect(r[0], r[1], r[2], r[3]);
      g.lineStyle(2, RED(), 0.4 + 0.5 * k).strokeRect(r[0], r[1], r[2], r[3]);
      if (h.step + 1 < h.steps.length) {
        const n = rect(h.steps[h.step + 1], h.width);
        g.lineStyle(1, RED(), 0.25).strokeRect(n[0], n[1], n[2], n[3]);
      }
      return;
    }
    const r = rect(pos, h.width);
    g.fillStyle(0x000000, 0.92).fillRect(r[0], r[1], r[2], r[3]);
    g.lineStyle(2, WHITE, 0.7).strokeRect(r[0], r[1], r[2], r[3]);
  },

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
  assemble: ringTelegraph,
  belts: ringTelegraph,
  press: ringTelegraph,
  moltenspit: ringTelegraph,
  fasten: ringTelegraph,
  fullline: ringTelegraph,
  echo: ringTelegraph,
  // 足跡爆撃：記録した足跡を、赤い輪で見せる
  trailstrike: (g, b, act, world) => {
    if (act.phase !== 'telegraph') return;
    ringTelegraph(g, b, act, world);
    for (const s of act.samples ?? []) g.lineStyle(1.5, RED(), 0.45).strokeCircle(s.x, s.y, act.def.radius * 0.6);
  },
  collect: ringTelegraph,
  censorbars: ringTelegraph,
  backup: ringTelegraph,
  rewind: ringTelegraph,
  gateclose: ringTelegraph,
  holdshots: ringTelegraph,
  callguards: ringTelegraph,
  fissure: lineTelegraph(900),
  tailbomb: ringTelegraph,
  lockdown: ringTelegraph,
};
