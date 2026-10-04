import { describe, expect, it } from 'vitest';
import { ITEMS, PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { addItem, hasUse, useItem } from '../src/game/consumables.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { interact } from '../src/game/objects.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { ITEM_ICONS, SLOT_ICONS } from '../src/render/icons.js';
import { createBuild } from '../src/logic/stats.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, specialPressed: false, dashPressed: false };

function makeWorld() {
  const world = createWorld({ waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity;
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function addEnemy(world, id, dx, dy = 0) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng);
  e.cd = 99;
  e.hp = e.maxHp = 10000;
  world.enemies.push(e);
  return e;
}

function give(world, id) {
  world.player.build.items = [{ id, count: 1 }, null];
}

describe('定義データのつじつま', () => {
  it('消耗品は、どれも効果の部品とアイコンがある', () => {
    expect(DATA.consumables.all()).toHaveLength(5);
    for (const def of DATA.consumables.all()) {
      expect(hasUse(def.use), def.id).toBe(true);
      expect(ITEM_ICONS[def.icon], def.id).toBeDefined();
    }
  });

  it('装備のスロットは、どれもアイコンがある', () => {
    expect(Object.keys(SLOT_ICONS).sort()).toEqual(['acc', 'armor', 'mod']);
  });
});

describe('持ち物', () => {
  it('2枠。同じ種類は1枠に3個まで重なり、入らなければ拾えない', () => {
    const build = createBuild();
    expect(build.items).toEqual([null, null]);
    expect(addItem(build, 'emp')).toBe(true);
    expect(addItem(build, 'emp')).toBe(true);
    expect(addItem(build, 'emp')).toBe(true);
    expect(build.items).toEqual([{ id: 'emp', count: ITEMS.stack }, null]);
    expect(addItem(build, 'emp')).toBe(true); // 4個目は次の枠へ
    expect(build.items[1]).toEqual({ id: 'emp', count: 1 });
    expect(addItem(build, 'smoke')).toBe(false); // 枠がない
    expect(addItem(build, 'emp')).toBe(true);
  });

  it('落ちている消耗品は、近づいて E で拾う（触れただけでは拾わない）。いっぱいなら拾えない', () => {
    const world = makeWorld();
    const p = world.player;
    world.objects.push({ kind: 'pickup', id: 'drug', x: p.x, y: p.y, r: 36 });
    run(world, 0.2);
    expect(p.build.items).toEqual([null, null]);
    interact(world);
    expect(p.build.items[0]).toEqual({ id: 'drug', count: 1 });
    expect(world.objects).toHaveLength(0);

    p.build.items = [{ id: 'emp', count: 3 }, { id: 'smoke', count: 3 }];
    world.objects.push({ kind: 'pickup', id: 'drug', x: p.x, y: p.y, r: 36 });
    run(world, 0.1);
    interact(world);
    expect(world.objects).toHaveLength(1);
  });

  it('雑魚はたまに落とし、エリートとボスは必ず1つ落とす', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 60);
    world.rng = () => 0.01;
    hitEnemy(world, e, 99999, 1, 0, 0);
    expect(world.objects.filter((o) => o.kind === 'pickup')).toHaveLength(1);

    const world2 = makeWorld();
    const e2 = addEnemy(world2, 'grunt', 60);
    world2.rng = () => 0.9;
    hitEnemy(world2, e2, 99999, 1, 0, 0);
    expect(world2.objects).toHaveLength(0);

    const world3 = createWorld({ waves: [{ boss: 'boltboar' }], rng: () => 0.9 });
    while (!world3.boss || world3.boss.spawnT > 0) updateWorld(world3, DT, idle);
    hitEnemy(world3, world3.boss, 999999, 1, 0, 0);
    expect(world3.objects.filter((o) => o.kind === 'pickup')).toHaveLength(1);
  });

  it('使うと1個減り、なくなると枠が空く。空の枠を使っても何も起きない', () => {
    const world = makeWorld();
    const p = world.player;
    p.build.items = [{ id: 'drug', count: 2 }, null];
    expect(useItem(world, 1)).toBe(false);
    expect(useItem(world, 0)).toBe(true);
    expect(p.build.items[0].count).toBe(1);
    useItem(world, 0);
    expect(p.build.items[0]).toBe(null);
  });
});

describe('消耗品の効果', () => {
  it('EMPグレネード：カーソルの位置の敵を2秒止める。範囲の外には効かない', () => {
    const world = makeWorld();
    const near = addEnemy(world, 'grunt', 200);
    const far = addEnemy(world, 'grunt', 200, 220);
    give(world, 'emp');
    useItem(world, 0, { x: near.x, y: near.y });
    expect(near.stopT).toBeCloseTo(2);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.stopT).toBeLessThanOrEqual(0);
    expect(far.hp).toBe(far.maxHp);
  });

  it('グレネードは届く距離に限りがある', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 700);
    give(world, 'emp');
    useItem(world, 0, { x: e.x, y: e.y });
    expect(e.hp).toBe(e.maxHp);
  });

  it('焼夷グレネード：ダメージと燃焼', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 200);
    give(world, 'incendiary');
    useItem(world, 0, { x: e.x, y: e.y });
    expect(e.maxHp - e.hp).toBe(35);
    expect(e.burnT).toBeGreaterThan(0);
  });

  it('冷却スプレー：自分の周りの敵を減速させ、自分の減速も消す', () => {
    const world = makeWorld();
    const p = world.player;
    const near = addEnemy(world, 'grunt', 120);
    const far = addEnemy(world, 'grunt', 500);
    p.slowT = 1;
    give(world, 'coolant');
    useItem(world, 0);
    expect(near.slowT).toBeGreaterThan(0);
    expect(far.slowT).toBeLessThanOrEqual(0);
    expect(p.slowT).toBe(0);
  });

  it('戦闘ドラッグ：10秒間だけ攻撃力+40%', () => {
    const world = makeWorld();
    give(world, 'drug');
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
    useItem(world, 0);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.4);
    run(world, 9);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.4);
    run(world, 1.2);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
  });

  it('煙幕：3秒間は無敵で、近くの敵の弾が消える', () => {
    const world = makeWorld();
    const p = world.player;
    give(world, 'smoke');
    useItem(world, 0);
    world.shots.push({ x: p.x + 60, y: p.y, vx: -100, vy: 0, r: 5, damage: 10, life: 3 });
    world.shots.push({ x: p.x + 500, y: p.y, vx: 0, vy: 0, r: 5, damage: 10, life: 3 });
    run(world, 0.1);
    expect(world.shots).toHaveLength(1);
    expect(hurtPlayer(world, 20)).toBe(false);
    run(world, 3.2);
    expect(hurtPlayer(world, 20)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - 20);
  });
});

describe('装備のドロップ率', () => {
  it('以前の約75%に下げた（ドローン12%、グラントとタレット24%）', () => {
    expect(DATA.enemies.get('drone').dropChance).toBe(0.12);
    expect(DATA.enemies.get('grunt').dropChance).toBe(0.24);
    expect(DATA.enemies.get('turret').dropChance).toBe(0.24);
  });
});
