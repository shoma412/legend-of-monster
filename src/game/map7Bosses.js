// マップ7のボスの、そのボスだけの攻撃。共通の部品は使わない（docs/詳細仕様.md「新しいボスを作るときの決まり」）。
//   コギトール    : forecast 予測 / multiplex 多重化 / interrupt 割り込み / glitch 演算エラー / overheat 過熱 / allthreads 全並列（大技）
//   ファブリケーター: assemble 組立 / belts ベルト / press プレス / moltenspit 溶鉄 / fasten 締結 / fullline 全工程稼働（大技）
//   アーカイバー  : echo 再生 / trailstrike 足跡爆撃 / collect 回収弾 / censorbars 検閲帯 / backup 復元 / rewind 巻き戻し（大技）
//   ゲートキーパー: gateclose 閉門 / holdshots 検問弾 / callguards 衛兵召喚 / fissure 裂け目 / tailbomb 尾行爆弾 / lockdown 全門閉鎖（大技）
// 残る床や線は hazard（world.hazards）として置き、動きは HAZARDS_MAP7 の update、絵は src/render/map7Draw.js の draw で扱う。
import { FEEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS } from '../data/theme.js';
import { circlesOverlap, clampToBounds, distToSegment } from '../logic/geometry.js';
import { startRain } from './acidRain.js';
import { clamp, pushMark, timed, trackVelocity } from './bossKit.js';
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
  // 演算エラー：床の四角い区画が、予告のあと、一瞬だけ当たる
  glitchcell: {
    update(world, h, dt) {
      const p = world.player;
      if (h.wait > 0) {
        h.wait -= dt;
        return;
      }
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn <= 0) {
          h.phase = 'active';
          h.t = 0;
          sfx(world, 'zap');
        }
        return;
      }
      h.t += dt;
      if (Math.abs(p.x - h.x) <= h.w / 2 + p.r && Math.abs(p.y - h.y) <= h.h / 2 + p.r) hurtPlayer(world, h.damage);
      if (h.t >= 0.4) h.dead = true;
    },
  },

  // 部品の飛来：部屋のふちから、組み上がる場所へ飛んで、着いたら砲台（enemy）になる
  partflight: {
    update(world, h, dt) {
      h.t += dt;
      const k = Math.min(1, h.t / h.dur);
      h.x = h.sx + (h.tx - h.sx) * k;
      h.y = h.sy + (h.ty - h.sy) * k;
      if (k >= 1) {
        const [scale, hpScale] = SCALE(world);
        const e = createEnemy(DATA.enemies.get(h.enemy), h.tx, h.ty, 0.3, world.rng, scale, hpScale);
        e.expire = world.time + h.life;
        world.enemies.push(e);
        ring(world, h.tx, h.ty, 50, h.color);
        burst(world, h.tx, h.ty, h.color, 16, 220);
        sfx(world, 'block');
        h.dead = true;
      }
    },
  },

  // ベルト：帯の中にいると、dir の向きへ流される（ダッシュ中は流されない）。warn 秒の予告のあと、life 秒つづく
  belt: {
    update(world, h, dt) {
      const p = world.player;
      if (h.warn > 0) {
        h.warn -= dt;
        return;
      }
      h.age += dt;
      const d = h.axis === 'h' ? Math.abs(p.y - h.pos) : Math.abs(p.x - h.pos);
      if (d <= h.width / 2 && p.dashT <= 0) {
        if (h.axis === 'h') p.x += h.dir * h.speed * dt;
        else p.y += h.dir * h.speed * dt;
        clampToBounds(p, world.bounds);
      }
      if (h.age >= h.life) h.dead = true;
    },
  },

  // 修繕工場のゆれる床（検閲帯と同じく、予告のあと一瞬だけ当たる）は、ここには書かない（マークを使う）

  // 再生の影：プレイヤーが通ってきた道を、delay 秒遅れで、そのままなぞって追ってくる。出てから delay 秒は、出た場所で待つ（当たらない）
  replayshade: {
    update(world, h, dt) {
      const p = world.player;
      h.age += dt;
      h.buf.push({ t: h.age, x: p.x, y: p.y });
      const want = h.age - h.delay;
      if (want < 0) {
        h.x = h.buf[0].x;
        h.y = h.buf[0].y;
        h.active = false;
        return;
      }
      h.active = true;
      while (h.i < h.buf.length - 1 && h.buf[h.i + 1].t <= want) h.i++;
      const a = h.buf[h.i];
      const b = h.buf[Math.min(h.i + 1, h.buf.length - 1)];
      const k = b.t > a.t ? (want - a.t) / (b.t - a.t) : 0;
      h.x = a.x + (b.x - a.x) * k;
      h.y = a.y + (b.y - a.y) * k;
      if (h.i > 600) {
        h.buf.splice(0, h.i - 1);
        h.i = 1;
      }
      if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
      if (h.age >= h.life) h.dead = true;
    },
  },

  // 検閲帯：黒い帯が、予告のあと、一瞬だけ当たる。当たったあと、横へずれて、もう一度（steps の位置を順に）
  censor: {
    update(world, h, dt) {
      const p = world.player;
      const pos = h.steps[h.step];
      if (h.phase === 'warn') {
        h.warn -= dt;
        if (h.warn <= 0) {
          h.phase = 'strike';
          h.t = 0;
          sfx(world, 'swingHeavy');
          addShake(world, FEEL.shake.hit);
        }
        return;
      }
      h.t += dt;
      const d = h.axis === 'x' ? Math.abs(p.x - pos) : Math.abs(p.y - pos);
      if (d <= h.width / 2 + p.r) hurtPlayer(world, h.damage);
      if (h.t >= 0.3) {
        h.step++;
        if (h.step >= h.steps.length) h.dead = true;
        else {
          h.phase = 'warn';
          h.warn = h.warnMax = h.rewarn;
        }
      }
    },
  },

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

// プレスの並びを1段ぶん置く（左から右、または右から左へ、順に落ちる）
function pressRow(world, act, b, def, rowFrac, dir, baseDelay) {
  const bd = world.bounds;
  const w = bd.right - bd.left;
  const h = bd.bottom - bd.top;
  for (let j = 0; j < def.cols; j++) {
    const x = bd.left + (j + 0.5) * (w / def.cols);
    const y = bd.top + rowFrac * h;
    pushMark(world, act, b, { x, y, r: def.radius, t: baseDelay + (dir > 0 ? j : def.cols - 1 - j) * def.stagger, damage: def.damage, color: b.color });
  }
}

// 溶鉄を落とす（プレイヤーの足元と、そのまわり）。落ちた所に、燃える床が残る
function moltenDrop(world, act, b, def) {
  const p = world.player;
  for (let i = 0; i < def.count; i++) {
    const a = world.rng() * Math.PI * 2;
    const r = i === 0 ? 0 : def.spread * (0.6 + world.rng() * 0.5);
    const x = clamp(p.x + Math.cos(a) * r, world.bounds.left + 30, world.bounds.right - 30);
    const y = clamp(p.y + Math.sin(a) * r, world.bounds.top + 30, world.bounds.bottom - 30);
    pushMark(world, act, b, { x, y, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, color: '#ff7a3d', extra: { pool: { radius: def.poolRadius, arm: 0.4, life: def.poolLife, tick: 0.5, damage: def.poolDamage, dot: 'burn' } } });
  }
}

// 演算エラーの区画を、プレイヤーのまわりに count 個置く（床の格子に合わせて、大きさ cell px の四角）
function glitchCells(world, act, b, def) {
  const p = world.player;
  const bd = world.bounds;
  for (let i = 0; i < def.count; i++) {
    const gx = Math.round((p.x + (world.rng() - 0.5) * def.spread * 2) / def.cell) * def.cell;
    const gy = Math.round((p.y + (world.rng() - 0.5) * def.spread * 2) / def.cell) * def.cell;
    const h = {
      type: 'glitchcell', x: clamp(gx, bd.left + def.cell / 2, bd.right - def.cell / 2), y: clamp(gy, bd.top + def.cell / 2, bd.bottom - def.cell / 2), w: def.cell, h: def.cell,
      wait: i * def.stagger, phase: 'warn', warn: def.warn, warnMax: def.warn, t: 0, damage: def.damage, color: b.color,
    };
    world.hazards.push(h);
    act.hs.push(h);
  }
}

// 予測の印を置く（プレイヤーのいまの動きが続いたとしたときの、leads 秒あとの位置）
function forecastMarks(world, act, b, def) {
  const p = world.player;
  def.leads.forEach((lead, i) => {
    const x = clamp(p.x + (act.vx ?? 0) * lead, world.bounds.left + 30, world.bounds.right - 30);
    const y = clamp(p.y + (act.vy ?? 0) * lead, world.bounds.top + 30, world.bounds.bottom - 30);
    pushMark(world, act, b, { x, y, r: def.radius, t: lead + def.delay, damage: def.damage, color: b.color });
  });
}

// 分身を count 体、部屋のあちこちに出す（弾を放射状に撃つ。life 秒で消える）
function spawnCopies(world, act, b, def) {
  const [scale, hpScale] = SCALE(world);
  const kind = DATA.enemies.get(def.enemy);
  const bd = world.bounds;
  for (let i = 0; i < def.count; i++) {
    const a = (i * Math.PI * 2) / def.count + world.rng() * 0.5;
    const x = clamp((bd.left + bd.right) / 2 + Math.cos(a) * 300, bd.left + 50, bd.right - 50);
    const y = clamp((bd.top + bd.bottom) / 2 + Math.sin(a) * 170, bd.top + 50, bd.bottom - 50);
    const e = createEnemy(kind, x, y, 0.4, world.rng, scale, hpScale);
    e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * def.hpMul));
    e.expire = world.time + def.life;
    world.enemies.push(e);
    act.hs.push(e);
  }
}

export const PATTERNS_MAP7 = {
  // 予測：プレイヤーの動きが続いたとして、leads 秒あとの位置に、印が並ぶ。止まれば足元、走れば走る先。予告のあいだ（telegraph）の動きで決まる
  forecast: {
    start(world, b, act) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.lx = null;
      act.hs = [];
      sfx(world, 'bossCharge');
    },
    update(world, b, dt, act) {
      const def = act.def;
      trackVelocity(act, world.player, dt);
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t <= 0) {
          act.phase = 'active';
          forecastMarks(world, act, b, def);
          sfx(world, 'enemyShot');
        }
      } else if (act.phase === 'active') {
        if (act.hs.every((h) => h.dead)) {
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // 多重化：分身が count 体出て、それぞれ、弾を放射状に撃つ（life 秒で消える）。壊せる
  multiplex: timed({
    fire(world, b, act) {
      spawnCopies(world, act, b, act.def);
      floatText(world, b.x, b.y - b.r - 14, 'Fork', COLORS.cyan, 14);
      sfx(world, 'warning');
    },
    finished(world, b, act, dt) {
      act.clock = (act.clock ?? 0) + dt;
      return act.clock >= act.def.hold;
    },
  }),

  // 割り込み：広がる輪が count 回。当たるとダメージと減速（動きを止められる）
  interrupt: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const h = { type: 'elemring', x: b.x, y: b.y, r: b.r, speed: def.speed, max: def.max, width: def.width, damage: def.damage, fx: { slow: true, dots: [], power: 1 }, wait: i * def.gap + 0.001, color: '#8fd8ff' };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),

  // 演算エラー：床の四角い区画が、プレイヤーのまわりで、次々に誤作動する
  glitch: timed({
    fire(world, b, act) {
      glitchCells(world, act, b, act.def);
      sfx(world, 'warning');
    },
  }),

  // 過熱：部屋の外から、ボスへ向かって縮む熱の輪が count 本
  overheat: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const h = { type: 'closering', owner: b, x: b.x, y: b.y, r: def.start, min: def.min, speed: def.speed, width: def.width, damage: def.damage, wait: i * def.gap, color: '#ff7a3d' };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'bossCharge');
    },
  }),

  // 全並列（大技）：分身が出続け、予測と演算エラーが重なる。duration 秒つづく
  allthreads: timed({
    fire(world, b, act) {
      const def = act.def;
      act.clock = 0;
      act.lx = null;
      act.forecastAt = 1.0;
      act.glitchAt = 0.5;
      spawnCopies(world, act, b, def.copies);
      addShake(world, FEEL.shake.charged);
      sfx(world, 'explode');
    },
    finished(world, b, act, dt) {
      const def = act.def;
      trackVelocity(act, world.player, dt);
      act.clock += dt;
      if (act.clock >= act.forecastAt && act.clock < def.duration - 2) {
        act.forecastAt += def.forecastEvery;
        forecastMarks(world, act, b, def.forecast);
      }
      if (act.clock >= act.glitchAt && act.clock < def.duration - 2) {
        act.glitchAt += def.glitchEvery;
        glitchCells(world, act, b, def.glitch);
      }
      return act.clock >= def.duration + 1 && act.hs.every((h) => h.dead);
    },
  }),

  // 組立：部屋のふちから部品が飛んできて、プレイヤーのまわりで砲台に組み上がる（turretLife 秒で壊れる）。壊せる
  assemble: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      for (let i = 0; i < def.count; i++) {
        const a = world.rng() * Math.PI * 2;
        const r = def.minDist + world.rng() * (def.maxDist - def.minDist);
        const tx = clamp(p.x + Math.cos(a) * r, bd.left + 40, bd.right - 40);
        const ty = clamp(p.y + Math.sin(a) * r, bd.top + 40, bd.bottom - 40);
        const side = Math.floor(world.rng() * 4) % 4;
        const sx = side === 0 ? bd.left : side === 1 ? bd.right : tx;
        const sy = side === 2 ? bd.top : side === 3 ? bd.bottom : ty;
        const h = { type: 'partflight', sx, sy, tx, ty, x: sx, y: sy, t: -i * def.gap, dur: def.fly, enemy: def.enemy, life: def.turretLife, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'enemyShot');
    },
    finished(world, b, act, dt) {
      act.clock = (act.clock ?? 0) + dt;
      return act.clock >= act.def.hold;
    },
  }),

  // ベルト：床の帯が count 本、向きを交互に、プレイヤーを流す。流される先の壁や、換気扇の壁に気をつける
  belts: timed({
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      const horizontal = world.rng() < 0.5;
      const len = horizontal ? bd.bottom - bd.top : bd.right - bd.left;
      const start = horizontal ? bd.top : bd.left;
      for (let i = 0; i < def.count; i++) {
        const pos = start + (len * (i + 1)) / (def.count + 1);
        const h = { type: 'belt', axis: horizontal ? 'h' : 'v', pos, width: def.width, dir: i % 2 === 0 ? 1 : -1, speed: def.speed, warn: def.warn, warnMax: def.warn, age: 0, life: def.life, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'warning');
    },
  }),

  // プレス：巨大な押し潰しが、列ごとに、左から右へ（段ごとに向きが逆）順に落ちる
  press: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let r = 0; r < def.rows; r++) pressRow(world, act, b, def, (r + 1) / (def.rows + 1), r % 2 === 0 ? 1 : -1, def.delay + r * def.rowGap);
      sfx(world, 'warning');
    },
  }),

  // 溶鉄：プレイヤーの足元とそのまわりに溶鉄が落ちる。落ちた所に、燃える床が残る
  moltenspit: timed({
    fire(world, b, act) {
      moltenDrop(world, act, b, act.def);
      sfx(world, 'enemyShot');
    },
  }),

  // 締結：部屋のあちこちに留め具が打たれ、その間を電撃の線がつなぐ（予告のあと、一瞬だけ当たる）。プレイヤーの足元も、点の1つ
  fasten: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      const pts = [{ x: clamp(p.x, bd.left + 30, bd.right - 30), y: clamp(p.y, bd.top + 30, bd.bottom - 30) }];
      for (let tries = 0; tries < 80 && pts.length < def.points; tries++) {
        const sx = bd.left + 40 + world.rng() * (bd.right - bd.left - 80);
        const sy = bd.top + 40 + world.rng() * (bd.bottom - bd.top - 80);
        if (pts.every((q) => Math.hypot(q.x - sx, q.y - sy) >= 160)) pts.push({ x: sx, y: sy });
      }
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
      segs.push([pts[pts.length - 1], pts[0]]);
      const h = { type: 'netline', points: pts, segs, phase: 'warn', warn: def.warn, warnMax: def.warn, t: 0, flash: 0.3, width: def.width, damage: def.damage, color: '#ffb347' };
      world.hazards.push(h);
      act.hs.push(h);
      sfx(world, 'warning');
    },
  }),

  // 全工程稼働（大技）：ベルトが回り続け、プレスと溶鉄が次々に来る。duration 秒つづく
  fullline: timed({
    fire(world, b, act) {
      const def = act.def;
      const bd = world.bounds;
      act.clock = 0;
      act.pressAt = 0.6;
      act.moltenAt = 1.2;
      const len = bd.bottom - bd.top;
      for (let i = 0; i < 2; i++) {
        const h = { type: 'belt', axis: 'h', pos: bd.top + (len * (i + 1)) / 3, width: def.beltWidth, dir: i % 2 === 0 ? 1 : -1, speed: def.beltSpeed, warn: 1.0, warnMax: 1.0, age: 0, life: def.duration, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      addShake(world, FEEL.shake.charged);
      sfx(world, 'explode');
    },
    finished(world, b, act, dt) {
      const def = act.def;
      act.clock += dt;
      if (act.clock >= act.pressAt && act.clock < def.duration - 2) {
        act.pressAt += def.pressEvery;
        pressRow(world, act, b, def.press, 0.25 + world.rng() * 0.5, world.rng() < 0.5 ? 1 : -1, def.press.delay);
        sfx(world, 'warning');
      }
      if (act.clock >= act.moltenAt && act.clock < def.duration - 2) {
        act.moltenAt += def.moltenEvery;
        moltenDrop(world, act, b, def.molten);
      }
      return act.clock >= def.duration + 1 && act.hs.every((h) => h.dead);
    },
  }),

  // 再生：プレイヤーの通った道をなぞる影が、count 体、delay 秒遅れで追ってくる（life 秒で消える）
  echo: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const h = { type: 'replayshade', x: world.player.x, y: world.player.y, buf: [], i: 0, age: 0, delay: def.delay + i * def.gap, life: def.life, r: def.radius, damage: def.damage, active: false, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'warning');
    },
    finished(world, b, act, dt) {
      act.clock = (act.clock ?? 0) + dt;
      return act.clock >= act.def.hold;
    },
  }),

  // 足跡爆撃：予告のあいだに歩いた場所（every 秒ごとに記録）に、あとから、落雷の予告が並ぶ。同じ場所に居続けても、歩き回っても、足跡は残る
  trailstrike: {
    start(world, b, act) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.samples = [];
      act.clock = 0;
      act.next = 0;
      act.hs = [];
      sfx(world, 'bossCharge');
    },
    update(world, b, dt, act) {
      const def = act.def;
      const p = world.player;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        act.clock += dt;
        if (act.clock >= act.next) {
          act.next += def.every;
          act.samples.push({ x: p.x, y: p.y });
        }
        if (act.t <= 0) {
          act.phase = 'active';
          act.samples.slice(-def.count).forEach((s, i) => pushMark(world, act, b, { x: s.x, y: s.y, r: def.radius, t: def.delay + i * def.stagger, damage: def.damage, color: b.color }));
          sfx(world, 'enemyShot');
        }
      } else if (act.phase === 'active') {
        if (act.hs.every((h) => h.dead)) {
          act.phase = 'recover';
          act.t = def.recover;
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  // 回収弾：部屋の外まわりから、ボスめがけて弾が飛んでくる（ボスのいる場所を、つぎつぎ通る）。count 発、gap 秒ずつ
  collect: timed({
    fire(world, b, act) {
      act.clock = 0;
      act.fired = 0;
    },
    finished(world, b, act, dt) {
      const def = act.def;
      const bd = world.bounds;
      act.clock += dt;
      while (act.fired < def.count && act.clock >= act.fired * def.gap) {
        const side = Math.floor(world.rng() * 4) % 4;
        const x = side === 0 ? bd.left + 6 : side === 1 ? bd.right - 6 : bd.left + 30 + world.rng() * (bd.right - bd.left - 60);
        const y = side === 2 ? bd.top + 6 : side === 3 ? bd.bottom - 6 : bd.top + 30 + world.rng() * (bd.bottom - bd.top - 60);
        const a = Math.atan2(b.y - y, b.x - x);
        world.shots.push({ x, y, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, r: def.radius, damage: def.damage, life: 6, color: b.color });
        act.fired++;
      }
      return act.fired >= def.count && act.clock >= def.count * def.gap + 1.8;
    },
  }),

  // 検閲帯：黒い帯が、プレイヤーの近くに count 本。予告のあと一瞬当たり、横へ shift px ずれて、もう一度当たる
  censorbars: timed({
    fire(world, b, act) {
      const def = act.def;
      const p = world.player;
      const bd = world.bounds;
      for (let i = 0; i < def.count; i++) {
        const axis = i % 2 === 0 ? (world.rng() < 0.5 ? 'x' : 'y') : act.hs[act.hs.length - 1].axis === 'x' ? 'y' : 'x';
        const base = axis === 'x' ? p.x : p.y;
        const lo = axis === 'x' ? bd.left + 40 : bd.top + 40;
        const hi = axis === 'x' ? bd.right - 40 : bd.bottom - 40;
        const dir = world.rng() < 0.5 ? 1 : -1;
        const first = clamp(base + (i === 0 ? 0 : (world.rng() - 0.5) * 200), lo, hi);
        const second = clamp(first + dir * def.shift, lo, hi);
        const h = { type: 'censor', axis, steps: [first, second], step: 0, phase: 'warn', warn: def.warn + i * def.stagger, warnMax: def.warn + i * def.stagger, rewarn: def.rewarn, width: def.width, damage: def.damage, t: 0, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      sfx(world, 'warning');
    },
  }),

  // 復元：記録の柱が count 本出る。壊さないと、ボスのHPが回復し続ける（柱1本につき、毎秒 healPerSec の割合）。maxTime 秒で切り上げる
  backup: timed({
    fire(world, b, act) {
      const def = act.def;
      const [scale, hpScale] = SCALE(world);
      const kind = DATA.enemies.get(def.enemy);
      act.clock = 0;
      for (let i = 0; i < def.count; i++) {
        const a = (i * Math.PI * 2) / def.count + world.rng();
        const r = 180 + world.rng() * 120;
        const e = createEnemy(kind, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 0.4, world.rng, scale, hpScale);
        e.x = clamp(e.x, world.bounds.left + 40, world.bounds.right - 40);
        e.y = clamp(e.y, world.bounds.top + 40, world.bounds.bottom - 40);
        e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * def.hpMul));
        e.expire = world.time + def.maxTime + 2;
        world.enemies.push(e);
        act.hs.push(e);
      }
      floatText(world, b.x, b.y - b.r - 14, 'Backup', COLORS.cyan, 14);
      sfx(world, 'warning');
    },
    finished(world, b, act, dt) {
      act.clock += dt;
      const alive = act.hs.filter((e) => !e.dead).length;
      if (alive > 0) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * act.def.healPerSec * alive * dt);
      if (alive === 0 || act.clock >= act.def.maxTime) {
        for (const e of act.hs) if (!e.dead) e.expire = world.time;
        return true;
      }
      return false;
    },
  }),

  // 巻き戻し（大技）：再生の影が、delay をずらして count 体。同時に、酸の雨が rain 秒降る
  rewind: timed({
    fire(world, b, act) {
      const def = act.def;
      for (let i = 0; i < def.count; i++) {
        const h = { type: 'replayshade', x: world.player.x, y: world.player.y, buf: [], i: 0, age: 0, delay: def.delay + i * def.gap, life: def.life, r: def.radius, damage: def.damage, active: false, color: b.color };
        world.hazards.push(h);
        act.hs.push(h);
      }
      startRain(world, def.rain);
      addShake(world, FEEL.shake.charged);
      sfx(world, 'explode');
    },
  }),

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
