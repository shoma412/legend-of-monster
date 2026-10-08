import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { META } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { hitEnemy } from '../src/game/combat.js';
import { createRun, enterRoom, finishRun, handleEvents } from '../src/game/run.js';
import { updateWorld } from '../src/game/world.js';
import { applyCarryOver, carryOverPicks, permanentBonuses, recordCarryOver } from '../src/logic/meta.js';
import { createSave, normalizeSave } from '../src/logic/save.js';
import { buildTree } from '../src/logic/skillTree.js';
import { restoreRun, snapshotRun } from '../src/logic/suspend.js';
import { activeSpeciesBonuses } from '../src/logic/stats.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップをクリアしたあとの持ち越し（docs/詳細仕様.md「25. マップをクリアしたあとの持ち越し」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// マップ1の最後のボスを倒して、クリアする。setup で、倒す直前の持ち物を決める
function clearMap1(save, setup = () => {}) {
  const run = createRun({ rng: seeded(7), save, mapId: 'map1', weaponId: 'sword' });
  run.areaIndex = 2;
  run.plan.current = 'boss';
  const world = enterRoom(run);
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  setup(world.player.build);
  world.player.inv = Infinity;
  hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
  handleEvents(run, world);
  finishRun(run, world, 'clear');
  return { run, world, credits: world.player.build.credits };
}

describe('持ち越し：マップをクリアしたときだけ、次の出撃に残る', () => {
  it('クリアすると、クレジットの半分（切り捨て）と、持っていたインプラントの一覧が記録される', () => {
    const save = createSave();
    const { credits } = clearMap1(save, (build) => {
      build.credits = 301;
      build.implants = { overclock: 3, muscle: 1 };
    });
    expect(save.carryOver.credits).toBe(Math.floor(credits * META.carryOver.creditRate));
    expect(save.carryOver.credits).toBeGreaterThanOrEqual(150);
    expect([...save.carryOver.implants].sort()).toEqual(['muscle', 'overclock']);
    expect(save.carryOver.picked).toEqual([]);
  });

  it('死んだときは、何も残らない', () => {
    const save = createSave();
    const run = createRun({ rng: seeded(3), save, mapId: 'map1' });
    const world = enterRoom(run);
    world.player.build.credits = 500;
    world.player.build.implants = { overclock: 1 };
    finishRun(run, world, 'dead');
    expect(save.carryOver).toBeNull();
  });

  it('次に出撃すると、クレジットと、選んだインプラント（Lv1）を持って始まる。レベル・装備・修復キットは持ち越さない', () => {
    const save = createSave();
    clearMap1(save, (build) => {
      build.credits = 400;
      build.implants = { overclock: 3, muscle: 2 };
      build.level = 9;
      build.kits = 7;
    });
    const carried = save.carryOver.credits;
    save.carryOver.picked = ['overclock'];
    const run = createRun({ rng: seeded(4), save, mapId: 'map2' });
    expect(run.build.credits).toBe(carried);
    expect(run.build.implants).toEqual({ overclock: META.carryOver.level });
    expect(META.carryOver.level).toBe(1);
    expect(run.build.level).toBe(1);
    expect(run.build.gear.mod).toBeNull();
    expect(run.build.kits).toBe(createRun({ rng: seeded(4), save: createSave(), mapId: 'map1' }).build.kits);
    expect(run.carriedOver).toEqual({ credits: carried, implants: ['overclock'] });
    // 最初の部屋でも、ステータスに効いている
    expect(enterRoom(run).player.stats.attackMul).toBeCloseTo(1.2);
    // 使ったら消える。その次の出撃には、何も付かない
    expect(save.carryOver).toBeNull();
    const next = createRun({ rng: seeded(5), save, mapId: 'map1' });
    expect(next.build.credits).toBe(0);
    expect(next.build.implants).toEqual({});
  });

  it('選ばなければ、クレジットだけが残る', () => {
    const save = createSave();
    clearMap1(save, (build) => {
      build.credits = 100;
      build.implants = { overclock: 1 };
    });
    const run = createRun({ rng: seeded(4), save, mapId: 'map1' });
    expect(run.build.implants).toEqual({});
    expect(run.build.credits).toBeGreaterThanOrEqual(50);
  });

  it('選べる数は、最初は1つ。恒久強化「記憶領域」で2つになる。同じものは2回選べず、候補にないものは選べない', () => {
    const save = createSave();
    expect(permanentBonuses(save).keepImplants).toBe(1);
    recordCarryOver(save, { credits: 0, implants: { overclock: 2, muscle: 1, plating: 1 } });
    save.carryOver.picked = ['overclock', 'muscle'];
    expect(carryOverPicks(save)).toEqual(['overclock']);
    save.upgrades.memory = 1;
    expect(permanentBonuses(save).keepImplants).toBe(2);
    expect(carryOverPicks(save)).toEqual(['overclock', 'muscle']);
    save.carryOver.picked = ['overclock', 'overclock'];
    expect(carryOverPicks(save)).toEqual(['overclock', null]);
    save.carryOver.picked = ['chain', 'nothing'];
    expect(carryOverPicks(save)).toEqual([null, null]);
    save.carryOver.picked = ['plating', 'muscle'];
    const build = { credits: 5, implants: {} };
    expect(applyCarryOver(save, build)).toEqual({ credits: 0, implants: ['plating', 'muscle'] });
    expect(build.implants).toEqual({ plating: 1, muscle: 1 });
  });

  it('持ち越したインプラントは、種族ボーナスの数に入る', () => {
    const save = createSave();
    save.upgrades.memory = 1;
    recordCarryOver(save, { credits: 0, implants: { chain: 1, overcurrent: 1 } });
    save.carryOver.picked = ['chain', 'overcurrent'];
    const run = createRun({ rng: seeded(4), save, mapId: 'map1' });
    expect(activeSpeciesBonuses(run.build).some((b) => b.species === 'boar' && b.need === 2)).toBe(true);
  });

  it('セーブデータ：持ち越しは保存され、読み直しても残る。おかしな中身は、直すか捨てる', () => {
    const save = createSave();
    recordCarryOver(save, { credits: 77, implants: { overclock: 1 } });
    save.carryOver.picked = ['overclock'];
    const copy = () => JSON.parse(JSON.stringify(save));
    expect(normalizeSave(copy()).carryOver).toEqual({ credits: 38, implants: ['overclock'], picked: ['overclock'] });
    expect(normalizeSave({ ...copy(), carryOver: 'x' }).carryOver).toBeNull();
    expect(normalizeSave({ ...copy(), carryOver: { credits: -5, implants: [1, 'a'], picked: [3] } }).carryOver).toEqual({ credits: 0, implants: ['a'], picked: [null] });
    // 前からあるセーブデータ（項目がない）は、持ち越しなし
    const old = JSON.parse(JSON.stringify(createSave()));
    delete old.carryOver;
    expect(normalizeSave(old).carryOver).toBeNull();
  });

  it('中断して再開した出撃には、関係しない（持ち越しは、新しく出撃するときにだけ使われる）', () => {
    const save = createSave();
    const run = createRun({ rng: seeded(3), save, mapId: 'map1' });
    const world = enterRoom(run);
    world.mode = 'clear';
    const data = snapshotRun(run, world);
    recordCarryOver(save, { credits: 200, implants: { overclock: 1 } });
    const again = restoreRun(data, save, seeded(9));
    expect(again.build.credits).toBe(0);
    expect(save.carryOver.credits).toBe(100);
  });
});

describe('隠しボスの素材と、恒久強化「記憶領域」', () => {
  it('隠しボス2体は、素材を持つ。絵もある。「記憶領域」は、その2つを1個ずつ', () => {
    expect(DATA.bosses.get('architect').material).toBe('architectCore');
    expect(DATA.bosses.get('nocturne').material).toBe('nocturneCore');
    for (const id of ['architectCore', 'nocturneCore']) {
      expect(DATA.materials.has(id)).toBe(true);
      expect(MATERIAL_ICONS[id]).toBeDefined();
    }
    const def = DATA.upgrades.get('memory');
    expect(def.costs).toEqual([{ architectCore: 1, nocturneCore: 1 }]);
    expect(def.since).toBe(3);
  });

  it('すでにアーキテクトを倒しているセーブデータには、アーキテクトコアが1個渡る（1回だけ）', () => {
    const old = JSON.parse(JSON.stringify(createSave()));
    old.bossKills.architect = 2;
    const save = normalizeSave(old);
    expect(save.materials.architectCore).toBe(1);
    // 使ったあと（0個）に読み直しても、また増えたりしない
    save.materials.architectCore = 0;
    expect(normalizeSave(JSON.parse(JSON.stringify(save))).materials.architectCore).toBe(0);
    // 倒していない人には、渡らない
    expect(normalizeSave(JSON.parse(JSON.stringify(createSave()))).materials.architectCore).toBeUndefined();
  });

  it('スキルツリー：「記憶領域」を足しても、最初の34マスと、マップ4で足した7マスの場所は変わらない', () => {
    const v2 = JSON.parse(readFileSync(new URL('./fixtures/tree-v2.json', import.meta.url), 'utf8'));
    expect(Object.keys(v2)).toHaveLength(20);
    for (const [seed, list] of Object.entries(v2)) {
      expect(list).toHaveLength(41);
      const now = buildTree(Number(seed)).nodes.filter((n) => n.since <= 2).map((n) => `${n.id}<${n.parent}@${n.depth}`);
      expect(now, seed).toEqual(list);
    }
  });
});
