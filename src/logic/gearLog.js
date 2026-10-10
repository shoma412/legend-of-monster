// 手に入れた装備の記録と、プレイ時間の表示（画面には触らない。docs/詳細仕様.md「33. 記録の画面」）。
// 装備は、出撃のたびに作られて、帰ると残らない。そこで「どんな装備を手に入れたことがあるか」だけを、セーブデータに残す。

// 記録の入れ物
//   counts  : { 'レア度の番号:スロットの id': 手に入れた数 }
//   uniques : 手に入れたことのある、レジェンド装備の固有効果の id
//   best    : { 効果の id: 見た中で、いちばん高かった値 }
//   elements: 装備に付いていたことのある属性の id
export function createGearLog() {
  return { counts: {}, uniques: [], best: {}, elements: [] };
}

// 読み込んだ記録の中身を確かめる（形がおかしければ、空から）
export function normalizeGearLog(log) {
  const base = createGearLog();
  if (!log || typeof log !== 'object') return base;
  const numbers = (obj) => Object.fromEntries(Object.entries(obj ?? {}).filter(([, n]) => Number.isFinite(n) && n > 0));
  const strings = (list) => (Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === 'string'))] : []);
  return { counts: numbers(log.counts), uniques: strings(log.uniques), best: numbers(log.best), elements: strings(log.elements) };
}

// 装備を1つ、記録に入れる。同じ装備を2回数えないように、入れた装備には印（logged）を付ける。入れたら true
export function logGear(log, item) {
  if (!item || item.logged) return false;
  item.logged = true;
  const key = `${item.rarity}:${item.slot}`;
  log.counts[key] = (log.counts[key] ?? 0) + 1;
  if (item.unique && !log.uniques.includes(item.unique)) log.uniques.push(item.unique);
  for (const line of item.effects ?? []) {
    if (line.element) {
      if (!log.elements.includes(line.element)) log.elements.push(line.element);
    } else if (Number.isFinite(line.value)) {
      log.best[line.id] = Math.max(log.best[line.id] ?? 0, line.value);
    }
  }
  return true;
}

// 今持っている装備（身につけているもの・バッグの中）を、まとめて記録に入れる
export function logBuildGear(log, build) {
  let added = false;
  for (const item of [...Object.values(build.gear ?? {}), ...(build.bag ?? [])]) if (logGear(log, item)) added = true;
  return added;
}

// プレイ時間（秒）を「12時間 34分」の形に。1時間に満たなければ「34分」
export function formatPlayTime(seconds) {
  const total = Math.max(0, Math.floor((seconds ?? 0) / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}時間 ${m}分` : `${m}分`;
}
