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

export const FONTS = {
  display: '"Chakra Petch", "Noto Sans JP", system-ui, sans-serif',
  body: '"Noto Sans JP", system-ui, sans-serif',
};

// '#rrggbb' を Phaser の図形描画で使う数値に直す
export function hex(color) {
  return parseInt(color.slice(1), 16);
}
