import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVEL, PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { openImplantChoice, skipImplantChoice } from '../src/game/build.js';
import { canAddImplant, implantCap, implantKinds, rollImplantChoices } from '../src/logic/level.js';
import { permanentBonuses } from '../src/logic/meta.js';
import { createSave } from '../src/logic/save.js';
import { buildTree } from '../src/logic/skillTree.js';
import { computeStats, createBuild } from '../src/logic/stats.js';

// インプラントの枠と、レベルアップでの成長（docs/詳細仕様.md「34. インプラントの枠と、レベルアップでの成長」）
const rngOf = (seed) => {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
};
const general = DATA.implants.all().filter((d) => d.species === 'general').map((d) => d.id);

describe('インプラントの枠', () => {
  it('最初は5種類。スキップは2回', () => {
    const build = createBuild();
    expect(implantCap(build)).toBe(5);
    expect(build.skips).toBe(2);
  });

  it('枠が空いている間は、新しいものも出る。いっぱいになると、持っているものの強化だけが出る', () => {
    const build = createBuild();
    for (const id of general.slice(0, 4)) build.implants[id] = 1;
    expect(rollImplantChoices(build, rngOf(1), 50).some((d) => !(d.id in build.implants))).toBe(true);
    build.implants[general[4]] = 1;
    expect(implantKinds(build)).toBe(5);
    for (let seed = 1; seed <= 20; seed++) {
      const options = rollImplantChoices(build, rngOf(seed));
      expect(options.length).toBeGreaterThan(0);
      for (const d of options) expect(d.id in build.implants, d.id).toBe(true);
    }
  });

  it('いっぱいのとき、持っていないものは入れられない。持っているものは入れられる（強化）', () => {
    const build = createBuild();
    for (const id of general.slice(0, 5)) build.implants[id] = 1;
    expect(canAddImplant(build, general[5])).toBe(false);
    expect(canAddImplant(build, general[0])).toBe(true);
  });

  it('全部 Lv5 で枠もいっぱいなら、3択は出ず、代わりに HP が少し回復する', () => {
    const build = createBuild();
    for (const id of general.slice(0, 5)) build.implants[id] = LEVEL.implantMax;
    const world = { player: { build, stats: computeStats(build), hp: 10, x: 0, y: 0 }, rng: rngOf(3), fx: { texts: [], sounds: [], rings: [] }, events: [] };
    openImplantChoice(world);
    expect(world.choice ?? null).toBeNull();
    expect(world.player.hp).toBeCloseTo(10 + world.player.stats.maxHp * LEVEL.maxedHeal);
  });

  it('スキップ：何も取らずに閉じる。回数が減り、0 になると使えない', () => {
    const build = createBuild();
    const world = { player: { build, stats: computeStats(build), hp: 100, x: 0, y: 0 }, rng: rngOf(5), fx: { texts: [], sounds: [], rings: [] }, events: [] };
    for (const left of [1, 0]) {
      openImplantChoice(world);
      expect(world.choice).toBeTruthy();
      expect(skipImplantChoice(world)).toBe(true);
      expect(world.choice).toBeNull();
      expect(build.skips).toBe(left);
      expect(implantKinds(build)).toBe(0);
    }
    openImplantChoice(world);
    expect(skipImplantChoice(world)).toBe(false);
    expect(world.choice).toBeTruthy();
  });
});

describe('レベルアップでの成長', () => {
  it('レベルが1上がるごとに、最大HP +5、攻撃力 +2%', () => {
    const build = createBuild();
    const base = computeStats(build);
    expect(base.maxHp).toBe(PLAYER.maxHp);
    build.level = 11;
    const up = computeStats(build);
    expect(up.maxHp).toBe(PLAYER.maxHp + 50);
    expect(up.attackMul / base.attackMul).toBeCloseTo(1.2);
  });
});

describe('スキルツリー：インプラント拡張と選別回路（since: 6）', () => {
  it('インプラント拡張は3段で 5 → 8種類。選別回路は2段で 2 → 4回', () => {
    const save = createSave();
    expect(permanentBonuses(save)).toMatchObject({ implantSlots: 0, skips: 0 });
    save.upgrades = { implantslot: 3, skipchip: 2 };
    const bonus = permanentBonuses(save);
    expect(bonus).toMatchObject({ implantSlots: 3, skips: 2 });
    const build = createBuild(bonus);
    expect(implantCap(build)).toBe(8);
    expect(build.skips).toBe(4);
  });

  it('足す前の57マスの場所は、変わらない。足した5マスは、どの種でも置ける', () => {
    const v5 = JSON.parse(readFileSync(new URL('./fixtures/tree-v5.json', import.meta.url), 'utf8'));
    expect(Object.keys(v5)).toHaveLength(20);
    for (const [seed, list] of Object.entries(v5)) {
      expect(list).toHaveLength(57);
      const tree = buildTree(Number(seed));
      expect(tree.nodes.filter((n) => n.since <= 5).map((n) => `${n.id}<${n.parent}@${n.depth}`), seed).toEqual(list);
      const added = tree.nodes.filter((n) => n.since === 6);
      expect(added.map((n) => n.id).sort()).toEqual(['implantslot#0', 'implantslot#1', 'implantslot#2', 'skipchip#0', 'skipchip#1']);
      // 手前のマスは、先のボスの素材を要求しない
      for (const n of added) expect(tree.byId[n.parent].rank, `${seed} ${n.id}`).toBeLessThanOrEqual(n.rank);
    }
  });
});
