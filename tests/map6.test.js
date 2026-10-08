import { describe, expect, it } from 'vitest';
import { BGM } from '../src/data/audio.js';
import { LOOT } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { maps } from '../src/data/maps.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { recalcStats } from '../src/game/build.js';
import { hitEnemy } from '../src/game/combat.js';
import { statWith } from '../src/game/effects.js';
import { createEnemy, debrisCount, dropDebris } from '../src/game/enemyAI.js';
import { flowAt, isBlowing, placeScreens, sheltered } from '../src/game/wind.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { DEG, roomBounds } from '../src/logic/geometry.js';
import { lockReason, mapState, recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';
import { mapSpecies } from '../src/logic/stats.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { MATERIAL_ICONS } from '../src/render/metaIcons.js';

// マップ6「送風区」と、環境「強風」（docs/詳細仕様.md「30. マップ6「送風区」と、環境「強風」」）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };
const env = DATA.environments.get('gale');
const EAST = { dirX: 1, dirY: 0 };

function windWorld({ screens = [], waves = [{}], implants = [] } = {}) {
  const room = { type: 'combat', waves, objects: [], doors: [], clearCredits: 0, environment: env, screens };
  const world = createWorld({ room, rng: () => 0.99, weaponId: 'sword' });
  world.waveTimer = Infinity;
  for (const id of implants) world.player.build.implants[id] = (world.player.build.implants[id] ?? 0) + 1;
  recalcStats(world.player);
  world.player.x = 300;
  world.player.y = 300;
  return world;
}

// 風を、決めた向きに吹かせる
function blow(world, dir = EAST, seconds = env.cycle.blow) {
  world.wind = { phase: 'blow', t: seconds, max: seconds, ...dir };
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

function bossWorld(screens = []) {
  const world = windWorld({ screens, waves: [{ boss: 'intake' }] });
  world.waveTimer = 0;
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  const b = world.boss;
  b.idleT = Infinity;
  b.x = 600;
  b.y = 300;
  b.littered = true; // 最初のがれきは、まかない（数を数えやすくするため）
  world.player.inv = Infinity;
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

describe('マップ6「送風区」の定義', () => {
  const map = maps.find((m) => m.id === 'map6');

  it('マップ6は、強風のマップ。雑魚はマップ1の5倍。入るには、マップ5の完了と、溶解区の通行証が要る', () => {
    expect(map.name).toBe('送風区');
    expect(map.ready).not.toBe(false);
    expect(map.environment).toBe('gale');
    expect(map.enemyScale).toBe(5);
    expect(map.requiresPass).toBe('map5');
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3', 'map4', 'map5']) recordMapClear(save, id, 1);
    save.passes = ['map3', 'map4'];
    expect(mapState(save, map)).toBe('locked');
    expect(lockReason(save, map)).toContain('溶解区');
    save.passes.push('map5');
    expect(mapState(save, map)).toBe('open');
  });

  it('エリア1「吸気口」は、背景・曲・ボス・素材・データ片4つがそろっている', () => {
    const area = DATA.areas.get(map.areas[0]);
    expect(area.name).toBe('吸気口');
    expect(AREA_THEMES[area.theme]).toBeDefined();
    expect(hasBackdrop(area.theme)).toBe(true);
    expect(BGM[area.bgm]).toBeDefined();
    expect(BGM[area.bossBgm]).toBeDefined();
    const boss = DATA.bosses.get(area.boss);
    expect(boss.name).toBe('インテーク');
    expect(boss.weakness).toBe('corrode');
    expect(DATA.materials.get(boss.material).name).toBe('インテークコア');
    expect(MATERIAL_ICONS[boss.material]).toBeTypeOf('function');
    const fragments = DATA.fragments.all().filter((f) => f.area === area.id);
    expect(fragments.filter((f) => f.source === 'vault')).toHaveLength(3);
    expect(fragments.filter((f) => f.source === 'boss')).toHaveLength(1);
    for (const e of area.enemies) expect(DATA.enemies.has(e.id), e.id).toBe(true);
    for (const id of area.eliteBases) expect(DATA.enemies.has(id), id).toBe(true);
  });

  it('このマップで出る種族は「吸気」。部品は5つ', () => {
    expect(mapSpecies(map)).toContain('intake');
    expect(DATA.implants.all().filter((d) => d.species === 'intake')).toHaveLength(5);
  });

  it('装備のレア度の表は4段。4つ目のエリアは、3つ目よりレジェンドとエピックが出やすい', () => {
    expect(LOOT.areaWeights).toHaveLength(4);
    expect(LOOT.areaWeights[3][3]).toBeGreaterThan(LOOT.areaWeights[2][3]);
    expect(LOOT.areaWeights[3][2]).toBeGreaterThan(LOOT.areaWeights[2][2]);
    expect(LOOT.areaWeights[3].reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('環境「強風」', () => {
  it('凪 → 予告 → 風、をくり返す。予告のたびに、風向きが決まる', () => {
    const world = windWorld();
    run(world, env.cycle.clear + 0.1);
    expect(world.wind.phase).toBe('warn');
    expect(Math.abs(world.wind.dirX) + Math.abs(world.wind.dirY)).toBe(1);
    run(world, env.cycle.warn);
    expect(isBlowing(world)).toBe(true);
    run(world, env.cycle.blow);
    expect(world.wind.phase).toBe('clear');
  });

  it('カウントダウン中と、部屋をクリアしたあとは、吹かない', () => {
    const world = windWorld();
    world.countdown = 3;
    run(world, 1);
    expect(world.wind).toBe(null);
  });

  it('風の間、プレイヤーは風下へ流される。風そのものにダメージはない', () => {
    const world = windWorld();
    const hp = world.player.hp;
    blow(world);
    run(world, 1);
    expect(world.player.x).toBeGreaterThan(300 + env.push.player * 0.9);
    expect(world.player.y).toBeCloseTo(300, 0);
    expect(world.player.hp).toBe(hp);
  });

  it('遮風板の風下側にいれば、流されない。風上側では流される。飛ばされた板は、陰にならない', () => {
    const lee = windWorld({ screens: [{ x: 260, y: 300 }] });
    blow(lee);
    run(lee, 1);
    expect(lee.player.x).toBeCloseTo(300, 0);

    const front = windWorld({ screens: [{ x: 340, y: 300 }] });
    blow(front);
    run(front, 0.1);
    expect(front.player.x).toBeGreaterThan(300);

    const gone = windWorld({ screens: [{ x: 260, y: 300 }] });
    gone.screens[0].broken = 99;
    blow(gone);
    run(gone, 0.5);
    expect(gone.player.x).toBeGreaterThan(330);
    expect(sheltered(gone, 300, 300, 1, 0)).toBe(false);
  });

  it('敵と弾も流される。ボスと、置かれたものは流されない', () => {
    const world = windWorld();
    world.player.x = 100;
    world.player.inv = Infinity;
    const grunt = addEnemy(world, 'turret', 500, 150);
    const debris = dropDebris(world, 500, 450);
    world.shots.push({ x: 300, y: 100, vx: 0, vy: 0, r: 4, damage: 0, life: 9 });
    blow(world);
    run(world, 0.5);
    expect(grunt.x).toBeGreaterThan(500 + env.push.enemy * 0.3);
    expect(grunt.pulledT).toBeGreaterThan(0);
    expect(debris.x).toBeCloseTo(500, 0);
    expect(world.shots[0].x).toBeGreaterThan(300 + env.push.shot * 0.4);
  });

  it('遮風板は、部屋に2〜3か所。ボス部屋には、3か所', () => {
    const bounds = roomBounds({ width: 960, height: 540 }, 40);
    for (const r of [0, 0.5, 0.99]) {
      const n = placeScreens(env, bounds, () => r).length;
      expect(n).toBeGreaterThanOrEqual(env.screens.count.min);
      expect(n).toBeLessThanOrEqual(env.screens.count.max);
    }
    expect(placeScreens(env, bounds, () => 0, { all: true })).toHaveLength(env.screens.count.max);
  });
});

describe('マップ6の雑魚', () => {
  // 1秒で、プレイヤーにどれだけ近づいたか
  function approach(dir) {
    const world = windWorld();
    world.player.x = 800;
    world.player.inv = Infinity;
    const e = addEnemy(world, 'windrider', 200, 300);
    if (dir) blow(world, dir);
    run(world, 1);
    return e.x - 200;
  }

  it('風乗り：追い風のときは、一気に飛び込んでくる。向かい風では、ほとんど進めない', () => {
    const calm = approach(null);
    const tail = approach(EAST);
    const head = approach({ dirX: -1, dirY: 0 });
    expect(tail).toBeGreaterThan(calm * 2);
    expect(head).toBeLessThan(calm * 0.5);
  });

  it('錨打ち：風の予告が出ると杭を打ち、風の間は流されない。風がやむと、杭を抜く', () => {
    const world = windWorld();
    world.player.x = 100;
    world.player.inv = Infinity;
    const e = addEnemy(world, 'anchorer', 400, 300);
    world.wind = { phase: 'warn', t: 0.3, max: 0.3, ...EAST };
    run(world, 0.2);
    expect(e.staked).toBe(true);
    const x = e.x;
    blow(world, EAST, 1);
    run(world, 0.8);
    expect(e.x).toBeCloseTo(x, 0);
    run(world, 0.5);
    expect(world.wind.phase).toBe('clear');
    expect(e.staked).toBe(false);
  });

  it('錨打ち：杭を打っている間は、ふだんより速く撃つ', () => {
    const count = (staked) => {
      const world = windWorld();
      world.player.x = 100;
      world.player.inv = Infinity;
      const e = addEnemy(world, 'anchorer', 380, 300);
      e.cd = 0;
      let fired = 0;
      for (let t = 0; t < 6; t += DT) {
        if (staked) world.wind = { phase: 'warn', t: 1, max: 1, ...EAST };
        updateWorld(world, DT, idle);
        fired += world.shots.length;
        world.shots.length = 0;
      }
      return fired;
    };
    expect(count(true)).toBeGreaterThan(count(false));
  });
});

describe('ボス「インテーク」', () => {
  it('吸い込む向きは、正面の扇形だけ。横や後ろにいれば、流れはない', () => {
    const world = windWorld();
    world.suction = { x: 600, y: 300, arc: 80 * DEG, angle: Math.PI, until: Infinity };
    expect(flowAt(world, 400, 300)).toMatchObject({ suction: true });
    expect(flowAt(world, 400, 300).x).toBeCloseTo(1, 5);
    expect(flowAt(world, 800, 300)).toBe(null);
    expect(flowAt(world, 600, 100)).toBe(null);
  });

  it('吸引：正面にいると、口へ引き寄せられる。ダッシュ中は引かれない', () => {
    const world = bossWorld();
    const def = world.boss.def.attacks.inhale;
    startMove(world, 'inhale');
    run(world, def.telegraph + 0.05);
    expect(world.boss.act.phase).toBe('active');
    const x0 = world.player.x;
    run(world, 0.5);
    expect(world.player.x).toBeGreaterThan(x0 + def.pull * 0.4);
    const x1 = world.player.x;
    world.player.dashT = 9;
    world.player.dvx = 0;
    world.player.dvy = 0;
    run(world, 0.2);
    expect(world.player.x).toBeCloseTo(x1, 0);
  });

  it('吸引：遮風板をはさんで口の反対側にいれば、引かれない', () => {
    const world = bossWorld([{ x: 440, y: 300 }]);
    startMove(world, 'inhale');
    run(world, world.boss.def.attacks.inhale.telegraph + 1);
    expect(world.player.x).toBeCloseTo(400, 0);
  });

  it('吸引：口のすぐ前まで引き寄せられると、ダメージを受ける', () => {
    const world = bossWorld();
    const p = world.player;
    p.x = world.boss.x - world.boss.r - p.r - 20;
    startMove(world, 'inhale');
    run(world, world.boss.def.attacks.inhale.telegraph);
    p.inv = 0;
    const hp = p.hp;
    run(world, 1);
    expect(p.hp).toBeLessThan(hp);
  });

  it('吸引：正面のがれきを飲み込む。終わると、次は「吐き出し」。弾の数は、飲み込んだぶんだけ増える', () => {
    const world = bossWorld();
    const b = world.boss;
    const inhale = b.def.attacks.inhale;
    const exhale = b.def.attacks.exhale;
    dropDebris(world, 470, 300);
    dropDebris(world, 450, 320);
    world.player.x = 200; // 遠くにいる（引かれても、口までは届かない）
    startMove(world, 'inhale');
    run(world, inhale.telegraph + inhale.duration + 0.05);
    expect(b.swallowed).toBe(2);
    expect(debrisCount(world)).toBe(0);
    expect(b.next).toBe('exhale');
    const act = startMove(world, 'exhale');
    expect(act.count).toBe(exhale.base + exhale.perDebris * 2);
    expect(b.swallowed).toBe(0);
    world.shots.length = 0;
    run(world, exhale.telegraph + 0.05);
    expect(world.shots).toHaveLength(exhale.base + exhale.perDebris * 2);
  });

  it('がれきを壊しておけば、吐き出しの弾は、いちばん少ない数になる', () => {
    const world = bossWorld();
    const exhale = world.boss.def.attacks.exhale;
    expect(startMove(world, 'exhale').count).toBe(exhale.base);
    world.boss.swallowed = 99;
    expect(startMove(world, 'exhale').count).toBe(exhale.max);
  });

  it('最初の吸引のときだけ、部屋にがれきがまかれる', () => {
    const world = bossWorld();
    world.boss.littered = false;
    startMove(world, 'inhale');
    expect(debrisCount(world)).toBe(world.boss.def.attacks.inhale.seed);
    startMove(world, 'inhale');
    expect(debrisCount(world)).toBe(world.boss.def.attacks.inhale.seed);
  });

  it('吐き出された弾は、壁に当たると、がれきになって残ることがある（上限まで）', () => {
    const world = windWorld();
    world.rng = () => 0;
    world.player.inv = Infinity;
    const wall = world.bounds.right;
    for (let i = 0; i < 4; i++) world.shots.push({ x: wall - 5, y: 150 + i * 60, vx: 600, vy: 0, r: 8, damage: 0, life: 4, litter: 1, maxDebris: 3 });
    run(world, 0.2);
    expect(debrisCount(world)).toBe(3);
  });

  it('大技「全開」：どこにいても引かれる。板の陰にいれば引かれない。板は1枚ずつ飛び、1枚は残る。最後に、全方向へ吐く', () => {
    const world = bossWorld([{ x: 300, y: 200 }, { x: 300, y: 400 }, { x: 800, y: 300 }]);
    const b = world.boss;
    const def = b.def.attacks.fullopen;
    expect(b.def.ultimate.move).toBe('fullopen');
    world.player.x = 262;
    world.player.y = 195;
    startMove(world, 'fullopen');
    run(world, def.telegraph + 1);
    expect(world.player.x).toBeCloseTo(262, 0);
    // いちばん近い板が、揺れてから飛ぶ → 引かれ始める
    run(world, def.strip.first + def.strip.warn - 1 + 0.6);
    expect(world.screens[0].broken).toBeGreaterThan(0);
    expect(world.player.x).toBeGreaterThan(280);
    run(world, def.duration - def.strip.first - def.strip.warn - 0.8);
    expect(world.boss.act.phase).toBe('active');
    expect(world.screens.filter((s) => !(s.broken > 0))).toHaveLength(def.strip.keep);
  });

  it('ボスが吸っている間は、風は止まる（風と吸い込みが、同時に来ない）', () => {
    const world = bossWorld();
    blow(world);
    startMove(world, 'fullopen');
    run(world, world.boss.def.attacks.fullopen.telegraph + 0.5);
    expect(isBlowing(world)).toBe(false);
    const t = world.wind.t;
    run(world, 1);
    expect(world.wind.phase).toBe('clear');
    expect(world.wind.t).toBe(t);
  });

  it('大技「全開」：最後に吐く弾の数は、飲み込んだがれきで増える', () => {
    const world = bossWorld();
    const b = world.boss;
    const def = b.def.attacks.fullopen;
    world.player.x = 120;
    dropDebris(world, 500, 300);
    startMove(world, 'fullopen');
    let most = 0;
    for (let t = 0; t < def.telegraph + def.duration + 0.2; t += DT) {
      updateWorld(world, DT, idle);
      most = Math.max(most, world.shots.length);
    }
    expect(most).toBe(def.burst.base + def.burst.perDebris * 1);
  });
});

describe('種族「吸気」', () => {
  it('追い風・吹き返し：風の間だけ、移動速度と与えるダメージが上がる', () => {
    const world = windWorld({ implants: ['tailwind', 'blowback'] });
    const speed = statWith(world, 'moveSpeedMul');
    const attack = statWith(world, 'attackMul');
    blow(world);
    expect(statWith(world, 'moveSpeedMul')).toBeCloseTo(speed + 0.2, 5);
    expect(statWith(world, 'attackMul')).toBeCloseTo(attack + 0.12, 5);
  });

  it('風よけ：流される量が半分になる', () => {
    const plain = windWorld();
    const guarded = windWorld({ implants: ['windbreak'] });
    for (const world of [plain, guarded]) {
      blow(world);
      run(world, 1);
    }
    expect(guarded.player.x - 300).toBeCloseTo((plain.player.x - 300) / 2, 0);
  });

  it('吸い寄せ：攻撃が当たった敵が、手前に寄る。ボスは動かない', () => {
    const world = windWorld({ implants: ['drawin'] });
    const e = addEnemy(world, 'grunt', 420, 300);
    hitEnemy(world, e, 10, 1, 0, 0);
    expect(e.x).toBeCloseTo(420 - 16, 0);
    expect(e.pulledT).toBeGreaterThan(0);
  });

  it('集塵：敵を倒すと、近くの敵が、倒した場所へ寄る', () => {
    const world = windWorld({ implants: ['dustcollect'] });
    const dying = addEnemy(world, 'grunt', 500, 300);
    const near = addEnemy(world, 'grunt', 600, 300);
    const far = addEnemy(world, 'grunt', 500, 60);
    dying.hp = 1;
    hitEnemy(world, dying, 10, 1, 0, 0);
    expect(dying.dead).toBe(true);
    expect(near.x).toBeCloseTo(540, 0);
    expect(far.y).toBe(60);
  });

  it('種族ボーナス：2種類で、風の間のダッシュの回復が速い。3種類で、引き寄せた敵へのダメージが上がる', () => {
    const two = windWorld({ implants: ['windbreak', 'tailwind'] });
    expect(two.player.stats.windDash).toBeCloseTo(0.2, 5);
    const three = windWorld({ implants: ['windbreak', 'tailwind', 'dustcollect'] });
    const e = addEnemy(three, 'grunt', 420, 300);
    const base = statWith(three, 'attackMul', e);
    e.pulledT = 1;
    expect(statWith(three, 'attackMul', e)).toBeCloseTo(base + 0.15, 5);
  });
});
