import { describe, expect, it } from 'vitest';
import { FEEL, ITEMS, LOOT } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, enterRoom, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { generateVault } from '../src/logic/areaGen.js';
import { makeItem, rarityWeights, rollRarity } from '../src/logic/loot.js';
import { buyUpgrade, permanentBonuses } from '../src/logic/meta.js';
import { createSave } from '../src/logic/save.js';
import { createBuild } from '../src/logic/stats.js';

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
    save.materials.boarCore = 2;
    save.materials.cryoCore = 2;
    expect(buyUpgrade(save, 'pouch')).toBe(true);
    expect(createBuild(permanentBonuses(save)).items).toHaveLength(3);
    expect(buyUpgrade(save, 'pouch')).toBe(true);
    expect(createBuild(permanentBonuses(save)).items).toHaveLength(4);
    expect(buyUpgrade(save, 'pouch')).toBe(false);
    expect(save.materials.boarCore).toBe(0);
    expect(save.materials.cryoCore).toBe(0);
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
