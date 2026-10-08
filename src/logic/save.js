// セーブデータ。隠れ家の進行状況だけを保存する（ラン途中は保存しない）。
// セーブ枠は SLOT_COUNT 個。保存先（storage）は外から渡すので、テストでは偽物を使える。ブラウザでは localStorage を渡す。
import { upgrades } from '../data/upgrades.js';
import { buildTree, cleanOwned, newTreeSeed, upgradeCounts } from './skillTree.js';

export const SAVE_VERSION = 7;
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
    upgrades: {}, // { 恒久強化のid: 段階 }。スキルツリーで取ったマス（tree.owned）から数える
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
    passes: [], // 持っている通行証（隠しボスを倒したマップの id。版6で追加）
    // スキルツリー（版7で追加）。seed は配置を決める種（セーブデータごとに違う）、owned は取ったマスの id
    tree: { seed: newTreeSeed(), owned: [] },
    notices: [], // 次に隠れ家へ入ったときに、1回だけ出すお知らせ（版7で追加）
    // マップをクリアしたあとの持ち越し（2026-10-08 追加。なければ null）。{ credits, implants: 候補の id, picked: 選んだ id }。次に出撃したら消える
    carryOver: null,
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
  // 版5 → 版6：通行証を足す（隠しボスは新しい要素なので、誰も持っていない状態から始まる）
  if (data.version === 5) {
    data.passes = [];
    data.version = 6;
  }
  // 版6 → 版7：恒久強化がスキルツリーになった。買ってあった強化をすべて外し、使った素材を全部返す
  if (data.version === 6) {
    const refund = refundUpgrades(data.upgrades ?? {});
    data.materials = { ...(data.materials ?? {}) };
    for (const [id, n] of Object.entries(refund)) data.materials[id] = (data.materials[id] ?? 0) + n;
    data.upgrades = {};
    data.tree = { seed: newTreeSeed(), owned: [] };
    data.notices = Object.keys(refund).length > 0 ? ['treeRefund'] : [];
    data.version = 7;
  }
  return data;
}

// スキルツリーにする前の値段で、買ってあった強化に使った素材を数える（{ 素材のid: 個数 }）
export function refundUpgrades(owned) {
  const refund = {};
  for (const def of upgrades) {
    const costs = def.legacyCosts ?? def.costs;
    const level = Math.min(costs.length, owned[def.id] ?? 0);
    for (let i = 0; i < level; i++) for (const [id, n] of Object.entries(costs[i])) refund[id] = (refund[id] ?? 0) + n;
  }
  return refund;
}

// 持ち越しの中身を確かめる。読めなければ null
function normalizeCarryOver(co) {
  if (!co || typeof co !== 'object') return null;
  const strings = (list) => (Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
  return {
    credits: Number.isFinite(co.credits) && co.credits > 0 ? Math.floor(co.credits) : 0,
    implants: [...new Set(strings(co.implants))],
    picked: Array.isArray(co.picked) ? co.picked.map((x) => (typeof x === 'string' ? x : null)) : [],
  };
}

// 壊れたデータや足りない項目があっても遊べるように、初期値で埋める。読めないデータなら null
export function normalizeSave(data) {
  const base = createSave();
  if (!data || typeof data !== 'object' || typeof data.version !== 'number' || data.version > SAVE_VERSION) return null;
  const d = migrate(data);
  // スキルツリー：種が読めなければ作り直す。取ったマスは、手前を取っていないものなどを除く。強化の段数は、取ったマスから数える
  const seed = Number.isInteger(d.tree?.seed) && d.tree.seed >= 0 ? d.tree.seed : newTreeSeed();
  const tree = buildTree(seed);
  const owned = cleanOwned(tree, Array.isArray(d.tree?.owned) ? d.tree.owned : []);
  return {
    version: SAVE_VERSION,
    // 隠しボスの素材（2026-10-08 追加）：足す前にアーキテクトを倒していたデータには、1個渡す（もう一度倒さなくてよい）
    materials: { ...base.materials, ...((d.bossKills?.architect ?? 0) > 0 && d.materials?.architectCore === undefined ? { architectCore: 1 } : {}), ...(d.materials ?? {}) },
    upgrades: upgradeCounts(tree, owned),
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
    passes: Array.isArray(d.passes) ? [...new Set(d.passes)] : [],
    tree: { seed, owned },
    notices: Array.isArray(d.notices) ? d.notices.filter((n) => typeof n === 'string') : [],
    carryOver: normalizeCarryOver(d.carryOver),
  };
}

function read(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? normalizeSave(JSON.parse(raw)) : null;
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
