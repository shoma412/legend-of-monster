import { describe, expect, it } from 'vitest';
import { CYCLE, META, PLAYER, ROOMGEN } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { interact, updateFocus } from '../src/game/objects.js';
import { buildRoom } from '../src/game/rooms.js';
import { NEXT_AREA, createRun, currentArea, enterRoom, handleEvents, hasNextArea, leaveRoom, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { generateEliteWaves } from '../src/logic/areaGen.js';
import { allMapsCleared, canSortie, canSortieCycle, cycleMods, cycleNotes, mapState, recordMapClear } from '../src/logic/maps.js';
import { SAVE_VERSION, createSave, loadSlot, slotKey } from '../src/logic/save.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}

// マップの最後のボスを倒すところまで進める
function clearMap(save, cycle = 1) {
  const r = createRun({ rng: seeded(7), save, mapId: 'map1', cycle });
  while (hasNextArea(r)) leaveRoom(r, enterRoom(r), NEXT_AREA);
  skipToBoss(r, enterRoom(r));
  const world = enterRoom(r);
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.player.inv = Infinity;
  hitEnemy(world, world.boss, 99999999, 1, 0, 0);
  const notes = handleEvents(r, world);
  return { run: r, notes };
}

describe('マップの定義', () => {
  it('マップは7つ。マップ1は、今の3エリアを順に進む。マップ2は排水区', () => {
    expect(maps).toHaveLength(7);
    expect(maps[0]).toMatchObject({ id: 'map1', areas: ['slum', 'plant', 'tower'] });
    expect(maps[1]).toMatchObject({ id: 'map2', name: '排水区' });
    expect(maps[1].areas[0]).toBe('sewer');
    for (const map of maps) {
      for (const id of map.areas) expect(DATA.areas.has(id), `${map.id}: ${id}`).toBe(true);
      if (map.ready !== false) expect(map.areas.length).toBeGreaterThan(0);
    }
  });

  it('ランは、選んだマップのエリアを順に進む', () => {
    const r = createRun({ rng: seeded(3), mapId: 'map1' });
    expect(r.map.id).toBe('map1');
    expect(currentArea(r).id).toBe('slum');
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    expect(currentArea(r).id).toBe('plant');
    expect(hasNextArea(r)).toBe(true);
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    expect(hasNextArea(r)).toBe(false);
  });
});

describe('マップの解放と完了', () => {
  it('最初はマップ1だけ選べる。マップ2は未解放、マップ3以降は準備中', () => {
    const save = createSave();
    expect(mapState(save, maps[0])).toBe('open');
    expect(canSortie(save, maps[0])).toBe(true);
    expect(mapState(save, maps[1])).toBe('locked');
    expect(canSortie(save, maps[1])).toBe(false);
    for (const map of maps.slice(2)) {
      expect(mapState(save, map)).toBe('notReady');
      expect(canSortie(save, map)).toBe(false);
    }
  });

  it('マップ1を完了すると、マップ2が選べるようになる', () => {
    const save = createSave();
    recordMapClear(save, 'map1', 1);
    expect(mapState(save, maps[1])).toBe('open');
    expect(canSortie(save, maps[1])).toBe(true);
    recordMapClear(save, 'map2', 1);
    expect(mapState(save, maps[1])).toBe('done');
  });

  it('マップの最後のボスを倒すと完了になり、通知が出る', () => {
    const save = createSave();
    const { run, notes } = clearMap(save);
    expect(mapState(save, maps[0])).toBe('done');
    expect(save.maps.map1).toEqual({ clears: 1, clearedCycle: 1 });
    const texts = notes.map((n) => n.text);
    expect(texts.some((t) => t.includes('マップ完了'))).toBe(true);
    // 次の周は、今あるマップをすべて完了するまで選べない
    expect(texts.some((t) => t.includes('周目が選べるようになった'))).toBe(false);
    expect(save.cycle).toBe(1);
    // リザルトにも残る
    expect(run.gained.notes.some((n) => n.text.includes('マップ完了'))).toBe(true);
  });

  it('エンディングは、7つすべてを完了したときだけ（準備中のマップがある間は出ない）', () => {
    const save = createSave();
    expect(allMapsCleared(save)).toBe(false);
    expect(clearMap(save).run.ending).toBe(false);
    expect(allMapsCleared(save)).toBe(false);
    // 7つすべてが完了になった瞬間だけ true（仮に、7つとも中身ができたものとして確かめる）
    const originals = maps.slice();
    maps.forEach((m, i) => { maps[i] = { ...m, ready: true, areas: maps[0].areas }; });
    try {
      const fresh = createSave();
      const results = maps.map((m) => recordMapClear(fresh, m.id, 1));
      expect(results.slice(0, 6).every((r) => r.ending === false)).toBe(true);
      expect(results[6].ending).toBe(true);
      expect(allMapsCleared(fresh)).toBe(true);
      expect(recordMapClear(fresh, 'map1', 1).ending).toBe(false); // 2回目は出ない
    } finally {
      originals.forEach((m, i) => { maps[i] = m; });
    }
  });
});

describe('周回', () => {
  it('今あるマップをすべて完了すると、次の周が選べる。同じ周をもう一度クリアしても増えない', () => {
    const save = createSave();
    expect(save.cycle).toBe(1);
    expect(canSortieCycle(save, maps[0], 2)).toBe(false);
    // マップ1だけでは、まだ進めない。マップ2も完了すると、2周目が選べる
    expect(recordMapClear(save, 'map1', 1).nextCycle).toBeNull();
    expect(save.cycle).toBe(1);
    expect(recordMapClear(save, 'map2', 1).nextCycle).toBe(2);
    expect(canSortieCycle(save, maps[0], 2)).toBe(true);
    expect(recordMapClear(save, 'map1', 1).nextCycle).toBeNull();
    expect(save.cycle).toBe(2);
    expect(recordMapClear(save, 'map1', 2).nextCycle).toBeNull();
    expect(recordMapClear(save, 'map2', 2).nextCycle).toBe(3);
    expect(save.maps.map1).toEqual({ clears: 3, clearedCycle: 2 });
    // 前の周も選べる
    expect(canSortieCycle(save, maps[0], 1)).toBe(true);
    expect(canSortieCycle(save, maps[0], 4)).toBe(false);
  });

  it('1周目は何も変わらない。周が進むごとに、HP +15%・受けるダメージ +8%', () => {
    expect(cycleMods(1)).toMatchObject({ hpScale: 1, damageScale: 1, stepBonus: 0, materialBonus: 0, rarityChance: 0, eliteTraits: 1, bossHard: false, healScale: 1 });
    expect(cycleNotes(1)).toEqual([]);
    const m3 = cycleMods(3);
    expect(m3.hpScale).toBeCloseTo(1 + 2 * CYCLE.hpPerCycle);
    expect(m3.damageScale).toBeCloseTo(1 + 2 * CYCLE.damagePerCycle);
    expect(m3.materialBonus).toBe(1);
    expect(cycleNotes(3).join(' ')).toContain('+30%');
  });

  it('追加のルール：3周目からエリートの特性が2つ、5周目からボスが最初から後半、7周目から補給が半分', () => {
    expect(cycleMods(2).eliteTraits).toBe(1);
    expect(cycleMods(3).eliteTraits).toBe(2);
    expect(cycleMods(4).bossHard).toBe(false);
    expect(cycleMods(5).bossHard).toBe(true);
    expect(cycleMods(6).healScale).toBe(1);
    expect(cycleMods(7).healScale).toBe(CYCLE.supplyScale);
  });

  it('周が進むと、雑魚とボスの HP が増える。雑魚の攻撃力そのものは変わらない', () => {
    const first = enterRoom(createRun({ rng: seeded(5), cycle: 1 }));
    const third = enterRoom(createRun({ rng: seeded(5), cycle: 3 }));
    for (const world of [first, third]) {
      world.countdown = 0;
      while (world.enemies.length === 0) updateWorld(world, DT, idle);
    }
    const sample = (world, id) => world.enemies.find((e) => e.def.id === id);
    const id = first.enemies[0].def.id;
    const a = sample(first, id);
    const b = sample(third, id);
    expect(b).toBeDefined();
    expect(b.maxHp).toBe(Math.round(a.maxHp * (1 + 2 * CYCLE.hpPerCycle)));
    expect(b.def.damage).toBe(a.def.damage);

    const boss = (cycle) => {
      const r = createRun({ rng: seeded(5), cycle });
      skipToBoss(r, enterRoom(r));
      const world = enterRoom(r);
      while (!world.boss) updateWorld(world, DT, idle);
      return world.boss;
    };
    expect(boss(3).maxHp).toBe(Math.round(boss(1).maxHp * (1 + 2 * CYCLE.hpPerCycle)));
  });

  it('周が進むと、受けるダメージが増える', () => {
    const take = (cycle) => {
      const world = enterRoom(createRun({ rng: seeded(5), cycle }));
      hurtPlayer(world, 20);
      return PLAYER.maxHp - world.player.hp;
    };
    expect(take(1)).toBe(20);
    expect(take(4)).toBe(Math.round(20 * (1 + 3 * CYCLE.damagePerCycle)));
  });

  it('周が進むと、1部屋の敵の量が増える', () => {
    const count = (cycle) => {
      let total = 0;
      for (let n = 1; n <= 30; n++) {
        const world = enterRoom(createRun({ rng: seeded((n * 2654435761) % 4294967296), cycle }));
        total += world.waves.reduce((sum, wave) => sum + Object.values(wave).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0), 0);
      }
      return total;
    };
    expect(count(6)).toBeGreaterThan(count(1));
  });

  it('周が進むと、ボス素材が多くもらえる（2周ごとに +1）', () => {
    const save = createSave();
    clearMap(save, 1);
    const before = save.materials.overCore;
    expect(before).toBe(META.firstKillMaterials);
    clearMap(save, 3); // 初回ではないので 1 個 + 追加 1 個
    expect(save.materials.overCore).toBe(before + 2);
  });

  it('3周目からは、エリートに違う特性が2つ付く', () => {
    const area = DATA.areas.get('slum');
    const [one] = generateEliteWaves(area, 1, seeded(4));
    expect(one.elite.traits).toHaveLength(1);
    const [two] = generateEliteWaves(area, 1, seeded(4), 2);
    expect(two.elite.traits).toHaveLength(2);
    expect(new Set(two.elite.traits).size).toBe(2);

    const room = { type: 'elite', waves: [{ elite: two.elite }], objects: [], doors: [], clearCredits: 0 };
    const world = createWorld({ room, rng: seeded(4) });
    while (world.enemies.length === 0) updateWorld(world, DT, idle);
    const elite = world.enemies.find((e) => e.elite);
    expect(elite.traits).toHaveLength(2);
    expect(elite.def.name).toContain('・');
  });

  it('5周目からは、ボスが最初から後半の行動で始まる', () => {
    const start = (cycle) => {
      const r = createRun({ rng: () => 0.5, cycle });
      skipToBoss(r, enterRoom(r));
      const world = enterRoom(r);
      world.player.inv = Infinity;
      while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
      for (let t = 0; t < 1; t += DT) updateWorld(world, DT, idle);
      return world.boss;
    };
    expect(start(1).phaseIndex).toBe(0);
    const hard = start(5);
    expect(hard.phaseIndex).toBe(hard.def.phases.length - 1);
    expect(hard.hp).toBe(hard.maxHp); // HP は減っていない
  });

  it('7周目からは、補給部屋の回復量が半分になる', () => {
    const heal = (healScale) => {
      const room = { ...buildRoom('supply', { area: DATA.areas.get('slum'), step: 1, build: null, rng: seeded(2) }), healScale };
      const world = createWorld({ room, rng: seeded(2) });
      const p = world.player;
      const station = world.objects.find((o) => o.kind === 'heal');
      p.hp = 10;
      p.x = station.x;
      p.y = station.y;
      updateFocus(world);
      interact(world);
      return p.hp - 10;
    };
    const full = Math.round(PLAYER.maxHp * ROOMGEN.supply.heal);
    expect(heal(1)).toBe(full);
    expect(heal(CYCLE.supplyScale)).toBe(Math.round(full * CYCLE.supplyScale));
  });
});

describe('セーブデータ（マップと周回）', () => {
  it('版2のセーブデータ：オーバーロードを倒していれば、マップ1は完了済みで2周目が選べる', () => {
    const old = { ...createSave(), version: 2, bossKills: { boltboar: 3, overload: 2 }, records: { runs: 9, clears: 2, kills: 100, bestArea: 2, bestStep: 9 } };
    for (const key of ['maps', 'cycle', 'selectedMap', 'selectedCycle']) delete old[key];
    const loaded = loadSlot(fakeStorage({ [slotKey(1)]: JSON.stringify(old) }), 1);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.maps.map1).toEqual({ clears: 2, clearedCycle: 1 });
    expect(loaded.cycle).toBe(2);
    expect(loaded.selectedMap).toBe('map1');
  });

  it('版1・版2のセーブデータ：まだクリアしていなければ、1周目のまま', () => {
    for (const version of [1, 2]) {
      const old = { ...createSave(), version, bossKills: { boltboar: 1 } };
      for (const key of ['maps', 'cycle', 'selectedMap', 'selectedCycle']) delete old[key];
      const loaded = loadSlot(fakeStorage({ [slotKey(1)]: JSON.stringify(old) }), 1);
      expect(loaded.version).toBe(SAVE_VERSION);
      expect(loaded.maps).toEqual({});
      expect(loaded.cycle).toBe(1);
    }
  });

  it('マップの記録と周は、保存して読み直しても残る', () => {
    const save = createSave();
    recordMapClear(save, 'map1', 1);
    recordMapClear(save, 'map2', 1);
    save.selectedCycle = 2;
    const loaded = loadSlot(fakeStorage({ [slotKey(2)]: JSON.stringify(save) }), 2);
    expect(loaded.maps.map1).toEqual({ clears: 1, clearedCycle: 1 });
    expect(loaded.cycle).toBe(2);
    expect(loaded.selectedCycle).toBe(2);
  });
});
