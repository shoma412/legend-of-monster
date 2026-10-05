import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
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
import { createRun, enterRoom, handleEvents, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { mapState, recordMapClear } from '../src/logic/maps.js';
import { buyUpgrade, permanentBonuses } from '../src/logic/meta.js';
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
    expect(buyUpgrade(save, 'legs')).toBe(true);
    expect(buyUpgrade(save, 'legs')).toBe(true);
    const world = createWorld({ waves: [{}], rng: () => 0.5, carry: { hp: null, build: createBuild(permanentBonuses(save)) } });
    expect(world.player.stats.moveSpeedMul).toBeCloseTo(1.06);
  });
});
