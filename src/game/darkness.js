// 環境「暗闇」の動き（docs/詳細仕様.md「24. マップ4「停電区」と、環境「暗闇」」）。
// 見える範囲、非常灯、攻撃の光、目くらみを扱う。明るいマップでは、どれも何もしない。
import { COLORS } from '../data/theme.js';
import { burst, floatText, sfx } from './fx.js';

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
  const scale = p.blindT > 0 ? env.blind.scale : 1;
  return env.vision * (1 + (p.stats.visionBonus ?? 0)) * scale;
}

// 今ある灯り（プレイヤーのまわりの円は含まない）：点いている非常灯と、一時的な光。{ x, y, r } の並び
export function lightSources(world) {
  const env = darkEnv(world);
  if (!env) return [];
  const list = [];
  for (const lamp of world.lamps ?? []) if (lamp.on > 0) list.push({ x: lamp.x, y: lamp.y, r: env.lamps.radius });
  for (const l of world.lights ?? []) list.push({ x: l.x, y: l.y, r: l.r * Math.min(1, (l.life / l.max) * 1.6) });
  return list;
}

// その場所が、灯り（非常灯か一時的な光）に照らされているか。プレイヤーのまわりの円は数えない。明るいマップでは false
export function litByLamp(world, x, y) {
  return lightSources(world).some((l) => Math.hypot(x - l.x, y - l.y) <= l.r);
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

// 目くらみ：見える円が、しばらく狭くなる。明るいマップでは何もしない
export function blindPlayer(world) {
  const env = darkEnv(world);
  if (!env || world.mode !== 'play') return;
  const p = world.player;
  if (!(p.blindT > 0)) floatText(world, p.x, p.y - 42, '目くらみ!', COLORS.magenta, 16);
  p.blindT = env.blind.duration;
}

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
  for (const lamp of world.lamps) {
    if (lamp.broken > 0) {
      lamp.broken -= dt;
      continue;
    }
    if (lamp.on > 0) lamp.on -= dt;
    // 近づくと点く（点いている間に近づけば、時間が戻る）
    if (Math.hypot(p.x - lamp.x, p.y - lamp.y) <= env.lamps.trigger) {
      if (lamp.on <= 0) sfx(world, 'select');
      lamp.on = env.lamps.duration;
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
