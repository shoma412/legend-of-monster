import { describe, expect, it } from 'vitest';
import { ECONOMY, ELITE, PLAYER, ROOMGEN } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { hitEnemy } from '../src/game/combat.js';
import { hasTraitPart } from '../src/game/elite.js';
import { interact, useKit } from '../src/game/objects.js';
import { buildRoom, hasRoomBuilder } from '../src/game/rooms.js';
import { createRun, currentArea, enterRoom, leaveRoom } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { advancePlan, areaOverview, createAreaPlan, doorOptions, generateEliteWaves, generateShop, generateVault, generateWaves } from '../src/logic/areaGen.js';
import { createBuild } from '../src/logic/stats.js';
import { hasIcon } from '../src/render/objects.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const area = DATA.areas.get('slum');

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function roomWorld(type, { rng = () => 0.5, doors = [], build = createBuild() } = {}) {
  const room = buildRoom(type, { area, step: 1, build, rng }, doors);
  const world = createWorld({ rng, room, carry: { hp: null, build } });
  return world;
}

// プレイヤーを物のそばに動かして E を押す
function useObject(world, o) {
  world.player.x = o.x - (o.kind === 'door' ? 20 : 0);
  world.player.y = o.y;
  run(world, 0.05);
  return interact(world);
}

describe('定義データのつじつま', () => {
  it('部屋の種類は、中身を作る部品とアイコンがある', () => {
    for (const room of DATA.rooms.all()) {
      expect(hasRoomBuilder(room.build), room.id).toBe(true);
      expect(hasIcon(room.icon), room.id).toBe(true);
    }
  });

  it('エリアが使う部屋・敵・ボスは定義されている', () => {
    for (const a of DATA.areas.all()) {
      for (const r of [a.first, ...a.pool, ...a.specialRooms]) expect(DATA.rooms.has(r), r).toBe(true);
      for (const e of [...a.enemies.map((x) => x.id), ...a.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
      expect(DATA.bosses.has(a.boss)).toBe(true);
    }
  });

  it('エリートの特性は4種で、どれも部品がある', () => {
    expect(DATA.eliteTraits.ids().sort()).toEqual(['absorb', 'barrier', 'haste', 'split']);
    for (const t of DATA.eliteTraits.all()) expect(hasTraitPart(t.part), t.id).toBe(true);
  });
});

describe('エリアの部屋の並び', () => {
  // 扉をランダムに選んで最後まで進み、通った部屋の並びを返す
  function walk(n) {
    const seed = (n * 2654435761) % 4294967296; // 連番の種だと最初の乱数が似るので散らす
    const rng = seeded(seed);
    const plan = createAreaPlan(area, rng);
    const path = [plan.current];
    for (let guard = 0; guard < 10; guard++) {
      const doors = doorOptions(plan, rng);
      if (doors.length === 0) break;
      expect(doors.length).toBeLessThanOrEqual(2);
      expect(new Set(doors).size).toBe(doors.length);
      advancePlan(plan, doors[Math.floor(rng() * doors.length)]);
      path.push(plan.current);
    }
    return path;
  }

  it('どの道順でも、戦闘3部屋（うち1つエリート）＋特殊部屋1つ＋ボスになる', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const path = walk(seed);
      expect(path).toHaveLength(5);
      expect(path[0]).toBe('combat');
      expect(path[4]).toBe('boss');
      expect(path.filter((t) => t === 'combat')).toHaveLength(2);
      expect(path.filter((t) => t === 'elite')).toHaveLength(1);
      expect(path.filter((t) => ['supply', 'market', 'vault'].includes(t))).toHaveLength(1);
    }
  });

  it('道順はランごとに変わる', () => {
    const paths = new Set();
    for (let seed = 1; seed <= 200; seed++) paths.add(walk(seed).join('>'));
    expect(paths.size).toBeGreaterThan(8);
  });

  it('エリアのマップ：通った部屋・今の部屋・この先の部屋・ボスが並ぶ', () => {
    const plan = createAreaPlan(area, seeded(3));
    const special = plan.pool[2];
    expect(areaOverview(plan)).toEqual([
      { type: 'combat', state: 'current' },
      { type: 'combat', state: 'ahead' },
      { type: 'elite', state: 'ahead' },
      { type: special, state: 'ahead' },
      { type: 'boss', state: 'ahead' },
    ]);
    advancePlan(plan, 'elite');
    expect(areaOverview(plan).map((n) => n.type + ':' + n.state)).toEqual(['combat:done', 'elite:current', 'combat:ahead', special + ':ahead', 'boss:ahead']);
    advancePlan(plan, 'combat');
    advancePlan(plan, special);
    advancePlan(plan, 'boss');
    expect(areaOverview(plan).at(-1)).toEqual({ type: 'boss', state: 'current' });
    expect(areaOverview(plan)).toHaveLength(5);
  });

  it('残りが2種類以上あれば扉は2つ、残りがなくなるとボスの扉だけ', () => {
    const plan = createAreaPlan(area, seeded(3));
    expect(doorOptions(plan, seeded(1))).toHaveLength(2);
    plan.pool = ['combat'];
    expect(doorOptions(plan, seeded(1))).toEqual(['combat']);
    plan.pool = [];
    expect(doorOptions(plan, seeded(1))).toEqual(['boss']);
    plan.current = 'boss';
    expect(doorOptions(plan, seeded(1))).toEqual([]);
  });
});

describe('部屋の中身', () => {
  it('戦闘部屋は2〜3波で、奥の部屋ほど敵が増える', () => {
    const rng = seeded(4);
    const total = (step) => {
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        const waves = generateWaves(area, step, rng);
        expect(waves.length).toBeGreaterThanOrEqual(ROOMGEN.combat.wavesMin);
        expect(waves.length).toBeLessThanOrEqual(ROOMGEN.combat.wavesMax);
        for (const w of waves) for (const [id, n] of Object.entries(w)) sum += DATA.enemies.get(id).cost * n;
      }
      return sum;
    };
    expect(total(3)).toBeGreaterThan(total(0));
  });

  it('エリート部屋は強化個体1体＋取り巻き。HP3倍で、倒すとレア以上の装備が確定', () => {
    const [wave] = generateEliteWaves(area, 1, seeded(2));
    expect(area.eliteBases).toContain(wave.elite.base);
    const world = roomWorld('elite');
    run(world, 2);
    const elite = world.enemies.find((e) => e.elite);
    expect(elite.maxHp).toBe(elite.baseDef.hp * ELITE.hpMul);
    expect(elite.def.damage).toBe(Math.round(elite.baseDef.damage * ELITE.damageMul));
    // ひるまない：構えている最中に攻撃されても中断されない
    elite.state = 'windup';
    hitEnemy(world, elite, 1, 1, 0, 0);
    expect(elite.state).toBe('windup');
    expect(elite.stagger).toBeLessThanOrEqual(0);
    expect(world.enemies.length).toBeGreaterThan(1);
    elite.barrier = 0;
    hitEnemy(world, elite, 99999, 1, 0, 0);
    const dropped = world.loot.at(-1).item;
    expect(dropped.rarity).toBeGreaterThanOrEqual(1);
  });

  it('クリアすると扉が開き、クレジットがもらえる。扉を E で選ぶと次の部屋が決まる', () => {
    const world = roomWorld('combat', { doors: ['market', 'elite'] });
    expect(world.objects).toHaveLength(0);
    run(world, 1);
    world.enemies.forEach((e) => { e.dead = true; });
    for (let i = 0; i < 6 && world.mode !== 'clear'; i++) {
      run(world, 1.5);
      world.enemies.forEach((e) => { e.dead = true; });
    }
    expect(world.mode).toBe('clear');
    expect(world.player.build.credits).toBe(DATA.rooms.get('combat').clearCredits);
    const doors = world.objects.filter((o) => o.kind === 'door');
    expect(doors.map((d) => d.type)).toEqual(['market', 'elite']);
    expect(world.exit).toBe(null);
    useObject(world, doors[1]);
    expect(world.exit).toBe('elite');
  });

  it('補給：端末を調べるとHPが40%回復する（1回だけ）', () => {
    const world = roomWorld('supply', { doors: ['boss'] });
    const p = world.player;
    p.hp = 10;
    run(world, 0.1);
    expect(world.mode).toBe('clear'); // 戦闘がないので、すぐ扉が開く
    const terminal = world.objects.find((o) => o.kind === 'heal');
    useObject(world, terminal);
    expect(p.hp).toBe(50);
    interact(world);
    expect(p.hp).toBe(50);
  });

  it('闇市：装備2つ・修復キット・インプラントが並び、クレジットで買える。足りないと買えない', () => {
    const goods = generateShop(createBuild(), seeded(6));
    expect(goods.map((g) => g.type)).toEqual(['gear', 'gear', 'kit', 'implant']);
    expect(goods[0].price).toBe(ECONOMY.prices.gear[goods[0].item.rarity]);

    const world = roomWorld('market', { rng: seeded(6) });
    const p = world.player;
    run(world, 0.1);
    const kit = world.objects.find((o) => o.goods?.type === 'kit');
    useObject(world, kit);
    expect(p.build.kits).toBe(PLAYER.kit.start); // クレジット不足
    expect(world.objects).toContain(kit);

    p.build.credits = 1000;
    useObject(world, kit);
    expect(p.build.kits).toBe(PLAYER.kit.start + 1);
    expect(p.build.credits).toBe(1000 - ECONOMY.prices.kit);
    expect(world.objects).not.toContain(kit);

    const gear = world.objects.find((o) => o.goods?.type === 'gear');
    useObject(world, gear);
    expect(p.build.gear[gear.goods.item.slot]).toBe(gear.goods.item);

    const implant = world.objects.find((o) => o.goods?.type === 'implant');
    useObject(world, implant);
    expect(p.build.implants[implant.goods.def.id]).toBe(1);
  });

  it('データ金庫：装備3つから1つ選ぶと、残りは消える。持っていた装備は足元に落ちる', () => {
    expect(generateVault(seeded(1)).map((i) => i.slot)).toEqual(['mod', 'armor', 'acc']);
    const world = roomWorld('vault');
    const p = world.player;
    const old = { slot: 'armor', rarity: 0, effects: [], unique: null, name: 'old' };
    p.build.gear.armor = old;
    run(world, 0.1);
    const items = world.objects.filter((o) => o.kind === 'vault');
    expect(items).toHaveLength(3);
    const pick = items.find((o) => o.item.slot === 'armor');
    useObject(world, pick);
    expect(p.build.gear.armor).toBe(pick.item);
    expect(world.objects.filter((o) => o.kind === 'vault')).toHaveLength(0);
    expect(world.loot.map((l) => l.item)).toEqual([old]);
  });

  it('ボスを倒すと全回復する', () => {
    const world = roomWorld('boss');
    const p = world.player;
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    p.hp = 5;
    p.inv = Infinity;
    hitEnemy(world, world.boss, 99999, 1, 0, 0);
    for (let i = 0; i < 10; i++) {
      run(world, 0.7);
      if (world.choice) world.choice = null;
    }
    expect(world.mode).toBe('clear');
    expect(p.hp).toBe(p.stats.maxHp);
  });
});

describe('エリートの特性', () => {
  function eliteWorld(trait) {
    const world = createWorld({ rng: () => 0.5, waves: [{ elite: { base: 'grunt', trait }, drone: 2 }] });
    run(world, 2);
    const elite = world.enemies.find((e) => e.elite);
    elite.cd = 99;
    return { world, elite };
  }

  it('障壁：一定ダメージまで無効', () => {
    const { world, elite } = eliteWorld('barrier');
    const barrier = elite.barrier;
    expect(barrier).toBe(elite.maxHp * 0.5);
    hitEnemy(world, elite, barrier - 10, 1, 0, 0);
    expect(elite.hp).toBe(elite.maxHp);
    hitEnemy(world, elite, 30, 1, 0, 0);
    expect(elite.hp).toBe(elite.maxHp - 20);
  });

  it('分裂：倒すと小型2体になり、全部倒すまでクリアにならない', () => {
    const { world, elite } = eliteWorld('split');
    world.enemies.filter((e) => !e.elite).forEach((e) => { e.dead = true; });
    hitEnemy(world, elite, 99999, 1, 0, 0);
    if (world.choice) world.choice = null;
    world.pendingLevelUps = 0;
    run(world, 0.5);
    expect(world.enemies).toHaveLength(2);
    expect(world.enemies.every((e) => !e.elite && e.r < elite.r)).toBe(true);
    expect(world.mode).toBe('play');
  });

  it('加速：移動が速い', () => {
    const fast = eliteWorld('haste');
    const normal = eliteWorld('barrier');
    const moved = [fast, normal].map(({ world, elite }) => {
      world.enemies.filter((e) => !e.elite).forEach((e) => { e.dead = true; });
      world.player.inv = Infinity;
      elite.x = 800;
      elite.y = 270;
      world.player.x = 100;
      world.player.y = 270;
      run(world, 1);
      return 800 - elite.x;
    });
    expect(moved[0] / moved[1]).toBeCloseTo(1.5, 1);
  });

  it('吸収：周りの雑魚を回復する', () => {
    const { world, elite } = eliteWorld('absorb');
    world.player.inv = Infinity;
    const minion = world.enemies.find((e) => !e.elite);
    minion.x = elite.x + 40;
    minion.y = elite.y;
    minion.hp = 5;
    run(world, 2);
    expect(minion.hp).toBeGreaterThan(5);
  });
});

describe('クレジットと修復キット', () => {
  it('敵を倒すとクレジットがもらえる。クレジット獲得+%が効く', () => {
    const world = createWorld({ rng: () => 0.5, waves: [{ grunt: 1 }] });
    run(world, 2);
    world.player.stats.creditMul = 1.5;
    hitEnemy(world, world.enemies[0], 99999, 1, 0, 0);
    expect(world.player.build.credits).toBe(Math.round(DATA.enemies.get('grunt').credits * 1.5));
  });

  it('修復キットは最初に2個。Q で HP を35回復し、満タンのときは使わない', () => {
    const world = createWorld({ rng: () => 0.5, waves: [{}] });
    const p = world.player;
    expect(p.build.kits).toBe(2);
    expect(useKit(world)).toBe(false);
    p.hp = 20;
    expect(useKit(world)).toBe(true);
    expect(p.hp).toBe(55);
    expect(p.build.kits).toBe(1);
    useKit(world);
    expect(useKit(world)).toBe(false);
    expect(p.hp).toBe(90);
  });
});

describe('ラン', () => {
  it('部屋をまたいで、HP・装備・レベル・クレジットを引き継ぐ', () => {
    const r = createRun({ rng: seeded(8) });
    expect(currentArea(r).id).toBe('slum');
    const first = enterRoom(r);
    expect(first.room.type).toBe('combat');
    expect(first.room.doors.length).toBeGreaterThan(0);
    first.player.hp = 42;
    first.player.build.credits = 77;
    first.player.build.implants.overclock = 1;
    first.kills = 5;

    const next = first.room.doors[0];
    leaveRoom(r, first, next);
    const second = enterRoom(r);
    expect(second.room.type).toBe(next);
    expect(r.plan.step).toBe(1);
    expect(second.player.hp).toBe(42);
    expect(second.player.build.credits).toBe(77);
    expect(second.player.stats.attackMul).toBeCloseTo(1.2);
    expect(r.kills).toBe(5);
  });

  it('新しいランは、まっさらな状態で始まる', () => {
    const p = enterRoom(createRun({ rng: seeded(9) })).player;
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(p.build).toMatchObject({ level: 1, credits: 0, kits: 2, implants: {} });
  });
});
