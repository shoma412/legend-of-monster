// 攻撃を当てる・受ける処理
import { COMBAT, FEEL, PLAYER } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { calcDamage } from '../logic/damage.js';
import { addHitstop, addShake, burst, floatText } from './fx.js';

// 敵にダメージを与える。(dirX, dirY) は吹き飛ばす向き
export function hitEnemy(world, enemy, base, dirX, dirY, knockback) {
  const stats = world.player.stats;
  const { amount, crit, weak } = calcDamage({
    base,
    attackMul: stats.attackMul,
    critChance: stats.critChance,
    critMul: stats.critMul,
    element: stats.element,
    weakness: enemy.def.weakness ?? null,
    weaknessMul: COMBAT.weaknessMultiplier,
    rng: world.rng,
  });
  enemy.hp -= amount;
  enemy.hit = 0.1;
  // ボスはひるまず、吹き飛ばない
  if (!enemy.boss) {
    enemy.stagger = COMBAT.stagger;
    // ひるんだら構えは中断する
    if (enemy.state !== 'chase') {
      enemy.state = 'chase';
      enemy.cd = Math.max(enemy.cd, 0.3);
    }
    const len = Math.hypot(dirX, dirY) || 1;
    const kb = knockback * (1 - (enemy.def.knockbackResist ?? 0));
    enemy.vx += (dirX / len) * kb;
    enemy.vy += (dirY / len) * kb;
  }

  const label = (crit ? '会心 ' : '') + amount + (weak ? ' 弱点' : '');
  floatText(world, enemy.x, enemy.y - enemy.r - 6, label, crit ? COLORS.amber : weak ? ELEMENT_COLORS.cold : COLORS.ink, crit || weak ? 20 : 15);
  burst(world, enemy.x, enemy.y, enemy.color, crit ? 10 : 5);
  if (enemy.hp <= 0) killEnemy(world, enemy);
  return { amount, crit, weak };
}

export function killEnemy(world, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  world.kills++;
  burst(world, enemy.x, enemy.y, enemy.color, enemy.boss ? 90 : 18, enemy.boss ? 400 : 240);
  addShake(world, enemy.boss ? FEEL.shake.bossKill : FEEL.shake.kill);
  if (enemy.boss) addHitstop(world, FEEL.hitstop.bossKill);
}

export function hurtPlayer(world, damage) {
  const p = world.player;
  if (p.inv > 0 || world.mode !== 'play') return false;
  p.hp = Math.max(0, p.hp - damage);
  p.inv = PLAYER.hitInvincible;
  addShake(world, FEEL.shake.hurt);
  floatText(world, p.x, p.y - 22, '-' + damage, COLORS.red, 18);
  burst(world, p.x, p.y, COLORS.red, 12);
  if (p.hp <= 0) {
    world.mode = 'dead';
    p.attack = null;
    p.charge = null;
    addShake(world, FEEL.shake.death);
    burst(world, p.x, p.y, COLORS.cyan, 40, 320);
  }
  return true;
}
