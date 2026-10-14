import { describe, expect, it } from 'vitest';
import { CYCLE, LOOT } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { createRun, enterRoom } from '../src/game/run.js';
import { createAreaPlan } from '../src/logic/areaGen.js';
import { afterNoise } from '../src/logic/dialogue.js';
import { addOneEnv, envIdFor, flagsOf } from '../src/logic/envs.js';
import { cycleMods, cycleNotes, hpScaleFor } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';

// 長い周回（docs/詳細仕様.md「37. 周回の長い先と、終わりのない強化」）

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

describe('敵のHP：10周目から伸びが増える', () => {
  it('9周目までは毎周 +15%。10周目からは毎周 +20%、そこから 5周ごとに伸びが +5%', () => {
    expect(hpScaleFor(1)).toBe(1);
    expect(hpScaleFor(2)).toBeCloseTo(1.15);
    expect(hpScaleFor(9)).toBeCloseTo(1 + 8 * 0.15);
    expect(hpScaleFor(10)).toBeCloseTo(1 + 8 * 0.15 + 0.2);
    expect(hpScaleFor(14)).toBeCloseTo(hpScaleFor(10) + 4 * 0.2);
    // 15周目から、伸びは 0.25
    expect(hpScaleFor(15) - hpScaleFor(14)).toBeCloseTo(0.25);
    expect(hpScaleFor(20) - hpScaleFor(19)).toBeCloseTo(0.3);
    // 上限はない（どこまでも増える）
    expect(hpScaleFor(100)).toBeGreaterThan(hpScaleFor(50));
    expect(cycleMods(3).hpScale).toBeCloseTo(1.3);
  });
});

describe('ミシック・環境・補給・素材：周が進むと変わる', () => {
  it('ミシックの確率は、10周目から毎周 +5%（上限 ×2）', () => {
    expect(cycleMods(9).mythicMul).toBe(1);
    expect(cycleMods(10).mythicMul).toBeCloseTo(1.05);
    expect(cycleMods(20).mythicMul).toBeCloseTo(1.55);
    expect(cycleMods(100).mythicMul).toBe(CYCLE.mythicMax);
  });

  it('マップ7の部屋のミシックの確率に、周の倍率が掛かる', () => {
    const run = createRun({ weaponId: 'sword', rng: seeded(3), mapId: 'map7', cycle: 20 });
    const world = enterRoom(run);
    expect(world.room.mythicChance).toBeCloseTo(LOOT.mythic.map7[0] * 1.55);
  });

  it('15周目から、エリアごとに環境が1つ重なる。ふだん環境のないエリアにも', () => {
    expect(cycleMods(14).extraEnv).toBe(false);
    expect(cycleMods(15).extraEnv).toBe(true);
    const run = createRun({ weaponId: 'sword', rng: seeded(3), mapId: 'map1', cycle: 15 });
    const world = enterRoom(run);
    expect(['dark', 'acidrain', 'gale']).toContain(world.room.environment.id);
    // 同じエリアの次の部屋も、同じ環境
    const again = enterRoom(run);
    expect(again.room.environment.id).toBe(world.room.environment.id);
    // 14周目までは、重ならない
    const run14 = createRun({ weaponId: 'sword', rng: seeded(3), mapId: 'map1', cycle: 14 });
    expect(enterRoom(run14).room.environment).toBeFalsy();
  });

  it('環境の組み合わせ：入っているものから id を決め、まだないものを1つ足せる', () => {
    expect(flagsOf(DATA.environments.get('darkgale'))).toEqual(['dark', 'wind']);
    expect(envIdFor(['wind', 'dark'])).toBe('darkgale');
    expect(envIdFor(['rain'])).toBe('acidrain');
    expect(addOneEnv(DATA.environments.get('dark'), 0)).toBe('darkrain');
    expect(addOneEnv(DATA.environments.get('dark'), 0.99)).toBe('darkgale');
    expect(addOneEnv(DATA.environments.get('storm'), 0.5)).toBe('storm');
    expect(addOneEnv(null, 0.1)).toBe('dark');
    for (const id of ['darkrain', 'raingale', 'darkgale', 'storm']) expect(DATA.environments.get(id)).toBeDefined();
  });

  it('20周目から、補給部屋が出ない。ボス前も戦闘の部屋になる。ボス素材は毎周 +1', () => {
    const area = DATA.areas.get('slum');
    const plan = createAreaPlan(area, seeded(7), cycleMods(20));
    const types = Object.values(plan.nodes).map((n) => n.type);
    expect(types).not.toContain('supply');
    expect(plan.nodes.rest.type).toBe('combat');
    const normal = createAreaPlan(area, seeded(7), cycleMods(19));
    expect(Object.values(normal.nodes).map((n) => n.type)).toContain('supply');
    expect(cycleMods(20).materialBonus).toBe(cycleMods(19).materialBonus + 1);
    expect(cycleMods(21).materialBonus).toBe(cycleMods(20).materialBonus + 2);
  });

  it('周の説明に、新しい決まりが出る', () => {
    expect(cycleNotes(15).join('')).toContain('環境が重なる');
    expect(cycleNotes(20).join('')).toContain('補給部屋なし');
  });
});

describe('依頼人（ノイズ）を止めたあとの通信', () => {
  it('止める前はそのまま。止めたあとは、ノイズは雑音だけで、ハルが受ける', () => {
    const lines = ['@noise＞ 本文'];
    const save = createSave();
    expect(afterNoise(save, lines)).toEqual(lines);
    save.bossKills.noise = 1;
    const after = afterNoise(save, lines);
    expect(after).toHaveLength(2);
    expect(after[0]).toContain('ザ');
    expect(after[1]).toContain('ハル');
  });
});
