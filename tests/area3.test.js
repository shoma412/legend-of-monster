import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { ending } from '../src/data/story.js';
import { applyStop, effectDamage, hitEnemy } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { AREA_ORDER, NEXT_AREA, createRun, currentArea, enterRoom, handleEvents, leaveRoom, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { distToSegment } from '../src/logic/geometry.js';
import { createSave } from '../src/logic/save.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, specialPressed: false, dashPressed: false };
const def = DATA.bosses.get('overload');

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeWorld() {
  const world = createWorld({ waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity;
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 40) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

function addEnemy(world, id, dx, dy = 0) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng);
  e.cd = 0;
  world.enemies.push(e);
  return e;
}

function overloadWorld() {
  const world = createWorld({ waves: [{ boss: 'overload' }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  return world;
}

describe('エリア3の定義', () => {
  it('3つ目のエリアは企業タワーで、最後のエリア。シールド兵とスナイパーはここにだけ出る', () => {
    expect(AREA_ORDER).toEqual(['slum', 'plant', 'tower']);
    const tower = DATA.areas.get('tower');
    expect(tower).toMatchObject({ boss: 'overload', final: true });
    expect(DATA.areas.all().filter((a) => a.final)).toHaveLength(1);
    const ids = (id) => DATA.areas.get(id).enemies.map((e) => e.id);
    expect(ids('tower')).toEqual(expect.arrayContaining(['bomber', 'shield', 'sniper']));
    for (const id of ['slum', 'plant']) {
      expect(ids(id)).not.toContain('shield');
      expect(ids(id)).not.toContain('sniper');
    }
    expect(ids('tower')).not.toContain('sprayer'); // フロストスプレイヤーはエリア2だけ
    expect(def).toMatchObject({ weakness: 'shock', material: 'overCore' });
    expect(ending.lines.length).toBeGreaterThan(3);
  });
});

describe('distToSegment', () => {
  it('線分までの距離（端より先は、端までの距離）', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(distToSegment(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5);
    expect(distToSegment(14, 3, 0, 0, 10, 0)).toBeCloseTo(5);
  });
});

describe('シールド兵', () => {
  it('正面からの攻撃は防ぐ。背後からなら通る', () => {
    const world = makeWorld();
    world.player.weapon = DATA.weapons.get('sword'); // 盾で完全に防がれる武器で確かめる（大剣・大砲は、半分通る）
    const e = addEnemy(world, 'shield', 100);
    e.facing = Math.PI; // 左（プレイヤーの方）を向いている
    // プレイヤーから敵へ向かう攻撃（正面から）
    expect(hitEnemy(world, e, 30, 1, 0, 0)).toMatchObject({ amount: 0, blocked: true });
    expect(e.hp).toBe(e.maxHp);
    // 背後から（敵の向こう側から手前へ向かう攻撃）
    expect(hitEnemy(world, e, 30, -1, 0, 0).amount).toBe(30);
    expect(e.hp).toBe(e.maxHp - 30);
  });

  it('止まっている間（凍結・EMP）は防げない。インプラントなどの追加ダメージも防げない', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'shield', 100);
    e.facing = Math.PI;
    effectDamage(world, e, 10, 'shock');
    expect(e.hp).toBe(e.maxHp - 10);
    applyStop(e, 2);
    expect(hitEnemy(world, e, 30, 1, 0, 0).amount).toBe(30);
  });

  it('向きを変えるのは遅い。素早く回り込めば背後を取れる', () => {
    const world = makeWorld();
    world.player.weapon = DATA.weapons.get('sword'); // 盾で完全に防がれる武器で確かめる（大剣・大砲は、半分通る）
    const p = world.player;
    const e = addEnemy(world, 'shield', 200);
    e.cd = 99;
    run(world, 0.5);
    expect(Math.abs(e.facing)).toBeCloseTo(Math.PI, 1); // こちらを向いている
    // 一瞬で反対側へ移動する（ダッシュで回り込んだことにする）
    p.x = e.x + 80;
    p.y = e.y;
    run(world, 0.2);
    // まだ振り向ききっていないので、今の位置（敵の右側）からの攻撃が通る
    expect(hitEnemy(world, e, 30, -1, 0, 0).blocked).toBeUndefined();
    run(world, 3);
    // 十分に時間がたつと、こちらを向き直して防ぐ
    expect(hitEnemy(world, e, 30, e.x - p.x, e.y - p.y, 0).blocked).toBe(true);
  });
});

describe('スナイパー', () => {
  it('照準線を出したあとに高威力の一撃。狙っている間は当たらない', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'sniper', 380);
    expect(runUntil(world, () => e.state === 'aim', 2)).toBe(true);
    run(world, e.def.snipe.aim - 0.1);
    expect(p.hp).toBe(PLAYER.maxHp);
    run(world, 0.2);
    expect(p.hp).toBe(PLAYER.maxHp - e.def.damage);
    expect(e.def.damage).toBeGreaterThan(DATA.enemies.get('turret').damage * 2);
  });

  it('向きが固定されてから照準線の外へ動けば当たらない', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'sniper', 380);
    runUntil(world, () => e.state === 'aim' && e.t <= e.def.snipe.lock, 3);
    p.y += 80;
    run(world, e.def.snipe.lock + 0.1);
    expect(p.hp).toBe(PLAYER.maxHp);
  });
});

describe('オーバーロード', () => {
  it('前半は、使える技の中から選び、同じ技を続けて出さない', () => {
    const world = overloadWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    const seen = [];
    let last = null;
    for (let t = 0; t < 50 && seen.length < 4; t += DT) {
      updateWorld(world, DT, idle);
      if (b.act && b.act !== last) seen.push(b.act.name);
      last = b.act;
    }
    const moves = DATA.bosses.get('overload').phases[0].moves;
    expect(seen).toHaveLength(4);
    seen.forEach((name, i) => {
      expect(moves).toContain(name);
      if (i > 0) expect(name).not.toBe(seen[i - 1]);
    });
  });

});

describe('クリア', () => {
  function clearRun(save, weaponId = 'greatsword') {
    const r = createRun({ rng: seeded(7), save, weaponId });
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    expect(currentArea(r).id).toBe('tower');
    skipToBoss(r, enterRoom(r));
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 9999999, 1, 0, 0);
    handleEvents(r, world);
    return r;
  }

  it('オーバーロードを倒すとクリア。オーバーコア、クリア回数、その武器でのクリア実績が残る', () => {
    const save = createSave();
    const r = clearRun(save, 'sword');
    expect(save.materials.overCore).toBe(3);
    expect(save.records.clears).toBe(1);
    expect(save.records.bestArea).toBe(2);
    expect(save.achievements).toEqual(expect.arrayContaining(['overload', 'clear-sword']));
    expect(save.achievements).not.toContain('clear-greatsword');
    expect(save.fragments).toContain('ov-core');
    // マップ1が完了になる。次の周は、今あるマップをすべて完了するまで選べない。エンディングは7つすべてを完了するまで出ない
    expect(save.maps.map1).toEqual({ clears: 1, clearedCycle: 1 });
    expect(save.cycle).toBe(1);
    expect(save.achievements).toContain('map1');
    expect(r.ending).toBe(false);
  });

  it('同じマップをもう一度クリアすると、クリア回数だけ増える', () => {
    const save = createSave();
    clearRun(save);
    clearRun(save);
    expect(save.records.clears).toBe(2);
    expect(save.maps.map1).toEqual({ clears: 2, clearedCycle: 1 });
    expect(save.cycle).toBe(1);
  });

  it('エリア3の雑魚は、HPと攻撃力が 1.6×1.6 倍', () => {
    const r = createRun({ rng: seeded(7), save: createSave() });
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    expect(enterRoom(r).room.enemyScale).toBeCloseTo(2.56);
  });
});
