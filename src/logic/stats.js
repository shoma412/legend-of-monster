// ビルド（装備とインプラント）からステータスを計算する。
// 装備効果・レジェンド固有効果・インプラント・種族ボーナスはすべて同じ形の「effect」で、
//   mods（ステータス補正）と triggers（イベントで発動する効果）と element（属性付与）
// だけでできている。ここではそれを1つにまとめる。
import { FEATURES, ITEMS, LEVEL, PLAYER } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { species } from '../data/implants.js';

// bonus: 隠れ家の恒久強化（src/logic/meta.js の permanentBonuses）
export function createBuild(bonus = null) {
  return {
    level: 1,
    xp: 0,
    gear: { mod: null, armor: null, acc: null }, // スロットごとの装備
    bag: [], // バッグにしまってある装備（ポーズ画面で付け替えられる）
    implants: {}, // { インプラントのid: レベル }
    species: null, // このランで選択肢に出る種族の id（null はすべて。隠れ家やテスト用）
    credits: 0,
    items: Array(ITEMS.slots).fill(null), // 消耗品の枠。{ id, count } か null
    kits: PLAYER.kit.start + (bonus?.kits ?? 0), // 修復キットの数
    permanent: bonus?.effects ?? [], // 恒久強化のステータス補正
    ougi: bonus?.ougi ?? [], // 奥義が使える武器の id
    ougiUsed: false, // このエリアで奥義を使ったか（エリアごとに1回）
  };
}

// インプラントの強さの倍率。Lv1 で 1、Lv が1上がるごとに implantGrowth ずつ増える
export function implantScale(level) {
  return 1 + (Math.max(1, level) - 1) * LEVEL.implantGrowth;
}

// そのレベルでのインプラントの効果と、説明文
export function implantEffect(def, level = 1) {
  return def.effect(implantScale(level));
}

export function implantDesc(def, level = 1) {
  return def.desc(implantScale(level));
}

// もう1つ手に入れたときのレベル（上限まで）
export function nextImplantLevel(build, id) {
  return Math.min(LEVEL.implantMax, (build.implants[id] ?? 0) + 1);
}

export function isAvailable(def) {
  return !def.requires || FEATURES[def.requires];
}

// 装備1つを effect の並びに直す
export function itemEffects(item) {
  const list = [];
  for (const line of item.effects) {
    const def = DATA.gearEffects.get(line.id);
    if (def.kind === 'element') list.push({ element: line.element });
    else list.push({ mods: [{ stat: def.stat, add: (def.sign ?? 1) * line.value }] });
  }
  if (item.unique) list.push(DATA.legendEffects.get(item.unique).effect);
  return list;
}

// このランで選択肢に出る種族：そのマップのボスの種族と、持ち込みの種族（汎用はいつでも出る）
export function mapSpecies(map) {
  const bosses = map.areas.map((id) => DATA.areas.get(id).boss);
  return Object.keys(species).filter((id) => bosses.includes(species[id].boss));
}

export function runSpecies(map, carry = null) {
  const list = mapSpecies(map);
  if (carry && species[carry] && !list.includes(carry)) list.push(carry);
  return list;
}

// 持ち込める種族：倒したことのあるボスの種族のうち、そのマップに元からいないもの
export function carryOptions(save, map) {
  const own = mapSpecies(map);
  return Object.keys(species).filter((id) => species[id].boss && !own.includes(id) && (save.bossKills[species[id].boss] ?? 0) > 0);
}

// そのインプラントが、このランの選択肢に出るか
export function inRunPool(build, def) {
  return def.species === 'general' || !build.species || build.species.includes(def.species);
}

// 種族ごとの、持っている種類の数（レベルは数えない）
export function speciesCounts(build) {
  const counts = {};
  for (const id of Object.keys(build.implants)) {
    const sp = DATA.implants.get(id).species;
    counts[sp] = (counts[sp] ?? 0) + 1;
  }
  return counts;
}

// 発動している種族ボーナス。[{ species: 種族の id, need, desc, effect }]
export function activeSpeciesBonuses(build) {
  const counts = speciesCounts(build);
  const list = [];
  for (const [id, sp] of Object.entries(species)) {
    for (const bonus of sp.bonuses) if ((counts[id] ?? 0) >= bonus.need) list.push({ species: id, ...bonus });
  }
  return list;
}

// 種類を count 個持ったときに、新しく発動するボーナス（なければ null）
export function bonusAt(speciesId, count) {
  return species[speciesId].bonuses.find((b) => b.need === count) ?? null;
}

export function collectEffects(build) {
  const list = [...(build.permanent ?? [])];
  for (const item of Object.values(build.gear)) {
    if (item) list.push(...itemEffects(item));
  }
  for (const [id, n] of Object.entries(build.implants)) {
    list.push(implantEffect(DATA.implants.get(id), n));
  }
  for (const bonus of activeSpeciesBonuses(build)) list.push(bonus.effect);
  return list;
}

export function computeStats(build) {
  // 足し算で積む値の初期値
  const sum = {
    maxHp: PLAYER.maxHp,
    moveSpeedMul: 1,
    attackMul: 1,
    critChance: PLAYER.critChance,
    critMul: PLAYER.critMultiplier,
    attackSpeed: 0,
    damageTaken: 1,
    meleeRange: 1,
    meleeArc: 1, // 近接攻撃の角度の倍率
    dashCharges: 1, // 続けて出せるダッシュの回数
    killHeal: 0,
    creditMul: 1,
    pierce: 0,
    chainBonus: 0,
    burnMul: 1,
    slowMul: 1, // 敵にかける減速の時間の倍率
    freezeChance: 0,
  };
  const conditional = []; // 条件つきの補正。使うときに条件を調べる（src/game/effects.js）
  const triggers = {}; // { イベント名: [trigger, ...] }
  const elements = [];

  for (const effect of collectEffects(build)) {
    for (const mod of effect.mods ?? []) {
      if (mod.when) conditional.push(mod);
      else sum[mod.stat] = (sum[mod.stat] ?? 0) + mod.add;
    }
    for (const trigger of effect.triggers ?? []) (triggers[trigger.on] ??= []).push(trigger);
    if (effect.element && !elements.includes(effect.element)) elements.push(effect.element);
  }

  return {
    ...sum,
    maxHp: Math.round(sum.maxHp),
    moveSpeed: PLAYER.moveSpeed * sum.moveSpeedMul,
    damageTaken: Math.max(PLAYER.minDamageTaken, sum.damageTaken),
    conditional,
    triggers,
    elements,
  };
}
