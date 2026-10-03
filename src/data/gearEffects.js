// 装備効果のプール（M3 で追加）
// 1件 = { id, ... } の形で足す。
//
// stat    : 補正するステータスの名前（src/logic/stats.js）
// min/max : 値の範囲。レア度が高いほど max 寄りになる（src/data/balance.js の LOOT.rarities）
// unit    : '%' なら割合（0.05 = 5%）、'' ならそのままの数
// sign    : -1 なら値を引く（被ダメージ −% など）
// kind: 'element' は数値ではなく、電撃／熱／冷却のどれかを攻撃に付ける
// primaryFor : このスロットの装備の1つ目の効果として選ばれやすい（スロットごとの個性）
// requires   : まだ実装していない仕組みが必要な効果。balance の FEATURES で有効になるまで出ない
export const gearEffects = [
  { id: 'attack', label: '攻撃力', stat: 'attackMul', min: 0.05, max: 0.2, unit: '%', primaryFor: ['mod'] },
  { id: 'critChance', label: '会心率', stat: 'critChance', min: 0.03, max: 0.12, unit: '%', primaryFor: ['mod', 'acc'] },
  { id: 'critDamage', label: '会心ダメージ', stat: 'critMul', min: 0.2, max: 0.6, unit: '%', primaryFor: ['mod', 'acc'] },
  { id: 'attackSpeed', label: '攻撃速度', stat: 'attackSpeed', min: 0.05, max: 0.15, unit: '%', primaryFor: ['mod'] },
  { id: 'maxHp', label: '最大HP', stat: 'maxHp', min: 10, max: 40, unit: '', primaryFor: ['armor'] },
  { id: 'moveSpeed', label: '移動速度', stat: 'moveSpeedMul', min: 0.04, max: 0.12, unit: '%', primaryFor: ['armor', 'acc'] },
  { id: 'damageReduce', label: '被ダメージ', stat: 'damageTaken', min: 0.03, max: 0.1, unit: '%', sign: -1, primaryFor: ['armor'] },
  { id: 'element', label: '属性付与', kind: 'element', primaryFor: ['mod'] },
  { id: 'killHeal', label: '撃破時HP回復', stat: 'killHeal', min: 1, max: 4, unit: '', primaryFor: ['armor', 'acc'] },
  { id: 'credit', label: 'クレジット獲得', stat: 'creditMul', min: 0.1, max: 0.3, unit: '%', primaryFor: ['acc'], requires: 'credits' },
];
