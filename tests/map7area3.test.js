import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { species } from '../src/data/implants.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ7「核心区」エリア3「修繕工場」（docs/詳細仕様.md「36. マップ7「核心区」と、ミシック」の「③エリア3」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const fb = DATA.bosses.get('fabricator');

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function bossWorld() {
  const room = { type: 'combat', waves: [{ boss: 'fabricator' }], objects: [], doors: [], clearCredits: 0 };
  const world = createWorld({ room, rng: seeded(41), weaponId: 'sword' });
  world.waveTimer = 0;
  recalcStats(world.player);
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  const b = world.boss;
  b.idleT = Infinity;
  b.x = 700;
  b.y = 300;
  world.player.inv = Infinity;
  world.player.stats.maxHp = 99999;
  world.player.hp = 99999;
  world.player.x = 400;
  world.player.y = 300;
  return world;
}

function startMove(world, name) {
  const b = world.boss;
  const p = world.player;
  const d = { dx: p.x - b.x, dy: p.y - b.y, dist: Math.hypot(p.x - b.x, p.y - b.y) || 1 };
  b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
  PATTERNS[b.act.def.pattern].start(world, b, b.act, d);
  return b.act;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

const hazardsOf = (world, type) => world.hazards.filter((h) => h.type === type);

describe('エリア3「修繕工場」の定義', () => {
  const map = maps.find((m) => m.id === 'map7');
  const area = DATA.areas.get('factory');

  it('マップ7の3つ目のエリア。環境は強風。背景・曲・ボス・素材・データ片4つがそろっている', () => {
    expect(map.areas.slice(0, 3)).toEqual(['gate', 'archive', 'factory']);
    expect(area.name).toBe('修繕工場');
    expect(area.environment).toBe('gale');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    expect(area.boss).toBe('fabricator');
    expect(fb.weakness).toBe('cold');
    expect(fb.hp).toBeGreaterThan(DATA.bosses.get('archivist').hp);
    expect(DATA.materials.get(fb.material).name).toBe('ファブコア');
    expect(MATERIAL_ICONS[fb.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === 'factory');
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(DATA.achievements.get('fabricator').name).toBe('修繕停止');
    expect(species.repair.boss).toBe('fabricator');
    expect(DATA.implants.all().filter((d) => d.species === 'repair')).toHaveLength(5);
  });

  it('雑魚は定義がそろっている。ボスの部品は、ほかのボスと重ならない', () => {
    for (const { id } of area.enemies) expect(DATA.enemies.get(id), id).toBeDefined();
    const others = new Set();
    for (const boss of DATA.bosses.all()) if (boss.id !== 'fabricator') for (const a of Object.values(boss.attacks)) others.add(a.pattern);
    for (const a of Object.values(fb.attacks)) {
      expect(PATTERNS[a.pattern], a.pattern).toBeDefined();
      expect(others.has(a.pattern), a.pattern).toBe(false);
    }
  });
});

describe('ファブリケーターの攻撃', () => {
  it('組立：部品が飛んできて、着くと砲台になる。壊せる', () => {
    const world = bossWorld();
    startMove(world, 'assemble');
    expect(runUntil(world, () => hazardsOf(world, 'partflight').length === 3, 3)).toBe(true);
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'turretunit').length === 3, 6)).toBe(true);
    const t = world.enemies.find((e) => e.def.id === 'turretunit');
    expect(t.expire).toBeGreaterThan(world.time);
  });

  it('ベルト：帯の中にいると、流される。ダッシュ中は流されない', () => {
    const world = bossWorld();
    startMove(world, 'belts');
    expect(runUntil(world, () => hazardsOf(world, 'belt').length === 3, 3)).toBe(true);
    const belt = hazardsOf(world, 'belt')[0];
    expect(runUntil(world, () => belt.warn <= 0, 3)).toBe(true);
    const horizontal = belt.axis === 'h';
    world.player.x = 500;
    world.player.y = 300;
    if (horizontal) world.player.y = belt.pos;
    else world.player.x = belt.pos;
    const p0 = horizontal ? world.player.x : world.player.y;
    run(world, 0.5);
    const p1 = horizontal ? world.player.x : world.player.y;
    expect(Math.sign(p1 - p0)).toBe(belt.dir);
    expect(Math.abs(p1 - p0)).toBeGreaterThan(50);
    world.player.dashT = 1;
    const before = horizontal ? world.player.x : world.player.y;
    updateWorld(world, DT, idle);
    world.player.dashT = 1;
    expect(horizontal ? world.player.x : world.player.y).toBeCloseTo(before, 0);
  });

  it('プレス：段ごと、順に落ちる予告が並ぶ', () => {
    const world = bossWorld();
    startMove(world, 'press');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length === 12, 3)).toBe(true);
    const marks = hazardsOf(world, 'mark');
    expect(new Set(marks.map((m) => m.t.toFixed(2))).size).toBeGreaterThan(6);
    expect(runUntil(world, () => !world.boss.act, 20)).toBe(true);
  });

  it('溶鉄：落ちた所に、燃える床が残る', () => {
    const world = bossWorld();
    startMove(world, 'moltenspit');
    expect(runUntil(world, () => hazardsOf(world, 'pool').length > 0, 5)).toBe(true);
    expect(hazardsOf(world, 'pool')[0].dot).toBe('burn');
  });

  it('締結：留め具の間を電撃の線がつなぐ。予告のあと当たる', () => {
    const world = bossWorld();
    world.player.inv = 0;
    startMove(world, 'fasten');
    expect(runUntil(world, () => hazardsOf(world, 'netline').length === 1, 3)).toBe(true);
    const net = hazardsOf(world, 'netline')[0];
    expect(net.points.length).toBeGreaterThanOrEqual(3);
    const hp = world.player.hp;
    runUntil(world, () => net.phase === 'flash', 4);
    world.player.x = net.points[0].x;
    world.player.y = net.points[0].y;
    run(world, 0.2);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('大技「全工程稼働」：ベルトが回り続け、プレスと溶鉄が来る。最後まで終わる', () => {
    const world = bossWorld();
    startMove(world, 'fullline');
    expect(runUntil(world, () => hazardsOf(world, 'belt').length === 2, 4)).toBe(true);
    expect(runUntil(world, () => hazardsOf(world, 'mark').length > 4, 6)).toBe(true);
    expect(runUntil(world, () => !world.boss.act, 40)).toBe(true);
  });

  it('後半は連携を2つ持つ。反応は締結、大技は全工程稼働', () => {
    expect(fb.phases.at(-1).combos).toHaveLength(2);
    expect(fb.reactions[0].move).toBe('fasten');
    expect(fb.ultimate.move).toBe('fullline');
  });
});

describe('絵：ファブリケーターの全攻撃と雑魚を描いても、エラーにならない', () => {
  it('全部描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const name of Object.keys(fb.attacks)) {
      const world = bossWorld();
      world.boss.hp = world.boss.maxHp * 0.2;
      startMove(world, name);
      let frame = 0;
      for (let t = 0; t < 40 && world.boss.act; t += DT) {
        updateWorld(world, DT, idle);
        if (frame++ % 3 === 0) {
          drawHazards(g, world);
          drawBossTelegraph(g, world);
          drawEnemies(g, world);
          drawPlayer(g, world);
        }
      }
      expect(frame, name).toBeGreaterThan(3);
    }
    const world = bossWorld();
    for (const id of ['weldbot', 'bolter', 'turretunit']) world.enemies.push(createEnemy(DATA.enemies.get(id), 600, 300, 0, world.rng));
    drawEnemies(g, world);
  });
});
