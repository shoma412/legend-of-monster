import { describe, expect, it } from 'vitest';
import { META, PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { weaponUnlocks } from '../src/data/upgrades.js';
import { chooseImplant, equipItem } from '../src/game/build.js';
import { hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { interact } from '../src/game/objects.js';
import { NEXT_AREA, createRun, enterRoom, finishRun, handleEvents, leaveRoom, skipToBoss } from '../src/game/run.js';
import { updateWorld } from '../src/game/world.js';
import { hasCheck } from '../src/logic/achievements.js';
import { buyUpgrade, nextUpgradeCost, permanentBonuses, pickFragment, processEvent, unlockWeapon } from '../src/logic/meta.js';
import { SAVE_VERSION, SLOT_COUNT, createSave, deleteSlot, listSlots, loadSlot, slotKey, storeSlot } from '../src/logic/save.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// localStorage の代わり
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

// ボス部屋まで飛ばして、ボスが出てくるまで進める
function bossRoom(r) {
  const first = enterRoom(r);
  skipToBoss(r, first);
  const world = enterRoom(r);
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  return world;
}

function killBoss(r, world) {
  world.player.inv = Infinity;
  hitEnemy(world, world.boss, 999999, 1, 0, 0);
  return handleEvents(r, world);
}

describe('定義データのつじつま', () => {
  it('実績の条件は、どれも部品（CHECKS）がある', () => {
    for (const def of DATA.achievements.all()) {
      if (def.check) expect(hasCheck(def.check), def.id).toBe(true);
    }
  });

  it('恒久強化と武器解放に使う素材、ボスが落とす素材、データ片のエリアは定義されている', () => {
    for (const def of DATA.upgrades.all()) {
      expect(def.costs).toHaveLength(def.max);
      for (const cost of def.costs) for (const id of Object.keys(cost)) expect(DATA.materials.has(id), `${def.id} の ${id}`).toBe(true);
    }
    for (const w of weaponUnlocks) for (const id of Object.keys(w.cost ?? {})) expect(DATA.materials.has(id)).toBe(true);
    for (const boss of DATA.bosses.all()) expect(DATA.materials.has(boss.material), boss.id).toBe(true);
    for (const f of DATA.fragments.all()) expect(DATA.areas.has(f.area), f.id).toBe(true);
  });

  it('恒久強化は仕様どおりの段階と素材', () => {
    const get = (id) => DATA.upgrades.get(id);
    expect(get('frame').costs).toEqual(Array(5).fill({ boarCore: 1 }));
    expect(get('nerve').costs).toEqual([{ boarCore: 1 }, { boarCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }]);
    expect(get('kitslot').costs).toEqual([{ cryoCore: 2 }, { cryoCore: 2 }]);
    expect(get('doubledash').costs).toEqual([{ cryoCore: 3 }]);
    expect(get('bootprogram').costs).toEqual([{ overCore: 1 }]);
  });
});

describe('セーブデータ', () => {
  it('保存して読み込むと元に戻る。版の番号を持つ', () => {
    const storage = fakeStorage();
    const save = createSave();
    save.materials.boarCore = 4;
    save.upgrades.frame = 2;
    save.fragments.push('bb-01');
    save.achievements.push('boltboar');
    save.records.kills = 77;
    save.tutorialSeen = true;
    expect(storeSlot(storage, 1, save)).toBe(true);
    expect(JSON.parse(storage.getItem(slotKey(1))).version).toBe(SAVE_VERSION);
    expect(loadSlot(storage, 1)).toEqual(save);
  });

  it('セーブ枠は3つで、それぞれ別に保存される。消すと空に戻る', () => {
    const storage = fakeStorage();
    expect(SLOT_COUNT).toBe(3);
    expect(listSlots(storage)).toEqual([null, null, null]);
    const a = createSave();
    a.records.runs = 5;
    const c = createSave();
    c.records.runs = 9;
    storeSlot(storage, 1, a);
    storeSlot(storage, 3, c);
    expect(listSlots(storage).map((s) => s?.records.runs ?? null)).toEqual([5, null, 9]);
    deleteSlot(storage, 1);
    expect(listSlots(storage).map((s) => s?.records.runs ?? null)).toEqual([null, null, 9]);
  });

  it('セーブ枠ができる前のデータは、枠1に引き継がれる（枠1が空のときだけ）', () => {
    const storage = fakeStorage();
    const old = createSave();
    old.records.runs = 12;
    storage.setItem('legend-of-monster/save', JSON.stringify(old));
    expect(listSlots(storage)[0].records.runs).toBe(12);
    expect(storage.getItem('legend-of-monster/save')).toBe(null);

    // 枠1にすでにデータがあるときは、上書きしない
    const storage2 = fakeStorage();
    const mine = createSave();
    mine.records.runs = 3;
    storeSlot(storage2, 1, mine);
    storage2.setItem('legend-of-monster/save', JSON.stringify(old));
    expect(listSlots(storage2)[0].records.runs).toBe(3);
  });

  it('壊れている・新しすぎる版のデータは、空の枠として扱う', () => {
    const storage = fakeStorage();
    storage.setItem(slotKey(1), '{こわれた');
    expect(loadSlot(storage, 1)).toBe(null);
    storage.setItem(slotKey(2), JSON.stringify({ version: SAVE_VERSION + 1, materials: { boarCore: 99 } }));
    expect(loadSlot(storage, 2)).toBe(null);
    expect(loadSlot(null, 1)).toBe(null);
  });

  it('項目が足りないセーブは、足りないところだけ初期値で埋める', () => {
    const storage = fakeStorage();
    storage.setItem(slotKey(1), JSON.stringify({ version: 1, materials: { boarCore: 2 } }));
    const save = loadSlot(storage, 1);
    expect(save.materials.boarCore).toBe(2);
    expect(save.weapons).toEqual(['greatsword']);
    expect(save.records.runs).toBe(0);
    expect(save.tutorialSeen).toBe(false);
  });

  it('保存できない環境でも止まらない', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(loadSlot(broken, 1)).toBe(null);
    expect(storeSlot(broken, 1, createSave())).toBe(false);
    expect(listSlots(broken)).toEqual([null, null, null]);
    deleteSlot(broken, 1);
  });
});

describe('ボス素材', () => {
  it('初めて倒すと3個、2回目以降は1個。倒した時点で確定し、そのあと死んでも失わない', () => {
    const save = createSave();
    const r1 = createRun({ rng: seeded(3), save });
    const w1 = bossRoom(r1);
    const notes = killBoss(r1, w1);
    expect(save.materials.boarCore).toBe(META.firstKillMaterials);
    expect(save.bossKills.boltboar).toBe(1);
    expect(r1.gained.materials).toEqual({ boarCore: 3 });
    expect(notes.some((n) => n.kind === 'material')).toBe(true);

    // 倒したあとに死んでも、素材はセーブデータに残っている
    finishRun(r1, w1, 'dead');
    expect(save.materials.boarCore).toBe(3);

    const r2 = createRun({ rng: seeded(4), save });
    killBoss(r2, bossRoom(r2));
    expect(save.materials.boarCore).toBe(4);
    expect(save.records.runs).toBe(2);
  });
});

describe('恒久強化', () => {
  it('素材が足りないと買えない。買うと素材が減り、段階が上がる', () => {
    const save = createSave();
    expect(buyUpgrade(save, 'frame')).toBe(false);
    save.materials.boarCore = 2;
    expect(buyUpgrade(save, 'frame')).toBe(true);
    expect(buyUpgrade(save, 'frame')).toBe(true);
    expect(buyUpgrade(save, 'frame')).toBe(false);
    expect(save.upgrades.frame).toBe(2);
    expect(save.materials.boarCore).toBe(0);
  });

  it('最大まで上げると、それ以上は買えない', () => {
    const save = createSave();
    save.materials = { boarCore: 99, cryoCore: 99, overCore: 99 };
    for (let i = 0; i < 10; i++) buyUpgrade(save, 'frame');
    expect(save.upgrades.frame).toBe(5);
    expect(nextUpgradeCost(save, DATA.upgrades.get('frame'))).toBe(null);
    expect(buyUpgrade(save, 'ougi-greatsword')).toBe(true);
    expect(buyUpgrade(save, 'ougi-greatsword')).toBe(false);
  });

  it('武器の解放：片手剣はボアコア2個、銃はクライオコア2個。足りないと解放できない', () => {
    const save = createSave();
    save.materials = { boarCore: 1 };
    expect(unlockWeapon(save, 'sword')).toBe(false);
    save.materials = { boarCore: 2, cryoCore: 2 };
    expect(unlockWeapon(save, 'sword')).toBe(true);
    expect(unlockWeapon(save, 'sword')).toBe(false); // 2回は買えない
    expect(unlockWeapon(save, 'gun')).toBe(true);
    expect(save.weapons).toEqual(['greatsword', 'sword', 'gun']);
    expect(save.materials).toEqual({ boarCore: 0, cryoCore: 0 });
  });

  it('買った強化は次のランに乗る：最大HP、攻撃力、修復キット、二重ダッシュ、起動プログラム', () => {
    const save = createSave();
    save.materials = { boarCore: 99, cryoCore: 99, overCore: 99 };
    buyUpgrade(save, 'frame');
    buyUpgrade(save, 'frame');
    buyUpgrade(save, 'nerve');
    buyUpgrade(save, 'kitslot');
    buyUpgrade(save, 'doubledash');
    buyUpgrade(save, 'bootprogram');
    expect(permanentBonuses(save)).toMatchObject({ kits: 1, startChoice: true });

    const r = createRun({ rng: seeded(5), save });
    const world = enterRoom(r);
    const p = world.player;
    expect(p.stats.maxHp).toBe(PLAYER.maxHp + 20);
    expect(p.hp).toBe(PLAYER.maxHp + 20);
    expect(p.stats.attackMul).toBeCloseTo(1.05);
    expect(p.build.kits).toBe(PLAYER.kit.start + 1);
    expect(p.stats.dashCharges).toBe(2);

    // 起動プログラム：最初にインプラントを1つ選べる（レベルは上がらない）
    run(world, 0.1);
    expect(world.choice.options).toHaveLength(3);
    chooseImplant(world, 0);
    expect(p.build.level).toBe(1);
    expect(Object.keys(p.build.implants)).toHaveLength(1);
  });

  it('二重ダッシュ：2回続けて出せて、1回ずつ溜め直す', () => {
    const save = createSave();
    save.upgrades.doubledash = 1;
    const world = enterRoom(createRun({ rng: seeded(5), save }));
    const p = world.player;
    const x0 = p.x;
    updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
    run(world, 0.25);
    updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
    run(world, 0.25);
    expect(p.x - x0).toBeGreaterThan(PLAYER.dash.distance * 2 - 20);
    expect(p.dashCharges).toBe(0);
    const x1 = p.x;
    updateWorld(world, DT, { ...idle, dashPressed: true });
    run(world, 0.2);
    expect(p.x).toBe(x1); // 3回目は出ない
    run(world, PLAYER.dash.cooldown);
    expect(p.dashCharges).toBeGreaterThanOrEqual(1);
    run(world, PLAYER.dash.cooldown);
    expect(p.dashCharges).toBe(2);
  });

  it('大剣の奥義：買うとランで使えるようになり、次のエリアに進むと使用回数が戻る', () => {
    const save = createSave();
    save.materials = { overCore: 1 };
    expect(buyUpgrade(save, 'ougi-greatsword')).toBe(true);
    const r = createRun({ rng: seeded(5), save });
    expect(r.build.ougi).toEqual(['greatsword']);
    const world = enterRoom(r);
    r.build.ougiUsed = true;
    leaveRoom(r, world, NEXT_AREA);
    expect(r.build.ougiUsed).toBe(false);
  });

  it('強化がなければ、ランは素の状態で始まる', () => {
    const p = enterRoom(createRun({ rng: seeded(5), save: createSave() })).player;
    expect(p.stats.maxHp).toBe(PLAYER.maxHp);
    expect(p.stats.dashCharges).toBe(1);
    expect(p.build.kits).toBe(PLAYER.kit.start);
  });
});

describe('データ片', () => {
  it('ボスを倒すと、そのボスのデータ片が手に入る（1回だけ）', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    killBoss(r, bossRoom(r));
    expect(save.fragments).toEqual(['bb-core']);
    const r2 = createRun({ rng: seeded(4), save });
    killBoss(r2, bossRoom(r2));
    expect(save.fragments).toEqual(['bb-core']);
    expect(r2.gained.fragments).toEqual([]);
  });

  it('データ金庫には、まだ持っていないデータ片が置かれる。拾った時点でセーブデータに入る', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(6), save });
    // データ金庫の部屋に入ったことにする
    r.plan.nodes.start.type = 'vault';
    const world = enterRoom(r);
    run(world, 0.1);
    const o = world.objects.find((x) => x.kind === 'fragment');
    expect(DATA.fragments.get(o.id).source).toBe('vault');
    world.player.x = o.x;
    world.player.y = o.y;
    run(world, 0.05);
    interact(world);
    handleEvents(r, world);
    expect(save.fragments).toEqual([o.id]);
    expect(world.objects.some((x) => x.kind === 'fragment')).toBe(false);
  });

  it('全部持っていたら、もう置かれない', () => {
    const save = createSave();
    save.fragments = DATA.fragments.ids();
    expect(pickFragment(save, 'slum', 'vault', seeded(1))).toBe(null);
  });
});

describe('実績', () => {
  it('出撃・ボス撃破・データ片で解除され、同じ実績は1回だけ', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    expect(save.achievements).toEqual(['first-sortie']);
    const notes = killBoss(r, bossRoom(r));
    expect(save.achievements).toEqual(expect.arrayContaining(['boltboar', 'no-damage-boss', 'fragment-first']));
    expect(notes.filter((n) => n.kind === 'achievement').length).toBeGreaterThanOrEqual(3);

    const before = save.achievements.length;
    const r2 = createRun({ rng: seeded(4), save });
    killBoss(r2, bossRoom(r2));
    expect(save.achievements).toHaveLength(before);
    expect(r2.gained.achievements).toEqual([]);
  });

  it('ダメージを受けてからボスを倒すと「無傷の仕事」は解除されない', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    const world = bossRoom(r);
    hurtPlayer(world, 5);
    killBoss(r, world);
    expect(save.achievements).toContain('boltboar');
    expect(save.achievements).not.toContain('no-damage-boss');
  });

  it('系統を3つそろえる・レジェンド装備・エリート撃破・累計撃破数', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    const world = enterRoom(r);
    for (const id of ['chain', 'overcurrent', 'shockdash']) {
      world.choice = { type: 'implant', options: [DATA.implants.get(id)] };
      chooseImplant(world, 0);
      handleEvents(r, world);
    }
    expect(save.achievements).toContain('family');

    equipItem(world, { slot: 'acc', rarity: 2, effects: [], unique: null, name: 'epic' });
    handleEvents(r, world);
    expect(save.achievements).not.toContain('legend');
    equipItem(world, { slot: 'acc', rarity: 3, effects: [], unique: 'overflow', name: 'legend' });
    handleEvents(r, world);
    expect(save.achievements).toContain('legend');

    processEvent(save, r, { type: 'eliteKill' });
    expect(save.achievements).toContain('elite');

    save.records.kills = 98;
    processEvent(save, r, { type: 'kill' });
    expect(save.achievements).not.toContain('kills-100');
    processEvent(save, r, { type: 'kill' });
    expect(save.achievements).toContain('kills-100');
  });

  it('データ片をすべて集めると「全記録回収」', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    const ids = DATA.fragments.ids();
    ids.slice(0, -1).forEach((id) => processEvent(save, r, { type: 'fragment', id }));
    expect(save.achievements).not.toContain('fragment-all');
    processEvent(save, r, { type: 'fragment', id: ids.at(-1) });
    expect(save.achievements).toContain('fragment-all');
  });

  it('「大剣で初めてクリア」は、最後のボスを倒すまで解除されない', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    killBoss(r, bossRoom(r)); // エリア1のボスは最後のボスではない
    expect(save.achievements).not.toContain('clear-greatsword');
    expect(save.records.clears).toBe(0);
    processEvent(save, r, { type: 'runClear' });
    expect(save.achievements).toContain('clear-greatsword');
    expect(save.records.clears).toBe(1);
  });
});

describe('記録', () => {
  it('出撃回数、倒した数、最高到達が残る', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    const world = bossRoom(r);
    killBoss(r, world);
    finishRun(r, world, 'areaClear');
    expect(save.records).toMatchObject({ runs: 1, kills: 1, bestArea: 0, bestStep: r.plan.columns - 1 });
    expect(r.outcome).toBe('areaClear');
    expect(r.kills).toBe(1);
    finishRun(r, world, 'dead'); // 終わり方は最初に決まったものが残る
    expect(r.outcome).toBe('areaClear');
  });
});

describe('M9 で足した実績', () => {
  it('実績は28個あり、どれも名前と説明がある', () => {
    const list = DATA.achievements.all();
    expect(list).toHaveLength(28);
    for (const def of list) {
      expect(def.name, def.id).toBeTruthy();
      expect(def.desc, def.id).toBeTruthy();
    }
  });

  it('出来事が起きると解除される：ジャストガード、奥義、闇市、消耗品', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    for (const [type, id] of [['guard', 'just-guard'], ['ougi', 'ougi'], ['buy', 'market'], ['item', 'item']]) {
      expect(save.achievements).not.toContain(id);
      processEvent(save, r, { type });
      expect(save.achievements).toContain(id);
    }
  });

  it('レベル8、10回出撃、累計500体', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    processEvent(save, r, { type: 'levelup', level: 7 });
    expect(save.achievements).not.toContain('level-8');
    processEvent(save, r, { type: 'levelup', level: 8 });
    expect(save.achievements).toContain('level-8');

    for (let i = 0; i < 8; i++) createRun({ rng: seeded(3), save });
    expect(save.records.runs).toBe(9);
    expect(save.achievements).not.toContain('runs-10');
    createRun({ rng: seeded(3), save });
    expect(save.achievements).toContain('runs-10');

    save.records.kills = 499;
    processEvent(save, r, { type: 'kill' });
    expect(save.achievements).toContain('kills-500');
  });

  it('敵を倒してレベルが上がると、レベルアップの出来事が出る', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(3), save });
    const world = enterRoom(r);
    world.countdown = 0;
    while (world.enemies.length === 0) updateWorld(world, DT, idle);
    const e = world.enemies[0];
    e.def = { ...e.def, xp: 40 };
    e.spawnT = 0;
    hitEnemy(world, e, 99999, 1, 0, 0);
    expect(world.events.some((ev) => ev.type === 'levelup' && ev.level === 2)).toBe(true);
    expect(world.fx.sounds).toContain('kill');
  });
});
