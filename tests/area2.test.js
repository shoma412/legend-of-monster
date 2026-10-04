import { describe, expect, it } from 'vitest';
import { ENEMY_SCALING, PLAYER, STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { hitEnemy } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { AREA_ORDER, NEXT_AREA, createRun, currentArea, enterRoom, handleEvents, hasNextArea, leaveRoom, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { createSave } from '../src/logic/save.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, specialPressed: false, dashPressed: false };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeWorld() {
  const world = createWorld({ waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity;
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 30) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

function addEnemy(world, id, dx, dy = 0, scale = 1) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng, scale);
  e.cd = 0;
  world.enemies.push(e);
  return e;
}

function wyvernWorld() {
  const world = createWorld({ waves: [{ boss: 'cryowyvern' }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  return world;
}

describe('定義データのつじつま', () => {
  it('エリアは順番どおりにあり、色・敵・ボスが定義されている', () => {
    expect(AREA_ORDER.slice(0, 2)).toEqual(['slum', 'plant']);
    for (const id of AREA_ORDER) {
      const a = DATA.areas.get(id);
      expect(AREA_THEMES[a.theme], id).toBeDefined();
      for (const e of [...a.enemies.map((x) => x.id), ...a.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
      expect(DATA.bosses.has(a.boss)).toBe(true);
      // エリアごとにデータ片がある（データ金庫で3つ、ボスで1つ）
      const frags = DATA.fragments.all().filter((f) => f.area === id);
      expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
      expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
    }
  });

  it('仕様どおり、自爆ボットとフロストスプレイヤーはエリア1には出ない', () => {
    const slum = DATA.areas.get('slum').enemies.map((e) => e.id);
    const plant = DATA.areas.get('plant').enemies.map((e) => e.id);
    expect(slum).not.toContain('bomber');
    expect(slum).not.toContain('sprayer');
    expect(plant).toEqual(expect.arrayContaining(['drone', 'grunt', 'turret', 'bomber', 'sprayer']));
  });

  it('ボスが使う攻撃は、どれも部品がある', () => {
    for (const boss of DATA.bosses.all()) {
      for (const phase of boss.phases) for (const name of phase.sequence) expect(PATTERNS[boss.attacks[name].pattern], `${boss.id} の ${name}`).toBeDefined();
    }
    expect(DATA.bosses.get('cryowyvern')).toMatchObject({ weakness: 'heat', material: 'cryoCore' });
  });
});

describe('エリアが進むと敵が強くなる', () => {
  it('エリア2の雑魚は、HPと攻撃力が1.6倍', () => {
    const r = createRun({ rng: seeded(3), save: createSave() });
    expect(enterRoom(r).room.enemyScale).toBe(1);
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    expect(enterRoom(r).room.enemyScale).toBeCloseTo(ENEMY_SCALING.perArea);

    const world = makeWorld();
    const base = DATA.enemies.get('grunt');
    const e = addEnemy(world, 'grunt', 300, 0, 1.6);
    expect(e.maxHp).toBe(Math.round(base.hp * 1.6));
    expect(e.def.damage).toBe(Math.round(base.damage * 1.6));
  });
});

describe('エリアの切り替え', () => {
  it('ボスを倒すと全回復して「次のエリアへ」の扉が開き、進むと新しい地図になる', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(5), save });
    expect(hasNextArea(r)).toBe(true);
    skipToBoss(r, enterRoom(r));
    const world = enterRoom(r);
    expect(world.room.doors).toEqual([{ id: NEXT_AREA, type: 'descend' }]);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.player.hp = 7;
    world.player.inv = Infinity;
    world.player.build.credits = 5;
    hitEnemy(world, world.boss, 999999, 1, 0, 0);
    handleEvents(r, world);
    for (let i = 0; i < 10; i++) {
      run(world, 0.7);
      if (world.choice) world.choice = null;
    }
    expect(world.mode).toBe('clear');
    expect(world.objects.filter((o) => o.kind === 'door').map((o) => o.type)).toEqual(['descend']);

    leaveRoom(r, world, NEXT_AREA);
    expect(currentArea(r).id).toBe('plant');
    expect(r.plan.step).toBe(0);
    const next = enterRoom(r);
    expect(next.room.type).toBe('combat');
    expect(next.countdown).toBe(0); // カウントダウンはランの最初だけ
    expect(next.player.hp).toBe(next.player.stats.maxHp);
    expect(next.player.build.credits).toBeGreaterThan(5); // 装備・レベル・クレジットは引き継ぐ
    expect(save.records).toMatchObject({ bestArea: 1, bestStep: 0 });
  });

  it('最後のエリアのボス部屋には「次のエリアへ」の扉がない', () => {
    const r = createRun({ rng: seeded(5), save: createSave() });
    r.areaIndex = AREA_ORDER.length - 1;
    expect(hasNextArea(r)).toBe(false);
    skipToBoss(r, enterRoom(r));
    expect(enterRoom(r).room.doors).toEqual([]);
  });
});

describe('自爆ボット', () => {
  it('近づくと1秒点滅してから爆発し、範囲内にいるとダメージ', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'bomber', 120);
    expect(runUntil(world, () => e.state === 'fuse', 3)).toBe(true);
    expect(world.player.hp).toBe(PLAYER.maxHp);
    run(world, e.def.bomb.fuse + 0.1);
    expect(world.player.hp).toBe(PLAYER.maxHp - e.def.damage);
    expect(world.enemies).toHaveLength(0);
    expect(world.kills).toBe(0); // 自爆は撃破に数えない
  });

  it('点滅中に範囲の外へ逃げれば当たらない。爆発前に倒せば爆発しない', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'bomber', 100);
    runUntil(world, () => e.state === 'fuse', 3);
    world.player.x += 300;
    run(world, e.def.bomb.fuse + 0.1);
    expect(world.player.hp).toBe(PLAYER.maxHp);

    const world2 = makeWorld();
    const e2 = addEnemy(world2, 'bomber', 100);
    runUntil(world2, () => e2.state === 'fuse', 3);
    hitEnemy(world2, e2, 9999, 1, 0, 0);
    run(world2, 1.5);
    expect(world2.player.hp).toBe(PLAYER.maxHp);
    expect(world2.kills).toBe(1);
  });
});

describe('フロストスプレイヤー', () => {
  it('構えてから前方に冷気を噴き、当たるとダメージと減速', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'sprayer', 120);
    expect(runUntil(world, () => e.state === 'windup', 2)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => p.slowT > 0, 2)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - e.def.damage);

    // 減速中は移動が遅い
    e.dead = true;
    p.inv = 0;
    const x0 = p.x;
    run(world, 0.5, { ...idle, mx: 1 });
    expect((p.x - x0) / (PLAYER.moveSpeed * 0.5)).toBeCloseTo(1 - STATUS.playerSlow.amount, 1);
  });

  it('横に回り込めば当たらない', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'sprayer', 120);
    runUntil(world, () => e.state === 'windup', 2);
    p.x = e.x;
    p.y = e.y + 120; // 正面（左向き）から外れた真下
    run(world, e.def.spray.windup + e.def.spray.duration);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(p.slowT).toBeLessThanOrEqual(0);
  });
});

describe('クライオ・ワイバーン', () => {
  const def = DATA.bosses.get('cryowyvern');

  it('前半は 冷気ブレス→氷柱の雨→尻尾なぎ払い の順に攻撃する', () => {
    const world = wyvernWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    const seen = [];
    let last = null;
    for (let t = 0; t < 40 && seen.length < 4; t += DT) {
      updateWorld(world, DT, idle);
      if (b.act && b.act !== last) seen.push(b.act.name);
      last = b.act;
    }
    expect(seen).toEqual(['breath', 'icicles', 'sweep', 'breath']);
  });

  it('冷気ブレス：予告のあと、扇の中にいるとダメージと減速。扇の外なら当たらない', () => {
    const world = wyvernWorld();
    const b = world.boss;
    const p = world.player;
    expect(runUntil(world, () => b.act?.name === 'breath')).toBe(true);
    p.x = b.x - 200;
    p.y = b.y;
    expect(runUntil(world, () => b.act?.phase === 'active', 3)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp); // 予告の間は当たらない
    run(world, 0.1);
    expect(p.hp).toBe(PLAYER.maxHp - def.attacks.breath.damage);
    expect(p.slowT).toBeGreaterThan(0);

    const world2 = wyvernWorld();
    const b2 = world2.boss;
    runUntil(world2, () => b2.act?.name === 'breath' && b2.act.phase === 'active');
    world2.player.x = b2.x - b2.act.dirX * 200; // 真後ろ
    world2.player.y = b2.y - b2.act.dirY * 200;
    run(world2, 0.3);
    expect(world2.player.hp).toBe(PLAYER.maxHp);
  });

  it('尻尾なぎ払い：予告の円の中にいると当たる。離れれば当たらない', () => {
    for (const [dist, hit] of [[80, true], [260, false]]) {
      const world = wyvernWorld();
      const b = world.boss;
      const p = world.player;
      b.seqIndex = 2;
      b.idleT = 0;
      expect(runUntil(world, () => b.act?.name === 'sweep')).toBe(true);
      b.x = 480;
      b.y = 270;
      p.x = b.x - dist;
      p.y = b.y;
      runUntil(world, () => b.act?.phase === 'recover', 3);
      expect(p.hp < PLAYER.maxHp).toBe(hit);
    }
  });

  it('氷柱の雨：落下地点が先に表示され、少し遅れて落ちる。その場から動けば当たらない', () => {
    const world = wyvernWorld();
    const b = world.boss;
    const p = world.player;
    b.seqIndex = 1;
    b.idleT = 0;
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'mark'))).toBe(true);
    const mark = world.hazards.find((h) => h.type === 'mark');
    expect(mark.t).toBeGreaterThan(0.5);
    expect(p.hp).toBe(PLAYER.maxHp);
    // 立ち止まっていると当たる
    b.x = 900;
    b.y = 60; // ボス本体には触れない位置へ
    runUntil(world, () => p.hp < PLAYER.maxHp, 3);
    expect(p.hp).toBe(PLAYER.maxHp - def.attacks.icicles.damage);
  });

  it('HPが半分を切ると、部屋の端から凍りついて動ける範囲が狭まる。倒すと元に戻る', () => {
    const world = wyvernWorld();
    const b = world.boss;
    const p = world.player;
    p.inv = Infinity;
    const before = { ...world.bounds };
    b.hp = b.maxHp * 0.4;
    expect(runUntil(world, () => world.arena != null)).toBe(true);
    run(world, 5);
    expect(world.bounds.left).toBeGreaterThan(before.left);
    expect(world.bounds.right).toBeLessThan(before.right);
    // 端にいたプレイヤーは内側に押し戻される
    p.x = 0;
    run(world, 0.1);
    expect(p.x).toBeGreaterThanOrEqual(world.bounds.left + p.r - 1); // 1コマぶんのずれは許す
    run(world, 30);
    expect(world.bounds.left).toBeCloseTo(before.left + def.phases[1].arena.inset);

    hitEnemy(world, b, 999999, 1, 0, 0);
    for (let i = 0; i < 10; i++) {
      run(world, 0.7);
      if (world.choice) world.choice = null;
    }
    expect(world.mode).toBe('clear');
    expect(world.bounds).toEqual(before);
  });

  it('弱点は熱。倒すとクライオコアが手に入る', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(5), save });
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    skipToBoss(r, enterRoom(r));
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('cryowyvern');
    world.player.stats.elements = ['heat'];
    expect(hitEnemy(world, world.boss, 40, 1, 0, 0)).toMatchObject({ amount: 60, weak: true });
    hitEnemy(world, world.boss, 999999, 1, 0, 0);
    handleEvents(r, world);
    expect(save.materials.cryoCore).toBe(3);
    expect(save.fragments).toContain('cw-core');
    expect(save.achievements).toContain('cryowyvern');
  });
});
