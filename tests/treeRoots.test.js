import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createSave, normalizeSave, refundNodes } from '../src/logic/save.js';
import { buildTree } from '../src/logic/skillTree.js';

// スキルツリーの根元（docs/詳細仕様.md「23. スキルツリー」の決まり3。2026-10-10 変更）
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

describe('スキルツリーの根元：マップ1のボス3体の素材を、1つずつ', () => {
  it('どの種でも、根元の3マスは、ボアコア・クライオコア・オーバーコアが1つずつ', () => {
    for (const seed of SEEDS) {
      const roots = buildTree(seed).nodes.filter((n) => n.parent === null);
      expect(roots.map((n) => Object.keys(n.cost).join('+')).sort(), seed).toEqual(['boarCore', 'cryoCore', 'overCore']);
      for (const n of roots) expect(Object.values(n.cost)).toEqual([1]);
    }
  });

  it('マップ1を1回クリアしたぶんの素材（3種類を1個ずつ）で、根元の3マスを全部取れる', () => {
    for (const seed of SEEDS) {
      const need = {};
      for (const n of buildTree(seed).nodes.filter((x) => x.parent === null)) for (const [id, c] of Object.entries(n.cost)) need[id] = (need[id] ?? 0) + c;
      expect(need, seed).toEqual({ boarCore: 1, cryoCore: 1, overCore: 1 });
    }
  });

  it('ボアコアだけのマスは、ボアコアの枝の中にある（先のボスの素材に、道をふさがれない）', () => {
    for (const seed of SEEDS) {
      const tree = buildTree(seed);
      for (const n of tree.nodes.filter((x) => Object.keys(x.cost).join() === 'boarCore')) {
        let top = n;
        while (top.parent) top = tree.byId[top.parent];
        expect(Object.keys(top.cost), `${seed} ${n.id}`).toEqual(['boarCore']);
      }
    }
  });
});

describe('前の版（版7）のセーブデータ：取ってあったマスを外して、素材を返す', () => {
  const old = () => ({ ...createSave(), version: 7, materials: { boarCore: 1, hydraCore: 2 }, upgrades: { frame: 2, kitslot: 1 }, tree: { seed: 12345, owned: ['frame#0', 'frame#1', 'kitslot#0'] }, notices: [] });

  it('取ってあったマスは空になり、使った素材がすべて戻る。種は変わらない', () => {
    const save = normalizeSave(old());
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.tree).toEqual({ seed: 12345, owned: [] });
    expect(save.upgrades).toEqual({});
    // 強化骨格 2段（ボアコア 1個ずつ）＋ 修復キット増設 1段（クライオコア 1・ボアコア 1）
    expect(save.materials).toEqual({ boarCore: 1 + 3, cryoCore: 1, hydraCore: 2 });
    expect(save.notices).toEqual(['treeRebuilt']);
  });

  it('何も取っていなかったデータには、お知らせを出さない', () => {
    const save = normalizeSave({ ...old(), upgrades: {}, tree: { seed: 5, owned: [] } });
    expect(save.notices).toEqual([]);
    expect(save.materials).toEqual({ boarCore: 1, hydraCore: 2 });
  });

  it('返す素材の数え方：同じマスは1回だけ。知らないマスは数えない', () => {
    expect(refundNodes(['frame#0', 'frame#0', 'nazo#9'])).toEqual({ boarCore: 1 });
  });

  it('今の版のデータは、何も変えない', () => {
    const save = createSave();
    save.materials = { boarCore: 1 };
    const root = buildTree(save.tree.seed).nodes.find((n) => n.parent === null && n.cost.boarCore);
    save.tree.owned = [root.id];
    const loaded = normalizeSave(JSON.parse(JSON.stringify(save)));
    expect(loaded.tree.owned).toEqual([root.id]);
    expect(loaded.materials).toEqual({ boarCore: 1 });
  });
});
