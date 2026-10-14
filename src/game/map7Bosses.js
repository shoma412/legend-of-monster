// マップ7のボスの、そのボスだけの攻撃。共通の部品は使わない（docs/詳細仕様.md「新しいボスを作るときの決まり」）。
//   ゲートキーパー: gateclose 閉門 / holdshots 検問弾 / callguards 衛兵召喚 / fissure 裂け目 / tailbomb 尾行爆弾 / lockdown 全門閉鎖（大技）
// 残る床や線は hazard（world.hazards）として置き、動きは HAZARDS_MAP7 の update、絵は src/render/map7Draw.js の draw で扱う。
import { FEEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS } from '../data/theme.js';
import { distToSegment } from '../logic/geometry.js';
import { clamp, timed } from './bossKit.js';
import { hurtPlayer } from './combat.js';
import { createEnemy } from './enemyAI.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';

const DEG = Math.PI / 180;
const SCALE = (world) => [world.room.enemyScale ?? 1, world.room.hpScale ?? 1];

// 門板をつくる：axis 'x' なら左右から、'y' なら上下から閉まる。lane は、すき間の真ん中（x または y の座標）
function makeSlab(world, def, axis, lane, wait, color) {
  const bd = world.bounds;
  const gap = def.gap;
  const lo = axis === 'x' ? bd.left : bd.top;
  const hi = axis === 'x' ? bd.right : bd.bottom;
  const center = clamp(lane, lo + gap / 2 + 20, hi - gap / 2 - 20);
  return {
    type: 'gateslab', axis, center, gap, wait, phase: 'warn', warn: def.warn, warnMax: def.warn, hold: def.hold, speed: def.speed, trav: 0,
    maxA: center - gap / 2 - lo, maxB: hi - center - gap / 2, damage: def.damage, color,
  };
}

// ---- ハザード（残る攻撃）の動き ----
export const HAZARDS_MAP7 = {
  // 門板：予告のあと、両側から勢いよく閉まる。板の中にいると当たる。すき間（gap）の中なら当たらない
  gateslab: {
    update(world, h, dt) {
      const p = world.player;
      const bd = world.bounds;
      if (h.wait > 0) {
        h.wait -= dt;
        return;
      }
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn <= 0) {
          h.phase = 'close';
          sfx(world, 'swingHeavy');
        }
        return;
      }
      if (h.phase === 'close') {
        h.trav = Math.min(1, h.trav + (h.speed * dt) / Math.max(h.maxA, h.maxB, 1));
        if (h.trav >= 1) {
          h.phase = 'hold';
          h.t = 0;
          addShake(world, FEEL.shake.charged);
          burst(world, p.x, p.y, h.color, 6, 120);
        }
      } else if (h.phase === 'hold') {
        h.t += dt;
        if (h.t >= h.hold) h.phase = 'open';
      } else {
        h.trav = Math.max(0, h.trav - (h.speed * 0.6 * dt) / Math.max(h.maxA, h.maxB, 1));
        if (h.trav <= 0) {
          h.dead = true;
          return;
        }
      }
      // 当たり判定：板の中（全体の長さにわたる帯）にいるか
      const pos = h.axis === 'x' ? p.x : p.y;
      const lo = h.axis === 'x' ? bd.left : bd.top;
      const hi = h.axis === 'x' ? bd.right : bd.bottom;
      if (pos - p.r < lo + h.maxA * h.trav || pos + p.r > hi - h.maxB * h.trav) hurtPlayer(world, h.damage);
    },
  },

  // 検問弾：ボスのまわりに浮かんで止まり（hold 秒）、そのあと、そのときのプレイヤーの位置めがけて飛ぶ
  holdshot: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        return;
      }
      h.age += dt;
      if (h.phase === 'hold') {
        if (h.age >= h.hold) {
          h.phase = 'fly';
          h.ang = Math.atan2(p.y - h.y, p.x - h.x);
          sfx(world, 'enemyShot');
        }
        return;
      }
      h.x += Math.cos(h.ang) * h.speed * dt;
      h.y += Math.sin(h.ang) * h.speed * dt;
      if (Math.hypot(p.x - h.x, p.y - h.y) <= h.r + p.r && hurtPlayer(world, h.damage)) {
        burst(world, h.x, h.y, h.color, 8, 180);
        h.dead = true;
      }
      const bd = world.bounds;
      if (h.age > h.hold + 6 || h.x < bd.left - 60 || h.x > bd.right + 60 || h.y < bd.top - 60 || h.y > bd.bottom + 60) h.dead = true;
    },
  },

  // 裂け目：ボスから一直線に、床が割れる。予告の線のあと、一瞬だけ当たる
  fissure: {
    update(world, h, dt) {
      const p = world.player;
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn <= 0) {
          h.phase = 'erupt';
          h.t = 0;
          sfx(world, 'explode');
          addShake(world, FEEL.shake.hit);
        }
        return;
      }
      h.t += dt;
      const x2 = h.x + Math.cos(h.ang) * h.len;
      const y2 = h.y + Math.sin(h.ang) * h.len;
      if (distToSegment(p.x, p.y, h.x, h.y, x2, y2) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      if (h.t >= 0.3) h.dead = true;
    },
  },

  // 尾行爆弾：プレイヤーを追いかけて、触れるか、導火線が燃え尽きると爆発する。爆発の範囲にいると当たる
  tailbomb: {
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
      h.x += (dx / dist) * h.speed * dt;
      h.y += (dy / dist) * h.speed * dt;
      if (dist <= h.r + p.r + 4 || h.age >= h.fuse) {
        if (Math.hypot(p.x - h.x, p.y - h.y) <= h.blast + p.r) hurtPlayer(world, h.damage);
        ring(world, h.x, h.y, h.blast, h.color);
        burst(world, h.x, h.y, h.color, 26, 300);
        addShake(world, FEEL.shake.hit);
        sfx(world, 'explode');
        h.dead = true;
      }
    },
  },
};

export const PATTERNS_MAP7 = {
  // 閉門：予告の帯（赤）のあと、両側から門板が閉まる。waves 回（向きは交互）。すき間の位置は、プレイヤーのいる所に合わせる
  gateclose: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      let axis = world.rng() < 0.5 ? 'x' : 'y';
      for (let i = 0; i < def.waves; i++) {
        const lane = axis === 'x' ? p.x : p.y;
        // 2回目以降は、少しずらす（その場に居続けないように）
        const shift = i === 0 ? 0 : (world.rng() < 0.5 ? -1 : 1) * def.gap * 0.9;
        const h = makeSlab(world, def, axis, lane + shift, i * def.stagger, b.color);
        world.hazards.push(h);
        act.hs.push(h);
        axis = axis === 'x' ? 'y' : 'x';
      }
      sfx(world, 'warning');
    },
  }),

  // 検問弾：ボスのまわりに count 発が浮かび、hold 秒止まったあと、stagger 秒ずつずれて、プレイヤーめがけて飛ぶ
  holdshots: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const a = (i * Math.PI * 2) / def.count + world.rng() * 0.3;
        const h = {
          type: 'holdshot', x: b.x + Math.cos(a) * (b.r + def.ring), y: b.y + Math.sin(a) * (b.r + def.ring), ang: a, phase: 'hold', wait: 0, age: -i * def.stagger,
          hold: def.hold, speed: def.speed, r: def.radius, damage: def.damage, color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // 衛兵召喚：盾を持った門衛が count 体、プレイヤーのまわりに出る（life 秒で消える）。体力は hpMul 倍
  callguards: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const [scale, hpScale] = SCALE(world);
      const kind = DATA.enemies.get(def.enemy);
      for (let i = 0; i < def.count; i++) {
        const a = (i * Math.PI * 2) / def.count + world.rng();
        const e = createEnemy(kind, p.x + Math.cos(a) * def.spread, p.y + Math.sin(a) * def.spread, 0.5, world.rng, scale, hpScale);
        e.x = clamp(e.x, world.bounds.left + 30, world.bounds.right - 30);
        e.y = clamp(e.y, world.bounds.top + 30, world.bounds.bottom - 30);
        e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * def.hpMul));
        e.expire = world.time + def.life;
        world.enemies.push(e);
        act.hs.push(e);
      }
      floatText(world, b.x, b.y - b.r - 14, 'Guards', COLORS.cyan, 14);
      sfx(world, 'warning');
    },
    finished(world, b, act, dt) {
      act.clock = (act.clock ?? 0) + dt;
      return act.clock >= act.def.hold;
    },
  }),

  // 裂け目：プレイヤーのほうへ、床の裂け目が count 本（spread 度ずつ開く）走る
  fissure: timed({
    fire(world, b, act) {
      const def = act.def;
      const base = Math.atan2(act.dirY, act.dirX);
      for (let i = 0; i < def.count; i++) {
        const a = base + (def.count > 1 ? (i - (def.count - 1) / 2) * def.spread * DEG : 0);
        const h = { type: 'fissure', x: b.x, y: b.y, ang: a, len: def.len, width: def.width, phase: 'warn', warn: def.warn, warnMax: def.warn, t: 0, damage: def.damage, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),

  // 尾行爆弾：プレイヤーを追いかける爆弾が count 個。fuse 秒で爆発する。触れても爆発する
  tailbomb: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const a = (i * Math.PI * 2) / def.count + world.rng();
        const h = {
          type: 'tailbomb', x: b.x + Math.cos(a) * (b.r + 20), y: b.y + Math.sin(a) * (b.r + 20), speed: def.speed, fuse: def.fuse, age: 0, wait: i * def.stagger,
          r: 12, blast: def.blast, damage: def.damage, color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // 全門閉鎖（大技）：門板の波が、向きを変えながら、次々と閉まる。すき間は、毎回プレイヤーの近くにできる。検問弾も重なる
  lockdown: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      let axis = world.rng() < 0.5 ? 'x' : 'y';
      for (let i = 0; i < def.waves; i++) {
        const base = axis === 'x' ? p.x : p.y;
        const shift = (world.rng() - 0.5) * def.gap * 2.2;
        const h = makeSlab(world, def, axis, base + shift, i * def.every, b.color);
        h.laneFollow = true;
        world.hazards.push(h);
        act.hs.push(h);
        axis = axis === 'x' ? 'y' : 'x';
      }
      // 検問弾
      for (let i = 0; i < def.shots; i++) {
        const a = (i * Math.PI * 2) / def.shots;
        const h = {
          type: 'holdshot', x: b.x + Math.cos(a) * (b.r + 40), y: b.y + Math.sin(a) * (b.r + 40), ang: a, phase: 'hold', wait: 0, age: -i * 0.35 - 1.2,
          hold: def.shotHold, speed: def.shotSpeed, r: 10, damage: def.shotDamage, color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      addShake(world, FEEL.shake.charged);
      sfx(world, 'explode');
    },
  }),
};

export function installMap7(PATTERNS_TABLE, HAZARD_TYPES) {
  Object.assign(PATTERNS_TABLE, PATTERNS_MAP7);
  Object.assign(HAZARD_TYPES, HAZARDS_MAP7);
}
