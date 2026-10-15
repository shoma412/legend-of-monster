// スキルツリーの、画面の上の位置を決める計算（画面には触らない。docs/詳細仕様.md「23. スキルツリー」の「マスが増えても重ならない並び」）。
//   放射状の樹（中心から外へ枝が伸びる）。段（深さ）ごとの輪の間隔はいつも同じ。
//   枝ごとに「扇形の取り分」を持ち、取り分の広さは「その枝の先のマスが、輪の上で隣と NODE_GAP 以上あく広さ」から決める。
//   取り分は重ならないので、マス同士・マスと線は、作りから重ならない。マスが増えたら、輪の間隔が広がる（枠の広さには縛られない）。
export const TREE_RINGS = [0, 24, 46, 68, 86, 101, 114, 126, 138, 150]; // 旧：段ごとの、中心からの距離（広げる前）。もう位置には使わない（互換のために残す）
export const TREE_STRETCH = 1; // 輪は、真円
export const NODE_GAP = 30; // 同じ輪の上で、隣り合うマスの中心の間に、最低限あけたい長さ（マスの直径 16 ＋ 名前や線の余裕）
export const MIN_STEP = 70; // 輪の間隔の、最低限の長さ

const cache = new WeakMap();

// layout は layoutTree(tree) の返り値。返り値：
//   step     : 輪の間隔（段 d の輪の半径は step × d）
//   points   : { マスの id: { x, y } }（中心が 0,0）
//   ids・nodes・pts: テストと確認用（nodes は { x, y, parent }。parent は ids の中の番号、中心につながるマスは -1）
//   extent   : { x, y }（いちばん外のマスの、中心からの長さ）
//   radiusOf : 段 → 輪の半径
export function worldLayout(layout) {
  if (cache.has(layout)) return cache.get(layout);
  const ids = Object.keys(layout.pos);
  const index = Object.fromEntries(ids.map((id, i) => [id, i]));
  const kids = new Map();
  for (const id of ids) {
    const parent = layout.pos[id].parent ?? null;
    if (!kids.has(parent)) kids.set(parent, []);
    kids.get(parent).push(id);
  }
  for (const list of kids.values()) list.sort((a, b) => layout.pos[a].row - layout.pos[b].row);
  const roots = kids.get(null) ?? [];
  const depthOf = (id) => layout.pos[id].col;

  // 輪の間隔が step のとき、各マスの枝が必要とする角度の広さ（自分の輪で NODE_GAP あくための広さと、枝の先の合計の、大きいほう）
  const needs = (step) => {
    const memo = new Map();
    const need = (id) => {
      if (memo.has(id)) return memo.get(id);
      const own = NODE_GAP / (step * depthOf(id));
      const sum = (kids.get(id) ?? []).reduce((s, c) => s + need(c), 0);
      const value = Math.max(own, sum);
      memo.set(id, value);
      return value;
    };
    return { need, total: roots.reduce((s, r) => s + need(r), 0) };
  };
  // 全体の角度が 2π に収まる、いちばん小さい間隔を探す
  let lo = MIN_STEP;
  let hi = MIN_STEP;
  while (needs(hi).total > Math.PI * 2 && hi < 100000) hi *= 2;
  if (needs(lo).total > Math.PI * 2) {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (needs(mid).total > Math.PI * 2) lo = mid;
      else hi = mid;
    }
  } else {
    hi = lo;
  }
  const step = Math.ceil(hi * 1.01);
  const { need } = needs(step);

  // 扇形を割り振る：自分の取り分の真ん中に自分を置き、枝の先へ、必要な広さに比例して分ける
  //   自分の位置は、枝の先のマスの真ん中（線が斜めに伸びすぎない）。ただし、自分の取り分の中で、隣と NODE_GAP あくところまで
  const angle = new Map();
  const place = (id, a0, a1) => {
    const list = kids.get(id) ?? [];
    const total = list.reduce((s, c) => s + need(c), 0);
    let at = a0;
    for (const c of list) {
      const width = ((a1 - a0) * need(c)) / total;
      place(c, at, at + width);
      at += width;
    }
    const own = NODE_GAP / (step * depthOf(id));
    const want = list.length > 0 ? (angle.get(list[0]) + angle.get(list.at(-1))) / 2 : (a0 + a1) / 2;
    angle.set(id, Math.max(a0 + own / 2, Math.min(a1 - own / 2, want)));
  };
  {
    const total = roots.reduce((s, r) => s + need(r), 0);
    let at = -Math.PI / 2;
    for (const r of roots) {
      const width = (Math.PI * 2 * need(r)) / total;
      place(r, at, at + width);
      at += width;
    }
  }
  const nodes = ids.map((id) => {
    const radius = step * depthOf(id);
    return { x: Math.cos(angle.get(id)) * radius, y: Math.sin(angle.get(id)) * radius, parent: layout.pos[id].parent ? index[layout.pos[id].parent] : -1 };
  });
  const pts = nodes.map((n) => ({ x: n.x, y: n.y }));
  const points = Object.fromEntries(ids.map((id, i) => [id, pts[i]]));
  const maxDepth = Math.max(1, ...ids.map(depthOf));
  const extent = { x: Math.max(1, ...pts.map((q) => Math.abs(q.x))), y: Math.max(1, ...pts.map((q) => Math.abs(q.y))) };
  const result = { step, points, ids, nodes, pts, extent, maxDepth, radiusOf: (d) => step * d };
  cache.set(layout, result);
  return result;
}
