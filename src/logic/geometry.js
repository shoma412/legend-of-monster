// 当たり判定などの図形計算

export const DEG = Math.PI / 180;

// 角度の差を -π〜π に直す
export function angleDiff(a, b) {
  const d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

// (ox, oy) から angle の向きに広がる扇（広さ arc ラジアン、半径 range）が、
// 中心 (tx, ty)・半径 tr の円に当たるか。円の端が扇にかかっていれば当たる。
// 密着している相手は向きに関係なく当たる。
export function arcHitsCircle(ox, oy, angle, arc, range, tx, ty, tr, closeRadius = 0) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist - tr > range) return false;
  if (dist < tr + closeRadius) return true;
  // 相手の半径ぶん、角度に余裕を持たせる（狭い扇でも、かすっていれば当たる）
  const margin = Math.asin(Math.min(1, tr / dist));
  return Math.abs(angleDiff(Math.atan2(dy, dx), angle)) <= arc / 2 + margin;
}

// 点 (px, py) から、線分 (x1, y1)-(x2, y2) までの距離（照準線やレーザーの当たり判定）
export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  return Math.hypot(bx - ax, by - ay) < ar + br;
}

// 円を部屋の内側に押し戻す。壁に触れたら true
export function clampToBounds(o, bounds) {
  const x = Math.max(bounds.left + o.r, Math.min(bounds.right - o.r, o.x));
  const y = Math.max(bounds.top + o.r, Math.min(bounds.bottom - o.r, o.y));
  const touched = x !== o.x || y !== o.y;
  o.x = x;
  o.y = y;
  return touched;
}

// wallTop: 上の壁だけ厚みを変えるとき
export function roomBounds(screen, wall, wallTop = wall) {
  return { left: wall, top: wallTop, right: screen.width - wall, bottom: screen.height - wall };
}
