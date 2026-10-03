import { describe, expect, it } from 'vitest';
import { defineRegistry } from '../src/data/registry.js';
import { DATA } from '../src/data/index.js';

describe('defineRegistry', () => {
  const sample = [
    { id: 'drone', hp: 10 },
    { id: 'grunt', hp: 30 },
  ];

  it('id で定義を引ける', () => {
    const reg = defineRegistry('敵', sample);
    expect(reg.get('grunt').hp).toBe(30);
    expect(reg.has('drone')).toBe(true);
    expect(reg.has('turret')).toBe(false);
    expect(reg.ids()).toEqual(['drone', 'grunt']);
    expect(reg.all()).toHaveLength(2);
  });

  it('定義されていない id を引くとエラーになる', () => {
    const reg = defineRegistry('敵', sample);
    expect(() => reg.get('turret')).toThrow('turret');
  });

  it('id が重複しているとエラーになる', () => {
    expect(() => defineRegistry('敵', [...sample, { id: 'drone', hp: 99 }])).toThrow('重複');
  });

  it('id がない定義はエラーになる', () => {
    expect(() => defineRegistry('敵', [{ hp: 1 }])).toThrow('id');
  });

  it('登録した定義は書き換えられない', () => {
    const reg = defineRegistry('敵', sample);
    expect(() => { reg.get('drone').hp = 999; }).toThrow();
    expect(reg.get('drone').hp).toBe(10);
  });
});

describe('DATA', () => {
  it('すべての種類の定義データを読み込める', () => {
    const kinds = ['enemies', 'bosses', 'weapons', 'gearEffects', 'legendEffects', 'implants', 'rooms', 'upgrades'];
    expect(Object.keys(DATA).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) expect(Array.isArray(DATA[kind].all())).toBe(true);
  });
});
