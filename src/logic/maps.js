// マップと周回の判定（どのマップを選べるか、完了の記録、周ごとの敵の強さ）。画面には依存しない。
import { CYCLE } from '../data/balance.js';
import { maps } from '../data/maps.js';

const isReady = (map) => map.ready !== false;

// そのマップをクリアした最高の周（まだなら 0）
export function clearedCycle(save, mapId) {
  return save.maps[mapId]?.clearedCycle ?? 0;
}

// マップの状態：notReady（準備中）/ locked（前のマップを完了していない）/ open（選べる）/ done（完了済み。選べる）
export function mapState(save, map) {
  if (!isReady(map)) return 'notReady';
  const index = maps.indexOf(map);
  if (index > 0 && clearedCycle(save, maps[index - 1].id) < 1) return 'locked';
  return clearedCycle(save, map.id) >= 1 ? 'done' : 'open';
}

export function canSortie(save, map) {
  const state = mapState(save, map);
  return state === 'open' || state === 'done';
}

// その周で、そのマップを選べるか。2周目以降は、前の周までに解放したマップだけ
export function canSortieCycle(save, map, cycle) {
  return canSortie(save, map) && cycle >= 1 && cycle <= save.cycle;
}

// 7つすべてのマップを完了したか（エンディングの条件。準備中のマップがある間は false）
export function allMapsCleared(save) {
  return maps.every((map) => isReady(map) && clearedCycle(save, map.id) >= 1);
}

// マップを完了したときの記録。新しく起きたことを返す
//   { firstClear: そのマップを初めて完了した, nextCycle: 新しく選べるようになった周（なければ null）, ending: これで7つすべてを初めて完了した }
export function recordMapClear(save, mapId, cycle) {
  const before = allMapsCleared(save);
  const entry = (save.maps[mapId] ??= { clears: 0, clearedCycle: 0 });
  const firstClear = entry.clearedCycle < 1;
  entry.clears++;
  entry.clearedCycle = Math.max(entry.clearedCycle, cycle);
  // 今あるマップを、今選べる最高の周ですべて完了したら、次の周が選べるようになる
  // （開発中の扱い。マップが7つそろったら、「7つすべて」と同じ意味になる）
  let nextCycle = null;
  const ready = maps.filter(isReady);
  if (ready.every((map) => clearedCycle(save, map.id) >= save.cycle)) {
    save.cycle++;
    nextCycle = save.cycle;
  }
  return { firstClear, nextCycle, ending: !before && allMapsCleared(save) };
}

// その周での、敵の強さなどの変化。1周目は何も変わらない
export function cycleMods(cycle = 1) {
  const n = Math.max(0, cycle - 1);
  return {
    hpScale: 1 + n * CYCLE.hpPerCycle, // 敵の HP の倍率
    damageScale: 1 + n * CYCLE.damagePerCycle, // 受けるダメージの倍率
    stepBonus: n * CYCLE.stepsPerCycle, // 敵の量：この部屋数ぶん奥のものとして数える
    materialBonus: Math.floor(n / CYCLE.materialEvery), // ボス素材の追加
    rarityChance: Math.min(1, n * CYCLE.rarityPerCycle), // 装備のレア度が1段上がる確率
    eliteTraits: cycle >= CYCLE.eliteTwoTraitsFrom ? 2 : 1, // エリートの特性の数
    bossHard: cycle >= CYCLE.bossHardFrom, // ボスが最初から後半の行動で始まる
    healScale: cycle >= CYCLE.supplyHalfFrom ? CYCLE.supplyScale : 1, // 補給部屋の回復量の倍率
  };
}

// 周の説明（マップを選ぶ画面に出す）。1周目は空
export function cycleNotes(cycle) {
  if (cycle <= 1) return [];
  const m = cycleMods(cycle);
  const pct = (v) => `+${Math.round((v - 1) * 100)}%`;
  const notes = [`敵のHP ${pct(m.hpScale)}　受けるダメージ ${pct(m.damageScale)}　敵の数が増える`];
  const extra = [];
  if (m.materialBonus > 0) extra.push(`ボス素材 +${m.materialBonus}`);
  if (m.rarityChance > 0) extra.push('良い装備が出やすい');
  if (extra.length > 0) notes.push(extra.join('　'));
  const rules = [];
  if (m.eliteTraits > 1) rules.push('エリートの特性が2つ');
  if (m.bossHard) rules.push('ボスが最初から本気');
  if (m.healScale < 1) rules.push('補給の回復が半分');
  if (rules.length > 0) notes.push(rules.join('　'));
  return notes;
}
