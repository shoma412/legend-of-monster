// ブラウザの localStorage にセーブデータを読み書きする窓口。
// セーブ枠の選択画面で枠を選ぶと、ゲーム中はその枠のデータを共有する。
import { createSave, deleteSlot, listSlots, loadSlot, storeSlot } from '../logic/save.js';

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
  current = loadSlot(storage(), n) ?? createSave();
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

// その枠のセーブデータを消す
export function eraseSlot(n) {
  deleteSlot(storage(), n);
  if (n === slot) current = null;
}
