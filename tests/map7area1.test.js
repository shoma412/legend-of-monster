import { describe, expect, it } from 'vitest';
import { LOOT } from '../src/data/balance.js';
import { BGM } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { species } from '../src/data/implants.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES, RARITY_COLORS } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { fire } from '../src/game/effects.js';
import { createEnemy } from '../src/game/enemyAI.js';
import { NEXT_AREA, createRun, currentArea, enterRoom, skipToBoss } from '../src/game/run.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { makeItem, rollRarity, describeItem } from '../src/logic/loot.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ7「核心区」エリア1「中枢の門」と、ミシック（docs/詳細仕様.md「36. マップ7「核心区」と、ミシック」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const gk = DATA.bosses.get('gatekeeper');

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeWorld({ boss = null, waves = [{}], implants = [] } = {}) {
  const room = { type: 'combat', waves: boss ? [{ boss }] : waves, objects: [], doors: [], clearCredits: 0 };
  const world = createWorld({ room, rng: seeded(21), weaponId: 'sword' });
  world.waveTimer = boss ? 0 : Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  world.player.x = 400;
  world.player.y = 300;
  return world;
}

function bossWorld() {
  const world = makeWorld({ boss: 'gatekeeper' });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  const b = world.boss;
  b.idleT = Infinity;
  b.x = 700;
  b.y = 300;
  world.player.inv = Infinity;
  world.player.stats.maxHp = 99999;
  world.player.hp = 99999;
  world.player.x = 400;
  world.player.y = 300;
  return world;
}

function startMove(world, name) {
  const b = world.boss;
  const p = world.player;
  const d = { dx: p.x - b.x, dy: p.y - b.y, dist: Math.hypot(p.x - b.x, p.y - b.y) || 1 };
  b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
  PATTERNS[b.act.def.pattern].start(world, b, b.act, d);
  return b.act;
}

function run(world, seconds) {
  for (let t = 0; t < seconds; t += DT) updateWorld(world, DT, idle);
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

const hazardsOf = (world, type) => world.hazards.filter((h) => h.type === type);

describe('ミシック：レア度と抽選', () => {
  it('レジェンドの上に、赤いミシックがある。効果は5個で、値はほぼ最大', () => {
    const r = LOOT.rarities;
    expect(r.map((x) => x.id)).toEqual(['common', 'rare', 'epic', 'legend', 'mythic']);
    expect(r[4].effects).toBe(5);
    expect(r[4].roll[0]).toBeGreaterThan(r[3].roll[0]);
    expect(RARITY_COLORS.mythic).toBe('#ff3b4a');
  });

  it('ミシックは、ミシック専用の固有効果（そのスロット用）が1つ付く。レジェンドには、ミシック専用は付かない', () => {
    const mythicIds = DATA.legendEffects.all().filter((u) => u.mythic).map((u) => u.id);
    expect(mythicIds).toHaveLength(6);
    for (const slot of ['mod', 'armor', 'acc']) {
      for (let i = 0; i < 20; i++) {
        const item = makeItem(seeded(i + 1), { rarity: 4, slot });
        expect(item.rarity).toBe(4);
        expect(item.effects).toHaveLength(4);
        const u = DATA.legendEffects.get(item.unique);
        expect(u.mythic).toBe(true);
        expect(u.slot).toBe(slot);
        expect(describeItem(item).at(-1)).toContain('★');
      }
    }
    for (let i = 0; i < 30; i++) expect(DATA.legendEffects.get(makeItem(seeded(i + 1), { rarity: 3 }).unique).mythic).toBeFalsy();
  });

  it('mythic が 0 なら、ミシックは出ない。確率 1 なら必ず出る。やり直しの回数ぶん、引き直せる', () => {
    const rng = seeded(3);
    for (let i = 0; i < 500; i++) expect(rollRarity(rng, 3, 3, 0)).toBeLessThan(4);
    expect(rollRarity(seeded(1), 0, 0, 1)).toBe(4);
    // 確率 0.5：1回なら外れる乱数でも、2回めで当たる
    const seq = [0.9, 0.2];
    let k = 0;
    const rig = () => (k < 3 ? [0.5, 0.9, 0.2][k++] : 0.5);
    expect(rollRarity(rig, 0, 0, 0.5, 2)).toBe(4);
    void seq;
  });

  it('確率の表：マップ5から。マップ7がいちばん高い。マップ7の最後のボスは装備を落とさないので 0', () => {
    expect(LOOT.mythic.map5).toHaveLength(3);
    expect(LOOT.mythic.map6).toHaveLength(4);
    expect(LOOT.mythic.map7).toHaveLength(5);
    for (let i = 0; i < 3; i++) expect(LOOT.mythic.map7[i]).toBeGreaterThan(LOOT.mythic.map6[i]);
    expect(LOOT.mythic.map1).toBeUndefined();
    expect(LOOT.bossMythic.map7.at(-1)).toBe(0);
    expect(LOOT.bossMythic.map7[3]).toBe(0.5);
  });

  it('ミシック固有効果：連鎖爆轟（まわりの敵に爆発）、超過駆動（倒すと攻撃速度）、不屈（起き上がる）', () => {
    const world = makeWorld();
    const a = createEnemy(DATA.enemies.get('grunt'), 450, 300, 0, world.rng);
    const b = createEnemy(DATA.enemies.get('grunt'), 500, 300, 0, world.rng);
    a.hp = a.maxHp = b.hp = b.maxHp = 100000;
    world.enemies.push(a, b);
    world.player.stats.effects ??= [];
    const hp = b.hp;
    // 確率を 1 にした連鎖爆轟を、直接呼ぶ
    fire(world, 'hit', { target: a, elements: [], primary: true });
    expect(b.hp).toBe(hp); // 装備していなければ、何も起きない
    world.player.build.gear.mod = { slot: 'mod', rarity: 4, effects: [], unique: 'chainburst', name: 'x' };
    recalcStats(world.player);
    world.rng = () => 0;
    fire(world, 'hit', { target: a, elements: [], primary: true });
    expect(b.hp).toBeLessThan(hp);

    world.player.build.gear.acc = { slot: 'acc', rarity: 4, effects: [], unique: 'overclock', name: 'y' };
    recalcStats(world.player);
    fire(world, 'kill', { target: a, elements: [], primary: true });
    expect(world.player.buffs.some((x) => x.id === 'overclock' && x.stat === 'attackSpeed')).toBe(true);

    world.player.build.gear.armor = { slot: 'armor', rarity: 4, effects: [], unique: 'undying', name: 'z' };
    recalcStats(world.player);
    expect(world.player.stats.revive).toBeCloseTo(0.5);
  });

  it('マップ7の部屋は、ミシックの確率と環境（暗闇）を持つ。ほかのマップは 0', () => {
    const save = undefined;
    const run7 = createRun({ weaponId: 'sword', rng: seeded(5), mapId: 'map7', ...(save ? { save } : {}) });
    const world = enterRoom(run7);
    expect(world.room.mythicChance).toBe(LOOT.mythic.map7[0]);
    expect(world.room.mythicLuck).toBe(true);
    expect(world.room.environment?.id).toBe('dark');
    const run1 = createRun({ weaponId: 'sword', rng: seeded(5), mapId: 'map1' });
    const w1 = enterRoom(run1);
    expect(w1.room.mythicChance).toBe(0);
    expect(w1.room.mythicLuck).toBe(false);
  });

  it('ボスの装備：確率 1 なら、ミシックが落ちる。最後のボス（確率 0）は落とさない', () => {
    const world = makeWorld({ boss: 'gatekeeper' });
    while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
    world.room.bossMythic = 1;
    world.room.noBossLoot = false;
    const b = world.boss;
    b.hp = 1;
    b.x = 700;
    b.y = 300;
    hitEnemy(world, b, 999999, 1, 0, 0, { unblockable: true });
    run(world, 0.5);
    expect(world.loot.length).toBeGreaterThanOrEqual(3);
    expect(world.loot.every((l) => l.item.rarity === 4)).toBe(true);
  });
});

describe('エリア1「中枢の門」の定義', () => {
  const map = maps.find((m) => m.id === 'map7');
  const area = DATA.areas.get('gate');

  it('マップ7の1つ目のエリア。背景・曲・ボス・素材・データ片4つがそろっている', () => {
    expect(map.name).toBe('核心区');
    expect(map.requiresPass).toBe('map6'); // 送風区の通行証（マップ6の隠しボス「カーム」）
    expect(map.enemyScale).toBeGreaterThan(maps.find((m) => m.id === 'map6').enemyScale);
    expect(map.areas[0]).toBe('gate');
    expect(area.name).toBe('中枢の門');
    expect(area.environment).toBe('dark');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    expect(area.boss).toBe('gatekeeper');
    expect(gk.weakness).toBe('heat');
    expect(gk.hp).toBeGreaterThan(DATA.bosses.get('cyclone').hp);
    expect(DATA.materials.get(gk.material).name).toBe('ゲートコア');
    expect(MATERIAL_ICONS[gk.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === 'gate');
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    expect(DATA.achievements.get('gatekeeper').name).toBe('門破り');
    expect(DATA.achievements.get('mythic').name).toBe('赤の領域');
    expect(species.gate.boss).toBe('gatekeeper');
    expect(DATA.implants.all().filter((d) => d.species === 'gate')).toHaveLength(5);
  });

  it('雑魚は定義がそろい、前のマップの雑魚より強い。ボスの部品はほかのボスと重ならない', () => {
    for (const { id } of area.enemies) expect(DATA.enemies.get(id), id).toBeDefined();
    expect(DATA.enemies.get('gateguard').hp).toBeGreaterThan(DATA.enemies.get('shield').hp * 3);
    const others = new Set();
    for (const boss of DATA.bosses.all()) if (boss.id !== 'gatekeeper') for (const a of Object.values(boss.attacks)) others.add(a.pattern);
    for (const a of Object.values(gk.attacks)) {
      expect(PATTERNS[a.pattern], a.pattern).toBeDefined();
      expect(others.has(a.pattern), a.pattern).toBe(false);
    }
  });

  it('マップ7のエリア1に出撃してボス部屋まで進める', () => {
    const run7 = createRun({ weaponId: 'sword', rng: seeded(9), mapId: 'map7' });
    expect(currentArea(run7).id).toBe('gate');
    skipToBoss(run7, enterRoom(run7));
    const world = enterRoom(run7);
    expect(world.room.waves[0].boss).toBe('gatekeeper');
    expect(NEXT_AREA).toBeDefined();
  });
});

describe('ゲートキーパーの攻撃', () => {
  it('閉門：予告のあと、両側から門板が閉まる。すき間の中は安全、板の中は当たる', () => {
    const world = bossWorld();
    world.player.inv = 0;
    startMove(world, 'gateclose');
    expect(runUntil(world, () => hazardsOf(world, 'gateslab').length === 2, 3)).toBe(true);
    const slab = hazardsOf(world, 'gateslab')[0];
    // すき間の真ん中に立つ
    const axis = slab.axis;
    const hp = world.player.hp;
    for (let i = 0; i < 240; i++) {
      if (axis === 'x') world.player.x = slab.center;
      else world.player.y = slab.center;
      updateWorld(world, DT, idle);
      if (slab.phase === 'hold') break;
    }
    expect(slab.phase === 'hold' || slab.trav > 0.9).toBe(true);
    expect(world.player.hp).toBe(hp);
    // 板の中（壁ぎわ）に立つと当たる
    const w2 = bossWorld();
    w2.player.inv = 0;
    startMove(w2, 'gateclose');
    runUntil(w2, () => hazardsOf(w2, 'gateslab').length === 2, 3);
    const s2 = hazardsOf(w2, 'gateslab')[0];
    const hp2 = w2.player.hp;
    for (let i = 0; i < 300 && s2.phase !== 'hold'; i++) {
      if (s2.axis === 'x') w2.player.x = w2.bounds.left + 20;
      else w2.player.y = w2.bounds.top + 20;
      updateWorld(w2, DT, idle);
    }
    expect(w2.player.hp).toBeLessThan(hp2);
  });

  it('検問弾：浮かんで止まり、止まったあと、プレイヤーめがけて飛ぶ', () => {
    const world = bossWorld();
    startMove(world, 'holdshots');
    expect(runUntil(world, () => hazardsOf(world, 'holdshot').length === 8, 3)).toBe(true);
    const s = hazardsOf(world, 'holdshot')[4];
    // 浮かんでいる間は動かない
    run(world, 0.5);
    const x0 = s.x;
    const y0 = s.y;
    run(world, 0.1);
    if (s.phase === 'hold') expect(Math.hypot(s.x - x0, s.y - y0)).toBeLessThan(1);
    // 飛び始める
    expect(runUntil(world, () => s.phase === 'fly', 4)).toBe(true);
    const d0 = Math.hypot(world.player.x - s.x, world.player.y - s.y);
    run(world, 0.3);
    expect(Math.hypot(world.player.x - s.x, world.player.y - s.y)).toBeLessThan(d0);
  });

  it('衛兵召喚：盾を持った門衛が出る。体力は弱め、時間で消える', () => {
    const world = bossWorld();
    startMove(world, 'callguards');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'gateguard').length === 2, 3)).toBe(true);
    const g = world.enemies.find((e) => e.def.id === 'gateguard');
    const full = createEnemy(DATA.enemies.get('gateguard'), 0, 0, 0, world.rng, world.room.enemyScale ?? 1, world.room.hpScale ?? 1);
    expect(g.maxHp).toBeLessThan(full.maxHp);
    expect(g.expire).toBeGreaterThan(world.time);
  });

  it('裂け目：予告の線のあと、一瞬だけ当たる。線から外れていれば当たらない', () => {
    const world = bossWorld();
    world.player.inv = 0;
    world.player.x = 300;
    world.player.y = 300;
    startMove(world, 'fissure');
    expect(runUntil(world, () => hazardsOf(world, 'fissure').length === 1, 3)).toBe(true);
    const hp = world.player.hp;
    run(world, 2);
    expect(world.player.hp).toBeLessThan(hp);

    const w2 = bossWorld();
    w2.player.inv = 0;
    w2.player.x = 300;
    w2.player.y = 300;
    startMove(w2, 'fissure');
    runUntil(w2, () => hazardsOf(w2, 'fissure').length === 1, 3);
    const f = hazardsOf(w2, 'fissure')[0];
    const hp2 = w2.player.hp;
    w2.player.x = w2.boss.x;
    w2.player.y = w2.boss.y > 400 ? w2.boss.y - 250 : w2.boss.y + 250; // 線から十分に離れる
    w2.player.y = Math.min(Math.max(w2.player.y, w2.bounds.top + 20), w2.bounds.bottom - 20);
    void f;
    run(w2, 2);
    expect(w2.player.hp).toBe(hp2);
  });

  it('尾行爆弾：プレイヤーを追いかけ、近づくと爆発する', () => {
    const world = bossWorld();
    world.player.inv = 0;
    startMove(world, 'tailbomb');
    expect(runUntil(world, () => hazardsOf(world, 'tailbomb').length === 2, 3)).toBe(true);
    const bomb = hazardsOf(world, 'tailbomb')[0];
    bomb.wait = 0;
    const d0 = Math.hypot(world.player.x - bomb.x, world.player.y - bomb.y);
    run(world, 0.5);
    expect(Math.hypot(world.player.x - bomb.x, world.player.y - bomb.y)).toBeLessThan(d0);
    const hp = world.player.hp;
    bomb.x = world.player.x + 5;
    bomb.y = world.player.y;
    run(world, 0.2);
    expect(bomb.dead).toBe(true);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('大技「全門閉鎖」：門板が何度も閉まり、検問弾も出る。最後まで終わる', () => {
    const world = bossWorld();
    startMove(world, 'lockdown');
    expect(runUntil(world, () => hazardsOf(world, 'gateslab').length === 6, 4)).toBe(true);
    expect(hazardsOf(world, 'holdshot').length).toBe(10);
    expect(runUntil(world, () => !world.boss.act, 30)).toBe(true);
  });

  it('後半は連携を2つ持つ。反応は裂け目、大技は全門閉鎖', () => {
    expect(gk.phases.at(-1).combos).toHaveLength(2);
    expect(gk.reactions[0].move).toBe('fissure');
    expect(gk.ultimate.move).toBe('lockdown');
  });
});

describe('絵：ゲートキーパーの全攻撃と雑魚を描いても、エラーにならない', () => {
  it('全部描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawLoot, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const name of Object.keys(gk.attacks)) {
      const world = bossWorld();
      world.boss.hp = world.boss.maxHp * 0.2;
      startMove(world, name);
      let frame = 0;
      for (let t = 0; t < 40 && world.boss.act; t += DT) {
        updateWorld(world, DT, idle);
        if (frame++ % 3 === 0) {
          drawHazards(g, world);
          drawBossTelegraph(g, world);
          drawEnemies(g, world);
          drawPlayer(g, world);
        }
      }
      expect(frame, name).toBeGreaterThan(3);
    }
    const world = makeWorld();
    for (const id of ['gateguard', 'scanner']) world.enemies.push(createEnemy(DATA.enemies.get(id), 600, 300, 0, world.rng));
    world.loot.push({ x: 300, y: 300, item: makeItem(seeded(1), { rarity: 4 }), t: 0 });
    drawEnemies(g, world);
    drawLoot(g, world);
  });
});
