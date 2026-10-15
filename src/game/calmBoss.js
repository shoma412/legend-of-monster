// マップ6の隠しボス「カーム」（凪）の、そのボスだけの攻撃（docs/詳細仕様.md「30. マップ6「送風区」」の「⑤隠しボス」）。共通の部品は使わない。
//   hush      静寂   : 輪が縮んで、静まる。動いている（ダッシュも）と爆ぜる。止まって耐えていれば当たらない弾が、すぐ脇を通る
//   bloom     凪の花 : プレイヤーのまわりに、花の印が、順に咲く。咲いたとき、中にいるとダメージ。そのあと、遅い花びらが放射状に飛ぶ
//   calmwave  無風の輪: ボスから、すき間のある輪が、次々に広がる。すき間（またはダッシュの無敵）で抜ける
//   ebb       引き潮 : 部屋の中心の、安全な円が縮んでいく。円の外にいると、少しずつダメージを受ける
import { COLORS } from '../data/theme.js';
import { angleDiff, circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { clamp, timed } from './bossKit.js';
import { hurtPlayer } from './combat.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';

const DEG = Math.PI / 180;

function shoot(world, x, y, a, speed, r, damage, color) {
  world.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, damage, life: 6, color });
}

export const HAZARDS_CALM = {
  // 静寂の場：見た目だけ（画面全体が静まる）。stage は 'ring'（輪が縮む）／'quiet'（静まっている）
  hushfield: {
    update() {},
  },

  // 凪の花：fuse 秒あとに咲く。咲いたとき、花の中にいるとダメージ。そのあと、花びらを放射状に飛ばす
  bloom: {
    update(world, h, dt) {
      h.t -= dt;
      if (h.t > 0) return;
      const p = world.player;
      if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
      for (let k = 0; k < h.petals; k++) shoot(world, h.x, h.y, h.spin + (k * Math.PI * 2) / h.petals, h.petalSpeed, h.petalRadius, h.petalDamage, h.color);
      burst(world, h.x, h.y, COLORS.cyan, 12, 180);
      sfx(world, 'enemyShot');
      h.dead = true;
    },
  },

  // 引き潮：部屋の中心を中心に、安全な円（r）が、r0 から rEnd まで縮み、hold 秒そのまま。円の外にいると、tick 秒ごとにダメージ（warn 秒は、まだダメージなし）
  ebb: {
    update(world, h, dt) {
      h.age += dt;
      const k = Math.min(1, h.age / h.shrink);
      h.r = h.r0 + (h.rEnd - h.r0) * k;
      if (h.age >= h.warn) {
        h.acc -= dt;
        const p = world.player;
        if (h.acc <= 0 && Math.hypot(p.x - h.x, p.y - h.y) > h.r + p.r * 0.5) {
          hurtPlayer(world, h.damage);
          h.acc = h.tick;
        }
      }
      if (h.age >= h.shrink + h.hold) h.dead = true;
    },
  },

  // 無風の輪：ボスから広がる輪。すき間（gapA を中心に gapW ラジアン）は通れる。ダッシュの無敵でも抜けられる
  calmwave: {
    update(world, h, dt) {
      if (h.delay > 0) {
        h.delay -= dt;
        return;
      }
      const p = world.player;
      h.r += h.speed * dt;
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (!h.done && Math.abs(dist - h.r) < h.width / 2 + p.r) {
        const inGap = Math.abs(angleDiff(Math.atan2(dy, dx), h.gapA)) <= h.gapW / 2;
        if (!inGap && hurtPlayer(world, h.damage)) h.done = true;
      }
      if (h.r > h.max) h.dead = true;
    },
  },
};

export const PATTERNS_CALM = {
  // 静寂：輪が縮む（ringTime 秒）→ 静まる（quiet 秒）→ 花びらの輪が広がる。これを rounds 回くり返す
  hush: timed({
    fire(world, b, act) {
      const def = act.def;
      act.round = 0;
      act.stage = 'ring';
      act.clock = 0;
      act.field = { type: 'hushfield', x: b.x, y: b.y, stage: 'ring', t: 0, max: def.ringTime, quiet: def.quiet, dead: false };
      world.hazards.push(act.field);
      sfx(world, 'warning');
    },
    finished(world, b, act, dt) {
      const def = act.def;
      const p = world.player;
      const f = act.field;
      act.clock += dt;
      if (act.stage === 'ring') {
        f.t = act.clock;
        if (act.clock >= def.ringTime) {
          act.stage = 'quiet';
          act.clock = 0;
          act.px = p.x;
          act.py = p.y;
          act.hit = false;
          f.stage = 'quiet';
          f.t = 0;
          // 止まっていれば当たらない弾：プレイヤーの、すぐ脇（miss px）を通る
          const base = Math.atan2(p.y - b.y, p.x - b.x);
          for (let k = 0; k < def.shots; k++) {
            const side = k % 2 === 0 ? 1 : -1;
            const tx = p.x + Math.cos(base + (Math.PI / 2) * side) * def.miss * (1 + Math.floor(k / 2) * 0.35);
            const ty = p.y + Math.sin(base + (Math.PI / 2) * side) * def.miss * (1 + Math.floor(k / 2) * 0.35);
            shoot(world, b.x, b.y, Math.atan2(ty - b.y, tx - b.x), def.shotSpeed, def.shotRadius, def.damage, b.color);
          }
          sfx(world, 'bossCharge');
        }
      } else {
        f.t = act.clock;
        // 静まっている間に動くと爆ぜる（ダッシュも）。1回の静寂につき1回だけ
        const moved = dt > 0 ? Math.hypot(p.x - act.px, p.y - act.py) / dt : 0;
        act.px = p.x;
        act.py = p.y;
        if (!act.hit && (moved > def.moveLimit || p.dashT > 0)) {
          act.hit = true;
          hurtPlayer(world, def.damage);
          ring(world, p.x, p.y, 60, COLORS.cyan);
          burst(world, p.x, p.y, COLORS.cyan, 16, 240);
          addShake(world, 6);
          floatText(world, p.x, p.y - 36, 'Stir!', COLORS.cyan, 18);
        }
        if (act.clock >= def.quiet) {
          // 静寂がとけて、花びらの輪が広がる
          for (let k = 0; k < def.release; k++) shoot(world, b.x, b.y, (k * Math.PI * 2) / def.release + act.round * 0.3, def.releaseSpeed, def.shotRadius, def.damage, b.color);
          sfx(world, 'enemyShot');
          act.round++;
          if (act.round >= (def.rounds ?? 1)) {
            f.dead = true;
            return true;
          }
          act.stage = 'ring';
          act.clock = 0;
          f.stage = 'ring';
          f.t = 0;
        }
      }
      return false;
    },
  }),

  // 凪の花：count 輪の花が、gap 秒ずつ遅れて、プレイヤーのまわり（spread px 以内）に咲く
  bloom: timed({
    fire(world, b, act) {
      act.clock = 0;
      act.fired = 0;
    },
    finished(world, b, act, dt) {
      const def = act.def;
      const p = world.player;
      act.clock += dt;
      while (act.fired < def.count && act.clock >= act.fired * def.gap) {
        const a = world.rng() * Math.PI * 2;
        const d = world.rng() * def.spread;
        const h = {
          type: 'bloom',
          x: clamp(p.x + Math.cos(a) * d, world.bounds.left + 30, world.bounds.right - 30),
          y: clamp(p.y + Math.sin(a) * d, world.bounds.top + 30, world.bounds.bottom - 30),
          r: def.radius,
          t: def.fuse,
          max: def.fuse,
          damage: def.damage,
          petals: def.petals,
          petalSpeed: def.petalSpeed,
          petalRadius: def.petalRadius,
          petalDamage: def.petalDamage,
          spin: world.rng() * Math.PI,
          color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
        act.fired++;
      }
      return act.fired >= def.count && act.hs.every((h) => h.dead);
    },
  }),

  // 引き潮：安全な円が縮む。円の外は、少しずつダメージ
  ebb: timed({
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      const h = { type: 'ebb', x: (bd.left + bd.right) / 2, y: (bd.top + bd.bottom) / 2, r: def.r0, r0: def.r0, rEnd: def.rEnd, shrink: def.shrink, hold: def.hold, warn: def.warn, age: 0, tick: def.tick, acc: 0, damage: def.damage, color: b.color };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // 無風の輪：waves 本の輪が、stagger 秒ずつ遅れて広がる。すき間は、輪ごとに別の向き
  calmwave: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const toward = Math.atan2(p.y - b.y, p.x - b.x);
      for (let k = 0; k < def.waves; k++) {
        const h = {
          type: 'calmwave',
          x: b.x,
          y: b.y,
          r: b.r,
          delay: k * def.stagger,
          speed: def.speed,
          width: def.width,
          gapA: toward + (world.rng() - 0.5) * def.gapSpread * DEG * 2,
          gapW: def.gapSize * DEG,
          max: Math.hypot(world.bounds.right - world.bounds.left, world.bounds.bottom - world.bounds.top) + 40,
          damage: def.damage,
          color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),
};

export function installCalm(PATTERNS_TABLE, HAZARD_TYPES) {
  Object.assign(PATTERNS_TABLE, PATTERNS_CALM);
  Object.assign(HAZARD_TYPES, HAZARDS_CALM);
}
