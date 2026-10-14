// マップ6のボス（インテーク・ダクトクローラー）の、そのボスだけの攻撃。共通の部品は使わない。
//   インテーク    : inhale 吸引・exhale 吐き出し・fullopen 全開（固有・前からある）/ bladevolley 羽根の乱射 / suctionring 吸気の輪 / downdraft 排気の打ち下ろし
//   ダクトクローラー: sweep 横断・ventburst 熱排気・blowthrough 吹き抜け（固有・前からある）/ spinevolley 鱗の棘 / ductquake 管の振動 / ductbite 噛みつき加速
//   サイクロン      : twister 竜巻 / sweepup 巻き上げ投げ / swirlshot 渦巻きの弾 / spiralbolt 螺旋落雷 / cycloneram 渦巻き突進 / eyestorm 台風の目（大技）
//   ウェザーベーン  : compass 方位撃ち / gust 突風 / windseed 風種 / windturn 風向き返し / windrush 向かい風突進 / stormfury 乱風（大技）
import { FEEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS } from '../data/theme.js';
import { angleDiff, circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { ventSpots } from '../logic/ventSpots.js';
import { clamp, inside, pushMark, timed } from './bossKit.js';
import { hurtPlayer } from './combat.js';
import { createEnemy } from './enemyAI.js';
import { sheltered, windEnv, windScale } from './wind.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';

const DEG = Math.PI / 180;

const SCALE = (world) => [world.room.enemyScale ?? 1, world.room.hpScale ?? 1];
const WIND_DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

// 風を、いま吹いている状態にして、向きを決める（ウェザーベーンの「風向き返し」「乱風」）。風の吹かない部屋では何もしない。変えたら true
function setWind(world, dirX, dirY, { warn = 0, blow = 4 } = {}) {
  const env = windEnv(world);
  if (!env) return false;
  const w = (world.wind ??= { phase: 'clear', t: 1, max: 1, dirX: 1, dirY: 0 });
  Object.assign(w, warn > 0 ? { phase: 'warn', t: warn, max: warn } : { phase: 'blow', t: blow, max: blow }, { dirX, dirY, pushing: false });
  if (warn > 0) w.blowAfter = blow;
  floatText(world, world.player.x, world.player.y - 44, 'Gale', COLORS.cyan, 16);
  sfx(world, 'warning');
  return true;
}

// 風をやめさせる（次の風は、clear 秒あとに予告から始まる）
function clearWind(world) {
  const env = windEnv(world);
  const w = world.wind;
  if (!env || !w) return;
  Object.assign(w, { phase: 'clear', t: (env.windCycle ?? env.cycle).clear, max: (env.windCycle ?? env.cycle).clear, pushing: false });
}

// 風の向き（いま吹いている、または予告された向き）。なければ null
export function windDir(world) {
  const w = world.wind;
  return w && (w.phase === 'warn' || w.phase === 'blow') ? { x: w.dirX, y: w.dirY } : null;
}

// 竜巻を1本つくる（竜巻・台風の目で使う）。def: { core, pullR, pull, speed, life, damage, tick }
export function makeTwister(world, def, x, y, color) {
  const h = { type: 'twister', x, y, core: def.core, pullR: def.pullR, pull: def.pull, speed: def.speed, life: def.life, age: 0, damage: def.damage, tick: def.tick, acc: def.tick, wait: 0.5, color };
  world.hazards.push(h);
  return h;
}

export const HAZARDS_MAP6 = {
  // 竜巻：プレイヤーのほうへ、ゆっくり寄ってくる。まわりでは弱く引き込まれる（ダッシュ中は引かれない）。芯に触れるとダメージ
  twister: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        return;
      }
      h.age += dt;
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const dist = Math.hypot(dx, dy) || 1;
      h.x += (dx / dist) * h.speed * dt + Math.cos(h.age * 2.3) * 12 * dt;
      h.y += (dy / dist) * h.speed * dt + Math.sin(h.age * 1.9) * 12 * dt;
      if (dist <= h.pullR && p.dashT <= 0) {
        const k = (1 - dist / h.pullR) * h.pull * windScale(world) * dt;
        p.x -= (dx / dist) * k;
        p.y -= (dy / dist) * k;
        clampToBounds(p, world.bounds);
      }
      h.acc += dt;
      if (dist <= h.core + p.r && h.acc >= h.tick) {
        h.acc = 0;
        hurtPlayer(world, h.damage);
      }
      if (h.age >= h.life) h.dead = true;
    },
  },

  // 曲がる弾（渦巻きの弾）：向きが少しずつ変わりながら飛ぶ
  curveshot: {
    update(world, h, dt) {
      const p = world.player;
      h.age += dt;
      h.ang += h.turn * dt;
      h.x += Math.cos(h.ang) * h.speed * dt;
      h.y += Math.sin(h.ang) * h.speed * dt;
      if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r) && hurtPlayer(world, h.damage)) {
        burst(world, h.x, h.y, h.color, 6, 160);
        h.dead = true;
      }
      if (h.age >= h.life || !inside(world, h.x, h.y, -40)) h.dead = true;
    },
  },

  // 台風の目：部屋ぜんたいが暴風圏。目（安全な円）の外にいる間は、tick 秒ごとにダメージ。目はゆっくり動き、縮む
  stormeye: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        return;
      }
      h.age += dt;
      h.r = h.r0 + (h.r1 - h.r0) * Math.min(1, h.age / h.life);
      // 目は、ときどき行き先を変えながら、ゆっくり動く
      if (!h.goal || Math.hypot(h.goal.x - h.x, h.goal.y - h.y) < 12) {
        const bd = world.bounds;
        h.goal = { x: bd.left + 120 + world.rng() * (bd.right - bd.left - 240), y: bd.top + 100 + world.rng() * (bd.bottom - bd.top - 200) };
      }
      const gx = h.goal.x - h.x;
      const gy = h.goal.y - h.y;
      const gd = Math.hypot(gx, gy) || 1;
      h.x += (gx / gd) * h.drift * dt;
      h.y += (gy / gd) * h.drift * dt;
      h.acc += dt;
      if (h.acc >= h.tick) {
        h.acc = 0;
        if (Math.hypot(p.x - h.x, p.y - h.y) > h.r - p.r * 0.5) hurtPlayer(world, h.damage);
      }
      h.twisterT -= dt;
      if (h.twisterT <= 0) {
        h.twisterT = h.twister.every;
        for (let i = 0; i < h.twister.count; i++) {
          const spot = { x: world.bounds.left + 60 + world.rng() * (world.bounds.right - world.bounds.left - 120), y: world.bounds.top + 60 + world.rng() * (world.bounds.bottom - world.bounds.top - 120), r: 0 };
          makeTwister(world, h.twister, spot.x, spot.y, h.color);
        }
      }
      if (h.age >= h.life) h.dead = true;
    },
  },

  // 風の刃：風下へ走る、部屋の幅いっぱいの刃。一か所だけすき間がある。すき間（gap）に入るか、ダッシュで抜ける
  windblade: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        if (h.wait <= 0) sfx(world, 'enemyShot');
        return;
      }
      h.s += h.speed * dt;
      const x = h.x + h.dx * h.s;
      const y = h.y + h.dy * h.s;
      const along = (p.x - x) * h.dx + (p.y - y) * h.dy;
      const across = (p.x - x) * h.px + (p.y - y) * h.py;
      if (Math.abs(along) <= h.width / 2 + p.r && Math.abs(across) <= h.half && Math.abs(across - h.gap) > h.gapHalf - p.r * 0.5) hurtPlayer(world, h.damage);
      if (h.s >= h.travel) h.dead = true;
    },
  },

  // 吸気の輪：部屋の外から、ボスへ向かって縮んでくる輪。輪に触れると当たる（縮みきる前に、輪の内側へ抜けるか、ダッシュで抜ける）
  closering: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        return;
      }
      if (h.owner && !h.owner.dead) {
        h.x = h.owner.x;
        h.y = h.owner.y;
      }
      h.r -= h.speed * dt;
      const dist = Math.hypot(p.x - h.x, p.y - h.y);
      if (Math.abs(dist - h.r) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      if (h.r <= h.min) {
        ring(world, h.x, h.y, h.min + 20, h.color);
        h.dead = true;
      }
    },
  },

  // 管の振動：通気口から、小さな輪が広がる（口が光ってから、delay 秒後）
  ventring: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        if (h.wait <= 0) {
          sfx(world, 'explode');
          addShake(world, FEEL.shake.hit);
          burst(world, h.x, h.y, h.color, 12, 220);
        }
        return;
      }
      h.r += h.speed * dt;
      const dist = Math.hypot(p.x - h.x, p.y - h.y);
      if (Math.abs(dist - h.r) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      if (h.r >= h.max) h.dead = true;
    },
  },
};

function spawnShot(world, b, x, y, a, def, color) {
  world.shots.push({ x, y, vx: Math.cos(a) * def.shotSpeed, vy: Math.sin(a) * def.shotSpeed, r: def.shotRadius, damage: def.damage, life: 4, color });
}

export const PATTERNS_MAP6 = {
  // インテーク：羽根の乱射（回る羽根が、弾を出す。途中で回る向きが逆になる）
  bladevolley: timed({
    fire(world, b, act) {
      act.clock = 0;
      act.fired = 0;
      act.angle = Math.atan2(act.dirY, act.dirX);
    },
    finished(world, b, act, dt) {
      const def = act.def;
      act.clock += dt;
      while (act.fired < def.shots && act.clock >= act.fired * def.gap) {
        const dir = act.fired < def.reverseAt ? 1 : -1;
        for (let k = 0; k < def.blades; k++) {
          const a = act.angle + (k * Math.PI * 2) / def.blades;
          spawnShot(world, b, b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, a, def, b.color);
        }
        act.angle += dir * def.turn * DEG;
        act.fired++;
        if (act.fired % 3 === 0) sfx(world, 'enemyShot');
      }
      return act.fired >= def.shots;
    },
  }),

  // インテーク：吸気の輪
  suctionring: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const h = { type: 'closering', owner: b, x: b.x, y: b.y, r: def.start, min: def.min, speed: def.speed, width: def.width, damage: def.damage, wait: i * def.gap, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),

  // インテーク：排気の打ち下ろし（打ち下ろされた空気の塊。当たると、外へ吹き飛ばされる）
  downdraft: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      for (let i = 0; i < def.count; i++) {
        const a = world.rng() * Math.PI * 2;
        const r = i === 0 ? 0 : def.spread * (0.6 + world.rng() * 0.6);
        const x = Math.max(world.bounds.left + 20, Math.min(world.bounds.right - 20, p.x + Math.cos(a) * r));
        const y = Math.max(world.bounds.top + 20, Math.min(world.bounds.bottom - 20, p.y + Math.sin(a) * r));
        pushMark(world, act, b, { x, y, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, extra: { knock: def.knock } });
      }
      sfx(world, 'enemyShot');
    },
  }),

  // ダクトクローラー：鱗の棘（床の通気口から、プレイヤーへ棘が飛ぶ）
  spinevolley: timed({
    fire(world, b, act) {
      act.clock = 0;
      act.fired = 0;
      const vents = ventSpots(world.bounds);
      for (let i = vents.length - 1; i > 0; i--) {
        const j = Math.floor(world.rng() * (i + 1));
        [vents[i], vents[j]] = [vents[j], vents[i]];
      }
      act.order = vents;
    },
    finished(world, b, act, dt) {
      const def = act.def;
      const p = world.player;
      act.clock += dt;
      while (act.fired < def.vents && act.clock >= act.fired * def.gap) {
        const v = act.order[act.fired % act.order.length];
        const base = Math.atan2(p.y - v.y, p.x - v.x);
        for (let k = 0; k < def.spines; k++) {
          const a = base + (def.spines > 1 ? (k / (def.spines - 1) - 0.5) * def.spread * DEG : 0);
          spawnShot(world, b, v.x, v.y, a, def, b.color);
        }
        burst(world, v.x, v.y, b.color, 8, 160);
        act.fired++;
        sfx(world, 'enemyShot');
      }
      return act.fired >= def.vents;
    },
  }),

  // ダクトクローラー：管の振動（通気口が順に光り、小さな輪が広がる）
  ductquake: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const vents = ventSpots(world.bounds).sort((u, w) => Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(w.x - p.x, w.y - p.y));
      const picks = vents.slice(0, def.count);
      picks.forEach((v, i) => {
        const h = { type: 'ventring', x: v.x, y: v.y, r: 10, speed: def.speed, max: def.max, width: def.width, damage: def.damage, wait: def.delay + i * def.stagger, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
        // 光る予告
        pushMark(world, act, b, { x: v.x, y: v.y, r: 26, t: def.delay + i * def.stagger, damage: 0 });
      });
      sfx(world, 'warning');
    },
  }),

  // ダクトクローラー：噛みつき加速（じわじわ速くなる突進。壁に当たると、止まって隙ができる）
  ductbite: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.dirX = d.dx / (d.dist || 1);
      act.dirY = d.dy / (d.dist || 1);
      act.time = 0;
      sfx(world, 'bossCharge');
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      const p = world.player;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t > def.lockTime) {
          act.dirX = d.dx / (d.dist || 1);
          act.dirY = d.dy / (d.dist || 1);
        }
        if (act.t <= 0) act.phase = 'active';
      } else if (act.phase === 'active') {
        act.time += dt;
        const k = Math.min(1, act.time / def.duration);
        const speed = def.speedFrom + (def.speedTo - def.speedFrom) * k;
        b.x += act.dirX * speed * dt;
        b.y += act.dirY * speed * dt;
        const touched = clampToBounds(b, world.bounds);
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage * (1 + k * def.bonus));
        if (touched || act.time >= def.duration * 1.6) {
          act.phase = 'recover';
          act.t = touched ? def.wallStun : def.recover;
          if (touched) {
            addShake(world, FEEL.shake.charged);
            burst(world, b.x, b.y, b.color, 20, 260);
            sfx(world, 'explode');
          }
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },
};

// ---- ウェザーベーン ----

// 方位撃ち：東西南北に大きな弾を撃ち、次に斜め4方向。羅針盤のように回りながら、くり返す
const compassShots = (world, b, act, def, offset) => {
  for (let k = 0; k < 4; k++) {
    const a = offset + (k * Math.PI) / 2;
    spawnShot(world, b, b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, a, def, b.color);
  }
  sfx(world, 'enemyShot');
};

PATTERNS_MAP6.compass = timed({
  fire(world, b, act) {
    act.clock = 0;
    act.fired = 0;
  },
  finished(world, b, act, dt) {
    const def = act.def;
    act.clock += dt;
    while (act.fired < def.volleys && act.clock >= act.fired * def.gap) {
      const offset = (act.fired % 2) * (Math.PI / 4) + Math.floor(act.fired / 2) * def.twist * DEG;
      compassShots(world, b, act, def, offset);
      act.fired++;
    }
    return act.fired >= def.volleys;
  },
});

// 突風：盾の正面から風を吹かせ、扇形の中にいるプレイヤーを押す。ダメージはない。遮風板の陰と、ダッシュ中は押されない
PATTERNS_MAP6.gust = timed({
  fire(world, b, act) {
    act.clock = 0;
    act.angle = b.facing ?? b.angle;
    sfx(world, 'bossCharge');
  },
  finished(world, b, act, dt) {
    const def = act.def;
    const p = world.player;
    act.clock += dt;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const inCone = dist <= def.range && Math.abs(angleDiff(Math.atan2(dy, dx), act.angle)) <= (def.arc * DEG) / 2;
    if (inCone && p.dashT <= 0 && !sheltered(world, p.x, p.y, Math.cos(act.angle), Math.sin(act.angle))) {
      p.x += Math.cos(act.angle) * def.push * dt;
      p.y += Math.sin(act.angle) * def.push * dt;
      clampToBounds(p, world.bounds);
    }
    if (world.rng() < 0.5) burst(world, b.x + Math.cos(act.angle) * (b.r + world.rng() * def.range), b.y + Math.sin(act.angle) * (b.r + world.rng() * def.range), COLORS.cyan, 1, 140);
    return act.clock >= def.duration;
  },
});

// 風種：風に乗って流れる種をまく。風の間は流され、風がやむと、その場に残って地雷になる（近づくと爆ぜる）。壊せる
PATTERNS_MAP6.windseed = timed({
  fire(world, b, act) {
    const def = act.def;
    const [scale, hpScale] = SCALE(world);
    const kind = DATA.enemies.get(def.enemy);
    act.clock = 0;
    for (let i = 0; i < def.count; i++) {
      const a = world.rng() * Math.PI * 2;
      const r = b.r + 50 + world.rng() * def.spread;
      const e = createEnemy(kind, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 0.3, world.rng, scale, hpScale);
      clampToBounds(e, world.bounds);
      e.expire = world.time + def.life;
      world.enemies.push(e);
      act.hs.push(e);
    }
    sfx(world, 'enemyShot');
  },
  finished(world, b, act, dt) {
    act.clock += dt;
    return act.clock >= act.def.hold;
  },
});

// 風向き返し：風向きを反対にする（予告のあと、吹く）。風下へ走る、すき間のある風の刃も出る
PATTERNS_MAP6.windturn = timed({
  fire(world, b, act) {
    const def = act.def;
    const bd = world.bounds;
    const now = windDir(world) ?? { x: 1, y: 0 };
    const dir = { x: -now.x, y: -now.y };
    setWind(world, dir.x, dir.y, { warn: def.warn, blow: def.blow });
    // 刃は、風上の壁から出て、風下の壁へ走る
    const horizontal = dir.x !== 0;
    const alongLen = horizontal ? bd.right - bd.left : bd.bottom - bd.top;
    const acrossLen = horizontal ? bd.bottom - bd.top : bd.right - bd.left;
    const cx = (bd.left + bd.right) / 2;
    const cy = (bd.top + bd.bottom) / 2;
    const start = { x: cx - dir.x * (alongLen / 2 + 30), y: cy - dir.y * (alongLen / 2 + 30) };
    const perp = { x: -dir.y, y: dir.x };
    for (let i = 0; i < def.blades; i++) {
      const h = {
        type: 'windblade', x: start.x, y: start.y, dx: dir.x, dy: dir.y, px: perp.x, py: perp.y, s: 0, travel: alongLen + 60, speed: def.speed,
        width: def.width, half: acrossLen / 2 + 10, gap: (world.rng() - 0.5) * (acrossLen - def.gapSize * 1.4), gapHalf: def.gapSize / 2, damage: def.damage,
        wait: def.warn + 0.4 + i * def.stagger, color: b.color,
      };
      world.hazards.push(h);
      act.hs.push(h);
    }
  },
});

// 向かい風突進：プレイヤーでなく、風上へ。風下の壁ぎわからプレイヤーの横位置に合わせて、風上の壁まで一気に走る（盾を前にして）
PATTERNS_MAP6.windrush = {
  start(world, b, act) {
    const dir = { x: Math.cos(b.facing ?? b.angle), y: Math.sin(b.facing ?? b.angle) };
    // 走る向きは、4方向のうち、いまの盾の向きにいちばん近いもの
    const best = WIND_DIRS.reduce((m, d) => (d.x * dir.x + d.y * dir.y > m.x * dir.x + m.y * dir.y ? d : m), WIND_DIRS[0]);
    act.dirX = best.x;
    act.dirY = best.y;
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.lane = { x: b.x, y: b.y };
    sfx(world, 'bossCharge');
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    const bd = world.bounds;
    const horizontal = act.dirX !== 0;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      // 走り出す壁ぎわ（走る向きの反対側）の、プレイヤーの横位置へ寄る。最後の lockTime 秒だけ、位置を固定する
      if (act.t > def.lockTime || !act.locked) {
        const startX = horizontal ? (act.dirX > 0 ? bd.left + b.r : bd.right - b.r) : clamp(p.x, bd.left + b.r, bd.right - b.r);
        const startY = horizontal ? clamp(p.y, bd.top + b.r, bd.bottom - b.r) : act.dirY > 0 ? bd.top + b.r : bd.bottom - b.r;
        act.lane = { x: startX, y: startY };
        if (act.t <= def.lockTime) act.locked = true;
      }
      const k = Math.min(1, dt * 7);
      b.x += (act.lane.x - b.x) * k;
      b.y += (act.lane.y - b.y) * k;
      if (act.t <= 0) {
        b.x = act.lane.x;
        b.y = act.lane.y;
        act.phase = 'active';
      }
    } else if (act.phase === 'active') {
      b.x += act.dirX * def.speed * dt;
      b.y += act.dirY * def.speed * dt;
      if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
      if (world.rng() < 0.7) burst(world, b.x - act.dirX * b.r, b.y - act.dirY * b.r, COLORS.cyan, 1, 100);
      const touched = clampToBounds(b, world.bounds);
      if (touched) {
        act.phase = 'stun';
        act.t = def.wallStun;
        addShake(world, FEEL.shake.charged);
        burst(world, b.x, b.y, b.color, 20, 260);
        sfx(world, 'explode');
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 乱風（大技）：数秒のあいだ、風向きが every 秒ごとに変わり続け、盾もそのたびに回る。方位撃ちも重なる
PATTERNS_MAP6.stormfury = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.clock = 0;
    act.turns = 0;
    act.volleys = 0;
    sfx(world, 'bossCharge');
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        act.phase = 'active';
        act.clock = 0;
        act.turns = 0;
        act.volleys = 0;
        b.vaneRush = def.vaneTurn;
      }
    } else if (act.phase === 'active') {
      act.clock += dt;
      if (act.clock >= act.turns * def.every) {
        const prev = windDir(world);
        let next;
        for (let tries = 0; tries < 6; tries++) {
          next = WIND_DIRS[Math.floor(world.rng() * WIND_DIRS.length) % WIND_DIRS.length];
          if (!prev || next.x !== prev.x || next.y !== prev.y) break;
        }
        setWind(world, next.x, next.y, { blow: def.duration + 1 });
        act.turns++;
      }
      if (act.clock >= act.volleys * def.volleyGap + 0.5) {
        const offset = (act.volleys % 2) * (Math.PI / 4) + act.volleys * 0.2;
        compassShots(world, b, act, def, offset);
        act.volleys++;
      }
      if (act.clock >= def.duration) {
        clearWind(world);
        b.vaneRush = null;
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// ---- サイクロン ----

// 竜巻：竜巻が count 本、ボスのまわりに出て、プレイヤーへ寄ってくる
PATTERNS_MAP6.twister = timed({
  fire(world, b, act) {
    const def = act.def;
    for (let i = 0; i < def.count; i++) {
      const a = (i * Math.PI * 2) / def.count + world.rng();
      const h = makeTwister(world, def, b.x + Math.cos(a) * (b.r + 80), b.y + Math.sin(a) * (b.r + 80), b.color);
      clampToBounds(Object.assign(h, { r: 0 }), world.bounds);
      act.hs.push(h);
    }
    sfx(world, 'bossCharge');
  },
  finished(world, b, act, dt) {
    // 竜巻が消えるのは待たない（少ししたら次の行動へ）
    act.clock = (act.clock ?? 0) + dt;
    return act.clock >= act.def.hold;
  },
});

// 巻き上げ投げ：瓦礫を巻き上げて、ボスのまわりを回らせる。そのあと、1個ずつ、プレイヤーめがけて飛ばす。回っている間に壊せる
PATTERNS_MAP6.sweepup = timed({
  fire(world, b, act) {
    const def = act.def;
    const [scale, hpScale] = SCALE(world);
    const kind = DATA.enemies.get(def.enemy);
    for (let i = 0; i < def.count; i++) {
      const a = (i * Math.PI * 2) / def.count;
      const e = createEnemy(kind, b.x + Math.cos(a) * def.orbit, b.y + Math.sin(a) * def.orbit, 0.2, world.rng, scale, hpScale);
      Object.assign(e, { owner: b, orbitAngle: a, orbitR: def.orbit, orbitSpin: def.spin, flingAt: world.time + def.hold + i * def.gap, flingSpeed: def.flingSpeed, state: 'orbit' });
      e.expire = world.time + def.hold + def.count * def.gap + 4;
      world.enemies.push(e);
      act.hs.push(e);
    }
    sfx(world, 'enemyShot');
  },
});

// 渦巻きの弾：曲がりながら飛ぶ弾を、arms 本の腕に分けて撃つ。腕ごとに曲がる向きが逆
PATTERNS_MAP6.swirlshot = timed({
  fire(world, b, act) {
    act.clock = 0;
    act.fired = 0;
    act.base = Math.atan2(act.dirY, act.dirX);
  },
  finished(world, b, act, dt) {
    const def = act.def;
    act.clock += dt;
    while (act.fired < def.shots && act.clock >= act.fired * def.gap) {
      for (let k = 0; k < def.arms; k++) {
        const a = act.base + (k * Math.PI * 2) / def.arms + act.fired * def.step * DEG;
        world.hazards.push({ type: 'curveshot', x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, ang: a, turn: (k % 2 === 0 ? 1 : -1) * def.turn, speed: def.speed, r: def.radius, damage: def.damage, life: def.life, age: 0, color: b.color });
      }
      act.fired++;
      if (act.fired % 3 === 0) sfx(world, 'enemyShot');
    }
    return act.fired >= def.shots && act.clock >= def.shots * def.gap + 1.5;
  },
});

// 螺旋落雷：ボスから外へ、螺旋の形に、落雷の予告が並ぶ。内側から順に落ちる
PATTERNS_MAP6.spiralbolt = timed({
  fire(world, b, act) {
    const def = act.def;
    const start = world.rng() * Math.PI * 2;
    const dir = world.rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < def.count; i++) {
      const r = def.inner + i * def.step;
      const a = start + dir * i * def.turn;
      const x = b.x + Math.cos(a) * r;
      const y = b.y + Math.sin(a) * r;
      if (!inside(world, x, y, 6)) continue;
      pushMark(world, act, b, { x, y, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, color: ELEMENT_BOLT });
    }
    sfx(world, 'warning');
  },
});

const ELEMENT_BOLT = '#fff36b';

// 渦巻き突進：曲がりながら突進する（円弧の道）。予告で道の線が見える。壁に当たると隙
PATTERNS_MAP6.cycloneram = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.heading = Math.atan2(d.dy, d.dx);
    act.sign = world.rng() < 0.5 ? 1 : -1;
    act.dirX = Math.cos(act.heading);
    act.dirY = Math.sin(act.heading);
    act.time = 0;
    act.preview = [];
    sfx(world, 'bossCharge');
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t > def.lockTime) act.heading = Math.atan2(d.dy, d.dx);
      act.dirX = Math.cos(act.heading);
      act.dirY = Math.sin(act.heading);
      // 道の予告（曲がりながら進む線）
      act.preview.length = 0;
      let x = b.x;
      let y = b.y;
      let h = act.heading;
      for (let i = 0; i < 36; i++) {
        x += Math.cos(h) * def.speed * 0.035;
        y += Math.sin(h) * def.speed * 0.035;
        h += act.sign * def.curve * 0.035;
        act.preview.push({ x, y });
      }
      if (act.t <= 0) act.phase = 'active';
    } else if (act.phase === 'active') {
      act.time += dt;
      act.heading += act.sign * def.curve * dt;
      act.dirX = Math.cos(act.heading);
      act.dirY = Math.sin(act.heading);
      b.x += act.dirX * def.speed * dt;
      b.y += act.dirY * def.speed * dt;
      if (world.rng() < 0.7) burst(world, b.x - act.dirX * b.r, b.y - act.dirY * b.r, b.color, 1, 100);
      if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
      const touched = clampToBounds(b, world.bounds);
      if (touched) {
        act.phase = 'stun';
        act.t = def.wallStun;
        addShake(world, FEEL.shake.charged);
        burst(world, b.x, b.y, b.color, 20, 260);
        sfx(world, 'explode');
      } else if (act.time >= def.duration) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 台風の目（大技）：部屋ぜんたいが暴風圏。外にいる間はダメージ。真ん中の安全な円（目）にだけ入れる。竜巻も重なる
PATTERNS_MAP6.eyestorm = timed({
  fire(world, b, act) {
    const def = act.def;
    const bd = world.bounds;
    const h = {
      type: 'stormeye', x: (bd.left + bd.right) / 2, y: (bd.top + bd.bottom) / 2, r: def.eye, r0: def.eye, r1: def.eyeEnd, age: 0, life: def.duration, drift: def.drift, tick: def.tick, acc: 0,
      damage: def.damage, twister: def.twister, twisterT: 0.5, wait: 0.6, color: b.color,
    };
    world.hazards.push(h);
    act.hs.push(h);
    addShake(world, FEEL.shake.charged);
    sfx(world, 'explode');
  },
});

export function installMap6(PATTERNS_TABLE, HAZARD_TYPES) {
  Object.assign(PATTERNS_TABLE, PATTERNS_MAP6);
  Object.assign(HAZARD_TYPES, HAZARDS_MAP6);
}
