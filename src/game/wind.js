// 環境「強風」の動き（docs/詳細仕様.md「30. マップ6「送風区」と、環境「強風」」）。
// 風の周期、遮風板、風に流されるもの（プレイヤー・敵・弾）を扱う。風の吹かないマップでは、どれも何もしない。
// ボスの「吸引」も、同じ「空気の流れ」として扱う（遮風板の陰にいれば、吸われない）。
import { ELEMENT_COLORS } from '../data/theme.js';
import { clampToBounds } from '../logic/geometry.js';
import { floatText, sfx } from './fx.js';

export const WIND_COLOR = ELEMENT_COLORS.cold;
const DIRECTIONS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

// その部屋の環境が「強風」なら、その定義。そうでなければ null
export function windEnv(world) {
  const env = world.room?.environment;
  return env?.wind ? env : null;
}

// 今、風が吹いているか
export function isBlowing(world) {
  return world.wind?.phase === 'blow';
}

// 風の予告が出ているか、吹いているか（錨打ちが、杭を打つ合図）
export function windComing(world) {
  return world.wind?.phase === 'warn' || world.wind?.phase === 'blow';
}

// その場所での、空気の流れの向き（長さ1）。流れがなければ null。
//   ボスが吸っている間は、ボスへ向かう流れ（world.suction。扇形に吸うときは、その中だけ）。それ以外は、風の向き
export function flowAt(world, x, y, { warn = false } = {}) {
  const s = world.suction;
  if (s && s.until >= world.time) {
    const dx = s.x - x;
    const dy = s.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    if (s.arc != null) {
      // 扇形：ボスの正面（s.angle）から、左右に s.arc / 2 の中だけ
      let diff = Math.atan2(-dy, -dx) - s.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > s.arc / 2) return null;
    }
    return { x: dx / dist, y: dy / dist, suction: true };
  }
  const w = world.wind;
  if (w && (w.phase === 'blow' || (warn && w.phase === 'warn'))) return { x: w.dirX, y: w.dirY };
  return null;
}

// 陰ができる向き。風は、風下側。吸い込みは、吸い込み口の反対側（板が、口との間に入る）
export function shadowOf(flow) {
  return flow.suction ? { x: -flow.x, y: -flow.y } : { x: flow.x, y: flow.y };
}

// その場所が、遮風板の陰か（陰ができる向き (dirX, dirY) に、板から lee px まで。飛ばされた板は数えない）
export function sheltered(world, x, y, dirX, dirY) {
  const env = windEnv(world);
  if (!env) return false;
  for (const s of world.screens ?? []) {
    if (s.broken > 0) continue;
    const along = (x - s.x) * dirX + (y - s.y) * dirY;
    const across = Math.abs((x - s.x) * dirY - (y - s.y) * dirX);
    if (along >= 0 && along <= env.screens.lee && across <= env.screens.width / 2) return true;
  }
  return false;
}

// プレイヤーが流される量の倍率。インプラント「風よけ」で減る（9割まで）
export function windScale(world) {
  return 1 - Math.min(0.9, world.player.stats.windResist ?? 0);
}

// 風に流されない敵：ボス、置かれたもの、体から生えた首、杭を打った錨打ち、潜っているもの
function rooted(e) {
  return e.dead || e.spawnT > 0 || e.boss || e.def.prop || e.def.solid || e.anchor || e.staked || e.hidden || e.state === 'latched';
}

// (x, y) にあるものを、流れに沿って speed px/秒 で動かす。遮風板の陰なら動かさない。動かしたら true
function drift(world, o, speed, dt) {
  const flow = flowAt(world, o.x, o.y);
  if (!flow) return false;
  const shadow = shadowOf(flow);
  if (sheltered(world, o.x, o.y, shadow.x, shadow.y)) return false;
  o.x += flow.x * speed * dt;
  o.y += flow.y * speed * dt;
  return true;
}

// 毎フレームの進行：風の周期、流されるもの
export function updateWind(world, dt) {
  const env = windEnv(world);
  if (!env) return;
  for (const s of world.screens ?? []) {
    if (s.broken > 0) s.broken -= dt;
    if (s.loose > 0) s.loose -= dt;
    // 揺れ終わった板は、飛ぶ
    if (s.flyAt != null && world.time >= s.flyAt) {
      s.flyAt = null;
      s.loose = 0;
      s.broken = s.restore;
      sfx(world, 'block');
    }
  }
  // 戦闘の間だけ吹く
  if (world.mode !== 'play' || world.countdown > 0) {
    world.wind = null;
    return;
  }
  const w = (world.wind ??= { phase: 'clear', t: env.cycle.clear, max: env.cycle.clear, dirX: 1, dirY: 0 });
  const p = world.player;
  // ボスが吸っている間は、風は止まる（予告や風の途中だったら、やめて、少しあとに出直す）
  if (world.suction && world.suction.until >= world.time) {
    if (w.phase !== 'clear') Object.assign(w, { phase: 'clear', t: env.cycle.retry, max: env.cycle.clear, pushing: false });
    return;
  }
  w.t -= dt;
  if (w.t <= 0) {
    if (w.phase === 'clear') {
      const dir = DIRECTIONS[Math.floor(world.rng() * DIRECTIONS.length) % DIRECTIONS.length];
      Object.assign(w, { phase: 'warn', t: env.cycle.warn, max: env.cycle.warn, dirX: dir.x, dirY: dir.y });
      floatText(world, p.x, p.y - 44, 'Gale', WIND_COLOR, 16);
      sfx(world, 'warning');
    } else if (w.phase === 'warn') {
      Object.assign(w, { phase: 'blow', t: env.cycle.blow, max: env.cycle.blow });
    } else {
      Object.assign(w, { phase: 'clear', t: env.cycle.clear, max: env.cycle.clear });
    }
  }
  if (w.phase !== 'blow') return;
  // プレイヤー：遮風板の陰にいなければ、風下へ流される（ダッシュ中も流されるので、追い風では伸び、向かい風では縮む）
  w.pushing = drift(world, p, env.push.player * windScale(world), dt);
  if (w.pushing) clampToBounds(p, world.bounds);
  // 種族「吸気」のボーナス：風の間は、ダッシュの回復が速い
  const haste = Math.min(0.6, p.stats.windDash ?? 0);
  if (haste > 0 && p.dashRecharge > 0) p.dashRecharge -= (dt * haste) / (1 - haste);
  // 敵：同じように流される。流されている間は「引き寄せた敵」と同じ扱い（種族「吸気」のボーナス）
  for (const e of world.enemies) {
    if (rooted(e)) continue;
    if (drift(world, e, env.push.enemy, dt)) {
      e.pulledT = Math.max(e.pulledT ?? 0, 0.3);
      clampToBounds(e, world.bounds);
    }
  }
  // 弾：敵の弾も、こちらの弾も流される（遮風板では止まらない）
  for (const s of world.shots) {
    s.x += w.dirX * env.push.shot * dt;
    s.y += w.dirY * env.push.shot * dt;
  }
  for (const s of world.playerShots) {
    s.x += w.dirX * env.push.shot * dt;
    s.y += w.dirY * env.push.shot * dt;
  }
}

// ボスが吸う（吸引・全開）。このフレームのあいだ、(x, y) へ向かう流れを作り、プレイヤーを strength px/秒 で引く。
//   arc・angle を書くと、その扇形の中だけ。ダッシュ中と、遮風板の陰では、引かれない。引かれたら true
export function suck(world, x, y, strength, dt, { arc = null, angle = 0, stop = 0 } = {}) {
  world.suction = { x, y, arc, angle, until: world.time + dt * 1.5 };
  const p = world.player;
  if (p.dashT > 0) return false;
  const flow = flowAt(world, p.x, p.y);
  if (!flow || !flow.suction || sheltered(world, p.x, p.y, -flow.x, -flow.y)) return false;
  if (Math.hypot(x - p.x, y - p.y) <= stop) return true; // 口まで来たら、それ以上は引かない
  p.x += flow.x * strength * windScale(world) * dt;
  p.y += flow.y * strength * windScale(world) * dt;
  clampToBounds(p, world.bounds);
  return true;
}

// 遮風板を1枚、飛ばす（ボスの大技）。warn 秒のあいだ揺れてから飛び、seconds 秒たつと、元の場所に戻る
export function loosenScreen(world, screen, warn, seconds) {
  screen.loose = warn;
  screen.flyAt = world.time + warn;
  screen.restore = seconds;
}

// 遮風板を置く場所を決める（部屋を作るときに呼ぶ）。部屋の中の決まった候補から選ぶ。all: true なら、いちばん多い数を置く（ボス部屋）
export function placeScreens(env, bounds, rng, { all = false } = {}) {
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const spots = [[0.3, 0.32], [0.7, 0.32], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]];
  const range = env.screens.count;
  const count = all ? range.max : range.min + Math.min(range.max - range.min, Math.floor(rng() * (range.max - range.min + 1)));
  const pool = [...spots];
  const screens = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const [fx, fy] = pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0];
    screens.push({ x: bounds.left + w * fx, y: bounds.top + h * fy });
  }
  return screens;
}
