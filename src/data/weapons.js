// 武器の定義（M1 で大剣、M6 で片手剣と弓）
// 1件 = { id, ... } の形で足す。
//
// combo: 通常攻撃（左クリック）の段。順番に出る
//   damage 威力 / range 届く距離(px) / arc 扇の広さ(度)
//   windup 振りかぶり(秒) / swing 振っている時間(秒) / recover 振った後の硬直(秒)
//   knockback 吹き飛ばす強さ / lunge 踏み込む距離(px) / heavy 重い一撃（演出が強くなる）
// special: 特殊攻撃（大剣は左クリック長押し）
export const weapons = [
  {
    id: 'greatsword',
    name: '大剣',
    type: 'melee',
    moveSlow: 0.45, // 振っている間の移動速度の倍率
    comboReset: 0.7, // この秒数攻撃しないと1段目に戻る
    combo: [
      { damage: 30, range: 80, arc: 150, windup: 0.1, swing: 0.2, recover: 0.26, knockback: 380, lunge: 16 },
      { damage: 34, range: 80, arc: 150, windup: 0.1, swing: 0.2, recover: 0.28, knockback: 400, lunge: 16 },
      { damage: 50, range: 94, arc: 220, windup: 0.15, swing: 0.24, recover: 0.42, knockback: 600, lunge: 24, heavy: true },
    ],
    special: {
      type: 'charge',
      name: '溜め斬り',
      cooldown: 4, // 秒
      moveSlow: 0.5, // 溜めている間の移動速度の倍率
      damage: 40, // これに段階ごとの倍率がかかる
      swing: 0.28,
      recover: 0.4,
      knockback: 720,
      // time 秒溜めるとその段階になる。1段階目に届く前に離すと不発（クールダウンなし）
      stages: [
        { time: 0.35, multiplier: 1.5, range: 96, arc: 200 },
        { time: 0.75, multiplier: 2.2, range: 112, arc: 260 },
        { time: 1.2, multiplier: 3, range: 132, arc: 360 },
      ],
    },
  },
];
