// スキルツリーの画面の並びを、重ならないように整える計算（画面には触らない。docs/詳細仕様.md「23. スキルツリー」）。
//   spreadNodes : マス同士、マスとほかの線が重ならないように、マスを少しずつ動かす
//   placeLabel  : マスの名前を、ほかのマス・線・名前と重ならない側（下・上・右・左）に置く

// 点 p から、線分 a-b までの、いちばん近い点
function closestOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + dx * t, y: a.y + dy * t, t };
}

export const SPREAD = {
  nodeGap: 21, // マス同士の中心の、いちばん近い距離（マスの半径 8 ×2 ＋ すき間）
  lineGap: 12, // マスの中心と、つながっていない線との、いちばん近い距離（マスの半径 ＋ すき間）
  rootGap: 20, // マスと、中心の点との距離
  home: 0.04, // 元の場所へ戻ろうとする強さ（形が崩れすぎないように）
  rounds: 80, // くり返す回数
};

// nodes: [{ x, y, parent }]（parent は、nodes の中の番号。中心につながるマスは -1）。bounds: { x, y }（動かせる範囲。中心からの長さ）。
//   返り値は、動かしたあとの [{ x, y }]（同じ順番）。同じ入力なら、いつも同じ結果になる
export function spreadNodes(nodes, bounds, opts = SPREAD) {
  const pts = nodes.map((n) => ({ x: n.x, y: n.y }));
  const root = { x: 0, y: 0 };
  const from = (i) => (nodes[i].parent >= 0 ? pts[nodes[i].parent] : root);
  // a を、b から離す（距離が gap になるまでの、share の割合だけ）。ぴったり重なっているときは、番号で決めた向きへ
  const push = (i, away, gap, share) => {
    const p = pts[i];
    let dx = p.x - away.x;
    let dy = p.y - away.y;
    let d = Math.hypot(dx, dy);
    if (d >= gap) return false;
    if (d < 0.01) {
      const angle = i * 2.399963; // 黄金角。番号ごとに違う向き
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      d = 1;
    }
    const move = (gap - d) * share;
    p.x += (dx / d) * move;
    p.y += (dy / d) * move;
    return true;
  };
  for (let round = 0; round < opts.rounds; round++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      // 中心の点
      if (push(i, root, opts.rootGap, 1)) moved = true;
      // ほかのマス（お互いに半分ずつ動く）
      for (let j = i + 1; j < pts.length; j++) {
        const before = { x: pts[j].x, y: pts[j].y };
        if (push(i, before, opts.nodeGap, 0.5)) {
          push(j, pts[i], opts.nodeGap, 1);
          moved = true;
        }
      }
      // つながっていない線（そのマスから出る線と、そのマスへ入る線は除く）
      for (let k = 0; k < pts.length; k++) {
        if (k === i || nodes[k].parent === i || nodes[i].parent === k) continue;
        const c = closestOnSegment(pts[i], from(k), pts[k]);
        if (c.t <= 0 || c.t >= 1) continue; // 線の端は、マス同士の距離で見ている
        if (push(i, c, opts.lineGap, 0.6)) moved = true;
      }
    }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x += (nodes[i].x - p.x) * opts.home;
      p.y += (nodes[i].y - p.y) * opts.home;
      p.x = Math.max(-bounds.x, Math.min(bounds.x, p.x));
      p.y = Math.max(-bounds.y, Math.min(bounds.y, p.y));
    }
    if (!moved) break;
  }
  return pts;
}

// まだ残っている重なりの数（テストと確認用）。{ nodes: マス同士, lines: マスと線 }
export function countOverlaps(nodes, pts, radius = 8) {
  const root = { x: 0, y: 0 };
  let nodeHits = 0;
  let lineHits = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < radius * 2) nodeHits++;
    for (let k = 0; k < pts.length; k++) {
      if (k === i || nodes[k].parent === i || nodes[i].parent === k) continue;
      const c = closestOnSegment(pts[i], nodes[k].parent >= 0 ? pts[nodes[k].parent] : root, pts[k]);
      if (c.t > 0 && c.t < 1 && Math.hypot(pts[i].x - c.x, pts[i].y - c.y) < radius) lineHits++;
    }
  }
  return { nodes: nodeHits, lines: lineHits };
}

// ---- マスの名前を置く場所 ----

const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function circleHitsRect(c, rect) {
  const x = Math.max(rect.left, Math.min(rect.right, c.x));
  const y = Math.max(rect.top, Math.min(rect.bottom, c.y));
  return Math.hypot(c.x - x, c.y - y) < c.r;
}

function segmentHitsRect(s, rect) {
  // 端のどちらかが中にあるか、4辺のどれかと交わる
  const inside = (p) => p.x > rect.left && p.x < rect.right && p.y > rect.top && p.y < rect.bottom;
  if (inside(s.a) || inside(s.b)) return true;
  const cross = (p, q, r, t) => {
    const d = (q.x - p.x) * (t.y - r.y) - (q.y - p.y) * (t.x - r.x);
    if (d === 0) return false;
    const u = ((r.x - p.x) * (t.y - r.y) - (r.y - p.y) * (t.x - r.x)) / d;
    const v = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1;
  };
  const tl = { x: rect.left, y: rect.top };
  const tr = { x: rect.right, y: rect.top };
  const bl = { x: rect.left, y: rect.bottom };
  const br = { x: rect.right, y: rect.bottom };
  return cross(s.a, s.b, tl, tr) || cross(s.a, s.b, tr, br) || cross(s.a, s.b, br, bl) || cross(s.a, s.b, bl, tl);
}

// node: { x, y, r }（名前を付けるマス）, size: { w, h }（名前の大きさ）, gap: マスと名前のすき間。
// others: { circles: ほかのマス [{ x, y, r }], segments: 線 [{ a, b }], rects: もう置いた名前 [{ left, top, right, bottom }] }, bounds: はみ出してはいけない枠。
// 返り値: { side, rect, hits }。side は below / above / right / left。重なりがいちばん少ない側（同じなら、下・上・右・左の順）
export function placeLabel(node, size, gap, others, bounds = null) {
  const half = size.w / 2;
  const sides = {
    below: { left: node.x - half, top: node.y + node.r + gap },
    above: { left: node.x - half, top: node.y - node.r - gap - size.h },
    right: { left: node.x + node.r + gap, top: node.y - size.h / 2 },
    left: { left: node.x - node.r - gap - size.w, top: node.y - size.h / 2 },
  };
  let best = null;
  for (const [side, at] of Object.entries(sides)) {
    const rect = { left: at.left, top: at.top, right: at.left + size.w, bottom: at.top + size.h };
    let hits = 0;
    if (bounds && (rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom)) hits += 100;
    for (const c of others.circles ?? []) if (circleHitsRect(c, rect)) hits += 3;
    for (const r of others.rects ?? []) if (overlap(r, rect)) hits += 3;
    for (const s of others.segments ?? []) if (segmentHitsRect(s, rect)) hits += 1;
    if (!best || hits < best.hits) best = { side, rect, hits };
  }
  return best;
}
