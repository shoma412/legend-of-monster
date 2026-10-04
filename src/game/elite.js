// エリート（雑魚の強化版）。特性の定義（src/data/eliteTraits.js）の part で、下の部品を選ぶ。
import { ELITE } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS } from '../data/theme.js';
import { createEnemy } from './enemyAI.js';
import { floatText, ring } from './fx.js';

// 特性の部品。必要なところだけ書く
//   onCreate(e, trait)            … 出現時
//   onUpdate(world, e, dt, trait) … 毎フレーム
//   onDeath(world, e, trait)      … 倒されたとき
export const TRAIT_PARTS = {
  // 倒すと小型の個体に分かれる
  split: {
    onDeath(world, e, trait) {
      for (let i = 0; i < trait.count; i++) {
        const a = (i / trait.count) * Math.PI * 2 + world.rng() * 0.5;
        // baseDef はすでにエリアの倍率がかかった値
        const mini = createEnemy(e.baseDef, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, 0.35, world.rng);
        mini.hp = mini.maxHp = Math.round(e.baseDef.hp * trait.hpRatio * ELITE.hpMul);
        mini.r *= trait.sizeRatio;
        world.enemies.push(mini);
      }
    },
  },

  // 一定ダメージまで無効（src/game/combat.js の damageEnemy が e.barrier を先に削る）
  barrier: {
    onCreate(e, trait) {
      e.barrier = e.barrierMax = Math.round(e.maxHp * trait.ratio);
    },
  },

  // 移動と攻撃が速い（src/game/combat.js の enemySpeedFactor が e.haste を掛ける）
  haste: {
    onCreate(e, trait) {
      e.haste = trait.speed;
    },
  },

  // 周りの雑魚を回復する
  absorb: {
    onCreate(e, trait) {
      e.traitT = trait.interval;
    },
    onUpdate(world, e, dt, trait) {
      e.traitT -= dt;
      if (e.traitT > 0) return;
      e.traitT = trait.interval;
      let healed = false;
      for (const o of world.enemies) {
        if (o === e || o.dead || o.spawnT > 0 || o.hp >= o.maxHp) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) > trait.radius) continue;
        o.hp = Math.min(o.maxHp, o.hp + trait.heal);
        floatText(world, o.x, o.y - o.r - 6, `+${trait.heal}`, COLORS.green, 12);
        healed = true;
      }
      if (healed) ring(world, e.x, e.y, trait.radius, COLORS.green);
    },
  },
};

// 雑魚をエリートに変える
export function makeElite(e, traitId) {
  const trait = DATA.eliteTraits.get(traitId);
  const base = e.def;
  e.elite = trait;
  e.baseDef = base;
  e.def = {
    ...base,
    name: `${base.name}［${trait.name}］`,
    damage: Math.round(base.damage * ELITE.damageMul),
    xp: base.xp * ELITE.xpMul,
    credits: base.credits * ELITE.creditMul,
    dropChance: 0,
    drops: ELITE.drops,
    knockbackResist: Math.max(base.knockbackResist ?? 0, ELITE.knockbackResist),
  };
  e.noStagger = ELITE.noStagger;
  e.hp = e.maxHp = base.hp * ELITE.hpMul;
  e.r *= ELITE.sizeMul;
  TRAIT_PARTS[trait.part].onCreate?.(e, trait);
  return e;
}

export function updateEliteTrait(world, e, dt) {
  if (e.elite) TRAIT_PARTS[e.elite.part].onUpdate?.(world, e, dt, e.elite);
}

export function eliteDeath(world, e) {
  if (e.elite) TRAIT_PARTS[e.elite.part].onDeath?.(world, e, e.elite);
}

export function hasTraitPart(name) {
  return name in TRAIT_PARTS;
}
