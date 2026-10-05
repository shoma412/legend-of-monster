// 会話に出てくる人物（2026-10-06 追加）
// 1件 = { id, ... } の形で足す。
//   name     : 会話の画面に出す名前
//   portrait : 顔イラストの名前（src/render/portraits.js の PORTRAITS）
//   color    : 名前の色（src/data/theme.js の色名）
//   glitch   : true なら、名前をはっきり出さず、記号の並びでごまかして表示する（依頼主）
export const characters = [
  { id: 'jin', name: 'ジン', portrait: 'jin', color: 'cyan' },
  { id: 'noise', name: 'ノイズ', portrait: 'noise', color: 'amber', glitch: true },
  { id: 'hal', name: 'ハル', portrait: 'hal', color: 'green' },
  { id: 'peddler', name: '流れの商人', portrait: 'peddler', color: 'amber' },
  { id: 'machine', name: '壊れかけの保守機', portrait: 'machine', color: 'green' },
  { id: 'scavenger', name: '倒れた回収屋', portrait: 'scavenger', color: 'ice' },
];

// 名前をごまかすときに使う記号と、その文字数
export const GLITCH = { chars: '□▼◯☆◆△▽■●※〓◇▲★', length: 4 };

// 文章の中にこの印を書くと、表示するときに依頼主のごまかした名前に置き換わる（通信ログ、エンディング）
export const NOISE_TAG = '@noise';
