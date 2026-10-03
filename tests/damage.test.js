import { describe, expect, it } from 'vitest';
import { calcDamage } from '../src/logic/damage.js';
import { DEG, arcHitsCircle, clampToBounds } from '../src/logic/geometry.js';

describe('calcDamage', () => {
  const never = () => 0.99;
  const always = () => 0;

  it('基本は 威力×攻撃力倍率', () => {
    expect(calcDamage({ base: 30, attackMul: 1.2, critChance: 0.05, rng: never })).toEqual({ amount: 36, crit: false, weak: false });
  });

  it('会心は×2', () => {
    expect(calcDamage({ base: 30, critChance: 0.05, critMul: 2, rng: always })).toEqual({ amount: 60, crit: true, weak: false });
  });

  it('弱点属性は×1.5。属性がなければ弱点にならない', () => {
    expect(calcDamage({ base: 30, element: 'cold', weakness: 'cold', rng: never }).amount).toBe(45);
    expect(calcDamage({ base: 30, element: 'heat', weakness: 'cold', rng: never }).weak).toBe(false);
    expect(calcDamage({ base: 30, element: null, weakness: null, rng: never }).weak).toBe(false);
  });

  it('会心と弱点は掛け算で重なり、最低でも1は与える', () => {
    expect(calcDamage({ base: 30, critChance: 1, element: 'cold', weakness: 'cold', rng: always }).amount).toBe(90);
    expect(calcDamage({ base: 0.1, rng: never }).amount).toBe(1);
  });
});

describe('arcHitsCircle', () => {
  const arc = 90 * DEG;

  it('正面の範囲内は当たる', () => {
    expect(arcHitsCircle(0, 0, 0, arc, 80, 60, 0, 10)).toBe(true);
  });

  it('届かない距離は当たらない（相手の半径ぶんは届く）', () => {
    expect(arcHitsCircle(0, 0, 0, arc, 80, 95, 0, 10)).toBe(false);
    expect(arcHitsCircle(0, 0, 0, arc, 80, 89, 0, 10)).toBe(true);
  });

  it('背後は当たらないが、密着していれば当たる', () => {
    expect(arcHitsCircle(0, 0, 0, arc, 80, -60, 0, 10)).toBe(false);
    expect(arcHitsCircle(0, 0, 0, arc, 80, -20, 0, 10, 18)).toBe(true);
  });

  it('角度が -π と π をまたいでも判定できる', () => {
    expect(arcHitsCircle(0, 0, Math.PI, arc, 80, -60, -5, 10)).toBe(true);
    expect(arcHitsCircle(0, 0, Math.PI, arc, 80, -60, 5, 10)).toBe(true);
  });
});

describe('clampToBounds', () => {
  it('壁の外に出た円を内側に戻す', () => {
    const o = { x: 5, y: 600, r: 10 };
    const touched = clampToBounds(o, { left: 28, top: 28, right: 932, bottom: 512 });
    expect(touched).toBe(true);
    expect(o).toEqual({ x: 38, y: 502, r: 10 });
  });
});
