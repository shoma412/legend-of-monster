// インプラントの定義（M3 で追加）
// 1件 = { id, ... } の形で足す。
//
// effect は装備効果・レジェンド固有効果と共通の形で、2種類の書き方だけを使う
//   mods     : ステータス補正。{ stat, add, when } … when を書くと条件を満たす間だけ効く
//              when: hpBelowHalf / hpFull / recentDash（window 秒以内にダッシュした）/ targetSlowed（相手が減速中）
//   triggers : イベントで発動する効果。{ on, do, ... }
//              on: hit（攻撃が当たった）/ crit / kill / hurt（被弾）/ dashMove（ダッシュ中）
//              do: 発動する効果の部品の名前（src/game/effects.js の ACTIONS）
//              ifElement: その属性の攻撃のときだけ / ifTarget: slowed, burning の相手のときだけ / chance: 確率
//   element  : 攻撃に属性を付ける（shock / heat / cold）
// stack: true は何度でも選べる（重ねがけ）
// requires: まだ実装していない仕組みが必要なもの。balance の FEATURES で有効になるまで選択肢に出ない
export const implants = [
  // ---- 電撃 ----
  {
    id: 'chain', family: 'shock', name: '連鎖放電', desc: '撃破時、近くの敵2体に電撃',
    effect: { triggers: [{ on: 'kill', do: 'chainLightning', count: 2, range: 170, damage: 18 }] },
  },
  {
    id: 'overcurrent', family: 'shock', name: '過電流', desc: '電撃属性の攻撃が20%の確率で敵を0.5秒止める',
    effect: { triggers: [{ on: 'hit', do: 'stun', ifElement: 'shock', chance: 0.2, duration: 0.5 }] },
  },
  {
    id: 'shockdash', family: 'shock', name: '雷撃ダッシュ', desc: 'ダッシュの通り道にいる敵に電撃ダメージ',
    effect: { triggers: [{ on: 'dashMove', do: 'dashDamage', element: 'shock', damage: 20, radius: 26 }] },
  },
  // ---- 熱 ----
  {
    id: 'incendiary', family: 'heat', name: '焼却弾', desc: '攻撃に熱属性を付与し、3秒間の継続ダメージ',
    effect: { element: 'heat' },
  },
  {
    id: 'thermal', family: 'heat', name: '熱暴走', desc: 'HPが50%以下のとき攻撃力 +35%',
    effect: { mods: [{ stat: 'attackMul', add: 0.35, when: 'hpBelowHalf' }] },
  },
  {
    id: 'blast', family: 'heat', name: '爆炎処理', desc: '燃えている敵を倒すと小爆発',
    effect: { triggers: [{ on: 'kill', do: 'explode', ifTarget: 'burning', element: 'heat', radius: 75, damage: 25 }] },
  },
  // ---- 冷却 ----
  {
    id: 'coolant', family: 'cold', name: '冷却コア', desc: '攻撃に冷却属性を付与し、敵を40%減速',
    effect: { element: 'cold' },
  },
  {
    id: 'frostarmor', family: 'cold', name: '氷結装甲', desc: '被弾したとき周囲の敵を減速させる',
    effect: { triggers: [{ on: 'hurt', do: 'slowNearby', radius: 150 }] },
  },
  {
    id: 'icebreaker', family: 'cold', name: '砕氷', desc: '減速中の敵への会心率 +25%',
    effect: { mods: [{ stat: 'critChance', add: 0.25, when: 'targetSlowed' }] },
  },
  // ---- 汎用 ----
  {
    id: 'overclock', family: 'general', name: 'オーバークロック', desc: '攻撃力 +20%', stack: true,
    effect: { mods: [{ stat: 'attackMul', add: 0.2 }] },
  },
  {
    id: 'muscle', family: 'general', name: '人工筋繊維', desc: '移動速度 +15%', stack: true,
    effect: { mods: [{ stat: 'moveSpeedMul', add: 0.15 }] },
  },
  {
    id: 'plating', family: 'general', name: '装甲プレート', desc: '最大HP +25、全回復', stack: true, onAcquire: 'fullHeal',
    effect: { mods: [{ stat: 'maxHp', add: 25 }] },
  },
  {
    id: 'adrenaline', family: 'general', name: 'アドレナリン回路', desc: 'ダッシュ後2秒間 攻撃力 +50%',
    effect: { mods: [{ stat: 'attackMul', add: 0.5, when: 'recentDash', window: 2 }] },
  },
  {
    id: 'blade', family: 'general', name: '拡張ブレード', desc: '近接範囲 +25%／矢が1体貫通',
    effect: { mods: [{ stat: 'meleeRange', add: 0.25 }, { stat: 'pierce', add: 1 }] },
  },
  {
    id: 'nano', family: 'general', name: 'ナノ修復', desc: '撃破するたびHP +2',
    effect: { mods: [{ stat: 'killHeal', add: 2 }] },
  },
  {
    id: 'greed', family: 'general', name: '強欲プロトコル', desc: 'クレジット獲得 +50%、被ダメージ +10%', requires: 'credits',
    effect: { mods: [{ stat: 'creditMul', add: 0.5 }, { stat: 'damageTaken', add: 0.1 }] },
  },
];

// 系統。同じ系統のインプラントを need 個持つと bonus が発動する
export const families = {
  shock: {
    name: '電撃', color: 'shock',
    bonus: { need: 3, desc: '連鎖数 +2', effect: { mods: [{ stat: 'chainBonus', add: 2 }] } },
  },
  heat: {
    name: '熱', color: 'heat',
    bonus: { need: 3, desc: '継続ダメージ2倍', effect: { mods: [{ stat: 'burnMul', add: 1 }] } },
  },
  cold: {
    name: '冷却', color: 'cold',
    bonus: { need: 3, desc: '減速した敵が凍結することがある', effect: { mods: [{ stat: 'freezeChance', add: 0.2 }] } },
  },
  general: { name: '汎用', color: 'ink' },
};
