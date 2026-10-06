import { describe, expect, it } from 'vitest';
import { grantUpgrade } from './helpers/upgrades.js';
import { DEVICE, PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { hasGimmickPart } from '../src/game/gimmicks.js';
import { buildRoom } from '../src/game/rooms.js';
import { NEXT_AREA, createRun, currentArea, enterRoom, handleEvents, leaveRoom, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { mapState, recordMapClear } from '../src/logic/maps.js';
import { permanentBonuses } from '../src/logic/meta.js';
import { createSave } from '../src/logic/save.js';
import { createBuild, mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ3「建設区」のエリア1：資材置き場（部屋の仕掛け、溶接ボット、リベッター、運搬ドローン、スクラップハウンド、種族「猟犬」）

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

describe('マップ3の定義', () => {
  it('資材置き場：色・背景・敵・ボス・素材・データ片がそろっている', () => {
    expect(maps[2]).toMatchObject({ id: 'map3', name: '建設区' });
    expect(maps[2].areas[0]).toBe('yard');
    const area = DATA.areas.get('yard');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const e of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
    const boss = DATA.bosses.get(area.boss);
    expect(boss.id).toBe('scraphound');
    expect(MATERIAL_ICONS[boss.material]).toBeDefined();
    const frags = DATA.fragments.all().filter((f) => f.area === 'yard');
    expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
  });

  it('マップ2を完了すると選べる。雑魚はマップ2より強い。出る種族は猟犬', () => {
    const save = createSave();
    recordMapClear(save, 'map1', 1);
    expect(mapState(save, maps[2])).toBe('locked');
    recordMapClear(save, 'map2', 1);
    expect(mapState(save, maps[2])).toBe('open');
    const r = createRun({ rng: seeded(4), mapId: 'map3' });
    expect(enterRoom(r).room.enemyScale).toBeGreaterThan(maps[1].enemyScale);
    expect(mapSpecies(maps[2])).toContain('hound');
  });

  it('スクラップハウンドを倒すと、ハウンドコアと実績が手に入る', () => {
    const save = createSave();
    const r = createRun({ rng: seeded(7), save, mapId: 'map3' });
    skipToBoss(r, enterRoom(r));
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0);
    handleEvents(r, world);
    expect(save.materials.houndCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('scraphound');
  });
});

describe('部屋の仕掛け：落下する鉄骨', () => {
  const def = DATA.gimmicks.get('girders');
  const area = DATA.areas.get('yard');

  it('どの仕掛けも、動かし方の部品がある。エリアに書いた仕掛けは、定義されている', () => {
    for (const g of DATA.gimmicks.all()) expect(hasGimmickPart(g.part), g.id).toBe(true);
    for (const a of DATA.areas.all()) for (const g of a.gimmicks ?? []) expect(DATA.gimmicks.has(g.id), `${a.id}: ${g.id}`).toBe(true);
  });

  it('資材置き場の戦闘部屋の一部に付く。エリート・ボス・戦闘のない部屋には付かない。ほかのマップには付かない', () => {
    let with_ = 0;
    const rng = seeded(11);
    for (let i = 0; i < 200; i++) if (buildRoom('combat', { area, step: 1, build: null, rng }).gimmick) with_++;
    expect(with_).toBeGreaterThan(40);
    expect(with_).toBeLessThan(140);
    for (const type of ['elite', 'boss', 'supply', 'vault']) {
      for (let i = 0; i < 20; i++) expect(buildRoom(type, { area, step: 1, build: createBuild(), rng }).gimmick).toBeNull();
    }
    for (let i = 0; i < 50; i++) expect(buildRoom('combat', { area: DATA.areas.get('slum'), step: 1, build: null, rng }).gimmick).toBeNull();
  });

  function gimmickWorld() {
    const room = { type: 'combat', waves: [{}], objects: [], doors: [], clearCredits: 0, gimmick: def };
    const world = createWorld({ room, rng: seeded(3) });
    world.waveTimer = Infinity;
    return world;
  }

  it('予告つきで落ちてくる。1つ目はプレイヤーの近く。立ち止まっていると当たる', () => {
    const world = gimmickWorld();
    const p = world.player;
    addEnemy(world, 'turret', 900, 900).cd = 99; // 部屋をクリアにしないための敵（攻撃はさせない）
    expect(runUntil(world, () => world.hazards.length > 0, 4)).toBe(true);
    expect(world.hazards).toHaveLength(def.count);
    expect(Math.hypot(world.hazards[0].x - p.x, world.hazards[0].y - p.y)).toBeLessThanOrEqual(def.spread + 1);
    expect(world.hazards[0].t).toBeGreaterThan(0.8); // 予告の時間がある
    expect(p.hp).toBe(PLAYER.maxHp);
    // 何度か落ちてくるうちに、動かなければ当たる
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 20)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);
  });

  it('敵にも当たる', () => {
    const world = gimmickWorld();
    world.player.inv = Infinity;
    const e = addEnemy(world, 'grunt', 0);
    e.cd = 99;
    e.hp = e.maxHp = 100000;
    e.def = { ...e.def, speed: 0 };
    expect(runUntil(world, () => e.hp < e.maxHp, 20)).toBe(true);
    expect(e.maxHp - e.hp).toBe(def.enemyDamage);
  });

  it('カウントダウン中と、部屋をクリアしたあとは、落ちてこない', () => {
    const waiting = gimmickWorld();
    waiting.countdown = 99;
    run(waiting, 8);
    expect(waiting.hazards).toHaveLength(0);

    const world = gimmickWorld();
    world.player.inv = Infinity;
    world.waveTimer = 0; // 敵のいない波：すぐにクリアになる
    run(world, 1);
    expect(world.mode).toBe('clear');
    run(world, 8);
    expect(world.hazards).toHaveLength(0);
  });
});

describe('溶接ボット', () => {
  it('火花を噴いても減速はしない。噴き終わると、噴いた先の床がしばらく燃える', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'welder', 100);
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 5)).toBe(true);
    expect(p.slowT).toBeLessThanOrEqual(0);
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'pool'), 4)).toBe(true);
    const pool = world.hazards.find((h) => h.type === 'pool');
    expect(pool.slow).toBe(false);
    expect(pool.damage).toBe(e.def.spray.pool.damage);
  });

  it('フロストスプレイヤーは、これまでどおり減速する', () => {
    const world = makeWorld();
    const p = world.player;
    addEnemy(world, 'sprayer', 100);
    runUntil(world, () => p.hp < PLAYER.maxHp, 5);
    expect(p.slowT).toBeGreaterThan(0);
    run(world, 3);
    expect(world.hazards.filter((h) => h.type === 'pool')).toHaveLength(0);
  });
});

describe('リベッター', () => {
  it('狙いをつけてから、3発続けて撃つ', () => {
    const world = makeWorld();
    world.player.inv = Infinity;
    const e = addEnemy(world, 'riveter', 280);
    let fired = 0;
    let before = 0;
    for (let t = 0; t < 1.6; t += DT) {
      updateWorld(world, DT, idle);
      if (world.shots.length > before) fired += world.shots.length - before;
      before = world.shots.length;
    }
    expect(fired).toBe(e.def.shot.burst);
    expect(e.state).toBe('chase');
  });

  it('監視タレットは、これまでどおり1発ずつ撃つ', () => {
    const world = makeWorld();
    world.player.inv = Infinity;
    addEnemy(world, 'turret', 300);
    let fired = 0;
    let before = 0;
    for (let t = 0; t < 1.5; t += DT) {
      updateWorld(world, DT, idle);
      if (world.shots.length > before) fired += world.shots.length - before;
      before = world.shots.length;
    }
    expect(fired).toBe(1);
  });
});

describe('運搬ドローン', () => {
  it('プレイヤーのいる場所に、予告つきで樽を落とす。その場から動けば当たらない', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'carrier', 150);
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'mark'), 4)).toBe(true);
    const mark = world.hazards.find((h) => h.type === 'mark');
    expect(Math.hypot(mark.x - p.x, mark.y - p.y)).toBeLessThan(2);
    expect(p.hp).toBe(PLAYER.maxHp);
    // 立ち止まっていると当たる
    e.cd = 99;
    runUntil(world, () => world.hazards.length === 0, 3);
    expect(p.hp).toBe(PLAYER.maxHp - e.def.damage);

    const world2 = makeWorld();
    const e2 = addEnemy(world2, 'carrier', 150);
    runUntil(world2, () => world2.hazards.some((h) => h.type === 'mark'), 4);
    e2.cd = 99;
    world2.player.y += 150;
    runUntil(world2, () => world2.hazards.length === 0, 3);
    expect(world2.player.hp).toBe(PLAYER.maxHp);
  });
});

describe('スクラップハウンド：磁力', () => {
  function houndWorld() {
    const world = createWorld({ waves: [{ boss: 'scraphound' }], rng: () => 0.5 });
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.boss.idleT = Infinity;
    return world;
  }
  function startMagnet(world) {
    const b = world.boss;
    const p = world.player;
    b.act = { name: 'magnet', def: b.def.attacks.magnet, phase: '', t: 0 };
    PATTERNS.magnet.start(world, b, b.act, { dx: p.x - b.x, dy: p.y - b.y, dist: 1 });
    return b.act;
  }

  it('立ち止まっていると引き寄せられ、最後に周りを叩かれる', () => {
    const world = houndWorld();
    const b = world.boss;
    const p = world.player;
    b.x = 600;
    b.y = p.y;
    p.x = 400;
    const act = startMagnet(world);
    runUntil(world, () => act.phase === 'active');
    const before = b.x - p.x;
    run(world, 1);
    expect(b.x - p.x).toBeLessThan(before - 80);
    expect(p.hp).toBe(PLAYER.maxHp);
    runUntil(world, () => act.phase === 'recover');
    expect(p.hp).toBe(PLAYER.maxHp - act.def.damage);
  });

  it('逆向きに歩けば、引き寄せに逆らって離れられる。最後の一撃も当たらない', () => {
    const world = houndWorld();
    const b = world.boss;
    const p = world.player;
    b.x = 600;
    b.y = p.y;
    p.x = 400;
    const act = startMagnet(world);
    const away = { ...idle, mx: -1 };
    for (let t = 0; t < 8 && act.phase !== 'recover'; t += DT) updateWorld(world, DT, away);
    expect(b.x - p.x).toBeGreaterThan(200);
    expect(p.hp).toBe(PLAYER.maxHp);
  });
});

describe('種族「猟犬」', () => {
  it('慣性：動いている間だけ、攻撃力が上がる', () => {
    const world = makeWorld(['momentum']);
    run(world, 0.3);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
    run(world, 0.2, { ...idle, mx: 1 });
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.15);
  });

  it('狩り：HPが半分以下の敵へのダメージが上がる', () => {
    const world = makeWorld(['hunt']);
    const e = addEnemy(world, 'grunt', 60);
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1);
    e.hp = e.maxHp * 0.5;
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.25);
  });

  it('疾走：敵を倒すと3秒間、速く動ける', () => {
    const distance = (world) => {
      const x = world.player.x;
      run(world, 0.5, { ...idle, my: 1 });
      return Math.abs(world.player.y - 270) + Math.abs(world.player.x - x);
    };
    const world = makeWorld(['sprint']);
    const slow = distance(world);
    world.player.y = 270;
    hitEnemy(world, addEnemy(world, 'drone', 300), 9999, 1, 0, 0);
    const fast = distance(world);
    expect(fast).toBeGreaterThan(slow * 1.2);
    // 3秒たつと元に戻る
    world.player.inv = Infinity;
    run(world, 3);
    world.player.y = 270;
    expect(distance(world)).toBeCloseTo(slow, 0);
  });

  it('跳躍：ダッシュの距離が伸びる', () => {
    const dash = (ids) => {
      const world = makeWorld(ids);
      const x = world.player.x;
      updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
      for (let t = 0; t < PLAYER.dash.duration; t += DT) updateWorld(world, DT, idle);
      return world.player.x - x;
    };
    expect(dash(['longdash'])).toBeGreaterThan(dash([]) * 1.15);
  });

  it('追い打ち：ダッシュ後1.5秒間、攻撃速度が上がる', () => {
    const world = makeWorld(['pursuit']);
    expect(statWith(world, 'attackSpeed')).toBeCloseTo(0);
    updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
    expect(statWith(world, 'attackSpeed')).toBeCloseTo(0.2);
    run(world, 1.7);
    expect(statWith(world, 'attackSpeed')).toBeCloseTo(0);
  });

  it('種族ボーナス：2種類で移動速度 +10%、3種類でダッシュの回数 +1', () => {
    const two = makeWorld(['momentum', 'hunt']).player.stats;
    expect(two.moveSpeedMul).toBeCloseTo(1.1);
    expect(two.dashCharges).toBe(1);
    expect(makeWorld(['momentum', 'hunt', 'longdash']).player.stats.dashCharges).toBe(2);
  });

  it('恒久強化「脚部強化」：ハウンドコアで買え、移動速度が1段ごとに 3% 上がる', () => {
    const save = createSave();
    save.materials.houndCore = 2;
    grantUpgrade(save, 'legs');
    grantUpgrade(save, 'legs');
    const world = createWorld({ waves: [{}], rng: () => 0.5, carry: { hp: null, build: createBuild(permanentBonuses(save)) } });
    expect(world.player.stats.moveSpeedMul).toBeCloseTo(1.06);
  });
});

// ===== エリア2：高架の現場（足場組み、現場荒らし、ガーダースパイダー、種族「蜘蛛」） =====

const posts = (world, id) => world.enemies.filter((e) => !e.dead && e.def.id === id);

describe('高架の現場の定義', () => {
  it('色・背景・敵・ボス・素材・データ片がそろっている', () => {
    expect(maps[2].areas).toContain('viaduct');
    const area = DATA.areas.get('viaduct');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const e of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
    expect(MATERIAL_ICONS[DATA.bosses.get(area.boss).material]).toBeDefined();
    const frags = DATA.fragments.all().filter((f) => f.area === 'viaduct');
    expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
    // 置かれたもの（柵・橋げた）と子蜘蛛は、部屋の敵としては選ばれない
    for (const a of DATA.areas.all()) for (const id of ['fencepost', 'girderpost', 'spiderling']) expect(a.enemies.map((x) => x.id)).not.toContain(id);
  });
});

describe('柵・橋げた（置かれたもの）', () => {
  it('歩いては通れない。ダッシュ中はすり抜けられる', () => {
    const world = makeWorld();
    const p = world.player;
    const post = addEnemy(world, 'fencepost', 40);
    const stay = addEnemy(world, 'turret', 900, 900); // 部屋をクリアにしないための敵
    stay.cd = 99;
    run(world, 1.2, { ...idle, mx: 1 });
    expect(p.x).toBeLessThan(post.x - post.r - p.r + 1);

    const world2 = makeWorld();
    const p2 = world2.player;
    const post2 = addEnemy(world2, 'fencepost', 40);
    addEnemy(world2, 'turret', 900, 900).cd = 99;
    updateWorld(world2, DT, { ...idle, mx: 1, dashPressed: true });
    for (let t = 0; t < PLAYER.dash.duration + 0.05; t += DT) updateWorld(world2, DT, { ...idle, mx: 1 });
    expect(p2.x).toBeGreaterThan(post2.x);
  });

  it('敵の弾を止める。攻撃で壊せる。壊しても撃破数や経験値にはならない', () => {
    const world = makeWorld();
    const p = world.player;
    const post = addEnemy(world, 'fencepost', 60);
    addEnemy(world, 'turret', 900, 900).cd = 99;
    world.shots.push({ x: p.x + 200, y: p.y, vx: -300, vy: 0, r: 5, damage: 10, life: 3 });
    run(world, 1);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(world.shots).toHaveLength(0);

    const xp = p.build.xp;
    hitEnemy(world, post, 9999, 1, 0, 0);
    expect(post.dead).toBe(true);
    expect(world.kills).toBe(0);
    expect(p.build.xp).toBe(xp);
    expect(world.events.filter((e) => e.type === 'kill')).toHaveLength(0);
  });

  it('柵が残っていても、敵を全部倒せば部屋はクリアになり、柵は片づけられる', () => {
    const world = makeWorld();
    world.player.inv = Infinity;
    addEnemy(world, 'fencepost', 200);
    const foe = addEnemy(world, 'drone', 300);
    world.waveTimer = 0;
    run(world, 0.2);
    expect(world.mode).toBe('play');
    hitEnemy(world, foe, 9999, 1, 0, 0);
    run(world, 0.5);
    expect(world.mode).toBe('clear');
    expect(world.enemies).toHaveLength(0);
  });
});

describe('足場組み', () => {
  it('予告のあと、プレイヤーの手前に柵（杭4本）を立てる。上限を超えては立てない', () => {
    const world = makeWorld();
    world.player.inv = Infinity;
    const e = addEnemy(world, 'scaffolder', 260);
    const build = e.def.build;
    expect(runUntil(world, () => e.state === 'windup', 3)).toBe(true);
    expect(e.buildSpots).toHaveLength(build.posts);
    expect(posts(world, 'fencepost')).toHaveLength(0);
    expect(runUntil(world, () => posts(world, 'fencepost').length > 0, 3)).toBe(true);
    expect(posts(world, 'fencepost')).toHaveLength(build.posts);
    // 柵は、足場組みとプレイヤーのあいだに立つ
    const p = world.player;
    for (const post of posts(world, 'fencepost')) {
      expect(post.x).toBeGreaterThan(p.x);
      expect(post.x).toBeLessThan(e.x);
    }
    run(world, build.interval * 6);
    expect(posts(world, 'fencepost').length).toBeLessThanOrEqual(build.max);
  });
});

describe('現場荒らし', () => {
  it('プレイヤーのいる場所に、予告つきで鉄パイプを投げる。その場から動けば当たらない', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'lobber', 300);
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'mark'), 4)).toBe(true);
    const mark = world.hazards.find((h) => h.type === 'mark');
    expect(mark.from).toBeDefined();
    expect(Math.hypot(mark.x - p.x, mark.y - p.y)).toBeLessThan(2);
    e.cd = 99;
    runUntil(world, () => world.hazards.length === 0, 3);
    expect(p.hp).toBe(PLAYER.maxHp - e.def.damage);

    const world2 = makeWorld();
    const e2 = addEnemy(world2, 'lobber', 300);
    runUntil(world2, () => world2.hazards.some((h) => h.type === 'mark'), 4);
    e2.cd = 99;
    world2.player.y += 130;
    runUntil(world2, () => world2.hazards.length === 0, 3);
    expect(world2.player.hp).toBe(PLAYER.maxHp);
  });
});

describe('ガーダースパイダー：橋げた', () => {
  function spiderWorld() {
    const world = createWorld({ waves: [{ boss: 'girderspider' }], rng: seeded(9) });
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.boss.idleT = Infinity;
    world.player.inv = Infinity;
    return world;
  }
  function startGirder(world, name = 'girder') {
    const b = world.boss;
    b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
    PATTERNS.girder.start(world, b, b.act, { dx: -1, dy: 0, dist: 1 });
    return b.act;
  }

  it('予告のあと、部屋を横切る杭の列が立つ。ところどころに隙間がある。プレイヤーの真上には立たない', () => {
    const world = spiderWorld();
    const p = world.player;
    const act = startGirder(world);
    expect(act.spots.length).toBeGreaterThan(10);
    expect(posts(world, 'girderpost')).toHaveLength(0); // 予告の間は、まだ立たない
    runUntil(world, () => act.phase === 'recover');
    const made = posts(world, 'girderpost');
    expect(made.length).toBeGreaterThan(10);
    for (const post of made) expect(Math.hypot(post.x - p.x, post.y - p.y)).toBeGreaterThanOrEqual(p.r + post.r);
    // 縦の列：部屋の高さぶんを杭で埋めると、隙間のぶんだけ少なくなる
    const xs = new Map();
    for (const post of made) xs.set(Math.round(post.x), (xs.get(Math.round(post.x)) ?? 0) + 1);
    const column = Math.max(...xs.values());
    const full = Math.floor((world.bounds.bottom - world.bounds.top) / act.def.spacing);
    expect(column).toBeLessThan(full);
    expect(column).toBeGreaterThan(full / 2);
  });

  it('何度張っても、部屋に残る杭は上限まで（古いものから崩れる）', () => {
    const world = spiderWorld();
    const max = world.boss.def.attacks.girderHard.max;
    for (let i = 0; i < 6; i++) {
      const act = startGirder(world, 'girderHard');
      runUntil(world, () => world.boss.act !== act);
      world.boss.idleT = Infinity;
    }
    expect(posts(world, 'girderpost').length).toBeLessThanOrEqual(max);
    expect(posts(world, 'girderpost').length).toBeGreaterThan(max * 0.6);
  });

  it('子蜘蛛の召喚は、杭の数を数えない（杭が多くても呼べる）', () => {
    const world = spiderWorld();
    const b = world.boss;
    const act = startGirder(world);
    runUntil(world, () => b.act !== act);
    b.idleT = Infinity;
    b.act = { name: 'brood', def: b.def.attacks.brood, phase: '', t: 0 };
    PATTERNS.summon.start(world, b, b.act, { dx: -1, dy: 0, dist: 1 });
    runUntil(world, () => world.enemies.some((e) => e.def.id === 'spiderling'), 3);
    expect(world.enemies.filter((e) => e.def.id === 'spiderling')).toHaveLength(b.def.attacks.brood.count);
  });

  it('ボスを倒すと、杭も一緒に消える', () => {
    const world = spiderWorld();
    const act = startGirder(world);
    runUntil(world, () => world.boss.act !== act);
    hitEnemy(world, world.boss, 99999999, 1, 0, 0);
    for (let t = 0; t < 3; t += DT) {
      if (world.choice) world.choice = null;
      world.pendingLevelUps = 0;
      updateWorld(world, DT, idle);
    }
    expect(world.mode).toBe('clear');
    expect(world.enemies).toHaveLength(0);
  });
});

describe('種族「蜘蛛」', () => {
  const dash = (world) => {
    updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
    for (let t = 0; t < PLAYER.dash.duration + 0.05; t += DT) updateWorld(world, DT, idle);
  };
  const mines = (world) => world.devices.filter((d) => d.type === 'mine');
  const sentries = (world) => world.devices.filter((d) => d.type === 'sentry');
  function fightWorld(ids) {
    const world = makeWorld(ids);
    world.player.inv = Infinity;
    const far = addEnemy(world, 'turret', 900, 900); // 部屋をクリアにしないための敵
    far.cd = 99;
    far.hp = far.maxHp = 1e9;
    return world;
  }

  it('地雷：ダッシュした場所に1個置く。敵が触れると爆発する。新しく置くと、古いものは消える', () => {
    const world = fightWorld(['mine']);
    const p = world.player;
    const start = { x: p.x, y: p.y };
    dash(world);
    expect(mines(world)).toHaveLength(1);
    expect(Math.hypot(mines(world)[0].x - start.x, mines(world)[0].y - start.y)).toBeLessThan(40);
    run(world, 1.2); // ダッシュが溜まるのを待つ
    dash(world);
    expect(mines(world)).toHaveLength(1); // 置けるのは1個まで

    const mine = mines(world)[0];
    const e = addEnemy(world, 'grunt', 0);
    e.x = mine.x;
    e.y = mine.y;
    e.cd = 99;
    e.hp = e.maxHp = 100000;
    run(world, 0.5);
    expect(e.maxHp - e.hp).toBe(48);
    expect(mines(world)).toHaveLength(0);
  });

  it('小型タレット：部屋に入ってしばらくすると足元に置かれ、近くの敵を撃って、時間がたつと消える', () => {
    const world = fightWorld(['sentry']);
    const e = addEnemy(world, 'grunt', 120);
    e.cd = 99;
    e.hp = e.maxHp = 100000;
    e.def = { ...e.def, speed: 0 };
    run(world, DEVICE.sentry.first + 0.1);
    expect(sentries(world)).toHaveLength(1);
    run(world, 2);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect((e.maxHp - e.hp) % 12).toBe(0);
    run(world, DEVICE.sentry.life);
    // 次のタレットが置かれるまでは、いない時間がある
    expect(sentries(world).length).toBeLessThanOrEqual(1);
  });

  it('紡績腺と種族ボーナス：設置物のダメージが上がる。3種類で、同じ設置物を2つ置ける', () => {
    expect(makeWorld(['spinneret']).player.stats.deviceMul).toBeCloseTo(1.3);
    expect(makeWorld(['mine', 'spinneret']).player.stats.deviceMul).toBeCloseTo(1.55);
    const world = fightWorld(['mine', 'spinneret', 'trapper']);
    expect(world.player.stats.deviceCount).toBe(2);
    dash(world);
    run(world, 1.2);
    dash(world);
    expect(mines(world)).toHaveLength(2);
    run(world, 1.2);
    dash(world);
    expect(mines(world)).toHaveLength(2);
  });

  it('粘着糸：攻撃が当たった敵を足止めすることがある。罠師：動けない敵へのダメージが上がる', () => {
    const world = createWorld({ waves: [{}], rng: () => 0.01 }); // 確率の判定が必ず通る乱数
    world.waveTimer = Infinity;
    world.player.build.implants.stickyweb = 1;
    recalcStats(world.player);
    const e = addEnemy(world, 'grunt', 60);
    e.hp = e.maxHp = 100000;
    hitEnemy(world, e, 10, 1, 0, 0);
    expect(e.stopT).toBeGreaterThan(0);

    const w2 = makeWorld(['trapper']);
    const e2 = addEnemy(w2, 'grunt', 60);
    expect(statWith(w2, 'attackMul', e2)).toBeCloseTo(1);
    e2.stopT = 1;
    expect(statWith(w2, 'attackMul', e2)).toBeCloseTo(1.3);
  });

  it('設置物は、部屋をクリアすると片づけられる', () => {
    const world = makeWorld(['mine']);
    world.player.inv = Infinity;
    const foe = addEnemy(world, 'drone', 500);
    foe.cd = 99;
    world.waveTimer = 0;
    dash(world);
    expect(mines(world)).toHaveLength(1);
    hitEnemy(world, foe, 9999, 1, 0, 0);
    run(world, 0.5);
    expect(world.mode).toBe('clear');
    expect(world.devices).toHaveLength(0);
  });

  it('恒久強化「補助演算」：スパイダーコアで買え、会心率が1段ごとに 2% 上がる', () => {
    const save = createSave();
    save.materials.spiderCore = 2;
    grantUpgrade(save, 'coproc');
    grantUpgrade(save, 'coproc');
    const world = createWorld({ waves: [{}], rng: () => 0.5, carry: { hp: null, build: createBuild(permanentBonuses(save)) } });
    expect(world.player.stats.critChance).toBeCloseTo(PLAYER.critChance + 0.04);
  });
});

// ===== エリア3：未完の塔（クレーンタイタン、種族「巨人」） =====

describe('未完の塔の定義', () => {
  it('色・背景・敵・ボス・素材・データ片がそろっている。マップ3は3エリア', () => {
    expect(maps[2].areas).toEqual(['yard', 'viaduct', 'spire']);
    const area = DATA.areas.get('spire');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const e of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
    expect(MATERIAL_ICONS[DATA.bosses.get(area.boss).material]).toBeDefined();
    for (const id of maps[2].areas) {
      const frags = DATA.fragments.all().filter((f) => f.area === id);
      expect(frags.filter((f) => f.source === 'vault'), id).toHaveLength(3);
      expect(frags.filter((f) => f.source === 'boss'), id).toHaveLength(1);
    }
    expect(mapSpecies(maps[2]).sort()).toEqual(['hound', 'spider', 'titan']);
  });

  it('3体のボスを順に倒すと、マップ3が完了になる。マップ4が残っているので、2周目はまだ選べない', () => {
    const save = createSave();
    recordMapClear(save, 'map1', 1);
    recordMapClear(save, 'map2', 1);
    const r = createRun({ rng: seeded(7), save, mapId: 'map3' });
    const killBoss = () => {
      skipToBoss(r, enterRoom(r));
      const world = enterRoom(r);
      while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
      world.player.inv = Infinity;
      hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
      handleEvents(r, world);
      return world;
    };
    leaveRoom(r, killBoss(), NEXT_AREA);
    expect(currentArea(r).id).toBe('viaduct');
    leaveRoom(r, killBoss(), NEXT_AREA);
    expect(currentArea(r).id).toBe('spire');
    expect(mapState(save, maps[2])).toBe('open');
    killBoss();
    expect(save.materials.titanCore).toBeGreaterThan(0);
    expect(save.achievements).toEqual(expect.arrayContaining(['scraphound', 'girderspider', 'cranetitan', 'map3']));
    expect(mapState(save, maps[2])).toBe('done');
    expect(save.cycle).toBe(1);
  });
});

describe('クレーンタイタン', () => {
  function titanWorld() {
    const world = createWorld({ waves: [{ boss: 'cranetitan' }], rng: () => 0.5 });
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.boss.idleT = Infinity;
    return world;
  }
  function startSwing(world, name = 'swing') {
    const b = world.boss;
    b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
    PATTERNS.pendulum.start(world, b, b.act, { dx: -1, dy: 0, dist: 1 });
    return b.act;
  }
  const hooks = (world) => world.hazards.filter((h) => h.type === 'hook');

  it('本体は動かない', () => {
    const world = titanWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    const at = { x: b.x, y: b.y };
    b.idleT = 99;
    run(world, 3);
    expect(b.x).toBeCloseTo(at.x);
    expect(b.y).toBeCloseTo(at.y);
  });

  it('振り子：予告の線が出てから、フックがプレイヤーのいた高さを行ったり来たりする。立ち止まっていると当たる', () => {
    const world = titanWorld();
    const p = world.player;
    const act = startSwing(world);
    expect(act.paths).toHaveLength(1);
    expect(act.paths[0].y1).toBeCloseTo(p.y);
    expect(hooks(world)).toHaveLength(0); // 予告の間は、まだ出ない
    expect(p.hp).toBe(PLAYER.maxHp);
    runUntil(world, () => hooks(world).length > 0);
    world.boss.x = 900;
    world.boss.y = 60;
    expect(runUntil(world, () => p.hp < PLAYER.maxHp, 6)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - act.def.damage);
  });

  it('線から離れれば当たらない。決まった回数だけ往復すると、フックは消える', () => {
    const world = titanWorld();
    const p = world.player;
    const act = startSwing(world);
    runUntil(world, () => hooks(world).length > 0);
    world.boss.idleT = Infinity;
    world.boss.x = 900;
    world.boss.y = 60;
    p.y += 120;
    const hook = hooks(world)[0];
    const xs = [];
    for (let t = 0; t < act.def.passes * act.def.period + 0.5; t += DT) {
      world.boss.idleT = Infinity; // フックだけを見る
      updateWorld(world, DT, idle);
      xs.push(hook.x);
    }
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(hooks(world)).toHaveLength(0);
    // 部屋の端から端まで動いた
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(700);
  });

  it('後半は、横と縦の2本になる', () => {
    const world = titanWorld();
    world.player.inv = Infinity;
    const act = startSwing(world, 'swingHard');
    expect(act.paths).toHaveLength(2);
    expect(act.paths[1].x1).toBeCloseTo(world.player.x);
    runUntil(world, () => hooks(world).length > 0);
    expect(hooks(world)).toHaveLength(2);
  });
});

describe('種族「巨人」', () => {
  const dummy = (world) => {
    const e = addEnemy(world, 'grunt', 60);
    e.hp = e.maxHp = 100000;
    return e;
  };
  const damage = (world, e, options) => {
    const before = e.hp;
    hitEnemy(world, e, 100, 1, 0, 0, options);
    return before - e.hp;
  };

  it('剛腕：重い攻撃だけ、威力が上がる', () => {
    const world = makeWorld(['heavyhand']);
    const e = dummy(world);
    expect(damage(world, e)).toBe(100);
    expect(damage(world, e, { heavy: true })).toBe(125);
    const plain = makeWorld();
    expect(damage(plain, dummy(plain), { heavy: true })).toBe(100);
  });

  it('大剣の3段目（締めの一撃）と溜め斬りは、重い攻撃として数えられる', () => {
    const world = makeWorld(['heavyhand']);
    const combo = world.player.weapon.combo;
    expect(combo.at(-1).heavy).toBe(true);
    expect(combo[0].heavy).toBeFalsy();
  });

  it('初撃：HPが満タンの敵へのダメージが上がる。重圧：エリートとボスへのダメージが上がる', () => {
    const world = makeWorld(['firstblow']);
    const e = addEnemy(world, 'grunt', 60);
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.4);
    e.hp -= 1;
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1);

    const w2 = makeWorld(['pressure']);
    const normal = addEnemy(w2, 'grunt', 60);
    expect(statWith(w2, 'attackMul', normal)).toBeCloseTo(1);
    expect(statWith(w2, 'attackMul', { ...normal, elite: {} })).toBeCloseTo(1.15);
    expect(statWith(w2, 'attackMul', { ...normal, boss: true })).toBeCloseTo(1.15);
  });

  it('震動：敵を吹き飛ばす力が上がる。長腕：近接範囲が広がる', () => {
    const push = (ids) => {
      const world = makeWorld(ids);
      const e = addEnemy(world, 'drone', 60);
      e.hp = e.maxHp = 100000;
      hitEnemy(world, e, 1, 1, 0, 400);
      return e.vx;
    };
    expect(push(['tremor'])).toBeCloseTo(push([]) * 1.5);
    expect(makeWorld(['longarm']).player.stats.meleeRange).toBeCloseTo(1.12);
  });

  it('種族ボーナス：2種類で近接範囲 +15%。3種類で、重い攻撃ならエリートもひるむ', () => {
    expect(makeWorld(['heavyhand', 'tremor']).player.stats.meleeRange).toBeCloseTo(1.15);
    const world = makeWorld(['heavyhand', 'tremor', 'pressure']);
    const elite = dummy(world);
    elite.noStagger = true;
    elite.stagger = 0;
    hitEnemy(world, elite, 1, 1, 0, 0);
    expect(elite.stagger).toBeLessThanOrEqual(0); // ふつうの攻撃では、ひるまない
    hitEnemy(world, elite, 1, 1, 0, 0, { heavy: true });
    expect(elite.stagger).toBeGreaterThan(0);

    const two = makeWorld(['heavyhand', 'tremor']);
    const e2 = dummy(two);
    e2.noStagger = true;
    e2.stagger = 0;
    hitEnemy(two, e2, 1, 1, 0, 0, { heavy: true });
    expect(e2.stagger).toBeLessThanOrEqual(0);
  });

  it('恒久強化「基礎補強」：タイタンコアで買え、最大HPが1段ごとに 20 増える', () => {
    const save = createSave();
    save.materials.titanCore = 2;
    grantUpgrade(save, 'foundation');
    grantUpgrade(save, 'foundation');
    const world = createWorld({ waves: [{}], rng: () => 0.5, carry: { hp: null, build: createBuild(permanentBonuses(save)) } });
    expect(world.player.stats.maxHp).toBe(PLAYER.maxHp + 40);
  });
});
