// 操作方法「オート」の、プレイヤーの向き（docs/詳細仕様.md「26. 操作方法（マニュアル／オート）」）。
// 敵を1体ロックオンして、その敵のほうを向き続ける。R キーで、次に近い敵へ切り替える。敵がいなければ、動いている向きを向く。
import { isVisible } from './darkness.js';

// ロックオンできるか：出現の予告中・潜っている・消えている（明滅機）ものは、できない。
// 暗闇では、見えている敵（自分のまわりの円の中か、灯りに照らされている敵）だけ
export function lockable(world, e) {
  if (!e || e.dead || e.spawnT > 0 || e.hidden || (e.unseen && e.hit <= 0)) return false;
  return isVisible(world, e.x, e.y, e.r);
}

const gap = (e, p) => Math.hypot(e.x - p.x, e.y - p.y) - e.r;

// ロックオンの候補を、近い順に並べたもの。敵がいれば敵だけ。いなければ、壊せるもの（柵、橋げた、ひび割れた壁）
export function lockCandidates(world) {
  const p = world.player;
  const list = world.enemies.filter((e) => lockable(world, e));
  const foes = list.filter((e) => !e.def.prop || e.def.decoy);
  return (foes.length > 0 ? foes : list).sort((a, b) => gap(a, p) - gap(b, p));
}

// ブレーカーの「残像」が出ている間か（本物と偽物を、同じに扱う）
function mirageOf(world) {
  const b = world.boss;
  return b && !b.dead && b.act?.def.pattern === 'afterimage' && (b.act.phase === 'aim' || b.act.phase === 'active') ? b.act : null;
}

// 最初にロックオンする相手：ボスがいれば、ボス。いなければ、いちばん近い敵。残像の間は、いちばん近いもの
function firstTarget(world, list) {
  if (mirageOf(world)) return list[0] ?? null;
  return list.find((e) => e.boss) ?? list[0] ?? null;
}

// 閃光の予告が出ているか（閃光持ちが構えていて、その光が届く／ボスが閃光を溜めている）。
// オートだと目を背けられないので、この間だけは、動いている向きを向く
export function flashWarning(world) {
  const p = world.player;
  for (const e of world.enemies) {
    if (e.dead || e.spawnT > 0 || e.hidden) continue;
    if (e.boss) {
      if (e.act?.def.pattern === 'flare' && e.act.phase === 'telegraph') return true;
    } else if (e.def.behavior === 'flasher' && e.state === 'windup' && Math.hypot(e.x - p.x, e.y - p.y) <= e.def.flash.radius + p.r) {
      return true;
    }
  }
  return false;
}

// ロックオンを進める（毎フレーム呼ぶ）。switchPressed は、R キーが押された瞬間。返り値は、今ロックオンしている敵（いなければ null）
export function updateLock(world, switchPressed = false) {
  const p = world.player;
  const list = lockCandidates(world);
  // 残像が並び直したら、いちばん近いものに付け直す（本物を向いたままだと、向きで本物がばれる）
  const mirage = mirageOf(world);
  const round = mirage && mirage.phase === 'aim' ? mirage.remaining : null;
  if (mirage && round !== null && (p.lockMirage?.act !== mirage || p.lockMirage.round !== round)) {
    p.lockMirage = { act: mirage, round };
    p.lock = list[0] ?? null;
  } else if (!mirage) {
    p.lockMirage = null;
  }
  if (!list.includes(p.lock)) p.lock = firstTarget(world, list);
  else if (switchPressed && list.length > 1) p.lock = list[(list.indexOf(p.lock) + 1) % list.length];
  return p.lock;
}

// オートでの向き。{ x, y }（長さ1）か、向きを変えないなら null。mx, my は、移動キーの向き（長さ1か 0）
export function autoFacing(world, mx, my, switchPressed = false) {
  const p = world.player;
  const moving = mx !== 0 || my !== 0;
  const target = updateLock(world, switchPressed);
  if (target && !flashWarning(world)) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) return { x: dx / dist, y: dy / dist };
  }
  return moving ? { x: mx, y: my } : null;
}
