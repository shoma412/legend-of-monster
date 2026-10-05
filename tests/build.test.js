import { describe, expect, it } from 'vitest';
import { LEVEL, LOOT, PLAYER, STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { species } from '../src/data/implants.js';
import { maps } from '../src/data/maps.js';
import { addImplant, chooseImplant, discardFromBag, equipFocusLoot, equipFromBag, equipItem, recalcStats, stashFocusLoot, unequipToBag } from '../src/game/build.js';
import { hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { hasAction, hasCondition, statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { addXp, rollImplantChoices, xpToNext } from '../src/logic/level.js';
import { describeItem, makeItem, rollRarity } from '../src/logic/loot.js';
import { carryOptions, computeStats, createBuild, implantDesc, implantEffect, mapSpecies, runSpecies } from '../src/logic/stats.js';
import { createRun } from '../src/game/run.js';
import { createSave } from '../src/logic/save.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

// 再現できる乱数
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 会心もドロップも出ない固定の乱数の部屋。implants は最初から持たせるインプラントの id
function makeWorld(implants = []) {
  const world = createWorld({ waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function addEnemy(world, id, dx, dy = 0) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng);
  e.cd = 99; // テスト中は攻撃してこない
  world.enemies.push(e);
  return e;
}

describe('定義データのつじつま', () => {
  const effects = [
    ...DATA.implants.all().map((d) => [d.id, d.effect(1)]),
    ...DATA.legendEffects.all().map((d) => [d.id, d.effect]),
    ...Object.entries(species).flatMap(([id, sp]) => sp.bonuses.map((b) => [`${id} の種族ボーナス（${b.need}種類）`, b.effect])),
  ];
  const stats = computeStats(createBuild());

  it('イベント効果は、どれも部品（ACTIONS）がある', () => {
    for (const [id, effect] of effects) {
      for (const t of effect.triggers ?? []) expect(hasAction(t.do), `${id} の ${t.do}`).toBe(true);
    }
  });

  it('ステータス補正は、どれも知っているステータスと条件を使っている', () => {
    for (const [id, effect] of effects) {
      for (const mod of effect.mods ?? []) {
        expect(stats, `${id} の ${mod.stat}`).toHaveProperty(mod.stat);
        if (mod.when) expect(hasCondition(mod.when), `${id} の ${mod.when}`).toBe(true);
      }
    }
    for (const def of DATA.gearEffects.all()) {
      if (def.kind !== 'element') expect(stats, def.id).toHaveProperty(def.stat);
    }
  });

  it('仕様どおり、インプラント38種（種族6つ×5、汎用8）・固有効果4種・装備効果10種がある', () => {
    expect(DATA.implants.all()).toHaveLength(38);
    expect(DATA.legendEffects.all()).toHaveLength(4);
    expect(DATA.gearEffects.all()).toHaveLength(10);
    for (const id of ['boar', 'wyvern', 'core', 'serpent', 'crab', 'hydra']) expect(DATA.implants.all().filter((d) => d.species === id)).toHaveLength(5);
  });
});

describe('装備ドロップ', () => {
  it('レア度は重みどおりに出る（コモンが一番多く、レジェンドが一番少ない）', () => {
    const rng = seeded(7);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[rollRarity(rng)]++;
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    expect(counts[2]).toBeGreaterThan(counts[3]);
    expect(counts[3]).toBeGreaterThan(0);
  });

  it('効果の数はレア度ごとに 1・2・3・4個で、同じ効果は重複しない。レジェンドは固有効果を1つ持つ', () => {
    const rng = seeded(3);
    for (let rarity = 0; rarity < 4; rarity++) {
      for (let i = 0; i < 50; i++) {
        const item = makeItem(rng, { rarity });
        const total = item.effects.length + (item.unique ? 1 : 0);
        expect(total).toBe(LOOT.rarities[rarity].effects);
        expect(new Set(item.effects.map((e) => e.id)).size).toBe(item.effects.length);
        expect(!!item.unique).toBe(rarity === 3);
        expect(describeItem(item)).toHaveLength(total);
      }
    }
  });

  it('効果の値は仕様の範囲に収まり、レア度が高いほど大きい', () => {
    const rng = seeded(11);
    const avg = [0, 3].map((rarity) => {
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 300; i++) {
        for (const line of makeItem(rng, { rarity }).effects) {
          const def = DATA.gearEffects.get(line.id);
          if (def.kind === 'element') continue;
          expect(line.value).toBeGreaterThanOrEqual(def.min - 0.005);
          expect(line.value).toBeLessThanOrEqual(def.max + 0.005);
          if (line.id === 'attack') {
            sum += line.value;
            n++;
          }
        }
      }
      return sum / n;
    });
    expect(avg[1]).toBeGreaterThan(avg[0]);
  });

  it('クレジットの効果も出る（M4 でクレジットを実装したため）', () => {
    const rng = seeded(5);
    let found = false;
    for (let i = 0; i < 300; i++) found ||= makeItem(rng).effects.some((e) => e.id === 'credit');
    expect(found).toBe(true);
    expect(rollImplantChoices(createBuild(), seeded(2), 99).some((d) => d.id === 'greed')).toBe(true);
  });

  it('倒した敵が装備を落とし、近づいて E で付け替えられる。外した装備はその場に残る', () => {
    const world = makeWorld();
    const p = world.player;
    const a = { slot: 'armor', rarity: 0, effects: [{ id: 'maxHp', value: 20 }], unique: null, name: 'A' };
    const b = { slot: 'armor', rarity: 1, effects: [{ id: 'maxHp', value: 30 }, { id: 'attack', value: 0.1 }], unique: null, name: 'B' };
    world.loot.push({ x: p.x, y: p.y, item: a, t: 0 });
    run(world, 0.1);
    expect(world.focusLoot.item).toBe(a);
    expect(p.stats.maxHp).toBe(100); // 近づいただけでは装備しない

    expect(equipFocusLoot(world)).toBe(true);
    expect(p.build.gear.armor).toBe(a);
    expect(p.stats.maxHp).toBe(120);
    expect(p.hp).toBe(120);
    expect(world.loot).toHaveLength(0);

    world.loot.push({ x: p.x, y: p.y, item: b, t: 0 });
    run(world, 0.1);
    equipFocusLoot(world);
    expect(p.build.gear.armor).toBe(b);
    expect(p.stats.maxHp).toBe(130);
    expect(p.stats.attackMul).toBeCloseTo(1.1);
    // 外した装備はバッグに入る
    expect(world.loot).toHaveLength(0);
    expect(p.build.bag).toEqual([a]);
  });

  it('ドロップ率どおりに落とす（乱数が確率より小さいときだけ）', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 40);
    world.rng = () => 0.1;
    hitEnemy(world, e, 9999, 1, 0, 0);
    expect(world.loot).toHaveLength(1);
  });
});

describe('レベルアップとインプラント', () => {
  it('必要経験値は 40 から始まり、レベルごとに 1.35 倍', () => {
    expect(xpToNext(1)).toBe(40);
    expect(xpToNext(2)).toBe(54);
    const build = createBuild();
    expect(addXp(build, 39)).toBe(0);
    expect(addXp(build, 1)).toBe(1);
    expect(build).toMatchObject({ level: 2, xp: 0 });
    expect(addXp(build, 54 + 73)).toBe(2);
  });

  it('レベルが上がると3択が出て戦闘が止まり、選ぶと再開する', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'grunt', 40);
    e.def = { ...e.def, xp: 40 };
    hitEnemy(world, e, 9999, 1, 0, 0);
    run(world, 0.2);
    expect(world.choice.options).toHaveLength(3);
    expect(new Set(world.choice.options.map((d) => d.id)).size).toBe(3);

    const time = world.time;
    const x = p.x;
    run(world, 0.5, { ...idle, mx: 1 });
    expect(p.x).toBe(x); // 止まっている
    expect(world.time).toBeGreaterThan(time);

    const picked = world.choice.options[0];
    chooseImplant(world, 0);
    expect(world.choice).toBe(null);
    expect(p.build.implants[picked.id]).toBe(1);
    run(world, 0.5, { ...idle, mx: 1 });
    expect(p.x).toBeGreaterThan(x);
  });

  it('持っているインプラントは強化として選択肢に出る。レベルが上限のものは出ない', () => {
    const build = createBuild();
    build.implants.chain = LEVEL.implantMax;
    build.implants.overclock = 1;
    const ids = rollImplantChoices(build, seeded(9), 99).map((d) => d.id);
    expect(ids).not.toContain('chain');
    expect(ids).toContain('overclock');
  });

  it('同じインプラントをもう一度入れると、レベルが上がって効果が少し伸びる（1レベルごとに最初の値の2割）', () => {
    const world = makeWorld();
    const p = world.player;
    const def = DATA.implants.get('overclock');
    addImplant(world, def);
    expect(p.build.implants.overclock).toBe(1);
    expect(p.stats.attackMul).toBeCloseTo(1.2);
    addImplant(world, def);
    expect(p.build.implants.overclock).toBe(2);
    expect(p.stats.attackMul).toBeCloseTo(1.24);
    // 上限より上には上がらない
    for (let i = 0; i < 10; i++) addImplant(world, def);
    expect(p.build.implants.overclock).toBe(LEVEL.implantMax);
    expect(p.stats.attackMul).toBeCloseTo(1 + 0.2 * (1 + (LEVEL.implantMax - 1) * LEVEL.implantGrowth));
  });

  it('説明文は、レベルに合わせた数値になる', () => {
    const def = DATA.implants.get('overclock');
    expect(implantDesc(def, 1)).toBe('攻撃力 +20%');
    expect(implantDesc(def, 2)).toBe('攻撃力 +24%');
    expect(implantDesc(def, 5)).toBe('攻撃力 +36%');
    expect(implantDesc(DATA.implants.get('chain'), 3)).toContain('25ダメージ');
    // どのインプラントも、どのレベルでも説明と効果が作れる
    for (const d of DATA.implants.all()) {
      for (let lv = 1; lv <= LEVEL.implantMax; lv++) {
        expect(implantDesc(d, lv).length, d.id).toBeGreaterThan(0);
        const effect = implantEffect(d, lv);
        for (const mod of effect.mods ?? []) expect(Number.isFinite(mod.add), d.id).toBe(true);
      }
    }
  });

  it('伸ばさないと決めた数値は、レベルが上がっても変わらない（貫通数、強欲の被ダメージ）', () => {
    const pierce = (lv) => implantEffect(DATA.implants.get('blade'), lv).mods.find((m) => m.stat === 'pierce').add;
    expect(pierce(1)).toBe(1);
    expect(pierce(5)).toBe(1);
    const taken = (lv) => implantEffect(DATA.implants.get('greed'), lv).mods.find((m) => m.stat === 'damageTaken').add;
    expect(taken(5)).toBe(taken(1));
  });

  it('属性を付けるインプラントは、強化すると追加の効果が付く（焼却弾は継続ダメージ、冷却コアは凍結）', () => {
    expect(makeWorld(['incendiary']).player.stats.burnMul).toBeCloseTo(1);
    expect(makeWorld(['incendiary', 'incendiary']).player.stats.burnMul).toBeCloseTo(1.2);
    expect(makeWorld(['coolant']).player.stats.freezeChance).toBe(0);
    expect(makeWorld(['coolant', 'coolant', 'coolant']).player.stats.freezeChance).toBeCloseTo(0.1);
  });

  it('種族ボーナスは種類の数で数える（同じものを強化しても増えない）', () => {
    expect(makeWorld(['chain', 'chain', 'chain']).player.stats.chainBonus).toBe(0);
    expect(makeWorld(['chain', 'chain', 'overcurrent', 'shockdash']).player.stats.chainBonus).toBe(3);
  });

  it('装甲プレートは最大HP+25で全回復。強化すると +30', () => {
    const world = makeWorld();
    const p = world.player;
    p.hp = 10;
    world.choice = { type: 'implant', options: [DATA.implants.get('plating')] };
    chooseImplant(world, 0);
    expect(p.stats.maxHp).toBe(125);
    expect(p.hp).toBe(125);
    p.hp = 10;
    addImplant(world, DATA.implants.get('plating'));
    expect(p.stats.maxHp).toBe(130);
    expect(p.hp).toBe(130);
  });

  it('同じ種族を2種類持つと小さいボーナス、3種類で大きいボーナスが重なる', () => {
    expect(makeWorld(['chain']).player.stats.chainBonus).toBe(0);
    expect(makeWorld(['chain', 'overcurrent']).player.stats.chainBonus).toBe(1);
    expect(makeWorld(['chain', 'overcurrent', 'shockdash']).player.stats.chainBonus).toBe(3);
    expect(makeWorld(['incendiary', 'thermal']).player.stats.burnMul).toBeCloseTo(1.5);
    expect(makeWorld(['incendiary', 'thermal', 'blast']).player.stats.burnMul).toBeCloseTo(2.5);
    expect(makeWorld(['coolant', 'frostarmor']).player.stats.slowMul).toBeCloseTo(1.5);
    expect(makeWorld(['coolant', 'frostarmor']).player.stats.freezeChance).toBe(0);
    expect(makeWorld(['coolant', 'frostarmor', 'icebreaker']).player.stats.freezeChance).toBeGreaterThan(0);
  });

  it('種族は、ボス1体につき1つ。どの部品も、定義された種族に属している', () => {
    const bosses = Object.values(species).map((sp) => sp.boss).filter(Boolean);
    expect(new Set(bosses).size).toBe(bosses.length);
    for (const id of bosses) expect(DATA.bosses.has(id), id).toBe(true);
    for (const d of DATA.implants.all()) expect(species[d.species], d.id).toBeDefined();
    for (const sp of Object.values(species)) for (const b of sp.bonuses) expect(b.desc.length).toBeGreaterThan(0);
  });

  it('1回の出撃で選択肢に出るのは、汎用と、そのマップの種族と、持ち込みの種族だけ', () => {
    expect(mapSpecies(maps[0]).sort()).toEqual(['boar', 'core', 'wyvern']);
    // 仮に、猪しか出ないマップで、飛竜を持ち込んだとする
    const build = createBuild();
    build.species = runSpecies({ areas: ['slum'] }, 'wyvern');
    expect(build.species.sort()).toEqual(['boar', 'wyvern']);
    const ids = rollImplantChoices(build, seeded(3), 99).map((d) => DATA.implants.get(d.id).species);
    expect(new Set(ids)).toEqual(new Set(['boar', 'wyvern', 'general']));
    // 種族を絞っていないとき（隠れ家など）は、すべて出る
    const all = rollImplantChoices(createBuild(), seeded(3), 99).map((d) => d.species);
    expect(new Set(all).has('core')).toBe(true);
  });

  it('ランを始めると、そのマップの種族が選択肢に出るようになる', () => {
    const r = createRun({ rng: seeded(3), mapId: 'map1' });
    expect([...r.build.species].sort()).toEqual(['boar', 'core', 'wyvern']);
  });

  it('持ち込めるのは、倒したことのあるボスの種族のうち、そのマップに元からいないもの', () => {
    const save = createSave();
    const boarOnly = { areas: ['slum'] };
    expect(carryOptions(save, boarOnly)).toEqual([]);
    save.bossKills.cryowyvern = 1;
    save.bossKills.boltboar = 2;
    expect(carryOptions(save, boarOnly)).toEqual(['wyvern']);
    // マップ1には3種族とも元からいるので、持ち込めるものはない
    save.bossKills.overload = 1;
    expect(carryOptions(save, maps[0])).toEqual([]);
  });
});

describe('ダッシュで残るダメージ床（レジェンド装備：ネオン・ハロー）', () => {
  const halo = () => ({ slot: 'acc', rarity: 3, name: 'テスト', effects: [], unique: 'neonhalo' });
  const dash = (world) => {
    updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
    for (let t = 0; t < 0.4; t += DT) updateWorld(world, DT, { ...idle, mx: 1 });
  };

  it('ダッシュした場所に床が残り、3秒たつと消える', () => {
    const world = makeWorld();
    equipItem(world, halo());
    dash(world);
    expect(world.zones.length).toBeGreaterThan(0);
    for (let t = 0; t < 3.2; t += DT) updateWorld(world, DT, idle);
    expect(world.zones).toHaveLength(0);
  });

  it('部屋をクリアしたあとにダッシュしても、床は残り続けない', () => {
    const world = makeWorld();
    equipItem(world, halo());
    world.mode = 'clear';
    dash(world);
    expect(world.zones.length).toBeGreaterThan(0);
    for (let t = 0; t < 3.2; t += DT) updateWorld(world, DT, idle);
    expect(world.zones).toHaveLength(0);
  });
});

describe('種族の新しい部品', () => {
  it('帯電刃：攻撃に電撃属性が付く', () => {
    expect(makeWorld(['voltedge']).player.stats.elements).toContain('shock');
  });

  it('帯電外皮：被弾したとき、周囲の敵に電撃ダメージ', () => {
    const world = makeWorld(['voltskin']);
    const e = addEnemy(world, 'grunt', 60);
    const hp = e.hp;
    hurtPlayer(world, 5);
    expect(e.hp).toBeLessThan(hp);
  });

  it('排熱弁：被弾したとき、周囲の敵が燃える', () => {
    const world = makeWorld(['exhaust']);
    const near = addEnemy(world, 'grunt', 60);
    const far = addEnemy(world, 'grunt', 400);
    hurtPlayer(world, 5);
    expect(near.burnT).toBeGreaterThan(0);
    expect(far.burnT).toBe(0);
  });

  it('過熱出力：燃えている敵へのダメージが増える', () => {
    const world = makeWorld(['overheat']);
    const e = addEnemy(world, 'grunt', 60);
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1);
    e.burnT = 2;
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.2);
  });

  it('凍てつく爪：減速中の敵へのダメージが増える', () => {
    const world = makeWorld(['frostclaw']);
    const e = addEnemy(world, 'grunt', 60);
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1);
    e.slowT = 2;
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.2);
  });

  it('霜の翼：ダッシュで通り抜けた敵が減速する', () => {
    const world = makeWorld(['frostwing']);
    const e = addEnemy(world, 'grunt', 50);
    updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
    for (let t = 0; t < 0.3; t += DT) updateWorld(world, DT, { ...idle, mx: 1 });
    expect(e.slowT).toBeGreaterThan(0);
  });

  it('飛竜の部品を2種類持つと、減速が長く続く', () => {
    const slowFor = (ids) => {
      const world = makeWorld(ids);
      const e = addEnemy(world, 'grunt', 60);
      hurtPlayer(world, 5); // 氷結装甲：被弾で周囲を減速
      return e.slowT;
    };
    expect(slowFor(['frostarmor'])).toBeCloseTo(STATUS.slow.duration);
    expect(slowFor(['frostarmor', 'icebreaker'])).toBeCloseTo(STATUS.slow.duration * 1.5);
  });
});

describe('インプラントの効果', () => {
  it('連鎖放電：撃破時に近くの2体へ電撃。種族ボーナスで3体（2種類）、5体（3種類）になる', () => {
    for (const [implants, expected] of [[['chain'], 2], [['chain', 'overcurrent'], 3], [['chain', 'overcurrent', 'shockdash'], 5]]) {
      const world = makeWorld(implants);
      const victim = addEnemy(world, 'drone', 60);
      const others = [0, 1, 2, 3, 4].map((i) => addEnemy(world, 'grunt', 90 + i * 10, 40));
      hitEnemy(world, victim, 9999, 1, 0, 0);
      expect(others.filter((o) => o.hp < o.maxHp)).toHaveLength(expected);
      expect(others[0].maxHp - others[0].hp).toBe(18);
    }
  });

  it('焼却弾：熱属性が付き、3秒間の継続ダメージ。種族ボーナス（3種類）で約2.5倍', () => {
    const totals = [['incendiary'], ['incendiary', 'thermal', 'blast']].map((implants) => {
      const world = makeWorld(implants);
      world.player.hp = world.player.stats.maxHp; // 熱暴走が効かないHP
      expect(world.player.stats.elements).toEqual(['heat']);
      const e = addEnemy(world, 'grunt', 300);
      e.hp = e.maxHp = 1000;
      hitEnemy(world, e, 10, 1, 0, 0);
      const after = e.hp;
      run(world, STATUS.burn.duration + 0.5);
      expect(e.burnT).toBeLessThanOrEqual(0);
      return after - e.hp;
    });
    expect(totals[0]).toBe(STATUS.burn.dps * STATUS.burn.duration);
    // 小数は当たるたびに丸めるので、ぴったり2.5倍にはならない
    expect(totals[1]).toBeGreaterThanOrEqual(totals[0] * 2.4);
    expect(totals[1]).toBeLessThanOrEqual(totals[0] * 2.7);
  });

  it('冷却コア：冷却属性が付き、当てた敵は40%遅くなる', () => {
    const world = makeWorld(['coolant']);
    const slow = addEnemy(world, 'grunt', 400, -100);
    const normal = addEnemy(world, 'grunt', 400, 100);
    hitEnemy(world, slow, 1, 1, 0, 0);
    slow.vx = slow.vy = 0;
    slow.stagger = 0;
    const d0 = [slow, normal].map((e) => Math.hypot(e.x - world.player.x, e.y - world.player.y));
    run(world, 1);
    const moved = [slow, normal].map((e, i) => d0[i] - Math.hypot(e.x - world.player.x, e.y - world.player.y));
    expect(moved[0] / moved[1]).toBeCloseTo(1 - STATUS.slow.amount, 1);
  });

  it('熱暴走：HPが50%以下のときだけ攻撃力+35%', () => {
    const world = makeWorld(['thermal']);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
    world.player.hp = 50;
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.35);
  });

  it('砕氷：減速中の敵にだけ会心率+25%', () => {
    const world = makeWorld(['icebreaker']);
    const e = addEnemy(world, 'grunt', 60);
    expect(statWith(world, 'critChance', e)).toBeCloseTo(PLAYER.critChance);
    e.slowT = 1;
    expect(statWith(world, 'critChance', e)).toBeCloseTo(PLAYER.critChance + 0.25);
  });

  it('アドレナリン回路：ダッシュ後2秒間だけ攻撃力+50%', () => {
    const world = makeWorld(['adrenaline']);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
    updateWorld(world, DT, { ...idle, dashPressed: true });
    run(world, 1);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.5);
    run(world, 1.2);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
  });

  it('雷撃ダッシュ：通り抜けた敵に電撃ダメージ（1回のダッシュで1回だけ）', () => {
    const world = makeWorld(['shockdash']);
    const e = addEnemy(world, 'grunt', 50);
    e.hp = e.maxHp = 1000;
    run(world, 0.4, { ...idle, mx: 1, dashPressed: true });
    expect(e.maxHp - e.hp).toBe(20);
  });

  it('過電流：電撃属性の攻撃で敵が止まることがある（ボスには効かない）', () => {
    const world = makeWorld(['overcurrent']);
    world.player.stats.elements = ['shock'];
    const e = addEnemy(world, 'grunt', 60);
    world.rng = () => 0.1; // 20% の抽選に当たる
    hitEnemy(world, e, 1, 1, 0, 0);
    expect(e.stopT).toBeCloseTo(0.5);
    world.player.stats.elements = [];
    const other = addEnemy(world, 'grunt', 60);
    hitEnemy(world, other, 1, 1, 0, 0);
    expect(other.stopT).toBeLessThanOrEqual(0);
  });

  it('爆炎処理：燃えている敵を倒すと周囲にダメージ', () => {
    const world = makeWorld(['blast']);
    const victim = addEnemy(world, 'drone', 60);
    const near = addEnemy(world, 'grunt', 100);
    const far = addEnemy(world, 'grunt', 400);
    victim.burnT = 1;
    hitEnemy(world, victim, 9999, 1, 0, 0);
    expect(near.maxHp - near.hp).toBe(25);
    expect(far.hp).toBe(far.maxHp);
  });

  it('氷結装甲：被弾すると周囲の敵が減速する', () => {
    const world = makeWorld(['frostarmor']);
    const e = addEnemy(world, 'grunt', 80);
    hurtPlayer(world, 5);
    expect(e.slowT).toBeGreaterThan(0);
  });

  it('ナノ修復：撃破するたびHP+2', () => {
    const world = makeWorld(['nano']);
    world.player.hp = 50;
    hitEnemy(world, addEnemy(world, 'drone', 40), 9999, 1, 0, 0);
    expect(world.player.hp).toBe(52);
  });

  it('広角ブレード：近接攻撃の角度+50%（強化で少しずつ広がる。360度が上限）', () => {
    const p = makeWorld().player;
    const angles = (world) => {
      updateWorld(world, DT, { ...idle, attackPressed: true });
      updateWorld(world, DT, idle);
      return Math.round((world.player.attack.arc * 180) / Math.PI);
    };
    expect(p.weapon.combo[0].arc).toBe(45);
    expect(angles(makeWorld())).toBe(45);
    expect(angles(makeWorld(['wideblade']))).toBe(68);
    expect(angles(makeWorld(['wideblade', 'wideblade']))).toBe(72);
    expect(angles(makeWorld(Array(100).fill('wideblade')))).toBe(360); // ありえないほど強化しても、一周まで
  });

  it('拡張ブレード：近接範囲+25%', () => {
    const world = makeWorld(['blade']);
    const e = addEnemy(world, 'turret', 105); // 通常の1段目（届く距離80+敵の半径13）では届かない
    run(world, 0.3, { ...idle, attackPressed: true, aimX: e.x, aimY: e.y });
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});

describe('レジェンドの固有効果', () => {
  function withUnique(unique) {
    const world = makeWorld();
    world.player.build.gear.acc = { slot: 'acc', rarity: 3, effects: [], unique, name: 'test' };
    recalcStats(world.player);
    return world;
  }

  it('ゼロデイ：会心が出ると次の攻撃も必ず会心', () => {
    const world = withUnique('zeroday');
    const e = addEnemy(world, 'grunt', 60);
    e.hp = e.maxHp = 10000;
    world.rng = () => 0.01; // 会心が出る
    expect(hitEnemy(world, e, 10, 1, 0, 0).crit).toBe(true);
    world.rng = () => 0.99; // 本来は会心が出ない
    expect(hitEnemy(world, e, 10, 1, 0, 0).crit).toBe(true);
    expect(hitEnemy(world, e, 10, 1, 0, 0).crit).toBe(false);
  });

  it('ネオン・ハロー：ダッシュした場所にダメージ床が3秒残る', () => {
    const world = withUnique('neonhalo');
    const e = addEnemy(world, 'grunt', 60);
    e.hp = e.maxHp = 1000;
    run(world, 0.3, { ...idle, mx: 1, dashPressed: true });
    expect(world.zones.length).toBeGreaterThan(1);
    e.x = world.zones[0].x;
    e.y = world.zones[0].y;
    e.stopT = 99; // 床の上から動かさない
    run(world, 1);
    expect(e.hp).toBeLessThan(e.maxHp);
    run(world, 3);
    expect(world.zones).toHaveLength(0);
  });

  it('ブラックアイス：冷却状態の敵を倒すと周囲が凍る', () => {
    const world = withUnique('blackice');
    const victim = addEnemy(world, 'drone', 60);
    const near = addEnemy(world, 'grunt', 120);
    victim.slowT = 1;
    hitEnemy(world, victim, 9999, 1, 0, 0);
    expect(near.stopT).toBeGreaterThan(0);
  });

  it('オーバーフロー：HP満タンのときだけ攻撃力+40%', () => {
    const world = withUnique('overflow');
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.4);
    world.player.hp -= 1;
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
  });
});

describe('装備効果', () => {
  it('攻撃速度が上がると振りが速くなり、被ダメージ軽減で受けるダメージが減る', () => {
    const world = makeWorld();
    const p = world.player;
    p.build.gear.mod = { slot: 'mod', rarity: 0, effects: [{ id: 'attackSpeed', value: 0.15 }], unique: null, name: 'm' };
    p.build.gear.armor = { slot: 'armor', rarity: 0, effects: [{ id: 'damageReduce', value: 0.1 }], unique: null, name: 'a' };
    recalcStats(p);
    updateWorld(world, DT, { ...idle, attackPressed: true });
    updateWorld(world, DT, idle);
    expect(p.attack.windup).toBeCloseTo(p.weapon.combo[0].windup / 1.15);
    hurtPlayer(world, 20);
    expect(p.hp).toBe(100 - 18);
  });

  it('属性付与の装備で弱点を突ける', () => {
    const world = makeWorld();
    const p = world.player;
    p.build.gear.mod = { slot: 'mod', rarity: 0, effects: [{ id: 'element', element: 'cold' }], unique: null, name: 'm' };
    recalcStats(p);
    const e = addEnemy(world, 'grunt', 60);
    e.def = { ...e.def, weakness: 'cold' };
    e.hp = e.maxHp = 1000;
    expect(hitEnemy(world, e, 40, 1, 0, 0)).toMatchObject({ amount: 60, weak: true });
  });
});

describe('バッグ', () => {
  const item = (slot, name, extra = {}) => ({ slot, rarity: 0, effects: [], unique: null, name, ...extra });

  it('F で足元の装備をバッグに入れる（身につけない）。6個まで', () => {
    const world = makeWorld();
    const p = world.player;
    for (let i = 0; i < 7; i++) world.loot.push({ x: p.x, y: p.y, item: item('acc', `i${i}`), t: 0 });
    for (let i = 0; i < 7; i++) {
      run(world, 0.05);
      stashFocusLoot(world);
    }
    expect(p.build.bag).toHaveLength(6);
    expect(p.build.gear.acc).toBe(null);
    expect(world.loot).toHaveLength(1); // 7個目は入らず、その場に残る
  });

  it('バッグがいっぱいのとき、E で付け替えた装備はその場に落ちる', () => {
    const world = makeWorld();
    const p = world.player;
    const old = item('armor', 'old');
    const next = item('armor', 'next');
    p.build.gear.armor = old;
    p.build.bag = Array.from({ length: 6 }, (_, i) => item('acc', `b${i}`));
    world.loot.push({ x: p.x, y: p.y, item: next, t: 0 });
    run(world, 0.05);
    equipFocusLoot(world);
    expect(p.build.gear.armor).toBe(next);
    expect(world.loot.map((l) => l.item)).toEqual([old]);
    expect(p.build.bag).toHaveLength(6);
  });

  it('ポーズ画面：バッグの装備を付けると、今の装備と入れ替わる', () => {
    const world = makeWorld();
    const p = world.player;
    const a = item('armor', 'A', { effects: [{ id: 'maxHp', value: 20 }] });
    const b = item('armor', 'B', { effects: [{ id: 'maxHp', value: 40 }] });
    p.build.gear.armor = a;
    p.build.bag = [item('acc', 'x'), b];
    recalcStats(p);
    expect(equipFromBag(world, 1)).toBe(true);
    expect(p.build.gear.armor).toBe(b);
    expect(p.build.bag.map((i) => i.name)).toEqual(['x', 'A']);
    expect(p.stats.maxHp).toBe(140);
    // 空のスロットに付けたときは、バッグから1つ減る
    equipFromBag(world, 0);
    expect(p.build.gear.acc.name).toBe('x');
    expect(p.build.bag.map((i) => i.name)).toEqual(['A']);
  });

  it('ポーズ画面：装備を外すとバッグに入る。バッグがいっぱいなら外せない', () => {
    const world = makeWorld();
    const p = world.player;
    const a = item('armor', 'A', { effects: [{ id: 'maxHp', value: 20 }] });
    p.build.gear.armor = a;
    recalcStats(p);
    p.hp = p.stats.maxHp;
    expect(unequipToBag(world, 'armor')).toBe(true);
    expect(p.build.gear.armor).toBe(null);
    expect(p.build.bag).toEqual([a]);
    expect(p.stats.maxHp).toBe(100);
    expect(p.hp).toBe(100); // 最大HPが下がったぶん、現在HPも収まる
    expect(unequipToBag(world, 'armor')).toBe(false);

    p.build.gear.mod = item('mod', 'M');
    p.build.bag = Array.from({ length: 6 }, (_, i) => item('acc', `b${i}`));
    expect(unequipToBag(world, 'mod')).toBe(false);
    expect(p.build.gear.mod).not.toBe(null);
  });

  it('ポーズ画面：バッグの装備を捨てると足元に落ちる（その部屋にいる間は拾い直せる）', () => {
    const world = makeWorld();
    const p = world.player;
    const a = item('acc', 'A');
    p.build.bag = [a];
    expect(discardFromBag(world, 0)).toBe(true);
    expect(p.build.bag).toHaveLength(0);
    expect(world.loot.map((l) => l.item)).toEqual([a]);
  });

  it('闇市やデータ金庫で装備を取ると、外した装備はバッグに入る', () => {
    const world = makeWorld();
    const p = world.player;
    const old = item('mod', 'old');
    p.build.gear.mod = old;
    equipItem(world, item('mod', 'new'));
    expect(p.build.bag).toEqual([old]);
    expect(world.loot).toHaveLength(0);
  });
});

describe('会心の表示', () => {
  it('「会心」の文字は出さず、数字の横に「!」を付ける', () => {
    const world = makeWorld();
    const e = addEnemy(world, 'grunt', 60);
    e.hp = e.maxHp = 1000;
    world.rng = () => 0.01;
    hitEnemy(world, e, 30, 1, 0, 0);
    expect(world.fx.texts.at(-1).text).toBe('60!');
    world.rng = () => 0.99;
    hitEnemy(world, e, 30, 1, 0, 0);
    expect(world.fx.texts.at(-1).text).toBe('30');
  });
});
