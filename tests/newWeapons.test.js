import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { upgrades, weaponUnlocks } from '../src/data/upgrades.js';
import { recalcStats } from '../src/game/build.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { unlockWeapon } from '../src/logic/meta.js';
import { createSave } from '../src/logic/save.js';
import { upgradedWeapon, weaponTraitText } from '../src/logic/stats.js';
import { hurtPlayer } from '../src/game/combat.js';

// 新武器：槍とチャクラム（docs/詳細仕様.md「29. 新武器：槍とチャクラム」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, specialPressed: false, dashPressed: false };

function makeWorld(weaponId) {
  const world = createWorld({ waves: [{}], rng: () => 0.99, weaponId }); // 0.99：会心なし
  world.waveTimer = Infinity;
  const p = world.player;
  p.build.weaponId = weaponId;
  recalcStats(p);
  p.x = 300;
  p.y = 300;
  p.fx = 1;
  p.fy = 0;
  p.inv = Infinity;
  return world;
}

// 動かない、硬い敵を置く（プレイヤーからの位置で）
function addEnemy(world, dx, dy = 0) {
  const e = createEnemy(DATA.enemies.get('grunt'), world.player.x + dx, world.player.y + dy, 0, world.rng);
  e.def = { ...e.def, speed: 0, knockbackResist: 1 };
  e.cd = 999;
  e.hp = e.maxHp = 1000000;
  world.enemies.push(e);
  return e;
}

const lost = (e) => e.maxHp - e.hp;
const aim = (world) => ({ aimX: world.player.x + 200, aimY: world.player.y });

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, { ...input, ...aim(world) });
}

describe('槍', () => {
  const def = DATA.weapons.get('spear');

  it('ラストコア2個で解放できる。会心率 +5%、被ダメージ +5%', () => {
    expect(weaponUnlocks.find((w) => w.weapon === 'spear').cost).toEqual({ rustCore: 2 });
    const save = createSave();
    expect(unlockWeapon(save, 'spear')).toBe(false);
    save.materials.rustCore = 2;
    expect(unlockWeapon(save, 'spear')).toBe(true);
    expect(save.weapons).toContain('spear');
    expect(weaponTraitText(def)).toBe('会心率 +5%／被ダメージ +5%');
    const world = makeWorld('spear');
    expect(world.player.stats.damageTaken).toBeCloseTo(1.05);
  });

  it('突き：前へ長く届き、一直線上の敵をすべて貫く。横の敵には当たらない', () => {
    const world = makeWorld('spear');
    const near = addEnemy(world, 50);
    const far = addEnemy(world, 118);
    const side = addEnemy(world, 60, 60);
    const behind = addEnemy(world, -50);
    updateWorld(world, DT, { ...idle, ...aim(world), attack: true, attackPressed: true });
    run(world, 0.4);
    expect(lost(near)).toBe(def.combo[0].damage);
    expect(lost(far)).toBe(def.combo[0].damage);
    expect(lost(side)).toBe(0);
    expect(lost(behind)).toBe(0);
  });

  it('大剣や片手剣より、遠くまで届く。扇は、ずっと狭い', () => {
    for (const id of ['greatsword', 'sword', 'knuckle']) {
      expect(def.combo[0].range).toBeGreaterThan(Math.max(...DATA.weapons.get(id).combo.map((c) => c.range)));
    }
    expect(def.combo[0].arc).toBeLessThan(DATA.weapons.get('greatsword').combo[0].arc);
  });

  it('3段目は、威力が高く、もっと遠くまで届く', () => {
    const world = makeWorld('spear');
    const e = addEnemy(world, 60);
    const seen = [];
    let last = e.hp;
    for (let t = 0; t < 3 && seen.length < 3; t += DT) {
      updateWorld(world, DT, { ...idle, ...aim(world), attack: true, attackPressed: !world.player.attack });
      if (e.hp < last) {
        seen.push(last - e.hp);
        last = e.hp;
      }
    }
    expect(seen).toEqual(def.combo.map((c) => c.damage));
    expect(def.combo[2].range).toBeGreaterThan(def.combo[0].range);
  });

  it('突進突き：前へ踏み込み、通り道の敵すべてにダメージ。踏み込んでいる間は無敵。クールダウンがある', () => {
    const world = makeWorld('spear');
    const p = world.player;
    p.inv = 0;
    const a = addEnemy(world, 70);
    const b = addEnemy(world, 150);
    const off = addEnemy(world, 100, 120);
    const x0 = p.x;
    updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
    expect(p.thrust).toBeTruthy();
    expect(p.inv).toBeGreaterThan(0);
    // 踏み込みの途中で、移動キーを押しても、向きは変わらない
    for (let t = 0; t < 0.5; t += DT) updateWorld(world, DT, { ...idle, my: p.thrust ? 1 : 0, aimX: p.x + 200, aimY: p.y });
    expect(p.thrust).toBeNull();
    expect(Math.abs(p.x - x0 - def.special.distance)).toBeLessThan(12);
    expect(Math.abs(p.y - 300)).toBeLessThan(2);
    expect(lost(a)).toBe(def.special.damage);
    expect(lost(b)).toBe(def.special.damage);
    expect(lost(off)).toBe(0);
    expect(p.specialCd).toBeGreaterThan(def.special.cooldown - 1);
    // クールダウン中は、出ない
    updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
    expect(p.thrust).toBeFalsy();
  });

  it('突進突き：同じ敵には、1回だけ当たる。ダッシュでやめられる', () => {
    const world = makeWorld('spear');
    const e = addEnemy(world, 40);
    updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
    run(world, 0.5);
    expect(lost(e)).toBe(def.special.damage);

    const w2 = makeWorld('spear');
    updateWorld(w2, DT, { ...idle, ...aim(w2), specialPressed: true });
    expect(w2.player.thrust).toBeTruthy();
    updateWorld(w2, DT, { ...idle, ...aim(w2), mx: -1, dashPressed: true });
    expect(w2.player.thrust).toBeNull();
    expect(w2.player.dashT).toBeGreaterThan(0);
  });
});

describe('チャクラム', () => {
  const def = DATA.weapons.get('chakram');
  const rings = (world) => world.playerShots.filter((s) => s.boomerang);
  const throwing = { ...idle, attack: true, attackPressed: true };

  it('モスコア2個で解放できる。移動速度 +5%、被ダメージ +5%', () => {
    expect(weaponUnlocks.find((w) => w.weapon === 'chakram').cost).toEqual({ intakeCore: 2 });
    expect(weaponTraitText(def)).toBe('移動速度 +5%／被ダメージ +5%');
  });

  it('投げた輪は、決まった距離を飛んで、手元へ戻ってくる。戻るまで、次は投げられない', () => {
    const world = makeWorld('chakram');
    const p = world.player;
    updateWorld(world, DT, { ...throwing, ...aim(world) });
    expect(rings(world)).toHaveLength(1);
    const ring = rings(world)[0];
    let farthest = 0;
    let turned = false;
    for (let t = 0; t < 4 && rings(world).length > 0; t += DT) {
      updateWorld(world, DT, { ...throwing, ...aim(world) });
      expect(rings(world).length).toBeLessThanOrEqual(1); // 押し続けていても、2つ目は出ない
      farthest = Math.max(farthest, ring.x - p.x);
      if (ring.boomerang.phase === 'back') turned = true;
    }
    expect(turned).toBe(true);
    expect(farthest).toBeGreaterThan(def.shot.boomerang.range * 0.9);
    expect(farthest).toBeLessThan(def.shot.boomerang.range + 60);
    expect(rings(world)).toHaveLength(0);
    // 戻ったら、すぐ次を投げられる
    run(world, def.shot.interval + 0.05, throwing);
    expect(rings(world)).toHaveLength(1);
  });

  it('行きと帰りで、同じ敵に2回当たる。並んだ敵は、すべて貫く', () => {
    const world = makeWorld('chakram');
    const a = addEnemy(world, 100);
    const b = addEnemy(world, 220);
    updateWorld(world, DT, { ...throwing, ...aim(world) });
    for (let t = 0; t < 4 && rings(world).length > 0; t += DT) updateWorld(world, DT, { ...idle, ...aim(world) });
    expect(lost(a)).toBe(def.shot.damage * 2);
    expect(lost(b)).toBe(def.shot.damage * 2);
  });

  it('壁に当たっても、消えずに戻ってくる', () => {
    const world = makeWorld('chakram');
    const p = world.player;
    p.x = world.bounds.right - 60;
    updateWorld(world, DT, { ...throwing, aimX: p.x + 200, aimY: p.y });
    const ring = rings(world)[0];
    for (let t = 0; t < 0.4 && rings(world).length > 0; t += DT) {
      updateWorld(world, DT, { ...idle, aimX: p.x + 200, aimY: p.y });
      expect(ring.x).toBeLessThanOrEqual(world.bounds.right);
    }
    expect(ring.boomerang.phase).toBe('back');
  });

  it('自分が動いても、輪は今いる場所へ戻ってくる', () => {
    const world = makeWorld('chakram');
    const p = world.player;
    updateWorld(world, DT, { ...throwing, ...aim(world) });
    for (let t = 0; t < 4 && rings(world).length > 0; t += DT) updateWorld(world, DT, { ...idle, my: 1, aimX: p.x + 200, aimY: p.y });
    expect(rings(world)).toHaveLength(0);
    expect(p.y).toBeGreaterThan(320);
  });

  it('設置：少し前に、回り続ける輪を置く。中の敵を削り続け、5秒で消える。置いたあとも、輪を投げられる', () => {
    const world = makeWorld('chakram');
    const p = world.player;
    const inside = addEnemy(world, def.special.offset);
    const outside = addEnemy(world, def.special.offset, 200);
    updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
    expect(world.zones).toHaveLength(1);
    expect(world.zones[0].x).toBeCloseTo(p.x + def.special.offset, 0);
    expect(p.specialCd).toBeGreaterThan(def.special.cooldown - 1);
    run(world, 1);
    const afterOne = lost(inside);
    expect(afterOne).toBeGreaterThanOrEqual(def.special.damage * 3);
    expect(lost(outside)).toBe(0);
    run(world, def.special.life);
    expect(world.zones).toHaveLength(0);
    expect(lost(inside)).toBeGreaterThan(afterOne);
    // 置いた直後でも、輪は投げられる
    const w2 = makeWorld('chakram');
    updateWorld(w2, DT, { ...idle, ...aim(w2), specialPressed: true });
    updateWorld(w2, DT, { ...throwing, ...aim(w2) });
    expect(rings(w2)).toHaveLength(1);
  });

  it('攻撃速度が上がると、輪が速く飛ぶ', () => {
    const speedOf = (bonus) => {
      const world = makeWorld('chakram');
      world.player.stats = { ...world.player.stats, attackSpeed: bonus };
      updateWorld(world, DT, { ...throwing, ...aim(world) });
      const s = rings(world)[0];
      return Math.hypot(s.vx, s.vy);
    };
    expect(speedOf(0.5) / speedOf(0)).toBeCloseTo(1.5);
  });
});

describe('ドローンユニット', () => {
  const def = DATA.weapons.get('drone');
  const alive = (world) => world.player.drones.filter((d) => d.alive).length;

  it('マップ7の5ボスの素材で解放できる。最初から子機を2機持っていて、上限は4機', () => {
    const save = createSave();
    expect(weaponUnlocks.find((w) => w.weapon === 'drone').cost).toEqual({ gateCore: 2, archiveCore: 2, fabCore: 2, cogCore: 2, noiseCore: 2 });
    save.materials = { gateCore: 2, archiveCore: 2, fabCore: 2, cogCore: 2, noiseCore: 1 };
    expect(unlockWeapon(save, 'drone')).toBe(false); // 5種類そろっていないと解放できない
    save.materials.noiseCore = 2;
    expect(unlockWeapon(save, 'drone')).toBe(true);
    const world = makeWorld('drone');
    run(world, 0.2);
    expect(world.player.drones).toHaveLength(2);
    expect(weaponTraitText(def)).toContain('被ダメージ −5%');
    world.player.stats = { ...world.player.stats, droneCount: 1 };
    run(world, 0.1);
    expect(world.player.drones).toHaveLength(3);
    world.player.stats = { ...world.player.stats, droneCount: 9 };
    run(world, 0.1);
    expect(world.player.drones).toHaveLength(4);
  });

  it('子機が、近くの敵を自動で撃つ。遠い敵は撃たない', () => {
    const world = makeWorld('drone');
    const near = addEnemy(world, 150);
    const far = addEnemy(world, 700, 200);
    run(world, 2);
    expect(lost(near)).toBeGreaterThanOrEqual(def.drones.damage * 4);
    expect(lost(far)).toBe(0);
  });

  it('「拡張ブレード」で子機が増え、「広角ブレード」で2発撃つ', () => {
    const world = makeWorld('drone');
    const p = world.player;
    p.build.implants = { blade: 1 };
    recalcStats(p);
    expect(p.stats.droneCount).toBe(1);
    const wide = makeWorld('drone');
    wide.player.build.implants = { wideblade: 1 };
    recalcStats(wide.player);
    const shots = (w) => {
      addEnemy(w, 150);
      run(w, 0.05);
      return w.playerShots.length;
    };
    expect(shots(wide)).toBe(2 * shots(makeWorld('drone')));
  });

  it('敵の攻撃を受けると、自分の代わりに子機が1機壊れ、4秒で戻る。全部壊れると、自分が受ける', () => {
    const world = makeWorld('drone');
    const p = world.player;
    run(world, 0.1);
    p.inv = 0;
    const hp = p.hp;
    expect(hurtPlayer(world, 20)).toBe(true);
    expect(p.hp).toBe(hp);
    expect(alive(world)).toBe(1);
    p.inv = 0;
    hurtPlayer(world, 20);
    expect(alive(world)).toBe(0);
    expect(p.hp).toBe(hp);
    p.inv = 0;
    hurtPlayer(world, 20);
    expect(p.hp).toBeLessThan(hp);
    run(world, def.drones.respawn + 0.2);
    expect(alive(world)).toBe(2);
  });

  it('帰還シールド：0.5秒は攻撃を受けず、終わると子機が突撃して、通り道の敵に1機ずつ当たる', () => {
    const world = makeWorld('drone');
    const p = world.player;
    run(world, 0.2);
    const e = addEnemy(world, 220);
    const before = lost(e);
    updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
    expect(p.shield).toBeTruthy();
    expect(p.specialCd).toBeGreaterThan(def.special.cooldown - 1);
    p.inv = 0; // シールドの無敵だけを調べる
    updateWorld(world, DT, { ...idle, ...aim(world) });
    expect(p.inv).toBeGreaterThan(0);
    run(world, def.special.shield + def.special.charge.duration + 0.2);
    expect(p.shield).toBeNull();
    expect(lost(e) - before).toBeGreaterThanOrEqual(def.special.charge.damage * 2);
  });

  it('子機が1機もいないときは、帰還シールドは出ない', () => {
    const world = makeWorld('drone');
    run(world, 0.1);
    for (const d of world.player.drones) d.alive = false;
    updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
    expect(world.player.shield).toBeNull();
  });

  it('恒久強化「増設ラック」で子機が増え、「強襲プログラム」で突撃が強くなる', () => {
    const rack = upgrades.find((u) => u.id === 'droneRack');
    expect(rack.max).toBe(2);
    expect(rack.perLevel.mods).toEqual([{ stat: 'droneCount', add: 1 }]);
    const mod = upgrades.find((u) => u.id === 'wm-drone').perLevel.weaponMod;
    const upgraded = upgradedWeapon(def, mod);
    expect(upgraded.special.cooldown).toBe(4);
    expect(upgraded.special.charge.damage).toBe(55);
  });
});
