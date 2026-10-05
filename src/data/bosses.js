// ボスの定義。攻撃パターンの組み合わせと順番を書く（M2 から追加）
// 1件 = { id, ... } の形で足す。
//
// attacks: このボスが使う攻撃。pattern は部品の名前（src/game/bossPatterns.js）
//   charge    : 予告線 → 突進 → 硬直。壁に当たるとスタン。repeat で連続回数
//   shockwave : 足元に予告 → 衝撃波の輪が広がる → 硬直
//   cone      : 扇形の予告 → その範囲に噴射し続ける → 硬直。slow: true なら当たると減速
//   slam      : 自分の周りに円の予告 → その範囲を一度に攻撃 → 硬直
//   rain      : 落下地点の予告を次々に出し、少し遅れてそこに落ちてくる → 硬直
//   laser     : 細い線の予告 → 太いレーザーが turn 度ぶん回転する → 硬直
//   summon    : 予告 → 雑魚を count 体呼ぶ（部屋にいる雑魚が max 体を超えない範囲で）→ 硬直
//   vent      : duration 秒のあいだ動けない（大きな隙）。その間は体に触れても安全
//   barrage   : 予告 → 弾をばらまく。spread 360 で全方向、それより小さいとプレイヤーへ扇形。waves 回、rotate 度ずつずらして撃つ
//   leap      : プレイヤーの場所に着地点の予告 → 跳ぶ → 着地で周りを攻撃。ring を書くと衝撃波の輪も出る
//   lines     : 部屋を横切る線を count 本、順に光らせる。orient: aim / horizontal / vertical / cross
//   pools     : その場に残る危険な床を count 個置く。slow: true なら踏むと減速
//   girder    : 予告の線に沿って、杭の列（壁）を張る。lines 本。杭は post の敵（置かれたもの）で、gap の幅の隙間が gaps か所ある。部屋に残せるのは max 本まで
//   magnet    : duration 秒のあいだ、プレイヤーを strength の速さで引き寄せる（ダッシュ中は引かれない）。最後に radius の範囲を叩く
//   burrow    : 潜って姿を消し（その間は攻撃が当たらない）、予告の円から飛び出して周りを攻撃する。repeat で連続回数。pool を書くと、飛び出した場所に床が残る
// shield: { arc } を書くと、正面のその角度（度）からの武器の攻撃を防ぐ（甲羅）。硬直中は開いて防げない
// heads: { enemy, count, orbit, reduce } を書くと、体から首が生える。首が残っている間、本体へのダメージが reduce の割合だけ減る
// turnRate: 攻撃の合間に向きを変える速さ（ラジアン/秒）。書かなければ、すぐにプレイヤーのほうを向く
// phases: HP の割合で切り替わる行動。上から順に見て、残りHPの割合が hpAbove より大きい最初のものを使う
//   sequence : attacks の名前を出す順番（最後まで行ったら最初に戻る）
//   idle     : 攻撃と攻撃の間に歩いて近づく時間（秒）
//   speed    : この段階の速さの倍率（予告も攻撃も、合間の時間も速くなる）
//   noShield : true なら、この段階では甲羅で防げない
//   regrow   : この段階では、倒された首がこの秒数ごとに1本ずつ生え直す
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
    hp: 2100,
    speed: 70,
    contactDamage: 26,
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
        damage: 38,
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
        damage: 38,
        recover: 0.8,
        wallStun: 1.6,
      },
      stomp: {
        pattern: 'shockwave',
        telegraph: 0.8,
        damage: 22,
        ringSpeed: 330, // 輪が広がる速さ（px/秒）
        ringMax: 320, // 輪が消える半径
        ringWidth: 14,
        recover: 0.9,
      },
      // 放電弾：全方向に火花を飛ばす
      sparks: { pattern: 'barrage', telegraph: 0.7, count: 10, spread: 360, waves: 1, shotSpeed: 230, shotRadius: 7, damage: 22, recover: 0.7 },
      sparksHard: { pattern: 'barrage', telegraph: 0.6, count: 10, spread: 360, waves: 3, interval: 0.45, rotate: 18, shotSpeed: 250, shotRadius: 7, damage: 22, recover: 0.8 },
      // 落雷の列：プレイヤーの場所から順に、突進の向きと平行な雷が落ちる
      thunder: { pattern: 'lines', telegraph: 0.6, orient: 'aim', count: 3, spacing: 110, width: 34, delay: 0.8, stagger: 0.25, damage: 30, recover: 0.8 },
      thunderHard: { pattern: 'lines', telegraph: 0.5, orient: 'aim', count: 5, spacing: 95, width: 34, delay: 0.7, stagger: 0.2, damage: 30, recover: 0.8 },
      // 跳びかかり：着地で周りを攻撃し、衝撃波の輪が広がる
      leap: { pattern: 'leap', telegraph: 0.9, lockTime: 0.3, air: 0.5, radius: 105, damage: 38, ring: { speed: 300, max: 260, width: 14, damage: 22 }, recover: 0.9 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.3, max: 2.2 }, sequence: ['charge', 'sparks', 'charge', 'stomp', 'thunder'] },
      {
        hpAbove: 0,
        idle: { min: 1.0, max: 1.6 },
        sequence: ['doubleCharge', 'leap', 'sparksHard', 'doubleCharge', 'thunderHard', 'stomp', 'leap'],
        announce: '暴走',
      },
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
    hp: 3400,
    speed: 96,
    contactDamage: 31,
    xp: 200,
    credits: 90,
    drops: { count: 3, rarityBonus: 1 },
    attacks: {
      // 冷気ブレス
      breath: { pattern: 'cone', telegraph: 0.9, lockTime: 0.3, range: 400, arc: 54, duration: 1.1, damage: 26, slow: true, recover: 0.7 },
      // 尻尾なぎ払い
      sweep: { pattern: 'slam', telegraph: 0.65, radius: 135, damage: 36, recover: 0.6 },
      // 氷柱の雨
      icicles: { pattern: 'rain', telegraph: 0.4, count: 7, interval: 0.28, delay: 0.85, radius: 36, spread: 60, damage: 29, recover: 0.7 },
      iciclesHard: { pattern: 'rain', telegraph: 0.3, count: 11, interval: 0.2, delay: 0.8, radius: 36, spread: 80, damage: 29, recover: 0.6 },
      // 滑空：部屋を一直線に飛び抜ける。壁に当たると、少しだけ隙ができる
      dive: { pattern: 'charge', telegraph: 0.75, lockTime: 0.25, speed: 680, duration: 0.8, damage: 34, recover: 0.6, wallStun: 0.8 },
      // 氷の破片：プレイヤーへ扇形に3回撃つ。当たると減速
      shards: { pattern: 'barrage', telegraph: 0.6, lockTime: 0.15, count: 5, spread: 50, waves: 3, interval: 0.4, track: true, shotSpeed: 300, shotRadius: 7, damage: 22, slow: true, recover: 0.7 },
      // 霜だまり：踏むと減速してダメージを受ける床が、しばらく残る
      frost: { pattern: 'pools', telegraph: 0.6, count: 4, radius: 56, spread: 130, arm: 0.9, life: 6, tick: 0.6, damage: 14, slow: true, recover: 0.6 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, sequence: ['breath', 'shards', 'icicles', 'sweep', 'dive'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.4 },
        sequence: ['iciclesHard', 'dive', 'breath', 'frost', 'sweep', 'shards', 'breath'],
        announce: '凍結開始',
        arena: { inset: 90, seconds: 22 },
      },
    ],
  },
  {
    id: 'overload',
    name: 'オーバーロード',
    alias: '統合管理機構', // 登場時に出す異名
    shape: 'core',
    color: 'heat',
    weakness: 'shock',
    material: 'overCore',
    radius: 48,
    hp: 5500,
    speed: 34,
    contactDamage: 36,
    xp: 300,
    credits: 150,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // レーザーの回転掃射
      laser: { pattern: 'laser', telegraph: 0.9, lead: 55, turn: 190, speed: 95, width: 22, range: 1100, damage: 34, recover: 0.7 },
      // ドローン召喚
      summon: { pattern: 'summon', telegraph: 0.7, enemy: 'drone', count: 3, max: 6, recover: 0.6 },
      // 全体衝撃波（部屋の端まで届く輪。ダッシュの無敵ですり抜ける）
      nova: { pattern: 'shockwave', telegraph: 0.9, damage: 29, ringSpeed: 340, ringMax: 980, ringWidth: 16, recover: 0.8 },
      // 冷却：数秒の大きな隙
      vent: { pattern: 'vent', duration: 3.6 },
      // 格子レーザー：横と縦の線が、プレイヤーの場所から順に交互に光る
      grid: { pattern: 'lines', telegraph: 0.6, orient: 'cross', count: 6, spacing: 120, width: 30, delay: 0.85, stagger: 0.22, damage: 34, recover: 0.7 },
      // うずまき弾：全方向の弾を、少しずつ向きをずらして撃ち続ける
      spiral: { pattern: 'barrage', telegraph: 0.7, count: 8, spread: 360, waves: 6, interval: 0.28, rotate: 13, shotSpeed: 210, shotRadius: 7, damage: 26, recover: 0.8 },
      // 過熱床：踏むとダメージを受ける床が、しばらく残る
      scorch: { pattern: 'pools', telegraph: 0.6, count: 5, radius: 60, spread: 150, arm: 1.0, life: 7, tick: 0.5, damage: 18, recover: 0.6 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.8 }, sequence: ['laser', 'summon', 'spiral', 'nova', 'grid'] },
      // オーバーヒート：攻撃が速くなるが、3回攻撃するたびに冷却の隙ができる
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.1 },
        speed: 1.4,
        sequence: ['laser', 'nova', 'grid', 'vent', 'summon', 'spiral', 'laser', 'vent', 'scorch', 'nova', 'grid', 'vent'],
        announce: 'オーバーヒート',
      },
    ],
  },
  // ---- ここからマップ2「排水区」 ----
  {
    id: 'pipeserpent',
    name: 'パイプサーペント',
    alias: '配管呑み', // 登場時に出す異名
    shape: 'serpent',
    color: 'green',
    weakness: 'shock',
    material: 'serpentCore',
    radius: 34,
    hp: 4600,
    speed: 88,
    contactDamage: 34,
    xp: 240,
    credits: 110,
    drops: { count: 3, rarityBonus: 1 },
    attacks: {
      // 部屋を横切る突進。壁に当たると少し隙ができる
      lunge: { pattern: 'charge', telegraph: 0.75, lockTime: 0.25, speed: 640, duration: 0.85, damage: 40, recover: 0.6, wallStun: 1.2 },
      // 汚水の噴射（当たると減速）
      spit: { pattern: 'cone', telegraph: 0.8, lockTime: 0.3, range: 360, arc: 50, duration: 1.0, damage: 28, slow: true, recover: 0.7 },
      // 毒液の弾：プレイヤーへ扇形に撃つ
      venom: { pattern: 'barrage', telegraph: 0.6, lockTime: 0.15, count: 7, spread: 70, waves: 2, interval: 0.45, track: true, shotSpeed: 270, shotRadius: 7, damage: 26, recover: 0.7 },
      venomHard: { pattern: 'barrage', telegraph: 0.5, lockTime: 0.15, count: 9, spread: 90, waves: 3, interval: 0.4, track: true, shotSpeed: 290, shotRadius: 7, damage: 26, recover: 0.7 },
      // 潜行：配管に潜って姿を消し、プレイヤーの足元から飛び出す
      burrow: { pattern: 'burrow', dive: 0.5, under: 1.3, lockTime: 0.45, radius: 92, damage: 38, repeat: 1, recover: 1.0 },
      burrowHard: {
        pattern: 'burrow', dive: 0.4, under: 1.1, lockTime: 0.4, radius: 92, damage: 38, repeat: 2, recover: 1.0,
        pool: { radius: 70, arm: 0.2, life: 6, tick: 0.5, damage: 16, slow: true },
      },
      // 汚水の床をばらまく
      sludge: { pattern: 'pools', telegraph: 0.6, count: 5, radius: 54, spread: 150, arm: 0.9, life: 6, tick: 0.5, damage: 16, slow: true, recover: 0.6 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.1, max: 1.8 }, sequence: ['lunge', 'spit', 'burrow', 'venom', 'lunge'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.3 },
        sequence: ['burrowHard', 'spit', 'lunge', 'venomHard', 'burrowHard', 'sludge'],
        announce: '詰まり検知',
      },
    ],
  },
  {
    id: 'tankcrab',
    name: 'タンククラブ',
    alias: '水門の番', // 登場時に出す異名
    shape: 'crab',
    color: 'amber',
    weakness: 'cold',
    material: 'crabCore',
    radius: 46,
    hp: 5600,
    speed: 62,
    contactDamage: 36,
    xp: 300,
    credits: 140,
    drops: { count: 3, rarityBonus: 1 },
    shield: { arc: 170 }, // 甲羅：正面からの武器の攻撃を防ぐ
    turnRate: 1.5, // 向きを変えるのは遅いので、背後に回り込める
    attacks: {
      // はさみのなぎ払い：正面の広い扇
      pinch: { pattern: 'cone', telegraph: 0.75, lockTime: 0.3, range: 170, arc: 110, duration: 0.25, damage: 42, recover: 1.1 },
      // 水圧：横と縦の線が、プレイヤーの場所から交互に走る
      jets: { pattern: 'lines', telegraph: 0.6, orient: 'cross', count: 4, spacing: 130, width: 30, delay: 0.85, stagger: 0.25, damage: 34, recover: 1.0 },
      jetsHard: { pattern: 'lines', telegraph: 0.5, orient: 'cross', count: 6, spacing: 115, width: 30, delay: 0.8, stagger: 0.2, damage: 34, recover: 0.9 },
      // 跳びかかり：着地で周りを攻撃し、衝撃波の輪が広がる
      leap: { pattern: 'leap', telegraph: 0.95, lockTime: 0.3, air: 0.55, radius: 120, damage: 42, ring: { speed: 300, max: 300, width: 14, damage: 24 }, recover: 1.2 },
      // 泡：全方向に、遅い弾をばらまく
      bubbles: { pattern: 'barrage', telegraph: 0.7, count: 12, spread: 360, waves: 2, interval: 0.6, rotate: 15, shotSpeed: 150, shotRadius: 9, shotLife: 6, damage: 26, recover: 1.0 },
      bubblesHard: { pattern: 'barrage', telegraph: 0.6, count: 14, spread: 360, waves: 3, interval: 0.5, rotate: 13, shotSpeed: 170, shotRadius: 9, shotLife: 6, damage: 26, recover: 0.9 },
      // 横走り：甲羅が割れたあとの突進
      scuttle: { pattern: 'charge', repeat: 2, repeatTelegraph: 0.45, telegraph: 0.65, lockTime: 0.2, speed: 560, duration: 0.7, damage: 40, recover: 0.8, wallStun: 1.3 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, sequence: ['pinch', 'jets', 'leap', 'pinch', 'bubbles'] },
      // 甲羅が割れる：防げなくなる代わりに、攻撃が速くなる
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.3 },
        speed: 1.3,
        noShield: true,
        sequence: ['leap', 'scuttle', 'jetsHard', 'pinch', 'bubblesHard', 'scuttle'],
        announce: '甲羅破損',
      },
    ],
  },
  {
    id: 'sludgehydra',
    name: 'スラッジハイドラ',
    alias: '汚泥の多頭', // 登場時に出す異名
    shape: 'hydra',
    color: 'magenta',
    weakness: 'heat',
    material: 'hydraCore',
    radius: 50,
    hp: 5200,
    speed: 26,
    contactDamage: 38,
    xp: 360,
    credits: 180,
    drops: { count: 3, rarityBonus: 2 },
    // 首：3本。体の前側に付いて、弾を吐く。残っている間は、本体へのダメージが 75% 減る
    heads: { enemy: 'hydrahead', count: 3, orbit: 78, reduce: 0.75 },
    attacks: {
      // 汚泥の落下
      drop: { pattern: 'rain', telegraph: 0.4, count: 8, interval: 0.3, delay: 0.9, radius: 40, spread: 80, damage: 32, recover: 0.8 },
      dropHard: { pattern: 'rain', telegraph: 0.3, count: 13, interval: 0.2, delay: 0.85, radius: 40, spread: 110, damage: 32, recover: 0.7 },
      // うずまきの弾
      spiral: { pattern: 'barrage', telegraph: 0.7, count: 8, spread: 360, waves: 5, interval: 0.32, rotate: 14, shotSpeed: 200, shotRadius: 7, damage: 28, recover: 0.9 },
      spiralHard: { pattern: 'barrage', telegraph: 0.6, count: 10, spread: 360, waves: 7, interval: 0.26, rotate: 11, shotSpeed: 220, shotRadius: 7, damage: 28, recover: 0.8 },
      // ぬかるみ：踏むと減速してダメージを受ける床
      mire: { pattern: 'pools', telegraph: 0.6, count: 5, radius: 58, spread: 150, arm: 0.9, life: 7, tick: 0.5, damage: 16, slow: true, recover: 0.7 },
      // 体のまわりを叩く
      slam: { pattern: 'slam', telegraph: 0.8, radius: 165, damage: 42, recover: 1.0 },
      // 汚泥のしずくを生む
      spawn: { pattern: 'summon', telegraph: 0.7, enemy: 'sludgelet', count: 3, max: 8, recover: 0.7 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, sequence: ['drop', 'spiral', 'mire', 'slam', 'spawn'] },
      // 再生：倒された首が、時間で生え直す
      {
        hpAbove: 0,
        idle: { min: 0.9, max: 1.4 },
        regrow: 9,
        sequence: ['dropHard', 'spiral', 'slam', 'mire', 'spawn', 'spiralHard'],
        announce: '再生開始',
      },
    ],
  },
  // ---- ここからマップ3「建設区」 ----
  {
    id: 'scraphound',
    name: 'スクラップハウンド',
    alias: '資材喰い', // 登場時に出す異名
    shape: 'hound',
    color: 'red',
    weakness: 'cold',
    material: 'houndCore',
    radius: 34,
    hp: 7400,
    speed: 128,
    contactDamage: 40,
    xp: 400,
    credits: 200,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 飛びかかり：短い予告で跳んでくる
      pounce: { pattern: 'leap', telegraph: 0.65, lockTime: 0.25, air: 0.38, radius: 92, damage: 44, recover: 0.6 },
      // 3連続の突進。壁に当たると隙ができる
      triple: { pattern: 'charge', repeat: 3, repeatTelegraph: 0.35, telegraph: 0.6, lockTime: 0.18, speed: 660, duration: 0.5, damage: 42, recover: 0.8, wallStun: 1.2 },
      // 鉄くずの弾：プレイヤーへ扇形に
      scrap: { pattern: 'barrage', telegraph: 0.55, lockTime: 0.15, count: 5, spread: 56, waves: 2, interval: 0.35, track: true, shotSpeed: 330, shotRadius: 7, damage: 30, recover: 0.6 },
      scrapHard: { pattern: 'barrage', telegraph: 0.45, lockTime: 0.15, count: 7, spread: 76, waves: 3, interval: 0.3, track: true, shotSpeed: 350, shotRadius: 7, damage: 30, recover: 0.6 },
      // 周囲への一撃
      howl: { pattern: 'slam', telegraph: 0.7, radius: 150, damage: 44, recover: 0.9 },
      // 磁力：引き寄せてから、周りを叩く
      magnet: { pattern: 'magnet', telegraph: 0.6, duration: 2.6, strength: 130, radius: 135, damage: 46, recover: 1.1 },
      magnetHard: { pattern: 'magnet', telegraph: 0.5, duration: 2.4, strength: 175, radius: 150, damage: 46, recover: 1.0 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 0.9, max: 1.5 }, sequence: ['pounce', 'scrap', 'triple', 'magnet', 'howl'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.1 },
        speed: 1.2,
        sequence: ['magnetHard', 'pounce', 'triple', 'scrapHard', 'pounce', 'howl'],
        announce: '不足検知',
      },
    ],
  },
  {
    id: 'girderspider',
    name: 'ガーダースパイダー',
    alias: '橋げた張り', // 登場時に出す異名
    shape: 'spider',
    color: 'ice',
    weakness: 'heat',
    material: 'spiderCore',
    radius: 40,
    hp: 8200,
    speed: 92,
    contactDamage: 40,
    xp: 440,
    credits: 220,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 糸の弾：プレイヤーへ扇形に。当たると減速
      web: { pattern: 'barrage', telegraph: 0.6, lockTime: 0.15, count: 5, spread: 60, waves: 3, interval: 0.4, track: true, shotSpeed: 280, shotRadius: 8, damage: 28, slow: true, recover: 0.7 },
      // 跳びかかり
      leap: { pattern: 'leap', telegraph: 0.8, lockTime: 0.3, air: 0.45, radius: 105, damage: 46, recover: 0.8 },
      // 脚の突き：正面の細い扇
      stab: { pattern: 'cone', telegraph: 0.6, lockTime: 0.25, range: 210, arc: 40, duration: 0.2, damage: 46, recover: 0.8 },
      // 子蜘蛛を生む
      brood: { pattern: 'summon', telegraph: 0.7, enemy: 'spiderling', count: 3, max: 6, recover: 0.7 },
      // 橋げた：部屋を横切る壁を張る
      girder: { pattern: 'girder', telegraph: 1.0, lines: 2, offset: 110, spacing: 34, gap: 96, gaps: 2, max: 46, post: 'girderpost', recover: 0.8 },
      girderHard: { pattern: 'girder', telegraph: 0.8, lines: 3, offset: 100, spacing: 34, gap: 90, gaps: 2, max: 60, post: 'girderpost', recover: 0.7 },
      // 突進（後半）：2連続
      rush: { pattern: 'charge', repeat: 2, repeatTelegraph: 0.4, telegraph: 0.6, lockTime: 0.2, speed: 620, duration: 0.6, damage: 44, recover: 0.8, wallStun: 1.2 },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, sequence: ['web', 'girder', 'leap', 'stab', 'brood'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.2 },
        sequence: ['girderHard', 'leap', 'web', 'rush', 'brood', 'stab'],
        announce: '架設続行',
      },
    ],
  },
];
