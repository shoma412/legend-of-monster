import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { hitEnemy } from '../src/game/combat.js';
import { interact } from '../src/game/objects.js';
import { NEXT_AREA, SECRET_IN, SECRET_OUT, createRun, enterRoom, handleEvents, leaveRoom, skipToBoss } from '../src/game/run.js';
import { updateWorld } from '../src/game/world.js';
import { hasPassFor, lockReason, mapState, recordMapClear } from '../src/logic/maps.js';
import { SAVE_VERSION, createSave, normalizeSave } from '../src/logic/save.js';
import { canSuspend, restoreRun, snapshotRun } from '../src/logic/suspend.js';

// 隠しボスと通行証（docs/詳細仕様.md「21. 隠しボスと通行証」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function map3Run(seed = 1, save = createSave()) {
  recordMapClear(save, 'map1', 1);
  recordMapClear(save, 'map2', 1);
  return createRun({ rng: seeded(seed), save, mapId: 'map3', weaponId: 'sword' });
}

// ひび割れた壁のある部屋に、直接入った状態にする
function secretRoom(seed = 1) {
  const run = map3Run(seed);
  run.secret.areaIndex = 0;
  run.secret.node = run.plan.current;
  const world = enterRoom(run);
  world.player.inv = Infinity;
  return { run, world, save: run.save };
}

// 部屋の敵を全部倒して、クリアさせる
function clearRoom(world) {
  for (let t = 0; t < 200 && world.mode !== 'clear'; t += DT) {
    for (const e of world.enemies) if (!e.dead && e.spawnT <= 0 && !e.def.prop) hitEnemy(world, e, 9999999, 1, 0, 0, { unblockable: true });
    world.choice = null;
    world.pendingLevelUps = 0;
    updateWorld(world, DT, idle);
  }
  world.choice = null;
  world.pendingLevelUps = 0;
  updateWorld(world, DT, idle);
}

const crack = (world) => world.enemies.find((e) => e.def.id === 'crackwall');
const door = (world) => world.objects.find((o) => o.kind === 'secretDoor');

describe('ひび割れた壁の場所', () => {
  it('隠しボスのいるマップだけに出る。エリアと部屋は、出撃ごとに変わる', () => {
    expect(createRun({ rng: seeded(1), save: createSave(), mapId: 'map1' }).secret).toBeNull();
    const areas = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const run = map3Run(seed);
      expect(run.secret.boss).toBe('architect');
      expect(run.secret.areaIndex).toBeGreaterThanOrEqual(0);
      expect(run.secret.areaIndex).toBeLessThan(run.map.areas.length);
      areas.add(run.secret.areaIndex);
    }
    expect([...areas].sort()).toEqual([0, 1, 2]);
  });

  it('そのエリアに入ったときに部屋が決まる。最初の部屋・ボス前の補給・ボス部屋には出ない', () => {
    const nodes = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const run = map3Run(seed);
      while (run.areaIndex < run.secret.areaIndex) {
        expect(run.secret.node).toBeNull();
        skipToBoss(run, enterRoom(run));
        leaveRoom(run, enterRoom(run), NEXT_AREA);
      }
      const node = run.secret.node;
      expect(run.plan.nodes[node], `seed ${seed}`).toBeDefined();
      expect(['start', 'rest', 'boss']).not.toContain(node);
      nodes.add(node);
    }
    expect(nodes.size).toBeGreaterThan(5);
  });

  it('その部屋にだけ、ひびが出る。ほかの部屋には出ない', () => {
    const run = map3Run(3);
    run.secret.areaIndex = 0;
    run.secret.node = '9-9'; // 通らない部屋
    expect(enterRoom(run).room.secret).toBeUndefined();
    const { world } = secretRoom(3);
    expect(world.room.secret).toBeDefined();
    expect(['top', 'left']).toContain(world.room.secret.side);
    const b = world.bounds;
    expect(world.room.secret.x).toBeGreaterThan(b.left);
    expect(world.room.secret.x).toBeLessThan(b.right - 100); // 右の壁（扉が並ぶ）には出ない
  });
});

describe('壁を壊す', () => {
  it('敵が残っている間は、壁そのものがなく、壊せない。部屋をクリアすると壊せるようになる', () => {
    const { world } = secretRoom(4);
    expect(world.mode).toBe('play');
    for (let i = 0; i < 120; i++) updateWorld(world, DT, idle);
    expect(crack(world)).toBeUndefined();
    expect(door(world)).toBeUndefined();
    clearRoom(world);
    expect(world.mode).toBe('clear');
    updateWorld(world, DT, idle);
    const wall = crack(world);
    expect(wall).toBeDefined();
    expect(wall.x).toBe(world.room.secret.x);
    // 壊れるまでは扉が出ない
    hitEnemy(world, wall, wall.hp - 1, 1, 0, 0);
    updateWorld(world, DT, idle);
    expect(door(world)).toBeUndefined();
    hitEnemy(world, wall, 10, 1, 0, 0);
    updateWorld(world, DT, idle);
    expect(door(world)).toBeDefined();
    expect(door(world).target).toBe(SECRET_IN);
    expect(crack(world)).toBeUndefined();
    expect(world.room.secret.broken).toBe(true);
  });

  it('壁を壊しても、撃破数や経験値にはならない', () => {
    const { world } = secretRoom(4);
    clearRoom(world);
    updateWorld(world, DT, idle);
    const kills = world.kills;
    const xp = world.player.build.xp;
    hitEnemy(world, crack(world), 99999, 1, 0, 0);
    updateWorld(world, DT, idle);
    expect(world.kills).toBe(kills);
    expect(world.player.build.xp).toBe(xp);
  });
});

describe('隠しボスの部屋', () => {
  // 壁を壊して、隠し扉に入る
  function enterSecret(seed = 5) {
    const ctx = secretRoom(seed);
    clearRoom(ctx.world);
    updateWorld(ctx.world, DT, idle);
    hitEnemy(ctx.world, crack(ctx.world), 99999, 1, 0, 0);
    updateWorld(ctx.world, DT, idle);
    const d = door(ctx.world);
    ctx.world.player.x = d.x;
    ctx.world.player.y = d.y + (d.side === 'top' ? 30 : 0);
    updateWorld(ctx.world, DT, idle);
    interact(ctx.world);
    expect(ctx.world.exit).toBe(SECRET_IN);
    const node = ctx.run.plan.current;
    leaveRoom(ctx.run, ctx.world, ctx.world.exit);
    expect(ctx.run.inSecret).toBe(true);
    expect(ctx.run.plan.current).toBe(node); // 地図の上では、同じ部屋のまま
    const boss = enterRoom(ctx.run);
    boss.player.inv = Infinity;
    return { ...ctx, node, boss };
  }

  it('隠し扉に入ると、アーキテクトの部屋になる。クレーンタイタンより HP が多い', () => {
    const { boss } = enterSecret();
    expect(boss.room.type).toBe('secretBoss');
    expect(boss.room.secret).toBeUndefined();
    while (!boss.boss) updateWorld(boss, DT, idle);
    expect(boss.boss.def.id).toBe('architect');
    // 出撃中の HP には、敵ぜんたいの強さ（0.65倍）が掛かる。定義どうしで比べる
    expect(boss.boss.def.hp).toBeGreaterThan(DATA.bosses.get('cranetitan').hp * 1.2);
    expect(DATA.bosses.get('architect').phases).toHaveLength(3);
  });

  it('倒すと通行証と実績が手に入り、装備（エピック以上）を落とす。マップの完了にはならず、データ片は増えない。素材は、アーキテクトコアが1個だけ増える', () => {
    const { run, save, boss } = enterSecret();
    while (!boss.boss || boss.boss.spawnT > 0) updateWorld(boss, DT, idle);
    const materials = JSON.stringify(save.materials);
    const fragments = save.fragments.length;
    hitEnemy(boss, boss.boss, 99999999, 1, 0, 0, { unblockable: true });
    const notes = handleEvents(run, boss);
    expect(save.passes).toEqual(['map3']);
    expect(save.bossKills.architect).toBe(1);
    expect(save.achievements).toContain('architect');
    expect(notes.some((n) => n.text.includes('通行証'))).toBe(true);
    expect(save.materials).toEqual({ ...JSON.parse(materials), architectCore: 1 });
    expect(save.fragments.length).toBe(fragments);
    expect(mapState(save, maps[2])).toBe('open'); // マップ3は、まだ完了していない
    expect(run.outcome).toBeNull();
    expect(boss.loot).toHaveLength(3);
    for (const l of boss.loot) expect(l.item.rarity).toBeGreaterThanOrEqual(2);
  });

  it('最後のエリアで倒しても、マップの完了にはならない', () => {
    const run = map3Run(6);
    run.areaIndex = run.map.areas.length - 1;
    run.secret.areaIndex = run.areaIndex;
    run.secret.node = run.plan.current;
    run.inSecret = true;
    const boss = enterRoom(run);
    boss.player.inv = Infinity;
    expect(boss.room.noBossLoot).toBe(false);
    while (!boss.boss || boss.boss.spawnT > 0) updateWorld(boss, DT, idle);
    hitEnemy(boss, boss.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(run, boss);
    expect(run.save.records.clears).toBe(0);
    expect(mapState(run.save, maps[2])).toBe('open');
    expect(boss.loot.length).toBeGreaterThan(0);
  });

  it('倒したあとの扉で、元の部屋（クリア済み・扉が開いている）に戻る。壁はもう出ない', () => {
    const { run, node, boss } = enterSecret();
    while (!boss.boss || boss.boss.spawnT > 0) updateWorld(boss, DT, idle);
    hitEnemy(boss, boss.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(run, boss);
    for (let t = 0; t < 10 && boss.mode !== 'clear'; t += DT) {
      boss.choice = null;
      boss.pendingLevelUps = 0;
      updateWorld(boss, DT, idle);
    }
    expect(boss.mode).toBe('clear');
    expect(boss.room.doors).toEqual([{ id: SECRET_OUT, type: 'secretBack' }]);
    leaveRoom(run, boss, SECRET_OUT);
    expect(run.inSecret).toBe(false);
    expect(run.secret.done).toBe(true);
    const back = enterRoom(run);
    expect(run.plan.current).toBe(node);
    expect(back.room.type).toBe('resume');
    expect(back.room.secret).toBeUndefined();
    expect(back.room.doors.length).toBeGreaterThan(0);
    // その先は、ふつうに進める
    leaveRoom(run, back, back.room.doors[0].id);
    expect(enterRoom(run).room.type).not.toBe('resume');
  });

  it('隠し部屋の中では中断できない。壁のある部屋で中断しても、再開後に壁は残っている', () => {
    const { run, boss } = enterSecret(7);
    boss.mode = 'clear';
    expect(canSuspend(run, boss)).toBe(false);

    const ctx = secretRoom(7);
    clearRoom(ctx.world);
    expect(canSuspend(ctx.run, ctx.world)).toBe(true);
    const again = restoreRun(JSON.parse(JSON.stringify(snapshotRun(ctx.run, ctx.world))), ctx.save, seeded(9));
    expect(again.secret).toEqual(ctx.run.secret);
    const resumed = enterRoom(again);
    expect(resumed.room.type).toBe('resume');
    expect(resumed.room.secret).toBeDefined();
    updateWorld(resumed, DT, idle);
    updateWorld(resumed, DT, idle);
    expect(crack(resumed)).toBeDefined();
  });

  it('アーキテクトの技・連携・大技は、どれも定義された部品を指している', () => {
    const def = DATA.bosses.get('architect');
    expect(def.hidden).toBe(true);
    for (const attack of Object.values(def.attacks)) expect(PATTERNS[attack.pattern]).toBeDefined();
    expect(def.attacks[def.ultimate.move].pattern).toBe('safezone');
    expect(DATA.enemies.has(def.attacks.blueprint.post)).toBe(true);
  });
});

describe('通行証とマップ4', () => {
  it('セーブデータ：通行証の欄がある。古い版のデータは、通行証なしで読み込まれる', () => {
    expect(createSave().passes).toEqual([]);
    const old = { ...createSave(), version: 5 };
    delete old.passes;
    const save = normalizeSave(old);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.passes).toEqual([]);
    expect(normalizeSave({ ...createSave(), passes: ['map3', 'map3'] }).passes).toEqual(['map3']);
  });

  it('マップ4は、マップ3の完了と通行証の両方がそろうと開く条件になっている', () => {
    const map4 = maps[3];
    {
      const save = createSave();
      expect(hasPassFor(save, map4)).toBe(false);
      expect(mapState(save, map4)).toBe('locked');
      expect(lockReason(save, map4)).toContain('前のマップ');
      recordMapClear(save, 'map1', 1);
      recordMapClear(save, 'map2', 1);
      recordMapClear(save, 'map3', 1);
      expect(mapState(save, map4)).toBe('locked');
      expect(lockReason(save, map4)).toBe('建設区の隠しボスを倒すと、選べるようになる');
      save.passes.push('map3');
      expect(mapState(save, map4)).toBe('open');
      expect(lockReason(save, map4)).toBe('');
    }
    expect(lockReason(createSave(), maps[4])).toContain('準備中');
    // 通行証の要らないマップは、今までどおり
    expect(hasPassFor(createSave(), maps[1])).toBe(true);
  });
});
