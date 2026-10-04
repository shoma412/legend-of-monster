// 実績の判定。定義（src/data/achievements.js）の check で、下の部品を選ぶ。
import { DATA } from '../data/index.js';
import { activeFamilyBonuses } from './stats.js';

// 追加の条件の部品。(実績の定義, 出来事, セーブデータ, ラン) → 満たしていれば true
const CHECKS = {
  bossIs: (def, event) => event.boss === def.boss,
  noDamage: (def, event) => event.noDamage === true,
  familyBonus: (def, event, save, run) => activeFamilyBonuses(run.build).length > 0,
  rarityAtLeast: (def, event) => event.rarity >= def.rarity,
  fragmentCount: (def, event, save) => save.fragments.length >= def.count,
  allFragments: (def, event, save) => DATA.fragments.ids().every((id) => save.fragments.includes(id)),
  totalKills: (def, event, save) => save.records.kills >= def.count,
  weaponIs: (def, event, save, run) => run.weaponId === def.weapon,
  levelAtLeast: (def, event) => event.level >= def.level,
  runsAtLeast: (def, event, save) => save.records.runs >= def.count,
};

export function hasCheck(name) {
  return name in CHECKS;
}

// 出来事を見て、新しく解除された実績を save に記録して返す
export function unlockAchievements(save, run, event) {
  const unlocked = [];
  for (const def of DATA.achievements.all()) {
    if (def.on !== event.type || save.achievements.includes(def.id)) continue;
    if (def.check && !CHECKS[def.check](def, event, save, run)) continue;
    save.achievements.push(def.id);
    unlocked.push(def);
  }
  return unlocked;
}
