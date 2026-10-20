import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, enterRoom, skipToBoss } from '../src/game/run.js';
import { placeHotWalls, touchingHotWall } from '../src/game/wind.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { roomBounds } from '../src/logic/geometry.js';
import { ROOM, SCREEN } from '../src/data/balance.js';
import { drawHotWalls } from '../src/render/wind.js';

// マップ6「送風区」の、換気扇の壁（docs/詳細仕様.md「30. マップ6「送風区」と、環境「強風」」の「換気扇の壁」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('gale');
const bounds = roomBounds(SCREEN, ROOM.wall, ROOM.wallTop);

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wallWorld(hotWalls) {
  const room = { type: 'combat', waves: [{}], objects: [], doors: [], clearCredits: 0, environment: env, screens: [], hotWalls };
  const world = createWorld({ room, rng: () => 0.99, weaponId: 'sword' });
  world.waveTimer = Infinity;
  world.countdown = 0;
  return world;
}

describe('換気扇の壁：置き方', () => {
  it('強風のマップの環境に、数・長さ・ダメージが決まっている', () => {
    expect(env.hotWalls).toEqual({ count: { min: 3, max: 5 }, length: { min: 120, max: 200 }, damage: 28, depth: 10 });
  });

  it('4つの壁のどれにも、置かれる（200通りの置き方の中に、右の壁もある）', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 200; seed++) for (const w of placeHotWalls(env, bounds, seeded(seed))) seen.add(w.side);
    expect([...seen].sort()).toEqual(['bottom', 'left', 'right', 'top']);
  });

  it('3〜5か所。上・下・左・右の壁（右にも置く。2026-10-20）。長さは決まった範囲で、同じ壁の上で重ならず、角から離れている', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const walls = placeHotWalls(env, bounds, seeded(seed));
      expect(walls.length, seed).toBeGreaterThanOrEqual(3);
      expect(walls.length, seed).toBeLessThanOrEqual(5);
      for (const w of walls) {
        expect(['top', 'bottom', 'left', 'right']).toContain(w.side);
        expect(w.to - w.from).toBeGreaterThanOrEqual(env.hotWalls.length.min - 1);
        expect(w.to - w.from).toBeLessThanOrEqual(env.hotWalls.length.max + 1);
        const [lo, hi] = w.side === 'left' || w.side === 'right' ? [bounds.top, bounds.bottom] : [bounds.left, bounds.right];
        expect(w.from).toBeGreaterThanOrEqual(lo + 49);
        expect(w.to).toBeLessThanOrEqual(hi - 49);
      }
      for (const a of walls) {
        for (const b of walls) if (a !== b && a.side === b.side) expect(a.from < b.to + 40 && a.to > b.from - 40, `seed ${seed}`).toBe(false);
      }
    }
  });

  it('マップ6の、戦闘のある部屋（ボス部屋も）に置かれる。ほかのマップには置かれない', () => {
    for (const mapId of ['map6']) {
      for (let areaIndex = 0; areaIndex < 2; areaIndex++) {
        const run = createRun({ weaponId: 'sword', rng: seeded(7 + areaIndex), mapId });
        run.areaIndex = areaIndex;
        // 最初の戦闘の部屋
        const first = enterRoom(run);
        expect(first.room.waves.length).toBeGreaterThan(0);
        expect(first.room.hotWalls.length).toBeGreaterThanOrEqual(3);
        expect(first.hotWalls).toEqual(first.room.hotWalls);
        // ボス部屋
        skipToBoss(run, first);
        const boss = enterRoom(run);
        expect(boss.room.waves[0].boss).toBeTruthy();
        expect(boss.room.hotWalls.length).toBeGreaterThanOrEqual(3);
      }
    }
    // 風の吹かない（壁のない）マップ
    const other = createRun({ weaponId: 'sword', rng: seeded(7), mapId: 'map1' });
    expect(enterRoom(other).room.hotWalls ?? []).toHaveLength(0);

  });
});

describe('換気扇の壁：ダメージ', () => {
  const top = { side: 'top', from: 300, to: 460 };

  it('触れていると、damage のダメージ（弾き返しはなし）。壁から離れた場所や、壁の範囲の外では当たらない', () => {
    const world = wallWorld([top]);
    const p = world.player;
    p.inv = 0;
    p.x = 380;
    p.y = bounds.top + p.r;
    expect(touchingHotWall(world, top)).toBe(true);
    const before = p.hp;
    updateWorld(world, DT, idle);
    expect(before - p.hp).toBeGreaterThan(0);
    expect(p.y).toBeCloseTo(bounds.top + p.r, 1); // 弾き返されない
    // 範囲の外
    const w2 = wallWorld([top]);
    w2.player.inv = 0;
    w2.player.x = 700;
    w2.player.y = bounds.top + w2.player.r;
    const hp2 = w2.player.hp;
    updateWorld(w2, DT, idle);
    expect(w2.player.hp).toBe(hp2);
    // 壁から離れている
    const w3 = wallWorld([top]);
    w3.player.inv = 0;
    w3.player.x = 380;
    w3.player.y = bounds.top + 80;
    const hp3 = w3.player.hp;
    updateWorld(w3, DT, idle);
    expect(w3.player.hp).toBe(hp3);
  });

  it('下の壁・左の壁にも当たる', () => {
    const bottom = { side: 'bottom', from: 300, to: 460 };
    const left = { side: 'left', from: 200, to: 360 };
    for (const [wall, x, y] of [[bottom, 380, bounds.bottom - 12], [left, bounds.left + 12, 280]]) {
      const world = wallWorld([wall]);
      world.player.inv = 0;
      world.player.x = x;
      world.player.y = y;
      const before = world.player.hp;
      updateWorld(world, DT, idle);
      expect(before - world.player.hp, wall.side).toBeGreaterThan(0);
    }
  });

  it('張り付いていると、被弾後の無敵が切れるたびに当たり続ける。ダッシュ中（無敵）は当たらない', () => {
    const world = wallWorld([top]);
    const p = world.player;
    p.inv = 0;
    p.x = 380;
    p.y = bounds.top + p.r;
    for (let t = 0; t < 2.5; t += DT) {
      p.x = 380;
      p.y = bounds.top + p.r;
      updateWorld(world, DT, idle);
    }
    const hits = Math.round((p.stats.maxHp - p.hp) / 1);
    expect(hits).toBeGreaterThan(0);
    const dashing = wallWorld([top]);
    dashing.player.inv = Infinity;
    dashing.player.x = 380;
    dashing.player.y = bounds.top + dashing.player.r;
    const full = dashing.player.hp;
    run(dashing, 1);
    expect(dashing.player.hp).toBe(full);
  });

  it('敵には当たらない', () => {
    const world = wallWorld([top]);
    const e = createEnemy(DATA.enemies.get('grunt'), 380, bounds.top + 8, 0, world.rng);
    e.cd = 99;
    e.hp = e.maxHp = 1000;
    e.def = { ...e.def, speed: 0 };
    world.enemies.push(e);
    run(world, 1);
    expect(e.hp).toBe(1000);
  });

  it('カウントダウンの間と、部屋をクリアしたあとは、当たらない', () => {
    const counting = wallWorld([top]);
    counting.countdown = 5;
    counting.player.inv = 0;
    counting.player.x = 380;
    counting.player.y = bounds.top + counting.player.r;
    const hp = counting.player.hp;
    updateWorld(counting, DT, idle);
    expect(counting.player.hp).toBe(hp);
    const cleared = wallWorld([top]);
    cleared.mode = 'clear';
    cleared.player.inv = 0;
    cleared.player.x = 380;
    cleared.player.y = bounds.top + cleared.player.r;
    const hp2 = cleared.player.hp;
    updateWorld(cleared, DT, idle);
    expect(cleared.player.hp).toBe(hp2);
  });
});

describe('換気扇の壁：絵', () => {
  it('上・下・左の壁を描ける（描画の呼び出しが、エラーなく通る）。強風でない部屋では何も描かない', () => {
    const calls = [];
    const g = new Proxy({}, { get: (_, name) => (...args) => { calls.push(name); return g; } });
    const world = wallWorld([{ side: 'top', from: 300, to: 460 }, { side: 'bottom', from: 200, to: 340 }, { side: 'left', from: 120, to: 260 }]);
    drawHotWalls(g, world);
    expect(calls).toContain('fillRect');
    expect(calls).toContain('strokeCircle');
    const plain = createWorld({ waves: [{}], rng: () => 0.99 });
    calls.length = 0;
    drawHotWalls(g, plain);
    expect(calls).toHaveLength(0);
  });

  it('右の壁にも触れるとダメージ（右に風が吹いても、壁が働く）。範囲の外では受けない', () => {
    const right = { side: 'right', from: 200, to: 340 };
    const world = wallWorld([right]);
    const p = world.player;
    p.inv = 0;
    p.x = bounds.right - p.r;
    p.y = 260;
    expect(touchingHotWall(world, right)).toBe(true);
    const before = p.hp;
    updateWorld(world, DT, idle);
    expect(before - p.hp).toBeGreaterThan(0);
    p.inv = 0;
    p.y = 400;
    expect(touchingHotWall(world, right)).toBe(false);
  });
});

function run(world, seconds) {
  for (let t = 0; t < seconds; t += DT) {
    world.player.x = 380;
    world.player.y = bounds.top + world.player.r;
    updateWorld(world, DT, idle);
  }
}
