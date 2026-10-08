import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { isFacing, isVisible, lightSources, litByLamp } from '../src/game/darkness.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, enterRoom, handleEvents } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { brightness, lightReach } from '../src/logic/darkCells.js';
import { recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ4 エリア2「地下変電所」（docs/詳細仕様.md「24. マップ4」の ②）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('dark');

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function darkWorld({ lamps = [], waves = [{}], implants = [], dark = true } = {}) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment: dark ? env : null, lamps };
  const world = createWorld({ room, rng: () => 0.5, weaponId: 'sword' });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  return world;
}

function addEnemy(world, id, x, y) {
  const e = createEnemy(DATA.enemies.get(id), x, y, 0, world.rng);
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

// プレイヤーの向き（マウスの向き）を決める
function face(world, x, y) {
  const p = world.player;
  const d = Math.hypot(x - p.x, y - p.y) || 1;
  p.fx = (x - p.x) / d;
  p.fy = (y - p.y) / d;
}

function bossWorld() {
  const world = darkWorld({ lamps: [{ x: 300, y: 300 }], waves: [{ boss: 'sentinel' }] });
  world.waveTimer = 0;
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.player.inv = 0;
  return world;
}

describe('マップ4 エリア2「地下変電所」の定義', () => {
  it('色・背景・敵・ボス・素材・データ片・種族・曲がそろっている', () => {
    const map = maps[3];
    expect(map.areas).toEqual(['darkstreet', 'substation']);
    const area = DATA.areas.get('substation');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const id of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(id), id).toBe(true);
    const boss = DATA.bosses.get(area.boss);
    expect(boss.id).toBe('sentinel');
    expect(boss.weakness).toBe('shock');
    expect(boss.material).toBe('lensCore');
    expect(MATERIAL_ICONS.lensCore).toBeDefined();
    const frags = DATA.fragments.all().filter((f) => f.area === 'substation');
    expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(mapSpecies(map)).toEqual(expect.arrayContaining(['moth', 'sentinel']));
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
  });

  it('消灯街のボスを倒すと、地下変電所へ進める。センチネルを倒すと、レンズコアと実績が手に入る', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3']) recordMapClear(save, id, 1);
    save.passes.push('map3');
    const r = createRun({ rng: seeded(7), save, mapId: 'map4', weaponId: 'sword' });
    expect(r.map.areas.length).toBe(2);
    r.areaIndex = 1;
    r.area = DATA.areas.get('substation');
    r.plan.current = 'boss';
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('sentinel');
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.materials.lensCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('sentinel');
  });
});

describe('暗闇：扇形の灯り', () => {
  const cone = { x: 100, y: 100, r: 300, angle: 0, arc: Math.PI / 3 };

  it('扇の中は明るく、扇の外と、届かない場所は暗い', () => {
    expect(lightReach(cone, 250, 100)).toBeCloseTo(0.5);
    expect(lightReach(cone, 100, 250)).toBe(1);
    expect(lightReach(cone, 450, 100)).toBeGreaterThan(1);
    expect(brightness(200, 110, [cone], 0.2)).toBe(1);
    expect(brightness(100, 250, [cone], 0.2)).toBe(0);
    // 真後ろ（角度が ±180度をまたぐ）でも、正しく外になる
    expect(lightReach({ ...cone, angle: Math.PI }, 0, 100)).toBeLessThan(1);
    expect(lightReach({ ...cone, angle: Math.PI }, 200, 100)).toBe(1);
  });

  it('プレイヤーの向き：正面にあるものは「向いている」、背中側は「向いていない」', () => {
    const world = darkWorld();
    const p = world.player;
    face(world, p.x + 100, p.y);
    expect(isFacing(world, p.x + 200, p.y + 20, 70)).toBe(true);
    expect(isFacing(world, p.x - 200, p.y, 70)).toBe(false);
    expect(isFacing(world, p.x, p.y + 200, 70)).toBe(false);
  });
});

describe('雑魚：見張り灯', () => {
  const setup = () => {
    const world = darkWorld();
    const p = world.player;
    const e = addEnemy(world, 'watchlamp', p.x + 200, p.y);
    const def = e.def.cone;
    return { world, p, e, def };
  };

  it('動かない。光の扇が回り、扇の中は明るい（忍び寄りは、扇の中では動けない）', () => {
    const { world, p, e } = setup();
    e.def = { ...e.def, cone: { ...e.def.cone, spin: 0 } };
    run(world, 0.1);
    e.coneAngle = Math.PI / 2; // 下向き。プレイヤーは左にいるので、扇の外
    const x0 = e.x;
    run(world, 0.5);
    expect(e.x).toBe(x0);
    expect(litByLamp(world, e.x, e.y + 150)).toBe(true);
    expect(isVisible(world, e.x + 60, e.y + 320)).toBe(true);
    expect(litByLamp(world, e.x, e.y - 150)).toBe(false);
    const s = addEnemy(world, 'stalker', e.x, e.y + 150);
    const before = { x: s.x, y: s.y };
    run(world, 0.5);
    expect(s.x).toBe(before.x);
    expect(p.hp).toBe(p.stats.maxHp);
  });

  it('扇の中に1秒いると、照準線を出して狙い撃つ。扇の外にいれば、撃たれない', () => {
    const { world, p, e, def } = setup();
    e.def = { ...e.def, cone: { ...def, spin: 0 } };
    run(world, 0.05);
    e.coneAngle = Math.PI; // プレイヤーのほう
    run(world, def.need * 0.5);
    expect(e.state).toBe('chase');
    expect(e.lock).toBeGreaterThan(0);
    expect(runUntil(world, () => e.state === 'aim', 2)).toBe(true);
    expect(runUntil(world, () => p.hp < p.stats.maxHp, 2)).toBe(true);

    const other = setup();
    other.e.def = { ...other.e.def, cone: { ...def, spin: 0 } };
    run(other.world, 0.05);
    other.e.coneAngle = 0; // 反対向き
    run(other.world, 4);
    expect(other.e.state).toBe('chase');
    expect(other.p.hp).toBe(other.p.stats.maxHp);
  });

  it('扇から出ると、たまった時間は少しずつ減る', () => {
    const { world, e, def } = setup();
    e.def = { ...e.def, cone: { ...def, spin: 0 } };
    run(world, 0.05);
    e.coneAngle = Math.PI;
    run(world, 0.6);
    const lock = e.lock;
    e.coneAngle = 0;
    run(world, 0.4);
    expect(e.lock).toBeLessThan(lock);
    expect(e.lock).toBeGreaterThan(0);
  });
});

describe('雑魚：閃光持ち', () => {
  const setup = () => {
    const world = darkWorld();
    const p = world.player;
    const e = addEnemy(world, 'flasher', p.x + 120, p.y);
    return { world, p, e };
  };

  it('予告のあとに光る。そのとき敵のほうを向いていると、目くらみ', () => {
    const { world, p, e } = setup();
    face(world, e.x, e.y);
    expect(runUntil(world, () => e.state === 'windup', 1)).toBe(true);
    face(world, e.x, e.y);
    expect(runUntil(world, () => p.blindT > 0, 2)).toBe(true);
    expect(p.blindT).toBeCloseTo(e.def.flash.blind, 0);
    expect(p.hp).toBe(p.stats.maxHp);
  });

  it('背を向けていれば、何も起きない', () => {
    const { world, p, e } = setup();
    expect(runUntil(world, () => e.state === 'windup', 1)).toBe(true);
    face(world, p.x - 100, p.y);
    expect(runUntil(world, () => e.state === 'chase', 2)).toBe(true);
    expect(p.blindT > 0).toBe(false);
  });

  it('光の届かない距離なら、向いていても目くらみにならない', () => {
    const { world, p, e } = setup();
    expect(runUntil(world, () => e.state === 'windup', 1)).toBe(true);
    e.x = p.x + e.def.flash.radius + 80;
    face(world, e.x, e.y);
    expect(runUntil(world, () => e.state === 'chase', 2)).toBe(true);
    expect(p.blindT > 0).toBe(false);
  });
});

describe('ボス「サーチライト・センチネル」', () => {
  it('そのボスだけの攻撃（照射・閃光）を持ち、前半から使う。大技も、そのボスだけの部品', () => {
    const def = DATA.bosses.get('sentinel');
    for (const pattern of ['searchlight', 'flare']) {
      expect(PATTERNS[pattern]).toBeDefined();
      expect(def.phases[0].moves.some((m) => def.attacks[m].pattern === pattern), pattern).toBe(true);
      for (const other of DATA.bosses.all()) {
        if (other.id !== 'sentinel') expect(Object.values(other.attacks).some((a) => a.pattern === pattern), other.id).toBe(false);
      }
    }
    expect(def.attacks[def.ultimate.move].pattern).toBe('searchlight');
    expect(def.attacks.beamHard.count).toBe(2);
    expect(def.attacks.flareHard.count).toBe(2);
  });

  const beam = (world) => world.hazards.find((h) => h.type === 'searchlight');

  it('照射：光の扇が出て、回る。出た瞬間は、プレイヤーは扇の外にいる。扇そのものにダメージはない', () => {
    const world = bossWorld();
    const p = world.player;
    world.boss.next = 'beam';
    world.boss.idleT = 0;
    expect(runUntil(world, () => !!beam(world), 3)).toBe(true);
    world.boss.idleT = Infinity;
    const h = beam(world);
    expect(h.inBeam).toBeFalsy();
    const a0 = h.angle;
    run(world, 0.5);
    expect(h.angle).not.toBe(a0);
    // 扇の中は明るい
    const far = { x: h.x + Math.cos(h.angle) * 300, y: h.y + Math.sin(h.angle) * 300 };
    expect(lightSources(world).some((l) => l.arc != null)).toBe(true);
    expect(litByLamp(world, far.x, far.y)).toBe(true);
    expect(p.hp).toBe(p.stats.maxHp);
  });

  it('照射：扇の中に0.8秒いると捕捉され、照準線のあとに狙撃が来る', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    world.boss.next = 'beam';
    world.boss.idleT = 0;
    runUntil(world, () => !!beam(world), 3);
    b.idleT = Infinity;
    const h = beam(world);
    h.spin = 0;
    h.angle = Math.atan2(p.y - b.y, p.x - b.x);
    run(world, 0.5);
    expect(h.lock).toBeGreaterThan(0.3);
    expect(world.hazards.some((x) => x.type === 'snipe')).toBe(false);
    expect(runUntil(world, () => world.hazards.some((x) => x.type === 'snipe'), 1)).toBe(true);
    expect(p.hp).toBe(p.stats.maxHp);
    expect(runUntil(world, () => p.hp < p.stats.maxHp, 2)).toBe(true);
  });

  it('照射：点いている非常灯のそばにいても、捕捉が進む。暗がりにいれば、進まない', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    b.x = 800;
    b.y = 300;
    world.boss.next = 'beam';
    world.boss.idleT = 0;
    runUntil(world, () => !!beam(world), 3);
    b.idleT = Infinity;
    const h = beam(world);
    h.spin = 0;
    p.x = 480;
    p.y = 480;
    h.angle = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI; // 扇は反対向き
    h.lock = 0;
    run(world, 0.5);
    expect(h.lock).toBe(0);
    // 非常灯のそばへ
    p.x = 300;
    p.y = 330;
    h.angle = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI;
    run(world, 0.5);
    expect(world.lamps[0].on).toBeGreaterThan(0);
    expect(h.lock).toBeGreaterThan(0.3);
  });

  it('閃光：ボスのほうを向いていると、長い目くらみ。背けていれば無効。どちらでも、部屋が明るくなる', () => {
    for (const looking of [true, false]) {
      const world = bossWorld();
      const p = world.player;
      const b = world.boss;
      b.next = 'flare';
      b.idleT = 0;
      runUntil(world, () => b.act?.def.pattern === 'flare', 1);
      b.idleT = Infinity;
      const lights = () => world.lights.length;
      const before = lights();
      for (let t = 0; t < 3 && lights() === before; t += DT) {
        if (looking) face(world, b.x, b.y);
        else face(world, p.x * 2 - b.x, p.y * 2 - b.y);
        updateWorld(world, DT, idle);
      }
      expect(lights()).toBeGreaterThan(before);
      if (looking) expect(p.blindT).toBeGreaterThan(env.blind.duration);
      else expect(p.blindT > 0).toBe(false);
      expect(isVisible(world, b.x, b.y)).toBe(true);
      expect(p.hp).toBe(p.stats.maxHp);
    }
  });

  it('大技「全照射」：扇が4本。出た瞬間は隙間にいる。扇に触れるとダメージ', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    b.next = 'fullbeam';
    b.idleT = 0;
    runUntil(world, () => !!beam(world), 4);
    const h = beam(world);
    expect(h.count).toBe(4);
    expect(h.touch).toBeGreaterThan(0);
    h.spin = 0;
    run(world, 0.3);
    expect(p.hp).toBe(p.stats.maxHp);
    h.angle = Math.atan2(p.y - b.y, p.x - b.x);
    run(world, 0.2);
    expect(p.hp).toBeLessThan(p.stats.maxHp);
    p.inv = Infinity;
    // 終わると、扇は消える
    expect(runUntil(world, () => !beam(world), 15)).toBe(true);
  });

  it('ボスを倒すと、光の扇も消える', () => {
    const world = bossWorld();
    const b = world.boss;
    b.next = 'beam';
    b.idleT = 0;
    runUntil(world, () => !!beam(world), 3);
    world.player.inv = Infinity;
    hitEnemy(world, b, 99999999, 1, 0, 0, { unblockable: true });
    // 倒したときのレベルアップの選択は、閉じて進める
    for (let t = 0; t < 1.5; t += DT) {
      world.choice = null;
      world.pendingLevelUps = 0;
      updateWorld(world, DT, idle);
    }
    expect(beam(world)).toBeUndefined();
  });
});

describe('種族「番兵」', () => {
  it('部品は5つ。ボーナスは2種類と3種類', () => {
    expect(DATA.implants.all().filter((d) => d.species === 'sentinel')).toHaveLength(5);
  });

  it('照準灯：攻撃を当てた敵を4秒照らす。暗闇でも見え、その敵へのダメージが上がる。忍び寄りは止まる', () => {
    const world = darkWorld({ implants: ['spotlight'] });
    const p = world.player;
    const e = addEnemy(world, 'stalker', p.x + 500, p.y);
    e.hp = e.maxHp = 100000;
    expect(isVisible(world, e.x, e.y)).toBe(false);
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1);
    hitEnemy(world, e, 10, 1, 0, 0);
    expect(e.litT).toBeCloseTo(4);
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.08);
    run(world, 0.6); // 攻撃の光が消えたあとも、照らされている
    expect(isVisible(world, e.x, e.y)).toBe(true);
    const x = e.x;
    run(world, 0.5);
    expect(e.x).toBe(x);
    run(world, 4);
    expect(e.litT > 0).toBe(false);
    expect(e.x).toBeLessThan(x);
  });

  it('見張り：立ち止まっている間、攻撃力が上がる。迎撃：近くの敵へのダメージが上がる', () => {
    const world = darkWorld({ implants: ['lookout'] });
    run(world, 0.5);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.15);
    run(world, 0.2, { ...idle, mx: 1 });
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);

    const w2 = darkWorld({ implants: ['intercept'] });
    const p = w2.player;
    const near = addEnemy(w2, 'grunt', p.x + 100, p.y);
    const far = addEnemy(w2, 'grunt', p.x + 300, p.y);
    expect(statWith(w2, 'attackMul', near)).toBeCloseTo(1.15);
    expect(statWith(w2, 'attackMul', far)).toBeCloseTo(1);
  });

  it('閃光弾：ダッシュすると、まわりの敵が止まる。6秒に1回。ボスには効かない', () => {
    const world = darkWorld({ implants: ['flashbang'] });
    const p = world.player;
    const near = addEnemy(world, 'grunt', p.x + 80, p.y + 40);
    const far = addEnemy(world, 'grunt', p.x + 500, p.y);
    near.cd = far.cd = 99;
    run(world, 0.05, { ...idle, mx: -1, dashPressed: true });
    run(world, 0.1, { ...idle, mx: -1 });
    expect(near.stopT).toBeGreaterThan(0);
    expect(far.stopT > 0).toBe(false);
    // 続けてダッシュしても、6秒たつまでは出ない
    run(world, 2);
    near.stopT = 0;
    near.x = p.x + 60;
    near.y = p.y;
    p.dashCharge = p.stats.dashCharges;
    p.dashRecharge = 0;
    run(world, 0.05, { ...idle, mx: -1, dashPressed: true });
    run(world, 0.1, { ...idle, mx: -1 });
    expect(near.stopT > 0).toBe(false);
  });

  it('警戒：HPが満タンのとき、被ダメージが減る', () => {
    const world = darkWorld({ implants: ['vigil'] });
    const p = world.player;
    expect(statWith(world, 'damageTaken')).toBeCloseTo(0.75);
    p.hp -= 10;
    expect(statWith(world, 'damageTaken')).toBeCloseTo(1);
  });

  it('種族ボーナス：2種類で、照準灯がなくても2秒照らす（あれば6秒）。3種類で、見えている敵が遅くなる（ボスには効かない）', () => {
    const two = darkWorld({ implants: ['lookout', 'intercept'] });
    expect(two.player.stats.markTime).toBe(2);
    const withSpot = darkWorld({ implants: ['spotlight', 'lookout'] });
    expect(withSpot.player.stats.markTime).toBe(6);

    const walk = (implants) => {
      const world = darkWorld({ implants });
      const p = world.player;
      const e = addEnemy(world, 'glowbug', p.x + 150, p.y);
      e.def = { ...e.def, wobble: 0 };
      const x = e.x;
      run(world, 0.5);
      return x - e.x;
    };
    expect(walk(['lookout', 'intercept', 'vigil']) / walk([])).toBeCloseTo(0.8, 1);
  });

  it('明るいマップでも、照準灯のダメージ上昇は効く', () => {
    const world = darkWorld({ implants: ['spotlight'], dark: false });
    const e = addEnemy(world, 'grunt', world.player.x + 300, world.player.y);
    e.hp = e.maxHp = 100000;
    hitEnemy(world, e, 10, 1, 0, 0);
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.08);
  });
});
