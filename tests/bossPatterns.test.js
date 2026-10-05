import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { createWorld, updateWorld } from '../src/game/world.js';

// 2026-10-06 に足した攻撃パターンの部品：弾のばらまき、跳びかかり、線の攻撃、残る床

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

// ボスが出現し終わった状態の部屋。ボスは右、プレイヤーは左にいる
function bossWorld(id) {
  const world = createWorld({ waves: [{ boss: id }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity; // 勝手に次の攻撃を始めない
  return world;
}

// その攻撃を今すぐ始めさせる
function startAttack(world, name) {
  const b = world.boss;
  const p = world.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
  PATTERNS[b.act.def.pattern].start(world, b, b.act, { dx, dy, dist: Math.hypot(dx, dy) || 1 });
  return b.act;
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

describe('ボスの攻撃の数', () => {
  it('どのボスも、前半で4種類以上、後半で5種類以上の攻撃を使う', () => {
    for (const boss of DATA.bosses.all()) {
      expect(new Set(boss.phases[0].sequence).size, boss.id).toBeGreaterThanOrEqual(4);
      expect(new Set(boss.phases.at(-1).sequence).size, boss.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('オーバーロードの後半は、3回攻撃するごとに冷却の隙がある', () => {
    const seq = DATA.bosses.get('overload').phases.at(-1).sequence;
    seq.forEach((name, i) => expect(name === 'vent', `${i}: ${name}`).toBe(i % 4 === 3));
  });
});

describe('弾のばらまき', () => {
  it('放電弾：予告のあと、全方向に弾が飛ぶ', () => {
    const world = bossWorld('boltboar');
    const def = world.boss.def.attacks.sparks;
    world.player.inv = Infinity;
    startAttack(world, 'sparks');
    expect(world.shots).toHaveLength(0);
    expect(runUntil(world, () => world.shots.length > 0)).toBe(true);
    expect(world.shots).toHaveLength(def.count);
    const angles = world.shots.map((s) => Math.round((Math.atan2(s.vy, s.vx) * 180) / Math.PI));
    expect(new Set(angles).size).toBe(def.count);
    // 左右どちらにも飛んでいる
    expect(world.shots.some((s) => s.vx > 0)).toBe(true);
    expect(world.shots.some((s) => s.vx < 0)).toBe(true);
  });

  it('うずまき弾：何回かに分けて撃ち、毎回向きがずれる', () => {
    const world = bossWorld('overload');
    const def = world.boss.def.attacks.spiral;
    world.player.inv = Infinity;
    const act = startAttack(world, 'spiral');
    const bases = new Set();
    let waves = 0;
    let left = act.left;
    for (let t = 0; t < 12 && world.boss.act; t += DT) {
      updateWorld(world, DT, idle);
      if (act.left < left) {
        waves++;
        bases.add(Math.round((act.base * 180) / Math.PI));
        left = act.left;
      }
    }
    expect(waves).toBe(def.waves);
    expect(bases.size).toBe(def.waves);
  });

  it('氷の破片：プレイヤーへ向かって扇形に飛び、当たるとダメージと減速', () => {
    const world = bossWorld('cryowyvern');
    const p = world.player;
    const def = world.boss.def.attacks.shards;
    startAttack(world, 'shards');
    expect(runUntil(world, () => world.shots.length > 0)).toBe(true);
    expect(world.shots.every((s) => s.vx < 0)).toBe(true); // プレイヤーは左にいる
    expect(runUntil(world, () => p.hp < PLAYER.maxHp)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);
    expect(p.slowT).toBeGreaterThan(0);
  });
});

describe('線の攻撃', () => {
  it('落雷の列：予告の線が出て、少し遅れて光る。立ち止まっていると当たる', () => {
    const world = bossWorld('boltboar');
    const p = world.player;
    const def = world.boss.def.attacks.thunder;
    startAttack(world, 'thunder');
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'bar'))).toBe(true);
    const bars = world.hazards.filter((h) => h.type === 'bar');
    expect(bars).toHaveLength(def.count);
    expect(bars[0].t).toBeGreaterThan(0.5); // 予告の時間がある
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 3)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);
  });

  it('落雷の列：線のない場所へ動けば当たらない', () => {
    const world = bossWorld('boltboar');
    const p = world.player;
    startAttack(world, 'thunder');
    runUntil(world, () => world.hazards.some((h) => h.type === 'bar'));
    // 線は横向き（ボスからプレイヤーへの向き）に、プレイヤーの高さとその上下に出る。線と線のあいだへ動く
    p.y += 55;
    world.boss.x = 900;
    world.boss.y = 60;
    runUntil(world, () => world.hazards.length === 0, 4);
    expect(world.hazards).toHaveLength(0);
    expect(p.hp).toBe(PLAYER.maxHp);
  });

  it('格子レーザー：横の線と縦の線が半分ずつ出る', () => {
    const world = bossWorld('overload');
    const def = world.boss.def.attacks.grid;
    world.player.inv = Infinity;
    startAttack(world, 'grid');
    runUntil(world, () => world.hazards.some((h) => h.type === 'bar'));
    const bars = world.hazards.filter((h) => h.type === 'bar');
    expect(bars).toHaveLength(def.count);
    expect(bars.filter((h) => h.angle === 0)).toHaveLength(def.count / 2);
    expect(bars.filter((h) => h.angle !== 0)).toHaveLength(def.count / 2);
    // 順番に光る（予告の長さが1本ずつ違う）
    expect(new Set(bars.map((h) => h.max.toFixed(2))).size).toBe(def.count);
  });
});

describe('跳びかかり', () => {
  it('プレイヤーのいた場所に着地し、そこにいると当たる。跳んでいる間は体に触れても当たらない', () => {
    const world = bossWorld('boltboar');
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.leap;
    const target = { x: p.x, y: p.y };
    startAttack(world, 'leap');
    expect(runUntil(world, () => b.act?.phase === 'air')).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => b.act?.phase === 'recover')).toBe(true);
    expect(Math.hypot(b.x - target.x, b.y - target.y)).toBeLessThan(2);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);
    // 着地と同時に、衝撃波の輪が広がる
    expect(world.hazards.some((h) => h.type === 'ring')).toBe(true);
  });

  it('着地点から離れれば当たらない', () => {
    const world = bossWorld('boltboar');
    const b = world.boss;
    const p = world.player;
    startAttack(world, 'leap');
    runUntil(world, () => b.act?.phase === 'air');
    p.inv = 0;
    p.y += 230; // 着地点は固定されたあと
    world.hazards.length = 0;
    runUntil(world, () => b.act?.phase === 'recover');
    expect(p.hp).toBe(PLAYER.maxHp);
  });
});

describe('残る床', () => {
  it('霜だまり：置かれてすぐは効かず、効き始めると中にいる間ダメージと減速。時間がたつと消える', () => {
    const world = bossWorld('cryowyvern');
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.frost;
    startAttack(world, 'frost');
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'pool'))).toBe(true);
    const pools = world.hazards.filter((h) => h.type === 'pool');
    expect(pools).toHaveLength(def.count);
    // 1つ目はプレイヤーの足元
    expect(Math.hypot(pools[0].x - p.x, pools[0].y - p.y)).toBeLessThan(1);
    b.x = 900;
    b.y = 60;
    updateWorld(world, DT, idle);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 3)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);
    expect(p.slowT).toBeGreaterThan(0);
    // 床から出れば、それ以上は減らない
    for (const h of world.hazards) { h.x = 100; h.y = 500; }
    p.x = 480;
    p.y = 150;
    const hp = p.hp;
    b.idleT = Infinity; // ボスに次の攻撃をさせない
    p.inv = 0;
    for (let t = 0; t < 1.5; t += DT) updateWorld(world, DT, idle);
    expect(p.hp).toBe(hp);
    p.inv = Infinity;
    runUntil(world, () => world.hazards.every((h) => h.type !== 'pool'), def.life + 2);
    expect(world.hazards.filter((h) => h.type === 'pool')).toHaveLength(0);
  });
});
