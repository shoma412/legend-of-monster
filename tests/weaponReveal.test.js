import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { upgrades, weaponUnlocks } from '../src/data/upgrades.js';
import { recalcStats } from '../src/game/build.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { recordMapClear } from '../src/logic/maps.js';
import { unlockWeapon, weaponAvailable } from '../src/logic/meta.js';
import { createSave } from '../src/logic/save.js';
import { mouseLines } from '../src/scenes/controlsPanel.js';

// 武器が、マップをクリアするごとに現れる（docs/詳細仕様.md「武器の解放」）。ドローンの下方修正（35 章）

describe('武器の出現', () => {
  it('最初は大剣だけ。片手剣はマップ1、銃は2、ナックルは3、大砲は4、槍は5、チャクラムは6、ドローンは7のクリアで現れる', () => {
    const save = createSave();
    expect(weaponUnlocks.map((w) => w.map)).toEqual([undefined, 'map1', 'map2', 'map3', 'map4', 'map5', 'map6', 'map7']);
    expect(weaponUnlocks.filter((w) => weaponAvailable(save, w.weapon)).map((w) => w.weapon)).toEqual(['greatsword']);
    const order = weaponUnlocks.map((w) => w.weapon);
    for (let n = 1; n <= 7; n++) {
      recordMapClear(save, `map${n}`, 1);
      expect(weaponAvailable(save, order[n]), order[n]).toBe(true);
      if (n < 7) expect(weaponAvailable(save, order[n + 1]), order[n + 1]).toBe(false);
    }
  });

  it('持っている武器は、マップをクリアしていなくても現れている（以前のセーブデータ）。周回に関係なく、1回クリアしていればよい', () => {
    const save = createSave();
    save.weapons.push('cannon');
    expect(weaponAvailable(save, 'cannon')).toBe(true);
    expect(weaponAvailable(save, 'gun')).toBe(false);
    recordMapClear(save, 'map2', 3);
    expect(weaponAvailable(save, 'gun')).toBe(true);
  });

  it('現れていない武器の、操作の説明は「？？？」。現れたら出る', () => {
    const save = createSave();
    const lines = mouseLines(null, (id) => weaponAvailable(save, id));
    expect(lines.find((l) => l.id === 'greatsword').name).toBe('大剣');
    for (const l of lines.filter((x) => x.id !== 'greatsword')) expect([l.name, l.left, l.right]).toEqual(['？？？', '？？？', '？？？']);
    recordMapClear(save, 'map1', 1);
    expect(mouseLines(null, (id) => weaponAvailable(save, id)).find((l) => l.id === 'sword').name).toBe('片手剣');
  });

  it('武器ごとの強化（wm-*・増設ラック）には、どの武器のものかが書いてある', () => {
    for (const w of weaponUnlocks) expect(upgrades.find((u) => u.id === `wm-${w.weapon}`)?.weapon, w.weapon).toBe(w.weapon);
    expect(upgrades.find((u) => u.id === 'droneRack').weapon).toBe('drone');
  });
});

describe('ドローンユニットの下方修正', () => {
  it('子機1発の威力は6。広角ブレードで2発撃つときは、1発が70%（4.2）', () => {
    const def = DATA.weapons.get('drone');
    expect(def.drones.damage).toBe(6);
    expect(def.drones.wideMul).toBe(0.7);
    const shotDamage = (implants) => {
      const world = createWorld({ waves: [{}], rng: () => 0.99, weaponId: 'drone' });
      world.waveTimer = Infinity;
      const p = world.player;
      p.build.weaponId = 'drone';
      p.build.implants = implants;
      recalcStats(p);
      p.x = 300;
      p.y = 300;
      p.fx = 1;
      p.fy = 0;
      p.inv = Infinity;
      const e = createEnemy(DATA.enemies.get('grunt'), 450, 300, 0, world.rng);
      e.def = { ...e.def, speed: 0, knockbackResist: 1 };
      e.cd = 999;
      e.hp = e.maxHp = 1e9;
      world.enemies.push(e);
      for (let t = 0; t < 0.05; t += 1 / 60) updateWorld(world, 1 / 60, { mx: 0, my: 0, attack: false, attackPressed: false, specialPressed: false, dashPressed: false });
      return world.playerShots.map((x) => x.damage);
    };
    const normal = shotDamage({});
    expect(normal.length).toBeGreaterThan(0);
    expect(normal.every((d) => d === 6)).toBe(true);
    const wide = shotDamage({ wideblade: 1 });
    expect(wide.length).toBeGreaterThan(0);
    expect(wide.every((d) => Math.abs(d - 4.2) < 1e-9)).toBe(true);
  });

  it('現れていても、解放には素材が要る（武器の解放の仕組みは変わらない）', () => {
    const save = createSave();
    recordMapClear(save, 'map1', 1);
    expect(unlockWeapon(save, 'sword')).toBe(false);
    save.materials.boarCore = 2;
    expect(unlockWeapon(save, 'sword')).toBe(true);
  });
});
