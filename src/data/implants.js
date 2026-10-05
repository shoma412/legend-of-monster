// インプラントの定義（M3 で追加、2026-10-06 にレベル制と種族へ変更）
// 1件 = { id, ... } の形で足す。
//
// インプラントにはレベルがあり、同じものをもう一度手に入れると Lv が1つ上がる（上限は balance の LEVEL.implantMax）。
// desc と effect は「強さの倍率 k」を受け取る関数で書く。k は Lv1 で 1、Lv が1上がるごとに LEVEL.implantGrowth ずつ増える。
//   どの数値を k で伸ばすかは、インプラントごとにここで決める（伸ばさない数値は、そのまま書く）
//   下の pct / num は、説明文に数値を入れるための小道具
//
// effect が返す形は、装備効果・レジェンド固有効果と共通で、2種類の書き方だけを使う
//   mods     : ステータス補正。{ stat, add, when } … when を書くと条件を満たす間だけ効く
//              when: hpBelowHalf / hpFull / recentDash（window 秒以内にダッシュした）/ targetSlowed（相手が減速中）/ targetBurning（相手が燃えている）
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
  // species: どの種族の部品か（下の species の id。general は汎用の義体部品）
  // ---- 猪（ボルトボア由来・電撃） ----
  {
    id: 'chain', species: 'boar', name: '連鎖放電',
    desc: (k) => `撃破時、近くの敵2体に電撃（${num(18 * k)}ダメージ）`,
    effect: (k) => ({ triggers: [{ on: 'kill', do: 'chainLightning', count: 2, range: 170, damage: 18 * k }] }),
  },
  {
    id: 'overcurrent', species: 'boar', name: '過電流',
    desc: (k) => `電撃属性の攻撃が${pct(0.2 * k)}の確率で敵を0.5秒止める`,
    effect: (k) => ({ triggers: [{ on: 'hit', do: 'stun', ifElement: 'shock', chance: 0.2 * k, duration: 0.5 }] }),
  },
  {
    id: 'shockdash', species: 'boar', name: '雷撃ダッシュ',
    desc: (k) => `ダッシュの通り道にいる敵に電撃（${num(20 * k)}ダメージ）`,
    effect: (k) => ({ triggers: [{ on: 'dashMove', do: 'dashDamage', element: 'shock', damage: 20 * k, radius: 26 }] }),
  },
  {
    id: 'voltedge', species: 'boar', name: '帯電刃',
    desc: (k) => `攻撃に電撃属性を付与${k > 1 ? `。会心率 +${pct((k - 1) * 0.15)}` : ''}`,
    effect: (k) => ({ element: 'shock', mods: [{ stat: 'critChance', add: (k - 1) * 0.15 }] }),
  },
  {
    id: 'voltskin', species: 'boar', name: '帯電外皮',
    desc: (k) => `被弾したとき周囲の敵に電撃（${num(24 * k)}ダメージ）`,
    effect: (k) => ({ triggers: [{ on: 'hurt', do: 'shockNearby', radius: 130, damage: 24 * k }] }),
  },
  // ---- 機構（オーバーロード由来・熱） ----
  {
    id: 'incendiary', species: 'core', name: '焼却弾',
    desc: (k) => `攻撃に熱属性を付与し、3秒間の継続ダメージ${k > 1 ? `（威力${times(k)}）` : ''}`,
    effect: (k) => ({ element: 'heat', mods: [{ stat: 'burnMul', add: k - 1 }] }),
  },
  {
    id: 'thermal', species: 'core', name: '熱暴走',
    desc: (k) => `HPが50%以下のとき攻撃力 +${pct(0.35 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.35 * k, when: 'hpBelowHalf' }] }),
  },
  {
    id: 'blast', species: 'core', name: '爆炎処理',
    desc: (k) => `燃えている敵を倒すと小爆発（${num(25 * k)}ダメージ）`,
    effect: (k) => ({ triggers: [{ on: 'kill', do: 'explode', ifTarget: 'burning', element: 'heat', radius: 75, damage: 25 * k }] }),
  },
  {
    id: 'overheat', species: 'core', name: '過熱出力',
    desc: (k) => `燃えている敵へのダメージ +${pct(0.2 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.2 * k, when: 'targetBurning' }] }),
  },
  {
    id: 'exhaust', species: 'core', name: '排熱弁',
    desc: (k) => `被弾したとき周囲の敵を燃やす（範囲 ${num(140 * k)}）`,
    effect: (k) => ({ triggers: [{ on: 'hurt', do: 'burnNearby', radius: 140 * k }] }),
  },
  // ---- 飛竜（クライオ・ワイバーン由来・冷却） ----
  {
    id: 'coolant', species: 'wyvern', name: '冷却コア',
    desc: (k) => `攻撃に冷却属性を付与し、敵を40%減速${k > 1 ? `。減速中の敵が${pct((k - 1) * 0.25)}の確率で凍結` : ''}`,
    effect: (k) => ({ element: 'cold', mods: [{ stat: 'freezeChance', add: (k - 1) * 0.25 }] }),
  },
  {
    id: 'frostarmor', species: 'wyvern', name: '氷結装甲',
    desc: (k) => `被弾したとき周囲の敵を減速させる（範囲 ${num(150 * k)}）`,
    effect: (k) => ({ triggers: [{ on: 'hurt', do: 'slowNearby', radius: 150 * k }] }),
  },
  {
    id: 'icebreaker', species: 'wyvern', name: '砕氷',
    desc: (k) => `減速中の敵への会心率 +${pct(0.25 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'critChance', add: 0.25 * k, when: 'targetSlowed' }] }),
  },
  {
    id: 'frostwing', species: 'wyvern', name: '霜の翼',
    desc: (k) => `ダッシュの通り道にいる敵を減速させる（範囲 ${num(46 * k)}）`,
    effect: (k) => ({ triggers: [{ on: 'dashMove', do: 'dashSlow', radius: 46 * k }] }),
  },
  {
    id: 'frostclaw', species: 'wyvern', name: '凍てつく爪',
    desc: (k) => `減速中の敵へのダメージ +${pct(0.2 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.2 * k, when: 'targetSlowed' }] }),
  },
  // ---- 汎用の義体部品 ----
  {
    id: 'overclock', species: 'general', name: 'オーバークロック',
    desc: (k) => `攻撃力 +${pct(0.2 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.2 * k }] }),
  },
  {
    id: 'muscle', species: 'general', name: '人工筋繊維',
    desc: (k) => `移動速度 +${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'moveSpeedMul', add: 0.15 * k }] }),
  },
  {
    id: 'plating', species: 'general', name: '装甲プレート', onAcquire: 'fullHeal',
    desc: (k) => `最大HP +${num(25 * k)}、全回復`,
    effect: (k) => ({ mods: [{ stat: 'maxHp', add: Math.round(25 * k) }] }),
  },
  {
    id: 'adrenaline', species: 'general', name: 'アドレナリン回路',
    desc: (k) => `ダッシュ後2秒間 攻撃力 +${pct(0.5 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.5 * k, when: 'recentDash', window: 2 }] }),
  },
  {
    id: 'blade', species: 'general', name: '拡張ブレード',
    desc: (k) => `近接範囲 +${pct(0.25 * k)}／弾が1体貫通`,
    effect: (k) => ({ mods: [{ stat: 'meleeRange', add: 0.25 * k }, { stat: 'pierce', add: 1 }] }),
  },
  {
    id: 'wideblade', species: 'general', name: '広角ブレード',
    desc: (k) => `近接攻撃の角度 +${pct(0.5 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'meleeArc', add: 0.5 * k }] }),
  },
  {
    id: 'nano', species: 'general', name: 'ナノ修復',
    desc: (k) => `撃破するたびHP +${Math.round(2 * k * 10) / 10}`,
    effect: (k) => ({ mods: [{ stat: 'killHeal', add: Math.round(2 * k * 10) / 10 }] }),
  },
  {
    id: 'greed', species: 'general', name: '強欲プロトコル', requires: 'credits',
    desc: (k) => `クレジット獲得 +${pct(0.5 * k)}、被ダメージ +10%`,
    effect: (k) => ({ mods: [{ stat: 'creditMul', add: 0.5 * k }, { stat: 'damageTaken', add: 0.1 }] }),
  },
];

// 種族。インプラントは「種族の部品」と「汎用の義体部品（general）」に分かれる。種族は、ボス1体につき1つ。
// 1回の出撃で選択肢に出るのは、汎用＋そのマップのボスの種族＋持ち込みの種族だけ（src/logic/stats.js の runSpecies）。
// 種族を足すときは、ここに1件足して、部品（上の implants）の species にその id を書く。
//   name    : 画面に出す名前 / color : 色（src/data/theme.js の属性の色か、色の名前）
//   boss    : 由来のボス（src/data/bosses.js の id）。そのボスが出るマップで、この種族の部品が出る
//   bonuses : 同じ種族の部品を need 種類持つと発動するボーナス（レベルは数えない）。上から順に、条件を満たしたものがすべて重なる
export const species = {
  boar: {
    name: '猪', color: 'shock', boss: 'boltboar',
    bonuses: [
      { need: 2, desc: '連鎖の数 +1', effect: { mods: [{ stat: 'chainBonus', add: 1 }] } },
      { need: 3, desc: '連鎖の数 さらに +2', effect: { mods: [{ stat: 'chainBonus', add: 2 }] } },
    ],
  },
  wyvern: {
    name: '飛竜', color: 'cold', boss: 'cryowyvern',
    bonuses: [
      { need: 2, desc: '減速の時間 +50%', effect: { mods: [{ stat: 'slowMul', add: 0.5 }] } },
      { need: 3, desc: '減速した敵が凍結することがある', effect: { mods: [{ stat: 'freezeChance', add: 0.2 }] } },
    ],
  },
  core: {
    name: '機構', color: 'heat', boss: 'overload',
    bonuses: [
      { need: 2, desc: '継続ダメージ +50%', effect: { mods: [{ stat: 'burnMul', add: 0.5 }] } },
      { need: 3, desc: '継続ダメージ さらに +100%', effect: { mods: [{ stat: 'burnMul', add: 1 }] } },
    ],
  },
  general: { name: '汎用', color: 'ink', bonuses: [] },
};
