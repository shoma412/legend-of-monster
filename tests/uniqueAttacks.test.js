import { describe, expect, it } from 'vitest';
import { PLAYER, STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { afflictPlayer, hurtPlayer } from '../src/game/combat.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { cellHot, cellRect, orbitBlades } from '../src/logic/bossShapes.js';

// マップ3のボスと隠しボスの、固有の攻撃と持続ダメージ（docs/詳細仕様.md「22. 固有の攻撃と持続ダメージ」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function bossWorld(id) {
  const world = createWorld({ waves: [{ boss: id }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.boss.ultimateDone = true;
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
  for (let t = 0; t < seconds; t += DT) {
    world.boss.idleT = Infinity;
    updateWorld(world, DT, input);
  }
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    world.boss.idleT = Infinity;
    updateWorld(world, DT, idle);
  }
  return false;
}

describe('固有の攻撃の割り当て', () => {
  it('マップ3の3体と隠しボスは、ほかのボスが使わない部品を持っている', () => {
    const own = { scraphound: ['orbit'], girderspider: ['wires'], cranetitan: ['weld'], architect: ['cells', 'ink'] };
    for (const [id, patterns] of Object.entries(own)) {
      const boss = DATA.bosses.get(id);
      const used = new Set(boss.phases.flatMap((ph) => ph.moves.map((m) => boss.attacks[typeof m === 'string' ? m : m.move].pattern)));
      for (const pattern of patterns) {
        expect(PATTERNS[pattern], pattern).toBeDefined();
        expect(used.has(pattern), `${id} が ${pattern} を使う`).toBe(true);
        // ほかのボスは使っていない
        for (const other of DATA.bosses.all()) {
          if (other.id === id) continue;
          expect(Object.values(other.attacks).some((a) => a.pattern === pattern), `${other.id} は ${pattern} を使わない`).toBe(false);
        }
        // 前半から出る
        expect(boss.phases[0].moves.some((m) => boss.attacks[m].pattern === pattern), `${id} の前半`).toBe(true);
      }
    }
  });

  it('持続ダメージの種類は、定義されたものを指している', () => {
    for (const boss of DATA.bosses.all()) {
      for (const attack of Object.values(boss.attacks)) if (attack.dot) expect(STATUS.dots[attack.dot], `${boss.id} ${attack.dot}`).toBeDefined();
    }
  });
});

describe('持続ダメージ', () => {
  it('決まった間隔でダメージを受け、時間がたつと消える。被弾後の無敵の間も効く', () => {
    const world = bossWorld('cranetitan');
    const p = world.player;
    const def = STATUS.dots.burn;
    world.boss.x = 900;
    world.boss.y = 60;
    p.x = 200;
    p.y = 400;
    afflictPlayer(world, 'burn');
    expect(p.dot.name).toBe('炎上');
    p.inv = 99; // 無敵でも、持続ダメージは通る
    run(world, def.duration + 0.2);
    expect(p.dot).toBeNull();
    const ticks = Math.floor(def.duration / def.tick);
    expect(PLAYER.maxHp - p.hp).toBe(ticks * def.damage);
  });

  it('ダッシュすると消える', () => {
    const world = bossWorld('cranetitan');
    const p = world.player;
    world.boss.x = 900;
    world.boss.y = 60;
    afflictPlayer(world, 'bleed');
    updateWorld(world, DT, { ...idle, mx: -1, dashPressed: true });
    expect(p.dot).toBeNull();
  });

  it('持続ダメージでは倒れない（HP は 1 残る）。部屋をクリアすると消える', () => {
    const world = bossWorld('cranetitan');
    const p = world.player;
    world.boss.x = 900;
    world.boss.y = 60;
    p.hp = 3;
    afflictPlayer(world, 'corrode');
    run(world, 2);
    expect(p.hp).toBe(1);
    expect(world.mode).toBe('play');
  });
});

describe('刃の渦（スクラップハウンド）', () => {
  it('予告の間は当たらない。始まると刃が回り、ボスは追いかけてくる。刃に当たると裂傷が付く', () => {
    const world = bossWorld('scraphound');
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.shred;
    b.x = 600;
    b.y = 270;
    p.x = 250;
    p.y = 270;
    const act = startAttack(world, 'shred');
    run(world, def.telegraph - 0.1);
    expect(act.phase).toBe('telegraph');
    expect(p.hp).toBe(PLAYER.maxHp);
    const startX = b.x;
    expect(runUntil(world, () => act.phase === 'active', 1)).toBe(true);
    expect(orbitBlades(b, act)).toHaveLength(def.count);
    run(world, 0.5);
    expect(b.x).toBeLessThan(startX); // 追ってくる
    for (const blade of orbitBlades(b, act)) expect(Math.hypot(blade.x - b.x, blade.y - b.y)).toBeCloseTo(def.radius);
    // 刃の通り道に立つ
    expect(runUntil(world, () => {
      p.x = b.x - def.radius;
      p.y = b.y;
      return p.hp < PLAYER.maxHp;
    }, 3)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);
    expect(p.dot?.id).toBe('bleed');
  });
});

describe('張り糸（ガーダースパイダー）', () => {
  const wires = (world) => world.hazards.filter((h) => h.type === 'wire');

  it('糸は決まった本数張られ、1本目はプレイヤーのいる場所を通る。効き始めるまでは当たらない', () => {
    const world = bossWorld('girderspider');
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.wires;
    b.x = 900;
    b.y = 60;
    p.x = 300;
    p.y = 300;
    startAttack(world, 'wires');
    expect(runUntil(world, () => wires(world).length > 0, 2)).toBe(true);
    expect(wires(world)).toHaveLength(def.count);
    expect(wires(world)[0].x).toBeCloseTo(p.x);
    expect(wires(world)[0].y).toBeCloseTo(p.y);
    run(world, def.arm - 0.1);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(p.slowT ?? 0).toBeLessThanOrEqual(0);
  });

  it('効き始めた糸に触れていると、減速してダメージを受ける。離れていれば当たらない。時間がたつと消える', () => {
    const world = bossWorld('girderspider');
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.wires;
    b.x = 900;
    b.y = 60;
    p.x = 300;
    p.y = 300;
    startAttack(world, 'wires');
    runUntil(world, () => wires(world).length > 0, 2);
    world.hazards = [wires(world)[0]]; // 1本目だけで確かめる
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, def.arm + 1)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);
    expect(p.slowT).toBeGreaterThan(0);
    // 糸から離れる（糸と直角の向きへ）
    const wire = wires(world)[0];
    p.x = wire.x - Math.sin(wire.angle) * 120;
    p.y = wire.y + Math.cos(wire.angle) * 120;
    p.inv = 0;
    const hp = p.hp;
    run(world, def.life + 0.5);
    expect(p.hp).toBe(hp);
    expect(wires(world)).toHaveLength(0);
  });
});

describe('溶接ビーム（クレーンタイタン）', () => {
  it('ビームはプレイヤーをゆっくり追う。立ち止まっていると当たり、炎上が付く。通ったあとに燃える床が残る', () => {
    const world = bossWorld('cranetitan');
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.weld;
    const act = startAttack(world, 'weld');
    run(world, def.telegraph - 0.1);
    expect(p.hp).toBe(PLAYER.maxHp); // 予告の間は当たらない
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 2)).toBe(true);
    expect(p.hp).toBeLessThanOrEqual(PLAYER.maxHp - def.damage);
    expect(p.dot?.id).toBe('burn');
    expect(world.hazards.some((h) => h.type === 'pool' && h.dot === 'burn')).toBe(true);
    expect(act.phase).toBe('active');
  });

  it('回る速さには上限がある：近くを速く回り込めば、振り切れる', () => {
    const world = bossWorld('cranetitan');
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.weld;
    b.x = 480;
    b.y = 290;
    // ビームの向き（右）から、真上へ一気に動く
    p.x = b.x + 200;
    p.y = b.y;
    const act = startAttack(world, 'weld');
    run(world, def.telegraph + 0.05);
    const before = act.angle;
    p.x = b.x;
    p.y = b.y - 200;
    p.inv = Infinity;
    run(world, 0.5);
    // 0.5 秒では、追いつける角度は限られる
    expect(Math.abs(act.angle - before)).toBeLessThanOrEqual((def.turn * Math.PI) / 180 * 0.5 + 0.02);
    expect(Math.abs(act.angle - before)).toBeGreaterThan(0.1);
  });
});

describe('方眼（アーキテクト）', () => {
  // プレイヤーのいるマス
  const cellOf = (world, act) => {
    const bounds = world.bounds;
    const p = world.player;
    return {
      col: Math.floor(((p.x - bounds.left) / (bounds.right - bounds.left)) * act.def.cols),
      row: Math.floor(((p.y - bounds.top) / (bounds.bottom - bounds.top)) * act.def.rows),
    };
  };
  // 攻撃される／されないマスの真ん中へ動かす
  const moveTo = (world, act, hot) => {
    for (let col = 0; col < act.def.cols; col++) {
      for (let row = 0; row < act.def.rows; row++) {
        const rect = cellRect(world, act, col, row);
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        const farFromBoss = Math.hypot(cx - world.boss.x, cy - world.boss.y) > 200;
        if (cellHot(act, col, row) === hot && farFromBoss) {
          world.player.x = cx;
          world.player.y = cy;
          return;
        }
      }
    }
  };

  it('攻撃されるマスは、市松模様のちょうど半分。次の回は、残りの半分になる', () => {
    const world = bossWorld('architect');
    const act = startAttack(world, 'cells');
    let hot = 0;
    for (let col = 0; col < act.def.cols; col++) for (let row = 0; row < act.def.rows; row++) if (cellHot(act, col, row)) hot++;
    expect(hot).toBe((act.def.cols * act.def.rows) / 2);
    const first = cellHot(act, 0, 0);
    act.wave = 1;
    expect(cellHot(act, 0, 0)).toBe(!first);
    expect(cellHot(act, 1, 0)).toBe(first);
  });

  it('攻撃されるマスに立っていると当たる。予告の間は当たらない', () => {
    const world = bossWorld('architect');
    const p = world.player;
    const act = startAttack(world, 'cells');
    moveTo(world, act, true);
    const { col, row } = cellOf(world, act);
    expect(cellHot(act, col, row)).toBe(true);
    run(world, act.def.telegraph - 0.1);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => act.phase === 'active', 1)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - act.def.damage);
  });

  it('毎回、攻撃されないマスへ動けば、最後まで当たらない。決まった回数で終わる', () => {
    const world = bossWorld('architect');
    const p = world.player;
    const act = startAttack(world, 'cellsHard');
    let waves = 0;
    let wasActive = false;
    for (let t = 0; t < 12 && world.boss.act === act && act.phase !== 'recover'; t += DT) {
      moveTo(world, act, false);
      world.boss.idleT = Infinity;
      updateWorld(world, DT, idle);
      if (act.phase === 'active' && !wasActive) waves++;
      wasActive = act.phase === 'active';
    }
    expect(waves).toBe(act.def.waves);
    expect(p.hp).toBe(PLAYER.maxHp);
  });
});

describe('インク流し（アーキテクト）', () => {
  it('足元から広がっていく床が出る。中にいるとダメージと腐食。外へ出れば当たらない', () => {
    const world = bossWorld('architect');
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.ink;
    b.x = 900;
    b.y = 60;
    p.x = 300;
    p.y = 300;
    startAttack(world, 'ink');
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'pool'), 2)).toBe(true);
    const pool = world.hazards.find((h) => h.type === 'pool');
    expect(pool.x).toBeCloseTo(300);
    expect(pool.r).toBe(def.start);
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 2)).toBe(true);
    expect(p.dot?.id).toBe('corrode');
    // 広がる。上限で止まる
    run(world, 1);
    expect(pool.r).toBeGreaterThan(def.start + 20);
    run(world, 3);
    expect(pool.r).toBeLessThanOrEqual(def.maxRadius);

    // 最初から外にいれば、広がりきっても届かない場所では当たらない
    const w2 = bossWorld('architect');
    w2.boss.x = 900;
    w2.boss.y = 60;
    w2.player.x = 300;
    w2.player.y = 300;
    startAttack(w2, 'ink');
    runUntil(w2, () => w2.hazards.some((h) => h.type === 'pool'), 2);
    w2.player.x = 300 + def.maxRadius + 40;
    run(w2, def.life + 1);
    expect(w2.player.hp).toBe(PLAYER.maxHp);
    expect(w2.hazards.filter((h) => h.type === 'pool')).toHaveLength(0);
  });

  it('被弾そのものは、ふつうの攻撃と同じ扱い（無敵の間は当たらない）', () => {
    const world = bossWorld('architect');
    world.player.inv = 5;
    expect(hurtPlayer(world, 10)).toBe(false);
  });
});
