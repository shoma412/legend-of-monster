import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { weaponUnlocks } from '../src/data/upgrades.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, specialPressed: false, dashPressed: false };

function makeWorld(weaponId, implants = []) {
  const world = createWorld({ weaponId, waves: [{}], rng: () => 0.5 });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  return world;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, typeof input === 'function' ? input(t) : input);
}

function addEnemy(world, id, dx, dy = 0) {
  const p = world.player;
  const e = createEnemy(DATA.enemies.get(id), p.x + dx, p.y + dy, 0, world.rng);
  e.cd = 99;
  e.hp = e.maxHp = 100000;
  world.enemies.push(e);
  return e;
}

describe('武器の定義', () => {
  it('5種類あり、どれも隠れ家の武器ラックに並ぶ', () => {
    expect(DATA.weapons.ids()).toEqual(['greatsword', 'sword', 'gun', 'knuckle', 'cannon']);
    expect(weaponUnlocks.map((w) => w.weapon)).toEqual(DATA.weapons.ids());
    for (const w of DATA.weapons.all()) expect(w.special.hint, w.id).toBeTruthy();
  });
});

describe('片手剣', () => {
  it('速い4段コンボで、4段目だけ威力1.5倍', () => {
    const world = makeWorld('sword');
    const e = addEnemy(world, 'grunt', 40);
    const seen = [];
    let last = e.hp;
    for (let t = 0; t < 3 && seen.length < 5; t += DT) {
      e.x = world.player.x + 40;
      e.y = world.player.y;
      updateWorld(world, DT, { ...idle, attackPressed: true });
      if (e.hp !== last) {
        seen.push(last - e.hp);
        last = e.hp;
      }
    }
    expect(seen).toEqual([12, 12, 12, 18, 12]);
  });

  it('大剣より手数が多い（同じ時間で多く振れる）', () => {
    const swings = ['sword', 'greatsword'].map((id) => {
      const world = makeWorld(id);
      let n = 0;
      let prev = null;
      for (let t = 0; t < 3; t += DT) {
        updateWorld(world, DT, { ...idle, attackPressed: true });
        if (world.player.attack && world.player.attack !== prev) n++;
        prev = world.player.attack;
      }
      return n;
    });
    expect(swings[0]).toBeGreaterThan(swings[1] * 1.5);
  });

  it('長押ししても溜めにならない', () => {
    const world = makeWorld('sword');
    run(world, 1.5, { ...idle, attack: true });
    expect(world.player.charge).toBe(null);
  });

  it('ジャストガード：右クリックで少しの間だけ構え、その間に攻撃を受けると無効化して反撃する', () => {
    const world = makeWorld('sword');
    const p = world.player;
    const special = p.weapon.special;
    const near = addEnemy(world, 'grunt', 60);
    const far = addEnemy(world, 'grunt', 300);
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.guard).not.toBe(null);
    expect(p.specialCd).toBeCloseTo(special.cooldown, 1);

    expect(hurtPlayer(world, 30)).toBe(true); // 受けた（が、無効化された）
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(p.guard).toBe(null);
    expect(near.maxHp - near.hp).toBe(special.counter.damage);
    expect(far.hp).toBe(far.maxHp);
    // 成功するとクールダウンが短くなり、少しの間は無敵
    expect(p.specialCd).toBeLessThanOrEqual(special.successCooldown);
    expect(hurtPlayer(world, 30)).toBe(false);
  });

  it('構えが終わってから攻撃を受けると、普通にダメージを受ける。クールダウン中は構えられない', () => {
    const world = makeWorld('sword');
    const p = world.player;
    updateWorld(world, DT, { ...idle, specialPressed: true });
    run(world, p.weapon.special.window + 0.05);
    expect(p.guard).toBe(null);
    hurtPlayer(world, 30);
    expect(p.hp).toBe(PLAYER.maxHp - 30);

    p.inv = 0;
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.guard).toBe(null); // まだクールダウン中
    run(world, p.weapon.special.cooldown);
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.guard).not.toBe(null);
  });

  it('敵の弾もジャストガードで消せる', () => {
    const world = makeWorld('sword');
    const p = world.player;
    world.shots.push({ x: p.x + 30, y: p.y, vx: -300, vy: 0, r: 5, damage: 10, life: 3 });
    updateWorld(world, DT, { ...idle, specialPressed: true });
    run(world, 0.2);
    expect(world.shots).toHaveLength(0);
    expect(p.hp).toBe(PLAYER.maxHp);
  });
});

describe('銃', () => {
  it('押している間、カーソルの方向に撃ち続ける。弾は当たるとダメージを与えて消える', () => {
    const world = makeWorld('gun');
    const p = world.player;
    const shot = p.weapon.shot;
    const e = addEnemy(world, 'grunt', 300);
    run(world, 1, { ...idle, attack: true, aimX: e.x, aimY: e.y });
    const fired = Math.round((e.maxHp - e.hp) / shot.damage);
    expect(fired).toBeGreaterThanOrEqual(2);
    expect(fired).toBeLessThanOrEqual(Math.ceil(1 / shot.interval));
    run(world, 1);
    expect(world.playerShots).toHaveLength(0);
  });

  it('遠くの敵に当たる（近接の届かない距離）。背後には飛ばない', () => {
    const world = makeWorld('gun');
    const front = addEnemy(world, 'turret', 400);
    const back = addEnemy(world, 'turret', -60);
    run(world, 1.5, { ...idle, attack: true, aimX: front.x, aimY: front.y });
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(back.hp).toBe(back.maxHp);
  });

  it('弾は壁で消える', () => {
    const world = makeWorld('gun');
    updateWorld(world, DT, { ...idle, attack: true, aimX: 0, aimY: world.player.y });
    expect(world.playerShots).toHaveLength(1);
    run(world, 1);
    expect(world.playerShots).toHaveLength(0);
  });

  it('拡散射撃：右クリックで5方向に同時に撃つ。クールダウン制', () => {
    const world = makeWorld('gun');
    const p = world.player;
    const special = p.weapon.special;
    updateWorld(world, DT, { ...idle, specialPressed: true, aimX: p.x + 100, aimY: p.y });
    expect(world.playerShots).toHaveLength(special.count);
    const angles = world.playerShots.map((s) => (Math.atan2(s.vy, s.vx) * 180) / Math.PI);
    [-25, -12.5, 0, 12.5, 25].forEach((want, i) => expect(angles[i]).toBeCloseTo(want));
    expect(p.specialCd).toBeCloseTo(special.cooldown, 1);
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(world.playerShots).toHaveLength(special.count);
  });

  it('拡張ブレード：弾が1体貫通する', () => {
    for (const [implants, hitBoth] of [[[], false], [['blade'], true]]) {
      const world = makeWorld('gun', implants);
      const a = addEnemy(world, 'grunt', 100);
      const b = addEnemy(world, 'grunt', 180);
      updateWorld(world, DT, { ...idle, attack: true, aimX: a.x, aimY: a.y });
      a.stopT = b.stopT = 99;
      run(world, 1);
      expect(a.hp).toBeLessThan(a.maxHp);
      expect(b.hp < b.maxHp).toBe(hitBoth);
    }
  });

  it('広角ブレード：拡散射撃の広がりが大きくなる', () => {
    const world = makeWorld('gun', ['wideblade']);
    const p = world.player;
    updateWorld(world, DT, { ...idle, specialPressed: true, aimX: p.x + 100, aimY: p.y });
    const angles = world.playerShots.map((s) => (Math.atan2(s.vy, s.vx) * 180) / Math.PI);
    expect(Math.max(...angles) - Math.min(...angles)).toBeCloseTo(p.weapon.special.angle * 1.5);
  });

  it('攻撃速度が上がると、撃つ間隔が短くなる', () => {
    const counts = [0, 0.5].map((bonus) => {
      const world = makeWorld('gun');
      world.player.stats.attackSpeed = bonus;
      let n = 0;
      for (let t = 0; t < 3; t += DT) {
        const before = world.playerShots.length;
        updateWorld(world, DT, { ...idle, attack: true, aimX: 900, aimY: world.player.y });
        if (world.playerShots.length > before) n++;
      }
      return n;
    });
    expect(counts[1]).toBeGreaterThan(counts[0]);
  });
});

describe('大剣（変わっていないこと）', () => {
  it('右クリックでは何も起きない。溜め斬りは左クリック長押しのまま', () => {
    const world = makeWorld('greatsword');
    const p = world.player;
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.attack).toBe(null);
    expect(p.charge).toBe(null);
    expect(p.guard).toBe(null);
    run(world, 0.5, { ...idle, attack: true });
    expect(p.charge.stage).toBeGreaterThanOrEqual(0);
  });
});

describe('大剣の奥義', () => {
  // 奥義を買った状態の部屋
  function ougiWorld() {
    const world = makeWorld('greatsword');
    world.player.build.ougi = ['greatsword'];
    return world;
  }
  const ougi = DATA.weapons.get('greatsword').ougi;
  const right = { ...idle, specialPressed: true };

  it('残りHPが20%以下のときだけ、右クリックで出せる', () => {
    const world = ougiWorld();
    const p = world.player;
    const e = addEnemy(world, 'grunt', 150);
    p.hp = p.stats.maxHp * 0.21;
    updateWorld(world, DT, right);
    expect(e.hp).toBe(e.maxHp);
    expect(p.build.ougiUsed).toBe(false);

    p.hp = p.stats.maxHp * 0.2;
    updateWorld(world, DT, right);
    expect(e.maxHp - e.hp).toBe(ougi.damage * ougi.multiplier); // 120 × 1.75 = 210
    expect(p.build.ougiUsed).toBe(true);
  });

  it('自分を中心とした広い円の中の敵すべてに当たる。円の外には当たらない', () => {
    const world = ougiWorld();
    const p = world.player;
    p.x = 480;
    p.y = 270;
    const inside = [addEnemy(world, 'grunt', 200), addEnemy(world, 'grunt', -200), addEnemy(world, 'grunt', 0, 200), addEnemy(world, 'grunt', 0, -200)];
    const outside = addEnemy(world, 'grunt', 320);
    p.hp = 10;
    updateWorld(world, DT, right);
    for (const e of inside) expect(e.hp).toBeLessThan(e.maxHp);
    expect(outside.hp).toBe(outside.maxHp);
  });

  it('1つのエリアで1回だけ。次のエリアに進むと、また使える', () => {
    const world = ougiWorld();
    const p = world.player;
    const e = addEnemy(world, 'grunt', 150);
    p.hp = 10;
    updateWorld(world, DT, right);
    const after = e.hp;
    run(world, 1);
    e.x = p.x + 150;
    p.hp = 10;
    updateWorld(world, DT, right);
    expect(e.hp).toBe(after); // 2回目は出ない
  });

  it('恒久強化を買っていないと出せない。ほかの武器でも出せない', () => {
    const world = makeWorld('greatsword');
    const e = addEnemy(world, 'grunt', 150);
    world.player.hp = 10;
    updateWorld(world, DT, right);
    expect(e.hp).toBe(e.maxHp);

    const sword = makeWorld('sword');
    sword.player.build.ougi = ['greatsword'];
    sword.player.hp = 10;
    updateWorld(sword, DT, right);
    expect(sword.player.build.ougiUsed).toBe(false);
    expect(sword.player.guard).not.toBe(null); // 片手剣の右クリックはジャストガードのまま
  });

  it('シールド兵の盾でも防げない。使った瞬間は少しだけ無敵', () => {
    const world = ougiWorld();
    const p = world.player;
    const e = addEnemy(world, 'shield', 150);
    e.facing = Math.PI;
    p.hp = 10;
    updateWorld(world, DT, right);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(hurtPlayer(world, 50)).toBe(false);
  });
});

describe('ナックル（2026-10-07 追加）', () => {
  const knuckle = DATA.weapons.get('knuckle');
  const special = knuckle.special;
  // 敵を目の前に置いたまま、押しっぱなしで殴り続ける
  const punch = (world, e, seconds, extra = {}) => {
    for (let t = 0; t < seconds; t += DT) {
      e.x = world.player.x + 30;
      e.y = world.player.y;
      updateWorld(world, DT, { ...idle, attack: true, ...extra });
    }
  };

  it('射程はいちばん短い。押している間、殴り続ける（クリックし直さなくてよい）', () => {
    const reach = (w) => Math.max(...w.combo.map((c) => c.range));
    for (const id of ['greatsword', 'sword']) expect(reach(knuckle)).toBeLessThan(reach(DATA.weapons.get(id)));
    const world = makeWorld('knuckle');
    const e = addEnemy(world, 'grunt', 30);
    const seen = [];
    let last = e.hp;
    for (let t = 0; t < 2 && seen.length < 6; t += DT) {
      e.x = world.player.x + 30;
      e.y = world.player.y;
      updateWorld(world, DT, { ...idle, attack: true }); // attackPressed は出していない
      if (e.hp !== last) {
        seen.push(last - e.hp);
        last = e.hp;
      }
    }
    expect(seen).toEqual([8, 8, 8, 13, 8, 8]);
  });

  it('同じ時間で、片手剣より多く殴れる', () => {
    const hits = ['knuckle', 'sword'].map((id) => {
      const world = makeWorld(id);
      const e = addEnemy(world, 'grunt', 30);
      let count = 0;
      let last = e.hp;
      for (let t = 0; t < 3; t += DT) {
        e.x = world.player.x + 30;
        e.y = world.player.y;
        updateWorld(world, DT, { ...idle, attack: true, attackPressed: true });
        if (e.hp !== last) {
          count++;
          last = e.hp;
        }
      }
      return count;
    });
    expect(hits[0]).toBeGreaterThan(hits[1] * 1.3);
  });

  it('当てるとゲージが溜まる（フックは多め）。空振りでは溜まらない', () => {
    const empty = makeWorld('knuckle');
    run(empty, 1, { ...idle, attack: true }); // 敵がいない
    expect(empty.player.gauge).toBe(0);
    const world = makeWorld('knuckle');
    const p = world.player;
    const e = addEnemy(world, 'grunt', 30);
    let last = e.hp;
    const gains = [];
    for (let t = 0; t < 2 && gains.length < 4; t += DT) {
      e.x = p.x + 30;
      e.y = p.y;
      const before = p.gauge;
      updateWorld(world, DT, { ...idle, attack: true });
      if (e.hp !== last) {
        gains.push(p.gauge - before);
        last = e.hp;
      }
    }
    expect(gains).toEqual([special.gain, special.gain, special.gain, special.gainHeavy]);
  });

  it('ゲージが満タンでないと、右クリックしても出ない', () => {
    const world = makeWorld('knuckle');
    const p = world.player;
    const e = addEnemy(world, 'grunt', 30);
    p.gauge = special.gaugeMax - 1;
    updateWorld(world, DT, { ...idle, specialPressed: true });
    expect(p.attack).toBeNull();
    expect(e.hp).toBe(e.maxHp);
    expect(p.gauge).toBe(special.gaugeMax - 1);
  });

  it('満タンで右クリックすると、バーストブロー：踏み込んで強烈な一撃。ゲージを全部使い、その間は無敵', () => {
    const world = makeWorld('knuckle');
    const p = world.player;
    const e = addEnemy(world, 'grunt', 60);
    p.gauge = special.gaugeMax;
    p.fx = 1;
    p.fy = 0;
    const x = p.x;
    updateWorld(world, DT, { ...idle, specialPressed: true, aimX: p.x + 300, aimY: p.y });
    expect(p.gauge).toBe(0);
    expect(p.attack?.burst).toBe(true);
    expect(hurtPlayer(world, 10)).toBe(false); // 無敵
    run(world, 0.5);
    expect(e.maxHp - e.hp).toBe(special.blow.damage);
    expect(p.x).toBeCloseTo(x); // もう届く敵がいるので、踏み込まない（近接攻撃の踏み込みの決まり）
    expect(p.gauge).toBe(0); // バーストブローそのものでは、ゲージは溜まらない
    // 届く敵がいないときは、前に踏み込む
    const w2 = makeWorld('knuckle');
    w2.player.gauge = special.gaugeMax;
    const x2 = w2.player.x;
    updateWorld(w2, DT, { ...idle, specialPressed: true, aimX: w2.player.x + 300, aimY: w2.player.y });
    run(w2, 0.5);
    expect(w2.player.x).toBeGreaterThan(x2 + special.blow.lunge * 0.8);
    // 大剣の通常攻撃のどれよりも強い
    expect(special.blow.damage).toBeGreaterThan(Math.max(...DATA.weapons.get('greatsword').combo.map((c) => c.damage)));
  });

  it('しばらく当てないでいると、ゲージは減っていく。当てている間は減らない', () => {
    const world = makeWorld('knuckle');
    const p = world.player;
    p.gauge = 50;
    run(world, special.hold - 0.2);
    expect(p.gauge).toBe(50);
    run(world, 1.2);
    expect(p.gauge).toBeLessThan(50 - special.decay * 0.8);
    expect(p.gauge).toBeGreaterThan(0);
    run(world, 5);
    expect(p.gauge).toBe(0);

    const w2 = makeWorld('knuckle');
    const e = addEnemy(w2, 'grunt', 30);
    punch(w2, e, special.hold + 2);
    expect(w2.player.gauge).toBe(special.gaugeMax);
  });

  it('殴り続けて満タンになるまでは、4秒前後', () => {
    const world = makeWorld('knuckle');
    const e = addEnemy(world, 'grunt', 30);
    let t = 0;
    for (; t < 20 && world.player.gauge < special.gaugeMax; t += DT) {
      e.x = world.player.x + 30;
      e.y = world.player.y;
      updateWorld(world, DT, { ...idle, attack: true });
    }
    expect(t).toBeGreaterThan(2.5);
    expect(t).toBeLessThan(5.5);
  });

  it('ステータス：移動速度 +10%、被ダメージ +5%。解放はサーペントコア2個', () => {
    expect(knuckle.mods).toEqual([{ stat: 'moveSpeedMul', add: 0.1 }, { stat: 'damageTaken', add: 0.05 }]);
    expect(weaponUnlocks.find((w) => w.weapon === 'knuckle').cost).toEqual({ serpentCore: 2 });
  });
});

describe('大砲（2026-10-07 追加）', () => {
  const cannon = DATA.weapons.get('cannon');
  const greatsword = DATA.weapons.get('greatsword');
  const aimRight = (world) => ({ aimX: world.player.x + 400, aimY: world.player.y });

  it('1発の威力は、大剣の通常攻撃のどれよりも高い。徹甲砲撃は、大剣の溜め斬りの最大より高い', () => {
    expect(cannon.shot.damage).toBeGreaterThan(Math.max(...greatsword.combo.map((c) => c.damage)));
    const chargeMax = greatsword.special.damage * Math.max(...greatsword.special.stages.map((s) => s.multiplier));
    expect(cannon.special.shot.damage).toBeGreaterThan(chargeMax);
  });

  it('移動速度がいちばん遅い（−30%）。解放はクラブコア2個', () => {
    expect(cannon.mods).toEqual([{ stat: 'moveSpeedMul', add: -0.3 }]);
    for (const w of DATA.weapons.all()) {
      const speed = (w.mods ?? []).filter((m) => m.stat === 'moveSpeedMul').reduce((s, m) => s + m.add, 0);
      if (w.id !== 'cannon') expect(speed, w.id).toBeGreaterThan(-0.3);
    }
    expect(weaponUnlocks.find((w) => w.weapon === 'cannon').cost).toEqual({ crabCore: 2 });
  });

  it('撃つ間隔は長い：同じ時間で、銃よりずっと少ない弾数になる', () => {
    const count = (id) => {
      const world = makeWorld(id);
      let shots = 0;
      let last = 0;
      for (let t = 0; t < 4; t += DT) {
        updateWorld(world, DT, { ...idle, attack: true, ...aimRight(world) });
        if (world.playerShots.length > last) shots += world.playerShots.length - last;
        last = world.playerShots.length;
      }
      return shots;
    };
    expect(count('cannon')).toBeLessThanOrEqual(4);
    expect(count('gun')).toBeGreaterThan(count('cannon') * 3);
  });

  it('砲弾が当たると、その敵に弾のダメージ、まわりの敵に爆発のダメージ。離れた敵には届かない', () => {
    const world = makeWorld('cannon');
    const hit = addEnemy(world, 'grunt', 160);
    const near = addEnemy(world, 'grunt', 160 + 50, 30);
    const far = addEnemy(world, 'grunt', 160, 220);
    for (const e of [hit, near, far]) e.def = { ...e.def, speed: 0 };
    updateWorld(world, DT, { ...idle, attack: true, attackPressed: true, ...aimRight(world) });
    run(world, 1);
    expect(hit.maxHp - hit.hp).toBe(cannon.shot.damage);
    expect(near.maxHp - near.hp).toBe(cannon.shot.explode.damage);
    expect(far.hp).toBe(far.maxHp);
  });

  it('撃つと反動で後ろへ下がり、しばらく足が遅くなる', () => {
    const world = makeWorld('cannon');
    const p = world.player;
    p.x = 400;
    const x = p.x;
    updateWorld(world, DT, { ...idle, attack: true, attackPressed: true, ...aimRight(world) });
    run(world, 0.2);
    expect(x - p.x).toBeGreaterThan(cannon.shot.recoil * 0.7);
    expect(x - p.x).toBeLessThan(cannon.shot.recoil * 1.4);
    expect(p.firingT).toBeGreaterThan(0);
  });

  it('徹甲砲撃：溜めている間は撃てず、溜まりきると、敵をすべて貫く砲弾が出る。クールダウンに入る', () => {
    const world = makeWorld('cannon');
    const p = world.player;
    const special = cannon.special;
    const line = [120, 200, 280, 360].map((dx) => {
      const e = addEnemy(world, 'grunt', dx);
      e.def = { ...e.def, speed: 0 };
      return e;
    });
    updateWorld(world, DT, { ...idle, specialPressed: true, ...aimRight(world) });
    expect(p.siege).not.toBeNull();
    run(world, special.charge - 0.15, { ...idle, attack: true, ...aimRight(world) });
    expect(world.playerShots).toHaveLength(0); // 溜めている間は、ふつうの弾も出ない
    for (const e of line) expect(e.hp).toBe(e.maxHp);
    run(world, 0.2, { ...idle, ...aimRight(world) });
    expect(p.siege).toBeNull();
    expect(p.specialCd).toBeGreaterThan(special.cooldown - 0.5);
    run(world, 1, { ...idle, ...aimRight(world) });
    for (const e of line) expect(e.maxHp - e.hp).toBe(special.shot.damage); // 4体とも貫く
  });

  it('溜めはダッシュでやめられる。そのときはクールダウンに入らない', () => {
    const world = makeWorld('cannon');
    const p = world.player;
    updateWorld(world, DT, { ...idle, specialPressed: true, ...aimRight(world) });
    expect(p.siege).not.toBeNull();
    updateWorld(world, DT, { ...idle, mx: -1, dashPressed: true });
    expect(p.siege).toBeNull();
    expect(p.specialCd).toBeLessThanOrEqual(0);
    run(world, 2);
    expect(world.playerShots).toHaveLength(0);
  });

  it('銃の弾は、今までどおり爆発しない', () => {
    const world = makeWorld('gun');
    const hit = addEnemy(world, 'grunt', 160);
    const near = addEnemy(world, 'grunt', 160 + 40, 30);
    for (const e of [hit, near]) e.def = { ...e.def, speed: 0 };
    updateWorld(world, DT, { ...idle, attack: true, attackPressed: true, ...aimRight(world) });
    run(world, 0.2);
    expect(hit.hp).toBeLessThan(hit.maxHp);
    expect(near.hp).toBe(near.maxHp);
  });

  it('大砲だけ、ダッシュが遅い：進む距離は同じで、かかる時間が延びる。無敵の時間は同じ', () => {
    const dash = (id) => {
      const world = makeWorld(id);
      const p = world.player;
      p.x = 480;
      const x = p.x;
      updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
      const inv = p.inv;
      let time = DT;
      while (p.dashT > 0) {
        updateWorld(world, DT, idle);
        time += DT;
      }
      return { distance: p.x - x, time, inv };
    };
    const slow = dash('cannon');
    const normal = dash('gun');
    expect(slow.time).toBeGreaterThan(normal.time * 1.4);
    expect(slow.distance).toBeGreaterThan(normal.distance * 0.9);
    expect(slow.distance).toBeLessThan(normal.distance * 1.15);
    expect(slow.inv).toBe(normal.inv);
    // ほかの武器は、今までどおり
    for (const id of ['greatsword', 'sword', 'knuckle']) expect(DATA.weapons.get(id).dashSpeed).toBeUndefined();
    expect(cannon.dashSpeed).toBe(0.6);
  });
});

describe('ガードの上からのダメージ（2026-10-07 追加）', () => {
  // 盾をこちらに向けたシールド兵に、正面から 100 の攻撃を当てる
  const frontHit = (weaponId, options) => {
    const world = makeWorld(weaponId);
    const e = addEnemy(world, 'shield', 100);
    e.facing = Math.PI; // 左（プレイヤーの方）を向いている
    world.rng = () => 0.99; // 会心なし
    const result = hitEnemy(world, e, 100, 1, 0, 400, options);
    return { result, lost: e.maxHp - e.hp, e, world };
  };

  it('大剣と大砲は、盾で防がれても 50% のダメージが通る', () => {
    for (const id of ['greatsword', 'cannon']) {
      expect(DATA.weapons.get(id).guardBreak).toBe(0.5);
      const { result, lost } = frontHit(id);
      expect(lost, id).toBe(50);
      expect(result.amount, id).toBe(50);
      expect(result.blocked, id).toBeFalsy();
    }
  });

  it('片手剣・銃・ナックルは、今までどおり完全に防がれる', () => {
    for (const id of ['sword', 'gun', 'knuckle']) {
      expect(DATA.weapons.get(id).guardBreak).toBeUndefined();
      const { result, lost } = frontHit(id);
      expect(lost, id).toBe(0);
      expect(result.blocked, id).toBe(true);
    }
  });

  it('背後からの攻撃や、盾が開いている間は、どの武器でも 100% 通る。奥義など「防げない攻撃」も 100%', () => {
    const world = makeWorld('greatsword');
    world.rng = () => 0.99;
    const e = addEnemy(world, 'shield', 100);
    e.facing = Math.PI;
    expect(hitEnemy(world, e, 100, -1, 0, 0).amount).toBe(100); // 背後から
    e.shieldOpen = true;
    expect(hitEnemy(world, e, 100, 1, 0, 0).amount).toBe(100);
    e.shieldOpen = false;
    expect(hitEnemy(world, e, 100, 1, 0, 0, { unblockable: true }).amount).toBe(100);
  });

  it('ボスの甲羅（タンククラブ）にも、同じように半分通る', () => {
    const world = makeWorld('cannon');
    world.rng = () => 0.99;
    const crab = { def: DATA.bosses.get('tankcrab'), boss: true, x: world.player.x + 150, y: world.player.y, r: 46, hp: 5000, maxHp: 5000, facing: Math.PI, stopT: 0, slowT: 0, burnT: 0, hit: 0, vx: 0, vy: 0 };
    world.enemies.push(crab);
    expect(hitEnemy(world, crab, 100, 1, 0, 0).amount).toBe(50);
    world.player.weapon = DATA.weapons.get('gun');
    expect(hitEnemy(world, crab, 100, 1, 0, 0).blocked).toBe(true);
  });
});
