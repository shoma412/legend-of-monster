// 設置物（地雷・小型タレット）。種族「蜘蛛」のインプラントで置けるようになる。
// 部屋ごとに置き直しになる（world.devices に入り、部屋を出ると消える）。
import { DEVICE } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { effectDamage } from './combat.js';
import { burst, ring, sfx } from './fx.js';

function targets(world) {
  return world.enemies.filter((e) => !e.dead && e.spawnT <= 0 && !e.hidden && !e.def.prop);
}

// 同じ種類の設置物は、置ける数まで。超えたら古いものから消える
function limit(world, type) {
  const max = Math.max(1, Math.round(world.player.stats.deviceCount));
  const same = world.devices.filter((d) => d.type === type && !d.dead);
  while (same.length > max) same.shift().dead = true;
}

export function placeMine(world, x, y) {
  const m = DEVICE.mine;
  world.devices.push({ type: 'mine', x, y, r: m.trigger, blast: m.blast, arm: m.arm, damage: world.player.stats.mineDamage });
  limit(world, 'mine');
}

export function placeSentry(world, x, y) {
  const s = DEVICE.sentry;
  world.devices.push({ type: 'sentry', x, y, life: s.life, max: s.life, cd: 0.3, range: s.range, damage: world.player.stats.sentryDamage });
  limit(world, 'sentry');
  sfx(world, 'equip');
}

export function updateDevices(world, dt) {
  const p = world.player;
  const stats = p.stats;
  // 小型タレット：一定の間隔で、足元に置く
  if (stats.sentryDamage > 0) {
    p.sentryT = (p.sentryT ?? DEVICE.sentry.first) - dt;
    if (p.sentryT <= 0) {
      p.sentryT = DEVICE.sentry.interval;
      placeSentry(world, p.x, p.y);
    }
  }
  const mul = stats.deviceMul;
  for (const d of world.devices) {
    if (d.dead) continue;
    if (d.type === 'mine') {
      d.arm -= dt;
      if (d.arm > 0) continue;
      // 敵が触れたら爆発する
      const live = targets(world);
      if (!live.some((e) => Math.hypot(e.x - d.x, e.y - d.y) <= d.r + e.r)) continue;
      for (const e of live) if (Math.hypot(e.x - d.x, e.y - d.y) <= d.blast + e.r) effectDamage(world, e, d.damage * mul);
      ring(world, d.x, d.y, d.blast, COLORS.amber);
      burst(world, d.x, d.y, COLORS.amber, 22, 280);
      sfx(world, 'explode');
      d.dead = true;
    } else if (d.type === 'sentry') {
      d.life -= dt;
      d.cd -= dt;
      if (d.life <= 0) {
        d.dead = true;
        continue;
      }
      if (d.cd > 0) continue;
      // いちばん近い敵を撃つ
      let best = null;
      let bestDist = d.range;
      for (const e of targets(world)) {
        const dist = Math.hypot(e.x - d.x, e.y - d.y);
        if (dist <= bestDist) {
          best = e;
          bestDist = dist;
        }
      }
      if (!best) continue;
      d.cd = DEVICE.sentry.rate;
      d.aim = Math.atan2(best.y - d.y, best.x - d.x);
      world.fx.bolts.push({ x1: d.x, y1: d.y, x2: best.x, y2: best.y, life: 0.1, max: 0.1 });
      effectDamage(world, best, d.damage * mul);
    }
  }
  world.devices = world.devices.filter((d) => !d.dead);
}
