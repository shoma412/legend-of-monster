import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { species } from '../src/data/implants.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { fire } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, currentArea, enterRoom } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ7「核心区」エリア2「記録庫」（docs/詳細仕様.md「36. マップ7「核心区」と、ミシック」の「②エリア2」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const av = DATA.bosses.get('archivist');

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeWorld({ boss = null, waves = [{}], implants = [] } = {}) {
  const room = { type: 'combat', waves: boss ? [{ boss }] : waves, objects: [], doors: [], clearCredits: 0 };
  const world = createWorld({ room, rng: seeded(31), weaponId: 'sword' });
  world.waveTimer = boss ? 0 : Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  world.player.x = 400;
  world.player.y = 300;
  return world;
}

function bossWorld() {
  const world = makeWorld({ boss: 'archivist' });
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

describe('エリア2「記録庫」の定義', () => {
  const map = maps.find((m) => m.id === 'map7');
  const area = DATA.areas.get('archive');

  it('マップ7の2つ目のエリア。環境は酸の雨。背景・曲・ボス・素材・データ片4つがそろっている', () => {
    expect(map.areas.slice(0, 2)).toEqual(['gate', 'archive']);
    expect(area.name).toBe('記録庫');
    expect(area.environment).toBe('acidrain');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    expect(area.boss).toBe('archivist');
    expect(av.weakness).toBe('shock');
    expect(av.hp).toBeGreaterThan(DATA.bosses.get('gatekeeper').hp);
    expect(DATA.materials.get(av.material).name).toBe('アーカイブコア');
    expect(MATERIAL_ICONS[av.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === 'archive');
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(DATA.achievements.get('archivist').name).toBe('記録抹消');
    expect(species.record.boss).toBe('archivist');
    expect(DATA.implants.all().filter((d) => d.species === 'record')).toHaveLength(5);
  });

  it('雑魚は定義がそろっている。ボスの部品は、ほかのボスと重ならない', () => {
    for (const { id } of area.enemies) expect(DATA.enemies.get(id), id).toBeDefined();
    const others = new Set();
    for (const boss of DATA.bosses.all()) if (boss.id !== 'archivist') for (const a of Object.values(boss.attacks)) others.add(a.pattern);
    for (const a of Object.values(av.attacks)) {
      expect(PATTERNS[a.pattern], a.pattern).toBeDefined();
      expect(others.has(a.pattern), a.pattern).toBe(false);
    }
  });

  it('2つ目のエリアに進むと、酸の雨の環境になり、ミシックの確率が上がる', () => {
    const run7 = createRun({ weaponId: 'sword', rng: seeded(5), mapId: 'map7' });
    run7.areaIndex = 1;
    expect(currentArea(run7).id).toBe('archive');
    const world = enterRoom(run7);
    expect(world.room.environment?.id).toBe('acidrain');
    expect(world.room.mythicChance).toBeGreaterThan(0.007);
  });
});

describe('アーカイバーの攻撃', () => {
  it('再生：プレイヤーの通った道を、遅れてなぞる。待っている間は当たらない', () => {
    const world = bossWorld();
    world.player.inv = 0;
    startMove(world, 'echo');
    expect(runUntil(world, () => hazardsOf(world, 'replayshade').length === 1, 3)).toBe(true);
    const h = hazardsOf(world, 'replayshade')[0];
    const start = { x: h.x, y: h.y };
    // 待っている間は、出た場所から動かず、当たらない
    const hp = world.player.hp;
    world.player.x = start.x + 2;
    world.player.y = start.y;
    run(world, 0.5);
    expect(h.active).toBe(false);
    expect(world.player.hp).toBe(hp);
    // 右へ歩く。影は、遅れて、同じ道をなぞる
    const walk = { ...idle, mx: 1 };
    for (let t = 0; t < 3.5; t += DT) updateWorld(world, DT, walk);
    expect(h.active).toBe(true);
    expect(h.x).toBeGreaterThan(start.x + 20);
    expect(world.player.x).toBeGreaterThan(h.x);
  });

  it('足跡爆撃：予告のあいだに歩いた場所に、落雷の予告が並ぶ', () => {
    const world = bossWorld();
    startMove(world, 'trailstrike');
    const walk = { ...idle, mx: 1 };
    const x0 = world.player.x;
    for (let t = 0; t < 1.7; t += DT) updateWorld(world, DT, walk);
    const marks = hazardsOf(world, 'mark');
    expect(marks.length).toBeGreaterThanOrEqual(5);
    // 歩いた範囲の中にある
    for (const m of marks) {
      expect(m.x).toBeGreaterThanOrEqual(x0 - 5);
      expect(m.x).toBeLessThanOrEqual(world.player.x + 5);
    }
    expect(runUntil(world, () => !world.boss.act, 15)).toBe(true);
  });

  it('回収弾：外まわりから、ボスめがけて飛んでくる', () => {
    const world = bossWorld();
    const b = world.boss;
    startMove(world, 'collect');
    expect(runUntil(world, () => world.shots.length >= 3, 3)).toBe(true);
    const s = world.shots[0];
    const d0 = Math.hypot(b.x - s.x, b.y - s.y);
    run(world, 0.3);
    expect(Math.hypot(b.x - s.x, b.y - s.y)).toBeLessThan(d0);
  });

  it('検閲帯：予告のあと当たり、ずれて、もう一度当たる', () => {
    const world = bossWorld();
    startMove(world, 'censorbars');
    expect(runUntil(world, () => hazardsOf(world, 'censor').length === 2, 3)).toBe(true);
    const h = hazardsOf(world, 'censor')[0];
    expect(h.steps).toHaveLength(2);
    expect(h.steps[1]).not.toBe(h.steps[0]);
    // 1回目に当たる位置に立つ
    world.player.inv = 0;
    const hp = world.player.hp;
    let struck = 0;
    for (let i = 0; i < 400 && !h.dead; i++) {
      const pos = h.steps[Math.min(h.step, h.steps.length - 1)];
      if (h.axis === 'x') world.player.x = pos;
      else world.player.y = pos;
      const before = h.step;
      updateWorld(world, DT, idle);
      if (h.step > before) struck++;
    }
    expect(struck).toBe(2);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('復元：柱が残っている間、ボスのHPが回復する。壊すと止まる', () => {
    const world = bossWorld();
    const b = world.boss;
    b.hp = b.maxHp * 0.5;
    startMove(world, 'backup');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'datapylon').length === 2, 3)).toBe(true);
    const hp0 = b.hp;
    run(world, 2);
    expect(b.hp).toBeGreaterThan(hp0);
    for (const e of world.enemies) if (e.def.id === 'datapylon') e.dead = true;
    const hp1 = b.hp;
    run(world, 1);
    expect(b.hp).toBeLessThanOrEqual(hp1 + 1);
    expect(runUntil(world, () => !b.act, 6)).toBe(true);
  });

  it('大技「巻き戻し」：影が3体、遅れをずらして出る。酸の雨も降る', () => {
    const world = bossWorld();
    world.room.environment = DATA.environments.get('acidrain');
    startMove(world, 'rewind');
    expect(runUntil(world, () => hazardsOf(world, 'replayshade').length === 3, 4)).toBe(true);
    const delays = hazardsOf(world, 'replayshade').map((h) => h.delay);
    expect(new Set(delays).size).toBe(3);
    expect(runUntil(world, () => !world.boss.act, 30)).toBe(true);
  });

  it('後半は連携を2つ持つ。反応は足跡爆撃、大技は巻き戻し', () => {
    expect(av.phases.at(-1).combos).toHaveLength(2);
    expect(av.reactions[0].move).toBe('trailstrike');
    expect(av.ultimate.move).toBe('rewind');
  });
});

describe('種族「記録」と、しおりの効果', () => {
  it('しおり：敵を倒すと、3秒間だけダメージが上がる（超過駆動とは別の効果）', () => {
    const world = makeWorld({ implants: ['bookmark'] });
    const e = createEnemy(DATA.enemies.get('grunt'), 450, 300, 0, world.rng);
    fire(world, 'kill', { target: e, elements: [], primary: true });
    expect(world.player.buffs.some((x) => x.id === 'bookmark' && x.stat === 'attackMul')).toBe(true);
    expect(world.player.buffs.some((x) => x.id === 'overclock')).toBe(false);
  });
});

describe('絵：アーカイバーの全攻撃と雑魚を描いても、エラーにならない', () => {
  it('全部描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const name of Object.keys(av.attacks)) {
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
    const world = makeWorld();
    for (const id of ['clerk', 'shredder', 'datapylon']) world.enemies.push(createEnemy(DATA.enemies.get(id), 600, 300, 0, world.rng));
    drawEnemies(g, world);
  });
});
