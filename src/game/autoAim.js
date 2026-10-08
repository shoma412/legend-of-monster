// 操作方法「オート」の、プレイヤーの向き（docs/詳細仕様.md「26. 操作方法（マニュアル／オート）」）。
// 動いている向きを向く。敵がいるときは、いちばん近い敵のほうを向く。ボスがいるときは、ボスを優先する。

// 向く相手にできるか：出現の予告中・潜っている・消えている（明滅機）ものは、相手にしない
function targetable(e) {
  return !e.dead && e.spawnT <= 0 && !e.hidden && !(e.unseen && e.hit <= 0);
}

function nearest(list, p) {
  let best = null;
  let bestDist = Infinity;
  for (const e of list) {
    const dist = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
    if (dist < bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  return best;
}

// 閃光の予告が出ているか（閃光持ちが構えていて、その光が届く／ボスが閃光を溜めている）。
// オートだと目を背けられないので、この間だけは、動いている向きを向く
export function flashWarning(world) {
  const p = world.player;
  for (const e of world.enemies) {
    if (!targetable(e)) continue;
    if (e.boss) {
      if (e.act?.def.pattern === 'flare' && e.act.phase === 'telegraph') return true;
    } else if (e.def.behavior === 'flasher' && e.state === 'windup' && Math.hypot(e.x - p.x, e.y - p.y) <= e.def.flash.radius + p.r) {
      return true;
    }
  }
  return false;
}

// オートで向く相手（いなければ null）
export function autoTarget(world) {
  const p = world.player;
  const list = world.enemies.filter(targetable);
  const boss = list.find((e) => e.boss);
  // ブレーカーの「残像」の間は、ボスを優先しない（向きで本物がばれないように）
  const mirage = boss && boss.act?.def.pattern === 'afterimage' && boss.act.phase !== 'telegraph' && boss.act.phase !== 'recover';
  if (boss && !mirage) return boss;
  const foes = list.filter((e) => !e.def.prop || e.def.decoy);
  if (foes.length > 0) return nearest(foes, p);
  // 敵がいなければ、壊せるもの（柵、橋げた、ひび割れた壁）
  return nearest(list, p);
}

// オートでの向き。{ x, y }（長さ1）か、向きを変えないなら null。mx, my は、移動キーの向き（長さ1か 0）
export function autoFacing(world, mx, my) {
  const p = world.player;
  const moving = mx !== 0 || my !== 0;
  const target = flashWarning(world) ? null : autoTarget(world);
  if (target) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) return { x: dx / dist, y: dy / dist };
  }
  return moving ? { x: mx, y: my } : null;
}
