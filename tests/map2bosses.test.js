import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { hitEnemy } from '../src/game/combat.js';
import { createWorld, updateWorld } from '../src/game/world.js';

// マップ2のボス3体の、固有の攻撃（docs/詳細仕様.md「ボス「パイプサーペント」…」）。共通の部品は使わない

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bossWorld(id, rng = seeded(5)) {
  const world = createWorld({ waves: [{ boss: id }], rng });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  updateWorld(world, DT, idle); // 首（ハイドラ）が生える
  world.boss.idleT = Infinity;
  world.player.inv = Infinity;
  world.player.stats.maxHp = 99999;
  world.player.hp = 99999;
  return world;
}

function startAttack(world, name) {
  const b = world.boss;
  const p = world.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
  PATTERNS[b.act.def.pattern].start(world, b, b.act, { dx, dy, dist: Math.hypot(dx, dy) || 1 });
  return b.act;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 12, input = idle) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, input);
  }
  return false;
}

const hazardsOf = (world, type) => world.hazards.filter((h) => h.type === type);

function damageTaken(world, seconds, before = () => {}) {
  const p = world.player;
  p.inv = 0;
  const hp = p.hp;
  for (let t = 0; t < seconds; t += DT) {
    before();
    updateWorld(world, DT, idle);
  }
  return hp - p.hp;
}

const heads = (world) => world.enemies.filter((e) => e.anchor === world.boss && !e.dead);

describe('マップ2の3体：共通部品を使わない', () => {
  const converted = ['pipeserpent', 'tankcrab', 'sludgehydra'];

  it('3体の攻撃（大技も）の部品は、そのボスだけが使う。ほかのボスとは1つも重ならない', () => {
    const usedBy = {};
    for (const boss of DATA.bosses.all()) {
      for (const attack of Object.values(boss.attacks)) (usedBy[attack.pattern] ??= new Set()).add(boss.id);
    }
    for (const id of converted) {
      for (const attack of Object.values(DATA.bosses.get(id).attacks)) expect([...usedBy[attack.pattern]], `${id} の ${attack.pattern}`).toEqual([id]);
    }
  });

  it('3体とも、前半に固有の攻撃が5つあり、大技も固有。後半には連携がある。反応も固有の攻撃', () => {
    for (const id of converted) {
      const boss = DATA.bosses.get(id);
      expect(new Set(boss.phases[0].moves.map((m) => boss.attacks[m].pattern)).size, id).toBe(5);
      expect(boss.phases.at(-1).combos.length, id).toBeGreaterThanOrEqual(1);
      for (const r of boss.reactions ?? []) expect(boss.attacks[r.move], id).toBeDefined();
      expect(PATTERNS[boss.attacks[boss.ultimate.move].pattern], id).toBeDefined();
    }
    expect(DATA.bosses.get('tankcrab').reactions.map((r) => r.move)).toEqual(['rollshell', 'bubbleswarm']);
  });
});

describe('パイプサーペント', () => {
  it('とぐろ締め：輪が縮む。輪の隙間にいれば当たらない。隙間以外にいると当たる', () => {
    const run1 = (opposite) => {
      const world = bossWorld('pipeserpent');
      const p = world.player;
      const act = startAttack(world, 'coilcrush');
      const [h] = hazardsOf(world, 'coil');
      run(world, act.def.telegraph + 0.05);
      expect(h.phase).toBe('close');
      const a = h.gapAngle + (opposite ? Math.PI : 0);
      const r0 = h.r;
      const dmg = damageTaken(world, 0.3, () => {
        p.x = h.cx + Math.cos(a) * h.r;
        p.y = h.cy + Math.sin(a) * h.r;
      });
      expect(h.r).toBeLessThan(r0); // 縮んでいる
      return dmg;
    };
    expect(run1(true)).toBeGreaterThan(0);
    expect(run1(false)).toBe(0);
  });

  it('とぐろ締め：縮みきったら終わる。予告の間は、プレイヤーを追って輪が動く', () => {
    const world = bossWorld('pipeserpent');
    const act = startAttack(world, 'coilcrush');
    const [h] = hazardsOf(world, 'coil');
    world.player.x = 300;
    run(world, 0.2);
    expect(h.cx).toBeCloseTo(300, 0);
    expect(runUntil(world, () => world.boss.act !== act, 10)).toBe(true);
    expect(h.dead).toBe(true);
  });

  it('配管破裂：壁の配管が順に漏れ、予告の線のあと、水柱が噴く。線の上にいると当たる。通らない場所は当たらない', () => {
    const world = bossWorld('pipeserpent');
    const p = world.player;
    const act = startAttack(world, 'pipeburst');
    expect(runUntil(world, () => hazardsOf(world, 'jet').length === act.def.count, 3)).toBe(true);
    const jets = hazardsOf(world, 'jet');
    expect(jets[1].wait).toBeGreaterThan(jets[0].wait);
    const j = jets[0];
    // 水柱の上
    const hit = damageTaken(world, 3, () => {
      if (j.phase === 'fire' || j.phase === 'aim') {
        p.x = (j.x1 + j.x2) / 2;
        p.y = (j.y1 + j.y2) / 2;
      }
    });
    expect(hit).toBeGreaterThan(0);
    // 線から遠い
    const w2 = bossWorld('pipeserpent');
    startAttack(w2, 'pipeburst');
    runUntil(w2, () => hazardsOf(w2, 'jet').length > 0, 3);
    const jets2 = hazardsOf(w2, 'jet');
    // 全部の水柱から、水柱の幅より離れた場所を探す
    const far = [];
    for (let x = w2.bounds.left + 20; x < w2.bounds.right; x += 40) {
      for (let y = w2.bounds.top + 20; y < w2.bounds.bottom; y += 40) {
        const dist = (jj) => {
          const dx = jj.x2 - jj.x1;
          const dy = jj.y2 - jj.y1;
          const t = Math.max(0, Math.min(1, ((x - jj.x1) * dx + (y - jj.y1) * dy) / (dx * dx + dy * dy)));
          return Math.hypot(x - (jj.x1 + dx * t), y - (jj.y1 + dy * t));
        };
        if (jets2.every((jj) => dist(jj) > jj.width + 20)) far.push({ x, y });
      }
    }
    if (far.length > 0) {
      const spot = far[0];
      expect(damageTaken(w2, 5, () => {
        w2.player.x = spot.x;
        w2.player.y = spot.y;
      })).toBe(0);
    }
  });

  it('汚水の塊：山なりに落ちて、減速の床が残る。小さな塊が3つ、周りへ飛び散って落ちる', () => {
    const world = bossWorld('pipeserpent');
    const act = startAttack(world, 'sludgeglob');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length === 1, 2)).toBe(true);
    const [mark] = hazardsOf(world, 'mark');
    expect(mark.from).toBeDefined();
    expect(mark.split.count).toBe(3);
    expect(runUntil(world, () => hazardsOf(world, 'mark').length === 3 && hazardsOf(world, 'mark').every((m) => m !== mark), 3)).toBe(true);
    const pools = hazardsOf(world, 'pool');
    expect(pools.length).toBeGreaterThanOrEqual(1);
    expect(pools.every((q) => q.slow)).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
  });

  it('巻きつき：当たると巻きつかれて動けず、決まった間隔でダメージ。ダッシュで振りほどける', () => {
    const world = bossWorld('pipeserpent');
    const b = world.boss;
    const p = world.player;
    b.x = 300;
    b.y = 270;
    p.x = 480;
    p.y = 270;
    const act = startAttack(world, 'grapple');
    p.inv = 0;
    const hp = p.hp;
    expect(runUntil(world, () => !!p.held, 3)).toBe(true);
    const x = p.x;
    updateWorld(world, DT, { ...idle, mx: 1 });
    expect(Math.abs(p.x - world.boss.x - p.held.dx)).toBeLessThan(1); // ボスに引きずられて動かない
    expect(runUntil(world, () => p.hp < hp, act.def.hold + 0.5)).toBe(true);
    expect(x).toBeDefined();
    // 振りほどく
    updateWorld(world, DT, { ...idle, dashPressed: true });
    expect(p.held).toBeNull();
    expect(p.inv).toBeGreaterThan(0);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
    // 振りほどかないと、hold 秒で解ける
    const w2 = bossWorld('pipeserpent');
    w2.boss.x = 300;
    w2.boss.y = 270;
    w2.player.x = 480;
    w2.player.y = 270;
    startAttack(w2, 'grapple');
    w2.player.inv = 0;
    expect(runUntil(w2, () => !!w2.player.held, 3)).toBe(true);
    run(w2, act.def.hold + 0.3);
    expect(w2.player.held).toBeNull();
  });

  it('巻きつき：外れたら（壁に当たる・届かない）何も起きない。無敵のあいだは巻きつかれない', () => {
    const world = bossWorld('pipeserpent');
    world.boss.x = 300;
    world.boss.y = 270;
    world.player.x = 480;
    world.player.y = 270;
    const act = startAttack(world, 'grapple');
    world.player.inv = 5;
    run(world, 2);
    expect(world.player.held).toBeFalsy();
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
  });

  it('濁流（大技）：水の壁が3回、部屋を横切る。柱の真後ろだけが安全', () => {
    const world = bossWorld('pipeserpent');
    const act = startAttack(world, 'mudflow');
    expect(runUntil(world, () => hazardsOf(world, 'mudtide').length > 0, 3)).toBe(true);
    const [h] = hazardsOf(world, 'mudtide');
    expect(h.waves).toHaveLength(3);
    expect(h.waves[0].id).not.toBe(h.waves[1].id);
    expect(h.pillars).toHaveLength(3);
    const dirOf = (w) => ({ left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] })[w.id];
    const w0 = h.waves[0];
    const [dx, dy] = dirOf(w0);
    const pl = h.pillars[0];
    const p = world.player;
    // 柱の真後ろ
    const lee = damageTaken(world, 6, () => {
      p.x = pl.x + dx * 60;
      p.y = pl.y + dy * 60;
    });
    expect(lee).toBe(0);
    // 柱の後ろから、横へ外れた場所
    const w2 = bossWorld('pipeserpent');
    startAttack(w2, 'mudflow');
    runUntil(w2, () => hazardsOf(w2, 'mudtide').length > 0, 3);
    const [h2] = hazardsOf(w2, 'mudtide');
    const [ex, ey] = dirOf(h2.waves[0]);
    const q = h2.pillars[0];
    const side = { x: q.x + ex * 60 - ey * 110, y: q.y + ey * 60 + ex * 110 };
    expect(damageTaken(w2, 6, () => {
      w2.player.x = Math.max(w2.bounds.left + 10, Math.min(w2.bounds.right - 10, side.x));
      w2.player.y = Math.max(w2.bounds.top + 10, Math.min(w2.bounds.bottom - 10, side.y));
    })).toBeGreaterThan(0);
    expect(runUntil(world, () => world.boss.act !== act, 20)).toBe(true);
    expect(h.i).toBe(3);
  });
});

describe('タンククラブ', () => {
  it('はさみ打ち：左右の爪が、プレイヤーの場所へ閉じる。立っていると当たる。爪の線の外（前後）へ出れば当たらない。後半は2組', () => {
    const run1 = (move) => {
      const world = bossWorld('tankcrab');
      const p = world.player;
      p.x = 300;
      p.y = 270;
      world.boss.x = 700;
      world.boss.y = 270;
      const act = startAttack(world, 'pincerclose');
      const [h] = hazardsOf(world, 'claws');
      run(world, act.def.telegraph + 0.05);
      expect(h.phase).toBe('close');
      const cx = h.cx;
      const cy = h.cy;
      const dmg = damageTaken(world, act.def.close + 0.5, () => {
        p.x = cx + h.ux * move;
        p.y = cy + h.uy * move;
      });
      return dmg;
    };
    expect(run1(0)).toBeGreaterThan(0);
    expect(run1(140)).toBe(0);
    const hard = bossWorld('tankcrab');
    startAttack(hard, 'pincercloseHard');
    expect(hazardsOf(hard, 'claws')).toHaveLength(2);
  });

  it('泡の群れ：壊せる泡が6個。寄ってきて、触れると破裂する。先に壊せば当たらない。時間で消える', () => {
    const world = bossWorld('tankcrab');
    const p = world.player;
    const act = startAttack(world, 'bubbleswarm');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'bubble').length === 6, 2)).toBe(true);
    const bubbles = world.enemies.filter((e) => e.def.id === 'bubble');
    const d0 = Math.hypot(bubbles[0].x - p.x, bubbles[0].y - p.y);
    run(world, 1.5);
    expect(Math.hypot(bubbles[0].x - p.x, bubbles[0].y - p.y)).toBeLessThan(d0); // 寄ってくる
    // 触れると破裂
    const hp = p.hp;
    p.inv = 0;
    bubbles[0].x = p.x;
    bubbles[0].y = p.y;
    run(world, 0.1);
    expect(bubbles[0].dead).toBe(true);
    expect(p.hp).toBeLessThan(hp);
    // 先に壊した泡は、当たらない
    const broken = bubbles[1];
    hitEnemy(world, broken, 99999, 1, 0, 0);
    p.inv = 0;
    const hp2 = p.hp;
    broken.x = p.x;
    broken.y = p.y;
    run(world, 0.1);
    expect(p.hp).toBe(hp2);
    // 時間で消えて、技が終わる
    expect(runUntil(world, () => world.boss.act !== act, 12)).toBe(true);
    expect(world.enemies.filter((e) => e.def.id === 'bubble' && !e.dead)).toHaveLength(0);
  });

  it('横走り：横へずれて、止まるたびに前方へ爪を振る。回数は決まっている', () => {
    const world = bossWorld('tankcrab');
    const b = world.boss;
    world.player.x = 300;
    world.player.y = 270;
    b.x = 700;
    b.y = 270;
    const act = startAttack(world, 'sidestep');
    const y0 = b.y;
    expect(runUntil(world, () => hazardsOf(world, 'mark').length >= 1, 3)).toBe(true);
    expect(Math.abs(b.y - y0)).toBeGreaterThan(80); // 横（プレイヤーとの線に垂直）へずれた
    expect(runUntil(world, () => world.boss.act !== act, 8)).toBe(true);
    expect(act.i).toBe(act.def.count);
  });

  it('水圧噴射：十字の線が、段ごとに22.5度ずつ回る。段の数は決まっている', () => {
    const world = bossWorld('tankcrab');
    const act = startAttack(world, 'jetcross');
    expect(runUntil(world, () => act.phase === 'active', 3)).toBe(true);
    expect(world.hazards.filter((h) => h.type === 'bar')).toHaveLength(2);
    const a0 = world.hazards.find((h) => h.type === 'bar').angle;
    expect(runUntil(world, () => act.spawned >= 2, 4)).toBe(true);
    const bars = world.hazards.filter((h) => h.type === 'bar');
    const a1 = bars.at(-1).angle;
    expect(Math.abs(a1 - a0 - (22.5 * Math.PI) / 180) % (Math.PI / 2)).toBeCloseTo(0, 1);
    expect(runUntil(world, () => world.boss.act !== act, 10)).toBe(true);
    expect(act.spawned).toBe(act.def.steps);
  });

  it('甲羅転がし：転がって、壁で跳ね返る。決まった回数のあと、止まる（長い隙）。体に触れると当たる', () => {
    const world = bossWorld('tankcrab');
    const b = world.boss;
    b.x = 480;
    b.y = 270;
    world.player.x = 200;
    world.player.y = 100;
    const act = startAttack(world, 'rollshell');
    expect(runUntil(world, () => act.phase === 'roll', 3)).toBe(true);
    expect(runUntil(world, () => act.bounces >= 1, 4)).toBe(true);
    expect(runUntil(world, () => act.phase === 'recover', 10)).toBe(true);
    expect(act.bounces).toBe(act.def.bounces + 1);
    expect(act.t).toBeGreaterThan(act.def.recover - 0.1);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
    // 当たる
    const w2 = bossWorld('tankcrab');
    w2.boss.x = 300;
    w2.boss.y = 270;
    w2.player.x = 420;
    w2.player.y = 270;
    startAttack(w2, 'rollshell');
    expect(damageTaken(w2, 2)).toBeGreaterThan(0);
  });

  it('満潮（大技）：水位が3回上がる。水の中は、ダメージと減速。高台の上は安全', () => {
    const world = bossWorld('tankcrab');
    const p = world.player;
    const act = startAttack(world, 'hightide');
    expect(runUntil(world, () => hazardsOf(world, 'tide').length > 0, 3)).toBe(true);
    const [h] = hazardsOf(world, 'tide');
    expect(h.pulses).toHaveLength(3);
    expect(h.islands).toHaveLength(3);
    expect(runUntil(world, () => h.phase === 'hold', 6)).toBe(true);
    const pulse = h.pulses[h.i];
    const bd = world.bounds;
    const inWater = { x: pulse.id === 'left' ? bd.left + 10 : pulse.id === 'right' ? bd.right - 10 : (bd.left + bd.right) / 2, y: pulse.id === 'top' ? bd.top + 10 : pulse.id === 'bottom' ? bd.bottom - 10 : (bd.top + bd.bottom) / 2 };
    h.islands = [];
    expect(damageTaken(world, 1.2, () => {
      p.x = inWater.x;
      p.y = inWater.y;
    })).toBeGreaterThan(0);
    expect(p.slowT).toBeGreaterThan(0);
    // 高台の上
    h.islands = [{ x: inWater.x, y: inWater.y, r: 70 }];
    expect(damageTaken(world, 1.2, () => {
      p.x = inWater.x;
      p.y = inWater.y;
    })).toBe(0);
    expect(runUntil(world, () => world.boss.act !== act, 25)).toBe(true);
    expect(h.i).toBe(3);
  });
});

describe('スラッジハイドラ', () => {
  it('汚泥の噴水：汚泥が山なりに落ち、落ちた場所に、広がり続ける汚泥の床が残る', () => {
    const world = bossWorld('sludgehydra');
    const act = startAttack(world, 'sludgefount');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length === act.def.count, 3)).toBe(true);
    expect(hazardsOf(world, 'mark').every((m) => m.from && m.pool.grow > 0)).toBe(true);
    expect(runUntil(world, () => hazardsOf(world, 'pool').length > 0, 3)).toBe(true);
    const pool = hazardsOf(world, 'pool')[0];
    const r0 = pool.r;
    run(world, 1.5);
    expect(pool.r).toBeGreaterThan(r0);
    expect(pool.r).toBeLessThanOrEqual(act.def.pool.rMax);
    expect(pool.slow).toBe(true);
  });

  it('首の掃射：生きている首の数だけ、線が出る。首が倒れているほど、線が減る。線に当たるとダメージ', () => {
    const world = bossWorld('sludgehydra');
    const act = startAttack(world, 'headsweep');
    expect(runUntil(world, () => hazardsOf(world, 'headbeams').length > 0, 2)).toBe(true);
    const [h] = hazardsOf(world, 'headbeams');
    expect(h.beams).toHaveLength(3);
    // 首を1本倒すと、線が2本
    const w2 = bossWorld('sludgehydra');
    expect(heads(w2)).toHaveLength(3);
    hitEnemy(w2, heads(w2)[0], 99999, 1, 0, 0);
    startAttack(w2, 'headsweep');
    runUntil(w2, () => hazardsOf(w2, 'headbeams').length > 0, 2);
    expect(hazardsOf(w2, 'headbeams')[0].beams).toHaveLength(2);
    // 当たる
    run(world, h.warn + 0.05);
    const beam = h.beams[0];
    const p = world.player;
    expect(damageTaken(world, 1.5, () => {
      if (h.warn <= 0) {
        p.x = beam.head.x + Math.cos(beam.angle) * 220;
        p.y = beam.head.y + Math.sin(beam.angle) * 220;
      }
    })).toBeGreaterThan(0);
    expect(runUntil(world, () => world.boss.act !== act, 6)).toBe(true);
  });

  it('泥沼：中心へ引き込まれ、減速する。中心に近いとダメージ。歩けば逆らえる。ダッシュ中は引かれない', () => {
    const world = bossWorld('sludgehydra');
    const p = world.player;
    const act = startAttack(world, 'bogs');
    expect(runUntil(world, () => hazardsOf(world, 'bog').length === act.def.count, 3)).toBe(true);
    const [bog] = hazardsOf(world, 'bog');
    expect(runUntil(world, () => bog.arm <= 0, 2)).toBe(true);
    p.x = bog.x + 60;
    p.y = bog.y;
    p.inv = 0; // 無敵のあいだは、減速もしない
    run(world, 0.5);
    expect(Math.hypot(p.x - bog.x, p.y - bog.y)).toBeLessThan(60 - 5); // 引き込まれた
    expect(p.slowT).toBeGreaterThan(0);
    // 中心でダメージ
    expect(damageTaken(world, 1, () => {
      p.x = bog.x;
      p.y = bog.y;
    })).toBeGreaterThan(0);
    // ダッシュ中は、引かれない
    p.x = bog.x + 60;
    p.y = bog.y;
    p.dashT = 0.5;
    const x = p.x;
    bog.acc = -99;
    world.hazards.filter((h) => h.type === 'bog').forEach((h) => (h.acc = -99));
    updateWorld(world, DT, idle);
    expect(p.dashT).toBeGreaterThan(0);
    expect(p.x).toBeGreaterThanOrEqual(x - 1);
  });

  it('首の絡み：絡みつかれると、減速してダッシュできない。絡んだ首を倒すと解ける。解けないと、引き寄せられて叩かれる', () => {
    const world = bossWorld('sludgehydra');
    const p = world.player;
    p.x = world.boss.x - 150;
    p.y = world.boss.y;
    const act = startAttack(world, 'entangle');
    expect(runUntil(world, () => !!p.tether, 3)).toBe(true);
    p.inv = 0;
    run(world, 0.2);
    expect(p.slowT).toBeGreaterThan(0);
    updateWorld(world, DT, { ...idle, dashPressed: true });
    expect(p.dashT).toBeLessThanOrEqual(0); // ダッシュできない
    // 首を倒すと解ける
    hitEnemy(world, p.tether.head, 99999, 1, 0, 0);
    run(world, 0.3); // 倒したときの、画面の止まり（ヒットストップ）が終わるまで
    expect(p.tether).toBeNull();
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
    // 解けないと、引き寄せられて叩かれる
    const w2 = bossWorld('sludgehydra');
    w2.player.x = w2.boss.x - 150;
    w2.player.y = w2.boss.y;
    startAttack(w2, 'entangle');
    runUntil(w2, () => !!w2.player.tether, 3);
    w2.player.inv = 0;
    const hp = w2.player.hp;
    const x = w2.player.x;
    expect(runUntil(w2, () => !w2.player.tether, act.def.hold + 1)).toBe(true);
    expect(w2.player.hp).toBeLessThan(hp);
    run(w2, 0.2);
    expect(Math.abs(w2.player.x - x)).toBeGreaterThan(5); // 引き寄せられた
  });

  it('首の絡み：届かないときは、空振りして終わる', () => {
    const world = bossWorld('sludgehydra');
    world.player.x = world.bounds.left + 5;
    world.player.y = world.bounds.top + 5;
    world.boss.x = world.bounds.right - 60;
    world.boss.y = world.bounds.bottom - 60;
    const act = startAttack(world, 'entangle');
    run(world, act.def.telegraph + 0.3);
    expect(world.player.tether).toBeFalsy();
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
  });

  it('大再生（大技）：倒された首の根元が光り、順に首が生え直る。生え直るたびにHPが回復する。根元を壊すと、その首は止まる', () => {
    const setup = () => {
      const world = bossWorld('sludgehydra');
      for (const e of heads(world)) e.dead = true;
      world.enemies = world.enemies.filter((e) => !e.dead);
      const b = world.boss;
      b.hp = b.maxHp * 0.2;
      return world;
    };
    const world = setup();
    const act = startAttack(world, 'regrowth');
    expect(runUntil(world, () => act.roots.length === 3, 4)).toBe(true);
    expect(act.roots[1].due).toBeGreaterThan(act.roots[0].due);
    const hp = world.boss.hp;
    expect(runUntil(world, () => world.boss.act !== act, 12)).toBe(true);
    expect(heads(world)).toHaveLength(3);
    expect(world.boss.hp).toBeCloseTo(hp + world.boss.maxHp * act.def.heal * 3, 0);
    // 1本、根元を壊す
    const w2 = setup();
    const act2 = startAttack(w2, 'regrowth');
    runUntil(w2, () => act2.roots.length === 3, 4);
    hitEnemy(w2, act2.roots[0].enemy, 99999, 1, 0, 0);
    expect(runUntil(w2, () => w2.boss.act !== act2, 12)).toBe(true);
    expect(heads(w2)).toHaveLength(2);
  });

  it('大再生：首が全部残っているときは、首が一斉に汚泥を撒く', () => {
    const world = bossWorld('sludgehydra');
    const act = startAttack(world, 'regrowth');
    expect(runUntil(world, () => act.volleys >= 1, 5)).toBe(true);
    expect(act.roots).toHaveLength(0);
    expect(world.shots.length).toBeGreaterThanOrEqual(3 * act.def.ring);
    expect(runUntil(world, () => world.boss.act !== act, 12)).toBe(true);
  });
});

describe('絵：マップ2の新しい攻撃を最後まで描いても、エラーにならない', () => {
  it('3体の、すべての攻撃を描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const id of ['pipeserpent', 'tankcrab', 'sludgehydra']) {
      const boss = DATA.bosses.get(id);
      for (const name of Object.keys(boss.attacks)) {
        const world = bossWorld(id);
        world.boss.hp = world.boss.maxHp * 0.4;
        world.player.x = world.boss.x - 160;
        world.player.y = world.boss.y;
        startAttack(world, name);
        let frame = 0;
        for (let t = 0; t < 16 && world.boss.act; t += DT) {
          updateWorld(world, DT, idle);
          if (frame++ % 3 === 0) {
            drawHazards(g, world);
            drawBossTelegraph(g, world);
            drawEnemies(g, world);
            drawPlayer(g, world);
          }
        }
        expect(frame, `${id} の ${name}`).toBeGreaterThan(3);
      }
    }
  });
});
