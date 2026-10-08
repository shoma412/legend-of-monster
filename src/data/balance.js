// 調整用の数値はここに集める（コードに直書きしない）。
// 初期値は docs/詳細仕様.md「9. 数値の目安」のもの。

export const SCREEN = { width: 960, height: 540 };

export const PLAYER = {
  radius: 12,
  maxHp: 100,
  moveSpeed: 210, // px/秒
  dash: {
    duration: 0.16, // 秒
    distance: 115, // px
    cooldown: 0.9, // 秒
    invincible: 0.25, // 秒
    buffer: 0.12, // 押してから受け付ける猶予（秒）。攻撃の硬直明けにすぐ出せるようにする
  },
  attackBuffer: 0.2, // 攻撃ボタンを押してから受け付ける猶予（秒）。硬直中のクリックで次の段がつながる
  hitInvincible: 0.6, // 被弾後の無敵（秒）
  kit: { heal: 35, start: 2 }, // 修復キット：回復量と、ラン開始時の数
  critChance: 0.05,
  critMultiplier: 2,
  minDamageTaken: 0.3, // 被ダメージ軽減を重ねても、これより小さい倍率にはならない
};

// 連続ヒット（種族「大蛇」）：同じ敵に続けて当てるたびにダメージが上がる。その重なる回数の上限
export const COMBO = { max: 5 };

// 設置物（種族「蜘蛛」）
export const DEVICE = {
  // 地雷：置いてから arm 秒後に効き始め、敵が trigger の距離に入ると、blast の範囲に爆発する
  mine: { trigger: 26, blast: 72, arm: 0.35 },
  // 小型タレット：interval 秒ごとに足元に置く（部屋に入って最初の1つは first 秒後）。life 秒のあいだ、range 以内のいちばん近い敵を rate 秒ごとに撃つ
  sentry: { interval: 8, first: 1.5, life: 6, range: 300, rate: 0.6 },
};

export const COMBAT = {
  weaknessMultiplier: 1.5, // 弱点属性の倍率
  stagger: 0.18, // 攻撃を当てた敵がひるむ時間（秒）
  knockbackDamping: 9, // 吹き飛びが止まる速さ（大きいほどすぐ止まる）
};

export const ENEMY_SCALING = {
  // 敵ぜんたいの強さ（HP と、プレイヤーが受けるダメージにかかる倍率）。雑魚にもボスにも、どの周にも同じようにかかる。
  // 2026-10-07：1周目が強すぎたので、1 から 0.65 に下げた（周回の倍率は、この値に掛け算される）
  base: 0.65,
  perArea: 1.6, // エリアが1つ進むごとの HP・攻撃力の倍率
};

// 周回（すべてのマップを完了すると、次の周に進める。周が1つ進むごとに敵が強くなる）
export const CYCLE = {
  hpPerCycle: 0.15, // 敵の HP の増え方（1周ごと）
  damagePerCycle: 0.08, // 受けるダメージの増え方（1周ごと）
  stepsPerCycle: 1, // 敵の量：1周ごとに、この部屋数ぶん奥のものとして数える
  materialEvery: 2, // この周数ごとに、ボス素材が +1 個
  rarityPerCycle: 0.1, // 落ちる装備のレア度が1段上がる確率（1周ごと）
  eliteTwoTraitsFrom: 3, // この周から、エリートに特性が2つ付く
  bossHardFrom: 5, // この周から、ボスが最初から後半の行動で始まる
  supplyHalfFrom: 7, // この周から、補給部屋の回復量が減る
  supplyScale: 0.5, // そのときの回復量の倍率
};

export const ROOM = {
  wall: 28, // 壁の厚み（px）
  wallTop: 31, // 上の壁の厚み（px）。画面上部の表示が入るので、ほかの壁より少し厚い
  spawnWarning: 0.7, // 敵が出る前の予告（秒）
  bossWarning: 2.4, // ボスが出る前の予告（秒）。この間に警告と異名を出す
  waveDelay: 0.9, // 波と波の間（秒）
  spawnMinDistance: 200, // プレイヤーからこれ以上離れた場所に出す（px）
  barLength: 1400, // ボスの線の攻撃の、中心から片側への長さ（部屋の端まで届く）
  doorSpacing: 150, // 扉が2つ以上のときの間隔（px）
  startCountdown: { count: 3, step: 0.7 }, // ランの最初の部屋のカウントダウン（3, 2, 1）と、1つあたりの秒数
};

// ボスの行動の選び方（src/logic/bossAi.js、src/game/boss.js）
export const BOSS_AI = {
  near: 210, // これより近いと「近い」（px）
  far: 340, // これより遠いと「遠い」（px）
  match: 3, // 距離が合う技の出やすさ（倍率）
  mismatch: 0.3, // 距離が合わない技の出やすさ（倍率）
  repeatPenalty: 0.35, // 2つ前に使った技の出やすさ（倍率）。直前の技は出ない
  comboWeight: 1.2, // 連携の出やすさ（ふつうの技を 1 として）
  comboRecover: 0.15, // 連携の途中の技の硬直（秒）。これより長い硬直は、ここまで縮む
  comboRest: 1.3, // 連携の締めのあと、立ち止まる時間（秒）
  behindAngle: 2.2, // 正面からこの角度（ラジアン）より後ろにいると「背後」
  ultimateAt: 0.25, // HP の割合がこれ以下になると、大技を1回使う
};

// 隠しボスへの入口（ひび割れた壁）。docs/詳細仕様.md「21. 隠しボスと通行証」
export const SECRET = {
  wallMargin: 14, // 壁の内側の端から、ひびの中心までの距離（px）
  sideMargin: 180, // 部屋の角から、これ以上離れた場所に出す（px）
  doorRadius: 56, // 隠し扉に近づいて E を押せる距離（px）
};

// まだ実装していない仕組み。true にすると、それを必要とする装備効果やインプラントが出るようになる
export const FEATURES = {
  credits: true, // クレジット（M4 で実装）
};

// レベルと経験値
export const LEVEL = {
  baseXp: 40, // Lv1→2 に必要な経験値
  growth: 1.35, // レベルが1上がるごとの必要経験値の倍率
  choices: 3, // インプラントの選択肢の数
  implantMax: 5, // インプラントのレベルの上限
  implantGrowth: 0.2, // インプラントのレベルが1上がるごとに、効果の数値が最初の値の何割ぶん伸びるか
};

// 装備ドロップ
export const LOOT = {
  // weight: 出やすさ / effects: 効果の数 / roll: 効果の値が範囲のどのあたりになるか（0=最小, 1=最大）
  // unique: 効果のうち1つがレジェンド固有効果になる
  rarities: [
    { id: 'common', name: 'コモン', weight: 60, effects: 1, roll: [0, 0.4] },
    { id: 'rare', name: 'レア', weight: 33, effects: 2, roll: [0.2, 0.6] },
    { id: 'epic', name: 'エピック', weight: 5, effects: 3, roll: [0.4, 0.8] },
    { id: 'legend', name: 'レジェンド', weight: 2, effects: 4, roll: [0.7, 1], unique: true },
  ],
  // マップの中の何番目のエリアかで変わる、レア度の出やすさ（コモン, レア, エピック, レジェンド）。奥のエリアほど良いものが出る
  //   上の rarities の weight は、エリアが分からないとき（テストなど）に使う。2番目のエリアと同じ値
  areaWeights: [
    [70, 27.7, 2, 0.3],
    [60, 33, 5, 2],
    [50, 36, 9, 5],
  ],
  bossMinRarity: 1, // ボスが落とす装備の、最低のレア度（1 = レア）
  slots: [
    { id: 'mod', name: '武器モッド', noun: '武器モッド' },
    { id: 'armor', name: '防具', noun: '装甲ジャケット' },
    { id: 'acc', name: 'アクセ', noun: 'データリング' },
  ],
  pickupRadius: 36, // この距離まで近づくと比較が出る（px）
};

// バッグ（ラン中に装備をしまっておく場所）
export const BAG = {
  size: 6, // しまえる装備の数
};

// 消耗品（ラン中に拾って使うアイテム）
export const ITEMS = {
  slots: 2, // 持てる枠の数（1・2 キー）。恒久強化「携行ポーチ」で最大4枠（3・4 キー）
  stack: 3, // 同じ種類を1枠に重ねられる数
  dropChance: 0.05, // 雑魚が倒されたときに落とす確率（装備のドロップとは別に抽選）
  // 修復キットのドロップ：雑魚が倒されたときに落とす確率と、エリートが落とす確率（装備・消耗品とは別に抽選。ボスは落とさない）
  kitDrop: { chance: 0.04, eliteChance: 0.35 },
  price: 25, // 闇市での値段
};

// 属性の状態異常
export const STATUS = {
  burn: { duration: 3, dps: 6, tick: 0.5 }, // 熱：継続ダメージ
  slow: { duration: 2, amount: 0.4 }, // 冷却：減速
  freeze: { duration: 1.5 }, // 凍結：動けない
  // 腐食（4つ目の属性）：duration 秒のあいだ、受けるダメージが amount の割合だけ増える（ボスは bossAmount）。
  //   spread は、インプラント「腐食液」Lv2 以降：腐食中の敵を倒すと、この範囲（px。レベルで広がる）の敵に移る
  corrode: { duration: 4, amount: 0.15, bossAmount: 0.08, spread: 110 },
  bossSlowScale: 0.5, // ボスへの減速はこの倍率に弱まる。ボスは凍結・停止しない
  playerSlow: { duration: 1.5, amount: 0.4 }, // プレイヤーが冷気を浴びたときの減速
  killLight: { radius: 120, life: 6 }, // インプラント「誘蛾灯」：敵を倒した場所に残る光（暗闇のマップだけ）
  // プレイヤーが受ける持続ダメージ。tick 秒ごとに damage を、duration 秒のあいだ受ける。ダッシュすると消える。これで HP が 0 になることはない（1 残る）
  // 種族「遮断器」：蓄電（window 秒のあいだ攻撃を当てていないと、次の攻撃が強くなる。grace は、1振りで何体かに当たるときのための猶予）、
  //   遮断（一度に最大HPの threshold 以上のダメージを受けるときに効く）、復電（修復キットを使ったあと、強くなる秒数）、種族ボーナス（敵を倒すとダッシュが回復。cooldown 秒に1回）
  rested: { window: 2, grace: 0.12 },
  bigHit: { threshold: 0.2 },
  kitPower: { duration: 5 },
  killDash: { cooldown: 3 },
  // 種族「雨」：恵みの雷（interval 秒ごとに、range px 以内の敵1体に落雷）、増水（敵を倒すたびに攻撃力が上がる。cap 体ぶんまで）
  skyBolt: { interval: 4, range: 320 },
  flood: { cap: 10 },
  // label は、付いた瞬間に画面に出す文字（状態が変わったときの文字は、英語にそろえる）
  dots: {
    burn: { name: '炎上', label: 'Burn', color: 'heat', damage: 5, tick: 0.5, duration: 3 },
    bleed: { name: '裂傷', label: 'Bleed', color: 'red', damage: 4, tick: 0.4, duration: 3 },
    corrode: { name: '腐食', label: 'Corrode', color: 'green', damage: 6, tick: 0.5, duration: 3.5 },
  },
};

// 手触りの演出
export const FEEL = {
  hitstop: { normal: 0.04, heavy: 0.08, charged: 0.12, bossKill: 0.5 }, // 当てた瞬間に一瞬止める（秒）
  shake: { hit: 2.5, heavy: 6, charged: 12, kill: 3, bossKill: 20, hurt: 8, death: 14 },
  critTextSize: 24, // クリティカルのダメージ数字の大きさ（ふつうは 15）
  // HP が少ないときの警告。ratio 以下で「警告」、critical 以下で「危険」（HP の割合）。beat は鼓動の音の間隔（秒）
  lowHp: { ratio: 0.3, critical: 0.15, beat: 1.05, beatCritical: 0.6 },
};

// 持ち帰り要素
export const META = {
  // マップをクリアしたあとの持ち越し（docs/詳細仕様.md「25. マップをクリアしたあとの持ち越し」）：
  //   クレジットは、持っていた額のこの割合。インプラントは、最初はこの数だけ選べる（恒久強化で増える）。持ち越したインプラントは、このレベルになる
  carryOver: { creditRate: 0.5, implants: 1, level: 1 },
  firstKillMaterials: 3, // ボスを初めて倒したときにもらえる素材の数（2回目以降は1個）
};

// 部屋の中身の抽選
export const ROOMGEN = {
  // 戦闘部屋：波の数と、1波あたりの敵の予算（敵ごとの cost の合計）
  // budgetPerStep は、1エリア 8〜10 部屋の長さに合わせてある（エリアの終わりで、予算がおよそ +4）
  combat: { wavesMin: 2, wavesMax: 3, budget: 5, budgetPerStep: 0.6, budgetPerWave: 1 },
  depthPerArea: 5, // エリアが1つ進むごとに、敵の予算をこの部屋数ぶん先のものとして数える
  elite: { minionBudget: 7, minionPerStep: 0.4 }, // エリートの取り巻きの予算と、1部屋進むごとの増え方
  supply: { heal: 0.4, fullHpKits: 1 }, // 補給：最大HPに対する回復の割合。fullHpKits は、HP が満タンのときに回復の代わりにもらえる修復キットの数
  vault: { count: 3, rarityBonus: 1 }, // データ金庫：装備の数と、レア度の底上げ
  // 遭遇部屋
  encounter: {
    hpCost: 0.25, // 流れの商人：払うHP（最大HPに対する割合）
    gearRarityBonus: 2, // 流れの商人：もらえる装備のレア度の底上げ
    salvageCredits: 40, // 壊れかけの保守機：部品を抜いたときのクレジット
    lootRarityBonus: 1, // 倒れた回収屋：拾える装備のレア度の底上げ
    ambushSteps: 7, // 倒れた回収屋：次の戦闘部屋を、この部屋数ぶん奥のものとして敵を増やす
    restHeal: 0.2, // 倒れた回収屋：休んだときの回復（最大HPに対する割合）
  },
};

// エリート（雑魚の強化版）
export const ELITE = {
  hpMul: 3,
  damageMul: 1.5, // 攻撃力の倍率
  sizeMul: 1.4,
  xpMul: 3,
  creditMul: 5,
  knockbackResist: 0.9,
  noStagger: true, // 攻撃を当ててもひるまず、構えも中断されない
  drops: { count: 1, minRarity: 1 }, // レア以上の装備が確定
};

// クレジット
export const ECONOMY = {
  prices: {
    gear: [30, 55, 90, 150], // レア度ごとの装備の値段
    kit: 35,
    implant: 70,
  },
  // 闇市の品ぞろえ：count の範囲で、店ごとに並べる数が変わる。装備・修復キット・消耗品・インプラントは必ず1つずつ入り、残りは extras の出やすさで抽選する（修復キットは1つまで）
  shop: { count: { min: 5, max: 6 }, extras: { gear: 3, item: 3, implant: 2 }, rarityBonus: 0 },
};
