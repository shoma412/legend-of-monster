// ボスの進行。定義（src/data/bosses.js）の phases に従って、次の技を選び（src/logic/bossAi.js）、攻撃パターンの部品を実行する。
import { BOSS_AI } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { chooseMove } from '../logic/bossAi.js';
import { angleDiff, circlesOverlap, clampToBounds } from '../logic/geometry.js';
import { DATA } from '../data/index.js';
import { PATTERNS } from './bossPatterns.js';
import { createEnemy } from './enemyAI.js';
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
    next: null, // 次に必ず出す技の名前（テストや、決め打ちしたいとき用）
    queue: [], // 連携の残りの技
    memory: { last: null, prev: null, lastCombo: false }, // 最近使った技
    sinceRest: 0, // 最後の冷却から、何回攻撃したか
    react: { far: 0, behind: 0 }, // プレイヤーがその状態を続けている時間（秒）
    restT: 0, // 連携のあとの隙（秒）。この間は歩かない
    side: null, // 本体の行動とは別に、重ねて出している攻撃
    sideT: null,
    sideRequest: null, // 大技などが、重ねて出したい攻撃の名前を書く
    ultimateDone: false,
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

// 首を1本生やす。index は、何番目の位置か（体の前側に、等間隔に並ぶ）
function growHead(world, b, index) {
  const heads = b.def.heads;
  const e = createEnemy(DATA.enemies.get(heads.enemy), b.x, b.y, 0.5, world.rng, world.room.enemyScale ?? 1, world.room.hpScale ?? 1);
  e.anchor = b;
  e.headIndex = index;
  e.anchorAngle = (index - (heads.count - 1) / 2) * 0.95; // 正面を中心に、左右へ開く
  e.anchorDist = heads.orbit;
  e.cd = 1 + index * 0.8; // 弾を吐くタイミングをずらす
  e.noStagger = true;
  world.enemies.push(e);
  return e;
}

function between(range, rng) {
  return range.min + rng() * (range.max - range.min);
}

// 技を始める。options: { combo: 連携の途中（硬直を縮める）, ultimate: 大技 }
function startMove(world, b, name, d, options = {}) {
  let def = b.def.attacks[name];
  if (options.combo) def = { ...def, recover: Math.min(def.recover ?? 0, BOSS_AI.comboRecover) };
  b.act = { name, def, phase: '', t: 0, ultimate: !!options.ultimate };
  PATTERNS[def.pattern].start(world, b, b.act, d);
}

// 次に出す技を決める。返り値は { moves: [技の名前…], combo, rest }
function pickMoves(world, b, phase, d) {
  if (b.next) {
    const name = b.next;
    b.next = null;
    return { moves: [name] };
  }
  // 決まった回数だけ攻撃したら、冷却の隙
  if (phase.rest && b.sinceRest >= phase.rest.after) return { moves: [phase.rest.move], rest: true };
  // プレイヤーが同じ動きを続けていたら、決まった技で返す
  for (const r of b.def.reactions ?? []) {
    if (b.react[r.when] >= r.seconds && r.move !== b.memory.last) {
      b.react[r.when] = 0;
      return { moves: [r.move] };
    }
  }
  return chooseMove(phase, b.def.attacks, b.memory, d.dist, world.rng);
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
    b.sinceRest = 0;
    b.sideT = null;
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

  // プレイヤーが遠くに離れ続けている・背後に居続けている時間を数える
  if (!b.hidden) {
    const facingOff = Math.abs(angleDiff(Math.atan2(dy, dx), b.angle));
    b.react.far = d.dist >= BOSS_AI.far ? b.react.far + dt : 0;
    b.react.behind = d.dist < BOSS_AI.far && facingOff > BOSS_AI.behindAngle ? b.react.behind + dt : 0;
  }

  if (b.act) {
    const pattern = PATTERNS[b.act.def.pattern];
    if (pattern.update(world, b, dt, b.act, d)) {
      // 壁に激突して終わったときは、連携の続きを出さない
      if (b.act.phase === 'stun') b.queue = [];
      const comboEnd = b.act.comboEnd;
      b.act = null;
      b.idleT = between(phase.idle, world.rng);
      if (comboEnd) {
        // 連携の締めのあとは、長めの隙
        b.restT = BOSS_AI.comboRest;
        b.idleT += BOSS_AI.comboRest;
      }
    } else if (b.act.dirX != null) {
      b.angle = Math.atan2(b.act.dirY, b.act.dirX);
    }
  } else if (b.queue.length > 0) {
    // 連携の続き：間を空けずに次の技へ
    const name = b.queue.shift();
    startMove(world, b, name, d, { combo: b.queue.length > 0 });
    b.act.comboEnd = b.queue.length === 0;
    b.sinceRest++;
  } else if (b.def.ultimate && !b.ultimateDone && b.hp / b.maxHp <= BOSS_AI.ultimateAt) {
    // 大技：HP が残りわずかになったら、1回だけ
    b.ultimateDone = true;
    b.restT = 0;
    floatText(world, b.x, b.y - b.r - 16, b.def.ultimate.announce, COLORS.amber, 28);
    burst(world, b.x, b.y, COLORS.amber, 36, 320);
    addShake(world, 12);
    startMove(world, b, b.def.ultimate.move, d, { ultimate: true });
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
    b.restT -= dt;
    if (b.restT <= 0 && d.dist > b.r + p.r + 24) {
      b.x += (dx / d.dist) * b.def.speed * dt;
      b.y += (dy / d.dist) * b.def.speed * dt;
    }
    b.idleT -= dt;
    if (b.idleT <= 0) {
      const pick = pickMoves(world, b, phase, d);
      const [name, ...rest] = pick.moves;
      b.queue = rest;
      startMove(world, b, name, d, { combo: rest.length > 0 });
      b.sinceRest = pick.rest ? 0 : b.sinceRest + 1;
      b.memory = { last: pick.moves.at(-1), prev: pick.combo ? pick.moves[0] : b.memory.last, lastCombo: !!pick.combo };
    }
  }

  // 重ねる攻撃：本体の行動とは別に、残る攻撃を一定の間隔で差し込む。冷却の隙と大技の間は、新しく出さない
  if (b.side) {
    if (PATTERNS[b.side.def.pattern].update(world, b, dt, b.side, d)) b.side = null;
  } else if (b.sideRequest) {
    const name = b.sideRequest;
    b.side = { name, def: b.def.attacks[name], phase: '', t: 0, side: true };
    PATTERNS[b.side.def.pattern].start(world, b, b.side, d);
  } else if (phase.side && !b.act?.ultimate && b.act?.def.pattern !== 'vent' && b.restT <= 0) {
    b.sideT = (b.sideT ?? between(phase.side.every, world.rng)) - dt;
    if (b.sideT <= 0) {
      b.sideT = between(phase.side.every, world.rng);
      const name = phase.side.moves[Math.floor(world.rng() * phase.side.moves.length) % phase.side.moves.length];
      b.side = { name, def: b.def.attacks[name], phase: '', t: 0, side: true };
      PATTERNS[b.side.def.pattern].start(world, b, b.side, d);
    }
  }
  b.sideRequest = null;

  // 首：残っている間は本体が硬い。段階によっては、倒された首が時間で生え直す
  if (b.def.heads) {
    const heads = b.def.heads;
    if (!b.headsSpawned) {
      b.headsSpawned = true;
      for (let i = 0; i < heads.count; i++) growHead(world, b, i);
    }
    let alive = world.enemies.filter((e) => e.anchor === b && !e.dead);
    // 大再生：首がすべて生え直す
    if (b.regrowAll) {
      b.regrowAll = false;
      const used = new Set(alive.map((e) => e.headIndex));
      for (let i = 0; i < heads.count; i++) if (!used.has(i)) alive.push(growHead(world, b, i));
    }
    b.armor = alive.length > 0 ? heads.reduce : 0;
    if (phase.regrow && alive.length < heads.count) {
      b.regrowT = (b.regrowT ?? phase.regrow) - dt;
      if (b.regrowT <= 0) {
        b.regrowT = phase.regrow;
        const used = new Set(alive.map((e) => e.headIndex));
        growHead(world, b, [...Array(heads.count).keys()].find((i) => !used.has(i)));
      }
    }
  }

  // 甲羅：向いている方向が正面。硬直中（recover・stun）と、甲羅が割れた段階では、開いていて防げない
  if (b.def.shield) {
    b.facing = b.angle;
    const resting = b.act?.phase === 'recover' || b.act?.phase === 'stun';
    b.shieldOpen = resting || b.restT > 0 || !!phase.noShield;
  }

  if (b.hidden) return; // 潜っている間は、部屋の中にいない
  clampToBounds(b, world.bounds);
  // 体に触れるとダメージ。スタン中は安全。跳んでいる間も当たらない
  const untouchable = b.act?.phase === 'stun' || b.act?.phase === 'air'; // スタン中と、跳んでいる間
  if (!untouchable && circlesOverlap(b.x, b.y, b.r, p.x, p.y, p.r)) hurtPlayer(world, b.def.contactDamage);
}
