// 攻撃を当てる・受ける処理
import { COMBAT, FEEL, PLAYER, STATUS } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { calcDamage } from '../logic/damage.js';
import { addXp } from '../logic/level.js';
import { makeItem } from '../logic/loot.js';
import { fire, statWith } from './effects.js';
import { eliteDeath } from './elite.js';
import { addHitstop, addShake, burst, floatText } from './fx.js';
import { triggerCounter } from './player.js';

// ---- 状態異常 ----

export function applyBurn(enemy) {
  if (enemy.burnT <= 0) enemy.burnAcc = 0;
  enemy.burnT = STATUS.burn.duration;
}

export function applySlow(enemy) {
  enemy.slowT = STATUS.slow.duration;
}

// 凍結・停止。ボスには効かない
export function applyStop(enemy, duration) {
  if (enemy.boss || enemy.dead) return;
  enemy.stopT = Math.max(enemy.stopT, duration);
}

// 属性つきの攻撃が当たったときの状態異常。熱は燃焼、冷却は減速
function applyElementStatus(world, enemy, elements) {
  if (enemy.dead) return;
  if (elements.includes('heat')) applyBurn(enemy);
  if (elements.includes('cold')) {
    // 系統ボーナス：すでに減速している敵は凍結することがある
    const chance = world.player.stats.freezeChance;
    if (chance > 0 && enemy.slowT > 0 && world.rng() < chance) applyStop(enemy, STATUS.freeze.duration);
    applySlow(enemy);
  }
}

// 敵の動く速さの倍率（1 = 通常, 0 = 止まっている）
export function enemySpeedFactor(enemy) {
  if (enemy.stopT > 0) return 0;
  const haste = enemy.haste ?? 1; // エリートの特性「加速」
  if (enemy.slowT > 0) return haste * (1 - STATUS.slow.amount * (enemy.boss ? STATUS.bossSlowScale : 1));
  return haste;
}

// ---- 敵へのダメージ ----

// プレイヤーの武器による攻撃。(dirX, dirY) は吹き飛ばす向き
export function hitEnemy(world, enemy, base, dirX, dirY, knockback) {
  const p = world.player;
  const stats = p.stats;
  const forceCrit = p.forceCrit;
  p.forceCrit = false;
  const result = calcDamage({
    base,
    attackMul: statWith(world, 'attackMul', enemy),
    critChance: forceCrit ? 1 : statWith(world, 'critChance', enemy),
    critMul: stats.critMul,
    elements: stats.elements,
    weakness: enemy.def.weakness ?? null,
    weaknessMul: COMBAT.weaknessMultiplier,
    rng: world.rng,
  });
  // ボスはひるまず、吹き飛ばない
  if (!enemy.boss) {
    // エリートはひるまない（吹き飛びにくいだけ）
    if (!enemy.noStagger) {
      enemy.stagger = COMBAT.stagger;
      // ひるんだら構えは中断する
      if (enemy.state !== 'chase') {
        enemy.state = 'chase';
        enemy.cd = Math.max(enemy.cd, 0.3);
      }
    }
    const len = Math.hypot(dirX, dirY) || 1;
    const kb = knockback * (1 - (enemy.def.knockbackResist ?? 0));
    enemy.vx += (dirX / len) * kb;
    enemy.vy += (dirY / len) * kb;
  }
  const sparkColor = stats.elements.length > 0 ? ELEMENT_COLORS[stats.elements[0]] : enemy.color;
  burst(world, enemy.x, enemy.y, sparkColor, result.crit ? 10 : 5);
  damageEnemy(world, enemy, result.amount, result);
  applyElementStatus(world, enemy, stats.elements);
  fire(world, 'hit', { target: enemy, elements: stats.elements, primary: true });
  // 「必ず会心」で出た会心は数えない（そうしないとゼロデイで永久に会心が続く）
  if (result.crit && !forceCrit) fire(world, 'crit', { target: enemy });
  return result;
}

// インプラントなどによる追加ダメージ（連鎖放電、爆発、ダメージ床など）。会心は出ない
export function effectDamage(world, enemy, base, element = null) {
  if (enemy.dead || enemy.spawnT > 0) return;
  const elements = element ? [element] : [];
  const weak = element != null && enemy.def.weakness === element;
  const amount = Math.max(1, Math.round(base * world.player.stats.attackMul * (weak ? COMBAT.weaknessMultiplier : 1)));
  damageEnemy(world, enemy, amount, { crit: false, weak, color: element ? ELEMENT_COLORS[element] : COLORS.dim, small: true });
  applyElementStatus(world, enemy, elements);
  fire(world, 'hit', { target: enemy, elements, primary: false });
}

// HPを減らして数字を出す。倒したら撃破の処理へ
export function damageEnemy(world, enemy, amount, { crit = false, weak = false, color = null, small = false } = {}) {
  if (enemy.dead) return;
  // エリートの特性「障壁」：障壁が残っている間は、ダメージを障壁が受ける
  if (enemy.barrier > 0) {
    const absorbed = Math.min(enemy.barrier, amount);
    enemy.barrier -= absorbed;
    amount -= absorbed;
    enemy.hit = 0.1;
    if (amount <= 0) {
      floatText(world, enemy.x, enemy.y - enemy.r - 6, enemy.barrier > 0 ? '障壁' : '障壁破壊', COLORS.cyan, 13);
      return;
    }
  }
  enemy.hp -= amount;
  enemy.hit = 0.1;
  const label = (crit ? '会心 ' : '') + amount + (weak ? ' 弱点' : '');
  const textColor = color ?? (crit ? COLORS.amber : weak ? ELEMENT_COLORS[enemy.def.weakness] : COLORS.ink);
  floatText(world, enemy.x + (world.rng() - 0.5) * 14, enemy.y - enemy.r - 6, label, textColor, small ? 12 : crit || weak ? 20 : 15);
  if (enemy.hp <= 0) killEnemy(world, enemy);
}

export function killEnemy(world, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  world.kills++;
  burst(world, enemy.x, enemy.y, enemy.color, enemy.boss ? 90 : 18, enemy.boss ? 400 : 240);
  addShake(world, enemy.boss ? FEEL.shake.bossKill : FEEL.shake.kill);
  if (enemy.boss) addHitstop(world, FEEL.hitstop.bossKill);

  const p = world.player;
  if (p.stats.killHeal > 0) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.killHeal);
  world.pendingLevelUps += addXp(p.build, enemy.def.xp ?? 0);
  p.build.credits += Math.round((enemy.def.credits ?? 0) * p.stats.creditMul);
  eliteDeath(world, enemy);
  world.events.push({ type: 'kill', enemy: enemy.def.id });
  if (enemy.elite) world.events.push({ type: 'eliteKill', enemy: enemy.baseDef.id });
  if (enemy.boss) world.events.push({ type: 'bossKill', boss: enemy.def.id, noDamage: world.damageTaken === 0 });
  dropLoot(world, enemy);
  fire(world, 'kill', { target: enemy });
}

function dropLoot(world, enemy) {
  const drops = enemy.def.drops;
  if (drops) {
    // ボスなどの確定ドロップ
    for (let i = 0; i < drops.count; i++) {
      const offset = (i - (drops.count - 1) / 2) * 44;
      world.loot.push({ x: enemy.x + offset, y: enemy.y, item: makeItem(world.rng, { rarityBonus: drops.rarityBonus ?? 0, minRarity: drops.minRarity ?? 0 }), t: 0 });
    }
  } else if (world.rng() < (enemy.def.dropChance ?? 0)) {
    world.loot.push({ x: enemy.x, y: enemy.y, item: makeItem(world.rng), t: 0 });
  }
}

// ---- プレイヤーへのダメージ ----

// 冷気を浴びたときの減速。無敵中（ダッシュ中など）は付かない
export function slowPlayer(world) {
  const p = world.player;
  if (p.inv > 0 || world.mode !== 'play') return;
  p.slowT = STATUS.playerSlow.duration;
}

export function hurtPlayer(world, damage) {
  const p = world.player;
  if (p.inv > 0 || world.mode !== 'play') return false;
  // ジャストガードの構え中なら、無効化して反撃する（弾は消える）
  if (p.guard) {
    triggerCounter(world);
    return true;
  }
  const amount = Math.max(1, Math.round(damage * p.stats.damageTaken));
  p.hp = Math.max(0, p.hp - amount);
  world.damageTaken += amount;
  p.inv = PLAYER.hitInvincible;
  addShake(world, FEEL.shake.hurt);
  floatText(world, p.x, p.y - 22, '-' + amount, COLORS.red, 18);
  burst(world, p.x, p.y, COLORS.red, 12);
  if (p.hp <= 0) {
    world.mode = 'dead';
    p.attack = null;
    p.charge = null;
    addShake(world, FEEL.shake.death);
    burst(world, p.x, p.y, COLORS.cyan, 40, 320);
  } else {
    fire(world, 'hurt', {});
  }
  return true;
}
