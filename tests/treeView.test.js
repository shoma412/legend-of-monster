import { describe, expect, it } from 'vitest';
import { TREE_PAD, TREE_VIEW, easeTo, nearestNode, panStick, zoomKeep, centerOn, clampView, clipSegment, createTreeView, inRect, panBy, toLocal, toScreen, zoomAt } from '../src/logic/treeView.js';

// スキルツリーの円の、拡大・縮小と移動（docs/詳細仕様.md「23. スキルツリー → 画面」）

const center = { x: 270, y: 314 };
const rect = { left: 40, top: 166, right: 500, bottom: 462 };

describe('スキルツリーの円の拡大・縮小', () => {
  it('最初は等倍で、円の中心が枠の真ん中に出る', () => {
    const view = createTreeView();
    expect(view).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(toScreen(view, center, { x: 0, y: 0 })).toEqual(center);
    expect(toScreen(view, center, { x: 30, y: -40 })).toEqual({ x: 300, y: 274 });
  });

  it('拡大すると、マウスの下にあるものは動かない', () => {
    const pointer = { x: 320, y: 300 };
    const before = createTreeView();
    const under = toLocal(before, center, pointer);
    const after = zoomAt(before, center, pointer, 1);
    expect(after.zoom).toBeCloseTo(TREE_VIEW.step);
    const again = toScreen(after, center, under);
    expect(again.x).toBeCloseTo(pointer.x);
    expect(again.y).toBeCloseTo(pointer.y);
  });

  it('倍率には上限と下限がある。いちばん引くと、必ず円の真ん中に戻る', () => {
    let view = createTreeView();
    for (let i = 0; i < 30; i++) view = zoomAt(view, center, { x: 450, y: 200 }, 1);
    expect(view.zoom).toBe(TREE_VIEW.max);
    for (let i = 0; i < 30; i++) view = zoomAt(view, center, { x: 60, y: 440 }, -1);
    expect(view).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it('画面の位置と、円の中の位置は、行き来しても同じになる', () => {
    const view = clampView({ zoom: 2.2, x: 40, y: -25 });
    const local = { x: 61, y: 17 };
    const back = toLocal(view, center, toScreen(view, center, local));
    expect(back.x).toBeCloseTo(local.x);
    expect(back.y).toBeCloseTo(local.y);
  });
});

describe('スキルツリーの円を動かす', () => {
  it('等倍のときは動かせない。拡大しているときは、引っぱったぶん動く', () => {
    expect(panBy(createTreeView(), 50, 30)).toEqual({ zoom: 1, x: 0, y: 0 });
    const zoomed = { zoom: 2, x: 0, y: 0 };
    const moved = panBy(zoomed, 40, -20);
    // 右へ引っぱると、見ている場所は左へ動く（中身が右へついてくる）
    expect(moved.x).toBeCloseTo(-20);
    expect(moved.y).toBeCloseTo(10);
    expect(toScreen(moved, center, { x: 0, y: 0 })).toEqual({ x: center.x + 40, y: center.y - 20 });
  });

  it('円から離れすぎた場所へは動かせない', () => {
    let view = { zoom: 3, x: 0, y: 0 };
    for (let i = 0; i < 50; i++) view = panBy(view, -200, 0);
    const limit = TREE_VIEW.reach * (1 - 1 / 3);
    expect(Math.hypot(view.x, view.y)).toBeCloseTo(limit);
    // いちばん外の輪（139px）は、いちばん寄った状態でも真ん中まで持ってこられない距離ではない
    expect(limit).toBeGreaterThan(90);
  });

  it('選んだマスを真ん中に出す', () => {
    const view = centerOn({ zoom: 2, x: 0, y: 0 }, { x: 50, y: 30 });
    const p = toScreen(view, center, { x: 50, y: 30 });
    expect(p.x).toBeCloseTo(center.x);
    expect(p.y).toBeCloseTo(center.y);
  });
});

describe('枠からはみ出さない', () => {
  it('枠の中の線はそのまま。はみ出す線は、枠のところで切る。枠の外の線は描かない', () => {
    expect(clipSegment(100, 200, 300, 400, rect)).toEqual({ x1: 100, y1: 200, x2: 300, y2: 400 });
    const cut = clipSegment(270, 314, 700, 314, rect);
    expect(cut).toEqual({ x1: 270, y1: 314, x2: 500, y2: 314 });
    const diagonal = clipSegment(0, 100, 270, 314, rect);
    expect(diagonal.x1).toBeGreaterThanOrEqual(rect.left - 1e-9);
    expect(diagonal.y1).toBeGreaterThanOrEqual(rect.top - 1e-9);
    expect(diagonal.x2).toBeCloseTo(270);
    expect(clipSegment(600, 100, 800, 150, rect)).toBeNull();
    expect(clipSegment(10, 10, 10, 600, rect)).toBeNull(); // 枠の左を、縦にすり抜ける線
  });

  it('枠の中かどうか（余白つき）', () => {
    expect(inRect(270, 314, rect)).toBe(true);
    expect(inRect(45, 314, rect)).toBe(true);
    expect(inRect(45, 314, rect, 10)).toBe(false);
    expect(inRect(501, 314, rect)).toBe(false);
  });
});

describe('ゲームパッド：真ん中の照準にマスを合わせる', () => {
  const bounds = { x: 100, y: 50 };
  const points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 40 }];

  it('スティックで動かせる。いちばん引いた状態でも動く。範囲の外には出ない', () => {
    const v = panStick({ zoom: 1, x: 0, y: 0 }, 1, 0, 0.1, bounds);
    expect(v.x).toBeCloseTo(TREE_PAD.speed * 0.1);
    expect(panStick({ zoom: 1, x: 99, y: 0 }, 1, 1, 1, bounds)).toEqual({ zoom: 1, x: 100, y: 50 });
  });

  it('寄っているときは、同じ倒し方で、動く量が小さい（画面の上では同じ速さ）', () => {
    expect(panStick({ zoom: 2, x: 0, y: 0 }, 1, 0, 0.1, bounds).x).toBeCloseTo((TREE_PAD.speed * 0.1) / 2);
  });

  it('照準に重なったマスを選ぶ。離れていれば、選ばない', () => {
    expect(nearestNode({ zoom: 1, x: 38, y: 2 }, points, TREE_PAD.pick)).toBe(1);
    expect(nearestNode({ zoom: 1, x: 20, y: 20 }, points, TREE_PAD.pick)).toBe(-1);
  });

  it('スティックを離すと、近くのマスへ寄っていき、ぴったり合う', () => {
    let v = { zoom: 1, x: 30, y: 4 };
    for (let i = 0; i < 120; i++) v = easeTo(v, points[1], 1 / 60);
    expect(v).toEqual({ zoom: 1, x: 40, y: 0 });
  });

  it('拡大・縮小しても、見ている場所は変わらない', () => {
    const v = zoomKeep({ zoom: 1, x: 40, y: 10 }, 1);
    expect(v.zoom).toBeCloseTo(TREE_VIEW.step);
    expect([v.x, v.y]).toEqual([40, 10]);
    expect(zoomKeep({ zoom: 1, x: 40, y: 10 }, -1).zoom).toBe(TREE_VIEW.min);
  });
});
