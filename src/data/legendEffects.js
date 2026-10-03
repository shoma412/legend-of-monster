// レジェンド装備の固有効果（M3 で追加）
// 1件 = { id, ... } の形で足す。
//
// effect の書き方はインプラントと同じ（src/data/implants.js の説明を参照）
export const legendEffects = [
  {
    id: 'zeroday',
    name: 'ゼロデイ',
    desc: '会心が出ると次の攻撃も必ず会心',
    effect: { triggers: [{ on: 'crit', do: 'guaranteeNextCrit' }] },
  },
  {
    id: 'neonhalo',
    name: 'ネオン・ハロー',
    desc: 'ダッシュした場所に3秒間ダメージ床を残す',
    effect: { triggers: [{ on: 'dashMove', do: 'damageFloor', duration: 3, radius: 28, damage: 8, tick: 0.3 }] },
  },
  {
    id: 'blackice',
    name: 'ブラックアイス',
    desc: '冷却状態の敵を倒すと周囲を凍らせる',
    effect: { triggers: [{ on: 'kill', do: 'freezeNearby', ifTarget: 'slowed', radius: 120 }] },
  },
  {
    id: 'overflow',
    name: 'オーバーフロー',
    desc: 'HP満タンのとき攻撃力 +40%',
    effect: { mods: [{ stat: 'attackMul', add: 0.4, when: 'hpFull' }] },
  },
];
