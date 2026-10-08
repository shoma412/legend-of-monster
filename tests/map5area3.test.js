import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { breakRoof, isRaining, startRain, underRoof } from '../src/game/acidRain.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, enterRoom, handleEvents } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ5 エリア3「降雨制御塔」（docs/詳細仕様.md「28. マップ5」の ③）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('acidrain');
const def = DATA.bosses.get('rainmaker');
const roofAt = (x, y) => ({ x, y, w: env.roofs.w, h: env.roofs.h });

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function rainWorld({ roofs = [roofAt(700, 300)], waves = [{}], implants = [], rain = true } = {}) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment: rain ? env : null, roofs };
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

// 雨の周期を止めておく（雨雲などだけを確かめるため）
const holdClear = (world) => {
  world.rain = { phase: 'clear', t: 9999, max: 9999, acc: 0, hits: 0 };
};

function bossWorld() {
  const world = rainWorld({ roofs: [roofAt(300, 300), roofAt(700, 300), roofAt(500, 440)], waves: [{ boss: 'rainmaker' }] });
  world.waveTimer = 0;
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.boss.x = 860;
  world.boss.y = 110;
  world.player.inv = Infinity;
  holdClear(world);
  return world;
}

const clouds = (world) => world.hazards.filter((h) => h.type === 'cloud');
const intact = (world) => world.roofs.filter((r) => !(r.broken > 0));

describe('マップ5 エリア3「降雨制御塔」の定義', () => {
  it('色・背景・敵・ボス・素材・データ片・種族・曲がそろっている', () => {
    const map = maps[4];
    expect(map.areas).toEqual(['drainway', 'neutral', 'raintower']);
    const area = DATA.areas.get('raintower');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const id of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(id), id).toBe(true);
    expect(def).toMatchObject({ weakness: 'shock', material: 'rainCore' });
    expect(MATERIAL_ICONS.rainCore).toBeDefined();
    const frags = DATA.fragments.all().filter((f) => f.area === 'raintower');
    expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(mapSpecies(map)).toEqual(expect.arrayContaining(['rust', 'buffer', 'rain']));
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
  });

  it('レインメーカーを倒すと、レインコアと実績が手に入り、マップ5の完了になる', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3', 'map4']) recordMapClear(save, id, 1);
    save.passes.push('map3', 'map4');
    const r = createRun({ rng: seeded(7), save, mapId: 'map5', weaponId: 'sword' });
    r.areaIndex = 2;
    r.plan.current = 'boss';
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('rainmaker');
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.materials.rainCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('rainmaker');
    expect(save.maps.map5.clears).toBe(1);
  });
});

describe('崩された屋根', () => {
  it('崩された屋根の下では、雨に当たる。時間がたつと直る', () => {
    const world = rainWorld();
    const p = world.player;
    const roof = world.roofs[0];
    p.x = roof.x;
    p.y = roof.y;
    expect(underRoof(world, p.x, p.y)).toBe(true);
    breakRoof(world, roof, 3);
    expect(underRoof(world, p.x, p.y)).toBe(false);
    startRain(world, 2);
    run(world, 1.5);
    expect(p.hp).toBeLessThan(p.stats.maxHp);
    run(world, 2);
    expect(roof.broken > 0).toBe(false);
    expect(underRoof(world, p.x, p.y)).toBe(true);
  });
});

describe('雑魚：雨雲・導雷針', () => {
  it('雨雲：プレイヤーを追い、真下にだけ雨を降らせる（雨の周期とは関係ない）。屋根の下なら当たらない', () => {
    const world = rainWorld();
    const p = world.player;
    holdClear(world);
    const c = addEnemy(world, 'raincloud', 520, 300);
    run(world, 1);
    expect(c.x).toBeLessThan(520);
    expect(p.hp).toBe(p.stats.maxHp);
    expect(runUntil(world, () => p.hp < p.stats.maxHp, 6)).toBe(true);
    expect(isRaining(world)).toBe(false);

    const safe = rainWorld();
    holdClear(safe);
    safe.player.x = 700;
    safe.player.y = 300;
    addEnemy(safe, 'raincloud', 720, 300);
    run(safe, 4);
    expect(safe.player.hp).toBe(safe.player.stats.maxHp);
  });

  it('導雷針：晴れている間は、何もしない。雨の間だけ、照準線のあとに撃つ（屋根の下でも当たる）', () => {
    const world = rainWorld();
    const p = world.player;
    p.x = 700;
    p.y = 300; // 屋根の下
    holdClear(world);
    const e = addEnemy(world, 'conductor', 400, 300);
    e.cd = 0;
    run(world, 4);
    expect(e.state).toBe('chase');
    expect(p.hp).toBe(p.stats.maxHp);
    startRain(world, 5);
    expect(runUntil(world, () => e.state === 'aim', 1)).toBe(true);
    expect(runUntil(world, () => p.hp < p.stats.maxHp, 2)).toBe(true);
  });
});

describe('ボス「レインメーカー」', () => {
  it('そのボスだけの攻撃（瓦落とし・雨雲）を持ち、前半から使う', () => {
    for (const pattern of ['unroof', 'stormcloud']) {
      expect(PATTERNS[pattern]).toBeDefined();
      expect(def.phases[0].moves.some((m) => def.attacks[m].pattern === pattern), pattern).toBe(true);
      for (const other of DATA.bosses.all()) {
        if (other.id !== 'rainmaker') expect(Object.values(other.attacks).some((a) => a.pattern === pattern), other.id).toBe(false);
      }
    }
    expect(def.attacks.unroofHard.count).toBe(2);
    expect(def.attacks.cloudHard.count).toBe(2);
  });

  it('瓦落とし：プレイヤーにいちばん近い屋根が崩れる。崩れた瞬間に下にいると、ダメージ', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    p.x = 300;
    p.y = 300;
    p.inv = 0;
    b.next = 'unroof';
    b.idleT = 0;
    updateWorld(world, DT, idle);
    b.idleT = Infinity;
    expect(b.act.targets).toEqual([world.roofs[0]]);
    const hp = p.hp;
    expect(runUntil(world, () => world.roofs[0].broken > 0, 3)).toBe(true);
    expect(p.hp).toBeLessThan(hp);
    expect(intact(world)).toHaveLength(2);
  });

  it('瓦落とし：予告の間に屋根から出れば、当たらない', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    p.x = 300;
    p.y = 300;
    p.inv = 0;
    b.next = 'unroof';
    b.idleT = 0;
    updateWorld(world, DT, idle);
    b.idleT = Infinity;
    p.x = 120;
    p.y = 480;
    const hp = p.hp;
    runUntil(world, () => world.roofs[0].broken > 0, 3);
    expect(p.hp).toBe(hp);
  });

  it('雨雲：プレイヤーを追い、真下に雨を降らせる。決まった間隔で、雲の真下に落雷の予告が出る', () => {
    const world = bossWorld();
    const p = world.player;
    const b = world.boss;
    p.x = 150;
    p.y = 480;
    b.next = 'cloud';
    b.idleT = 0;
    expect(runUntil(world, () => clouds(world).length === 1, 3)).toBe(true);
    b.idleT = Infinity;
    const c = clouds(world)[0];
    const d0 = Math.hypot(c.x - p.x, c.y - p.y);
    run(world, 1.5);
    expect(Math.hypot(c.x - p.x, c.y - p.y)).toBeLessThan(d0);
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'mark'), 4)).toBe(true);
    const mark = world.hazards.find((h) => h.type === 'mark');
    expect(Math.hypot(mark.x - c.x, mark.y - c.y)).toBeLessThan(30);
    // 雲は、時間がたつと消える
    expect(runUntil(world, () => clouds(world).length === 0, def.attacks.cloud.life + 1)).toBe(true);
  });

  it('雨雲の真下：屋根の外なら雨に当たる。屋根の下なら、雨には当たらない', () => {
    for (const roofed of [false, true]) {
      const world = bossWorld();
      const p = world.player;
      const b = world.boss;
      p.x = roofed ? 300 : 120;
      p.y = roofed ? 300 : 470;
      b.next = 'cloud';
      b.idleT = 0;
      runUntil(world, () => clouds(world).length === 1, 3);
      b.idleT = Infinity;
      const c = clouds(world)[0];
      c.strikeT = 999; // 落雷は、別に確かめる
      c.x = p.x;
      c.y = p.y;
      const before = world.rainHits;
      run(world, 2);
      expect(world.rainHits > before).toBe(!roofed);
    }
  });

  it('大技「豪雨」：すべての屋根が崩れ、雨が降り、雨雲が2つ出る', () => {
    const world = bossWorld();
    const b = world.boss;
    b.next = 'downpour';
    b.idleT = 0;
    expect(runUntil(world, () => intact(world).length === 0, 4)).toBe(true);
    expect(isRaining(world)).toBe(true);
    expect(clouds(world)).toHaveLength(2);
  });

  it('ボスを倒すと、雨雲は消える', () => {
    const world = bossWorld();
    const b = world.boss;
    b.next = 'cloud';
    b.idleT = 0;
    runUntil(world, () => clouds(world).length === 1, 3);
    hitEnemy(world, b, 99999999, 1, 0, 0, { unblockable: true });
    for (let t = 0; t < 2; t += DT) {
      world.choice = null;
      world.pendingLevelUps = 0;
      updateWorld(world, DT, idle);
    }
    expect(clouds(world)).toHaveLength(0);
  });
});

describe('種族「雨」', () => {
  const dummy = (world, x = 360) => {
    const e = addEnemy(world, 'grunt', x, 300);
    e.def = { ...e.def, speed: 0 };
    e.hp = e.maxHp = 1000000;
    return e;
  };

  it('部品は5つ', () => {
    expect(DATA.implants.all().filter((d) => d.species === 'rain')).toHaveLength(5);
  });

  it('雨具：酸の雨（雨の周期、雨雲）のダメージを受けない。被ダメージも少し減る', () => {
    const world = rainWorld({ implants: ['raincoat'] });
    const p = world.player;
    startRain(world, 3);
    addEnemy(world, 'raincloud', p.x, p.y);
    run(world, 2.5);
    expect(p.hp).toBe(p.stats.maxHp);
    expect(world.rainHits).toBe(0);
    expect(p.stats.damageTaken).toBeCloseTo(0.95);
  });

  it('恵みの雷：4秒ごとに、近くの敵1体に落雷する。敵がいなければ、落ちない', () => {
    const world = rainWorld({ implants: ['blessing'], rain: false });
    world.player.inv = Infinity;
    run(world, 6);
    const e = dummy(world);
    const far = dummy(world, 300 + STATUS.skyBolt.range + 200);
    const hp = e.hp;
    run(world, 0.5);
    expect(hp - e.hp).toBe(30);
    expect(far.hp).toBe(far.maxHp);
    run(world, STATUS.skyBolt.interval - 1);
    expect(hp - e.hp).toBe(30);
    run(world, 1.2);
    expect(hp - e.hp).toBe(60);
  });

  it('軒下：立ち止まっている間だけ、HP が戻る', () => {
    const world = rainWorld({ implants: ['eaves'], rain: false });
    const p = world.player;
    p.hp = 50;
    run(world, 3.3);
    expect(p.hp).toBeGreaterThan(52.5);
    const moving = rainWorld({ implants: ['eaves'], rain: false });
    moving.player.hp = 50;
    for (let t = 0; t < 2; t += DT) updateWorld(moving, DT, { ...idle, mx: Math.sin(t * 20) > 0 ? 1 : -1 });
    expect(moving.player.hp).toBeLessThan(50.5);
  });

  it('雷雲：電撃属性を持っているときだけ、攻撃力 +15%', () => {
    expect(statWith(rainWorld({ implants: ['thunderhead'] }), 'attackMul')).toBeCloseTo(1);
    expect(statWith(rainWorld({ implants: ['thunderhead', 'voltedge'] }), 'attackMul')).toBeCloseTo(1.15);
  });

  it('増水：敵を倒すたびに、その部屋にいる間、攻撃力が上がる。10体ぶんまで', () => {
    const world = rainWorld({ implants: ['flood'], rain: false });
    const e = dummy(world);
    const dealt = () => {
      const hp = e.hp;
      hitEnemy(world, e, 100, 1, 0, 0);
      return hp - e.hp;
    };
    expect(dealt()).toBe(100);
    world.kills = 3;
    expect(dealt()).toBe(106);
    world.kills = 50;
    expect(dealt()).toBe(120);
  });

  it('種族ボーナス：2種類で移動速度 +8%。3種類で、敵を倒すと近くの敵に落雷', () => {
    const two = rainWorld({ implants: ['eaves', 'flood'], rain: false });
    expect(two.player.stats.moveSpeedMul).toBeCloseTo(1.08);
    const three = rainWorld({ implants: ['eaves', 'flood', 'raincoat'], rain: false });
    const a = addEnemy(three, 'grunt', 360, 300);
    const near = dummy(three, 420);
    hitEnemy(three, a, 99999999, 1, 0, 0);
    expect(near.hp).toBeLessThan(near.maxHp);
  });
});
