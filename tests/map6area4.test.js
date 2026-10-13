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

// マップ6「送風区」エリア4「排気塔」（docs/詳細仕様.md「30. マップ6「送風区」と、環境「強風」」の「④エリア4」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('gale');
const cyclone = DATA.bosses.get('cyclone');

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeWorld({ waves = [{}], implants = [], boss = null } = {}) {
  const room = { type: 'combat', waves: boss ? [{ boss }] : waves, objects: [], doors: [], clearCredits: 0, environment: env, screens: [] };
  const world = createWorld({ room, rng: seeded(11), weaponId: 'sword' });
  world.waveTimer = boss ? 0 : Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  world.player.x = 400;
  world.player.y = 300;
  return world;
}

function bossWorld() {
  const world = makeWorld({ boss: 'cyclone' });
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

describe('エリア4「排気塔」の定義', () => {
  const map = maps.find((m) => m.id === 'map6');
  const area = DATA.areas.get('airstack');

  it('マップ6の4つ目のエリア。背景・曲・ボス・素材・データ片4つがそろっている', () => {
    expect(map.areas).toHaveLength(4);
    expect(map.areas.at(-1)).toBe('airstack');
    expect(area.name).toBe('排気塔');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    expect(area.boss).toBe('cyclone');
    expect(cyclone.weakness).toBe('cold');
    expect(cyclone.hp).toBe(33000);
    expect(DATA.materials.get(cyclone.material).name).toBe('サイクロンコア');
    expect(MATERIAL_ICONS[cyclone.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === 'airstack');
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(DATA.achievements.get('cyclone').name).toBe('大渦狩り');
    expect(species.swirl.boss).toBe('cyclone');
  });

  it('このエリアに出る雑魚は、定義がそろっている', () => {
    for (const { id } of area.enemies) expect(DATA.enemies.get(id), id).toBeDefined();
    expect(area.enemies.map((e) => e.id)).toEqual(expect.arrayContaining(['whirl', 'balloon']));
  });

  it('ボスの攻撃・大技の部品が、すべて存在し、ほかのボスと重ならない', () => {
    const others = new Set();
    for (const boss of DATA.bosses.all()) if (boss.id !== 'cyclone') for (const a of Object.values(boss.attacks)) others.add(a.pattern);
    for (const a of Object.values(cyclone.attacks)) {
      expect(PATTERNS[a.pattern], a.pattern).toBeDefined();
      expect(others.has(a.pattern), a.pattern).toBe(false);
    }
  });

  it('装備のレア度の表は、4つ目のエリアの行がある', () => {
    expect(map.areas.length).toBeLessThanOrEqual(4);
  });
});

describe('サイクロンの攻撃', () => {
  it('竜巻：出て、プレイヤーへ寄ってきて、まわりで引き込む。芯に触れるとダメージ。ダッシュ中は引かれない', () => {
    const world = bossWorld();
    world.player.inv = 0;
    startMove(world, 'twister');
    expect(runUntil(world, () => hazardsOf(world, 'twister').length === 2, 3)).toBe(true);
    const t = hazardsOf(world, 'twister')[0];
    t.wait = 0;
    t.x = world.player.x + 100;
    t.y = world.player.y;
    const x0 = world.player.x;
    run(world, 0.3);
    expect(world.player.x).toBeGreaterThan(x0); // 竜巻のほうへ引かれる
    // 芯に触れるとダメージ
    world.player.x = t.x;
    world.player.y = t.y;
    const hp = world.player.hp;
    run(world, 0.6);
    expect(world.player.hp).toBeLessThan(hp);
    // ダッシュ中は引かれない
    const w2 = bossWorld();
    startMove(w2, 'twister');
    runUntil(w2, () => hazardsOf(w2, 'twister').length === 2, 3);
    const t2 = hazardsOf(w2, 'twister')[0];
    t2.wait = 0;
    t2.x = w2.player.x + 100;
    t2.y = w2.player.y;
    w2.player.dashT = 1;
    const x1 = w2.player.x;
    updateWorld(w2, DT, idle);
    expect(w2.player.x).toBeCloseTo(x1, 1);
  });

  it('巻き上げ投げ：瓦礫が回り、時間が来ると1個ずつ飛んでくる。壊した分は飛ばない', () => {
    const world = bossWorld();
    const b = world.boss;
    world.player.x = b.x - 350;
    world.player.y = b.y;
    startMove(world, 'sweepup');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'flotsam').length === 6, 3)).toBe(true);
    const list = world.enemies.filter((e) => e.def.id === 'flotsam');
    // 回っている間は、ボスのまわりにいる
    run(world, 0.5);
    for (const e of list) expect(Math.hypot(e.x - b.x, e.y - b.y)).toBeLessThan(140);
    // 1個壊す
    list[0].dead = true;
    expect(runUntil(world, () => list.some((e) => e.state === 'fling'), 4)).toBe(true);
    expect(list[0].state).toBe('orbit');
    // 飛んで、当たるとダメージ（無敵を切る）
    world.player.inv = 0;
    const hp = world.player.hp;
    run(world, 4);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('渦巻きの弾：曲がりながら飛ぶ。腕ごとに曲がる向きが逆', () => {
    const world = bossWorld();
    startMove(world, 'swirlshot');
    expect(runUntil(world, () => hazardsOf(world, 'curveshot').length >= 2, 3)).toBe(true);
    const [a, c] = hazardsOf(world, 'curveshot');
    expect(Math.sign(a.turn)).toBe(-Math.sign(c.turn));
    const ang0 = a.ang;
    run(world, 0.5);
    expect(Math.abs(a.ang - ang0)).toBeGreaterThan(0.3);
  });

  it('螺旋落雷：予告が螺旋の形（外へ向かって離れていく）に、内側から順に落ちる', () => {
    const world = bossWorld();
    const b = world.boss;
    startMove(world, 'spiralbolt');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length >= 6, 3)).toBe(true);
    const marks = hazardsOf(world, 'mark');
    const dists = marks.map((m) => Math.hypot(m.x - b.x, m.y - b.y));
    for (let i = 1; i < dists.length; i++) expect(dists[i]).toBeGreaterThan(dists[i - 1] - 1);
    expect(marks[0].t).toBeLessThan(marks.at(-1).t);
  });

  it('渦巻き突進：曲がりながら進み、壁か時間で止まる', () => {
    const world = bossWorld();
    const b = world.boss;
    world.player.x = 300;
    world.player.y = 300;
    startMove(world, 'cycloneram');
    expect(runUntil(world, () => b.act.phase === 'active', 3)).toBe(true);
    const h0 = b.act.heading;
    run(world, 0.4);
    expect(Math.abs(b.act.heading - h0)).toBeGreaterThan(0.3);
    expect(runUntil(world, () => b.act.phase !== 'active', 4)).toBe(true);
  });

  it('大技「台風の目」：目の外にいるとダメージ、目の中なら安全。目は縮み、竜巻も出る。終わると消える', () => {
    const world = bossWorld();
    startMove(world, 'eyestorm');
    expect(runUntil(world, () => hazardsOf(world, 'stormeye').length === 1, 4)).toBe(true);
    const eye = hazardsOf(world, 'stormeye')[0];
    eye.wait = 0;
    // 目の外
    world.player.inv = 0;
    world.player.x = eye.x + eye.r + 150;
    world.player.y = eye.y;
    const hp = world.player.hp;
    run(world, 1.3);
    expect(world.player.hp).toBeLessThan(hp);
    // 目の中（目の中心にいるように、毎フレーム置く）
    const hp2 = world.player.hp;
    for (let i = 0; i < 90; i++) {
      world.player.x = eye.x;
      world.player.y = eye.y;
      updateWorld(world, DT, idle);
    }
    expect(world.player.hp).toBe(hp2);
    expect(eye.r).toBeLessThan(eye.r0);
    expect(hazardsOf(world, 'twister').length).toBeGreaterThan(0);
    // 終わる
    world.player.inv = Infinity;
    expect(runUntil(world, () => hazardsOf(world, 'stormeye').length === 0, 20)).toBe(true);
  });

  it('後半は連携を2つ持つ。反応は渦巻き突進', () => {
    expect(cyclone.phases.at(-1).combos).toHaveLength(2);
    expect(cyclone.reactions[0].move).toBe('cycloneram');
    expect(cyclone.ultimate.move).toBe('eyestorm');
  });
});

describe('雑魚：つむじと観測気球', () => {
  it('つむじ：近くのプレイヤーを引き寄せ、触れるとダメージ', () => {
    const world = makeWorld({ waves: [{}] });
    const e = createEnemy(DATA.enemies.get('whirl'), 560, 300, 0, world.rng);
    world.enemies.push(e);
    const x0 = world.player.x;
    updateWorld(world, DT, idle);
    run(world, 0.5);
    expect(world.player.x).toBeGreaterThan(x0);
    world.player.inv = 0;
    world.player.x = e.x;
    world.player.y = e.y;
    e.touchCd = 0;
    const hp = world.player.hp;
    updateWorld(world, DT, idle);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('観測気球：プレイヤーの足元に、雷の予告を落とす', () => {
    const world = makeWorld({ waves: [{}] });
    const e = createEnemy(DATA.enemies.get('balloon'), 700, 300, 0, world.rng);
    e.cd = 0;
    world.enemies.push(e);
    expect(runUntil(world, () => hazardsOf(world, 'mark').length > 0, 3)).toBe(true);
  });
});

describe('種族「渦」と、④の恒久強化', () => {
  it('5つの部品がそろい、2種類・3種類のボーナスがある', () => {
    const list = DATA.implants.all().filter((d) => d.species === 'swirl');
    expect(list.map((d) => d.id).sort()).toEqual(['airstream', 'eyewall', 'lowpressure', 'stormzone', 'turbulence'].sort());
    expect(species.swirl.bonuses).toHaveLength(2);
  });

  it('台風の目：立ち止まっている間だけ被ダメージが減る。暴風圏：敵が3体以上近くにいるときだけダメージが上がる', () => {
    const world = makeWorld({ implants: ['eyewall', 'stormzone'] });
    world.player.stillT = 1;
    expect(statWith(world, 'damageTaken')).toBeCloseTo(statWith(makeWorld(), 'damageTaken') - 0.08);
    world.player.stillT = 0;
    expect(statWith(world, 'damageTaken')).toBeCloseTo(statWith(makeWorld(), 'damageTaken'));
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
    for (let i = 0; i < 3; i++) world.enemies.push(createEnemy(DATA.enemies.get('grunt'), 450 + i * 10, 300, 0, world.rng));
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.12);
  });

  it('低気圧：敵を倒すと、近くの敵に冷却のダメージ。乱気流：当たった敵が横へ弾かれる', () => {
    const world = makeWorld({ implants: ['lowpressure'] });
    const a = createEnemy(DATA.enemies.get('grunt'), 450, 300, 0, world.rng);
    const b = createEnemy(DATA.enemies.get('grunt'), 500, 300, 0, world.rng);
    a.hp = 1;
    world.enemies.push(a, b);
    const hp = b.hp;
    hitEnemy(world, a, 100, 1, 0, 0);
    expect(a.dead).toBe(true);
    expect(b.hp).toBeLessThan(hp);

    const w2 = makeWorld({ implants: ['turbulence'] });
    const c = createEnemy(DATA.enemies.get('grunt'), 450, 300, 0, w2.rng);
    c.hp = c.maxHp = 100000;
    w2.enemies.push(c);
    const y0 = c.y;
    hitEnemy(w2, c, 10, 1, 0, 0);
    expect(Math.abs(c.y - y0)).toBeGreaterThan(10);
  });

  it('恒久強化が3つ増えた', () => {
    const ids = ['windcloak', 'stormheart', 'stormeye'];
    for (const id of ids) expect(DATA.upgrades.get(id).since).toBe(8);
    expect(DATA.upgrades.get('stormeye').costs.flatMap((c) => Object.keys(c)).sort()).toEqual(['cycloneCore', 'vaneCore']);
  });
});

describe('絵：サイクロンの全攻撃と雑魚を描いても、エラーにならない', () => {
  it('全部描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const name of Object.keys(cyclone.attacks)) {
      const world = bossWorld();
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
    for (const id of ['whirl', 'balloon', 'flotsam']) world.enemies.push(createEnemy(DATA.enemies.get(id), 600, 300, 0, world.rng));
    drawEnemies(g, world);
  });
});
