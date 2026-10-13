// マップ1のボス3体（ボルトボア・クライオ・ワイバーン・オーバーロード）の、そのボスだけの攻撃。
// 共通の部品は使わない（docs/詳細仕様.md「新しいボスを作るときの決まり」）。部品の名前は、1体のボスにだけ使う。
//   ボルトボア        : wirepull 電線ひっぱり / insulators 碍子落とし / stakefence 杭の放電 / statics 帯電 / tuskrip 牙の突き上げ / overvolt 大技「過電圧」
//   クライオ・ワイバーン: featherbolt 氷の羽根 / iciclewave 氷柱の波 / frostbreath 凍る息 / frostwings 霜の翼 / skyshadow 寒空の影 / absolutezero 大技「絶対零度」
//   オーバーロード    : opblocks 命令ブロック / tracepath 配線トレース / satellites 子機の円陣 / reboot 再起動 / shortcircuit 基板ショート / systemhalt 大技「全システム停止」
// 残る床や線は hazard（world.hazards）として置き、動きは HAZARDS の update、絵は src/render/map1Draw.js の draw で扱う。
import { FEEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { arcHitsCircle, circlesOverlap, distToSegment } from '../logic/geometry.js';
import { hurtPlayer, slowPlayer } from './combat.js';
import { createEnemy } from './enemyAI.js';
import { aim, clamp, inside, pushMark, randomSpot, timed } from './bossKit.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';

const DEG = Math.PI / 180;
const SHOCK = ELEMENT_COLORS.shock;
const COLD = ELEMENT_COLORS.cold;

// オーバーロードの基板の線（配線トレースと基板ショートで同じ場所を使う）。4列 × 3段の12か所
export const BOARD_COLUMNS = [0.2, 0.4, 0.6, 0.8];
export const BOARD_ROWS = [0.3, 0.5, 0.7];
export function boardPoints(bounds) {
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const points = [];
  BOARD_ROWS.forEach((fy, row) => BOARD_COLUMNS.forEach((fx, col) => points.push({ x: bounds.left + w * fx, y: bounds.top + h * fy, row, col })));
  return points;
}

// ---- ハザード（残る攻撃）の動き ----
export const HAZARDS = {
  // 電線ひっぱり：電柱のあいだの電線が、部屋を横切ってしなり、伸びきったあと、逆向きに戻ってくる
  wirepass: {
    update(world, h, dt) {
      const p = world.player;
      const bd = world.bounds;
      if (!h.owner || h.owner.dead) {
        h.dead = true;
        return;
      }
      const horizontal = h.axis === 'y'; // 横長の電線が、上下に動く
      const crossOf = () => clamp((horizontal ? p.x : p.y) + h.shift, (horizontal ? bd.left : bd.top) + h.length / 2, (horizontal ? bd.right : bd.bottom) - h.length / 2);
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn > h.lock) h.cross = crossOf();
        if (h.warn <= 0) {
          h.phase = 'leg';
          sfx(world, 'zap');
        }
        return;
      }
      if (h.phase === 'hold') {
        h.hold -= dt;
        if (h.hold <= 0) {
          [h.from, h.to] = [h.to, h.from];
          h.pos = h.from;
          h.leg = 2;
          h.phase = 'leg';
          sfx(world, 'zap');
        }
        return;
      }
      const dir = Math.sign(h.to - h.from);
      h.pos += dir * (h.leg === 1 ? h.speed : h.backSpeed) * dt;
      const a = h.length / 2;
      const seg = horizontal ? [h.cross - a, h.pos, h.cross + a, h.pos] : [h.pos, h.cross - a, h.pos, h.cross + a];
      if (distToSegment(p.x, p.y, seg[0], seg[1], seg[2], seg[3]) <= 8 + p.r) hurtPlayer(world, h.damage);
      if ((h.pos - h.to) * dir >= 0) {
        addShake(world, FEEL.shake.hit);
        if (h.leg === 1) {
          h.phase = 'hold';
          h.hold = 0.35;
          sfx(world, 'block');
        } else {
          h.dead = true;
        }
      }
    },
  },

  // 杭の放電：杭を結ぶ線が電気を帯びる。線に触れるとダメージ。内側は安全で、外へ出る隙間が1か所ある
  fence: {
    update(world, h, dt) {
      const p = world.player;
      if (h.arm > 0) {
        h.arm -= dt;
        if (h.arm <= 0) sfx(world, 'zap');
        return;
      }
      h.life -= dt;
      for (const s of h.segs) if (distToSegment(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      if (h.life <= 0) h.dead = true;
    },
  },

  // 帯電：ボスから放射状の稲妻がのび、ゆっくり回る。稲妻のすき間に入れば当たらない
  rays: {
    update(world, h, dt) {
      const b = h.owner;
      if (!b || b.dead) {
        h.dead = true;
        return;
      }
      if (h.warn > 0) {
        h.warn -= dt;
        if (h.warn <= 0) sfx(world, 'zap');
        return;
      }
      h.live -= dt;
      h.angle += h.spin * dt;
      const p = world.player;
      for (let i = 0; i < h.count; i++) {
        const a = h.angle + (i * Math.PI * 2) / h.count;
        if (distToSegment(p.x, p.y, b.x, b.y, b.x + Math.cos(a) * 1400, b.y + Math.sin(a) * 1400) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      }
      if (h.live <= 0) h.dead = true;
    },
  },

  // 過電圧：壁ぎわの電線が、内側へ狭まっていく。電線と壁のあいだは、いる間ずっとダメージ。電柱のそば（安全の円）だけが助かる
  squeeze: {
    inset(h) {
      return h.steps[Math.min(h.i, h.steps.length - 1)];
    },
    update(world, h, dt) {
      const p = world.player;
      const bd = world.bounds;
      h.t -= dt;
      if (h.phase === 'warn') {
        if (h.t <= 0) {
          h.phase = 'live';
          h.t = h.hold;
          h.acc = h.tick;
          sfx(world, 'zap');
          addShake(world, FEEL.shake.hit);
        }
        return;
      }
      h.acc += dt;
      if (h.acc >= h.tick) {
        h.acc = 0;
        const inset = HAZARDS.squeeze.inset(h);
        const outside = p.x - p.r < bd.left + inset || p.x + p.r > bd.right - inset || p.y - p.r < bd.top + inset || p.y + p.r > bd.bottom - inset;
        const safe = h.safes.some((s) => Math.hypot(p.x - s.x, p.y - s.y) <= s.r);
        if (outside && !safe) hurtPlayer(world, h.damage);
      }
      if (h.t <= 0) {
        h.i++;
        if (h.i >= h.steps.length) h.dead = true;
        else {
          h.phase = 'warn';
          h.t = h.warn;
        }
      }
    },
  },

  // 氷の羽根：弧を描いて飛び、しばらくしたら、竜のいる場所へ戻ってくる
  feather: {
    update(world, h, dt) {
      const b = h.owner;
      const p = world.player;
      if (!b || b.dead) {
        h.dead = true;
        return;
      }
      h.age += dt;
      if (h.phase === 'out') {
        h.ang += h.turn * dt;
        h.x += Math.cos(h.ang) * h.speed * dt;
        h.y += Math.sin(h.ang) * h.speed * dt;
        h.outT -= dt;
        if (h.outT <= 0) h.phase = 'back';
      } else {
        const dx = b.x - h.x;
        const dy = b.y - h.y;
        const dist = Math.hypot(dx, dy) || 1;
        h.ang = Math.atan2(dy, dx);
        h.x += (dx / dist) * h.back * dt;
        h.y += (dy / dist) * h.back * dt;
        if (dist <= b.r + 10) h.dead = true;
      }
      if (h.age > 9) h.dead = true;
      if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
    },
  },

  // 凍る床：しばらく残る。上にいると慣性がついて、止まりにくくなる（動きは src/game/player.js）
  ice: {
    update(world, h, dt) {
      h.life -= dt;
      if (h.life <= 0) h.dead = true;
    },
  },

  // 寒空の影：竜が空へ消えて、影が部屋の中を動き回る。止まった場所に竜が降りてきて、周りを凍らせる
  shadow: {
    update(world, h, dt) {
      const p = world.player;
      const bd = world.bounds;
      if (!h.owner || h.owner.dead) {
        h.dead = true;
        return;
      }
      if (h.phase === 'roam') {
        h.roam -= dt;
        h.wpT -= dt;
        if (h.wpT <= 0) {
          h.wpT = 0.55;
          h.wp = { x: p.x + (world.rng() - 0.5) * 2 * h.wander, y: p.y + (world.rng() - 0.5) * 2 * h.wander };
        }
        const dx = h.wp.x - h.x;
        const dy = h.wp.y - h.y;
        const dist = Math.hypot(dx, dy) || 1;
        const step = Math.min(dist, h.speed * dt);
        h.x = clamp(h.x + (dx / dist) * step, bd.left + 40, bd.right - 40);
        h.y = clamp(h.y + (dy / dist) * step, bd.top + 40, bd.bottom - 40);
        if (h.roam <= 0) {
          h.phase = 'land';
          h.t = h.landT;
          sfx(world, 'warning');
        }
        return;
      }
      h.t -= dt;
      if (h.t <= 0) {
        if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) {
          slowPlayer(world);
          hurtPlayer(world, h.damage);
        }
        ring(world, h.x, h.y, h.r, COLD);
        burst(world, h.x, h.y, COLD, 28, 300);
        addShake(world, FEEL.shake.charged);
        sfx(world, 'explode');
        h.landed = true;
        h.dead = true;
      }
    },
  },

  // 絶対零度：部屋が凍りついて、「凍え」がたまる。焚き火の円の中にいる間だけ、下がる。満タンで凍結ダメージ
  coldfield: {
    update(world, h, dt) {
      const p = world.player;
      h.t -= dt;
      // 焚き火の場所が変わる（予告のあと）
      h.moveT -= dt;
      if (!h.next && h.moveT <= h.warn) h.next = HAZARDS.coldfield.spots(world, h);
      if (h.moveT <= 0) {
        h.fires = h.next ?? h.fires;
        h.next = null;
        h.moveT = h.move;
      }
      const warm = h.fires.some((f) => Math.hypot(p.x - f.x, p.y - f.y) <= h.r);
      h.chill = clamp(h.chill + (warm ? -h.cool : h.rate) * dt, 0, 1);
      if (h.chill >= 1 && world.mode === 'play') {
        h.chill = h.after;
        if (hurtPlayer(world, h.damage)) {
          p.floatT = Math.max(p.floatT ?? 0, h.freeze);
          floatText(world, p.x, p.y - 30, 'Freeze', COLD, 18);
          burst(world, p.x, p.y, COLD, 20, 260);
        }
      }
      if (h.t <= 0) h.dead = true;
    },
    spots(world, h) {
      const spots = [];
      for (let tries = 0; tries < 80 && spots.length < h.count; tries++) {
        const s = randomSpot(world, 90);
        if (spots.every((o) => Math.hypot(o.x - s.x, o.y - s.y) >= h.r * 2.4)) spots.push(s);
      }
      return spots;
    },
  },

  // 命令ブロック：番号の順に、爆発する
  opblocks: {
    update(world, h, dt) {
      const p = world.player;
      h.clock += dt;
      for (const blk of h.blocks) {
        if (blk.done) continue;
        if (h.clock < h.warn + (blk.n - 1) * h.gap) continue;
        blk.done = true;
        if (circlesOverlap(blk.x, blk.y, h.radius, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
        ring(world, blk.x, blk.y, h.radius, SHOCK);
        burst(world, blk.x, blk.y, SHOCK, 14, 240);
        sfx(world, 'hit');
      }
      if (h.clock >= h.warn + h.blocks.length * h.gap + 0.3) h.dead = true;
    },
  },

  // 配線トレース：基板の線の上を、光の点が走る。通ったあとの線は、しばらく感電する
  trace: {
    update(world, h, dt) {
      const p = world.player;
      if (h.warn > 0) {
        h.warn -= dt;
        if (h.warn <= 0) sfx(world, 'zap');
        return;
      }
      // 先頭が進む
      if (h.edge < h.route.length - 1) {
        const a = h.route[h.edge];
        const c = h.route[h.edge + 1];
        const len = Math.hypot(c.x - a.x, c.y - a.y);
        h.f += (h.speed * dt) / len;
        const seg = h.segs[h.edge];
        seg.f = Math.min(1, h.f);
        if (h.f >= 1) {
          seg.life = h.trailLife;
          h.edge++;
          h.f = 0;
        }
      }
      let alive = false;
      for (const seg of h.segs) {
        if (seg.life != null) {
          seg.life -= dt;
          if (seg.life <= 0) continue;
        }
        if (seg.f <= 0) continue;
        alive = true;
        const x2 = seg.x1 + (seg.x2 - seg.x1) * seg.f;
        const y2 = seg.y1 + (seg.y2 - seg.y1) * seg.f;
        if (distToSegment(p.x, p.y, seg.x1, seg.y1, x2, y2) <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      }
      if (!alive && h.edge >= h.route.length - 1) h.dead = true;
      else if (h.edge >= h.route.length - 1 && h.segs.every((s) => s.life != null && s.life <= 0)) h.dead = true;
    },
  },
};

// ---- ボスの攻撃の部品 ----
export const MAP1_PATTERNS = {
  // ボルトボア：電線ひっぱり
  wirepull: timed({
    early: true,
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      const horizontal = world.rng() < 0.5; // 横長の電線が、上下に動く（そうでなければ、縦長の電線が、左右に動く）
      const lo = horizontal ? bd.top : bd.left;
      const hi = horizontal ? bd.bottom : bd.right;
      for (let i = 0; i < def.wires; i++) {
        const dir = i % 2 === 0 ? 1 : -1; // 2本目は、反対側から来る
        const h = {
          type: 'wirepass', axis: horizontal ? 'y' : 'x', cross: horizontal ? world.player.x : world.player.y, shift: i === 0 ? 0 : (i % 2 ? 1 : -1) * def.offset * Math.ceil(i / 2),
          length: def.length, pos: dir > 0 ? lo : hi, from: dir > 0 ? lo : hi, to: dir > 0 ? hi : lo, speed: def.speed, backSpeed: def.backSpeed, leg: 1,
          phase: 'warn', warn: def.telegraph, warnMax: def.telegraph, lock: def.lockTime ?? 0.35, hold: 0, damage: def.damage, owner: b, color: SHOCK,
        };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),

  // ボルトボア：碍子落とし
  insulators: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      for (let i = 0; i < def.count; i++) {
        let spot = { x: p.x, y: p.y };
        if (i > 0) {
          for (let tries = 0; tries < 20; tries++) {
            spot = randomSpot(world, 36);
            if (Math.hypot(spot.x - p.x, spot.y - p.y) >= def.minDist) break;
          }
        }
        pushMark(world, act, b, { ...spot, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, color: SHOCK, extra: { shards: def.shards, pool: def.pool } });
      }
      sfx(world, 'enemyShot');
    },
  }),

  // ボルトボア：杭の放電
  stakefence: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      const n = def.stakes;
      const base = world.rng() * Math.PI * 2;
      const stakes = [];
      for (let k = 0; k < n; k++) {
        const a = base + (k * Math.PI * 2) / n;
        stakes.push({ x: clamp(p.x + Math.cos(a) * def.radius, bd.left + 20, bd.right - 20), y: clamp(p.y + Math.sin(a) * def.radius, bd.top + 20, bd.bottom - 20) });
      }
      const gapEdge = Math.floor(world.rng() * n);
      const segs = [];
      for (let k = 0; k < n; k++) {
        const a = stakes[k];
        const c = stakes[(k + 1) % n];
        if (k !== gapEdge) {
          segs.push([a, c]);
          continue;
        }
        const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
        const t0 = (len / 2 - def.gap / 2) / len;
        const t1 = (len / 2 + def.gap / 2) / len;
        const at = (t) => ({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t });
        segs.push([a, at(t0)], [at(t1), c]);
      }
      const h = { type: 'fence', stakes, segs, gapEdge, arm: def.arm, armMax: def.arm, life: def.life, damage: def.damage, width: 10, color: SHOCK };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'block');
    },
  }),

  // ボルトボア：帯電
  statics: timed({
    fire(world, b, act) {
      const def = act.def;
      const h = { type: 'rays', owner: b, count: def.rays, angle: world.rng() * Math.PI * 2, spin: def.spin * (world.rng() < 0.5 ? 1 : -1), width: def.width, warn: def.warn, warnMax: def.warn, live: def.live, damage: def.damage, color: SHOCK };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'bossCharge');
    },
  }),

  // ボルトボア：牙の突き上げ
  tuskrip: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const dist = b.r + 54 + i * def.step;
        const x = b.x + act.dirX * dist;
        const y = b.y + act.dirY * dist;
        if (!inside(world, x, y, 6)) continue;
        pushMark(world, act, b, { x, y, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, color: SHOCK, extra: { float: def.float } });
      }
      sfx(world, 'swingHeavy');
    },
  }),

  // ボルトボア：大技「過電圧」
  overvolt: timed({
    fire(world, b, act) {
      const def = act.def;
      const safes = [];
      for (let i = 0; i < def.safes; i++) {
        const s = randomSpot(world, 100);
        safes.push({ x: s.x, y: s.y, r: def.safeRadius });
      }
      const h = { type: 'squeeze', steps: def.steps, i: 0, phase: 'warn', t: def.warn, warn: def.warn, hold: def.hold, tick: def.tick, acc: 0, damage: def.damage, safes, color: SHOCK };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // クライオ・ワイバーン：氷の羽根
  featherbolt: timed({
    fire(world, b, act) {
      const def = act.def;
      const base = Math.atan2(act.dirY, act.dirX);
      for (let i = 0; i < def.count; i++) {
        const offset = def.count > 1 ? (i / (def.count - 1) - 0.5) * def.spread * DEG : 0;
        const h = { type: 'feather', x: b.x, y: b.y, ang: base + offset, speed: def.speed, turn: (i % 2 === 0 ? 1 : -1) * def.turn, outT: def.outT, phase: 'out', back: def.back, damage: def.damage, r: def.radius, age: 0, owner: b, color: COLD };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
  }),

  // クライオ・ワイバーン：氷柱の波
  iciclewave: timed({
    fire(world, b, act) {
      const def = act.def;
      const base = Math.atan2(act.dirY, act.dirX);
      for (let line = 0; line < def.lines; line++) {
        const a = base + (def.lines > 1 ? (line / (def.lines - 1) - 0.5) * def.lineSpread * DEG : 0);
        for (let i = 0; i < def.count; i++) {
          const dist = b.r + 40 + i * def.step;
          const x = b.x + Math.cos(a) * dist;
          const y = b.y + Math.sin(a) * dist;
          if (!inside(world, x, y, 6)) continue;
          pushMark(world, act, b, { x, y, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, color: COLD });
        }
      }
      sfx(world, 'swingHeavy');
    },
  }),

  // クライオ・ワイバーン：霜の翼（左右に氷の壁が立ち、一本道の通路に氷柱の波が走る）
  frostwings: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      const cx = clamp(p.x, bd.left + def.gap / 2 + 50, bd.right - def.gap / 2 - 50);
      const pillar = DATA.enemies.get(def.pillar);
      for (const side of [-1, 1]) {
        for (let y = bd.top + 14; y < bd.bottom; y += def.spacing) {
          const x = cx + side * (def.gap / 2);
          if (Math.hypot(x - p.x, y - p.y) < p.r + pillar.radius + 8) continue;
          if (Math.hypot(x - b.x, y - b.y) < b.r + pillar.radius) continue;
          const e = createEnemy(pillar, x, y, 0.15, world.rng, world.room.enemyScale ?? 1, world.room.hpScale ?? 1);
          e.expire = world.time + def.life;
          world.enemies.push(e);
        }
      }
      for (let i = 0; i < def.marks; i++) {
        const y = bd.top + 36 + (i * (bd.bottom - bd.top - 72)) / Math.max(1, def.marks - 1);
        const x = cx + (i % 2 === 0 ? -1 : 1) * def.laneOffset;
        pushMark(world, act, b, { x, y, r: def.markRadius, t: def.delay + i * def.stagger, damage: def.damage, color: COLD });
      }
      sfx(world, 'block');
      addShake(world, FEEL.shake.hit);
    },
  }),

  // クライオ・ワイバーン：凍る息（扇形に冷気を吹く。浴びた場所に、滑る床が残る）
  frostbreath: {
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
          act.tick = 0;
          sfx(world, 'enemyShot');
        }
      } else if (act.phase === 'active') {
        act.tick -= dt;
        if (act.tick <= 0) {
          act.tick = def.tick;
          const angle = Math.atan2(act.dirY, act.dirX);
          if (arcHitsCircle(b.x, b.y, angle, def.arc * DEG, def.range, p.x, p.y, p.r)) {
            slowPlayer(world); // 減速は、被弾後の無敵が付く前に（無敵のあいだは、かからない）
            hurtPlayer(world, def.damage);
          }
          // 浴びせた場所に、凍る床
          const a = angle + (world.rng() - 0.5) * def.arc * DEG;
          const dist = 90 + world.rng() * (def.range - 90);
          const spot = { x: b.x + Math.cos(a) * dist, y: b.y + Math.sin(a) * dist };
          if (inside(world, spot.x, spot.y, 10)) {
            world.hazards.push({ type: 'ice', x: spot.x, y: spot.y, r: def.patch.r, life: def.patch.life, max: def.patch.life, color: COLD });
            const patches = world.hazards.filter((h) => h.type === 'ice' && !h.dead);
            for (const old of patches.slice(0, Math.max(0, patches.length - def.patch.max))) old.dead = true;
          }
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
  },

  // クライオ・ワイバーン：寒空の影
  skyshadow: {
    start(world, b, act) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.shadow = null;
      sfx(world, 'bossCharge');
    },
    update(world, b, dt, act) {
      const def = act.def;
      if (act.phase === 'telegraph') {
        act.t -= dt;
        if (act.t <= 0) {
          act.phase = 'hidden';
          b.hidden = true;
          act.shadow = { type: 'shadow', x: b.x, y: b.y, wp: { x: b.x, y: b.y }, wpT: 0, roam: def.roam, speed: def.speed, wander: def.wander, phase: 'roam', t: 0, landT: def.land, r: def.radius, damage: def.damage, owner: b, landed: false, color: COLD };
          world.hazards.push(act.shadow);
          burst(world, b.x, b.y, COLD, 20, 260);
          b.x = -9000;
        }
      } else if (act.phase === 'hidden') {
        if (act.shadow.dead) {
          b.hidden = false;
          b.x = act.shadow.x;
          b.y = act.shadow.y;
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else {
        act.t -= dt;
        if (act.t <= 0) return true;
      }
      return false;
    },
  },

  // クライオ・ワイバーン：大技「絶対零度」
  absolutezero: timed({
    fire(world, b, act) {
      const def = act.def;
      const h = { type: 'coldfield', t: def.duration, fires: [], next: null, count: def.fires, r: def.radius, move: def.move, moveT: def.move, warn: def.warn, rate: def.rate, cool: def.cool, damage: def.damage, freeze: def.freeze, after: def.after, chill: 0, color: COLD };
      h.fires = HAZARDS.coldfield.spots(world, h);
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // オーバーロード：命令ブロック
  opblocks: timed({
    fire(world, b, act) {
      act.hs.push(makeBlocks(world, act.def, world.player, SHOCK));
      sfx(world, 'enemyShot');
    },
  }),

  // オーバーロード：配線トレース
  tracepath: timed({
    fire(world, b, act) {
      act.hs.push(makeTrace(world, b, act.def));
      sfx(world, 'enemyShot');
    },
  }),

  // オーバーロード：子機の円陣（子機を全部壊すと、本体に隙ができる）
  satellites: timed({
    fire(world, b, act) {
      const def = act.def;
      const kind = DATA.enemies.get(def.enemy);
      for (let i = 0; i < def.count; i++) {
        const e = createEnemy(kind, b.x, b.y, 0.4, world.rng, world.room.enemyScale ?? 1, world.room.hpScale ?? 1);
        e.anchor = b;
        e.headIndex = i;
        e.anchorAngle = (i * Math.PI * 2) / def.count;
        e.anchorDist = def.orbit;
        e.cd = 0.8 + i * 0.5;
        e.noStagger = true;
        e.expire = world.time + def.duration;
        world.enemies.push(e);
        act.hs.push(e);
      }
      act.opened = false;
      sfx(world, 'enemyShot');
    },
    finished(world, b, act, dt) {
      const alive = act.hs.filter((e) => !e.dead);
      for (const e of alive) e.anchorAngle += act.def.spin * dt;
      if (alive.length > 0) return false;
      // 時間切れでなく、プレイヤーが全部壊したときだけ、本体に隙ができる
      if (world.time < act.hs[0].expire - 0.05) {
        act.recoverT = act.def.recover + act.def.open;
        floatText(world, b.x, b.y - b.r - 14, 'Unit Down', COLORS.cyan, 18);
      }
      return true;
    },
  }),

  // オーバーロード：再起動（四隅の端末を、1つでも壊さないと、全体に放電する）
  reboot: {
    start(world, b, act) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.terminals = [];
      sfx(world, 'warning');
    },
    update(world, b, dt, act) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t <= 0) {
          act.phase = 'active';
          act.t = def.charge;
          const kind = DATA.enemies.get(def.terminal);
          for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const x = bd.left + def.inset + fx * (bd.right - bd.left - def.inset * 2);
            const y = bd.top + def.inset + fy * (bd.bottom - bd.top - def.inset * 2);
            const e = createEnemy(kind, x, y, 0.3, world.rng, world.room.enemyScale ?? 1, world.room.hpScale ?? 1);
            world.enemies.push(e);
            act.terminals.push(e);
          }
        }
      } else if (act.phase === 'active') {
        if (act.terminals.some((e) => e.dead)) {
          // 1つでも壊した：放電は止まり、本体に隙ができる
          for (const e of act.terminals) if (!e.dead) {
            e.dead = true;
            burst(world, e.x, e.y, e.color, 8, 180);
          }
          floatText(world, b.x, b.y - b.r - 14, 'Reboot Failed', COLORS.cyan, 18);
          sfx(world, 'levelup');
          act.phase = 'recover';
          act.t = def.recover + def.open;
        } else if (act.t <= 0) {
          const nearWall = p.x - bd.left < def.safe || bd.right - p.x < def.safe || p.y - bd.top < def.safe || bd.bottom - p.y < def.safe;
          if (!nearWall) hurtPlayer(world, def.damage);
          ring(world, b.x, b.y, 380, SHOCK);
          burst(world, b.x, b.y, SHOCK, 40, 360);
          addShake(world, FEEL.shake.charged);
          sfx(world, 'explode');
          for (const e of act.terminals) {
            e.dead = true;
            burst(world, e.x, e.y, e.color, 8, 180);
          }
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // オーバーロード：基板ショート
  shortcircuit: timed({
    fire(world, b, act) {
      const def = act.def;
      const points = boardPoints(world.bounds);
      const picked = [];
      while (picked.length < def.count && points.length > 0) picked.push(points.splice(Math.floor(world.rng() * points.length) % points.length, 1)[0]);
      picked.forEach((pt, i) => {
        const t = def.delay + i * def.stagger;
        for (const angle of [0, Math.PI / 2]) {
          const bar = { type: 'bar', x: pt.x, y: pt.y, angle, width: def.width, t, max: t, damage: def.damage, color: b.color, flash: 0 };
          world.hazards.push(bar);
          act.hs.push(bar);
        }
      });
      sfx(world, 'enemyShot');
    },
  }),

  // オーバーロード：大技「全システム停止」
  systemhalt: timed({
    fire(world, b, act) {
      const def = act.def;
      const blocks = makeBlocks(world, def, world.player, SHOCK);
      blocks.dim = def.dim;
      blocks.hideAfter = def.hideAfter;
      act.hs.push(blocks);
      const trace = makeTrace(world, b, def.trace);
      trace.warn += def.traceDelay;
      act.hs.push(trace);
      sfx(world, 'warning');
    },
  }),
};

// 命令ブロックを置く（1つ目はプレイヤーの近く、残りは部屋のあちこち。番号は、ばらばらの順）
function makeBlocks(world, def, p, color) {
  const blocks = [];
  for (let i = 0; i < def.count; i++) {
    let spot = null;
    for (let tries = 0; tries < 60; tries++) {
      const s = i === 0 ? { x: p.x + (world.rng() - 0.5) * 240, y: p.y + (world.rng() - 0.5) * 240 } : randomSpot(world, 50);
      if (!inside(world, s.x, s.y, 40)) continue;
      if (blocks.every((o) => Math.hypot(o.x - s.x, o.y - s.y) >= def.sep)) {
        spot = s;
        break;
      }
    }
    if (spot) blocks.push({ ...spot, n: 0, done: false });
  }
  const order = blocks.map((_, i) => i + 1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(world.rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  blocks.forEach((blk, i) => (blk.n = order[i]));
  const h = { type: 'opblocks', blocks, warn: def.warn, gap: def.gap, clock: 0, radius: def.radius, damage: def.damage, dim: 0, hideAfter: null, color };
  world.hazards.push(h);
  return h;
}

// 配線トレースを置く：基板の線の上の、曲がりながら進む道
function makeTrace(world, b, def) {
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
  const segs = [];
  for (let i = 0; i < route.length - 1; i++) segs.push({ x1: route[i].x, y1: route[i].y, x2: route[i + 1].x, y2: route[i + 1].y, f: 0, life: null });
  const h = { type: 'trace', route, segs, edge: 0, f: 0, warn: def.warn, warnMax: def.warn, speed: def.speed, trailLife: def.trailLife, width: def.width, damage: def.damage, color: SHOCK };
  world.hazards.push(h);
  return h;
}

// bossPatterns.js から呼ぶ：部品とハザードを登録する
export function installMap1(PATTERNS, HAZARD_TYPES) {
  Object.assign(PATTERNS, MAP1_PATTERNS);
  Object.assign(HAZARD_TYPES, HAZARDS);
}
