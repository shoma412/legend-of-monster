// エリートの特性（M4 で追加）
// 1件 = { id, ... } の形で足す。
//
// part : 動きの部品の名前（src/game/elite.js の TRAIT_PARTS）
export const eliteTraits = [
  // 倒すと小型の個体に分かれる
  { id: 'split', name: '分裂', part: 'split', count: 2, hpRatio: 0.4, sizeRatio: 0.75 },
  // 一定ダメージまで無効。ratio は最大HPに対する障壁の量
  { id: 'barrier', name: '障壁', part: 'barrier', ratio: 0.5 },
  // 移動と攻撃が速い
  { id: 'haste', name: '加速', part: 'haste', speed: 1.5 },
  // 周りの雑魚を回復する
  { id: 'absorb', name: '吸収', part: 'absorb', interval: 1.5, radius: 190, heal: 10 },
];
