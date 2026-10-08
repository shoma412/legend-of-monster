// 装備のドロップ抽選。乱数は外から渡すので、テストで結果を固定できる。
import { LOOT } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { isAvailable } from './stats.js';

const ELEMENTS = ['shock', 'heat', 'cold', 'corrode'];
export const ELEMENT_NAMES = { shock: '電撃', heat: '熱', cold: '冷却', corrode: '腐食' };

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// そのエリアでの、レア度ごとの出やすさ。tier はマップの中の何番目のエリアか（0 から）。null なら基本の値
export function rarityWeights(tier = null) {
  if (tier == null) return LOOT.rarities.map((r) => r.weight);
  return LOOT.areaWeights[Math.max(0, Math.min(LOOT.areaWeights.length - 1, tier))];
}

function rollOnce(rng, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return 0;
}

// レア度の番号（0=コモン … 3=レジェンド）。bonus の回数だけ引き直して、いちばん良いものを取る
export function rollRarity(rng, bonus = 0, tier = null) {
  const weights = rarityWeights(tier);
  let best = rollOnce(rng, weights);
  for (let i = 0; i < bonus; i++) best = Math.max(best, rollOnce(rng, weights));
  return best;
}

function rollLine(def, rarity, rng) {
  if (def.kind === 'element') return { id: def.id, element: pick(ELEMENTS, rng) };
  const [lo, hi] = rarity.roll;
  const raw = def.min + (def.max - def.min) * (lo + rng() * (hi - lo));
  const value = def.unit === '%' ? Math.round(raw * 100) / 100 : Math.round(raw);
  return { id: def.id, value };
}

// 装備を1つ作る。{ slot, rarity, effects: [{ id, value } | { id, element }], unique, name }
//   tier: マップの中の何番目のエリアか（レア度の出やすさが変わる）
export function makeItem(rng, { rarityBonus = 0, minRarity = 0, slot = null, rarity = null, tier = null } = {}) {
  const rarityIndex = rarity ?? Math.max(minRarity, rollRarity(rng, rarityBonus, tier));
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
