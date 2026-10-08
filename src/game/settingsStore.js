// 設定をブラウザの localStorage に読み書きする窓口。ゲーム中はここの1つを共有する。
import { DISPLAY_SIZES, loadSettings, storeSettings } from '../logic/settings.js';
import { touch } from './touchInput.js';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let current = null;

export function getSettings() {
  current ??= loadSettings(storage(), { mobile: touch.enabled });
  return current;
}

export function saveSettings() {
  return storeSettings(storage(), getSettings());
}

// フレームレートの上限を反映する（0 は制限なし）。遊んでいる途中でもすぐ変わる
export function applyFrameRate(game) {
  game.loop.setFPSLimit(getSettings().frameRate);
}

// フルスクリーンにできる環境か（アプリに埋め込まれた画面などでは、できないことがある）
export function canFullscreen() {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

export function isFullscreen() {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

// フルスクリーンを切り替える。ゲームの入れ物（#game）ごと画面いっぱいにする。できなかったら false
export async function toggleFullscreen() {
  if (!canFullscreen()) return false;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.getElementById('game').requestFullscreen();
    syncEscapeLock();
    return true;
  } catch {
    return false;
  }
}

// フルスクリーンの間だけ、Esc をゲームが受け取れるようにする（Chrome / Edge の機能。この間は Esc の長押しでフルスクリーンが解ける）。
// 対応していないブラウザでは何もしない（Tab で同じ操作ができる）
export function syncEscapeLock() {
  const keyboard = typeof navigator !== 'undefined' ? navigator.keyboard : null;
  if (!keyboard?.lock) return;
  try {
    if (document.fullscreenElement) keyboard.lock(['Escape']).catch(() => {});
    else keyboard.unlock();
  } catch {
    // 使えない環境では、そのまま
  }
}

// 表示の大きさを反映する。ゲームの入れ物（#game）の大きさを決めると、Phaser がその中いっぱいに合わせる
export function applyDisplaySize(game) {
  const size = DISPLAY_SIZES.find((d) => d.id === getSettings().displaySize) ?? DISPLAY_SIZES[0];
  const parent = document.getElementById('game');
  if (!parent) return;
  // フルスクリーン中は、選んだ大きさに関係なく画面いっぱいにする
  const full = !!document.fullscreenElement;
  parent.style.width = size.width && !full ? `${size.width}px` : '100%';
  parent.style.height = size.height && !full ? `${size.height}px` : '100%';
  game.scale.refresh();
}
