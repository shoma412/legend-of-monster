// 隠れ家の恒久強化の定義（M5 で追加）
// 1件 = { id, ... } の形で足す。
//
// max      : 段階の数
// costs    : 1段ごとの必要素材（1段目, 2段目, …）。{ 素材のid: 個数 }
// perLevel : 1段ごとの効果
//   mods        : ステータス補正（インプラントや装備と同じ書き方）
//   kits        : ラン開始時の修復キットの数に足す
//   startChoice : true なら、ラン開始時にインプラントを1つ選べる
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
    id: 'ougi-greatsword', name: '大剣の奥義', desc: '溜め斬りが強化版になる', max: 1,
    costs: [{ overCore: 1 }],
    perLevel: {},
    ready: false,
  },
];

// 武器の解放。ready: false はまだ実装していない武器（M6）
export const weaponUnlocks = [
  { weapon: 'greatsword', name: '大剣', note: '重い一撃と溜め斬り', cost: null },
  { weapon: 'sword', name: '片手剣', note: '手数とジャストガード', cost: { boarCore: 2 }, ready: false },
  { weapon: 'gun', name: '銃', note: '遠距離と拡散射撃', cost: { cryoCore: 2 }, ready: false },
];
