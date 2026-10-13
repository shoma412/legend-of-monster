// マップ4のボス（ランプイーター・サーチライト・センチネル・ブレーカー・隠しボス ノクターン）の、そのボスだけの攻撃。
// 共通の部品は使わない（docs/詳細仕様.md「新しいボスを作るときの決まり」）。部品の名前は、1体のボスにだけ使う。
//   ランプイーター: douse 消灯・scales 鱗粉（固有・前からある）/ lamptarget 灯り目がけ / windflap 羽ばたきの風 / glowscales 光の鱗
//   センチネル    : searchlight 照射・flare 閃光（固有・前からある）/ sweeplights 探照の掃き / flashring 閃光の輪
//   ブレーカー    : blackout 停電・afterimage 残像（固有・前からある）/ shortout 短絡 / cutterarm 遮断の腕 / railrush 過負荷突進
//   ノクターン    : shadowstep 影踏み・mirror 写し身（固有・前からある）/ leadblade 先読みの刃 / shadowring 影の包囲 / afterwing 黒い羽ばたき
// 残る床や線は hazard（world.hazards）として置き、動きは HAZARDS_MAP4 の update、絵は src/render/map4Draw.js の draw で扱う。
import { FEEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS } from '../data/theme.js';
import { arcHitsCircle, circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { clamp, inside, pushMark, rayToBounds, timed, trackVelocity } from './bossKit.js';
import { blindPlayer, breakLamp, flashLight } from './darkness.js';
import { hurtPlayer } from './combat.js';
import { createEnemy } from './enemyAI.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';
import { boardPoints } from './map1Bosses.js';

const DEG = Math.PI / 180;
const SCALE = (world) => [world.room.enemyScale ?? 1, world.room.hpScale ?? 1];
const HIDE_X = -9000;

// ---- ハザード（残る攻撃）の動き ----
export const HAZARDS_MAP4 = {
  // 扇形の刃（遮断の腕・噛み砕きなど）：予告のあと閉じて、扇の中にいると当たる。track なら、予告の間はプレイヤーを追う
  wedge: {
    update(world, h, dt) {
      const p = world.player;
      const b = h.owner;
      if (!b || b.dead) {
        h.dead = true;
        return;
      }
      if (h.follow) {
        h.x = b.x;
        h.y = b.y;
      }
      if (h.phase === 'wait') {
        h.wait -= dt;
        if (h.wait <= 0) h.phase = 'warn';
        return;
      }
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.track && h.warn > h.lock) h.angle = Math.atan2(p.y - h.y, p.x - h.x) + (h.offset ?? 0);
        if (h.warn <= 0) {
          h.phase = 'snap';
          h.t = 0;
          sfx(world, 'swingHeavy');
          addShake(world, FEEL.shake.hit);
          if (arcHitsCircle(h.x, h.y, h.angle, h.arc, h.radius, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
          burst(world, h.x + Math.cos(h.angle) * h.radius * 0.6, h.y + Math.sin(h.angle) * h.radius * 0.6, h.color, 12, 240);
        }
        return;
      }
      h.t += dt;
      if (h.t >= 0.25) h.dead = true;
    },
  },

  // 探照の掃き：2つの光が、プレイヤーのまわりを回りながら、重なる点を作る。重なった点に、狙撃が落ちる
  crossbeams: {
    cross(h) {
      const dx = h.dirA.x * h.dirB.y - h.dirA.y * h.dirB.x;
      if (Math.abs(dx) < 0.08) return null;
      const s = ((h.B.x - h.A.x) * h.dirB.y - (h.B.y - h.A.y) * h.dirB.x) / dx;
      if (s < 0) return null;
      return { x: h.A.x + h.dirA.x * s, y: h.A.y + h.dirA.y * s };
    },
    update(world, h, dt) {
      const p = world.player;
      if (!h.owner || h.owner.dead) {
        h.dead = true;
        return;
      }
      h.t += dt;
      const qa = { x: p.x + h.orbit * Math.cos(h.spin * h.t), y: p.y + h.orbit * Math.sin(h.spin * h.t) };
      const qb = { x: p.x + h.orbit * Math.cos(Math.PI - h.spin * h.t * 1.3), y: p.y + h.orbit * Math.sin(Math.PI - h.spin * h.t * 1.3) };
      const norm = (from, to) => {
        const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
      };
      h.dirA = norm(h.A, qa);
      h.dirB = norm(h.B, qb);
      h.I = HAZARDS_MAP4.crossbeams.cross(h);
      if (h.t >= h.warm) {
        h.acc += dt;
        if (h.acc >= h.interval && h.I && inside(world, h.I.x, h.I.y, 10)) {
          h.acc = 0;
          world.hazards.push({ type: 'mark', x: h.I.x, y: h.I.y, r: h.strike.radius, t: h.strike.delay, max: h.strike.delay, damage: h.strike.damage, enemyDamage: 0, color: h.color });
          sfx(world, 'enemyShot');
        }
      }
      if (h.t >= h.duration) h.dead = true;
    },
  },

  // 閃光の輪：広がる光の輪。帯に触れると、ダメージと目くらみ
  flashring: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        if (h.wait <= 0) {
          sfx(world, 'zap');
          addShake(world, FEEL.shake.hit);
        }
        return;
      }
      h.r += h.speed * dt;
      const dist = Math.hypot(p.x - h.x, p.y - h.y);
      if (Math.abs(dist - h.r) <= h.width / 2 + p.r) {
        if (hurtPlayer(world, h.damage)) blindPlayer(world, h.blind);
      }
      if (h.r >= h.max) h.dead = true;
    },
  },
};

// ---- ボスの攻撃の部品 ----
export const PATTERNS_MAP4 = {
  // ランプイーター：灯り目がけ（点いている灯りを順に狙って突っ込み、壊す。点いている灯りがなければ、プレイヤーを狙う）
  lamptarget: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.i = 0;
      act.used = new Set();
      pickTarget(world, b, act, d);
      act.t = act.def.telegraph;
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      const p = world.player;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        // 狙いは、最後の lockTime 秒を除いて、目標のほうを向き続ける
        if (!act.target.lamp && act.t > (def.lockTime ?? 0)) {
          act.target = { x: p.x, y: p.y, lamp: null };
          act.reach = Math.hypot(p.x - b.x, p.y - b.y) + 120;
          setDirTo(act, b, act.target);
        }
        if (act.t <= 0) {
          act.phase = 'dash';
          act.t = def.duration;
          act.sx = b.x;
          act.sy = b.y;
          sfx(world, 'bossCharge');
        }
      } else if (act.phase === 'dash') {
        b.x += act.dirX * def.speed * dt;
        b.y += act.dirY * def.speed * dt;
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        const arrived = Math.hypot(b.x - act.target.x, b.y - act.target.y) <= 34 || Math.hypot(b.x - act.sx, b.y - act.sy) >= act.reach;
        const wall = clampToBounds(b, world.bounds);
        if (arrived || wall || act.t <= 0) {
          if (act.target.lamp && Math.hypot(b.x - act.target.x, b.y - act.target.y) <= 60) {
            breakLamp(world, act.target.lamp, def.breakTime);
            floatText(world, act.target.x, act.target.y - 18, 'Snuff', COLORS.magenta, 14);
          }
          act.i++;
          if (act.i >= def.count) {
            act.phase = 'recover';
            act.t = def.recover;
          } else {
            pickTarget(world, b, act, d);
            act.phase = 'telegraph';
            act.t = def.repeatTelegraph;
          }
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // ランプイーター：羽ばたきの風（両羽根から、斜めの風の線が、波になって走る）
  windflap: timed({
    fire(world, b, act) {
      act.clock = 0;
      act.spawned = 0;
      windWave(world, b, act);
    },
    finished(world, b, act, dt) {
      act.clock += dt;
      while (act.spawned < act.def.waves && act.clock >= act.spawned * act.def.stagger) windWave(world, b, act);
      return act.spawned >= act.def.waves && act.hs.every((h) => h.dead);
    },
  }),

  // ランプイーター：光の鱗（壊せる光る鱗が、ゆっくり寄ってくる。壊すと、その場所が明るくなる。触れると破裂する）
  glowscales: timed({
    fire(world, b, act) {
      const def = act.def;
      const kind = DATA.enemies.get(def.enemy);
      const [scale, hpScale] = SCALE(world);
      for (let i = 0; i < def.count; i++) {
        const a = (i * Math.PI * 2) / def.count + world.rng();
        const e = createEnemy(kind, b.x + Math.cos(a) * (b.r + 30), b.y + Math.sin(a) * (b.r + 30), 0.3, world.rng, scale, hpScale);
        e.def = { ...e.def, speed: def.speed };
        e.expire = world.time + def.life;
        world.enemies.push(e);
        act.hs.push(e);
      }
      sfx(world, 'enemyShot');
    },
    finished(world, b, act) {
      for (const e of act.hs) {
        if (e.dead && !e.popped && !e.flashed) {
          e.flashed = true;
          flashLight(world, e.x, e.y);
          floatText(world, e.x, e.y - 16, 'Light', COLORS.cyan, 14);
        }
      }
      return act.hs.every((e) => e.dead);
    },
  }),

  // センチネル：探照の掃き
  sweeplights: timed({
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      const A = { x: bd.left + 6, y: bd.top + (bd.bottom - bd.top) * (0.2 + 0.6 * world.rng()) };
      const B = { x: bd.right - 6, y: bd.top + (bd.bottom - bd.top) * (0.2 + 0.6 * world.rng()) };
      const h = {
        type: 'crossbeams', owner: b, A, B, dirA: { x: 1, y: 0 }, dirB: { x: -1, y: 0 }, I: null, t: 0, warm: def.warm, duration: def.duration, orbit: def.orbit, spin: def.spin,
        acc: def.interval, interval: def.interval, strike: def.strike, color: b.color,
      };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // センチネル：閃光の輪
  flashring: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const h = { type: 'flashring', x: b.x, y: b.y, r: b.r, speed: def.speed, max: def.max, width: def.width, damage: def.damage, blind: def.blind, wait: i * def.gap + 0.001, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
    },
  }),

  // ブレーカー：短絡（配線の交差点が順に光り、そのたびに、電気が走る）
  shortout: timed({
    fire(world, b, act) {
      const def = act.def;
      const points = boardPoints(world.bounds);
      const at = (row, col) => points.find((q) => q.row === row && q.col === col);
      let cur = points[Math.floor(world.rng() * points.length) % points.length];
      let prev = null;
      act.route = [cur];
      for (let i = 1; i < def.count; i++) {
        const options = [at(cur.row - 1, cur.col), at(cur.row + 1, cur.col), at(cur.row, cur.col - 1), at(cur.row, cur.col + 1)].filter((q) => q && q !== prev);
        const next = options[Math.floor(world.rng() * options.length) % options.length];
        prev = cur;
        cur = next;
        act.route.push(cur);
      }
      act.route.forEach((q, i) => pushMark(world, act, b, { x: q.x, y: q.y, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, color: b.color }));
      sfx(world, 'enemyShot');
    },
  }),

  // ブレーカー：遮断の腕（扇形の遮断器が、プレイヤーのほうで閉じる）
  cutterarm: timed({
    early: true,
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.wedges; i++) {
        const h = {
          type: 'wedge', owner: b, x: b.x, y: b.y, follow: true, angle: 0, arc: def.arc * DEG, radius: def.radius, phase: i === 0 ? 'warn' : 'wait', wait: i * def.wedgeGap, warn: def.telegraph, warnMax: def.telegraph,
          lock: def.lockTime ?? 0.3, track: true, offset: i * 90 * DEG, damage: def.damage, t: 0, color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),

  // ブレーカー：過負荷突進（壁の電柱から電柱へ、プレイヤーを通る直線を、一気に走る）
  railrush: {
    start(world, b, act, d) {
      const def = act.def;
      const p = world.player;
      act.phase = 'hide';
      act.t = def.telegraph;
      // プレイヤーを通る直線（向きは、いまのボスからの向きに近い）
      const base = Math.atan2(d.dy, d.dx) + (world.rng() - 0.5) * 1.2;
      act.lineDirX = Math.cos(base);
      act.lineDirY = Math.sin(base);
      act.cx = p.x;
      act.cy = p.y;
      b.hidden = true;
      burst(world, b.x, b.y, b.color, 20, 260);
      b.x = HIDE_X;
      sfx(world, 'bossCharge');
    },
    update(world, b, dt, act) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      act.t -= dt;
      if (act.phase === 'hide') {
        // 予告の間は、プレイヤーを追って線が動く（最後の lockTime 秒だけ止まる）
        if (act.t > def.lockTime) {
          act.cx = p.x;
          act.cy = p.y;
        }
        const back = rayToBounds(bd, act.cx, act.cy, -act.lineDirX, -act.lineDirY, b.r);
        const fwd = rayToBounds(bd, act.cx, act.cy, act.lineDirX, act.lineDirY, b.r);
        act.x1 = act.cx - act.lineDirX * back;
        act.y1 = act.cy - act.lineDirY * back;
        act.x2 = act.cx + act.lineDirX * fwd;
        act.y2 = act.cy + act.lineDirY * fwd;
        if (act.t <= 0) {
          b.hidden = false;
          b.x = act.x1;
          b.y = act.y1;
          act.dirX = act.lineDirX;
          act.dirY = act.lineDirY;
          act.phase = 'dash';
          act.t = Math.hypot(act.x2 - act.x1, act.y2 - act.y1) / def.speed + 0.1;
          sfx(world, 'explode');
          ring(world, b.x, b.y, b.r + 20, b.color);
        }
      } else if (act.phase === 'dash') {
        b.x += act.dirX * def.speed * dt;
        b.y += act.dirY * def.speed * dt;
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        if (clampToBounds(b, bd) || act.t <= 0) {
          act.phase = 'recover';
          act.t = def.recover;
          addShake(world, FEEL.shake.hit);
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // ノクターン：先読みの刃（いま動いている向きの先に、影の刃が落ちる。続けて何回も）
  leadblade: timed({
    fire(world, b, act) {
      act.clock = 0;
      act.spawned = 0;
    },
    finished(world, b, act, dt) {
      const def = act.def;
      const p = world.player;
      trackVelocity(act, p, dt);
      act.clock += dt;
      while (act.spawned < def.count && act.clock >= act.spawned * def.gap) {
        const x = clamp(p.x + act.vx * def.delay, world.bounds.left + 20, world.bounds.right - 20);
        const y = clamp(p.y + act.vy * def.delay, world.bounds.top + 20, world.bounds.bottom - 20);
        pushMark(world, act, b, { x, y, r: def.radius, t: def.delay, damage: def.damage, color: b.color, extra: { from: { x: b.x, y: b.y } } });
        act.spawned++;
        sfx(world, 'enemyShot');
      }
      return act.spawned >= def.count && act.hs.every((h) => h.dead);
    },
  }),

  // ノクターン：影の包囲（プレイヤーのまわりに、影の輪が出て縮む。出口は1か所）
  shadowring: timed({
    early: true,
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const h = {
        type: 'coil', owner: b, cx: p.x, cy: p.y, r: def.r0, rEnd: def.rEnd, speed: (def.r0 - def.rEnd) / def.shrink, width: 16, gap: def.gap * DEG, gapAngle: world.rng() * Math.PI * 2,
        phase: 'warn', warn: def.telegraph, warnMax: def.telegraph, lock: def.lockTime ?? 0.35, hold: 0.4, damage: def.damage, color: b.color,
      };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'bossCharge');
    },
  }),

  // ノクターン：黒い羽ばたき（プレイヤーが通った場所から、影が飛び出して、いまのプレイヤーへ向かう）
  afterwing: {
    start(world, b, act) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.samples = [];
      act.sampleT = 0;
      act.queue = [];
      sfx(world, 'bossCharge');
    },
    update(world, b, dt, act) {
      const def = act.def;
      const p = world.player;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        act.sampleT -= dt;
        if (act.sampleT <= 0) {
          act.sampleT = 0.12;
          act.samples.push({ x: p.x, y: p.y });
        }
        if (act.t <= 0) {
          // 古いほうから、等間隔に count か所。プレイヤーに近すぎる場所は、外す
          const usable = act.samples.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) > 90);
          const pool = usable.length >= def.count ? usable : act.samples;
          for (let i = 0; i < def.count; i++) act.queue.push(pool[Math.min(pool.length - 1, Math.floor((i * pool.length) / def.count))]);
          act.phase = 'active';
          act.clock = 0;
          act.fired = 0;
        }
      } else if (act.phase === 'active') {
        act.clock += dt;
        while (act.fired < act.queue.length && act.clock >= act.fired * def.gap) {
          const s = act.queue[act.fired++];
          const a = Math.atan2(p.y - s.y, p.x - s.x);
          world.shots.push({ x: s.x, y: s.y, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, r: def.radius, damage: def.damage, life: 3, slow: false, color: b.color });
          ring(world, s.x, s.y, 26, b.color);
          sfx(world, 'enemyShot');
        }
        if (act.fired >= act.queue.length) {
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

function setDirTo(act, b, target) {
  const dx = target.x - b.x;
  const dy = target.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  act.dirX = dx / d;
  act.dirY = dy / d;
}

// 灯り目がけ：次に狙う灯り（点いているもののうち、近いもの）を決める。なければ、プレイヤー
function pickTarget(world, b, act, d) {
  const lamps = (world.lamps ?? []).filter((l) => l.on > 0 && !(l.broken > 0) && !act.used.has(l));
  lamps.sort((x, y) => Math.hypot(x.x - b.x, x.y - b.y) - Math.hypot(y.x - b.x, y.y - b.y));
  const lamp = lamps[0] ?? null;
  if (lamp) act.used.add(lamp);
  const p = world.player;
  act.target = lamp ? { x: lamp.x, y: lamp.y, lamp } : { x: p.x, y: p.y, lamp: null };
  act.reach = Math.hypot(act.target.x - b.x, act.target.y - b.y) + 120;
  setDirTo(act, b, act.target);
  void d;
}

// 羽ばたきの風：両羽根から、斜めの風の線（4本）。波ごとに、少しずつ向きがずれる
function windWave(world, b, act) {
  const def = act.def;
  const p = world.player;
  const base = Math.atan2(p.y - b.y, p.x - b.x) + act.spawned * 15 * DEG;
  for (const a of [base + 35 * DEG, base - 35 * DEG, base + Math.PI + 35 * DEG, base + Math.PI - 35 * DEG]) {
    const bar = { type: 'bar', x: b.x, y: b.y, angle: a, width: def.width, t: def.delay, max: def.delay, damage: def.damage, color: b.color, flash: 0 };
    world.hazards.push(bar);
    act.hs.push(bar);
  }
  act.spawned++;
  sfx(world, 'swing');
}

// bossPatterns.js から呼ぶ：部品とハザードを登録する
export function installMap4(PATTERNS_TABLE, HAZARD_TYPES) {
  Object.assign(PATTERNS_TABLE, PATTERNS_MAP4);
  Object.assign(HAZARD_TYPES, HAZARDS_MAP4);
}
