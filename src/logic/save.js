// セーブデータ。隠れ家の進行状況だけを保存する（ラン途中は保存しない）。
// セーブ枠は SLOT_COUNT 個。保存先（storage）は外から渡すので、テストでは偽物を使える。ブラウザでは localStorage を渡す。

export const SAVE_VERSION = 5;
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
    records: { runs: 0, clears: 0, kills: 0, bestMap: 0, bestArea: 0, bestStep: 0 }, // bestMap は版5で追加
    tutorialSeen: false, // 最初の操作説明を見たか
    seenDialogues: [], // 自動で出る会話のうち、もう見たものの id（版2で追加）
    // ここから版3で追加（マップと周回）
    maps: {}, // { マップのid: { clears: クリアした回数, clearedCycle: クリアした最高の周 } }
    cycle: 1, // 選べる最高の周
    selectedMap: 'map1', // マップを選ぶ画面で、最後に選んでいたマップ
    selectedCycle: 1, // 同じく、最後に選んでいた周
    carrySpecies: null, // 持ち込みの種族の id（版4で追加。選んでいなければ null）
    carrySpecies2: null, // 持ち込みの2つ目の枠（版5で追加。恒久強化で枠を増やすと使える）
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
  // 版2 → 版3：マップと周回を足す。オーバーロードを倒したことがあれば、マップ1は完了済みにする（2周目が選べる）
  if (data.version === 2) {
    const cleared = (data.bossKills?.overload ?? 0) > 0;
    data.maps = cleared ? { map1: { clears: Math.max(1, data.records?.clears ?? 1), clearedCycle: 1 } } : {};
    data.cycle = cleared ? 2 : 1;
    data.selectedMap = 'map1';
    data.selectedCycle = 1;
    data.version = 3;
  }
  // 版3 → 版4：持ち込みの種族を足す
  if (data.version === 3) {
    data.carrySpecies = null;
    data.version = 4;
  }
  // 版4 → 版5：持ち込みの2つ目の枠と、記録の「最高到達」のマップを足す
  if (data.version === 4) {
    data.carrySpecies2 = null;
    if (data.records) data.records.bestMap = 0;
    data.version = 5;
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
    maps: Object.fromEntries(Object.entries(d.maps ?? {}).map(([id, m]) => [id, { clears: m?.clears ?? 0, clearedCycle: m?.clearedCycle ?? 0 }])),
    cycle: Number.isInteger(d.cycle) && d.cycle >= 1 ? d.cycle : 1,
    selectedMap: typeof d.selectedMap === 'string' ? d.selectedMap : base.selectedMap,
    selectedCycle: Number.isInteger(d.selectedCycle) && d.selectedCycle >= 1 ? d.selectedCycle : 1,
    carrySpecies: typeof d.carrySpecies === 'string' ? d.carrySpecies : null,
    carrySpecies2: typeof d.carrySpecies2 === 'string' ? d.carrySpecies2 : null,
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
