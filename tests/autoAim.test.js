import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { autoFacing, flashWarning, lockCandidates, updateLock } from '../src/game/autoAim.js';
import { hitEnemy } from '../src/game/combat.js';
import { addLight, powerOn } from '../src/game/darkness.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { CONTROL_MODES, createSettings, normalizeSettings } from '../src/logic/settings.js';

// 操作方法「オート」（docs/詳細仕様.md「26. 操作方法（マニュアル／オート）」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const auto = { ...idle, auto: true };
const env = DATA.environments.get('dark');

function makeWorld({ dark = false, waves = [{}] } = {}) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment: dark ? env : null, lamps: [] };
  const world = createWorld({ room, rng: () => 0.5, weaponId: 'sword' });
  world.waveTimer = Infinity;
  world.player.inv = Infinity;
  // 部屋の真ん中に立たせる（まわりに敵を置いても、壁に押し戻されないように）
  world.player.x = 480;
  world.player.y = 290;
  return world;
}

// 動かない敵を置く
function addEnemy(world, id, x, y) {
  const e = createEnemy(DATA.enemies.get(id), x, y, 0, world.rng);
  e.def = { ...e.def, speed: 0 };
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
  it('近くに敵がいても、カーソルの向き。ロックオンは付かず、R キーも効かない', () => {
    const world = makeWorld();
    const p = world.player;
    addEnemy(world, 'grunt', p.x + 100, p.y);
    updateWorld(world, DT, { ...idle, aimX: p.x, aimY: p.y - 200, lockPressed: true });
    expect(facing(world).y).toBeCloseTo(-1);
    expect(facing(world).x).toBeCloseTo(0);
    expect(p.lock ?? null).toBeNull();
  });

  it('オートからマニュアルに戻すと、ロックオンは外れる', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'grunt', p.x + 100, p.y);
    updateWorld(world, DT, auto);
    expect(p.lock).toBe(e);
    updateWorld(world, DT, idle);
    expect(p.lock).toBeNull();
  });
});

describe('オート：ロックオンした敵を向く', () => {
  it('敵がいなければ、動いている向きを向く。止まると、最後の向きのまま。カーソルは関係ない', () => {
    const world = makeWorld();
    const p = world.player;
    updateWorld(world, DT, { ...auto, mx: 0, my: 1, aimX: p.x + 300, aimY: p.y });
    expect(facing(world)).toEqual({ x: 0, y: 1 });
    updateWorld(world, DT, { ...auto, mx: -1, my: -1 });
    expect(facing(world).x).toBeCloseTo(-Math.SQRT1_2);
    updateWorld(world, DT, { ...auto, aimX: p.x + 300, aimY: p.y });
    expect(facing(world).x).toBeCloseTo(-Math.SQRT1_2);
    expect(p.lock).toBeNull();
  });

  it('最初は、いちばん近い敵をロックオンして、そのほうを向く（動いている向きより優先）', () => {
    const world = makeWorld();
    const p = world.player;
    addEnemy(world, 'grunt', p.x + 300, p.y);
    const near = addEnemy(world, 'grunt', p.x, p.y + 120);
    updateWorld(world, DT, { ...auto, mx: -1 });
    expect(p.lock).toBe(near);
    expect(facing(world).y).toBeGreaterThan(0.95);
  });

  it('ロックオンは、もっと近い敵が出ても、そのまま', () => {
    const world = makeWorld();
    const p = world.player;
    const first = addEnemy(world, 'grunt', p.x + 200, p.y);
    updateWorld(world, DT, auto);
    expect(p.lock).toBe(first);
    addEnemy(world, 'grunt', p.x, p.y + 40);
    for (let i = 0; i < 30; i++) updateWorld(world, DT, auto);
    expect(p.lock).toBe(first);
    expect(facing(world).x).toBeGreaterThan(0.95);
  });

  it('R キー：次に近い敵へ切り替わる。いちばん遠い敵の次は、いちばん近い敵に戻る', () => {
    const world = makeWorld();
    const p = world.player;
    const a = addEnemy(world, 'grunt', p.x + 60, p.y);
    const b = addEnemy(world, 'grunt', p.x, p.y + 140);
    const c = addEnemy(world, 'grunt', p.x - 260, p.y);
    updateWorld(world, DT, auto);
    expect(p.lock).toBe(a);
    updateWorld(world, DT, { ...auto, lockPressed: true });
    expect(p.lock).toBe(b);
    expect(facing(world).y).toBeGreaterThan(0.95);
    updateWorld(world, DT, { ...auto, lockPressed: true });
    expect(p.lock).toBe(c);
    updateWorld(world, DT, { ...auto, lockPressed: true });
    expect(p.lock).toBe(a);
    // 敵が1体だけなら、押しても変わらない
    b.dead = true;
    c.dead = true;
    updateWorld(world, DT, { ...auto, lockPressed: true });
    expect(p.lock).toBe(a);
  });

  it('ロックオンした敵を倒すと、そのとき、いちばん近い敵に移る', () => {
    const world = makeWorld();
    const p = world.player;
    const a = addEnemy(world, 'grunt', p.x + 60, p.y);
    const far = addEnemy(world, 'grunt', p.x - 300, p.y);
    const mid = addEnemy(world, 'grunt', p.x, p.y + 150);
    updateWorld(world, DT, auto);
    expect(p.lock).toBe(a);
    hitEnemy(world, a, 99999, 1, 0, 0);
    world.choice = null;
    world.pendingLevelUps = 0;
    updateWorld(world, DT, auto);
    expect(p.lock).toBe(mid);
    expect(far.dead).toBe(false);
  });

  it('出現の予告中の敵と、消えている明滅機は、ロックオンできない。消えたら、外れる', () => {
    const world = makeWorld();
    const p = world.player;
    const spawning = addEnemy(world, 'grunt', p.x + 50, p.y);
    spawning.spawnT = 1;
    const blinker = addEnemy(world, 'blinker', p.x + 60, p.y);
    blinker.unseen = true;
    const far = addEnemy(world, 'grunt', p.x - 300, p.y);
    expect(updateLock(world)).toBe(far);
    blinker.unseen = false;
    expect(updateLock(world, true)).toBe(blinker);
    blinker.unseen = true;
    expect(updateLock(world)).toBe(far);
  });

  it('ボスがいるときは、最初はボスをロックオンする。R で、雑魚に切り替えられる', () => {
    const world = makeWorld({ waves: [{ boss: 'boltboar' }] });
    world.waveTimer = 0;
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    const p = world.player;
    world.boss.idleT = Infinity;
    const grunt = addEnemy(world, 'grunt', p.x + 30, p.y);
    expect(updateLock(world)).toBe(world.boss);
    expect(updateLock(world, true)).toBe(grunt);
    expect(updateLock(world)).toBe(grunt);
  });

  it('敵がいなくて、壊せるもの（柵・ひび割れた壁）があれば、それをロックオンする。敵が出たら、敵に移る', () => {
    const world = makeWorld();
    const p = world.player;
    const post = addEnemy(world, 'fencepost', p.x + 60, p.y);
    expect(updateLock(world)).toBe(post);
    const grunt = addEnemy(world, 'grunt', p.x - 400, p.y);
    expect(updateLock(world)).toBe(grunt);
    // 敵がいる間は、R を押しても、壊せるものには切り替わらない
    expect(updateLock(world, true)).toBe(grunt);
    expect(lockCandidates(world)).toEqual([grunt]);
  });

  it('振っている間は、向きが変わらない。R の切り替えは受け付けて、振り終わってから向く', () => {
    const world = makeWorld();
    const p = world.player;
    const a = addEnemy(world, 'grunt', p.x + 100, p.y);
    a.hp = a.maxHp = 100000;
    const b = addEnemy(world, 'grunt', p.x - 150, p.y);
    b.hp = b.maxHp = 100000;
    updateWorld(world, DT, { ...auto, attack: true, attackPressed: true });
    updateWorld(world, DT, auto);
    expect(p.attack).toBeTruthy();
    updateWorld(world, DT, { ...auto, lockPressed: true });
    expect(p.lock).toBe(b);
    expect(facing(world).x).toBeGreaterThan(0.9);
    for (let i = 0; i < 120 && p.attack; i++) updateWorld(world, DT, auto);
    updateWorld(world, DT, auto);
    expect(facing(world).x).toBeLessThan(-0.9);
  });
});

describe('オート：暗闇では、見えている敵だけロックオンできる', () => {
  it('見える円の外の敵は、ロックオンできない。円の中に入ると、できる', () => {
    const world = makeWorld({ dark: true });
    const p = world.player;
    const far = addEnemy(world, 'grunt', p.x + 600, p.y);
    expect(updateLock(world)).toBeNull();
    expect(autoFacing(world, 0, 1)).toEqual({ x: 0, y: 1 }); // 敵がいないのと同じ：動いている向き
    far.x = p.x + 120;
    expect(updateLock(world)).toBe(far);
  });

  it('灯りに照らされている敵は、遠くてもロックオンできる。暗い所へ出たら、外れる', () => {
    const world = makeWorld({ dark: true });
    const p = world.player;
    const far = addEnemy(world, 'grunt', p.x + 600, p.y);
    addLight(world, far.x, far.y, 100, 1);
    expect(updateLock(world)).toBe(far);
    world.lights = [];
    expect(updateLock(world)).toBeNull();
  });

  it('R で回るのも、見えている敵だけ', () => {
    const world = makeWorld({ dark: true });
    const p = world.player;
    const a = addEnemy(world, 'grunt', p.x + 60, p.y);
    const b = addEnemy(world, 'grunt', p.x, p.y + 120);
    addEnemy(world, 'grunt', p.x + 700, p.y);
    expect(updateLock(world)).toBe(a);
    expect(updateLock(world, true)).toBe(b);
    expect(updateLock(world, true)).toBe(a);
  });

  it('明るいマップでは、遠くの敵もロックオンできる', () => {
    const world = makeWorld();
    const far = addEnemy(world, 'grunt', world.player.x + 600, world.player.y);
    expect(updateLock(world)).toBe(far);
  });
});

describe('オート：閃光と残像', () => {
  it('閃光の予告が出ている間は、動いている向きを向く（ロックオンは外れない）。離れる向きに動けば、目くらみにならない', () => {
    const world = makeWorld({ dark: true });
    const p = world.player;
    const e = addEnemy(world, 'flasher', p.x + 100, p.y);
    expect(flashWarning(world)).toBe(false);
    expect(autoFacing(world, -1, 0).x).toBeGreaterThan(0.9); // ふだんは、ロックオンした敵のほう
    e.state = 'windup';
    e.t = 0.5;
    expect(flashWarning(world)).toBe(true);
    expect(autoFacing(world, -1, 0)).toEqual({ x: -1, y: 0 });
    expect(p.lock).toBe(e);
    p.inv = 0;
    for (let t = 0; t < 0.7; t += DT) updateWorld(world, DT, { ...auto, mx: -1 });
    expect(e.state).toBe('chase');
    expect(p.blindT > 0).toBe(false);
  });

  it('ブレーカーの「残像」が並んだ瞬間、ロックオンは、いちばん近いものに付け直される（本物を向いたままにならない）', () => {
    const world = makeWorld({ dark: true, waves: [{ boss: 'breaker' }] });
    world.waveTimer = 0;
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    const b = world.boss;
    const p = world.player;
    for (const lamp of world.lamps) lamp.on = 0;
    // ボスの近くにいて、ボスをロックオンしている
    b.x = p.x + 120;
    b.y = p.y;
    b.idleT = Infinity;
    expect(updateLock(world)).toBe(b);
    powerOn(world, 99); // 部屋全体を明るくしておく（暗いままだと、離れた所に並ぶ残像は、ロックオンできない）
    b.next = 'mirage';
    b.idleT = 0;
    for (let t = 0; t < 4 && b.act?.phase !== 'aim'; t += DT) updateWorld(world, DT, auto);
    expect(b.act.phase).toBe('aim');
    updateWorld(world, DT, auto);
    // 並んだ直後：みんな同じ距離なので、ロックオンは「いちばん近いもの」。本物とは限らない
    const all = [b, ...world.enemies.filter((e) => e.def.decoy)];
    const nearest = lockCandidates(world)[0];
    expect(all).toContain(p.lock);
    expect(p.lock).toBe(nearest);
  });
});
