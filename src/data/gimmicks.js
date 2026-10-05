// 部屋の仕掛けの定義（2026-10-06 追加）
// 戦闘部屋の一部に、その土地ならではの仕掛けが付く。1件 = { id, ... } の形で足す。
// どのエリアで、どのくらいの確率で付くかは、エリアの定義（src/data/areas.js）の gimmicks に書く。
//
//   name : 部屋に入ったときの区画名に出す名前
//   part : 動かし方の部品（src/game/gimmicks.js の GIMMICK_PARTS の名前）
// part が fallingMarks のとき（予告つきで、ものが落ちてくる）：
//   interval    : 落ちてくる間隔（秒）
//   count       : 1回に落ちる数（1つ目はプレイヤーの近く、残りは部屋のどこか）
//   spread      : プレイヤーの近くに落とすときの、ずれの大きさ
//   radius      : 当たる範囲
//   delay       : 予告が出てから落ちるまで（秒）
//   damage      : プレイヤーへのダメージ / enemyDamage : 敵へのダメージ
export const gimmicks = [
  {
    id: 'girders',
    name: '落下物注意',
    part: 'fallingMarks',
    interval: 2.8,
    count: 2,
    spread: 70,
    radius: 44,
    delay: 1.15,
    damage: 28,
    enemyDamage: 70,
    color: 'amber',
  },
];
