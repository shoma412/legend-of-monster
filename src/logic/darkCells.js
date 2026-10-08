// 暗闇の絵のための計算：画面をマスに分け、マスごとの暗さを決めて、横に並んだ同じ暗さのマスを1本の帯にまとめる。
// 画面には触らない（src/render/darkness.js が、返ってきた帯を塗る）。

// 灯りの中心からの離れ具合（0＝中心、1以上＝灯りの外）。
//   扇形の灯り（angle：向き、arc：広さ。どちらもラジアン）は、その扇の外なら、いつも外
export function lightReach(l, x, y) {
  const dx = x - l.x;
  const dy = y - l.y;
  const k = Math.hypot(dx, dy) / l.r;
  if (k >= 1 || l.arc == null) return k;
  const d = Math.atan2(dy, dx) - l.angle;
  const diff = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
  return diff <= l.arc / 2 ? k : 1;
}

// その場所の明るさ（0＝真っ暗、1＝はっきり見える）。lights は { x, y, r } の並び。soft は、円の縁のぼかしの幅（半径に対する割合）
export function brightness(x, y, lights, soft) {
  let best = 0;
  for (const l of lights) {
    const k = lightReach(l, x, y);
    if (k >= 1) continue;
    const v = k <= 1 - soft ? 1 : (1 - k) / soft;
    if (v > best) best = v;
    if (best >= 1) return 1;
  }
  return best;
}

// 暗さの帯を作る。返り値は [{ x, y, w, h, level }]（level は 1〜levels。大きいほど暗い。0＝塗らない、は含まない）
//   rect: { left, top, right, bottom }、cell: マスの大きさ（px）、levels: 暗さの段階の数
export function darkStrips(rect, cell, lights, soft, levels = 4) {
  const strips = [];
  for (let y = rect.top; y < rect.bottom; y += cell) {
    const h = Math.min(cell, rect.bottom - y);
    let run = null;
    for (let x = rect.left; x < rect.right; x += cell) {
      const w = Math.min(cell, rect.right - x);
      const level = Math.round((1 - brightness(x + w / 2, y + h / 2, lights, soft)) * levels);
      if (run && run.level === level) {
        run.w += w;
      } else {
        if (run && run.level > 0) strips.push(run);
        run = { x, y, w, h, level };
      }
    }
    if (run && run.level > 0) strips.push(run);
  }
  return strips;
}
