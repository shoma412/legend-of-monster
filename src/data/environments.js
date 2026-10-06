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
];
