// マウスカーソル。ゲームの画面の上にいる間だけ、見やすい点の形にする。
// 絵は、ここでコードで描く（SVG）。暗い縁取りを付けて、明るい背景の上でも見えるようにする。
import { COLORS } from '../data/theme.js';

const SIZE = 16; // 絵の大きさ（px）。真ん中が、指している場所
const DOT = 4; // 点の半径（px）

// 点1つ。color は点の色
function dot(color) {
  const c = SIZE / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`
    + `<circle cx="${c}" cy="${c}" r="${DOT}" fill="${color}" stroke="#07060d" stroke-width="2"/>`
    + '</svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}`;
}

// ゲームの画面（parentId の中の canvas）のカーソルを差し替える。
//   ふだんは水色の点。押せるもの（ボタンなど）の上では、黄色の点（Phaser が cursor: pointer にするので、それを見分ける）
export function installCursor(parentId = 'game') {
  const style = document.createElement('style');
  style.textContent = `
#${parentId} canvas { cursor: ${dot(COLORS.cyan)}, crosshair !important; }
#${parentId} canvas[style*="cursor: pointer"] { cursor: ${dot(COLORS.amber)}, pointer !important; }
`;
  document.head.appendChild(style);
}
