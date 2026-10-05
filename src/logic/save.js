// セーブデータ。隠れ家の進行状況だけを保存する（ラン途中は保存しない）。
// セーブ枠は SLOT_COUNT 個。保存先（storage）は外から渡すので、テストでは偽物を使える。ブラウザでは localStorage を渡す。

export const SAVE_VERSION = 2;
export const SLOT_COUNT = 3;
const LEGACY_KEY = 'legend-of-monster/save'; // セーブ枠ができる前の、1つだけのセーブデータ

// 枠の番号は 1 から
export function slotKey(slot) {
  return `legend-of-monster/save-${slot}`;
}

export function createSave() {
  return {
    version: SAVE_VERSION,
    materials: {}, // { 素材のid: 個数 }
    upgrades: {}, // { 恒久強化のid: 段階 }
    weapons: ['greatsword'], // 解放済みの武器
    selected: 'greatsword', // 隠れ家で選んでいる武器
    bossKills: {}, // { ボスのid: 倒した回数 }
    fragments: [], // 手に入れたデータ片の id
    achievements: [], // 解除した実績の id
    records: { runs: 0, clears: 0, kills: 0, bestArea: 0, bestStep: 0 },
    tutorialSeen: false, // 最初の操作説明を見たか
    seenDialogues: [], // 自動で出る会話のうち、もう見たものの id（版2で追加）
  };
}

// 古い版のセーブデータを今の形に直す。版が上がったら、ここに1段ずつ足す
//   例：if (data.version === 1) { data.newField = ...; data.version = 2; }
function migrate(data) {
  // 版1 → 版2：会話の既読を足す
  if (data.version === 1) {
    data.seenDialogues = [];
    data.version = 2;
  }
  return data;
}

// 壊れたデータや足りない項目があっても遊べるように、初期値で埋める。読めないデータなら null
function normalize(data) {
  const base = createSave();
  if (!data || typeof data !== 'object' || typeof data.version !== 'number' || data.version > SAVE_VERSION) return null;
  const d = migrate(data);
  return {
    version: SAVE_VERSION,
    materials: { ...base.materials, ...(d.materials ?? {}) },
    upgrades: { ...(d.upgrades ?? {}) },
    weapons: Array.isArray(d.weapons) && d.weapons.length > 0 ? [...new Set(d.weapons)] : base.weapons,
    selected: typeof d.selected === 'string' ? d.selected : base.selected,
    bossKills: { ...(d.bossKills ?? {}) },
    fragments: Array.isArray(d.fragments) ? [...new Set(d.fragments)] : [],
    achievements: Array.isArray(d.achievements) ? [...new Set(d.achievements)] : [],
    records: { ...base.records, ...(d.records ?? {}) },
    tutorialSeen: d.tutorialSeen === true,
    seenDialogues: Array.isArray(d.seenDialogues) ? [...new Set(d.seenDialogues)] : [],
  };
}

function read(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

// セーブ枠ができる前のデータが残っていたら、枠1に移す（枠1が空のときだけ）
export function migrateLegacy(storage) {
  try {
    const raw = storage?.getItem(LEGACY_KEY);
    if (!raw) return;
    if (!storage.getItem(slotKey(1))) storage.setItem(slotKey(1), raw);
    storage.removeItem(LEGACY_KEY);
  } catch {
    // 移せなくても、遊ぶことはできる
  }
}

// その枠のセーブデータ。空（または読めない）なら null
export function loadSlot(storage, slot) {
  return read(storage, slotKey(slot));
}

// 保存できたら true。保存できない環境（プライベートブラウズなど）でも、遊びは続けられる
export function storeSlot(storage, slot, save) {
  try {
    storage?.setItem(slotKey(slot), JSON.stringify(save));
    return !!storage;
  } catch {
    return false;
  }
}

export function deleteSlot(storage, slot) {
  try {
    storage?.removeItem(slotKey(slot));
  } catch {
    // 消せなくても止まらない
  }
}

// セーブ枠の選択画面に出す、全部の枠の中身（空の枠は null）
export function listSlots(storage) {
  migrateLegacy(storage);
  return Array.from({ length: SLOT_COUNT }, (_, i) => loadSlot(storage, i + 1));
}
