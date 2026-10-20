import { describe, expect, it } from 'vitest';
import { LOOT, ROOMGEN } from '../src/data/balance.js';
import { recalcStats } from '../src/game/build.js';
import { chooseEncounter } from '../src/game/encounters.js';
import { createWorld } from '../src/game/world.js';
import { makeItem } from '../src/logic/loot.js';

// 遭遇で出る装備（2026-10-20）：流れの商人は、いま着ている装備の確定で1段階上。倒れた回収屋は、同じか1段階上。部位はランダム

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const TOP = LOOT.rarities.findIndex((r) => r.id === 'legend');

// 3部位に、レア度 rarity の装備を着せた世界
function worldWith(rarity, seed = 1) {
  const world = createWorld({ waves: [{}], rng: seeded(seed * 98765) }); // 種が1ずつ違っても、最初の乱数がばらけるように、大きく離す
  world.waveTimer = Infinity;
  recalcStats(world.player);
  for (const slot of LOOT.slots.map((s) => s.id)) world.player.build.gear[slot] = rarity == null ? null : makeItem(seeded(seed + 9), { slot, rarity });
  world.player.hp = world.player.stats.maxHp;
  return world;
}

const npc = () => ({ used: false });
const peddler = { action: 'payHpForGear' };
const scavenger = { action: 'lootBody' };

// 1回遭遇して、足元に落ちた装備を返す
function drop(world, choice) {
  const before = world.loot.length;
  expect(chooseEncounter(world, npc(), choice)).toBe(true);
  expect(world.loot.length).toBe(before + 1);
  return world.loot[world.loot.length - 1].item;
}

describe('遭遇の装備：流れの商人は、確定で1段階上', () => {
  it('コモン〜エピックを着ているとき、同じ部位の装備より、必ず1段階上が出る', () => {
    for (let rarity = 0; rarity < TOP; rarity++) {
      for (let seed = 1; seed <= 60; seed++) {
        const world = worldWith(rarity, seed);
        const item = drop(world, peddler);
        expect(item.rarity, `着ている ${rarity} / 種 ${seed}`).toBe(rarity + 1);
      }
    }
  });

  it('部位は、ランダム（3部位とも出る）', () => {
    const slots = new Set();
    for (let seed = 1; seed <= 60; seed++) slots.add(drop(worldWith(1, seed), peddler).slot);
    expect([...slots].sort()).toEqual(LOOT.slots.map((s) => s.id).sort());
  });

  it('レジェンドを着ているときは、レジェンドのまま（上限）。ミシックの出る確率がないとき、ミシックは出ない', () => {
    for (let seed = 1; seed <= 60; seed++) expect(drop(worldWith(TOP, seed), peddler).rarity).toBe(TOP);
  });

  it('何も着けていない部位は、今までどおり（底上げの抽選）。そのレア度は、必ず存在する', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const item = drop(worldWith(null, seed), peddler);
      expect(item.rarity).toBeGreaterThanOrEqual(0);
      expect(item.rarity).toBeLessThan(LOOT.rarities.length);
    }
  });

  it('HPは払う（最大HPの割合）', () => {
    const world = worldWith(1);
    const max = world.player.stats.maxHp;
    drop(world, peddler);
    expect(world.player.hp).toBe(max - Math.round(max * ROOMGEN.encounter.hpCost));
  });
});

describe('遭遇の装備：倒れた回収屋は、同じか1段階上', () => {
  it('着ているものと同じか、1段階上。弱いものは出ない。両方とも、出る', () => {
    const seen = new Set();
    for (let rarity = 0; rarity < TOP; rarity++) {
      for (let seed = 1; seed <= 80; seed++) {
        const world = worldWith(rarity, seed);
        const item = drop(world, scavenger);
        expect(item.rarity).toBeGreaterThanOrEqual(rarity);
        expect(item.rarity).toBeLessThanOrEqual(rarity + 1);
        seen.add(item.rarity - rarity);
      }
    }
    expect([...seen].sort()).toEqual([0, 1]);
  });

  it('1段階上になる確率は、設定の値に近い', () => {
    let up = 0;
    const n = 400;
    for (let seed = 1; seed <= n; seed++) if (drop(worldWith(1, seed), scavenger).rarity === 2) up++;
    expect(up / n).toBeGreaterThan(ROOMGEN.encounter.lootStepChance - 0.1);
    expect(up / n).toBeLessThan(ROOMGEN.encounter.lootStepChance + 0.1);
  });

  it('次の戦闘部屋の敵が増える（今までどおり）', () => {
    const world = worldWith(1);
    drop(world, scavenger);
    expect(world.player.build.ambush).toBe(true);
  });
});
