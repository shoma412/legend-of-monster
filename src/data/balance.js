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

export const ROOM = {
  wall: 28, // 壁の厚み（px）
  spawnWarning: 0.7, // 敵が出る前の予告（秒）
  bossWarning: 1.6, // ボスが出る前の予告（秒）
  waveDelay: 0.9, // 波と波の間（秒）
  spawnMinDistance: 200, // プレイヤーからこれ以上離れた場所に出す（px）
};

// まだ実装していない仕組み。true にすると、それを必要とする装備効果やインプラントが出るようになる
export const FEATURES = {
  credits: false, // クレジット（M4）
};

// レベルと経験値
export const LEVEL = {
  baseXp: 40, // Lv1→2 に必要な経験値
  growth: 1.35, // レベルが1上がるごとの必要経験値の倍率
  choices: 3, // インプラントの選択肢の数
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

// 属性の状態異常
export const STATUS = {
  burn: { duration: 3, dps: 6, tick: 0.5 }, // 熱：継続ダメージ
  slow: { duration: 2, amount: 0.4 }, // 冷却：減速
  freeze: { duration: 1.5 }, // 凍結：動けない
  bossSlowScale: 0.5, // ボスへの減速はこの倍率に弱まる。ボスは凍結・停止しない
};

// 手触りの演出
export const FEEL = {
  hitstop: { normal: 0.04, heavy: 0.08, charged: 0.12, bossKill: 0.5 }, // 当てた瞬間に一瞬止める（秒）
  shake: { hit: 2.5, heavy: 6, charged: 12, kill: 3, bossKill: 20, hurt: 8, death: 14 },
};

// 確認用の部屋（M4 で部屋生成に置き換える）。波ごとに出す敵の id と数。{ boss: id } はボスを出す
export const TEST_STAGES = {
  room: {
    waves: [
      { drone: 4, grunt: 1 },
      { drone: 3, grunt: 2, turret: 1 },
      { drone: 5, grunt: 2, turret: 2 },
    ],
  },
  boss: { waves: [{ boss: 'boltboar' }] },
};
