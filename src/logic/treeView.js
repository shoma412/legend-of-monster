// スキルツリーの円を、拡大・縮小したり、動かしたりするための計算（画面には触らない）。
// view: { zoom, x, y } … zoom は倍率、x・y は「円の中心から見て、今どこを画面の真ん中に出しているか」

export const TREE_VIEW = {
  min: 1, // いちばん引いた状態（円の全体が見える）
  max: 3, // いちばん寄った状態
  step: 1.2, // ホイール1回ぶんの倍率
  reach: 150, // 円の中心から、これより遠くは真ん中に出せない（px。拡大していないときの長さ）
};

export function createTreeView() {
  return { zoom: 1, x: 0, y: 0 };
}

// 見ている場所が、円から離れすぎないようにする。いちばん引いた状態では、必ず円の真ん中に戻す
export function clampView(view) {
  const zoom = Math.max(TREE_VIEW.min, Math.min(TREE_VIEW.max, view.zoom));
  if (zoom <= TREE_VIEW.min + 1e-6) return { zoom: TREE_VIEW.min, x: 0, y: 0 };
  // 寄っているほど、遠くまで動かせる
  const limit = TREE_VIEW.reach * (1 - 1 / zoom);
  const dist = Math.hypot(view.x, view.y);
  const k = dist > limit ? limit / dist : 1;
  return { zoom, x: view.x * k, y: view.y * k };
}

// 円の中の位置（中心が 0,0）を、画面の位置に直す。center は、円を出す枠の真ん中
export function toScreen(view, center, local) {
  return { x: center.x + (local.x - view.x) * view.zoom, y: center.y + (local.y - view.y) * view.zoom };
}

// 画面の位置を、円の中の位置に直す
export function toLocal(view, center, screen) {
  return { x: (screen.x - center.x) / view.zoom + view.x, y: (screen.y - center.y) / view.zoom + view.y };
}

// マウスのある場所を中心に、拡大（direction が 1）・縮小（-1）する。マウスの下にあるものは、できるだけ動かない
export function zoomAt(view, center, pointer, direction) {
  const zoom = Math.max(TREE_VIEW.min, Math.min(TREE_VIEW.max, view.zoom * (direction > 0 ? TREE_VIEW.step : 1 / TREE_VIEW.step)));
  const under = toLocal(view, center, pointer);
  return clampView({ zoom, x: under.x - (pointer.x - center.x) / zoom, y: under.y - (pointer.y - center.y) / zoom });
}

// 画面の上で (dx, dy) だけ引っぱったぶん、見ている場所を動かす
export function panBy(view, dx, dy) {
  return clampView({ zoom: view.zoom, x: view.x - dx / view.zoom, y: view.y - dy / view.zoom });
}

// その位置（円の中の位置）が画面の真ん中に来るように動かす
export function centerOn(view, local) {
  return clampView({ zoom: view.zoom, x: local.x, y: local.y });
}

// 線を、四角い枠の中だけに切りつめる。枠の外にあって見えない線は null
//   rect: { left, top, right, bottom }
export function clipSegment(x1, y1, x2, y2, rect) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const edges = [[-dx, x1 - rect.left], [dx, rect.right - x1], [-dy, y1 - rect.top], [dy, rect.bottom - y1]];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  return { x1: x1 + dx * t0, y1: y1 + dy * t0, x2: x1 + dx * t1, y2: y1 + dy * t1 };
}

export function inRect(x, y, rect, margin = 0) {
  return x >= rect.left + margin && x <= rect.right - margin && y >= rect.top + margin && y <= rect.bottom - margin;
}
