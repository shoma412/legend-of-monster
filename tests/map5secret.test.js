import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { rainHit, startRain } from '../src/game/acidRain.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { NEXT_AREA, SECRET_IN, SECRET_OUT, createRun, enterRoom, handleEvents, leaveRoom } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { restoreRun, snapshotRun } from '../src/logic/suspend.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ5の隠しボス「カタリスト」と、その出し方（docs/詳細仕様.md「28. マップ5」の ④）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('acidrain');
const def = DATA.bosses.get('catalyst');

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function newRun(seed = 5) {
  const save = createSave();
  for (const id of ['map1', 'map2', 'map3', 'map4']) recordMapClear(save, id, 1);
  save.passes.push('map3', 'map4');
  return { save, run: createRun({ rng: seeded(seed), save, mapId: 'map5', weaponId: 'sword' }) };
}

// 今の部屋から、ボス前の補給部屋まで進む（雨には当たらない）
function walkToRest(run) {
  let world = enterRoom(run);
  let guard = 0;
  while (run.plan.current !== 'rest' && guard++ < 40) {
    leaveRoom(run, world, world.room.doors[0].id);
    world = enterRoom(run);
  }
  return world;
}

const secretDoor = (world) => world.room.objects.find((o) => o.kind === 'secretDoor');

function bossWorld(implants = []) {
  const room = { type: 'secretBoss', waves: [{ boss: 'catalyst' }], objects: [], doors: [], clearCredits: 0, environment: env, roofs: [] };
  const world = createWorld({ room, rng: seeded(3), weaponId: 'sword' });
  for (const id of implants) world.player.build.implants[id] = 1;
  recalcStats(world.player);
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.boss.x = 700;
  world.boss.y = 300;
  world.player.x = 300;
  world.player.y = 300;
  world.player.inv = Infinity;
  world.rain = { phase: 'clear', t: 9999, max: 9999, acc: 0, hits: 0 };
  return world;
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

function cast(world, move) {
  const b = world.boss;
  b.next = move;
  b.idleT = 0;
  updateWorld(world, DT, idle);
  b.idleT = Infinity;
}

describe('隠しボスの出し方（マップ5）：雨のダメージを、1回も受けない', () => {
  it('マップ5は「雨に当たらない」決まり。ひび割れた壁は出ない', () => {
    expect(maps[4].secretBoss).toMatchObject({ boss: 'catalyst', rule: 'rain' });
    const { run: r } = newRun();
    expect(r.secret).toMatchObject({ boss: 'catalyst', rule: 'rain', dryOk: true, done: false });
    let world = enterRoom(r);
    for (let i = 0; i < 30 && r.plan.current !== 'boss'; i++) {
      expect(world.room.secret).toBeUndefined();
      leaveRoom(r, world, world.room.doors[0].id);
      world = enterRoom(r);
    }
  });

  it('雨に当たらずに補給部屋に着くと、道が開いている', () => {
    const { run: r } = newRun();
    const world = walkToRest(r);
    expect(world.room.secretOpen).toBe(true);
    expect(secretDoor(world)).toMatchObject({ target: SECRET_IN });
  });

  it('1回でも雨に当たると、そのエリアでは道が開かない', () => {
    const { run: r } = newRun();
    const world = enterRoom(r);
    world.countdown = 0;
    world.player.inv = Infinity; // 敵の攻撃は受けない（雨は、無敵でも当たる）
    world.player.x = world.bounds.left + 20;
    world.player.y = world.bounds.bottom - 20;
    startRain(world, 3);
    for (let t = 0; t < 1.5; t += DT) updateWorld(world, DT, idle);
    expect(world.rainHits).toBeGreaterThan(0);
    leaveRoom(r, world, world.room.doors[0].id);
    expect(r.secret.dryOk).toBe(false);
    expect(secretDoor(walkToRest(r))).toBeUndefined();
  });

  it('敵の攻撃で受けたダメージは、数えない', () => {
    const { run: r } = newRun();
    const world = enterRoom(r);
    world.damageTaken = 50;
    leaveRoom(r, world, world.room.doors[0].id);
    expect(r.secret.dryOk).toBe(true);
  });

  it('インプラント「雨具」を持っていれば、雨の中にいても、当たったことにならない', () => {
    const { run: r } = newRun();
    r.build.implants.raincoat = 1;
    const world = enterRoom(r);
    world.countdown = 0;
    world.player.inv = Infinity;
    startRain(world, 3);
    for (let t = 0; t < 2; t += DT) updateWorld(world, DT, idle);
    rainHit(world);
    expect(world.rainHits).toBe(0);
    leaveRoom(r, world, world.room.doors[0].id);
    expect(r.secret.dryOk).toBe(true);
  });

  it('判定はエリアごと。次のエリアに入ると、やり直しになる', () => {
    const { run: r } = newRun();
    const world = enterRoom(r);
    world.rainHits = 2;
    leaveRoom(r, world, world.room.doors[0].id);
    expect(r.secret.dryOk).toBe(false);
    r.plan.current = 'boss';
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    expect(r.secret.dryOk).toBe(true);
    expect(secretDoor(walkToRest(r))).toBeDefined();
  });

  it('道に入ると、カタリストと戦う。倒すと溶解区の通行証・実績・カタリストコア。戻ったあとは、もう開かない', () => {
    const { run: r, save } = newRun();
    let world = walkToRest(r);
    leaveRoom(r, world, SECRET_IN);
    world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('catalyst');
    // 隠しボスの部屋で雨に当たっても、条件には関係しない
    world.rainHits = 5;
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.passes).toContain('map5');
    expect(save.achievements).toContain('catalyst');
    expect(save.materials.catalystCore).toBe(1);
    leaveRoom(r, world, SECRET_OUT);
    world = enterRoom(r);
    expect(r.secret.done).toBe(true);
    expect(secretDoor(world)).toBeUndefined();
  });

  it('中断：雨に当たった部屋で中断すると、道は開かない。当たっていなければ、再開しても条件は残る', () => {
    for (const wet of [false, true]) {
      const { run: r, save } = newRun();
      const world = enterRoom(r);
      if (wet) world.rainHits = 1;
      const again = restoreRun(snapshotRun(r, world), save, seeded(9));
      expect(again.secret.dryOk).toBe(!wet);
    }
  });

  it('マップ4の「非常灯」の決まりは、今までどおり', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3']) recordMapClear(save, id, 1);
    save.passes.push('map3');
    const r = createRun({ rng: seeded(5), save, mapId: 'map4' });
    expect(r.secret).toMatchObject({ rule: 'lamps', lampsOk: true });
    const world = enterRoom(r);
    leaveRoom(r, world, world.room.doors[0].id);
    expect(r.secret.lampsOk).toBe(false);
  });
});

describe('隠しボス「カタリスト」', () => {
  it('隠しボスで、マップ5でいちばん強い。弱点はない。専用の曲と素材がある。3段階', () => {
    expect(def.hidden).toBe(true);
    expect(def.weakness).toBeNull();
    expect(def.material).toBe('catalystCore');
    expect(MATERIAL_ICONS.catalystCore).toBeDefined();
    for (const id of ['rusteater', 'buffertank', 'rainmaker']) expect(def.hp).toBeGreaterThan(DATA.bosses.get(id).hp);
    expect(BGM[def.bgm]).toBeDefined();
    expect(def.phases).toHaveLength(3);
    expect(def.drops.minRarity).toBe(2);
  });

  it('そのボスだけの攻撃（反応・奪取・軌跡）を持ち、前半から使う', () => {
    for (const pattern of ['reflect', 'seize', 'streak']) {
      expect(PATTERNS[pattern]).toBeDefined();
      expect(def.phases[0].moves.some((m) => def.attacks[m].pattern === pattern), pattern).toBe(true);
      for (const other of DATA.bosses.all()) {
        if (other.id !== 'catalyst') expect(Object.values(other.attacks).some((a) => a.pattern === pattern), other.id).toBe(false);
      }
    }
  });

  it('反応：こちらの属性を写し取る。弾に、その効き目が乗る（熱：炎上、冷却：減速）', () => {
    const world = bossWorld(['incendiary', 'coolant']);
    cast(world, 'reflect');
    expect([...world.boss.copied].sort()).toEqual(['cold', 'heat']);
    expect(runUntil(world, () => world.shots.length > 0, 3)).toBe(true);
    expect(world.shots.every((s) => s.slow)).toBe(true);
    expect(world.shots.every((s) => s.dots.includes('burn'))).toBe(true);
    // 当たると、炎上が付く
    const p = world.player;
    p.inv = 0;
    const s = world.shots[0];
    s.x = p.x;
    s.y = p.y;
    updateWorld(world, DT, idle);
    expect(p.dot?.id).toBe('burn');
  });

  it('反応：属性を1つも持っていない相手には、効き目は乗らない。かわりに、ダメージが 1.25倍', () => {
    const none = bossWorld();
    cast(none, 'reflect');
    expect(none.boss.copied).toEqual([]);
    runUntil(none, () => none.shots.length > 0, 3);
    expect(none.shots[0].slow).toBe(false);
    expect(none.shots[0].dots).toEqual([]);
    expect(none.shots[0].damage).toBeCloseTo(def.attacks.reflect.damage * def.attacks.reflect.plainBonus);

    const some = bossWorld(['voltedge']);
    cast(some, 'reflect');
    runUntil(some, () => some.shots.length > 0, 3);
    expect(some.shots[0].damage).toBeCloseTo(def.attacks.reflect.damage);
    // 電撃を写し取ると、弾が速い
    const speed = (s) => Math.hypot(s.vx, s.vy);
    expect(speed(some.shots[0]) / speed(none.shots[0])).toBeCloseTo(def.attacks.reflect.shockSpeed);
  });

  it('奪取：円の中にいると、10秒のあいだ属性を奪われる。切れると、元に戻る', () => {
    const world = bossWorld(['incendiary']);
    const p = world.player;
    p.x = world.boss.x - 150;
    p.inv = 0;
    expect(p.stats.elements).toEqual(['heat']);
    cast(world, 'seize');
    const hp = p.hp;
    expect(runUntil(world, () => p.sealT > 0, 3)).toBe(true);
    expect(p.hp).toBeLessThan(hp);
    expect(p.stats.elements).toEqual([]);
    // 奪われている間に、ボスが写し取り直しても、元の属性を覚えている
    p.inv = Infinity;
    cast(world, 'reflect');
    expect(world.boss.copied).toEqual(['heat']);
    // 途中でインプラントを足しても、奪われている間は属性が付かない
    p.build.implants.coolant = 1;
    recalcStats(p);
    expect(p.stats.elements).toEqual([]);
    run(world, def.attacks.seize.seal + 0.3);
    expect(p.sealT > 0).toBe(false);
    expect([...p.stats.elements].sort()).toEqual(['cold', 'heat']);
  });

  it('奪取：円の外にいれば、当たらない。属性を持っていなければ、ダメージだけ', () => {
    const far = bossWorld(['incendiary']);
    far.player.inv = 0;
    cast(far, 'seize');
    runUntil(far, () => far.boss.act?.phase === 'recover', 3);
    expect(far.player.sealT > 0).toBe(false);
    expect(far.player.hp).toBe(far.player.stats.maxHp);

    const none = bossWorld();
    none.player.x = none.boss.x - 150;
    none.player.inv = 0;
    cast(none, 'seize');
    runUntil(none, () => none.boss.act?.phase === 'recover', 3);
    expect(none.player.hp).toBeLessThan(none.player.stats.maxHp);
    expect(none.player.sealT > 0).toBe(false);
  });

  it('軌跡：突進の通ったあとに、写し取った属性の床が残る。属性がなければ、残らない', () => {
    const world = bossWorld(['acid']);
    world.player.y = 480; // 線から外れておく
    cast(world, 'streak');
    world.player.y = 300;
    expect(runUntil(world, () => world.boss.act?.phase === 'stun' || world.boss.act?.phase === 'recover', 4)).toBe(true);
    const pools = world.hazards.filter((h) => h.type === 'pool');
    expect(pools.length).toBeGreaterThanOrEqual(3);
    expect(pools.every((h) => h.dot === 'corrode')).toBe(true);

    const none = bossWorld();
    cast(none, 'streak');
    runUntil(none, () => none.boss.act?.phase === 'stun' || none.boss.act?.phase === 'recover', 4);
    expect(none.hazards.filter((h) => h.type === 'pool' || h.type === 'mark')).toHaveLength(0);
  });

  it('大技「連鎖反応」：写し取ったものに関係なく、4つの属性すべてが乗った弾を、全方向に撃つ', () => {
    const world = bossWorld();
    cast(world, 'chainreaction');
    expect([...world.boss.copied].sort()).toEqual(['cold', 'corrode', 'heat', 'shock']);
    expect(runUntil(world, () => world.shots.length >= def.attacks.chainreaction.count, 4)).toBe(true);
    const s = world.shots[0];
    expect(s.slow).toBe(true);
    expect([...s.dots].sort()).toEqual(['burn', 'corrode']);
  });
});
