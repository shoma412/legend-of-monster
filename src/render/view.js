// 画質（描画の細かさ）。ゲームの中の座標はいつも 960×540 のまま、描く先の画面だけを倍の細かさにする。
//   画質「高」= 2倍。キャンバスを 1920×1080 で作り、カメラを2倍に拡大して同じ範囲を映す。
import { SCREEN } from '../data/balance.js';

let scale = 1;

// 起動時に1回だけ決める（途中で変えるには再読み込みが必要）
export function setRenderScale(value) {
  scale = value;
}

export function renderScale() {
  return scale;
}

// 各画面の最初に呼ぶ。カメラを画質の倍率に合わせる
export function setupView(scene) {
  const cam = scene.cameras.main;
  cam.setZoom(scale);
  cam.centerOn(SCREEN.width / 2, SCREEN.height / 2);
  scene.viewBase = { x: cam.scrollX, y: cam.scrollY };
}

// 画面を揺らす（dx, dy は 960×540 の座標での量）
export function shakeView(scene, dx, dy) {
  scene.cameras.main.setScroll(scene.viewBase.x + dx, scene.viewBase.y + dy);
}
