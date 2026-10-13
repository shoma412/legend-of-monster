import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { species } from '../src/data/implants.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ6「送風区」エリア3「風見の庭」（docs/詳細仕様.md「30. マップ6「送風区」と、環境「強風」」の「③エリア3」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('gale');
const vane = DATA.bosses.get('weathervane');

function makeWorld({ waves = [{}], implants = [], boss = null } = {}) {
  const room = { type: 'combat', waves: boss ? [{ boss }] : waves, objects: [], doors: [], clearCredits: 0, environment: env, screens: [] };
  const world = createWorld({ room, rng: () => 0.99, weaponId: 'sword' });
  world.waveTimer = boss ? 0 : Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  world.player.x = 400;
  world.player.y = 300;
  return world;
}

function bossWorld() {
  const world = makeWorld({ boss: 'weathervane' });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  const b = world.boss;
  b.idleT = Infinity;
  b.x = 700;
  b.y = 300;
  world.player.inv = Infinity;
  world.player.x = 400;
  world.player.y = 300;
  world.wind = { phase: 'clear', t: 99, max: 99, dirX: 1, dirY: 0 };
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

function run(world, seconds) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, idle);
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

const hazardsOf = (world, type) => world.hazards.filter((h) => h.type === type);

describe('エリア3「風見の庭」の定義', () => {
  const map = maps.find((m) => m.id === 'map6');
  const area = DATA.areas.get('airgarden');

  it('マップ6の3つ目のエリア。背景・曲・ボス・素材・データ片4つがそろっている', () => {
    expect(map.areas).toEqual(['airintake', 'airduct', 'airgarden']);
    expect(area.name).toBe('風見の庭');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    expect(area.boss).toBe('weathervane');
    expect(vane.weakness).toBe('shock');
    expect(vane.hp).toBe(29000);
    expect(DATA.materials.get(vane.material).name).toBe('ベーンコア');
    expect(MATERIAL_ICONS[vane.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === 'airgarden');
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(DATA.achievements.get('weathervane').name).toBe('風見狩り');
    expect(species.vane.boss).toBe('weathervane');
  });

  it('このエリアに出る雑魚は、定義がそろっている', () => {
    for (const { id } of area.enemies) expect(DATA.enemies.get(id), id).toBeDefined();
    expect(area.enemies.map((e) => e.id)).toEqual(expect.arrayContaining(['pinwheel', 'fluff']));
  });

  it('ボスの攻撃・大技の部品が、すべて存在し、ほかのボスと重ならない', () => {
    const others = new Set();
    for (const boss of DATA.bosses.all()) if (boss.id !== 'weathervane') for (const a of Object.values(boss.attacks)) others.add(a.pattern);
    for (const a of Object.values(vane.attacks)) {
      expect(PATTERNS[a.pattern], a.pattern).toBeDefined();
      expect(others.has(a.pattern), a.pattern).toBe(false);
    }
  });
});

describe('風上を向く盾', () => {
  it('風の予告が出ると、盾は風上へ回る。プレイヤーのほうは向かない', () => {
    const world = bossWorld();
    const b = world.boss;
    world.wind = { phase: 'warn', t: 2, max: 2, dirX: 0, dirY: 1 }; // 風は下へ吹く → 風上は上
    run(world, 1.5);
    expect(Math.abs(b.facing - -Math.PI / 2)).toBeLessThan(0.05);
  });

  it('盾の正面からの攻撃は防がれ、背中側からは通る（風下から攻める）', () => {
    const world = bossWorld();
    const b = world.boss;
    world.wind = { phase: 'blow', t: 3, max: 4, dirX: 1, dirY: 0 }; // 風は右へ → 風上は左（盾は左向き）
    run(world, 2);
    b.restT = 0;
    b.hp = b.maxHp;
    b.shieldOpen = false;
    const front = hitEnemy(world, b, 100, 1, 0, 0); // 左から右へ打つ = 盾の側から
    expect(front.blocked).toBe(true);
    const back = hitEnemy(world, b, 100, -1, 0, 0); // 右から左へ打つ = 背中から
    expect(back.blocked).toBeFalsy();
  });
});

describe('ウェザーベーンの攻撃', () => {
  it('方位撃ち：東西南北に撃ち、次は斜め4方向', () => {
    const world = bossWorld();
    startMove(world, 'compass');
    const act = world.boss.act;
    const lastFour = () => world.shots.slice(-4).map((s) => Math.round(((Math.atan2(s.vy, s.vx) * 180) / Math.PI + 360) % 360)).sort((x, y) => x - y);
    expect(runUntil(world, () => act.fired === 1, 3)).toBe(true);
    expect(lastFour()).toEqual([0, 90, 180, 270]);
    expect(runUntil(world, () => act.fired === 2, 3)).toBe(true);
    expect(lastFour()).toEqual([45, 135, 225, 315]);
  });

  it('突風：盾の正面の扇の中にいると押され、外にいると押されない。ダメージはない', () => {
    const world = bossWorld();
    const b = world.boss;
    b.facing = Math.PI; // 左向き
    world.player.x = b.x - 200;
    world.player.y = b.y;
    const hp = world.player.hp;
    startMove(world, 'gust');
    const x0 = world.player.x;
    run(world, 2.5);
    expect(world.player.x).toBeLessThan(x0 - 100);
    expect(world.player.hp).toBe(hp);

    const w2 = bossWorld();
    w2.boss.facing = Math.PI;
    w2.player.x = w2.boss.x + 200; // 背中側
    w2.player.y = w2.boss.y;
    startMove(w2, 'gust');
    const x1 = w2.player.x;
    run(w2, 2.5);
    expect(w2.player.x).toBe(x1);
  });

  it('突風：ダッシュ中は押されない', () => {
    const world = bossWorld();
    const b = world.boss;
    b.facing = Math.PI;
    world.player.x = b.x - 200;
    world.player.y = b.y;
    startMove(world, 'gust');
    runUntil(world, () => b.act.phase === 'active', 3);
    world.player.dashT = 1;
    const x0 = world.player.x;
    run(world, 0.3);
    world.player.dashT = 1;
    expect(world.player.x).toBeCloseTo(x0, 0);
  });

  it('風種：風で流される。風がやんで少しすると地雷になり、近づくと爆ぜる', () => {
    const world = bossWorld();
    startMove(world, 'windseed');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'windseed').length === 4, 3)).toBe(true);
    const seed = world.enemies.find((e) => e.def.id === 'windseed');
    seed.x = 300;
    seed.y = 500;
    seed.spawnT = 0;
    // 風が吹いている間は流される
    world.wind = { phase: 'blow', t: 3, max: 4, dirX: 1, dirY: 0 };
    const x0 = seed.x;
    run(world, 1);
    expect(seed.x).toBeGreaterThan(x0 + 50);
    // 風がやむと地雷になる
    world.wind = { phase: 'clear', t: 99, max: 99, dirX: 1, dirY: 0 };
    world.player.inv = 0;
    world.player.x = seed.x + 20;
    world.player.y = seed.y;
    const hp = world.player.hp;
    run(world, 1.5);
    expect(seed.dead).toBe(true);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('風向き返し：風向きが反対になり、すき間のある刃が風下へ走る。すき間にいれば当たらない', () => {
    const world = bossWorld();
    world.wind = { phase: 'blow', t: 3, max: 4, dirX: 1, dirY: 0 };
    startMove(world, 'windturn');
    expect(runUntil(world, () => hazardsOf(world, 'windblade').length === 3, 3)).toBe(true);
    expect(world.wind.dirX).toBe(-1);
    const blade = hazardsOf(world, 'windblade')[0];
    expect(blade.dx).toBe(-1);
    // すき間の位置にプレイヤーを置いて、刃が通り過ぎる
    world.player.inv = 0;
    const hp = world.player.hp;
    runUntil(world, () => blade.wait <= 0, 4);
    for (let i = 0; i < 400 && !blade.dead; i++) {
      const x = blade.x + blade.dx * blade.s;
      const y = blade.y + blade.dy * blade.s;
      world.player.x = x + 0; // 刃の線上
      world.player.y = y + blade.py * blade.gap; // すき間の位置
      world.player.x = Math.min(Math.max(world.player.x, world.bounds.left + 20), world.bounds.right - 20);
      world.player.y = Math.min(Math.max(world.player.y, world.bounds.top + 20), world.bounds.bottom - 20);
      updateWorld(world, DT, idle);
    }
    expect(world.player.hp).toBe(hp);
  });

  it('向かい風突進：盾の向きへ、反対側の壁から走り、壁に当たると止まる', () => {
    const world = bossWorld();
    const b = world.boss;
    b.facing = Math.PI; // 左向き → 右の壁から左の壁へ
    world.player.x = 500;
    world.player.y = 350;
    startMove(world, 'windrush');
    expect(runUntil(world, () => b.act.phase === 'active', 3)).toBe(true);
    expect(b.x).toBeGreaterThan(world.bounds.right - 100);
    expect(Math.abs(b.y - 350)).toBeLessThan(40);
    expect(runUntil(world, () => b.act.phase === 'stun', 3)).toBe(true);
    expect(b.x).toBeLessThan(world.bounds.left + 100);
  });

  it('大技「乱風」：風向きが何度も変わり、盾がそのたびに回る。終わると風はやむ', () => {
    const world = bossWorld();
    const b = world.boss;
    let seed = 7;
    world.rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    startMove(world, 'stormfury');
    expect(runUntil(world, () => b.act.phase === 'active', 3)).toBe(true);
    const dirs = new Set();
    for (let t = 0; t < 9; t += DT) {
      updateWorld(world, DT, idle);
      if (world.wind) dirs.add(`${world.wind.dirX},${world.wind.dirY}`);
    }
    expect(dirs.size).toBeGreaterThanOrEqual(3);
    expect(world.shots.length).toBeGreaterThan(0);
    run(world, 2);
    expect(world.wind.phase).toBe('clear');
  });

  it('後半は、盾の回りが速くなり、連携を2つ持つ', () => {
    expect(vane.phases[1].vaneTurn).toBeGreaterThan(vane.vaneTurn);
    expect(vane.phases.at(-1).combos).toHaveLength(2);
    expect(vane.ultimate.move).toBe('stormfury');
  });
});

describe('雑魚：かざぐるまと綿毛', () => {
  it('かざぐるま：動かず、弾を放射状に撃つ。風の間は、弾の腕が2倍になる', () => {
    const world = makeWorld({ waves: [{}] });
    const e = createEnemy(DATA.enemies.get('pinwheel'), 700, 300, 0, world.rng);
    e.cd = 0;
    world.enemies.push(e);
    world.wind = { phase: 'clear', t: 99, max: 99, dirX: 1, dirY: 0 };
    world.player.inv = Infinity;
    updateWorld(world, DT, idle);
    expect(world.shots.length).toBe(3);
    expect(e.x).toBe(700);
    world.shots.length = 0;
    e.cd = 0;
    world.wind = { phase: 'blow', t: 3, max: 4, dirX: 1, dirY: 0 };
    updateWorld(world, DT, idle);
    expect(world.shots.length).toBe(6);
  });

  it('綿毛：寄ってきて、触れると破裂する。壊せば当たらない', () => {
    const world = makeWorld({ waves: [{}] });
    const e = createEnemy(DATA.enemies.get('fluff'), 460, 300, 0, world.rng);
    world.enemies.push(e);
    world.player.inv = 0;
    const hp = world.player.hp;
    run(world, 2);
    expect(e.dead).toBe(true);
    expect(world.player.hp).toBeLessThan(hp);
  });
});

describe('種族「風見」', () => {
  it('5つの部品がそろい、2種類・3種類のボーナスがある', () => {
    const list = DATA.implants.all().filter((d) => d.species === 'vane');
    expect(list.map((d) => d.id).sort()).toEqual(['flank', 'lightrod', 'pinwheelring', 'vaneflow', 'windread'].sort());
    expect(species.vane.bonuses).toHaveLength(2);
  });

  it('順風：風の間だけ攻撃速度が上がる。風読み：風の予告の間だけダメージが上がる', () => {
    const world = makeWorld({ implants: ['vaneflow', 'windread'] });
    world.wind = { phase: 'clear', t: 99, max: 99, dirX: 1, dirY: 0 };
    expect(statWith(world, 'attackSpeed')).toBeCloseTo(0);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
    world.wind.phase = 'warn';
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.12);
    expect(statWith(world, 'attackSpeed')).toBeCloseTo(0);
    world.wind.phase = 'blow';
    expect(statWith(world, 'attackSpeed')).toBeCloseTo(0.15);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
  });

  it('回り込み：敵の背中側から当てたときだけ、ダメージが上がる', () => {
    const world = makeWorld({ implants: ['flank'] });
    const e = createEnemy(DATA.enemies.get('grunt'), 600, 300, 0, world.rng);
    e.angle = 0; // 右向き
    world.player.x = 700; // 正面側
    world.player.y = 300;
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1);
    world.player.x = 500; // 背中側
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.15);
  });

  it('風車：ダッシュのあと1.5秒だけダメージが上がる', () => {
    const world = makeWorld({ implants: ['pinwheelring'] });
    world.player.sinceDash = 0.5;
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.12);
    world.player.sinceDash = 2;
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
  });
});

describe('絵：ウェザーベーンの全攻撃と雑魚を描いても、エラーにならない', () => {
  it('全部描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const name of Object.keys(vane.attacks)) {
      const world = bossWorld();
      world.wind = { phase: 'blow', t: 3, max: 4, dirX: 0, dirY: 1 };
      world.boss.hp = world.boss.maxHp * 0.2;
      startMove(world, name);
      let frame = 0;
      for (let t = 0; t < 30 && world.boss.act; t += DT) {
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
    const world = makeWorld({ waves: [{}] });
    for (const id of ['pinwheel', 'fluff', 'windseed']) world.enemies.push(createEnemy(DATA.enemies.get(id), 600, 300, 0, world.rng));
    drawEnemies(g, world);
  });
});
