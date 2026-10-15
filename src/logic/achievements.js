// 実績の判定。定義（src/data/achievements.js）の check で、下の部品を選ぶ。
import { DATA } from '../data/index.js';
import { activeSpeciesBonuses } from './stats.js';

// 追加の条件の部品。(実績の定義, 出来事, セーブデータ, ラン) → 満たしていれば true
const CHECKS = {
  bossIs: (def, event) => event.boss === def.boss,
  noDamage: (def, event) => event.noDamage === true,
  // 同じ種族の部品を3種類そろえた
  familyBonus: (def, event, save, run) => activeSpeciesBonuses(run.build).some((b) => b.need >= 3),
  rarityAtLeast: (def, event) => event.rarity >= def.rarity,
  fragmentCount: (def, event, save) => save.fragments.length >= def.count,
  allFragments: (def, event, save) => DATA.fragments.ids().every((id) => save.fragments.includes(id)),
  totalKills: (def, event, save) => save.records.kills >= def.count,
  weaponIs: (def, event, save, run) => run.weaponId === def.weapon,
  levelAtLeast: (def, event) => event.level >= def.level,
  runsAtLeast: (def, event, save) => save.records.runs >= def.count,
  mapIs: (def, event) => event.map === def.map,
  cycleAtLeast: (def, event) => event.cycle >= def.cycle,
  // その武器で、count 回クリアした（武器ごとのクリア回数は、save.records.weaponClears。2026-10-16 から数える）
  weaponClears: (def, event, save) => (save.records.weaponClears?.[def.weapon] ?? 0) >= def.count,
  // 8種類すべての武器で、クリアしたことがある（記録がなくても、その武器の「初めてクリア」の実績があればよい）
  allWeaponsCleared: (def, event, save) => DATA.weapons.ids().every((id) => (save.records.weaponClears?.[id] ?? 0) > 0 || save.achievements.includes(`clear-${id}`)),
  totalClears: (def, event, save) => save.records.clears >= def.count,
  // これ以外の実績を、すべて解除した
  allAchievements: (def, event, save) => DATA.achievements.all().every((d) => d.id === def.id || save.achievements.includes(d.id)),
  // 隠しボスを含む、すべてのボスを倒した
  allBosses: (def, event, save) => DATA.bosses.ids().every((id) => (save.bossKills[id] ?? 0) > 0),
};

export function hasCheck(name) {
  return name in CHECKS;
}

// 出来事を見て、新しく解除された実績を save に記録して返す
export function unlockAchievements(save, run, event) {
  const unlocked = [];
  for (const def of DATA.achievements.all()) {
    if (save.achievements.includes(def.id) || !([def.on].flat().includes('any') || [def.on].flat().includes(event.type))) continue;
    if (def.check && !CHECKS[def.check](def, event, save, run)) continue;
    save.achievements.push(def.id);
    unlocked.push(def);
  }
  return unlocked;
}
