// ボスの攻撃パターンの部品。どれも「予告 → 攻撃 → 硬直」の流れで、終わったら true を返す。
// ボスの定義（src/data/bosses.js）の attacks で、数値を変えて組み合わせる。
//   act: { def, phase, t, ... } 実行中の攻撃の状態
//   d:   { dx, dy, dist } プレイヤーへの向きと距離
import { FEEL, ROOM } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { DATA } from '../data/index.js';
import { DEG, arcHitsCircle, circlesOverlap, clampToBounds, distToSegment } from '../logic/geometry.js';
import { damageEnemy, hurtPlayer, slowPlayer } from './combat.js';
import { createEnemy } from './enemyAI.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';

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
          floatText(world, b.x, b.y - b.r - 12, 'スタン!', COLORS.amber, 20);
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
    floatText(world, b.x, b.y - b.r - 14, '冷却中', COLORS.cyan, 20);
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
            r: def.shotRadius, damage: def.damage, life: def.shotLife ?? 4, slow: !!def.slow, color: b.color,
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
            tick: def.tick, acc: def.tick, damage: def.damage, slow: !!def.slow, color: b.color,
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
        floatText(world, b.x, b.y - b.r - 12, 'ブレイク!', COLORS.amber, 24);
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
          floatText(world, b.x, b.y - b.r - 12, '再生', COLORS.green, 22);
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

// 広がる輪などの、ボスから離れて残る攻撃
export function updateHazards(world, dt) {
  const p = world.player;
  for (const h of world.hazards) {
    if (h.type === 'ring') {
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
    } else if (h.type === 'pool') {
      // その場に残る床。効き始めてからは、中にいる間 tick 秒ごとに当たる
      if (h.arm > 0) {
        h.arm -= dt;
      } else {
        h.life -= dt;
        h.acc += dt;
        if (circlesOverlap(h.x, h.y, h.r, p.x, p.y, p.r)) {
          if (h.slow) slowPlayer(world);
          if (h.damage > 0 && h.acc >= h.tick) {
            h.acc = 0;
            hurtPlayer(world, h.damage);
          }
        }
        if (h.life <= 0) h.dead = true;
      }
    }
  }
  world.hazards = world.hazards.filter((h) => !h.dead);
}
