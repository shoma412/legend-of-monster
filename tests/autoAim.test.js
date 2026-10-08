import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { autoFacing, autoTarget, flashWarning } from '../src/game/autoAim.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { CONTROL_MODES, createSettings, normalizeSettings } from '../src/logic/settings.js';

// 操作方法「オート」（docs/詳細仕様.md「26. 操作方法（マニュアル／オート）」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('dark');

function makeWorld({ dark = false, waves = [{}] } = {}) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment: dark ? env : null, lamps: [] };
  const world = createWorld({ room, rng: () => 0.5, weaponId: 'sword' });
  world.waveTimer = Infinity;
  world.player.inv = Infinity;
  return world;
}

function addEnemy(world, id, x, y) {
  const e = createEnemy(DATA.enemies.get(id), x, y, 0, world.rng);
  e.cd = 99;
  world.enemies.push(e);
  return e;
}

const facing = (world) => ({ x: world.player.fx, y: world.player.fy });

describe('設定：操作方法', () => {
  it('最初はマニュアル。オートに変えられる。知らない値は、マニュアルに戻る', () => {
    expect(createSettings().controls).toBe('manual');
    expect(CONTROL_MODES.map((c) => c.id)).toEqual(['manual', 'auto']);
    expect(normalizeSettings({ controls: 'auto' }).controls).toBe('auto');
    expect(normalizeSettings({ controls: 'x' }).controls).toBe('manual');
    expect(normalizeSettings({}).controls).toBe('manual');
  });
});

describe('マニュアル：今までどおり、カーソルのほうを向く', () => {
  it('近くに敵がいても、カーソルの向き', () => {
    const world = makeWorld();
    const p = world.player;
    addEnemy(world, 'grunt', p.x + 100, p.y);
    updateWorld(world, DT, { ...idle, aimX: p.x, aimY: p.y - 200 });
    expect(facing(world).y).toBeCloseTo(-1);
    expect(facing(world).x).toBeCloseTo(0);
  });
});

describe('オート：動いている向き。敵がいるときは、いちばん近い敵', () => {
  const auto = { ...idle, auto: true };

  it('敵がいなければ、動いている向きを向く。止まると、最後の向きのまま。カーソルは関係ない', () => {
    const world = makeWorld();
    const p = world.player;
    updateWorld(world, DT, { ...auto, mx: 0, my: 1, aimX: p.x + 300, aimY: p.y });
    expect(facing(world)).toEqual({ x: 0, y: 1 });
    updateWorld(world, DT, { ...auto, mx: -1, my: -1 });
    expect(facing(world).x).toBeCloseTo(-Math.SQRT1_2);
    expect(facing(world).y).toBeCloseTo(-Math.SQRT1_2);
    updateWorld(world, DT, { ...auto, aimX: p.x + 300, aimY: p.y });
    expect(facing(world).x).toBeCloseTo(-Math.SQRT1_2);
  });

  it('敵がいると、いちばん近い敵のほうを向く（動いている向きより優先）', () => {
    const world = makeWorld();
    const p = world.player;
    addEnemy(world, 'grunt', p.x + 300, p.y).def = { ...DATA.enemies.get('grunt'), speed: 0 };
    const near = addEnemy(world, 'grunt', p.x, p.y + 120);
    near.def = { ...near.def, speed: 0 };
    expect(autoTarget(world)).toBe(near);
    updateWorld(world, DT, { ...auto, mx: -1 });
    expect(facing(world).y).toBeGreaterThan(0.95);
  });

  it('出現の予告中の敵と、消えている明滅機は、相手にしない', () => {
    const world = makeWorld();
    const p = world.player;
    const spawning = addEnemy(world, 'grunt', p.x + 50, p.y);
    spawning.spawnT = 1;
    const hidden = addEnemy(world, 'blinker', p.x + 60, p.y);
    hidden.unseen = true;
    const far = addEnemy(world, 'grunt', p.x - 300, p.y);
    expect(autoTarget(world)).toBe(far);
    hidden.unseen = false;
    expect(autoTarget(world)).toBe(hidden);
  });

  it('ボスがいるときは、近くの雑魚よりボスを優先する', () => {
    const world = makeWorld({ waves: [{ boss: 'boltboar' }] });
    world.waveTimer = 0;
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    const p = world.player;
    world.boss.idleT = Infinity;
    addEnemy(world, 'grunt', p.x + 30, p.y);
    expect(autoTarget(world)).toBe(world.boss);
  });

  it('敵がいなくて、壊せるもの（柵・ひび割れた壁）があれば、それを向く。敵がいる間は、敵が先', () => {
    const world = makeWorld();
    const p = world.player;
    const post = addEnemy(world, 'fencepost', p.x + 60, p.y);
    expect(autoTarget(world)).toBe(post);
    const grunt = addEnemy(world, 'grunt', p.x - 400, p.y);
    expect(autoTarget(world)).toBe(grunt);
  });

  it('暗闇で、見える円の外にいる敵も、相手にする', () => {
    const world = makeWorld({ dark: true });
    const p = world.player;
    const far = addEnemy(world, 'grunt', p.x + 600, p.y);
    expect(autoTarget(world)).toBe(far);
  });

  it('振っている間は、向きが変わらない', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'grunt', p.x + 100, p.y);
    e.def = { ...e.def, speed: 0 };
    e.hp = e.maxHp = 100000;
    updateWorld(world, DT, { ...auto, attack: true, attackPressed: true });
    updateWorld(world, DT, { ...auto });
    expect(p.attack).toBeTruthy();
    e.x = p.x - 100;
    updateWorld(world, DT, { ...auto });
    expect(facing(world).x).toBeGreaterThan(0.9);
  });

  it('閃光の予告が出ている間は、動いている向きを向く（離れる方向に動けば、目を背けたことになる）', () => {
    const world = makeWorld({ dark: true });
    const p = world.player;
    const e = addEnemy(world, 'flasher', p.x + 100, p.y);
    e.def = { ...e.def, speed: 0 };
    expect(flashWarning(world)).toBe(false);
    expect(autoFacing(world, -1, 0).x).toBeGreaterThan(0.9); // ふだんは、敵のほう
    e.state = 'windup';
    e.t = 0.5;
    expect(flashWarning(world)).toBe(true);
    expect(autoFacing(world, -1, 0)).toEqual({ x: -1, y: 0 });
    // そのまま離れる向きに動いていれば、目くらみにならない
    p.inv = 0;
    for (let t = 0; t < 0.7; t += DT) updateWorld(world, DT, { ...auto, mx: -1 });
    expect(e.state).toBe('chase');
    expect(p.blindT > 0).toBe(false);
  });

  it('ブレーカーの「残像」の間は、ボスを優先しない（いちばん近いものを向く）', () => {
    const world = makeWorld({ dark: true, waves: [{ boss: 'breaker' }] });
    world.waveTimer = 0;
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    const b = world.boss;
    const p = world.player;
    b.next = 'mirage';
    b.idleT = 0;
    for (let t = 0; t < 4 && b.act?.phase !== 'aim'; t += DT) updateWorld(world, DT, idle);
    expect(b.act.phase).toBe('aim');
    const decoy = world.enemies.find((e) => e.def.decoy);
    decoy.x = p.x + 40;
    decoy.y = p.y;
    b.x = p.x - 300;
    expect(autoTarget(world)).toBe(decoy);
  });
});
