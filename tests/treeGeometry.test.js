import { describe, expect, it } from 'vitest';
import { buildTree, layoutTree } from '../src/logic/skillTree.js';
import { MIN_STEP, NODE_GAP, worldLayout } from '../src/logic/treeGeometry.js';
import { countOverlaps } from '../src/logic/treeSpread.js';
import { TREE_VIEW, clampView, createTreeView, setTreeLimits } from '../src/logic/treeView.js';

// スキルツリーの並び：放射状の樹。マスがどんなに増えても、1つも重ならない。枠より大きくても、引いて全体を見られる

const SEEDS = [1, 7, 42, 99, 123456, 2026, 31337, 777777, 5, 88, 4242, 909090];

describe('マスが増えても、1つも重ならない', () => {
  it('どの種でも、マス同士・マスと線の重なりが 0（マスの半径 8 で数える）', () => {
    for (const seed of SEEDS) {
      const world = worldLayout(layoutTree(buildTree(seed)));
      expect(countOverlaps(world.nodes, world.pts, 8), `seed ${seed}`).toEqual({ nodes: 0, lines: 0 });
    }
  });

  it('同じ輪の隣り合うマスは NODE_GAP 以上あき、輪の間隔は、どの段でも同じ（線が急に長くならない）', () => {
    const tree = buildTree(42);
    expect(tree.nodes.length).toBeGreaterThan(300);
    const layout = layoutTree(tree);
    const world = worldLayout(layout);
    expect(world.step).toBeGreaterThanOrEqual(MIN_STEP);
    // 輪の間隔は同じ：段 d のマスは、中心から step × d の距離にいる
    for (const [i, id] of world.ids.entries()) {
      expect(Math.hypot(world.pts[i].x, world.pts[i].y), id).toBeCloseTo(world.step * layout.pos[id].col, 3);
    }
    // 同じ段の、近くのマスどうしの距離
    let nearest = Infinity;
    for (let i = 0; i < world.pts.length; i++) for (let j = i + 1; j < world.pts.length; j++) nearest = Math.min(nearest, Math.hypot(world.pts[i].x - world.pts[j].x, world.pts[i].y - world.pts[j].y));
    expect(nearest).toBeGreaterThanOrEqual(NODE_GAP * 0.99);
  });

  it('親と子の線の長さは、どれも、輪の間隔の 1.5 倍以内（長い線がない）', () => {
    const world = worldLayout(layoutTree(buildTree(99)));
    for (const [i, id] of world.ids.entries()) {
      const p = world.nodes[i].parent;
      const a = p >= 0 ? world.pts[p] : { x: 0, y: 0 };
      const len = Math.hypot(world.pts[i].x - a.x, world.pts[i].y - a.y);
      expect(len, id).toBeLessThanOrEqual(world.step * 1.5);
    }
  });

  it('同じ種なら、いつも同じ位置（キャッシュされる）', () => {
    const a = worldLayout(layoutTree(buildTree(7)));
    const b = worldLayout(layoutTree(buildTree(7)));
    expect(a).toBe(b);
  });
});

describe('枠より大きいツリーを、引いて全体を見る・寄って動かす', () => {
  it('いちばん引いた倍率は、ツリー全体が枠に入る大きさ。そこでは真ん中に戻り、寄ると動かせる範囲が広がる', () => {
    const saved = { ...TREE_VIEW };
    try {
      const world = worldLayout(layoutTree(buildTree(42)));
      setTreeLimits({ extent: world.extent, rectW: 540, rectH: 296 });
      expect(TREE_VIEW.min).toBeLessThan(0.5);
      expect(TREE_VIEW.min).toBeGreaterThanOrEqual(0.04);
      expect(world.extent.x * TREE_VIEW.min).toBeLessThanOrEqual(540 / 2);
      expect(world.extent.y * TREE_VIEW.min).toBeLessThanOrEqual(296 / 2);
      const start = createTreeView();
      expect(start.zoom).toBeCloseTo(0.6); // 最初は、中心まわりが読める大きさ
      expect(clampView({ zoom: TREE_VIEW.min, x: 300, y: 200 })).toEqual({ zoom: TREE_VIEW.min, x: 0, y: 0 });
      const near = clampView({ zoom: 1, x: 99999, y: 0 });
      expect(near.x).toBeGreaterThan(world.extent.x * 0.5);
      expect(near.x).toBeLessThanOrEqual(TREE_VIEW.reach);
    } finally {
      Object.assign(TREE_VIEW, saved);
    }
  });
});
