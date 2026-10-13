// マップ6のボス（インテーク・ダクトクローラー）の、そのボスだけの攻撃。共通の部品は使わない。
//   インテーク    : inhale 吸引・exhale 吐き出し・fullopen 全開（固有・前からある）/ bladevolley 羽根の乱射 / suctionring 吸気の輪 / downdraft 排気の打ち下ろし
//   ダクトクローラー: sweep 横断・ventburst 熱排気・blowthrough 吹き抜け（固有・前からある）/ spinevolley 鱗の棘 / ductquake 管の振動 / ductbite 噛みつき加速
import { FEEL } from '../data/balance.js';
import { circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { ventSpots } from '../logic/ventSpots.js';
import { pushMark, timed } from './bossKit.js';
import { hurtPlayer } from './combat.js';
import { addShake, burst, ring, sfx } from './fx.js';

const DEG = Math.PI / 180;

export const HAZARDS_MAP6 = {
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

export function installMap6(PATTERNS_TABLE, HAZARD_TYPES) {
  Object.assign(PATTERNS_TABLE, PATTERNS_MAP6);
  Object.assign(HAZARD_TYPES, HAZARDS_MAP6);
}
