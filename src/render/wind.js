// 環境「強風」の絵：遮風板と、風。戦闘の描画より手前、表示より奥に描く。
import { SCREEN } from '../data/balance.js';
import { COLORS, hex } from '../data/theme.js';
import { WIND_COLOR, flowAt, shadowOf, sheltered, windEnv } from '../game/wind.js';

const PLATE = { base: 0x141c26, face: 0x2a3a4c, light: 0x9db4d0 };

// 遮風板を描く。十字に組んだ板（どの向きの風も、陰ができる）。風の予告と、吹いている間は、陰になる場所を薄く示す
export function drawScreens(g, world) {
  const env = windEnv(world);
  if (!env) return;
  const ice = hex(WIND_COLOR);
  const half = env.screens.size / 2;
  for (const s of world.screens ?? []) {
    if (s.broken > 0) {
      // 飛ばされた板：土台だけが残る
      g.lineStyle(1.5, ice, 0.25).strokeCircle(s.x, s.y, 7);
      continue;
    }
    // 陰になる場所（流れの風下側）
    const raw = flowAt(world, s.x, s.y, { warn: true });
    if (raw) {
      const flow = shadowOf(raw);
      const px = -flow.y;
      const py = flow.x;
      const w = env.screens.width / 2;
      const pts = [
        { x: s.x + px * w, y: s.y + py * w },
        { x: s.x - px * w, y: s.y - py * w },
        { x: s.x - px * w + flow.x * env.screens.lee, y: s.y - py * w + flow.y * env.screens.lee },
        { x: s.x + px * w + flow.x * env.screens.lee, y: s.y + py * w + flow.y * env.screens.lee },
      ];
      g.fillStyle(ice, 0.1).fillPoints(pts, true);
      g.lineStyle(1, ice, 0.35).strokePoints(pts, true, true);
    }
    // 揺れている板（もうすぐ飛ぶ）は、赤く、小刻みに震える
    const loose = s.loose > 0;
    const jx = loose ? Math.sin(world.time * 60) * 2.5 : 0;
    const color = loose ? hex(COLORS.red) : ice;
    for (const [w, h] of [[half * 2, 10], [10, half * 2]]) {
      g.fillStyle(PLATE.base, 0.95).fillRect(s.x - w / 2 + jx, s.y - h / 2, w, h);
      g.fillStyle(PLATE.face, 0.95).fillRect(s.x - w / 2 + 2 + jx, s.y - h / 2 + 2, w - 4, h - 4);
      g.lineStyle(1.5, color, 0.9).strokeRect(s.x - w / 2 + jx, s.y - h / 2, w, h);
    }
    // 支柱と、板の端のボルト
    g.fillStyle(PLATE.light, 0.9).fillCircle(s.x + jx, s.y, 4);
    for (const [dx, dy] of [[half - 5, 0], [-half + 5, 0], [0, half - 5], [0, -half + 5]]) g.fillStyle(PLATE.light, 0.7).fillCircle(s.x + dx + jx, s.y + dy, 1.8);
  }
}

// 向きを表す、くの字の矢印
function chevron(g, x, y, dx, dy, size) {
  const px = -dy;
  const py = dx;
  g.lineBetween(x - dx * size + px * size, y - dy * size + py * size, x, y);
  g.lineBetween(x - dx * size - px * size, y - dy * size - py * size, x, y);
}

// 風：予告の間は、画面のふちが明滅して、風向きの矢印が出る。吹いている間は、風すじが流れる
export function drawWind(g, world) {
  const env = windEnv(world);
  const w = world.wind;
  if (!env || !w || w.phase === 'clear') return;
  const ice = hex(WIND_COLOR);
  const W = SCREEN.width;
  const H = SCREEN.height;
  if (w.phase === 'warn') {
    const k = 0.25 + 0.2 * Math.abs(Math.sin(world.time * 9));
    g.lineStyle(10, ice, k).strokeRect(5, 5, W - 10, H - 10);
    // 風向きの矢印（画面の真ん中に3つ。風下へ流れるように動く）
    g.lineStyle(5, ice, 0.75);
    for (let i = -1; i <= 1; i++) {
      const shift = i * 46 + ((world.time * 60) % 46);
      chevron(g, W / 2 + w.dirX * shift, H / 2 + w.dirY * shift, w.dirX, w.dirY, 18);
    }
    return;
  }
  const fade = Math.min(1, w.t / 0.5, (w.max - w.t) / 0.3);
  // 風すじ（時間で流れる。同じ乱数の並びを、ずらして使う）。遮風板の陰には描かない
  g.lineStyle(1.5, ice, 0.45 * fade);
  for (let i = 0; i < 70; i++) {
    const seed = i * 97.13;
    const along = (seed * 7.3 + world.time * 620) % (W + 120);
    const across = (seed * 13.7) % (W + 120);
    const x = w.dirX !== 0 ? (w.dirX > 0 ? along - 60 : W + 60 - along) : across - 60;
    const y = w.dirY !== 0 ? (w.dirY > 0 ? along - 60 : H + 60 - along) : (seed * 13.7) % H;
    if (y < 0 || y > H || x < 0 || x > W) continue;
    if (sheltered(world, x, y, w.dirX, w.dirY)) continue;
    g.lineBetween(x, y, x - w.dirX * 26, y - w.dirY * 26);
  }
  // 流されているときは、プレイヤーの風上側に、短い風すじ（当たっている合図）
  const p = world.player;
  if (w.pushing) {
    g.lineStyle(2, ice, 0.7 * fade);
    for (const side of [-1, 0, 1]) {
      const ox = p.x - w.dirX * (p.r + 8) - w.dirY * side * 8;
      const oy = p.y - w.dirY * (p.r + 8) + w.dirX * side * 8;
      g.lineBetween(ox, oy, ox - w.dirX * 12, oy - w.dirY * 12);
    }
  }
}

// 杭を打った錨打ちの足元に、杭の印
export function drawAnchors(g, world) {
  if (!windEnv(world)) return;
  for (const e of world.enemies) {
    if (!e.staked || e.dead) continue;
    g.lineStyle(2, hex(COLORS.amber), 0.9).strokeCircle(e.x, e.y, e.r + 5);
    for (const a of [0.25, 0.75, 1.25, 1.75]) {
      const cx = Math.cos(a * Math.PI);
      const cy = Math.sin(a * Math.PI);
      g.lineBetween(e.x + cx * (e.r + 5), e.y + cy * (e.r + 5), e.x + cx * (e.r + 12), e.y + cy * (e.r + 12));
    }
  }
}
