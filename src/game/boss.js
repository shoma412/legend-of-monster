// ボスの進行。定義（src/data/bosses.js）の phases と sequence に従って、攻撃パターンの部品を順に実行する。
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { angleDiff, circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { PATTERNS } from './bossPatterns.js';
import { hurtPlayer } from './combat.js';
import { addShake, burst, floatText } from './fx.js';

// options: { hpScale: HP の倍率（周回）, hard: true なら最初から後半の行動で始まる（周回） }
export function createBoss(def, x, y, spawnT, { hpScale = 1, hard = false } = {}) {
  const hp = Math.round(def.hp * hpScale);
  return {
    def,
    boss: true,
    x,
    y,
    r: def.radius,
    hp,
    maxHp: hp,
    minPhase: hard ? def.phases.length - 1 : 0, // これより前の段階には戻らない
    hidden: false, // 潜っている間 true（攻撃が当たらず、体に触れても当たらない）
    color: ELEMENT_COLORS[def.color] ?? COLORS[def.color] ?? COLORS.ink,
    vx: 0,
    vy: 0,
    hit: 0,
    burnT: 0,
    burnAcc: 0,
    slowT: 0,
    stopT: 0,
    spawnT,
    act: null, // 実行中の攻撃
    phaseIndex: 0,
    seqIndex: 0,
    idleT: def.phases[0].idle.min,
    angle: Math.PI, // 向いている方向（描画用）
    dead: false,
  };
}

function currentPhaseIndex(b) {
  const ratio = b.hp / b.maxHp;
  const i = b.def.phases.findIndex((ph) => ratio > ph.hpAbove);
  return Math.max(b.minPhase ?? 0, i < 0 ? b.def.phases.length - 1 : i);
}

export function updateBoss(world, b, dt) {
  const p = world.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const d = { dx, dy, dist: Math.hypot(dx, dy) || 1 };
  b.hit -= dt;

  // HP が減ったら次の段階へ。実行中の攻撃が終わってから切り替える
  const phaseIndex = currentPhaseIndex(b);
  if (phaseIndex !== b.phaseIndex && !b.act) {
    b.phaseIndex = phaseIndex;
    b.seqIndex = 0;
    const phase = b.def.phases[phaseIndex];
    // 部屋の端から凍りつき、動ける範囲が狭まる
    if (phase.arena && !world.arena) world.arena = { inset: 0, target: phase.arena.inset, speed: phase.arena.inset / phase.arena.seconds, base: { ...world.bounds } };
    if (phase.announce) {
      floatText(world, b.x, b.y - b.r - 16, phase.announce, COLORS.red, 26);
      burst(world, b.x, b.y, COLORS.red, 30, 300);
      addShake(world, 10);
    }
  }
  const phase = b.def.phases[b.phaseIndex];
  // 段階によっては全体が速くなる（オーバーヒートなど）。冷却の隙だけは速くならない
  const fast = phase.speed ?? 1;
  if (!(b.act && b.act.def.pattern === 'vent')) dt *= fast;

  if (b.act) {
    const pattern = PATTERNS[b.act.def.pattern];
    if (pattern.update(world, b, dt, b.act, d)) {
      b.act = null;
      b.idleT = phase.idle.min + world.rng() * (phase.idle.max - phase.idle.min);
    } else if (b.act.dirX != null) {
      b.angle = Math.atan2(b.act.dirY, b.act.dirX);
    }
  } else {
    // 攻撃の合間は歩いて近づく。向きを変えるのが遅いボス（甲羅持ち）は、少しずつ向き直る
    if (!b.hidden) {
      const want = Math.atan2(dy, dx);
      if (b.def.turnRate) {
        const diff = angleDiff(want, b.angle);
        const step = b.def.turnRate * dt;
        b.angle += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
      } else {
        b.angle = want;
      }
    }
    if (d.dist > b.r + p.r + 24) {
      b.x += (dx / d.dist) * b.def.speed * dt;
      b.y += (dy / d.dist) * b.def.speed * dt;
    }
    b.idleT -= dt;
    if (b.idleT <= 0) {
      const name = phase.sequence[b.seqIndex % phase.sequence.length];
      b.seqIndex++;
      b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
      PATTERNS[b.act.def.pattern].start(world, b, b.act, d);
    }
  }

  // 甲羅：向いている方向が正面。硬直中（recover・stun）と、甲羅が割れた段階では、開いていて防げない
  if (b.def.shield) {
    b.facing = b.angle;
    const resting = b.act?.phase === 'recover' || b.act?.phase === 'stun';
    b.shieldOpen = resting || !!phase.noShield;
  }

  if (b.hidden) return; // 潜っている間は、部屋の中にいない
  clampToBounds(b, world.bounds);
  // 体に触れるとダメージ。スタン中は安全。跳んでいる間も当たらない
  const untouchable = b.act?.phase === 'stun' || b.act?.phase === 'air'; // スタン中と、跳んでいる間
  if (!untouchable && circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, b.def.contactDamage);
}
