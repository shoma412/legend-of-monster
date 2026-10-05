// 会話に出す顔イラスト。64×64 のドット絵を、コードで1ドットずつ塗って作る（外部素材は使わない）。
//   portraitGrid(id, mood) : 色の並び（64×64。何もないところは null）
//   ensurePortrait(scene, id, mood) : Phaser で表示できる画像にして、その名前を返す
// 人物を足すときは、下の PORTRAITS に描く関数を1つ足す。

export const PORTRAIT_SIZE = 64;
const N = PORTRAIT_SIZE;
const OUTLINE = '#05060c';

// 材質ごとの4段階の色（ハイライト・明・中・暗）
const MAT = {
  skin: ['#ffe2c8', '#f2c7a5', '#d9a07e', '#a86f5a'],
  skin2: ['#f0c8a4', '#e0b08a', '#bd8763', '#8a5a44'],
  metal: ['#dfe6fa', '#aab6d6', '#6e7aa0', '#3d4566'],
  rust: ['#d9a070', '#b0683c', '#7a4428', '#4a2a1c'],
  hairTeal: ['#8ff5e6', '#3fd6c8', '#1f8f93', '#12505e'],
  hairOrange: ['#ffd98a', '#ffb347', '#e07a2a', '#9a4a1c'],
  hood: ['#7a5ab0', '#5a3f8a', '#3a2860', '#20163a'],
  jacket: ['#55629a', '#3a4470', '#252c4e', '#141830'],
  overall: ['#6fa67c', '#4f7f5a', '#35573f', '#1f3527'],
  cloak: ['#a08a5a', '#7a6640', '#54452a', '#30281a'],
  scarf: ['#e06a6a', '#b04444', '#7a2c34', '#4a1a22'],
  helmet: ['#8a94a8', '#5c6678', '#3a4252', '#20262e'],
};

const makeGrid = () => Array.from({ length: N }, () => Array(N).fill(null));

// 左上から光が当たっているように、形の中の位置で明暗を決める（境目は市松模様でぼかす）
function tone(nx, ny, x, y) {
  const l = -nx * 0.55 - ny * 0.6;
  const d = (x + y) % 2 === 0;
  if (l > 0.72 || (l > 0.62 && d)) return 0;
  if (l > 0.3 || (l > 0.2 && d)) return 1;
  if (l < -0.45 || (l < -0.33 && d)) return 3;
  return 2;
}

function ellipse(g, cx, cy, rx, ry, mat, clip) {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      if (clip && !clip(x, y)) continue;
      g[y][x] = MAT[mat][tone(nx, ny, x, y)];
    }
  }
}

function rect(g, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (g[y]?.[x] !== undefined) g[y][x] = color;
}

function rectMat(g, x0, y0, w, h, mat) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (g[y]?.[x] === undefined) continue;
      g[y][x] = MAT[mat][tone((x - x0 - w / 2) / (w / 2), (y - y0 - h / 2) / (h / 2), x, y)];
    }
  }
}

function px(g, x, y, c) {
  if (g[y]?.[x] !== undefined) g[y][x] = c;
}

function line(g, x0, y0, x1, y1, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) px(g, Math.round(x0 + ((x1 - x0) * i) / (steps || 1)), Math.round(y0 + ((y1 - y0) * i) / (steps || 1)), c);
}

// 塗ったところのまわりを、暗い色で縁取る
function outline(g) {
  const out = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      if (g[y - 1]?.[x] || g[y + 1]?.[x] || g[y][x - 1] || g[y][x + 1]) out.push([x, y]);
    }
  }
  for (const [x, y] of out) g[y][x] = OUTLINE;
  return g;
}

// ---- 人物ごとの絵 ----

// ジン（主人公）：左が人、右が機械
function jin(mood) {
  const g = makeGrid();
  const H = MAT.hairTeal;
  const M = MAT.metal;
  const S = MAT.skin;
  // 肩と上着（襟にネオンの縁取り）
  ellipse(g, 32, 68, 27, 15, 'jacket');
  line(g, 23, 55, 31, 63, '#ff3df0'); line(g, 41, 55, 33, 63, '#ff3df0');
  line(g, 24, 55, 32, 63, '#a02a9a'); line(g, 40, 55, 32, 63, '#a02a9a');
  rect(g, 9, 58, 1, 6, '#2af6ff'); rect(g, 54, 58, 1, 6, '#2af6ff');
  rect(g, 46, 59, 5, 3, '#141830'); rect(g, 47, 60, 3, 1, '#ffe14a');
  // 首（右半分は機械）
  rectMat(g, 26, 46, 7, 10, 'skin2'); rectMat(g, 33, 46, 6, 10, 'metal');
  for (let y = 48; y < 56; y += 2) rect(g, 33, y, 6, 1, M[3]);
  rect(g, 26, 46, 7, 2, MAT.skin2[3]);
  // 顔
  ellipse(g, 32, 33, 14.5, 17, 'skin', (x) => x < 35);
  ellipse(g, 32, 33, 14.5, 17, 'metal', (x) => x >= 35);
  for (let y = 16; y < 51; y++) if (g[y][35]) px(g, 35, y, y % 4 === 0 ? M[3] : '#2af6ff');
  // 機械側：装甲の継ぎ目、ボルト、あごの排気口
  line(g, 37, 40, 45, 38, M[3]); line(g, 38, 44, 43, 43, M[3]);
  rect(g, 38, 46, 1, 2, M[3]); rect(g, 40, 46, 1, 2, M[3]); rect(g, 42, 45, 1, 2, M[3]);
  px(g, 44, 28, M[0]); px(g, 45, 36, M[0]); px(g, 39, 22, M[0]);
  // 髪（とがった前髪、明るい筋）
  ellipse(g, 32, 19, 17, 11, 'hairTeal');
  ellipse(g, 17, 28, 4, 10, 'hairTeal');
  ellipse(g, 46, 22, 4, 6, 'hairTeal');
  const spikes = [[18, 26, 5], [23, 28, 6], [29, 27, 5], [35, 26, 4], [40, 24, 3]];
  for (const [sx, sy, len] of spikes) {
    for (let i = 0; i < len; i++) { px(g, sx + i, sy + i, H[1]); px(g, sx + i + 1, sy + i, H[2]); px(g, sx + i + 2, sy + i, H[3]); }
  }
  line(g, 20, 13, 26, 10, H[0]); line(g, 28, 11, 36, 9, H[0]); line(g, 22, 17, 30, 15, H[0]);
  line(g, 38, 14, 44, 17, H[3]); line(g, 34, 20, 42, 22, H[3]);
  // 人の目
  rect(g, 22, 34, 8, 4, '#f5f7ff'); rect(g, 25, 34, 4, 4, '#1c5f7a'); rect(g, 26, 35, 2, 2, '#0a1420'); px(g, 25, 34, '#bfefff');
  rect(g, 21, 33, 10, 1, '#2a1a22'); px(g, 21, 34, '#2a1a22'); px(g, 30, 34, '#2a1a22');
  rect(g, 22, 38, 8, 1, S[3]);
  // 機械の目の枠
  rect(g, 38, 32, 8, 7, '#0a1420'); rect(g, 37, 33, 1, 5, M[3]); rect(g, 46, 33, 1, 5, M[3]);
  // 耳と通信機
  rectMat(g, 16, 33, 3, 7, 'skin2'); px(g, 17, 36, MAT.skin2[3]);
  rect(g, 47, 31, 3, 9, M[2]); rect(g, 48, 32, 1, 7, M[3]); line(g, 49, 30, 51, 24, '#ffe14a'); px(g, 51, 23, '#fff6c0');
  // 鼻、頬
  line(g, 32, 37, 31, 42, S[3]); px(g, 32, 43, S[3]); px(g, 30, 43, S[2]);
  rect(g, 21, 41, 3, 1, '#e8a08a'); rect(g, 22, 42, 2, 1, '#e8a08a');
  // 表情（眉・機械の目の色・口）
  if (mood === 'angry') {
    line(g, 21, 29, 30, 32, H[3]); line(g, 21, 30, 30, 33, H[3]);
    line(g, 38, 31, 46, 28, '#ff4a5a');
    rect(g, 39, 34, 6, 3, '#ff4a5a'); rect(g, 41, 35, 2, 1, '#ffd0d0');
    rect(g, 26, 46, 8, 1, '#5a2a2a'); rect(g, 27, 47, 6, 1, '#f5f7ff'); px(g, 25, 47, '#5a2a2a'); px(g, 34, 46, M[3]);
  } else {
    rect(g, 21, 30, 9, 1, H[3]); rect(g, 22, 29, 7, 1, H[3]);
    rect(g, 39, 34, 6, 3, '#2af6ff'); rect(g, 41, 35, 2, 1, '#e8ffff'); px(g, 39, 34, '#0e8f9a'); px(g, 44, 36, '#0e8f9a');
    rect(g, 27, 46, 7, 1, '#7a4038'); px(g, 26, 45, '#7a4038'); px(g, 34, 46, M[3]);
  }
  return outline(g);
}

// ノイズ（依頼主）：フードの奥が画面になっている
function noise() {
  const g = makeGrid();
  const D = MAT.hood;
  ellipse(g, 32, 70, 29, 18, 'hood');
  ellipse(g, 32, 31, 21, 25, 'hood');
  line(g, 14, 30, 17, 46, D[3]); line(g, 49, 26, 47, 44, D[3]); line(g, 20, 12, 26, 8, D[0]); line(g, 12, 58, 20, 54, D[3]);
  // 画面（角の丸い四角、走査線）
  for (let y = 16; y < 52; y++) {
    for (let x = 16; x < 49; x++) {
      const v = ((x - 32) / 14.5) ** 4 + ((y - 34) / 16.5) ** 4;
      if (v > 1) continue;
      g[y][x] = v > 0.78 ? '#1b1230' : y % 2 === 0 ? '#0e2619' : '#07140e';
    }
  }
  // 画面の目と、口の波形
  rect(g, 22, 30, 7, 3, '#ffe14a'); rect(g, 36, 30, 7, 3, '#ffe14a');
  rect(g, 22, 29, 7, 1, '#a8842a'); rect(g, 36, 29, 7, 1, '#a8842a'); px(g, 23, 31, '#fff6c0'); px(g, 37, 31, '#fff6c0');
  const wave = [0, 0, -1, 1, -2, 2, -3, 3, -2, 2, -1, 1, 0, -1, 1, 0, 0];
  wave.forEach((d, i) => { px(g, 24 + i, 42 + d, '#36ff9a'); if (d !== 0) px(g, 24 + i, 42, '#1c7a4c'); });
  // 画面の隅の表示
  px(g, 21, 22, '#36ff9a'); px(g, 23, 22, '#1c7a4c'); px(g, 25, 22, '#1c7a4c'); rect(g, 38, 22, 5, 1, '#1c7a4c');
  rect(g, 21, 47, 3, 1, '#ff3df0'); rect(g, 40, 47, 3, 1, '#2af6ff');
  // 首もとのケーブル
  for (let y = 53; y < N; y++) { px(g, 26, y, '#ff3df0'); px(g, 27, y, '#7a1f74'); px(g, 37, y, '#2af6ff'); px(g, 38, y, '#0e7a82'); }
  rect(g, 30, 56, 4, 3, '#141830'); px(g, 31, 57, '#ffe14a');
  return outline(g);
}

// ハル（整備士）：ゴーグル、結んだ髪
function hal() {
  const g = makeGrid();
  const S = MAT.skin;
  const O = MAT.hairOrange;
  const M = MAT.metal;
  ellipse(g, 32, 69, 27, 16, 'overall');
  rect(g, 22, 56, 3, 8, '#ffe14a'); rect(g, 39, 56, 3, 8, '#ffe14a'); rect(g, 22, 56, 1, 8, '#a8842a'); rect(g, 39, 56, 1, 8, '#a8842a');
  rect(g, 44, 60, 6, 4, '#1f3527'); line(g, 45, 59, 47, 55, M[1]);
  rectMat(g, 27, 46, 10, 10, 'skin2'); rect(g, 27, 46, 10, 2, MAT.skin2[3]);
  ellipse(g, 32, 34, 14.5, 16, 'skin');
  ellipse(g, 32, 21, 17, 11, 'hairOrange');
  ellipse(g, 50, 27, 5, 7, 'hairOrange');
  ellipse(g, 16, 30, 3, 8, 'hairOrange');
  line(g, 20, 14, 28, 11, O[0]); line(g, 30, 12, 38, 12, O[0]); line(g, 40, 16, 46, 20, O[3]);
  rect(g, 15, 23, 35, 4, '#252c4e'); rect(g, 15, 23, 35, 1, '#3a4470');
  rectMat(g, 19, 20, 10, 9, 'metal'); rectMat(g, 35, 20, 10, 9, 'metal');
  rect(g, 21, 22, 6, 5, '#2af6ff'); rect(g, 37, 22, 6, 5, '#2af6ff');
  rect(g, 21, 22, 3, 2, '#e8ffff'); rect(g, 37, 22, 3, 2, '#e8ffff'); rect(g, 25, 25, 2, 2, '#0e8f9a'); rect(g, 41, 25, 2, 2, '#0e8f9a');
  rect(g, 29, 23, 6, 2, M[3]);
  // 目（笑っている）と眉
  for (const ex of [22, 36]) { rect(g, ex + 1, 35, 5, 1, '#2a1a22'); px(g, ex, 36, '#2a1a22'); px(g, ex + 6, 36, '#2a1a22'); rect(g, ex + 1, 34, 5, 1, S[3]); }
  line(g, 22, 32, 28, 31, O[3]); line(g, 36, 31, 42, 32, O[3]);
  // 鼻・口・そばかす・頬の油汚れ
  line(g, 32, 37, 31, 41, S[3]); px(g, 32, 42, S[3]);
  rect(g, 26, 44, 12, 1, '#7a4038'); rect(g, 27, 45, 10, 2, '#f5f7ff'); rect(g, 28, 47, 8, 1, '#7a4038'); px(g, 25, 43, '#7a4038'); px(g, 38, 43, '#7a4038');
  px(g, 31, 45, '#c8ccd8'); px(g, 34, 45, '#c8ccd8');
  for (const [fx, fy] of [[22, 40], [24, 41], [21, 42], [40, 40], [42, 41]]) px(g, fx, fy, S[3]);
  rect(g, 39, 42, 3, 2, '#3a4470'); px(g, 42, 43, '#3a4470'); px(g, 40, 44, '#3a4470');
  rect(g, 20, 41, 3, 1, '#f0a090');
  rectMat(g, 16, 34, 3, 6, 'skin2'); px(g, 17, 40, '#2af6ff');
  return outline(g);
}

// 流れの商人：つばの広い帽子、口もとを隠す布、片目のレンズ
function peddler() {
  const g = makeGrid();
  const C = MAT.cloak;
  const S = MAT.skin2;
  ellipse(g, 32, 70, 28, 18, 'cloak');
  line(g, 20, 56, 26, 63, C[3]); line(g, 44, 56, 38, 63, C[3]);
  rectMat(g, 27, 44, 10, 10, 'skin2');
  ellipse(g, 32, 34, 13, 15, 'skin2');
  // 口もとの布
  ellipse(g, 32, 45, 15, 8, 'scarf', (x, y) => y >= 40);
  line(g, 20, 44, 44, 44, MAT.scarf[3]); line(g, 22, 48, 42, 48, MAT.scarf[3]);
  rectMat(g, 40, 48, 6, 12, 'scarf');
  // 帽子（つば、山、帯）
  ellipse(g, 32, 24, 26, 6, 'cloak');
  ellipse(g, 32, 17, 14, 11, 'cloak', (x, y) => y <= 23);
  rect(g, 19, 20, 27, 3, '#30281a'); rect(g, 30, 20, 4, 3, '#ffe14a');
  line(g, 8, 25, 56, 25, C[3]);
  // 目：片方は人、片方は光るレンズ
  rect(g, 22, 33, 7, 3, '#f5f7ff'); rect(g, 25, 33, 3, 3, '#2a1a22'); rect(g, 21, 32, 9, 1, '#2a1a22');
  rect(g, 35, 31, 9, 7, '#20163a'); rect(g, 36, 32, 7, 5, '#ffc23a'); rect(g, 37, 33, 3, 2, '#fff6c0'); rect(g, 41, 35, 2, 2, '#a8842a');
  line(g, 44, 34, 47, 33, '#3d4566');
  line(g, 31, 36, 30, 40, S[3]);
  line(g, 21, 29, 28, 30, S[3]);
  // 首から下げた品
  px(g, 30, 58, '#2af6ff'); px(g, 31, 59, '#2af6ff'); px(g, 30, 60, '#e8ffff'); rect(g, 24, 60, 2, 2, '#ff3df0');
  return outline(g);
}

// 壊れかけの保守機：四角い頭、ひびの入った片目、曲がったアンテナ、錆
function machine() {
  const g = makeGrid();
  const M = MAT.metal;
  const R = MAT.rust;
  rectMat(g, 12, 52, 40, 14, 'metal');
  rect(g, 12, 52, 40, 1, M[3]); rect(g, 18, 56, 6, 4, R[2]); rect(g, 40, 58, 8, 3, R[3]);
  rectMat(g, 27, 45, 10, 8, 'metal');
  for (let y = 46; y < 53; y += 2) rect(g, 27, y, 10, 1, M[3]);
  // 頭
  rectMat(g, 13, 14, 38, 32, 'metal');
  rect(g, 13, 14, 38, 1, M[0]); rect(g, 13, 45, 38, 1, M[3]);
  // 錆とへこみ
  rect(g, 14, 36, 7, 6, R[2]); rect(g, 15, 37, 4, 3, R[1]); rect(g, 44, 16, 5, 4, R[2]); px(g, 46, 20, R[3]); px(g, 20, 42, R[3]);
  line(g, 40, 22, 48, 30, M[3]); line(g, 41, 22, 49, 30, R[3]);
  // 目：左は点いている、右はひびが入って消えかけ
  rect(g, 18, 22, 11, 9, '#0a1420'); rect(g, 20, 24, 7, 5, '#5dffa0'); rect(g, 21, 25, 3, 2, '#e8ffe8');
  rect(g, 35, 22, 11, 9, '#0a1420'); rect(g, 37, 24, 7, 5, '#1c5a3a');
  line(g, 36, 23, 44, 30, '#0a1420'); line(g, 44, 23, 40, 27, '#0a1420'); px(g, 39, 26, '#5dffa0');
  // 口（スピーカーの格子）
  rect(g, 22, 36, 20, 6, '#0a1420');
  for (let x = 24; x < 41; x += 3) rect(g, x, 37, 1, 4, M[2]);
  // 曲がったアンテナと、ボルト
  line(g, 20, 13, 20, 7, M[1]); line(g, 20, 7, 25, 3, M[1]); px(g, 26, 2, '#ff4d5e');
  for (const [bx, by] of [[15, 16], [48, 16], [15, 43], [48, 43]]) px(g, bx, by, M[0]);
  // 垂れたケーブル
  line(g, 51, 30, 55, 40, '#ff3df0'); line(g, 55, 40, 53, 50, '#ff3df0');
  return outline(g);
}

// 倒れた回収屋：ひびの入ったバイザーのヘルメット、呼吸マスク
function scavenger() {
  const g = makeGrid();
  const Hm = MAT.helmet;
  ellipse(g, 32, 70, 27, 17, 'jacket');
  rect(g, 14, 58, 6, 3, '#ffc23a'); rect(g, 44, 60, 5, 2, '#141830');
  rectMat(g, 27, 46, 10, 9, 'helmet');
  ellipse(g, 32, 31, 17, 19, 'helmet');
  line(g, 17, 22, 47, 22, Hm[3]); rect(g, 30, 12, 4, 10, Hm[0]);
  // バイザー（暗いガラス、ひび、消えかけの光）
  for (let y = 25; y < 36; y++) {
    for (let x = 18; x < 47; x++) {
      const v = ((x - 32) / 14) ** 4 + ((y - 30) / 5.5) ** 4;
      if (v <= 1) g[y][x] = v > 0.75 ? '#10141c' : y % 2 === 0 ? '#1a2a3a' : '#142230';
    }
  }
  line(g, 36, 25, 41, 30, '#8fd8ff'); line(g, 41, 30, 38, 35, '#8fd8ff'); line(g, 41, 30, 45, 31, '#8fd8ff');
  rect(g, 22, 29, 5, 2, '#ff4d5e'); px(g, 23, 29, '#ffd0d0');
  rect(g, 20, 26, 8, 1, '#2a3e52');
  // 呼吸マスクと管
  rectMat(g, 25, 38, 14, 9, 'helmet');
  rect(g, 27, 40, 10, 5, '#10141c');
  for (let x = 28; x < 37; x += 2) rect(g, x, 41, 1, 3, Hm[1]);
  line(g, 25, 43, 19, 50, Hm[3]); line(g, 39, 43, 45, 50, Hm[3]); line(g, 19, 50, 19, 58, Hm[2]); line(g, 45, 50, 45, 58, Hm[2]);
  // 傷
  line(g, 20, 14, 24, 19, Hm[3]); line(g, 44, 16, 41, 20, Hm[3]);
  px(g, 47, 30, '#ffc23a'); px(g, 48, 30, '#ffc23a');
  return outline(g);
}

const PORTRAITS = { jin, noise, hal, peddler, machine, scavenger };

export function hasPortrait(id) {
  return id in PORTRAITS;
}

// 顔の色の並び（64×64）。mood は表情（normal / angry など。その表情を持たない人物は normal と同じ）
export function portraitGrid(id, mood = 'normal') {
  return PORTRAITS[id](mood);
}

// Phaser の画像として登録し、その名前を返す（同じ顔は1回だけ作る）
export function ensurePortrait(scene, id, mood = 'normal') {
  const key = `portrait:${id}:${mood}`;
  if (scene.textures.exists(key)) return key;
  const grid = portraitGrid(id, mood);
  const texture = scene.textures.createCanvas(key, N, N);
  const ctx = texture.getContext();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!grid[y][x]) continue;
      ctx.fillStyle = grid[y][x];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  texture.refresh();
  texture.setFilter(1); // 拡大してもドットをぼかさない（1 = Phaser の NEAREST）
  return key;
}
