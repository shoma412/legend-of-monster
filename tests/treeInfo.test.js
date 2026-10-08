import { describe, expect, it } from 'vitest';
import { upgrades } from '../src/data/upgrades.js';
import { buildTree } from '../src/logic/skillTree.js';
import { nextOpenIndex, pathTo, totalCost, upgradePreview } from '../src/logic/treeInfo.js';

describe('スキルツリーの案内', () => {
  const tree = buildTree(12345);
  const deepest = [...tree.nodes].sort((a, b) => b.depth - a.depth)[0];

  it('道筋は、中心からそのマスまでの、まだ取っていないマス（中心に近い順）', () => {
    const path = pathTo(tree, [], deepest.id);
    expect(path.length).toBe(deepest.depth);
    expect(path[0].parent).toBe(null);
    expect(path.at(-1).id).toBe(deepest.id);
    for (let i = 1; i < path.length; i++) expect(path[i].parent).toBe(path[i - 1].id);
  });

  it('取ってあるマスは、道筋に入らない', () => {
    const full = pathTo(tree, [], deepest.id);
    const owned = full.slice(0, 2).map((n) => n.id);
    expect(pathTo(tree, owned, deepest.id).map((n) => n.id)).toEqual(full.slice(2).map((n) => n.id));
    expect(pathTo(tree, full.map((n) => n.id), deepest.id)).toEqual([]);
  });

  it('道筋の素材の合計は、マスの値段を足したもの', () => {
    const path = pathTo(tree, [], deepest.id);
    const total = totalCost(path);
    const sum = Object.values(total).reduce((a, b) => a + b, 0);
    expect(sum).toBe(path.reduce((a, n) => a + Object.values(n.cost).reduce((x, y) => x + y, 0), 0));
  });

  it('取ったあとの合計：同じ数値を上げる強化は、まとめて数える', () => {
    const frame = upgrades.find((u) => u.id === 'frame');
    // 強化骨格 2段（+20）と、再生槽 1段（+15）を取ってある
    expect(upgradePreview(upgrades, { frame: 2, regentank: 1 }, frame)).toEqual([{ label: '最大HP', now: '+35', next: '+45' }]);
    const plate = upgrades.find((u) => u.id === 'armorplate');
    expect(upgradePreview(upgrades, { armorplate: 1 }, plate)).toEqual([{ label: '被ダメージ', now: '−3%', next: '−6%' }]);
    const kit = upgrades.find((u) => u.id === 'kitslot');
    expect(upgradePreview(upgrades, {}, kit)).toEqual([{ label: '開始時の修復キット', now: '+0', next: '+1' }]);
  });

  it('数値で表せない強化（奥義・武器ごとの強化）には、合計を出さない', () => {
    expect(upgradePreview(upgrades, {}, upgrades.find((u) => u.id === 'ougi-greatsword'))).toEqual([]);
    expect(upgradePreview(upgrades, {}, upgrades.find((u) => u.id === 'wm-gun'))).toEqual([]);
  });

  it('次の取れるマス：今の位置の次から探して、端まで行ったら頭に戻る', () => {
    const states = ['owned', 'open', 'locked', 'open', 'short'];
    expect(nextOpenIndex(states, 0)).toBe(1);
    expect(nextOpenIndex(states, 1)).toBe(3);
    expect(nextOpenIndex(states, 3)).toBe(1);
    expect(nextOpenIndex(states, -1)).toBe(1);
  });

  it('次の取れるマス：取れるマスがなければ、素材が足りないだけのマス。それもなければ -1', () => {
    expect(nextOpenIndex(['owned', 'locked', 'short'], 0)).toBe(2);
    expect(nextOpenIndex(['owned', 'locked'], 0)).toBe(-1);
  });
});
