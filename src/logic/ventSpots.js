// 送風路の床の通気口の場所（ボス「ダクトクローラー」の熱排気と、背景の絵で同じ場所を使う）。
// bounds: { left, right, top, bottom }（部屋の、動ける範囲）。4列 × 2段の8か所
export const VENT_COLUMNS = [0.15, 0.38, 0.62, 0.85];
export const VENT_ROWS = [0.3, 0.7];

export function ventSpots(bounds) {
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const spots = [];
  for (const fy of VENT_ROWS) for (const fx of VENT_COLUMNS) spots.push({ x: bounds.left + w * fx, y: bounds.top + h * fy });
  return spots;
}
