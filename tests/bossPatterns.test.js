import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { createWorld, updateWorld } from '../src/game/world.js';

// 2026-10-06 に足した攻撃パターンの部品：弾のばらまき、跳びかかり、線の攻撃、残る床

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

// ボスが出現し終わった状態の部屋。ボスは右、プレイヤーは左にいる
function bossWorld(id) {
  const world = createWorld({ waves: [{ boss: id }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity; // 勝手に次の攻撃を始めない
  return world;
}

// その攻撃を今すぐ始めさせる
function startAttack(world, name) {
  const b = world.boss;
  const p = world.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
  PATTERNS[b.act.def.pattern].start(world, b, b.act, { dx, dy, dist: Math.hypot(dx, dy) || 1 });
  return b.act;
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

describe('ボスの攻撃の数', () => {
  it('どのボスも、前半で4種類以上、後半で5種類以上の攻撃を使う', () => {
    for (const boss of DATA.bosses.all()) {
      expect(new Set(boss.phases[0].moves).size, boss.id).toBeGreaterThanOrEqual(4);
      expect(new Set(boss.phases.at(-1).moves).size, boss.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('オーバーロードの後半は、3回攻撃するごとに冷却の隙がある', () => {
    const world = bossWorld('overload');
    const b = world.boss;
    world.player.inv = Infinity;
    b.hp = b.maxHp * 0.4;
    b.idleT = 0;
    const seen = [];
    let last = null;
    for (let t = 0; t < 120 && seen.length < 12; t += DT) {
      updateWorld(world, DT, idle);
      if (b.act && b.act !== last) seen.push(b.act.name);
      last = b.act;
    }
    expect(seen).toHaveLength(12);
    seen.forEach((name, i) => expect(name === 'vent', `${i}: ${seen.join(',')}`).toBe(i % 4 === 3));
  });
});
