// ボスの攻撃パターンの部品。どれも「予告 → 攻撃 → 硬直」の流れで、終わったら true を返す。
// ボスの定義（src/data/bosses.js）の attacks で、数値を変えて組み合わせる。
//   act: { def, phase, t, ... } 実行中の攻撃の状態
//   d:   { dx, dy, dist } プレイヤーへの向きと距離
import { FEEL, ROOM } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { DATA } from '../data/index.js';
import { DEG, angleDiff, arcHitsCircle, circlesOverlap, clampToBounds, distToSegment } from '../logic/geometry.js';
import { cellHot, orbitBlades } from '../logic/bossShapes.js';
import { beamAngles, blindPlayer, breakLamp, flashAt, nearLitLamp, powerOn, startBlackout } from './darkness.js';
import { afflictPlayer, damageEnemy, hurtPlayer, slowPlayer } from './combat.js';
import { breakRoof, rainHit, startRain, underRoof } from './acidRain.js';
import { recalcStats } from './build.js';
import { createEnemy } from './enemyAI.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';

const ELEMENT_COLORS_BY_ID = { shock: '#fff36b', heat: '#ff7a3d', cold: '#8fd8ff', corrode: '#b6ff3a' }; // src/data/theme.js の ELEMENT_COLORS と同じ
const ELEMENT_COLORS_RUST = '#ff7a3d'; // 「錆」の文字と印の色
// 色が切り替わるボス（バッファータンク）が、色を変えたときに出す文字
export const ELEMENT_NAMES_EN = { shock: 'Shock', heat: 'Heat', cold: 'Cold', corrode: 'Corrode' };
const BAR_FLASH = 0.16; // 線が光っている時間（秒）

function aimAt(act, d) {
  act.dirX = d.dx / d.dist;
  act.dirY = d.dy / d.dist;
}

export const PATTERNS = {
  charge: {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.remaining = act.def.repeat ?? 1;
      aimAt(act, d);
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        // 予告中はプレイヤーを追って向きを変える。最後の少しの間だけ向きを固定して、避ける余地を作る
        if (act.t > def.lockTime) aimAt(act, d);
        if (act.t <= 0) {
          act.phase = 'active';
          act.t = def.duration;
          sfx(world, 'bossCharge');
        }
      } else if (act.phase === 'active') {
        b.x += act.dirX * def.speed * dt;
        b.y += act.dirY * def.speed * dt;
        if (world.rng() < 0.6) burst(world, b.x - act.dirX * b.r, b.y - act.dirY * b.r, b.color, 1, 80);
        const p = world.player;
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        if (clampToBounds(b, world.bounds)) {
          // 壁に激突。連続突進の途中でもここで止まる
          act.phase = 'stun';
          act.t = def.wallStun;
          sfx(world, 'explode');
          addShake(world, FEEL.shake.charged);
          burst(world, b.x + act.dirX * b.r, b.y + act.dirY * b.r, b.color, 24, 260);
          floatText(world, b.x, b.y - b.r - 12, 'Stun!', COLORS.amber, 20);
        } else if (act.t <= 0) {
          act.remaining--;
          if (act.remaining > 0) {
            act.phase = 'telegraph';
            act.t = def.repeatTelegraph ?? def.telegraph;
            aimAt(act, d);
          } else {
            act.phase = 'recover';
            act.t = def.recover;
          }
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  },

  shockwave: {
    start(world, b, act) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
    },
    update(world, b, dt, act) {
      const def = act.def;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t <= 0) {
          sfx(world, 'explode');
          world.hazards.push({
            type: 'ring', x: b.x, y: b.y, r: b.r, speed: def.ringSpeed, max: def.ringMax, width: def.ringWidth,
            damage: def.damage, color: b.color, done: false,
          });
          addShake(world, FEEL.shake.charged);
          burst(world, b.x, b.y, b.color, 30, 260);
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

// 扇形に噴射し続ける（冷気ブレスなど）
PATTERNS.cone = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    aimAt(act, d);
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t > def.lockTime) aimAt(act, d);
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.duration;
      }
    } else if (act.phase === 'active') {
      const angle = Math.atan2(act.dirY, act.dirX);
      if (arcHitsCircle(b.x, b.y, angle, def.arc * DEG, def.range, p.x, p.y, p.r)) {
        if (def.slow) slowPlayer(world);
        hurtPlayer(world, def.damage);
      }
      // 噴射のしぶき
      for (let i = 0; i < 2; i++) {
        const a = angle + (world.rng() - 0.5) * def.arc * DEG;
        const v = def.range / 0.45;
        world.fx.particles.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45, max: 0.45, color: b.color, size: 4 });
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
};

// 自分の周りを一度に攻撃する（尻尾なぎ払いなど）
PATTERNS.slam = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        if (circlesOverlap(b.x, b.y, def.radius, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        ring(world, b.x, b.y, def.radius, b.color);
        burst(world, b.x, b.y, b.color, 24, 300);
        addShake(world, FEEL.shake.heavy);
        sfx(world, 'explode');
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 落下地点の予告を次々に出し、少し遅れてそこに落とす（氷柱の雨など）
PATTERNS.rain = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.left = act.def.count;
    act.next = 0;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) act.phase = 'active';
    } else if (act.phase === 'active') {
      act.next -= dt;
      if (act.next <= 0 && act.left > 0) {
        act.next = def.interval;
        act.left--;
        // プレイヤーのいる場所の近くを狙う
        const a = world.rng() * Math.PI * 2;
        const r = world.rng() * def.spread;
        world.hazards.push({ type: 'mark', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: def.radius, t: def.delay, max: def.delay, damage: def.damage, color: b.color });
      }
      if (act.left <= 0) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 回転するレーザー。予告の線の位置から、プレイヤーのいる側へ向かって回る
PATTERNS.laser = {
  start(world, b, act, d) {
    const def = act.def;
    act.phase = 'telegraph';
    act.t = def.telegraph;
    act.turnDir = world.rng() < 0.5 ? 1 : -1;
    // プレイヤーの少し手前の角度から始めて、プレイヤーを通り過ぎるように回す
    act.angle = Math.atan2(d.dy, d.dx) - act.turnDir * def.lead * DEG;
    act.swept = 0;
    act.dirX = Math.cos(act.angle);
    act.dirY = Math.sin(act.angle);
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        act.phase = 'active';
        sfx(world, 'laser');
      }
    } else if (act.phase === 'active') {
      const step = def.speed * DEG * dt;
      act.angle += act.turnDir * step;
      act.swept += step;
      act.dirX = Math.cos(act.angle);
      act.dirY = Math.sin(act.angle);
      const x2 = b.x + act.dirX * def.range;
      const y2 = b.y + act.dirY * def.range;
      if (distToSegment(p.x, p.y, b.x, b.y, x2, y2) <= p.r + def.width / 2) hurtPlayer(world, def.damage);
      if (act.swept >= def.turn * DEG) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 雑魚を呼ぶ
PATTERNS.summon = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        const live = world.enemies.filter((e) => !e.boss && !e.dead && !e.def.prop).length;
        const count = Math.max(0, Math.min(def.count, def.max - live));
        for (let i = 0; i < count; i++) {
          const a = (i / Math.max(1, count)) * Math.PI * 2 + world.rng() * 0.6;
          const e = createEnemy(DATA.enemies.get(def.enemy), b.x + Math.cos(a) * (b.r + 50), b.y + Math.sin(a) * (b.r + 50), 0.6, world.rng, world.room.enemyScale ?? 1, world.room.hpScale ?? 1);
          clampToBounds(e, world.bounds);
          world.enemies.push(e);
        }
        ring(world, b.x, b.y, b.r + 60, b.color);
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 冷却：しばらく動けない（大きな隙）。phase を 'stun' にするので、体に触れても安全
PATTERNS.vent = {
  start(world, b, act) {
    act.phase = 'stun';
    act.t = act.def.duration;
    floatText(world, b.x, b.y - b.r - 14, 'Cooling', COLORS.cyan, 20);
    burst(world, b.x, b.y, COLORS.ink, 30, 220);
  },
  update(world, b, dt, act) {
    act.t -= dt;
    if (world.rng() < 0.5) burst(world, b.x, b.y, COLORS.ink, 1, 160);
    return act.t <= 0;
  },
};

// 弾をばらまく。spread が 360 なら全方向、それより小さければプレイヤーの方向へ扇形に撃つ
//   waves 回に分けて撃ち、1回ごとに rotate 度ずつ向きがずれる（うずまきになる）。track: true なら毎回プレイヤーを狙い直す
PATTERNS.barrage = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.left = act.def.waves ?? 1;
    act.next = 0;
    aimAt(act, d);
    act.base = Math.atan2(act.dirY, act.dirX);
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t > (def.lockTime ?? 0)) {
        aimAt(act, d);
        act.base = Math.atan2(act.dirY, act.dirX);
      }
      if (act.t <= 0) act.phase = 'active';
    } else if (act.phase === 'active') {
      act.next -= dt;
      if (act.next <= 0 && act.left > 0) {
        act.next = def.interval ?? 0.3;
        act.left--;
        if (def.track) act.base = Math.atan2(d.dy, d.dx);
        const full = def.spread >= 360;
        for (let i = 0; i < def.count; i++) {
          const offset = full ? (i * 360) / def.count : def.count > 1 ? (i / (def.count - 1) - 0.5) * def.spread : 0;
          const a = act.base + offset * DEG;
          world.shots.push({
            x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r,
            vx: Math.cos(a) * def.shotSpeed, vy: Math.sin(a) * def.shotSpeed,
            r: def.shotRadius, damage: def.damage, life: def.shotLife ?? 4, slow: !!def.slow, color: act.color ?? b.color, // 「放出」のときは、その属性の色
          });
        }
        act.base += (def.rotate ?? 0) * DEG;
        sfx(world, 'enemyShot');
        burst(world, b.x, b.y, b.color, 8, 200);
      }
      if (act.left <= 0) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 跳びかかり。プレイヤーのいる場所に着地点の予告を出し、跳んで、着地で周りを攻撃する
//   ring を書くと、着地と同時に衝撃波の輪も広がる
PATTERNS.leap = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.tx = world.player.x;
    act.ty = world.player.y;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      // 予告中は着地点がプレイヤーを追う。最後の少しの間だけ固定する
      if (act.t > def.lockTime) {
        act.tx = p.x;
        act.ty = p.y;
      }
      if (act.t <= 0) {
        act.phase = 'air';
        act.t = def.air;
        act.sx = b.x;
        act.sy = b.y;
        sfx(world, 'bossCharge');
      }
    } else if (act.phase === 'air') {
      const k = 1 - Math.max(0, act.t) / def.air;
      b.x = act.sx + (act.tx - act.sx) * k;
      b.y = act.sy + (act.ty - act.sy) * k;
      act.height = Math.sin(k * Math.PI); // 描画用：跳んでいる高さ（0〜1）
      if (act.t <= 0) {
        act.height = 0;
        if (circlesOverlap(b.x, b.y, def.radius, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        if (def.ring) {
          world.hazards.push({ type: 'ring', x: b.x, y: b.y, r: def.radius, speed: def.ring.speed, max: def.ring.max, width: def.ring.width, damage: def.ring.damage, color: b.color, done: false });
        }
        ring(world, b.x, b.y, def.radius, b.color);
        burst(world, b.x, b.y, b.color, 30, 320);
        addShake(world, FEEL.shake.charged);
        sfx(world, 'explode');
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 部屋を横切る線の攻撃を、何本か続けて出す（落雷の列、格子レーザー）。線は予告のあと、一瞬だけ光って当たる
//   orient: aim（ボスからプレイヤーへの向きに平行）/ horizontal / vertical / cross（横と縦を交互に）
//   1本目はプレイヤーのいる場所を通り、残りは spacing ずつずれる。stagger 秒ずつ遅れて順に光る
PATTERNS.lines = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        const aim = Math.atan2(d.dy, d.dx);
        for (let i = 0; i < def.count; i++) {
          const angle = def.orient === 'aim' ? aim : def.orient === 'vertical' ? Math.PI / 2 : def.orient === 'cross' && i % 2 === 1 ? Math.PI / 2 : 0;
          // 0, +1, -1, +2, -2 … の順に、プレイヤーのいる場所から離れていく
          const step = def.orient === 'cross' ? Math.floor(i / 2) : i;
          const offset = (step % 2 === 1 ? 1 : -1) * Math.ceil(step / 2) * def.spacing;
          const delay = def.delay + i * (def.stagger ?? 0);
          world.hazards.push({
            type: 'bar', x: p.x - Math.sin(angle) * offset, y: p.y + Math.cos(angle) * offset, angle,
            width: def.width, t: delay, max: delay, damage: def.damage, color: b.color, flash: 0,
          });
        }
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// その場に残る危険な床を置く（霜だまり、過熱した床）。置かれてから arm 秒後に効き始め、life 秒残る
//   1つ目はプレイヤーの足元、残りはその周り（spread の範囲）。slow: true なら踏むと減速する
PATTERNS.pools = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        for (let i = 0; i < def.count; i++) {
          const a = world.rng() * Math.PI * 2;
          const r = i === 0 ? 0 : def.radius + world.rng() * def.spread;
          const spot = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 0 };
          clampToBounds(spot, world.bounds);
          world.hazards.push({
            type: 'pool', x: spot.x, y: spot.y, r: def.radius, arm: def.arm, armMax: def.arm, life: def.life,
            tick: def.tick, acc: def.tick, damage: def.damage, slow: !!def.slow, dot: def.dot, color: act.color ?? b.color,
          });
        }
        sfx(world, 'enemyShot');
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 振り子：吊ったフックが、予告の線の上を行ったり来たりする。線はプレイヤーのいる場所を通る（1本目は横、2本目は縦）
PATTERNS.pendulum = {
  start(world, b, act) {
    const def = act.def;
    const p = world.player;
    const bounds = world.bounds;
    act.phase = 'telegraph';
    act.t = def.telegraph;
    act.paths = [];
    for (let i = 0; i < def.lines; i++) {
      if (i % 2 === 0) act.paths.push({ x1: bounds.left + def.radius, y1: p.y, x2: bounds.right - def.radius, y2: p.y });
      else act.paths.push({ x1: p.x, y1: bounds.top + def.radius, x2: p.x, y2: bounds.bottom - def.radius });
    }
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        act.paths.forEach((path, i) => {
          // 2本目は、半周ぶんずらして動かす（同時に同じ場所へ来ないように）
          world.hazards.push({ type: 'hook', ...path, r: def.radius, period: def.period, t: i * 0.5, total: def.passes, damage: def.damage, color: b.color, x: path.x1, y: path.y1 });
        });
        sfx(world, 'bossCharge');
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 橋げた：予告の線に沿って、部屋を横切る杭の列（壁）を張る。
//   1本目は縦、2本目は横…と交互に、プレイヤーの少し横を通る。ところどころに隙間がある
PATTERNS.girder = {
  start(world, b, act) {
    const def = act.def;
    const p = world.player;
    const bounds = world.bounds;
    act.phase = 'telegraph';
    act.t = def.telegraph;
    act.spots = [];
    for (let i = 0; i < def.lines; i++) {
      const vertical = i % 2 === 0;
      const side = world.rng() < 0.5 ? -1 : 1;
      const from = vertical ? bounds.top : bounds.left;
      const to = vertical ? bounds.bottom : bounds.right;
      // プレイヤーの少し横を通る（部屋の端に寄りすぎないようにする）
      const lo = (vertical ? bounds.left : bounds.top) + 60;
      const hi = (vertical ? bounds.right : bounds.bottom) - 60;
      const at = Math.max(lo, Math.min(hi, (vertical ? p.x : p.y) + side * def.offset * (1 + Math.floor(i / 2) * 0.9)));
      // 隙間の場所
      const gaps = Array.from({ length: def.gaps }, () => from + 50 + world.rng() * (to - from - 100 - def.gap));
      for (let v = from + def.spacing / 2; v < to; v += def.spacing) {
        if (gaps.some((g) => v >= g && v <= g + def.gap)) continue;
        act.spots.push(vertical ? { x: at, y: v } : { x: v, y: at });
      }
    }
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        const post = DATA.enemies.get(def.post);
        for (const s of act.spots) {
          // プレイヤーの真上と、ボスの体の中には立てない
          if (Math.hypot(s.x - p.x, s.y - p.y) < p.r + post.radius + 8) continue;
          if (Math.hypot(s.x - b.x, s.y - b.y) < b.r + post.radius) continue;
          world.enemies.push(createEnemy(post, s.x, s.y, 0.15, world.rng, world.room.enemyScale ?? 1, world.room.hpScale ?? 1));
        }
        // 部屋に残せる数まで。超えたら、古い杭から崩れる
        const posts = world.enemies.filter((e) => !e.dead && e.def.id === def.post);
        for (const old of posts.slice(0, Math.max(0, posts.length - def.max))) {
          old.dead = true;
          burst(world, old.x, old.y, old.color, 6, 160);
        }
        sfx(world, 'block');
        addShake(world, FEEL.shake.hit);
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 磁力：しばらくのあいだ、プレイヤーを引き寄せる。歩けば逆らえる速さで、ダッシュ中は引かれない。最後に周りを叩く
PATTERNS.magnet = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.duration;
        sfx(world, 'bossCharge');
      }
    } else if (act.phase === 'active') {
      // 体に触れるほど近くまでは引かない
      if (p.dashT <= 0 && d.dist > b.r + p.r + 6) {
        p.x -= (d.dx / d.dist) * def.strength * dt;
        p.y -= (d.dy / d.dist) * def.strength * dt;
        clampToBounds(p, world.bounds);
      }
      if (world.rng() < 0.6) {
        // 引き寄せられる鉄くず（見た目だけ）
        const a = world.rng() * Math.PI * 2;
        const r = 220 + world.rng() * 120;
        world.fx.particles.push({ x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, vx: -Math.cos(a) * 420, vy: -Math.sin(a) * 420, life: 0.5, max: 0.5, color: b.color, size: 3 });
      }
      if (act.t <= 0) {
        if (circlesOverlap(b.x, b.y, def.radius, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        ring(world, b.x, b.y, def.radius, b.color);
        burst(world, b.x, b.y, b.color, 26, 300);
        addShake(world, FEEL.shake.heavy);
        sfx(world, 'explode');
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 潜行：潜って姿を消し、予告の円から飛び出して周りを攻撃する。
//   潜っている間は b.hidden が true で、攻撃が当たらない（画面の外に退避させる）。
//   着地点はプレイヤーを追い、最後の lockTime 秒だけ固定される。repeat 回くり返す
const HIDE_X = -9000;

PATTERNS.burrow = {
  start(world, b, act) {
    act.phase = 'dive';
    act.t = act.def.dive;
    act.remaining = act.def.repeat ?? 1;
    act.tx = b.x;
    act.ty = b.y;
    sfx(world, 'bossCharge');
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'dive') {
      // 潜っていく（まだ攻撃は当たる）
      act.sink = 1 - Math.max(0, act.t) / def.dive; // 描画用：0〜1
      if (act.t <= 0) {
        burst(world, b.x, b.y, b.color, 24, 240);
        act.phase = 'under';
        act.t = def.under;
        b.hidden = true;
        b.x = HIDE_X;
        act.tx = p.x;
        act.ty = p.y;
      }
    } else if (act.phase === 'under') {
      if (act.t > def.lockTime) {
        act.tx = p.x;
        act.ty = p.y;
      }
      if (act.t <= 0) {
        // 飛び出す
        b.hidden = false;
        b.x = act.tx;
        b.y = act.ty;
        act.sink = 0;
        if (circlesOverlap(b.x, b.y, def.radius, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        if (def.pool) {
          world.hazards.push({
            type: 'pool', x: b.x, y: b.y, r: def.pool.radius, arm: def.pool.arm, armMax: def.pool.arm, life: def.pool.life,
            tick: def.pool.tick, acc: def.pool.tick, damage: def.pool.damage, slow: !!def.pool.slow, color: b.color,
          });
        }
        ring(world, b.x, b.y, def.radius, b.color);
        burst(world, b.x, b.y, b.color, 30, 320);
        addShake(world, FEEL.shake.charged);
        sfx(world, 'explode');
        act.remaining--;
        act.phase = 'emerge';
        act.t = act.remaining > 0 ? 0.45 : def.recover;
      }
    } else if (act.t <= 0) {
      // 飛び出したあとの隙。まだ回数が残っていれば、もう一度潜る
      if (act.remaining > 0) {
        act.phase = 'dive';
        act.t = def.dive;
        sfx(world, 'bossCharge');
      } else {
        return true;
      }
    }
    return false;
  },
};

// 耐える（大技）：力を溜める。溜めている間に break（最大HPに対する割合）のダメージを与えると中断でき、長いスタンになる。
//   中断できないと、部屋の端まで届く輪が blast.count 回広がる。
//   pulse: { move, interval } を書くと、溜めている間、その技が重ねて出る
//   heal: 中断できなかったときに回復する割合。regrow: true なら首がすべて生え直す
PATTERNS.endure = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        act.phase = 'charge';
        act.t = def.duration;
        act.startHp = b.hp;
        act.need = Math.max(1, Math.round(b.maxHp * def.break));
        act.dealt = 0;
        act.pulseT = def.pulse?.first ?? 0.5;
        sfx(world, 'bossCharge');
        floatText(world, b.x, b.y - b.r - 44, '攻撃して止めろ', COLORS.amber, 18);
      }
    } else if (act.phase === 'charge') {
      act.dealt = Math.max(0, act.startHp - b.hp);
      if (act.dealt >= act.need) {
        act.phase = 'stun';
        act.t = def.stun;
        sfx(world, 'explode');
        addShake(world, FEEL.shake.charged);
        burst(world, b.x, b.y, COLORS.amber, 40, 340);
        floatText(world, b.x, b.y - b.r - 12, 'Break!', COLORS.amber, 24);
        return false;
      }
      if (def.pulse) {
        act.pulseT -= dt;
        if (act.pulseT <= 0) {
          act.pulseT = def.pulse.interval;
          b.sideRequest = def.pulse.move;
        }
      }
      if (act.t <= 0) {
        act.phase = 'blast';
        act.left = def.blast.count;
        act.next = 0;
        if (def.heal) {
          b.hp = Math.min(b.maxHp, b.hp + Math.round(b.maxHp * def.heal));
          floatText(world, b.x, b.y - b.r - 12, 'Regen', COLORS.green, 22);
        }
        if (def.regrow) b.regrowAll = true;
      }
    } else if (act.phase === 'blast') {
      act.next -= dt;
      if (act.next <= 0 && act.left > 0) {
        act.left--;
        act.next = def.blast.interval;
        world.hazards.push({
          type: 'ring', x: b.x, y: b.y, r: b.r, speed: def.blast.ringSpeed, max: def.blast.ringMax, width: def.blast.ringWidth,
          damage: def.blast.damage, color: b.color, done: false,
        });
        sfx(world, 'explode');
        addShake(world, FEEL.shake.charged);
        burst(world, b.x, b.y, b.color, 30, 300);
      }
      if (act.left <= 0) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 安全地帯（大技）：部屋全体が危険になり、zones 個の円の中だけが助かる。場所を変えて waves 回くり返す。
//   1つ目の円は、プレイヤーから within px 以内に必ず出る
function pickZones(world, b, def) {
  const bounds = world.bounds;
  const p = world.player;
  const zones = [];
  for (let i = 0; i < def.zones; i++) {
    let spot;
    for (let tries = 0; tries < 24; tries++) {
      if (i === 0) {
        const a = world.rng() * Math.PI * 2;
        const r = def.within * (0.5 + 0.5 * world.rng());
        spot = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: def.radius };
      } else {
        spot = { x: bounds.left + world.rng() * (bounds.right - bounds.left), y: bounds.top + world.rng() * (bounds.bottom - bounds.top), r: def.radius };
      }
      clampToBounds(spot, bounds);
      const clearOfBoss = Math.hypot(spot.x - b.x, spot.y - b.y) > b.r + def.radius + 12;
      if (clearOfBoss && zones.every((z) => Math.hypot(spot.x - z.x, spot.y - z.y) > def.radius * 2)) break;
    }
    zones.push(spot);
  }
  return zones;
}

PATTERNS.safezone = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.total = act.def.telegraph;
    act.wave = 0;
    act.zones = pickZones(world, b, act.def);
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.active;
        sfx(world, 'explode');
        addShake(world, FEEL.shake.charged);
      }
    } else if (act.phase === 'active') {
      if (!act.zones.some((z) => Math.hypot(p.x - z.x, p.y - z.y) <= z.r)) hurtPlayer(world, def.damage);
      if (act.t <= 0) {
        act.wave++;
        if (act.wave < def.waves) {
          act.phase = 'telegraph';
          act.t = act.total = def.waveTelegraph ?? def.telegraph;
          act.zones = pickZones(world, b, def);
        } else {
          act.phase = 'recover';
          act.t = def.recover;
        }
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 追尾（大技）：照準の円が count 個、interval 秒おきに現れる。follow 秒のあいだプレイヤーを追い、lock 秒止まってから、その場所を攻撃する。
//   pool を書くと、攻撃した場所に床が残る
PATTERNS.chase = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.left = act.def.count;
    act.next = 0;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) act.phase = 'active';
    } else if (act.phase === 'active') {
      act.next -= dt;
      if (act.next <= 0 && act.left > 0) {
        act.next = def.interval;
        act.left--;
        // プレイヤーから少し離れた場所に現れて、追いかけてくる
        const a = world.rng() * Math.PI * 2;
        const spot = { x: p.x + Math.cos(a) * def.spawn, y: p.y + Math.sin(a) * def.spawn, r: 0 };
        clampToBounds(spot, world.bounds);
        world.hazards.push({
          type: 'seeker', x: spot.x, y: spot.y, r: def.radius, speed: def.speed, follow: def.follow, lock: def.lock, lockMax: def.lock,
          damage: def.damage, pool: def.pool, color: b.color, owner: b,
        });
        sfx(world, 'enemyShot');
      }
      if (act.left <= 0 && !world.hazards.some((h) => h.type === 'seeker' && h.owner === b)) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// ---- ここから、ボスごとの固有の攻撃（2026-10-07 追加） ----

// 刃の渦（スクラップハウンド）：体のまわりを count 枚の刃が回る。その間も、ボスは chase の速さでプレイヤーを追う。
//   刃に当たると、ダメージと持続ダメージ（dot）
PATTERNS.orbit = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.angle = 0;
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.duration;
        sfx(world, 'bossCharge');
      }
    } else if (act.phase === 'active') {
      act.angle += def.spin * DEG * dt;
      // 回しながら追いかけてくる
      if (d.dist > b.r + p.r) {
        b.x += (d.dx / d.dist) * b.def.speed * def.chase * dt;
        b.y += (d.dy / d.dist) * b.def.speed * def.chase * dt;
      }
      for (const blade of orbitBlades(b, act)) {
        if (circlesOverlap(blade.x, blade.y, def.bladeRadius, p.x, p.y, p.r) && hurtPlayer(world, def.damage)) {
          if (def.dot) afflictPlayer(world, def.dot);
          break;
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
};

// 張り糸（ガーダースパイダー）：部屋を横切る糸を count 本張る。しばらく残り、触れている間は減速して、tick 秒ごとにダメージ。
//   1本目はプレイヤーのいる場所を通る。残りは、その近くを別の向きで通る
PATTERNS.wires = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        const base = world.rng() * Math.PI;
        for (let i = 0; i < def.count; i++) {
          const angle = base + (i * Math.PI) / def.count + (world.rng() - 0.5) * 0.3;
          const off = i === 0 ? 0 : (world.rng() - 0.5) * 2 * def.spread;
          world.hazards.push({
            type: 'wire', x: p.x - Math.sin(angle) * off, y: p.y + Math.cos(angle) * off, angle, width: def.width,
            arm: def.arm, armMax: def.arm, life: def.life, tick: def.tick, acc: def.tick, damage: def.damage, color: b.color,
          });
        }
        sfx(world, 'enemyShot');
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 溶接ビーム（クレーンタイタン）：ビームが、プレイヤーをゆっくり追って回る（turn 度/秒）。当たるとダメージと持続ダメージ。
//   通ったあとに、燃える床（trail）が残る
PATTERNS.weld = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.angle = Math.atan2(d.dy, d.dx);
    act.dirX = Math.cos(act.angle);
    act.dirY = Math.sin(act.angle);
    act.trailT = 0;
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    // プレイヤーのいる向きへ、決まった速さで回る（予告の間は、少し速く向き直る）
    const want = Math.atan2(d.dy, d.dx);
    let diff = want - act.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = def.turn * DEG * dt * (act.phase === 'telegraph' ? 2 : 1);
    if (act.phase !== 'recover') act.angle += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
    act.dirX = Math.cos(act.angle);
    act.dirY = Math.sin(act.angle);
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.duration;
        sfx(world, 'laser');
      }
    } else if (act.phase === 'active') {
      const x2 = b.x + act.dirX * def.range;
      const y2 = b.y + act.dirY * def.range;
      if (distToSegment(p.x, p.y, b.x, b.y, x2, y2) <= p.r + def.width / 2 && hurtPlayer(world, def.damage) && def.dot) afflictPlayer(world, def.dot);
      // ビームの先（プレイヤーと同じ距離のあたり）に、燃える床を残していく
      if (def.trail) {
        act.trailT -= dt;
        if (act.trailT <= 0) {
          act.trailT = def.trail.every;
          const reach = Math.min(def.range, Math.max(b.r + 40, d.dist));
          const spot = { x: b.x + act.dirX * reach, y: b.y + act.dirY * reach, r: 0 };
          clampToBounds(spot, world.bounds);
          world.hazards.push({
            type: 'pool', x: spot.x, y: spot.y, r: def.trail.radius, arm: def.trail.arm, armMax: def.trail.arm, life: def.trail.life,
            tick: def.trail.tick, acc: def.trail.tick, damage: def.trail.damage, slow: false, dot: def.dot, color: b.color,
          });
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
};

// 方眼（アーキテクト）：部屋を cols × rows のマスに分け、市松模様の半分が光って攻撃する。続けて、残りの半分が光る（waves 回）
PATTERNS.cells = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.total = act.def.telegraph;
    act.wave = 0;
    act.parity = world.rng() < 0.5 ? 0 : 1;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        const bounds = world.bounds;
        const col = Math.max(0, Math.min(def.cols - 1, Math.floor(((p.x - bounds.left) / (bounds.right - bounds.left)) * def.cols)));
        const row = Math.max(0, Math.min(def.rows - 1, Math.floor(((p.y - bounds.top) / (bounds.bottom - bounds.top)) * def.rows)));
        if (cellHot(act, col, row)) hurtPlayer(world, def.damage);
        sfx(world, 'zap');
        addShake(world, FEEL.shake.heavy);
        act.phase = 'active';
        act.t = def.active;
      }
    } else if (act.phase === 'active') {
      if (act.t <= 0) {
        act.wave++;
        if (act.wave < def.waves) {
          act.phase = 'telegraph';
          act.t = act.total = def.second;
        } else {
          act.phase = 'recover';
          act.t = def.recover;
        }
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// インク流し（アーキテクト）：プレイヤーの足元から、広がっていく床を置く（count 個。2個目からはボスの足元）。
//   中にいると、tick 秒ごとにダメージと持続ダメージ
PATTERNS.ink = {
  start(world, b, act) {
    const p = world.player;
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.spots = Array.from({ length: act.def.count }, (_, i) => (i === 0 ? { x: p.x, y: p.y } : { x: b.x, y: b.y }));
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        for (const spot of act.spots) {
          world.hazards.push({
            type: 'pool', x: spot.x, y: spot.y, r: def.start, grow: def.grow, rMax: def.maxRadius, arm: def.arm, armMax: def.arm, life: def.life,
            tick: def.tick, acc: def.tick, damage: def.damage, slow: false, dot: def.dot, color: b.color,
          });
        }
        sfx(world, 'enemyShot');
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 消灯（ランプイーター）：点いている非常灯をすべて消し、1本（breakAll なら全部）を食べて壊す。
//   そのあと暗闇にまぎれて位置を変え（その間は触れても当たらない）、予告つきの突進を lunges 回くり返す。blind なら、プレイヤーを目くらみにする
PATTERNS.douse = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.remaining = act.def.lunges;
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    const shift = () => {
      // プレイヤーから少し離れた場所へ、暗闇の中を移る
      const a = world.rng() * Math.PI * 2;
      const spot = { x: p.x + Math.cos(a) * def.reposition.distance, y: p.y + Math.sin(a) * def.reposition.distance, r: b.r };
      clampToBounds(spot, world.bounds);
      act.sx = b.x;
      act.sy = b.y;
      act.tx = spot.x;
      act.ty = spot.y;
      act.phase = 'air';
      act.t = def.reposition.time;
    };
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        const lamps = world.lamps ?? [];
        const lit = lamps.filter((l) => l.on > 0);
        for (const lamp of lamps) lamp.on = 0;
        // 食べるのは、いちばん近い1本（なければ、壊れていないもの）
        const eat = def.breakAll ? lamps : [...(lit.length > 0 ? lit : lamps.filter((l) => l.broken <= 0))].sort((l1, l2) => Math.hypot(l1.x - b.x, l1.y - b.y) - Math.hypot(l2.x - b.x, l2.y - b.y)).slice(0, 1);
        for (const lamp of eat) breakLamp(world, lamp, def.breakTime);
        if (def.blind) blindPlayer(world);
        sfx(world, 'bossCharge');
        shift();
      }
    } else if (act.phase === 'air') {
      const k = 1 - Math.max(0, act.t) / def.reposition.time;
      b.x = act.sx + (act.tx - act.sx) * k;
      b.y = act.sy + (act.ty - act.sy) * k;
      if (act.t <= 0) {
        act.phase = 'aim';
        act.t = def.lungeTelegraph;
        aimAt(act, { dx: p.x - b.x, dy: p.y - b.y, dist: Math.hypot(p.x - b.x, p.y - b.y) || 1 });
      }
    } else if (act.phase === 'aim') {
      if (act.t > def.lockTime) aimAt(act, d);
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.duration;
        sfx(world, 'bossCharge');
      }
    } else if (act.phase === 'active') {
      b.x += act.dirX * def.speed * dt;
      b.y += act.dirY * def.speed * dt;
      if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
      if (clampToBounds(b, world.bounds)) {
        act.phase = 'stun';
        act.t = def.wallStun;
        sfx(world, 'explode');
        addShake(world, FEEL.shake.charged);
        floatText(world, b.x, b.y - b.r - 12, 'Stun!', COLORS.amber, 20);
      } else if (act.t <= 0) {
        act.remaining--;
        if (act.remaining > 0) shift();
        else {
          act.phase = 'recover';
          act.t = def.recover;
        }
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 鱗粉（ランプイーター）：プレイヤーのまわりに、鱗粉の雲を count 個まく。しばらく残り、中にいると目くらみになる
PATTERNS.scales = {
  start(world, b, act) {
    const def = act.def;
    const p = world.player;
    act.phase = 'telegraph';
    act.t = def.telegraph;
    act.spots = Array.from({ length: def.count }, (_, i) => {
      const a = world.rng() * Math.PI * 2;
      const r = i === 0 ? 0 : def.radius * 0.8 + world.rng() * def.spread;
      const spot = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 0 };
      clampToBounds(spot, world.bounds);
      return spot;
    });
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        for (const spot of act.spots) {
          world.hazards.push({
            type: 'pool', x: spot.x, y: spot.y, r: def.radius, arm: def.arm, armMax: def.arm, life: def.life,
            tick: 1, acc: 0, damage: 0, slow: false, blind: true, color: b.color,
          });
        }
        sfx(world, 'enemyShot');
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// ---- 隠しボス「カタリスト」：こちらの属性を写し取って、同じ属性で攻めてくる ----

// プレイヤーが持っている属性を写し取る（奪われている間は、奪われる前のもの）。all なら、4つすべて
function transcribe(world, b, all = false) {
  const stats = world.player.stats;
  b.copied = all ? Object.keys(ELEMENT_COLORS_BY_ID) : [...(stats.sealed ?? stats.elements)];
  return b.copied;
}

// 写し取った属性の、効き目。属性を1つも写し取れなかったときは、かわりにダメージが増える
function copiedEffects(b, def) {
  const els = b.copied ?? [];
  return {
    slow: els.includes('cold'),
    dots: [els.includes('heat') ? 'burn' : null, els.includes('corrode') ? 'corrode' : null].filter(Boolean),
    fast: els.includes('shock'),
    power: els.length === 0 ? def.plainBonus ?? 1 : 1,
    color: els.length > 0 ? ELEMENT_COLORS_BY_ID[els[0]] : b.color,
  };
}

// 反応（カタリスト）：プレイヤーへ弾を撃つ。弾には、写し取った属性の効き目が乗る。all: true なら（大技）、4つすべてが乗る
PATTERNS.reflect = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.remaining = act.def.waves;
    act.base = Math.atan2(d.dy, d.dx);
    transcribe(world, b, !!act.def.all);
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph' || act.phase === 'active') {
      if (act.t > 0) return false;
      const fx = copiedEffects(b, def);
      const full = def.spread >= 360;
      if (def.track && !full) act.base = Math.atan2(d.dy, d.dx);
      for (let i = 0; i < def.count; i++) {
        const offset = full ? (i * 360) / def.count : def.count > 1 ? (i / (def.count - 1) - 0.5) * def.spread : 0;
        const a = act.base + offset * DEG;
        const speed = def.shotSpeed * (fx.fast ? def.shockSpeed : 1);
        world.shots.push({
          x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          r: def.shotRadius, damage: def.damage * fx.power, life: 4, slow: fx.slow, dots: fx.dots, color: ELEMENT_COLORS_BY_ID[(b.copied ?? [])[i % Math.max(1, (b.copied ?? []).length)]] ?? b.color,
        });
      }
      act.base += (def.rotate ?? 0) * DEG;
      sfx(world, 'enemyShot');
      act.remaining--;
      act.phase = act.remaining > 0 ? 'active' : 'recover';
      act.t = act.remaining > 0 ? def.interval : def.recover;
      return false;
    }
    return act.t <= 0;
  },
};

// 奪取（カタリスト）：予告の円（ボスのまわり）のあと、円の中にいると、ダメージに加えて、seal 秒のあいだ属性を奪われる
PATTERNS.seize = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        ring(world, b.x, b.y, def.radius, b.color);
        sfx(world, 'zap');
        addShake(world, FEEL.shake.hit);
        if (Math.hypot(p.x - b.x, p.y - b.y) <= def.radius + p.r && hurtPlayer(world, def.damage) && world.mode === 'play' && !p.guard) {
          const had = p.stats.sealed ?? p.stats.elements;
          if (had.length > 0) {
            p.sealT = def.seal;
            recalcStats(p);
            floatText(world, p.x, p.y - 42, 'Sealed!', COLORS.dim, 16);
          }
        }
        transcribe(world, b);
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 軌跡（カタリスト）：予告線つきの突進。通ったあとに、写し取った属性の床が残る。壁に当たると隙
PATTERNS.streak = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    aimAt(act, d);
    transcribe(world, b);
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t > def.lockTime) aimAt(act, d);
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.duration;
        act.last = { x: b.x, y: b.y };
        act.step = 0;
        sfx(world, 'bossCharge');
      }
    } else if (act.phase === 'active') {
      const fx = copiedEffects(b, def);
      b.x += act.dirX * def.speed * dt;
      b.y += act.dirY * def.speed * dt;
      if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage * fx.power);
      // 通ったあとに、床を残す（写し取った属性を、順番に）
      const els = b.copied ?? [];
      if (els.length > 0 && Math.hypot(b.x - act.last.x, b.y - act.last.y) >= def.trail.gap) {
        const el = els[act.step++ % els.length];
        act.last = { x: b.x, y: b.y };
        if (el === 'shock') {
          world.hazards.push({ type: 'mark', x: b.x, y: b.y, r: def.trail.radius, t: def.trail.strikeDelay, max: def.trail.strikeDelay, damage: def.trail.strike, enemyDamage: 0, color: ELEMENT_COLORS_BY_ID.shock });
        } else {
          world.hazards.push({
            type: 'pool', x: b.x, y: b.y, r: def.trail.radius, arm: def.trail.arm, armMax: def.trail.arm, life: def.trail.life,
            tick: 0.5, acc: 0.5, damage: el === 'cold' ? 0 : def.trail.damage, slow: el === 'cold', dot: el === 'heat' ? 'burn' : el === 'corrode' ? 'corrode' : undefined, color: ELEMENT_COLORS_BY_ID[el],
          });
        }
      }
      if (clampToBounds(b, world.bounds)) {
        act.phase = 'stun';
        act.t = def.wallStun;
        sfx(world, 'explode');
        addShake(world, FEEL.shake.charged);
        floatText(world, b.x, b.y - b.r - 12, 'Stun!', COLORS.amber, 20);
      } else if (act.t <= 0) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 雨雲を1つ呼ぶ（レインメーカー）。プレイヤーを追い、真下に雨を降らせ、決まった間隔で、雲の真下に落雷する
function spawnCloud(world, b, def, index = 0) {
  const a = world.rng() * Math.PI * 2;
  world.hazards.push({
    type: 'cloud', owner: b, x: b.x + Math.cos(a) * (b.r + 40 + index * 30), y: b.y + Math.sin(a) * (b.r + 40 + index * 30), r: def.radius, speed: def.speed, life: def.life, max: def.life,
    acc: 0, strikeT: def.strike.every * (0.6 + 0.4 * index), strike: def.strike, color: b.color,
  });
}

// 瓦落とし（レインメーカー）：予告のあと、屋根を count 個崩す（breakTime 秒。プレイヤーに近い屋根から）。崩れた瞬間に下にいると、がれきでダメージ。
//   all: true なら、全部崩す（大技）。rain を書くと雨が降り、clouds を書くと雨雲も呼ぶ
PATTERNS.unroof = {
  start(world, b, act) {
    const def = act.def;
    const p = world.player;
    act.phase = 'telegraph';
    act.t = def.telegraph;
    const intact = (world.roofs ?? []).filter((r) => !(r.broken > 0)).sort((r1, r2) => Math.hypot(r1.x - p.x, r1.y - p.y) - Math.hypot(r2.x - p.x, r2.y - p.y));
    act.targets = def.all ? intact : intact.slice(0, def.count);
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        for (const roof of act.targets) {
          if (Math.abs(p.x - roof.x) <= roof.w / 2 + p.r && Math.abs(p.y - roof.y) <= roof.h / 2 + p.r) hurtPlayer(world, def.damage);
          breakRoof(world, roof, def.breakTime);
        }
        if (act.targets.length > 0) addShake(world, FEEL.shake.charged);
        if (def.rain) startRain(world, def.rain);
        if (def.clouds) for (let i = 0; i < def.clouds.count; i++) spawnCloud(world, b, def.clouds, i);
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 雨雲（レインメーカー）：雨雲を count 個呼ぶ
PATTERNS.stormcloud = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        for (const h of world.hazards) if (h.type === 'cloud' && h.owner === b) h.dead = true;
        for (let i = 0; i < act.def.count; i++) spawnCloud(world, b, act.def, i);
        sfx(world, 'bossCharge');
        act.phase = 'recover';
        act.t = act.def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 放出（バッファータンク）：今の色に合わせた攻撃を出す。中身は、属性ごとに、ほかの部品の数値で書く（byElement）。
//   「飽和」のあとは、今の色ではなく、決められた順番の色（b.emitQueue）で出す
PATTERNS.emit = {
  start(world, b, act, d) {
    const element = b.emitQueue?.shift() ?? b.attune ?? Object.keys(act.def.byElement)[0];
    // ここから先は、その属性の部品として動く（予告の絵も、その部品のものになる）
    act.element = element;
    act.color = ELEMENT_COLORS_BY_ID[element];
    act.def = act.def.byElement[element];
    PATTERNS[act.def.pattern].start(world, b, act, d);
  },
  update() {
    return true;
  },
};

// 飽和（バッファータンク）：色の印が sequence 個並び、その順番で「放出」（move）を続けて出す。
//   frenzy を書くと（大技）、そのあと frenzy 秒のあいだ、色の切り替わりが速くなる
PATTERNS.saturate = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    const pool = Object.keys(b.def.attacks[act.def.move].byElement);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(world.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    act.sequence = pool.slice(0, act.def.sequence);
  },
  update(world, b, dt, act) {
    act.t -= dt;
    if (act.t > 0) return false;
    b.emitQueue = [...act.sequence];
    b.queue = [...act.sequence.map(() => act.def.move), ...b.queue];
    if (act.def.frenzy) b.frenzyT = act.def.frenzy;
    sfx(world, 'bossCharge');
    return true;
  },
};

// 溶解（ラストイーター）：予告のあと、床が溶けて、酸の穴になる。穴は、ボスを倒すまで消えない（中にいると、tick 秒ごとにダメージ）。
//   count 個ずつ増える（1つ目はプレイヤーの足元、残りはその近く）。全部で max 個まで。
//   ring を書くと（大技）、部屋の外まわりにぐるりと並べる（真ん中だけが残る）。rain を書くと、同時に雨が降る
function meltSpots(world, def) {
  const p = world.player;
  const wb = world.bounds;
  if (def.ring) {
    const cx = (wb.left + wb.right) / 2;
    const cy = (wb.top + wb.bottom) / 2;
    return Array.from({ length: def.ring.count }, (_, i) => {
      const a = (i / def.ring.count) * Math.PI * 2;
      return { x: cx + Math.cos(a) * def.ring.rx, y: cy + Math.sin(a) * def.ring.ry };
    });
  }
  return Array.from({ length: def.count }, (_, i) => {
    const a = world.rng() * Math.PI * 2;
    const r = i === 0 ? 0 : def.radius * 1.2 + world.rng() * def.spread;
    const spot = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 0 };
    clampToBounds(spot, wb);
    return spot;
  });
}

PATTERNS.melt = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    // 上限を超えるぶんは、出さない
    const have = world.hazards.filter((h) => h.pit).length;
    act.spots = meltSpots(world, act.def).slice(0, Math.max(0, act.def.max - have));
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        for (const spot of act.spots) {
          world.hazards.push({
            type: 'pool', pit: true, x: spot.x, y: spot.y, r: def.radius, arm: def.arm, armMax: def.arm, life: Infinity,
            tick: def.tick, acc: def.tick, damage: def.damage, slow: false, color: COLORS.green,
          });
        }
        if (def.rain) startRain(world, def.rain);
        sfx(world, 'steam');
        addShake(world, FEEL.shake.hit);
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 噛みつき（ラストイーター）：予告線つきの突進。当たると、ダメージに加えて「錆」（しばらく、与えるダメージが下がる）。壁に当たると隙
PATTERNS.gnaw = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    aimAt(act, d);
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t > def.lockTime) aimAt(act, d);
      if (act.t <= 0) {
        act.phase = 'active';
        act.t = def.duration;
        act.bit = false;
        sfx(world, 'bossCharge');
      }
    } else if (act.phase === 'active') {
      b.x += act.dirX * def.speed * dt;
      b.y += act.dirY * def.speed * dt;
      if (!act.bit && circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r) && hurtPlayer(world, def.damage) && world.mode === 'play' && !p.guard) {
        // 錆：しばらく、与えるダメージが下がる（付け直すと、時間が戻る）
        act.bit = true;
        p.buffs = p.buffs.filter((x) => x.id !== 'rust');
        p.buffs.push({ id: 'rust', stat: 'attackMul', add: -def.rust.amount, t: def.rust.duration, max: def.rust.duration, color: ELEMENT_COLORS_RUST });
        floatText(world, p.x, p.y - 42, 'Rust!', ELEMENT_COLORS_RUST, 16);
      }
      if (clampToBounds(b, world.bounds)) {
        act.phase = 'stun';
        act.t = def.wallStun;
        sfx(world, 'explode');
        addShake(world, FEEL.shake.charged);
        floatText(world, b.x, b.y - b.r - 12, 'Stun!', COLORS.amber, 20);
      } else if (act.t <= 0) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 影（ノクターン）の攻撃を始める。どちらも、出したあとに残り続けて、ボスはほかの攻撃をする。
//   trail  : 影踏み。プレイヤーが lag 秒前にいた場所が、次々に攻撃される（interval 秒ごと、life 秒のあいだ）
//   echoes : 写し身。プレイヤーの動きを、それぞれの秒数だけ遅れて真似る影（触れるとダメージ。life 秒のあいだ）
//   blackout : その間、遮断の暗闇になる（大技）
function castShadow(world, b, def) {
  const p = world.player;
  if (def.blackout) startBlackout(world, def.blackout.duration, def.blackout.vision);
  if (def.trail) {
    for (const h of world.hazards) if (h.type === 'trail' && h.owner === b) h.dead = true;
    world.hazards.push({ type: 'trail', owner: b, clock: 0, life: def.trail.life, lag: def.trail.lag, interval: def.trail.interval, next: 0, delay: def.trail.delay, radius: def.trail.radius, damage: def.trail.damage, path: [{ x: p.x, y: p.y, t: 0 }], color: b.color });
  }
  if (def.echoes) {
    for (const h of world.hazards) if (h.type === 'echo' && h.owner === b) h.dead = true;
    for (const delay of def.echoes.delays) {
      world.hazards.push({ type: 'echo', owner: b, clock: 0, life: def.echoes.life + delay, delay, r: def.echoes.radius, damage: def.echoes.damage, x: p.x, y: p.y, armed: false, path: [{ x: p.x, y: p.y, t: 0 }], color: b.color });
    }
  }
  sfx(world, 'bossCharge');
}

const SHADOW_PATTERN = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        castShadow(world, b, act.def);
        act.phase = 'recover';
        act.t = act.def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 影踏み（ノクターン）：自分が少し前にいた場所が、次々に攻撃される
PATTERNS.shadowstep = SHADOW_PATTERN;
// 写し身（ノクターン）：自分の動きを、遅れて真似る影が出る
PATTERNS.mirror = SHADOW_PATTERN;

// 遮断（ブレーカー）：部屋の灯りがすべて落ち、見える円も狭くなる（duration 秒）。その間、プレイヤーの足元に落雷の予告が次々に出る（strikes）。
//   終わると「復電」で部屋全体が明るくなり（surge 秒）、ボスは過負荷で overload 秒動けない
PATTERNS.blackout = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
  },
  update(world, b, dt, act) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        startBlackout(world, def.duration, def.vision);
        sfx(world, 'bossCharge');
        floatText(world, b.x, b.y - b.r - 14, 'Blackout', COLORS.red, 20);
        act.phase = 'active';
        act.t = def.duration;
        act.strikeT = def.strikes.first;
      }
    } else if (act.phase === 'active') {
      act.strikeT -= dt;
      if (act.strikeT <= 0) {
        act.strikeT = def.strikes.interval;
        const a = world.rng() * Math.PI * 2;
        const r = world.rng() * def.strikes.spread;
        const spot = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: def.strikes.radius };
        clampToBounds(spot, world.bounds);
        world.hazards.push({ type: 'mark', x: spot.x, y: spot.y, r: def.strikes.radius, t: def.strikes.delay, max: def.strikes.delay, damage: def.strikes.damage, enemyDamage: 0, color: b.color });
      }
      if (act.t <= 0) {
        powerOn(world, def.surge);
        floatText(world, b.x, b.y - b.r - 14, 'Overload', COLORS.amber, 20);
        burst(world, b.x, b.y, COLORS.amber, 26, 260);
        sfx(world, 'explode');
        act.phase = 'stun';
        act.t = def.overload;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 残像（ブレーカー）：偽物を count 体出して、プレイヤーを囲み、本物と一緒に突進する。rounds 回くり返す。
//   偽物は1発当てると消える。本物に当てると、偽物は全部消える。blackout を書くと（大技）、その間、遮断の暗闇になる
PATTERNS.afterimage = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.remaining = act.def.rounds ?? 1;
    act.decoys = [];
  },
  update(world, b, dt, act, d) {
    const def = act.def;
    const p = world.player;
    act.t -= dt;
    const clear = () => {
      for (const e of act.decoys) {
        if (e.dead) continue;
        e.dead = true;
        burst(world, e.x, e.y, b.color, 8, 160);
      }
      act.decoys = [];
    };
    // 本物と偽物を、プレイヤーのまわりに等間隔に並べる。どれが本物かは、毎回変わる
    const arrange = () => {
      clear();
      const n = def.count + 1;
      const base = world.rng() * Math.PI * 2;
      const real = Math.floor(world.rng() * n) % n;
      // 囲む円の中心。プレイヤーが壁ぎわにいるときは、部屋の内側へ寄せる（壁に押しつけられて、同じ場所に固まらないように）
      const inset = def.distance * 0.6;
      const wb = world.bounds;
      const cx = Math.max(wb.left + inset, Math.min(wb.right - inset, p.x));
      const cy = Math.max(wb.top + inset, Math.min(wb.bottom - inset, p.y));
      for (let i = 0; i < n; i++) {
        const a = base + (i * Math.PI * 2) / n;
        const spot = { x: cx + Math.cos(a) * def.distance, y: cy + Math.sin(a) * def.distance, r: b.r };
        clampToBounds(spot, world.bounds);
        if (i === real) {
          b.x = spot.x;
          b.y = spot.y;
        } else {
          const e = createEnemy(DATA.enemies.get(def.decoy), spot.x, spot.y, 0, world.rng);
          e.noStagger = true;
          world.enemies.push(e);
          act.decoys.push(e);
        }
        burst(world, spot.x, spot.y, b.color, 8, 160);
      }
      sfx(world, 'bossCharge');
      act.hp = b.hp;
      act.phase = 'aim';
      act.t = def.aim;
    };
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        if (def.blackout) startBlackout(world, def.blackout.duration, def.blackout.vision);
        arrange();
      }
    } else if (act.phase === 'aim' || act.phase === 'active') {
      // 本物に当てられたら、偽物は全部消える
      if (b.hp < act.hp) clear();
      act.decoys = act.decoys.filter((e) => !e.dead);
      if (act.phase === 'aim') {
        if (act.t > def.lockTime) {
          aimAt(act, d);
          for (const e of act.decoys) e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        }
        if (act.t <= 0) {
          act.phase = 'active';
          act.t = def.duration;
          sfx(world, 'bossCharge');
        }
      } else {
        b.x += act.dirX * def.speed * dt;
        b.y += act.dirY * def.speed * dt;
        clampToBounds(b, world.bounds);
        if (circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, def.damage);
        for (const e of act.decoys) {
          e.x += Math.cos(e.angle) * def.speed * dt;
          e.y += Math.sin(e.angle) * def.speed * dt;
          clampToBounds(e, world.bounds);
          if (circlesOverlap(e.x, e.y, e.r, p.x, p.y, p.r)) hurtPlayer(world, def.decoyDamage);
        }
        if (act.t <= 0) {
          act.remaining--;
          if (act.remaining > 0) {
            arrange();
          } else {
            clear();
            if (def.blackout) powerOn(world, def.surge);
            act.phase = 'recover';
            act.t = def.recover;
          }
        }
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 照射（サーチライト・センチネル）：光の扇が、ボスを中心に回る（count 本、life 秒）。出したあとも、ボスはほかの攻撃をする。
//   扇の中にプレイヤーが合計 need 秒いると「捕捉」され、予告つきの狙撃（snipe）が来る。点いている非常灯のそばにいても、捕捉が進む。
//   touch を書くと（大技）、捕捉のかわりに、扇に触れるとそのダメージ。hold: true なら、扇が消えるまで、ボスはその場で待つ
PATTERNS.searchlight = {
  start(world, b, act, d) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    // 出たときに、プレイヤーが扇の中にいないように向きを決める（1本なら反対側、何本かあるなら隙間がプレイヤーに向く）
    act.base = Math.atan2(d.dy, d.dx) + Math.PI / act.def.count;
    act.spin = act.def.spin * (world.rng() < 0.5 ? 1 : -1);
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        for (const h of world.hazards) if (h.type === 'searchlight' && h.owner === b) h.dead = true;
        world.hazards.push({
          type: 'searchlight', owner: b, x: b.x, y: b.y, count: def.count, angle: act.base, spin: act.spin, arc: def.arc * DEG, range: def.range,
          life: def.life, max: def.life, lock: 0, need: def.need ?? 0, decay: def.decay ?? 0, cool: 0, touch: def.touch ?? 0, snipe: def.snipe ?? null, color: b.color,
        });
        sfx(world, 'bossCharge');
        act.phase = def.hold ? 'active' : 'recover';
        act.t = def.hold ? def.life : def.recover;
      }
    } else if (act.phase === 'active') {
      if (act.t <= 0) {
        act.phase = 'recover';
        act.t = def.recover;
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 閃光（サーチライト・センチネル）：溜めのあと、部屋全体が光る。その瞬間にボスのほうを向いていると、目くらみ。count 回くり返す（間は gap 秒）
PATTERNS.flare = {
  start(world, b, act) {
    act.phase = 'telegraph';
    act.t = act.def.telegraph;
    act.remaining = act.def.count ?? 1;
  },
  update(world, b, dt, act) {
    const def = act.def;
    act.t -= dt;
    if (act.phase === 'telegraph') {
      if (act.t <= 0) {
        flashAt(world, b.x, b.y, { radius: 0, facing: def.facing, blind: def.blind, light: def.light, lightLife: def.lightLife });
        addShake(world, FEEL.shake.hit);
        act.remaining--;
        if (act.remaining > 0) {
          act.t = def.gap;
          act.gapMax = def.gap;
        } else {
          act.phase = 'recover';
          act.t = def.recover;
        }
      }
    } else if (act.t <= 0) {
      return true;
    }
    return false;
  },
};

// 広がる輪などの、ボスから離れて残る攻撃
export function updateHazards(world, dt) {
  const p = world.player;
  for (const h of world.hazards) {
    if (h.type === 'cloud') {
      // 雨雲：プレイヤーを追い、真下に雨を降らせる（屋根の下なら当たらない）。決まった間隔で、雲の真下に落雷（屋根でも防げない）
      if (h.dead || !h.owner || h.owner.dead) {
        h.dead = true;
        continue;
      }
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        h.x += (dx / dist) * h.speed * dt;
        h.y += (dy / dist) * h.speed * dt;
      }
      h.life -= dt;
      h.acc += dt;
      if (h.acc >= 0.6) {
        h.acc -= 0.6;
        if (dist <= h.r + p.r && !underRoof(world, p.x, p.y)) rainHit(world);
      }
      h.strikeT -= dt;
      if (h.strikeT <= 0) {
        h.strikeT = h.strike.every;
        world.hazards.push({ type: 'mark', x: h.x, y: h.y, r: h.strike.radius, t: h.strike.delay, max: h.strike.delay, damage: h.strike.damage, enemyDamage: 0, color: '#fff36b' });
      }
      if (h.life <= 0) h.dead = true;
    } else if (h.type === 'trail' || h.type === 'echo') {
      // 影：プレイヤーの通った道を覚えておく（path は、古い順）
      if (!h.owner || h.owner.dead) {
        h.dead = true;
        continue;
      }
      h.clock += dt;
      h.life -= dt;
      h.path.push({ x: p.x, y: p.y, t: h.clock });
      if (h.type === 'trail') {
        // 影踏み：lag 秒前にいた場所に、予告つきの攻撃を置く（予告の時間ぶんだけ、早めに置く）
        const back = h.lag - h.delay;
        while (h.path.length > 1 && h.clock - h.path[1].t >= back) h.path.shift();
        if (h.clock >= h.next && h.clock >= back) {
          h.next = h.clock + h.interval;
          const spot = h.path[0];
          world.hazards.push({ type: 'mark', x: spot.x, y: spot.y, r: h.radius, t: h.delay, max: h.delay, damage: h.damage, enemyDamage: 0, color: h.color });
        }
      } else {
        // 写し身：delay 秒前のプレイヤーの場所にいる。動き始めてから、触れるとダメージ
        while (h.path.length > 1 && h.clock - h.path[1].t >= h.delay) h.path.shift();
        h.x = h.path[0].x;
        h.y = h.path[0].y;
        h.armed = h.clock >= h.delay;
        if (h.armed && circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
      }
      if (h.life <= 0) h.dead = true;
    } else if (h.type === 'searchlight') {
      // 光の扇：ボスについて回る。扇の中にいる時間がたまると、狙撃が来る
      const b = h.owner;
      if (!b || b.dead || h.dead) {
        h.dead = true;
        continue;
      }
      h.x = b.x;
      h.y = b.y;
      h.angle += h.spin * dt;
      h.life -= dt;
      h.cool -= dt;
      const toPlayer = Math.atan2(p.y - h.y, p.x - h.x);
      const inBeam = Math.hypot(p.x - h.x, p.y - h.y) <= h.range + p.r && beamAngles(h).some((a) => Math.abs(angleDiff(toPlayer, a)) <= h.arc / 2);
      if (h.touch > 0) {
        if (inBeam) hurtPlayer(world, h.touch);
      } else if (h.cool <= 0 && world.mode === 'play') {
        h.inBeam = inBeam;
        h.inLamp = !inBeam && nearLitLamp(world, p.x, p.y);
        h.lock = h.inBeam || h.inLamp ? h.lock + dt : Math.max(0, h.lock - h.decay * dt);
        if (h.lock >= h.need) {
          h.lock = 0;
          h.cool = h.snipe.aim + h.snipe.interval;
          floatText(world, p.x, p.y - 42, 'Locked On!', COLORS.red, 16);
          sfx(world, 'select');
          world.hazards.push({ type: 'snipe', owner: b, x: b.x, y: b.y, t: h.snipe.aim, max: h.snipe.aim, lockTime: h.snipe.lock, angle: toPlayer, width: h.snipe.width, range: h.snipe.range, damage: h.snipe.damage, color: b.color });
        }
      }
      if (h.life <= 0) h.dead = true;
    } else if (h.type === 'snipe') {
      // 捕捉されたあとの狙撃：照準線がプレイヤーを追い、最後の少しの間だけ向きが固定されてから撃つ
      const b = h.owner;
      if (!b || b.dead) {
        h.dead = true;
        continue;
      }
      h.x = b.x;
      h.y = b.y;
      h.t -= dt;
      if (h.t > h.lockTime) h.angle = Math.atan2(p.y - h.y, p.x - h.x);
      if (h.t <= 0) {
        const x2 = h.x + Math.cos(h.angle) * h.range;
        const y2 = h.y + Math.sin(h.angle) * h.range;
        if (distToSegment(p.x, p.y, h.x, h.y, x2, y2) <= p.r + h.width / 2) hurtPlayer(world, h.damage);
        sfx(world, 'snipe');
        world.fx.beams.push({ x1: h.x, y1: h.y, x2, y2, life: 0.2, max: 0.2, color: h.color, width: h.width });
        addShake(world, FEEL.shake.hit);
        h.dead = true;
      }
    } else if (h.type === 'ring') {
      h.r += h.speed * dt;
      const dist = Math.hypot(p.x - h.x, p.y - h.y);
      // 輪の線に触れたら当たる。ダッシュの無敵ですり抜けられる
      if (!h.done && Math.abs(dist - h.r) < h.width / 2 + p.r) {
        if (hurtPlayer(world, h.damage)) h.done = true;
      }
      if (h.r > h.max) h.dead = true;
    } else if (h.type === 'mark') {
      // 落下地点の予告。時間が来たら、その円の中にいると当たる
      h.t -= dt;
      if (h.t <= 0) {
        if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
        // 部屋の仕掛けの落下物は、敵にも当たる
        if (h.enemyDamage > 0) {
          for (const e of world.enemies) {
            if (!e.dead && e.spawnT <= 0 && !e.hidden && circlesOverlap(h.x, h.y, h.r, e.x, e.y, e.r)) damageEnemy(world, e, h.enemyDamage, { color: h.color });
          }
        }
        burst(world, h.x, h.y, h.color, 12, 220);
        sfx(world, 'hit');
        h.dead = true;
      }
    } else if (h.type === 'seeker') {
      // 追尾の照準：しばらくプレイヤーを追い、止まってから、その場所を攻撃する
      if (h.follow > 0) {
        h.follow -= dt;
        const dx = p.x - h.x;
        const dy = p.y - h.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.min(dist, h.speed * dt);
        if (dist > 0) {
          h.x += (dx / dist) * step;
          h.y += (dy / dist) * step;
        }
      } else {
        h.lock -= dt;
        if (h.lock <= 0) {
          if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
          if (h.pool) {
            world.hazards.push({
              type: 'pool', x: h.x, y: h.y, r: h.pool.radius, arm: h.pool.arm, armMax: h.pool.arm, life: h.pool.life,
              tick: h.pool.tick, acc: h.pool.tick, damage: h.pool.damage, slow: !!h.pool.slow, color: h.color,
            });
          }
          burst(world, h.x, h.y, h.color, 16, 260);
          sfx(world, 'zap');
          addShake(world, FEEL.shake.hit);
          h.dead = true;
        }
      }
    } else if (h.type === 'hook') {
      // 吊ったフック：線の上を行ったり来たりする（端でゆっくり、真ん中で速い）。触れると当たる
      h.t += dt / h.period;
      const k = (1 - Math.cos(h.t * Math.PI)) / 2; // 0 → 1 → 0 …
      h.x = h.x1 + (h.x2 - h.x1) * k;
      h.y = h.y1 + (h.y2 - h.y1) * k;
      if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) hurtPlayer(world, h.damage);
      if (h.t >= h.total) h.dead = true;
    } else if (h.type === 'bar') {
      // 部屋を横切る線。予告の時間が来たら一瞬だけ光り、そのとき線の上にいると当たる
      if (h.flash > 0) {
        h.flash -= dt;
        if (h.flash <= 0) h.dead = true;
      } else {
        h.t -= dt;
        if (h.t <= 0) {
          const dx = Math.cos(h.angle) * ROOM.barLength;
          const dy = Math.sin(h.angle) * ROOM.barLength;
          if (distToSegment(p.x, p.y, h.x - dx, h.y - dy, h.x + dx, h.y + dy) <= p.r + h.width / 2) hurtPlayer(world, h.damage);
          h.flash = BAR_FLASH;
          sfx(world, 'zap');
          addShake(world, FEEL.shake.hit);
        }
      }
    } else if (h.type === 'wire') {
      // 張り糸：張られてから arm 秒後に効き始める。触れている間は減速して、tick 秒ごとに当たる
      if (h.arm > 0) {
        h.arm -= dt;
      } else {
        h.life -= dt;
        h.acc += dt;
        const dx = Math.cos(h.angle) * ROOM.barLength;
        const dy = Math.sin(h.angle) * ROOM.barLength;
        if (distToSegment(p.x, p.y, h.x - dx, h.y - dy, h.x + dx, h.y + dy) <= p.r + h.width / 2) {
          slowPlayer(world);
          if (h.acc >= h.tick) {
            h.acc = 0;
            hurtPlayer(world, h.damage);
          }
        }
        if (h.life <= 0) h.dead = true;
      }
    } else if (h.type === 'pool') {
      // その場に残る床。効き始めてからは、中にいる間 tick 秒ごとに当たる
      if (h.arm > 0) {
        h.arm -= dt;
      } else {
        h.life -= dt;
        h.acc += dt;
        // 広がっていく床（インク）
        if (h.grow && h.r < h.rMax) h.r = Math.min(h.rMax, h.r + h.grow * dt);
        if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) {
          if (h.slow) slowPlayer(world);
          if (h.blind) blindPlayer(world); // 鱗粉の雲
          if (h.damage > 0 && h.acc >= h.tick) {
            h.acc = 0;
            if (hurtPlayer(world, h.damage) && h.dot) afflictPlayer(world, h.dot);
          }
        }
        if (h.life <= 0) h.dead = true;
      }
    }
  }
  world.hazards = world.hazards.filter((h) => !h.dead);
}
