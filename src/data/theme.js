// 色とフォント。試作版（docs/試作版.html）の配色を引き継ぐ。

export const COLORS = {
  void: '#07060d',
  panel: '#110f1d',
  line: '#2a2546',
  ink: '#e9e6ff',
  dim: '#8a84ad',
  cyan: '#2ef2ff',
  magenta: '#ff2bd6',
  amber: '#ffc23a',
  red: '#ff4d5e',
  green: '#5dffa0',
  ice: '#8fd8ff',
};

export const ELEMENT_COLORS = {
  shock: '#fff36b',
  heat: '#ff7a3d',
  cold: '#8fd8ff',
};

export const RARITY_COLORS = {
  common: '#c9c5e6',
  rare: '#2ef2ff',
  epic: '#c77dff',
  legend: '#ffc23a',
};

// エリアごとの床と壁の色（エリアの定義の theme で選ぶ）
export const AREA_THEMES = {
  slum: { floor: 0x0b0914, grid: 0x785aff, wall: 0x16122a, edge: '#ff2bd6' },
  plant: { floor: 0x08101a, grid: 0x4fb8ff, wall: 0x101e30, edge: '#8fd8ff' },
  tower: { floor: 0x120a0a, grid: 0xff7a3d, wall: 0x241414, edge: '#ffc23a' },
  sewer: { floor: 0x07100e, grid: 0x3fae7a, wall: 0x0f1f1a, edge: '#5dffa0' },
  tank: { floor: 0x060d16, grid: 0x3a8fd0, wall: 0x0d1a2b, edge: '#4fb8ff' },
  filter: { floor: 0x100a14, grid: 0xb05ad0, wall: 0x1e1226, edge: '#ff2bd6' },
  hideout: { floor: 0x0d0b16, grid: 0x785aff, wall: 0x16122a, edge: '#2ef2ff' },
};

export const FONTS = {
  // 古い端末の画面のようなドット文字。DotGothic16 に無い字だけ Noto Sans JP で補う
  display: '"DotGothic16", "Noto Sans JP", system-ui, sans-serif',
  body: '"DotGothic16", "Noto Sans JP", system-ui, sans-serif',
};

// '#rrggbb' を Phaser の図形描画で使う数値に直す
export function hex(color) {
  return parseInt(color.slice(1), 16);
}
