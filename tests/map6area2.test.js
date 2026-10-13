import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { ventSpots } from '../src/logic/ventSpots.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ6「送風区」エリア2「送風路」（docs/詳細仕様.md「30. マップ6「送風区」と、環境「強風」」の「②エリア2」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('gale');
const duct = DATA.bosses.get('ductcrawler');

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
  const world = makeWorld({ boss: 'ductcrawler' });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  const b = world.boss;
  b.idleT = Infinity;
  b.x = 700;
  b.y = 160;
  world.player.inv = Infinity;
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

function addEnemy(world, id, x, y) {
  const e = createEnemy(DATA.enemies.get(id), x, y, 0, world.rng);
  e.cd = 99;
  e.hp = e.maxHp = 1000000;
  world.enemies.push(e);
  return e;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

const sweepOf = (world) => world.hazards.find((h) => h.type === 'sweep');

// seconds 秒のあいだに出た予告の円（'mark'）を、出た順に集める
function collectMarks(world, seconds, input = idle) {
  const seen = new Set();
  const marks = [];
  for (let t = 0; t < seconds; t += DT) {
    updateWorld(world, DT, input);
    for (const h of world.hazards) {
      if (h.type === 'mark' && !seen.has(h)) {
        seen.add(h);
        marks.push({ x: h.x, y: h.y, r: h.r, from: h.from, playerX: world.player.x });
      }
    }
  }
  return marks;
}

describe('エリア2「送風路」の定義', () => {
  const map = maps.find((m) => m.id === 'map6');
  const area = DATA.areas.get('airduct');

  it('マップ6の2つ目のエリア。背景・曲・ボス・素材・データ片4つがそろっている', () => {
    expect(map.areas).toEqual(['airintake', 'airduct', 'airgarden', 'airstack']);
    expect(area.name).toBe('送風路');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    expect(area.boss).toBe('ductcrawler');
    expect(duct.weakness).toBe('heat');
    expect(DATA.materials.get(duct.material).name).toBe('ダクトコア');
    expect(MATERIAL_ICONS[duct.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === area.id);
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(DATA.achievements.get('ductcrawler').name).toBe('管這い狩り');
    for (const id of area.enemies.map((e) => e.id)) expect(DATA.enemies.get(id), id).toBeDefined();
  });

  it('ボス素材は、インテークコアの次（隠しボスの素材より前）に並ぶ', () => {
    const ids = DATA.materials.all().map((m) => m.id);
    expect(ids.indexOf('ductCore')).toBe(ids.indexOf('intakeCore') + 1);
    expect(ids.indexOf('ductCore')).toBeLessThan(ids.indexOf('architectCore'));
  });

  it('マップ6から強く：ボスの HP は前のボスより +4000、雑魚は同じ役割の敵より強い', () => {
    expect(duct.hp).toBe(DATA.bosses.get('intake').hp + 4000);
    expect(DATA.enemies.get('ductrat').hp).toBeGreaterThanOrEqual(DATA.enemies.get('windrider').hp * 1.2);
    expect(DATA.enemies.get('heater').hp).toBeGreaterThan(DATA.enemies.get('anchorer').hp);
    expect(DATA.enemies.get('heater').damage).toBeGreaterThan(DATA.enemies.get('anchorer').damage);
  });

  it('ボスには、そのボスだけの固有の攻撃が2つあり、1段階目から使う。後半には連携がある', () => {
    const patterns = new Set(Object.values(duct.attacks).map((a) => a.pattern));
    expect(patterns.has('sweep')).toBe(true);
    expect(patterns.has('ventburst')).toBe(true);
    expect(duct.phases[0].moves.some((m) => duct.attacks[m].pattern === 'sweep')).toBe(true);
    expect(duct.phases[0].moves.some((m) => duct.attacks[m].pattern === 'ventburst')).toBe(true);
    expect(duct.phases.at(-1).combos.length).toBeGreaterThanOrEqual(1);
    expect(duct.attacks[duct.ultimate.move].pattern).toBe('blowthrough');
    // 潜行（パイプサーペント）の部品は使わない
    expect(patterns.has('burrow')).toBe(false);
  });
});

describe('雑魚：ダクトネズミ・熱吹き', () => {
  it('ダクトネズミは、風に流されない。風乗りは流される', () => {
    const world = makeWorld();
    world.player.x = 100;
    world.player.y = 300;
    const rat = addEnemy(world, 'ductrat', 600, 100);
    const rider = addEnemy(world, 'windrider', 600, 500);
    for (const e of [rat, rider]) e.def = { ...e.def, speed: 0 };
    world.wind = { phase: 'blow', t: 4, max: 4, dirX: 0, dirY: 1 };
    run(world, 1);
    expect(rat.x).toBe(600);
    expect(rat.y).toBe(100);
    expect(rider.y).not.toBe(500);
  });

  it('熱吹きは、熱の柱を一列に3本、プレイヤーのいる場所を真ん中にして出す', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'heater', 700, 300);
    e.def = { ...e.def, speed: 0 };
    e.cd = 0;
    world.countdown = 0;
    const marks = collectMarks(world, 2);
    expect(marks.length).toBeGreaterThanOrEqual(3);
    const first = marks.slice(0, 3);
    expect(first.every((m) => m.r === e.def.lob.radius && m.from === undefined)).toBe(true);
    const xs = first.map((m) => m.x).sort((a, b) => a - b);
    expect(xs[1]).toBeCloseTo(world.player.x, 0);
    expect(xs[1] - xs[0]).toBeCloseTo(e.def.lob.spacing, 0);
    expect(xs[2] - xs[1]).toBeCloseTo(e.def.lob.spacing, 0);
  });
});

describe('ボス「ダクトクローラー」：横断', () => {
  // rng は 0.99 なので、縦向き（axis: y）で、下から上へ進む
  function sweepSetup() {
    const world = bossWorld();
    startMove(world, 'sweep');
    const h = sweepOf(world);
    run(world, duct.attacks.sweep.telegraph + 0.05);
    expect(h.phase).toBe('run');
    return { world, h };
  }

  it('予告の間は、プレイヤーを追って帯が動き、最後に止まる。ボスは入口の壁ぎわにいる', () => {
    const world = bossWorld();
    startMove(world, 'sweep');
    const h = sweepOf(world);
    expect(h.axis).toBe('y');
    expect(h.dir).toBe(-1);
    run(world, 0.3);
    world.player.x = 500;
    run(world, 0.1);
    expect(h.cross).toBeCloseTo(500, 0);
    run(world, duct.attacks.sweep.telegraph - 0.4 - 0.1 + 0.05);
    const locked = h.cross;
    world.player.x = 300;
    run(world, 0.1);
    expect(h.cross).toBe(locked);
    expect(Math.abs(world.boss.y - world.bounds.bottom)).toBeLessThan(70);
  });

  it('帯の上で、継ぎ目の外にいると当たる。継ぎ目の中、帯の外にいると当たらない', () => {
    const results = {};
    for (const spot of ['body', 'seam', 'outside']) {
      const { world, h } = sweepSetup();
      const p = world.player;
      p.inv = 0;
      const lo = world.bounds.top;
      const hi = world.bounds.bottom;
      // 先頭（ボス本体）に触れない位置：帯の端（中心から 62px）
      p.x = h.cross + 62;
      p.y = spot === 'seam' ? h.seams[0].pos : lo + (hi - lo) * 0.56;
      if (spot === 'outside') p.x = h.cross + h.width / 2 + p.r + 40;
      const before = p.hp;
      run(world, 3);
      results[spot] = before - p.hp;
    }
    expect(results.body).toBeGreaterThan(0);
    expect(results.seam).toBe(0);
    expect(results.outside).toBe(0);
  });

  it('体が通り抜けたら、技が終わる。ボスは出口の壁ぎわにいる', () => {
    const { world, h } = sweepSetup();
    const b = world.boss;
    const act = b.act;
    for (let t = 0; t < 4 && !h.done; t += DT) updateWorld(world, DT, idle);
    expect(h.done).toBe(true);
    expect(Math.abs(b.y - world.bounds.top)).toBeLessThan(70); // 出口の壁ぎわまで進んでいる
    run(world, 1.5);
    expect(b.act).not.toBe(act); // 技が終わって、次の技に移っている
  });

  it('第2段階の横断は、継ぎ目が1か所に減る', () => {
    expect(duct.attacks.sweep.seams).toBe(2);
    expect(duct.attacks.sweepHard.seams).toBe(1);
    expect(duct.phases[1].moves).toContain('sweepHard');
  });
});

describe('ボス「ダクトクローラー」：熱排気', () => {
  it('通気口は部屋に8か所。柱は、その通気口のどれかに出る', () => {
    const world = bossWorld();
    expect(ventSpots(world.bounds)).toHaveLength(8);
    startMove(world, 'ventburst');
    const marks = collectMarks(world, 4);
    const spots = ventSpots(world.bounds);
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) expect(spots.some((s) => s.x === m.x && s.y === m.y)).toBe(true);
  });

  it('プレイヤーが右へ走り続けていると、柱は、走る先（右）の通気口に出る。直前と同じ口には続けて出ない', () => {
    const world = bossWorld();
    const p = world.player;
    p.x = 220;
    startMove(world, 'ventburst');
    const marks = collectMarks(world, 1.6, { ...idle, mx: 1 });
    expect(marks.length).toBeGreaterThanOrEqual(2);
    for (const m of marks) expect(m.x).toBeGreaterThan(m.playerX);
    for (let i = 1; i < marks.length; i++) expect(marks[i].x === marks[i - 1].x && marks[i].y === marks[i - 1].y).toBe(false);
  });

  it('柱の数は、第1段階が 5、第2段階が 8', () => {
    expect(duct.attacks.ventburst.count).toBe(5);
    expect(duct.attacks.ventburstHard.count).toBe(8);
    const world = bossWorld();
    const act = startMove(world, 'ventburst');
    run(world, 6);
    expect(act.fired).toBe(5);
    expect(world.boss.act).not.toBe(act); // 技が終わっている
  });
});

describe('ボス「ダクトクローラー」：大技「吹き抜け」', () => {
  it('横断が3本、時間差で通り、熱排気も重なる。終わったら技が終わる', () => {
    const world = bossWorld();
    const act = startMove(world, 'blowthrough');
    const def = duct.attacks.blowthrough;
    run(world, def.telegraph + def.stagger * 2 + 0.2);
    expect(act.hs).toHaveLength(3);
    expect(act.hs.map((h) => h.axis)).toEqual(['y', 'x', 'y']);
    expect(act.hs.filter((h) => h.drive)).toHaveLength(1);
    run(world, 12);
    expect(act.fired).toBe(def.vents.count);
    expect(world.boss.act).not.toBe(act); // 技が終わっている
    expect(world.hazards.some((h) => h.type === 'sweep')).toBe(false);
  });

  it('HP が残りわずかになると、1回だけ大技を出す', () => {
    const world = bossWorld();
    const b = world.boss;
    b.idleT = 0;
    b.hp = b.maxHp * 0.2;
    updateWorld(world, DT, idle);
    expect(b.ultimateDone).toBe(true);
    expect(b.act.def.pattern).toBe('blowthrough');
  });
});

describe('種族「管」', () => {
  it('管は5種類。ダクトクローラーの種族', () => {
    expect(DATA.implants.all().filter((d) => d.species === 'duct')).toHaveLength(5);
  });

  it('継ぎ目：攻撃が当たった敵が、減速する', () => {
    const world = makeWorld({ implants: ['ductseam'] });
    const e = addEnemy(world, 'grunt', 420, 300);
    expect(e.slowT).toBe(0);
    hitEnemy(world, e, 10, 1, 0, 0);
    expect(e.slowT).toBeGreaterThan(0);
  });

  it('通気：ダッシュのあと1秒間だけ、移動速度 +15%', () => {
    const world = makeWorld({ implants: ['airflow'] });
    expect(statWith(world, 'moveSpeedMul')).toBeCloseTo(1, 5);
    world.player.sinceDash = 0.5;
    expect(statWith(world, 'moveSpeedMul')).toBeCloseTo(1.15, 5);
    world.player.sinceDash = 1.5;
    expect(statWith(world, 'moveSpeedMul')).toBeCloseTo(1, 5);
  });

  it('熱だまり：燃えている敵にだけ、ダメージ +12%', () => {
    const world = makeWorld({ implants: ['heatpool'] });
    const e = addEnemy(world, 'grunt', 420, 300);
    const base = statWith(world, 'attackMul', e);
    e.burnT = 2;
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(base + 0.12, 5);
  });

  it('排気弁：被弾すると、まわりの敵に熱風が当たり、外へ吹き飛ぶ。遠い敵は動かない', () => {
    const world = makeWorld({ implants: ['ventvalve'] });
    const near = addEnemy(world, 'grunt', 460, 300);
    const far = addEnemy(world, 'grunt', 900, 300);
    world.player.inv = 0;
    hurtPlayer(world, 10);
    expect(near.maxHp - near.hp).toBeGreaterThan(0);
    expect(near.x).toBeGreaterThan(460 + 60);
    expect(far.x).toBe(900);
  });

  it('結露：敵を倒すと、近くの敵が減速する', () => {
    const world = makeWorld({ implants: ['condense'] });
    const dying = addEnemy(world, 'grunt', 440, 300);
    const near = addEnemy(world, 'grunt', 480, 300);
    const far = addEnemy(world, 'grunt', 900, 300);
    dying.hp = 1;
    hitEnemy(world, dying, 10, 1, 0, 0);
    expect(dying.dead).toBe(true);
    expect(near.slowT).toBeGreaterThan(0);
    expect(far.slowT).toBe(0);
  });

  it('種族ボーナス：2種類でダッシュの回復が速い。3種類で、減速中の敵へのダメージが上がる', () => {
    const two = makeWorld({ implants: ['ductseam', 'airflow'] });
    expect(two.player.stats.dashHaste).toBeCloseTo(0.1, 5);
    const three = makeWorld({ implants: ['ductseam', 'airflow', 'condense'] });
    const e = addEnemy(three, 'grunt', 420, 300);
    const base = statWith(three, 'attackMul', e);
    e.slowT = 1;
    expect(statWith(three, 'attackMul', e)).toBeCloseTo(base + 0.15, 5);
  });
});
