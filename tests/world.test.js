import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { hurtPlayer } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

// 会心が出ない固定の乱数
function makeWorld() {
  const world = createWorld({ waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity; // テストでは波を自動で出さない
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, typeof input === 'function' ? input(t) : input);
}

function addEnemy(world, id, dx, dy = 0) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng);
  world.enemies.push(e);
  return e;
}

describe('移動とダッシュ', () => {
  it('1秒で移動速度ぶん進む', () => {
    const world = makeWorld();
    const x0 = world.player.x;
    run(world, 1, { ...idle, mx: 1 });
    expect(world.player.x - x0).toBeCloseTo(PLAYER.moveSpeed, 0);
  });

  it('ダッシュは約115px進み、クールダウン中は出せない', () => {
    const world = makeWorld();
    const x0 = world.player.x;
    run(world, 0.5, (t) => ({ ...idle, dashPressed: t === 0 }));
    expect(world.player.x - x0).toBeGreaterThan(PLAYER.dash.distance - 10);
    expect(world.player.x - x0).toBeLessThan(PLAYER.dash.distance + 10);

    const x1 = world.player.x;
    updateWorld(world, DT, { ...idle, dashPressed: true });
    run(world, 0.2);
    expect(world.player.x).toBe(x1);
  });

  it('ダッシュ中は無敵で、被弾後もしばらく無敵', () => {
    const world = makeWorld();
    updateWorld(world, DT, { ...idle, dashPressed: true });
    expect(hurtPlayer(world, 10)).toBe(false);
    run(world, PLAYER.dash.invincible + 0.05);
    expect(hurtPlayer(world, 10)).toBe(true);
    expect(world.player.hp).toBe(PLAYER.maxHp - 10);
    expect(hurtPlayer(world, 10)).toBe(false);
  });

  it('壁の外には出られない', () => {
    const world = makeWorld();
    run(world, 3, { ...idle, mx: -1, my: -1 });
    expect(world.player.x).toBe(world.bounds.left + world.player.r);
    expect(world.player.y).toBe(world.bounds.top + world.player.r);
  });
});

describe('大剣', () => {
  it('通常攻撃は3段で、順に 30・34・50 のダメージ', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 40);
    e.hp = e.maxHp = 1000;
    const seen = [];
    let last = e.hp;
    for (let t = 0; t < 3 && seen.length < 4; t += DT) {
      e.x = world.player.x + 40; // 吹き飛ばされても目の前に戻す
      e.y = world.player.y;
      updateWorld(world, DT, { ...idle, attackPressed: true });
      if (e.hp !== last) {
        seen.push(last - e.hp);
        last = e.hp;
      }
    }
    expect(seen).toEqual([30, 34, 50, 30]);
  });

  it('攻撃はカーソルの方向に出る', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'turret', 0, 60);
    e.cd = 99;
    run(world, 0.3, { ...idle, attackPressed: true, aimX: p.x, aimY: p.y + 200 });
    expect(e.hp).toBe(e.maxHp - 30);
  });

  it('クリックしてから押しっぱなしにすると、振り終わってから溜めが始まる', () => {
    const world = makeWorld();
    run(world, 0.3, (t) => ({ ...idle, attack: true, attackPressed: t === 0 }));
    expect(world.player.attack).not.toBe(null);
    expect(world.player.charge).toBe(null);
    run(world, 0.5, { ...idle, attack: true });
    expect(world.player.attack).toBe(null);
    expect(world.player.charge).not.toBe(null);
  });

  it('背後の敵には当たらない', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'turret', -70);
    e.cd = 99;
    run(world, 0.3, { ...idle, attackPressed: true });
    expect(e.hp).toBe(e.maxHp);
  });

  it('溜め斬りは最大まで溜めると威力3倍で、クールダウンに入る', () => {
    const world = makeWorld();
    const special = world.player.weapon.special;
    const e = addEnemy(world, 'grunt', 60);
    e.hp = e.maxHp = 1000;
    e.cd = 99;
    e.x += 20; // 殴られない距離
    run(world, 1.3, () => {
      e.x = world.player.x + 80;
      return { ...idle, attack: true };
    });
    expect(world.player.charge.stage).toBe(2);
    updateWorld(world, DT, idle);
    expect(e.maxHp - e.hp).toBe(special.damage * 3);
    expect(world.player.specialCd).toBeGreaterThan(special.cooldown - 0.1);
  });

  it('溜めが足りないうちに離すと不発で、クールダウンにも入らない', () => {
    const world = makeWorld();
    run(world, 0.2, { ...idle, attack: true });
    updateWorld(world, DT, idle);
    expect(world.player.attack).toBe(null);
    expect(world.player.specialCd).toBeLessThanOrEqual(0);
  });
});

describe('敵と部屋の進行', () => {
  it('ドローンは体当たりでダメージを与える', () => {
    const world = makeWorld();
    addEnemy(world, 'drone', 60);
    run(world, 0.7);
    expect(world.player.hp).toBe(PLAYER.maxHp - DATA.enemies.get('drone').damage);
  });

  it('グラントは構えてから殴る。構えの間に離れれば当たらない', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 40);
    e.cd = 0;
    run(world, 0.2);
    expect(e.state).toBe('windup');
    expect(world.player.hp).toBe(PLAYER.maxHp);
    run(world, 0.2, { ...idle, mx: -1 });
    run(world, 0.3, (t) => ({ ...idle, mx: -1, dashPressed: t === 0 }));
    expect(world.player.hp).toBe(PLAYER.maxHp);
  });

  it('タレットは狙ってから弾を撃ち、当たるとダメージ', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'turret', 300);
    e.cd = 0;
    run(world, 0.6);
    expect(world.shots).toHaveLength(1);
    run(world, 2);
    expect(world.player.hp).toBe(PLAYER.maxHp - DATA.enemies.get('turret').damage);
  });

  it('HPが0になると死亡して止まる', () => {
    const world = makeWorld();
    world.player.hp = 5;
    addEnemy(world, 'drone', 30);
    run(world, 1);
    expect(world.player.hp).toBe(0);
    expect(world.mode).toBe('dead');
  });

  it('波を順に出し、全部倒すとクリアになる', () => {
    const world = createWorld({ waves: [{ drone: 2 }, { grunt: 1 }], rng: () => 0.5 });
    run(world, 0.6);
    expect(world.wave).toBe(0);
    expect(world.enemies).toHaveLength(2);
    world.enemies.forEach((e) => { e.dead = true; });
    run(world, 1.2);
    expect(world.wave).toBe(1);
    expect(world.enemies).toHaveLength(1);
    expect(world.mode).toBe('play');
    world.enemies.forEach((e) => { e.dead = true; });
    run(world, 0.1);
    expect(world.mode).toBe('clear');
  });
});
