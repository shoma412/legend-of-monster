// 隠れ家の恒久強化の定義（M5 で追加）
// 1件 = { id, ... } の形で足す。
//
// max      : 段階の数（スキルツリーでは、1段ぶんがマス1つになる。src/logic/skillTree.js）
// costs    : 1段ごとの必要素材（1段目, 2段目, …）。{ 素材のid: 個数 }
//            素材の種類の数で、スキルツリーの中で置かれる深さが決まる：1種類 → 1〜3段目、2種類 → 4〜5段目、3種類 → 6段目以降
// legacyCosts : スキルツリーにする前（2026-10-07 まで）の値段。古いセーブデータの素材を払い戻すときにだけ使う。書いていなければ costs と同じ
// treeMaxDepth : スキルツリーで、これより奥には置かない段（書いていなければ、素材の種類の数で決まる範囲）
// category : 強化の種類（body 体 / skill 技 / gear 備え）。スキルツリーでの色分けに使う
// perLevel : 1段ごとの効果
//   mods        : ステータス補正（インプラントや装備と同じ書き方）
//   kits        : ラン開始時の修復キットの数に足す
//   startChoice : true なら、ラン開始時にインプラントを1つ選べる
//   ougi        : その武器の奥義が使えるようになる（武器の id）
//   carrySlots  : 持ち込みの種族の枠を増やす数
//   itemSlots   : 消耗品の枠を増やす数
//   keepImplants: マップをクリアしたあと、次の出撃に持ち越せるインプラントの数を増やす
//   implantSlots: 1回の出撃で持てるインプラントの種類の数を増やす
//   skips       : 1回の出撃で、3択を引き直せる回数を増やす
//   weaponMod   : その武器の特殊アクションを強くする。{ weapon: 武器の id, special: 書き換える値, scale: 掛ける倍率, stageTime: 溜めの段階の時間に掛ける倍率 }
// since    : 何回目に足した強化か（書いていなければ 1 ＝ 最初の34マス）。2 以上のものは、最初の配置を作ったあとで、枝の先や空いている所に付け足す。
//            今あるセーブデータの配置を変えないための決まり（docs/詳細仕様.md「23. スキルツリー」の「あとからマスを足すとき」）
// ready: false は、まだ中身ができていないもの（隠れ家には「準備中」と出て、買えない）
export const upgrades = [
  {
    id: 'frame', category: 'body', name: '強化骨格', desc: '最大HP +10', max: 5,
    costs: [{ boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 10 }] },
  },
  {
    id: 'nerve', category: 'skill', name: '神経加速', desc: '攻撃力 +5%', max: 5,
    costs: [{ boarCore: 1 }, { boarCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.05 }] },
  },
  {
    id: 'kitslot', category: 'gear', name: '修復キット増設', desc: 'ラン開始時の修復キット +1', max: 2,
    costs: [{ cryoCore: 1, boarCore: 1 }, { cryoCore: 1, boarCore: 1 }],
    legacyCosts: [{ cryoCore: 2 }, { cryoCore: 2 }],
    perLevel: { kits: 1 },
  },
  {
    id: 'pouch', category: 'gear', name: '携行ポーチ', desc: '消耗品の枠 +1（最大4枠。3・4 キーで使う）', max: 2,
    // 1枠目はボアコアだけで取れる（前と同じく、最初のボスの素材だけでよい）。2枠目は奥のマス。合計は前と同じ（ボアコア2・クライオコア2）
    costs: [{ boarCore: 1 }, { boarCore: 1, cryoCore: 2 }],
    legacyCosts: [{ boarCore: 2 }, { cryoCore: 2 }],
    perLevel: { itemSlots: 1 },
  },
  {
    id: 'doubledash', category: 'gear', name: '二重ダッシュ', desc: 'ダッシュを2回連続で使える', max: 1,
    // 素材の数は前と同じ3個。4段目に置く（それより奥には行かない）
    costs: [{ cryoCore: 2, boarCore: 1 }],
    legacyCosts: [{ cryoCore: 3 }],
    treeMaxDepth: 4,
    perLevel: { mods: [{ stat: 'dashCharges', add: 1 }] },
  },
  {
    id: 'bootprogram', category: 'skill', name: '起動プログラム', desc: 'ラン開始時にインプラントを1つ選んで始められる', max: 1,
    costs: [{ overCore: 1 }],
    perLevel: { startChoice: true },
  },
  {
    id: 'ougi-greatsword', category: 'skill', name: '大剣の奥義', desc: '残りHP20%以下のとき、エリアごとに1回、右クリックで周囲に衝撃波（攻撃力1.75倍）', max: 1,
    costs: [{ overCore: 1 }],
    perLevel: { ougi: 'greatsword' },
  },
  {
    id: 'joints', category: 'gear', name: '関節強化', desc: 'ダッシュの回復が 10% 速くなる', max: 3,
    costs: [{ serpentCore: 1 }, { serpentCore: 1 }, { serpentCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.1 }] },
  },
  {
    id: 'armorplate', category: 'body', name: '装甲板', desc: '被ダメージ −3%', max: 3,
    costs: [{ crabCore: 1 }, { crabCore: 1 }, { crabCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.03 }] },
  },
  {
    id: 'regentank', category: 'body', name: '再生槽', desc: '最大HP +15', max: 2,
    costs: [{ hydraCore: 1 }, { hydraCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 15 }] },
  },
  {
    id: 'carryslot', category: 'gear', name: '部品棚の増設', desc: '持ち込みの種族の枠が2つになる', max: 1,
    // ツリーのいちばん奥のマス。マップ2の3体の素材を1個ずつ（前はハイドラコア×2）
    costs: [{ hydraCore: 1, crabCore: 1, serpentCore: 1 }],
    legacyCosts: [{ hydraCore: 2 }],
    perLevel: { carrySlots: 1 },
  },
  {
    id: 'legs', category: 'gear', name: '脚部強化', desc: '移動速度 +3%', max: 3,
    costs: [{ houndCore: 1 }, { houndCore: 1 }, { houndCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.03 }] },
  },
  {
    id: 'coproc', category: 'skill', name: '補助演算', desc: '会心率 +2%', max: 3,
    costs: [{ spiderCore: 1 }, { spiderCore: 1 }, { spiderCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.02 }] },
  },
  {
    id: 'foundation', category: 'body', name: '基礎補強', desc: '最大HP +20', max: 2,
    costs: [{ titanCore: 1 }, { titanCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 20 }] },
  },
  // ---- ここから、マップ4で足した強化（since: 2） ----
  {
    id: 'nightsight', category: 'gear', name: '暗視素子', desc: '暗闇で見える範囲 +8%', max: 2, since: 2,
    costs: [{ mothCore: 1 }, { mothCore: 1 }],
    perLevel: { mods: [{ stat: 'visionBonus', add: 0.08 }] },
  },
  {
    id: 'condenser', category: 'skill', name: '集光レンズ', desc: '会心ダメージ +5%', max: 2, since: 2,
    costs: [{ lensCore: 1 }, { lensCore: 1 }],
    perLevel: { mods: [{ stat: 'critMul', add: 0.05 }] },
  },
  {
    id: 'surgeguard', category: 'body', name: '過負荷耐性', desc: '最大HP +25', max: 2, since: 2,
    costs: [{ breakerCore: 1 }, { breakerCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 25 }] },
  },
  {
    id: 'sparekit', category: 'gear', name: '予備キット', desc: 'ラン開始時の修復キット +1', max: 1, since: 2,
    // マップ4の3体の素材を1個ずつ。6段目に置く（画面の円が6段までなので、それより奥には行かない）
    costs: [{ mothCore: 1, lensCore: 1, breakerCore: 1 }],
    treeMaxDepth: 6,
    perLevel: { kits: 1 },
  },
  // ---- ここから、持ち越しのために足した強化（since: 3） ----
  {
    id: 'memory', category: 'skill', name: '記憶領域', desc: 'マップをクリアしたあと、次の出撃に持ち越せるインプラントが2つになる', max: 1, since: 3,
    // 隠しボス2体の素材を1個ずつ（4〜5段目のマス）
    costs: [{ architectCore: 1, nocturneCore: 1 }],
    perLevel: { keepImplants: 1 },
  },
  // ---- ここから、マップ5で足した強化（since: 4）。数値は小さめ。マップ5で覚える要素（持続ダメージ・弱点・状態異常）に沿わせる ----
  {
    id: 'rustproof', category: 'body', name: '防錆塗装', desc: '持続ダメージ（炎上・裂傷・腐食・酸の雨）で受ける量 −10%', max: 2, since: 4,
    costs: [{ rustCore: 1 }, { rustCore: 1 }],
    perLevel: { mods: [{ stat: 'dotResist', add: 0.1 }] },
  },
  {
    id: 'reagent', category: 'skill', name: '試薬庫', desc: '弱点を突いたときのダメージ +5%', max: 2, since: 4,
    costs: [{ bufferCore: 1 }, { bufferCore: 1 }],
    perLevel: { mods: [{ stat: 'weakBonus', add: 0.05 }] },
  },
  {
    id: 'cistern', category: 'gear', name: '集雨槽', desc: '修復キットの回復量 +10%', max: 2, since: 4,
    costs: [{ rainCore: 1 }, { rainCore: 1 }],
    perLevel: { mods: [{ stat: 'kitBonus', add: 0.1 }] },
  },
  {
    id: 'hardshell', category: 'body', name: '強化外装', desc: '被ダメージ −4%', max: 1, since: 4,
    // マップ5の3体の素材を1個ずつ。6段目に置く
    costs: [{ rustCore: 1, bufferCore: 1, rainCore: 1 }],
    treeMaxDepth: 6,
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.04 }] },
  },
  {
    id: 'catalyzer', category: 'skill', name: '触媒炉', desc: '敵に付けた状態異常（燃焼・減速・腐食）の時間 +20%', max: 1, since: 4,
    // 隠しボス「カタリスト」の素材を使う（4〜5段目のマス）
    costs: [{ catalystCore: 1, bufferCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.2 }] },
  },
  // ---- ここから、武器ごとの強化（since: 5）。その武器の特殊アクションだけを強くする。その武器を持っているときだけ効く ----
  {
    id: 'wm-greatsword', category: 'skill', name: '溜めの心得', desc: '大剣：溜め斬りの溜め時間 −20%', max: 1, since: 5,
    costs: [{ overCore: 1, hydraCore: 1 }],
    perLevel: { weaponMod: { weapon: 'greatsword', stageTime: 0.8 } },
  },
  {
    id: 'wm-sword', category: 'skill', name: '見切り', desc: '片手剣：ジャストガードの受付 0.15秒 → 0.20秒', max: 1, since: 5,
    costs: [{ boarCore: 1, houndCore: 1 }],
    perLevel: { weaponMod: { weapon: 'sword', special: { window: 0.2 } } },
  },
  {
    id: 'wm-gun', category: 'skill', name: '拡張弾倉', desc: '銃：拡散射撃 5発 → 7発', max: 1, since: 5,
    costs: [{ cryoCore: 1, spiderCore: 1 }],
    perLevel: { weaponMod: { weapon: 'gun', special: { count: 7 } } },
  },
  {
    id: 'wm-knuckle', category: 'skill', name: '闘気', desc: 'ナックル：バーストブローのゲージの溜まり +25%', max: 1, since: 5,
    costs: [{ serpentCore: 1, titanCore: 1 }],
    perLevel: { weaponMod: { weapon: 'knuckle', scale: { gain: 1.25, gainHeavy: 1.25 } } },
  },
  {
    id: 'wm-cannon', category: 'skill', name: '急速装填', desc: '大砲：徹甲砲撃のクールダウン 7秒 → 5秒', max: 1, since: 5,
    costs: [{ crabCore: 1, mothCore: 1 }],
    perLevel: { weaponMod: { weapon: 'cannon', special: { cooldown: 5 } } },
  },
  {
    id: 'wm-spear', category: 'skill', name: '踏み込み', desc: '槍：突進突きの距離 +25%、クールダウン 5秒 → 4秒', max: 1, since: 5,
    costs: [{ titanCore: 1, lensCore: 1 }],
    perLevel: { weaponMod: { weapon: 'spear', special: { cooldown: 4 }, scale: { distance: 1.25 } } },
  },
  {
    id: 'wm-chakram', category: 'skill', name: '二枚刃', desc: 'チャクラム：設置を、続けて2つ置ける', max: 1, since: 5,
    costs: [{ mothCore: 1, breakerCore: 1 }],
    perLevel: { weaponMod: { weapon: 'chakram', special: { maxPlaced: 2 } } },
  },
  // インプラントの枠と、3択のスキップ（2026-10-10 追加。docs/詳細仕様.md「34. インプラントの枠と、レベルアップでの成長」）
  {
    id: 'implantslot', category: 'body', name: 'インプラント拡張', desc: '持てるインプラントの種類 +1（最初は5種類）', max: 3, since: 6,
    costs: [{ overCore: 1, hydraCore: 1 }, { hydraCore: 1, titanCore: 1 }, { titanCore: 1, breakerCore: 1 }],
    perLevel: { implantSlots: 1 },
  },
  {
    id: 'skipchip', category: 'skill', name: '選別回路', desc: 'レベルアップの3択を引き直せる回数 +1（最初は2回）', max: 2, since: 6,
    costs: [{ cryoCore: 1, serpentCore: 1 }, { crabCore: 1, houndCore: 1 }],
    perLevel: { skips: 1 },
  },
  // ドローンユニットの子機を増やす（2026-10-12 追加。docs/詳細仕様.md「35. 新武器：ドローンユニット」）
  {
    id: 'droneRack', category: 'skill', name: '増設ラック', desc: 'ドローンユニット：子機 +1機（最初は2機。最大4機）', max: 2, since: 7,
    costs: [{ intakeCore: 1, hydraCore: 1 }, { intakeCore: 1, titanCore: 1 }], // マップ6のボスの素材（2026-10-12）
    perLevel: { mods: [{ stat: 'droneCount', add: 1 }] },
  },
  {
    id: 'wm-drone', category: 'skill', name: '強襲プログラム', desc: 'ドローン：帰還シールドの突撃のダメージ 35 → 55、クールダウン 5秒 → 4秒', max: 1, since: 7,
    costs: [{ intakeCore: 1, crabCore: 1 }],
    perLevel: { weaponMod: { weapon: 'drone', special: { cooldown: 4, charge: { distance: 320, duration: 0.3, damage: 55, knockback: 420, width: 12, spacing: 22 } } } },
  },
  // ---- ここから、マップ6で足した強化（since: 8） ----
  {
    id: 'windcloak', category: 'gear', name: '防風外套', desc: '風と吸い込みで流される量 −10%', max: 2, since: 8,
    costs: [{ intakeCore: 1 }, { intakeCore: 1 }],
    perLevel: { mods: [{ stat: 'windResist', add: 0.1 }] },
  },
  {
    id: 'stormheart', category: 'body', name: '強化心臓', desc: '最大HP +30', max: 2, since: 8,
    costs: [{ ductCore: 1 }, { ductCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 30 }] },
  },
  {
    id: 'stormeye', category: 'skill', name: '嵐の目', desc: 'ダッシュの回復 +5%', max: 2, since: 8,
    costs: [{ vaneCore: 1 }, { cycloneCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.05 }] },
  },
  // ---- ここから、マップ7に向けて足した強化（since: 9）。ボスの素材ごとに1つ（3段）＋ 2種類の素材（2段）＋ 3種類の素材（1段）。最後のマップの敵に、ちょうど届く強さになるように ----
  // 1種類の素材：1段ごとに1個（1〜3段目のマスは、1種類を1個、という決まり）
  {
    id: 'steelrib', category: 'body', name: '鉄骨補強', desc: '最大HP +20', max: 3, since: 9,
    costs: [{ boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 20 }] },
  },
  {
    id: 'coolcircuit', category: 'skill', name: '冷却回路', desc: '攻撃力 +4%', max: 3, since: 9,
    costs: [{ cryoCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.04 }] },
  },
  {
    id: 'overcurrent', category: 'skill', name: '過電流回路', desc: '会心率 +2%', max: 3, since: 9,
    costs: [{ overCore: 1 }, { overCore: 1 }, { overCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.02 }] },
  },
  {
    id: 'coilmuscle', category: 'skill', name: '蛇腹の筋', desc: '攻撃速度 +4%', max: 3, since: 9,
    costs: [{ serpentCore: 1 }, { serpentCore: 1 }, { serpentCore: 1 }],
    perLevel: { mods: [{ stat: 'attackSpeed', add: 0.04 }] },
  },
  {
    id: 'carapace', category: 'body', name: '甲殻板', desc: '被ダメージ −3%', max: 3, since: 9,
    costs: [{ crabCore: 1 }, { crabCore: 1 }, { crabCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.03 }] },
  },
  {
    id: 'selfheal', category: 'body', name: '自己再生', desc: 'HP が毎秒 0.4 回復', max: 3, since: 9,
    costs: [{ hydraCore: 1 }, { hydraCore: 1 }, { hydraCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.4 }] },
  },
  {
    id: 'houndlegs', category: 'gear', name: '猟犬の脚', desc: '移動速度 +3%', max: 3, since: 9,
    costs: [{ houndCore: 1 }, { houndCore: 1 }, { houndCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.03 }] },
  },
  {
    id: 'spidereye', category: 'skill', name: '蜘蛛の目', desc: '会心ダメージ +6%', max: 3, since: 9,
    costs: [{ spiderCore: 1 }, { spiderCore: 1 }, { spiderCore: 1 }],
    perLevel: { mods: [{ stat: 'critMul', add: 0.06 }] },
  },
  {
    id: 'giantbone', category: 'body', name: '巨躯の骨', desc: '最大HP +30', max: 3, since: 9,
    costs: [{ titanCore: 1 }, { titanCore: 1 }, { titanCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 30 }] },
  },
  {
    id: 'mothwing', category: 'gear', name: '夜蛾の翅', desc: 'ダッシュの回復 +4%', max: 3, since: 9,
    costs: [{ mothCore: 1 }, { mothCore: 1 }, { mothCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.04 }] },
  },
  {
    id: 'lightcollector', category: 'skill', name: '集光器', desc: '弱点を突いたときのダメージ +5%', max: 3, since: 9,
    costs: [{ lensCore: 1 }, { lensCore: 1 }, { lensCore: 1 }],
    perLevel: { mods: [{ stat: 'weakBonus', add: 0.05 }] },
  },
  {
    id: 'breakerplate', category: 'body', name: '遮断板', desc: '被弾後の無敵 +0.04秒', max: 3, since: 9,
    costs: [{ breakerCore: 1 }, { breakerCore: 1 }, { breakerCore: 1 }],
    perLevel: { mods: [{ stat: 'hurtInvincible', add: 0.04 }] },
  },
  {
    id: 'rustfilm', category: 'body', name: '錆止め膜', desc: '持続ダメージで受ける量 −5%', max: 3, since: 9,
    costs: [{ rustCore: 1 }, { rustCore: 1 }, { rustCore: 1 }],
    perLevel: { mods: [{ stat: 'dotResist', add: 0.05 }] },
  },
  {
    id: 'bufferfluid', category: 'skill', name: '緩衝液', desc: '状態異常の時間 +10%', max: 3, since: 9,
    costs: [{ bufferCore: 1 }, { bufferCore: 1 }, { bufferCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.1 }] },
  },
  {
    id: 'rainfilter', category: 'gear', name: '雨水濾過', desc: '修復キットの回復量 +8%', max: 3, since: 9,
    costs: [{ rainCore: 1 }, { rainCore: 1 }, { rainCore: 1 }],
    perLevel: { mods: [{ stat: 'kitBonus', add: 0.08 }] },
  },
  {
    id: 'intakevalve', category: 'skill', name: '吸気弁', desc: '攻撃力 +4%', max: 3, since: 9,
    costs: [{ intakeCore: 1 }, { intakeCore: 1 }, { intakeCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.04 }] },
  },
  {
    id: 'ductcore', category: 'body', name: '管の芯', desc: '最大HP +40', max: 3, since: 9,
    costs: [{ ductCore: 1 }, { ductCore: 1 }, { ductCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 40 }] },
  },
  {
    id: 'vanefeather', category: 'skill', name: '風見の羽', desc: '攻撃速度 +4%', max: 3, since: 9,
    costs: [{ vaneCore: 1 }, { vaneCore: 1 }, { vaneCore: 1 }],
    perLevel: { mods: [{ stat: 'attackSpeed', add: 0.04 }] },
  },
  {
    id: 'vortexring', category: 'gear', name: '渦の輪', desc: 'ダッシュの距離 +6%', max: 3, since: 9,
    costs: [{ cycloneCore: 1 }, { cycloneCore: 1 }, { cycloneCore: 1 }],
    perLevel: { mods: [{ stat: 'dashDistance', add: 0.06 }] },
  },
  {
    id: 'gatelock', category: 'body', name: '門の錠', desc: '被ダメージ −3%', max: 3, since: 9,
    costs: [{ gateCore: 1 }, { gateCore: 1 }, { gateCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.03 }] },
  },
  {
    id: 'blueprint', category: 'skill', name: '設計図', desc: '攻撃力 +5%', max: 3, since: 9,
    costs: [{ architectCore: 1 }, { architectCore: 1 }, { architectCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.05 }] },
  },
  {
    id: 'shadowfoot', category: 'gear', name: '影の足', desc: 'ダッシュの回復 +4%', max: 3, since: 9,
    costs: [{ nocturneCore: 1 }, { nocturneCore: 1 }, { nocturneCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.04 }] },
  },
  {
    id: 'catalystdust', category: 'skill', name: '触媒の粉', desc: '会心率 +2%', max: 3, since: 9,
    costs: [{ catalystCore: 1 }, { catalystCore: 1 }, { catalystCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.02 }] },
  },
  // 2種類の素材：1個ずつ（4〜5段目のマス）
  {
    id: 'trainingset', category: 'skill', name: '戦闘訓練', desc: '攻撃力 +5%', max: 2, since: 9,
    costs: [{ boarCore: 1, rainCore: 1 }, { boarCore: 1, rainCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.05 }] },
  },
  {
    id: 'reflexes', category: 'skill', name: '反射神経', desc: '会心率 +3%', max: 2, since: 9,
    costs: [{ cryoCore: 1, intakeCore: 1 }, { cryoCore: 1, intakeCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.03 }] },
  },
  {
    id: 'shockproof', category: 'body', name: '耐衝撃', desc: '被ダメージ −4%', max: 2, since: 9,
    costs: [{ overCore: 1, ductCore: 1 }, { overCore: 1, ductCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.04 }] },
  },
  {
    id: 'comboform', category: 'skill', name: '連撃の型', desc: '会心ダメージ +10%', max: 2, since: 9,
    costs: [{ serpentCore: 1, vaneCore: 1 }, { serpentCore: 1, vaneCore: 1 }],
    perLevel: { mods: [{ stat: 'critMul', add: 0.1 }] },
  },
  {
    id: 'heavyarmor', category: 'body', name: '重装', desc: '最大HP +50', max: 2, since: 9,
    costs: [{ crabCore: 1, cycloneCore: 1 }, { crabCore: 1, cycloneCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 50 }] },
  },
  {
    id: 'regenarmor', category: 'body', name: '再生装甲', desc: 'HP が毎秒 0.6 回復', max: 2, since: 9,
    costs: [{ hydraCore: 1, gateCore: 1 }, { hydraCore: 1, gateCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.6 }] },
  },
  {
    id: 'pursuit', category: 'skill', name: '追撃', desc: '攻撃力 +6%', max: 2, since: 9,
    costs: [{ houndCore: 1, architectCore: 1 }, { houndCore: 1, architectCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.06 }] },
  },
  {
    id: 'shadoweye', category: 'skill', name: '影の目', desc: '弱点を突いたときのダメージ +8%', max: 2, since: 9,
    costs: [{ spiderCore: 1, nocturneCore: 1 }, { spiderCore: 1, nocturneCore: 1 }],
    perLevel: { mods: [{ stat: 'weakBonus', add: 0.08 }] },
  },
  {
    id: 'catalystguard', category: 'body', name: '触媒耐性', desc: '状態異常の時間 +12%、持続ダメージで受ける量 −4%', max: 2, since: 9,
    costs: [{ titanCore: 1, catalystCore: 1 }, { titanCore: 1, catalystCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.12 }, { stat: 'dotResist', add: 0.04 }] },
  },
  {
    id: 'nightwind', category: 'gear', name: '夜風', desc: '移動速度 +4%', max: 2, since: 9,
    costs: [{ mothCore: 1, ductCore: 1 }, { mothCore: 1, ductCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.04 }] },
  },
  // 3種類の素材：1個ずつ（6段目のマス）
  {
    id: 'ironoath', category: 'body', name: '鉄の誓い', desc: '最大HP +100、被ダメージ −5%', max: 1, since: 9,
    treeMaxDepth: 6,
    costs: [{ boarCore: 1, titanCore: 1, gateCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 100 }, { stat: 'damageTaken', add: -0.05 }] },
  },
  {
    id: 'absoluteaim', category: 'skill', name: '絶対精度', desc: '会心率 +5%、会心ダメージ +20%', max: 1, since: 9,
    treeMaxDepth: 6,
    costs: [{ cryoCore: 1, lensCore: 1, cycloneCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.05 }, { stat: 'critMul', add: 0.2 }] },
  },
  {
    id: 'windfoot', category: 'gear', name: '風の足', desc: '移動速度 +8%、ダッシュの回復 +8%', max: 1, since: 9,
    treeMaxDepth: 6,
    costs: [{ houndCore: 1, ductCore: 1, vaneCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.08 }, { stat: 'dashHaste', add: 0.08 }] },
  },
  {
    id: 'fullguard', category: 'body', name: '完全防護', desc: '被ダメージ −6%', max: 1, since: 9,
    treeMaxDepth: 6,
    costs: [{ rustCore: 1, rainCore: 1, bufferCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.06 }] },
  },
  {
    id: 'limitbreak', category: 'skill', name: '極限', desc: '攻撃力 +10%', max: 1, since: 9,
    treeMaxDepth: 6,
    costs: [{ overCore: 1, serpentCore: 1, architectCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.1 }] },
  },
  {
    id: 'shadowart', category: 'skill', name: '影の極意', desc: '攻撃力 +8%、会心率 +4%', max: 1, since: 9,
    treeMaxDepth: 6,
    costs: [{ spiderCore: 1, nocturneCore: 1, catalystCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.08 }, { stat: 'critChance', add: 0.04 }] },
  },
  // ---- ここから、マップ7の周回に向けて足した強化（since: 10）。すべての素材ごとに2系統（第2層・第3層）＋ 2種類の組み合わせ ＋ 3種類の組み合わせ ----
  // 第2層：1種類の素材（3段）
  {
    id: 'l2-boar', category: 'skill', name: 'ボア・会心威力II', desc: '会心ダメージ +5%', max: 3, since: 10,
    costs: [{ boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }],
    perLevel: { mods: [{ stat: 'critMul', add: 0.05 }] },
  },
  {
    id: 'l2-cryo', category: 'skill', name: 'クライオ・弱点II', desc: '弱点を突いたときのダメージ +4%', max: 3, since: 10,
    costs: [{ cryoCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }],
    perLevel: { mods: [{ stat: 'weakBonus', add: 0.04 }] },
  },
  {
    id: 'l2-over', category: 'skill', name: 'オーバー・会心II', desc: '会心率 +1.2%', max: 3, since: 10,
    costs: [{ overCore: 1 }, { overCore: 1 }, { overCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.012 }] },
  },
  {
    id: 'l2-serpent', category: 'gear', name: 'サーペント・跳躍II', desc: 'ダッシュの距離 +4%', max: 3, since: 10,
    costs: [{ serpentCore: 1 }, { serpentCore: 1 }, { serpentCore: 1 }],
    perLevel: { mods: [{ stat: 'dashDistance', add: 0.04 }] },
  },
  {
    id: 'l2-crab', category: 'skill', name: 'クラブ・火力II', desc: '攻撃力 +3%', max: 3, since: 10,
    costs: [{ crabCore: 1 }, { crabCore: 1 }, { crabCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.03 }] },
  },
  {
    id: 'l2-hydra', category: 'gear', name: 'ハイドラ・回避II', desc: 'ダッシュの回復 +3%', max: 3, since: 10,
    costs: [{ hydraCore: 1 }, { hydraCore: 1 }, { hydraCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.03 }] },
  },
  {
    id: 'l2-hound', category: 'body', name: 'ハウンド・耐久II', desc: '最大HP +25', max: 3, since: 10,
    costs: [{ houndCore: 1 }, { houndCore: 1 }, { houndCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 25 }] },
  },
  {
    id: 'l2-spider', category: 'gear', name: 'スパイダー・脚力II', desc: '移動速度 +2%', max: 3, since: 10,
    costs: [{ spiderCore: 1 }, { spiderCore: 1 }, { spiderCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.02 }] },
  },
  {
    id: 'l2-titan', category: 'body', name: 'タイタン・猶予II', desc: '被弾後の無敵 +0.03秒', max: 3, since: 10,
    costs: [{ titanCore: 1 }, { titanCore: 1 }, { titanCore: 1 }],
    perLevel: { mods: [{ stat: 'hurtInvincible', add: 0.03 }] },
  },
  {
    id: 'l2-moth', category: 'body', name: 'モス・再生II', desc: 'HP が毎秒 0.25 回復', max: 3, since: 10,
    costs: [{ mothCore: 1 }, { mothCore: 1 }, { mothCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.25 }] },
  },
  {
    id: 'l2-lens', category: 'body', name: 'レンズ・耐性II', desc: '持続ダメージで受ける量 −4%', max: 3, since: 10,
    costs: [{ lensCore: 1 }, { lensCore: 1 }, { lensCore: 1 }],
    perLevel: { mods: [{ stat: 'dotResist', add: 0.04 }] },
  },
  {
    id: 'l2-breaker', category: 'body', name: 'ブレーカー・装甲II', desc: '被ダメージ −2%', max: 3, since: 10,
    costs: [{ breakerCore: 1 }, { breakerCore: 1 }, { breakerCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.02 }] },
  },
  {
    id: 'l2-rust', category: 'gear', name: 'ラスト・補給II', desc: '修復キットの回復量 +6%', max: 3, since: 10,
    costs: [{ rustCore: 1 }, { rustCore: 1 }, { rustCore: 1 }],
    perLevel: { mods: [{ stat: 'kitBonus', add: 0.06 }] },
  },
  {
    id: 'l2-buffer', category: 'skill', name: 'バッファー・連撃II', desc: '攻撃速度 +3%', max: 3, since: 10,
    costs: [{ bufferCore: 1 }, { bufferCore: 1 }, { bufferCore: 1 }],
    perLevel: { mods: [{ stat: 'attackSpeed', add: 0.03 }] },
  },
  {
    id: 'l2-rain', category: 'skill', name: 'レイン・状態II', desc: '状態異常の時間 +8%', max: 3, since: 10,
    costs: [{ rainCore: 1 }, { rainCore: 1 }, { rainCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.08 }] },
  },
  {
    id: 'l2-intake', category: 'skill', name: 'インテーク・会心威力II', desc: '会心ダメージ +5%', max: 3, since: 10,
    costs: [{ intakeCore: 1 }, { intakeCore: 1 }, { intakeCore: 1 }],
    perLevel: { mods: [{ stat: 'critMul', add: 0.05 }] },
  },
  {
    id: 'l2-duct', category: 'skill', name: 'ダクト・弱点II', desc: '弱点を突いたときのダメージ +4%', max: 3, since: 10,
    costs: [{ ductCore: 1 }, { ductCore: 1 }, { ductCore: 1 }],
    perLevel: { mods: [{ stat: 'weakBonus', add: 0.04 }] },
  },
  {
    id: 'l2-vane', category: 'skill', name: 'ベーン・会心II', desc: '会心率 +1.2%', max: 3, since: 10,
    costs: [{ vaneCore: 1 }, { vaneCore: 1 }, { vaneCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.012 }] },
  },
  {
    id: 'l2-cyclone', category: 'gear', name: 'サイクロン・跳躍II', desc: 'ダッシュの距離 +4%', max: 3, since: 10,
    costs: [{ cycloneCore: 1 }, { cycloneCore: 1 }, { cycloneCore: 1 }],
    perLevel: { mods: [{ stat: 'dashDistance', add: 0.04 }] },
  },
  {
    id: 'l2-gate', category: 'skill', name: 'ゲート・火力II', desc: '攻撃力 +3%', max: 3, since: 10,
    costs: [{ gateCore: 1 }, { gateCore: 1 }, { gateCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.03 }] },
  },
  {
    id: 'l2-archive', category: 'gear', name: 'アーカイブ・回避II', desc: 'ダッシュの回復 +3%', max: 3, since: 10,
    costs: [{ archiveCore: 1 }, { archiveCore: 1 }, { archiveCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.03 }] },
  },
  {
    id: 'l2-fab', category: 'body', name: 'ファブ・耐久II', desc: '最大HP +25', max: 3, since: 10,
    costs: [{ fabCore: 1 }, { fabCore: 1 }, { fabCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 25 }] },
  },
  {
    id: 'l2-cog', category: 'gear', name: 'コギト・脚力II', desc: '移動速度 +2%', max: 3, since: 10,
    costs: [{ cogCore: 1 }, { cogCore: 1 }, { cogCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.02 }] },
  },
  {
    id: 'l2-noise', category: 'body', name: 'ノイズ・猶予II', desc: '被弾後の無敵 +0.03秒', max: 3, since: 10,
    costs: [{ noiseCore: 1 }, { noiseCore: 1 }, { noiseCore: 1 }],
    perLevel: { mods: [{ stat: 'hurtInvincible', add: 0.03 }] },
  },
  {
    id: 'l2-architect', category: 'body', name: 'アーキテクト・再生II', desc: 'HP が毎秒 0.25 回復', max: 3, since: 10,
    costs: [{ architectCore: 1 }, { architectCore: 1 }, { architectCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.25 }] },
  },
  {
    id: 'l2-nocturne', category: 'body', name: 'ノクターン・耐性II', desc: '持続ダメージで受ける量 −4%', max: 3, since: 10,
    costs: [{ nocturneCore: 1 }, { nocturneCore: 1 }, { nocturneCore: 1 }],
    perLevel: { mods: [{ stat: 'dotResist', add: 0.04 }] },
  },
  {
    id: 'l2-catalyst', category: 'body', name: 'カタリスト・装甲II', desc: '被ダメージ −2%', max: 3, since: 10,
    costs: [{ catalystCore: 1 }, { catalystCore: 1 }, { catalystCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.02 }] },
  },
  // 第3層：1種類の素材（3段）
  {
    id: 'l3-boar', category: 'gear', name: 'ボア・回避III', desc: 'ダッシュの回復 +3%', max: 3, since: 10,
    costs: [{ boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.03 }] },
  },
  {
    id: 'l3-cryo', category: 'gear', name: 'クライオ・補給III', desc: '修復キットの回復量 +6%', max: 3, since: 10,
    costs: [{ cryoCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }],
    perLevel: { mods: [{ stat: 'kitBonus', add: 0.06 }] },
  },
  {
    id: 'l3-over', category: 'skill', name: 'オーバー・火力III', desc: '攻撃力 +3%', max: 3, since: 10,
    costs: [{ overCore: 1 }, { overCore: 1 }, { overCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.03 }] },
  },
  {
    id: 'l3-serpent', category: 'body', name: 'サーペント・装甲III', desc: '被ダメージ −2%', max: 3, since: 10,
    costs: [{ serpentCore: 1 }, { serpentCore: 1 }, { serpentCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.02 }] },
  },
  {
    id: 'l3-crab', category: 'gear', name: 'クラブ・跳躍III', desc: 'ダッシュの距離 +4%', max: 3, since: 10,
    costs: [{ crabCore: 1 }, { crabCore: 1 }, { crabCore: 1 }],
    perLevel: { mods: [{ stat: 'dashDistance', add: 0.04 }] },
  },
  {
    id: 'l3-hydra', category: 'body', name: 'ハイドラ・耐性III', desc: '持続ダメージで受ける量 −4%', max: 3, since: 10,
    costs: [{ hydraCore: 1 }, { hydraCore: 1 }, { hydraCore: 1 }],
    perLevel: { mods: [{ stat: 'dotResist', add: 0.04 }] },
  },
  {
    id: 'l3-hound', category: 'skill', name: 'ハウンド・会心III', desc: '会心率 +1.2%', max: 3, since: 10,
    costs: [{ houndCore: 1 }, { houndCore: 1 }, { houndCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.012 }] },
  },
  {
    id: 'l3-spider', category: 'body', name: 'スパイダー・再生III', desc: 'HP が毎秒 0.25 回復', max: 3, since: 10,
    costs: [{ spiderCore: 1 }, { spiderCore: 1 }, { spiderCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.25 }] },
  },
  {
    id: 'l3-titan', category: 'skill', name: 'タイタン・弱点III', desc: '弱点を突いたときのダメージ +4%', max: 3, since: 10,
    costs: [{ titanCore: 1 }, { titanCore: 1 }, { titanCore: 1 }],
    perLevel: { mods: [{ stat: 'weakBonus', add: 0.04 }] },
  },
  {
    id: 'l3-moth', category: 'body', name: 'モス・猶予III', desc: '被弾後の無敵 +0.03秒', max: 3, since: 10,
    costs: [{ mothCore: 1 }, { mothCore: 1 }, { mothCore: 1 }],
    perLevel: { mods: [{ stat: 'hurtInvincible', add: 0.03 }] },
  },
  {
    id: 'l3-lens', category: 'skill', name: 'レンズ・会心威力III', desc: '会心ダメージ +5%', max: 3, since: 10,
    costs: [{ lensCore: 1 }, { lensCore: 1 }, { lensCore: 1 }],
    perLevel: { mods: [{ stat: 'critMul', add: 0.05 }] },
  },
  {
    id: 'l3-breaker', category: 'gear', name: 'ブレーカー・脚力III', desc: '移動速度 +2%', max: 3, since: 10,
    costs: [{ breakerCore: 1 }, { breakerCore: 1 }, { breakerCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.02 }] },
  },
  {
    id: 'l3-rust', category: 'skill', name: 'ラスト・状態III', desc: '状態異常の時間 +8%', max: 3, since: 10,
    costs: [{ rustCore: 1 }, { rustCore: 1 }, { rustCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.08 }] },
  },
  {
    id: 'l3-buffer', category: 'body', name: 'バッファー・耐久III', desc: '最大HP +25', max: 3, since: 10,
    costs: [{ bufferCore: 1 }, { bufferCore: 1 }, { bufferCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 25 }] },
  },
  {
    id: 'l3-rain', category: 'skill', name: 'レイン・連撃III', desc: '攻撃速度 +3%', max: 3, since: 10,
    costs: [{ rainCore: 1 }, { rainCore: 1 }, { rainCore: 1 }],
    perLevel: { mods: [{ stat: 'attackSpeed', add: 0.03 }] },
  },
  {
    id: 'l3-intake', category: 'gear', name: 'インテーク・回避III', desc: 'ダッシュの回復 +3%', max: 3, since: 10,
    costs: [{ intakeCore: 1 }, { intakeCore: 1 }, { intakeCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.03 }] },
  },
  {
    id: 'l3-duct', category: 'gear', name: 'ダクト・補給III', desc: '修復キットの回復量 +6%', max: 3, since: 10,
    costs: [{ ductCore: 1 }, { ductCore: 1 }, { ductCore: 1 }],
    perLevel: { mods: [{ stat: 'kitBonus', add: 0.06 }] },
  },
  {
    id: 'l3-vane', category: 'skill', name: 'ベーン・火力III', desc: '攻撃力 +3%', max: 3, since: 10,
    costs: [{ vaneCore: 1 }, { vaneCore: 1 }, { vaneCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.03 }] },
  },
  {
    id: 'l3-cyclone', category: 'body', name: 'サイクロン・装甲III', desc: '被ダメージ −2%', max: 3, since: 10,
    costs: [{ cycloneCore: 1 }, { cycloneCore: 1 }, { cycloneCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.02 }] },
  },
  {
    id: 'l3-gate', category: 'gear', name: 'ゲート・跳躍III', desc: 'ダッシュの距離 +4%', max: 3, since: 10,
    costs: [{ gateCore: 1 }, { gateCore: 1 }, { gateCore: 1 }],
    perLevel: { mods: [{ stat: 'dashDistance', add: 0.04 }] },
  },
  {
    id: 'l3-archive', category: 'body', name: 'アーカイブ・耐性III', desc: '持続ダメージで受ける量 −4%', max: 3, since: 10,
    costs: [{ archiveCore: 1 }, { archiveCore: 1 }, { archiveCore: 1 }],
    perLevel: { mods: [{ stat: 'dotResist', add: 0.04 }] },
  },
  {
    id: 'l3-fab', category: 'skill', name: 'ファブ・会心III', desc: '会心率 +1.2%', max: 3, since: 10,
    costs: [{ fabCore: 1 }, { fabCore: 1 }, { fabCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.012 }] },
  },
  {
    id: 'l3-cog', category: 'body', name: 'コギト・再生III', desc: 'HP が毎秒 0.25 回復', max: 3, since: 10,
    costs: [{ cogCore: 1 }, { cogCore: 1 }, { cogCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.25 }] },
  },
  {
    id: 'l3-noise', category: 'skill', name: 'ノイズ・弱点III', desc: '弱点を突いたときのダメージ +4%', max: 3, since: 10,
    costs: [{ noiseCore: 1 }, { noiseCore: 1 }, { noiseCore: 1 }],
    perLevel: { mods: [{ stat: 'weakBonus', add: 0.04 }] },
  },
  {
    id: 'l3-architect', category: 'body', name: 'アーキテクト・猶予III', desc: '被弾後の無敵 +0.03秒', max: 3, since: 10,
    costs: [{ architectCore: 1 }, { architectCore: 1 }, { architectCore: 1 }],
    perLevel: { mods: [{ stat: 'hurtInvincible', add: 0.03 }] },
  },
  {
    id: 'l3-nocturne', category: 'skill', name: 'ノクターン・会心威力III', desc: '会心ダメージ +5%', max: 3, since: 10,
    costs: [{ nocturneCore: 1 }, { nocturneCore: 1 }, { nocturneCore: 1 }],
    perLevel: { mods: [{ stat: 'critMul', add: 0.05 }] },
  },
  {
    id: 'l3-catalyst', category: 'gear', name: 'カタリスト・脚力III', desc: '移動速度 +2%', max: 3, since: 10,
    costs: [{ catalystCore: 1 }, { catalystCore: 1 }, { catalystCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.02 }] },
  },
  // 2種類の素材（2段）
  {
    id: 'pr-boar-buffer', category: 'skill', name: 'ボア×バッファー・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ boarCore: 1, bufferCore: 1 }, { boarCore: 1, bufferCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-cryo-rain', category: 'body', name: 'クライオ×レイン・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ cryoCore: 1, rainCore: 1 }, { cryoCore: 1, rainCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-over-intake', category: 'skill', name: 'オーバー×インテーク・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ overCore: 1, intakeCore: 1 }, { overCore: 1, intakeCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  {
    id: 'pr-serpent-duct', category: 'skill', name: 'サーペント×ダクト・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ serpentCore: 1, ductCore: 1 }, { serpentCore: 1, ductCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-crab-vane', category: 'body', name: 'クラブ×ベーン・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ crabCore: 1, vaneCore: 1 }, { crabCore: 1, vaneCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-hydra-cyclone', category: 'skill', name: 'ハイドラ×サイクロン・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ hydraCore: 1, cycloneCore: 1 }, { hydraCore: 1, cycloneCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  {
    id: 'pr-hound-gate', category: 'skill', name: 'ハウンド×ゲート・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ houndCore: 1, gateCore: 1 }, { houndCore: 1, gateCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-spider-archive', category: 'body', name: 'スパイダー×アーカイブ・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ spiderCore: 1, archiveCore: 1 }, { spiderCore: 1, archiveCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-titan-fab', category: 'skill', name: 'タイタン×ファブ・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ titanCore: 1, fabCore: 1 }, { titanCore: 1, fabCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  {
    id: 'pr-moth-cog', category: 'skill', name: 'モス×コギト・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ mothCore: 1, cogCore: 1 }, { mothCore: 1, cogCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-lens-noise', category: 'body', name: 'レンズ×ノイズ・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ lensCore: 1, noiseCore: 1 }, { lensCore: 1, noiseCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-breaker-architect', category: 'skill', name: 'ブレーカー×アーキテクト・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ breakerCore: 1, architectCore: 1 }, { breakerCore: 1, architectCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  {
    id: 'pr-rust-nocturne', category: 'skill', name: 'ラスト×ノクターン・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ rustCore: 1, nocturneCore: 1 }, { rustCore: 1, nocturneCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-buffer-catalyst', category: 'body', name: 'バッファー×カタリスト・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ bufferCore: 1, catalystCore: 1 }, { bufferCore: 1, catalystCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-rain-boar', category: 'skill', name: 'レイン×ボア・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ rainCore: 1, boarCore: 1 }, { rainCore: 1, boarCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  {
    id: 'pr-intake-cryo', category: 'skill', name: 'インテーク×クライオ・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ intakeCore: 1, cryoCore: 1 }, { intakeCore: 1, cryoCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-duct-over', category: 'body', name: 'ダクト×オーバー・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ ductCore: 1, overCore: 1 }, { ductCore: 1, overCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-vane-serpent', category: 'skill', name: 'ベーン×サーペント・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ vaneCore: 1, serpentCore: 1 }, { vaneCore: 1, serpentCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  {
    id: 'pr-cyclone-crab', category: 'skill', name: 'サイクロン×クラブ・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ cycloneCore: 1, crabCore: 1 }, { cycloneCore: 1, crabCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-gate-hydra', category: 'body', name: 'ゲート×ハイドラ・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ gateCore: 1, hydraCore: 1 }, { gateCore: 1, hydraCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-archive-hound', category: 'skill', name: 'アーカイブ×ハウンド・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ archiveCore: 1, houndCore: 1 }, { archiveCore: 1, houndCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  {
    id: 'pr-fab-spider', category: 'skill', name: 'ファブ×スパイダー・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ fabCore: 1, spiderCore: 1 }, { fabCore: 1, spiderCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-cog-titan', category: 'body', name: 'コギト×タイタン・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ cogCore: 1, titanCore: 1 }, { cogCore: 1, titanCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-noise-moth', category: 'skill', name: 'ノイズ×モス・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ noiseCore: 1, mothCore: 1 }, { noiseCore: 1, mothCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  {
    id: 'pr-architect-lens', category: 'skill', name: 'アーキテクト×レンズ・火力', desc: '攻撃力 +3.6%、HP が毎秒 0.3 回復', max: 2, since: 10,
    costs: [{ architectCore: 1, lensCore: 1 }, { architectCore: 1, lensCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.036 }, { stat: 'hpRegen', add: 0.3 }] },
  },
  {
    id: 'pr-nocturne-breaker', category: 'body', name: 'ノクターン×ブレーカー・再生', desc: 'HP が毎秒 0.45 回復', max: 2, since: 10,
    costs: [{ nocturneCore: 1, breakerCore: 1 }, { nocturneCore: 1, breakerCore: 1 }],
    perLevel: { mods: [{ stat: 'hpRegen', add: 0.45 }] },
  },
  {
    id: 'pr-catalyst-rust', category: 'skill', name: 'カタリスト×ラスト・状態', desc: '状態異常の時間 +14.4%', max: 2, since: 10,
    costs: [{ catalystCore: 1, rustCore: 1 }, { catalystCore: 1, rustCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.144 }] },
  },
  // 3種類の素材（1段）
  {
    id: 'tr-boar-moth-cyclone', category: 'skill', name: 'ボモサの極意・会心', desc: '会心率 +3.6%、ダッシュの距離 +12%', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ boarCore: 1, mothCore: 1, cycloneCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.036 }, { stat: 'dashDistance', add: 0.12 }] },
  },
  {
    id: 'tr-cryo-lens-gate', category: 'body', name: 'クレゲの極意・装甲', desc: '被ダメージ −6%、修復キットの回復量 +18%', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ cryoCore: 1, lensCore: 1, gateCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.06 }, { stat: 'kitBonus', add: 0.18 }] },
  },
  {
    id: 'tr-over-breaker-archive', category: 'gear', name: 'オブアの極意・回避', desc: 'ダッシュの回復 +9%、最大HP +75', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ overCore: 1, breakerCore: 1, archiveCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.09 }, { stat: 'maxHp', add: 75 }] },
  },
  {
    id: 'tr-serpent-rust-fab', category: 'skill', name: 'サラフの極意・状態', desc: '状態異常の時間 +24%、会心ダメージ +15%', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ serpentCore: 1, rustCore: 1, fabCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.24 }, { stat: 'critMul', add: 0.15 }] },
  },
  {
    id: 'tr-crab-buffer-cog', category: 'body', name: 'クバコの極意・猶予', desc: '被弾後の無敵 +0.09秒、HP が毎秒 0.75 回復', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ crabCore: 1, bufferCore: 1, cogCore: 1 }],
    perLevel: { mods: [{ stat: 'hurtInvincible', add: 0.09 }, { stat: 'hpRegen', add: 0.75 }] },
  },
  {
    id: 'tr-hydra-rain-noise', category: 'skill', name: 'ハレノの極意・会心', desc: '会心率 +3.6%、ダッシュの距離 +12%', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ hydraCore: 1, rainCore: 1, noiseCore: 1 }],
    perLevel: { mods: [{ stat: 'critChance', add: 0.036 }, { stat: 'dashDistance', add: 0.12 }] },
  },
  {
    id: 'tr-hound-intake-architect', category: 'body', name: 'ハイアの極意・装甲', desc: '被ダメージ −6%、修復キットの回復量 +18%', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ houndCore: 1, intakeCore: 1, architectCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.06 }, { stat: 'kitBonus', add: 0.18 }] },
  },
  {
    id: 'tr-spider-duct-nocturne', category: 'gear', name: 'スダノの極意・回避', desc: 'ダッシュの回復 +9%、最大HP +75', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ spiderCore: 1, ductCore: 1, nocturneCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.09 }, { stat: 'maxHp', add: 75 }] },
  },
  {
    id: 'tr-titan-vane-catalyst', category: 'skill', name: 'タベカの極意・状態', desc: '状態異常の時間 +24%、会心ダメージ +15%', max: 1, since: 10,
    treeMaxDepth: 6,
    costs: [{ titanCore: 1, vaneCore: 1, catalystCore: 1 }],
    perLevel: { mods: [{ stat: 'statusTime', add: 0.24 }, { stat: 'critMul', add: 0.15 }] },
  },
];

// 武器の解放
export const weaponUnlocks = [
  { weapon: 'greatsword', name: '大剣', note: '重い一撃と溜め斬り', cost: null },
  { weapon: 'sword', name: '片手剣', note: '手数とジャストガード', cost: { boarCore: 2 } },
  { weapon: 'gun', name: '銃', note: '遠距離と拡散射撃', cost: { cryoCore: 2 } },
  { weapon: 'knuckle', name: 'ナックル', note: '超高速の拳とバーストブロー', cost: { serpentCore: 2 } },
  { weapon: 'cannon', name: '大砲', note: '爆発する砲弾と徹甲砲撃', cost: { crabCore: 2 } },
  { weapon: 'spear', name: '槍', note: '貫く突きと突進突き', cost: { titanCore: 2 } },
  { weapon: 'chakram', name: 'チャクラム', note: '戻ってくる輪と設置', cost: { mothCore: 2 } },
  { weapon: 'drone', name: 'ドローンユニット', note: '子機が自動で撃つ。帰還シールド', cost: { rainCore: 2 } },
];
