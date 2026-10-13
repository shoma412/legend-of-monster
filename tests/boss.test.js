import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { chooseImplant } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { createWorld, updateWorld } from '../src/game/world.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const def = DATA.bosses.get('boltboar');

// ボスが出現し終わった状態の部屋
function bossWorld() {
  const world = createWorld({ waves: [{ boss: 'boltboar' }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 20) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

describe('ボスの定義', () => {
  it('どのボスも、使う攻撃と部品が定義されている', () => {
    for (const boss of DATA.bosses.all()) {
      for (const phase of boss.phases) {
        for (const name of phase.moves) {
          expect(boss.attacks[name], `${boss.id} の ${name}`).toBeDefined();
          expect(PATTERNS[boss.attacks[name].pattern], `${boss.id} の ${name} の部品`).toBeDefined();
        }
      }
      expect(boss.phases.at(-1).hpAbove).toBe(0);
    }
  });
});

describe('ボルトボア', () => {
  it('前半は、使える技の中から選び、同じ技を続けて出さない', () => {
    const world = bossWorld();
    const b = world.boss;
    world.player.inv = Infinity; // 行動順だけを見る
    const seen = [];
    let last = null;
    for (let t = 0; t < 30 && seen.length < 4; t += DT) {
      updateWorld(world, DT, idle);
      if (b.act && b.act !== last) seen.push(b.act.name);
      last = b.act;
    }
    const moves = DATA.bosses.get('boltboar').phases[0].moves;
    expect(seen).toHaveLength(4);
    seen.forEach((name, i) => {
      expect(moves).toContain(name);
      if (i > 0) expect(name).not.toBe(seen[i - 1]);
    });
  });

  it('弱点は冷却。冷却属性で攻撃するとダメージ1.5倍', () => {
    const world = bossWorld();
    const b = world.boss;
    expect(hitEnemy(world, b, 40, 1, 0, 500)).toMatchObject({ amount: 40, weak: false });
    world.player.stats.elements = ['cold'];
    expect(hitEnemy(world, b, 40, 1, 0, 500)).toMatchObject({ amount: 60, weak: true });
  });

  it('攻撃されても吹き飛ばず、倒すとクリアになる', () => {
    const world = bossWorld();
    const b = world.boss;
    hitEnemy(world, b, 40, 1, 0, 500);
    expect(b.vx).toBe(0);
    hitEnemy(world, b, 99999, 1, 0, 0);
    // レベルアップの選択を済ませる
    for (let i = 0; i < 10; i++) {
      run(world, 0.7);
      if (world.choice) chooseImplant(world, 0);
    }
    expect(world.loot).toHaveLength(def.drops.count);
    expect(world.mode).toBe('clear');
    expect(world.hazards).toHaveLength(0);
  });
});
