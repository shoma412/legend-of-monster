// ボスの固有の攻撃の「形」の計算。当たり判定（src/game/bossPatterns.js）と絵（src/render/draw.js）の両方で使う

// 刃の渦：今の刃の位置
export function orbitBlades(b, act) {
  const def = act.def;
  return Array.from({ length: def.count }, (_, i) => {
    const a = act.angle + (i * Math.PI * 2) / def.count;
    return { x: b.x + Math.cos(a) * def.radius, y: b.y + Math.sin(a) * def.radius };
  });
}

// 方眼：マスの位置と大きさ
export function cellRect(world, act, col, row) {
  const b = world.bounds;
  const w = (b.right - b.left) / act.def.cols;
  const h = (b.bottom - b.top) / act.def.rows;
  return { x: b.left + col * w, y: b.top + row * h, w, h };
}

// 方眼：そのマスが、今の回で攻撃されるか
export function cellHot(act, col, row) {
  return (col + row + act.parity + act.wave) % 2 === 0;
}
