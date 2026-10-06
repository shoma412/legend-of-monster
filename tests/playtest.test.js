import { describe, expect, it } from 'vitest';
import { grantUpgrade } from './helpers/upgrades.js';
import { FEEL, ITEMS, LOOT, PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { NEXT_AREA, createRun, enterRoom, hasNextArea, leaveRoom, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { doorOptions, generateVault } from '../src/logic/areaGen.js';
import { makeItem, rarityWeights, rollRarity } from '../src/logic/loot.js';
import { permanentBonuses } from '../src/logic/meta.js';
import { SAVE_VERSION, createSave } from '../src/logic/save.js';
import { CODE_PREFIX, exportSaveText, importSaveText } from '../src/logic/saveTransfer.js';
import { computeStats, createBuild, weaponTraitText } from '../src/logic/stats.js';
import { SUSPEND_VERSION, canSuspend, deleteSuspend, loadSuspend, restoreRun, snapshotRun, storeSuspend, suspendKey, suspendSummary } from '../src/logic/suspend.js';

// 2026-10-06 のテストプレイを受けた調整（docs/詳細仕様.md「20. テストプレイを受けた調整」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// その部屋から出られる扉（ボス部屋なら、次のエリアへの扉）
function enterDoors(run) {
  return run.plan.current === 'boss' && hasNextArea(run) ? [{ id: NEXT_AREA, type: 'descend' }] : doorOptions(run.plan);
}

function makeWorld() {
  const world = createWorld({ waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity;
  recalcStats(world.player);
  return world;
}

function addEnemy(world, id, dx, dy = 0) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng);
  e.cd = 99;
  world.enemies.push(e);
  return e;
}

describe('装備のレア度：エリアが進むほど良いものが出る', () => {
  const share = (tier, bonus, n = 40000) => {
    const rng = seeded(5 + tier * 7 + bonus);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) counts[rollRarity(rng, bonus, tier)]++;
    return counts.map((c) => c / n);
  };

  it('エリアごとの確率は、足すと100%。エリアが分からないときは、2番目のエリアと同じ', () => {
    for (const weights of LOOT.areaWeights) expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(100);
    expect(rarityWeights(null)).toEqual(LOOT.areaWeights[1]);
    expect(rarityWeights(9)).toEqual(LOOT.areaWeights.at(-1)); // 4番目以降のエリアは、最後の値
  });

  it('レジェンドとエピックは、エリア1でほとんど出ず、エリア3でいちばん出やすい', () => {
    const [a1, a2, a3] = [0, 1, 2].map((tier) => share(tier, 0));
    expect(a1[3]).toBeLessThan(0.008);
    expect(a1[2]).toBeLessThan(0.05);
    expect(a2[3]).toBeGreaterThan(a1[3]);
    expect(a3[3]).toBeGreaterThan(a2[3]);
    expect(a3[2]).toBeGreaterThan(a2[2]);
    expect(a2[2]).toBeGreaterThan(a1[2]);
    expect(a3[3]).toBeCloseTo(0.05, 1);
  });

  it('底上げは「引き直して良いほうを取る」。1段まるごと上がることはない', () => {
    // エリア1の金庫（底上げ1）：レジェンドは 1% 台まで。以前は 12% だった
    const vault = share(0, 1);
    expect(vault[3]).toBeLessThan(0.015);
    expect(vault[3]).toBeGreaterThan(share(0, 0)[3]);
    expect(vault[0]).toBeGreaterThan(0.4); // コモンもふつうに出る
    // エリア3のボス（底上げ2）：レジェンドは 14% 前後
    expect(share(2, 2)[3]).toBeGreaterThan(0.1);
    expect(share(2, 2)[3]).toBeLessThan(0.2);
  });

  it('データ金庫の中身も、エリアで変わる', () => {
    const best = (tier) => {
      const rng = seeded(21);
      let high = 0;
      for (let i = 0; i < 600; i++) high += generateVault(rng, tier).filter((it) => it.rarity >= 2).length;
      return high;
    };
    expect(best(2)).toBeGreaterThan(best(0) * 2);
  });

  it('ボスが落とす装備は、レア以上', () => {
    const rng = seeded(4);
    for (let i = 0; i < 300; i++) expect(makeItem(rng, { minRarity: LOOT.bossMinRarity, tier: 0 }).rarity).toBeGreaterThanOrEqual(1);
  });

  function killBossIn(run) {
    skipToBoss(run, enterRoom(run));
    const world = enterRoom(run);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    return world;
  }

  it('エリア1のボスは装備と消耗品を落とす。マップの最後のボスは、どちらも落とさない', () => {
    const save = createSave();
    const run = createRun({ rng: seeded(7), save, mapId: 'map1' });
    const first = killBossIn(run);
    expect(first.room.lootTier).toBe(0);
    expect(first.room.noBossLoot).toBe(false);
    expect(first.loot.length).toBeGreaterThan(0);
    for (const l of first.loot) expect(l.item.rarity).toBeGreaterThanOrEqual(LOOT.bossMinRarity);
    expect(first.objects.some((o) => o.kind === 'pickup')).toBe(true);

    run.areaIndex = run.map.areas.length - 1;
    run.plan = null;
    const last = createRun({ rng: seeded(8), save, mapId: 'map1' });
    last.areaIndex = last.map.areas.length - 1;
    const world = killBossIn(last);
    expect(world.room.noBossLoot).toBe(true);
    expect(world.loot).toHaveLength(0);
    expect(world.objects.some((o) => o.kind === 'pickup')).toBe(false);
  });
});

describe('クリティカルの見せ方', () => {
  it('「!」は付けず、数字を大きく・黄色にする', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 60);
    e.hp = e.maxHp = 1000;
    world.rng = () => 0.01;
    hitEnemy(world, e, 30, 1, 0, 0);
    const crit = world.fx.texts.at(-1);
    world.rng = () => 0.99;
    hitEnemy(world, e, 30, 1, 0, 0);
    const normal = world.fx.texts.at(-1);
    expect(crit.text).not.toContain('!');
    expect(crit.size).toBe(FEEL.critTextSize);
    expect(crit.size).toBeGreaterThan(normal.size);
    expect(crit.color).not.toBe(normal.color);
  });
});

describe('恒久強化「携行ポーチ」', () => {
  it('1段ごとに消耗品の枠が1つ増え、最大4枠', () => {
    const save = createSave();
    expect(createBuild(permanentBonuses(save)).items).toHaveLength(ITEMS.slots);
    grantUpgrade(save, 'pouch');
    expect(createBuild(permanentBonuses(save)).items).toHaveLength(3);
    grantUpgrade(save, 'pouch');
    expect(createBuild(permanentBonuses(save)).items).toHaveLength(4);
  });
});

describe('近接攻撃の踏み込み', () => {
  // 右を向いて1回攻撃し、振りかぶりが終わるまでに進んだ距離
  function lungeDistance(world) {
    const p = world.player;
    const x = p.x;
    const aim = { aimX: p.x + 300, aimY: p.y };
    updateWorld(world, DT, { ...idle, ...aim, attack: true, attackPressed: true });
    for (let i = 0; i < 60 && p.attack?.phase === 'windup'; i++) updateWorld(world, DT, { ...idle, ...aim });
    return p.x - x;
  }

  it('届く敵がいないときは、今までどおり踏み込む', () => {
    const world = makeWorld();
    const step = world.player.weapon.combo[0].lunge;
    expect(step).toBeGreaterThan(0);
    expect(lungeDistance(world)).toBeGreaterThan(step * 0.8);
    // 遠くに敵がいても同じ
    const far = makeWorld();
    addEnemy(far, 'grunt', 300).hp = 100000;
    expect(lungeDistance(far)).toBeGreaterThan(step * 0.8);
  });

  it('もう届く敵がいるときは、踏み込まない', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 50);
    e.hp = e.maxHp = 100000;
    e.def = { ...e.def, speed: 0 };
    expect(Math.abs(lungeDistance(world))).toBeLessThan(1);
    expect(e.hp).toBeLessThan(e.maxHp); // 攻撃そのものは当たる
  });
});

describe('中断セーブ', () => {
  const fakeStorage = () => {
    const map = new Map();
    return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), size: () => map.size };
  };
  // 最初の部屋をクリアした状態のラン
  function clearedRoom(seed = 3) {
    const save = createSave();
    const run = createRun({ rng: seeded(seed), save, mapId: 'map1' });
    const world = enterRoom(run);
    world.player.inv = Infinity;
    for (let t = 0; t < 120 && world.mode !== 'clear'; t += DT) {
      for (const e of world.enemies) if (!e.dead && e.spawnT <= 0) hitEnemy(world, e, 99999, 1, 0, 0, { unblockable: true });
      if (world.choice) world.choice = null;
      updateWorld(world, DT, idle);
    }
    world.choice = null;
    world.pendingLevelUps = 0;
    return { save, run, world };
  }

  it('戦闘中は中断できない。部屋をクリアすると中断できる', () => {
    const save = createSave();
    const run = createRun({ rng: seeded(3), save, mapId: 'map1' });
    const fighting = enterRoom(run);
    expect(fighting.mode).toBe('play');
    expect(canSuspend(run, fighting)).toBe(false);
    const { run: r2, world } = clearedRoom();
    expect(world.mode).toBe('clear');
    expect(canSuspend(r2, world)).toBe(true);
    // レベルアップの3択が出ている間と、ランが終わったあとは、中断できない
    world.choice = [{}];
    expect(canSuspend(r2, world)).toBe(false);
    world.choice = null;
    r2.outcome = 'dead';
    expect(canSuspend(r2, world)).toBe(false);
  });

  it('マップの最後のボスを倒したあとは、中断できない（倒すとランが終わるため）', () => {
    const { run, world } = clearedRoom();
    run.areaIndex = run.map.areas.length - 1;
    run.plan.current = 'boss';
    expect(canSuspend(run, world)).toBe(false);
    run.areaIndex = 0;
    expect(canSuspend(run, world)).toBe(true);
  });

  it('中断して再開すると、同じ場所・同じ持ち物で、クリア済みの部屋（扉が開いている）から始まる', () => {
    const { save, run, world } = clearedRoom();
    const p = world.player;
    p.hp = 61;
    p.build.credits = 123;
    p.build.kits = 1;
    p.build.level = 4;
    p.build.implants[DATA.implants.all()[0].id] = 2;
    p.build.gear.mod = makeItem(seeded(2), { rarity: 3, slot: 'mod' });
    p.build.bag.push(makeItem(seeded(4), { rarity: 1 }));
    p.build.items[0] = { id: DATA.consumables.ids()[0], count: 2 };
    const before = JSON.parse(JSON.stringify(p.build));
    const data = snapshotRun(run, world);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data); // そのまま保存できる形

    const again = restoreRun(JSON.parse(JSON.stringify(data)), save, seeded(99));
    expect(again.map.id).toBe('map1');
    expect(again.areaIndex).toBe(run.areaIndex);
    expect(again.plan.current).toBe(run.plan.current);
    expect(again.kills).toBe(run.kills + world.kills);
    const runsBefore = save.records.runs;
    const w2 = enterRoom(again);
    expect(save.records.runs).toBe(runsBefore); // 出撃の回数は増えない
    expect(w2.room.type).toBe('resume');
    expect(w2.room.waves).toHaveLength(0);
    expect(w2.room.countdown).toBeUndefined();
    expect(w2.room.doors).toEqual(enterDoors(run));
    expect(w2.player.hp).toBe(61);
    expect(w2.player.build).toEqual(before);
    for (let i = 0; i < 30; i++) updateWorld(w2, DT, idle);
    expect(w2.mode).toBe('clear');
    expect(w2.enemies).toHaveLength(0);
    // 再開の扱いは最初の部屋だけ。次の部屋は、ふつうの部屋
    leaveRoom(again, w2, w2.room.doors[0].id);
    expect(enterRoom(again).room.type).not.toBe('resume');
  });

  it('保存先への読み書き：再開できる文が出る。枠を分けて持つ。消すと読めない', () => {
    const { run, world } = clearedRoom();
    const storage = fakeStorage();
    expect(loadSuspend(storage, 2)).toBeNull();
    expect(storeSuspend(storage, 2, snapshotRun(run, world))).toBe(true);
    expect(loadSuspend(storage, 1)).toBeNull();
    const data = loadSuspend(storage, 2);
    expect(suspendSummary(data)).toContain('MAP 01');
    expect(suspendSummary(data)).toContain(DATA.areas.get(run.map.areas[0]).name);
    deleteSuspend(storage, 2);
    expect(loadSuspend(storage, 2)).toBeNull();
    expect(storeSuspend(null, 1, data)).toBe(false); // 保存できない環境
  });

  it('形が合わない・壊れた中断データは、再開しない（隠れ家から始まる）', () => {
    const { save, run, world } = clearedRoom();
    const good = snapshotRun(run, world);
    const broken = (change) => {
      const d = JSON.parse(JSON.stringify(good));
      change(d);
      return restoreRun(d, save);
    };
    expect(restoreRun(good, save)).not.toBeNull();
    expect(restoreRun(null, save)).toBeNull();
    expect(broken((d) => { d.version = SUSPEND_VERSION + 1; })).toBeNull();
    expect(broken((d) => { d.mapId = 'nowhere'; })).toBeNull();
    expect(broken((d) => { d.plan.current = 'x-y'; })).toBeNull();
    expect(broken((d) => { d.build.implants.unknownPart = 1; })).toBeNull();
    expect(broken((d) => { d.build.gear.mod = { slot: 'mod', rarity: 0, effects: [{ id: 'gone', value: 1 }], unique: null, name: '?' }; })).toBeNull();
    expect(broken((d) => { d.hp = 0; })).toBeNull();
    expect(suspendSummary({ version: 0 })).toBeNull();
    const storage = fakeStorage();
    storage.setItem(suspendKey(1), '{こわれたデータ');
    expect(loadSuspend(storage, 1)).toBeNull();
  });
});

describe('セーブデータの書き出し／読み込み', () => {
  const sample = () => {
    const save = createSave();
    save.tree.seed = 12345; // スキルツリーの種は、作るたびに変わるので固定する
    save.materials.boarCore = 4;
    save.achievements.push('firstRun');
    save.records.runs = 12;
    save.seenDialogues.push('会話・その1');
    return save;
  };

  it('書き出したコードを読み込むと、同じセーブデータに戻る（日本語が入っていても）', () => {
    const save = sample();
    const code = exportSaveText(save);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    expect(code).toMatch(/^LOM1:[A-Za-z0-9+/=]+$/);
    const result = importSaveText(code);
    expect(result.ok).toBe(true);
    expect(result.save).toEqual(save);
  });

  it('前後の空白や改行、途中の改行が入っていても読める', () => {
    const code = exportSaveText(sample());
    const messy = `  \n${code.slice(0, 40)}\n${code.slice(40)}  \n`;
    expect(importSaveText(messy).save).toEqual(sample());
  });

  it('ブラウザから直接取り出したセーブデータの文字列も、そのまま読める', () => {
    const save = sample();
    const raw = JSON.stringify(save);
    expect(importSaveText(raw).save).toEqual(save);
    expect(importSaveText(`'${raw}'`).save).toEqual(save); // 引用符つきでコピーされた場合
    expect(importSaveText(JSON.stringify(raw)).save).toEqual(save); // 文字列として二重に包まれた場合
  });

  it('古い版のデータは、今の形に直して読み込む', () => {
    const old = { version: 1, materials: { boarCore: 2 }, upgrades: {}, weapons: ['greatsword'], selected: 'greatsword', bossKills: { overload: 1 }, fragments: [], achievements: [], records: { runs: 3, clears: 1, kills: 50, bestArea: 2, bestStep: 5 }, tutorialSeen: true };
    const result = importSaveText(JSON.stringify(old));
    expect(result.ok).toBe(true);
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.materials.boarCore).toBe(2);
    expect(result.save.cycle).toBe(2); // 版3への変換：オーバーロードを倒していれば2周目が選べる
  });

  it('読めないコード・関係ない文字・新しすぎる版は、理由を付けて断る', () => {
    for (const text of ['', '   ', 'こんにちは', 'LOM1:@@@@', 'LOM1:' + btoa('{broken'), '[1,2,3]', '{"name":"x"}', 'null']) {
      const result = importSaveText(text);
      expect(result.ok, text).toBe(false);
      expect(result.reason.length, text).toBeGreaterThan(0);
    }
    const future = importSaveText(JSON.stringify({ ...createSave(), version: SAVE_VERSION + 1 }));
    expect(future.ok).toBe(false);
    expect(future.reason).toContain('新しい');
    // 途中で切れたコード
    const code = exportSaveText(sample());
    expect(importSaveText(code.slice(0, Math.floor(code.length / 2))).ok).toBe(false);
  });
});

describe('武器ごとのステータス', () => {
  const statsWith = (weaponId) => {
    const build = createBuild();
    build.weaponId = weaponId;
    return computeStats(build);
  };

  it('大剣は打たれ強くて遅い。片手剣は身軽。銃は打たれ弱い', () => {
    const plain = computeStats(createBuild());
    expect(plain.damageTaken).toBe(1);
    expect(plain.moveSpeed).toBe(PLAYER.moveSpeed);
    expect(statsWith('greatsword').damageTaken).toBeCloseTo(0.9);
    expect(statsWith('greatsword').moveSpeed).toBeCloseTo(PLAYER.moveSpeed * 0.95);
    expect(statsWith('sword').damageTaken).toBeCloseTo(1);
    expect(statsWith('sword').moveSpeed).toBeCloseTo(PLAYER.moveSpeed * 1.05);
    expect(statsWith('gun').damageTaken).toBeCloseTo(1.1);
    expect(statsWith('gun').moveSpeed).toBeCloseTo(PLAYER.moveSpeed);
  });

  it('出撃すると、選んだ武器の補正が乗る。装備やインプラントの補正とは足し合わせになる', () => {
    const run = createRun({ rng: seeded(2), save: createSave(), mapId: 'map1', weaponId: 'gun' });
    expect(run.build.weaponId).toBe('gun');
    const world = enterRoom(run);
    expect(world.player.stats.damageTaken).toBeCloseTo(1.1);
    world.player.build.permanent.push({ mods: [{ stat: 'damageTaken', add: -0.03 }] });
    recalcStats(world.player);
    expect(world.player.stats.damageTaken).toBeCloseTo(1.07);
  });

  it('説明の文：どの武器も、補正がそのまま文になる', () => {
    expect(weaponTraitText(DATA.weapons.get('greatsword'))).toBe('被ダメージ −10%／移動速度 −5%');
    expect(weaponTraitText(DATA.weapons.get('sword'))).toBe('移動速度 +5%');
    expect(weaponTraitText(DATA.weapons.get('gun'))).toBe('被ダメージ +10%');
    expect(weaponTraitText(null)).toBe('');
  });
});
