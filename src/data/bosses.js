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
//   pendulum  : 吊ったフックが、予告の線の上を passes 回、行ったり来たりする。lines 本（1本目は横、2本目は縦）。プレイヤーのいる場所を通る
//   girder    : 予告の線に沿って、杭の列（壁）を張る。lines 本。杭は post の敵（置かれたもの）で、gap の幅の隙間が gaps か所ある。部屋に残せるのは max 本まで
//   magnet    : duration 秒のあいだ、プレイヤーを strength の速さで引き寄せる（ダッシュ中は引かれない）。最後に radius の範囲を叩く
//   endure    : 大技「耐える」。duration 秒溜める。その間に最大HPの break の割合だけダメージを与えると中断でき、stun 秒のスタン。中断できないと、輪が blast.count 回広がる
//   safezone  : 大技「安全地帯」。部屋全体が危険になり、zones 個の円（radius）の中だけが助かる。waves 回くり返す
//   chase     : 大技「追尾」。照準の円が count 個、プレイヤーを follow 秒追い、lock 秒止まってから攻撃する
//   orbit     : 固有（スクラップハウンド）。体のまわりを刃が count 枚回り、その間もプレイヤーを追う。当たると持続ダメージ（dot）
//   wires     : 固有（ガーダースパイダー）。部屋を横切る糸を count 本張る。life 秒残り、触れている間は減速と、tick 秒ごとのダメージ
//   weld      : 固有（クレーンタイタン）。ビームがプレイヤーをゆっくり追って回る（turn 度/秒）。通ったあとに燃える床（trail）が残る
//   cells     : 固有（アーキテクト）。部屋をマスに分け、市松模様の半分 → 残りの半分の順に攻撃する（waves 回）
//   ink       : 固有（アーキテクト）。足元から広がっていく床を置く。中にいると持続ダメージ
//   dot       : 持続ダメージの種類（balance の STATUS.dots：burn 炎上 / bleed 裂傷 / corrode 腐食）。ダッシュすると消える
//   douse     : 固有（ランプイーター）。非常灯を消して1本を壊し（breakAll なら全部）、暗闇の中で位置を変えてから、突進を lunges 回
//   scales    : 固有（ランプイーター）。鱗粉の雲を count 個まく。中にいると「目くらみ」（見える範囲が狭くなる）
//   burrow    : 潜って姿を消し（その間は攻撃が当たらない）、予告の円から飛び出して周りを攻撃する。repeat で連続回数。pool を書くと、飛び出した場所に床が残る
// shield: { arc } を書くと、正面のその角度（度）からの武器の攻撃を防ぐ（甲羅）。硬直中は開いて防げない
// heads: { enemy, count, orbit, reduce } を書くと、体から首が生える。首が残っている間、本体へのダメージが reduce の割合だけ減る
// turnRate: 攻撃の合間に向きを変える速さ（ラジアン/秒）。書かなければ、すぐにプレイヤーのほうを向く
// 攻撃に reach: 'near' / 'far' を書くと、プレイヤーが近い・遠いときに出やすくなる（書かなければ、いつでも同じ）
// reactions: プレイヤーが同じ動きを続けたときに返す技。when は 'far'（離れ続ける）か 'behind'（背後に居続ける）、seconds 秒続くと move を出す
// ultimate: { move, announce } HP が残りわずか（balance の BOSS_AI.ultimateAt）になると、1回だけ使う大技
// phases: HP の割合で切り替わる行動。上から順に見て、残りHPの割合が hpAbove より大きい最初のものを使う
//   moves    : この段階で使う技（attacks の名前）。この中から、状況に合うものを抽選する（src/logic/bossAi.js）
//   combos   : 連携。[{ moves: [技, 技] }] と書くと、間を空けずに続けて出す。締めのあとは長めの隙ができる
//   side     : 重ねる攻撃。{ moves: [技…], every: { min, max } } と書くと、本体の行動とは別に、その間隔（秒）で差し込まれる
//   rest     : { after, move } after 回攻撃するごとに、必ず move（冷却の隙）を出す
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
        reach: 'far',
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
        reach: 'far',
      },
      stomp: {
        pattern: 'shockwave',
        telegraph: 0.8,
        damage: 22,
        ringSpeed: 330, // 輪が広がる速さ（px/秒）
        ringMax: 320, // 輪が消える半径
        ringWidth: 14,
        recover: 0.9,
        reach: 'near',
      },
      // 放電弾：全方向に火花を飛ばす
      sparks: { pattern: 'barrage', telegraph: 0.7, count: 10, spread: 360, waves: 1, shotSpeed: 230, shotRadius: 7, damage: 22, recover: 0.7 },
      sparksHard: { pattern: 'barrage', telegraph: 0.6, count: 10, spread: 360, waves: 3, interval: 0.45, rotate: 18, shotSpeed: 250, shotRadius: 7, damage: 22, recover: 0.8 },
      // 落雷の列：プレイヤーの場所から順に、突進の向きと平行な雷が落ちる
      thunder: { pattern: 'lines', telegraph: 0.6, orient: 'aim', count: 3, spacing: 110, width: 34, delay: 0.8, stagger: 0.25, damage: 30, recover: 0.8 },
      thunderHard: { pattern: 'lines', telegraph: 0.5, orient: 'aim', count: 5, spacing: 95, width: 34, delay: 0.7, stagger: 0.2, damage: 30, recover: 0.8 },
      // 跳びかかり：着地で周りを攻撃し、衝撃波の輪が広がる
      leap: { pattern: 'leap', telegraph: 0.9, lockTime: 0.3, air: 0.5, radius: 105, damage: 38, ring: { speed: 300, max: 260, width: 14, damage: 22 }, recover: 0.9, reach: 'far' },
      // 大技「過充電」：溜めている間、放電弾が出る。溜めきると、部屋の端まで届く輪が3回広がる
      overcharge: {
        pattern: 'endure', telegraph: 0.8, duration: 5, break: 0.06, stun: 4, recover: 1.2,
        pulse: { move: 'sparks', interval: 1.7 },
        blast: { count: 3, interval: 0.45, damage: 38, ringSpeed: 380, ringMax: 980, ringWidth: 18 },
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'charge' }],
    ultimate: { move: 'overcharge', announce: '過充電' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.3, max: 2.2 }, moves: ['charge', 'sparks', 'stomp', 'thunder'] },
      {
        hpAbove: 0,
        idle: { min: 1.0, max: 1.6 },
        moves: ['doubleCharge', 'leap', 'sparksHard', 'thunderHard', 'stomp'],
        combos: [{ moves: ['leap', 'stomp'] }, { moves: ['doubleCharge', 'sparksHard'] }],
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
      sweep: { pattern: 'slam', telegraph: 0.65, radius: 135, damage: 36, recover: 0.6, reach: 'near' },
      // 氷柱の雨
      icicles: { pattern: 'rain', telegraph: 0.4, count: 7, interval: 0.28, delay: 0.85, radius: 36, spread: 60, damage: 29, recover: 0.7 },
      iciclesHard: { pattern: 'rain', telegraph: 0.3, count: 11, interval: 0.2, delay: 0.8, radius: 36, spread: 80, damage: 29, recover: 0.6 },
      // 滑空：部屋を一直線に飛び抜ける。壁に当たると、少しだけ隙ができる
      dive: { pattern: 'charge', telegraph: 0.75, lockTime: 0.25, speed: 680, duration: 0.8, damage: 34, recover: 0.6, wallStun: 0.8, reach: 'far' },
      // 氷の破片：プレイヤーへ扇形に3回撃つ。当たると減速
      shards: { pattern: 'barrage', telegraph: 0.6, lockTime: 0.15, count: 5, spread: 50, waves: 3, interval: 0.4, track: true, shotSpeed: 300, shotRadius: 7, damage: 22, slow: true, recover: 0.7, reach: 'far' },
      // 霜だまり：踏むと減速してダメージを受ける床が、しばらく残る
      frost: { pattern: 'pools', telegraph: 0.6, count: 4, radius: 56, spread: 130, arm: 0.9, life: 6, tick: 0.6, damage: 14, slow: true, recover: 0.6 },
      // 大技「絶対零度」：部屋全体が凍りつく。光る円の中だけが助かる
      zero: { pattern: 'safezone', telegraph: 1.9, waveTelegraph: 1.4, zones: 2, radius: 78, within: 190, waves: 3, active: 0.35, damage: 44, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'dive' }],
    ultimate: { move: 'zero', announce: '絶対零度' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, moves: ['breath', 'shards', 'icicles', 'sweep', 'dive'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.4 },
        moves: ['iciclesHard', 'dive', 'breath', 'sweep', 'shards'],
        combos: [{ moves: ['dive', 'sweep'] }, { moves: ['shards', 'breath'] }],
        side: { moves: ['frost'], every: { min: 9, max: 13 } },
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
      grid: { pattern: 'lines', telegraph: 0.6, orient: 'cross', count: 6, spacing: 120, width: 30, delay: 0.85, stagger: 0.22, damage: 34, recover: 0.7, reach: 'far' },
      // うずまき弾：全方向の弾を、少しずつ向きをずらして撃ち続ける
      spiral: { pattern: 'barrage', telegraph: 0.7, count: 8, spread: 360, waves: 6, interval: 0.28, rotate: 13, shotSpeed: 210, shotRadius: 7, damage: 26, recover: 0.8 },
      // 過熱床：踏むとダメージを受ける床が、しばらく残る
      scorch: { pattern: 'pools', telegraph: 0.6, count: 5, radius: 60, spread: 150, arm: 1.0, life: 7, tick: 0.5, damage: 18, recover: 0.6 },
      // 大技「照準固定」：照準の円が追いかけてきて、止まった場所を撃つ
      lockon: { pattern: 'chase', telegraph: 1.0, count: 6, interval: 1.0, spawn: 150, speed: 330, follow: 1.3, lock: 0.55, radius: 60, damage: 40, recover: 1.2 },
    },
    ultimate: { move: 'lockon', announce: '照準固定' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.8 }, moves: ['laser', 'summon', 'spiral', 'nova', 'grid'] },
      // オーバーヒート：攻撃が速くなるが、3回攻撃するたびに冷却の隙ができる
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.1 },
        speed: 1.4,
        moves: ['laser', 'nova', 'grid', 'summon', 'spiral'],
        combos: [{ moves: ['grid', 'nova'] }],
        side: { moves: ['scorch'], every: { min: 10, max: 14 } },
        rest: { after: 3, move: 'vent' },
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
      lunge: { pattern: 'charge', telegraph: 0.75, lockTime: 0.25, speed: 640, duration: 0.85, damage: 40, recover: 0.6, wallStun: 1.2, reach: 'far' },
      // 汚水の噴射（当たると減速）
      spit: { pattern: 'cone', telegraph: 0.8, lockTime: 0.3, range: 360, arc: 50, duration: 1.0, damage: 28, slow: true, recover: 0.7 },
      // 毒液の弾：プレイヤーへ扇形に撃つ
      venom: { pattern: 'barrage', telegraph: 0.6, lockTime: 0.15, count: 7, spread: 70, waves: 2, interval: 0.45, track: true, shotSpeed: 270, shotRadius: 7, damage: 26, recover: 0.7, reach: 'far' },
      venomHard: { pattern: 'barrage', telegraph: 0.5, lockTime: 0.15, count: 9, spread: 90, waves: 3, interval: 0.4, track: true, shotSpeed: 290, shotRadius: 7, damage: 26, recover: 0.7, reach: 'far' },
      // 潜行：配管に潜って姿を消し、プレイヤーの足元から飛び出す
      burrow: { pattern: 'burrow', dive: 0.5, under: 1.3, lockTime: 0.45, radius: 92, damage: 38, repeat: 1, recover: 1.0 },
      burrowHard: {
        pattern: 'burrow', dive: 0.4, under: 1.1, lockTime: 0.4, radius: 92, damage: 38, repeat: 2, recover: 1.0,
        pool: { radius: 70, arm: 0.2, life: 6, tick: 0.5, damage: 16, slow: true },
      },
      // 汚水の床をばらまく
      sludge: { pattern: 'pools', telegraph: 0.6, count: 5, radius: 54, spread: 150, arm: 0.9, life: 6, tick: 0.5, damage: 16, slow: true, recover: 0.6 },
      // 大技「配管破裂」：足元を追って配管が破裂し、その場所に汚水の床が残る
      rupture: {
        pattern: 'chase', telegraph: 1.0, count: 5, interval: 0.95, spawn: 140, speed: 330, follow: 1.1, lock: 0.55, radius: 62, damage: 40, recover: 1.2,
        pool: { radius: 56, arm: 0.2, life: 5, tick: 0.5, damage: 16, slow: true },
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'burrow' }],
    ultimate: { move: 'rupture', announce: '配管破裂' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.1, max: 1.8 }, moves: ['lunge', 'spit', 'burrow', 'venom'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.3 },
        moves: ['burrowHard', 'spit', 'lunge', 'venomHard', 'sludge'],
        combos: [{ moves: ['lunge', 'spit'] }, { moves: ['venomHard', 'lunge'] }],
        side: { moves: ['sludge'], every: { min: 9, max: 13 } },
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
      pinch: { pattern: 'cone', telegraph: 0.75, lockTime: 0.3, range: 170, arc: 110, duration: 0.25, damage: 42, recover: 1.1, reach: 'near' },
      // 水圧：横と縦の線が、プレイヤーの場所から交互に走る
      jets: { pattern: 'lines', telegraph: 0.6, orient: 'cross', count: 4, spacing: 130, width: 30, delay: 0.85, stagger: 0.25, damage: 34, recover: 1.0 },
      jetsHard: { pattern: 'lines', telegraph: 0.5, orient: 'cross', count: 6, spacing: 115, width: 30, delay: 0.8, stagger: 0.2, damage: 34, recover: 0.9 },
      // 跳びかかり：着地で周りを攻撃し、衝撃波の輪が広がる
      leap: { pattern: 'leap', telegraph: 0.95, lockTime: 0.3, air: 0.55, radius: 120, damage: 42, ring: { speed: 300, max: 300, width: 14, damage: 24 }, recover: 1.2, reach: 'far' },
      // 泡：全方向に、遅い弾をばらまく
      bubbles: { pattern: 'barrage', telegraph: 0.7, count: 12, spread: 360, waves: 2, interval: 0.6, rotate: 15, shotSpeed: 150, shotRadius: 9, shotLife: 6, damage: 26, recover: 1.0 },
      bubblesHard: { pattern: 'barrage', telegraph: 0.6, count: 14, spread: 360, waves: 3, interval: 0.5, rotate: 13, shotSpeed: 170, shotRadius: 9, shotLife: 6, damage: 26, recover: 0.9 },
      // 横走り：甲羅が割れたあとの突進
      scuttle: { pattern: 'charge', repeat: 2, repeatTelegraph: 0.45, telegraph: 0.65, lockTime: 0.2, speed: 560, duration: 0.7, damage: 40, recover: 0.8, wallStun: 1.3, reach: 'far' },
      // 回転：背後に居続けると、体ごと回って周りを叩く。硬直は長め
      spin: { pattern: 'slam', telegraph: 0.6, radius: 150, damage: 40, recover: 1.3 },
      // 大技「満水」：部屋が水で満ちる。光る円（足場）の中だけが助かる
      flood: { pattern: 'safezone', telegraph: 1.9, waveTelegraph: 1.4, zones: 2, radius: 80, within: 190, waves: 3, active: 0.35, damage: 46, recover: 1.6 },
    },
    reactions: [
      { when: 'behind', seconds: 2.4, move: 'spin' },
      { when: 'far', seconds: 4, move: 'leap' },
    ],
    ultimate: { move: 'flood', announce: '満水' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, moves: ['pinch', 'jets', 'leap', 'bubbles'] },
      // 甲羅が割れる：防げなくなる代わりに、攻撃が速くなる
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.3 },
        speed: 1.3,
        noShield: true,
        moves: ['leap', 'scuttle', 'jetsHard', 'pinch', 'bubblesHard'],
        combos: [{ moves: ['leap', 'pinch'] }, { moves: ['scuttle', 'bubblesHard'] }],
        side: { moves: ['jets'], every: { min: 10, max: 14 } },
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
      slam: { pattern: 'slam', telegraph: 0.8, radius: 165, damage: 42, recover: 1.0, reach: 'near' },
      // 汚泥のしずくを生む
      spawn: { pattern: 'summon', telegraph: 0.7, enemy: 'sludgelet', count: 3, max: 8, recover: 0.7 },
      // 大技「大再生」：溜めている間、汚泥が落ちる。溜めきると、HP が少し回復し、首がすべて生え直す
      rebirth: {
        pattern: 'endure', telegraph: 0.8, duration: 6, break: 0.04, stun: 4.5, recover: 1.2, heal: 0.1, regrow: true,
        pulse: { move: 'drop', interval: 3.2 },
        blast: { count: 2, interval: 0.5, damage: 40, ringSpeed: 360, ringMax: 980, ringWidth: 18 },
      },
    },
    ultimate: { move: 'rebirth', announce: '大再生' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, moves: ['drop', 'spiral', 'mire', 'slam', 'spawn'] },
      // 再生：倒された首が、時間で生え直す
      {
        hpAbove: 0,
        idle: { min: 0.9, max: 1.4 },
        regrow: 9,
        moves: ['dropHard', 'spiral', 'slam', 'mire', 'spawn', 'spiralHard'],
        combos: [{ moves: ['mire', 'dropHard'] }, { moves: ['slam', 'spiral'] }],
        side: { moves: ['drop'], every: { min: 10, max: 14 } },
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
      pounce: { pattern: 'leap', telegraph: 0.65, lockTime: 0.25, air: 0.38, radius: 92, damage: 44, recover: 0.6, reach: 'far' },
      // 3連続の突進。壁に当たると隙ができる
      triple: { pattern: 'charge', repeat: 3, repeatTelegraph: 0.35, telegraph: 0.6, lockTime: 0.18, speed: 660, duration: 0.5, damage: 42, recover: 0.8, wallStun: 1.2, reach: 'far' },
      // 鉄くずの弾：プレイヤーへ扇形に
      scrap: { pattern: 'barrage', telegraph: 0.55, lockTime: 0.15, count: 5, spread: 56, waves: 2, interval: 0.35, track: true, shotSpeed: 330, shotRadius: 7, damage: 30, recover: 0.6 },
      scrapHard: { pattern: 'barrage', telegraph: 0.45, lockTime: 0.15, count: 7, spread: 76, waves: 3, interval: 0.3, track: true, shotSpeed: 350, shotRadius: 7, damage: 30, recover: 0.6 },
      // 周囲への一撃
      howl: { pattern: 'slam', telegraph: 0.7, radius: 150, damage: 44, recover: 0.9, reach: 'near' },
      // 磁力：引き寄せてから、周りを叩く
      magnet: { pattern: 'magnet', telegraph: 0.6, duration: 2.6, strength: 130, radius: 135, damage: 46, recover: 1.1 },
      magnetHard: { pattern: 'magnet', telegraph: 0.5, duration: 2.4, strength: 175, radius: 150, damage: 46, recover: 1.0 },
      // 固有「刃の渦」：鉄くずの刃を体のまわりで回しながら、追いかけてくる。当たると裂傷（持続ダメージ）
      shred: { pattern: 'orbit', telegraph: 0.7, duration: 3.2, count: 3, radius: 92, bladeRadius: 16, spin: 200, chase: 0.75, damage: 30, dot: 'bleed', recover: 0.9 },
      shredHard: { pattern: 'orbit', telegraph: 0.6, duration: 3.6, count: 4, radius: 96, bladeRadius: 16, spin: 230, chase: 0.9, damage: 30, dot: 'bleed', recover: 0.9 },
      // 大技「鉄くず嵐」：照準の円が次々に現れ、同時に何個も追ってくる
      storm: { pattern: 'chase', telegraph: 0.9, count: 8, interval: 0.6, spawn: 170, speed: 300, follow: 1.0, lock: 0.5, radius: 52, damage: 42, recover: 1.2 },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'pounce' }],
    ultimate: { move: 'storm', announce: '鉄くず嵐' },
    phases: [
      { hpAbove: 0.5, idle: { min: 0.9, max: 1.5 }, moves: ['pounce', 'scrap', 'triple', 'magnet', 'shred'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.1 },
        speed: 1.2,
        moves: ['magnetHard', 'pounce', 'triple', 'scrapHard', 'shredHard', 'howl'],
        combos: [{ moves: ['pounce', 'howl'] }, { moves: ['scrapHard', 'triple'] }],
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
      web: { pattern: 'barrage', telegraph: 0.6, lockTime: 0.15, count: 5, spread: 60, waves: 3, interval: 0.4, track: true, shotSpeed: 280, shotRadius: 8, damage: 28, slow: true, recover: 0.7, reach: 'far' },
      // 跳びかかり
      leap: { pattern: 'leap', telegraph: 0.8, lockTime: 0.3, air: 0.45, radius: 105, damage: 46, recover: 0.8, reach: 'far' },
      // 脚の突き：正面の細い扇
      stab: { pattern: 'cone', telegraph: 0.6, lockTime: 0.25, range: 210, arc: 40, duration: 0.2, damage: 46, recover: 0.8, reach: 'near' },
      // 子蜘蛛を生む
      brood: { pattern: 'summon', telegraph: 0.7, enemy: 'spiderling', count: 3, max: 6, recover: 0.7 },
      // 橋げた：部屋を横切る壁を張る
      girder: { pattern: 'girder', telegraph: 1.0, lines: 2, offset: 110, spacing: 34, gap: 96, gaps: 2, max: 46, post: 'girderpost', recover: 0.8 },
      girderHard: { pattern: 'girder', telegraph: 0.8, lines: 3, offset: 100, spacing: 34, gap: 90, gaps: 2, max: 60, post: 'girderpost', recover: 0.7 },
      // 突進（後半）：2連続
      rush: { pattern: 'charge', repeat: 2, repeatTelegraph: 0.4, telegraph: 0.6, lockTime: 0.2, speed: 620, duration: 0.6, damage: 44, recover: 0.8, wallStun: 1.2, reach: 'far' },
      // 固有「張り糸」：部屋を横切る糸を張る。しばらく残り、触れている間は減速とダメージ
      wires: { pattern: 'wires', telegraph: 0.5, count: 3, spread: 130, arm: 0.9, life: 7, width: 10, damage: 18, tick: 0.5, recover: 0.7 },
      wiresHard: { pattern: 'wires', telegraph: 0.4, count: 5, spread: 170, arm: 0.8, life: 8, width: 10, damage: 18, tick: 0.5, recover: 0.6 },
      // 大技「全面架設」：部屋じゅうに鉄骨が降る。光る円の中だけが助かる
      overbuild: { pattern: 'safezone', telegraph: 1.9, waveTelegraph: 1.4, zones: 2, radius: 78, within: 180, waves: 3, active: 0.35, damage: 48, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'leap' }],
    ultimate: { move: 'overbuild', announce: '全面架設' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['web', 'girder', 'leap', 'stab', 'wires'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.2 },
        moves: ['girderHard', 'leap', 'wiresHard', 'rush', 'stab', 'web'],
        combos: [{ moves: ['leap', 'stab'] }, { moves: ['web', 'rush'] }],
        side: { moves: ['brood'], every: { min: 13, max: 17 } },
        announce: '架設続行',
      },
    ],
  },
  {
    id: 'cranetitan',
    name: 'クレーンタイタン',
    alias: '未完の巨人', // 登場時に出す異名
    shape: 'titan',
    color: 'heat',
    weakness: 'shock',
    material: 'titanCore',
    radius: 58,
    hp: 9600,
    speed: 0, // 本体は動かない
    contactDamage: 44,
    xp: 520,
    credits: 260,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 腕のなぎ払い：長い腕が、プレイヤーのいる側へ回る
      sweep: { pattern: 'laser', telegraph: 0.9, lead: 50, turn: 170, speed: 105, width: 34, range: 400, damage: 48, recover: 0.8, reach: 'near' },
      // 鉄骨の落下
      drop: { pattern: 'rain', telegraph: 0.4, count: 8, interval: 0.28, delay: 0.9, radius: 42, spread: 90, damage: 36, recover: 0.8 },
      dropHard: { pattern: 'rain', telegraph: 0.3, count: 14, interval: 0.18, delay: 0.85, radius: 42, spread: 130, damage: 36, recover: 0.7 },
      // 衝撃波：部屋の端まで届く輪
      quake: { pattern: 'shockwave', telegraph: 0.9, damage: 34, ringSpeed: 330, ringMax: 980, ringWidth: 16, recover: 0.8 },
      // 鋲の弾：向きをずらしながら全方向に
      rivets: { pattern: 'barrage', telegraph: 0.7, count: 9, spread: 360, waves: 5, interval: 0.3, rotate: 12, shotSpeed: 220, shotRadius: 7, damage: 30, recover: 0.8 },
      // 振り子：吊ったフックが、部屋を行ったり来たりする
      swing: { pattern: 'pendulum', telegraph: 1.0, lines: 1, passes: 3, period: 1.5, radius: 36, damage: 46, recover: 0.6 },
      swingHard: { pattern: 'pendulum', telegraph: 0.8, lines: 2, passes: 4, period: 1.3, radius: 36, damage: 46, recover: 0.5 },
      // 固有「溶接ビーム」：ビームがゆっくり追ってくる。当たると炎上（持続ダメージ）。通ったあとに燃える床が残る
      weld: { pattern: 'weld', telegraph: 0.9, duration: 3.2, turn: 38, width: 26, range: 900, damage: 40, dot: 'burn', trail: { every: 0.35, radius: 34, arm: 0.15, life: 4, tick: 0.5, damage: 10 }, recover: 1.0 },
      weldHard: { pattern: 'weld', telegraph: 0.75, duration: 4, turn: 46, width: 26, range: 900, damage: 40, dot: 'burn', trail: { every: 0.3, radius: 34, arm: 0.15, life: 5, tick: 0.5, damage: 10 }, recover: 0.9 },
      // 大技「増築」：溜めている間、鉄骨が落ちる。溜めきると、部屋の端まで届く輪が3回広がる
      extend: {
        pattern: 'endure', telegraph: 0.8, duration: 5.5, break: 0.05, stun: 4.5, recover: 1.2,
        pulse: { move: 'drop', interval: 2.8 },
        blast: { count: 3, interval: 0.5, damage: 44, ringSpeed: 380, ringMax: 980, ringWidth: 18 },
      },
    },
    ultimate: { move: 'extend', announce: '増築' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['sweep', 'drop', 'swing', 'quake', 'weld'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['sweep', 'dropHard', 'weldHard', 'rivets', 'swingHard', 'quake'],
        combos: [{ moves: ['quake', 'rivets'] }, { moves: ['sweep', 'dropHard'] }],
        side: { moves: ['swing'], every: { min: 10, max: 14 } },
        announce: '増築再開',
      },
    ],
  },
  // ---- ここからマップ4「停電区」 ----
  {
    id: 'lampeater',
    name: 'ランプイーター',
    alias: '灯り喰い', // 登場時に出す異名
    shape: 'moth',
    color: 'magenta',
    weakness: 'heat',
    material: 'mothCore',
    radius: 40,
    hp: 11000,
    speed: 82,
    contactDamage: 46,
    xp: 600,
    credits: 300,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「消灯」：非常灯をすべて消して1本を食べ、暗闇にまぎれて位置を変えてから、突進する
      douse: {
        pattern: 'douse', telegraph: 1.0, breakTime: 14, reposition: { distance: 250, time: 0.45 },
        lunges: 1, lungeTelegraph: 0.6, lockTime: 0.2, speed: 640, duration: 0.55, damage: 50, wallStun: 1.2, recover: 0.8,
      },
      douseHard: {
        pattern: 'douse', telegraph: 0.9, breakTime: 14, reposition: { distance: 250, time: 0.4 },
        lunges: 2, lungeTelegraph: 0.5, lockTime: 0.18, speed: 680, duration: 0.55, damage: 50, wallStun: 1.2, recover: 0.8,
      },
      // 固有「鱗粉」：プレイヤーのまわりに雲をまく。中にいると、見える範囲が狭くなる
      scales: { pattern: 'scales', telegraph: 0.6, count: 3, radius: 62, spread: 120, arm: 0.6, life: 6, recover: 0.6 },
      scalesHard: { pattern: 'scales', telegraph: 0.5, count: 5, radius: 62, spread: 160, arm: 0.5, life: 7, recover: 0.6 },
      // 急降下：予告線つきの突進。壁に当たると隙ができる
      dive: { pattern: 'charge', telegraph: 0.7, lockTime: 0.22, speed: 660, duration: 0.7, damage: 50, recover: 0.7, wallStun: 1.2, reach: 'far' },
      // 羽ばたき：足元からの衝撃波の輪
      gust: { pattern: 'shockwave', telegraph: 0.8, damage: 34, ringSpeed: 320, ringMax: 340, ringWidth: 14, recover: 0.8, reach: 'near' },
      // 鱗片：プレイヤーへ扇形に弾を撃つ（後半）
      flakes: { pattern: 'barrage', telegraph: 0.55, lockTime: 0.15, count: 6, spread: 64, waves: 3, interval: 0.35, track: true, shotSpeed: 310, shotRadius: 7, damage: 32, recover: 0.6, reach: 'far' },
      // 大技「全消灯」：非常灯をすべて壊し、目くらみにしたうえで、暗闇からの突進を4回
      blackout: {
        pattern: 'douse', telegraph: 1.3, breakAll: true, breakTime: 22, blind: true, reposition: { distance: 240, time: 0.4 },
        lunges: 4, lungeTelegraph: 0.55, lockTime: 0.18, speed: 680, duration: 0.5, damage: 52, wallStun: 1.6, recover: 1.5,
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'dive' }],
    ultimate: { move: 'blackout', announce: '全消灯' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['douse', 'scales', 'dive', 'gust'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['douseHard', 'scalesHard', 'dive', 'gust', 'flakes'],
        combos: [{ moves: ['scalesHard', 'dive'] }, { moves: ['gust', 'flakes'] }],
        announce: '灯りを寄こせ',
      },
    ],
  },
  {
    id: 'sentinel',
    name: 'サーチライト・センチネル',
    alias: '照射番', // 登場時に出す異名
    shape: 'sentinel',
    color: 'amber',
    weakness: 'shock',
    material: 'lensCore',
    radius: 42,
    hp: 12500,
    speed: 58,
    contactDamage: 46,
    xp: 640,
    credits: 320,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「照射」：光の扇が回る。扇の中（と、点いている非常灯のそば）に合計 need 秒いると捕捉され、予告つきの狙撃が来る
      //   arc: 扇の広さ（度）, spin: 回る速さ（ラジアン/秒）, life: 続く秒数, decay: 扇の外にいる間、たまった時間が減る速さ
      //   snipe: { aim: 照準線が出ている秒数, lock: 最後に向きが固定される秒数, interval: 次に捕捉が進み始めるまでの秒数 }
      beam: {
        pattern: 'searchlight', telegraph: 0.9, count: 1, arc: 46, range: 1100, spin: 0.55, life: 14, need: 0.8, decay: 0.4,
        snipe: { aim: 0.75, lock: 0.25, width: 14, range: 1100, damage: 46, interval: 1.2 }, recover: 0.5,
      },
      beamHard: {
        pattern: 'searchlight', telegraph: 0.8, count: 2, arc: 46, range: 1100, spin: 0.6, life: 15, need: 0.8, decay: 0.4,
        snipe: { aim: 0.65, lock: 0.22, width: 14, range: 1100, damage: 46, interval: 1.0 }, recover: 0.5,
      },
      // 固有「閃光」：溜めのあと、部屋全体が光る。その瞬間にボスのほうを向いている（正面から左右 facing 度）と、blind 秒の目くらみ
      flare: { pattern: 'flare', telegraph: 1.2, count: 1, gap: 0, facing: 70, blind: 6, light: 1400, lightLife: 2.5, recover: 0.7 },
      flareHard: { pattern: 'flare', telegraph: 1.2, count: 2, gap: 0.75, facing: 70, blind: 6, light: 1400, lightLife: 2.5, recover: 0.7 },
      // 斉射：プレイヤーへ扇形に弾を撃つ
      volley: { pattern: 'barrage', telegraph: 0.6, lockTime: 0.15, count: 5, spread: 50, waves: 3, interval: 0.4, track: true, shotSpeed: 300, shotRadius: 7, damage: 32, recover: 0.6, reach: 'far' },
      // 全周弾：向きをずらしながら全方向に（後半）
      ringshot: { pattern: 'barrage', telegraph: 0.65, count: 12, spread: 360, waves: 3, interval: 0.4, rotate: 15, shotSpeed: 220, shotRadius: 7, damage: 30, recover: 0.7 },
      // 放電：足元からの衝撃波の輪
      pulse: { pattern: 'shockwave', telegraph: 0.8, damage: 36, ringSpeed: 330, ringMax: 360, ringWidth: 14, recover: 0.8, reach: 'near' },
      // 大技「全照射」：扇が4本になって速く回る。この間だけ、扇に触れるとダメージ
      fullbeam: { pattern: 'searchlight', telegraph: 1.7, count: 4, arc: 36, range: 1100, spin: 0.6, life: 9, touch: 40, hold: true, recover: 1.6 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'volley' }],
    ultimate: { move: 'fullbeam', announce: '全照射' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['beam', 'flare', 'volley', 'pulse'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['beamHard', 'flareHard', 'volley', 'ringshot', 'pulse'],
        combos: [{ moves: ['flareHard', 'volley'] }, { moves: ['pulse', 'ringshot'] }],
        announce: '侵入者、捕捉',
      },
    ],
  },
  {
    id: 'breaker',
    name: 'ブレーカー',
    alias: '主幹遮断器', // 登場時に出す異名
    shape: 'breaker',
    color: 'cyan',
    weakness: 'cold',
    material: 'breakerCore',
    radius: 42,
    hp: 14000,
    speed: 70,
    contactDamage: 48,
    xp: 680,
    credits: 340,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「遮断」：duration 秒のあいだ、部屋の灯りが落ち、見える円が vision 倍になる。その間、足元に落雷の予告が出る（strikes）
      //   終わると復電（surge 秒のあいだ部屋全体が明るい）して、overload 秒動けない
      cutoff: {
        pattern: 'blackout', telegraph: 1.0, duration: 4, vision: 0.6,
        strikes: { first: 0.5, interval: 0.7, spread: 70, radius: 50, delay: 0.85, damage: 44 }, surge: 3, overload: 2, recover: 0.3,
      },
      cutoffHard: {
        pattern: 'blackout', telegraph: 0.9, duration: 5.5, vision: 0.6,
        strikes: { first: 0.4, interval: 0.55, spread: 80, radius: 50, delay: 0.8, damage: 44 }, surge: 3, overload: 2, recover: 0.3,
      },
      // 固有「残像」：偽物を count 体出して囲み、本物と一緒に突進する。偽物の体当たり（decoyDamage）は、本物より弱い
      mirage: {
        pattern: 'afterimage', telegraph: 0.8, count: 3, rounds: 1, decoy: 'afterimage', distance: 250,
        aim: 0.9, lockTime: 0.25, speed: 620, duration: 0.55, damage: 50, decoyDamage: 24, recover: 0.9,
      },
      mirageHard: {
        pattern: 'afterimage', telegraph: 0.7, count: 5, rounds: 2, decoy: 'afterimage', distance: 250,
        aim: 0.85, lockTime: 0.22, speed: 640, duration: 0.55, damage: 50, decoyDamage: 24, recover: 0.9,
      },
      // 横切る線：プレイヤーへの向きに平行な線が、順に光る
      bars: { pattern: 'lines', telegraph: 0.6, orient: 'aim', count: 4, spacing: 105, width: 32, delay: 0.8, stagger: 0.22, damage: 44, recover: 0.7, reach: 'far' },
      barsHard: { pattern: 'lines', telegraph: 0.5, orient: 'cross', count: 8, spacing: 100, width: 30, delay: 0.75, stagger: 0.18, damage: 44, recover: 0.6 },
      // 周囲への一撃
      trip: { pattern: 'slam', telegraph: 0.7, radius: 155, damage: 50, recover: 0.8, reach: 'near' },
      // 突進。壁に当たると隙ができる
      rush: { pattern: 'charge', telegraph: 0.7, lockTime: 0.22, speed: 650, duration: 0.7, damage: 50, recover: 0.7, wallStun: 1.3, reach: 'far' },
      // 大技「全系統遮断」：遮断の暗闇の中で、残像6体との一斉突進を3回。終わると復電して、長い隙
      shutdown: {
        pattern: 'afterimage', telegraph: 1.6, count: 6, rounds: 3, decoy: 'afterimage', distance: 260,
        aim: 0.9, lockTime: 0.22, speed: 640, duration: 0.55, damage: 52, decoyDamage: 26,
        blackout: { duration: 12, vision: 0.6 }, surge: 4, recover: 2.2,
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'rush' }],
    ultimate: { move: 'shutdown', announce: '全系統遮断' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['cutoff', 'mirage', 'bars', 'trip', 'rush'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['cutoffHard', 'mirageHard', 'barsHard', 'trip', 'rush'],
        combos: [{ moves: ['rush', 'trip'] }, { moves: ['barsHard', 'mirageHard'] }],
        announce: '主幹、遮断',
      },
    ],
  },
  // ---- ここからマップ5「溶解区」 ----
  {
    id: 'rusteater',
    name: 'ラストイーター',
    alias: '錆び喰い', // 登場時に出す異名
    shape: 'rusteater',
    color: 'heat',
    weakness: 'corrode',
    material: 'rustCore',
    radius: 44,
    hp: 15000,
    speed: 76,
    contactDamage: 50,
    xp: 720,
    credits: 360,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「溶解」：床が溶けて、酸の穴になる。穴は、ボスを倒すまで消えない。count 個ずつ増えて、全部で max 個まで
      melt: { pattern: 'melt', telegraph: 0.9, count: 2, max: 7, radius: 52, spread: 110, arm: 0.6, tick: 0.5, damage: 18, recover: 0.6 },
      meltHard: { pattern: 'melt', telegraph: 0.8, count: 3, max: 10, radius: 52, spread: 130, arm: 0.5, tick: 0.5, damage: 18, recover: 0.6 },
      // 固有「噛みつき」：予告線つきの突進。当たると「錆」（rust：duration 秒のあいだ、与えるダメージが amount の割合だけ下がる）
      gnaw: { pattern: 'gnaw', telegraph: 0.7, lockTime: 0.2, speed: 660, duration: 0.6, damage: 52, rust: { amount: 0.3, duration: 5 }, wallStun: 1.3, recover: 0.7, reach: 'far' },
      // 鉄片：プレイヤーへ扇形に弾を撃つ
      shards: { pattern: 'barrage', telegraph: 0.55, lockTime: 0.15, count: 6, spread: 60, waves: 3, interval: 0.38, track: true, shotSpeed: 310, shotRadius: 7, damage: 34, recover: 0.6, reach: 'far' },
      // 地ならし：足元からの衝撃波の輪
      quake: { pattern: 'shockwave', telegraph: 0.8, damage: 38, ringSpeed: 330, ringMax: 360, ringWidth: 14, recover: 0.8, reach: 'near' },
      // 踏みつけ：周囲への一撃
      stomp: { pattern: 'slam', telegraph: 0.7, radius: 160, damage: 52, recover: 0.8, reach: 'near' },
      // 大技「大溶解」：部屋の外まわりが、ぐるりと酸の穴になる（rx・ry は、部屋の真ん中からの距離）。同時に、雨が rain 秒降る
      meltdown: { pattern: 'melt', telegraph: 1.7, ring: { count: 12, rx: 330, ry: 150 }, max: 99, radius: 62, arm: 0.6, tick: 0.5, damage: 20, rain: 6, recover: 1.4 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'gnaw' }],
    ultimate: { move: 'meltdown', announce: '大溶解' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['melt', 'gnaw', 'shards', 'quake', 'stomp'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['meltHard', 'gnaw', 'shards', 'quake', 'stomp'],
        combos: [{ moves: ['meltHard', 'gnaw'] }, { moves: ['quake', 'shards'] }],
        announce: '錆を、寄こせ',
      },
    ],
  },
  // ---- マップ4の隠しボス（docs/詳細仕様.md「24. マップ4」の「隠しボス「ノクターン」」）。出し方は、マップの定義（secretBoss.rule）----
  {
    id: 'nocturne',
    name: 'ノクターン',
    alias: '影', // 登場時に出す異名
    hidden: true,
    bgm: 'bossNocturne', // この隠しボスだけの曲
    shape: 'nocturne',
    color: 'magenta',
    weakness: null,
    material: 'nocturneCore', // 倒すたびに1個（恒久強化「記憶領域」に使う）
    radius: 38,
    hp: 15500,
    speed: 96,
    contactDamage: 50,
    xp: 760,
    credits: 360,
    drops: { count: 3, rarityBonus: 2, minRarity: 2 }, // 装備は、エピック以上を保証
    comms: {
      intro: [
        '@noise＞ ……灯りを点けたから、影ができた。あれは、お前の影だ。',
        '@noise＞ 通った道を、遅れてなぞってくる。同じ場所に戻るな。弱点は、ない。',
      ],
      defeated: [
        '@noise＞ ……影が、足元に戻った。',
        '@noise＞ 通行証を拾え。いつか、要るかもしれない。',
      ],
    },
    attacks: {
      // 固有「影踏み」：lag 秒前にいた場所が、interval 秒ごとに攻撃される（delay は、予告が出ている時間）
      shadowstep: { pattern: 'shadowstep', telegraph: 0.8, trail: { life: 9, lag: 2, interval: 0.4, delay: 0.7, radius: 44, damage: 46 }, recover: 0.5 },
      shadowstepHard: { pattern: 'shadowstep', telegraph: 0.7, trail: { life: 11, lag: 1.7, interval: 0.3, delay: 0.65, radius: 46, damage: 46 }, recover: 0.5 },
      // 固有「写し身」：動きを delays 秒遅れて真似る影。触れるとダメージ
      mirror: { pattern: 'mirror', telegraph: 0.8, echoes: { delays: [1.5], life: 10, radius: 20, damage: 44 }, recover: 0.5 },
      mirrorHard: { pattern: 'mirror', telegraph: 0.7, echoes: { delays: [1.2, 2.4], life: 11, radius: 20, damage: 44 }, recover: 0.5 },
      // 突進。壁に当たると隙ができる
      lunge: { pattern: 'charge', telegraph: 0.65, lockTime: 0.2, speed: 680, duration: 0.65, damage: 52, recover: 0.7, wallStun: 1.2, reach: 'far' },
      // 弾：プレイヤーへ扇形に
      notes: { pattern: 'barrage', telegraph: 0.55, lockTime: 0.15, count: 5, spread: 56, waves: 3, interval: 0.38, track: true, shotSpeed: 310, shotRadius: 7, damage: 34, recover: 0.6 },
      notesHard: { pattern: 'barrage', telegraph: 0.5, count: 12, spread: 360, waves: 4, interval: 0.32, rotate: 14, shotSpeed: 235, shotRadius: 7, damage: 34, recover: 0.6 },
      // 追尾の照準
      gaze: { pattern: 'chase', telegraph: 0.8, count: 3, interval: 0.8, spawn: 150, speed: 330, follow: 1.1, lock: 0.5, radius: 56, damage: 46, recover: 0.8 },
      // 大技「夜想」：暗闇の中で、影踏みと、写し身2体が同時に来る。ボスは、そのまま攻撃を続ける
      nocturne: {
        pattern: 'shadowstep', telegraph: 1.6,
        trail: { life: 14, lag: 1.7, interval: 0.3, delay: 0.65, radius: 46, damage: 48 },
        echoes: { delays: [1.2, 2.4], life: 14, radius: 20, damage: 46 },
        blackout: { duration: 14, vision: 0.7 }, recover: 0.8,
      },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'lunge' }],
    ultimate: { move: 'nocturne', announce: '夜想' },
    phases: [
      { hpAbove: 0.6, idle: { min: 1.0, max: 1.6 }, moves: ['shadowstep', 'mirror', 'lunge', 'notes'] },
      {
        hpAbove: 0.3,
        idle: { min: 0.8, max: 1.3 },
        moves: ['shadowstepHard', 'mirror', 'gaze', 'lunge', 'notes'],
        combos: [{ moves: ['mirror', 'lunge'] }, { moves: ['shadowstepHard', 'notes'] }],
        announce: '影が、濃くなる',
      },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        speed: 1.15,
        moves: ['shadowstepHard', 'mirrorHard', 'gaze', 'lunge', 'notesHard'],
        combos: [{ moves: ['mirrorHard', 'lunge'] }, { moves: ['shadowstepHard', 'gaze'] }, { moves: ['notesHard', 'lunge'] }],
        announce: '夜は、明けない',
      },
    ],
  },
  // ---- 隠しボス（docs/詳細仕様.md「21. 隠しボスと通行証」） ----
  // hidden: true のボスは、エリアのボスではない。ひび割れた壁の奥にいて、倒すとそのマップの通行証が手に入る。素材を1個落とす。データ片は持たない
  {
    id: 'architect',
    name: 'アーキテクト',
    alias: '設計者', // 登場時に出す異名
    hidden: true,
    shape: 'architect',
    color: 'amber',
    weakness: 'cold',
    material: 'architectCore', // 倒すたびに1個（恒久強化「記憶領域」に使う）
    radius: 42,
    hp: 12000,
    speed: 74,
    contactDamage: 48,
    xp: 700,
    credits: 320,
    drops: { count: 3, rarityBonus: 2, minRarity: 2 }, // 装備は、エピック以上を保証
    comms: {
      intro: [
        '@noise＞ ……図面にない部屋だ。ここで、塔の形を書き換え続けている。',
        '@noise＞ 設計者だ。線と杭に気をつけろ。冷却が効く。',
      ],
      defeated: [
        '@noise＞ ……図面が、止まった。',
        '@noise＞ 通行証を拾え。その先へ行くのに、要る。',
      ],
    },
    attacks: {
      // 測量線：横と縦の線が、プレイヤーの場所から交互に光る
      survey: { pattern: 'lines', telegraph: 0.6, orient: 'cross', count: 6, spacing: 112, width: 30, delay: 0.8, stagger: 0.2, damage: 48, recover: 0.7 },
      surveyHard: { pattern: 'lines', telegraph: 0.5, orient: 'cross', count: 8, spacing: 96, width: 30, delay: 0.75, stagger: 0.17, damage: 48, recover: 0.6 },
      // 杭打ち：落下地点の予告が次々に出る
      piles: { pattern: 'rain', telegraph: 0.4, count: 9, interval: 0.24, delay: 0.85, radius: 42, spread: 100, damage: 40, recover: 0.7 },
      pilesHard: { pattern: 'rain', telegraph: 0.3, count: 15, interval: 0.17, delay: 0.8, radius: 42, spread: 130, damage: 40, recover: 0.6 },
      // 押印：周囲への一撃
      stamp: { pattern: 'slam', telegraph: 0.7, radius: 160, damage: 52, recover: 0.9, reach: 'near' },
      // 鋲の弾：向きをずらしながら全方向に
      bolts: { pattern: 'barrage', telegraph: 0.65, count: 10, spread: 360, waves: 4, interval: 0.3, rotate: 12, shotSpeed: 230, shotRadius: 7, damage: 34, recover: 0.7 },
      // 突進。壁に当たると隙ができる
      dash: { pattern: 'charge', telegraph: 0.7, lockTime: 0.22, speed: 640, duration: 0.7, damage: 50, recover: 0.7, wallStun: 1.3, reach: 'far' },
      // 図面展開：部屋を横切る壁（橋げた）を張る
      blueprint: { pattern: 'girder', telegraph: 0.9, lines: 2, offset: 110, spacing: 34, gap: 96, gaps: 2, max: 46, post: 'girderpost', recover: 0.7 },
      blueprintHard: { pattern: 'girder', telegraph: 0.75, lines: 3, offset: 100, spacing: 34, gap: 90, gaps: 2, max: 60, post: 'girderpost', recover: 0.6 },
      // 照準：追尾の円が追いかけてきて、止まった場所を攻撃する
      lock: { pattern: 'chase', telegraph: 0.8, count: 3, interval: 0.8, spawn: 150, speed: 320, follow: 1.1, lock: 0.5, radius: 56, damage: 46, recover: 0.8 },
      // 固有「方眼」：部屋をマスに分け、市松模様の半分が光る。続けて、残りの半分が光る
      cells: { pattern: 'cells', telegraph: 1.1, second: 0.85, cols: 6, rows: 4, waves: 2, active: 0.2, damage: 50, recover: 0.8 },
      cellsHard: { pattern: 'cells', telegraph: 0.95, second: 0.7, cols: 6, rows: 4, waves: 3, active: 0.2, damage: 50, recover: 0.7 },
      // 固有「インク流し」：足元から広がっていく床。中にいると腐食（持続ダメージ）
      ink: { pattern: 'ink', telegraph: 0.7, count: 1, start: 44, grow: 55, maxRadius: 185, arm: 0.5, life: 6, tick: 0.5, damage: 14, dot: 'corrode', recover: 0.6 },
      inkHard: { pattern: 'ink', telegraph: 0.6, count: 2, start: 44, grow: 70, maxRadius: 170, arm: 0.45, life: 6.5, tick: 0.5, damage: 14, dot: 'corrode', recover: 0.6 },
      // 大技「竣工」：部屋全体が危険になる。光る円の中だけが助かる
      completion: { pattern: 'safezone', telegraph: 1.8, waveTelegraph: 1.25, zones: 2, radius: 74, within: 180, waves: 4, active: 0.35, damage: 54, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'dash' }],
    ultimate: { move: 'completion', announce: '竣工' },
    phases: [
      { hpAbove: 0.6, idle: { min: 1.0, max: 1.6 }, moves: ['survey', 'cells', 'stamp', 'ink', 'dash'] },
      {
        hpAbove: 0.3,
        idle: { min: 0.8, max: 1.3 },
        moves: ['surveyHard', 'cells', 'blueprint', 'lock', 'ink', 'stamp', 'dash'],
        combos: [{ moves: ['dash', 'stamp'] }, { moves: ['blueprint', 'ink'] }],
        side: { moves: ['piles'], every: { min: 11, max: 15 } },
        announce: '設計変更',
      },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        speed: 1.15,
        moves: ['cellsHard', 'surveyHard', 'blueprintHard', 'lock', 'inkHard', 'dash', 'stamp'],
        combos: [{ moves: ['dash', 'stamp'] }, { moves: ['inkHard', 'cellsHard'] }, { moves: ['bolts', 'dash'] }],
        side: { moves: ['lock'], every: { min: 9, max: 12 } },
        announce: '最終図面',
      },
    ],
  },
];
