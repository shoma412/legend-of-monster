import { describe, expect, it } from 'vitest';
import { firstTarget, moveFocus, nearestTarget } from '../src/logic/focusNav.js';

// 2行3列のボタンと、その下の大きなボタン1つ
//   0 1 2
//   3 4 5
//     6
const box = (x, y, w = 60, h = 24) => ({ x, y, w, h });
const targets = [box(0, 0), box(100, 0), box(200, 0), box(0, 40), box(100, 40), box(200, 40), box(60, 120, 140, 30)];

describe('メニューのボタンを、上下左右で選ぶ', () => {
  it('最初は、いちばん左上', () => {
    expect(firstTarget(targets)).toBe(0);
    expect(firstTarget([box(200, 0), box(0, 2), box(0, 40)])).toBe(1);
    expect(firstTarget([])).toBe(-1);
  });

  it('右・左・下・上に、となりへ動く', () => {
    expect(moveFocus(targets, 0, 'right')).toBe(1);
    expect(moveFocus(targets, 1, 'left')).toBe(0);
    expect(moveFocus(targets, 1, 'down')).toBe(4);
    expect(moveFocus(targets, 4, 'up')).toBe(1);
  });

  it('その向きに何もなければ、動かない', () => {
    expect(moveFocus(targets, 0, 'left')).toBe(0);
    expect(moveFocus(targets, 0, 'up')).toBe(0);
    expect(moveFocus(targets, 6, 'down')).toBe(6);
  });

  it('下の段から、さらに下の大きなボタンへ行ける', () => {
    expect(moveFocus(targets, 4, 'down')).toBe(6);
    expect(moveFocus(targets, 6, 'up')).toBe(4);
  });

  it('まだ何も選んでいなければ、最初のものを選ぶ', () => {
    expect(moveFocus(targets, -1, 'down')).toBe(0);
  });

  it('場所から、いちばん近いものを探す（描き直したあとで、選んでいたものを見つける）', () => {
    expect(nearestTarget(targets, { x: 130, y: 52 })).toBe(4);
    expect(nearestTarget([], { x: 0, y: 0 })).toBe(-1);
  });
});
