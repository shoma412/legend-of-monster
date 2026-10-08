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
//              when: hpBelowHalf / hpFull / recentDash（window 秒以内にダッシュした）/ targetSlowed（相手が減速中）/ targetBurning（相手が燃えている）/
//                    standing（立ち止まっている）/ recentHurt（window 秒以内に被弾した）/
//                    moving（動いている）/ targetWeak（相手のHPが半分以下）/ recentKill（window 秒以内に敵を倒した）/
//                    targetLit（相手が照らされている。明るいマップでは常に）/ targetMarked（照準灯で照らした相手）/ targetNear（相手が range px 以内にいる）/
//                    targetStopped（相手が足止め・凍結・停止で動けない）/ targetFull（相手のHPが満タン）/ targetBig（相手がエリートかボス）
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
  // ---- 大蛇（パイプサーペント由来・連続で当てる） ----
  {
    id: 'coil', species: 'serpent', name: '締め上げ',
    desc: (k) => `同じ敵に続けて当てるたびに、ダメージ +${pct(0.06 * k)}（5回まで重なる）`,
    effect: (k) => ({ mods: [{ stat: 'comboBonus', add: 0.06 * k }] }),
  },
  {
    id: 'twinfang', species: 'serpent', name: '連牙',
    desc: (k) => `攻撃速度 +${pct(0.12 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackSpeed', add: 0.12 * k }] }),
  },
  {
    id: 'ambush', species: 'serpent', name: '奇襲',
    desc: (k) => `ダッシュ後1秒間、会心率 +${pct(0.3 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'critChance', add: 0.3 * k, when: 'recentDash', window: 1 }] }),
  },
  {
    id: 'slither', species: 'serpent', name: 'すり抜け',
    desc: (k) => `ダッシュの回復が ${pct(0.15 * k)} 速くなる`,
    effect: (k) => ({ mods: [{ stat: 'dashHaste', add: 0.15 * k }] }),
  },
  {
    id: 'swallow', species: 'serpent', name: '丸呑み',
    desc: (k) => `敵を倒すと、次の攻撃が必ず会心${k > 1 ? `。会心ダメージ +${pct((k - 1) * 0.5)}` : ''}`,
    effect: (k) => ({ triggers: [{ on: 'kill', do: 'guaranteeNextCrit' }], mods: [{ stat: 'critMul', add: (k - 1) * 0.5 }] }),
  },
  // ---- 大蟹（タンククラブ由来・守って返す） ----
  {
    id: 'carapace', species: 'crab', name: '甲殻',
    desc: (k) => `被ダメージ −${pct(0.08 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'damageTaken', add: -0.08 * k }] }),
  },
  {
    id: 'thornshell', species: 'crab', name: 'とげ甲羅',
    desc: (k) => `被弾したとき、周囲の敵に${num(34 * k)}ダメージ`,
    effect: (k) => ({ triggers: [{ on: 'hurt', do: 'thorns', radius: 120, damage: 34 * k }] }),
  },
  {
    id: 'brace', species: 'crab', name: '踏ん張り',
    desc: (k) => `立ち止まっている間、被ダメージ −${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'damageTaken', add: -0.15 * k, when: 'standing' }] }),
  },
  {
    id: 'riposte', species: 'crab', name: '反撃',
    desc: (k) => `被弾後2秒間、攻撃力 +${pct(0.3 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.3 * k, when: 'recentHurt', window: 2 }] }),
  },
  {
    id: 'bigclaw', species: 'crab', name: '大ばさみ',
    desc: (k) => `会心ダメージ +${pct(0.3 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'critMul', add: 0.3 * k }] }),
  },
  // ---- 多頭（スラッジハイドラ由来・回復して粘る） ----
  {
    id: 'regen', species: 'hydra', name: '再生組織',
    desc: (k) => `少しずつ HP が戻る（2秒ごとに +${Math.round(k * 10) / 10}）`,
    effect: (k) => ({ mods: [{ stat: 'hpRegen', add: 0.5 * k }] }),
  },
  {
    id: 'devour', species: 'hydra', name: '捕食',
    desc: (k) => `撃破するたび HP +${Math.round(3 * k * 10) / 10}`,
    effect: (k) => ({ mods: [{ stat: 'killHeal', add: Math.round(3 * k * 10) / 10 }] }),
  },
  {
    id: 'sparehead', species: 'hydra', name: '予備の首',
    desc: (k) => `倒れたとき、出撃ごとに1回だけ、HP ${pct(Math.min(1, 0.3 * k))} で起き上がる`,
    effect: (k) => ({ mods: [{ stat: 'revive', add: Math.min(1, 0.3 * k) }] }),
  },
  {
    id: 'thickblood', species: 'hydra', name: '濃縮体液',
    desc: (k) => `修復キットの回復量 +${pct(0.25 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'kitBonus', add: 0.25 * k }] }),
  },
  {
    id: 'lastgasp', species: 'hydra', name: '底力',
    desc: (k) => `HPが50%以下のとき、被ダメージ −${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'damageTaken', add: -0.15 * k, when: 'hpBelowHalf' }] }),
  },
  // ---- 猟犬（スクラップハウンド由来・動き回る） ----
  {
    id: 'momentum', species: 'hound', name: '慣性',
    desc: (k) => `動いている間、攻撃力 +${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.15 * k, when: 'moving' }] }),
  },
  {
    id: 'hunt', species: 'hound', name: '狩り',
    desc: (k) => `HPが半分以下の敵へのダメージ +${pct(0.25 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.25 * k, when: 'targetWeak' }] }),
  },
  {
    id: 'sprint', species: 'hound', name: '疾走',
    desc: (k) => `敵を倒すと3秒間、移動速度 +${pct(0.25 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'moveSpeedMul', add: 0.25 * k, when: 'recentKill', window: 3 }] }),
  },
  {
    id: 'longdash', species: 'hound', name: '跳躍',
    desc: (k) => `ダッシュの距離 +${pct(0.2 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'dashDistance', add: 0.2 * k }] }),
  },
  {
    id: 'pursuit', species: 'hound', name: '追い打ち',
    desc: (k) => `ダッシュ後1.5秒間、攻撃速度 +${pct(0.2 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackSpeed', add: 0.2 * k, when: 'recentDash', window: 1.5 }] }),
  },
  // ---- 蛾（ランプイーター由来・光と目） ----
  {
    id: 'compound', species: 'moth', name: '複眼',
    desc: (k) => `会心率 +${pct(0.05 * k)}。暗闇で見える範囲 +${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'critChance', add: 0.05 * k }, { stat: 'visionBonus', add: 0.15 * k }] }),
  },
  {
    id: 'phosphor', species: 'moth', name: '燐光',
    desc: (k) => `照らされている敵へのダメージ +${pct(0.1 * k)}（明るい場所では、常に効く）。攻撃の光が大きくなる`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.1 * k, when: 'targetLit' }, { stat: 'lightBonus', add: 0.5 * k }] }),
  },
  {
    id: 'flutter', species: 'moth', name: '羽ばたき',
    desc: (k) => `ダッシュ後1.5秒間、移動速度 +${pct(0.2 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'moveSpeedMul', add: 0.2 * k, when: 'recentDash', window: 1.5 }] }),
  },
  {
    id: 'lure', species: 'moth', name: '誘蛾灯',
    desc: (k) => `敵を倒すと、HP +${num(1 * k)}。暗闇では、倒した場所に光が残る`,
    effect: (k) => ({ mods: [{ stat: 'killHeal', add: 1 * k }, { stat: 'killLight', add: 1 }] }),
  },
  {
    id: 'mothdust', species: 'moth', name: '鱗粉',
    desc: (k) => `被弾後2秒間、被ダメージ −${pct(0.2 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'damageTaken', add: -0.2 * k, when: 'recentHurt', window: 2 }] }),
  },
  // ---- 番兵（サーチライト・センチネル由来・照らして、迎え撃つ） ----
  {
    id: 'spotlight', species: 'sentinel', name: '照準灯',
    desc: (k) => `攻撃を当てた敵を4秒照らす（暗闇でも姿が見える）。照らした敵へのダメージ +${pct(0.08 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'markTime', add: 4 }, { stat: 'attackMul', add: 0.08 * k, when: 'targetMarked' }] }),
  },
  {
    id: 'lookout', species: 'sentinel', name: '見張り',
    desc: (k) => `立ち止まっている間、攻撃力 +${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.15 * k, when: 'standing' }] }),
  },
  {
    id: 'intercept', species: 'sentinel', name: '迎撃',
    desc: (k) => `近くの敵へのダメージ +${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.15 * k, when: 'targetNear', range: 120 }] }),
  },
  {
    id: 'flashbang', species: 'sentinel', name: '閃光弾',
    desc: (k) => `ダッシュしたとき、まわりの敵を${Math.round(0.8 * k * 10) / 10}秒止める（6秒に1回）`,
    effect: (k) => ({ triggers: [{ on: 'dashMove', do: 'flashbang', radius: 130, duration: 0.8 * k, cooldown: 6 }] }),
  },
  {
    id: 'vigil', species: 'sentinel', name: '警戒',
    desc: (k) => `HPが満タンのとき、被ダメージ −${pct(0.25 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'damageTaken', add: -0.25 * k, when: 'hpFull' }] }),
  },
  // ---- 遮断器（ブレーカー由来・切り替えと、一瞬の力） ----
  {
    id: 'overloader', species: 'breaker', name: '過負荷',
    desc: (k) => `攻撃を8回当てるごとに、次の攻撃のダメージ +${pct(0.6 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'overloadBonus', add: 0.6 * k }] }),
  },
  {
    id: 'storage', species: 'breaker', name: '蓄電',
    desc: (k) => `2秒間攻撃を当てていないと、次の攻撃のダメージ +${pct(0.3 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'restedBonus', add: 0.3 * k }] }),
  },
  {
    id: 'cutoff', species: 'breaker', name: '遮断',
    desc: (k) => `一度に最大HPの20%以上のダメージを受けるとき、そのダメージを${pct(Math.min(0.6, 0.3 * k))}減らす`,
    effect: (k) => ({ mods: [{ stat: 'bigHitCut', add: 0.3 * k }] }),
  },
  {
    id: 'restore', species: 'breaker', name: '復電',
    desc: (k) => `修復キットを使うと、5秒間 攻撃力 +${pct(0.25 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'kitPower', add: 0.25 * k }] }),
  },
  {
    id: 'blip', species: 'breaker', name: '瞬断',
    desc: (k) => `ダッシュの無敵時間 +${Math.round(0.15 * k * 100) / 100}秒`,
    effect: (k) => ({ mods: [{ stat: 'dashInvincible', add: 0.15 * k }] }),
  },
  // ---- 蜘蛛（ガーダースパイダー由来・仕掛ける） ----
  {
    id: 'mine', species: 'spider', name: '地雷',
    desc: (k) => `ダッシュした場所に地雷を置く。敵が触れると爆発（${num(48 * k)}ダメージ）`,
    effect: (k) => ({ triggers: [{ on: 'dashMove', do: 'placeMine' }], mods: [{ stat: 'mineDamage', add: 48 * k }] }),
  },
  {
    id: 'stickyweb', species: 'spider', name: '粘着糸',
    desc: (k) => `攻撃が当たった敵を、${pct(0.15 * k)}の確率で0.8秒足止めする`,
    effect: (k) => ({ triggers: [{ on: 'hit', do: 'stun', chance: 0.15 * k, duration: 0.8 }] }),
  },
  {
    id: 'sentry', species: 'spider', name: '小型タレット',
    desc: (k) => `8秒ごとに、足元に小型タレットを置く。6秒間、近くの敵を撃つ（1発 ${num(12 * k)}ダメージ）`,
    effect: (k) => ({ mods: [{ stat: 'sentryDamage', add: 12 * k }] }),
  },
  {
    id: 'trapper', species: 'spider', name: '罠師',
    desc: (k) => `動けない敵（足止め・凍結・停止中）へのダメージ +${pct(0.3 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.3 * k, when: 'targetStopped' }] }),
  },
  {
    id: 'spinneret', species: 'spider', name: '紡績腺',
    desc: (k) => `設置物（地雷・小型タレット）のダメージ +${pct(0.3 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'deviceMul', add: 0.3 * k }] }),
  },
  // ---- 巨人（クレーンタイタン由来・重い一撃） ----
  // 「重い攻撃」は、溜め斬り・コンボの締めの一撃・反撃・拡散射撃・奥義のこと
  {
    id: 'heavyhand', species: 'titan', name: '剛腕',
    desc: (k) => `重い攻撃（溜め斬り・締めの一撃・反撃・拡散射撃）の威力 +${pct(0.25 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'heavyBonus', add: 0.25 * k }] }),
  },
  {
    id: 'firstblow', species: 'titan', name: '初撃',
    desc: (k) => `HPが満タンの敵へのダメージ +${pct(0.4 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.4 * k, when: 'targetFull' }] }),
  },
  {
    id: 'tremor', species: 'titan', name: '震動',
    desc: (k) => `攻撃で敵を吹き飛ばす力 +${pct(0.5 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'knockbackBonus', add: 0.5 * k }] }),
  },
  {
    id: 'longarm', species: 'titan', name: '長腕',
    desc: (k) => `近接範囲 +${pct(0.12 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'meleeRange', add: 0.12 * k }] }),
  },
  {
    id: 'pressure', species: 'titan', name: '重圧',
    desc: (k) => `エリートとボスへのダメージ +${pct(0.15 * k)}`,
    effect: (k) => ({ mods: [{ stat: 'attackMul', add: 0.15 * k, when: 'targetBig' }] }),
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
  serpent: {
    name: '大蛇', color: 'green', boss: 'pipeserpent',
    bonuses: [
      { need: 2, desc: '攻撃速度 +10%', effect: { mods: [{ stat: 'attackSpeed', add: 0.1 }] } },
      { need: 3, desc: '連続ヒットの上限 +3', effect: { mods: [{ stat: 'comboMax', add: 3 }] } },
    ],
  },
  crab: {
    name: '大蟹', color: 'amber', boss: 'tankcrab',
    bonuses: [
      { need: 2, desc: '被ダメージ −10%', effect: { mods: [{ stat: 'damageTaken', add: -0.1 }] } },
      { need: 3, desc: '被弾後の無敵時間 +0.4秒', effect: { mods: [{ stat: 'hurtInvincible', add: 0.4 }] } },
    ],
  },
  hydra: {
    name: '多頭', color: 'magenta', boss: 'sludgehydra',
    bonuses: [
      { need: 2, desc: '修復キットの回復量 +30%', effect: { mods: [{ stat: 'kitBonus', add: 0.3 }] } },
      { need: 3, desc: 'HPが半分以下のとき、回復が2倍', effect: { mods: [{ stat: 'lowHealBonus', add: 1 }] } },
    ],
  },
  hound: {
    name: '猟犬', color: 'red', boss: 'scraphound',
    bonuses: [
      { need: 2, desc: '移動速度 +10%', effect: { mods: [{ stat: 'moveSpeedMul', add: 0.1 }] } },
      { need: 3, desc: 'ダッシュの回数 +1', effect: { mods: [{ stat: 'dashCharges', add: 1 }] } },
    ],
  },
  moth: {
    name: '蛾', color: 'magenta', boss: 'lampeater',
    bonuses: [
      { need: 2, desc: '会心ダメージ +20%', effect: { mods: [{ stat: 'critMul', add: 0.2 }] } },
      { need: 3, desc: '暗闇で見える範囲 +25%。照らされている敵へのダメージ +10%', effect: { mods: [{ stat: 'visionBonus', add: 0.25 }, { stat: 'attackMul', add: 0.1, when: 'targetLit' }] } },
    ],
  },
  sentinel: {
    name: '番兵', color: 'amber', boss: 'sentinel',
    bonuses: [
      { need: 2, desc: '攻撃を当てた敵を照らす時間 +2秒（照準灯がなくても、2秒照らす）', effect: { mods: [{ stat: 'markTime', add: 2 }] } },
      { need: 3, desc: '照らされている敵の動きが20%遅くなる（ボスには効かない）', effect: { mods: [{ stat: 'litSlow', add: 0.2 }] } },
    ],
  },
  breaker: {
    name: '遮断器', color: 'cyan', boss: 'breaker',
    bonuses: [
      { need: 2, desc: '会心率 +5%', effect: { mods: [{ stat: 'critChance', add: 0.05 }] } },
      { need: 3, desc: '敵を倒すと、ダッシュが1回ぶん回復する（3秒に1回）', effect: { mods: [{ stat: 'killDash', add: 1 }] } },
    ],
  },
  spider: {
    name: '蜘蛛', color: 'cold', boss: 'girderspider',
    bonuses: [
      { need: 2, desc: '設置物のダメージ +25%', effect: { mods: [{ stat: 'deviceMul', add: 0.25 }] } },
      { need: 3, desc: '設置物が2つ置ける', effect: { mods: [{ stat: 'deviceCount', add: 1 }] } },
    ],
  },
  titan: {
    name: '巨人', color: 'heat', boss: 'cranetitan',
    bonuses: [
      { need: 2, desc: '近接範囲 +15%', effect: { mods: [{ stat: 'meleeRange', add: 0.15 }] } },
      { need: 3, desc: '重い攻撃で、エリートもひるむ', effect: { mods: [{ stat: 'heavyStagger', add: 1 }] } },
    ],
  },
  general: { name: '汎用', color: 'ink', bonuses: [] },
};
