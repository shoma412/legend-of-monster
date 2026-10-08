// 武器の定義（M1 で大剣、M6 で片手剣と銃）
// 1件 = { id, ... } の形で足す。
//
// type: melee（近接。combo を順に出す）/ ranged（遠距離。shot を撃ち続ける）
// special.type は特殊アクションの部品の名前（src/game/player.js の SPECIALS）
//   charge : 左クリック長押しで溜めて斬る（大剣）
//   guard  : 右クリックで少しの間だけ構え、攻撃を受けると無効化して反撃（片手剣）
//   spread : 右クリックで扇状に同時に撃つ（銃）
//   siege  : 右クリックで溜め始め、少しして、敵をすべて貫く砲弾を撃つ（大砲）
//   burst  : 敵に当てるたびにゲージが溜まり、満タンで右クリックの強烈な一撃（ナックル）
//   dashthrust : 右クリックで、向いている方向へ踏み込み、通り道の敵すべてにダメージ。踏み込んでいる間は無敵（槍）
//   plant  : 右クリックで、少し前に、回り続ける輪を置く。中の敵を削り続ける（チャクラム）
// shot（遠距離の武器の弾）: damage / interval 撃つ間隔(秒) / speed / radius / life / knockback
//   boomerang: { range, back } 投げて戻ってくる輪（チャクラム）。range px 飛ぶか壁に当たると、back の速さで手元へ戻る。敵をすべて貫き、行きと帰りで2回当たる。戻るまで、次は投げられない
//   explode: { radius, damage } 当たった場所で爆発して、まわりの敵にもダメージ / recoil: 撃ったときに後ろへ下がる距離(px) / firing: 撃ったあと足が遅くなる時間(秒)
// guardBreak: 盾や甲羅で防がれたときに通るダメージの割合（書いていなければ 0 ＝ 完全に防がれる）
// dashSpeed: ダッシュの速さの倍率（書いていなければ 1）。小さいほど、同じ距離を進むのに時間がかかる
// autoCombo: true なら、左クリックを押している間、通常攻撃を出し続ける（ナックル）
// ougi は奥義（今は大剣だけ）
// special.hint は画面下の操作説明に出す文
//
// combo: 通常攻撃（左クリック）の段。順番に出る
//   damage 威力 / range 届く距離(px) / arc 扇の広さ(度)
//   windup 振りかぶり(秒) / swing 振っている時間(秒) / recover 振った後の硬直(秒)
//   knockback 吹き飛ばす強さ / lunge 踏み込む距離(px) / heavy 重い一撃（演出が強くなる）
// special: 特殊アクション
export const weapons = [
  {
    id: 'greatsword',
    name: '大剣',
    type: 'melee',
    guardBreak: 0.5, // 盾や甲羅で防がれても、この割合のダメージが通る（重い武器だけ）
    // この武器を持っている間のステータス補正（重装：打たれ強いが足が遅い）
    mods: [{ stat: 'damageTaken', add: -0.1 }, { stat: 'moveSpeedMul', add: -0.05 }],
    // 奥義（恒久強化「大剣の奥義」を買うと使える）：残りHPが hpBelow 以下のとき、エリアごとに1回だけ、
    // 右クリックで自分を中心とした円の衝撃波を出す。威力は damage × multiplier
    ougi: { name: '奥義', hpBelow: 0.2, damage: 120, multiplier: 1.75, radius: 260, knockback: 900, invincible: 0.6 },
    moveSlow: 0.55, // 振っている間の移動速度の倍率（2026-10-09：0.45 から上げた。当てやすくするため）
    comboReset: 0.7, // この秒数攻撃しないと1段目に戻る
    combo: [
      { damage: 30, range: 80, arc: 45, windup: 0.1, swing: 0.2, recover: 0.26, knockback: 380, lunge: 16 },
      { damage: 34, range: 80, arc: 45, windup: 0.1, swing: 0.2, recover: 0.28, knockback: 400, lunge: 16 },
      { damage: 50, range: 94, arc: 90, windup: 0.15, swing: 0.24, recover: 0.42, knockback: 600, lunge: 24, heavy: true },
    ],
    special: {
      type: 'charge',
      name: '溜め斬り',
      hint: '左クリック長押し 溜め斬り',
      cooldown: 4, // 秒
      moveSlow: 0.5, // 溜めている間の移動速度の倍率
      damage: 40, // これに段階ごとの倍率がかかる
      swing: 0.28,
      recover: 0.4,
      knockback: 720,
      // 角度は、同じ段の通常攻撃の角度にこの倍率を掛けたもの（1段階目 = 通常1段目の1.15倍 …）
      arcScale: 1.15,
      // time 秒溜めるとその段階になる。1段階目に届く前に離すと不発（クールダウンなし）
      stages: [
        { time: 0.35, multiplier: 1.5, range: 96 },
        { time: 0.75, multiplier: 2.2, range: 112 },
        { time: 1.2, multiplier: 3, range: 132 },
      ],
    },
  },
  {
    id: 'sword',
    name: '片手剣',
    mods: [{ stat: 'moveSpeedMul', add: 0.05 }], // 身軽
    type: 'melee',
    moveSlow: 0.8, // 振っている間の移動速度の倍率
    comboReset: 0.6,
    // 速い4段コンボ。4段目だけ威力1.5倍
    combo: [
      { damage: 12, range: 58, arc: 70, windup: 0.04, swing: 0.1, recover: 0.07, knockback: 160, lunge: 10 },
      { damage: 12, range: 58, arc: 70, windup: 0.04, swing: 0.1, recover: 0.07, knockback: 160, lunge: 10 },
      { damage: 12, range: 58, arc: 70, windup: 0.04, swing: 0.1, recover: 0.07, knockback: 160, lunge: 10 },
      { damage: 18, range: 66, arc: 110, windup: 0.06, swing: 0.14, recover: 0.2, knockback: 340, lunge: 18, heavy: true },
    ],
    special: {
      type: 'guard',
      name: 'ジャストガード',
      hint: '右クリック ジャストガード',
      window: 0.15, // 構えている時間（秒）。この間に攻撃を受けると成功
      moveSlow: 0.3, // 構えている間の移動速度の倍率
      cooldown: 2.5, // 秒
      successCooldown: 0.4, // 成功したときのクールダウン（秒）
      invincible: 0.5, // 成功したあとの無敵（秒）
      // 反撃：周囲を斬り払う
      counter: { damage: 45, range: 96, arc: 360, swing: 0.2, recover: 0.12, knockback: 520 },
    },
  },
  {
    id: 'gun',
    name: '銃',
    type: 'ranged',
    mods: [{ stat: 'damageTaken', add: 0.1 }], // 打たれ弱い
    moveSlow: 0.8, // 撃っている間の移動速度の倍率
    // ハンドガン。左クリックを押している間、撃ち続ける
    shot: { damage: 14, interval: 0.28, speed: 640, radius: 4, life: 0.9, knockback: 110 },
    special: {
      type: 'spread',
      name: '拡散射撃',
      hint: '右クリック 拡散射撃',
      cooldown: 3, // 秒
      count: 5, // 同時に撃つ数
      angle: 50, // 扇の広さ（度）
      damage: 14, // 1発あたり
      recover: 0.3, // 撃ったあと、通常の弾が撃てるようになるまで（秒）
    },
  },
  {
    id: 'knuckle',
    name: 'ナックル',
    type: 'melee',
    mods: [{ stat: 'moveSpeedMul', add: 0.1 }, { stat: 'damageTaken', add: 0.05 }], // いちばん身軽。少し打たれ弱い
    moveSlow: 0.9, // 殴っている間の移動速度の倍率（ほとんど落ちない）
    comboReset: 0.45,
    autoCombo: true, // 押している間、殴り続ける
    // とても速い4段。ジャブ3発と、締めのフック。射程はいちばん短い
    combo: [
      { damage: 8, range: 42, arc: 80, windup: 0.02, swing: 0.06, recover: 0.04, knockback: 90, lunge: 8 },
      { damage: 8, range: 42, arc: 80, windup: 0.02, swing: 0.06, recover: 0.04, knockback: 90, lunge: 8 },
      { damage: 8, range: 42, arc: 80, windup: 0.02, swing: 0.06, recover: 0.04, knockback: 90, lunge: 8 },
      { damage: 13, range: 48, arc: 120, windup: 0.03, swing: 0.08, recover: 0.12, knockback: 300, lunge: 12, heavy: true },
    ],
    special: {
      type: 'burst',
      name: 'バーストブロー',
      hint: '右クリック バーストブロー（ゲージ満タンで）',
      cooldown: 0.5, // 撃ったあと、次に撃てるようになるまで（秒）。ゲージが要るので、短くてよい
      gaugeMax: 100,
      // 2026-10-09：4・8 から下げた（殴り続けて満タンになるまでが、約5秒 → 約7秒に）
      gain: 3, // 通常攻撃を当てるたびに溜まる量（1回の攻撃で何体に当てても同じ）
      gainHeavy: 6, // フックを当てたときに溜まる量
      hold: 3, // この秒数、敵に当てないでいると、ゲージが減り始める
      decay: 20, // 減る速さ（1秒あたり）
      // 一撃：前に踏み込んで殴る
      blow: { damage: 140, range: 86, arc: 110, windup: 0.08, swing: 0.16, recover: 0.3, knockback: 820, lunge: 46 },
      invincible: 0.35, // 撃っている間の無敵（秒）
    },
  },
  {
    id: 'cannon',
    name: '大砲',
    type: 'ranged',
    mods: [{ stat: 'moveSpeedMul', add: -0.3 }], // いちばん足が遅い
    guardBreak: 0.5, // 盾や甲羅で防がれても、この割合のダメージが通る（重い武器だけ）
    dashSpeed: 0.6, // ダッシュの速さの倍率（進む距離と無敵の時間は同じで、かかる時間が延びる。終わりぎわは無敵が切れている）
    moveSlow: 0.45, // 撃った直後の移動速度の倍率
    // 遅くて大きい砲弾。1発の威力は大剣の通常攻撃より高い。当たると爆発して、まわりの敵も巻き込む
    shot: {
      damage: 60, interval: 1.3, speed: 430, radius: 9, life: 1.8, knockback: 520, heavy: true,
      explode: { radius: 72, damage: 30 },
      recoil: 22,
      firing: 0.4,
    },
    special: {
      type: 'siege',
      name: '徹甲砲撃',
      hint: '右クリック 徹甲砲撃（溜めて撃つ）',
      cooldown: 7, // 秒
      charge: 0.95, // 溜める時間（秒）
      moveSlow: 0.15, // 溜めている間の移動速度の倍率
      // 敵をすべて貫く太い砲弾。大剣の溜め斬りの最大（120）より高い
      shot: { damage: 170, speed: 980, radius: 15, life: 1.2, knockback: 900, heavy: true, pierceAll: true, recoil: 44, firing: 0.5 },
    },
  },
  {
    // 槍（2026-10-09 追加）：前へ長く、横に狭い突き。届く範囲の敵を、すべて貫く
    id: 'spear',
    name: '槍',
    type: 'melee',
    mods: [{ stat: 'critChance', add: 0.05 }, { stat: 'damageTaken', add: 0.05 }], // 急所を狙える。少し打たれ弱い
    moveSlow: 0.7, // 突いている間の移動速度の倍率
    comboReset: 0.6,
    combo: [
      { damage: 20, range: 130, arc: 16, windup: 0.06, swing: 0.12, recover: 0.14, knockback: 220, lunge: 12 },
      { damage: 20, range: 130, arc: 16, windup: 0.06, swing: 0.12, recover: 0.14, knockback: 220, lunge: 12 },
      { damage: 30, range: 150, arc: 16, windup: 0.1, swing: 0.16, recover: 0.3, knockback: 460, lunge: 22, heavy: true },
    ],
    special: {
      type: 'dashthrust',
      name: '突進突き',
      hint: '右クリック 突進突き',
      cooldown: 5, // 秒
      distance: 190, // 踏み込む距離（px）
      duration: 0.2, // 踏み込みにかかる時間（秒）。この間は無敵
      width: 26, // 通り道の、当たる幅（自分の中心からの距離。敵の大きさのぶんは足す）
      damage: 70,
      knockback: 560,
      moveSlow: 0, // 踏み込んでいる間は、向きを変えられない
    },
  },
  {
    // チャクラム（2026-10-09 追加）：投げて、戻ってくる輪。行きと帰りで2回当たる
    id: 'chakram',
    name: 'チャクラム',
    type: 'ranged',
    mods: [{ stat: 'moveSpeedMul', add: 0.05 }, { stat: 'damageTaken', add: 0.05 }], // 身軽。少し打たれ弱い
    moveSlow: 0.85, // 投げた直後の移動速度の倍率
    shot: {
      // 2026-10-09：威力 22 → 28、戻りの速さ 680 → 820（7種類の中で、いちばん弱かったため）
      damage: 28, interval: 0.2, speed: 560, radius: 13, life: 30, knockback: 150,
      boomerang: { range: 300, back: 820 },
    },
    special: {
      type: 'plant',
      name: '設置',
      hint: '右クリック 回る輪を置く',
      cooldown: 8, // 秒
      offset: 84, // 自分の少し前（px）に置く
      radius: 66,
      life: 5, // 秒
      damage: 8, // tick 秒ごと
      tick: 0.25,
      maxPlaced: 1, // 続けて置ける数（恒久強化「二枚刃」で 2 になる）
    },
  },
];
