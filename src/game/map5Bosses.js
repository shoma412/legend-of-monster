// マップ5のボス（ラストイーター・バッファータンク・レインメーカー・隠しボス カタリスト）の、そのボスだけの攻撃。
// 共通の部品は使わない（docs/詳細仕様.md「新しいボスを作るときの決まり」）。部品の名前は、1体のボスにだけ使う。
//   ラストイーター: melt 溶解・gnaw 噛みつき（固有・前からある）/ scrapfling 鉄片散らし / rustwave 錆の波 / jawsnap 噛み砕き
//   バッファータンク: emit 放出・saturate 飽和（固有）/ neutralvortex 中和の渦 / tankrun 槽の突進 / flushring 排水の輪。放出の中身は、colorjets・emberpools・frostspiral・acidpools
//   レインメーカー: unroof 屋根崩し・stormcloud 雨雲（固有）/ thundernet 雷の網 / rainfront 降雨の波 / lightningline 雷線
//   カタリスト    : reflect 反応・seize 奪取・streak 連撃（固有）/ wavecopy 写し身の波 / homers 属性追尾
import { FEEL } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { circlesOverlap, clampToBounds, distToSegment } from '../logic/geometry.js';
import { clamp, inside, pushMark, randomSpot, timed } from './bossKit.js';
import { afflictPlayer, hurtPlayer, slowPlayer } from './combat.js';
import { underRoof } from './acidRain.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';
import { copiedEffects, transcribe } from './bossPatterns.js';

const DEG = Math.PI / 180;
const ELEMENT_COLOR = { shock: '#fff36b', heat: '#ff7a3d', cold: '#8fd8ff', corrode: '#b6ff3a' };
const ELEMENTS = ['shock', 'heat', 'cold', 'corrode'];

// 属性の効き目を、プレイヤーに与える（減速は、被弾後の無敵が付く前にかけるので、先に呼ぶ）
function elementPre(world, el) {
  if (el === 'cold') slowPlayer(world);
}
function elementPost(world, el) {
  if (el === 'heat') afflictPlayer(world, 'burn');
  if (el === 'corrode') afflictPlayer(world, 'corrode');
}

// ---- ハザード（残る攻撃）の動き ----
export const HAZARDS_MAP5 = {
  // 錆の波：ボスから広がる、錆の帯。通った場所に、錆の床が残る
  rustband: {
    update(world, h, dt) {
      const p = world.player;
      h.r += h.speed * dt;
      const dist = Math.hypot(p.x - h.x, p.y - h.y);
      if (Math.abs(dist - h.r) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      for (const d of h.drops) {
        if (d.done || h.r < d.r) continue;
        d.done = true;
        const x = h.x + Math.cos(d.angle) * h.r;
        const y = h.y + Math.sin(d.angle) * h.r;
        if (!inside(world, x, y, 10)) continue;
        world.hazards.push({ type: 'pool', x, y, r: h.pool.radius, arm: h.pool.arm, armMax: h.pool.arm, life: h.pool.life, tick: h.pool.tick, acc: h.pool.tick, damage: h.pool.damage, slow: !!h.pool.slow, color: h.color });
      }
      if (h.r >= h.max) h.dead = true;
    },
  },

  // 中和の渦：2つの渦が、向かい合って寄る。引き込まれる（歩けば逆らえる。ダッシュ中は引かれない）。ぶつかると、大きく爆ぜる
  vortex: {
    update(world, h, dt) {
      const p = world.player;
      if (h.arm > 0) {
        h.arm -= dt;
        return;
      }
      h.age += dt;
      const mate = h.mate;
      if (mate && !mate.dead) {
        const dx = mate.x - h.x;
        const dy = mate.y - h.y;
        const dist = Math.hypot(dx, dy) || 1;
        h.x += (dx / dist) * h.drift * dt;
        h.y += (dy / dist) * h.drift * dt;
        if (dist <= h.burstDist && h.lead) {
          // ぶつかった
          if (Math.hypot(p.x - h.x, p.y - h.y) <= h.burstRadius + p.r) hurtPlayer(world, h.burstDamage);
          ring(world, (h.x + mate.x) / 2, (h.y + mate.y) / 2, h.burstRadius, h.color);
          burst(world, (h.x + mate.x) / 2, (h.y + mate.y) / 2, h.color, 30, 320);
          addShake(world, FEEL.shake.charged);
          sfx(world, 'explode');
          h.dead = true;
          mate.dead = true;
          return;
        }
      }
      const dx = h.x - p.x;
      const dy = h.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist <= h.r * 1.4 + p.r) {
        slowPlayer(world);
        if (p.dashT <= 0 && world.mode === 'play') {
          p.x += (dx / dist) * h.pull * dt;
          p.y += (dy / dist) * h.pull * dt;
        }
      }
      h.acc += dt;
      if (dist <= h.core + p.r && h.acc >= h.tick) {
        h.acc = 0;
        hurtPlayer(world, h.damage);
      }
      if (h.age >= h.life) h.dead = true;
    },
  },

  // 雷の網：雲のあいだに、電撃の線が張られる。予告のあと、一瞬だけ当たる（屋根でも防げない）
  netline: {
    update(world, h, dt) {
      const p = world.player;
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn <= 0) {
          h.phase = 'flash';
          h.t = 0;
          sfx(world, 'zap');
          addShake(world, FEEL.shake.hit);
        }
        return;
      }
      h.t += dt;
      for (const s of h.segs) if (distToSegment(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      if (h.t >= h.flash) h.dead = true;
    },
  },

  // 降雨の波：雨の帯が、部屋の一辺から反対側へ降り進む。帯の中で、屋根の外にいると当たる
  rainfront: {
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
      h.acc += dt;
      const horizontal = w.axis === 'x';
      const along = horizontal ? (w.sign > 0 ? p.x - bd.left : bd.right - p.x) : w.sign > 0 ? p.y - bd.top : bd.bottom - p.y;
      if (h.acc >= h.tick) {
        h.acc = 0;
        if (along <= h.s + p.r && along >= h.s - h.thick - p.r && !underRoof(world, p.x, p.y)) hurtPlayer(world, h.damage);
      }
      const length = (horizontal ? bd.right - bd.left : bd.bottom - bd.top) + h.thick;
      if (h.s >= length) {
        h.i++;
        if (h.i >= h.waves.length) h.dead = true;
        else {
          h.phase = 'warn';
          h.t = h.warn;
        }
      }
    },
  },

  // 写し身の波：写し取った属性の色の輪が広がる。当たると、その属性の効き目
  elemring: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        if (h.wait <= 0) {
          sfx(world, 'explode');
          addShake(world, FEEL.shake.hit);
        }
        return;
      }
      h.r += h.speed * dt;
      const dist = Math.hypot(p.x - h.x, p.y - h.y);
      if (Math.abs(dist - h.r) <= h.width / 2 + p.r) {
        if (h.fx.slow) slowPlayer(world);
        if (hurtPlayer(world, h.damage * h.fx.power)) for (const id of h.fx.dots) afflictPlayer(world, id);
      }
      if (h.r >= h.max) h.dead = true;
    },
  },

  // 属性追尾：属性の光の玉が、プレイヤーをゆっくり追いかける
  homer: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        return;
      }
      h.age += dt;
      const want = Math.atan2(p.y - h.y, p.x - h.x);
      let diff = want - h.ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const step = h.turn * dt;
      h.ang += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
      h.x += Math.cos(h.ang) * h.speed * dt;
      h.y += Math.sin(h.ang) * h.speed * dt;
      if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) {
        elementPre(world, h.element);
        if (hurtPlayer(world, h.damage * (h.plain ? h.plainBonus : 1))) elementPost(world, h.element);
        burst(world, h.x, h.y, h.color, 10, 200);
        h.dead = true;
      }
      if (h.age >= h.life) h.dead = true;
    },
  },
};

function poolsAround(world, b, act, def, dot) {
  const p = world.player;
  for (let i = 0; i < def.count; i++) {
    const a = world.rng() * Math.PI * 2;
    const r = i === 0 ? 0 : def.radius + world.rng() * def.spread;
    const spot = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 0 };
    clampToBounds(spot, world.bounds);
    const h = { type: 'pool', x: spot.x, y: spot.y, r: def.radius, arm: def.arm, armMax: def.arm, life: def.life, tick: def.tick, acc: def.tick, damage: def.damage, slow: !!def.slow, dot, color: act.color ?? b.color };
    world.hazards.push(h);
    act.hs.push(h);
  }
  sfx(world, 'enemyShot');
}

// ---- ボスの攻撃の部品 ----
export const PATTERNS_MAP5 = {
  // ラストイーター：鉄片散らし（歯の欠けた歯車の破片が、跳ねながら飛ぶ。当たると「錆」）
  scrapfling: timed({
    fire(world, b, act) {
      const def = act.def;
      const base = Math.atan2(act.dirY, act.dirX);
      for (let i = 0; i < def.count; i++) {
        const a = base + (def.count > 1 ? (i / (def.count - 1) - 0.5) * def.spread * DEG : 0);
        const h = { type: 'junk', x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, r: def.radius, count: 0, bounces: def.bounces, damage: def.damage, rust: def.rust, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // ラストイーター：錆の波
  rustwave: timed({
    fire(world, b, act) {
      const def = act.def;
      const drops = [];
      for (let i = 0; i < def.drops; i++) drops.push({ r: 90 + world.rng() * (def.max - 150), angle: world.rng() * Math.PI * 2, done: false });
      const h = { type: 'rustband', x: b.x, y: b.y, r: b.r, speed: def.speed, max: def.max, width: def.width, damage: def.damage, drops, pool: def.pool, color: b.color };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'explode');
      addShake(world, FEEL.shake.charged);
    },
  }),

  // ラストイーター：噛み砕き（あごが閉じる。正面と真後ろは、あごが閉じない）
  jawsnap: timed({
    early: true,
    fire(world, b, act) {
      const def = act.def;
      for (const side of [1, -1]) {
        const h = {
          type: 'wedge', owner: b, x: b.x, y: b.y, follow: true, angle: 0, arc: def.arc * DEG, radius: def.radius, phase: 'warn', warn: def.telegraph, warnMax: def.telegraph,
          lock: def.lockTime ?? 0.3, track: true, offset: side * def.spread * DEG, damage: def.damage, t: 0, color: b.color,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),

  // バッファータンク（放出の中身）：色の噴出（壁の口から、順に噴く）
  colorjets: timed({
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      for (let i = 0; i < def.count; i++) {
        const horizontal = world.rng() < 0.5;
        const sign = world.rng() < 0.5 ? 1 : -1;
        const x1 = horizontal ? (sign > 0 ? bd.left : bd.right) : bd.left + 60 + world.rng() * (bd.right - bd.left - 120);
        const y1 = horizontal ? bd.top + 60 + world.rng() * (bd.bottom - bd.top - 120) : sign > 0 ? bd.top : bd.bottom;
        const x2 = horizontal ? (sign > 0 ? bd.right : bd.left) : x1;
        const y2 = horizontal ? y1 : sign > 0 ? bd.bottom : bd.top;
        const h = { type: 'jet', x1, y1, x2, y2, t: 0, wait: i * def.gap, leak: def.leak, aimT: def.aim, fire: 0.25, width: def.width, damage: def.damage, phase: 'wait', color: act.color ?? b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // バッファータンク（放出の中身）：熱の泡だまり
  emberpools: timed({
    fire(world, b, act) {
      poolsAround(world, b, act, act.def, 'burn');
    },
  }),

  // バッファータンク（放出の中身）：腐食の泡だまり
  acidpools: timed({
    fire(world, b, act) {
      poolsAround(world, b, act, act.def, 'corrode');
    },
  }),

  // バッファータンク（放出の中身）：冷却のうずまき（凍る弾が、うずまきに飛ぶ。当たると減速）
  frostspiral: timed({
    fire(world, b, act) {
      act.clock = 0;
      act.fired = 0;
      act.angle = Math.atan2(act.dirY, act.dirX);
    },
    finished(world, b, act, dt) {
      const def = act.def;
      act.clock += dt;
      while (act.fired < def.shots && act.clock >= act.fired * def.gap) {
        for (let k = 0; k < def.arms; k++) {
          const a = act.angle + (k * Math.PI * 2) / def.arms;
          world.shots.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, r: 7, damage: def.damage, life: 4, slow: true, color: act.color ?? b.color });
        }
        act.angle += def.turn * DEG;
        act.fired++;
        if (act.fired % 2 === 0) sfx(world, 'enemyShot');
      }
      return act.fired >= def.shots;
    },
  }),

  // バッファータンク：中和の渦
  neutralvortex: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      for (let k = 0; k < def.pairs; k++) {
        const a = world.rng() * Math.PI * 2;
        const dist = 260 + k * 40;
        const first = ELEMENTS[Math.floor(world.rng() * 4) % 4];
        const second = ELEMENTS[(ELEMENTS.indexOf(first) + 1 + Math.floor(world.rng() * 3)) % 4];
        const make = (sign, el) => {
          const x = clamp(p.x + Math.cos(a) * dist * sign, world.bounds.left + 40, world.bounds.right - 40);
          const y = clamp(p.y + Math.sin(a) * dist * sign, world.bounds.top + 40, world.bounds.bottom - 40);
          return {
            type: 'vortex', x, y, r: def.radius, core: def.core, arm: def.arm, armMax: def.arm, age: 0, life: def.life, drift: def.drift, pull: def.pull, tick: 0.5, acc: 0.5, damage: def.damage,
            burstDist: 70, burstRadius: def.burstRadius, burstDamage: def.burstDamage, lead: sign > 0, mate: null, color: ELEMENT_COLOR[el], element: el,
          };
        };
        const A = make(1, first);
        const B = make(-1, second);
        A.mate = B;
        B.mate = A;
        world.hazards.push(A, B);
        act.hs.push(A, B);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // バッファータンク：槽の突進（壁沿いに、角を2つ曲がって走る。通った角に、色の床が残る）
  tankrun: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      const bd = world.bounds;
      // 最初は、いちばん近い壁へ。そのあと、壁沿いに時計回りに角を2つ
      const nearest = [
        { x: bd.left + b.r, y: b.y, axis: 'x', v: b.x - bd.left },
        { x: bd.right - b.r, y: b.y, axis: 'x', v: bd.right - b.x },
        { x: b.x, y: bd.top + b.r, axis: 'y', v: b.y - bd.top },
        { x: b.x, y: bd.bottom - b.r, axis: 'y', v: bd.bottom - b.y },
      ].sort((u, w) => u.v - w.v)[0];
      const corners = [
        { x: bd.left + b.r, y: bd.top + b.r },
        { x: bd.right - b.r, y: bd.top + b.r },
        { x: bd.right - b.r, y: bd.bottom - b.r },
        { x: bd.left + b.r, y: bd.bottom - b.r },
      ];
      const start = corners.reduce((best, c, i) => (Math.hypot(c.x - nearest.x, c.y - nearest.y) < Math.hypot(corners[best].x - nearest.x, corners[best].y - nearest.y) ? i : best), 0);
      act.route = [{ x: nearest.x, y: nearest.y }, corners[start], corners[(start + 1) % 4], corners[(start + 2) % 4]];
      act.leg = 0;
      void d;
      sfx(world, 'bossCharge');
    },
    update(world, b, dt, act) {
      const def = act.def;
      const p = world.player;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t <= 0) act.phase = 'run';
      } else if (act.phase === 'run') {
        const target = act.route[act.leg];
        const dx = target.x - b.x;
        const dy = target.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        const step = Math.min(dist, def.speed * dt);
        b.x += (dx / dist) * step;
        b.y += (dy / dist) * step;
        act.dirX = dx / dist;
        act.dirY = dy / dist;
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        if (dist - step < 2) {
          // 角に着いた：その色の床を残す
          const dot = b.attune === 'heat' ? 'burn' : b.attune === 'corrode' ? 'corrode' : null;
          world.hazards.push({ type: 'pool', x: b.x, y: b.y, r: def.pool.radius, arm: def.pool.arm, armMax: def.pool.arm, life: def.pool.life, tick: def.pool.tick, acc: def.pool.tick, damage: def.pool.damage, slow: b.attune === 'cold', dot, color: b.color });
          act.leg++;
          if (act.leg >= act.route.length) {
            act.phase = 'recover';
            act.t = def.recover;
            addShake(world, FEEL.shake.hit);
          }
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // バッファータンク：排水の輪（ボスのまわりに、予告の円が輪になって並ぶ。内側の輪から、順に落ちる）
  flushring: timed({
    fire(world, b, act) {
      const def = act.def;
      def.rings.forEach((radius, ri) => {
        const n = def.perRing + ri * 3;
        const off = world.rng() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          const x = b.x + Math.cos(a) * radius;
          const y = b.y + Math.sin(a) * radius;
          if (!inside(world, x, y, 6)) continue;
          pushMark(world, act, b, { x, y, r: def.radius, t: def.delay + ri * def.stagger, damage: def.damage });
        }
      });
      sfx(world, 'enemyShot');
    },
  }),

  // レインメーカー：雷の網
  thundernet: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const pts = [{ x: clamp(p.x, world.bounds.left + 30, world.bounds.right - 30), y: clamp(p.y, world.bounds.top + 30, world.bounds.bottom - 30) }];
      for (let tries = 0; tries < 80 && pts.length < def.points; tries++) {
        const s = randomSpot(world, 30);
        if (pts.every((q) => Math.hypot(q.x - s.x, q.y - s.y) >= 150)) pts.push(s);
      }
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
      if (def.closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
      const h = { type: 'netline', points: pts, segs, phase: 'warn', warn: def.warn, warnMax: def.warn, t: 0, flash: 0.3, width: def.width, damage: def.damage, color: ELEMENT_COLOR.shock };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // レインメーカー：降雨の波
  rainfront: timed({
    fire(world, b, act) {
      const def = act.def;
      const SIDES = [
        { id: 'left', axis: 'x', sign: 1 },
        { id: 'right', axis: 'x', sign: -1 },
        { id: 'top', axis: 'y', sign: 1 },
        { id: 'bottom', axis: 'y', sign: -1 },
      ];
      const waves = [];
      let last = -1;
      for (let i = 0; i < def.waves; i++) {
        let k = Math.floor(world.rng() * SIDES.length) % SIDES.length;
        if (k === last) k = (k + 1) % SIDES.length;
        last = k;
        waves.push(SIDES[k]);
      }
      const h = { type: 'rainfront', waves, i: 0, phase: 'warn', t: def.warn, warn: def.warn, s: 0, speed: def.speed, thick: def.thick, tick: def.tick, acc: 0, damage: def.damage, color: b.color };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // レインメーカー：雷線（雷が、直線に並んで、端から順に落ちる）
  lightningline: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const base = world.rng() * Math.PI;
      for (let line = 0; line < def.lines; line++) {
        const a = base + (line * Math.PI) / 2;
        const flip = world.rng() < 0.5 ? 1 : -1;
        for (let k = 0; k < def.count; k++) {
          const off = (k - (def.count - 1) / 2) * def.step;
          const x = p.x + Math.cos(a) * off;
          const y = p.y + Math.sin(a) * off;
          if (!inside(world, x, y, 6)) continue;
          pushMark(world, act, b, { x, y, r: def.radius, t: def.delay + (flip > 0 ? k : def.count - 1 - k) * def.stagger + line * def.lineGap, damage: def.damage, color: ELEMENT_COLOR.shock });
        }
      }
      sfx(world, 'enemyShot');
    },
  }),

  // カタリスト：写し身の波
  wavecopy: timed({
    fire(world, b, act) {
      const def = act.def;
      transcribe(world, b, false);
      const fx = copiedEffects(b, def);
      for (let i = 0; i < def.count; i++) {
        const h = { type: 'elemring', x: b.x, y: b.y, r: b.r, speed: def.speed, max: def.max, width: def.width, damage: def.damage, fx, wait: i * def.gap + 0.001, color: fx.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      floatText(world, b.x, b.y - b.r - 14, (b.copied ?? []).length > 0 ? 'Copy' : 'Plain', COLORS.ink, 14);
    },
  }),

  // カタリスト：属性追尾
  homers: timed({
    fire(world, b, act) {
      const def = act.def;
      const copied = transcribe(world, b, false);
      const list = copied.length > 0 ? copied : ['plain'];
      for (let i = 0; i < def.count; i++) {
        const element = list[i % list.length];
        const plain = element === 'plain';
        const h = {
          type: 'homer', x: b.x, y: b.y, ang: Math.atan2(world.player.y - b.y, world.player.x - b.x), speed: def.speed * (element === 'shock' ? 1.35 : 1), turn: def.turn, life: def.life, age: 0, r: 12, damage: def.damage, wait: i * def.gap,
          element: plain ? null : element, plain, plainBonus: def.plainBonus, color: plain ? COLORS.ink : ELEMENT_COLOR[element],
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),
};

// bossPatterns.js から呼ぶ：部品とハザードを登録する
export function installMap5(PATTERNS_TABLE, HAZARD_TYPES) {
  Object.assign(PATTERNS_TABLE, PATTERNS_MAP5);
  Object.assign(HAZARD_TYPES, HAZARDS_MAP5);
}
