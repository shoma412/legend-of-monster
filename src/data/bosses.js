// ボスの定義。攻撃パターンの組み合わせと順番を書く（M2 から追加）
// 1件 = { id, ... } の形で足す。
//
// attacks: このボスが使う攻撃。pattern は部品の名前（src/game/bossPatterns.js）
//   charge    : 予告線 → 突進 → 硬直。壁に当たるとスタン。repeat で連続回数
//   shockwave : 足元に予告 → 衝撃波の輪が広がる → 硬直
// phases: HP の割合で切り替わる行動。上から順に見て、残りHPの割合が hpAbove より大きい最初のものを使う
//   sequence : attacks の名前を出す順番（最後まで行ったら最初に戻る）
//   idle     : 攻撃と攻撃の間に歩いて近づく時間（秒）
export const bosses = [
  {
    id: 'boltboar',
    name: 'ボルトボア',
    alias: '電線喰らい', // 登場時に出す異名
    shape: 'boar',
    color: 'shock',
    weakness: 'cold',
    material: 'boarCore', // 倒すと持ち帰れるボス素材（src/data/story.js の materials）
    radius: 42,
    hp: 1100,
    speed: 70,
    contactDamage: 22,
    xp: 120,
    credits: 60,
    drops: { count: 3, rarityBonus: 1 }, // 倒すと必ず落とす装備の数と、レア度の底上げ
    attacks: {
      charge: {
        pattern: 'charge',
        telegraph: 0.8, // 予告の時間（秒）
        lockTime: 0.25, // 予告の最後のこの時間は向きを変えない
        speed: 560,
        duration: 0.9,
        damage: 32,
        recover: 0.7,
        wallStun: 1.6, // 壁に当たったときのスタン（秒）
      },
      doubleCharge: {
        pattern: 'charge',
        repeat: 2,
        repeatTelegraph: 0.5, // 2回目以降の予告（秒）
        telegraph: 0.7,
        lockTime: 0.2,
        speed: 600,
        duration: 0.9,
        damage: 32,
        recover: 0.8,
        wallStun: 1.6,
      },
      stomp: {
        pattern: 'shockwave',
        telegraph: 0.8,
        damage: 18,
        ringSpeed: 330, // 輪が広がる速さ（px/秒）
        ringMax: 320, // 輪が消える半径
        ringWidth: 14,
        recover: 0.9,
      },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.3, max: 2.2 }, sequence: ['charge', 'charge', 'stomp'] },
      { hpAbove: 0, idle: { min: 1.0, max: 1.6 }, sequence: ['doubleCharge', 'stomp', 'doubleCharge', 'doubleCharge', 'stomp'], announce: '暴走' },
    ],
  },
];
