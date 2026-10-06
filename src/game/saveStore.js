// ブラウザの localStorage にセーブデータを読み書きする窓口。
// セーブ枠の選択画面で枠を選ぶと、ゲーム中はその枠のデータを共有する。
import { createSave, deleteSlot, listSlots, loadSlot, storeSlot } from '../logic/save.js';
import { deleteSuspend, loadSuspend, restoreRun, snapshotRun, storeSuspend, suspendSummary } from '../logic/suspend.js';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null; // 保存できない環境でも遊べるようにする
  }
}

let slot = 1; // 今遊んでいるセーブ枠（1 から）
let current = null;

// セーブ枠の一覧（空の枠は null）
export function getSlots() {
  return listSlots(storage());
}

// その枠で遊ぶ。空の枠なら、新しいデータで始める
export function selectSlot(n) {
  slot = n;
  const loaded = loadSlot(storage(), n);
  current = loaded ?? createSave();
  // 読み込んだデータは、今の形に直した状態ですぐ保存し直す（版が上がったときの変換や、スキルツリーの配置が、次に開いたときに変わらないように）
  if (loaded) storeSlot(storage(), n, current);
  return current;
}

export function currentSlot() {
  return slot;
}

export function getSave() {
  if (!current) {
    listSlots(storage()); // 古い形のセーブデータがあれば、枠1に移す
    selectSlot(slot);
  }
  return current;
}

export function persist() {
  return storeSlot(storage(), slot, getSave());
}

// ---- 中断セーブ（枠ごとに1つ） ----

// 今のランを、今の枠の中断データとして保存する。保存できたら true
export function saveSuspend(run, world) {
  return storeSuspend(storage(), slot, snapshotRun(run, world));
}

// セーブ枠の選択画面に出す、中断した場所の文（中断データがなければ null）
export function suspendText(n) {
  return suspendSummary(loadSuspend(storage(), n));
}

// 今の枠の中断データからランを作り直す。取り出した時点で、中断データは消える。なければ（再開できなければ）null
export function takeSuspendedRun() {
  const data = loadSuspend(storage(), slot);
  if (!data) return null;
  deleteSuspend(storage(), slot);
  return restoreRun(data, getSave());
}

// 読み込んだセーブデータを、その枠に入れる（上書き）。その枠の中断データは消す。保存できたら true
export function importToSlot(n, save) {
  const ok = storeSlot(storage(), n, save);
  if (ok) {
    deleteSuspend(storage(), n);
    if (n === slot) current = null;
  }
  return ok;
}

// その枠のセーブデータを消す（中断データも一緒に消す）
export function eraseSlot(n) {
  deleteSlot(storage(), n);
  deleteSuspend(storage(), n);
  if (n === slot) current = null;
}
