// スキルツリーの、画面の上の位置を決める計算（画面には触らない。docs/詳細仕様.md「23. スキルツリー」の「マスが増えても重ならない並び」）。
//   マスが増えても重ならないように、輪ごとに、乗るマスの数に合わせて半径を広げる。画面の枠の広さには、縛られない（引いて見る・寄って見る・動かす）。
import { SPREAD, countOverlaps, spreadNodes } from './treeSpread.js';

export const TREE_RINGS = [0, 24, 46, 68, 86, 101, 114]; // 段ごとの、中心からの距離（縦の長さ。広げる前）
export const TREE_PUSH = 0.5; // 3つに分かれた枝の左右を、外へずらす長さ（次の輪までの間の、何割か）
export const TREE_PUSH_OUTER = 7; // いちばん外の輪のマスを、外へずらす長さ
export const TREE_STRETCH = 2.15; // 横は、縦の何倍に広げるか
export const NODE_GAP = 40; // 同じ輪の上で、隣り合うマスの中心の間に、最低限あけたい長さ（マスの直径 16 ＋ 名前や線の余裕）
export const RING_STEP = 64; // 隣り合う輪の、半径の最低限の差（輪と輪の間に、線と名前が通れる）
const SPARE = 1.3; // 輪に乗るマスは、均等には並ばないので、少し余裕を見る

// マスの、中心からの距離（広げる前）。外へずらすマスは、次の輪との間に置く
export function ringRadius(p) {
  const col = Math.min(TREE_RINGS.length - 1, p.col);
  const gap = col < TREE_RINGS.length - 1 ? (TREE_RINGS[col + 1] - TREE_RINGS[col]) * TREE_PUSH : TREE_PUSH_OUTER;
  return TREE_RINGS[col] + (p.push > 0 ? gap : 0);
}

const cache = new WeakMap();

// layout は layoutTree(tree) の返り値。返り値：
//   fit      : 外へずらしたマスがはみ出さないように縮める割合
//   radiusFor: 広げる前の半径 → 広げたあとの半径（輪の目安の線を描くのに使う）
//   points   : { マスの id: { x, y } }（中心が 0,0）
//   ids・nodes・pts: テストと確認用（spreadNodes に渡した入力と、その結果）
//   extent   : { x, y }（いちばん外のマスの、中心からの長さ）
export function worldLayout(layout) {
  if (cache.has(layout)) return cache.get(layout);
  const ids = Object.keys(layout.pos);
  const outer = TREE_RINGS.at(-1);
  const fit = outer / Math.max(outer, ...ids.map((id) => ringRadius(layout.pos[id])));
  const perimeter = 2 * Math.PI * Math.sqrt((1 + TREE_STRETCH * TREE_STRETCH) / 2); // 半径 1 の横長の円の、まわりの長さ（おおよそ）
  const key = (u) => u.toFixed(2);
  // 輪ごとの、マスの数
  const counts = new Map();
  for (const id of ids) {
    const u = ringRadius(layout.pos[id]) * fit;
    counts.set(key(u), (counts.get(key(u)) ?? 0) + 1);
  }
  const rings = [...counts.keys()].map(Number).sort((a, b) => a - b);
  const index = Object.fromEntries(ids.map((id, i) => [id, i]));

  let spread = 1.5; // 輪を、さらに広げる倍率（重なりが残ったときに上げる）
  let radii;
  let nodes;
  let pts;
  for (let attempt = 0; attempt < 16; attempt++) {
    // 外へ向かって、輪の半径を決める：マスの数に合わせ、前の輪から RING_STEP 以上あける
    radii = new Map();
    let prev = 0;
    rings.forEach((u, k) => {
      const need = (counts.get(key(u)) * NODE_GAP * SPARE * spread) / perimeter;
      const r = u <= 0 ? 0 : Math.max(u, need, k === 0 ? 0 : prev + RING_STEP * Math.min(1, spread));
      radii.set(key(u), r);
      prev = r;
    });
    nodes = ids.map((id) => {
      const p = layout.pos[id];
      const angle = -Math.PI / 2 + (Math.PI * 2 * p.row * Math.max(1, layout.leaves - 1)) / layout.leaves;
      const radius = radii.get(key(ringRadius(p) * fit));
      return { x: Math.cos(angle) * radius * TREE_STRETCH, y: Math.sin(angle) * radius, parent: p.parent ? index[p.parent] : -1 };
    });
    const top = Math.max(...radii.values());
    pts = spreadNodes(nodes, { x: top * TREE_STRETCH * 1.3, y: top * 1.3 }, { ...SPREAD, rounds: 120 });
    const hits = countOverlaps(nodes, pts, SPREAD.nodeGap / 2);
    if (hits.nodes === 0 && hits.lines === 0) break;
    spread *= 1.15;
  }
  const points = Object.fromEntries(ids.map((id, i) => [id, pts[i]]));
  const extent = { x: Math.max(1, ...pts.map((q) => Math.abs(q.x))), y: Math.max(1, ...pts.map((q) => Math.abs(q.y))) };
  const result = { fit, radiusFor: (u) => radii.get(key(u)) ?? u, points, ids, nodes, pts, extent };
  cache.set(layout, result);
  return result;
}
