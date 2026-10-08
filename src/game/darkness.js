// 環境「暗闇」の動き（docs/詳細仕様.md「24. マップ4「停電区」と、環境「暗闇」」）。
// 見える範囲、非常灯、攻撃の光、目くらみを扱う。明るいマップでは、どれも何もしない。
import { COLORS } from '../data/theme.js';
import { lightReach } from '../logic/darkCells.js';
import { burst, floatText, ring, sfx } from './fx.js';

// その部屋の環境が「暗闇」なら、その定義。そうでなければ null
export function darkEnv(world) {
  const env = world.room?.environment;
  return env?.dark ? env : null;
}

// プレイヤーのまわりの、見える円の半径（px）。明るいマップでは Infinity
export function visionRadius(world) {
  const env = darkEnv(world);
  if (!env) return Infinity;
  const p = world.player;
  // 目くらみと、ボスの「遮断」で、見える円は狭くなる
  const scale = (p.blindT > 0 ? env.blind.scale : 1) * (world.blackout ? world.blackout.scale : 1);
  return env.vision * (1 + (p.stats.visionBonus ?? 0)) * scale;
}

// 今ある灯り（プレイヤーのまわりの円は含まない）：点いている非常灯と、一時的な光。{ x, y, r } の並び
export function lightSources(world) {
  const env = darkEnv(world);
  if (!env) return [];
  const list = [];
  for (const lamp of world.lamps ?? []) if (lamp.on > 0) list.push({ x: lamp.x, y: lamp.y, r: env.lamps.radius });
  // 通電・復電：部屋全体が明るい
  if (world.surgeT > 0) list.push({ x: (world.bounds.left + world.bounds.right) / 2, y: (world.bounds.top + world.bounds.bottom) / 2, r: 4000 });
  for (const l of world.lights ?? []) list.push({ x: l.x, y: l.y, r: l.r * Math.min(1, (l.life / l.max) * 1.6) });
  for (const e of world.enemies ?? []) {
    if (e.dead || e.spawnT > 0) continue;
    // 敵の光の扇（見張り灯）と、照らされた敵（インプラント「照準灯」）
    if (e.cone) list.push({ x: e.x, y: e.y, r: e.cone.range, angle: e.cone.angle, arc: e.cone.arc });
    if (e.litT > 0) list.push({ x: e.x, y: e.y, r: e.r + MARK_LIGHT });
  }
  // ボスの光の扇（照射）
  for (const h of world.hazards ?? []) {
    if (h.type !== 'searchlight') continue;
    for (const angle of beamAngles(h)) list.push({ x: h.x, y: h.y, r: h.range, angle, arc: h.arc });
  }
  return list;
}

// その場所が、灯り（非常灯か一時的な光）に照らされているか。プレイヤーのまわりの円は数えない。明るいマップでは false
export function litByLamp(world, x, y) {
  return lightSources(world).some((l) => (l.arc == null ? Math.hypot(x - l.x, y - l.y) <= l.r : lightReach(l, x, y) < 1));
}

// その場所が見えているか（プレイヤーのまわりの円の中か、灯りに照らされている）。明るいマップでは、いつも true
export function isVisible(world, x, y, margin = 0) {
  if (!darkEnv(world)) return true;
  const p = world.player;
  if (Math.hypot(x - p.x, y - p.y) <= visionRadius(world) + margin) return true;
  return litByLamp(world, x, y);
}

// 一時的な光を足す（攻撃が当たった瞬間、倒すと光る敵、など）。明るいマップでは何もしない
export function addLight(world, x, y, radius, life) {
  if (!darkEnv(world)) return;
  world.lights.push({ x, y, r: radius, life, max: life });
}

// 攻撃が当たった場所を、一瞬照らす。インプラントで大きくなる
export function flashLight(world, x, y) {
  const env = darkEnv(world);
  if (!env) return;
  addLight(world, x, y, env.flash.radius * (1 + (world.player.stats.lightBonus ?? 0)), env.flash.life);
}

// 目くらみ：見える円が、しばらく狭くなる。明るいマップでは何もしない。seconds を書くと、その長さになる
export function blindPlayer(world, seconds = null) {
  const env = darkEnv(world);
  if (!env || world.mode !== 'play') return;
  const p = world.player;
  if (!(p.blindT > 0)) floatText(world, p.x, p.y - 42, 'Blind!', COLORS.magenta, 16);
  // インプラント「中和剤」で、短くなる（8割まで）
  const scale = 1 - Math.min(0.8, p.stats.debuffResist ?? 0);
  p.blindT = Math.max(p.blindT ?? 0, (seconds ?? env.blind.duration) * scale);
}

// プレイヤーが、その場所のほうを向いているか（マウスカーソルの向き。half は、正面から左右に何度までか）
export function isFacing(world, x, y, half) {
  const p = world.player;
  const dx = x - p.x;
  const dy = y - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  return (p.fx * dx + p.fy * dy) / dist >= Math.cos((half * Math.PI) / 180);
}

// 閃光：その場所が光る。光った瞬間に、そちらを向いていると目くらみ。背けていれば、何も起きない。目くらみになったら true
//   def: { radius: 届く距離（0 なら部屋全体）, facing: 正面から左右に何度まで, blind: 目くらみの秒数, light / lightLife: 光の大きさと残る時間 }
export function flashAt(world, x, y, def) {
  const p = world.player;
  addLight(world, x, y, def.light ?? def.radius, def.lightLife ?? 0.5);
  ring(world, x, y, def.radius || 320, COLORS.ink);
  sfx(world, 'zap');
  if (world.mode !== 'play' || !darkEnv(world)) return false;
  if (def.radius > 0 && Math.hypot(p.x - x, p.y - y) > def.radius) return false;
  if (!isFacing(world, x, y, def.facing)) {
    floatText(world, p.x, p.y - 42, 'Averted', COLORS.cyan, 13);
    return false;
  }
  blindPlayer(world, def.blind);
  return true;
}

// その部屋の非常灯を、すべて1回は点けたか（非常灯のない部屋は、点けたものとして数える）
export function allLampsLit(world) {
  return (world.lamps ?? []).every((lamp) => lamp.lit);
}

// 遮断（ボス「ブレーカー」）：seconds 秒のあいだ、非常灯がすべて消えて点かず、見える円が scale 倍になる
export function startBlackout(world, seconds, scale) {
  if (!darkEnv(world)) return;
  world.blackout = { t: seconds, scale };
  world.surgeT = 0;
  for (const lamp of world.lamps) lamp.on = 0;
}

// 通電・復電：seconds 秒のあいだ、部屋全体が明るくなる。遮断は終わる
export function powerOn(world, seconds) {
  if (!darkEnv(world)) return;
  world.blackout = null;
  world.surgeT = Math.max(world.surgeT ?? 0, seconds);
}

// 部屋の非常灯を、すべて点ける（壊されていたものも直る）
export function lightAllLamps(world) {
  const env = darkEnv(world);
  if (!env) return;
  for (const lamp of world.lamps) {
    lamp.broken = 0;
    lamp.on = env.lamps.duration;
    lamp.lit = true;
  }
}

// その場所が、点いている非常灯の光の中か
export function nearLitLamp(world, x, y) {
  const env = darkEnv(world);
  if (!env) return false;
  return (world.lamps ?? []).some((lamp) => lamp.on > 0 && Math.hypot(x - lamp.x, y - lamp.y) <= env.lamps.radius);
}

// ボスの光の扇（照射）の、それぞれの向き
export function beamAngles(h) {
  return Array.from({ length: h.count }, (_, i) => h.angle + (i * Math.PI * 2) / h.count);
}

const MARK_LIGHT = 46; // 照らされた敵（照準灯）のまわりの、明るい範囲（px。敵の半径に足す）

// 非常灯を壊す（seconds 秒のあいだ、点かなくなる）
export function breakLamp(world, lamp, seconds) {
  lamp.on = 0;
  lamp.broken = Math.max(lamp.broken, seconds);
  burst(world, lamp.x, lamp.y, COLORS.amber, 12, 200);
  sfx(world, 'block');
}

// 毎フレームの進行：非常灯の点灯と残り時間、一時的な光、目くらみ
export function updateDarkness(world, dt) {
  const env = darkEnv(world);
  const p = world.player;
  if (p.blindT > 0) p.blindT -= dt;
  if (!env) return;
  if (world.surgeT > 0) world.surgeT -= dt;
  if (world.blackout) {
    world.blackout.t -= dt;
    if (world.blackout.t <= 0) world.blackout = null;
  }
  for (const lamp of world.lamps) {
    if (lamp.broken > 0) {
      lamp.broken -= dt;
      continue;
    }
    // 遮断の間は、非常灯は点かない
    if (world.blackout) {
      lamp.on = 0;
      continue;
    }
    if (lamp.on > 0) lamp.on -= dt;
    // 近づくと点く（点いている間に近づけば、時間が戻る）
    if (Math.hypot(p.x - lamp.x, p.y - lamp.y) <= env.lamps.trigger) {
      if (lamp.on <= 0) sfx(world, 'select');
      lamp.on = env.lamps.duration;
      lamp.lit = true;
    }
  }
  for (const l of world.lights) l.life -= dt;
  world.lights = world.lights.filter((l) => l.life > 0);
}

// 非常灯を置く場所を決める（部屋を作るときに呼ぶ）。部屋の中の決まった候補から、重ならないように選ぶ
export function placeLamps(env, bounds, rng) {
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const spots = [[0.3, 0.28], [0.7, 0.28], [0.5, 0.5], [0.3, 0.74], [0.7, 0.74], [0.5, 0.2], [0.5, 0.8]];
  const count = env.lamps.count.min + Math.min(env.lamps.count.max - env.lamps.count.min, Math.floor(rng() * (env.lamps.count.max - env.lamps.count.min + 1)));
  const pool = [...spots];
  const lamps = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const [fx, fy] = pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0];
    lamps.push({ x: bounds.left + w * fx, y: bounds.top + h * fy });
  }
  return lamps;
}
