// 凍る床（ボス「クライオ・ワイバーン」の「凍る息」）の上に、その場所があるか。上にいるものは、慣性がついて、止まりにくくなる
export function onIce(world, x, y) {
  return (world.hazards ?? []).some((h) => h.type === 'ice' && !h.dead && Math.hypot(h.x - x, h.y - y) <= h.r);
}
