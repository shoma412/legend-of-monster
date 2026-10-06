// 環境「暗闇」の絵。暗い場所を塗り、その上に「暗闇でも見えるもの」（目の光）を描く。
// 予告・残る攻撃・敵の弾は、呼ぶ側（BattleScene）が、この層の上にもう一度描く。
import { SCREEN } from '../data/balance.js';
import { COLORS, hex } from '../data/theme.js';
import { darkEnv, isVisible, lightSources, visionRadius } from '../game/darkness.js';
import { darkStrips } from '../logic/darkCells.js';

const CELL = 12; // 暗さを決めるマスの大きさ（px）。小さいほどなめらかだが、重くなる
const LEVELS = 4;

// 暗闇を塗る。明るいマップでは何もしない
export function drawDarkness(g, world) {
  const env = darkEnv(world);
  if (!env) return;
  const p = world.player;
  const lights = [{ x: p.x, y: p.y, r: visionRadius(world) }, ...lightSources(world)];
  const rect = { left: 0, top: 0, right: SCREEN.width, bottom: SCREEN.height };
  for (const s of darkStrips(rect, CELL, lights, env.soft, LEVELS)) {
    g.fillStyle(0x020108, env.darkness * (s.level / LEVELS)).fillRect(s.x, s.y, s.w, s.h);
  }
}

// 暗い場所にいる敵の、目の光（位置だけ分かる）
export function drawEyes(g, world) {
  if (!darkEnv(world)) return;
  const p = world.player;
  for (const e of world.enemies) {
    if (e.dead || e.spawnT > 0 || e.hidden || e.def.prop) continue;
    if (isVisible(world, e.x, e.y, -e.r * 0.5)) continue;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const gap = e.boss ? 7 : 4;
    const size = e.boss ? 3.2 : 2;
    const blink = 0.65 + 0.35 * Math.sin(world.time * 3 + (e.seed ?? 0));
    for (const side of [-1, 1]) {
      const x = e.x + Math.cos(a) * e.r * 0.3 - Math.sin(a) * side * gap;
      const y = e.y + Math.sin(a) * e.r * 0.3 + Math.cos(a) * side * gap;
      g.fillStyle(hex(COLORS.red), 0.25 * blink).fillCircle(x, y, size * 2.2);
      g.fillStyle(hex(COLORS.red), blink).fillCircle(x, y, size);
    }
  }
}

// 非常灯：柱と、点いているときの光の輪。壊されている間は、暗い柱だけ
export function drawLamps(g, world) {
  const env = darkEnv(world);
  if (!env) return;
  for (const lamp of world.lamps) {
    const broken = lamp.broken > 0;
    const on = lamp.on > 0;
    const color = hex(broken ? COLORS.line : on ? COLORS.amber : COLORS.dim);
    // 残り時間が少なくなると、ちらつく
    const flicker = on && lamp.on < 2 ? 0.55 + 0.45 * Math.abs(Math.sin(world.time * 18)) : 1;
    if (on) {
      g.fillStyle(hex(COLORS.amber), 0.05 * flicker).fillCircle(lamp.x, lamp.y, env.lamps.radius);
      g.lineStyle(1, hex(COLORS.amber), 0.25 * flicker).strokeCircle(lamp.x, lamp.y, env.lamps.radius);
    }
    g.fillStyle(0x0a0814, 0.95).fillRect(lamp.x - 4, lamp.y - 12, 8, 24);
    g.lineStyle(2, color, 1).strokeRect(lamp.x - 4, lamp.y - 12, 8, 24);
    g.fillStyle(color, on ? flicker : 0.5).fillCircle(lamp.x, lamp.y - 16, on ? 6 : 4);
    if (on) g.lineStyle(4, hex(COLORS.amber), 0.3 * flicker).strokeCircle(lamp.x, lamp.y - 16, 9);
    if (broken) g.lineStyle(2, hex(COLORS.red), 0.8).lineBetween(lamp.x - 7, lamp.y - 21, lamp.x + 7, lamp.y - 11);
    // まだ点いていない非常灯には、近づく範囲の目安を薄く出す
    if (!on && !broken) g.lineStyle(1, hex(COLORS.dim), 0.35).strokeCircle(lamp.x, lamp.y, env.lamps.trigger);
  }
}
