import { describe, expect, it } from 'vitest';
import { createGearLog, formatPlayTime, logBuildGear, logGear, normalizeGearLog } from '../src/logic/gearLog.js';
import { padWords } from '../src/logic/padWords.js';
import { createSave, normalizeSave } from '../src/logic/save.js';

// 手に入れた装備の記録と、プレイ時間（docs/詳細仕様.md「33. 記録の画面」）
const item = (extra = {}) => ({ slot: 'acc', rarity: 2, effects: [{ id: 'critChance', value: 0.08 }, { id: 'element', element: 'heat' }], unique: null, name: 'エピック データリング', ...extra });

describe('手に入れた装備の記録', () => {
  it('レア度と部位ごとに数える。効果は、いちばん高かった値を残す。属性も残す', () => {
    const log = createGearLog();
    expect(logGear(log, item())).toBe(true);
    expect(logGear(log, item({ effects: [{ id: 'critChance', value: 0.05 }] }))).toBe(true);
    expect(log.counts).toEqual({ '2:acc': 2 });
    expect(log.best).toEqual({ critChance: 0.08 });
    expect(log.elements).toEqual(['heat']);
  });

  it('同じ装備は、2回数えない', () => {
    const log = createGearLog();
    const one = item();
    logGear(log, one);
    expect(logGear(log, one)).toBe(false);
    expect(log.counts['2:acc']).toBe(1);
  });

  it('レジェンド装備の固有効果を残す', () => {
    const log = createGearLog();
    logGear(log, item({ rarity: 3, unique: 'zeroday' }));
    logGear(log, item({ rarity: 3, unique: 'zeroday' }));
    expect(log.uniques).toEqual(['zeroday']);
  });

  it('身につけているものと、バッグの中を、まとめて入れる', () => {
    const log = createGearLog();
    const build = { gear: { mod: item({ slot: 'mod' }), armor: null, acc: item() }, bag: [item({ slot: 'armor', rarity: 0 })] };
    expect(logBuildGear(log, build)).toBe(true);
    expect(log.counts).toEqual({ '2:mod': 1, '2:acc': 1, '0:armor': 1 });
    expect(logBuildGear(log, build)).toBe(false);
  });

  it('セーブデータに入る。形がおかしければ、空から', () => {
    const save = createSave();
    logGear(save.gearLog, item());
    expect(normalizeSave(JSON.parse(JSON.stringify(save))).gearLog.counts).toEqual({ '2:acc': 1 });
    expect(normalizeGearLog('x')).toEqual(createGearLog());
    expect(normalizeSave({ ...createSave(), gearLog: undefined }).gearLog).toEqual(createGearLog());
  });
});

describe('プレイ時間', () => {
  it('1時間に満たなければ分だけ。それより長ければ、時間と分', () => {
    expect(formatPlayTime(0)).toBe('0分');
    expect(formatPlayTime(59)).toBe('0分');
    expect(formatPlayTime(34 * 60 + 20)).toBe('34分');
    expect(formatPlayTime(12 * 3600 + 34 * 60)).toBe('12時間 34分');
    expect(formatPlayTime(undefined)).toBe('0分');
  });

  it('足す前のセーブデータは、0 から', () => {
    const old = createSave();
    delete old.records.playTime;
    expect(normalizeSave(old).records.playTime).toBe(0);
  });
});

describe('記録の中のタブの案内', () => {
  it('ゲームパッドでは、LT・RT', () => {
    expect(padWords('Q・E：切り替え')).toBe('LT・RT：切り替え');
  });
});
