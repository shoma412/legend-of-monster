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
//   列0：最初の部屋 / 途中の列：2〜3部屋ずつ / ボスの1つ前：必ず補給（1部屋）/ 最後の列：ボス
//   長さ（最初の部屋からボスまでに通る部屋の数）は、エリアの定義の map.length の範囲で毎回変わる
//   どの部屋からも、次の列の2〜3部屋へ進める（次の列が補給・ボスのときは1部屋）
//   nodes: { id: { id, col, row, type, next: [id, ...] } }  row は 0=上 〜 1=下（1部屋だけの列は 0.5）
//   current: 今いる部屋の id / visited: 通ってきた部屋の id / step: 何部屋目か（0から）
const LANE_ROWS = { 2: [0.25, 0.75], 3: [0, 0.5, 1] };

export function createAreaPlan(area, rng) {
  const gen = area.map;
  const length = gen.length.min + Math.floor(rng() * (gen.length.max - gen.length.min + 1));
  const columns = length - 3; // 途中の列の数（最初の部屋・ボス前の補給・ボスを除く）
  // 列ごとの部屋の数（2〜3）
  const lanes = Array.from({ length: columns }, () => gen.lanes.min + Math.floor(rng() * (gen.lanes.max - gen.lanes.min + 1)));
  const offsets = lanes.map((_, c) => lanes.slice(0, c).reduce((a, b) => a + b, 0));

  // 途中の部屋の中身：エリート、特殊部屋、残りは戦闘。
  // 扉の選択肢が全部同じ種類にならないように、同じ列で隣り合う部屋は必ず違う種類にする
  // （扉は、次の列の隣り合った2〜3部屋へ開くので、これで必ず2種類以上になる）。
  const elites = gen.elites.min + Math.floor(rng() * (gen.elites.max - gen.elites.min + 1));
  const marked = shuffle([...Array(elites).fill('elite'), ...shuffle(area.specialRooms, rng).slice(0, gen.specials)], rng);
  // どの列にも「戦闘でない部屋」が1つは要る。足りないぶんは、特殊部屋を足す（同じ種類が2つ出ることがある）
  while (marked.length < columns) marked.push(pick(area.specialRooms, rng));

  // まず、列ごとに1つずつ置く（3部屋の列は真ん中、2部屋の列はどちらか）
  const grid = lanes.map((n) => Array(n).fill('combat'));
  for (let c = 0; c < columns; c++) grid[c][lanes[c] === 3 ? 1 : Math.floor(rng() * 2)] = marked[c];
  // 残りは、空いている場所（戦闘の部屋）に置く。同じ列の隣が同じ種類になる場所は避ける
  for (const type of marked.slice(columns)) {
    const free = [];
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < lanes[c]; r++) {
        if (grid[c][r] === 'combat' && grid[c][r - 1] !== type && grid[c][r + 1] !== type) free.push([c, r]);
      }
    }
    if (free.length === 0) continue;
    const [c, r] = pick(free, rng);
    grid[c][r] = type;
  }
  const placed = grid.flat();

  const nodes = {};
  const add = (id, col, row, type) => { nodes[id] = { id, col, row, type, next: [] }; };
  const ids = (c) => Array.from({ length: lanes[c - 1] }, (_, r) => `${c}-${r}`); // c は 1 から
  add('start', 0, 0.5, area.first);
  for (let c = 0; c < columns; c++) {
    for (let r = 0; r < lanes[c]; r++) add(`${c + 1}-${r}`, c + 1, LANE_ROWS[lanes[c]][r], placed[offsets[c] + r]);
  }
  // ボスの1つ前は、どの道を通っても同じ部屋（補給）に集まる
  add('rest', columns + 1, 0.5, gen.preBoss);
  add('boss', columns + 2, 0.5, 'boss');
  nodes.rest.next = ['boss'];

  // 線を引く。最初の部屋からは、次の列のすべての部屋へ進める
  nodes.start.next = ids(1);
  for (let c = 1; c <= columns; c++) {
    const here = ids(c);
    if (c === columns) {
      for (const id of here) nodes[id].next = ['rest'];
      continue;
    }
    const there = ids(c + 1);
    here.forEach((id, r) => {
      let next;
      if (there.length === 2) next = [0, 1];
      else if (here.length === 2) next = r === 0 ? [0, 1] : [1, 2]; // 上の部屋は上寄り、下の部屋は下寄りへ
      else next = r === 0 ? [0, 1] : r === 2 ? [1, 2] : rng() < 0.5 ? [0, 1] : [1, 2];
      // ときどき、3部屋すべてへ進める
      if (there.length === 3 && rng() < gen.crossChance) next = [0, 1, 2];
      nodes[id].next = next.map((i) => there[i]); // 上の部屋が先（扉も上から並ぶ）
    });
  }

  return { areaId: area.id, nodes, current: 'start', visited: ['start'], step: 0, columns: length };
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
// traitCount: 特性の数（周が進むと2つになる）
export function generateEliteWaves(area, step, rng, traitCount = 1) {
  const traits = shuffle(DATA.eliteTraits.ids(), rng).slice(0, traitCount);
  const elite = { base: pick(area.eliteBases, rng), trait: traits[0], traits };
  return [{ ...fillWave(area, Math.round(ROOMGEN.elite.minionBudget + step * ROOMGEN.elite.minionPerStep), rng), elite }];
}

export function gearPrice(item) {
  return ECONOMY.prices.gear[item.rarity];
}

// 闇市の品ぞろえ：毎回ちがう。装備・修復キット・インプラントは必ず1つずつ入り、残りは抽選（装備・消耗品・インプラント）
export function generateShop(build, rng, tier = null) {
  const shop = ECONOMY.shop;
  // 種類を決める：装備・回復（修復キット）・インプラントは必ず1つずつ。残りは抽選
  const types = ['gear', 'kit', 'implant'];
  const pool = Object.entries(shop.extras);
  const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
  while (types.length < shop.count) {
    let roll = rng() * total;
    let chosen = pool[0][0];
    for (const [type, weight] of pool) {
      roll -= weight;
      if (roll < 0) {
        chosen = type;
        break;
      }
    }
    types.push(chosen);
  }
  // 中身を決める。インプラントと消耗品は、同じものが2つ並ばないようにする
  const implants = rollImplantChoices(build, rng, types.filter((t) => t === 'implant').length);
  const consumables = [...DATA.consumables.ids()];
  const goods = [];
  for (const type of types) {
    if (type === 'gear') {
      const item = makeItem(rng, { rarityBonus: shop.rarityBonus, tier });
      goods.push({ type, item, price: gearPrice(item) });
    } else if (type === 'kit') {
      goods.push({ type, price: ECONOMY.prices.kit });
    } else if (type === 'implant') {
      const def = implants.shift();
      if (def) goods.push({ type, def, price: ECONOMY.prices.implant });
    } else if (type === 'item' && consumables.length > 0) {
      const [id] = consumables.splice(Math.min(consumables.length - 1, Math.floor(rng() * consumables.length)), 1);
      goods.push({ type, id, price: ITEMS.price });
    }
  }
  // 見やすいように、種類ごとにまとめて並べる（装備 → 修復キット → 消耗品 → インプラント）
  const order = ['gear', 'kit', 'item', 'implant'];
  return goods.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

// データ金庫：装備3つ（スロットはなるべく別々）
export function generateVault(rng, tier = null) {
  const slots = ['mod', 'armor', 'acc'];
  return slots.slice(0, ROOMGEN.vault.count).map((slot) => makeItem(rng, { slot, rarityBonus: ROOMGEN.vault.rarityBonus, tier }));
}
