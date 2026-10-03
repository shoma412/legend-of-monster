import { describe, expect, it } from 'vitest';
import { LOOT, PLAYER, STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { families } from '../src/data/implants.js';
import { chooseImplant, equipFocusLoot, recalcStats } from '../src/game/build.js';
import { hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { hasAction, hasCondition, statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { addXp, rollImplantChoices, xpToNext } from '../src/logic/level.js';
import { describeItem, makeItem, rollRarity } from '../src/logic/loot.js';
import { computeStats, createBuild } from '../src/logic/stats.js';

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
    ...DATA.implants.all().map((d) => [d.id, d.effect]),
    ...DATA.legendEffects.all().map((d) => [d.id, d.effect]),
    ...Object.entries(families).filter(([, f]) => f.bonus).map(([id, f]) => [`${id}系統`, f.bonus.effect]),
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

  it('仕様どおり、インプラント16種・固有効果4種・装備効果10種がある', () => {
    expect(DATA.implants.all()).toHaveLength(16);
    expect(DATA.legendEffects.all()).toHaveLength(4);
    expect(DATA.gearEffects.all()).toHaveLength(10);
    for (const f of ['shock', 'heat', 'cold']) expect(DATA.implants.all().filter((d) => d.family === f)).toHaveLength(3);
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

  it('まだ実装していないクレジットの効果は出ない', () => {
    const rng = seeded(5);
    for (let i = 0; i < 300; i++) expect(makeItem(rng).effects.some((e) => e.id === 'credit')).toBe(false);
    expect(rollImplantChoices(createBuild(), seeded(2), 99).some((d) => d.id === 'greed')).toBe(false);
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
    expect(world.loot.map((l) => l.item)).toEqual([a]);
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

  it('重ねがけできないインプラントは、持っていると選択肢に出ない', () => {
    const build = createBuild();
    build.implants.chain = 1;
    build.implants.overclock = 1;
    const ids = rollImplantChoices(build, seeded(9), 99).map((d) => d.id);
    expect(ids).not.toContain('chain');
    expect(ids).toContain('overclock');
  });

  it('オーバークロックは重ねがけできる。装甲プレートは最大HP+25で全回復', () => {
    const world = makeWorld(['overclock', 'overclock']);
    const p = world.player;
    expect(p.stats.attackMul).toBeCloseTo(1.4);
    p.hp = 10;
    world.choice = { type: 'implant', options: [DATA.implants.get('plating')] };
    chooseImplant(world, 0);
    expect(p.stats.maxHp).toBe(125);
    expect(p.hp).toBe(125);
  });

  it('同じ系統を3つ持つと系統ボーナスが発動する', () => {
    expect(makeWorld(['chain', 'overcurrent']).player.stats.chainBonus).toBe(0);
    expect(makeWorld(['chain', 'overcurrent', 'shockdash']).player.stats.chainBonus).toBe(2);
    expect(makeWorld(['incendiary', 'thermal', 'blast']).player.stats.burnMul).toBe(2);
    expect(makeWorld(['coolant', 'frostarmor', 'icebreaker']).player.stats.freezeChance).toBeGreaterThan(0);
  });
});

describe('インプラントの効果', () => {
  it('連鎖放電：撃破時に近くの2体へ電撃。系統ボーナスで4体になる', () => {
    for (const [implants, expected] of [[['chain'], 2], [['chain', 'overcurrent', 'shockdash'], 4]]) {
      const world = makeWorld(implants);
      const victim = addEnemy(world, 'drone', 60);
      const others = [0, 1, 2, 3, 4].map((i) => addEnemy(world, 'grunt', 90 + i * 10, 40));
      hitEnemy(world, victim, 9999, 1, 0, 0);
      expect(others.filter((o) => o.hp < o.maxHp)).toHaveLength(expected);
      expect(others[0].maxHp - others[0].hp).toBe(18);
    }
  });

  it('焼却弾：熱属性が付き、3秒間の継続ダメージ。系統ボーナスで2倍', () => {
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
    expect(totals[1]).toBe(totals[0] * 2);
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
