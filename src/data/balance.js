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

export const COMBAT = {
  weaknessMultiplier: 1.5, // 弱点属性の倍率
  stagger: 0.18, // 攻撃を当てた敵がひるむ時間（秒）
  knockbackDamping: 9, // 吹き飛びが止まる速さ（大きいほどすぐ止まる）
};

export const ENEMY_SCALING = {
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
    { id: 'rare', name: 'レア', weight: 28, effects: 2, roll: [0.2, 0.6] },
    { id: 'epic', name: 'エピック', weight: 10, effects: 3, roll: [0.4, 0.8] },
    { id: 'legend', name: 'レジェンド', weight: 2, effects: 4, roll: [0.7, 1], unique: true },
  ],
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
  slots: 2, // 持てる枠の数（1・2 キー）
  stack: 3, // 同じ種類を1枠に重ねられる数
  dropChance: 0.05, // 雑魚が倒されたときに落とす確率（装備のドロップとは別に抽選）
  price: 25, // 闇市での値段
};

// 属性の状態異常
export const STATUS = {
  burn: { duration: 3, dps: 6, tick: 0.5 }, // 熱：継続ダメージ
  slow: { duration: 2, amount: 0.4 }, // 冷却：減速
  freeze: { duration: 1.5 }, // 凍結：動けない
  bossSlowScale: 0.5, // ボスへの減速はこの倍率に弱まる。ボスは凍結・停止しない
  playerSlow: { duration: 1.5, amount: 0.4 }, // プレイヤーが冷気を浴びたときの減速
};

// 手触りの演出
export const FEEL = {
  hitstop: { normal: 0.04, heavy: 0.08, charged: 0.12, bossKill: 0.5 }, // 当てた瞬間に一瞬止める（秒）
  shake: { hit: 2.5, heavy: 6, charged: 12, kill: 3, bossKill: 20, hurt: 8, death: 14 },
};

// 持ち帰り要素
export const META = {
  firstKillMaterials: 3, // ボスを初めて倒したときにもらえる素材の数（2回目以降は1個）
};

// 部屋の中身の抽選
export const ROOMGEN = {
  // 戦闘部屋：波の数と、1波あたりの敵の予算（敵ごとの cost の合計）
  // budgetPerStep は、1エリア 8〜10 部屋の長さに合わせてある（エリアの終わりで、予算がおよそ +4）
  combat: { wavesMin: 2, wavesMax: 3, budget: 5, budgetPerStep: 0.6, budgetPerWave: 1 },
  depthPerArea: 5, // エリアが1つ進むごとに、敵の予算をこの部屋数ぶん先のものとして数える
  elite: { minionBudget: 7, minionPerStep: 0.4 }, // エリートの取り巻きの予算と、1部屋進むごとの増え方
  supply: { heal: 0.4 }, // 補給：最大HPに対する回復の割合
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
  shop: { gearCount: 2, rarityBonus: 0 },
};
