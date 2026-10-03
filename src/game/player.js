// プレイヤーの移動・ダッシュ・攻撃
import { FEEL, PLAYER } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { DATA } from '../data/index.js';
import { DEG, arcHitsCircle, clampToBounds } from '../logic/geometry.js';
import { createBuild } from '../logic/stats.js';
import { recalcStats } from './build.js';
import { hitEnemy } from './combat.js';
import { fire } from './effects.js';
import { addHitstop, addShake, floatText, ghost, ring } from './fx.js';

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
    attack: null, // 今出している攻撃
    comboStep: 0, // 次に出る通常攻撃の段
    comboTimer: 0,
    charge: null, // 溜め中
    specialCd: 0,
    dashT: 0,
    dashCd: 0,
    dashBuffer: 0,
    attackBuffer: 0,
    dvx: 0,
    dvy: 0,
    inv: 0,
    sinceDash: Infinity, // 最後にダッシュしてからの秒数
    dashState: null, // ダッシュ1回ぶんの記録（通り抜けた敵など）
    forceCrit: false, // 次の攻撃が必ず会心
  };
  recalcStats(player);
  player.hp = Math.min(player.stats.maxHp, carry?.hp ?? player.stats.maxHp);
  return player;
}

// input: { mx, my, aimX, aimY, attack, attackPressed, dashPressed }
//   aimX, aimY: マウスカーソルの位置。攻撃はこの方向に出る
//   attack: 攻撃ボタンを押している間 true / attackPressed: 押した瞬間だけ true
export function updatePlayer(world, dt, input) {
  const p = world.player;
  const weapon = p.weapon;
  p.dashCd -= dt;
  p.inv -= dt;
  p.specialCd -= dt;
  p.dashBuffer -= dt;
  p.attackBuffer -= dt;
  p.sinceDash += dt;
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
  if (p.dashBuffer > 0 && p.dashCd <= 0 && p.dashT <= 0) startDash(p, ml > 0 ? mx : p.fx, ml > 0 ? my : p.fy);

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dvx * dt;
    p.y += p.dvy * dt;
    ghost(world, p.x, p.y, p.r, COLORS.cyan);
    fire(world, 'dashMove', { dash: p.dashState });
  } else {
    let slow = 1;
    if (p.attack) slow = weapon.moveSlow;
    else if (p.charge) slow = weapon.special.moveSlow;
    p.x += mx * p.stats.moveSpeed * slow * dt;
    p.y += my * p.stats.moveSpeed * slow * dt;
    updateAttack(world, dt, input);
  }
  clampToBounds(p, world.bounds);
}

function startDash(p, dx, dy) {
  const d = PLAYER.dash;
  p.dashBuffer = 0;
  p.dashT = d.duration;
  p.dashCd = d.cooldown;
  p.sinceDash = 0;
  p.dashState = { hit: new Set(), lastFloor: null };
  p.inv = Math.max(p.inv, d.invincible);
  p.dvx = (dx * d.distance) / d.duration;
  p.dvy = (dy * d.distance) / d.duration;
  // ダッシュは攻撃や溜めを中断して出せる
  p.attack = null;
  p.charge = null;
}

function updateAttack(world, dt, input) {
  const p = world.player;
  const weapon = p.weapon;

  if (p.attack) {
    const a = p.attack;
    a.t += dt;
    if (a.phase === 'windup') {
      // 踏み込み
      p.x += (Math.cos(a.angle) * a.lunge * dt) / a.windup;
      p.y += (Math.sin(a.angle) * a.lunge * dt) / a.windup;
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
      p.comboTimer = weapon.comboReset;
    }
    return;
  }

  const special = weapon.special;
  if (p.charge) {
    if (input.attack) {
      p.charge.t += dt;
      const stage = chargeStage(special, p.charge.t);
      if (stage > p.charge.stage) {
        p.charge.stage = stage;
        ring(world, p.x, p.y, 30 + stage * 12, stage === special.stages.length - 1 ? COLORS.amber : COLORS.cyan);
      }
    } else {
      const stage = p.charge.stage;
      p.charge = null;
      if (stage >= 0) releaseCharge(world, stage);
    }
    return;
  }

  // 押した瞬間に通常攻撃。硬直中に押したぶんも少しの間は覚えておく
  if (p.attackBuffer > 0) {
    p.attackBuffer = 0;
    const step = p.comboTimer > 0 ? p.comboStep : 0;
    const def = weapon.combo[step];
    p.attack = makeAttack(p, def, def.damage, def.range, def.arc, { step });
    p.comboStep = (step + 1) % weapon.combo.length;
    return;
  }

  // 押しっぱなしなら溜め始める
  if (input.attack && p.specialCd <= 0 && special.type === 'charge') {
    p.charge = { t: 0, stage: -1 };
  }
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
  p.attack = makeAttack(p, def, special.damage * s.multiplier, s.range, arc, { charged: stage + 1 });
  p.attack.phase = 'swing';
  p.specialCd = special.cooldown;
  p.comboTimer = 0;
  floatText(world, p.x, p.y - 30, `溜め斬り Lv${stage + 1}`, COLORS.amber, 14);
  resolveSwing(world, p.attack);
}

function makeAttack(p, def, damage, range, arcDeg, extra) {
  const speed = 1 + p.stats.attackSpeed; // 攻撃速度が上がると全体が短くなる
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

function resolveSwing(world, a) {
  const p = world.player;
  let hits = 0;
  for (const e of world.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    if (!arcHitsCircle(p.x, p.y, a.angle, a.arc, a.range, e.x, e.y, e.r, p.r + 6)) continue;
    hitEnemy(world, e, a.damage, e.x - p.x, e.y - p.y, a.knockback);
    hits++;
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
