// マップ2のボス3体（パイプサーペント・タンククラブ・スラッジハイドラ）の、そのボスだけの攻撃。
// 共通の部品は使わない（docs/詳細仕様.md「新しいボスを作るときの決まり」）。部品の名前は、1体のボスにだけ使う。
//   パイプサーペント: burrow 潜行（固有・前からある）/ coilcrush とぐろ締め / pipeburst 配管破裂 / sludgeglob 汚水の塊 / grapple 巻きつき / mudflow 大技「濁流」
//   タンククラブ    : pincerclose はさみ打ち / bubbleswarm 泡の群れ / sidestep 横走り / jetcross 水圧噴射 / rollshell 甲羅転がし / hightide 大技「満潮」
//   スラッジハイドラ: sludgesplit 分裂 / sludgefount 汚泥の噴水 / headsweep 首の掃射 / bogs 泥沼 / entangle 首の絡み / regrowth 大技「大再生」
// 残る床や線は hazard（world.hazards）として置き、動きは HAZARDS の update、絵は src/render/map2Draw.js の draw で扱う。
import { FEEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS } from '../data/theme.js';
import { angleDiff, circlesOverlap, clampToBounds, distToSegment } from '../logic/geometry.js';
import { aim, inside, pushMark, randomSpot, timed } from './bossKit.js';
import { growHead } from './boss.js';
import { hurtPlayer, slowPlayer } from './combat.js';
import { createEnemy } from './enemyAI.js';
import { addShake, burst, floatText, sfx } from './fx.js';

const DEG = Math.PI / 180;
const SCALE = (world) => [world.room.enemyScale ?? 1, world.room.hpScale ?? 1];

// 壁の側の名前と、その壁から見た「奥行き」の向き
const SIDES = [
  { id: 'left', axis: 'x', sign: 1 },
  { id: 'right', axis: 'x', sign: -1 },
  { id: 'top', axis: 'y', sign: 1 },
  { id: 'bottom', axis: 'y', sign: -1 },
];

// 壁から、その方向へ進んだ距離（左・上の壁からは正の向き、右・下の壁からは逆向きに数える）
function depthFrom(bd, side, x, y) {
  if (side.axis === 'x') return side.sign > 0 ? x - bd.left : bd.right - x;
  return side.sign > 0 ? y - bd.top : bd.bottom - y;
}
function crossOf(side, x, y) {
  return side.axis === 'x' ? y : x;
}

// ---- ハザード（残る攻撃）の動き ----
export const HAZARDS_MAP2 = {
  // とぐろ締め：プレイヤーを囲む体の輪が、外から縮む。隙間（gap）から外へ出る
  coil: {
    update(world, h, dt) {
      const p = world.player;
      if (!h.owner || h.owner.dead) {
        h.dead = true;
        return;
      }
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn > h.lock) {
          h.cx = p.x;
          h.cy = p.y;
        }
        if (h.warn <= 0) {
          h.phase = 'close';
          sfx(world, 'bossCharge');
        }
        return;
      }
      h.r = Math.max(h.rEnd, h.r - h.speed * dt);
      const dx = p.x - h.cx;
      const dy = p.y - h.cy;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dist - h.r) <= h.width / 2 + p.r && Math.abs(angleDiff(Math.atan2(dy, dx), h.gapAngle)) > h.gap / 2) hurtPlayer(world, h.damage);
      if (h.r <= h.rEnd) {
        h.hold -= dt;
        if (h.hold <= 0) h.dead = true;
      }
    },
  },

  // 配管破裂：壁の配管が漏れ、予告の線のあと、反対の壁まで水柱が噴く
  jet: {
    update(world, h, dt) {
      const p = world.player;
      h.t += dt;
      if (h.t < h.wait) return;
      const u = h.t - h.wait;
      if (u < h.leak) {
        h.phase = 'leak';
        return;
      }
      if (u < h.leak + h.aimT) {
        h.phase = 'aim';
        return;
      }
      if (u < h.leak + h.aimT + h.fire) {
        if (h.phase !== 'fire') {
          h.phase = 'fire';
          sfx(world, 'swingHeavy');
          addShake(world, FEEL.shake.hit);
        }
        if (distToSegment(p.x, p.y, h.x1, h.y1, h.x2, h.y2) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
        return;
      }
      h.dead = true;
    },
  },

  // 濁流：水の壁が部屋を横切る。配管の柱の真後ろ（波の向きの先）だけが安全
  mudtide: {
    update(world, h, dt) {
      const p = world.player;
      const bd = world.bounds;
      const w = h.waves[h.i];
      if (!w) {
        h.dead = true;
        return;
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
      const along = depthFrom(bd, w, p.x, p.y);
      const across = crossOf(w, p.x, p.y);
      if (along <= h.s + p.r && along >= h.s - h.thick - p.r) {
        const lee = h.pillars.some((pl) => depthFrom(bd, w, pl.x, pl.y) < along && Math.abs(across - crossOf(w, pl.x, pl.y)) <= pl.r + 8);
        if (!lee) hurtPlayer(world, h.damage);
      }
      const total = (w.axis === 'x' ? bd.right - bd.left : bd.bottom - bd.top) + h.thick;
      if (h.s >= total) {
        h.i++;
        if (h.i >= h.waves.length) h.dead = true;
        else {
          h.phase = 'warn';
          h.t = h.warn;
        }
      }
    },
  },

  // はさみ打ち：プレイヤーの左右の爪が、プレイヤーの場所へ向かって閉じる
  claws: {
    update(world, h, dt) {
      const p = world.player;
      const b = h.owner;
      if (!b || b.dead) {
        h.dead = true;
        return;
      }
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn > h.lock) {
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const d = Math.hypot(dx, dy) || 1;
          h.ux = dx / d;
          h.uy = dy / d;
          h.cx = p.x;
          h.cy = p.y;
        }
        if (h.warn <= 0) {
          h.phase = 'close';
          h.t = 0;
          sfx(world, 'bossCharge');
        }
        return;
      }
      if (h.phase === 'close') {
        h.t += dt;
        const k = Math.min(1, h.t / h.close);
        h.s = h.dist0 * (1 - k);
        const px = -h.uy;
        const py = h.ux;
        for (const sign of [-1, 1]) {
          const cx = h.cx + px * sign * h.s;
          const cy = h.cy + py * sign * h.s;
          const relx = p.x - cx;
          const rely = p.y - cy;
          if (Math.abs(relx * px + rely * py) <= h.thick / 2 + p.r && Math.abs(relx * h.ux + rely * h.uy) <= h.len / 2 + p.r) hurtPlayer(world, h.damage);
        }
        if (k >= 1) {
          h.phase = 'hold';
          h.hold = 0.25;
          addShake(world, FEEL.shake.hit);
          sfx(world, 'block');
          burst(world, h.cx, h.cy, h.color, 14, 240);
        }
      } else {
        h.hold -= dt;
        if (h.hold <= 0) h.dead = true;
      }
    },
  },

  // 満潮：水位が部屋の一辺から上がる。水の中は、減速とダメージ。高台（安全の円）の上だけが助かる
  tide: {
    level(h) {
      const pulse = h.pulses[h.i];
      if (!pulse) return 0;
      if (h.phase === 'rise') return pulse.depth * Math.min(1, h.t / h.rise);
      if (h.phase === 'hold') return pulse.depth;
      if (h.phase === 'drain') return pulse.depth * Math.max(0, 1 - h.t / h.drain);
      return 0;
    },
    inWater(world, h, x, y, r) {
      const pulse = h.pulses[h.i];
      const bd = world.bounds;
      const d = HAZARDS_MAP2.tide.level(h);
      if (d <= 0) return false;
      if (pulse.id === 'bottom') return y + r > bd.bottom - d;
      if (pulse.id === 'top') return y - r < bd.top + d;
      if (pulse.id === 'left') return x - r < bd.left + d;
      return x + r > bd.right - d;
    },
    update(world, h, dt) {
      const p = world.player;
      if (!h.pulses[h.i]) {
        h.dead = true;
        return;
      }
      h.t += dt;
      if (h.phase === 'warn' && h.t >= h.warn) {
        h.phase = 'rise';
        h.t = 0;
        sfx(world, 'warning');
      } else if (h.phase === 'rise' && h.t >= h.rise) {
        h.phase = 'hold';
        h.t = 0;
      } else if (h.phase === 'hold' && h.t >= h.hold) {
        h.phase = 'drain';
        h.t = 0;
      } else if (h.phase === 'drain' && h.t >= h.drain) {
        h.i++;
        h.phase = 'warn';
        h.t = 0;
        if (h.i >= h.pulses.length) h.dead = true;
        return;
      }
      h.acc += dt;
      if (h.acc >= h.tick) {
        h.acc = 0;
        const onIsland = h.islands.some((s) => Math.hypot(p.x - s.x, p.y - s.y) <= s.r);
        if (!onIsland && HAZARDS_MAP2.tide.inWater(world, h, p.x, p.y, p.r)) {
          slowPlayer(world);
          hurtPlayer(world, h.damage);
        }
      }
    },
  },

  // 首の掃射：生きている首が、それぞれ、汚泥の線を扇形に掃く
  headbeams: {
    update(world, h, dt) {
      const b = h.owner;
      const p = world.player;
      if (!b || b.dead) {
        h.dead = true;
        return;
      }
      if (h.warn > 0) {
        h.warn -= dt;
        if (h.warn <= 0) sfx(world, 'zap');
        return;
      }
      h.t += dt;
      const k = Math.min(1, h.t / h.sweepT);
      for (const beam of h.beams) {
        if (beam.head.dead) continue;
        beam.angle = beam.base + (k - 0.5) * h.arc * beam.dir;
        const x2 = beam.head.x + Math.cos(beam.angle) * 1100;
        const y2 = beam.head.y + Math.sin(beam.angle) * 1100;
        if (distToSegment(p.x, p.y, beam.head.x, beam.head.y, x2, y2) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      }
      if (h.t >= h.sweepT) h.dead = true;
    },
  },

  // 泥沼：中心へ、少しずつ引き込まれる（歩けば逆らえる。ダッシュ中は引かれない）。中心に近いとダメージ
  bog: {
    update(world, h, dt) {
      const p = world.player;
      if (h.arm > 0) {
        h.arm -= dt;
        return;
      }
      h.life -= dt;
      h.acc += dt;
      const dx = h.x - p.x;
      const dy = h.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist <= h.r + p.r) {
        slowPlayer(world);
        if (p.dashT <= 0 && world.mode === 'play') {
          p.x += (dx / dist) * h.pull * dt;
          p.y += (dy / dist) * h.pull * dt;
        }
        if (dist <= h.core + p.r && h.acc >= h.tick) {
          h.acc = 0;
          hurtPlayer(world, h.damage);
        }
      }
      if (h.life <= 0) h.dead = true;
    },
  },
};

// ---- ボスの攻撃の部品 ----
export const PATTERNS_MAP2 = {
  // パイプサーペント：とぐろ締め
  coilcrush: timed({
    early: true,
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const h = {
        type: 'coil', owner: b, cx: p.x, cy: p.y, r: def.r0, rEnd: def.rEnd, speed: (def.r0 - def.rEnd) / def.shrink, width: 16, gap: def.gap * DEG, gapAngle: world.rng() * Math.PI * 2,
        phase: 'warn', warn: def.telegraph, warnMax: def.telegraph, lock: def.lockTime ?? 0.35, hold: 0.5, damage: def.damage, color: b.color,
      };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'bossCharge');
    },
  }),

  // パイプサーペント：配管破裂
  pipeburst: timed({
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      for (let i = 0; i < def.count; i++) {
        const side = SIDES[Math.floor(world.rng() * SIDES.length) % SIDES.length];
        let x1;
        let y1;
        let x2;
        let y2;
        if (side.axis === 'x') {
          y1 = bd.top + 60 + world.rng() * (bd.bottom - bd.top - 120);
          y2 = y1;
          x1 = side.sign > 0 ? bd.left : bd.right;
          x2 = side.sign > 0 ? bd.right : bd.left;
        } else {
          x1 = bd.left + 60 + world.rng() * (bd.right - bd.left - 120);
          x2 = x1;
          y1 = side.sign > 0 ? bd.top : bd.bottom;
          y2 = side.sign > 0 ? bd.bottom : bd.top;
        }
        const h = { type: 'jet', x1, y1, x2, y2, t: 0, wait: i * def.gap, leak: def.leak, aimT: def.aim, fire: 0.25, width: def.width, damage: def.damage, phase: 'wait', color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // パイプサーペント：汚水の塊（落ちた場所に減速の床が残り、小さな塊が飛び散る）
  sludgeglob: timed({
    fire(world, b, act) {
      const def = act.def;
      pushMark(world, act, b, {
        x: world.player.x, y: world.player.y, r: def.radius, t: def.delay, damage: def.damage, color: COLORS.green,
        extra: { from: { x: b.x, y: b.y }, pool: def.pool, split: def.split },
      });
      sfx(world, 'enemyShot');
    },
  }),

  // パイプサーペント：巻きつき（当たると巻きつかれる。ダッシュで振りほどける）
  grapple: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      aim(act, d);
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      const p = world.player;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t > def.lockTime) aim(act, d);
        if (act.t <= 0) {
          act.phase = 'active';
          act.t = def.duration;
          sfx(world, 'bossCharge');
        }
      } else if (act.phase === 'active') {
        b.x += act.dirX * def.speed * dt;
        b.y += act.dirY * def.speed * dt;
        const wall = clampToBounds(b, world.bounds);
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r) && p.inv <= 0 && world.mode === 'play' && !p.held) {
          p.held = { boss: b, dx: p.x - b.x, dy: p.y - b.y, t: def.hold, tick: def.tick, tickMax: def.tick, damage: def.damage };
          floatText(world, p.x, p.y - 30, '巻きつき', COLORS.red, 18);
          sfx(world, 'block');
          addShake(world, FEEL.shake.hit);
          act.phase = 'hold';
        } else if (wall || act.t <= 0) {
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else if (act.phase === 'hold') {
        if (!p.held || p.held.boss !== b) {
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // パイプサーペント：大技「濁流」
  mudflow: timed({
    fire(world, b, act) {
      const def = act.def;
      const waves = [];
      let last = -1;
      for (let i = 0; i < def.waves; i++) {
        let k = Math.floor(world.rng() * SIDES.length) % SIDES.length;
        if (k === last) k = (k + 1) % SIDES.length; // 続けて同じ向きにはしない
        waves.push(SIDES[k]);
        last = k;
      }
      const pillars = [];
      for (let i = 0; i < def.pillars; i++) {
        const s = randomSpot(world, 120);
        pillars.push({ x: s.x, y: s.y, r: def.pillarRadius });
      }
      const h = { type: 'mudtide', waves, i: 0, phase: 'warn', t: def.warn, warn: def.warn, s: 0, speed: def.speed, thick: def.thick, damage: def.damage, pillars, color: b.color };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // タンククラブ：はさみ打ち
  pincerclose: timed({
    early: true,
    fire(world, b, act, d) {
      const def = act.def;
      for (let i = 0; i < def.sets; i++) {
        const h = {
          type: 'claws', owner: b, cx: world.player.x, cy: world.player.y, ux: d.dx / d.dist, uy: d.dy / d.dist, dist0: def.dist0, len: def.len, thick: def.thick, close: def.close,
          phase: 'warn', warn: def.telegraph + i * def.setGap, warnMax: def.telegraph + i * def.setGap, lock: def.lockTime ?? 0.3, s: def.dist0, t: 0, hold: 0, damage: def.damage, color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),

  // タンククラブ：泡の群れ（壊せる泡が、ゆっくり寄ってくる。触れると破裂）
  bubbleswarm: timed({
    fire(world, b, act) {
      const def = act.def;
      const kind = DATA.enemies.get(def.enemy);
      const [scale, hpScale] = SCALE(world);
      for (let i = 0; i < def.count; i++) {
        const a = world.rng() * Math.PI * 2;
        const e = createEnemy(kind, b.x + Math.cos(a) * (b.r + 30), b.y + Math.sin(a) * (b.r + 30), 0.3, world.rng, scale, hpScale);
        e.def = { ...e.def, speed: def.speed };
        e.expire = world.time + def.life;
        world.enemies.push(e);
        act.hs.push(e);
      }
      sfx(world, 'enemyShot');
    },
    finished(world, b, act) {
      return act.hs.every((e) => e.dead);
    },
  }),

  // タンククラブ：横走り（横へ素早くずれて、止まるたびに、前へ爪を振る）
  sidestep: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.i = 0;
      act.hs = [];
      aim(act, d);
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      act.t -= dt;
      const begin = () => {
        const side = world.rng() < 0.5 ? 1 : -1;
        const px = -d.dy / d.dist;
        const py = d.dx / d.dist;
        act.vx = (px * side * def.dist) / def.moveT;
        act.vy = (py * side * def.dist) / def.moveT;
        act.phase = 'move';
        act.t = def.moveT;
        sfx(world, 'swing');
      };
      if (act.phase === 'telegraph') {
        aim(act, d);
        if (act.t <= 0) begin();
      } else if (act.phase === 'move') {
        b.x += act.vx * dt;
        b.y += act.vy * dt;
        clampToBounds(b, world.bounds);
        if (act.t <= 0) {
          aim(act, d);
          pushMark(world, act, b, { x: b.x + act.dirX * def.swing, y: b.y + act.dirY * def.swing, r: def.radius, t: def.delay, damage: def.damage, color: b.color });
          act.phase = 'hold';
          act.t = def.hold;
        }
      } else if (act.phase === 'hold') {
        aim(act, d);
        if (act.t <= 0) {
          act.i++;
          if (act.i >= def.count) {
            act.phase = 'recover';
            act.t = def.recover;
          } else begin();
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // タンククラブ：水圧噴射（甲羅の弁から、十字の水の線。止まっては回る）
  jetcross: timed({
    fire(world, b, act, d) {
      act.base = Math.atan2(d.dy, d.dx);
      act.clock = 0;
      act.spawned = 0;
      jetStep(world, b, act);
    },
    finished(world, b, act, dt) {
      const def = act.def;
      act.clock += dt;
      while (act.spawned < def.steps && act.clock >= act.spawned * def.stepGap) jetStep(world, b, act);
      return act.spawned >= def.steps && act.hs.every((h) => h.dead);
    },
  }),

  // タンククラブ：甲羅転がし（甲羅にこもって転がり、壁で跳ね返る）
  rollshell: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      aim(act, d);
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t > def.lockTime) aim(act, d);
        if (act.t <= 0) {
          act.phase = 'roll';
          act.bounces = 0;
          act.t = def.maxTime;
          sfx(world, 'bossCharge');
        }
      } else if (act.phase === 'roll') {
        b.x += act.dirX * def.speed * dt;
        b.y += act.dirY * def.speed * dt;
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        if (clampToBounds(b, bd)) {
          if (b.x <= bd.left + b.r + 0.5 || b.x >= bd.right - b.r - 0.5) act.dirX = -act.dirX;
          if (b.y <= bd.top + b.r + 0.5 || b.y >= bd.bottom - b.r - 0.5) act.dirY = -act.dirY;
          act.bounces++;
          addShake(world, FEEL.shake.hit);
          burst(world, b.x, b.y, b.color, 14, 240);
          sfx(world, 'explode');
          if (act.bounces > def.bounces) {
            act.phase = 'recover';
            act.t = def.recover;
          }
        } else if (act.t <= 0) {
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // タンククラブ：大技「満潮」
  hightide: timed({
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      const pulses = [];
      let last = -1;
      for (let i = 0; i < def.pulses; i++) {
        let k = Math.floor(world.rng() * SIDES.length) % SIDES.length;
        if (k === last) k = (k + 1) % SIDES.length;
        last = k;
        const s = SIDES[k];
        const length = s.axis === 'x' ? bd.right - bd.left : bd.bottom - bd.top;
        pulses.push({ id: s.id, depth: length * def.depth });
      }
      const islands = [];
      for (let i = 0; i < def.islands; i++) {
        const spot = randomSpot(world, 110);
        islands.push({ x: spot.x, y: spot.y, r: def.islandRadius });
      }
      const h = { type: 'tide', pulses, islands, i: 0, phase: 'warn', t: 0, warn: def.warn, rise: def.rise, hold: def.hold, drain: def.drain, tick: def.tick, acc: 0, damage: def.damage, color: b.color };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // スラッジハイドラ：分裂（汚泥のしずくを生む。部屋にいる雑魚が max を超えない範囲で）
  sludgesplit: timed({
    fire(world, b, act) {
      const def = act.def;
      const live = world.enemies.filter((e) => !e.boss && !e.dead && !e.def.prop).length;
      const count = Math.max(0, Math.min(def.count, def.max - live));
      const [scale, hpScale] = SCALE(world);
      for (let i = 0; i < count; i++) {
        const a = (i / Math.max(1, count)) * Math.PI * 2 + world.rng() * 0.6;
        const e = createEnemy(DATA.enemies.get(def.enemy), b.x + Math.cos(a) * (b.r + 50), b.y + Math.sin(a) * (b.r + 50), 0.6, world.rng, scale, hpScale);
        clampToBounds(e, world.bounds);
        world.enemies.push(e);
      }
      burst(world, b.x, b.y, b.color, 18, 260);
      sfx(world, 'enemyShot');
    },
    finished: () => true,
  }),

  // スラッジハイドラ：汚泥の噴水（落ちた場所に、広がり続ける汚泥の床が残る）
  sludgefount: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      for (let i = 0; i < def.count; i++) {
        let spot = { x: p.x, y: p.y };
        if (i > 0) {
          for (let tries = 0; tries < 20; tries++) {
            const a = world.rng() * Math.PI * 2;
            const r = 90 + world.rng() * def.spread;
            spot = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
            if (inside(world, spot.x, spot.y, 30)) break;
          }
        }
        pushMark(world, act, b, { ...spot, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, color: b.color, extra: { from: { x: b.x, y: b.y }, pool: def.pool } });
      }
      sfx(world, 'enemyShot');
    },
  }),

  // スラッジハイドラ：首の掃射（生きている首が、それぞれ、汚泥の線を扇形に掃く。首が倒れているほど、線が減る）
  headsweep: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const heads = world.enemies.filter((e) => e.anchor === b && !e.dead);
      const beams = heads.map((head, i) => ({ head, base: Math.atan2(p.y - head.y, p.x - head.x), angle: 0, dir: i % 2 === 0 ? 1 : -1 }));
      const h = { type: 'headbeams', owner: b, beams, warn: def.warn, warnMax: def.warn, t: 0, sweepT: def.sweepT, arc: def.arc * DEG, width: def.width, damage: def.damage, color: b.color };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'enemyShot');
    },
  }),

  // スラッジハイドラ：泥沼（中心へ引き込まれる床）
  bogs: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const spots = [{ x: p.x, y: p.y }];
      for (let tries = 0; tries < 60 && spots.length < def.count; tries++) {
        const s = randomSpot(world, 90);
        if (spots.every((o) => Math.hypot(o.x - s.x, o.y - s.y) >= def.radius * 1.6)) spots.push(s);
      }
      for (const s of spots) {
        const h = { type: 'bog', x: s.x, y: s.y, r: def.radius, core: def.core, arm: def.arm, armMax: def.arm, life: def.life, pull: def.pull, tick: def.tick, acc: def.tick, damage: def.damage, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // スラッジハイドラ：首の絡み（首が絡みつく。その首を倒せば解ける。解けないと、引き寄せられて叩かれる）
  entangle: {
    start(world, b, act) {
      const p = world.player;
      const heads = world.enemies.filter((e) => e.anchor === b && !e.dead).sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y));
      act.head = heads[0] ?? null;
      act.phase = 'telegraph';
      act.t = act.head ? act.def.telegraph : 0.2;
      if (act.head) act.head.reaching = true;
      sfx(world, 'bossCharge');
    },
    update(world, b, dt, act) {
      const def = act.def;
      const p = world.player;
      act.t -= dt;
      const release = () => {
        if (act.head) act.head.reaching = false;
      };
      if (act.phase === 'telegraph') {
        if (act.t <= 0) {
          const head = act.head;
          if (head && !head.dead && Math.hypot(head.x - p.x, head.y - p.y) <= def.range && world.mode === 'play') {
            p.tether = { head, t: def.hold, damage: def.damage };
            floatText(world, p.x, p.y - 30, '絡みつき', COLORS.magenta, 18);
            act.phase = 'active';
          } else {
            release();
            act.phase = 'recover';
            act.t = def.recover;
          }
        }
      } else if (act.phase === 'active') {
        if (!p.tether || p.tether.head !== act.head) {
          release();
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else if (act.t <= 0) {
        release();
        return true;
      }
      return false;
    },
  },

  // スラッジハイドラ：大技「大再生」（倒された首が、順に生え直す。根元を壊せば止められる）
  regrowth: {
    start(world, b, act) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.roots = [];
      act.volleys = 0;
      sfx(world, 'warning');
    },
    update(world, b, dt, act) {
      const def = act.def;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t <= 0) {
          const alive = new Set(world.enemies.filter((e) => e.anchor === b && !e.dead).map((e) => e.headIndex));
          const kind = DATA.enemies.get(def.root);
          const [scale, hpScale] = SCALE(world);
          const heads = b.def.heads;
          for (let slot = 0; slot < heads.count; slot++) {
            if (alive.has(slot)) continue;
            const a = b.angle + (slot - (heads.count - 1) / 2) * 0.95;
            const e = createEnemy(kind, b.x + Math.cos(a) * heads.orbit, b.y + Math.sin(a) * heads.orbit, 0.2, world.rng, scale, hpScale);
            world.enemies.push(e);
            act.roots.push({ enemy: e, slot, due: act.roots.length * def.gap + def.first, done: false });
          }
          act.phase = 'active';
          act.clock = 0;
          act.nextVolley = def.first;
        }
      } else if (act.phase === 'active') {
        act.clock += dt;
        for (const r of act.roots) {
          if (r.done) continue;
          if (r.enemy.dead) {
            r.done = true; // 根元を壊された：再生は止まる
            floatText(world, r.enemy.x, r.enemy.y - 20, 'Cut', COLORS.cyan, 16);
            sfx(world, 'levelup');
          } else if (act.clock >= r.due) {
            r.done = true;
            r.enemy.dead = true;
            burst(world, r.enemy.x, r.enemy.y, b.color, 14, 240);
            growHead(world, b, r.slot);
            b.hp = Math.min(b.maxHp, b.hp + b.maxHp * def.heal);
            floatText(world, r.enemy.x, r.enemy.y - 20, 'Regrow', COLORS.magenta, 16);
            sfx(world, 'hit');
          }
        }
        // 全部の首が残っているときは、首が一斉に汚泥を撒く（再生するものがない代わり）
        if (act.roots.length === 0 && act.clock >= act.nextVolley && act.volleys < def.volleys) {
          act.volleys++;
          act.nextVolley += def.volleyGap;
          for (const head of world.enemies.filter((e) => e.anchor === b && !e.dead)) {
            for (let k = 0; k < def.ring; k++) {
              const a = (k * Math.PI * 2) / def.ring + act.volleys * 0.3;
              world.shots.push({ x: head.x, y: head.y, vx: Math.cos(a) * def.shotSpeed, vy: Math.sin(a) * def.shotSpeed, r: 7, damage: def.shotDamage, life: 4, slow: false, color: b.color });
            }
          }
          sfx(world, 'enemyShot');
        }
        const rootsDone = act.roots.length > 0 && act.roots.every((r) => r.done);
        const volleysDone = act.roots.length === 0 && act.volleys >= def.volleys && act.clock >= act.nextVolley;
        if (rootsDone || volleysDone) {
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

// 水圧噴射の1段ぶん：ボスを中心にした十字の線を、決まった向きに置く
function jetStep(world, b, act) {
  const def = act.def;
  const a0 = act.base + act.spawned * def.turn * DEG;
  for (const a of [a0, a0 + Math.PI / 2]) {
    const bar = { type: 'bar', x: b.x, y: b.y, angle: a, width: def.width, t: def.delay, max: def.delay, damage: def.damage, color: b.color, flash: 0 };
    world.hazards.push(bar);
    act.hs.push(bar);
  }
  act.spawned++;
}

// bossPatterns.js から呼ぶ：部品とハザードを登録する
export function installMap2(PATTERNS, HAZARD_TYPES) {
  Object.assign(PATTERNS, PATTERNS_MAP2);
  Object.assign(HAZARD_TYPES, HAZARDS_MAP2);
}
