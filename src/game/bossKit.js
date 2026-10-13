// ボスごとの固有の攻撃（src/game/map1Bosses.js, map2Bosses.js …）を書くときの、小さな道具。攻撃そのものではない（共通の「部品」ではなく、書きやすくするための関数）。
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ボスからプレイヤーへの向きを、act.dirX / act.dirY に入れる（boss.js が、これを見てボスの向きを決める）
export function aim(act, d) {
  act.dirX = d.dx / d.dist;
  act.dirY = d.dy / d.dist;
}

// 「予告 → 発動 → （残る攻撃が終わるまで待つ）→ 硬直」の流れの部品。
//   fire(world, b, act, d): 発動のときに呼ばれる。act.hs に、待つ対象（hazard や敵）を入れる
//   finished(world, b, act, dt): 待つ間、毎フレーム呼ばれる。true で硬直へ。省略すると、act.hs が全部消えたら
//   early: true なら、始まったときに fire を呼ぶ（予告の間に動く hazard を置く）
export function timed({ fire, finished, early = false }) {
  return {
    start(world, b, act, d) {
      act.phase = 'telegraph';
      act.t = act.def.telegraph;
      act.hs = [];
      aim(act, d);
      if (early) fire(world, b, act, d);
    },
    update(world, b, dt, act, d) {
      const def = act.def;
      act.t -= dt;
      if (act.phase === 'telegraph') {
        if (act.t > (def.lockTime ?? 0)) aim(act, d);
        if (act.t <= 0) {
          act.phase = 'active';
          if (!early) fire(world, b, act, d);
        }
      } else if (act.phase === 'active') {
        const done = finished ? finished(world, b, act, dt) : act.hs.every((h) => h.dead);
        if (done) {
          act.phase = 'recover';
          act.t = act.recoverT ?? def.recover;
        }
      } else if (act.t <= 0) {
        return true;
      }
      return false;
    },
  };
}

// 予告の円（hazard 'mark'）を置く。spec: { x, y, r, t, damage, color, extra }。extra に shards / pool / float / split / from を書ける
export function pushMark(world, act, b, spec) {
  const mark = { type: 'mark', x: spec.x, y: spec.y, r: spec.r, t: spec.t, max: spec.t, damage: spec.damage, enemyDamage: 0, color: spec.color ?? b.color, ...(spec.extra ?? {}) };
  world.hazards.push(mark);
  act.hs.push(mark);
  return mark;
}

// プレイヤーの動いている向きと速さ（なめらかにならした値）を、act.vx / act.vy に覚えておく（毎フレーム呼ぶ）
export function trackVelocity(act, p, dt) {
  if (act.lx == null) {
    act.lx = p.x;
    act.ly = p.y;
    act.vx = 0;
    act.vy = 0;
    return;
  }
  if (dt <= 0) return;
  const k = Math.min(1, dt * 8);
  act.vx += ((p.x - act.lx) / dt - act.vx) * k;
  act.vy += ((p.y - act.ly) / dt - act.vy) * k;
  act.lx = p.x;
  act.ly = p.y;
}

// 点 (x, y) から向き (dx, dy)（長さ 1）へまっすぐ進んだとき、部屋の端（margin だけ内側）に着くまでの距離
export function rayToBounds(bounds, x, y, dx, dy, margin = 0) {
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (bounds.right - margin - x) / dx);
  if (dx < -1e-6) t = Math.min(t, (bounds.left + margin - x) / dx);
  if (dy > 1e-6) t = Math.min(t, (bounds.bottom - margin - y) / dy);
  if (dy < -1e-6) t = Math.min(t, (bounds.top + margin - y) / dy);
  return Math.max(0, t);
}

// 錆：しばらく、与えるダメージが下がる（付け直すと、時間が戻る）。rust: { amount, duration }
export function applyRust(world, rust) {
  const p = world.player;
  p.buffs = p.buffs.filter((x) => x.id !== 'rust');
  p.buffs.push({ id: 'rust', stat: 'attackMul', add: -rust.amount, t: rust.duration, max: rust.duration, color: '#ff7a3d' });
}

export function inside(world, x, y, margin = 0) {
  const b = world.bounds;
  return x >= b.left + margin && x <= b.right - margin && y >= b.top + margin && y <= b.bottom - margin;
}

export function randomSpot(world, margin = 40) {
  const b = world.bounds;
  return { x: b.left + margin + world.rng() * (b.right - b.left - margin * 2), y: b.top + margin + world.rng() * (b.bottom - b.top - margin * 2) };
}
