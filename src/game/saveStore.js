// ブラウザの localStorage にセーブデータを読み書きする窓口。ゲーム中はここの1つのデータを共有する。
import { SAVE_KEY, loadSave, storeSave } from '../logic/save.js';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null; // 保存できない環境でも遊べるようにする
  }
}

let current = null;

export function getSave() {
  current ??= loadSave(storage());
  return current;
}

export function persist() {
  return storeSave(storage(), getSave());
}

// セーブデータを消して最初からにする
export function resetSave() {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    // 消せなくても、次に読み込むデータを空にすれば同じこと
  }
  current = null;
  return getSave();
}
