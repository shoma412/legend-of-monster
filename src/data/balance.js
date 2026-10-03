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
  hitInvincible: 0.6, // 被弾後の無敵（秒）
  critChance: 0.05,
  critMultiplier: 2,
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
  waveDelay: 0.9, // 波と波の間（秒）
  spawnMinDistance: 200, // プレイヤーからこれ以上離れた場所に出す（px）
};

// 手触りの演出
export const FEEL = {
  hitstop: { normal: 0.04, heavy: 0.08, charged: 0.12 }, // 当てた瞬間に一瞬止める（秒）
  shake: { hit: 2.5, heavy: 6, charged: 12, kill: 3, hurt: 8, death: 14 },
};

// M1 の確認用の部屋（M4 で部屋生成に置き換える）。波ごとに出す敵の id と数
export const M1_ROOM = {
  waves: [
    { drone: 4, grunt: 1 },
    { drone: 3, grunt: 2, turret: 1 },
    { drone: 5, grunt: 2, turret: 2 },
  ],
};
