import { describe, expect, it } from 'vitest';
import { grantUpgrade } from './helpers/upgrades.js';
import { COMBO, PLAYER, STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { species } from '../src/data/implants.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { hitEnemy, hurtPlayer as hurtPlayerFor } from '../src/game/combat.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { dashCooldown } from '../src/game/player.js';
import { chooseImplant, recalcStats } from '../src/game/build.js';
import { NEXT_AREA, createRun, currentArea, enterRoom, handleEvents, leaveRoom, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { bestReachText, mapState, recordMapClear } from '../src/logic/maps.js';
import { useKit } from '../src/game/objects.js';
import { SAVE_VERSION, loadSlot, slotKey } from '../src/logic/save.js';
import { permanentBonuses } from '../src/logic/meta.js';
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

  it('マップ2では、雑魚がマップ1より強い。出る種族は、マップ2のボスの種族（大蛇・大蟹・多頭）', () => {
    const r = createRun({ rng: seeded(4), mapId: 'map2' });
    expect(r.build.species).toEqual(['serpent', 'crab', 'hydra']);
    expect(enterRoom(r).room.enemyScale).toBeCloseTo(maps[1].enemyScale);
    expect(mapSpecies(maps[1])).toEqual(['serpent', 'crab', 'hydra']);
    expect(species.serpent.boss).toBe('pipeserpent');
  });

  it('マップ1のボスを倒していれば、その種族をマップ2に持ち込める。逆もできる', () => {
    const save = createSave();
    save.bossKills.boltboar = 1;
    expect(carryOptions(save, maps[1])).toEqual(['boar']);
    const r = createRun({ rng: seeded(4), mapId: 'map2', carry: 'boar' });
    expect([...r.build.species].sort()).toEqual(['boar', 'crab', 'hydra', 'serpent']);
    save.bossKills.pipeserpent = 1;
    expect(carryOptions(save, maps[0])).toEqual(['serpent']);
  });

  it('3体のボスを順に倒すと、それぞれのコアが手に入り、最後のスラッジハイドラでマップ2が完了になる', () => {
    const save = createSave();
    recordMapClear(save, 'map1', 1); // マップ2は、マップ1を完了すると選べる
    const r = createRun({ rng: seeded(7), save, mapId: 'map2' });
    const killBoss = () => {
      skipToBoss(r, enterRoom(r));
      const world = enterRoom(r);
      while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
      world.player.inv = Infinity;
      // 甲羅のあるボスにも通るよう、防げない攻撃で倒す
      hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
      handleEvents(r, world);
      return world;
    };
    const first = killBoss();
    expect(save.materials.serpentCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('pipeserpent');
    expect(mapState(save, maps[1])).toBe('open'); // まだ先がある
    leaveRoom(r, first, NEXT_AREA);
    expect(currentArea(r).id).toBe('reservoir');
    const second = killBoss();
    expect(save.materials.crabCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('tankcrab');
    expect(mapState(save, maps[1])).toBe('open');
    leaveRoom(r, second, NEXT_AREA);
    expect(currentArea(r).id).toBe('purifier');
    killBoss();
    expect(save.materials.hydraCore).toBeGreaterThan(0);
    expect(save.achievements).toEqual(expect.arrayContaining(['sludgehydra', 'map2']));
    expect(mapState(save, maps[1])).toBe('done');
    // 2周目は、今あるマップをすべて完了するまで選べない（マップ3が残っている）
    expect(save.cycle).toBe(1);
    expect(mapState(save, maps[2])).toBe('open');
    // 最高到達は、マップ2の3つ目のエリアまで
    expect(save.records).toMatchObject({ bestMap: 1, bestArea: 2 });
    expect(bestReachText(save, (id) => DATA.areas.get(id))).toContain('MAP 02 DRAIN 03');
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
    grantUpgrade(save, 'joints');
    grantUpgrade(save, 'joints');
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

// ===== エリア2：貯水槽（汚泥のかたまり、密漁者、タンククラブ、種族「大蟹」） =====

function crabWorld() {
  const world = createWorld({ waves: [{ boss: 'tankcrab' }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  return world;
}

describe('貯水槽の定義', () => {
  it('色・背景・敵・ボス・素材がそろっている', () => {
    const area = DATA.areas.get('reservoir');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const e of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
    const boss = DATA.bosses.get(area.boss);
    expect(boss.id).toBe('tankcrab');
    expect(MATERIAL_ICONS[boss.material]).toBeDefined();
    expect(area.enemies.map((x) => x.id)).toEqual(expect.arrayContaining(['sludge', 'poacher']));
    // 分かれたあとの小さい個体は、部屋の敵としては選ばれない
    for (const a of DATA.areas.all()) expect(a.enemies.map((x) => x.id)).not.toContain('sludgelet');
  });
});

describe('汚泥のかたまり', () => {
  it('倒すと、小さい2体に分かれる。分かれたほうは、もう分かれない', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'sludge', 200);
    hitEnemy(world, e, 99999, 1, 0, 0);
    const kids = world.enemies.filter((x) => !x.dead && x.def.id === 'sludgelet');
    expect(kids).toHaveLength(2);
    for (const k of kids) hitEnemy(world, k, 99999, 1, 0, 0);
    updateWorld(world, DT, idle);
    expect(world.enemies.filter((x) => !x.dead)).toHaveLength(0);
  });
});

describe('密漁者', () => {
  it('照準線を出してから銛を投げ、当たるとダメージを受けて手元まで引き寄せられる', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'poacher', 300);
    expect(runUntil(world, () => e.state === 'aim', 3)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 3)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - e.def.damage);
    expect(p.pull).not.toBeNull();
    const before = Math.hypot(e.x - p.x, e.y - p.y);
    run(world, e.def.harpoon.pull + 0.05);
    const after = Math.hypot(e.x - p.x, e.y - p.y);
    expect(after).toBeLessThan(before - 100);
    expect(after).toBeLessThan(e.def.harpoon.pullTo + 40);
    expect(p.pull).toBeNull();
  });

  it('向きが固定されたあとに線から離れれば、当たらない。ダッシュすれば、引き寄せを振り切れる', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'poacher', 300);
    runUntil(world, () => e.state === 'aim' && e.t <= e.def.harpoon.lock, 4);
    p.y += 100;
    runUntil(world, () => e.state === 'chase' && e.cd > 0, 3);
    expect(p.hp).toBe(PLAYER.maxHp);

    const world2 = makeWorld();
    const p2 = world2.player;
    addEnemy(world2, 'poacher', 300);
    runUntil(world2, () => !!p2.pull, 6);
    updateWorld(world2, DT, { ...idle, mx: -1, dashPressed: true });
    updateWorld(world2, DT, { ...idle, mx: -1 });
    expect(p2.pull).toBeNull();
  });
});

describe('タンククラブ：甲羅', () => {
  it('正面からの攻撃は防がれ、背後からの攻撃は通る', () => {
    const world = crabWorld();
    const b = world.boss;
    const hp = b.hp;
    updateWorld(world, DT, idle);
    // ボスはプレイヤー（左）を向いている。左から右への攻撃は正面から当たる
    expect(hitEnemy(world, b, 100, 1, 0, 0).blocked).toBe(true);
    expect(b.hp).toBe(hp);
    // 右から左への攻撃は、背後から当たる
    expect(hitEnemy(world, b, 100, -1, 0, 0).blocked).toBeFalsy();
    expect(b.hp).toBeLessThan(hp);
  });

  it('攻撃のあとの隙（硬直中）は、甲羅が開いて正面からも通る', () => {
    const world = crabWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    b.act = { name: 'pinch', def: b.def.attacks.pinch, phase: '', t: 0 };
    PATTERNS.cone.start(world, b, b.act, { dx: -1, dy: 0, dist: 1 });
    expect(runUntil(world, () => b.act?.phase === 'recover')).toBe(true);
    updateWorld(world, DT, idle);
    expect(b.shieldOpen).toBe(true);
    expect(hitEnemy(world, b, 100, 1, 0, 0).blocked).toBeFalsy();
  });

  it('向きを変えるのは遅い（すぐには振り向かない）', () => {
    const world = crabWorld();
    const b = world.boss;
    const p = world.player;
    world.player.inv = Infinity;
    updateWorld(world, DT, idle);
    const before = b.angle;
    // プレイヤーが背後へ回り込む
    p.x = b.x + 200;
    p.y = b.y;
    updateWorld(world, DT, idle);
    expect(Math.abs(b.angle - before)).toBeLessThan(0.1);
  });

  it('HPが半分を切ると甲羅が割れ、正面からも通るようになる', () => {
    const world = crabWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    b.hp = b.maxHp * 0.4;
    for (let t = 0; t < 0.5; t += DT) updateWorld(world, DT, idle);
    expect(b.phaseIndex).toBe(1);
    expect(b.shieldOpen).toBe(true);
    expect(hitEnemy(world, b, 100, 1, 0, 0).blocked).toBeFalsy();
  });
});

describe('種族「大蟹」', () => {
  const take = (world, damage = 100) => {
    const p = world.player;
    p.inv = 0;
    const before = p.hp;
    p.hp = before; // そのまま
    world.player.stats.maxHp = Math.max(world.player.stats.maxHp, 1000);
    p.hp = 1000;
    hurtPlayerFor(world, damage);
    return 1000 - p.hp;
  };

  it('甲殻：被ダメージが減る。種族ボーナス（2種類）でさらに減る', () => {
    expect(take(makeWorld())).toBe(100);
    expect(take(makeWorld(['carapace']))).toBe(92);
    expect(take(makeWorld(['carapace', 'bigclaw']))).toBe(82);
  });

  it('踏ん張り：立ち止まっている間だけ、被ダメージが減る', () => {
    const still = makeWorld(['brace']);
    run(still, 0.5);
    expect(take(still)).toBe(85);
    const moving = makeWorld(['brace']);
    run(moving, 0.5, { ...idle, mx: 1 });
    expect(take(moving)).toBe(100);
  });

  it('反撃：被弾後2秒間、攻撃力が上がる', () => {
    const world = makeWorld(['riposte']);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
    take(world, 5);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.3);
    world.player.inv = Infinity;
    run(world, 2.2);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
  });

  it('とげ甲羅：被弾したとき、周囲の敵にダメージ', () => {
    const world = makeWorld(['thornshell']);
    const near = addEnemy(world, 'grunt', 60);
    const far = addEnemy(world, 'grunt', 400);
    take(world, 5);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });

  it('大ばさみ：会心ダメージが上がる。種族ボーナス（3種類）：被弾後の無敵時間が伸びる', () => {
    expect(makeWorld(['bigclaw']).player.stats.critMul).toBeCloseTo(PLAYER.critMultiplier + 0.3);
    const normal = makeWorld();
    take(normal, 5);
    expect(normal.player.inv).toBeCloseTo(PLAYER.hitInvincible);
    const three = makeWorld(['carapace', 'bigclaw', 'riposte']);
    take(three, 5);
    expect(three.player.inv).toBeCloseTo(PLAYER.hitInvincible + 0.4);
  });

  it('被ダメージの軽減は、重ねても下限より小さくならない', () => {
    const world = makeWorld(['carapace', 'brace', 'bigclaw']);
    // ありえないほど強化しても、下限で止まる
    world.player.build.implants.carapace = 30;
    world.player.build.implants.brace = 30;
    recalcStats(world.player);
    run(world, 0.5);
    expect(take(world)).toBe(Math.round(100 * PLAYER.minDamageTaken));
  });

  it('恒久強化「装甲板」：クラブコアで買え、被ダメージが1段ごとに 3% 減る', () => {
    const save = createSave();
    save.materials.crabCore = 2;
    grantUpgrade(save, 'armorplate');
    grantUpgrade(save, 'armorplate');
    const world = createWorld({ waves: [{}], rng: () => 0.5, carry: { hp: null, build: createBuild(permanentBonuses(save)) } });
    expect(world.player.stats.damageTaken).toBeCloseTo(0.94);
  });
});

// ===== エリア3：浄水プラント（スラッジハイドラ、種族「多頭」、データ片、持ち込みの枠） =====

function hydraWorld() {
  const world = createWorld({ waves: [{ boss: 'sludgehydra' }], rng: () => 0.5 });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.player.inv = Infinity;
  for (let t = 0; t < 1; t += DT) updateWorld(world, DT, idle); // 首が生えそろうまで
  return world;
}
const headsOf = (world) => world.enemies.filter((e) => e.anchor === world.boss && !e.dead);

describe('浄水プラントの定義', () => {
  it('色・背景・敵・ボス・素材がそろっている。マップ2は3エリア', () => {
    expect(maps[1].areas).toEqual(['sewer', 'reservoir', 'purifier']);
    const area = DATA.areas.get('purifier');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const e of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
    expect(MATERIAL_ICONS[DATA.bosses.get(area.boss).material]).toBeDefined();
    for (const a of DATA.areas.all()) expect(a.enemies.map((x) => x.id)).not.toContain('hydrahead');
  });

  it('マップ2のどのエリアにも、データ片が4つある（データ金庫で3つ、ボスで1つ）', () => {
    for (const id of maps[1].areas) {
      const frags = DATA.fragments.all().filter((f) => f.area === id);
      expect(frags.filter((f) => f.source === 'vault'), id).toHaveLength(3);
      expect(frags.filter((f) => f.source === 'boss'), id).toHaveLength(1);
    }
  });
});

describe('スラッジハイドラ：首', () => {
  it('首が3本生える。体のまわりに付いたまま、弾を吐く', () => {
    const world = hydraWorld();
    const b = world.boss;
    const heads = headsOf(world);
    expect(heads).toHaveLength(3);
    for (const h of heads) expect(Math.hypot(h.x - b.x, h.y - b.y)).toBeCloseTo(b.def.heads.orbit, 0);
    world.player.inv = 0;
    expect(runUntil(world, () => world.shots.length > 0, 6)).toBe(true);
    // ボスが動くと、首もついてくる
    b.x -= 100;
    updateWorld(world, DT, idle);
    for (const h of headsOf(world)) expect(Math.hypot(h.x - b.x, h.y - b.y)).toBeCloseTo(b.def.heads.orbit, 0);
  });

  it('首が残っている間は本体が硬く、すべて落とすとふつうに通る', () => {
    const world = hydraWorld();
    const b = world.boss;
    const hit = () => {
      const before = b.hp;
      hitEnemy(world, b, 100, 1, 0, 0);
      return before - b.hp;
    };
    expect(hit()).toBe(Math.round(100 * (1 - b.def.heads.reduce)));
    for (const h of headsOf(world)) hitEnemy(world, h, 999999, 1, 0, 0);
    updateWorld(world, DT, idle);
    expect(headsOf(world)).toHaveLength(0);
    expect(b.armor).toBe(0);
    expect(hit()).toBe(100);
  });

  it('前半は、落とした首は生え直さない。後半は、時間がたつと1本ずつ生え直す', () => {
    const world = hydraWorld();
    const b = world.boss;
    for (const h of headsOf(world)) hitEnemy(world, h, 999999, 1, 0, 0);
    for (let t = 0; t < 12; t += DT) updateWorld(world, DT, idle);
    expect(headsOf(world)).toHaveLength(0);

    b.hp = b.maxHp * 0.4; // 後半へ
    b.idleT = Infinity;
    const regrow = b.def.phases[1].regrow;
    for (let t = 0; t < regrow + 1; t += DT) { b.idleT = Infinity; updateWorld(world, DT, idle); }
    expect(headsOf(world)).toHaveLength(1);
    for (let t = 0; t < regrow * 3; t += DT) { b.idleT = Infinity; updateWorld(world, DT, idle); }
    expect(headsOf(world)).toHaveLength(3); // 上限まで
  });

  it('本体を倒すと、首も一緒に消える', () => {
    const world = hydraWorld();
    hitEnemy(world, world.boss, 99999999, 1, 0, 0);
    // 倒した瞬間の、画面が止まる演出と、経験値でのレベルアップの3択を済ませる
    for (let t = 0; t < 3; t += DT) {
      if (world.choice) chooseImplant(world, 0);
      updateWorld(world, DT, idle);
    }
    expect(world.enemies.filter((e) => !e.dead)).toHaveLength(0);
    expect(world.mode).toBe('clear');
  });
});

describe('種族「多頭」', () => {
  it('再生組織：少しずつ HP が戻る（満タンより上には増えない）', () => {
    const world = makeWorld(['regen']);
    const p = world.player;
    p.hp = 50;
    run(world, 4);
    expect(p.hp).toBeCloseTo(52, 0);
    p.hp = p.stats.maxHp - 0.2;
    run(world, 4);
    expect(p.hp).toBe(p.stats.maxHp);
  });

  it('捕食：撃破するたびに HP が戻る', () => {
    const world = makeWorld(['devour']);
    const p = world.player;
    p.hp = 60;
    hitEnemy(world, addEnemy(world, 'drone', 60), 9999, 1, 0, 0);
    expect(p.hp).toBe(63);
  });

  it('予備の首：倒れても、出撃ごとに1回だけ起き上がる', () => {
    const world = makeWorld(['sparehead']);
    const p = world.player;
    p.inv = 0;
    hurtPlayerFor(world, 9999);
    expect(world.mode).toBe('play');
    expect(p.hp).toBe(Math.round(p.stats.maxHp * 0.3));
    expect(p.build.reviveUsed).toBe(true);
    p.inv = 0;
    hurtPlayerFor(world, 9999);
    expect(world.mode).toBe('dead');
  });

  it('濃縮体液：修復キットの回復量が増える。種族ボーナス（2種類）でさらに増える', () => {
    const heal = (ids) => {
      const world = makeWorld(ids);
      const p = world.player;
      p.build.kits = 1;
      p.stats.maxHp = 1000; // 回復が上限で切られないように
      p.hp = 600; // 半分より上（HP 半分以下の効果が乗らないように）
      useKit(world);
      return p.hp - 600;
    };
    expect(heal([])).toBeCloseTo(PLAYER.kit.heal);
    expect(heal(['thickblood'])).toBeCloseTo(PLAYER.kit.heal * 1.25);
    expect(heal(['thickblood', 'devour'])).toBeCloseTo(PLAYER.kit.heal * 1.55);
  });

  it('底力：HPが半分以下のとき、被ダメージが減る', () => {
    const world = makeWorld(['lastgasp']);
    const p = world.player;
    p.inv = 0;
    p.hp = 100;
    hurtPlayerFor(world, 20);
    expect(p.hp).toBe(80);
    p.hp = 50;
    p.inv = 0;
    hurtPlayerFor(world, 20);
    expect(p.hp).toBe(33);
  });

  it('種族ボーナス（3種類）：HPが半分以下のとき、回復が2倍', () => {
    const world = makeWorld(['regen', 'devour', 'lastgasp']);
    const p = world.player;
    p.build.kits = 2;
    p.hp = 60;
    useKit(world);
    const high = p.hp - 60;
    p.hp = 20;
    useKit(world);
    expect(p.hp - 20).toBe(high * 2);
  });
});

describe('恒久強化（ハイドラコア）', () => {
  it('再生槽：最大HPが増える。部品棚の増設：持ち込みの枠が2つになる', () => {
    const save = createSave();
    expect(permanentBonuses(save).carrySlots).toBe(1);
    save.materials.hydraCore = 3;
    grantUpgrade(save, 'regentank');
    grantUpgrade(save, 'carryslot');
    const bonus = permanentBonuses(save);
    expect(bonus.carrySlots).toBe(2);
    const world = createWorld({ waves: [{}], rng: () => 0.5, carry: { hp: null, build: createBuild(bonus) } });
    expect(world.player.stats.maxHp).toBe(PLAYER.maxHp + 15);
  });

  it('持ち込みは、2種類まで渡せる', () => {
    const r = createRun({ rng: seeded(4), mapId: 'map1', carry: ['serpent', 'hydra'] });
    expect([...r.build.species].sort()).toEqual(['boar', 'core', 'hydra', 'serpent', 'wyvern']);
  });
});

describe('セーブデータ（版5）', () => {
  it('版4のセーブデータを読むと、持ち込みの2つ目の枠と、最高到達のマップが足される', () => {
    const old = { ...createSave(), version: 4, carrySpecies: 'boar', records: { runs: 3, clears: 1, kills: 50, bestArea: 2, bestStep: 9 } };
    delete old.carrySpecies2;
    const loaded = loadSlot({ getItem: (k) => (k === slotKey(1) ? JSON.stringify(old) : null), setItem() {}, removeItem() {} }, 1);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.carrySpecies).toBe('boar');
    expect(loaded.carrySpecies2).toBeNull();
    expect(loaded.records).toMatchObject({ bestMap: 0, bestArea: 2, bestStep: 9 });
    expect(bestReachText(loaded, (id) => DATA.areas.get(id))).toBe('MAP 01 SECTOR 03-10');
  });

  it('最高到達は、マップ → エリア → 部屋の順に、奥まで進んだほうが残る', () => {
    const save = createSave();
    save.records.runs = 1;
    const r2 = createRun({ rng: seeded(4), save, mapId: 'map2' });
    enterRoom(r2);
    expect(save.records).toMatchObject({ bestMap: 1, bestArea: 0, bestStep: 0 });
    // そのあとマップ1の奥まで行っても、マップ2の記録は上書きされない
    const r1 = createRun({ rng: seeded(4), save, mapId: 'map1' });
    skipToBoss(r1, enterRoom(r1));
    enterRoom(r1);
    expect(save.records.bestMap).toBe(1);
  });
});
