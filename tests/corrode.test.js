import { describe, expect, it } from 'vitest';
import { STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { ELEMENT_COLORS } from '../src/data/theme.js';
import { recalcStats } from '../src/game/build.js';
import { applyBurn, applyCorrode, damageEnemy, hitEnemy } from '../src/game/combat.js';
import { hasAction } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { ELEMENT_NAMES, describeLine, makeItem } from '../src/logic/loot.js';
import { implantDesc } from '../src/logic/stats.js';

// 4つ目の属性「腐食」（docs/詳細仕様.md「27. 属性「腐食」」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeWorld(implants = {}, waves = [{}]) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0 };
  const world = createWorld({ room, rng: () => 0.99, weaponId: 'sword' }); // 0.99：会心なし
  world.waveTimer = Infinity;
  world.player.inv = Infinity;
  Object.assign(world.player.build.implants, implants);
  recalcStats(world.player);
  return world;
}

function addEnemy(world, id, x, y) {
  const e = createEnemy(DATA.enemies.get(id), x, y, 0, world.rng);
  e.def = { ...e.def, speed: 0 };
  e.cd = 99;
  e.hp = e.maxHp = 1000000;
  world.enemies.push(e);
  return e;
}

const dealt = (world, e, base = 100) => {
  const hp = e.hp;
  hitEnemy(world, e, base, 1, 0, 0);
  return hp - e.hp;
};

describe('属性「腐食」の定義', () => {
  it('名前・色がある。装備の属性付与は、4つのどれかになる', () => {
    expect(ELEMENT_NAMES.corrode).toBe('腐食');
    expect(ELEMENT_COLORS.corrode).toBeDefined();
    expect(describeLine({ id: 'element', element: 'corrode' })).toBe('腐食属性');
    const rng = seeded(11);
    const seen = new Set();
    for (let i = 0; i < 4000; i++) {
      for (const line of makeItem(rng, { rarity: 3 }).effects) if (line.element) seen.add(line.element);
    }
    expect([...seen].sort()).toEqual(['cold', 'corrode', 'heat', 'shock']);
  });

  it('マップ1〜4のボスの弱点は、変わっていない（腐食が弱点のボスは、マップ5から）', () => {
    const early = ['map1', 'map2', 'map3', 'map4'].flatMap((id) => DATA.maps.get(id).areas.map((a) => DATA.bosses.get(DATA.areas.get(a).boss)));
    expect(early).toHaveLength(12);
    expect(early.some((b) => b.weakness === 'corrode')).toBe(false);
    expect(DATA.bosses.get('rusteater').weakness).toBe('corrode');
  });
});

describe('腐食の効果', () => {
  it('腐食中の敵は、受けるダメージが +15%。付けた1発は増えない。4秒で切れる', () => {
    const world = makeWorld({ acid: 1 });
    const e = addEnemy(world, 'grunt', 600, 300);
    expect(world.player.stats.elements).toEqual(['corrode']);
    expect(dealt(world, e)).toBe(100); // 付けた1発は、そのまま
    expect(e.corrodeT).toBeCloseTo(STATUS.corrode.duration);
    expect(dealt(world, e)).toBe(115);
    for (let t = 0; t < STATUS.corrode.duration + 0.1; t += DT) updateWorld(world, DT, idle);
    expect(e.corrodeT > 0).toBe(false);
    expect(dealt(world, e)).toBe(100);
  });

  it('当て直すと時間が戻る。重なって強くはならない', () => {
    const world = makeWorld({ acid: 1 });
    const e = addEnemy(world, 'grunt', 600, 300);
    dealt(world, e);
    for (let t = 0; t < 2; t += DT) updateWorld(world, DT, idle);
    expect(dealt(world, e)).toBe(115);
    expect(e.corrodeT).toBeCloseTo(STATUS.corrode.duration);
    expect(dealt(world, e)).toBe(115);
  });

  it('ボスには、+8%', () => {
    const world = makeWorld({}, [{ boss: 'boltboar' }]);
    world.waveTimer = 0;
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    const b = world.boss;
    b.idleT = Infinity;
    b.hp = b.maxHp = 1000000;
    const hit = () => {
      const hp = b.hp;
      damageEnemy(world, b, 1000);
      return hp - b.hp;
    };
    expect(hit()).toBe(1000);
    applyCorrode(b);
    expect(hit()).toBe(1080);
  });

  it('自分の攻撃だけでなく、燃焼などのダメージにも効く', () => {
    const tick = (corroded) => {
      const world = makeWorld();
      const e = addEnemy(world, 'grunt', 600, 300);
      applyBurn(e);
      if (corroded) e.corrodeT = 99;
      const hp = e.hp;
      for (let t = 0; t < 2; t += DT) updateWorld(world, DT, idle);
      return hp - e.hp;
    };
    const plain = tick(false);
    expect(plain).toBeGreaterThan(0);
    expect(tick(true)).toBeGreaterThan(plain);
  });

  it('腐食の属性を持っていなければ、付かない', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 600, 300);
    dealt(world, e);
    expect(e.corrodeT > 0).toBe(false);
  });
});

describe('汎用インプラント「腐食液」', () => {
  it('汎用で、どのマップでも出る。Lv1 は属性を付けるだけ。Lv2 から、倒すと移る', () => {
    const def = DATA.implants.get('acid');
    expect(def.species).toBe('general');
    expect(def.effect(1).triggers).toEqual([]);
    expect(def.effect(1.5).triggers[0]).toMatchObject({ on: 'kill', do: 'spreadCorrode', ifTarget: 'corroded' });
    expect(hasAction('spreadCorrode')).toBe(true);
    expect(implantDesc(def, 1)).not.toContain('移る');
    expect(implantDesc(def, 2)).toContain('移る');
  });

  it('Lv2：腐食中の敵を倒すと、近くの敵に腐食が移る。遠くの敵には移らない', () => {
    const world = makeWorld({ acid: 2 });
    const a = addEnemy(world, 'grunt', 600, 300);
    const near = addEnemy(world, 'grunt', 660, 300);
    const far = addEnemy(world, 'grunt', 600 + STATUS.corrode.spread * 3, 300);
    a.hp = a.maxHp = 150;
    hitEnemy(world, a, 100, 1, 0, 0); // 腐食を付ける
    expect(a.dead).toBe(false);
    hitEnemy(world, a, 100, 1, 0, 0); // 倒す
    expect(a.dead).toBe(true);
    expect(near.corrodeT).toBeGreaterThan(0);
    expect(far.corrodeT > 0).toBe(false);
  });

  it('Lv1：倒しても、移らない', () => {
    const world = makeWorld({ acid: 1 });
    const a = addEnemy(world, 'grunt', 600, 300);
    const near = addEnemy(world, 'grunt', 660, 300);
    a.hp = a.maxHp = 150;
    hitEnemy(world, a, 100, 1, 0, 0);
    hitEnemy(world, a, 100, 1, 0, 0);
    expect(a.dead).toBe(true);
    expect(near.corrodeT > 0).toBe(false);
  });
});
