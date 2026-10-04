// 消耗品（ラン中に拾って使うアイテム）の定義
// 1件 = { id, ... } の形で足す。
//
// color : src/data/theme.js の色名（属性の色も使える）
// icon  : 見た目（src/render/icons.js の ITEM_ICONS）
// use   : 使ったときの効果の部品の名前（src/game/consumables.js の USES）
//   blast : カーソルの位置（range px まで）に投げ、radius の範囲の敵に damage。element の属性つき。stop 秒止める
//   aura  : 自分の周り radius の敵に damage。element の属性つき
//   buff  : duration 秒のあいだ、stat に add を足す
//   smoke : duration 秒のあいだ無敵になり、radius の範囲の敵の弾を消す
export const consumables = [
  {
    id: 'emp', name: 'EMPグレネード', desc: 'カーソルの位置に投げ、範囲内の敵を2秒止める', color: 'shock', icon: 'grenade',
    use: 'blast', range: 340, radius: 115, damage: 15, element: 'shock', stop: 2,
  },
  {
    id: 'incendiary', name: '焼夷グレネード', desc: 'カーソルの位置に投げ、範囲内の敵にダメージと燃焼', color: 'heat', icon: 'grenade',
    use: 'blast', range: 340, radius: 105, damage: 35, element: 'heat',
  },
  {
    id: 'coolant', name: '冷却スプレー', desc: '自分の周りの敵を減速させる', color: 'cold', icon: 'spray',
    use: 'aura', radius: 185, damage: 5, element: 'cold',
  },
  {
    id: 'drug', name: '戦闘ドラッグ', desc: '10秒間、攻撃力 +40%', color: 'magenta', icon: 'syringe',
    use: 'buff', stat: 'attackMul', add: 0.4, duration: 10,
  },
  {
    id: 'smoke', name: '煙幕', desc: '3秒間、無敵になり、近くの敵の弾を消す', color: 'ink', icon: 'cloud',
    use: 'smoke', duration: 3, radius: 100,
  },
];
