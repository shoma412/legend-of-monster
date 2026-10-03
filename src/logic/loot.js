// 装備のドロップ抽選。乱数は外から渡すので、テストで結果を固定できる。
import { LOOT } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { isAvailable } from './stats.js';

const ELEMENTS = ['shock', 'heat', 'cold'];
export const ELEMENT_NAMES = { shock: '電撃', heat: '熱', cold: '冷却' };

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// レア度の番号（0=コモン … 3=レジェンド）。bonus ぶんだけ上の段にずらす
export function rollRarity(rng, bonus = 0) {
  const total = LOOT.rarities.reduce((s, r) => s + r.weight, 0);
  let roll = rng() * total;
  let index = 0;
  for (let i = 0; i < LOOT.rarities.length; i++) {
    roll -= LOOT.rarities[i].weight;
    if (roll < 0) {
      index = i;
      break;
    }
  }
  return Math.min(LOOT.rarities.length - 1, index + bonus);
}

function rollLine(def, rarity, rng) {
  if (def.kind === 'element') return { id: def.id, element: pick(ELEMENTS, rng) };
  const [lo, hi] = rarity.roll;
  const raw = def.min + (def.max - def.min) * (lo + rng() * (hi - lo));
  const value = def.unit === '%' ? Math.round(raw * 100) / 100 : Math.round(raw);
  return { id: def.id, value };
}

// 装備を1つ作る。{ slot, rarity, effects: [{ id, value } | { id, element }], unique, name }
export function makeItem(rng, { rarityBonus = 0, slot = null, rarity = null } = {}) {
  const rarityIndex = rarity ?? rollRarity(rng, rarityBonus);
  const rar = LOOT.rarities[rarityIndex];
  const slotDef = slot ? LOOT.slots.find((s) => s.id === slot) : pick(LOOT.slots, rng);
  const pool = DATA.gearEffects.all().filter(isAvailable);

  // レジェンドは効果のうち1つが固有効果
  const unique = rar.unique ? pick(DATA.legendEffects.all(), rng) : null;
  const count = Math.min(pool.length, rar.effects - (unique ? 1 : 0));

  const chosen = [];
  // 1つ目はそのスロットらしい効果から選ぶ
  const primary = pool.filter((d) => d.primaryFor?.includes(slotDef.id));
  if (count > 0 && primary.length > 0) chosen.push(pick(primary, rng));
  while (chosen.length < count) {
    const rest = pool.filter((d) => !chosen.includes(d));
    chosen.push(pick(rest, rng));
  }

  return {
    slot: slotDef.id,
    rarity: rarityIndex,
    effects: chosen.map((def) => rollLine(def, rar, rng)),
    unique: unique ? unique.id : null,
    name: unique ? `${unique.name}・${slotDef.noun}` : `${rar.name} ${slotDef.noun}`,
  };
}

// 効果1行の表示。例：「攻撃力 +12%」「被ダメージ −5%」「冷却属性」
export function describeLine(line) {
  const def = DATA.gearEffects.get(line.id);
  if (def.kind === 'element') return `${ELEMENT_NAMES[line.element]}属性`;
  const sign = (def.sign ?? 1) < 0 ? '−' : '+';
  const value = def.unit === '%' ? `${Math.round(line.value * 100)}%` : `${line.value}`;
  return `${def.label} ${sign}${value}`;
}

export function describeItem(item) {
  const lines = item.effects.map(describeLine);
  if (item.unique) {
    const u = DATA.legendEffects.get(item.unique);
    lines.push(`★ ${u.desc}`);
  }
  return lines;
}
