// プレイヤーの移動・ダッシュ・攻撃
import { FEEL, PLAYER } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { DATA } from '../data/index.js';
import { DEG, arcHitsCircle, clampToBounds } from '../logic/geometry.js';
import { hitEnemy } from './combat.js';
import { addHitstop, addShake, floatText, ghost, ring } from './fx.js';

export function createPlayer(weaponId, x, y) {
  return {
    x,
    y,
    r: PLAYER.radius,
    hp: PLAYER.maxHp,
    // M3 で装備とインプラントの補正がここに乗る
    stats: {
      maxHp: PLAYER.maxHp,
      moveSpeed: PLAYER.moveSpeed,
      attackMul: 1,
      critChance: PLAYER.critChance,
      critMul: PLAYER.critMultiplier,
      element: null,
    },
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
    dvx: 0,
    dvy: 0,
    inv: 0,
  };
}

// input: { mx, my, attack, special, dashPressed }
export function updatePlayer(world, dt, input) {
  const p = world.player;
  const weapon = p.weapon;
  p.dashCd -= dt;
  p.inv -= dt;
  p.specialCd -= dt;
  p.dashBuffer -= dt;
  if (!p.attack) p.comboTimer -= dt;

  let mx = input.mx;
  let my = input.my;
  const ml = Math.hypot(mx, my);
  if (ml > 0) {
    mx /= ml;
    my /= ml;
    // 振っている間は向きを変えられない
    if (!p.attack) {
      p.fx = mx;
      p.fy = my;
    }
  }

  if (input.dashPressed) p.dashBuffer = PLAYER.dash.buffer;
  if (p.dashBuffer > 0 && p.dashCd <= 0 && p.dashT <= 0) startDash(p, ml > 0 ? mx : p.fx, ml > 0 ? my : p.fy);

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dvx * dt;
    p.y += p.dvy * dt;
    ghost(world, p.x, p.y, p.r, COLORS.cyan);
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
  p.inv = Math.max(p.inv, d.invincible);
  p.dvx = (dx * d.distance) / d.duration;
  p.dvy = (dy * d.distance) / d.duration;
  p.fx = dx;
  p.fy = dy;
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
    if (input.special) {
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

  if (input.special && p.specialCd <= 0 && special.type === 'charge') {
    p.charge = { t: 0, stage: -1 };
    return;
  }

  if (input.attack) {
    const step = p.comboTimer > 0 ? p.comboStep : 0;
    const def = weapon.combo[step];
    p.attack = makeAttack(p, def, def.damage, def.range, def.arc, { step });
    p.comboStep = (step + 1) % weapon.combo.length;
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
  p.attack = makeAttack(p, def, special.damage * s.multiplier, s.range, s.arc, { charged: stage + 1 });
  p.attack.phase = 'swing';
  p.specialCd = special.cooldown;
  p.comboTimer = 0;
  floatText(world, p.x, p.y - 30, `溜め斬り Lv${stage + 1}`, COLORS.amber, 14);
  resolveSwing(world, p.attack);
}

function makeAttack(p, def, damage, range, arcDeg, extra) {
  return {
    phase: 'windup',
    t: 0,
    angle: Math.atan2(p.fy, p.fx),
    damage,
    range,
    arc: arcDeg * DEG,
    windup: def.windup,
    swing: def.swing,
    recover: def.recover,
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
