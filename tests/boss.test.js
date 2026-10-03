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
        for (const name of phase.sequence) {
          expect(boss.attacks[name], `${boss.id} の ${name}`).toBeDefined();
          expect(PATTERNS[boss.attacks[name].pattern], `${boss.id} の ${name} の部品`).toBeDefined();
        }
      }
      expect(boss.phases.at(-1).hpAbove).toBe(0);
    }
  });
});

describe('ボルトボア', () => {
  it('前半は 突進→突進→踏みつけ の順に攻撃する', () => {
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
    expect(seen).toEqual(['charge', 'charge', 'stomp', 'charge']);
  });

  it('突進は予告の間は動かず、予告のあとに当たるとダメージ', () => {
    const world = bossWorld();
    const b = world.boss;
    expect(runUntil(world, () => b.act?.name === 'charge')).toBe(true);
    world.player.x = b.x - 250;
    const x0 = b.x;
    run(world, def.attacks.charge.telegraph - 0.1);
    expect(b.act.phase).toBe('telegraph');
    expect(b.x).toBe(x0);
    expect(world.player.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => world.player.hp < PLAYER.maxHp, 2)).toBe(true);
    expect(world.player.hp).toBe(PLAYER.maxHp - def.attacks.charge.damage);
  });

  it('突進を避けて壁に当てるとスタンし、その間は触れてもダメージを受けない', () => {
    const world = bossWorld();
    const b = world.boss;
    const p = world.player;
    // 壁際に立ち、突進が始まったら無敵で通り抜けさせる
    p.x = world.bounds.left + p.r;
    expect(runUntil(world, () => b.act?.phase === 'active')).toBe(true);
    b.x = 400;
    p.inv = 1;
    expect(runUntil(world, () => b.act?.phase === 'stun', 2)).toBe(true);
    p.inv = 0;
    p.x = b.x;
    p.y = b.y;
    const hp = p.hp;
    run(world, 0.5);
    expect(p.hp).toBe(hp);
  });

  it('踏みつけの輪は広がって当たる。ダッシュの無敵ですり抜けられる', () => {
    const world = bossWorld();
    const b = world.boss;
    const p = world.player;
    b.seqIndex = 2; // 次が踏みつけ
    p.x = b.x - 200;
    p.y = b.y;
    expect(runUntil(world, () => world.hazards.length > 0)).toBe(true);
    const ring = world.hazards[0];
    b.idleT = 99; // 次の攻撃を待たせる
    p.inv = 0;
    const hp = p.hp;
    expect(runUntil(world, () => ring.done || ring.dead, 3)).toBe(true);
    expect(p.hp).toBe(hp - def.attacks.stomp.damage);

    // もう一度。今度は輪が届く間ずっと無敵
    b.seqIndex = 2;
    b.idleT = 0;
    expect(runUntil(world, () => world.hazards.length > 0)).toBe(true);
    b.idleT = 99;
    p.inv = 5;
    const hp2 = p.hp;
    runUntil(world, () => world.hazards.length === 0, 3);
    expect(p.hp).toBe(hp2);
  });

  it('HPが半分以下になると突進が2連続になる', () => {
    const world = bossWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    b.hp = b.maxHp * 0.5;
    expect(runUntil(world, () => b.act?.name === 'doubleCharge')).toBe(true);
    let charges = 0;
    let wasActive = false;
    const act = b.act;
    for (let t = 0; t < 6 && b.act === act; t += DT) {
      // 壁に当たって途中で止まらないよう、部屋の中央に戻し続ける
      b.x = 480;
      b.y = 270;
      updateWorld(world, DT, idle);
      const active = b.act === act && act.phase === 'active';
      if (active && !wasActive) charges++;
      wasActive = active;
    }
    expect(charges).toBe(2);
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
