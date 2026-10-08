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
];

// 武器の解放
export const weaponUnlocks = [
  { weapon: 'greatsword', name: '大剣', note: '重い一撃と溜め斬り', cost: null },
  { weapon: 'sword', name: '片手剣', note: '手数とジャストガード', cost: { boarCore: 2 } },
  { weapon: 'gun', name: '銃', note: '遠距離と拡散射撃', cost: { cryoCore: 2 } },
  { weapon: 'knuckle', name: 'ナックル', note: '超高速の拳とバーストブロー', cost: { serpentCore: 2 } },
  { weapon: 'cannon', name: '大砲', note: '爆発する砲弾と徹甲砲撃', cost: { crabCore: 2 } },
];
