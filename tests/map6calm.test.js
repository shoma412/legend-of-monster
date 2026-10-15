import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { upgrades } from '../src/data/upgrades.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { SECRET_IN, createRun, enterRoom, handleEvents, leaveRoom, payForSecret, secretCost } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { mapState, recordMapClear } from '../src/logic/maps.js';
import { saveTree } from '../src/logic/meta.js';
import { createSave, normalizeSave } from '../src/logic/save.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ6の隠しボス「カーム」と、その出し方（docs/詳細仕様.md「30. マップ6「送風区」」の「⑤隠しボス」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const cm = DATA.bosses.get('calm');
const COST = { overCore: 3, hydraCore: 3, titanCore: 3, breakerCore: 3, rainCore: 3, cycloneCore: 3 };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function newRun(materials = {}) {
  const save = createSave();
  for (const id of ['map1', 'map2', 'map3', 'map4', 'map5']) recordMapClear(save, id, 1);
  save.passes.push('map3', 'map4', 'map5');
  Object.assign(save.materials, materials);
  return { save, run: createRun({ rng: seeded(5), save, mapId: 'map6', weaponId: 'sword' }) };
}

function bossWorld() {
  const room = { type: 'secretBoss', waves: [{ boss: 'calm' }], objects: [], doors: [], clearCredits: 0 };
  const world = createWorld({ room, rng: seeded(3), weaponId: 'sword' });
  world.waveTimer = 0;
  recalcStats(world.player);
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  const b = world.boss;
  b.idleT = Infinity;
  b.x = 700;
  b.y = 300;
  world.player.stats.maxHp = 99999;
  world.player.hp = 99999;
  world.player.inv = 0;
  world.player.x = 300;
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
  for (let t = 0; t < seconds; t += DT) {
    world.player.inv = 0;
    updateWorld(world, DT, input);
  }
}

const clampTo = (world, p) => {
  p.x = Math.max(world.bounds.left + 20, Math.min(world.bounds.right - 20, p.x));
  p.y = Math.max(world.bounds.top + 20, Math.min(world.bounds.bottom - 20, p.y));
};

describe('マップ6の隠しボス「カーム」の出し方と、通行証', () => {
  it('マップ6の隠しボスはカーム。壁を開けるには、マップ1〜6の最終ボスのコアを各3個。マップ7には、送風区の通行証が要る', () => {
    const map6 = maps.find((m) => m.id === 'map6');
    expect(map6.secretBoss.boss).toBe('calm');
    expect(map6.secretBoss.cost).toEqual(COST);
    // マップ1〜6の、最終ボスの素材
    const finals = ['overload', 'sludgehydra', 'cranetitan', 'breaker', 'rainmaker', 'cyclone'].map((id) => DATA.bosses.get(id).material);
    expect(Object.keys(COST).sort()).toEqual([...finals].sort());
    expect(maps.find((m) => m.id === 'map7').requiresPass).toBe('map6');
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3', 'map4', 'map5', 'map6']) recordMapClear(save, id, 1);
    save.passes.push('map3', 'map4', 'map5');
    expect(mapState(save, DATA.maps.get('map7'))).toBe('locked');
    save.passes.push('map6');
    expect(mapState(save, DATA.maps.get('map7'))).toBe('open');
  });

  it('コアが足りないと払えず、足りていれば払って、1回で壁が開く（次からは払わない）', () => {
    const { run: r, save } = newRun({ ...COST, cycloneCore: 2 });
    expect(secretCost(r)).toEqual(COST);
    expect(enterRoom(r).room.secretCost).toEqual(COST);
    const lack = payForSecret(r);
    expect(lack.ok).toBe(false);
    expect(save.materials.overCore).toBe(3); // 払っていない
    expect(save.secretsOpened).toEqual([]);
    save.materials.cycloneCore = 5;
    expect(payForSecret(r)).toMatchObject({ ok: true, paid: true });
    expect(save.materials).toMatchObject({ overCore: 0, hydraCore: 0, titanCore: 0, breakerCore: 0, rainCore: 0, cycloneCore: 2 });
    expect(save.secretsOpened).toEqual(['map6']);
    expect(secretCost(r)).toBeNull();
    expect(payForSecret(r)).toEqual({ ok: true }); // 2回目は、払わない
    expect(save.materials.overCore).toBe(0);
    expect(enterRoom(r).room.secretCost).toBeNull();
  });

  it('ほかのマップの隠しボスは、コアを払わない', () => {
    const save = createSave();
    for (const id of ['map1', 'map2']) recordMapClear(save, id, 1);
    const r = createRun({ rng: seeded(5), save, mapId: 'map3', weaponId: 'sword' });
    expect(secretCost(r)).toBeNull();
    expect(payForSecret(r)).toEqual({ ok: true });
  });

  it('隠し扉に入ると、カームと戦う。風は止んでいる。倒すと、通行証・実績・カームコア。弱点はない', () => {
    const { run: r, save } = newRun(COST);
    let world = enterRoom(r);
    expect(world.room.environment?.wind).toBeTruthy(); // ふつうの部屋は、強風
    payForSecret(r);
    leaveRoom(r, world, SECRET_IN);
    world = enterRoom(r);
    expect(world.room.environment).toBeFalsy(); // カームの部屋は、風が止まっている
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('calm');
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.passes).toContain('map6');
    expect(save.achievements).toContain('calm');
    expect([1, 2]).toContain(save.materials.calmCore);
    expect(cm.weakness).toBeNull();
  });

  it('マップ7をすでにクリアしたセーブデータは、通行証を持っている扱い。まだのセーブデータは、そのまま', () => {
    const cleared = createSave();
    recordMapClear(cleared, 'map7', 1);
    expect(normalizeSave(JSON.parse(JSON.stringify({ ...cleared, passes: [] }))).passes).toContain('map6');
    expect(normalizeSave(JSON.parse(JSON.stringify(createSave()))).passes).not.toContain('map6');
    expect(normalizeSave({ version: 8, secretsOpened: ['map6', 3, 'map6'] }).secretsOpened).toEqual(['map6']);
  });
});

describe('カーム：定義', () => {
  it('隠しボス。素材はカームコア。固有の攻撃が4つ（静寂・凪の花・無風の輪・引き潮）。ほかのボスと、攻撃の名前が重ならない', () => {
    expect(cm).toMatchObject({ hidden: true, material: 'calmCore', speed: 0 });
    expect(DATA.materials.get('calmCore').name).toBe('カームコア');
    expect(MATERIAL_ICONS.calmCore).toBeDefined();
    const patterns = new Set(Object.values(cm.attacks).map((a) => a.pattern));
    expect([...patterns].sort()).toEqual(['bloom', 'calmwave', 'ebb', 'hush']);
    for (const other of DATA.bosses.all().filter((b) => b.id !== 'calm')) {
      for (const a of Object.values(other.attacks)) expect(patterns.has(a.pattern), `${other.id}:${a.pattern}`).toBe(false);
    }
    for (const p of patterns) expect(PATTERNS[p], p).toBeDefined();
  });
});

describe('カーム：攻撃', () => {
  it('静寂：静まっている間に動くと、爆ぜる。止まっていれば、当たらない', () => {
    for (const move of [true, false]) {
      const world = bossWorld();
      const p = world.player;
      const act = startMove(world, 'hush');
      // 静まるまで、止まって待つ
      for (let t = 0; t < 4 && act.stage !== 'quiet'; t += DT) run(world, DT);
      expect(act.stage).toBe('quiet');
      const hpQuiet = p.hp;
      for (let t = 0; t < 1.0; t += DT) run(world, DT, move ? { ...idle, mx: 1 } : idle);
      if (move) expect(p.hp, '動いた').toBeLessThan(hpQuiet);
      else expect(p.hp, '止まっていた').toBe(hpQuiet);
    }
  });

  it('静寂：静寂がとけると、花びらの輪が広がる。rounds 回くり返したら、終わる', () => {
    const world = bossWorld();
    world.player.x = 120;
    const act = startMove(world, 'stillbottom');
    expect(cm.attacks.stillbottom.rounds).toBe(3);
    let rounds = 0;
    let last = 0;
    for (let t = 0; t < 30 && act.phase !== 'recover'; t += DT) {
      run(world, DT);
      if ((act.round ?? 0) > last) {
        last = act.round;
        rounds++;
      }
    }
    expect(rounds).toBe(3);
  });

  it('凪の花：プレイヤーのまわりに count 個咲き、咲いたあと、花びらが飛ぶ', () => {
    const world = bossWorld();
    const act = startMove(world, 'bloom');
    const def = cm.attacks.bloom;
    let seen = 0;
    let petals = 0;
    for (let t = 0; t < 8 && act.phase !== 'recover'; t += DT) {
      run(world, DT);
      seen = Math.max(seen, world.hazards.filter((h) => h.type === 'bloom').length);
      petals = Math.max(petals, world.shots.length);
    }
    expect(act.fired).toBe(def.count);
    expect(seen).toBeGreaterThanOrEqual(2);
    expect(petals).toBeGreaterThanOrEqual(def.petals);
  });

  it('無風の輪：すき間は通れる。すき間以外に当たると、ダメージ', () => {
    for (const inGap of [true, false]) {
      const world = bossWorld();
      const p = world.player;
      const b = world.boss;
      startMove(world, 'calmwave');
      for (let t = 0; t < 3 && !world.hazards.some((h) => h.type === 'calmwave'); t += DT) run(world, DT);
      const wave = world.hazards.find((h) => h.type === 'calmwave');
      expect(wave).toBeDefined();
      expect(world.hazards.filter((h) => h.type === 'calmwave')).toHaveLength(cm.attacks.calmwave.waves);
      // 確かめるのは、最初の1本だけ（あとの輪は、すき間の向きが少しずれる）
      world.hazards = world.hazards.filter((h) => h.type !== 'calmwave' || h === wave);
      // 輪が通る所に立つ：すき間の中心の向きか、その反対の向き
      const a = inGap ? wave.gapA : wave.gapA + Math.PI;
      const stand = () => {
        p.x = b.x + Math.cos(a) * 200;
        p.y = b.y + Math.sin(a) * 200;
        clampTo(world, p);
      };
      stand();
      const hp0 = p.hp;
      for (let t = 0; t < 2; t += DT) {
        run(world, DT);
        stand();
      }
      if (inGap) expect(p.hp, 'すき間').toBe(hp0);
      else expect(p.hp, 'すき間の外').toBeLessThan(hp0);
    }
  });

  it('引き潮：安全な円の外にいると、ダメージ。円の中なら、受けない', () => {
    for (const outside of [true, false]) {
      const world = bossWorld();
      const p = world.player;
      const bd = world.bounds;
      const cx = (bd.left + bd.right) / 2;
      const cy = (bd.top + bd.bottom) / 2;
      startMove(world, 'ebb');
      run(world, 1.4); // 予告のあと、円が出て、警告の間
      const hp0 = p.hp;
      for (let t = 0; t < 4; t += DT) {
        p.x = outside ? bd.left + 24 : cx;
        p.y = outside ? bd.top + 24 : cy;
        run(world, DT);
      }
      if (outside) expect(p.hp, '円の外').toBeLessThan(hp0);
      else expect(p.hp, '円の中').toBe(hp0);
    }
  });
});

describe('カームコアを使う強化（スキルツリー、since: 12）', () => {
  it('カームコアだけの3系統（各3段）と、最終ボスのコアとの組み合わせ6つ。合計15マス', () => {
    const calm = upgrades.filter((u) => u.since === 12);
    expect(calm).toHaveLength(9);
    expect(calm.filter((u) => Object.keys(u.costs[0]).length === 1).map((u) => u.max)).toEqual([3, 3, 3]);
    expect(calm.reduce((n, u) => n + u.max, 0)).toBe(15);
    for (const u of calm) for (const c of u.costs) expect(c.calmCore, u.id).toBe(1);
    const tree = saveTree(createSave());
    expect(tree.nodes.filter((n) => n.upgrade.startsWith('calm-'))).toHaveLength(15);
  });
});
