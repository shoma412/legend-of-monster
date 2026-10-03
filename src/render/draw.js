// 戦闘画面の描画。world の状態を読んで、毎フレーム Graphics にネオン線画を描き直す。
import { LOOT, PLAYER, ROOM, SCREEN } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS, RARITY_COLORS, hex } from '../data/theme.js';
import { xpToNext } from '../logic/level.js';
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

export function drawFloor(g) {
  const { width: W, height: H } = SCREEN;
  const wall = ROOM.wall;
  g.fillStyle(0x0b0914, 1).fillRect(0, 0, W, H);
  g.lineStyle(1, 0x785aff, 0.1);
  for (let x = wall; x < W; x += 40) g.lineBetween(x, 0, x, H);
  for (let y = wall; y < H; y += 40) g.lineBetween(0, y, W, y);
  g.fillStyle(0x16122a, 1);
  g.fillRect(0, 0, W, wall).fillRect(0, H - wall, W, wall).fillRect(0, 0, wall, H).fillRect(W - wall, 0, wall, H);
  neonStroke(g, hex(COLORS.magenta), 2, () => g.strokeRect(wall, wall, W - wall * 2, H - wall * 2));
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
  if (e.def.behavior === 'brawler' && e.state === 'windup') {
    // 殴る範囲の予告。構えが進むほど濃くなる
    const atk = e.def.attack;
    const k = 1 - e.t / atk.windup;
    g.fillStyle(red, 0.18 + 0.3 * k);
    g.slice(e.x, e.y, atk.range, e.angle - (atk.arc * DEG) / 2, e.angle + (atk.arc * DEG) / 2, false).fillPath();
  }
  if (e.def.behavior === 'brawler' && e.swingT > 0) {
    const atk = e.def.attack;
    g.lineStyle(6, hex(e.color), e.swingT / 0.15);
    arcPath(g, e.x, e.y, atk.range * 0.85, e.angle - (atk.arc * DEG) / 2, e.angle + (atk.arc * DEG) / 2);
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
    if (!e.boss && e.hp < e.maxHp) {
      g.fillStyle(hex(COLORS.line), 1).fillRect(e.x - 14, e.y - e.r - 11, 28, 3);
      g.fillStyle(color, 1).fillRect(e.x - 14, e.y - e.r - 11, (28 * Math.max(0, e.hp)) / e.maxHp, 3);
    }
  }
}

export function drawShots(g, world) {
  const color = hex(COLORS.amber);
  for (const s of world.shots) {
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

  // 振りかぶり中は剣を後ろに引いて見せる
  if (a && a.phase === 'windup') {
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
  const x = 62;
  const y = 9;
  const w = 180;
  // HP
  g.fillStyle(0x1b1631, 1).fillRect(x, y, w, 10);
  const ratio = p.hp / p.stats.maxHp;
  g.fillStyle(hex(ratio > 0.3 ? COLORS.green : COLORS.red), 1).fillRect(x, y, w * ratio, 10);
  g.lineStyle(1, hex(COLORS.line), 1).strokeRect(x, y, w, 10);

  // ダッシュと特殊攻撃のクールダウン
  cooldownBar(g, 362, y, 1 - Math.max(0, p.dashCd) / PLAYER.dash.cooldown, hex(COLORS.cyan));
  cooldownBar(g, 500, y, 1 - Math.max(0, p.specialCd) / p.weapon.special.cooldown, hex(COLORS.amber));

  // 経験値（HPバーの下の細い線）
  const xpRatio = Math.min(1, p.build.xp / xpToNext(p.build.level));
  g.fillStyle(0x1b1631, 1).fillRect(x, y + 13, w, 3);
  g.fillStyle(hex(COLORS.magenta), 1).fillRect(x, y + 13, w * xpRatio, 3);
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
    }
  }
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
    const pts = polygon(l.x, l.y + bob, focused ? 12 : 10, 4, 0);
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    neonStroke(g, color, focused ? 3 : 2, () => g.strokePoints(pts, true, true));
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
