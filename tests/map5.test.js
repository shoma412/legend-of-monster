import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { isRaining, placeRoofs, rainEnv, startRain, underRoof } from '../src/game/acidRain.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { afflictPlayer, hitEnemy, hurtPlayer } from '../src/game/combat.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, enterRoom, handleEvents } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { mapState, recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ5「溶解区」と、環境「酸の雨」（docs/詳細仕様.md「28. マップ5「溶解区」と、環境「酸の雨」」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('acidrain');
const ROOF = { x: 700, y: 300, w: env.roofs.w, h: env.roofs.h };

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function rainWorld({ roofs = [ROOF], waves = [{}], implants = [] } = {}) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment: env, roofs };
  const world = createWorld({ room, rng: () => 0.99, weaponId: 'sword' });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  world.player.x = 300;
  world.player.y = 300;
  return world;
}

function addEnemy(world, id, x, y) {
  const e = createEnemy(DATA.enemies.get(id), x, y, 0, world.rng);
  e.cd = 99;
  e.hp = e.maxHp = 1000000;
  world.enemies.push(e);
  return e;
}

function run(world, seconds, input = idle) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, input);
}

function runUntil(world, cond, limit = 12, input = idle) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, input);
  }
  return false;
}

function bossWorld() {
  const world = rainWorld({ roofs: [ROOF], waves: [{ boss: 'rusteater' }] });
  world.waveTimer = 0;
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.player.inv = Infinity;
  return world;
}

const pits = (world) => world.hazards.filter((h) => h.pit);

describe('マップ5「溶解区」の定義', () => {
  it('エリア1 廃液路：色・背景・敵・ボス・素材・データ片・種族・曲がそろっている。環境は酸の雨', () => {
    const map = maps[4];
    expect(map).toMatchObject({ id: 'map5', name: '溶解区', environment: 'acidrain', requiresPass: 'map4', enemyScale: 4 });
    expect(map.areas[0]).toBe('drainway');
    const area = DATA.areas.get('drainway');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const id of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(id), id).toBe(true);
    const boss = DATA.bosses.get(area.boss);
    expect(boss).toMatchObject({ id: 'rusteater', weakness: 'corrode', material: 'rustCore' });
    expect(MATERIAL_ICONS.rustCore).toBeDefined();
    const frags = DATA.fragments.all().filter((f) => f.area === 'drainway');
    expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(mapSpecies(map)).toContain('rust');
    for (const key of [area.bgm, area.bossBgm, 'neutral', 'bossNeutral', 'raintower', 'bossRaintower', 'bossCatalyst']) expect(BGM[key], key).toBeDefined();
  });

  it('マップ4の完了と、停電区の通行証がそろうと、出撃できる。戦闘の部屋には屋根がある', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3', 'map4']) recordMapClear(save, id, 1);
    save.passes.push('map3');
    expect(mapState(save, maps[4])).toBe('locked');
    save.passes.push('map4');
    expect(mapState(save, maps[4])).toBe('open');
    const world = enterRoom(createRun({ rng: seeded(4), save, mapId: 'map5', weaponId: 'sword' }));
    expect(rainEnv(world)).toBe(env);
    expect(world.roofs.length).toBeGreaterThanOrEqual(env.roofs.count.min);
    expect(world.roofs.length).toBeLessThanOrEqual(env.roofs.count.max);
    expect(world.room.enemyScale).toBeCloseTo(4);
    expect(world.lamps).toHaveLength(0);
  });

  it('ほかのマップの部屋には、屋根も雨もない', () => {
    const world = enterRoom(createRun({ rng: seeded(4), save: createSave(), mapId: 'map1' }));
    expect(rainEnv(world)).toBeNull();
    expect(world.roofs).toHaveLength(0);
    world.countdown = 0;
    run(world, 20);
    expect(world.rain).toBeNull();
  });

  it('ラストイーターを倒すと、ラストコアと実績が手に入る', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3', 'map4']) recordMapClear(save, id, 1);
    save.passes.push('map3', 'map4');
    const r = createRun({ rng: seeded(7), save, mapId: 'map5', weaponId: 'sword' });
    r.plan.current = 'boss';
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('rusteater');
    expect(world.roofs.length).toBeGreaterThan(0);
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.materials.rustCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('rusteater');
  });
});

describe('酸の雨：周期と屋根', () => {
  it('屋根の置き場所：数は決まった範囲。重ならない', () => {
    const bounds = { left: 28, top: 56, right: 932, bottom: 512 };
    for (let seed = 1; seed < 30; seed++) {
      const roofs = placeRoofs(env, bounds, seeded(seed));
      expect(roofs.length).toBeGreaterThanOrEqual(env.roofs.count.min);
      expect(roofs.length).toBeLessThanOrEqual(env.roofs.count.max);
      for (let i = 0; i < roofs.length; i++) {
        for (let j = i + 1; j < roofs.length; j++) {
          const apart = Math.abs(roofs[i].x - roofs[j].x) >= env.roofs.w || Math.abs(roofs[i].y - roofs[j].y) >= env.roofs.h;
          expect(apart, `${seed}`).toBe(true);
        }
      }
    }
  });

  it('晴れ → 予告 → 雨 → 晴れ、をくり返す。予告の間は、まだ当たらない', () => {
    const world = rainWorld();
    const p = world.player;
    addEnemy(world, 'grunt', 880, 480).def = { ...DATA.enemies.get('grunt'), speed: 0 };
    run(world, 1);
    expect(world.rain.phase).toBe('clear');
    expect(runUntil(world, () => world.rain.phase === 'warn', env.cycle.clear + 1)).toBe(true);
    run(world, env.cycle.warn - 0.2);
    expect(p.hp).toBe(p.stats.maxHp);
    expect(runUntil(world, () => isRaining(world), 1)).toBe(true);
    expect(runUntil(world, () => world.rain.phase === 'clear', env.cycle.rain + 1)).toBe(true);
    expect(p.hp).toBeLessThan(p.stats.maxHp);
  });

  it('雨の間、屋根の外にいると削られる。屋根の下なら、当たらない', () => {
    const outside = rainWorld();
    startRain(outside, 3);
    run(outside, 2);
    expect(outside.player.hp).toBeLessThan(outside.player.stats.maxHp);
    expect(outside.rainHits).toBeGreaterThan(0);

    const inside = rainWorld();
    inside.player.x = ROOF.x + 20;
    inside.player.y = ROOF.y - 10;
    expect(underRoof(inside, inside.player.x, inside.player.y)).toBe(true);
    startRain(inside, 3);
    run(inside, 2);
    expect(inside.player.hp).toBe(inside.player.stats.maxHp);
    expect(inside.rainHits).toBe(0);
  });

  it('雨では倒れない（HP 1 で止まる）。ダッシュの無敵でも、防げない', () => {
    const world = rainWorld();
    const p = world.player;
    p.hp = 3;
    p.inv = Infinity;
    startRain(world, 4);
    run(world, 3.5);
    expect(p.hp).toBe(1);
    expect(world.mode).toBe('play');
  });

  it('雨は敵にも降る：屋根の外の敵には腐食が付く。屋根の下の敵には付かない', () => {
    const world = rainWorld();
    world.player.inv = Infinity;
    const out = addEnemy(world, 'grunt', 200, 450);
    const under = addEnemy(world, 'grunt', ROOF.x, ROOF.y);
    for (const e of [out, under]) e.def = { ...e.def, speed: 0 };
    startRain(world, 3);
    run(world, 1.5);
    expect(out.corrodeT).toBeGreaterThan(0);
    expect(under.corrodeT > 0).toBe(false);
  });

  it('部屋をクリアすると、雨は止む。敵がいない間は、降り始めない', () => {
    const world = rainWorld();
    startRain(world, 5);
    world.mode = 'clear';
    updateWorld(world, DT, idle);
    expect(world.rain).toBeNull();
    const hp = world.player.hp;
    run(world, 30);
    expect(world.player.hp).toBe(hp);
  });
});

describe('雑魚：雨宿り・錆び犬', () => {
  it('雨宿り：雨の予告が出ると、屋根の下へ急ぐ。雨の間は、屋根から出ない', () => {
    const world = rainWorld();
    const p = world.player;
    p.inv = Infinity;
    const e = addEnemy(world, 'shelterer', 500, 300);
    e.cd = 0;
    // 晴れている間は、プレイヤーへ向かう
    run(world, 0.5);
    expect(e.x).toBeLessThan(500);
    startRain(world, 4);
    expect(runUntil(world, () => underRoof(world, e.x, e.y), 4)).toBe(true);
    run(world, 2);
    expect(underRoof(world, e.x, e.y)).toBe(true);
  });

  it('錆び犬：腐食が付いている間は、動きが速い', () => {
    const walk = (corroded) => {
      const world = rainWorld({ roofs: [] });
      world.player.inv = Infinity;
      const e = addEnemy(world, 'rusthound', 800, 300);
      e.def = { ...e.def, wobble: 0 };
      if (corroded) e.corrodeT = 99;
      run(world, 1);
      return 800 - e.x;
    };
    expect(walk(true) / walk(false)).toBeCloseTo(DATA.enemies.get('rusthound').corrodeHaste, 1);
  });
});

describe('ボス「ラストイーター」', () => {
  const def = DATA.bosses.get('rusteater');

  it('そのボスだけの攻撃（溶解・噛みつき）を持ち、前半から使う', () => {
    for (const pattern of ['melt', 'gnaw']) {
      expect(PATTERNS[pattern]).toBeDefined();
      expect(def.phases[0].moves.some((m) => def.attacks[m].pattern === pattern), pattern).toBe(true);
      for (const other of DATA.bosses.all()) {
        if (other.id !== 'rusteater') expect(Object.values(other.attacks).some((a) => a.pattern === pattern), other.id).toBe(false);
      }
    }
  });

  it('溶解：足元に穴が開く。穴は消えず、使うたびに増える。上限を超えない', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    b.x = 880;
    b.y = 120;
    const cast = () => {
      b.next = 'melt';
      b.idleT = 0;
      updateWorld(world, DT, idle);
      b.idleT = Infinity;
      runUntil(world, () => !b.act, 4);
    };
    cast();
    expect(pits(world)).toHaveLength(def.attacks.melt.count);
    const first = pits(world)[0];
    expect(Math.hypot(first.x - p.x, first.y - p.y)).toBeLessThan(5);
    run(world, 20);
    expect(pits(world)).toHaveLength(def.attacks.melt.count); // 時間がたっても、消えない
    for (let i = 0; i < 8; i++) cast();
    expect(pits(world)).toHaveLength(def.attacks.melt.max);
    // 穴の中にいると、削られる
    p.inv = 0;
    p.x = first.x;
    p.y = first.y;
    const hp = p.hp;
    expect(runUntil(world, () => p.hp < hp, 2)).toBe(true);
  });

  it('噛みつき：当たると「錆」。5秒のあいだ、与えるダメージが 30% 下がる', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    b.x = p.x + 200;
    b.y = p.y;
    p.inv = 0;
    b.next = 'gnaw';
    b.idleT = 0;
    const hp = p.hp;
    expect(runUntil(world, () => p.hp < hp, 3)).toBe(true);
    expect(p.buffs.some((x) => x.id === 'rust')).toBe(true);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1 - def.attacks.gnaw.rust.amount);
    p.inv = Infinity;
    run(world, def.attacks.gnaw.rust.duration + 0.3);
    expect(statWith(world, 'attackMul')).toBeCloseTo(1);
  });

  it('噛みつき：避ければ、錆は付かない。壁に当たると、隙ができる', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    p.x = 150;
    p.y = 300;
    b.x = 420;
    b.y = 300;
    b.next = 'gnaw';
    b.idleT = 0;
    expect(runUntil(world, () => b.act?.phase === 'active', 3)).toBe(true);
    p.y = 490; // 突進の線から外れる
    expect(runUntil(world, () => b.act?.phase === 'stun', 3)).toBe(true);
    expect(p.buffs.some((x) => x.id === 'rust')).toBe(false);
  });

  it('大技「大溶解」：部屋の外まわりが穴になり、真ん中は残る。同時に雨が降る', () => {
    const world = bossWorld();
    const b = world.boss;
    b.next = 'meltdown';
    b.idleT = 0;
    expect(runUntil(world, () => pits(world).length >= def.attacks.meltdown.ring.count, 4)).toBe(true);
    expect(isRaining(world)).toBe(true);
    const cx = (world.bounds.left + world.bounds.right) / 2;
    const cy = (world.bounds.top + world.bounds.bottom) / 2;
    expect(pits(world).every((h) => Math.hypot(h.x - cx, h.y - cy) > h.r + 30)).toBe(true);
  });

  it('ボスを倒すと、穴は消える', () => {
    const world = bossWorld();
    const b = world.boss;
    b.next = 'melt';
    b.idleT = 0;
    runUntil(world, () => pits(world).length > 0, 4);
    hitEnemy(world, b, 99999999, 1, 0, 0, { unblockable: true });
    for (let t = 0; t < 4; t += DT) {
      world.choice = null;
      world.pendingLevelUps = 0;
      updateWorld(world, DT, idle);
    }
    expect(world.mode).toBe('clear');
    expect(pits(world)).toHaveLength(0);
  });
});

describe('種族「錆」', () => {
  const dummy = (world, x = 360) => {
    const e = addEnemy(world, 'grunt', x, 300);
    e.def = { ...e.def, speed: 0 };
    return e;
  };
  const dealt = (world, e) => {
    const hp = e.hp;
    hitEnemy(world, e, 100, 1, 0, 0);
    return hp - e.hp;
  };

  it('部品は5つ', () => {
    expect(DATA.implants.all().filter((d) => d.species === 'rust')).toHaveLength(5);
  });

  it('錆びた刃：攻撃に腐食が付く。Lv2 からは、腐食の時間が延びる', () => {
    const world = rainWorld({ implants: ['rustedge'] });
    const e = dummy(world);
    dealt(world, e);
    expect(e.corrodeT).toBeCloseTo(STATUS.corrode.duration);
    const lv2 = rainWorld({ implants: ['rustedge', 'rustedge'] });
    const e2 = dummy(lv2);
    dealt(lv2, e2);
    expect(e2.corrodeT).toBeGreaterThan(STATUS.corrode.duration + 0.5);
  });

  it('侵食：腐食中の敵へのダメージ +15%（腐食そのものの +15% と、掛け算で重なる）', () => {
    const world = rainWorld({ implants: ['erosion'] });
    const e = dummy(world);
    expect(dealt(world, e)).toBe(100);
    e.corrodeT = 99;
    expect(dealt(world, e)).toBe(Math.floor(115 * 1.15 + 1e-6));
  });

  it('酸の血：被弾すると、まわりの敵に腐食が付く', () => {
    const world = rainWorld({ implants: ['acidblood'] });
    const near = dummy(world, 380);
    const far = dummy(world, 800);
    hurtPlayer(world, 5);
    expect(near.corrodeT).toBeGreaterThan(0);
    expect(far.corrodeT > 0).toBe(false);
  });

  it('錆び止め：酸の雨と、持続ダメージで受ける量が減る', () => {
    const rained = (implants) => {
      const world = rainWorld({ implants });
      startRain(world, 3);
      run(world, 2.5);
      return world.player.stats.maxHp - world.player.hp;
    };
    expect(rained(['antirust'])).toBeLessThan(rained([]) * 0.75);
    const burned = (implants) => {
      const world = rainWorld({ implants, roofs: [] });
      world.rain = { phase: 'clear', t: 99, max: 99, acc: 0, hits: 0 };
      afflictPlayer(world, 'burn');
      run(world, 3.2);
      return world.player.stats.maxHp - world.player.hp;
    };
    expect(burned(['antirust'])).toBeLessThan(burned([]));
  });

  it('朽ち喰い：腐食中の敵を倒すと、HP が戻る。腐食していない敵では、戻らない', () => {
    const world = rainWorld({ implants: ['scavenge'] });
    const p = world.player;
    p.hp = 50;
    const a = dummy(world);
    hitEnemy(world, a, 99999999, 1, 0, 0);
    expect(p.hp).toBe(50);
    const b = dummy(world);
    b.corrodeT = 99;
    hitEnemy(world, b, 99999999, 1, 0, 0);
    expect(p.hp).toBe(52);
  });

  it('種族ボーナス：2種類で腐食の時間 +2秒。3種類で、腐食で増えるダメージ +10%（+15% → +25%）', () => {
    const two = rainWorld({ implants: ['rustedge', 'antirust'] });
    const e = dummy(two);
    dealt(two, e);
    expect(e.corrodeT).toBeCloseTo(STATUS.corrode.duration + 2);
    const three = rainWorld({ implants: ['acidblood', 'antirust', 'scavenge'] });
    const e3 = dummy(three);
    e3.corrodeT = 99;
    expect(dealt(three, e3)).toBe(125);
  });
});
