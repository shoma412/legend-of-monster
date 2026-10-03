// エリアの部屋の並びと、部屋の中身の抽選。乱数は外から渡すので、テストで結果を固定できる。
import { ECONOMY, ROOMGEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { rollImplantChoices } from './level.js';
import { makeItem } from './loot.js';

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

function pickWeighted(list, rng) {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let roll = rng() * total;
  for (const x of list) {
    roll -= x.weight;
    if (roll < 0) return x;
  }
  return list[list.length - 1];
}

// エリアの進み具合。current: 今いる部屋の種類 / pool: まだ通っていない部屋 / step: 何部屋目か（0から）
export function createAreaPlan(area, rng) {
  return {
    areaId: area.id,
    step: 0,
    total: 1 + area.pool.length + 1 + 1, // 最初の部屋 + 残りの部屋 + 特殊部屋 + ボス
    current: area.first,
    pool: [...area.pool, pick(area.specialRooms, rng)],
  };
}

// 今の部屋をクリアしたあとに開く扉（次の部屋の種類）。最大2つで、同じ種類は並ばない。
// 残りの部屋がなくなったらボス部屋だけ。ボスの後は扉なし
export function doorOptions(plan, rng) {
  if (plan.current === 'boss') return [];
  if (plan.pool.length === 0) return ['boss'];
  const types = [...new Set(plan.pool)];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types.slice(0, 2);
}

// 扉を選んで次の部屋へ進む
export function advancePlan(plan, type) {
  const i = plan.pool.indexOf(type);
  if (i >= 0) plan.pool.splice(i, 1);
  else if (type !== 'boss') throw new Error(`部屋「${type}」はこのエリアに残っていません`);
  plan.current = type;
  plan.step++;
}

// 予算ぶんだけ雑魚を選ぶ。{ 敵のid: 数 }
function fillWave(area, budget, rng) {
  const wave = {};
  let left = budget;
  for (let guard = 0; guard < 100 && left > 0; guard++) {
    const affordable = area.enemies.filter((e) => DATA.enemies.get(e.id).cost <= left);
    if (affordable.length === 0) break;
    const { id } = pickWeighted(affordable, rng);
    wave[id] = (wave[id] ?? 0) + 1;
    left -= DATA.enemies.get(id).cost;
  }
  return wave;
}

// 戦闘部屋の波（2〜3波）。奥の部屋ほど敵が増える
export function generateWaves(area, step, rng) {
  const gen = ROOMGEN.combat;
  const count = gen.wavesMin + Math.floor(rng() * (gen.wavesMax - gen.wavesMin + 1));
  const waves = [];
  for (let i = 0; i < count; i++) waves.push(fillWave(area, Math.round(gen.budget + step * gen.budgetPerStep + i * gen.budgetPerWave), rng));
  return waves;
}

// エリート部屋：強化個体1体＋取り巻き
export function generateEliteWaves(area, step, rng) {
  const elite = { base: pick(area.eliteBases, rng), trait: pick(DATA.eliteTraits.ids(), rng) };
  return [{ ...fillWave(area, ROOMGEN.elite.minionBudget + step, rng), elite }];
}

export function gearPrice(item) {
  return ECONOMY.prices.gear[item.rarity];
}

// 闇市の品ぞろえ：装備2つ・修復キット・インプラント1つ
export function generateShop(build, rng) {
  const goods = [];
  for (let i = 0; i < ECONOMY.shop.gearCount; i++) {
    const item = makeItem(rng, { rarityBonus: ECONOMY.shop.rarityBonus });
    goods.push({ type: 'gear', item, price: gearPrice(item) });
  }
  goods.push({ type: 'kit', price: ECONOMY.prices.kit });
  const [implant] = rollImplantChoices(build, rng, 1);
  if (implant) goods.push({ type: 'implant', def: implant, price: ECONOMY.prices.implant });
  return goods;
}

// データ金庫：装備3つ（スロットはなるべく別々）
export function generateVault(rng) {
  const slots = ['mod', 'armor', 'acc'];
  return slots.slice(0, ROOMGEN.vault.count).map((slot) => makeItem(rng, { slot, rarityBonus: ROOMGEN.vault.rarityBonus }));
}
