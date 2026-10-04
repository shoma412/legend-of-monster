// エリアの部屋の並びと、部屋の中身の抽選。乱数は外から渡すので、テストで結果を固定できる。
import { ECONOMY, ITEMS, ROOMGEN } from '../data/balance.js';
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

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// エリアの地図を作る。左から右へ進み、線（next）でつながった部屋にだけ進める。
//   列0：最初の部屋 / 途中の列：上下2部屋ずつ / 最後の列：ボス
//   nodes: { id: { id, col, row, type, next: [id, ...] } }  row は 0=上, 1=下（1部屋だけの列は 0.5）
//   current: 今いる部屋の id / visited: 通ってきた部屋の id / step: 何部屋目か（0から）
export function createAreaPlan(area, rng) {
  const gen = area.map;
  const lanes = 2;
  const count = gen.columns * lanes;

  // 途中の部屋の中身：エリート、特殊部屋（別々の種類）、残りは戦闘
  const elites = gen.elites.min + Math.floor(rng() * (gen.elites.max - gen.elites.min + 1));
  const specials = shuffle(area.specialRooms, rng).slice(0, gen.specials);
  const types = [...Array(elites).fill('elite'), ...specials];
  while (types.length < count) types.push('combat');

  // 同じ列の上下が同じ種類にならない並びを探す
  let placed = shuffle(types, rng);
  for (let tries = 0; tries < 100; tries++) {
    let ok = true;
    for (let c = 0; c < gen.columns; c++) if (placed[c * lanes] === placed[c * lanes + 1]) ok = false;
    if (ok) break;
    placed = shuffle(types, rng);
  }

  const nodes = {};
  const add = (id, col, row, type) => { nodes[id] = { id, col, row, type, next: [] }; };
  add('start', 0, 0.5, area.first);
  for (let c = 0; c < gen.columns; c++) {
    for (let r = 0; r < lanes; r++) add(`${c + 1}-${r}`, c + 1, r, placed[c * lanes + r]);
  }
  add('boss', gen.columns + 1, 0.5, 'boss');

  // 線を引く：まっすぐ進む線は必ずあり、ときどき斜めの線が足される
  nodes.start.next = ['1-0', '1-1'];
  for (let c = 1; c <= gen.columns; c++) {
    for (let r = 0; r < lanes; r++) {
      const node = nodes[`${c}-${r}`];
      if (c === gen.columns) {
        node.next = ['boss'];
        continue;
      }
      node.next = [`${c + 1}-${r}`];
      if (rng() < gen.crossChance) node.next.push(`${c + 1}-${1 - r}`);
      node.next.sort(); // 上の部屋が先（扉も上から並ぶ）
    }
  }

  return { areaId: area.id, nodes, current: 'start', visited: ['start'], step: 0, columns: gen.columns + 2 };
}

export function currentNode(plan) {
  return plan.nodes[plan.current];
}

// 今の部屋をクリアしたあとに開く扉。[{ id, type }]（上の部屋から順）。ボスの後は扉なし
export function doorOptions(plan) {
  return currentNode(plan).next.map((id) => ({ id, type: plan.nodes[id].type }));
}

// 扉を選んで次の部屋へ進む。線でつながっていない部屋には進めない
export function advancePlan(plan, id) {
  if (!currentNode(plan).next.includes(id)) throw new Error(`部屋「${id}」へは、今の部屋から進めません`);
  plan.current = id;
  plan.visited.push(id);
  plan.step = plan.nodes[id].col;
}

// 今の部屋から、この先たどり着ける部屋の id
export function reachableNodes(plan) {
  const seen = new Set();
  const stack = [...currentNode(plan).next];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...plan.nodes[id].next);
  }
  return seen;
}

// 地図の上での部屋の状態：done（通った）/ current（今いる）/ next（扉で進める）/ ahead（この先たどり着ける）/ off（もう行けない）
export function nodeState(plan, id, reachable = reachableNodes(plan)) {
  if (id === plan.current) return 'current';
  if (plan.visited.includes(id)) return 'done';
  if (currentNode(plan).next.includes(id)) return 'next';
  return reachable.has(id) ? 'ahead' : 'off';
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

// 闇市の品ぞろえ：装備2つ・修復キット・消耗品1つ・インプラント1つ
export function generateShop(build, rng) {
  const goods = [];
  for (let i = 0; i < ECONOMY.shop.gearCount; i++) {
    const item = makeItem(rng, { rarityBonus: ECONOMY.shop.rarityBonus });
    goods.push({ type: 'gear', item, price: gearPrice(item) });
  }
  goods.push({ type: 'kit', price: ECONOMY.prices.kit });
  goods.push({ type: 'item', id: pick(DATA.consumables.ids(), rng), price: ITEMS.price });
  const [implant] = rollImplantChoices(build, rng, 1);
  if (implant) goods.push({ type: 'implant', def: implant, price: ECONOMY.prices.implant });
  return goods;
}

// データ金庫：装備3つ（スロットはなるべく別々）
export function generateVault(rng) {
  const slots = ['mod', 'armor', 'acc'];
  return slots.slice(0, ROOMGEN.vault.count).map((slot) => makeItem(rng, { slot, rarityBonus: ROOMGEN.vault.rarityBonus }));
}
