import { describe, expect, it } from 'vitest';
import { countOverlaps, placeLabel, spreadNodes } from '../src/logic/treeSpread.js';

// スキルツリーの画面の並び：重なりをほどく（docs/詳細仕様.md「23. スキルツリー」）
const bounds = { x: 256, y: 107 };

describe('マスと線の重なりをほどく', () => {
  it('重なっているマス同士は、離れる', () => {
    const nodes = [{ x: 40, y: 0, parent: -1 }, { x: 44, y: 2, parent: -1 }];
    expect(countOverlaps(nodes, nodes).nodes).toBe(1);
    const pts = spreadNodes(nodes, bounds);
    expect(countOverlaps(nodes, pts).nodes).toBe(0);
    expect(Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)).toBeGreaterThan(16);
  });

  it('ほかの線の上に乗っているマスは、線からどく', () => {
    // 0 → 1 の線（横にまっすぐ）の真ん中に、別の枝のマス 2 が乗っている
    const nodes = [{ x: 40, y: 0, parent: -1 }, { x: 120, y: 0, parent: 0 }, { x: 80, y: 3, parent: -1 }];
    expect(countOverlaps(nodes, nodes).lines).toBeGreaterThan(0);
    const pts = spreadNodes(nodes, bounds);
    expect(countOverlaps(nodes, pts)).toEqual({ nodes: 0, lines: 0 });
  });

  it('重なっていないマスは、動かさない', () => {
    const nodes = [{ x: 60, y: 0, parent: -1 }, { x: -60, y: 0, parent: -1 }, { x: 0, y: 60, parent: -1 }];
    expect(spreadNodes(nodes, bounds)).toEqual(nodes.map((n) => ({ x: n.x, y: n.y })));
  });

  it('同じ入力なら、いつも同じ結果。枠の外には出ない', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => ({ x: 250 - (i % 5) * 3, y: 100 - Math.floor(i / 5) * 3, parent: i === 0 ? -1 : i - 1 }));
    const a = spreadNodes(nodes, bounds);
    expect(spreadNodes(nodes, bounds)).toEqual(a);
    for (const p of a) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(bounds.x);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(bounds.y);
    }
  });
});

describe('マスの名前を置く側', () => {
  const node = { x: 100, y: 100, r: 10 };
  const size = { w: 40, h: 12 };

  it('じゃまがなければ、下', () => {
    expect(placeLabel(node, size, 3, {}).side).toBe('below');
  });

  it('下にほかのマスがあれば、上へ', () => {
    expect(placeLabel(node, size, 3, { circles: [{ x: 100, y: 120, r: 10 }] }).side).toBe('above');
  });

  it('下に線、上に名前があれば、右へ', () => {
    const others = {
      segments: [{ a: { x: 60, y: 118 }, b: { x: 140, y: 118 } }],
      rects: [{ left: 80, top: 76, right: 120, bottom: 88 }],
    };
    expect(placeLabel(node, size, 3, others).side).toBe('right');
  });

  it('枠からはみ出す側は、選ばない', () => {
    const area = { left: 0, top: 0, right: 200, bottom: 118 };
    expect(placeLabel(node, size, 3, {}, area).side).toBe('above');
  });
});
