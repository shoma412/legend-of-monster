import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { ENDLESS_LINES, buyEndless, describeEndless, endlessCost, endlessLevel, endlessMods, endlessValue } from '../src/logic/endless.js';
import { permanentBonuses } from '../src/logic/meta.js';
import { createSave, normalizeSave } from '../src/logic/save.js';
import { createBuild } from '../src/logic/stats.js';
import { hpScaleFor } from '../src/logic/maps.js';

// 終わりのない強化（docs/詳細仕様.md「37. 周回の長い先と、終わりのない強化」）

const line = (id) => ENDLESS_LINES.find((l) => l.id === id);

describe('値：段が上がるほど、決まったとおりに増える', () => {
  it('段 0 は 0。指数の系統は、段が上がるほど増え方が大きい', () => {
    for (const l of ENDLESS_LINES) expect(endlessValue(l, 0), l.id).toBe(0);
    const atk = line('atk');
    expect(endlessValue(atk, 1)).toBeCloseTo(0.03);
    expect(endlessValue(atk, 100)).toBeGreaterThan(17);
    expect(endlessValue(atk, 101) - endlessValue(atk, 100)).toBeGreaterThan(endlessValue(atk, 11) - endlessValue(atk, 10));
  });

  it('上限に近づく系統は、上限を超えない（被ダメージ軽減は −45% まで）', () => {
    const guard = line('guard');
    expect(endlessValue(guard, 1)).toBeLessThan(0);
    expect(endlessValue(guard, 10000)).toBeGreaterThan(-0.4501);
    expect(endlessValue(guard, 10000)).toBeLessThan(-0.44);
    expect(endlessValue(line('crit'), 10000)).toBeLessThan(0.4001);
  });

  it('直線の系統は、1段ごとに同じだけ増える', () => {
    const regen = line('regen');
    expect(endlessValue(regen, 10)).toBeCloseTo(3);
    expect(endlessValue(regen, 11) - endlessValue(regen, 10)).toBeCloseTo(0.3);
  });

  it('値の文：パーセント・数・毎秒', () => {
    expect(describeEndless(line('atk'), 0.125)).toBe('+12.5%');
    expect(describeEndless(line('hp'), 130.4)).toBe('+130');
    expect(describeEndless(line('regen'), 4.5)).toBe('毎秒 +4.5');
    expect(describeEndless(line('guard'), -0.1)).toBe('−10%');
  });
});

describe('値段：素材は順に回り、10段ごとに個数が増える', () => {
  it('素材の並びをぐるぐる回る。個数は 1 + 10段ごとに +1', () => {
    const hp = line('hp');
    expect(endlessCost(hp, 1)).toEqual({ titanCore: 1 });
    expect(endlessCost(hp, 2)).toEqual({ ductCore: 1 });
    expect(endlessCost(hp, 3)).toEqual({ gateCore: 1 });
    expect(endlessCost(hp, 4)).toEqual({ titanCore: 1 });
    expect(endlessCost(hp, 10)).toEqual({ titanCore: 1 });
    expect(endlessCost(hp, 11)).toEqual({ ductCore: 2 });
    expect(endlessCost(hp, 21)).toEqual({ gateCore: 3 });
    expect(Object.values(endlessCost(hp, 101))[0]).toBe(11);
  });

  it('どの素材の id も、実在する', () => {
    for (const l of ENDLESS_LINES) for (const id of l.pool) expect(DATA.materials.get(id), id).toBeDefined();
  });
});

describe('買う・保存・ラン開始時の補正', () => {
  it('素材が足りなければ買えない。足りれば、素材を使って1段上がる（上限はない）', () => {
    const save = createSave();
    expect(buyEndless(save, 'hp')).toBe(false);
    expect(endlessLevel(save, 'hp')).toBe(0);
    save.materials = { titanCore: 1, ductCore: 1, gateCore: 1 };
    expect(buyEndless(save, 'hp')).toBe(true);
    expect(buyEndless(save, 'hp')).toBe(true);
    expect(buyEndless(save, 'hp')).toBe(true);
    expect(save.materials).toEqual({ titanCore: 0, ductCore: 0, gateCore: 0 });
    expect(endlessLevel(save, 'hp')).toBe(3);
    expect(buyEndless(save, 'hp')).toBe(false);
    save.materials.titanCore = 99;
    expect(buyEndless(save, 'nothing')).toBe(false);
    for (let i = 0; i < 40; i++) save.materials = { titanCore: 99, ductCore: 99, gateCore: 99 }, buyEndless(save, 'hp');
    expect(endlessLevel(save, 'hp')).toBe(43);
  });

  it('セーブに残り、読み直しても同じ。壊れた値は捨てる', () => {
    const save = createSave();
    save.endless = { hp: 12, atk: 3 };
    const copy = normalizeSave(JSON.parse(JSON.stringify(save)));
    expect(copy.endless).toEqual({ hp: 12, atk: 3 });
    const broken = normalizeSave({ ...JSON.parse(JSON.stringify(save)), endless: { hp: 'x', atk: -4, move: 2.7 } });
    expect(broken.endless).toEqual({ move: 2 });
    const old = JSON.parse(JSON.stringify(save));
    delete old.endless;
    expect(normalizeSave(old).endless).toEqual({});
  });

  it('ラン開始時の補正に乗る（最大HP・攻撃力が上がる）', () => {
    const save = createSave();
    save.endless = { hp: 20, atk: 20 };
    const base = createBuild(permanentBonuses(createSave()));
    const bonus = permanentBonuses(save);
    expect(bonus.effects.length).toBeGreaterThan(permanentBonuses(createSave()).effects.length);
    const mods = endlessMods(save);
    expect(mods.map((m) => m.stat).sort()).toEqual(['attackMul', 'maxHp']);
    expect(base).toBeDefined();
  });
});

describe('周回に追いつくか：目安', () => {
  it('段数が多いほど、攻撃力の補正が敵のHPの伸びに追いつく（敵のHPの倍率：10周目 2.4倍、20周目 4.8倍、30周目 8.1倍、50周目 17.8倍、100周目 59.6倍）', () => {
    const hp20 = hpScaleFor(20);
    expect(hp20).toBeGreaterThan(4.5);
    // 無限火力が 54段あれば、攻撃力は 1.03^54 ≒ 4.9倍（基本の 1 に足される）。20周目の敵に追いつく
    expect(1 + endlessValue(line('atk'), 54)).toBeGreaterThan(hp20);
    // 50周目の敵 HP は、約 17.8倍。無限火力 100段で、約 19倍。足りない分は、ほかの系統（会心・速度）で埋める
    expect(hpScaleFor(50)).toBeGreaterThan(15);
    expect(1 + endlessValue(line('atk'), 100)).toBeGreaterThan(18);
  });
});
