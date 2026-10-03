// 調整用の数値はここに集める（コードに直書きしない）。
// 初期値は docs/詳細仕様.md「9. 数値の目安」のもの。

export const SCREEN = { width: 960, height: 540 };

export const PLAYER = {
  maxHp: 100,
  moveSpeed: 210, // px/秒
  dash: {
    duration: 0.16, // 秒
    distance: 115, // px
    cooldown: 0.9, // 秒
    invincible: 0.25, // 秒
  },
  hitInvincible: 0.6, // 被弾後の無敵（秒）
  critChance: 0.05,
  critMultiplier: 2,
};

export const COMBAT = {
  weaknessMultiplier: 1.5, // 弱点属性の倍率
};

export const ENEMY_SCALING = {
  perArea: 1.6, // エリアが1つ進むごとの HP・攻撃力の倍率
};
