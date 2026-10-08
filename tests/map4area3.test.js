import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { PLAYER, STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { isVisible, powerOn, visionRadius } from '../src/game/darkness.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { hasGimmickPart } from '../src/game/gimmicks.js';
import { useKit } from '../src/game/objects.js';
import { createRun, enterRoom, handleEvents } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { allMapsCleared, recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ4 エリア3「主幹制御室」（docs/詳細仕様.md「24. マップ4」の ③）

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

function darkWorld({ lamps = [], waves = [{}], implants = [], gimmick = null } = {}) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment: env, lamps, gimmick };
  const world = createWorld({ room, rng: seeded(11), weaponId: 'sword' });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  return world;
}

function addEnemy(world, id, x, y) {
  const e = createEnemy(DATA.enemies.get(id), x, y, 0, world.rng);
  e.cd = 0;
  world.enemies.push(e);
  return e;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

function bossWorld() {
  const world = darkWorld({ lamps: [{ x: 300, y: 300 }, { x: 700, y: 400 }], waves: [{ boss: 'breaker' }] });
  world.waveTimer = 0;
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.player.inv = 0;
  return world;
}

const decoys = (world) => world.enemies.filter((e) => e.def.decoy && !e.dead);

describe('マップ4 エリア3「主幹制御室」の定義', () => {
  it('色・背景・敵・仕掛け・ボス・素材・データ片・種族・曲がそろっている', () => {
    const map = maps[3];
    expect(map.areas).toEqual(['darkstreet', 'substation', 'control']);
    const area = DATA.areas.get('control');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const id of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(id), id).toBe(true);
    for (const g of area.gimmicks) expect(hasGimmickPart(DATA.gimmicks.get(g.id).part)).toBe(true);
    const boss = DATA.bosses.get(area.boss);
    expect(boss.id).toBe('breaker');
    expect(boss.weakness).toBe('cold');
    expect(MATERIAL_ICONS[boss.material]).toBeDefined();
    const frags = DATA.fragments.all().filter((f) => f.area === 'control');
    expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(mapSpecies(map)).toEqual(expect.arrayContaining(['moth', 'sentinel', 'breaker']));
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    // 残像（偽物）は、雑魚としては出てこない
    for (const a of DATA.areas.all()) expect(a.enemies.some((x) => x.id === 'afterimage'), a.id).toBe(false);
  });

  it('ブレーカーを倒すと、ブレーカーコアと実績が手に入り、マップ4の完了になる', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3']) recordMapClear(save, id, 1);
    save.passes.push('map3');
    const r = createRun({ rng: seeded(7), save, mapId: 'map4', weaponId: 'sword' });
    r.areaIndex = 2;
    r.area = DATA.areas.get('control');
    r.plan.current = 'boss';
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('breaker');
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.materials.breakerCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('breaker');
    expect(allMapsCleared(save)).toBe(false); // マップ5〜7は、まだない
  });
});

describe('雑魚：明滅機・蓄電器', () => {
  it('明滅機：姿が点いたり消えたりする。構えている間は、必ず見える', () => {
    const world = darkWorld();
    const p = world.player;
    const e = addEnemy(world, 'blinker', p.x + 400, p.y);
    e.def = { ...e.def, speed: 0 };
    const seen = new Set();
    for (let t = 0; t < 5; t += DT) {
      updateWorld(world, DT, idle);
      seen.add(!!e.unseen);
    }
    expect(seen.has(true)).toBe(true);
    expect(seen.has(false)).toBe(true);
    // 近づいて構えたら、見える
    e.x = p.x + 30;
    expect(runUntil(world, () => e.state === 'windup', 3)).toBe(true);
    updateWorld(world, DT, idle);
    expect(e.unseen).toBe(false);
  });

  it('明滅機：消えていても、攻撃は当たる', () => {
    const world = darkWorld();
    const e = addEnemy(world, 'blinker', world.player.x + 400, world.player.y);
    e.def = { ...e.def, speed: 0 };
    runUntil(world, () => e.unseen === true, 5);
    const hp = e.hp;
    hitEnemy(world, e, 5, 1, 0, 0);
    expect(e.hp).toBeLessThan(hp);
  });

  it('蓄電器：動かない。予告のあと、まわりに放電する。離れていれば当たらない', () => {
    const world = darkWorld();
    const p = world.player;
    const e = addEnemy(world, 'capacitor', p.x + 80, p.y);
    const x = e.x;
    expect(runUntil(world, () => e.state === 'windup', 1)).toBe(true);
    expect(p.hp).toBe(p.stats.maxHp);
    expect(runUntil(world, () => p.hp < p.stats.maxHp, 2)).toBe(true);
    expect(e.x).toBe(x);

    const far = darkWorld();
    const e2 = addEnemy(far, 'capacitor', far.player.x + e.def.discharge.radius + 80, far.player.y);
    run(far, 6);
    expect(e2.dead).toBe(false);
    expect(far.player.hp).toBe(far.player.stats.maxHp);
  });

  it('蓄電器：倒すと、部屋の非常灯がすべて点く（壊されていたものも直る）', () => {
    const world = darkWorld({ lamps: [{ x: 700, y: 200 }, { x: 800, y: 500 }] });
    world.lamps[1].broken = 20;
    const e = addEnemy(world, 'capacitor', 600, 300);
    hitEnemy(world, e, 99999, 1, 0, 0);
    expect(world.lamps.every((l) => l.on > 0 && l.broken <= 0)).toBe(true);
  });
});

describe('部屋の仕掛け「通電」', () => {
  it('ときどき、部屋全体が明るくなり、少しすると暗闇に戻る', () => {
    const def = DATA.gimmicks.get('surge');
    const world = darkWorld({ gimmick: def });
    addEnemy(world, 'capacitor', 900, 500).cd = 999;
    const far = { x: world.player.x + 600, y: world.player.y };
    expect(isVisible(world, far.x, far.y)).toBe(false);
    expect(runUntil(world, () => isVisible(world, far.x, far.y), def.interval + 1)).toBe(true);
    run(world, def.duration + 0.3);
    expect(isVisible(world, far.x, far.y)).toBe(false);
  });
});

describe('ボス「ブレーカー」', () => {
  it('そのボスだけの攻撃（遮断・残像）を持ち、前半から使う', () => {
    const def = DATA.bosses.get('breaker');
    for (const pattern of ['blackout', 'afterimage']) {
      expect(PATTERNS[pattern]).toBeDefined();
      expect(def.phases[0].moves.some((m) => def.attacks[m].pattern === pattern), pattern).toBe(true);
      for (const other of DATA.bosses.all()) {
        if (other.id !== 'breaker') expect(Object.values(other.attacks).some((a) => a.pattern === pattern), other.id).toBe(false);
      }
    }
    expect(def.attacks.mirageHard.count).toBe(5);
    expect(def.attacks.cutoffHard.duration).toBeGreaterThan(def.attacks.cutoff.duration);
  });

  it('遮断：非常灯が消えて点かなくなり、見える円が狭くなる。足元に予告が出る。終わると復電して、ボスは動けない', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    for (const lamp of world.lamps) lamp.on = 8;
    b.next = 'cutoff';
    b.idleT = 0;
    expect(runUntil(world, () => !!world.blackout, 3)).toBe(true);
    b.idleT = Infinity;
    expect(world.lamps.every((l) => l.on <= 0)).toBe(true);
    expect(visionRadius(world)).toBeCloseTo(env.vision * b.def.attacks.cutoff.vision);
    // 非常灯のそばに立っても、点かない
    p.x = world.lamps[0].x;
    p.y = world.lamps[0].y + 20;
    run(world, 0.3);
    expect(world.lamps[0].on).toBeLessThanOrEqual(0);
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'mark'), 2)).toBe(true);
    p.inv = Infinity;
    expect(runUntil(world, () => b.act?.phase === 'stun', 8)).toBe(true);
    expect(world.blackout).toBeNull();
    expect(visionRadius(world)).toBeCloseTo(env.vision);
    expect(isVisible(world, b.x, b.y)).toBe(true); // 復電：部屋全体が明るい
    // 動けない間は、体に触れても当たらない
    p.inv = 0;
    p.x = b.x;
    p.y = b.y;
    const hp = p.hp;
    world.hazards = [];
    run(world, 0.3);
    expect(p.hp).toBe(hp);
  });

  it('残像：偽物が3体出て、本物と一緒に突進する。偽物は1発で消える。偽物の体当たりは、本物より弱い', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    p.inv = Infinity;
    b.next = 'mirage';
    b.idleT = 0;
    expect(runUntil(world, () => decoys(world).length === 3, 3)).toBe(true);
    b.idleT = Infinity;
    const def = b.def.attacks.mirage;
    // みんな、プレイヤーから同じ距離に並ぶ
    for (const e of [b, ...decoys(world)]) expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThanOrEqual(def.distance * 1.6 + 1);
    // 同じ場所に固まらない
    const all = [b, ...decoys(world)];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y)).toBeGreaterThan(b.r);
    const one = decoys(world)[0];
    hitEnemy(world, one, 1, 1, 0, 0);
    expect(one.dead).toBe(true);
    run(world, 0.05);
    expect(decoys(world)).toHaveLength(2);
    expect(def.decoyDamage).toBeLessThan(def.damage);
    // 突進が終わると、残りの偽物も消える
    expect(runUntil(world, () => b.act?.phase === 'recover', 4)).toBe(true);
    expect(decoys(world)).toHaveLength(0);
    expect(world.kills).toBe(0); // 偽物は、撃破数に数えない
  });

  it('残像：本物に当てると、偽物は全部消える', () => {
    const world = bossWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    b.next = 'mirage';
    b.idleT = 0;
    runUntil(world, () => decoys(world).length === 3, 3);
    hitEnemy(world, b, 10, 1, 0, 0);
    run(world, 0.05);
    expect(decoys(world)).toHaveLength(0);
  });

  it('残像：偽物の体当たりで受けるダメージは、決まった値', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    p.inv = Infinity;
    b.next = 'mirage';
    b.idleT = 0;
    runUntil(world, () => decoys(world).length === 3 && b.act.phase === 'active', 4);
    const e = decoys(world)[0];
    b.x = p.x + 400; // 本物は遠ざける
    b.act.dirX = 1;
    b.act.dirY = 0;
    p.inv = 0;
    e.x = p.x;
    e.y = p.y;
    e.angle = 0;
    const hp = p.hp;
    updateWorld(world, DT, idle);
    expect(hp - p.hp).toBe(Math.round(b.def.attacks.mirage.decoyDamage));
  });

  it('大技「全系統遮断」：暗闇の中で、偽物6体との突進を3回。終わると復電する', () => {
    const world = bossWorld();
    const b = world.boss;
    world.player.inv = Infinity;
    b.next = 'shutdown';
    b.idleT = 0;
    expect(runUntil(world, () => decoys(world).length === 6, 4)).toBe(true);
    expect(world.blackout).not.toBeNull();
    let rounds = 0;
    let last = '';
    for (let t = 0; t < 12 && b.act?.phase !== 'recover'; t += DT) {
      updateWorld(world, DT, idle);
      if (b.act?.phase === 'active' && last !== 'active') rounds++;
      last = b.act?.phase;
    }
    expect(rounds).toBe(3);
    expect(world.blackout).toBeNull();
    expect(world.surgeT).toBeGreaterThan(0);
    expect(decoys(world)).toHaveLength(0);
  });
});

describe('種族「遮断器」', () => {
  const dummy = (world) => {
    const e = addEnemy(world, 'grunt', world.player.x + 60, world.player.y);
    e.hp = e.maxHp = 10000000;
    e.cd = 999;
    world.rng = () => 0.99; // 会心なし
    return e;
  };
  const dealt = (world, e) => {
    const hp = e.hp;
    hitEnemy(world, e, 100, 1, 0, 0);
    return hp - e.hp;
  };

  it('部品は5つ', () => {
    expect(DATA.implants.all().filter((d) => d.species === 'breaker')).toHaveLength(5);
  });

  it('過負荷：8回当てるごとに、次の攻撃が +60%', () => {
    const world = darkWorld({ implants: ['overloader'] });
    const e = dummy(world);
    const list = Array.from({ length: 18 }, () => dealt(world, e));
    expect(list.slice(0, 8).every((v) => v === 100)).toBe(true);
    expect(list[8]).toBe(160);
    expect(list.slice(9, 17).every((v) => v === 100)).toBe(true);
    expect(list[17]).toBe(160);
  });

  it('蓄電：2秒間当てていないと、次の攻撃が +30%。続けて当てると、付かない', () => {
    const world = darkWorld({ implants: ['storage'] });
    const e = dummy(world);
    expect(dealt(world, e)).toBe(130); // 最初の一撃
    run(world, 0.5);
    expect(dealt(world, e)).toBe(100);
    run(world, STATUS.rested.window + 0.1);
    expect(dealt(world, e)).toBe(130);
    // 1振りで何体かに当たるとき（同じ瞬間）は、どれにも付く
    run(world, STATUS.rested.window + 0.1);
    const other = dummy(world);
    expect(dealt(world, e)).toBe(130);
    expect(dealt(world, other)).toBe(130);
  });

  it('遮断：大きなダメージだけ、30% 減る', () => {
    const world = darkWorld({ implants: ['cutoff'] });
    const p = world.player;
    const max = p.stats.maxHp;
    hurtPlayer(world, 10);
    expect(max - p.hp).toBe(10);
    p.hp = max;
    p.inv = 0;
    hurtPlayer(world, 40);
    expect(max - p.hp).toBe(28);
  });

  it('復電：修復キットを使うと、5秒間、攻撃力が上がる', () => {
    const world = darkWorld({ implants: ['restore'] });
    const p = world.player;
    p.hp = 10;
    p.build.kits = 2;
    expect(useKit(world)).toBe(true);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1.25);
    run(world, STATUS.kitPower.duration + 0.2);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
  });

  it('瞬断：ダッシュの無敵時間が延びる', () => {
    const inv = (implants) => {
      const world = darkWorld({ implants });
      updateWorld(world, DT, { ...idle, mx: 1, dashPressed: true });
      return world.player.inv;
    };
    expect(inv(['blip']) - inv([])).toBeCloseTo(0.15);
    expect(inv([])).toBeCloseTo(PLAYER.dash.invincible - DT, 1);
  });

  it('種族ボーナス：2種類で会心率 +5%。3種類で、敵を倒すとダッシュが回復する（3秒に1回）', () => {
    const two = darkWorld({ implants: ['overloader', 'storage'] });
    expect(two.player.stats.critChance).toBeCloseTo(PLAYER.critChance + 0.05);
    const world = darkWorld({ implants: ['overloader', 'storage', 'blip'] });
    const p = world.player;
    run(world, 0.1);
    p.dashCharges = 0;
    p.dashRecharge = 5;
    hitEnemy(world, addEnemy(world, 'grunt', p.x + 60, p.y), 99999, 1, 0, 0);
    expect(p.dashCharges).toBe(1);
    // 続けて倒しても、3秒たつまでは回復しない
    p.dashCharges = 0;
    hitEnemy(world, addEnemy(world, 'grunt', p.x + 60, p.y), 99999, 1, 0, 0);
    expect(p.dashCharges).toBe(0);
  });
});

describe('通電と遮断は、明るいマップでは何もしない', () => {
  it('明るい部屋で呼んでも、何も変わらない', () => {
    const world = createWorld({ waves: [{}], rng: () => 0.5, weaponId: 'sword' });
    powerOn(world, 3);
    expect(world.surgeT ?? 0).toBe(0);
    expect(visionRadius(world)).toBe(Infinity);
  });
});
