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

// マップ7「核心区」エリア4「演算層」（docs/詳細仕様.md「36. マップ7「核心区」と、ミシック」の「④エリア4」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const cg = DATA.bosses.get('cogitor');

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function bossWorld() {
  const room = { type: 'combat', waves: [{ boss: 'cogitor' }], objects: [], doors: [], clearCredits: 0 };
  const world = createWorld({ room, rng: seeded(51), weaponId: 'sword' });
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

describe('エリア4「演算層」の定義', () => {
  const map = maps.find((m) => m.id === 'map7');
  const area = DATA.areas.get('logic');

  it('マップ7の4つ目のエリア。環境は暗闇と強風。背景・曲・ボス・素材・データ片4つがそろっている', () => {
    expect(map.areas.slice(0, 4)).toEqual(['gate', 'archive', 'factory', 'logic']);
    expect(area.name).toBe('演算層');
    expect(area.environment).toBe('darkgale');
    const env = DATA.environments.get('darkgale');
    expect(env.dark).toBe(true);
    expect(env.wind).toBe(true);
    expect(env.windCycle.blow).toBe(4);
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    expect(area.boss).toBe('cogitor');
    expect(cg.weakness).toBe('corrode');
    expect(cg.hp).toBeGreaterThan(DATA.bosses.get('fabricator').hp);
    expect(DATA.materials.get(cg.material).name).toBe('コギトコア');
    expect(MATERIAL_ICONS[cg.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === 'logic');
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(DATA.achievements.get('cogitor').name).toBe('演算停止');
    expect(species.calc.boss).toBe('cogitor');
    expect(DATA.implants.all().filter((d) => d.species === 'calc')).toHaveLength(5);
  });

  it('重ねた環境「暗闇・酸の雨・強風」も、3つとも動く設定がそろっている', () => {
    const env = DATA.environments.get('storm');
    expect(env.dark && env.rain && env.wind).toBe(true);
    expect(env.rainCycle.rain).toBeGreaterThan(0);
    expect(env.rainDamage.tick).toBeGreaterThan(0);
    expect(env.windCycle.warn).toBe(2);
    expect(env.roofs.count.min).toBeGreaterThan(0);
    expect(env.screens.count.min).toBeGreaterThan(0);
  });

  it('雑魚は定義がそろっている。ボスの部品は、ほかのボスと重ならない', () => {
    for (const { id } of area.enemies) expect(DATA.enemies.get(id), id).toBeDefined();
    const others = new Set();
    for (const boss of DATA.bosses.all()) if (boss.id !== 'cogitor') for (const a of Object.values(boss.attacks)) others.add(a.pattern);
    for (const a of Object.values(cg.attacks)) {
      expect(PATTERNS[a.pattern], a.pattern).toBeDefined();
      expect(others.has(a.pattern), a.pattern).toBe(false);
    }
  });
});

describe('コギトールの攻撃', () => {
  it('予測：走っていれば、走る先に印が出る。止まっていれば、足元に出る', () => {
    const world = bossWorld();
    startMove(world, 'forecast');
    const run1 = { ...idle, mx: 1 };
    for (let t = 0; t < 1.3; t += DT) updateWorld(world, DT, run1);
    const marks = hazardsOf(world, 'mark');
    expect(marks.length).toBe(3);
    expect(marks.at(-1).x).toBeGreaterThan(world.player.x + 100);

    const w2 = bossWorld();
    startMove(w2, 'forecast');
    run(w2, 1.3);
    const m2 = hazardsOf(w2, 'mark');
    expect(m2.length).toBe(3);
    for (const m of m2) expect(Math.abs(m.x - w2.player.x)).toBeLessThan(30);
  });

  it('多重化：分身が出て、弾を放射状に撃つ', () => {
    const world = bossWorld();
    startMove(world, 'multiplex');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'cogcopy').length === 3, 3)).toBe(true);
    expect(runUntil(world, () => world.shots.length >= 4, 5)).toBe(true);
  });

  it('割り込み：広がる輪に当たると、ダメージと減速', () => {
    const world = bossWorld();
    world.player.inv = 0;
    startMove(world, 'interrupt');
    expect(runUntil(world, () => hazardsOf(world, 'elemring').length === 2, 3)).toBe(true);
    const ring = hazardsOf(world, 'elemring')[0];
    const hp = world.player.hp;
    runUntil(world, () => ring.wait <= 0, 3);
    world.player.x = world.boss.x - 200;
    world.player.y = world.boss.y;
    for (let i = 0; i < 120 && world.player.hp === hp; i++) {
      world.player.x = world.boss.x - ring.r;
      world.player.y = world.boss.y;
      updateWorld(world, DT, idle);
    }
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('演算エラー：区画の予告のあと、一瞬だけ当たる。区画の外なら当たらない', () => {
    const world = bossWorld();
    startMove(world, 'glitch');
    expect(runUntil(world, () => hazardsOf(world, 'glitchcell').length === 10, 3)).toBe(true);
    const cell = hazardsOf(world, 'glitchcell')[0];
    world.player.inv = 0;
    const hp = world.player.hp;
    for (let i = 0; i < 400 && cell.phase !== 'active'; i++) {
      world.player.x = cell.x;
      world.player.y = cell.y;
      updateWorld(world, DT, idle);
    }
    for (let i = 0; i < 6; i++) {
      world.player.x = cell.x;
      world.player.y = cell.y;
      updateWorld(world, DT, idle);
    }
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('過熱：外から縮む輪が出て、消える', () => {
    const world = bossWorld();
    startMove(world, 'overheat');
    expect(runUntil(world, () => hazardsOf(world, 'closering').length === 3, 3)).toBe(true);
    expect(runUntil(world, () => hazardsOf(world, 'closering').length === 0, 20)).toBe(true);
  });

  it('大技「全並列」：分身が出て、予測と演算エラーが重なる。最後まで終わる', () => {
    const world = bossWorld();
    startMove(world, 'allthreads');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'cogcopy').length === 4, 4)).toBe(true);
    expect(runUntil(world, () => hazardsOf(world, 'glitchcell').length > 0, 6)).toBe(true);
    expect(runUntil(world, () => !world.boss.act, 40)).toBe(true);
  });

  it('後半は連携を2つ持つ。反応は予測、大技は全並列', () => {
    expect(cg.phases.at(-1).combos).toHaveLength(2);
    expect(cg.reactions[0].move).toBe('forecast');
    expect(cg.ultimate.move).toBe('allthreads');
  });
});

describe('絵：コギトールの全攻撃と雑魚を描いても、エラーにならない', () => {
  it('全部描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const name of Object.keys(cg.attacks)) {
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
    for (const id of ['calcbot', 'gearling', 'cogcopy']) world.enemies.push(createEnemy(DATA.enemies.get(id), 600, 300, 0, world.rng));
    drawEnemies(g, world);
  });
});
