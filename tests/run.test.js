import { describe, expect, it } from 'vitest';
import { ECONOMY, ELITE, PLAYER, ROOM, ROOMGEN } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { hitEnemy } from '../src/game/combat.js';
import { hasTraitPart } from '../src/game/elite.js';
import { interact, useKit } from '../src/game/objects.js';
import { buildRoom, hasRoomBuilder } from '../src/game/rooms.js';
import { createRun, currentArea, enterRoom, leaveRoom } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { advancePlan, createAreaPlan, doorOptions, nodeState, reachableNodes, generateEliteWaves, generateShop, generateVault, generateWaves } from '../src/logic/areaGen.js';
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
      for (const r of [a.first, ...a.specialRooms]) expect(DATA.rooms.has(r), r).toBe(true);
      expect(a.specialRooms.length).toBeGreaterThanOrEqual(a.map.specials);
      for (const e of [...a.enemies.map((x) => x.id), ...a.eliteBases]) expect(DATA.enemies.has(e), e).toBe(true);
      expect(DATA.bosses.has(a.boss)).toBe(true);
    }
  });

  it('エリートの特性は4種で、どれも部品がある', () => {
    expect(DATA.eliteTraits.ids().sort()).toEqual(['absorb', 'barrier', 'haste', 'split']);
    for (const t of DATA.eliteTraits.all()) expect(hasTraitPart(t.part), t.id).toBe(true);
  });
});

describe('エリアの地図', () => {
  const SPECIAL = ['supply', 'market', 'vault'];
  const spread = (n) => seeded((n * 2654435761) % 4294967296); // 連番の種だと最初の乱数が似るので散らす

  it('最初の部屋・途中の3列（上下2部屋）・ボスでできている', () => {
    for (let n = 1; n <= 200; n++) {
      const plan = createAreaPlan(area, spread(n));
      const nodes = Object.values(plan.nodes);
      expect(nodes).toHaveLength(8);
      expect(plan.nodes.start).toMatchObject({ col: 0, type: 'combat' });
      expect(plan.nodes.boss).toMatchObject({ col: 4, type: 'boss' });
      const middle = nodes.filter((x) => x.col >= 1 && x.col <= 3).map((x) => x.type);
      // 途中の6部屋：エリート1つ以上、特殊部屋2つ（別の種類）、残りは戦闘
      const elites = middle.filter((t) => t === 'elite').length;
      expect(elites).toBeGreaterThanOrEqual(1);
      expect(elites).toBeLessThanOrEqual(2);
      const specials = middle.filter((t) => SPECIAL.includes(t));
      expect(specials).toHaveLength(2);
      expect(new Set(specials).size).toBe(2);
      expect(middle.filter((t) => t === 'combat')).toHaveLength(6 - elites - 2);
      // 同じ列の上下は違う種類
      for (let c = 1; c <= 3; c++) expect(plan.nodes[`${c}-0`].type).not.toBe(plan.nodes[`${c}-1`].type);
    }
  });

  it('どの部屋からも次の列の1〜2部屋へ進め、どの部屋にも入ってくる道がある', () => {
    for (let n = 1; n <= 200; n++) {
      const plan = createAreaPlan(area, spread(n));
      const incoming = new Set();
      for (const node of Object.values(plan.nodes)) {
        if (node.id === 'boss') {
          expect(node.next).toEqual([]);
          continue;
        }
        expect(node.next.length).toBeGreaterThanOrEqual(1);
        expect(node.next.length).toBeLessThanOrEqual(2);
        for (const id of node.next) {
          expect(plan.nodes[id].col).toBe(node.col + 1);
          incoming.add(id);
        }
      }
      expect(incoming.size).toBe(7); // 最初の部屋以外すべて
    }
  });

  // 扉をランダムに選んで最後まで進み、通った部屋の種類を返す
  function walk(n) {
    const rng = spread(n);
    const plan = createAreaPlan(area, rng);
    const path = [plan.nodes[plan.current].type];
    for (let guard = 0; guard < 10; guard++) {
      const doors = doorOptions(plan);
      if (doors.length === 0) break;
      const door = doors[Math.floor(rng() * doors.length)];
      advancePlan(plan, door.id);
      path.push(door.type);
    }
    return path;
  }

  it('どの道でも5部屋で、最初は戦闘、最後はボス。道によって中身が変わる', () => {
    const paths = new Set();
    for (let n = 1; n <= 300; n++) {
      const path = walk(n);
      expect(path).toHaveLength(5);
      expect(path[0]).toBe('combat');
      expect(path[4]).toBe('boss');
      paths.add(path.join('>'));
    }
    expect(paths.size).toBeGreaterThan(20);
    // エリート2連戦の道も、エリートなしの道もありうる
    expect([...paths].some((p) => p.split('elite').length - 1 === 2)).toBe(true);
    expect([...paths].some((p) => !p.includes('elite'))).toBe(true);
  });

  it('線でつながっていない部屋には進めない。進むと、行けなくなった部屋が分かる', () => {
    const plan = createAreaPlan(area, () => 0.99); // 斜めの線が1本も引かれない地図
    expect(doorOptions(plan).map((d) => d.id)).toEqual(['1-0', '1-1']);
    expect(nodeState(plan, 'start')).toBe('current');
    expect(nodeState(plan, '1-0')).toBe('next');
    expect(nodeState(plan, '3-1')).toBe('ahead');
    expect(() => advancePlan(plan, '2-0')).toThrow();
    advancePlan(plan, '1-0');
    expect(plan.step).toBe(1);
    expect(doorOptions(plan).map((d) => d.id)).toEqual(['2-0']);
    expect(nodeState(plan, 'start')).toBe('done');
    expect(nodeState(plan, '1-1')).toBe('off');
    expect(nodeState(plan, '3-1')).toBe('off');
    expect(nodeState(plan, 'boss')).toBe('ahead');
    expect([...reachableNodes(plan)].sort()).toEqual(['2-0', '3-0', 'boss']);
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

  it('闇市：装備2つ・修復キット・消耗品・インプラントが並び、クレジットで買える。足りないと買えない', () => {
    const goods = generateShop(createBuild(), seeded(6));
    expect(goods.map((g) => g.type)).toEqual(['gear', 'gear', 'kit', 'item', 'implant']);
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
    expect(p.build.bag).toEqual([old]);
    expect(world.loot).toHaveLength(0);
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
    leaveRoom(r, first, next.id);
    const second = enterRoom(r);
    expect(second.room.type).toBe(next.type);
    expect(r.plan.step).toBe(1);
    expect(second.player.hp).toBe(42);
    expect(second.player.build.credits).toBe(77);
    expect(second.player.stats.attackMul).toBeCloseTo(1.2);
    expect(r.kills).toBe(5);
  });

  it('ランの最初の部屋だけ、3・2・1 のカウントダウンがある。その間は敵が出ない', () => {
    const r = createRun({ rng: seeded(8) });
    const first = enterRoom(r);
    const total = ROOM.startCountdown.count * ROOM.startCountdown.step;
    expect(first.countdown).toBeCloseTo(total);
    const x = first.player.x;
    run(first, total - 0.2, { ...idle, mx: 1 });
    expect(first.enemies).toHaveLength(0);
    expect(first.player.x).toBeGreaterThan(x); // カウントダウン中も動ける
    run(first, 1.2);
    expect(first.enemies.length).toBeGreaterThan(0);

    leaveRoom(r, first, first.room.doors[0].id);
    expect(enterRoom(r).countdown).toBe(0);
  });

  it('新しいランは、まっさらな状態で始まる', () => {
    const p = enterRoom(createRun({ rng: seeded(9) })).player;
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(p.build).toMatchObject({ level: 1, credits: 0, kits: 2, implants: {} });
  });
});
