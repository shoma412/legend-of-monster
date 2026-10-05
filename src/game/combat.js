// 攻撃を当てる・受ける処理
import { COMBAT, FEEL, ITEMS, LOOT, PLAYER, STATUS } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { calcDamage } from '../logic/damage.js';
import { DEG, angleDiff } from '../logic/geometry.js';
import { addXp } from '../logic/level.js';
import { makeItem } from '../logic/loot.js';
import { fire, statWith } from './effects.js';
import { rollConsumable } from './consumables.js';
import { eliteDeath } from './elite.js';
import { createEnemy } from './enemyAI.js';
import { addHitstop, addShake, burst, floatText, sfx } from './fx.js';
import { triggerCounter } from './player.js';

// ---- 状態異常 ----

export function applyBurn(enemy) {
  if (enemy.burnT <= 0) enemy.burnAcc = 0;
  enemy.burnT = STATUS.burn.duration;
}

// mul: 減速の時間の倍率（種族ボーナスなどで伸びる）
export function applySlow(enemy, mul = 1) {
  enemy.slowT = Math.max(enemy.slowT, STATUS.slow.duration * mul);
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
    // 種族ボーナスなど：すでに減速している敵は凍結することがある
    const chance = world.player.stats.freezeChance;
    if (chance > 0 && enemy.slowT > 0 && world.rng() < chance) applyStop(enemy, STATUS.freeze.duration);
    applySlow(enemy, world.player.stats.slowMul);
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
// options.unblockable: シールド兵の盾を無視する（奥義など）
// options.heavy: 重い攻撃（溜め斬り・締めの一撃・反撃・拡散射撃・奥義）。種族「巨人」の効果が乗る
export function hitEnemy(world, enemy, base, dirX, dirY, knockback, options = {}) {
  // シールド兵：盾を向けている側からの攻撃は防がれる。止まっている間（凍結・EMP）は防げない
  const shield = enemy.def.shield;
  if (shield && enemy.stopT <= 0 && !enemy.shieldOpen && !options.unblockable) {
    const from = Math.atan2(-dirY, -dirX); // 敵から見た、攻撃が来た方向
    if (Math.abs(angleDiff(from, enemy.facing)) <= (shield.arc * DEG) / 2) {
      enemy.hit = 0.06;
      floatText(world, enemy.x, enemy.y - enemy.r - 6, 'ガード', COLORS.dim, 13);
      burst(world, enemy.x + Math.cos(enemy.facing) * enemy.r, enemy.y + Math.sin(enemy.facing) * enemy.r, COLORS.ink, 4, 160);
      sfx(world, 'block');
      return { amount: 0, crit: false, weak: false, blocked: true };
    }
  }
  const p = world.player;
  const stats = p.stats;
  const forceCrit = p.forceCrit;
  p.forceCrit = false;
  // 連続ヒット（種族「大蛇」）：同じ敵に続けて当てるたびに、ダメージが上がる。別の敵に当てるとやり直し
  if (p.comboTarget !== enemy) {
    p.comboTarget = enemy;
    p.comboHits = 0;
  }
  const comboMul = stats.comboBonus * Math.min(p.comboHits, stats.comboMax);
  p.comboHits++;
  const result = calcDamage({
    base: options.heavy ? base * (1 + stats.heavyBonus) : base,
    attackMul: statWith(world, 'attackMul', enemy) + comboMul,
    critChance: forceCrit ? 1 : statWith(world, 'critChance', enemy),
    critMul: stats.critMul,
    elements: stats.elements,
    weakness: enemy.def.weakness ?? null,
    weaknessMul: COMBAT.weaknessMultiplier,
    rng: world.rng,
  });
  // ボスはひるまず、吹き飛ばない
  if (!enemy.boss) {
    // エリートはひるまない（吹き飛びにくいだけ）。種族ボーナスがあれば、重い攻撃ではひるむ
    if (!enemy.noStagger || (options.heavy && stats.heavyStagger > 0 && !enemy.def.prop && !enemy.anchor)) {
      enemy.stagger = COMBAT.stagger;
      // ひるんだら構えは中断する
      if (enemy.state !== 'chase') {
        enemy.state = 'chase';
        enemy.cd = Math.max(enemy.cd, 0.3);
      }
    }
    const len = Math.hypot(dirX, dirY) || 1;
    const kb = knockback * (1 + stats.knockbackBonus) * (1 - (enemy.def.knockbackResist ?? 0));
    enemy.vx += (dirX / len) * kb;
    enemy.vy += (dirY / len) * kb;
  }
  sfx(world, result.crit ? 'crit' : 'hit');
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
  // 首が残っているボス：本体へのダメージが減る
  if (enemy.armor > 0) amount = Math.max(1, Math.round(amount * (1 - enemy.armor)));
  enemy.hp -= amount;
  enemy.hit = 0.1;
  const label = amount + (crit ? '!' : '') + (weak ? ' 弱点' : '');
  const textColor = color ?? (crit ? COLORS.amber : weak ? ELEMENT_COLORS[enemy.def.weakness] : COLORS.ink);
  floatText(world, enemy.x + (world.rng() - 0.5) * 14, enemy.y - enemy.r - 6, label, textColor, small ? 12 : crit || weak ? 20 : 15);
  if (enemy.hp <= 0) killEnemy(world, enemy);
}

export function killEnemy(world, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  // 柵などの「置かれたもの」：壊れるだけ（撃破数にも経験値にもならない）
  if (enemy.def.prop) {
    burst(world, enemy.x, enemy.y, enemy.color, 10, 200);
    sfx(world, 'block');
    return;
  }
  world.kills++;
  burst(world, enemy.x, enemy.y, enemy.color, enemy.boss ? 90 : 18, enemy.boss ? 400 : 240);
  addShake(world, enemy.boss ? FEEL.shake.bossKill : FEEL.shake.kill);
  if (enemy.boss) addHitstop(world, FEEL.hitstop.bossKill);
  sfx(world, enemy.boss ? 'bossKill' : 'kill');

  const p = world.player;
  if (p.stats.killHeal > 0) healPlayer(world, p.stats.killHeal);
  const levelUps = addXp(p.build, enemy.def.xp ?? 0);
  world.pendingLevelUps += levelUps;
  if (levelUps > 0) world.events.push({ type: 'levelup', level: p.build.level });
  p.build.credits += Math.round((enemy.def.credits ?? 0) * p.stats.creditMul);
  p.sinceKill = 0;
  eliteDeath(world, enemy);
  splitOnDeath(world, enemy);
  world.events.push({ type: 'kill', enemy: enemy.def.id });
  if (enemy.elite) world.events.push({ type: 'eliteKill', enemy: enemy.baseDef.id });
  // ボスを倒したら、呼び出されていた雑魚も一緒に止まる
  if (enemy.boss) {
    for (const other of world.enemies) {
      if (other === enemy || other.dead) continue;
      other.dead = true;
      burst(world, other.x, other.y, other.color, 10, 200);
    }
  }
  if (enemy.boss) world.events.push({ type: 'bossKill', boss: enemy.def.id, noDamage: world.damageTaken === 0 });
  dropLoot(world, enemy);
  fire(world, 'kill', { target: enemy });
}

// 倒すと分かれる敵（定義の split）。分かれた先は、エリアと周回の倍率がかかった強さで出る
function splitOnDeath(world, enemy) {
  const split = enemy.def.split;
  if (!split) return;
  const def = DATA.enemies.get(split.into);
  for (let i = 0; i < split.count; i++) {
    const a = (i / split.count) * Math.PI * 2 + world.rng() * 0.6;
    const child = createEnemy(def, enemy.x + Math.cos(a) * enemy.r * 0.6, enemy.y + Math.sin(a) * enemy.r * 0.6, 0.3, world.rng, world.room.enemyScale ?? 1, world.room.hpScale ?? 1);
    child.vx = Math.cos(a) * 220;
    child.vy = Math.sin(a) * 220;
    world.enemies.push(child);
  }
}

function dropLoot(world, enemy) {
  const drops = enemy.def.drops;
  // 周が進むと、ときどきレア度が1段上がる
  const lucky = () => (world.rng() < (world.room.rarityChance ?? 0) ? 1 : 0);
  if (drops) {
    // ボスなどの確定ドロップ
    for (let i = 0; i < drops.count; i++) {
      const offset = (i - (drops.count - 1) / 2) * 44;
      world.loot.push({ x: enemy.x + offset, y: enemy.y, item: makeItem(world.rng, { rarityBonus: (drops.rarityBonus ?? 0) + lucky(), minRarity: drops.minRarity ?? 0 }), t: 0 });
    }
  } else if (world.rng() < (enemy.def.dropChance ?? 0)) {
    world.loot.push({ x: enemy.x, y: enemy.y, item: makeItem(world.rng, { rarityBonus: lucky() }), t: 0 });
  }
  // 消耗品。エリートとボスは確定で1つ、雑魚はたまに落とす。装備と同じく、近づいて E で拾う
  if (drops || world.rng() < ITEMS.dropChance) {
    world.objects.push({ kind: 'pickup', id: rollConsumable(world.rng), x: enemy.x, y: enemy.y + (drops ? 44 : 26), r: LOOT.pickupRadius });
  }
}

// ---- プレイヤーの回復 ----

// HP を回復する。HPが半分以下のときは、種族ボーナスで回復が増えることがある。実際に回復した量を返す
export function healPlayer(world, amount) {
  const p = world.player;
  const boost = p.hp <= p.stats.maxHp * 0.5 ? 1 + (p.stats.lowHealBonus ?? 0) : 1;
  const before = p.hp;
  p.hp = Math.min(p.stats.maxHp, p.hp + amount * boost);
  return p.hp - before;
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
  // 周が進むと、受けるダメージが増える
  // 被ダメージの軽減は、条件つきのもの（立ち止まっている間、など）も合わせて、下限まで
  const taken = Math.max(PLAYER.minDamageTaken, statWith(world, 'damageTaken'));
  const amount = Math.max(1, Math.round(damage * taken * (world.room.damageScale ?? 1)));
  p.hp = Math.max(0, p.hp - amount);
  world.damageTaken += amount;
  p.inv = PLAYER.hitInvincible + (p.stats.hurtInvincible ?? 0);
  p.sinceHurt = 0;
  addShake(world, FEEL.shake.hurt);
  sfx(world, p.hp <= 0 ? 'death' : 'hurt');
  floatText(world, p.x, p.y - 22, '-' + amount, COLORS.red, 18);
  burst(world, p.x, p.y, COLORS.red, 12);
  // 予備の首（種族「多頭」）：出撃ごとに1回だけ、倒れても起き上がる
  if (p.hp <= 0 && p.stats.revive > 0 && !p.build.reviveUsed) {
    p.build.reviveUsed = true;
    p.hp = Math.max(1, Math.round(p.stats.maxHp * p.stats.revive));
    p.inv = Math.max(p.inv, 2);
    floatText(world, p.x, p.y - 44, '予備の首 // 再起動', COLORS.magenta, 18);
    burst(world, p.x, p.y, COLORS.magenta, 40, 320);
    sfx(world, 'levelup');
  }
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
