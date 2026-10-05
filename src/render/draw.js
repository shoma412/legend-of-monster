// 戦闘画面の描画。world の状態を読んで、毎フレーム Graphics にネオン線画を描き直す。
import { LOOT, PLAYER, ROOM, SCREEN } from '../data/balance.js';
import { AREA_THEMES, COLORS, ELEMENT_COLORS, RARITY_COLORS, hex } from '../data/theme.js';
import { DATA } from '../data/index.js';
import { xpToNext } from '../logic/level.js';
import { drawBackdrop } from './backdrop.js';
import { drawItemIcon, drawSlotIcon } from './icons.js';
import { DEG } from '../logic/geometry.js';

const BODY_FILL = 0x0a0814;
const WHITE = 0xffffff;

// 太く薄い線の上に細い線を重ねて、光っているように見せる
function neonStroke(g, color, width, path) {
  g.lineStyle(width + 6, color, 0.16);
  path();
  g.lineStyle(width, color, 1);
  path();
}

function polygon(x, y, radius, sides, rotation) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * Math.PI * 2) / sides;
    pts.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius });
  }
  return pts;
}

function arcPath(g, x, y, r, from, to) {
  g.beginPath();
  g.arc(x, y, r, from, to, false);
  g.strokePath();
}

// 部屋の外側の枠（壁）。床の上のもの（敵の攻撃の予告、火花など）より手前に描いて、
// 部屋からはみ出したぶんが画面上部の表示や枠にかからないようにする
export function drawFrame(g, theme = 'slum') {
  const { width: W, height: H } = SCREEN;
  const wall = ROOM.wall;
  const top = ROOM.wallTop;
  const t = AREA_THEMES[theme] ?? AREA_THEMES.slum;
  g.fillStyle(t.wall, 1);
  g.fillRect(0, 0, W, top).fillRect(0, H - wall, W, wall).fillRect(0, 0, wall, H).fillRect(W - wall, 0, wall, H);
  neonStroke(g, hex(t.edge), 2, () => g.strokeRect(wall, top, W - wall * 2, H - wall - top));
}

// theme: エリアごとの床と壁の色（src/data/theme.js の AREA_THEMES の名前）
// seed: 背景の模様の置き場所を決める数（部屋ごとに変える）
export function drawFloor(g, theme = 'slum', seed = 1) {
  const { width: W, height: H } = SCREEN;
  const wall = ROOM.wall;
  const top = ROOM.wallTop;
  const t = AREA_THEMES[theme] ?? AREA_THEMES.slum;
  g.fillStyle(t.floor, 1).fillRect(0, 0, W, H);
  drawBackdrop(g, theme, seed);
  g.lineStyle(1, t.grid, 0.06);
  for (let x = wall; x < W; x += 40) g.lineBetween(x, 0, x, H);
  for (let y = top; y < H; y += 40) g.lineBetween(0, y, W, y);
  g.fillStyle(t.wall, 1);
  g.fillRect(0, 0, W, top).fillRect(0, H - wall, W, wall).fillRect(0, 0, wall, H).fillRect(W - wall, 0, wall, H);
  neonStroke(g, hex(t.edge), 2, () => g.strokeRect(wall, top, W - wall * 2, H - wall - top));
}

const SHAPES = {
  triangle(g, e, color, world) {
    const pts = polygon(e.x, e.y, e.r * 1.3, 3, world.time * 4 + e.seed);
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(pts, true, true));
  },
  square(g, e, color, world) {
    const p = world.player;
    const facing = e.state === 'chase' ? Math.atan2(p.y - e.y, p.x - e.x) : e.angle;
    const pts = polygon(e.x, e.y, e.r * 1.35, 4, facing + Math.PI / 4);
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(pts, true, true));
    g.fillStyle(color, 1).fillCircle(e.x + Math.cos(facing) * e.r * 0.5, e.y + Math.sin(facing) * e.r * 0.5, 3);
  },
  // 自爆ボット：とげのある六角形。点滅中は白く光る
  hexagon(g, e, color, world) {
    const blink = e.state === 'fuse' && Math.floor(world.time * (6 + 14 * (1 - e.t / e.def.bomb.fuse))) % 2 === 0;
    const c = blink ? WHITE : color;
    const pts = polygon(e.x, e.y, e.r * 1.25, 6, world.time * 2 + e.seed);
    g.fillStyle(blink ? c : BODY_FILL, blink ? 0.5 : 0.85).fillPoints(pts, true);
    neonStroke(g, c, 2.5, () => g.strokePoints(pts, true, true));
    g.fillStyle(c, 1).fillCircle(e.x, e.y, 3);
  },
  // フロストスプレイヤー：噴射口のついた五角形
  pentagon(g, e, color, world) {
    const p = world.player;
    const facing = e.state === 'chase' ? Math.atan2(p.y - e.y, p.x - e.x) : e.angle;
    const pts = polygon(e.x, e.y, e.r * 1.3, 5, facing);
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(pts, true, true));
    neonStroke(g, color, 4, () => g.lineBetween(e.x + Math.cos(facing) * e.r, e.y + Math.sin(facing) * e.r, e.x + Math.cos(facing) * e.r * 1.9, e.y + Math.sin(facing) * e.r * 1.9));
  },
  // シールド兵：四角い体と、正面の盾（太い弧）。盾のない背後が弱点
  shield(g, e, color, world) {
    const facing = e.state === 'chase' ? e.facing : e.angle;
    const pts = polygon(e.x, e.y, e.r * 1.25, 4, facing + Math.PI / 4);
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(pts, true, true));
    const half = (e.def.shield.arc * DEG) / 2;
    const stopped = e.stopT > 0;
    g.lineStyle(10, stopped ? hex(COLORS.dim) : WHITE, stopped ? 0.2 : 0.18);
    arcPath(g, e.x, e.y, e.r + 9, facing - half, facing + half);
    g.lineStyle(4, stopped ? hex(COLORS.dim) : WHITE, stopped ? 0.5 : 1);
    arcPath(g, e.x, e.y, e.r + 9, facing - half, facing + half);
  },
  // スナイパー：細長い菱形。狙っている方向を向く
  diamond(g, e, color, world) {
    const p = world.player;
    const a = e.state === 'aim' ? e.angle : Math.atan2(p.y - e.y, p.x - e.x);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const pts = [
      { x: e.x + cos * e.r * 1.7, y: e.y + sin * e.r * 1.7 },
      { x: e.x - sin * e.r * 0.7, y: e.y + cos * e.r * 0.7 },
      { x: e.x - cos * e.r * 1.1, y: e.y - sin * e.r * 1.1 },
      { x: e.x + sin * e.r * 0.7, y: e.y - cos * e.r * 0.7 },
    ];
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(pts, true, true));
  },
  // 清掃ローラー：横に長い胴と、前のブラシ。転がっている間は線が流れる
  roller(g, e, color, world) {
    const p = world.player;
    const a = e.state === 'chase' ? Math.atan2(p.y - e.y, p.x - e.x) : e.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const w = e.r * 0.8;
    const l = e.r * 1.25;
    const pts = [
      { x: e.x + cos * w - sin * l, y: e.y + sin * w + cos * l },
      { x: e.x + cos * w + sin * l, y: e.y + sin * w - cos * l },
      { x: e.x - cos * w + sin * l, y: e.y - sin * w - cos * l },
      { x: e.x - cos * w - sin * l, y: e.y - sin * w + cos * l },
    ];
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(pts, true, true));
    // ブラシ（前側の太い線）
    neonStroke(g, color, 5, () => g.lineBetween(pts[0].x + cos * 4, pts[0].y + sin * 4, pts[1].x + cos * 4, pts[1].y + sin * 4));
    if (e.state === 'roll') {
      const k = (world.time * 14) % 1;
      const mx = e.x + cos * w * (1 - 2 * k);
      const my = e.y + sin * w * (1 - 2 * k);
      g.lineStyle(1.5, color, 0.8).lineBetween(mx - sin * l, my + cos * l, mx + sin * l, my - cos * l);
    }
  },
  // ヒルドローン：小さな楕円と、口の輪。張り付いている間は脈打つ
  leech(g, e, color, world) {
    const p = world.player;
    const a = e.state === 'latched' ? e.latchAngle + Math.PI : Math.atan2(p.y - e.y, p.x - e.x);
    const pulse = e.state === 'latched' ? 1 + 0.25 * Math.sin(world.time * 18) : 1;
    const body = rotatedEllipse(e.x, e.y, e.r * 1.5 * pulse, e.r * 0.9 * pulse, a, 14);
    g.fillStyle(BODY_FILL, 0.85).fillPoints(body, true);
    neonStroke(g, e.state === 'stunned' ? hex(COLORS.dim) : color, 2, () => g.strokePoints(body, true, true));
    g.lineStyle(1.5, color, 1).strokeCircle(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, 2.5);
  },
  // 配管タレット：丸い継ぎ手と、太い噴射口
  pipe(g, e, color, world) {
    const p = world.player;
    const a = e.state === 'chase' ? Math.atan2(p.y - e.y, p.x - e.x) : e.angle;
    g.fillStyle(BODY_FILL, 0.85).fillCircle(e.x, e.y, e.r);
    neonStroke(g, color, 2.5, () => g.strokeCircle(e.x, e.y, e.r));
    g.lineStyle(1.5, color, 0.7).strokeCircle(e.x, e.y, e.r * 0.5);
    neonStroke(g, color, 7, () => g.lineBetween(e.x + Math.cos(a) * e.r * 0.6, e.y + Math.sin(a) * e.r * 0.6, e.x + Math.cos(a) * e.r * 1.7, e.y + Math.sin(a) * e.r * 1.7));
    // 床に固定するボルト
    for (let i = 0; i < 4; i++) {
      const b = (i * Math.PI) / 2 + Math.PI / 4;
      g.fillStyle(color, 0.8).fillRect(e.x + Math.cos(b) * (e.r + 3) - 1.5, e.y + Math.sin(b) * (e.r + 3) - 1.5, 3, 3);
    }
  },
  // 汚泥のかたまり：ゆらゆら形の変わる丸
  blob(g, e, color, world) {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      const r = e.r * (1.05 + 0.16 * Math.sin(world.time * 5 + e.seed + i * 1.7));
      pts.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r });
    }
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(pts, true, true));
    g.fillStyle(color, 0.7).fillCircle(e.x - e.r * 0.25, e.y - e.r * 0.2, Math.max(1.5, e.r * 0.14));
    g.fillStyle(color, 0.5).fillCircle(e.x + e.r * 0.3, e.y + e.r * 0.15, Math.max(1.5, e.r * 0.1));
  },
  // 密漁者：人の形（四角い体）と、構えた銛
  poacher(g, e, color, world) {
    const p = world.player;
    const a = e.state === 'aim' ? e.angle : Math.atan2(p.y - e.y, p.x - e.x);
    const pts = polygon(e.x, e.y, e.r * 1.3, 4, a + Math.PI / 4);
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(pts, true, true));
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // 銛（先がかぎになっている）
    const tip = { x: e.x + cos * e.r * 2.1, y: e.y + sin * e.r * 2.1 };
    neonStroke(g, color, 2, () => g.lineBetween(e.x - cos * e.r * 0.4, e.y - sin * e.r * 0.4, tip.x, tip.y));
    g.lineStyle(2, color, 1).lineBetween(tip.x, tip.y, tip.x - cos * 6 - sin * 5, tip.y - sin * 6 + cos * 5).lineBetween(tip.x, tip.y, tip.x - cos * 6 + sin * 5, tip.y - sin * 6 - cos * 5);
  },
  // スラッジハイドラの首：体とつながる首すじと、口を開けた頭。弾を吐く前に口が光る
  hydrahead(g, e, color, world) {
    const p = world.player;
    const b = e.anchor;
    if (b && !b.dead) {
      // 首すじ（体の中心から頭まで、節を並べる）
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        const sway = Math.sin(world.time * 3 + e.seed + i) * 4;
        g.fillStyle(BODY_FILL, 0.9).fillCircle(b.x + (e.x - b.x) * k + sway, b.y + (e.y - b.y) * k, e.r * 0.5);
        g.lineStyle(2, color, 0.7).strokeCircle(b.x + (e.x - b.x) * k + sway, b.y + (e.y - b.y) * k, e.r * 0.5);
      }
    }
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const head = rotatedEllipse(e.x, e.y, e.r * 1.2, e.r * 0.9, a, 16);
    g.fillStyle(BODY_FILL, 0.9).fillPoints(head, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(head, true, true));
    const mouth = { x: e.x + Math.cos(a) * e.r * 0.8, y: e.y + Math.sin(a) * e.r * 0.8 };
    const aiming = e.state === 'aim';
    g.fillStyle(aiming ? WHITE : color, aiming ? 0.9 : 0.6).fillCircle(mouth.x, mouth.y, aiming ? 5 : 3);
  },
  circle(g, e, color, world) {
    const p = world.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    g.fillStyle(BODY_FILL, 0.85).fillCircle(e.x, e.y, e.r);
    neonStroke(g, color, 2.5, () => g.strokeCircle(e.x, e.y, e.r));
    neonStroke(g, color, 2.5, () => g.lineBetween(e.x, e.y, e.x + Math.cos(a) * e.r * 1.6, e.y + Math.sin(a) * e.r * 1.6));
  },
};

function drawTelegraph(g, e, world) {
  const red = hex(COLORS.red);
  if (e.def.behavior === 'bomber' && e.state === 'fuse') {
    // 爆発の範囲。時間が近づくほど濃く、速く点滅する
    const bomb = e.def.bomb;
    const k = 1 - e.t / bomb.fuse;
    g.fillStyle(red, 0.1 + 0.22 * k).fillCircle(e.x, e.y, bomb.radius);
    g.lineStyle(2, red, 0.5 + 0.5 * Math.abs(Math.sin(world.time * (8 + 20 * k)))).strokeCircle(e.x, e.y, bomb.radius);
  }
  if (e.def.behavior === 'sprayer' && (e.state === 'windup' || e.state === 'spray')) {
    // 冷気の届く扇。構えている間は予告、噴いている間は濃く
    const spray = e.def.spray;
    const half = (spray.arc * DEG) / 2;
    const active = e.state === 'spray';
    g.fillStyle(active ? hex(e.color) : red, active ? 0.22 : 0.14 + 0.16 * (1 - e.t / spray.windup));
    g.slice(e.x, e.y, spray.range, e.angle - half, e.angle + half, false).fillPath();
  }
  if (e.def.attack && e.state === 'windup') {
    // 殴る範囲の予告。構えが進むほど濃くなる
    const atk = e.def.attack;
    const k = 1 - e.t / atk.windup;
    g.fillStyle(red, 0.18 + 0.3 * k);
    g.slice(e.x, e.y, atk.range, e.angle - (atk.arc * DEG) / 2, e.angle + (atk.arc * DEG) / 2, false).fillPath();
  }
  if (e.def.attack && e.swingT > 0) {
    const atk = e.def.attack;
    g.lineStyle(6, hex(e.color), e.swingT / 0.15);
    arcPath(g, e.x, e.y, atk.range * 0.85, e.angle - (atk.arc * DEG) / 2, e.angle + (atk.arc * DEG) / 2);
  }
  if (e.def.behavior === 'sniper' && e.state === 'aim') {
    // スナイパーの照準線。向きが固定されると太く明るくなる
    const snipe = e.def.snipe;
    const locked = e.t <= snipe.lock;
    g.lineStyle(locked ? 4 : 1.5, red, locked ? 0.95 : 0.45 + 0.25 * Math.sin(world.time * 30));
    g.lineBetween(e.x, e.y, e.x + Math.cos(e.angle) * snipe.range, e.y + Math.sin(e.angle) * snipe.range);
  }
  if (e.def.behavior === 'roller' && e.state === 'windup') {
    // 転がる道の予告
    const roll = e.def.roll;
    const len = roll.speed * roll.duration;
    const k = 1 - e.t / roll.windup;
    g.lineStyle(e.r * 2, red, 0.1 + 0.22 * k);
    g.lineBetween(e.x, e.y, e.x + Math.cos(e.angle) * len, e.y + Math.sin(e.angle) * len);
  }
  if (e.def.behavior === 'steamer' && (e.state === 'aim' || e.state === 'steam')) {
    // 蒸気の帯。狙っている間は予告（向きが固定されると濃くなる）、噴いている間は敵の色
    const steam = e.def.steam;
    const x2 = e.x + Math.cos(e.angle) * steam.range;
    const y2 = e.y + Math.sin(e.angle) * steam.range;
    if (e.state === 'aim') {
      const locked = e.t <= steam.lock;
      g.lineStyle(steam.width, red, locked ? 0.3 : 0.08 + 0.1 * Math.abs(Math.sin(world.time * 16)));
      g.lineBetween(e.x, e.y, x2, y2);
      g.lineStyle(1.5, red, locked ? 0.95 : 0.5).lineBetween(e.x, e.y, x2, y2);
    } else {
      const c = hex(e.color);
      g.lineStyle(steam.width + 10, c, 0.14).lineBetween(e.x, e.y, x2, y2);
      g.lineStyle(steam.width, c, 0.28 + 0.1 * Math.sin(world.time * 40)).lineBetween(e.x, e.y, x2, y2);
      g.lineStyle(steam.width * 0.25, WHITE, 0.3).lineBetween(e.x, e.y, x2, y2);
    }
  }
  if (e.def.behavior === 'harpooner' && e.state === 'aim') {
    // 銛の照準線。向きが固定されると太く明るくなる
    const harpoon = e.def.harpoon;
    const locked = e.t <= harpoon.lock;
    g.lineStyle(locked ? 4 : 1.5, red, locked ? 0.95 : 0.45 + 0.25 * Math.sin(world.time * 30));
    g.lineBetween(e.x, e.y, e.x + Math.cos(e.angle) * harpoon.range, e.y + Math.sin(e.angle) * harpoon.range);
  }
  if (e.def.behavior === 'gunner' && e.state === 'aim') {
    // 照準線
    const p = world.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const blink = 0.35 + 0.35 * Math.sin(world.time * 40);
    g.lineStyle(2, red, blink);
    g.lineBetween(e.x, e.y, e.x + Math.cos(a) * 700, e.y + Math.sin(a) * 700);
  }
}

// 状態異常の目印：減速は水色の輪、凍結・停止は水色の塗り、燃焼はオレンジのちらつき
function drawStatus(g, e, world) {
  const cold = hex(ELEMENT_COLORS.cold);
  if (e.stopT > 0) {
    g.fillStyle(cold, 0.3).fillCircle(e.x, e.y, e.r + 5);
    g.lineStyle(2, cold, 0.9).strokeCircle(e.x, e.y, e.r + 5);
  } else if (e.slowT > 0) {
    g.lineStyle(1.5, cold, 0.8).strokeCircle(e.x, e.y, e.r + 6);
  }
  if (e.burnT > 0) {
    const heat = hex(ELEMENT_COLORS.heat);
    for (let i = 0; i < 3; i++) {
      const a = world.time * 7 + i * 2.1 + e.x * 0.05;
      const rr = e.r * (0.4 + 0.5 * Math.abs(Math.sin(a * 1.3)));
      g.fillStyle(heat, 0.85).fillRect(e.x + Math.cos(a) * rr - 2, e.y + Math.sin(a) * rr - 2 - 3 * Math.abs(Math.sin(a)), 4, 4);
    }
  }
}

// エリートの目印：赤いとげの輪。障壁が残っている間は水色の膜
function drawEliteMark(g, e, world) {
  const red = hex(COLORS.red);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = world.time * 1.5 + (i * Math.PI * 2) / n;
    const r1 = e.r + 7;
    const r2 = e.r + 13;
    g.lineStyle(2, red, 0.9).lineBetween(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1, e.x + Math.cos(a) * r2, e.y + Math.sin(a) * r2);
  }
  if (e.barrier > 0) {
    const k = e.barrier / e.barrierMax;
    g.fillStyle(hex(COLORS.cyan), 0.1 + 0.15 * k).fillCircle(e.x, e.y, e.r + 9);
    g.lineStyle(2, hex(COLORS.cyan), 0.4 + 0.6 * k).strokeCircle(e.x, e.y, e.r + 9);
  }
}

export function drawEnemies(g, world) {
  for (const e of world.enemies) {
    if (e.dead) continue;
    const color = hex(e.color);
    if (e.spawnT > 0) {
      // 出現予告
      const k = Math.min(1, e.spawnT / ROOM.spawnWarning);
      g.lineStyle(2, color, 0.3 + 0.4 * Math.abs(Math.sin(world.time * 14)));
      g.strokeCircle(e.x, e.y, e.r + 4 + (e.boss ? 0 : k * 22));
      g.lineBetween(e.x - 5, e.y, e.x + 5, e.y).lineBetween(e.x, e.y - 5, e.x, e.y + 5);
      continue;
    }
    drawTelegraph(g, e, world);
    const frozen = e.stopT > 0;
    SHAPES[e.def.shape](g, e, e.hit > 0 ? WHITE : frozen ? hex(ELEMENT_COLORS.cold) : color, world);
    drawStatus(g, e, world);
    if (e.elite) drawEliteMark(g, e, world);
    if (!e.boss && e.hp < e.maxHp) {
      g.fillStyle(hex(COLORS.line), 1).fillRect(e.x - 14, e.y - e.r - 11, 28, 3);
      g.fillStyle(color, 1).fillRect(e.x - 14, e.y - e.r - 11, (28 * Math.max(0, e.hp)) / e.maxHp, 3);
    }
  }
}

// プレイヤーの弾：進む向きに伸びた光の線
export function drawPlayerShots(g, world) {
  const elements = world.player.stats.elements;
  const color = hex(elements.length > 0 ? ELEMENT_COLORS[elements[0]] : COLORS.cyan);
  for (const s of world.playerShots) {
    const len = Math.hypot(s.vx, s.vy) || 1;
    const tx = s.x - (s.vx / len) * 16;
    const ty = s.y - (s.vy / len) * 16;
    g.lineStyle(8, color, 0.18).lineBetween(s.x, s.y, tx, ty);
    g.lineStyle(3, color, 1).lineBetween(s.x, s.y, tx, ty);
  }
}

export function drawShots(g, world) {
  for (const s of world.shots) {
    const color = hex(s.color ?? COLORS.amber); // ボスの弾はボスの色
    g.fillStyle(color, 0.2).fillCircle(s.x, s.y, s.r + 4);
    g.fillStyle(color, 1).fillCircle(s.x, s.y, s.r);
  }
}

export function drawPlayer(g, world) {
  const p = world.player;
  const special = p.weapon.special;
  const cyan = hex(COLORS.cyan);

  // 斬撃の軌跡
  const a = p.attack;
  if (a && a.phase === 'swing') {
    const k = a.t / a.swing;
    const color = a.charged ? hex(COLORS.amber) : cyan;
    const from = a.angle - a.arc / 2;
    const sweep = a.arc * Math.min(1, k * 1.8);
    g.lineStyle(a.heavy ? 26 : 18, color, 0.18 * (1 - k));
    arcPath(g, p.x, p.y, a.range * 0.72, from, from + sweep);
    g.lineStyle(a.heavy ? 12 : 8, color, 1 - k);
    arcPath(g, p.x, p.y, a.range * 0.8, from, from + sweep);
    g.lineStyle(2, WHITE, 0.9 * (1 - k));
    arcPath(g, p.x, p.y, a.range * 0.92, from, from + sweep);
  }

  // ジャストガードの構え：体の前に盾の弧
  if (p.guard) {
    const k = p.guard.t / special.window;
    const facing = Math.atan2(p.fy, p.fx);
    g.lineStyle(10, cyan, 0.2);
    arcPath(g, p.x, p.y, p.r + 12, facing - 1.2, facing + 1.2);
    g.lineStyle(4, k < 0.5 ? WHITE : cyan, 1 - 0.5 * k);
    arcPath(g, p.x, p.y, p.r + 12, facing - 1.2, facing + 1.2);
    g.lineStyle(1.5, cyan, 0.5).strokeCircle(p.x, p.y, p.r + 12);
  }

  // 溜めの輪。段階が上がるほど大きく、最大で金色
  if (p.charge) {
    const max = special.stages[special.stages.length - 1].time;
    const k = Math.min(1, p.charge.t / max);
    const stage = p.charge.stage;
    const color = stage === special.stages.length - 1 ? hex(COLORS.amber) : stage >= 0 ? cyan : hex(COLORS.dim);
    const pulse = stage >= 0 ? 2 * Math.sin(world.time * 30) : 0;
    g.lineStyle(3, color, 0.9);
    arcPath(g, p.x, p.y, p.r + 10 + pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    for (let i = 0; i <= stage; i++) g.fillStyle(color, 1).fillCircle(p.x - 8 + i * 8, p.y - p.r - 20, 2.5);
  }

  // 奥義が使えるとき：金色の輪が脈打つ
  if (world.ougiReady) {
    const pulse = 4 * Math.sin(world.time * 9);
    g.lineStyle(2, hex(COLORS.amber), 0.9).strokeCircle(p.x, p.y, p.r + 12 + pulse);
    g.lineStyle(6, hex(COLORS.amber), 0.2).strokeCircle(p.x, p.y, p.r + 12 + pulse);
  }
  // 煙幕：まわりに煙の輪
  if (p.smokeT > 0) {
    g.fillStyle(hex(COLORS.dim), 0.16).fillCircle(p.x, p.y, p.smokeRadius);
    g.lineStyle(2, hex(COLORS.ink), 0.3 + 0.2 * Math.sin(world.time * 8)).strokeCircle(p.x, p.y, p.smokeRadius);
  }
  // 一時強化が効いている間は、その色の輪
  if (p.buffs.length > 0) g.lineStyle(2, hex(p.buffs[0].color), 0.5 + 0.3 * Math.sin(world.time * 10)).strokeCircle(p.x, p.y, p.r + 5);
  // 冷気を浴びて遅くなっている間は、水色の輪
  if (p.slowT > 0) g.lineStyle(2, hex(ELEMENT_COLORS.cold), 0.8).strokeCircle(p.x, p.y, p.r + 7);

  if (world.mode === 'dead') return;
  // 被弾後の無敵中は点滅
  if (p.inv > 0 && p.dashT <= 0 && Math.floor(world.time * 20) % 2 === 0) return;

  const ang = a ? a.angle : Math.atan2(p.fy, p.fx);
  g.fillStyle(0x0b0914, 1).fillCircle(p.x, p.y, p.r);
  neonStroke(g, cyan, 2.5, () => g.strokeCircle(p.x, p.y, p.r));
  const tip = [
    { x: p.x + Math.cos(ang) * (p.r + 8), y: p.y + Math.sin(ang) * (p.r + 8) },
    { x: p.x + Math.cos(ang + 0.42) * (p.r - 1), y: p.y + Math.sin(ang + 0.42) * (p.r - 1) },
    { x: p.x + Math.cos(ang - 0.42) * (p.r - 1), y: p.y + Math.sin(ang - 0.42) * (p.r - 1) },
  ];
  g.fillStyle(cyan, 1).fillPoints(tip, true);
  // 銃：銃身と、撃った瞬間の光
  if (p.weapon.type === 'ranged') {
    const mx = p.x + Math.cos(ang) * (p.r + 14);
    const my = p.y + Math.sin(ang) * (p.r + 14);
    g.lineStyle(4, cyan, 1).lineBetween(p.x + Math.cos(ang) * p.r, p.y + Math.sin(ang) * p.r, mx, my);
    if (p.firingT > 0.08) g.fillStyle(WHITE, 0.9).fillCircle(mx, my, 5);
  }

  // 振りかぶり中は剣を後ろに引いて見せる
  if (a && a.phase === 'windup' && a.windup > 0) {
    const back = a.angle - a.arc / 2;
    g.lineStyle(4, cyan, 0.9);
    g.lineBetween(p.x, p.y, p.x + Math.cos(back) * a.range * 0.7, p.y + Math.sin(back) * a.range * 0.7);
  }
}

export function drawFx(g, world) {
  const fx = world.fx;
  for (const gh of fx.ghosts) {
    g.fillStyle(hex(gh.color), 0.3 * (gh.life / gh.max)).fillCircle(gh.x, gh.y, gh.r);
  }
  for (const r of fx.rings) {
    const k = 1 - r.life / r.max;
    g.lineStyle(3, hex(r.color), 1 - k).strokeCircle(r.x, r.y, r.radius * (0.5 + k));
  }
  for (const p of fx.particles) {
    g.fillStyle(hex(p.color), Math.max(0, p.life / p.max)).fillRect(p.x, p.y, p.size, p.size);
  }
}

export function drawHud(g, world) {
  const p = world.player;
  const y = 11;
  // HP（上の段）
  const hpX = 62;
  const hpW = 180;
  g.fillStyle(0x1b1631, 1).fillRect(hpX, 5, hpW, 9);
  const ratio = p.hp / p.stats.maxHp;
  g.fillStyle(hex(ratio > 0.3 ? COLORS.green : COLORS.red), 1).fillRect(hpX, 5, hpW * ratio, 9);
  g.lineStyle(1, hex(COLORS.line), 1).strokeRect(hpX, 5, hpW, 9);
  // 経験値（下の段。左に「Lv」の表記が付く）
  const xpX = 86;
  const xpW = 156;
  const xpRatio = Math.min(1, p.build.xp / xpToNext(p.build.level));
  g.fillStyle(0x1b1631, 1).fillRect(xpX, 20, xpW, 6);
  g.fillStyle(hex(COLORS.magenta), 1).fillRect(xpX, 20, xpW * xpRatio, 6);
  g.lineStyle(1, hex(COLORS.line), 1).strokeRect(xpX, 20, xpW, 6);

  // ダッシュと特殊攻撃のクールダウン
  const dashFull = p.dashCharges >= p.stats.dashCharges;
  cooldownBar(g, 362, y, dashFull ? 1 : 1 - Math.max(0, p.dashRecharge) / PLAYER.dash.cooldown, hex(COLORS.cyan));
  // 二重ダッシュ：残り回数を点で出す
  if (p.stats.dashCharges > 1) {
    for (let i = 0; i < p.stats.dashCharges; i++) {
      g.fillStyle(hex(i < p.dashCharges ? COLORS.cyan : COLORS.line), 1).fillRect(362 + i * 8, y + 13, 6, 3);
    }
  }
  cooldownBar(g, 516, y, 1 - Math.max(0, p.specialCd) / p.weapon.special.cooldown, hex(COLORS.amber));

  drawItemSlots(g, world);
}

// 消耗品の枠（画面左上、部屋の中）。位置は ITEM_SLOT_POS
export const ITEM_SLOT_POS = { x: 40, y: ROOM.wallTop + 8, size: 28, gap: 36 };

function drawItemSlots(g, world) {
  const p = world.player;
  const { x, y, size, gap } = ITEM_SLOT_POS;
  p.build.items.forEach((slot, i) => {
    const bx = x + i * gap;
    g.fillStyle(0x110f1d, 0.85).fillRect(bx, y, size, size);
    g.lineStyle(1, hex(slot ? COLORS.ink : COLORS.line), slot ? 0.8 : 1).strokeRect(bx, y, size, size);
    if (slot) {
      const def = DATA.consumables.get(slot.id);
      drawItemIcon(g, def.icon, bx + size / 2, y + size / 2 + 1, 8, hex(ELEMENT_COLORS[def.color] ?? COLORS[def.color] ?? COLORS.ink));
    }
  });
  // 効いている一時強化：残り時間の棒
  p.buffs.forEach((b, i) => {
    const by = y + size + 5 + i * 6;
    g.fillStyle(0x1b1631, 1).fillRect(x, by, 64, 3);
    g.fillStyle(hex(b.color), 1).fillRect(x, by, 64 * (b.t / b.max), 3);
  });
}

// 装備の一覧（画面右上）の横に出す、スロットのアイコン
// 身につけている装備のアイコンを、横に並べる（色はレア度。空のスロットは暗い色）
export function drawGearIcons(g, world, x, y, gap) {
  LOOT.slots.forEach((s, i) => {
    const item = world.player.build.gear[s.id];
    const color = item ? hex(RARITY_COLORS[LOOT.rarities[item.rarity].id]) : 0x4a4470;
    drawSlotIcon(g, s.id, x + i * gap, y, 6, color);
  });
}

function cooldownBar(g, x, y, ratio, color) {
  const w = 60;
  g.fillStyle(0x1b1631, 1).fillRect(x, y, w, 10);
  g.fillStyle(color, ratio >= 1 ? 1 : 0.45).fillRect(x, y, w * Math.min(1, ratio), 10);
  g.lineStyle(1, ratio >= 1 ? color : hex(COLORS.line), 1).strokeRect(x, y, w, 10);
}

// ---- ボス ----

function rotatedEllipse(x, y, rx, ry, rotation, steps = 28) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI * 2) / steps;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    pts.push({ x: x + ex * cos - ey * sin, y: y + ex * sin + ey * cos });
  }
  return pts;
}

// ボスから見た (前, 横) の位置を画面上の位置に直す
function local(b, forward, side) {
  const cos = Math.cos(b.angle);
  const sin = Math.sin(b.angle);
  return { x: b.x + forward * cos - side * sin, y: b.y + forward * sin + side * cos };
}

// 攻撃の予告。パターンの部品（src/game/bossPatterns.js）ごとに描き方を決める
const BOSS_TELEGRAPHS = {
  charge(g, b, act, world) {
    if (act.phase !== 'telegraph') return;
    const def = act.def;
    const len = def.speed * def.duration;
    const locked = act.t <= def.lockTime;
    const alpha = locked ? 0.55 : 0.2 + 0.2 * Math.abs(Math.sin(world.time * 16));
    g.lineStyle(b.r * 1.6, hex(COLORS.red), alpha);
    g.lineBetween(b.x, b.y, b.x + act.dirX * len, b.y + act.dirY * len);
  },
  shockwave(g, b, act) {
    if (act.phase !== 'telegraph') return;
    const k = 1 - act.t / act.def.telegraph;
    g.fillStyle(hex(COLORS.red), 0.14 + 0.16 * k).fillCircle(b.x, b.y, b.r + k * 70);
    g.lineStyle(2, hex(COLORS.red), 0.7).strokeCircle(b.x, b.y, b.r + 70);
  },
};

// 予告：扇形（冷気ブレス）、自分の周りの円（尻尾なぎ払い）
BOSS_TELEGRAPHS.cone = (g, b, act, world) => {
  const def = act.def;
  const angle = Math.atan2(act.dirY, act.dirX);
  const half = (def.arc * DEG) / 2;
  if (act.phase === 'telegraph') {
    const locked = act.t <= def.lockTime;
    g.fillStyle(hex(COLORS.red), locked ? 0.34 : 0.14 + 0.12 * Math.abs(Math.sin(world.time * 14)));
    g.slice(b.x, b.y, def.range, angle - half, angle + half, false).fillPath();
  } else if (act.phase === 'active') {
    g.fillStyle(hex(b.color), 0.24).slice(b.x, b.y, def.range, angle - half, angle + half, false).fillPath();
  }
};
BOSS_TELEGRAPHS.slam = (g, b, act) => {
  if (act.phase !== 'telegraph') return;
  const k = 1 - act.t / act.def.telegraph;
  g.fillStyle(hex(COLORS.red), 0.12 + 0.2 * k).fillCircle(b.x, b.y, act.def.radius);
  g.lineStyle(2, hex(COLORS.red), 0.8).strokeCircle(b.x, b.y, act.def.radius);
  g.lineStyle(2, hex(COLORS.red), 0.6).strokeCircle(b.x, b.y, act.def.radius * k);
};

// 予告：回転するレーザー、召喚、冷却
BOSS_TELEGRAPHS.laser = (g, b, act, world) => {
  const def = act.def;
  const x2 = b.x + act.dirX * def.range;
  const y2 = b.y + act.dirY * def.range;
  if (act.phase === 'telegraph') {
    // 細い線と、これから回っていく向きの矢印
    g.lineStyle(2, hex(COLORS.red), 0.5 + 0.4 * Math.abs(Math.sin(world.time * 18)));
    g.lineBetween(b.x, b.y, x2, y2);
    const ahead = act.angle + act.turnDir * 0.35;
    g.lineStyle(2, hex(COLORS.red), 0.35);
    g.lineBetween(b.x, b.y, b.x + Math.cos(ahead) * 220, b.y + Math.sin(ahead) * 220);
  } else if (act.phase === 'active') {
    const color = hex(b.color);
    g.lineStyle(def.width + 14, color, 0.2).lineBetween(b.x, b.y, x2, y2);
    g.lineStyle(def.width, color, 0.95).lineBetween(b.x, b.y, x2, y2);
    g.lineStyle(def.width * 0.35, WHITE, 0.9).lineBetween(b.x, b.y, x2, y2);
  }
};
BOSS_TELEGRAPHS.summon = (g, b, act, world) => {
  if (act.phase !== 'telegraph') return;
  g.lineStyle(2, hex(COLORS.cyan), 0.5 + 0.4 * Math.sin(world.time * 20)).strokeCircle(b.x, b.y, b.r + 50);
};
// 予告：弾のばらまき（撃つ向きの線）、跳びかかり（着地点）、線の攻撃・残る床（ボスの周りの合図）
BOSS_TELEGRAPHS.barrage = (g, b, act, world) => {
  if (act.phase !== 'telegraph') return;
  const def = act.def;
  const alpha = 0.3 + 0.3 * Math.abs(Math.sin(world.time * 16));
  g.lineStyle(2, hex(COLORS.red), alpha);
  const full = def.spread >= 360;
  for (let i = 0; i < def.count; i++) {
    const offset = full ? (i * 360) / def.count : def.count > 1 ? (i / (def.count - 1) - 0.5) * def.spread : 0;
    const a = act.base + offset * DEG;
    g.lineBetween(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, b.x + Math.cos(a) * (b.r + 150), b.y + Math.sin(a) * (b.r + 150));
  }
};
BOSS_TELEGRAPHS.leap = (g, b, act, world) => {
  if (act.phase !== 'telegraph' && act.phase !== 'air') return;
  const def = act.def;
  const locked = act.phase === 'air' || act.t <= def.lockTime;
  g.fillStyle(hex(COLORS.red), locked ? 0.3 : 0.12 + 0.1 * Math.abs(Math.sin(world.time * 14))).fillCircle(act.tx, act.ty, def.radius);
  g.lineStyle(2, hex(COLORS.red), 0.9).strokeCircle(act.tx, act.ty, def.radius);
  if (act.phase === 'air') g.lineStyle(2, hex(COLORS.red), 0.7).strokeCircle(act.tx, act.ty, def.radius * (1 - Math.max(0, act.t) / def.air));
};
BOSS_TELEGRAPHS.lines = (g, b, act, world) => {
  if (act.phase !== 'telegraph') return;
  const k = 1 - act.t / act.def.telegraph;
  g.lineStyle(3, hex(COLORS.red), 0.4 + 0.5 * Math.abs(Math.sin(world.time * 20)));
  g.lineBetween(b.x - b.r - 26 * k, b.y - b.r - 26 * k, b.x + b.r + 26 * k, b.y + b.r + 26 * k);
  g.lineBetween(b.x - b.r - 26 * k, b.y + b.r + 26 * k, b.x + b.r + 26 * k, b.y - b.r - 26 * k);
};
BOSS_TELEGRAPHS.pools = (g, b, act, world) => {
  if (act.phase !== 'telegraph') return;
  const k = 1 - act.t / act.def.telegraph;
  g.lineStyle(3, hex(b.color), 0.4 + 0.5 * Math.abs(Math.sin(world.time * 18))).strokeCircle(b.x, b.y, b.r + 10 + 26 * k);
};
// 予告：潜行（潜っている間、飛び出す場所の円。向きが固定されると濃くなる）
BOSS_TELEGRAPHS.burrow = (g, b, act, world) => {
  if (act.phase !== 'under') return;
  const def = act.def;
  const locked = act.t <= def.lockTime;
  const k = 1 - Math.max(0, act.t) / def.under;
  g.fillStyle(hex(COLORS.red), locked ? 0.32 : 0.1 + 0.1 * Math.abs(Math.sin(world.time * 14))).fillCircle(act.tx, act.ty, def.radius);
  g.lineStyle(2, hex(COLORS.red), 0.9).strokeCircle(act.tx, act.ty, def.radius);
  g.lineStyle(2, hex(b.color), 0.9).strokeCircle(act.tx, act.ty, def.radius * k);
  // 地面の下を動いているしるし（ひび）
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + world.time * 0.8;
    g.lineStyle(2, hex(b.color), 0.5).lineBetween(act.tx + Math.cos(a) * 8, act.ty + Math.sin(a) * 8, act.tx + Math.cos(a) * def.radius * 0.6, act.ty + Math.sin(a + 0.3) * def.radius * 0.6);
  }
};
BOSS_TELEGRAPHS.vent = (g, b, act) => {
  // 冷却中：残り時間が輪で分かる
  const k = Math.max(0, act.t / act.def.duration);
  g.lineStyle(4, hex(COLORS.cyan), 0.9);
  arcPath(g, b.x, b.y, b.r + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
};

// オーバーロード：六角形の外殻と、回る内側の輪、中心の核
SHAPES.core = (g, b, color, world) => {
  const r = b.r;
  const venting = b.act?.phase === 'stun';
  const c = venting ? hex(COLORS.dim) : color;
  const outer = polygon(b.x, b.y, r * 1.1, 6, Math.PI / 6);
  g.fillStyle(BODY_FILL, 0.92).fillPoints(outer, true);
  neonStroke(g, c, 3, () => g.strokePoints(outer, true, true));
  const inner = polygon(b.x, b.y, r * 0.68, 3, world.time * (venting ? 0.3 : 1.8));
  neonStroke(g, c, 2.5, () => g.strokePoints(inner, true, true));
  const inner2 = polygon(b.x, b.y, r * 0.68, 3, -world.time * (venting ? 0.3 : 1.8) + Math.PI);
  neonStroke(g, c, 2.5, () => g.strokePoints(inner2, true, true));
  g.fillStyle(venting ? hex(COLORS.cyan) : hex(COLORS.red), 1).fillCircle(b.x, b.y, 7);
  // 砲口（向いている方向）
  if (!venting) {
    const m = local(b, r * 1.25, 0);
    g.fillStyle(c, 1).fillCircle(m.x, m.y, 5);
  }
};

// クライオ・ワイバーン：菱形の胴体に翼と尾
SHAPES.wyvern = (g, b, color, world) => {
  const r = b.r;
  const flap = Math.sin(world.time * 6) * r * 0.25;
  const body = [local(b, r * 1.25, 0), local(b, 0, r * 0.5), local(b, -r * 0.9, 0), local(b, 0, -r * 0.5)];
  for (const side of [-1, 1]) {
    const wing = [local(b, r * 0.3, side * r * 0.4), local(b, -r * 0.2, side * (r * 1.7 + flap)), local(b, -r * 0.7, side * r * 0.5)];
    g.fillStyle(BODY_FILL, 0.8).fillPoints(wing, true);
    neonStroke(g, color, 2.5, () => g.strokePoints(wing, true, true));
  }
  g.fillStyle(BODY_FILL, 0.9).fillPoints(body, true);
  neonStroke(g, color, 3, () => g.strokePoints(body, true, true));
  // 尾
  const tailA = local(b, -r * 0.9, 0);
  const tailB = local(b, -r * 1.8, Math.sin(world.time * 4) * r * 0.4);
  neonStroke(g, color, 3, () => g.lineBetween(tailA.x, tailA.y, tailB.x, tailB.y));
  // 目
  for (const side of [-1, 1]) {
    const eye = local(b, r * 0.7, side * r * 0.16);
    g.fillStyle(hex(COLORS.red), 1).fillCircle(eye.x, eye.y, 3);
  }
};

// パイプサーペント：頭と、あとをついてくる胴の節（配管の継ぎ目）。潜っていくときは小さくなる
SHAPES.serpent = (g, b, color) => {
  if (b.hidden) {
    b.trail = null;
    return;
  }
  const diving = b.act?.def.pattern === 'burrow' && b.act.phase === 'dive';
  const sink = diving ? b.act.sink ?? 0 : 0;
  const scale = 1 - 0.7 * sink;
  const r = b.r * scale;
  // 頭の通ったあとを覚えておき、等間隔に節を並べる（見た目だけ）
  const trail = (b.trail ??= []);
  const last = trail[0];
  if (!last || Math.hypot(last.x - b.x, last.y - b.y) > 6) trail.unshift({ x: b.x, y: b.y });
  if (last && Math.hypot(last.x - b.x, last.y - b.y) > 200) trail.length = 1; // 潜って離れた場所に出たとき
  if (trail.length > 60) trail.length = 60;
  const segments = 7;
  for (let i = segments; i >= 1; i--) {
    const at = trail[Math.min(trail.length - 1, i * 6)];
    if (!at) continue;
    const sr = r * (0.82 - i * 0.07);
    g.fillStyle(BODY_FILL, 0.9).fillCircle(at.x, at.y, sr);
    neonStroke(g, color, 2.5, () => g.strokeCircle(at.x, at.y, sr));
    g.lineStyle(1.5, color, 0.5).strokeCircle(at.x, at.y, sr * 0.55);
  }
  // 頭
  const head = rotatedEllipse(b.x, b.y, r * 1.15, r * 0.9, b.angle);
  g.fillStyle(BODY_FILL, 0.92).fillPoints(head, true);
  neonStroke(g, color, 3, () => g.strokePoints(head, true, true));
  // 口（配管の開いた口）と牙
  const mouthA = local({ ...b, r }, r * 0.95, -r * 0.45);
  const mouthB = local({ ...b, r }, r * 0.95, r * 0.45);
  neonStroke(g, color, 4, () => g.lineBetween(mouthA.x, mouthA.y, mouthB.x, mouthB.y));
  for (const side of [-1, 1]) {
    const from = local(b, r * 0.95, side * r * 0.3);
    const to = local(b, r * 1.45, side * r * 0.15);
    neonStroke(g, color, 2.5, () => g.lineBetween(from.x, from.y, to.x, to.y));
  }
  // 目。壁に当たって止まっている間は消える
  if (b.act?.phase !== 'stun') {
    for (const side of [-1, 1]) {
      const eye = local(b, r * 0.35, side * r * 0.5);
      g.fillStyle(hex(COLORS.red), 1).fillCircle(eye.x, eye.y, 3.5 * scale);
    }
  }
};

// タンククラブ：横に広い胴、背負ったタンク、左右のはさみ、正面の甲羅（太い弧。開いている間は暗い）
SHAPES.crab = (g, b, color, world) => {
  const r = b.r;
  const at = (forward, side) => local(b, forward, side);
  // 脚（左右に3本ずつ）
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const from = at(i * r * 0.45, side * r * 0.9);
      const swing = Math.sin(world.time * 8 + i * 1.5) * r * 0.08;
      const to = at(i * r * 0.6 + swing, side * r * 1.5);
      g.lineStyle(3, color, 0.8).lineBetween(from.x, from.y, to.x, to.y);
    }
  }
  // 胴（横に広い）
  const body = rotatedEllipse(b.x, b.y, r * 0.85, r * 1.15, b.angle);
  g.fillStyle(BODY_FILL, 0.92).fillPoints(body, true);
  neonStroke(g, color, 3, () => g.strokePoints(body, true, true));
  // 背負ったタンク（後ろ寄りの丸と、帯）
  const tank = at(-r * 0.25, 0);
  g.fillStyle(BODY_FILL, 0.95).fillCircle(tank.x, tank.y, r * 0.62);
  neonStroke(g, color, 2.5, () => g.strokeCircle(tank.x, tank.y, r * 0.62));
  g.lineStyle(1.5, color, 0.6).strokeCircle(tank.x, tank.y, r * 0.38);
  // はさみ
  for (const side of [-1, 1]) {
    const arm = at(r * 0.7, side * r * 0.75);
    const claw = at(r * 1.35, side * r * 0.6);
    neonStroke(g, color, 4, () => g.lineBetween(arm.x, arm.y, claw.x, claw.y));
    const tipA = at(r * 1.75, side * r * 0.8);
    const tipB = at(r * 1.75, side * r * 0.35);
    neonStroke(g, color, 3, () => g.lineBetween(claw.x, claw.y, tipA.x, tipA.y).lineBetween(claw.x, claw.y, tipB.x, tipB.y));
  }
  // 目
  for (const side of [-1, 1]) {
    const eye = at(r * 0.72, side * r * 0.25);
    g.fillStyle(hex(COLORS.red), 1).fillCircle(eye.x, eye.y, 3.5);
  }
  // 甲羅：正面の弧。防いでいる間は白く、開いている間・割れたあとは暗い
  if (b.def.shield) {
    const half = (b.def.shield.arc * DEG) / 2;
    const open = b.shieldOpen;
    const broken = b.def.phases[b.phaseIndex]?.noShield;
    if (!broken) {
      g.lineStyle(12, open ? hex(COLORS.dim) : WHITE, open ? 0.15 : 0.2);
      arcPath(g, b.x, b.y, r + 14, b.angle - half, b.angle + half);
      g.lineStyle(5, open ? hex(COLORS.dim) : WHITE, open ? 0.45 : 1);
      arcPath(g, b.x, b.y, r + 14, b.angle - half, b.angle + half);
    }
  }
};

// スラッジハイドラ：ゆらゆら形の変わる大きな汚泥の体と、中の制御機。首が残っている間は、体のまわりに膜が出る
SHAPES.hydra = (g, b, color, world) => {
  const r = b.r;
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI * 2) / 18;
    const rr = r * (1.08 + 0.1 * Math.sin(world.time * 3 + i * 1.3) + 0.05 * Math.sin(world.time * 5.3 + i * 2.1));
    pts.push({ x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr });
  }
  g.fillStyle(BODY_FILL, 0.92).fillPoints(pts, true);
  neonStroke(g, color, 3, () => g.strokePoints(pts, true, true));
  // 中に沈んだ制御機（四角い箱と、点滅する表示）
  const box = polygon(b.x, b.y, r * 0.5, 4, Math.PI / 4 + Math.sin(world.time) * 0.1);
  g.lineStyle(2, color, 0.7).strokePoints(box, true, true);
  g.fillStyle(hex(COLORS.red), 0.5 + 0.5 * Math.abs(Math.sin(world.time * 4))).fillCircle(b.x, b.y, 4);
  // 泡
  for (let i = 0; i < 4; i++) {
    const a = world.time * 0.7 + i * 1.6;
    g.lineStyle(1.5, color, 0.5).strokeCircle(b.x + Math.cos(a) * r * 0.6, b.y + Math.sin(a * 1.3) * r * 0.6, 3 + (i % 2) * 2);
  }
  // 首が残っている間は硬い：体のまわりに膜
  if (b.armor > 0) {
    g.lineStyle(3, WHITE, 0.25 + 0.15 * Math.sin(world.time * 6)).strokeCircle(b.x, b.y, r * 1.28);
  }
};

SHAPES.boar = (g, b, color) => {
  const r = b.r;
  const stunned = b.act?.phase === 'stun';
  const body = rotatedEllipse(b.x, b.y, r * 1.15, r * 0.85, b.angle);
  g.fillStyle(BODY_FILL, 0.9).fillPoints(body, true);
  neonStroke(g, color, 3, () => g.strokePoints(body, true, true));
  // 牙
  for (const side of [-1, 1]) {
    const from = local(b, r * 0.9, side * r * 0.4);
    const to = local(b, r * 1.55, side * r * 0.7);
    neonStroke(g, color, 3, () => g.lineBetween(from.x, from.y, to.x, to.y));
  }
  // 背中の電線
  const spineA = local(b, -r * 0.9, 0);
  const spineB = local(b, r * 0.3, 0);
  g.lineStyle(2, color, 0.6).lineBetween(spineA.x, spineA.y, spineB.x, spineB.y);
  // 目。スタン中は消える
  if (!stunned) {
    for (const side of [-1, 1]) {
      const eye = local(b, r * 0.6, side * r * 0.3);
      g.fillStyle(hex(COLORS.red), 1).fillCircle(eye.x, eye.y, 3.5);
    }
  }
};

export function drawBossTelegraph(g, world) {
  const b = world.boss;
  if (!b || b.dead || b.spawnT > 0 || !b.act) return;
  BOSS_TELEGRAPHS[b.act.def.pattern]?.(g, b, b.act, world);
}

export function drawHazards(g, world) {
  for (const h of world.hazards) {
    if (h.type === 'ring') {
      const color = hex(h.color);
      const fade = Math.min(1, (h.max - h.r) / 60);
      g.lineStyle(h.width + 10, color, 0.18 * fade).strokeCircle(h.x, h.y, h.r);
      g.lineStyle(h.width * 0.45, color, fade).strokeCircle(h.x, h.y, h.r);
    } else if (h.type === 'mark') {
      // 落下地点：外の輪に向かって内側の輪が広がり、重なった瞬間に落ちる
      const k = 1 - h.t / h.max;
      g.fillStyle(hex(COLORS.red), 0.1 + 0.2 * k).fillCircle(h.x, h.y, h.r);
      g.lineStyle(2, hex(COLORS.red), 0.9).strokeCircle(h.x, h.y, h.r);
      g.lineStyle(2, hex(h.color), 0.9).strokeCircle(h.x, h.y, h.r * k);
    } else if (h.type === 'bar') {
      const dx = Math.cos(h.angle) * ROOM.barLength;
      const dy = Math.sin(h.angle) * ROOM.barLength;
      if (h.flash > 0) {
        // 光った瞬間
        const color = hex(h.color);
        g.lineStyle(h.width + 14, color, 0.25).lineBetween(h.x - dx, h.y - dy, h.x + dx, h.y + dy);
        g.lineStyle(h.width, color, 0.95).lineBetween(h.x - dx, h.y - dy, h.x + dx, h.y + dy);
        g.lineStyle(h.width * 0.35, WHITE, 0.9).lineBetween(h.x - dx, h.y - dy, h.x + dx, h.y + dy);
      } else {
        // 予告：当たる幅の帯が、時間とともに濃くなる
        const k = 1 - h.t / h.max;
        g.lineStyle(h.width, hex(COLORS.red), 0.08 + 0.22 * k).lineBetween(h.x - dx, h.y - dy, h.x + dx, h.y + dy);
        g.lineStyle(1.5, hex(COLORS.red), 0.5 + 0.4 * k).lineBetween(h.x - dx, h.y - dy, h.x + dx, h.y + dy);
      }
    } else if (h.type === 'pool') {
      const color = hex(h.color);
      if (h.arm > 0) {
        // 効き始める前：輪が広がっていく
        const k = 1 - h.arm / h.armMax;
        g.fillStyle(hex(COLORS.red), 0.08 + 0.12 * k).fillCircle(h.x, h.y, h.r);
        g.lineStyle(2, hex(COLORS.red), 0.8).strokeCircle(h.x, h.y, h.r);
        g.lineStyle(2, color, 0.9).strokeCircle(h.x, h.y, h.r * k);
      } else {
        const fade = Math.min(1, h.life / 0.6);
        g.fillStyle(color, 0.22 * fade).fillCircle(h.x, h.y, h.r);
        g.lineStyle(2, color, 0.8 * fade).strokeCircle(h.x, h.y, h.r * (0.9 + 0.1 * Math.sin(world.time * 8 + h.x)));
      }
    }
  }
}

// 凍りついて狭まった部屋：使えなくなった端を氷の色で塗る
export function drawArena(g, world) {
  const a = world.arena;
  if (!a || a.inset <= 0) return;
  const b = world.bounds;
  const base = a.base;
  const ice = hex(ELEMENT_COLORS.cold);
  g.fillStyle(ice, 0.2);
  g.fillRect(base.left, base.top, base.right - base.left, a.inset);
  g.fillRect(base.left, b.bottom, base.right - base.left, a.inset);
  g.fillRect(base.left, b.top, a.inset, b.bottom - b.top);
  g.fillRect(b.right, b.top, a.inset, b.bottom - b.top);
  g.lineStyle(2, ice, 0.9).strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
}

export function drawBossBar(g, world) {
  const b = world.boss;
  if (!b || b.spawnT > 0) return;
  const w = 420;
  const x = (SCREEN.width - w) / 2;
  const y = SCREEN.height - ROOM.wall - 22;
  const ratio = Math.max(0, b.hp) / b.maxHp;
  g.fillStyle(0x1b1631, 0.9).fillRect(x, y, w, 8);
  g.fillStyle(hex(b.color), 1).fillRect(x, y, w * ratio, 8);
  g.lineStyle(1, hex(COLORS.line), 1).strokeRect(x, y, w, 8);
  // 段階が切り替わるHPの目印
  for (const ph of b.def.phases) {
    if (ph.hpAbove > 0) g.lineStyle(2, hex(COLORS.ink), 0.8).lineBetween(x + w * ph.hpAbove, y - 3, x + w * ph.hpAbove, y + 11);
  }
}

// ---- 装備とインプラントの効果 ----

export function drawLoot(g, world) {
  for (const l of world.loot) {
    const color = hex(RARITY_COLORS[LOOT.rarities[l.item.rarity].id]);
    const bob = Math.sin(world.time * 4 + l.x) * 3;
    const focused = l === world.focusLoot;
    // エピック以上は光の柱で目立たせる
    if (l.item.rarity >= 2) g.fillStyle(color, 0.22).fillRect(l.x - 2, l.y - 64, 4, 64);
    // スロットごとの形（武器モッド＝刃、防具＝盾、アクセ＝指輪）。色はレア度
    drawSlotIcon(g, l.item.slot, l.x, l.y + bob, focused ? 13 : 11, color);
    if (focused) g.lineStyle(1, color, 0.5).strokeCircle(l.x, l.y, LOOT.pickupRadius * 0.7);
  }
}

export function drawZones(g, world) {
  for (const z of world.zones) {
    const k = Math.min(1, z.life / 0.5);
    const color = hex(z.color);
    g.fillStyle(color, 0.16 * k).fillCircle(z.x, z.y, z.r);
    g.lineStyle(1.5, color, 0.6 * k).strokeCircle(z.x, z.y, z.r * (0.85 + 0.15 * Math.sin(world.time * 10 + z.x)));
  }
}

// 連鎖放電などの稲妻。毎フレーム形を変えてバチバチさせる
// スナイパーの一撃などの、一瞬の光線
export function drawBeams(g, world) {
  for (const b of world.fx.beams) {
    const k = b.life / b.max;
    const color = hex(b.color);
    g.lineStyle(b.width + 10, color, 0.25 * k).lineBetween(b.x1, b.y1, b.x2, b.y2);
    g.lineStyle(b.width * k, WHITE, k).lineBetween(b.x1, b.y1, b.x2, b.y2);
  }
}

export function drawBolts(g, world) {
  const color = hex(ELEMENT_COLORS.shock);
  for (const b of world.fx.bolts) {
    const pts = [{ x: b.x1, y: b.y1 }];
    for (let i = 1; i < 5; i++) {
      const k = i / 5;
      pts.push({ x: b.x1 + (b.x2 - b.x1) * k + (Math.random() - 0.5) * 18, y: b.y1 + (b.y2 - b.y1) * k + (Math.random() - 0.5) * 18 });
    }
    pts.push({ x: b.x2, y: b.y2 });
    neonStroke(g, color, 2, () => g.strokePoints(pts, false, false));
  }
}
