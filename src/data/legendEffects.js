// レジェンド装備の固有効果（M3 で追加）
// 1件 = { id, ... } の形で足す。
//
// effect の書き方はインプラントと同じ（src/data/implants.js の説明を参照）
// mythic: true は、ミシック装備だけに付く固有効果（slot で、付くスロットが決まる）。レジェンドには付かない
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
  // ---- ここから、ミシック専用（2026-10-15） ----
  {
    id: 'chainburst', mythic: true, slot: 'mod',
    name: '連鎖爆轟',
    desc: '攻撃が当たると、25%の確率で爆発（範囲 100、ダメージ 55）',
    effect: { triggers: [{ on: 'hit', do: 'blastTarget', chance: 0.25, radius: 100, damage: 55 }] },
  },
  {
    id: 'overdrive', mythic: true, slot: 'mod',
    name: '限界突破',
    desc: '会心率 +12%、会心ダメージ +60%',
    effect: { mods: [{ stat: 'critChance', add: 0.12 }, { stat: 'critMul', add: 0.6 }] },
  },
  {
    id: 'undying', mythic: true, slot: 'armor',
    name: '不屈',
    desc: '倒れても、出撃ごとに1回、HP 50% で起き上がる（「予備の首」と同じ1回）。被ダメージ −10%',
    effect: { mods: [{ stat: 'revive', add: 0.5 }, { stat: 'damageTaken', add: -0.1 }] },
  },
  {
    id: 'ironwall', mythic: true, slot: 'armor',
    name: '鉄壁',
    desc: '被ダメージ −20%、最大HP +40',
    effect: { mods: [{ stat: 'damageTaken', add: -0.2 }, { stat: 'maxHp', add: 40 }] },
  },
  {
    id: 'overclock', mythic: true, slot: 'acc',
    name: '超過駆動',
    desc: '敵を倒すと、2秒間、攻撃速度 +40%',
    effect: { triggers: [{ on: 'kill', do: 'killBuff', stat: 'attackSpeed', add: 0.4, seconds: 2 }] },
  },
  {
    id: 'phasestep', mythic: true, slot: 'acc',
    name: '位相歩行',
    desc: 'ダッシュの回復 +30%、ダッシュの距離 +20%',
    effect: { mods: [{ stat: 'dashHaste', add: 0.3 }, { stat: 'dashDistance', add: 0.2 }] },
  },
];
