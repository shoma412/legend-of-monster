// マップ3のボス3体と隠しボス（スクラップハウンド・ガーダースパイダー・クレーンタイタン・アーキテクト）の、そのボスだけの攻撃。
// 共通の部品は使わない（docs/詳細仕様.md「新しいボスを作るときの決まり」）。部品の名前は、1体のボスにだけ使う。
//   スクラップハウンド: magnet 磁力・orbit 刃の渦（固有・前からある）/ junkbounce 跳ね鉄くず / triplebite 三連噛み / junkpile 鉄くずの山 / junkstorm 大技「鉄くず嵐」
//   ガーダースパイダー: wires 張り糸・girder 橋げた（固有・前からある）/ needles 毒針 / eightlegs 八本脚 / eggs 卵 / webweave 大技「蜘蛛の巣」
//   クレーンタイタン  : weld 溶接ビーム・pendulum 振り子（固有・前からある）/ beamdrop 鉄骨落とし / cranespin クレーン旋回 / rivetgun 鋲打ち / collapse 大技「全層崩落」
//   アーキテクト      : cells 方眼・ink インク流し（固有・前からある）/ plans 設計図 / surveyrun 測量 / prototype 試作機 / finishwork 大技「竣工」
// 残る床や線は hazard（world.hazards）として置き、動きは HAZARDS_MAP3 の update、絵は src/render/map3Draw.js の draw で扱う。
import { FEEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS } from '../data/theme.js';
import { circlesOverlap, clampToBounds, distToSegment } from '../logic/geometry.js';
import { aim, clamp, inside, randomSpot, timed } from './bossKit.js';
import { hurtPlayer } from './combat.js';
import { applyRust } from './bossKit.js';
import { createEnemy } from './enemyAI.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';
import { boardPoints } from './map1Bosses.js';
import { PATTERNS } from './bossPatterns.js';

const SCALE = (world) => [world.room.enemyScale ?? 1, world.room.hpScale ?? 1];

// 壁の側（鉄くずの列・鉄くず嵐の向き）
const SIDES = [
  { id: 'left', axis: 'x', sign: 1 },
  { id: 'right', axis: 'x', sign: -1 },
  { id: 'top', axis: 'y', sign: 1 },
  { id: 'bottom', axis: 'y', sign: -1 },
];

function spawnProp(world, id, x, y, life, extra = {}) {
  const [scale, hpScale] = SCALE(world);
  const e = createEnemy(DATA.enemies.get(id), x, y, 0.15, world.rng, scale, hpScale);
  if (life != null) e.expire = world.time + life;
  Object.assign(e, extra);
  world.enemies.push(e);
  return e;
}

// 弾（敵の弾）を、決まった向きに1発撃つ
function shot(world, x, y, angle, speed, radius, damage, life, color) {
  world.shots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radius, damage, life, slow: false, color });
}

// ---- ハザード（残る攻撃）の動き ----
export const HAZARDS_MAP3 = {
  // 跳ね鉄くず：壁で跳ね返る鉄くず
  junk: {
    update(world, h, dt) {
      const p = world.player;
      const bd = world.bounds;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      let bounced = false;
      if (h.x < bd.left + h.r) {
        h.x = bd.left + h.r;
        h.vx = Math.abs(h.vx);
        bounced = true;
      } else if (h.x > bd.right - h.r) {
        h.x = bd.right - h.r;
        h.vx = -Math.abs(h.vx);
        bounced = true;
      }
      if (h.y < bd.top + h.r) {
        h.y = bd.top + h.r;
        h.vy = Math.abs(h.vy);
        bounced = true;
      } else if (h.y > bd.bottom - h.r) {
        h.y = bd.bottom - h.r;
        h.vy = -Math.abs(h.vy);
        bounced = true;
      }
      if (bounced) {
        h.count++;
        burst(world, h.x, h.y, h.color, 4, 120);
        if (h.count > h.bounces) h.dead = true;
      }
      // rust を書くと、当たったプレイヤーに「錆」が付く（鉄片散らし）
      if (!h.dead && circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r) && hurtPlayer(world, h.damage) && h.rust) applyRust(world, h.rust);
    },
  },

  // 鉄くず嵐：鉄くずの列が部屋を横切る（隙間が2つ）。そのあいだ、ボスのほうへ弱く引かれる
  junkstorm: {
    update(world, h, dt) {
      const p = world.player;
      const bd = world.bounds;
      const b = h.owner;
      if (!b || b.dead) {
        h.dead = true;
        return;
      }
      const w = h.waves[h.i];
      if (!w) {
        h.dead = true;
        return;
      }
      // 弱い磁力
      if (h.pull > 0 && p.dashT <= 0 && world.mode === 'play') {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > b.r + 40) {
          p.x += (dx / dist) * h.pull * dt;
          p.y += (dy / dist) * h.pull * dt;
        }
      }
      if (h.phase === 'warn') {
        h.t -= dt;
        if (h.t <= 0) {
          h.phase = 'run';
          h.s = 0;
          sfx(world, 'warning');
        }
        return;
      }
      h.s += h.speed * dt;
      const horizontal = w.axis === 'x'; // 横向きに進む列
      const length = horizontal ? bd.right - bd.left : bd.bottom - bd.top;
      for (const piece of w.pieces) {
        const along = w.sign > 0 ? (horizontal ? bd.left : bd.top) + h.s : (horizontal ? bd.right : bd.bottom) - h.s;
        const x = horizontal ? along : piece;
        const y = horizontal ? piece : along;
        if (circlesOverlap(x, y, h.pieceRadius, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
      }
      if (h.s >= length + 30) {
        h.i++;
        if (h.i >= h.waves.length) h.dead = true;
        else {
          h.phase = 'warn';
          h.t = h.warn;
        }
      }
    },
  },

  // 毒針：まっすぐ飛んで、止まった場所に毒の床が残る
  needle: {
    update(world, h, dt) {
      const p = world.player;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.traveled += Math.hypot(h.vx, h.vy) * dt;
      if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
      if (h.traveled >= h.range || !inside(world, h.x, h.y, 2)) {
        world.hazards.push({
          type: 'pool', x: h.x, y: h.y, r: h.pool.radius, arm: h.pool.arm, armMax: h.pool.arm, life: h.pool.life, tick: h.pool.tick, acc: h.pool.tick, damage: h.pool.damage, slow: false, dot: h.pool.dot, color: h.color,
        });
        burst(world, h.x, h.y, h.color, 6, 140);
        h.dead = true;
      }
    },
  },

  // 八本脚：プレイヤーを中心に、8方向（45度ずつ）から脚が順に突き出る
  legs: {
    update(world, h, dt) {
      const p = world.player;
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn > h.lock) {
          h.cx = p.x;
          h.cy = p.y;
        }
        if (h.warn <= 0) {
          h.phase = 'run';
          h.t = 0;
        }
        return;
      }
      h.t += dt;
      h.legs.forEach((leg, i) => {
        const start = i * h.gap;
        if (h.t >= start && h.t < start + h.flash) {
          if (!leg.hit) {
            leg.hit = true;
            sfx(world, 'swing');
          }
          const x2 = h.cx + Math.cos(leg.angle) * h.length;
          const y2 = h.cy + Math.sin(leg.angle) * h.length;
          if (distToSegment(p.x, p.y, h.cx, h.cy, x2, y2) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
        }
      });
      if (h.t > h.legs.length * h.gap + h.flash) h.dead = true;
    },
  },

  // 鉄骨落とし：予告の影のあと、長い鉄骨が落ちる
  beam: {
    update(world, h, dt) {
      const p = world.player;
      h.t += dt;
      if (h.t < h.wait) return;
      const u = h.t - h.wait;
      if (u < h.warn) {
        h.phase = 'warn';
        return;
      }
      if (u < h.warn + h.flash) {
        if (h.phase !== 'fall') {
          h.phase = 'fall';
          addShake(world, FEEL.shake.hit);
          sfx(world, 'explode');
          burst(world, h.x, h.y, h.color, 12, 240);
        }
        const dx = Math.cos(h.angle) * h.length * 0.5;
        const dy = Math.sin(h.angle) * h.length * 0.5;
        if (distToSegment(p.x, p.y, h.x - dx, h.y - dy, h.x + dx, h.y + dy) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
        return;
      }
      h.dead = true;
    },
  },

  // クレーン旋回：長い腕が、ボスを中心に回る。腕の根元（inner px 以内）は安全
  cranearm: {
    update(world, h, dt) {
      const p = world.player;
      const b = h.owner;
      if (!b || b.dead) {
        h.dead = true;
        return;
      }
      if (h.warn > 0) {
        h.warn -= dt;
        if (h.warn <= 0) sfx(world, 'bossCharge');
        return;
      }
      const step = h.speed * dt;
      h.angle += step * h.dir;
      h.swept += step;
      const x1 = b.x + Math.cos(h.angle) * h.inner;
      const y1 = b.y + Math.sin(h.angle) * h.inner;
      const x2 = b.x + Math.cos(h.angle) * h.length;
      const y2 = b.y + Math.sin(h.angle) * h.length;
      if (distToSegment(p.x, p.y, x1, y1, x2, y2) <= h.width / 2 + p.r || circlesOverlap(x2, y2, h.ball, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
      if (h.swept >= h.total) h.dead = true;
    },
  },

  // 鋲打ち：まっすぐ飛んで床に刺さり、しばらくして、十字に火花を飛ばして爆ぜる
  rivet: {
    update(world, h, dt) {
      const p = world.player;
      if (h.phase === 'fly') {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.traveled += Math.hypot(h.vx, h.vy) * dt;
        if (h.traveled >= h.range || !inside(world, h.x, h.y, 2)) {
          h.phase = 'stuck';
          h.fuse = h.fuseT;
          sfx(world, 'block');
        }
        return;
      }
      h.fuse -= dt;
      if (h.fuse <= 0) {
        if (circlesOverlap(h.x, h.y, h.radius, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
        for (let k = 0; k < 4; k++) shot(world, h.x, h.y, (k * Math.PI) / 2, h.sparkSpeed, 7, h.sparkDamage, h.sparkLife, h.color);
        ring(world, h.x, h.y, h.radius, h.color);
        burst(world, h.x, h.y, h.color, 16, 260);
        sfx(world, 'explode');
        h.dead = true;
      }
    },
  },

  // 設計図：長方形の枠が出て、そのあと、鉄骨の壁として建つ。建つとき、中にいるとダメージ
  plan: {
    update(world, h, dt) {
      const p = world.player;
      h.t -= dt;
      if (h.t > 0) return;
      for (const r of h.rects) {
        if (p.x + p.r > r.x - r.w / 2 && p.x - p.r < r.x + r.w / 2 && p.y + p.r > r.y - r.h / 2 && p.y - p.r < r.y + r.h / 2) hurtPlayer(world, h.damage);
        for (let x = r.x - r.w / 2 + h.step / 2; x < r.x + r.w / 2; x += h.step) {
          for (let y = r.y - r.h / 2 + h.step / 2; y < r.y + r.h / 2; y += h.step) {
            if (Math.hypot(x - h.owner.x, y - h.owner.y) < h.owner.r + 16) continue;
            spawnProp(world, h.block, x, y, h.life);
          }
        }
        burst(world, r.x, r.y, h.color, 10, 220);
      }
      sfx(world, 'block');
      addShake(world, FEEL.shake.hit);
      h.dead = true;
    },
  },

  // 測量：測量の点が、基板のような線の上を走り、通った場所に柱が建つ
  surveyor: {
    update(world, h, dt) {
      const p = world.player;
      if (h.warn > 0) {
        h.warn -= dt;
        return;
      }
      if (h.edge >= h.route.length - 1) {
        h.dead = true;
        return;
      }
      const a = h.route[h.edge];
      const c = h.route[h.edge + 1];
      const len = Math.hypot(c.x - a.x, c.y - a.y);
      const move = h.speed * dt;
      h.f += move / len;
      h.travel += move;
      h.x = a.x + (c.x - a.x) * Math.min(1, h.f);
      h.y = a.y + (c.y - a.y) * Math.min(1, h.f);
      while (h.travel >= h.nextPillar) {
        h.nextPillar += h.spacing;
        if (Math.hypot(h.x - p.x, h.y - p.y) > p.r + 22) spawnProp(world, h.block, h.x, h.y, h.life);
      }
      if (circlesOverlap(h.x, h.y, 11, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
      if (h.f >= 1) {
        h.edge++;
        h.f = 0;
      }
    },
  },
};

// ---- ボスの攻撃の部品 ----
export const PATTERNS_MAP3 = {
  // スクラップハウンド：跳ね鉄くず
  junkbounce: timed({
    fire(world, b, act) {
      const def = act.def;
      const base = Math.atan2(act.dirY, act.dirX);
      for (let i = 0; i < def.count; i++) {
        const a = base + (def.count > 1 ? (i / (def.count - 1) - 0.5) * def.spread * (Math.PI / 180) : 0);
        const h = { type: 'junk', x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, r: def.radius, count: 0, bounces: def.bounces, damage: def.damage, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // スクラップハウンド：三連噛み（3回続けて噛みつきの突進。通った道に、鉄くずのトゲが残る）
  triplebite: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.i = 0;
      aim(act, d);
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      const p = world.player;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t > def.lockTime) aim(act, d);
        if (act.t <= 0) {
          act.phase = 'bite';
          act.t = def.duration;
          act.spike = 0;
          sfx(world, 'bossCharge');
        }
      } else if (act.phase === 'bite') {
        b.x += act.dirX * def.speed * dt;
        b.y += act.dirY * def.speed * dt;
        act.spike -= dt;
        if (act.spike <= 0) {
          act.spike = def.spikeEvery;
          world.hazards.push({ type: 'pool', x: b.x - act.dirX * b.r, y: b.y - act.dirY * b.r, r: def.spike.radius, arm: def.spike.arm, armMax: def.spike.arm, life: def.spike.life, tick: def.spike.tick, acc: def.spike.tick, damage: def.spike.damage, slow: false, color: b.color });
        }
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        const wall = clampToBounds(b, world.bounds);
        if (wall || act.t <= 0) {
          act.i++;
          if (act.i >= def.count) {
            act.phase = 'recover';
            act.t = def.recover;
          } else {
            act.phase = 'telegraph';
            act.t = def.repeatTelegraph;
            aim(act, d);
          }
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // スクラップハウンド：鉄くずの山（壊せる山が、2.5秒後に十字に破片を飛ばして爆発する）
  junkpile: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      act.piles = [];
      const base = world.rng() * Math.PI * 2;
      for (let k = 0; k < def.count; k++) {
        const a = base + (k * Math.PI * 2) / def.count;
        const r = 140 + world.rng() * 80;
        const x = clamp(p.x + Math.cos(a) * r, world.bounds.left + 30, world.bounds.right - 30);
        const y = clamp(p.y + Math.sin(a) * r, world.bounds.top + 30, world.bounds.bottom - 30);
        act.piles.push({ e: spawnProp(world, def.pile, x, y, null), due: def.fuse });
      }
      act.clock = 0;
      sfx(world, 'block');
    },
    finished(world, b, act, dt) {
      const def = act.def;
      const p = world.player;
      act.clock += dt;
      let open = 0;
      for (const pile of act.piles) {
        if (pile.done) continue;
        if (pile.e.dead) {
          pile.done = true; // 壊された：爆発しない
          floatText(world, pile.e.x, pile.e.y - 20, 'Defused', COLORS.cyan, 14);
          continue;
        }
        if (act.clock < pile.due) {
          open++;
          continue;
        }
        pile.done = true;
        pile.e.dead = true;
        if (circlesOverlap(pile.e.x, pile.e.y, def.radius, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        for (let k = 0; k < 4; k++) shot(world, pile.e.x, pile.e.y, (k * Math.PI) / 2, def.shotSpeed, 7, def.shotDamage, 1.6, b.color);
        ring(world, pile.e.x, pile.e.y, def.radius, b.color);
        burst(world, pile.e.x, pile.e.y, b.color, 16, 260);
        sfx(world, 'explode');
        addShake(world, FEEL.shake.hit);
      }
      return open === 0;
    },
  }),

  // スクラップハウンド：大技「鉄くず嵐」
  junkstorm: timed({
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      const waves = [];
      let last = -1;
      for (let i = 0; i < def.waves; i++) {
        let k = Math.floor(world.rng() * SIDES.length) % SIDES.length;
        if (k === last) k = (k + 1) % SIDES.length;
        last = k;
        const s = SIDES[k];
        const horizontal = s.axis === 'x';
        const lo = (horizontal ? bd.top : bd.left) + 16;
        const hi = (horizontal ? bd.bottom : bd.right) - 16;
        const gaps = [];
        for (let g = 0; g < def.gaps; g++) gaps.push(lo + world.rng() * (hi - lo - def.gapLength));
        const pieces = [];
        for (let v = lo; v <= hi; v += def.pieceSpacing) {
          if (gaps.some((gp) => v >= gp && v <= gp + def.gapLength)) continue;
          pieces.push(v);
        }
        waves.push({ ...s, pieces, gaps });
      }
      const h = { type: 'junkstorm', owner: b, waves, i: 0, phase: 'warn', t: def.warn, warn: def.warn, s: 0, speed: def.speed, pieceRadius: def.pieceRadius, damage: def.damage, pull: def.pull, color: b.color };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // ガーダースパイダー：毒針
  needles: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const base = Math.atan2(p.y - b.y, p.x - b.x);
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      for (let i = 0; i < def.count; i++) {
        const a = base + (def.count > 1 ? (i / (def.count - 1) - 0.5) * def.spread * (Math.PI / 180) : 0);
        const h = {
          type: 'needle', x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, r: 7, traveled: 0, range: clamp(dist + 40, 220, 620),
          damage: def.damage, pool: def.pool, color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // ガーダースパイダー：八本脚
  eightlegs: timed({
    early: true,
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const order = [...Array(def.legs).keys()];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(world.rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const base = world.rng() * Math.PI;
      const legs = order.map((k) => ({ angle: base + (k * Math.PI * 2) / def.legs, hit: false }));
      const h = { type: 'legs', cx: p.x, cy: p.y, legs, phase: 'warn', warn: def.telegraph, warnMax: def.telegraph, lock: def.lockTime ?? 0.35, t: 0, gap: def.gap, flash: def.flash, length: def.length, width: def.width, damage: def.damage, color: b.color };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'bossCharge');
    },
  }),

  // ガーダースパイダー：卵（壊せる卵が出る。壊さないと、孵化して子蜘蛛が出る）
  eggs: timed({
    fire(world, b, act) {
      const def = act.def;
      act.eggs = [];
      for (let k = 0; k < def.count; k++) {
        const s = randomSpot(world, 70);
        act.eggs.push({ e: spawnProp(world, def.egg, s.x, s.y, null), due: def.hatch, done: false });
      }
      act.clock = 0;
      sfx(world, 'block');
    },
    finished(world, b, act, dt) {
      const def = act.def;
      act.clock += dt;
      let open = 0;
      for (const egg of act.eggs) {
        if (egg.done) continue;
        if (egg.e.dead) {
          egg.done = true;
          floatText(world, egg.e.x, egg.e.y - 18, 'Crack', COLORS.cyan, 14);
          continue;
        }
        if (act.clock < egg.due) {
          open++;
          continue;
        }
        egg.done = true;
        egg.e.dead = true;
        const kind = DATA.enemies.get(def.spawn);
        const [scale, hpScale] = SCALE(world);
        for (let k = 0; k < def.perEgg; k++) {
          const a = (k * Math.PI * 2) / def.perEgg + world.rng();
          const e = createEnemy(kind, egg.e.x + Math.cos(a) * 18, egg.e.y + Math.sin(a) * 18, 0.3, world.rng, scale, hpScale);
          world.enemies.push(e);
        }
        floatText(world, egg.e.x, egg.e.y - 18, 'Hatch', COLORS.red, 16);
        burst(world, egg.e.x, egg.e.y, b.color, 12, 220);
        sfx(world, 'hit');
      }
      return open === 0;
    },
  }),

  // ガーダースパイダー：大技「蜘蛛の巣」
  webweave: timed({
    fire(world, b, act) {
      act.clock = 0;
      act.spawned = 0;
      act.base = world.rng() * Math.PI;
      spawnWeb(world, b, act);
      sfx(world, 'warning');
    },
    finished(world, b, act, dt) {
      const def = act.def;
      act.clock += dt;
      while (act.spawned < def.waves && act.clock >= act.spawned * def.waveGap) spawnWeb(world, b, act);
      return act.spawned >= def.waves && act.hs.every((h) => h.dead);
    },
  }),

  // クレーンタイタン：鉄骨落とし
  beamdrop: timed({
    fire(world, b, act) {
      pushBeams(world, b, act, act.def);
      sfx(world, 'enemyShot');
    },
  }),

  // クレーンタイタン：クレーン旋回
  cranespin: timed({
    fire(world, b, act, d) {
      act.hs.push(makeArm(world, b, act.def, d));
      sfx(world, 'bossCharge');
    },
  }),

  // クレーンタイタン：鋲打ち
  rivetgun: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const base = Math.atan2(p.y - b.y, p.x - b.x);
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      for (let i = 0; i < def.count; i++) {
        const a = base + (def.count > 1 ? (i / (def.count - 1) - 0.5) * def.spread * (Math.PI / 180) : 0);
        const h = {
          type: 'rivet', x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, traveled: 0, range: clamp(dist - 40 + (i - (def.count - 1) / 2) * 50, 160, 640),
          phase: 'fly', fuse: 0, fuseT: def.fuse, radius: def.radius, damage: def.damage, sparkSpeed: def.sparkSpeed, sparkDamage: def.sparkDamage, sparkLife: def.sparkLife, color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // クレーンタイタン：大技「全層崩落」
  collapse: timed({
    fire(world, b, act, d) {
      const def = act.def;
      act.clock = 0;
      act.spawned = 0;
      act.hs.push(makeArm(world, b, def.arm, d));
      pushBeams(world, b, act, def.beams);
      act.spawned = 1;
      sfx(world, 'warning');
    },
    finished(world, b, act, dt) {
      const def = act.def;
      act.clock += dt;
      while (act.spawned < def.waves && act.clock >= act.spawned * def.waveGap) {
        pushBeams(world, b, act, def.beams);
        act.spawned++;
      }
      return act.spawned >= def.waves && act.hs.every((h) => h.dead);
    },
  }),

  // アーキテクト：設計図
  plans: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      const rects = [];
      for (let k = 0; k < def.count; k++) {
        const wide = world.rng() < 0.5;
        const w = wide ? def.long : def.short;
        const h = wide ? def.short : def.long;
        let x;
        let y;
        for (let tries = 0; tries < 30; tries++) {
          const s = k === 0 ? { x: p.x + (world.rng() - 0.5) * 120, y: p.y + (world.rng() - 0.5) * 120 } : randomSpot(world, 40);
          x = clamp(s.x, bd.left + w / 2 + 6, bd.right - w / 2 - 6);
          y = clamp(s.y, bd.top + h / 2 + 6, bd.bottom - h / 2 - 6);
          if (rects.every((r) => Math.abs(r.x - x) > (r.w + w) / 2 + 10 || Math.abs(r.y - y) > (r.h + h) / 2 + 10)) break;
        }
        rects.push({ x, y, w, h });
      }
      const hz = { type: 'plan', owner: b, rects, t: def.warn, warn: def.warn, step: 30, block: def.block, life: def.life, damage: def.damage, color: b.color };
      world.hazards.push(hz);
      act.hs.push(hz);
      sfx(world, 'enemyShot');
    },
  }),

  // アーキテクト：測量
  surveyrun: timed({
    fire(world, b, act) {
      act.hs.push(makeSurvey(world, b, act.def));
      sfx(world, 'enemyShot');
    },
  }),

  // アーキテクト：試作機（壊せる試作機が出る。2体とも壊すと、本体に隙ができる）
  prototype: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let k = 0; k < def.count; k++) {
        const a = (k * Math.PI * 2) / def.count + world.rng();
        const e = spawnProp(world, def.enemy, b.x + Math.cos(a) * (b.r + 80), b.y + Math.sin(a) * (b.r + 80), def.duration);
        clampToBounds(e, world.bounds);
        act.hs.push(e);
      }
      sfx(world, 'enemyShot');
    },
    finished(world, b, act) {
      if (!act.hs.every((e) => e.dead)) return false;
      if (world.time < act.hs[0].expire - 0.05) {
        act.recoverT = act.def.recover + act.def.open;
        floatText(world, b.x, b.y - b.r - 14, 'Prototype Down', COLORS.cyan, 18);
      }
      return true;
    },
  }),

  // アーキテクト：大技「竣工」（方眼と設計図を、順に続ける）
  finishwork: {
    start(world, b, act, d) {
      act.phase = 'work';
      act.steps = act.def.steps.map((name) => ({ name, def: b.def.attacks[name] }));
      act.index = 0;
      act.child = null;
      act.d = d;
    },
    update(world, b, dt, act, d) {
      if (act.phase === 'work') {
        if (!act.child) {
          const step = act.steps[act.index];
          act.child = { name: step.name, def: step.def, phase: '', t: 0, side: true };
          PATTERNS[step.def.pattern].start(world, b, act.child, d);
        }
        if (PATTERNS[act.child.def.pattern].update(world, b, dt, act.child, d)) {
          act.child = null;
          act.index++;
          if (act.index >= act.steps.length) {
            act.phase = 'recover';
            act.t = act.def.recover;
          }
        }
        if (act.child?.dirX != null) {
          act.dirX = act.child.dirX;
          act.dirY = act.child.dirY;
        }
      } else {
        act.t -= dt;
        if (act.t <= 0) return true;
      }
      return false;
    },
  },
};

// 蜘蛛の巣：平行な糸を並べる（向きは、波ごとに変わる）
function spawnWeb(world, b, act) {
  const def = act.def;
  const p = world.player;
  const angle = act.base + act.spawned * (Math.PI / 2) + (world.rng() - 0.5) * 0.4;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const n = def.lines;
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * def.spacing;
    const h = { type: 'wire', x: p.x + nx * off, y: p.y + ny * off, angle, width: 10, arm: def.arm, armMax: def.arm, life: def.life, tick: 0.5, acc: 0.5, damage: def.damage, color: b.color };
    world.hazards.push(h);
    act.hs.push(h);
  }
  act.spawned++;
}

// 鉄骨を、spec.count 本、順に落とす（1本目はプレイヤーの足元）
function pushBeams(world, b, act, spec) {
  const p = world.player;
  for (let i = 0; i < spec.count; i++) {
    const s = i === 0 ? { x: p.x, y: p.y } : { x: p.x + (world.rng() - 0.5) * 2 * spec.spread, y: p.y + (world.rng() - 0.5) * 2 * spec.spread };
    const h = { type: 'beam', x: clamp(s.x, world.bounds.left + 20, world.bounds.right - 20), y: clamp(s.y, world.bounds.top + 20, world.bounds.bottom - 20), angle: world.rng() * Math.PI, length: spec.length, width: spec.width, t: 0, wait: i * spec.stagger, warn: spec.warn, flash: 0.25, damage: spec.damage, phase: 'wait', color: b.color };
    world.hazards.push(h);
    act.hs.push(h);
  }
}

// クレーンの腕を置く（プレイヤーのいる側から、少し手前で始まって、回る）
function makeArm(world, b, spec, d) {
  const dir = world.rng() < 0.5 ? 1 : -1;
  const h = { type: 'cranearm', owner: b, angle: Math.atan2(d.dy, d.dx) - dir * 0.9, dir, speed: spec.speed, total: spec.turns * Math.PI * 2, swept: 0, inner: spec.inner, length: spec.length, width: spec.width, ball: spec.ball, warn: spec.warn, warnMax: spec.warn, damage: spec.damage, color: b.color };
  world.hazards.push(h);
  return h;
}

// 測量の道を作る（基板の線の交差点を、折り返さずにたどる）
function makeSurvey(world, b, def) {
  const points = boardPoints(world.bounds);
  const at = (row, col) => points.find((q) => q.row === row && q.col === col);
  let cur = points[Math.floor(world.rng() * points.length) % points.length];
  let prev = null;
  const route = [cur];
  for (let i = 0; i < def.edges; i++) {
    const options = [at(cur.row - 1, cur.col), at(cur.row + 1, cur.col), at(cur.row, cur.col - 1), at(cur.row, cur.col + 1)].filter((q) => q && q !== prev);
    const next = options[Math.floor(world.rng() * options.length) % options.length];
    prev = cur;
    cur = next;
    route.push(cur);
  }
  const h = { type: 'surveyor', owner: b, route, edge: 0, f: 0, x: route[0].x, y: route[0].y, warn: def.warn, warnMax: def.warn, speed: def.speed, travel: 0, spacing: def.spacing, nextPillar: def.spacing * 0.5, block: def.block, life: def.life, damage: def.damage, color: b.color };
  world.hazards.push(h);
  return h;
}

// bossPatterns.js から呼ぶ：部品とハザードを登録する
export function installMap3(PATTERNS_TABLE, HAZARD_TYPES) {
  Object.assign(PATTERNS_TABLE, PATTERNS_MAP3);
  Object.assign(HAZARD_TYPES, HAZARDS_MAP3);
}

