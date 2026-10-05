// 隠れ家の恒久強化の定義（M5 で追加）
// 1件 = { id, ... } の形で足す。
//
// max      : 段階の数
// costs    : 1段ごとの必要素材（1段目, 2段目, …）。{ 素材のid: 個数 }
// perLevel : 1段ごとの効果
//   mods        : ステータス補正（インプラントや装備と同じ書き方）
//   kits        : ラン開始時の修復キットの数に足す
//   startChoice : true なら、ラン開始時にインプラントを1つ選べる
//   ougi        : その武器の奥義が使えるようになる（武器の id）
//   carrySlots  : 持ち込みの種族の枠を増やす数
// ready: false は、まだ中身ができていないもの（隠れ家には「準備中」と出て、買えない）
export const upgrades = [
  {
    id: 'frame', name: '強化骨格', desc: '最大HP +10', max: 5,
    costs: [{ boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }, { boarCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 10 }] },
  },
  {
    id: 'nerve', name: '神経加速', desc: '攻撃力 +5%', max: 5,
    costs: [{ boarCore: 1 }, { boarCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }, { cryoCore: 1 }],
    perLevel: { mods: [{ stat: 'attackMul', add: 0.05 }] },
  },
  {
    id: 'kitslot', name: '修復キット増設', desc: 'ラン開始時の修復キット +1', max: 2,
    costs: [{ cryoCore: 2 }, { cryoCore: 2 }],
    perLevel: { kits: 1 },
  },
  {
    id: 'doubledash', name: '二重ダッシュ', desc: 'ダッシュを2回連続で使える', max: 1,
    costs: [{ cryoCore: 3 }],
    perLevel: { mods: [{ stat: 'dashCharges', add: 1 }] },
  },
  {
    id: 'bootprogram', name: '起動プログラム', desc: 'ラン開始時にインプラントを1つ選んで始められる', max: 1,
    costs: [{ overCore: 1 }],
    perLevel: { startChoice: true },
  },
  {
    id: 'ougi-greatsword', name: '大剣の奥義', desc: '残りHP20%以下のとき、エリアごとに1回、右クリックで周囲に衝撃波（攻撃力1.75倍）', max: 1,
    costs: [{ overCore: 1 }],
    perLevel: { ougi: 'greatsword' },
  },
  {
    id: 'joints', name: '関節強化', desc: 'ダッシュの回復が 10% 速くなる', max: 3,
    costs: [{ serpentCore: 1 }, { serpentCore: 1 }, { serpentCore: 1 }],
    perLevel: { mods: [{ stat: 'dashHaste', add: 0.1 }] },
  },
  {
    id: 'armorplate', name: '装甲板', desc: '被ダメージ −3%', max: 3,
    costs: [{ crabCore: 1 }, { crabCore: 1 }, { crabCore: 1 }],
    perLevel: { mods: [{ stat: 'damageTaken', add: -0.03 }] },
  },
  {
    id: 'regentank', name: '再生槽', desc: '最大HP +15', max: 2,
    costs: [{ hydraCore: 1 }, { hydraCore: 1 }],
    perLevel: { mods: [{ stat: 'maxHp', add: 15 }] },
  },
  {
    id: 'carryslot', name: '部品棚の増設', desc: '持ち込みの種族の枠が2つになる', max: 1,
    costs: [{ hydraCore: 2 }],
    perLevel: { carrySlots: 1 },
  },
  {
    id: 'legs', name: '脚部強化', desc: '移動速度 +3%', max: 3,
    costs: [{ houndCore: 1 }, { houndCore: 1 }, { houndCore: 1 }],
    perLevel: { mods: [{ stat: 'moveSpeedMul', add: 0.03 }] },
  },
];

// 武器の解放
export const weaponUnlocks = [
  { weapon: 'greatsword', name: '大剣', note: '重い一撃と溜め斬り', cost: null },
  { weapon: 'sword', name: '片手剣', note: '手数とジャストガード', cost: { boarCore: 2 } },
  { weapon: 'gun', name: '銃', note: '遠距離と拡散射撃', cost: { cryoCore: 2 } },
];
