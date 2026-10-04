// ボスの攻撃パターンの部品。どれも「予告 → 攻撃 → 硬直」の流れで、終わったら true を返す。
// ボスの定義（src/data/bosses.js）の attacks で、数値を変えて組み合わせる。
//   act: { def, phase, t, ... } 実行中の攻撃の状態
//   d:   { dx, dy, dist } プレイヤーへの向きと距離
import { FEEL } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { DEG, arcHitsCircle, circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { hurtPlayer, slowPlayer } from './combat.js';
import { addShake, burst, floatText, ring } from './fx.js';

function aimAt(act, d) {
  act.dirX = d.dx / d.dist;
  act.dirY = d.dy / d.dist;
}

export const PATTERNS = {
  charge: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.remaining = act.def.repeat ?? 1;
      aimAt(act, d);
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        // 予告中はプレイヤーを追って向きを変える。最後の少しの間だけ向きを固定して、避ける余地を作る
        if (act.t > def.lockTime) aimAt(act, d);
        if (act.t <= 0) {
          act.phase = 'active';
          act.t = def.duration;
        }
      } else if (act.phase === 'active') {
        b.x += act.dirX * def.speed * dt;
        b.y += act.dirY * def.speed * dt;
        if (world.rng() < 0.6) burst(world, b.x - act.dirX * b.r, b.y - act.dirY * b.r, b.color, 1, 80);
        const p = world.player;
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        if (clampToBounds(b, world.bounds)) {
          // 壁に激突。連続突進の途中でもここで止まる
          act.phase = 'stun';
          act.t = def.wallStun;
          addShake(world, FEEL.shake.charged);
          burst(world, b.x + act.dirX * b.r, b.y + act.dirY * b.r, b.color, 24, 260);
          floatText(world, b.x, b.y - b.r - 12, 'スタン!', COLORS.amber, 20);
        } else if (act.t <= 0) {
          act.remaining--;
          if (act.remaining > 0) {
            act.phase = 'telegraph';
            act.t = def.repeatTelegraph ?? def.telegraph;
            aimAt(act, d);
          } else {
            act.phase = 'recover';
            act.t = def.recover;
          }
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  shockwave: {
    start(world, b, act) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
    },
    update(world, b, dt, act) {
      const def = act.def;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t <= 0) {
          world.hazards.push({
            type: 'ring', x: b.x, y: b.y, r: b.r, speed: def.ringSpeed, max: def.ringMax, width: def.ringWidth,
            damage: def.damage, color: b.color, done: false,
          });
          addShake(world, FEEL.shake.charged);
          burst(world, b.x, b.y, b.color, 30, 260);
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },
};

// 扇形に噴射し続ける（冷気ブレスなど）
PATTERNS.cone = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    aimAt(act, d);
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t > def.lockTime) aimAt(act, d);
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.duration;
      }
    } else if (act.phase === 'active') {
      const angle = Math.atan2(act.dirY, act.dirX);
      if (arcHitsCircle(b.x, b.y, angle, def.arc * DEG, def.range, p.x, p.y, p.r)) {
        if (def.slow) slowPlayer(world);
        hurtPlayer(world, def.damage);
      }
      // 噴射のしぶき
      for (let i = 0; i < 2; i++) {
        const a = angle + (world.rng() - 0.5) * def.arc * DEG;
        const v = def.range / 0.45;
        world.fx.particles.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45, max: 0.45, color: b.color, size: 4 });
      }
      if (act.t <= 0) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 自分の周りを一度に攻撃する（尻尾なぎ払いなど）
PATTERNS.slam = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        if (circlesOverlap(b.x, b.y, def.radius, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        ring(world, b.x, b.y, def.radius, b.color);
        burst(world, b.x, b.y, b.color, 24, 300);
        addShake(world, FEEL.shake.heavy);
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 落下地点の予告を次々に出し、少し遅れてそこに落とす（氷柱の雨など）
PATTERNS.rain = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.left = act.def.count;
    act.next = 0;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) act.phase = 'active';
    } else if (act.phase === 'active') {
      act.next -= dt;
      if (act.next <= 0 && act.left > 0) {
        act.next = def.interval;
        act.left--;
        // プレイヤーのいる場所の近くを狙う
        const a = world.rng() * Math.PI * 2;
        const r = world.rng() * def.spread;
        world.hazards.push({ type: 'mark', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: def.radius, t: def.delay, max: def.delay, damage: def.damage, color: b.color });
      }
      if (act.left <= 0) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 広がる輪などの、ボスから離れて残る攻撃
export function updateHazards(world, dt) {
  const p = world.player;
  for (const h of world.hazards) {
    if (h.type === 'ring') {
      h.r += h.speed * dt;
      const dist = Math.hypot(p.x - h.x, p.y - h.y);
      // 輪の線に触れたら当たる。ダッシュの無敵ですり抜けられる
      if (!h.done && Math.abs(dist - h.r) < h.width / 2 + p.r) {
        if (hurtPlayer(world, h.damage)) h.done = true;
      }
      if (h.r > h.max) h.dead = true;
    } else if (h.type === 'mark') {
      // 落下地点の予告。時間が来たら、その円の中にいると当たる
      h.t -= dt;
      if (h.t <= 0) {
        if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
        burst(world, h.x, h.y, h.color, 12, 220);
        h.dead = true;
      }
    }
  }
  world.hazards = world.hazards.filter((h) => !h.dead);
}
