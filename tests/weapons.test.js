import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { weaponUnlocks } from '../src/data/upgrades.js';
import { recalcStats } from '../src/game/build.js';
import { hurtPlayer } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, specialPressed: false, dashPressed: false };

function makeWorld(weaponId, implants = []) {
  const world = createWorld({ weaponId, waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, typeof input === 'function' ? input(t) : input);
}

function addEnemy(world, id, dx, dy = 0) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng);
  e.cd = 99;
  e.hp = e.maxHp = 100000;
  world.enemies.push(e);
  return e;
}

describe('武器の定義', () => {
  it('3種類あり、どれも隠れ家の武器ラックに並ぶ', () => {
    expect(DATA.weapons.ids()).toEqual(['greatsword', 'sword', 'gun']);
    expect(weaponUnlocks.map((w) => w.weapon)).toEqual(DATA.weapons.ids());
    for (const w of DATA.weapons.all()) expect(w.special.hint, w.id).toBeTruthy();
  });
});

describe('片手剣', () => {
  it('速い4段コンボで、4段目だけ威力1.5倍', () => {
    const world = makeWorld('sword');
    const e = addEnemy(world, 'grunt', 40);
    const seen = [];
    let last = e.hp;
    for (let t = 0; t < 3 && seen.length < 5; t += DT) {
      e.x = world.player.x + 40;
      e.y = world.player.y;
      updateWorld(world, DT, { ...idle, attackPressed: true });
      if (e.hp !== last) {
        seen.push(last - e.hp);
        last = e.hp;
      }
    }
    expect(seen).toEqual([12, 12, 12, 18, 12]);
  });

  it('大剣より手数が多い（同じ時間で多く振れる）', () => {
    const swings = ['sword', 'greatsword'].map((id) => {
      const world = makeWorld(id);
      let n = 0;
      let prev = null;
      for (let t = 0; t < 3; t += DT) {
        updateWorld(world, DT, { ...idle, attackPressed: true });
        if (world.player.attack && world.player.attack !== prev) n++;
        prev = world.player.attack;
      }
      return n;
    });
    expect(swings[0]).toBeGreaterThan(swings[1] * 1.5);
  });

  it('長押ししても溜めにならない', () => {
    const world = makeWorld('sword');
    run(world, 1.5, { ...idle, attack: true });
    expect(world.player.charge).toBe(null);
  });

  it('ジャストガード：右クリックで少しの間だけ構え、その間に攻撃を受けると無効化して反撃する', () => {
    const world = makeWorld('sword');
    const p = world.player;
    const special = p.weapon.special;
    const near = addEnemy(world, 'grunt', 60);
    const far = addEnemy(world, 'grunt', 300);
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.guard).not.toBe(null);
    expect(p.specialCd).toBeCloseTo(special.cooldown, 1);

    expect(hurtPlayer(world, 30)).toBe(true); // 受けた（が、無効化された）
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(p.guard).toBe(null);
    expect(near.maxHp - near.hp).toBe(special.counter.damage);
    expect(far.hp).toBe(far.maxHp);
    // 成功するとクールダウンが短くなり、少しの間は無敵
    expect(p.specialCd).toBeLessThanOrEqual(special.successCooldown);
    expect(hurtPlayer(world, 30)).toBe(false);
  });

  it('構えが終わってから攻撃を受けると、普通にダメージを受ける。クールダウン中は構えられない', () => {
    const world = makeWorld('sword');
    const p = world.player;
    updateWorld(world, DT, { ...idle, specialPressed: true });
    run(world, p.weapon.special.window + 0.05);
    expect(p.guard).toBe(null);
    hurtPlayer(world, 30);
    expect(p.hp).toBe(PLAYER.maxHp - 30);

    p.inv = 0;
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.guard).toBe(null); // まだクールダウン中
    run(world, p.weapon.special.cooldown);
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.guard).not.toBe(null);
  });

  it('敵の弾もジャストガードで消せる', () => {
    const world = makeWorld('sword');
    const p = world.player;
    world.shots.push({ x: p.x + 30, y: p.y, vx: -300, vy: 0, r: 5, damage: 10, life: 3 });
    updateWorld(world, DT, { ...idle, specialPressed: true });
    run(world, 0.2);
    expect(world.shots).toHaveLength(0);
    expect(p.hp).toBe(PLAYER.maxHp);
  });
});

describe('銃', () => {
  it('押している間、カーソルの方向に撃ち続ける。弾は当たるとダメージを与えて消える', () => {
    const world = makeWorld('gun');
    const p = world.player;
    const shot = p.weapon.shot;
    const e = addEnemy(world, 'grunt', 300);
    run(world, 1, { ...idle, attack: true, aimX: e.x, aimY: e.y });
    const fired = Math.round((e.maxHp - e.hp) / shot.damage);
    expect(fired).toBeGreaterThanOrEqual(2);
    expect(fired).toBeLessThanOrEqual(Math.ceil(1 / shot.interval));
    run(world, 1);
    expect(world.playerShots).toHaveLength(0);
  });

  it('遠くの敵に当たる（近接の届かない距離）。背後には飛ばない', () => {
    const world = makeWorld('gun');
    const front = addEnemy(world, 'turret', 400);
    const back = addEnemy(world, 'turret', -60);
    run(world, 1.5, { ...idle, attack: true, aimX: front.x, aimY: front.y });
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(back.hp).toBe(back.maxHp);
  });

  it('弾は壁で消える', () => {
    const world = makeWorld('gun');
    updateWorld(world, DT, { ...idle, attack: true, aimX: 0, aimY: world.player.y });
    expect(world.playerShots).toHaveLength(1);
    run(world, 1);
    expect(world.playerShots).toHaveLength(0);
  });

  it('拡散射撃：右クリックで5方向に同時に撃つ。クールダウン制', () => {
    const world = makeWorld('gun');
    const p = world.player;
    const special = p.weapon.special;
    updateWorld(world, DT, { ...idle, specialPressed: true, aimX: p.x + 100, aimY: p.y });
    expect(world.playerShots).toHaveLength(special.count);
    const angles = world.playerShots.map((s) => (Math.atan2(s.vy, s.vx) * 180) / Math.PI);
    [-25, -12.5, 0, 12.5, 25].forEach((want, i) => expect(angles[i]).toBeCloseTo(want));
    expect(p.specialCd).toBeCloseTo(special.cooldown, 1);
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(world.playerShots).toHaveLength(special.count);
  });

  it('拡張ブレード：弾が1体貫通する', () => {
    for (const [implants, hitBoth] of [[[], false], [['blade'], true]]) {
      const world = makeWorld('gun', implants);
      const a = addEnemy(world, 'grunt', 100);
      const b = addEnemy(world, 'grunt', 180);
      updateWorld(world, DT, { ...idle, attack: true, aimX: a.x, aimY: a.y });
      a.stopT = b.stopT = 99;
      run(world, 1);
      expect(a.hp).toBeLessThan(a.maxHp);
      expect(b.hp < b.maxHp).toBe(hitBoth);
    }
  });

  it('広角ブレード：拡散射撃の広がりが大きくなる', () => {
    const world = makeWorld('gun', ['wideblade']);
    const p = world.player;
    updateWorld(world, DT, { ...idle, specialPressed: true, aimX: p.x + 100, aimY: p.y });
    const angles = world.playerShots.map((s) => (Math.atan2(s.vy, s.vx) * 180) / Math.PI);
    expect(Math.max(...angles) - Math.min(...angles)).toBeCloseTo(p.weapon.special.angle * 1.5);
  });

  it('攻撃速度が上がると、撃つ間隔が短くなる', () => {
    const counts = [0, 0.5].map((bonus) => {
      const world = makeWorld('gun');
      world.player.stats.attackSpeed = bonus;
      let n = 0;
      for (let t = 0; t < 3; t += DT) {
        const before = world.playerShots.length;
        updateWorld(world, DT, { ...idle, attack: true, aimX: 900, aimY: world.player.y });
        if (world.playerShots.length > before) n++;
      }
      return n;
    });
    expect(counts[1]).toBeGreaterThan(counts[0]);
  });
});

describe('大剣（変わっていないこと）', () => {
  it('右クリックでは何も起きない。溜め斬りは左クリック長押しのまま', () => {
    const world = makeWorld('greatsword');
    const p = world.player;
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.attack).toBe(null);
    expect(p.charge).toBe(null);
    expect(p.guard).toBe(null);
    run(world, 0.5, { ...idle, attack: true });
    expect(p.charge.stage).toBeGreaterThanOrEqual(0);
  });
});
