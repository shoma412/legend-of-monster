// ボスの定義。攻撃パターンの組み合わせと順番を書く（M2 から追加）
// 1件 = { id, ... } の形で足す。
//
// attacks: このボスが使う攻撃。pattern は部品の名前（src/game/bossPatterns.js）
//   charge    : 予告線 → 突進 → 硬直。壁に当たるとスタン。repeat で連続回数
//   shockwave : 足元に予告 → 衝撃波の輪が広がる → 硬直
//   cone      : 扇形の予告 → その範囲に噴射し続ける → 硬直。slow: true なら当たると減速
//   slam      : 自分の周りに円の予告 → その範囲を一度に攻撃 → 硬直
//   rain      : 落下地点の予告を次々に出し、少し遅れてそこに落ちてくる → 硬直
// phases: HP の割合で切り替わる行動。上から順に見て、残りHPの割合が hpAbove より大きい最初のものを使う
//   sequence : attacks の名前を出す順番（最後まで行ったら最初に戻る）
//   idle     : 攻撃と攻撃の間に歩いて近づく時間（秒）
//   arena    : この段階に入ると、部屋の端から inset px まで seconds 秒かけて凍りつき、動ける範囲が狭まる
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
  {
    id: 'cryowyvern',
    name: 'クライオ・ワイバーン',
    alias: '冷却塔の主', // 登場時に出す異名
    shape: 'wyvern',
    color: 'cold',
    weakness: 'heat',
    material: 'cryoCore',
    radius: 38,
    hp: 1800,
    speed: 96,
    contactDamage: 26,
    xp: 200,
    credits: 90,
    drops: { count: 3, rarityBonus: 1 },
    attacks: {
      // 冷気ブレス
      breath: { pattern: 'cone', telegraph: 0.9, lockTime: 0.3, range: 400, arc: 54, duration: 1.1, damage: 22, slow: true, recover: 0.7 },
      // 尻尾なぎ払い
      sweep: { pattern: 'slam', telegraph: 0.65, radius: 135, damage: 30, recover: 0.6 },
      // 氷柱の雨
      icicles: { pattern: 'rain', telegraph: 0.4, count: 7, interval: 0.28, delay: 0.85, radius: 36, spread: 60, damage: 24, recover: 0.7 },
      iciclesHard: { pattern: 'rain', telegraph: 0.3, count: 11, interval: 0.2, delay: 0.8, radius: 36, spread: 80, damage: 24, recover: 0.6 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, sequence: ['breath', 'icicles', 'sweep'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.4 },
        sequence: ['iciclesHard', 'breath', 'sweep', 'breath'],
        announce: '凍結開始',
        arena: { inset: 90, seconds: 22 },
      },
    ],
  },
];
