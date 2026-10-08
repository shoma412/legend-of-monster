// 環境の定義（2026-10-07 追加）。そのマップの「すべての部屋」に効く決まり。
// 一部の戦闘部屋にだけ付く「部屋の仕掛け」（src/data/gimmicks.js）とは別物。
// どのマップに付けるかは、マップの定義（src/data/maps.js）の environment に書く。1件 = { id, ... } の形で足す。
//
// dark: true のとき（暗闇）：
//   vision   : プレイヤーのまわりの、見える円の半径（px）
//   darkness : 暗い場所の暗さ（0〜1。1 に近いほど真っ暗）
//   soft     : 見える円の縁の、ぼかしの幅（円の半径に対する割合）
//   lamps    : 非常灯。count 本（戦闘のある部屋だけ）、trigger px まで近づくと点き、duration 秒のあいだ radius px を照らす
//   flash    : 攻撃が当たった瞬間の光。radius px を life 秒だけ照らす
//   blind    : 目くらみ。見える円が scale 倍になる時間（秒）
//
// rain: true のとき（酸の雨）：
//   cycle  : 雨の周期（秒）。clear 秒の晴れ → warn 秒の予告 → rain 秒の雨、をくり返す（戦闘の間だけ）
//   roofs  : 屋根。count か所（戦闘のある部屋だけ）、大きさは w × h（px）
//   damage : 雨の間、屋根の外にいると、tick 秒ごとに amount のダメージ（これで倒れることはない）
export const environments = [
  {
    id: 'dark',
    name: '暗闇',
    dark: true,
    vision: 190,
    darkness: 0.94,
    soft: 0.28,
    lamps: { count: { min: 2, max: 3 }, trigger: 62, duration: 10, radius: 150 },
    flash: { radius: 95, life: 0.3 },
    blind: { scale: 0.55, duration: 4 },
  },
  {
    id: 'acidrain',
    name: '酸の雨',
    rain: true,
    cycle: { clear: 13, warn: 2, rain: 5 },
    roofs: { count: { min: 2, max: 3 }, w: 176, h: 124 },
    damage: { tick: 0.6, amount: 6 },
  },
];
