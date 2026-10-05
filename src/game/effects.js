// 効果の仕組み。装備効果・レジェンド固有効果・インプラント・種族ボーナスを同じやり方で処理する。
//   条件つきのステータス補正 … CONDITIONS
//   イベントで発動する効果   … ACTIONS
// 新しい効果を足すときは、ここに部品を1つ足して、データ（src/data/）から名前で呼ぶ。
import { STATUS } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { applyBurn, applySlow, applyStop, effectDamage } from './combat.js';
import { burst, ring } from './fx.js';

// 条件つき補正（mods の when）
const CONDITIONS = {
  hpBelowHalf: (world) => world.player.hp <= world.player.stats.maxHp * 0.5,
  hpFull: (world) => world.player.hp >= world.player.stats.maxHp,
  recentDash: (world, mod) => world.player.sinceDash <= (mod.window ?? 2),
  targetSlowed: (world, mod, target) => !!target && (target.slowT > 0 || target.stopT > 0),
  targetBurning: (world, mod, target) => !!target && target.burnT > 0,
  standing: (world) => world.player.stillT >= 0.25, // 少しの間、動いていない
  moving: (world) => world.player.stillT <= 0,
  targetWeak: (world, mod, target) => !!target && target.hp <= target.maxHp * 0.5,
  recentKill: (world, mod) => world.player.sinceKill <= (mod.window ?? 3),
  recentHurt: (world, mod) => world.player.sinceHurt <= (mod.window ?? 2),
};

// 条件つき補正も含めた、今のステータスの値。target は攻撃する相手（相手による条件があるとき）
export function statWith(world, stat, target = null) {
  const stats = world.player.stats;
  let value = stats[stat];
  for (const mod of stats.conditional) {
    if (mod.stat === stat && CONDITIONS[mod.when](world, mod, target)) value += mod.add;
  }
  // 消耗品による一時的な強化
  for (const buff of world.player.buffs) {
    if (buff.stat === stat) value += buff.add;
  }
  return value;
}

// 相手の状態による発動条件（triggers の ifTarget）
const TARGET_CHECKS = {
  slowed: (e) => e.slowT > 0 || e.stopT > 0,
  burning: (e) => e.burnT > 0,
};

function liveEnemies(world) {
  return world.enemies.filter((e) => !e.dead && e.spawnT <= 0);
}

function enemiesNear(world, x, y, radius, except = null) {
  return liveEnemies(world).filter((e) => e !== except && Math.hypot(e.x - x, e.y - y) <= radius + e.r);
}

// イベントで発動する効果の部品。t はデータに書いた trigger、ctx はイベントの内容
const ACTIONS = {
  // 次の攻撃が必ず会心になる
  guaranteeNextCrit(world) {
    world.player.forceCrit = true;
  },

  // 倒した敵から近くの敵へ電撃が飛ぶ
  chainLightning(world, t, ctx) {
    const from = ctx.target;
    const count = t.count + world.player.stats.chainBonus;
    const targets = enemiesNear(world, from.x, from.y, t.range, from)
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))
      .slice(0, count);
    for (const e of targets) {
      world.fx.bolts.push({ x1: from.x, y1: from.y, x2: e.x, y2: e.y, life: 0.18, max: 0.18 });
      effectDamage(world, e, t.damage, 'shock');
    }
  },

  // 相手を少しの間止める
  stun(world, t, ctx) {
    applyStop(ctx.target, t.duration);
  },

  // ダッシュで通り抜けた敵にダメージ（1回のダッシュで1体につき1回）
  dashDamage(world, t, ctx) {
    const p = world.player;
    for (const e of enemiesNear(world, p.x, p.y, t.radius)) {
      if (ctx.dash.hit.has(e)) continue;
      ctx.dash.hit.add(e);
      world.fx.bolts.push({ x1: p.x, y1: p.y, x2: e.x, y2: e.y, life: 0.15, max: 0.15 });
      effectDamage(world, e, t.damage, t.element);
    }
  },

  // ダッシュの通り道にダメージ床を残す
  damageFloor(world, t, ctx) {
    const p = world.player;
    const last = ctx.dash.lastFloor;
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < t.radius) return;
    ctx.dash.lastFloor = { x: p.x, y: p.y };
    world.zones.push({ x: p.x, y: p.y, r: t.radius, life: t.duration, max: t.duration, damage: t.damage, tick: t.tick, acc: 0, color: COLORS.magenta });
  },

  // 倒した敵の周りを凍らせる
  freezeNearby(world, t, ctx) {
    const from = ctx.target;
    ring(world, from.x, from.y, t.radius, ELEMENT_COLORS.cold);
    for (const e of enemiesNear(world, from.x, from.y, t.radius, from)) {
      applySlow(e, world.player.stats.slowMul);
      applyStop(e, STATUS.freeze.duration);
    }
  },

  // 倒した敵が爆発する
  explode(world, t, ctx) {
    const from = ctx.target;
    const color = ELEMENT_COLORS[t.element] ?? COLORS.amber;
    ring(world, from.x, from.y, t.radius, color);
    burst(world, from.x, from.y, color, 16, 260);
    for (const e of enemiesNear(world, from.x, from.y, t.radius, from)) effectDamage(world, e, t.damage, t.element);
  },

  // プレイヤーの周りの敵を減速させる
  slowNearby(world, t) {
    const p = world.player;
    ring(world, p.x, p.y, t.radius, ELEMENT_COLORS.cold);
    for (const e of enemiesNear(world, p.x, p.y, t.radius)) applySlow(e, world.player.stats.slowMul);
  },

  // プレイヤーの周りの敵に電撃
  shockNearby(world, t) {
    const p = world.player;
    ring(world, p.x, p.y, t.radius, ELEMENT_COLORS.shock);
    for (const e of enemiesNear(world, p.x, p.y, t.radius)) {
      world.fx.bolts.push({ x1: p.x, y1: p.y, x2: e.x, y2: e.y, life: 0.18, max: 0.18 });
      effectDamage(world, e, t.damage, 'shock');
    }
  },

  // プレイヤーの周りの敵にダメージ（属性なし）
  thorns(world, t) {
    const p = world.player;
    ring(world, p.x, p.y, t.radius, COLORS.amber);
    for (const e of enemiesNear(world, p.x, p.y, t.radius)) effectDamage(world, e, t.damage);
  },

  // プレイヤーの周りの敵を燃やす
  burnNearby(world, t) {
    const p = world.player;
    ring(world, p.x, p.y, t.radius, ELEMENT_COLORS.heat);
    for (const e of enemiesNear(world, p.x, p.y, t.radius)) applyBurn(e);
  },

  // ダッシュで通り抜けた敵を減速させる
  dashSlow(world, t) {
    const p = world.player;
    for (const e of enemiesNear(world, p.x, p.y, t.radius)) applySlow(e, world.player.stats.slowMul);
  },
};

export function fire(world, event, ctx = {}) {
  const list = world.player.stats.triggers[event];
  if (!list) return;
  for (const t of list) {
    if (t.ifElement && !ctx.elements?.includes(t.ifElement)) continue;
    if (t.ifTarget && !(ctx.target && TARGET_CHECKS[t.ifTarget](ctx.target))) continue;
    if (t.chance != null && world.rng() >= t.chance) continue;
    ACTIONS[t.do](world, t, ctx);
  }
}

export function hasAction(name) {
  return name in ACTIONS;
}

export function hasCondition(name) {
  return name in CONDITIONS;
}

// ダメージ床など、その場に残る効果
export function updateZones(world, dt) {
  for (const z of world.zones) {
    z.life -= dt;
    z.acc += dt;
    while (z.acc >= z.tick) {
      z.acc -= z.tick;
      for (const e of enemiesNear(world, z.x, z.y, z.r)) effectDamage(world, e, z.damage);
    }
  }
  world.zones = world.zones.filter((z) => z.life > 0);
}
