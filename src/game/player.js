// プレイヤーの移動・ダッシュ・攻撃
import { FEEL, PLAYER, STATUS } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { DATA } from '../data/index.js';
import { DEG, arcHitsCircle, circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { createBuild } from '../logic/stats.js';
import { recalcStats } from './build.js';
import { healPlayer, hitEnemy } from './combat.js';
import { updateItemEffects } from './consumables.js';
import { fire, statWith } from './effects.js';
import { addHitstop, addShake, burst, floatText, ghost, ring, sfx } from './fx.js';

// carry: 前の部屋から引き継ぐもの { hp, build }。省略するとまっさらな状態で始まる
export function createPlayer(weaponId, x, y, carry = null) {
  const player = {
    x,
    y,
    r: PLAYER.radius,
    hp: 0,
    build: carry?.build ?? createBuild(), // 装備・インプラント・レベル
    stats: null, // build から計算する（src/logic/stats.js）
    weapon: DATA.weapons.get(weaponId),
    fx: 1, // 向き
    fy: 0,
    attack: null, // 今出している近接攻撃
    comboStep: 0, // 次に出る通常攻撃の段
    comboTimer: 0,
    charge: null, // 溜め中（大剣）
    guard: null, // ジャストガードの構え中（片手剣）
    shotCd: 0, // 次の弾が撃てるまでの秒数（銃）
    firingT: 0, // 撃っている最中の残り時間（銃。この間は移動が少し遅い）
    specialCd: 0,
    siege: null, // 徹甲砲撃の溜め中（大砲）
    gauge: 0, // バーストブローのゲージ（ナックル）
    gaugeIdle: 0, // 最後に敵に当ててからの秒数（ナックル）
    dashT: 0,
    dashCd: 0, // 次のダッシュが出せるまでの秒数（HUD 用）
    dashCharges: 1, // 今出せるダッシュの回数
    dashRecharge: 0, // 次の1回ぶんが溜まるまでの秒数
    dashBuffer: 0,
    attackBuffer: 0,
    dvx: 0,
    dvy: 0,
    inv: 0,
    slowT: 0, // 冷気を浴びて遅くなっている残り時間
    buffs: [], // 消耗品による一時的な強化 { stat, add, t }
    smokeT: 0, // 煙幕の残り時間
    smokeRadius: 0,
    sinceDash: Infinity, // 最後にダッシュしてからの秒数
    sinceHurt: Infinity, // 最後に被弾してからの秒数
    sinceKill: Infinity, // 最後に敵を倒してからの秒数
    stillT: 0, // 立ち止まっている秒数
    pull: null, // 引き寄せられている最中（密漁者の銛）{ vx, vy, t }
    dashState: null, // ダッシュ1回ぶんの記録（通り抜けた敵など）
    forceCrit: false, // 次の攻撃が必ず会心
  };
  recalcStats(player);
  player.hp = Math.min(player.stats.maxHp, carry?.hp ?? player.stats.maxHp);
  player.dashCharges = player.stats.dashCharges;
  return player;
}

// input: { mx, my, aimX, aimY, attack, attackPressed, specialPressed, dashPressed }
//   aimX, aimY: マウスカーソルの位置。攻撃はこの方向に出る
//   attack: 攻撃ボタン（左クリック）を押している間 true / attackPressed: 押した瞬間だけ true
//   specialPressed: 特殊アクションのボタン（右クリック）を押した瞬間だけ true
export function updatePlayer(world, dt, input) {
  const p = world.player;
  const weapon = p.weapon;
  // ダッシュは使った回数ぶん、1回ずつ溜め直す
  const maxDash = p.stats.dashCharges;
  if (p.dashCharges < maxDash) {
    p.dashRecharge -= dt;
    if (p.dashRecharge <= 0) {
      p.dashCharges++;
      p.dashRecharge = p.dashCharges < maxDash ? dashCooldown(p) : 0;
    }
  }
  p.dashCd = p.dashCharges > 0 ? 0 : p.dashRecharge;
  p.inv -= dt;
  p.slowT -= dt;
  updateItemEffects(world, dt);
  p.specialCd -= dt;
  // ゲージ（ナックル）：しばらく当てないでいると、減っていく
  if (p.weapon.special.type === 'burst' && p.gauge > 0) {
    p.gaugeIdle += dt;
    if (p.gaugeIdle > p.weapon.special.hold) p.gauge = Math.max(0, p.gauge - p.weapon.special.decay * dt);
  }
  p.shotCd -= dt;
  p.firingT -= dt;
  p.dashBuffer -= dt;
  p.attackBuffer -= dt;
  p.sinceDash += dt;
  p.sinceHurt += dt;
  p.sinceKill += dt;
  // 再生組織（種族「多頭」）：少しずつ HP が戻る
  if (p.stats.hpRegen > 0 && world.mode !== 'dead' && p.hp < p.stats.maxHp) healPlayer(world, p.stats.hpRegen * dt);
  if (!p.attack) p.comboTimer -= dt;

  let mx = input.mx;
  let my = input.my;
  const ml = Math.hypot(mx, my);
  if (ml > 0) {
    mx /= ml;
    my /= ml;
  }
  // カーソルの方を向く。振っている間は向きを変えられない
  if (!p.attack && input.aimX != null) {
    const ax = input.aimX - p.x;
    const ay = input.aimY - p.y;
    const al = Math.hypot(ax, ay);
    if (al > 1) {
      p.fx = ax / al;
      p.fy = ay / al;
    }
  }

  if (input.dashPressed) p.dashBuffer = PLAYER.dash.buffer;
  if (input.attackPressed) p.attackBuffer = PLAYER.attackBuffer;
  if (p.dashBuffer > 0 && p.dashCharges > 0 && p.dashT <= 0) {
    startDash(p, ml > 0 ? mx : p.fx, ml > 0 ? my : p.fy);
    sfx(world, 'dash');
  }

  // 立ち止まっている時間（種族「大蟹」の踏ん張り）
  p.stillT = ml > 0 || p.dashT > 0 || p.pull ? 0 : p.stillT + dt;
  // 銛で引き寄せられている間は、その向きに動かされる。ダッシュで振り切れる
  if (p.pull) {
    if (p.dashT > 0) p.pull = null;
    else {
      p.x += p.pull.vx * dt;
      p.y += p.pull.vy * dt;
      p.pull.t -= dt;
      if (p.pull.t <= 0) p.pull = null;
    }
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dvx * dt;
    p.y += p.dvy * dt;
    ghost(world, p.x, p.y, p.r, COLORS.cyan);
    fire(world, 'dashMove', { dash: p.dashState });
  } else {
    let slow = 1;
    if (p.guard || p.siege) slow = weapon.special.moveSlow;
    else if (p.attack || p.firingT > 0) slow = weapon.moveSlow;
    else if (p.charge) slow = weapon.special.moveSlow;
    if (p.slowT > 0) slow *= 1 - STATUS.playerSlow.amount;
    // 移動速度は、条件つきの効果（敵を倒した直後だけ速い、など）も合わせて決める
    const moveSpeed = PLAYER.moveSpeed * statWith(world, 'moveSpeedMul');
    p.x += mx * moveSpeed * slow * dt;
    p.y += my * moveSpeed * slow * dt;
    updateAttack(world, dt, input);
  }
  clampToBounds(p, world.bounds);
}

// ダッシュが1回ぶん溜まるまでの時間。インプラントや恒久強化で短くなる（短くなるのは6割まで）
export function dashCooldown(p) {
  return PLAYER.dash.cooldown * (1 - Math.min(0.6, p.stats.dashHaste ?? 0));
}

function startDash(p, dx, dy) {
  const d = PLAYER.dash;
  // 武器によっては、ダッシュが遅い（大砲）。進む距離と無敵の時間は同じで、かかる時間だけが延びる
  const duration = d.duration / (p.weapon.dashSpeed ?? 1);
  p.dashBuffer = 0;
  p.dashT = duration;
  if (p.dashCharges >= p.stats.dashCharges) p.dashRecharge = dashCooldown(p);
  p.dashCharges--;
  p.dashCd = p.dashCharges > 0 ? 0 : p.dashRecharge;
  p.sinceDash = 0;
  p.dashState = { hit: new Set(), lastFloor: null };
  p.dot = null; // 持続ダメージ（炎上など）は、ダッシュで振り払える
  p.inv = Math.max(p.inv, d.invincible);
  // ダッシュの距離は、インプラントで伸びる（時間は同じなので、そのぶん速くなる）
  const distance = d.distance * (1 + (p.stats.dashDistance ?? 0));
  p.dvx = (dx * distance) / duration;
  p.dvy = (dy * distance) / duration;
  // ダッシュは攻撃・溜め・構えを中断して出せる
  p.attack = null;
  p.charge = null;
  p.guard = null;
  p.siege = null; // 徹甲砲撃の溜めも、ダッシュでやめられる（クールダウンは始まらない）
}

// 近接攻撃の進行（振りかぶり → 斬る → 硬直）
function updateSwing(world, dt) {
  const p = world.player;
  const a = p.attack;
  a.t += dt;
  if (a.phase === 'windup') {
    // 踏み込み。出始めに、もう届く敵がいるなら踏み込まない（敵を押し込んだり、敵の攻撃に突っ込んだりしないように）
    if (a.lungeChecked !== true) {
      a.lungeChecked = true;
      if (a.lunge > 0 && enemyInReach(world, a)) a.lunge = 0;
    }
    if (a.windup > 0) {
      p.x += (Math.cos(a.angle) * a.lunge * dt) / a.windup;
      p.y += (Math.sin(a.angle) * a.lunge * dt) / a.windup;
    }
    if (a.t >= a.windup) {
      a.phase = 'swing';
      a.t = 0;
      resolveSwing(world, a);
    }
  } else if (a.phase === 'swing') {
    if (a.t >= a.swing) {
      a.phase = 'recover';
      a.t = 0;
    }
  } else if (a.t >= a.recover) {
    p.attack = null;
    p.comboTimer = p.weapon.comboReset ?? 0;
  }
}

// 特殊アクションの部品。武器の定義（src/data/weapons.js）の special.type で選ぶ
//   update(world, dt, input) が true を返したら、その間は通常攻撃を出せない
const SPECIALS = {
  // 溜め斬り：左クリックを押しっぱなしで溜め、離すと斬る
  charge(world, dt, input) {
    const p = world.player;
    const special = p.weapon.special;
    if (p.charge) {
      if (input.attack) {
        p.charge.t += dt;
        const stage = chargeStage(special, p.charge.t);
        if (stage > p.charge.stage) {
          p.charge.stage = stage;
          sfx(world, 'charge');
          ring(world, p.x, p.y, 30 + stage * 12, stage === special.stages.length - 1 ? COLORS.amber : COLORS.cyan);
        }
      } else {
        const stage = p.charge.stage;
        p.charge = null;
        if (stage >= 0) releaseCharge(world, stage);
      }
      return true;
    }
    // 通常攻撃を出したあとも押しっぱなしなら、溜め始める
    if (input.attack && p.attackBuffer <= 0 && p.specialCd <= 0) {
      p.charge = { t: 0, stage: -1 };
      return true;
    }
    return false;
  },

  // ジャストガード：右クリックで少しの間だけ構える。その間に攻撃を受けると無効化して反撃する
  guard(world, dt, input) {
    const p = world.player;
    const special = p.weapon.special;
    if (p.guard) {
      p.guard.t += dt;
      if (p.guard.t >= special.window) p.guard = null;
      return true;
    }
    if (input.specialPressed && p.specialCd <= 0) {
      p.guard = { t: 0 };
      p.specialCd = special.cooldown;
      return true;
    }
    return false;
  },

  // バーストブロー：ゲージが満タンのときに右クリックで、前に踏み込んで強烈な一撃。ゲージを全部使う
  burst(world, dt, input) {
    const p = world.player;
    const special = p.weapon.special;
    if (!input.specialPressed || p.specialCd > 0) return false;
    if (p.gauge < special.gaugeMax) {
      // 足りないときは、何も起きない（音だけ）
      sfx(world, 'deny');
      p.specialCd = 0.2;
      return false;
    }
    const blow = special.blow;
    p.gauge = 0;
    p.specialCd = special.cooldown;
    p.inv = Math.max(p.inv, special.invincible);
    p.attack = makeAttack(world, { ...blow, heavy: true }, blow.damage, blow.range, blow.arc, { charged: 3, burst: true });
    p.comboStep = 0;
    sfx(world, 'charge');
    floatText(world, p.x, p.y - 30, special.name, COLORS.amber, 16);
    ring(world, p.x, p.y, 40, COLORS.amber);
    return true;
  },

  // 徹甲砲撃：右クリックで溜め始め、溜まりきると、敵をすべて貫く太い砲弾を撃つ。溜めている間は、ふつうの弾は撃てない
  siege(world, dt, input) {
    const p = world.player;
    const special = p.weapon.special;
    if (p.siege) {
      p.siege.t += dt;
      if (p.siege.t >= special.charge) {
        p.siege = null;
        p.specialCd = special.cooldown;
        p.shotCd = Math.max(p.shotCd, 0.5);
        fireShot(world, Math.atan2(p.fy, p.fx), special.shot);
        sfx(world, 'explode');
        addShake(world, FEEL.shake.charged);
        floatText(world, p.x, p.y - 30, special.name, COLORS.amber, 16);
      }
      return true;
    }
    if (input.specialPressed && p.specialCd <= 0) {
      p.siege = { t: 0 };
      sfx(world, 'charge');
      return true;
    }
    return false;
  },

  // 拡散射撃：右クリックで、扇状に何発も同時に撃つ
  spread(world, dt, input) {
    const p = world.player;
    const special = p.weapon.special;
    if (!input.specialPressed || p.specialCd > 0) return false;
    p.specialCd = special.cooldown;
    // 「広角ブレード」は、銃では拡散射撃の広がりを大きくする
    const total = Math.min(360, special.angle * p.stats.meleeArc) * DEG;
    const base = Math.atan2(p.fy, p.fx);
    for (let i = 0; i < special.count; i++) {
      const a = base + (special.count > 1 ? (i / (special.count - 1) - 0.5) * total : 0);
      fireShot(world, a, { ...p.weapon.shot, damage: special.damage, heavy: true }); // 拡散射撃は「重い攻撃」
    }
    p.firingT = 0.2;
    p.shotCd = Math.max(p.shotCd, special.recover);
    addShake(world, FEEL.shake.heavy);
    return true;
  },
};

function updateAttack(world, dt, input) {
  const p = world.player;
  const weapon = p.weapon;

  // 奥義は、振っている途中でも出せる
  if (input.specialPressed && canUseOugi(world)) {
    useOugi(world);
    return;
  }

  if (p.attack) {
    updateSwing(world, dt);
    return;
  }
  if (SPECIALS[weapon.special.type](world, dt, input)) return;

  if (weapon.type === 'ranged') {
    // 銃：押している間、撃ち続ける
    if (input.attack && p.shotCd <= 0) {
      p.shotCd = weapon.shot.interval / (1 + statWith(world, 'attackSpeed'));
      fireShot(world, Math.atan2(p.fy, p.fx), weapon.shot);
    }
    return;
  }

  // 近接：押した瞬間に通常攻撃。硬直中に押したぶんも少しの間は覚えておく。押している間ずっと出し続ける武器もある（ナックル）
  if (p.attackBuffer > 0 || (weapon.autoCombo && input.attack)) {
    p.attackBuffer = 0;
    const step = p.comboTimer > 0 ? p.comboStep : 0;
    const def = weapon.combo[step];
    p.attack = makeAttack(world, def, def.damage, def.range, def.arc, { step });
    p.comboStep = (step + 1) % weapon.combo.length;
  }
}

// 奥義が今使えるか：その武器の奥義を持っていて、このエリアでまだ使っておらず、残りHPが少ない
export function canUseOugi(world) {
  const p = world.player;
  const ougi = p.weapon.ougi;
  if (!ougi || world.mode !== 'play') return false;
  if (!p.build.ougi.includes(p.weapon.id) || p.build.ougiUsed) return false;
  return p.hp <= p.stats.maxHp * ougi.hpBelow;
}

// 奥義：自分を中心とした円の衝撃波。盾でも防げない
function useOugi(world) {
  const p = world.player;
  const ougi = p.weapon.ougi;
  p.build.ougiUsed = true;
  sfx(world, 'ougi');
  world.events.push({ type: 'ougi' });
  p.attack = null;
  p.charge = null;
  p.inv = Math.max(p.inv, ougi.invincible);
  for (const e of world.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) > ougi.radius + e.r) continue;
    hitEnemy(world, e, ougi.damage * ougi.multiplier, e.x - p.x, e.y - p.y, ougi.knockback, { unblockable: true, heavy: true });
  }
  // 敵の弾も吹き飛ばす
  world.shots = world.shots.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) > ougi.radius);
  world.fx.rings.push({ x: p.x, y: p.y, radius: ougi.radius / 1.5, color: COLORS.amber, life: 0.45, max: 0.45 });
  ring(world, p.x, p.y, ougi.radius * 0.5, COLORS.ink);
  burst(world, p.x, p.y, COLORS.amber, 50, 520);
  floatText(world, p.x, p.y - 36, ougi.name, COLORS.amber, 26);
  addHitstop(world, FEEL.hitstop.charged * 1.5);
  addShake(world, FEEL.shake.bossKill);
}

function chargeStage(special, t) {
  let stage = -1;
  special.stages.forEach((s, i) => {
    if (t >= s.time) stage = i;
  });
  return stage;
}

function releaseCharge(world, stage) {
  const p = world.player;
  const special = p.weapon.special;
  const s = special.stages[stage];
  const def = { windup: 0, swing: special.swing, recover: special.recover, knockback: special.knockback, lunge: 0, heavy: true };
  // 溜めの段階ごとに、同じ段の通常攻撃より少し広い角度になる
  const combo = p.weapon.combo;
  const arc = combo[Math.min(stage, combo.length - 1)].arc * special.arcScale;
  p.attack = makeAttack(world, def, special.damage * s.multiplier, s.range, arc, { charged: stage + 1 });
  p.attack.phase = 'swing';
  p.specialCd = special.cooldown;
  p.comboTimer = 0;
  floatText(world, p.x, p.y - 30, `${special.name} Lv${stage + 1}`, COLORS.amber, 14);
  resolveSwing(world, p.attack);
}

// ジャストガード成功：攻撃を無効化して、周囲を斬り払う。src/game/combat.js の hurtPlayer から呼ばれる
export function triggerCounter(world) {
  const p = world.player;
  const special = p.weapon.special;
  const c = special.counter;
  p.guard = null;
  p.inv = Math.max(p.inv, special.invincible);
  // 成功するとクールダウンが短くなる
  p.specialCd = Math.min(p.specialCd, special.successCooldown);
  const def = { windup: 0, swing: c.swing, recover: c.recover, knockback: c.knockback, lunge: 0, heavy: true };
  p.attack = makeAttack(world, def, c.damage, c.range, c.arc, { charged: 1 });
  p.attack.phase = 'swing';
  // 反撃の角度は広角ブレードの影響を受けない（全方位のまま）
  p.attack.arc = c.arc * DEG;
  floatText(world, p.x, p.y - 30, 'JUST GUARD', COLORS.amber, 16);
  sfx(world, 'guard');
  world.events.push({ type: 'guard' });
  ring(world, p.x, p.y, c.range, COLORS.amber);
  burst(world, p.x, p.y, COLORS.amber, 16, 260);
  addHitstop(world, FEEL.hitstop.charged);
  resolveSwing(world, p.attack);
}

function makeAttack(world, def, damage, range, arcDeg, extra) {
  const p = world.player;
  const speed = 1 + statWith(world, 'attackSpeed'); // 攻撃速度が上がると全体が短くなる（ダッシュ直後だけ速い、などの条件つきの効果も合わせる）
  return {
    phase: 'windup',
    t: 0,
    angle: Math.atan2(p.fy, p.fx),
    damage,
    range: range * p.stats.meleeRange,
    arc: Math.min(360, arcDeg * p.stats.meleeArc) * DEG,
    windup: def.windup / speed,
    swing: def.swing / speed,
    recover: def.recover / speed,
    knockback: def.knockback,
    lunge: def.lunge ?? 0,
    heavy: !!def.heavy,
    charged: 0,
    ...extra,
  };
}

// その攻撃の範囲に、当てられる敵がいるか
function enemyInReach(world, a) {
  const p = world.player;
  return world.enemies.some((e) => !e.dead && e.spawnT <= 0 && !e.hidden && arcHitsCircle(p.x, p.y, a.angle, a.arc, a.range, e.x, e.y, e.r, p.r + 6));
}

function resolveSwing(world, a) {
  const p = world.player;
  sfx(world, a.heavy ? 'swingHeavy' : 'swing');
  let hits = 0;
  for (const e of world.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    if (!arcHitsCircle(p.x, p.y, a.angle, a.arc, a.range, e.x, e.y, e.r, p.r + 6)) continue;
    hitEnemy(world, e, a.damage, e.x - p.x, e.y - p.y, a.knockback, { heavy: a.heavy || a.charged > 0 });
    hits++;
  }
  // ゲージ（ナックル）：通常攻撃を当てると溜まる。バーストブローそのものでは溜まらない
  const special = p.weapon.special;
  if (hits > 0 && special.type === 'burst' && !a.burst) {
    const before = p.gauge;
    p.gauge = Math.min(special.gaugeMax, p.gauge + (a.heavy ? special.gainHeavy : special.gain));
    p.gaugeIdle = 0;
    if (before < special.gaugeMax && p.gauge >= special.gaugeMax) {
      sfx(world, 'levelup');
      floatText(world, p.x, p.y - 44, 'ゲージ MAX // 右クリック', COLORS.amber, 14);
    }
  }
  const kind = a.charged ? 'charged' : a.heavy ? 'heavy' : 'normal';
  if (hits > 0) {
    addHitstop(world, FEEL.hitstop[kind]);
    addShake(world, kind === 'normal' ? FEEL.shake.hit : FEEL.shake[kind]);
  } else if (kind !== 'normal') {
    addShake(world, FEEL.shake.hit);
  }
  return hits;
}

// ---- 銃の弾 ----

function fireShot(world, angle, shot) {
  const p = world.player;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  sfx(world, 'shoot');
  // 撃った直後は少し足が遅い。大砲は、反動で後ろへ下がる
  p.firingT = Math.max(p.firingT, shot.firing ?? 0.15);
  if (shot.recoil) p.pull = { vx: (-dx * shot.recoil) / 0.12, vy: (-dy * shot.recoil) / 0.12, t: 0.12 };
  world.playerShots.push({
    x: p.x + dx * (p.r + 6),
    y: p.y + dy * (p.r + 6),
    vx: dx * shot.speed,
    vy: dy * shot.speed,
    r: shot.radius,
    damage: shot.damage,
    knockback: shot.knockback,
    pierce: shot.pierceAll ? Infinity : p.stats.pierce, // あと何体貫通できるか
    heavy: !!shot.heavy,
    explode: shot.explode ?? null, // 当たった場所での爆発 { radius, damage }
    hit: new Set(),
    life: shot.life,
  });
}

// 砲弾の爆発：当たった場所のまわりの敵にダメージ。直接当たった敵（direct）は、弾のダメージをもう受けているので除く
function explodeShot(world, s, direct) {
  const { radius, damage } = s.explode;
  for (const e of world.enemies) {
    if (e === direct || e.dead || e.spawnT > 0 || e.hidden) continue;
    if (Math.hypot(e.x - s.x, e.y - s.y) > radius + e.r) continue;
    hitEnemy(world, e, damage, e.x - s.x, e.y - s.y, s.knockback * 0.5, { heavy: true });
  }
  world.fx.rings.push({ x: s.x, y: s.y, radius, color: COLORS.amber, life: 0.25, max: 0.25 });
  burst(world, s.x, s.y, COLORS.amber, 16, 260);
  sfx(world, 'explode');
  addShake(world, FEEL.shake.heavy);
}

export function updatePlayerShots(world, dt) {
  const b = world.bounds;
  for (const s of world.playerShots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (s.x < b.left || s.x > b.right || s.y < b.top || s.y > b.bottom) {
      s.life = 0;
      burst(world, s.x, s.y, COLORS.cyan, 2, 90);
      if (s.explode) explodeShot(world, s, null); // 砲弾は、壁に当たっても爆発する
    }
    if (s.life <= 0) continue;
    for (const e of world.enemies) {
      if (e.dead || e.spawnT > 0 || s.hit.has(e)) continue;
      if (!circlesOverlap(s.x, s.y, s.r, e.x, e.y, e.r)) continue;
      s.hit.add(e);
      hitEnemy(world, e, s.damage, s.vx, s.vy, s.knockback, { heavy: s.heavy });
      if (s.explode) explodeShot(world, s, e);
      if (s.pierce-- <= 0) {
        s.life = 0;
        break;
      }
    }
  }
  world.playerShots = world.playerShots.filter((s) => s.life > 0);
}
