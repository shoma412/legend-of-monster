import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { addLight, blindPlayer, darkEnv, isVisible, lightSources, litByLamp, placeLamps, visionRadius } from '../src/game/darkness.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, enterRoom, handleEvents } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { brightness, darkStrips } from '../src/logic/darkCells.js';
import { mapState, recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ4「停電区」と、環境「暗闇」（docs/詳細仕様.md「24. マップ4「停電区」と、環境「暗闇」」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('dark');

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 暗闇の部屋。lamps は非常灯の場所
function darkWorld({ lamps = [], waves = [{}], implants = [] } = {}) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment: env, lamps };
  const world = createWorld({ room, rng: () => 0.5, weaponId: 'sword' });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  return world;
}

function addEnemy(world, id, x, y) {
  const e = createEnemy(DATA.enemies.get(id), x, y, 0, world.rng);
  e.cd = 99;
  world.enemies.push(e);
  return e;
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

describe('マップ4「停電区」の定義', () => {
  it('エリア1 消灯街：色・背景・敵・ボス・素材・データ片がそろっている。環境は暗闇', () => {
    const map = maps[3];
    expect(map.id).toBe('map4');
    expect(map.environment).toBe('dark');
    expect(map.areas[0]).toBe('darkstreet');
    const area = DATA.areas.get('darkstreet');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const id of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(id), id).toBe(true);
    const boss = DATA.bosses.get(area.boss);
    expect(MATERIAL_ICONS[boss.material]).toBeDefined();
    const frags = DATA.fragments.all().filter((f) => f.area === 'darkstreet');
    expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(mapSpecies(map)).toContain('moth');
  });

  it('マップ3の完了と、建設区の通行証がそろうと、出撃できる。部屋には環境が付く', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3']) recordMapClear(save, id, 1);
    expect(mapState(save, maps[3])).toBe('locked');
    save.passes.push('map3');
    expect(mapState(save, maps[3])).toBe('open');
    const world = enterRoom(createRun({ rng: seeded(4), save, mapId: 'map4', weaponId: 'sword' }));
    expect(darkEnv(world)).toBe(env);
    expect(world.lamps.length).toBeGreaterThanOrEqual(env.lamps.count.min);
    expect(world.lamps.length).toBeLessThanOrEqual(env.lamps.count.max);
    expect(world.room.enemyScale).toBeCloseTo(3);
  });

  it('明るいマップの部屋には、環境も非常灯もない', () => {
    const world = enterRoom(createRun({ rng: seeded(4), save: createSave(), mapId: 'map1' }));
    expect(darkEnv(world)).toBeNull();
    expect(world.lamps).toHaveLength(0);
    expect(visionRadius(world)).toBe(Infinity);
    expect(isVisible(world, 900, 500)).toBe(true);
  });

  it('ランプイーターを倒すと、モスコアと実績が手に入る', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3']) recordMapClear(save, id, 1);
    save.passes.push('map3');
    const r = createRun({ rng: seeded(7), save, mapId: 'map4', weaponId: 'sword' });
    r.plan.current = 'boss';
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('lampeater');
    expect(world.lamps.length).toBeGreaterThan(0); // ボス部屋にも非常灯がある
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.materials.mothCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('lampeater');
  });
});

describe('暗闇：見える範囲', () => {
  it('プレイヤーのまわりの円の中だけが見える。遠くは見えない', () => {
    const world = darkWorld();
    const p = world.player;
    expect(visionRadius(world)).toBe(env.vision);
    expect(isVisible(world, p.x + env.vision - 5, p.y)).toBe(true);
    expect(isVisible(world, p.x + env.vision + 30, p.y)).toBe(false);
  });

  it('目くらみになると、見える円が狭くなり、時間がたつと戻る。ダッシュでは消えない', () => {
    const world = darkWorld();
    const p = world.player;
    blindPlayer(world);
    expect(visionRadius(world)).toBeCloseTo(env.vision * env.blind.scale);
    updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
    expect(p.blindT).toBeGreaterThan(0);
    run(world, env.blind.duration + 0.1);
    expect(visionRadius(world)).toBe(env.vision);
  });

  it('攻撃が当たると、その場所が一瞬照らされる', () => {
    const world = darkWorld();
    const p = world.player;
    const e = addEnemy(world, 'grunt', p.x + 400, p.y);
    e.hp = e.maxHp = 100000;
    expect(isVisible(world, e.x, e.y)).toBe(false);
    hitEnemy(world, e, 10, 1, 0, 0);
    expect(isVisible(world, e.x, e.y)).toBe(true);
    run(world, env.flash.life + 0.1);
    expect(isVisible(world, e.x, e.y)).toBe(false);
  });

  it('暗さの塗り方：光の真ん中は塗らず、縁はだんだん暗く、外は真っ暗。光がいくつあっても、明るいほうを取る', () => {
    const lights = [{ x: 100, y: 100, r: 100 }];
    expect(brightness(100, 100, lights, 0.25)).toBe(1);
    expect(brightness(100 + 74, 100, lights, 0.25)).toBe(1);
    const edge = brightness(100 + 90, 100, lights, 0.25);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
    expect(brightness(100 + 101, 100, lights, 0.25)).toBe(0);
    expect(brightness(300, 100, [...lights, { x: 300, y: 100, r: 50 }], 0.25)).toBe(1);

    const rect = { left: 0, top: 0, right: 240, bottom: 120 };
    const strips = darkStrips(rect, 12, lights, 0.25, 4);
    // 帯は枠の中に収まり、重ならない。真ん中のマスは塗らない
    let area = 0;
    for (const s of strips) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w).toBeLessThanOrEqual(240);
      expect(s.level).toBeGreaterThan(0);
      expect(s.level).toBeLessThanOrEqual(4);
      area += s.w * s.h;
      const coversCenter = s.x <= 100 && s.x + s.w > 100 && s.y <= 100 && s.y + s.h > 100;
      expect(coversCenter).toBe(false);
    }
    expect(area).toBeLessThan(240 * 120);
    // 光がなければ、全部がいちばん暗い段階で、行ごとに1本の帯にまとまる
    const all = darkStrips(rect, 12, [], 0.25, 4);
    expect(all).toHaveLength(10);
    expect(all.every((s) => s.level === 4 && s.w === 240)).toBe(true);
  });
});

describe('暗闇：非常灯', () => {
  it('非常灯は決まった本数で、部屋の中に重ならずに置かれる', () => {
    const bounds = { left: 28, top: 31, right: 932, bottom: 512 };
    for (let seed = 1; seed <= 50; seed++) {
      const lamps = placeLamps(env, bounds, seeded(seed * 7919));
      expect(lamps.length).toBeGreaterThanOrEqual(env.lamps.count.min);
      expect(lamps.length).toBeLessThanOrEqual(env.lamps.count.max);
      for (const l of lamps) {
        expect(l.x).toBeGreaterThan(bounds.left + 100);
        expect(l.x).toBeLessThan(bounds.right - 100);
      }
      expect(new Set(lamps.map((l) => `${l.x},${l.y}`)).size).toBe(lamps.length);
    }
  });

  it('近づくと点いて、まわりが見えるようになる。時間がたつと消え、また近づけば点く', () => {
    const world = darkWorld({ lamps: [{ x: 600, y: 300 }] });
    const p = world.player;
    const lamp = world.lamps[0];
    run(world, 0.2);
    expect(lamp.on).toBeLessThanOrEqual(0);
    expect(isVisible(world, 600 + 100, 300)).toBe(false);
    p.x = 600 + env.lamps.trigger - 5;
    p.y = 300;
    updateWorld(world, DT, idle);
    expect(lamp.on).toBeGreaterThan(0);
    // 離れても、しばらくは照らし続ける
    p.x = 120;
    p.y = 120;
    run(world, env.lamps.duration - 1);
    expect(litByLamp(world, 600 + 100, 300)).toBe(true);
    expect(isVisible(world, 600 + 100, 300)).toBe(true);
    expect(lightSources(world)).toHaveLength(1);
    run(world, 1.5);
    expect(lamp.on).toBeLessThanOrEqual(0);
    expect(isVisible(world, 600 + 100, 300)).toBe(false);
    p.x = 600;
    p.y = 300;
    updateWorld(world, DT, idle);
    expect(lamp.on).toBeGreaterThan(0);
  });
});

describe('マップ4の雑魚', () => {
  it('忍び寄り：暗闇では速く近づいてくる。非常灯に照らされている間は動けない。プレイヤーのまわりの円は、光に数えない', () => {
    const world = darkWorld({ lamps: [{ x: 600, y: 270 }] });
    const p = world.player;
    p.inv = Infinity;
    const e = addEnemy(world, 'stalker', 600, 270);
    const x = e.x;
    run(world, 0.5);
    expect(e.x).toBeLessThan(x - 40); // 暗いので、近づいてくる
    // 非常灯を点ける
    world.lamps[0].on = 5;
    e.x = 600;
    e.y = 270;
    run(world, 0.5);
    expect(e.x).toBeCloseTo(600, 0);
    expect(e.lit).toBe(true);
    // プレイヤーのすぐ近く（見える円の中）でも、灯りがなければ動く
    world.lamps[0].on = 0;
    e.x = p.x + 100;
    e.y = p.y;
    run(world, 0.2);
    expect(e.x).toBeLessThan(p.x + 90);
  });

  it('忍び寄り：攻撃の光でも、一瞬止まる', () => {
    const world = darkWorld();
    world.player.inv = Infinity;
    const e = addEnemy(world, 'stalker', 700, 270);
    addLight(world, 700, 270, 100, 0.5);
    const x = e.x;
    run(world, 0.2);
    expect(e.x).toBeCloseTo(x, 0);
    run(world, 0.6);
    expect(e.x).toBeLessThan(x - 10);
  });

  it('灯り割り：点いている非常灯へ向かい、壊す。壊された非常灯は、しばらく点かない。非常灯がなければ、プレイヤーへ向かう', () => {
    const world = darkWorld({ lamps: [{ x: 700, y: 150 }] });
    const p = world.player;
    p.inv = Infinity;
    const lamp = world.lamps[0];
    lamp.on = 30;
    const e = addEnemy(world, 'lampbreaker', 500, 400);
    expect(runUntil(world, () => lamp.broken > 0, 8)).toBe(true);
    expect(lamp.on).toBe(0);
    expect(Math.hypot(e.x - 700, e.y - 150)).toBeLessThan(40);
    // 壊れている間は、近づいても点かない
    p.x = 700;
    p.y = 150 + 30;
    e.x = 100;
    e.y = 480;
    updateWorld(world, DT, idle);
    expect(lamp.on).toBeLessThanOrEqual(0);
    // そのあとは、プレイヤーへ向かう
    const d0 = Math.hypot(e.x - p.x, e.y - p.y);
    run(world, 0.5);
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(d0 - 20);
    // 時間がたてば、また点く（灯り割りがいると、すぐまた壊されるので、いなくなってから確かめる）
    world.enemies = [];
    run(world, DATA.enemies.get('lampbreaker').breakTime);
    expect(lamp.on).toBeGreaterThan(0);
  });

  it('発光虫：倒すと、その場にしばらく光が残る', () => {
    const world = darkWorld();
    const e = addEnemy(world, 'glowbug', 700, 300);
    expect(isVisible(world, 700, 300)).toBe(false);
    hitEnemy(world, e, 9999, 1, 0, 0);
    run(world, 1);
    expect(isVisible(world, 700, 300)).toBe(true);
    run(world, DATA.enemies.get('glowbug').deathLight.life);
    expect(isVisible(world, 700, 300)).toBe(false);
  });
});

describe('ランプイーター', () => {
  function bossWorld(lamps = [{ x: 300, y: 150 }, { x: 650, y: 400 }]) {
    const world = darkWorld({ lamps, waves: [{ boss: 'lampeater' }] });
    world.waveTimer = 0;
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.boss.idleT = Infinity;
    world.boss.ultimateDone = true;
    return world;
  }
  function start(world, name) {
    const b = world.boss;
    const p = world.player;
    b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
    PATTERNS[b.act.def.pattern].start(world, b, b.act, { dx: p.x - b.x, dy: p.y - b.y, dist: Math.hypot(p.x - b.x, p.y - b.y) || 1 });
    return b.act;
  }
  const keepIdle = (world, cond, limit) => {
    for (let t = 0; t < limit; t += DT) {
      if (cond()) return true;
      world.boss.idleT = Infinity;
      updateWorld(world, DT, idle);
    }
    return false;
  };

  it('そのボスだけの攻撃（消灯・鱗粉）を持ち、前半から使う', () => {
    const def = DATA.bosses.get('lampeater');
    for (const pattern of ['douse', 'scales']) {
      expect(def.phases[0].moves.some((m) => def.attacks[m].pattern === pattern), pattern).toBe(true);
      for (const other of DATA.bosses.all()) {
        if (other.id !== 'lampeater') expect(Object.values(other.attacks).some((a) => a.pattern === pattern), other.id).toBe(false);
      }
    }
  });

  it('消灯：予告のあと、点いていた非常灯がすべて消え、1本は壊れる。暗闇の中で位置を変え、予告つきで突進してくる', () => {
    const world = bossWorld();
    const b = world.boss;
    const p = world.player;
    p.inv = Infinity;
    for (const lamp of world.lamps) lamp.on = 30;
    b.x = 800;
    b.y = 270;
    p.x = 200;
    p.y = 270;
    const act = start(world, 'douse');
    keepIdle(world, () => false, act.def.telegraph - 0.1);
    expect(world.lamps.every((l) => l.on > 0)).toBe(true); // 予告の間は、まだ消えない
    expect(keepIdle(world, () => act.phase === 'air', 1)).toBe(true);
    expect(world.lamps.every((l) => l.on <= 0)).toBe(true);
    expect(world.lamps.filter((l) => l.broken > 0)).toHaveLength(1);
    // 位置を変える：プレイヤーから決まった距離のあたりへ
    expect(keepIdle(world, () => act.phase === 'aim', 2)).toBe(true);
    expect(Math.hypot(b.x - p.x, b.y - p.y)).toBeLessThan(act.def.reposition.distance + 5);
    expect(Math.hypot(b.x - 800, b.y - 270)).toBeGreaterThan(100);
    // 突進
    const from = { x: b.x, y: b.y };
    expect(keepIdle(world, () => act.phase === 'active', 2)).toBe(true);
    keepIdle(world, () => act.phase !== 'active', 2);
    expect(Math.hypot(b.x - from.x, b.y - from.y)).toBeGreaterThan(150);
  });

  it('消灯：突進は、予告の間は当たらない。立ち止まっていると当たる', () => {
    const world = bossWorld([]);
    const b = world.boss;
    const p = world.player;
    b.x = 700;
    b.y = 270;
    p.x = 300;
    p.y = 270;
    const act = start(world, 'douse');
    expect(keepIdle(world, () => act.phase === 'active', 5)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(keepIdle(world, () => p.hp < PLAYER.maxHp || world.boss.act !== act, 3)).toBe(true);
    expect(p.hp).toBeLessThan(PLAYER.maxHp);
  });

  it('後半の消灯は、突進が2回。大技「全消灯」は、非常灯をすべて壊し、目くらみにして、突進4回', () => {
    const def = DATA.bosses.get('lampeater');
    expect(def.attacks.douseHard.lunges).toBe(2);
    expect(def.ultimate.move).toBe('blackout');
    const world = bossWorld([{ x: 300, y: 150 }, { x: 650, y: 400 }, { x: 480, y: 270 }]);
    const b = world.boss;
    const p = world.player;
    p.inv = Infinity;
    const act = start(world, 'blackout');
    let lunges = 0;
    let wasActive = false;
    for (let t = 0; t < 20 && b.act === act; t += DT) {
      b.idleT = Infinity;
      updateWorld(world, DT, idle);
      if (act.phase === 'active' && !wasActive) lunges++;
      wasActive = act.phase === 'active';
      if (act.phase === 'stun') break; // 壁に当たったら、そこで終わり
    }
    expect(world.lamps.every((l) => l.broken > 0)).toBe(true);
    expect(lunges).toBeGreaterThanOrEqual(1);
    expect(lunges).toBeLessThanOrEqual(4);
    expect(def.attacks.blackout.lunges).toBe(4);
    expect(def.attacks.blackout.blind).toBe(true);
  });

  it('鱗粉：雲の中にいると目くらみになる。雲の外なら、ならない。雲にダメージはない', () => {
    const world = bossWorld([]);
    const b = world.boss;
    const p = world.player;
    b.x = 880;
    b.y = 80;
    p.x = 300;
    p.y = 300;
    start(world, 'scales');
    expect(keepIdle(world, () => world.hazards.some((h) => h.blind), 2)).toBe(true);
    expect(world.hazards.filter((h) => h.blind)).toHaveLength(b.def.attacks.scales.count);
    expect(keepIdle(world, () => p.blindT > 0, 2)).toBe(true); // 1つ目は足元に出る
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(visionRadius(world)).toBeLessThan(env.vision);

    const w2 = bossWorld([]);
    w2.boss.x = 880;
    w2.boss.y = 80;
    w2.player.x = 300;
    w2.player.y = 300;
    start(w2, 'scales');
    keepIdle(w2, () => w2.hazards.some((h) => h.blind), 2);
    w2.player.x = 100;
    w2.player.y = 490;
    w2.hazards = w2.hazards.filter((h) => Math.hypot(h.x - 100, h.y - 490) > h.r + 20);
    keepIdle(w2, () => false, 2);
    expect(w2.player.blindT).toBeLessThanOrEqual(0);
  });
});

describe('種族「蛾」', () => {
  it('複眼：会心率が上がり、暗闇で見える範囲が広がる', () => {
    const world = darkWorld({ implants: ['compound'] });
    expect(world.player.stats.critChance).toBeCloseTo(PLAYER.critChance + 0.05);
    expect(visionRadius(world)).toBeCloseTo(env.vision * 1.15);
  });

  it('燐光：照らされている敵へのダメージが上がる。暗い場所の敵には乗らない。明るいマップでは、常に乗る', () => {
    const world = darkWorld({ implants: ['phosphor'] });
    const p = world.player;
    const near = addEnemy(world, 'grunt', p.x + 60, p.y);
    const far = addEnemy(world, 'grunt', p.x + 500, p.y);
    expect(statWith(world, 'attackMul', near)).toBeCloseTo(1.1);
    expect(statWith(world, 'attackMul', far)).toBeCloseTo(1);
    const bright = createWorld({ waves: [{}], rng: () => 0.5, weaponId: 'sword' });
    bright.player.build.implants.phosphor = 1;
    recalcStats(bright.player);
    const e = addEnemy(bright, 'grunt', bright.player.x + 500, bright.player.y);
    expect(statWith(bright, 'attackMul', e)).toBeCloseTo(1.1);
  });

  it('燐光：攻撃の光が大きくなる', () => {
    const plain = darkWorld();
    const big = darkWorld({ implants: ['phosphor'] });
    for (const world of [plain, big]) {
      const e = addEnemy(world, 'grunt', 700, 300);
      e.hp = e.maxHp = 100000;
      hitEnemy(world, e, 10, 1, 0, 0);
    }
    expect(big.lights[0].r).toBeCloseTo(plain.lights[0].r * 1.5);
  });

  it('誘蛾灯：敵を倒すと回復し、暗闇では、倒した場所に光が残る', () => {
    const world = darkWorld({ implants: ['lure'] });
    const p = world.player;
    p.hp = 50;
    const e = addEnemy(world, 'grunt', 700, 300);
    hitEnemy(world, e, 99999, 1, 0, 0);
    expect(p.hp).toBe(51);
    run(world, 1);
    expect(isVisible(world, 700, 300)).toBe(true);
  });

  it('種族ボーナス：2種類で会心ダメージ +20%。3種類で、見える範囲がさらに広がる', () => {
    const two = darkWorld({ implants: ['compound', 'flutter'] });
    expect(two.player.stats.critMul).toBeCloseTo(PLAYER.critMultiplier + 0.2);
    const three = darkWorld({ implants: ['compound', 'flutter', 'lure'] });
    expect(visionRadius(three)).toBeCloseTo(env.vision * (1 + 0.15 + 0.25));
  });
});
