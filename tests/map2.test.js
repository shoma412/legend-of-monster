import { describe, expect, it } from 'vitest';
import { COMBO, PLAYER, STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { species } from '../src/data/implants.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { hitEnemy } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { dashCooldown } from '../src/game/player.js';
import { recalcStats } from '../src/game/build.js';
import { createRun, enterRoom, handleEvents, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { mapState, recordMapClear } from '../src/logic/maps.js';
import { buyUpgrade, permanentBonuses } from '../src/logic/meta.js';
import { createSave } from '../src/logic/save.js';
import { carryOptions, createBuild, mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ2「排水区」のエリア1：下水道（清掃ローラー、ヒルドローン、配管タレット、パイプサーペント、種族「大蛇」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeWorld(implants = []) {
  const world = createWorld({ waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  return world;
}

function addEnemy(world, id, dx, dy = 0) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng);
  e.cd = 0;
  world.enemies.push(e);
  return e;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

function serpentWorld() {
  const world = createWorld({ waves: [{ boss: 'pipeserpent' }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  return world;
}

function startAttack(world, name) {
  const b = world.boss;
  const p = world.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
  PATTERNS[b.act.def.pattern].start(world, b, b.act, { dx, dy, dist: Math.hypot(dx, dy) || 1 });
  return b.act;
}

describe('マップ2の定義', () => {
  it('下水道：色・背景・敵・ボス・素材がそろっている', () => {
    const area = DATA.areas.get('sewer');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const e of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
    const boss = DATA.bosses.get(area.boss);
    expect(boss.id).toBe('pipeserpent');
    expect(DATA.materials.has(boss.material)).toBe(true);
    expect(MATERIAL_ICONS[boss.material]).toBeDefined();
    // マップ2だけの雑魚が3種類いる
    expect(area.enemies.map((x) => x.id)).toEqual(expect.arrayContaining(['roller', 'leech', 'pipegun']));
  });

  it('マップ2では、雑魚がマップ1より強い。出る種族は大蛇', () => {
    const r = createRun({ rng: seeded(4), mapId: 'map2' });
    expect(r.build.species).toEqual(['serpent']);
    expect(enterRoom(r).room.enemyScale).toBeCloseTo(maps[1].enemyScale);
    expect(mapSpecies(maps[1])).toEqual(['serpent']);
    expect(species.serpent.boss).toBe('pipeserpent');
  });

  it('マップ1のボスを倒していれば、その種族をマップ2に持ち込める。逆もできる', () => {
    const save = createSave();
    save.bossKills.boltboar = 1;
    expect(carryOptions(save, maps[1])).toEqual(['boar']);
    const r = createRun({ rng: seeded(4), mapId: 'map2', carry: 'boar' });
    expect([...r.build.species].sort()).toEqual(['boar', 'serpent']);
    save.bossKills.pipeserpent = 1;
    expect(carryOptions(save, maps[0])).toEqual(['serpent']);
  });

  it('パイプサーペントを倒すと、サーペントコアが手に入り、マップ2が完了になる', () => {
    const save = createSave();
    recordMapClear(save, 'map1', 1); // マップ2は、マップ1を完了すると選べる
    const r = createRun({ rng: seeded(7), save, mapId: 'map2' });
    skipToBoss(r, enterRoom(r));
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0);
    handleEvents(r, world);
    expect(save.materials.serpentCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('pipeserpent');
    expect(mapState(save, maps[1])).toBe('done');
  });
});

describe('清掃ローラー', () => {
  it('狙いをつけてから、プレイヤーのほうへまっすぐ転がり、通ったあとに汚水の床を残す', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'roller', 240);
    const startX = e.x;
    expect(runUntil(world, () => e.state === 'windup')).toBe(true);
    expect(e.x).toBeCloseTo(startX, 0); // 狙っている間は動かない
    expect(runUntil(world, () => e.state === 'roll')).toBe(true);
    world.player.inv = Infinity;
    run(world, 0.5);
    expect(e.x).toBeLessThan(startX - 100);
    const pools = world.hazards.filter((h) => h.type === 'pool');
    expect(pools.length).toBeGreaterThanOrEqual(2);
  });

  it('汚水の床は、踏むと減速するだけでダメージはない', () => {
    const world = makeWorld();
    const p = world.player;
    world.hazards.push({ type: 'pool', x: p.x, y: p.y, r: 24, arm: 0, armMax: 0.25, life: 3, tick: 1, acc: 0, damage: 0, slow: true, color: '#5dffa0' });
    run(world, 1.5);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(p.slowT).toBeGreaterThan(0);
  });

  it('転がってきたところに当たるとダメージ', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'roller', 200);
    runUntil(world, () => p.hp < PLAYER.maxHp, 5);
    expect(p.hp).toBe(PLAYER.maxHp - e.def.damage);
  });
});

describe('ヒルドローン', () => {
  it('張り付くと、少しずつ HP を吸い続ける（無敵時間は付かない）', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'leech', 60);
    expect(runUntil(world, () => e.state === 'latched', 4)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    run(world, e.def.latch.tick * 3 + 0.1);
    expect(p.hp).toBe(PLAYER.maxHp - e.def.damage * 3);
    expect(p.inv).toBeLessThanOrEqual(0);
    // プレイヤーについてくる
    world.player.x += 50;
    updateWorld(world, DT, idle);
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(p.r + e.r + 2);
  });

  it('ダッシュすると振り払える。しばらく動けなくなる', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'leech', 60);
    runUntil(world, () => e.state === 'latched', 4);
    updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
    updateWorld(world, DT, { ...idle, mx: 1 });
    expect(e.state).toBe('stunned');
    const hp = world.player.hp;
    run(world, 0.6, { ...idle, mx: 1 });
    expect(world.player.hp).toBe(hp);
  });

  it('張り付いている間も、攻撃で倒せる。吸われて倒れることはない', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'leech', 60);
    runUntil(world, () => e.state === 'latched', 4);
    p.hp = 2;
    run(world, 3);
    expect(p.hp).toBe(1);
    expect(world.mode).toBe('play');
    hitEnemy(world, e, 9999, 1, 0, 0);
    expect(e.dead).toBe(true);
  });
});

describe('配管タレット', () => {
  it('動かない。狙いをつけてから蒸気を噴き、線の上にいると当たる', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'pipegun', 300);
    const at = { x: e.x, y: e.y };
    expect(runUntil(world, () => e.state === 'aim', 3)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 4)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - e.def.damage);
    expect(e.x).toBe(at.x);
    expect(e.y).toBe(at.y);
  });

  it('向きが固定されたあとに線から離れれば、当たらない', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'pipegun', 300);
    runUntil(world, () => e.state === 'aim' && e.t <= e.def.steam.lock, 4);
    p.y += 120;
    runUntil(world, () => e.state === 'chase' && e.cd > 0, 4);
    expect(p.hp).toBe(PLAYER.maxHp);
  });
});

describe('パイプサーペント：潜行', () => {
  it('潜っている間は姿が消えて攻撃が当たらず、プレイヤーのいた場所から飛び出して当たる', () => {
    const world = serpentWorld();
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.burrow;
    const target = { x: p.x, y: p.y };
    startAttack(world, 'burrow');
    expect(runUntil(world, () => b.hidden)).toBe(true);
    // 部屋の外に退避しているので、近くの敵を探す処理にも引っかからない
    expect(b.x).toBeLessThan(world.bounds.left - 1000);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => !b.hidden)).toBe(true);
    expect(Math.hypot(b.x - target.x, b.y - target.y)).toBeLessThan(2);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);
  });

  it('着地点が固定されたあとに離れれば、当たらない', () => {
    const world = serpentWorld();
    const b = world.boss;
    const p = world.player;
    const def = b.def.attacks.burrow;
    startAttack(world, 'burrow');
    runUntil(world, () => b.act?.phase === 'under' && b.act.t <= def.lockTime);
    p.y += def.radius + 80;
    runUntil(world, () => !b.hidden);
    expect(p.hp).toBe(PLAYER.maxHp);
  });

  it('後半は2回続けて潜り、飛び出した場所に汚水の床が残る', () => {
    const world = serpentWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    startAttack(world, 'burrowHard');
    let dives = 0;
    let wasHidden = false;
    for (let t = 0; t < 12 && b.act; t += DT) {
      updateWorld(world, DT, idle);
      if (b.hidden && !wasHidden) dives++;
      wasHidden = b.hidden;
    }
    expect(dives).toBe(2);
    expect(world.hazards.filter((h) => h.type === 'pool').length).toBeGreaterThanOrEqual(1);
    expect(b.hidden).toBe(false);
  });
});

describe('種族「大蛇」', () => {
  const damage = (world, e) => {
    const before = e.hp;
    hitEnemy(world, e, 100, 1, 0, 0);
    return before - e.hp;
  };

  it('締め上げ：同じ敵に続けて当てるたびにダメージが上がり、5回で頭打ち。別の敵に当てるとやり直し', () => {
    const world = makeWorld(['coil']);
    const a = addEnemy(world, 'grunt', 60);
    const b = addEnemy(world, 'grunt', 60, 80);
    a.hp = a.maxHp = b.hp = b.maxHp = 100000;
    const hits = [0, 1, 2, 3, 4, 5, 6].map(() => damage(world, a));
    expect(hits[0]).toBe(100);
    expect(hits[1]).toBe(106);
    expect(hits[5]).toBe(130);
    expect(hits[6]).toBe(130); // 上限
    expect(damage(world, b)).toBe(100); // 別の敵
    expect(damage(world, a)).toBe(100); // 戻ってきても、やり直し
  });

  it('締め上げを持っていなければ、続けて当ててもダメージは変わらない', () => {
    const world = makeWorld();
    const a = addEnemy(world, 'grunt', 60);
    a.hp = a.maxHp = 100000;
    expect([0, 1, 2].map(() => damage(world, a))).toEqual([100, 100, 100]);
  });

  it('種族ボーナス：2種類で攻撃速度 +10%、3種類で連続ヒットの上限 +3', () => {
    expect(makeWorld(['coil']).player.stats.comboMax).toBe(COMBO.max);
    const two = makeWorld(['coil', 'ambush']).player.stats;
    expect(two.attackSpeed).toBeCloseTo(0.1);
    expect(two.comboMax).toBe(COMBO.max);
    expect(makeWorld(['coil', 'ambush', 'slither']).player.stats.comboMax).toBe(COMBO.max + 3);
  });

  it('連牙：攻撃速度が上がる。すり抜け：ダッシュの回復が速くなる', () => {
    expect(makeWorld(['twinfang']).player.stats.attackSpeed).toBeCloseTo(0.12);
    const normal = dashCooldown(makeWorld().player);
    expect(normal).toBeCloseTo(PLAYER.dash.cooldown);
    expect(dashCooldown(makeWorld(['slither']).player)).toBeCloseTo(PLAYER.dash.cooldown * 0.85);
  });

  it('丸呑み：敵を倒すと、次の攻撃が必ず会心になる', () => {
    const world = makeWorld(['swallow']);
    const a = addEnemy(world, 'drone', 60);
    const b = addEnemy(world, 'grunt', 60, 80);
    b.hp = b.maxHp = 100000;
    hitEnemy(world, a, 9999, 1, 0, 0);
    expect(world.player.forceCrit).toBe(true);
    expect(hitEnemy(world, b, 100, 1, 0, 0).crit).toBe(true);
  });
});

describe('恒久強化「関節強化」', () => {
  it('サーペントコアで買え、ダッシュの回復が1段ごとに 10% 速くなる', () => {
    const save = createSave();
    expect(buyUpgrade(save, 'joints')).toBe(false); // 素材がない
    save.materials.serpentCore = 2;
    expect(buyUpgrade(save, 'joints')).toBe(true);
    expect(buyUpgrade(save, 'joints')).toBe(true);
    expect(save.materials.serpentCore).toBe(0);
    const world = createWorld({ waves: [{}], rng: () => 0.5, carry: { hp: null, build: createBuild(permanentBonuses(save)) } });
    expect(dashCooldown(world.player)).toBeCloseTo(PLAYER.dash.cooldown * 0.8);
  });
});

describe('減速の重ねがけ', () => {
  it('敵の減速は、長いほうが残る（短い減速で上書きされない）', () => {
    const world = makeWorld(['frostarmor', 'icebreaker']); // 飛竜2種類：減速の時間 +50%
    const e = addEnemy(world, 'grunt', 60);
    e.slowT = STATUS.slow.duration * 3;
    world.player.inv = 0;
    world.player.hp = 50;
    hitEnemy(world, e, 1, 1, 0, 0);
    expect(e.slowT).toBeCloseTo(STATUS.slow.duration * 3);
  });
});
