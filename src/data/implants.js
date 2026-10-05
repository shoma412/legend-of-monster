// インプラントの定義（M3 で追加、2026-10-06 にレベル制へ変更）
// 1件 = { id, ... } の形で足す。
//
// インプラントにはレベルがあり、同じものをもう一度手に入れると Lv が1つ上がる（上限は balance の LEVEL.implantMax）。
// desc と effect は「強さの倍率 k」を受け取る関数で書く。k は Lv1 で 1、Lv が1上がるごとに LEVEL.implantGrowth ずつ増える。
//   どの数値を k で伸ばすかは、インプラントごとにここで決める（伸ばさない数値は、そのまま書く）
//   下の pct / num は、説明文に数値を入れるための小道具
//
// effect が返す形は、装備効果・レジェンド固有効果と共通で、2種類の書き方だけを使う
//   mods     : ステータス補正。{ stat, add, when } … when を書くと条件を満たす間だけ効く
//              when: hpBelowHalf / hpFull / recentDash（window 秒以内にダッシュした）/ targetSlowed（相手が減速中）
//   triggers : イベントで発動する効果。{ on, do, ... }
//              on: hit（攻撃が当たった）/ crit / kill / hurt（被弾）/ dashMove（ダッシュ中）
//              do: 発動する効果の部品の名前（src/game/effects.js の ACTIONS）
//              ifElement: その属性の攻撃のときだけ / ifTarget: slowed, burning の相手のときだけ / chance: 確率
//   element  : 攻撃に属性を付ける（shock / heat / cold）
// requires: まだ実装していない仕組みが必要なもの。balance の FEATURES で有効になるまで選択肢に出ない
const pct = (v) => `${Math.round(v * 100)}%`;
const num = (v) => `${Math.round(v)}`;
const times = (v) => `${Math.round(v * 10) / 10}倍`;

export const implants = [
  // ---- 電撃 ----
  {
    id: 'chain', family: 'shock', name: '連鎖放電',
    desc: (k) => `撃破時、近くの敵2体に電撃（${num(18 * k)}ダメージ）`,
    effect: (k) => ({ triggers: [{ on: 'kill', do: 'chainLightning', count: 2, range: 170, damage: 18 * k }] }),
  },
  {
    id: 'overcurrent', family: 'shock', name: '過電流',
    desc: (k) => `電撃属性の攻撃が${pct(0.2 * k)}の確率で敵を0.5秒止める`,
    effect: (k) => ({ triggers: [{ on: 'hit', do: 'stun', ifElement: 'shock', chance: 0.2 * k, duration: 0.5 }] }),
  },
  {
    id: 'shockdash', family: 'shock', name: '雷撃ダッシュ',
    desc: (k) => `ダッシュの通り道にいる敵に電撃（${num(20 * k)}ダメージ）`,
    effect: (k) => ({ triggers: [{ on: 'dashMove', do: 'dashDamage', element: 'shock', damage: 20 * k, radius: 26 }] }),
  },
  // ---- 熱 ----
  {
    id: 'incendiary', family: 'heat', name: '焼却弾',
    desc: (k) => `攻撃に熱属性を付与し、3秒間の継続ダメージ${k > 1 ? `（威力${times(k)}）` : ''}`,
    effect: (k) => ({ element: 'heat', mods: [{ stat: 'burnMul', add: k - 1 }] }),
  },
  {
    id: 'thermal', family: 'heat', name: '熱暴走',
    desc: (k) => `HPが50%以下のとき攻撃力 +${pct(0.35 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.35 * k, when: 'hpBelowHalf' }] }),
  },
  {
    id: 'blast', family: 'heat', name: '爆炎処理',
    desc: (k) => `燃えている敵を倒すと小爆発（${num(25 * k)}ダメージ）`,
    effect: (k) => ({ triggers: [{ on: 'kill', do: 'explode', ifTarget: 'burning', element: 'heat', radius: 75, damage: 25 * k }] }),
  },
  // ---- 冷却 ----
  {
    id: 'coolant', family: 'cold', name: '冷却コア',
    desc: (k) => `攻撃に冷却属性を付与し、敵を40%減速${k > 1 ? `。減速中の敵が${pct((k - 1) * 0.25)}の確率で凍結` : ''}`,
    effect: (k) => ({ element: 'cold', mods: [{ stat: 'freezeChance', add: (k - 1) * 0.25 }] }),
  },
  {
    id: 'frostarmor', family: 'cold', name: '氷結装甲',
    desc: (k) => `被弾したとき周囲の敵を減速させる（範囲 ${num(150 * k)}）`,
    effect: (k) => ({ triggers: [{ on: 'hurt', do: 'slowNearby', radius: 150 * k }] }),
  },
  {
    id: 'icebreaker', family: 'cold', name: '砕氷',
    desc: (k) => `減速中の敵への会心率 +${pct(0.25 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'critChance', add: 0.25 * k, when: 'targetSlowed' }] }),
  },
  // ---- 汎用 ----
  {
    id: 'overclock', family: 'general', name: 'オーバークロック',
    desc: (k) => `攻撃力 +${pct(0.2 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.2 * k }] }),
  },
  {
    id: 'muscle', family: 'general', name: '人工筋繊維',
    desc: (k) => `移動速度 +${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'moveSpeedMul', add: 0.15 * k }] }),
  },
  {
    id: 'plating', family: 'general', name: '装甲プレート', onAcquire: 'fullHeal',
    desc: (k) => `最大HP +${num(25 * k)}、全回復`,
    effect: (k) => ({ mods: [{ stat: 'maxHp', add: Math.round(25 * k) }] }),
  },
  {
    id: 'adrenaline', family: 'general', name: 'アドレナリン回路',
    desc: (k) => `ダッシュ後2秒間 攻撃力 +${pct(0.5 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.5 * k, when: 'recentDash', window: 2 }] }),
  },
  {
    id: 'blade', family: 'general', name: '拡張ブレード',
    desc: (k) => `近接範囲 +${pct(0.25 * k)}／弾が1体貫通`,
    effect: (k) => ({ mods: [{ stat: 'meleeRange', add: 0.25 * k }, { stat: 'pierce', add: 1 }] }),
  },
  {
    id: 'wideblade', family: 'general', name: '広角ブレード',
    desc: (k) => `近接攻撃の角度 +${pct(0.5 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'meleeArc', add: 0.5 * k }] }),
  },
  {
    id: 'nano', family: 'general', name: 'ナノ修復',
    desc: (k) => `撃破するたびHP +${Math.round(2 * k * 10) / 10}`,
    effect: (k) => ({ mods: [{ stat: 'killHeal', add: Math.round(2 * k * 10) / 10 }] }),
  },
  {
    id: 'greed', family: 'general', name: '強欲プロトコル', requires: 'credits',
    desc: (k) => `クレジット獲得 +${pct(0.5 * k)}、被ダメージ +10%`,
    effect: (k) => ({ mods: [{ stat: 'creditMul', add: 0.5 * k }, { stat: 'damageTaken', add: 0.1 }] }),
  },
];

// 系統。同じ系統のインプラントを need 種類持つと bonus が発動する（レベルは数えない）
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
