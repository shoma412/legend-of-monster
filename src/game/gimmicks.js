// 部屋の仕掛けを動かす。仕掛けの定義（src/data/gimmicks.js）の part で、下の部品を選ぶ。
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';

// 仕掛けの部品。(world, 仕掛けの定義, 進んだ秒数, その部屋での仕掛けの状態)
export const GIMMICK_PARTS = {
  // 予告つきで、ものが落ちてくる。プレイヤーの近くと、部屋のどこかに落ちる。敵にも当たる
  fallingMarks(world, def, dt, state) {
    state.t = (state.t ?? def.interval * 0.6) - dt;
    if (state.t > 0) return;
    state.t = def.interval;
    const b = world.bounds;
    const p = world.player;
    const color = COLORS[def.color] ?? ELEMENT_COLORS[def.color] ?? COLORS.amber;
    for (let i = 0; i < def.count; i++) {
      let x;
      let y;
      if (i === 0) {
        const a = world.rng() * Math.PI * 2;
        const r = world.rng() * def.spread;
        x = p.x + Math.cos(a) * r;
        y = p.y + Math.sin(a) * r;
      } else {
        x = b.left + def.radius + world.rng() * (b.right - b.left - def.radius * 2);
        y = b.top + def.radius + world.rng() * (b.bottom - b.top - def.radius * 2);
      }
      x = Math.max(b.left + def.radius, Math.min(b.right - def.radius, x));
      y = Math.max(b.top + def.radius, Math.min(b.bottom - def.radius, y));
      world.hazards.push({ type: 'mark', x, y, r: def.radius, t: def.delay, max: def.delay, damage: def.damage, enemyDamage: def.enemyDamage ?? 0, color });
    }
  },
};

export function hasGimmickPart(name) {
  return name in GIMMICK_PARTS;
}

// 部屋の仕掛けを進める（敵がいる間だけ呼ばれる）
export function updateGimmick(world, dt) {
  const def = world.room.gimmick;
  if (!def) return;
  world.gimmickState ??= {};
  GIMMICK_PARTS[def.part](world, def, dt, world.gimmickState);
}
