// 演出（火花・残像・ダメージ数字・画面揺れ・ヒットストップ）。world.fx に溜めて、描画側が読む。

export function createFx() {
  return { particles: [], ghosts: [], texts: [], rings: [], bolts: [], shake: 0, hitstop: 0 };
}

export function burst(world, x, y, color, count, speed = 200) {
  for (let i = 0; i < count; i++) {
    const a = world.rng() * Math.PI * 2;
    const v = speed * (0.3 + world.rng() * 0.7);
    const life = 0.3 + world.rng() * 0.3;
    world.fx.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 2 + world.rng() * 2.5,
    });
  }
}

export function ghost(world, x, y, r, color) {
  world.fx.ghosts.push({ x, y, r, color, life: 0.25, max: 0.25 });
}

export function ring(world, x, y, radius, color) {
  world.fx.rings.push({ x, y, radius, color, life: 0.3, max: 0.3 });
}

export function floatText(world, x, y, text, color, size = 15) {
  world.fx.texts.push({ x, y, text, color, size, life: 0.8, max: 0.8 });
}

export function addShake(world, amount) {
  world.fx.shake = Math.max(world.fx.shake, amount);
}

export function addHitstop(world, seconds) {
  world.fx.hitstop = Math.max(world.fx.hitstop, seconds);
}

export function updateFx(world, dt) {
  const fx = world.fx;
  const drag = Math.exp(-6 * dt);
  for (const p of fx.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
    p.life -= dt;
  }
  for (const t of fx.texts) {
    t.y -= 40 * dt;
    t.life -= dt;
  }
  for (const g of fx.ghosts) g.life -= dt;
  for (const r of fx.rings) r.life -= dt;
  for (const b of fx.bolts) b.life -= dt;
  fx.bolts = fx.bolts.filter((b) => b.life > 0);
  fx.particles = fx.particles.filter((p) => p.life > 0);
  fx.texts = fx.texts.filter((t) => t.life > 0);
  fx.ghosts = fx.ghosts.filter((g) => g.life > 0);
  fx.rings = fx.rings.filter((r) => r.life > 0);
  fx.shake *= Math.exp(-10 * dt);
  if (fx.shake < 0.2) fx.shake = 0;
}
