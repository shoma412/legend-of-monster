import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { recalcStats } from '../src/game/build.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, enterRoom } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { permanentBonuses } from '../src/logic/meta.js';
import { createSave } from '../src/logic/save.js';
import { createBuild, upgradedWeapon, weaponFor } from '../src/logic/stats.js';

// 武器ごとの恒久強化（docs/詳細仕様.md「23. スキルツリー」）と、武器の強さの調整

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, specialPressed: false, dashPressed: false };

// その強化を取ったセーブデータで作った、武器の定義
function modded(upgradeId, weaponId) {
  const save = createSave();
  save.upgrades[upgradeId] = 1;
  return weaponFor(createBuild(permanentBonuses(save)), weaponId);
}

function makeWorld(weaponId, upgradeId = null) {
  const save = createSave();
  if (upgradeId) save.upgrades[upgradeId] = 1;
  const build = createBuild(permanentBonuses(save));
  build.weaponId = weaponId;
  const world = createWorld({ waves: [{}], rng: () => 0.99, weaponId, carry: { hp: null, build } });
  world.waveTimer = Infinity;
  const p = world.player;
  recalcStats(p);
  p.x = 300;
  p.y = 300;
  p.fx = 1;
  p.fy = 0;
  p.inv = Infinity;
  return world;
}

const aim = (world) => ({ aimX: world.player.x + 200, aimY: world.player.y });

describe('武器ごとの強化', () => {
  it('強化を取っていなければ、武器は元のまま。取っても、ほかの武器には効かない', () => {
    const plain = weaponFor(createBuild(), 'gun');
    expect(plain).toBe(DATA.weapons.get('gun'));
    expect(modded('wm-gun', 'sword')).toBe(DATA.weapons.get('sword'));
    expect(upgradedWeapon(DATA.weapons.get('gun'), null)).toBe(DATA.weapons.get('gun'));
  });

  it('それぞれの中身：特殊アクションだけが変わり、通常攻撃は変わらない', () => {
    const base = (id) => DATA.weapons.get(id);
    const gs = modded('wm-greatsword', 'greatsword');
    gs.special.stages.forEach((s, i) => expect(s.time).toBeCloseTo(base('greatsword').special.stages[i].time * 0.8));
    expect(gs.combo).toBe(base('greatsword').combo);
    expect(modded('wm-sword', 'sword').special.window).toBe(0.2);
    expect(modded('wm-gun', 'gun').special.count).toBe(7);
    expect(modded('wm-gun', 'gun').shot).toBe(base('gun').shot);
    expect(modded('wm-knuckle', 'knuckle').special.gain).toBeCloseTo(base('knuckle').special.gain * 1.25);
    expect(modded('wm-knuckle', 'knuckle').special.gainHeavy).toBeCloseTo(base('knuckle').special.gainHeavy * 1.25);
    expect(modded('wm-cannon', 'cannon').special.cooldown).toBe(5);
    expect(modded('wm-spear', 'spear').special.distance).toBeCloseTo(base('spear').special.distance * 1.25);
    expect(modded('wm-spear', 'spear').special.cooldown).toBe(4);
    expect(modded('wm-chakram', 'chakram').special.maxPlaced).toBe(2);
    // 元の定義は、書き換えられていない
    expect(base('gun').special.count).toBe(5);
    expect(base('chakram').special.maxPlaced).toBe(1);
  });

  it('出撃すると、強化を当てた武器を持っている', () => {
    const save = createSave();
    save.upgrades['wm-gun'] = 1;
    const world = enterRoom(createRun({ rng: () => 0.5, save, mapId: 'map1', weaponId: 'gun' }));
    expect(world.player.weapon.special.count).toBe(7);
    const other = enterRoom(createRun({ rng: () => 0.5, save, mapId: 'map1', weaponId: 'sword' }));
    expect(other.player.weapon).toBe(DATA.weapons.get('sword'));
  });

  it('銃「拡張弾倉」：拡散射撃が、7発出る', () => {
    const world = makeWorld('gun', 'wm-gun');
    updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
    expect(world.playerShots).toHaveLength(7);
  });

  it('槍「踏み込み」：突進突きが、遠くまで届く', () => {
    const reach = (upgrade) => {
      const world = makeWorld('spear', upgrade);
      const x0 = world.player.x;
      updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
      for (let t = 0; t < 0.6; t += DT) updateWorld(world, DT, { ...idle, ...aim(world) });
      return world.player.x - x0;
    };
    expect(reach('wm-spear') / reach(null)).toBeCloseTo(1.25, 1);
  });

  it('チャクラム「二枚刃」：設置を、続けて2つ置ける。2つ置くと、クールダウンに入る', () => {
    const place = (world) => updateWorld(world, DT, { ...idle, ...aim(world), specialPressed: true });
    const wait = (world, s) => { for (let t = 0; t < s; t += DT) updateWorld(world, DT, { ...idle, ...aim(world) }); };
    const two = makeWorld('chakram', 'wm-chakram');
    place(two);
    expect(two.zones).toHaveLength(1);
    wait(two, 0.5);
    place(two);
    expect(two.zones).toHaveLength(2);
    expect(two.player.specialCd).toBeGreaterThan(two.player.weapon.special.cooldown - 1);
    wait(two, 0.5);
    place(two);
    expect(two.zones).toHaveLength(2);

    const one = makeWorld('chakram');
    place(one);
    wait(one, 0.5);
    place(one);
    expect(one.zones).toHaveLength(1);
    expect(one.player.specialCd).toBeGreaterThan(one.player.weapon.special.cooldown - 2);
  });
});

describe('武器の強さの調整（2026-10-09）', () => {
  it('ナックル：ゲージの溜まりは 3（フックは 6）。通常攻撃5セットでは、まだ満タンにならない', () => {
    const special = DATA.weapons.get('knuckle').special;
    expect(special.gain).toBe(3);
    expect(special.gainHeavy).toBe(6);
    expect((special.gain * 3 + special.gainHeavy) * 5).toBeLessThan(special.gaugeMax);
    expect((special.gain * 3 + special.gainHeavy) * 7).toBeGreaterThanOrEqual(special.gaugeMax);
  });

  it('チャクラム：威力28。行きと帰りで56', () => {
    const world = makeWorld('chakram');
    const e = createEnemy(DATA.enemies.get('grunt'), world.player.x + 120, world.player.y, 0, world.rng);
    e.def = { ...e.def, speed: 0, knockbackResist: 1 };
    e.cd = 999;
    e.hp = e.maxHp = 100000;
    world.enemies.push(e);
    updateWorld(world, DT, { ...idle, ...aim(world), attack: true, attackPressed: true });
    for (let t = 0; t < 4 && world.playerShots.length > 0; t += DT) updateWorld(world, DT, { ...idle, ...aim(world) });
    expect(e.maxHp - e.hp).toBe(56);
    expect(DATA.weapons.get('chakram').shot.boomerang.back).toBe(820);
  });

  it('大剣：振っている間の移動速度は 0.55', () => {
    expect(DATA.weapons.get('greatsword').moveSlow).toBe(0.55);
  });
});
