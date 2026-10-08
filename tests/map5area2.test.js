import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { STATUS } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { afflictPlayer, effectDamage, hitEnemy, slowPlayer } from '../src/game/combat.js';
import { blindPlayer } from '../src/game/darkness.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { createRun, enterRoom, handleEvents } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ5 エリア2「中和プラント」（docs/詳細仕様.md「28. マップ5」の ②）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('acidrain');
const def = DATA.bosses.get('buffertank');

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 雨の降らない、ふつうの部屋（敵と効果だけを確かめる）
function makeWorld({ implants = [], waves = [{}], rain = false, dark = false } = {}) {
  const environment = rain ? env : dark ? DATA.environments.get('dark') : null;
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment, roofs: [], lamps: [] };
  const world = createWorld({ room, rng: () => 0.99, weaponId: 'sword' }); // 0.99：会心なし
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

function bossWorld(implants = []) {
  const world = makeWorld({ implants, waves: [{ boss: 'buffertank' }] });
  world.rng = seeded(21);
  world.waveTimer = 0;
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  const b = world.boss;
  b.idleT = Infinity;
  b.hp = b.maxHp = 100000000;
  world.player.inv = Infinity;
  updateWorld(world, DT, idle); // 最初の色が決まる
  world.rng = () => 0.99;
  return world;
}

const dealt = (world, e, base = 100) => {
  const hp = e.hp;
  hitEnemy(world, e, base, 1, 0, 0);
  return hp - e.hp;
};

describe('マップ5 エリア2「中和プラント」の定義', () => {
  it('色・背景・敵・ボス・素材・データ片・種族・曲がそろっている', () => {
    const map = maps[4];
    expect(map.areas.slice(0, 2)).toEqual(['drainway', 'neutral']);
    const area = DATA.areas.get('neutral');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    for (const id of [...area.enemies.map((x) => x.id), ...area.eliteBases]) expect(DATA.enemies.has(id), id).toBe(true);
    expect(area.boss).toBe('buffertank');
    expect(def.weakness).toBeNull();
    expect(MATERIAL_ICONS[def.material]).toBeDefined();
    const frags = DATA.fragments.all().filter((f) => f.area === 'neutral');
    expect(frags.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(frags.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(mapSpecies(map)).toEqual(expect.arrayContaining(['rust', 'buffer']));
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
  });

  it('バッファータンクを倒すと、バッファーコアと実績が手に入る', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3', 'map4']) recordMapClear(save, id, 1);
    save.passes.push('map3', 'map4');
    const r = createRun({ rng: seeded(7), save, mapId: 'map5', weaponId: 'sword' });
    r.areaIndex = 1;
    r.plan.current = 'boss';
    const world = enterRoom(r);
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    expect(world.boss.def.id).toBe('buffertank');
    world.player.inv = Infinity;
    hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
    handleEvents(r, world);
    expect(save.materials.bufferCore).toBeGreaterThan(0);
    expect(save.achievements).toContain('buffertank');
  });
});

describe('雑魚：中和機・酸吐き', () => {
  it('中和機：まわりの敵の腐食・燃焼・減速を消す。遠くの敵のものは消さない。攻撃はしない', () => {
    const world = makeWorld();
    const p = world.player;
    const c = addEnemy(world, 'neutralizer', 620, 300);
    c.def = { ...c.def, speed: 0 };
    const near = addEnemy(world, 'grunt', 680, 300);
    const far = addEnemy(world, 'grunt', 620 + c.def.cleanse.radius * 2.5, 300);
    for (const e of [near, far]) {
      e.def = { ...e.def, speed: 0 };
      e.hp = e.maxHp = 100000;
      e.corrodeT = 99;
      e.burnT = 99;
      e.slowT = 99;
    }
    run(world, c.def.cleanse.interval + 0.2);
    expect([near.corrodeT, near.burnT, near.slowT].every((v) => v <= 0)).toBe(true);
    expect(far.corrodeT).toBeGreaterThan(0);
    expect(far.burnT).toBeGreaterThan(0);
    run(world, 6);
    expect(p.hp).toBe(p.stats.maxHp);
  });

  it('酸吐き：弾が当たると、ダメージに加えて「腐食」（持続ダメージ）が付く', () => {
    const world = makeWorld();
    const p = world.player;
    const e = addEnemy(world, 'spitter', 560, 300);
    e.cd = 0;
    expect(runUntil(world, () => p.hp < p.stats.maxHp, 6)).toBe(true);
    expect(p.dot?.id).toBe('corrode');
    const hp = p.hp;
    e.dead = true;
    world.shots = [];
    run(world, 1.2);
    expect(p.hp).toBeLessThan(hp);
  });
});

describe('ボス「バッファータンク」：色（弱点）の切り替え', () => {
  it('そのボスだけの攻撃（放出・飽和）を持ち、前半から使う。後半は5種類の攻撃', () => {
    for (const pattern of ['emit', 'saturate']) {
      expect(PATTERNS[pattern]).toBeDefined();
      expect(def.phases[0].moves.some((m) => def.attacks[m].pattern === pattern), pattern).toBe(true);
      for (const other of DATA.bosses.all()) {
        if (other.id !== 'buffertank') expect(Object.values(other.attacks).some((a) => a.pattern === pattern), other.id).toBe(false);
      }
    }
    expect(Object.keys(def.attacks.emit.byElement).sort()).toEqual([...def.attune.elements].sort());
  });

  it('最初から色が付いている。9秒ごとに、別の色に切り替わる。切り替わる前に、次の色が決まる', () => {
    const world = bossWorld();
    const b = world.boss;
    world.rng = seeded(5);
    const first = b.attune;
    expect(def.attune.elements).toContain(first);
    run(world, def.attune.every - def.attune.telegraph - 0.3);
    expect(b.attune).toBe(first);
    expect(b.attuneNext ?? null).toBeNull();
    run(world, 0.6);
    expect(b.attuneNext).toBeTruthy();
    expect(b.attuneNext).not.toBe(first);
    const next = b.attuneNext;
    run(world, def.attune.telegraph + 0.2);
    expect(b.attune).toBe(next);
    // 何回切り替わっても、同じ色が続くことはない
    let last = b.attune;
    for (let i = 0; i < 6; i++) {
      run(world, def.attune.every);
      expect(b.attune).not.toBe(last);
      last = b.attune;
    }
  });

  it('今の色と同じ属性は弱点（×1.5）。合わない属性は通りにくい（×0.6）。属性なしは、そのまま', () => {
    const plain = bossWorld();
    expect(dealt(plain, plain.boss)).toBe(100);

    const fire = bossWorld(['incendiary']); // 熱属性
    fire.boss.attune = 'heat';
    expect(dealt(fire, fire.boss)).toBe(150);
    fire.boss.attune = 'cold';
    expect(dealt(fire, fire.boss)).toBe(60);

    // 属性を2つ持っていて、片方が合えば弱点
    const both = bossWorld(['incendiary', 'coolant']);
    both.boss.attune = 'cold';
    expect(dealt(both, both.boss)).toBe(150);
    both.boss.attune = 'shock';
    expect(dealt(both, both.boss)).toBe(60);
  });

  it('インプラントなどの追加ダメージも、今の色が弱点になる', () => {
    const world = bossWorld();
    const b = world.boss;
    const hit = (element) => {
      const hp = b.hp;
      effectDamage(world, b, 100, element);
      return hp - b.hp;
    };
    b.attune = 'shock';
    expect(hit('shock')).toBe(150);
    expect(hit('heat')).toBe(100);
  });

  it('ほかの敵やボスには、関係しない（弱点は、今までどおり決まったもの）', () => {
    const world = makeWorld({ implants: ['incendiary'] });
    const e = addEnemy(world, 'grunt', 600, 300);
    e.hp = e.maxHp = 100000;
    expect(dealt(world, e)).toBe(100);
  });
});

describe('ボス「バッファータンク」：放出と飽和', () => {
  const emit = (element) => {
    const world = bossWorld();
    const b = world.boss;
    b.attune = element;
    b.attuneT = 99;
    b.next = 'emit';
    b.idleT = 0;
    updateWorld(world, DT, idle);
    b.idleT = Infinity;
    return { world, b };
  };

  it('放出：今の色に合わせた攻撃になる（電撃：線、熱：炎の床、冷却：減速つきの弾、腐食：酸の床）', () => {
    const shock = emit('shock');
    expect(shock.b.act.def.pattern).toBe('lines');
    expect(runUntil(shock.world, () => shock.world.hazards.some((h) => h.type === 'bar'), 3)).toBe(true);

    const heat = emit('heat');
    expect(runUntil(heat.world, () => heat.world.hazards.some((h) => h.type === 'pool'), 3)).toBe(true);
    expect(heat.world.hazards.find((h) => h.type === 'pool').dot).toBe('burn');

    const cold = emit('cold');
    expect(runUntil(cold.world, () => cold.world.shots.length > 0, 3)).toBe(true);
    expect(cold.world.shots.every((s) => s.slow)).toBe(true);

    const acid = emit('corrode');
    expect(runUntil(acid.world, () => acid.world.hazards.some((h) => h.type === 'pool'), 3)).toBe(true);
    expect(acid.world.hazards.find((h) => h.type === 'pool').dot).toBe('corrode');
  });

  it('放出の床：踏むと、その属性の持続ダメージが付く', () => {
    const { world } = emit('heat');
    runUntil(world, () => world.hazards.some((h) => h.type === 'pool' && h.arm <= 0), 4);
    const pool = world.hazards.find((h) => h.type === 'pool');
    const p = world.player;
    p.inv = 0;
    p.x = pool.x;
    p.y = pool.y;
    expect(runUntil(world, () => p.dot?.id === 'burn', 2)).toBe(true);
  });

  it('飽和：色の印が3つ（別々の色）並び、その順番で放出を3回続けて出す。今の色とは関係ない', () => {
    const world = bossWorld();
    const b = world.boss;
    world.rng = seeded(9);
    b.attuneT = 99;
    b.next = 'saturate';
    b.idleT = 0;
    updateWorld(world, DT, idle);
    b.idleT = Infinity;
    const sequence = [...b.act.sequence];
    expect(sequence).toHaveLength(3);
    expect(new Set(sequence).size).toBe(3);
    const seen = [];
    let last = null;
    for (let t = 0; t < 20 && seen.length < 3; t += DT) {
      updateWorld(world, DT, idle);
      if (b.act && b.act !== last && b.act.element) {
        seen.push(b.act.element);
        last = b.act;
      }
    }
    expect(seen).toEqual(sequence);
  });

  it('大技「全属性飽和」：4つの色すべてを出す。そのあと、色の切り替わりが速くなる', () => {
    const world = bossWorld();
    const b = world.boss;
    world.rng = seeded(3);
    b.next = 'overflow';
    b.idleT = 0;
    updateWorld(world, DT, idle);
    b.idleT = Infinity;
    expect([...b.act.sequence].sort()).toEqual([...def.attune.elements].sort());
    expect(runUntil(world, () => b.frenzyT > 0, 4)).toBe(true);
    // 速くなっている間：3秒ごとに切り替わる
    const start = b.attune;
    b.attuneT = def.attune.frenzyEvery;
    b.attuneNext = null;
    run(world, def.attune.frenzyEvery + 0.2);
    expect(b.attune).not.toBe(start);
    expect(b.attuneT).toBeLessThanOrEqual(def.attune.frenzyEvery);
  });
});

describe('種族「中和」', () => {
  const dummy = (world) => {
    const e = addEnemy(world, 'grunt', 360, 300);
    e.def = { ...e.def, speed: 0 };
    e.hp = e.maxHp = 1000000;
    return e;
  };

  it('部品は5つ', () => {
    expect(DATA.implants.all().filter((d) => d.species === 'buffer')).toHaveLength(5);
  });

  it('反応促進：持っている属性の種類ごとに、攻撃力 +6%。属性がなければ、増えない', () => {
    expect(dealt(makeWorld({ implants: ['reactant'] }), dummy(makeWorld()))).toBe(100);
    const none = makeWorld({ implants: ['reactant'] });
    expect(dealt(none, dummy(none))).toBe(100);
    const two = makeWorld({ implants: ['reactant', 'voltedge', 'acid'] });
    expect(two.player.stats.elements).toHaveLength(2);
    expect(dealt(two, dummy(two))).toBe(112);
  });

  it('無色：属性を1つも持っていないときだけ、攻撃力 +12%', () => {
    const none = makeWorld({ implants: ['colorless'] });
    expect(statWith(none, 'attackMul')).toBeCloseTo(1.12);
    const one = makeWorld({ implants: ['colorless', 'voltedge'] });
    expect(statWith(one, 'attackMul')).toBeCloseTo(1);
  });

  it('指示薬：弱点を突いたときのダメージが増える（×1.5 → ×1.65）', () => {
    const world = makeWorld({ implants: ['indicator', 'coolant'], waves: [{ boss: 'boltboar' }] });
    world.waveTimer = 0;
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    const b = world.boss;
    b.idleT = Infinity;
    b.hp = b.maxHp = 1000000;
    expect(b.def.weakness).toBe('cold');
    expect(dealt(world, b)).toBe(165);
  });

  it('飽和：状態異常が付いている敵へのダメージ +10%', () => {
    const world = makeWorld({ implants: ['saturation'] });
    const e = dummy(world);
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1);
    e.slowT = 2;
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.1);
    e.slowT = 0;
    e.burnT = 2;
    expect(statWith(world, 'attackMul', e)).toBeCloseTo(1.1);
  });

  it('中和剤：自分が受ける減速・目くらみ・持続ダメージの時間が、4割短くなる', () => {
    const plain = makeWorld();
    const cut = makeWorld({ implants: ['antidote'] });
    for (const w of [plain, cut]) {
      slowPlayer(w);
      afflictPlayer(w, 'burn');
    }
    expect(cut.player.slowT).toBeCloseTo(plain.player.slowT * 0.6);
    expect(cut.player.dot.t).toBeCloseTo(STATUS.dots.burn.duration * 0.6);
    const d1 = makeWorld({ dark: true });
    const d2 = makeWorld({ dark: true, implants: ['antidote'] });
    blindPlayer(d1);
    blindPlayer(d2);
    expect(d2.player.blindT).toBeCloseTo(d1.player.blindT * 0.6);
  });

  it('種族ボーナス：2種類で、弱点を突いたときのダメージ +15%。3種類で、属性の種類ごとに攻撃力 +5%', () => {
    const two = makeWorld({ implants: ['colorless', 'saturation'] });
    expect(two.player.stats.weakBonus).toBeCloseTo(0.15);
    const three = makeWorld({ implants: ['colorless', 'saturation', 'antidote'] });
    expect(three.player.stats.elementPower).toBeCloseTo(0.05);
  });
});
