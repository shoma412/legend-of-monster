// 環境「酸の雨」の絵：屋根（瓦ぶき）と、雨。戦闘の描画より手前、表示より奥に描く。
import { SCREEN } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS, hex } from '../data/theme.js';
import { rainEnv, underRoof } from '../game/acidRain.js';

// 瓦の色（いぶし瓦：青みのある灰色）
const TILE = { base: 0x1a222c, face: 0x2e3c4d, face2: 0x34455a, shade: 0x0b1016, light: 0x7d95b3, ridge: 0x41546c, ridgeLight: 0x9db4d0 };
const TW = 18; // 瓦1枚の幅
const TH = 12; // 瓦の段の間隔（下の段が、上の段に少し重なる）

// 屋根を1つ描く。瓦を、半分ずつずらして段に並べる（下の段ほど手前）。真ん中に棟（むね）、下の縁に軒先の丸瓦
function drawRoof(g, r, alpha) {
  const x0 = r.x - r.w / 2;
  const y0 = r.y - r.h / 2;
  const x1 = x0 + r.w;
  const y1 = y0 + r.h;
  g.fillStyle(TILE.base, alpha).fillRect(x0, y0, r.w, r.h);
  // 瓦の段：下が丸い瓦を、うろこのように重ねる。段ごとに半分ずらし、下の段が上の段に重なる
  const R = TW / 2;
  let row = 0;
  for (let y = y0 + 2; y < y1 - R + 2; y += TH - 2, row++) {
    const off = row % 2 === 1 ? R : 0;
    for (let cx = x0 + R - off; cx <= x1 - R + 0.5; cx += TW) {
      if (cx - R < x0 - 0.5) continue;
      const face = (Math.round((cx - x0) / R) + row * 2) % 5 === 0 ? TILE.face2 : TILE.face;
      // 瓦1枚：上は四角、下は半円
      g.fillStyle(face, alpha).fillRect(cx - R + 1, y, TW - 2, R - 2);
      g.fillStyle(face, alpha).slice(cx, y + R - 3, R - 1, 0, Math.PI, false).fillPath();
      // 下の縁（影）。重なりの段差が見えるように、太めに
      g.lineStyle(2, TILE.shade, alpha);
      g.beginPath();
      g.arc(cx, y + R - 3, R - 1, Math.PI * 0.04, Math.PI * 0.96, false);
      g.strokePath();
      // 濡れた面の反射（左上に、短い弧）
      g.lineStyle(1.2, TILE.light, alpha * 0.8);
      g.beginPath();
      g.arc(cx, y + R - 3, R - 4, Math.PI * 0.62, Math.PI * 0.9, false);
      g.strokePath();
    }
  }
  // 棟（むね）：真ん中を横に通る、丸瓦の列
  const ry = r.y;
  g.fillStyle(TILE.shade, alpha).fillRect(x0, ry - 7, r.w, 14);
  g.fillStyle(TILE.ridge, alpha).fillRect(x0, ry - 6, r.w, 11);
  g.lineStyle(1.5, TILE.ridgeLight, alpha * 0.8).lineBetween(x0 + 2, ry - 4, x1 - 2, ry - 4);
  for (let x = x0 + 12; x < x1 - 4; x += 16) g.lineStyle(1.5, TILE.shade, alpha).lineBetween(x, ry - 6, x, ry + 5);
  // 鬼瓦（棟の両端）
  for (const ex of [x0, x1]) {
    g.fillStyle(TILE.ridge, alpha).fillCircle(ex, ry, 9);
    g.lineStyle(2, TILE.shade, alpha).strokeCircle(ex, ry, 9);
    g.fillStyle(TILE.ridgeLight, alpha * 0.8).fillCircle(ex, ry, 3);
  }
  // 軒先：下の縁に並ぶ、丸い軒瓦
  for (let x = x0 + TW / 2; x < x1 - 2; x += TW) {
    g.fillStyle(TILE.face2, alpha).fillCircle(x, y1, 6);
    g.lineStyle(1.5, TILE.shade, alpha).strokeCircle(x, y1, 6);
    g.fillStyle(TILE.light, alpha * 0.6).fillCircle(x - 1.5, y1 - 1.5, 1.6);
  }
  // 枠
  g.lineStyle(2, TILE.shade, alpha).strokeRect(x0, y0, r.w, r.h);
  g.lineStyle(1, hex(COLORS.ice), alpha * 0.55).strokeRect(x0 - 1, y0 - 1, r.w + 2, r.h + 2);
}

// 崩された屋根：枠だけが点線で残り、割れた瓦が散らばる。直るまでの時間が、枠の上の線で分かる
function drawRubble(g, r) {
  const x0 = r.x - r.w / 2;
  const y0 = r.y - r.h / 2;
  const c = hex(COLORS.dim);
  g.lineStyle(1.5, c, 0.5);
  for (let x = x0; x < x0 + r.w; x += 16) {
    g.lineBetween(x, y0, Math.min(x0 + r.w, x + 8), y0);
    g.lineBetween(x, y0 + r.h, Math.min(x0 + r.w, x + 8), y0 + r.h);
  }
  for (let y = y0; y < y0 + r.h; y += 16) {
    g.lineBetween(x0, y, x0, Math.min(y0 + r.h, y + 8));
    g.lineBetween(x0 + r.w, y, x0 + r.w, Math.min(y0 + r.h, y + 8));
  }
  // 割れた瓦（場所は、屋根ごとに決まっている）
  for (let i = 0; i < 9; i++) {
    const fx = ((i * 37 + Math.floor(r.x)) % 100) / 100;
    const fy = ((i * 61 + Math.floor(r.y)) % 100) / 100;
    g.fillStyle(TILE.face, 0.55).fillRect(x0 + 8 + fx * (r.w - 24), y0 + 8 + fy * (r.h - 22), 9, 6);
    g.lineStyle(1, TILE.shade, 0.7).strokeRect(x0 + 8 + fx * (r.w - 24), y0 + 8 + fy * (r.h - 22), 9, 6);
  }
  const k = Math.max(0, Math.min(1, r.broken / (r.brokenMax || r.broken)));
  g.lineStyle(3, hex(COLORS.ice), 0.7).lineBetween(x0, y0 - 6, x0 + r.w * (1 - k), y0 - 6);
}

// 屋根を描く。下にいるものが見えるように、少し透ける。プレイヤーが下にいる屋根は、もっと透ける
export function drawRoofs(g, world) {
  if (!rainEnv(world)) return;
  const p = world.player;
  for (const r of world.roofs ?? []) {
    if (r.broken > 0) {
      drawRubble(g, r);
      continue;
    }
    const under = Math.abs(p.x - r.x) <= r.w / 2 && Math.abs(p.y - r.y) <= r.h / 2;
    drawRoof(g, r, under ? 0.3 : 0.62);
  }
}

// 雨：予告の間は、画面のふちが黄緑に明滅する。降っている間は、斜めの雨すじと、薄い黄緑のもや
export function drawRain(g, world) {
  const env = rainEnv(world);
  const r = world.rain;
  if (!env || !r || r.phase === 'clear') return;
  const acid = hex(ELEMENT_COLORS.corrode);
  const W = SCREEN.width;
  const H = SCREEN.height;
  if (r.phase === 'warn') {
    const k = 0.25 + 0.2 * Math.abs(Math.sin(world.time * 9));
    g.lineStyle(10, acid, k).strokeRect(5, 5, W - 10, H - 10);
    return;
  }
  const fade = Math.min(1, r.t / 0.5, (r.max - r.t) / 0.3);
  g.fillStyle(acid, 0.05 * fade).fillRect(0, 0, W, H);
  // 雨すじ（時間で流れる。同じ乱数の並びを、ずらして使う）
  g.lineStyle(1.5, acid, 0.5 * fade);
  for (let i = 0; i < 90; i++) {
    const seed = i * 97.13;
    const x = ((seed * 7.3 + world.time * 260) % (W + 80)) - 40;
    const y = ((seed * 13.7 + world.time * 900) % (H + 60)) - 30;
    if (underRoof(world, x, y)) continue; // 屋根の上には、すじを描かない（屋根に当たって止まる）
    g.lineBetween(x, y, x - 5, y + 16);
  }
  // 屋根の外にいるときは、プレイヤーの足元に、黄緑の輪（当たっている合図）
  const p = world.player;
  if (!underRoof(world, p.x, p.y)) g.lineStyle(2, acid, 0.6 * fade).strokeCircle(p.x, p.y, p.r + 6 + 2 * Math.sin(world.time * 14));
}
