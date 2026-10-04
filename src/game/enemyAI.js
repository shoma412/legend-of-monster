// 雑魚敵の動き方の部品。敵の定義（src/data/enemies.js）の behavior で選ぶ。
import { COMBAT, STATUS } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { DEG, arcHitsCircle, circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { updateBoss } from './boss.js';
import { damageEnemy, enemySpeedFactor, hurtPlayer, slowPlayer } from './combat.js';
import { updateEliteTrait } from './elite.js';
import { addShake, burst, ring } from './fx.js';

// scale: エリアが進んだぶんの、HPと攻撃力の倍率
export function createEnemy(def, x, y, spawnT, rng, scale = 1) {
  if (scale !== 1) def = { ...def, hp: Math.round(def.hp * scale), damage: Math.round(def.damage * scale) };
  return {
    def,
    x,
    y,
    r: def.radius,
    hp: def.hp,
    maxHp: def.hp,
    color: COLORS[def.color] ?? ELEMENT_COLORS[def.color] ?? COLORS.ink,
    vx: 0, // 吹き飛び
    vy: 0,
    hit: 0, // 白く光る残り時間
    stagger: 0, // ひるみの残り時間
    burnT: 0, // 燃焼の残り時間
    burnAcc: 0,
    slowT: 0, // 減速の残り時間
    stopT: 0, // 凍結・停止の残り時間
    spawnT, // 出現予告の残り時間。0 になるまで動かず、攻撃も当たらない
    state: 'chase',
    t: 0,
    cd: rng() * 1.2,
    angle: 0, // 構えている向き
    seed: rng() * 10,
    dead: false,
  };
}

// d: { dx, dy, dist } プレイヤーへの向きと距離
const BEHAVIORS = {
  swarm(world, e, dt, d) {
    const wob = Math.sin(world.time * 5 + e.seed) * (e.def.wobble ?? 0);
    const ax = d.dx / d.dist - (d.dy / d.dist) * wob;
    const ay = d.dy / d.dist + (d.dx / d.dist) * wob;
    e.x += ax * e.def.speed * dt;
    e.y += ay * e.def.speed * dt;
    const p = world.player;
    if (circlesOverlap(e.x, e.y, e.r, p.x, p.y, p.r)) hurtPlayer(world, e.def.damage);
  },

  brawler(world, e, dt, d) {
    const atk = e.def.attack;
    const p = world.player;
    if (e.state === 'chase') {
      if (d.dist > atk.triggerRange) {
        e.x += (d.dx / d.dist) * e.def.speed * dt;
        e.y += (d.dy / d.dist) * e.def.speed * dt;
      } else if (e.cd <= 0) {
        e.state = 'windup';
        e.t = atk.windup;
        e.angle = Math.atan2(d.dy, d.dx);
      }
    } else if (e.state === 'windup') {
      e.t -= dt;
      if (e.t <= 0) {
        if (arcHitsCircle(e.x, e.y, e.angle, atk.arc * DEG, atk.range, p.x, p.y, p.r)) hurtPlayer(world, e.def.damage);
        burst(world, e.x + Math.cos(e.angle) * atk.range * 0.6, e.y + Math.sin(e.angle) * atk.range * 0.6, e.color, 6, 140);
        e.state = 'recover';
        e.t = atk.recover;
        e.swingT = 0.15;
      }
    } else if (e.state === 'recover') {
      e.t -= dt;
      if (e.t <= 0) e.state = 'chase';
    }
  },

  // 自爆ボット：近づいたら止まって点滅し、時間が来たら爆発する
  bomber(world, e, dt, d) {
    const bomb = e.def.bomb;
    if (e.state === 'chase') {
      e.x += (d.dx / d.dist) * e.def.speed * dt;
      e.y += (d.dy / d.dist) * e.def.speed * dt;
      if (d.dist <= bomb.triggerRange) {
        e.state = 'fuse';
        e.t = bomb.fuse;
      }
    } else if (e.state === 'fuse') {
      e.t -= dt;
      if (e.t <= 0) {
        const p = world.player;
        if (circlesOverlap(e.x, e.y, bomb.radius, p.x, p.y, p.r)) hurtPlayer(world, e.def.damage);
        ring(world, e.x, e.y, bomb.radius, e.color);
        burst(world, e.x, e.y, e.color, 26, 300);
        addShake(world, 7);
        e.dead = true; // 自爆は撃破に数えない（経験値もドロップもなし）
      }
    }
  },

  // フロストスプレイヤー：近づいて構え、前方の扇に冷気を噴き続ける
  sprayer(world, e, dt, d) {
    const spray = e.def.spray;
    const p = world.player;
    if (e.state === 'chase') {
      if (d.dist > spray.triggerRange) {
        e.x += (d.dx / d.dist) * e.def.speed * dt;
        e.y += (d.dy / d.dist) * e.def.speed * dt;
      } else if (e.cd <= 0) {
        e.state = 'windup';
        e.t = spray.windup;
        e.angle = Math.atan2(d.dy, d.dx);
      }
    } else if (e.state === 'windup') {
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 'spray';
        e.t = spray.duration;
      }
    } else if (e.state === 'spray') {
      e.t -= dt;
      if (arcHitsCircle(e.x, e.y, e.angle, spray.arc * DEG, spray.range, p.x, p.y, p.r)) {
        slowPlayer(world);
        hurtPlayer(world, e.def.damage);
      }
      if (world.rng() < 0.7) {
        const a = e.angle + (world.rng() - 0.5) * spray.arc * DEG;
        world.fx.particles.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 0.35, max: 0.35, color: e.color, size: 3 });
      }
      if (e.t <= 0) {
        e.state = 'chase';
        e.cd = spray.recover;
      }
    }
  },

  gunner(world, e, dt, d) {
    const keep = e.def.keepDistance;
    const shot = e.def.shot;
    if (e.state === 'chase') {
      const want = d.dist < keep.min ? -1 : d.dist > keep.max ? 1 : 0;
      e.x += (d.dx / d.dist) * e.def.speed * want * dt;
      e.y += (d.dy / d.dist) * e.def.speed * want * dt;
      if (e.cd <= 0) {
        e.state = 'aim';
        e.t = shot.aim;
      }
    } else if (e.state === 'aim') {
      e.t -= dt;
      if (e.t <= 0) {
        world.shots.push({
          x: e.x,
          y: e.y,
          vx: (d.dx / d.dist) * shot.speed,
          vy: (d.dy / d.dist) * shot.speed,
          r: shot.radius,
          damage: e.def.damage,
          life: shot.life,
        });
        e.state = 'chase';
        e.cd = shot.interval;
      }
    }
  },
};

// 状態異常の時間を進める。燃焼は一定間隔でダメージ
function updateStatus(world, e, dt) {
  e.slowT -= dt;
  e.stopT -= dt;
  if (e.burnT > 0) {
    e.burnT -= dt;
    e.burnAcc += dt;
    const burn = STATUS.burn;
    while (e.burnAcc >= burn.tick && !e.dead) {
      e.burnAcc -= burn.tick;
      const amount = Math.max(1, Math.round(burn.dps * burn.tick * world.player.stats.burnMul));
      damageEnemy(world, e, amount, { color: ELEMENT_COLORS.heat, small: true });
    }
  }
}

export function updateEnemies(world, dt) {
  const p = world.player;
  const damp = Math.exp(-COMBAT.knockbackDamping * dt);
  for (const e of world.enemies) {
    if (e.dead) continue;
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      continue;
    }
    updateStatus(world, e, dt);
    if (e.dead) continue;
    // 減速・凍結中は、その敵の時間の進みを遅くする（動きも構えも遅くなる）
    const edt = dt * enemySpeedFactor(e);
    if (e.boss) {
      updateBoss(world, e, edt);
      continue;
    }
    updateEliteTrait(world, e, dt);
    e.hit -= dt;
    e.cd -= edt;
    e.stagger -= dt;
    if (e.swingT > 0) e.swingT -= dt;
    if (e.stagger <= 0 && edt > 0) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      BEHAVIORS[e.def.behavior](world, e, edt, { dx, dy, dist: Math.hypot(dx, dy) || 1 });
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vx *= damp;
    e.vy *= damp;
    clampToBounds(e, world.bounds);
  }

  // 敵同士が重ならないように押し合う
  const live = world.enemies.filter((e) => !e.dead && e.spawnT <= 0);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (dist < min && dist > 0) {
        // ボスは押されない
        const push = (min - dist) / (a.boss || b.boss ? 1 : 2);
        if (!a.boss) {
          a.x -= (dx / dist) * push;
          a.y -= (dy / dist) * push;
        }
        if (!b.boss) {
          b.x += (dx / dist) * push;
          b.y += (dy / dist) * push;
        }
      }
    }
  }
  world.enemies = world.enemies.filter((e) => !e.dead);
}

export function updateShots(world, dt) {
  const p = world.player;
  const b = world.bounds;
  for (const s of world.shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (s.x < b.left || s.x > b.right || s.y < b.top || s.y > b.bottom) s.life = 0;
    if (s.life > 0 && circlesOverlap(s.x, s.y, s.r, p.x, p.y, p.r)) {
      // 無敵中（ダッシュ中など）はすり抜ける
      if (hurtPlayer(world, s.damage)) s.life = 0;
    }
  }
  world.shots = world.shots.filter((s) => s.life > 0);
}
