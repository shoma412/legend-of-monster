import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { hitEnemy } from '../src/game/combat.js';
import { allLampsLit, lightAllLamps } from '../src/game/darkness.js';
import { NEXT_AREA, SECRET_IN, SECRET_OUT, createRun, enterRoom, handleEvents, leaveRoom } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { mapState, recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { restoreRun, snapshotRun } from '../src/logic/suspend.js';

// マップ4の隠しボス「ノクターン」と、その出し方（docs/詳細仕様.md「24. マップ4」の「隠しボスの出し方」）

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

function newRun(seed = 5) {
  const save = createSave();
  for (const id of ['map1', 'map2', 'map3']) recordMapClear(save, id, 1);
  save.passes.push('map3');
  return { save, run: createRun({ rng: seeded(seed), save, mapId: 'map4', weaponId: 'sword' }) };
}

// 今の部屋から、ボス前の補給部屋まで進む。light が true なら、どの部屋でも非常灯を全部点けてから出る
function walkToRest(run, light) {
  let world = enterRoom(run);
  let guard = 0;
  while (run.plan.current !== 'rest' && guard++ < 40) {
    if (light) lightAllLamps(world);
    const next = world.room.doors[0].id;
    leaveRoom(run, world, next);
    world = enterRoom(run);
  }
  return world;
}

const secretDoor = (world) => world.room.objects.find((o) => o.kind === 'secretDoor');

function bossWorld() {
  const room = { type: 'secretBoss', waves: [{ boss: 'nocturne' }], objects: [], doors: [], clearCredits: 0, environment: env, lamps: [] };
  const world = createWorld({ room, rng: seeded(3), weaponId: 'sword' });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.player.inv = Infinity;
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 12, input = idle) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, input);
  }
  return false;
}

describe('隠しボスの出し方（マップ4）：通ってきた部屋の非常灯を、すべて点ける', () => {
  it('マップ4は「灯りを点けて回る」決まり。ひび割れた壁は出ない。マップ3は、今までどおり', () => {
    expect(maps[3].secretBoss).toMatchObject({ boss: 'nocturne', rule: 'lamps' });
    const { run: r } = newRun();
    expect(r.secret).toMatchObject({ boss: 'nocturne', rule: 'lamps', lampsOk: true, done: false });
    let world = enterRoom(r);
    for (let i = 0; i < 30 && r.plan.current !== 'boss'; i++) {
      expect(world.room.secret).toBeUndefined();
      lightAllLamps(world);
      leaveRoom(r, world, world.room.doors[0].id);
      world = enterRoom(r);
    }
    const save = createSave();
    recordMapClear(save, 'map1', 1);
    recordMapClear(save, 'map2', 1);
    const r3 = createRun({ rng: seeded(5), save, mapId: 'map3' });
    expect(r3.secret.rule).toBeUndefined();
    expect(Number.isInteger(r3.secret.areaIndex)).toBe(true);
  });

  it('全部点けて補給部屋に着くと、隠しエリアへの道が開いている', () => {
    const { run: r } = newRun();
    const world = walkToRest(r, true);
    expect(r.plan.current).toBe('rest');
    expect(world.room.secretOpen).toBe(true);
    expect(secretDoor(world)).toMatchObject({ target: SECRET_IN });
  });

  it('1つでも点けずに部屋を出ると、そのエリアでは道が開かない', () => {
    const { run: r } = newRun();
    let world = enterRoom(r);
    // 最初の部屋（非常灯がある）を、点けずに出る
    expect(world.lamps.length).toBeGreaterThan(0);
    expect(allLampsLit(world)).toBe(false);
    leaveRoom(r, world, world.room.doors[0].id);
    expect(r.secret.lampsOk).toBe(false);
    world = walkToRest(r, true);
    expect(world.room.secretOpen).toBeUndefined();
    expect(secretDoor(world)).toBeUndefined();
  });

  it('近づいて点けた非常灯は「点けた」と数える。消えても、壊されても、数えたまま', () => {
    const { run: r } = newRun();
    const world = enterRoom(r);
    world.countdown = 0;
    const p = world.player;
    p.inv = Infinity;
    for (const lamp of world.lamps) {
      p.x = lamp.x;
      p.y = lamp.y + 10;
      updateWorld(world, DT, idle);
      expect(lamp.lit).toBe(true);
      lamp.on = 0;
      lamp.broken = 30;
    }
    expect(allLampsLit(world)).toBe(true);
    leaveRoom(r, world, world.room.doors[0].id);
    expect(r.secret.lampsOk).toBe(true);
  });

  it('非常灯のない部屋（補給・闇市など）は、点けたものとして数える', () => {
    const world = createWorld({ room: { type: 'supply', waves: [], objects: [], doors: [], clearCredits: 0, environment: env }, rng: seeded(1), weaponId: 'sword' });
    expect(world.lamps).toHaveLength(0);
    expect(allLampsLit(world)).toBe(true);
  });

  it('判定はエリアごと。次のエリアに入ると、やり直しになる', () => {
    const { run: r } = newRun();
    const world = enterRoom(r);
    leaveRoom(r, world, world.room.doors[0].id);
    expect(r.secret.lampsOk).toBe(false);
    r.plan.current = 'boss';
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    expect(r.areaIndex).toBe(1);
    expect(r.secret.lampsOk).toBe(true);
    const rest = walkToRest(r, true);
    expect(secretDoor(rest)).toBeDefined();
  });

  it('道に入ると、ノクターンと戦う。倒すと停電区の通行証と実績。戻ったあとは、もう開かない', () => {
    const { run: r, save } = newRun();
    let world = walkToRest(r, true);
    leaveRoom(r, world, SECRET_IN);
    expect(r.inSecret).toBe(true);
    world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('nocturne');
    expect(world.room.doors).toEqual([{ id: SECRET_OUT, type: 'secretBack' }]);
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.passes).toEqual(['map3', 'map4']);
    expect(save.achievements).toContain('nocturne');
    expect(save.materials).toMatchObject({ nocturneCore: 1 }); // 隠しボスの素材が1個
    expect(save.materials.breakerCore ?? 0).toBe(0);
    leaveRoom(r, world, SECRET_OUT);
    world = enterRoom(r);
    expect(r.plan.current).toBe('rest');
    expect(r.secret.done).toBe(true);
    expect(secretDoor(world)).toBeUndefined();
    // 次のエリアで条件を満たしても、もう開かない
    leaveRoom(r, world, world.room.doors[0].id);
    leaveRoom(r, enterRoom(r), NEXT_AREA);
    expect(secretDoor(walkToRest(r, true))).toBeUndefined();
  });

  it('停電区の通行証は、マップ5に入る条件になる（マップ4の完了だけでは、入れない）', () => {
    const save = createSave();
    const map5 = DATA.maps.all()[4];
    for (const id of ['map1', 'map2', 'map3', 'map4']) recordMapClear(save, id, 1);
    save.passes.push('map3');
    expect(mapState(save, map5)).toBe('locked');
    save.passes.push('map4');
    expect(mapState(save, map5)).toBe('open');
  });

  it('中断：点けていない非常灯が残る部屋で中断すると、道は開かない。全部点けていれば、再開しても条件は残る', () => {
    for (const light of [true, false]) {
      const { run: r, save } = newRun();
      const world = enterRoom(r);
      if (light) lightAllLamps(world);
      const again = restoreRun(snapshotRun(r, world), save, seeded(9));
      expect(again.secret.lampsOk).toBe(light);
      expect(again.secret.rule).toBe('lamps');
    }
  });

  it('中断：補給部屋で中断して再開しても、道は開いたまま', () => {
    const { run: r, save } = newRun();
    const world = walkToRest(r, true);
    const again = restoreRun(snapshotRun(r, world), save, seeded(9));
    expect(secretDoor(enterRoom(again))).toBeDefined();
  });
});

describe('隠しボス「ノクターン」', () => {
  const def = DATA.bosses.get('nocturne');
  const marks = (world) => world.hazards.filter((h) => h.type === 'mark');
  const echoes = (world) => world.hazards.filter((h) => h.type === 'echo');

  it('隠しボスで、マップ4でいちばん強い。弱点はない。専用の曲がある。3段階', () => {
    expect(def.hidden).toBe(true);
    expect(def.weakness).toBeNull();
    expect(def.material).toBe('nocturneCore');
    for (const id of ['lampeater', 'sentinel', 'breaker']) expect(def.hp).toBeGreaterThan(DATA.bosses.get(id).hp);
    expect(BGM[def.bgm]).toBeDefined();
    expect(def.phases).toHaveLength(3);
    expect(def.drops.minRarity).toBe(2);
  });

  it('そのボスだけの攻撃（影踏み・写し身）を持ち、前半から使う', () => {
    for (const pattern of ['shadowstep', 'mirror']) {
      expect(PATTERNS[pattern]).toBeDefined();
      expect(def.phases[0].moves.some((m) => def.attacks[m].pattern === pattern), pattern).toBe(true);
      for (const other of DATA.bosses.all()) {
        if (other.id !== 'nocturne') expect(Object.values(other.attacks).some((a) => a.pattern === pattern), other.id).toBe(false);
      }
    }
  });

  it('影踏み：自分が2秒前にいた場所が、攻撃される。動き続けていれば、今いる場所には来ない', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    b.x = 900;
    b.y = 120;
    p.x = 200;
    p.y = 400;
    b.next = 'shadowstep';
    b.idleT = 0;
    const trail = def.attacks.shadowstep.trail;
    // 右へ歩き続ける。場所の記録を取っておく
    const history = [];
    let clock = 0;
    let first = null;
    const walk = { ...idle, mx: 1 };
    for (let t = 0; t < 6 && !first; t += DT) {
      updateWorld(world, DT, walk);
      b.idleT = Infinity;
      if (p.x > 820) p.x = 200; // 壁まで行ったら戻す（記録は続ける）
      clock += DT;
      history.push({ x: p.x, y: p.y, t: clock });
      first = marks(world)[0] ?? null;
    }
    expect(first).not.toBeNull();
    // 予告が出た場所は、（2秒 − 予告の時間）前にいた場所。予告が終わるころに、ちょうど2秒前の場所になる
    const back = trail.lag - trail.delay;
    const then = history.find((h) => h.t >= clock - back - DT * 2);
    expect(Math.hypot(first.x - then.x, first.y - then.y)).toBeLessThan(30);
    expect(Math.hypot(first.x - p.x, first.y - p.y)).toBeGreaterThan(first.r + p.r);
  });

  it('影踏み：立ち止まっていると、足元が攻撃される', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    b.x = 900;
    b.y = 120;
    b.next = 'shadowstep';
    b.idleT = 0;
    expect(runUntil(world, () => marks(world).length > 0, 5)).toBe(true);
    b.idleT = Infinity;
    const m = marks(world)[0];
    expect(Math.hypot(m.x - p.x, m.y - p.y)).toBeLessThan(5);
    p.inv = 0;
    const hp = p.hp;
    expect(runUntil(world, () => p.hp < hp, 2)).toBe(true);
  });

  it('写し身：自分の動きを1.5秒遅れて真似る。動き始める前は当たらず、追いつかれると当たる', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    b.x = 900;
    b.y = 120;
    p.x = 200;
    p.y = 400;
    b.next = 'mirror';
    b.idleT = 0;
    expect(runUntil(world, () => echoes(world).length === 1, 3)).toBe(true);
    b.idleT = Infinity;
    const e = echoes(world)[0];
    const start = { x: p.x, y: p.y };
    // 出た直後：同じ場所に重なっていても、まだ当たらない
    p.inv = 0;
    const hp = p.hp;
    run(world, 0.3);
    expect(e.armed).toBe(false);
    expect(p.hp).toBe(hp);
    // 右へ歩く。1.5秒後から、影が同じ道をついてくる
    const walk = { ...idle, mx: 1 };
    run(world, 1.0, walk);
    expect(Math.hypot(e.x - start.x, e.y - start.y)).toBeLessThan(5);
    run(world, 1.2, walk);
    expect(e.armed).toBe(true);
    expect(e.x).toBeGreaterThan(start.x + 20);
    expect(e.x).toBeLessThan(p.x - 40);
    expect(p.hp).toBe(hp);
    // 引き返すと、影とぶつかる
    expect(runUntil(world, () => p.hp < hp, 3, { ...idle, mx: -1 })).toBe(true);
  });

  it('大技「夜想」：暗闇になり、影踏みと、写し身2体が同時に来る。ボスは、そのまま動き続ける', () => {
    const world = bossWorld();
    const b = world.boss;
    b.next = 'nocturne';
    b.idleT = 0;
    expect(runUntil(world, () => echoes(world).length === 2, 4)).toBe(true);
    expect(world.hazards.some((h) => h.type === 'trail')).toBe(true);
    expect(world.blackout).not.toBeNull();
    expect(runUntil(world, () => !b.act, 3)).toBe(true); // 技そのものは、すぐ終わる
    expect(echoes(world)).toHaveLength(2);
  });

  it('ボスを倒すと、影も消える', () => {
    const world = bossWorld();
    const b = world.boss;
    b.next = 'nocturne';
    b.idleT = 0;
    runUntil(world, () => echoes(world).length === 2, 4);
    hitEnemy(world, b, 99999999, 1, 0, 0, { unblockable: true });
    for (let t = 0; t < 1.5; t += DT) {
      world.choice = null;
      world.pendingLevelUps = 0;
      updateWorld(world, DT, idle);
    }
    expect(world.hazards.filter((h) => h.type === 'echo' || h.type === 'trail')).toHaveLength(0);
  });
});
