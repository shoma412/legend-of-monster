import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { species } from '../src/data/implants.js';
import { maps } from '../src/data/maps.js';
import { ending } from '../src/data/story.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, currentArea, enterRoom, hasNextArea } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ7「核心区」エリア5「中枢」と、最後のボス ノイズ（依頼人）、エンディング（docs/詳細仕様.md「36. マップ7「核心区」と、ミシック」の「⑤エリア5」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const nz = DATA.bosses.get('noise');

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function bossWorld() {
  const room = { type: 'combat', waves: [{ boss: 'noise' }], objects: [], doors: [], clearCredits: 0 };
  const world = createWorld({ room, rng: seeded(61), weaponId: 'sword' });
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

describe('エリア5「中枢」の定義', () => {
  const map = maps.find((m) => m.id === 'map7');
  const area = DATA.areas.get('core');

  it('マップ7の最後のエリア。環境は3つ重ね。ボスは依頼人のノイズ。素材・データ片4つがそろっている', () => {
    expect(map.areas).toEqual(['gate', 'archive', 'factory', 'logic', 'core']);
    expect(area.name).toBe('中枢');
    expect(area.environment).toBe('storm');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    expect(area.boss).toBe('noise');
    expect(nz.name).toBe('□▼◯☆');
    expect(nz.alias).toBe('依頼人');
    expect(nz.hp).toBeGreaterThan(DATA.bosses.get('cogitor').hp);
    expect(DATA.materials.get(nz.material).name).toBe('ノイズコア');
    expect(MATERIAL_ICONS[nz.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === 'core');
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(DATA.achievements.get('noise').name).toBe('依頼完了');
    expect(species.order.boss).toBe('noise');
    expect(DATA.implants.all().filter((d) => d.species === 'order')).toHaveLength(5);
  });

  it('5つのエリアが全部そろった。最後のエリアのボスを倒すと、マップは完了（次のエリアはない）', () => {
    const run7 = createRun({ weaponId: 'sword', rng: seeded(5), mapId: 'map7' });
    run7.areaIndex = 4;
    expect(currentArea(run7).id).toBe('core');
    expect(hasNextArea(run7)).toBe(false);
    const world = enterRoom(run7);
    expect(world.room.environment.id).toBe('storm');
    expect(world.room.mythicChance).toBe(0.06);
    expect(world.room.bossMythic).toBe(0);
  });

  it('雑魚は定義がそろっている。ボスの部品は、ほかのボスと重ならない（懇願だけは、ノイズの中で2つの攻撃が共有する）', () => {
    for (const { id } of area.enemies) expect(DATA.enemies.get(id), id).toBeDefined();
    const others = new Set();
    for (const boss of DATA.bosses.all()) if (boss.id !== 'noise') for (const a of Object.values(boss.attacks)) others.add(a.pattern);
    for (const a of Object.values(nz.attacks)) {
      expect(PATTERNS[a.pattern], a.pattern).toBeDefined();
      expect(others.has(a.pattern), a.pattern).toBe(false);
    }
  });

  it('エンディングの文は、依頼人を止めた話になっている', () => {
    expect(ending.title).toContain('□▼◯☆');
    expect(ending.lines.join('')).toContain('ありがとう');
  });
});

describe('ノイズの攻撃', () => {
  it('記号の雨：4種類の大きさの落雷の印が、順に並ぶ', () => {
    const world = bossWorld();
    startMove(world, 'glyphfall');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length === 12, 3)).toBe(true);
    expect(new Set(hazardsOf(world, 'mark').map((m) => m.r)).size).toBe(4);
  });

  it('解錠：4つの印が、ばらばらの順番で、2周ぶん（8回）爆ぜる', () => {
    const world = bossWorld();
    startMove(world, 'codelock');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length === 8, 3)).toBe(true);
    const ts = hazardsOf(world, 'mark').map((m) => m.t);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
    expect(runUntil(world, () => !world.boss.act, 30)).toBe(true);
  });

  it('命令の壁：すき間のある壁が3枚走る', () => {
    const world = bossWorld();
    startMove(world, 'orderwall');
    expect(runUntil(world, () => hazardsOf(world, 'windblade').length === 3, 3)).toBe(true);
    expect(runUntil(world, () => !world.boss.act, 30)).toBe(true);
  });

  it('記号弾：曲がり方の違う弾が出る', () => {
    const world = bossWorld();
    startMove(world, 'glyphshots');
    expect(runUntil(world, () => hazardsOf(world, 'curveshot').length >= 4, 3)).toBe(true);
    const turns = new Set(hazardsOf(world, 'curveshot').slice(0, 4).map((h) => h.turn));
    expect(turns.size).toBe(4);
  });

  it('停止命令：落ちた所に、減速の床が残る', () => {
    const world = bossWorld();
    startMove(world, 'halt');
    expect(runUntil(world, () => hazardsOf(world, 'pool').length > 0, 5)).toBe(true);
    expect(hazardsOf(world, 'pool')[0].slow).toBe(true);
  });

  it('記憶の3つ：門板、竜巻、再生の影が出る', () => {
    const w1 = bossWorld();
    startMove(w1, 'memorygate');
    expect(runUntil(w1, () => hazardsOf(w1, 'gateslab').length === 2, 3)).toBe(true);
    const w2 = bossWorld();
    startMove(w2, 'memorytwister');
    expect(runUntil(w2, () => hazardsOf(w2, 'twister').length === 3, 3)).toBe(true);
    const w3 = bossWorld();
    startMove(w3, 'memoryshade');
    expect(runUntil(w3, () => hazardsOf(w3, 'replayshade').length === 2, 3)).toBe(true);
  });

  it('3段階：HP が減ると、攻撃が変わる。最後の段階では、懇願だけ', () => {
    expect(nz.phases).toHaveLength(3);
    expect(nz.phases[1].moves.some((m) => m.startsWith('memory'))).toBe(true);
    expect(nz.phases[2].still).toBe(true);
    expect(nz.phases[2].moves).toEqual(['plea']);
    expect(nz.ultimate.move).toBe('pleaLast');
  });
});

describe('最後の段階：懇願', () => {
  it('動かず、体に触れてもダメージを受けない。語りかける', () => {
    const world = bossWorld();
    const b = world.boss;
    b.hp = b.maxHp * 0.2;
    b.ultimateDone = true;
    b.idleT = 0.1;
    world.player.inv = 0;
    const hp = world.player.hp;
    const x0 = b.x;
    const y0 = b.y;
    world.player.x = b.x - b.r;
    world.player.y = b.y;
    let spoke = false;
    for (let i = 0; i < 300; i++) {
      world.player.x = b.x - b.r + 4;
      world.player.y = b.y;
      updateWorld(world, DT, idle);
      if (world.fx.texts.some((t) => /止めて|ありがとう|動いて|続けて/.test(t.text ?? ''))) spoke = true;
    }
    expect(world.player.hp).toBe(hp);
    expect(Math.hypot(b.x - x0, b.y - y0)).toBeLessThan(2);
    expect(b.phaseIndex).toBe(2);
    expect(spoke).toBe(true);
  });

  it('倒すと、マップの最後のボスとして扱われる（ボスの撃破の出来事が出る）', () => {
    const world = bossWorld();
    const b = world.boss;
    b.hp = 1;
    b.phaseIndex = 2;
    hitEnemy(world, b, 999999, 1, 0, 0, { unblockable: true });
    run(world, 0.5);
    expect(world.events.some((e) => e.type === 'bossKill' && e.boss === 'noise')).toBe(true);
  });
});

describe('絵：ノイズの全攻撃と雑魚を描いても、エラーにならない', () => {
  it('全部描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const name of Object.keys(nz.attacks)) {
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
    for (const id of ['orderbot', 'glyphling']) world.enemies.push(createEnemy(DATA.enemies.get(id), 600, 300, 0, world.rng));
    drawEnemies(g, world);
  });
});
