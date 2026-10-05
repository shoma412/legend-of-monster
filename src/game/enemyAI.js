// 雑魚敵の動き方の部品。敵の定義（src/data/enemies.js）の behavior で選ぶ。
import { COMBAT, STATUS } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { DEG, angleDiff, arcHitsCircle, circlesOverlap, clampToBounds, distToSegment } from '../logic/geometry.js';
import { updateBoss } from './boss.js';
import { damageEnemy, enemySpeedFactor, hurtPlayer, slowPlayer } from './combat.js';
import { updateEliteTrait } from './elite.js';
import { addShake, burst, ring, sfx } from './fx.js';

// scale: エリアが進んだぶんの、HPと攻撃力の倍率
// scale: エリアが進んだぶんの、HP と攻撃力の倍率 / hpScale: 周回による、HP だけの倍率
export function createEnemy(def, x, y, spawnT, rng, scale = 1, hpScale = 1) {
  if (scale !== 1 || hpScale !== 1) def = { ...def, hp: Math.round(def.hp * scale * hpScale), damage: Math.round(def.damage * scale) };
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
    facing: Math.PI, // 盾を向けている方向（シールド兵）
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

  // シールド兵：盾をこちらに向けながら近づき、殴る。向きを変えるのは遅いので、回り込める
  guardian(world, e, dt, d) {
    const atk = e.def.attack;
    const p = world.player;
    const want = Math.atan2(d.dy, d.dx);
    if (e.state === 'chase') {
      const diff = angleDiff(want, e.facing);
      const step = e.def.turnRate * dt;
      e.facing += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
      if (d.dist > atk.triggerRange) {
        e.x += (d.dx / d.dist) * e.def.speed * dt;
        e.y += (d.dy / d.dist) * e.def.speed * dt;
      } else if (e.cd <= 0 && Math.abs(angleDiff(want, e.facing)) < 0.6) {
        e.state = 'windup';
        e.t = atk.windup;
        e.angle = e.facing;
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

  // スナイパー：距離を取り、照準線で狙ってから高威力の一撃を撃つ
  sniper(world, e, dt, d) {
    const keep = e.def.keepDistance;
    const snipe = e.def.snipe;
    const p = world.player;
    if (e.state === 'chase') {
      const want = d.dist < keep.min ? -1 : d.dist > keep.max ? 1 : 0;
      e.x += (d.dx / d.dist) * e.def.speed * want * dt;
      e.y += (d.dy / d.dist) * e.def.speed * want * dt;
      if (e.cd <= 0) {
        e.state = 'aim';
        e.t = snipe.aim;
        e.angle = Math.atan2(d.dy, d.dx);
      }
    } else if (e.state === 'aim') {
      e.t -= dt;
      // 最後の少しの間だけ向きを固定する（そこで照準線から外れれば当たらない）
      if (e.t > snipe.lock) e.angle = Math.atan2(d.dy, d.dx);
      if (e.t <= 0) {
        const x2 = e.x + Math.cos(e.angle) * snipe.range;
        const y2 = e.y + Math.sin(e.angle) * snipe.range;
        if (distToSegment(p.x, p.y, e.x, e.y, x2, y2) <= p.r + snipe.width / 2) hurtPlayer(world, e.def.damage);
        sfx(world, 'snipe');
        world.fx.beams.push({ x1: e.x, y1: e.y, x2, y2, life: 0.18, max: 0.18, color: e.color, width: snipe.width });
        addShake(world, 4);
        e.state = 'chase';
        e.cd = snipe.interval;
      }
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
        sfx(world, 'explode');
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
        if (spray.slow !== false) slowPlayer(world);
        hurtPlayer(world, e.def.damage);
      }
      if (world.rng() < 0.7) {
        const a = e.angle + (world.rng() - 0.5) * spray.arc * DEG;
        world.fx.particles.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 0.35, max: 0.35, color: e.color, size: 3 });
      }
      if (e.t <= 0) {
        // 溶接ボット：噴いた先の床が、しばらく燃える
        if (spray.pool) {
          const reach = spray.range * 0.62;
          world.hazards.push({
            type: 'pool', x: e.x + Math.cos(e.angle) * reach, y: e.y + Math.sin(e.angle) * reach, r: spray.pool.radius, arm: spray.pool.arm, armMax: spray.pool.arm,
            life: spray.pool.life, tick: spray.pool.tick, acc: spray.pool.tick, damage: spray.pool.damage, slow: false, color: e.color,
          });
        }
        e.state = 'chase';
        e.cd = spray.recover;
      }
    }
  },

  // 清掃ローラー：狙いをつけてから、まっすぐ転がる。通ったあとに汚水の床を残す
  roller(world, e, dt, d) {
    const roll = e.def.roll;
    const p = world.player;
    if (e.state === 'chase') {
      if (d.dist > roll.triggerRange) {
        e.x += (d.dx / d.dist) * e.def.speed * dt;
        e.y += (d.dy / d.dist) * e.def.speed * dt;
      } else if (e.cd <= 0) {
        e.state = 'windup';
        e.t = roll.windup;
        e.angle = Math.atan2(d.dy, d.dx);
      }
    } else if (e.state === 'windup') {
      e.t -= dt;
      // 最後の少しの間だけ向きを固定する
      if (e.t > 0.2) e.angle = Math.atan2(d.dy, d.dx);
      if (e.t <= 0) {
        e.state = 'roll';
        e.t = roll.duration;
        e.trailAcc = 0;
        e.hitPlayer = false;
      }
    } else if (e.state === 'roll') {
      e.t -= dt;
      const step = roll.speed * dt;
      e.x += Math.cos(e.angle) * step;
      e.y += Math.sin(e.angle) * step;
      e.trailAcc += step;
      if (e.trailAcc >= roll.trail) {
        e.trailAcc = 0;
        world.hazards.push({ type: 'pool', x: e.x, y: e.y, r: roll.poolRadius, arm: 0.25, armMax: 0.25, life: roll.poolLife, tick: 1, acc: 0, damage: 0, slow: true, color: e.color });
      }
      if (!e.hitPlayer && circlesOverlap(e.x, e.y, e.r, p.x, p.y, p.r) && hurtPlayer(world, e.def.damage)) e.hitPlayer = true;
      const hitWall = e.x <= world.bounds.left + e.r || e.x >= world.bounds.right - e.r || e.y <= world.bounds.top + e.r || e.y >= world.bounds.bottom - e.r;
      if (e.t <= 0 || hitWall) {
        e.state = 'chase';
        e.cd = roll.recover;
      }
    }
  },

  // ヒルドローン：ふらつきながら飛びつき、張り付いて HP を吸う。ダッシュで振り払える
  leech(world, e, dt, d) {
    const latch = e.def.latch;
    const p = world.player;
    if (e.state === 'latched') {
      // ダッシュされたら振り払われて、しばらく動けない
      if (p.dashT > 0) {
        e.state = 'stunned';
        e.t = latch.stun;
        e.vx = -p.dvx * 0.35;
        e.vy = -p.dvy * 0.35;
        return;
      }
      e.x = p.x + Math.cos(e.latchAngle) * (p.r + e.r * 0.5);
      e.y = p.y + Math.sin(e.latchAngle) * (p.r + e.r * 0.5);
      e.t -= dt;
      if (e.t <= 0) {
        e.t = latch.tick;
        // 吸われるダメージは、無敵時間を付けずに少しずつ入る（ほかの攻撃と重なる）
        if (p.inv <= 0 && world.mode === 'play') {
          const amount = Math.max(1, Math.round(e.def.damage * (world.room.damageScale ?? 1)));
          p.hp = Math.max(1, p.hp - amount);
          world.damageTaken += amount;
          e.hp = Math.min(e.maxHp, e.hp + amount);
          world.fx.texts.push({ x: p.x, y: p.y - 22, text: `-${amount}`, color: e.color, size: 13, life: 0.5, max: 0.5, vy: -30 });
        }
      }
    } else if (e.state === 'stunned') {
      e.t -= dt;
      if (e.t <= 0) e.state = 'chase';
    } else {
      const wob = Math.sin(world.time * 6 + e.seed) * (e.def.wobble ?? 0);
      e.x += (d.dx / d.dist - (d.dy / d.dist) * wob) * e.def.speed * dt;
      e.y += (d.dy / d.dist + (d.dx / d.dist) * wob) * e.def.speed * dt;
      // 触れたら張り付く（ダッシュ中は張り付けない）
      if (p.dashT <= 0 && circlesOverlap(e.x, e.y, e.r, p.x, p.y, p.r)) {
        e.state = 'latched';
        e.t = latch.tick;
        e.latchAngle = Math.atan2(e.y - p.y, e.x - p.x);
      }
    }
  },

  // 配管タレット：動かない。狙いをつけてから、蒸気を一直線に噴き続ける
  steamer(world, e, dt, d) {
    const steam = e.def.steam;
    const p = world.player;
    if (e.state === 'chase') {
      if (e.cd <= 0) {
        e.state = 'aim';
        e.t = steam.aim;
        e.angle = Math.atan2(d.dy, d.dx);
      }
    } else if (e.state === 'aim') {
      e.t -= dt;
      if (e.t > steam.lock) e.angle = Math.atan2(d.dy, d.dx);
      if (e.t <= 0) {
        e.state = 'steam';
        e.t = steam.duration;
        e.tickT = 0;
        sfx(world, 'steam');
      }
    } else if (e.state === 'steam') {
      e.t -= dt;
      e.tickT -= dt;
      const x2 = e.x + Math.cos(e.angle) * steam.range;
      const y2 = e.y + Math.sin(e.angle) * steam.range;
      if (e.tickT <= 0 && distToSegment(p.x, p.y, e.x, e.y, x2, y2) <= p.r + steam.width / 2) {
        if (hurtPlayer(world, e.def.damage)) e.tickT = steam.tick;
      }
      if (world.rng() < 0.8) {
        const v = 520;
        const off = (world.rng() - 0.5) * 0.12;
        world.fx.particles.push({ x: e.x + Math.cos(e.angle) * e.r, y: e.y + Math.sin(e.angle) * e.r, vx: Math.cos(e.angle + off) * v, vy: Math.sin(e.angle + off) * v, life: 0.5, max: 0.5, color: e.color, size: 3 });
      }
      if (e.t <= 0) {
        e.state = 'chase';
        e.cd = steam.interval;
      }
    }
  },

  // 密漁者：距離を取り、照準線を出してから銛を投げる。当たると、手元まで引き寄せられる
  harpooner(world, e, dt, d) {
    const keep = e.def.keepDistance;
    const harpoon = e.def.harpoon;
    const p = world.player;
    if (e.state === 'chase') {
      const want = d.dist < keep.min ? -1 : d.dist > keep.max ? 1 : 0;
      e.x += (d.dx / d.dist) * e.def.speed * want * dt;
      e.y += (d.dy / d.dist) * e.def.speed * want * dt;
      if (e.cd <= 0 && d.dist <= harpoon.range) {
        e.state = 'aim';
        e.t = harpoon.aim;
        e.angle = Math.atan2(d.dy, d.dx);
      }
    } else if (e.state === 'aim') {
      e.t -= dt;
      if (e.t > harpoon.lock) e.angle = Math.atan2(d.dy, d.dx);
      if (e.t <= 0) {
        const x2 = e.x + Math.cos(e.angle) * harpoon.range;
        const y2 = e.y + Math.sin(e.angle) * harpoon.range;
        const hit = distToSegment(p.x, p.y, e.x, e.y, x2, y2) <= p.r + harpoon.width / 2 && hurtPlayer(world, e.def.damage);
        sfx(world, 'snipe');
        world.fx.beams.push({ x1: e.x, y1: e.y, x2: hit ? p.x : x2, y2: hit ? p.y : y2, life: hit ? harpoon.pull + 0.1 : 0.15, max: hit ? harpoon.pull + 0.1 : 0.15, color: e.color, width: 3 });
        if (hit && world.mode === 'play') {
          // 手元の少し前まで、一定の時間で引き寄せる
          const travel = Math.max(0, d.dist - harpoon.pullTo);
          p.pull = { vx: (-d.dx / d.dist) * (travel / harpoon.pull), vy: (-d.dy / d.dist) * (travel / harpoon.pull), t: harpoon.pull };
        }
        e.state = 'chase';
        e.cd = harpoon.interval;
      }
    }
  },

  // スラッジハイドラの首：体のまわりの決まった位置に付いたまま、狙いをつけて弾を吐く
  hydrahead(world, e, dt, d) {
    const shot = e.def.shot;
    const b = e.anchor;
    if (b && !b.dead) {
      const a = b.angle + e.anchorAngle + Math.sin(world.time * 1.4 + e.seed) * 0.18;
      e.x = b.x + Math.cos(a) * e.anchorDist;
      e.y = b.y + Math.sin(a) * e.anchorDist;
    }
    if (e.state === 'chase') {
      if (e.cd <= 0) {
        e.state = 'aim';
        e.t = shot.aim;
      }
    } else if (e.state === 'aim') {
      e.t -= dt;
      if (e.t <= 0) {
        sfx(world, 'enemyShot');
        world.shots.push({ x: e.x, y: e.y, vx: (d.dx / d.dist) * shot.speed, vy: (d.dy / d.dist) * shot.speed, r: shot.radius, damage: e.def.damage, life: shot.life, color: e.color });
        e.state = 'chase';
        e.cd = shot.interval;
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
        fireShot(world, e, d, shot);
        // 連射（リベッター）：残りを、少しずつ間を空けて撃つ
        e.burstLeft = (shot.burst ?? 1) - 1;
        if (e.burstLeft > 0) {
          e.state = 'burst';
          e.t = shot.burstGap;
        } else {
          e.state = 'chase';
          e.cd = shot.interval;
        }
      }
    } else if (e.state === 'burst') {
      e.t -= dt;
      if (e.t <= 0) {
        fireShot(world, e, d, shot);
        e.burstLeft--;
        e.t = shot.burstGap;
        if (e.burstLeft <= 0) {
          e.state = 'chase';
          e.cd = shot.interval;
        }
      }
    }
  },

  // 運搬ドローン：ふらつきながらプレイヤーの近くまで来て、頭上から樽を落とす
  bombardier(world, e, dt, d) {
    const keep = e.def.keepDistance;
    const drop = e.def.drop;
    const p = world.player;
    const want = d.dist < keep.min ? -1 : d.dist > keep.max ? 1 : 0;
    const wob = Math.sin(world.time * 4 + e.seed) * (e.def.wobble ?? 0);
    e.x += ((d.dx / d.dist) * want - (d.dy / d.dist) * wob) * e.def.speed * dt;
    e.y += ((d.dy / d.dist) * want + (d.dx / d.dist) * wob) * e.def.speed * dt;
    if (e.cd <= 0 && d.dist <= keep.max + 40) {
      world.hazards.push({ type: 'mark', x: p.x, y: p.y, r: drop.radius, t: drop.delay, max: drop.delay, damage: e.def.damage, color: e.color });
      sfx(world, 'enemyShot');
      e.cd = drop.interval;
      e.dropT = 0.25; // 描画用：落とした瞬間
    }
    if (e.dropT > 0) e.dropT -= dt;
  },
};

// 弾を1発撃つ（プレイヤーのいる方向へ）
function fireShot(world, e, d, shot) {
  sfx(world, 'enemyShot');
  world.shots.push({
    x: e.x,
    y: e.y,
    vx: (d.dx / d.dist) * shot.speed,
    vy: (d.dy / d.dist) * shot.speed,
    r: shot.radius,
    damage: e.def.damage,
    life: shot.life,
  });
}

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
    if (e.anchor) e.stagger = 0; // 首は、ひるんでも体から離れない
    if (e.stagger <= 0 && edt > 0) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      BEHAVIORS[e.def.behavior](world, e, edt, { dx, dy, dist: Math.hypot(dx, dy) || 1 });
    }
    if (e.state !== 'latched' && !e.anchor) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
    e.vx *= damp;
    e.vy *= damp;
    clampToBounds(e, world.bounds);
  }

  // 敵同士が重ならないように押し合う
  const live = world.enemies.filter((e) => !e.dead && e.spawnT <= 0 && e.state !== 'latched' && !e.hidden && !e.anchor);
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
      // 減速つきの弾（氷の破片）は、当たると動きも鈍る。減速は、ダメージの無敵時間が付く前にかける
      if (s.slow) slowPlayer(world);
      if (hurtPlayer(world, s.damage)) s.life = 0;
    }
  }
  world.shots = world.shots.filter((s) => s.life > 0);
}
