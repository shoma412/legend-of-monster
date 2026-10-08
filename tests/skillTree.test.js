import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { materials } from '../src/data/story.js';
import { upgrades as allUpgrades } from '../src/data/upgrades.js';
import { buyNode, permanentBonuses, saveTree, treeNodeState } from '../src/logic/meta.js';
import { SAVE_VERSION, createSave, normalizeSave, refundUpgrades } from '../src/logic/save.js';
import { TREE, buildTree, cleanOwned, isReachable, layoutTree, treeNodeDefs, upgradeCounts } from '../src/logic/skillTree.js';

// 恒久強化のスキルツリー（docs/詳細仕様.md「23. スキルツリー」）

// 最初の34マスの強化（スキルツリーにしたときのもの）。あとから足した強化（since が 2 以上）は、別に確かめる
const upgrades = allUpgrades.filter((d) => (d.since ?? 1) === 1);
const FIRST_NODES = 34;
const ALL_NODES = 50;
const MAP5_NODES = 8; // マップ5で足したマス（since: 4）
const MAP4_NODES = 7; // マップ4で足したマス（since: 2）

const RANK = Object.fromEntries(materials.map((m, i) => [m.id, i]));
const units = (cost) => Object.values(cost).reduce((a, b) => a + b, 0);
const total = (costsOf) => {
  const sum = {};
  for (const def of upgrades) for (const cost of costsOf(def)) for (const [id, n] of Object.entries(cost)) sum[id] = (sum[id] ?? 0) + n;
  return sum;
};
const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 3);

describe('値段：前のゲームバランスとほぼ同じ', () => {
  const before = total((d) => d.legacyCosts ?? d.costs);
  const after = total((d) => d.costs);
  const group = (sum, ids) => ids.reduce((s, id) => s + (sum[id] ?? 0), 0);

  it('マスは34個。強化の種類・段数・効果は、前と同じ', () => {
    expect(treeNodeDefs().filter((d) => d.since === 1)).toHaveLength(FIRST_NODES);
    expect(treeNodeDefs()).toHaveLength(ALL_NODES);
    for (const def of upgrades) expect(def.costs).toHaveLength(def.max);
  });

  it('全部そろえるのに必要な素材は、マップ1ぶん・マップ3ぶんは前と同じ数。マップ2ぶんだけ1個多い', () => {
    expect(group(before, ['boarCore', 'cryoCore', 'overCore'])).toBe(23);
    expect(group(after, ['boarCore', 'cryoCore', 'overCore'])).toBe(23);
    expect(group(before, ['serpentCore', 'crabCore', 'hydraCore'])).toBe(10);
    expect(group(after, ['serpentCore', 'crabCore', 'hydraCore'])).toBe(11);
    expect(group(before, ['houndCore', 'spiderCore', 'titanCore'])).toBe(8);
    expect(group(after, ['houndCore', 'spiderCore', 'titanCore'])).toBe(8);
    // 素材ごとの数：変わったのは、種類を混ぜた4つの強化のぶんだけ
    expect(after).toEqual({ boarCore: 12, cryoCore: 9, overCore: 2, serpentCore: 4, crabCore: 4, hydraCore: 3, houndCore: 3, spiderCore: 3, titanCore: 2 });
    expect(before).toEqual({ boarCore: 9, cryoCore: 12, overCore: 2, serpentCore: 3, crabCore: 3, hydraCore: 4, houndCore: 3, spiderCore: 3, titanCore: 2 });
  });

  it('どのマスも、前より先のボスの素材は要求しない。素材の個数が変わったのは、携行ポーチ（1枠目 −1、2枠目 +1）と部品棚の増設（+1）だけ', () => {
    for (const def of upgrades) {
      const old = def.legacyCosts ?? def.costs;
      def.costs.forEach((cost, i) => {
        const rank = (c) => Math.max(...Object.keys(c).map((id) => RANK[id]));
        expect(rank(cost), `${def.id} ${i}`).toBeLessThanOrEqual(rank(old[i]));
        const shift = def.id === 'carryslot' ? 1 : def.id === 'pouch' ? (i === 0 ? -1 : 1) : 0;
        expect(units(cost), `${def.id} ${i}`).toBe(units(old[i]) + shift);
      });
    }
  });
});

describe('配置の決まり（どの種でも守られる）', () => {
  it('同じ種なら同じ配置。種が違えば配置が変わる', () => {
    expect(buildTree(42).nodes).toEqual(buildTree(42).nodes);
    const shapes = new Set(SEEDS.map((seed) => buildTree(seed).nodes.map((n) => `${n.id}<${n.parent}`).sort().join('|')));
    expect(shapes.size).toBeGreaterThan(390);
  });

  it('どの配置にも、34個のマスが全部ある。中心からの枝は3本', () => {
    const ids = treeNodeDefs().map((d) => d.id).sort();
    for (const seed of SEEDS) {
      const tree = buildTree(seed);
      expect(tree.nodes.map((n) => n.id).sort()).toEqual(ids);
      expect(tree.nodes.filter((n) => n.parent === null)).toHaveLength(TREE.roots);
    }
  });

  it('素材が1種類のマスは1〜3段目、2種類は4〜5段目、3種類は6段目以降', () => {
    for (const seed of SEEDS) {
      for (const n of buildTree(seed).nodes) {
        const types = Object.keys(n.cost).length;
        if (types === 1) {
          expect(n.depth).toBeLessThanOrEqual(3);
          expect(units(n.cost)).toBe(1); // 1〜3段目は、1種類を1個
        } else if (types === 2) {
          expect(n.depth).toBeGreaterThanOrEqual(4);
          expect(n.depth).toBeLessThanOrEqual(5);
        } else {
          expect(n.depth).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });

  it('手前のマスは、そのマスより先のボスの素材を要求しない（倒したボスまでの素材で、買えるマスに必ずたどり着ける）', () => {
    for (const seed of SEEDS) {
      const tree = buildTree(seed);
      for (const n of tree.nodes) {
        if (n.parent === null) {
          expect(n.depth).toBe(1);
          expect(Object.keys(n.cost)).toEqual(['boarCore']); // 枝の根元は、最初のボスの素材
          continue;
        }
        const parent = tree.byId[n.parent];
        expect(parent.depth).toBe(n.depth - 1);
        expect(parent.rank, `${n.id} の手前 ${parent.id}`).toBeLessThanOrEqual(n.rank);
      }
    }
  });

  it('二重ダッシュは必ず4段目（そこまでの道も含めて素材6個）。部品棚の増設は必ず6段目', () => {
    for (const seed of SEEDS) {
      const tree = buildTree(seed);
      expect(tree.byId['doubledash#0'].depth).toBe(4);
      expect(tree.byId['carryslot#0'].depth).toBe(6);
      let cost = 0;
      for (let n = tree.byId['doubledash#0']; n; n = n.parent ? tree.byId[n.parent] : null) cost += units(n.cost);
      expect(cost).toBe(6);
    }
  });

  it('マップ1の素材だけで、マップ1の素材のマスは全部取れる（マップ2以降の素材に道をふさがれない）', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const save = createSave();
      save.tree.seed = seed;
      save.materials = { boarCore: 99, cryoCore: 99, overCore: 99 };
      const tree = saveTree(save);
      let bought = true;
      while (bought) {
        bought = false;
        for (const n of tree.nodes) if (buyNode(save, n.id)) bought = true;
      }
      const map1 = tree.nodes.filter((n) => n.rank <= RANK.overCore);
      expect(save.tree.owned).toHaveLength(map1.length);
      expect(save.materials).toEqual({ boarCore: 99 - 12, cryoCore: 99 - 9, overCore: 99 - 2 });
    }
  });

  it('画面の並び：どのマスにも位置があり、同じ場所に重ならない', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const tree = buildTree(seed);
      const { pos, maxDepth } = layoutTree(tree);
      expect(maxDepth).toBe(6);
      const seen = new Set();
      for (const n of tree.nodes) {
        const p = pos[n.id];
        expect(p.col).toBe(n.depth);
        expect(p.row).toBeGreaterThanOrEqual(0);
        expect(p.row).toBeLessThanOrEqual(1);
        const key = `${p.col}/${p.row.toFixed(4)}`;
        expect(seen.has(key), `${seed} ${n.id}`).toBe(false);
        seen.add(key);
      }
    }
  });
});

describe('マスを取る', () => {
  function setup(seed = 77) {
    const save = createSave();
    save.tree.seed = seed;
    return { save, tree: saveTree(save) };
  }

  it('根元のマスは最初から取れる。素材が足りないと取れない。取ると素材が減り、強化の段数が増える', () => {
    const { save, tree } = setup();
    const root = tree.nodes.find((n) => n.parent === null);
    expect(treeNodeState(save, root.id)).toBe('short');
    expect(buyNode(save, root.id)).toBe(false);
    save.materials.boarCore = 1;
    expect(treeNodeState(save, root.id)).toBe('open');
    expect(buyNode(save, root.id)).toBe(true);
    expect(save.materials.boarCore).toBe(0);
    expect(save.tree.owned).toEqual([root.id]);
    expect(save.upgrades[root.upgrade]).toBe(1);
    expect(treeNodeState(save, root.id)).toBe('owned');
    expect(buyNode(save, root.id)).toBe(false); // 2回は取れない
  });

  it('手前のマスを取るまでは、素材があっても取れない', () => {
    const { save, tree } = setup();
    for (const m of materials) save.materials[m.id] = 99;
    const child = tree.nodes.find((n) => n.parent !== null);
    expect(treeNodeState(save, child.id)).toBe('locked');
    expect(buyNode(save, child.id)).toBe(false);
    // 根元から順に取っていけば、取れる
    const path = [];
    for (let n = child; n; n = n.parent ? tree.byId[n.parent] : null) path.unshift(n);
    for (const n of path) expect(buyNode(save, n.id), n.id).toBe(true);
    expect(treeNodeState(save, child.id)).toBe('owned');
  });

  it('全部取ると、前に全部買ったときと同じ強さになる', () => {
    const { save, tree } = setup(5);
    for (const m of materials) save.materials[m.id] = 99;
    let bought = true;
    while (bought) {
      bought = false;
      for (const n of tree.nodes) if (buyNode(save, n.id)) bought = true;
    }
    expect(save.tree.owned).toHaveLength(ALL_NODES);
    for (const def of allUpgrades) expect(save.upgrades[def.id], def.id).toBe(def.max);
    const old = createSave();
    for (const def of allUpgrades) old.upgrades[def.id] = def.max;
    expect(permanentBonuses(save)).toEqual(permanentBonuses(old));
  });

  it('取ったマスの数え方：強化ごとの段数になる。おかしなマス（知らない id、手前を取っていないもの）は除かれる', () => {
    const { tree } = setup(9);
    const root = tree.nodes.find((n) => n.parent === null);
    const child = tree.nodes.find((n) => n.parent === root.id);
    const orphan = tree.nodes.find((n) => n.parent !== null && n.parent !== root.id && n.depth === 2);
    expect(isReachable(tree, [], root.id)).toBe(true);
    expect(isReachable(tree, [], child.id)).toBe(false);
    expect(cleanOwned(tree, [child.id, root.id, 'nothing#9', orphan.id, root.id])).toEqual([root.id, child.id]);
    const counts = upgradeCounts(tree, [root.id, child.id]);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe('セーブデータと払い戻し', () => {
  it('新しいセーブデータは、種を持ち、何も取っていない。種はデータごとに違う', () => {
    const a = createSave();
    const b = createSave();
    expect(a.tree.owned).toEqual([]);
    expect(Number.isInteger(a.tree.seed)).toBe(true);
    expect(a.tree.seed).not.toBe(b.tree.seed);
    expect(a.notices).toEqual([]);
  });

  it('払い戻し：買ってあった強化に使った素材が、前の値段どおりに全部返る', () => {
    expect(refundUpgrades({})).toEqual({});
    expect(refundUpgrades({ frame: 3 })).toEqual({ boarCore: 3 });
    expect(refundUpgrades({ nerve: 4 })).toEqual({ boarCore: 2, cryoCore: 2 });
    expect(refundUpgrades({ kitslot: 2, pouch: 2, doubledash: 1, carryslot: 1 })).toEqual({ cryoCore: 4 + 2 + 3, boarCore: 2, hydraCore: 2 });
    // 全部買ってあった人には、前の合計がそのまま返る
    const all = Object.fromEntries(upgrades.map((d) => [d.id, d.max]));
    expect(refundUpgrades(all)).toEqual({ boarCore: 9, cryoCore: 12, overCore: 2, serpentCore: 3, crabCore: 3, hydraCore: 4, houndCore: 3, spiderCore: 3, titanCore: 2 });
    // 段数が多すぎるデータでも、最大までしか返さない
    expect(refundUpgrades({ frame: 99 })).toEqual({ boarCore: 5 });
  });

  it('前の版のセーブデータを読むと、強化が外れて素材が返り、お知らせが1つ付く。武器・実績・通行証などはそのまま', () => {
    const old = {
      version: 6, materials: { boarCore: 1, cryoCore: 0 }, upgrades: { frame: 2, doubledash: 1, 'ougi-greatsword': 1 },
      weapons: ['greatsword', 'sword'], selected: 'sword', bossKills: { boltboar: 4 }, fragments: ['bb-01'], achievements: ['boltboar'],
      records: { runs: 9, clears: 1, kills: 300, bestMap: 0, bestArea: 2, bestStep: 5 }, tutorialSeen: true, seenDialogues: [],
      maps: { map1: { clears: 1, clearedCycle: 1 } }, cycle: 1, selectedMap: 'map1', selectedCycle: 1, carrySpecies: null, carrySpecies2: null, passes: ['map3'],
    };
    const save = normalizeSave(JSON.parse(JSON.stringify(old)));
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.materials).toMatchObject({ boarCore: 1 + 2, cryoCore: 3, overCore: 1 });
    expect(save.upgrades).toEqual({});
    expect(save.tree.owned).toEqual([]);
    expect(save.notices).toEqual(['treeRefund']);
    expect(save.weapons).toEqual(['greatsword', 'sword']);
    expect(save.achievements).toEqual(['boltboar']);
    expect(save.passes).toEqual(['map3']);
    expect(save.records.runs).toBe(9);
    // 何も買っていなかった人には、お知らせは出ない
    expect(normalizeSave({ ...JSON.parse(JSON.stringify(old)), upgrades: {} }).notices).toEqual([]);
    // もう一度読み込んでも、二重には返らない
    const again = normalizeSave(JSON.parse(JSON.stringify(save)));
    expect(again.materials).toEqual(save.materials);
    expect(again.tree).toEqual(save.tree);
  });

  it('読み込むたびに、強化の段数は取ったマスから数え直す（データを書き換えて段数だけ増やしても、効かない）', () => {
    const save = createSave();
    save.tree.seed = 31;
    save.materials.boarCore = 5;
    const tree = saveTree(save);
    const root = tree.nodes.find((n) => n.parent === null);
    buyNode(save, root.id);
    const cheat = JSON.parse(JSON.stringify(save));
    cheat.upgrades = { frame: 5, nerve: 5, doubledash: 1 };
    const loaded = normalizeSave(cheat);
    expect(loaded.upgrades).toEqual({ [root.upgrade]: 1 });
    expect(loaded.tree.owned).toEqual([root.id]);
    expect(DATA.upgrades.has(root.upgrade)).toBe(true);
  });
});

describe('あとからマスを足す（マップ4の7マス）：今ある配置は変えない', () => {
  // マスを足す前（2026-10-08）に記録した、20個の種の配置（マスの id < 親 @ 深さ）
  const before = JSON.parse(readFileSync(new URL('./fixtures/tree-v1.json', import.meta.url), 'utf8'));

  it('最初の34マスは、足す前とまったく同じ場所・同じ親のまま', () => {
    expect(Object.keys(before)).toHaveLength(20);
    for (const [seed, list] of Object.entries(before)) {
      const now = buildTree(Number(seed)).nodes.filter((n) => n.since === 1).map((n) => `${n.id}<${n.parent}@${n.depth}`);
      expect(now, seed).toEqual(list);
    }
  });

  it('どの種でも、足した7マスが全部あり、深さの決まりと素材の順番を守る。円は6段のまま', () => {
    for (const seed of SEEDS) {
      const tree = buildTree(seed);
      const extra = tree.nodes.filter((n) => n.since > 1);
      expect(extra).toHaveLength(ALL_NODES - FIRST_NODES);
      expect(extra.filter((n) => n.since === 2)).toHaveLength(MAP4_NODES);
      expect(extra.filter((n) => n.since === 4)).toHaveLength(MAP5_NODES);
      expect(tree.byId['hardshell#0'].depth).toBe(6);
      expect(tree.byId['catalyzer#0'].depth).toBeGreaterThanOrEqual(4);
      expect(tree.byId['catalyzer#0'].depth).toBeLessThanOrEqual(5);
      expect(tree.byId['memory#0'].depth).toBeGreaterThanOrEqual(4);
      expect(tree.byId['memory#0'].depth).toBeLessThanOrEqual(5);
      expect(Math.max(...tree.nodes.map((n) => n.depth))).toBe(6);
      expect(tree.byId['sparekit#0'].depth).toBe(6);
      for (const n of extra) {
        const parent = tree.byId[n.parent];
        expect(parent, n.id).toBeDefined();
        expect(parent.depth).toBe(n.depth - 1);
        expect(parent.rank).toBeLessThanOrEqual(n.rank);
        if (n.types === 1) expect(n.depth).toBeLessThanOrEqual(3);
      }
    }
  });

  it('足す前に取ってあったマスは、そのまま残る（外れたり、別のマスに変わったりしない）', () => {
    for (const [seed, list] of Object.entries(before).slice(0, 6)) {
      const owned = list.map((x) => x.split('<')[0]);
      const save = normalizeSave({ ...createSave(), tree: { seed: Number(seed), owned } });
      expect(save.tree.owned.sort()).toEqual([...owned].sort());
      for (const def of upgrades) expect(save.upgrades[def.id], def.id).toBe(def.max);
      for (const def of allUpgrades.filter((d) => d.since > 1)) expect(save.upgrades[def.id] ?? 0, def.id).toBe(0);
    }
  });

  it('足した強化の値段と効果：モスコア2・レンズコア2・ブレーカーコア2と、3種類を1個ずつ', () => {
    const sum = {};
    for (const def of allUpgrades.filter((d) => d.since === 2)) for (const cost of def.costs) for (const [id, n] of Object.entries(cost)) sum[id] = (sum[id] ?? 0) + n;
    expect(sum).toEqual({ mothCore: 3, lensCore: 3, breakerCore: 3 });
    const save = createSave();
    for (const def of allUpgrades) save.upgrades[def.id] = def.max;
    const bonus = permanentBonuses(save);
    expect(bonus.kits).toBe(3); // 修復キット増設 2 ＋ 予備キット 1
  });
});

describe('マップ5で足した8マス（since: 4）', () => {
  it('足す前の42マス（最初の34・マップ4の7・記憶領域）の場所は、変わらない', () => {
    const v3 = JSON.parse(readFileSync(new URL('./fixtures/tree-v3.json', import.meta.url), 'utf8'));
    expect(Object.keys(v3)).toHaveLength(20);
    for (const [seed, list] of Object.entries(v3)) {
      expect(list).toHaveLength(42);
      const now = buildTree(Number(seed)).nodes.filter((n) => n.since <= 3).map((n) => `${n.id}<${n.parent}@${n.depth}`);
      expect(now, seed).toEqual(list);
    }
  });

  it('値段：ラストコア3・バッファーコア4・レインコア3・カタリストコア1。効果は、小さめ', () => {
    const sum = {};
    for (const def of allUpgrades.filter((d) => d.since === 4)) for (const cost of def.costs) for (const [id, n] of Object.entries(cost)) sum[id] = (sum[id] ?? 0) + n;
    expect(sum).toEqual({ rustCore: 3, bufferCore: 4, rainCore: 3, catalystCore: 1 });
    const save = createSave();
    for (const def of allUpgrades.filter((d) => d.since === 4)) save.upgrades[def.id] = def.max;
    const mods = permanentBonuses(save).effects.flatMap((e) => e.mods);
    const total = (stat) => mods.filter((m) => m.stat === stat).reduce((a, m) => a + m.add, 0);
    expect(total('dotResist')).toBeCloseTo(0.2);
    expect(total('weakBonus')).toBeCloseTo(0.1);
    expect(total('kitBonus')).toBeCloseTo(0.2);
    expect(total('damageTaken')).toBeCloseTo(-0.04);
    expect(total('statusTime')).toBeCloseTo(0.2);
  });

  it('画面の並び：50マスになっても、同じ場所に重ならない。円は6段のまま', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const tree = buildTree(seed);
      expect(tree.nodes).toHaveLength(ALL_NODES);
      const { pos, maxDepth } = layoutTree(tree);
      expect(maxDepth).toBe(6);
      expect(new Set(tree.nodes.map((n) => `${pos[n.id].col}/${pos[n.id].row.toFixed(4)}`)).size).toBe(ALL_NODES);
    }
  });
});
