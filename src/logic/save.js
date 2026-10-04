// セーブデータ。隠れ家の進行状況だけを保存する（ラン途中は保存しない）。
// 保存先（storage）は外から渡すので、テストでは偽物を使える。ブラウザでは localStorage を渡す。

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'legend-of-monster/save';

export function createSave() {
  return {
    version: SAVE_VERSION,
    materials: {}, // { 素材のid: 個数 }
    upgrades: {}, // { 恒久強化のid: 段階 }
    weapons: ['greatsword'], // 解放済みの武器
    bossKills: {}, // { ボスのid: 倒した回数 }
    fragments: [], // 手に入れたデータ片の id
    achievements: [], // 解除した実績の id
    records: { runs: 0, clears: 0, kills: 0, bestArea: 0, bestStep: 0 },
  };
}

// 古い版のセーブデータを今の形に直す。版が上がったら、ここに1段ずつ足す
//   例：if (data.version === 1) { data.newField = ...; data.version = 2; }
function migrate(data) {
  return data;
}

// 壊れたデータや足りない項目があっても遊べるように、初期値で埋める
function normalize(data) {
  const base = createSave();
  if (!data || typeof data !== 'object' || typeof data.version !== 'number' || data.version > SAVE_VERSION) return base;
  const d = migrate(data);
  return {
    version: SAVE_VERSION,
    materials: { ...base.materials, ...(d.materials ?? {}) },
    upgrades: { ...(d.upgrades ?? {}) },
    weapons: Array.isArray(d.weapons) && d.weapons.length > 0 ? [...new Set(d.weapons)] : base.weapons,
    bossKills: { ...(d.bossKills ?? {}) },
    fragments: Array.isArray(d.fragments) ? [...new Set(d.fragments)] : [],
    achievements: Array.isArray(d.achievements) ? [...new Set(d.achievements)] : [],
    records: { ...base.records, ...(d.records ?? {}) },
  };
}

export function loadSave(storage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return createSave();
  }
}

// 保存できたら true。保存できない環境（プライベートブラウズなど）でも、遊びは続けられる
export function storeSave(storage, save) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(save));
    return !!storage;
  } catch {
    return false;
  }
}
