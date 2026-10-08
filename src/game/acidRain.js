// 環境「酸の雨」の動き（docs/詳細仕様.md「28. マップ5「溶解区」と、環境「酸の雨」」）。
// 雨の周期、屋根、雨のダメージ、敵に付く腐食を扱う。雨の降らないマップでは、どれも何もしない。
import { PLAYER } from '../data/balance.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { applyCorrode } from './combat.js';
import { statWith } from './effects.js';
import { burst, floatText, sfx } from './fx.js';

// その部屋の環境が「酸の雨」なら、その定義。そうでなければ null
export function rainEnv(world) {
  const env = world.room?.environment;
  return env?.rain ? env : null;
}

// その場所が、屋根の下か（壊された屋根は数えない）
export function underRoof(world, x, y) {
  return (world.roofs ?? []).some((r) => !(r.broken > 0) && Math.abs(x - r.x) <= r.w / 2 && Math.abs(y - r.y) <= r.h / 2);
}

// 今、雨が降っているか
export function isRaining(world) {
  return world.rain?.phase === 'rain';
}

// 雨の予告が出ているか、降っているか（雨宿りの敵が、屋根へ向かう合図）
export function rainComing(world) {
  return world.rain?.phase === 'warn' || world.rain?.phase === 'rain';
}

// すぐに雨を降らせる（ボスの大技など）。seconds 秒のあいだ降る
export function startRain(world, seconds) {
  if (!rainEnv(world)) return;
  world.rain = { ...(world.rain ?? { hits: 0 }), phase: 'rain', t: seconds, max: seconds, acc: 0 };
  sfx(world, 'warning');
}

// 持続ダメージ（炎上・酸の雨など）で受ける量の倍率。インプラント「錆び止め」で減る（8割まで）
export function dotScale(world) {
  return 1 - Math.min(0.8, world.player.stats.dotResist ?? 0);
}

// 屋根を崩す（seconds 秒のあいだ、使えない）
export function breakRoof(world, roof, seconds) {
  roof.broken = Math.max(roof.broken ?? 0, seconds);
  roof.brokenMax = roof.broken;
  burst(world, roof.x, roof.y, COLORS.ice, 26, 280);
  sfx(world, 'explode');
}

// 雨に1回当たる（プレイヤー）。これで倒れることはない。インプラント「雨具」があれば、当たらない
export function rainHit(world) {
  const env = rainEnv(world);
  const p = world.player;
  if (!env || world.mode !== 'play' || p.stats.rainProof > 0) return;
  const taken = Math.max(PLAYER.minDamageTaken, statWith(world, 'damageTaken'));
  const amount = Math.min(Math.max(0, p.hp - 1), Math.max(1, Math.round(env.damage.amount * taken * dotScale(world) * (world.room.damageScale ?? 1))));
  if (world.rain) world.rain.hits++;
  world.rainHits = (world.rainHits ?? 0) + 1;
  if (amount > 0) {
    p.hp -= amount;
    world.damageTaken += amount;
    floatText(world, p.x + (world.rng() - 0.5) * 16, p.y - 20, '-' + amount, ELEMENT_COLORS.corrode, 13);
  }
}

// 毎フレームの進行：雨の周期、屋根の外にいるプレイヤーへのダメージ、屋根の外の敵への腐食
export function updateRain(world, dt) {
  const env = rainEnv(world);
  if (!env) return;
  // 崩された屋根は、時間がたつと直る
  for (const roof of world.roofs ?? []) if (roof.broken > 0) roof.broken -= dt;
  // 戦闘の間だけ降る
  if (world.mode !== 'play' || world.countdown > 0) {
    world.rain = null;
    return;
  }
  const r = (world.rain ??= { phase: 'clear', t: env.cycle.clear, max: env.cycle.clear, acc: 0, hits: 0 });
  const p = world.player;
  r.t -= dt;
  if (r.t <= 0) {
    if (r.phase === 'clear') {
      Object.assign(r, { phase: 'warn', t: env.cycle.warn, max: env.cycle.warn });
      floatText(world, p.x, p.y - 44, 'Acid Rain', ELEMENT_COLORS.corrode, 16);
      sfx(world, 'warning');
    } else if (r.phase === 'warn') {
      Object.assign(r, { phase: 'rain', t: env.cycle.rain, max: env.cycle.rain, acc: 0 });
    } else {
      Object.assign(r, { phase: 'clear', t: env.cycle.clear, max: env.cycle.clear });
    }
  }
  if (r.phase !== 'rain') return;
  r.acc += dt;
  if (r.acc < env.damage.tick) return;
  r.acc -= env.damage.tick;
  // プレイヤー：屋根の外にいると、少しずつ削られる（これで倒れることはない。ダッシュでは防げない）
  if (!underRoof(world, p.x, p.y)) rainHit(world);
  // 敵：屋根の外にいると、腐食が付く
  for (const e of world.enemies) {
    if (e.dead || e.spawnT > 0 || e.hidden || e.def.prop) continue;
    if (!underRoof(world, e.x, e.y)) applyCorrode(e, world.player.stats.corrodeTime ?? 0);
  }
}

// 屋根を置く場所を決める（部屋を作るときに呼ぶ）。部屋の中の決まった候補から、重ならないように選ぶ
export function placeRoofs(env, bounds, rng) {
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const spots = [[0.27, 0.3], [0.73, 0.3], [0.5, 0.52], [0.27, 0.74], [0.73, 0.74]];
  const range = env.roofs.count;
  const count = range.min + Math.min(range.max - range.min, Math.floor(rng() * (range.max - range.min + 1)));
  const pool = [...spots];
  const roofs = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const [fx, fy] = pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0];
    roofs.push({ x: bounds.left + w * fx, y: bounds.top + h * fy, w: env.roofs.w, h: env.roofs.h });
  }
  return roofs;
}

// いちばん近い屋根（壊されていないもの）。なければ null
export function nearestRoof(world, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const r of world.roofs ?? []) {
    if (r.broken > 0) continue;
    const dist = Math.hypot(r.x - x, r.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }
  return best;
}

export const RAIN_COLOR = COLORS.green;
