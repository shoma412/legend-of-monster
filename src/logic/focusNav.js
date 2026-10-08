// メニューの押せるもの（ボタン）を、上下左右で選ぶ（画面には触らない。docs/詳細仕様.md「32. ゲームパッド」）。
// targets は { x, y, w, h }（左上と大きさ）の並び。返り値は、どれも targets の中の番号（なければ -1）。

const center = (t) => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 });

// at（{ x, y }）にいちばん近いもの
export function nearestTarget(targets, at) {
  let best = -1;
  let bestD = Infinity;
  targets.forEach((t, i) => {
    const c = center(t);
    const d = Math.hypot(c.x - at.x, c.y - at.y);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

// いちばん左上のもの（最初に選ぶもの）
export function firstTarget(targets) {
  let best = -1;
  targets.forEach((t, i) => {
    if (best < 0 || t.y < targets[best].y - 4 || (Math.abs(t.y - targets[best].y) <= 4 && t.x < targets[best].x)) best = i;
  });
  return best;
}

// 今のもの（current）から、dir（up / down / left / right）の向きにある、いちばん近いもの。なければ、今のまま。
// 向きからずれているものは、遠いものとして扱う（まっすぐ先にあるものを選びやすくする）
export function moveFocus(targets, current, dir) {
  if (current < 0 || !targets[current]) return firstTarget(targets);
  const from = center(targets[current]);
  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'left' || dir === 'up' ? -1 : 1;
  let best = current;
  let bestScore = Infinity;
  targets.forEach((t, i) => {
    if (i === current) return;
    const c = center(t);
    const along = ((horizontal ? c.x - from.x : c.y - from.y)) * sign;
    const across = Math.abs(horizontal ? c.y - from.y : c.x - from.x);
    if (along <= 4) return;
    const score = along + across * 2.5;
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}
