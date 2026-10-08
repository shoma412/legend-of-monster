import { describe, expect, it } from 'vitest';
import { STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld } from '../src/game/world.js';
import { createBuild } from '../src/logic/stats.js';

// 恒久強化「触媒炉」：敵に付けた状態異常（燃焼・減速・腐食）の時間 +20%（docs/詳細仕様.md「23. スキルツリー」）

function makeWorld(withUpgrade) {
  const world = createWorld({ waves: [{}], rng: () => 0.99, weaponId: 'sword' });
  world.waveTimer = Infinity;
  const p = world.player;
  p.build = createBuild(withUpgrade ? { effects: [{ mods: [{ stat: 'statusTime', add: 0.2 }] }] } : null);
  Object.assign(p.build.implants, { incendiary: 1, coolant: 1, acid: 1 });
  recalcStats(p);
  const e = createEnemy(DATA.enemies.get('grunt'), 600, 300, 0, world.rng);
  e.hp = e.maxHp = 1000000;
  world.enemies.push(e);
  hitEnemy(world, e, 10, 1, 0, 0);
  return e;
}

describe('触媒炉：敵に付けた状態異常の時間', () => {
  it('燃焼・減速・腐食の時間が、どれも 1.2倍になる', () => {
    const plain = makeWorld(false);
    const long = makeWorld(true);
    expect(plain.burnT).toBeCloseTo(STATUS.burn.duration);
    expect(plain.slowT).toBeCloseTo(STATUS.slow.duration);
    expect(plain.corrodeT).toBeCloseTo(STATUS.corrode.duration);
    expect(long.burnT).toBeCloseTo(STATUS.burn.duration * 1.2);
    expect(long.slowT).toBeCloseTo(STATUS.slow.duration * 1.2);
    expect(long.corrodeT).toBeCloseTo(STATUS.corrode.duration * 1.2);
  });
});
