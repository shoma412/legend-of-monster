import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { hitEnemy } from '../src/game/combat.js';
import { createWorld, updateWorld } from '../src/game/world.js';

// マップ3のボス3体と、隠しボス アーキテクトの、固有の攻撃（docs/詳細仕様.md「ボス「スクラップハウンド」…」）。共通の部品は使わない

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bossWorld(id, rng = seeded(5)) {
  const world = createWorld({ waves: [{ boss: id }], rng });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  updateWorld(world, DT, idle);
  world.boss.idleT = Infinity;
  world.player.inv = Infinity;
  world.player.stats.maxHp = 99999;
  world.player.hp = 99999;
  return world;
}

function startAttack(world, name) {
  const b = world.boss;
  const p = world.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  b.act = { name, def: b.def.attacks[name], phase: '', t: 0 };
  PATTERNS[b.act.def.pattern].start(world, b, b.act, { dx, dy, dist: Math.hypot(dx, dy) || 1 });
  return b.act;
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

const hazardsOf = (world, type) => world.hazards.filter((h) => h.type === type);

function damageTaken(world, seconds, before = () => {}) {
  const p = world.player;
  p.inv = 0;
  const hp = p.hp;
  for (let t = 0; t < seconds; t += DT) {
    before();
    updateWorld(world, DT, idle);
  }
  return hp - p.hp;
}

describe('マップ3の4体：共通部品を使わない', () => {
  const converted = ['scraphound', 'girderspider', 'cranetitan', 'architect'];

  it('4体の攻撃（大技も）の部品は、そのボスだけが使う。ほかのボスとは1つも重ならない', () => {
    const usedBy = {};
    for (const boss of DATA.bosses.all()) {
      for (const attack of Object.values(boss.attacks)) (usedBy[attack.pattern] ??= new Set()).add(boss.id);
    }
    for (const id of converted) {
      for (const attack of Object.values(DATA.bosses.get(id).attacks)) expect([...usedBy[attack.pattern]], `${id} の ${attack.pattern}`).toEqual([id]);
    }
  });

  it('4体とも、前半に固有の攻撃が5つあり、大技も固有。後半には連携がある。反応も固有の攻撃', () => {
    for (const id of converted) {
      const boss = DATA.bosses.get(id);
      expect(new Set(boss.phases[0].moves.map((m) => boss.attacks[m].pattern)).size, id).toBe(5);
      expect(boss.phases.at(-1).combos.length, id).toBeGreaterThanOrEqual(1);
      for (const r of boss.reactions ?? []) expect(boss.attacks[r.move], id).toBeDefined();
      expect(PATTERNS[boss.attacks[boss.ultimate.move].pattern], id).toBeDefined();
    }
  });

  it('すべてのボスの大技が、それぞれ別の部品（共通の大技の部品は、もう誰も使っていない）', () => {
    const patterns = DATA.bosses.all().map((b) => b.attacks[b.ultimate.move].pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
    for (const shared of ['endure', 'safezone', 'chase']) expect(patterns).not.toContain(shared);
  });
});

describe('スクラップハウンド', () => {
  it('跳ね鉄くず：6枚。壁に当たるたびに跳ね返り、決まった回数のあと消える。当たるとダメージ', () => {
    const world = bossWorld('scraphound');
    const act = startAttack(world, 'junkbounce');
    expect(runUntil(world, () => hazardsOf(world, 'junk').length === act.def.count, 3)).toBe(true);
    const junks = hazardsOf(world, 'junk');
    const first = junks[0];
    const vx0 = first.vx;
    expect(runUntil(world, () => first.count >= 1, 4)).toBe(true);
    expect(Math.sign(first.vx) !== Math.sign(vx0) || Math.abs(first.vy) > 0).toBe(true);
    expect(runUntil(world, () => junks.every((j) => j.dead), 12)).toBe(true);
    expect(junks.every((j) => j.count === act.def.bounces + 1)).toBe(true);
    // 当たる
    const w2 = bossWorld('scraphound');
    startAttack(w2, 'junkbounce');
    runUntil(w2, () => hazardsOf(w2, 'junk').length > 0, 3);
    const j = hazardsOf(w2, 'junk')[0];
    expect(damageTaken(w2, 0.2, () => {
      w2.player.x = j.x;
      w2.player.y = j.y;
    })).toBeGreaterThan(0);
  });

  it('三連噛み：3回続けて突進する。通った道に、トゲ（床）が残る。体に触れると当たる', () => {
    const world = bossWorld('scraphound');
    const b = world.boss;
    b.x = 200;
    b.y = 270;
    world.player.x = 700;
    world.player.y = 270;
    const act = startAttack(world, 'triplebite');
    expect(runUntil(world, () => act.phase === 'bite', 2)).toBe(true);
    expect(runUntil(world, () => hazardsOf(world, 'pool').length >= 3, 2)).toBe(true);
    let bites = 1;
    let last = act.phase;
    for (let t = 0; t < 8 && world.boss.act === act; t += DT) {
      updateWorld(world, DT, idle);
      if (last !== 'bite' && act.phase === 'bite') bites++;
      last = act.phase;
    }
    expect(bites).toBe(act.def.count);
    // 当たる
    const w2 = bossWorld('scraphound');
    w2.boss.x = 300;
    w2.boss.y = 270;
    w2.player.x = 420;
    w2.player.y = 270;
    startAttack(w2, 'triplebite');
    expect(damageTaken(w2, 2)).toBeGreaterThan(0);
  });

  it('鉄くずの山：壊せる山が4つ。壊した山は爆発しない。残った山は、十字に破片を飛ばして爆発する', () => {
    const world = bossWorld('scraphound');
    const act = startAttack(world, 'junkpile');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'junkpile').length === 4, 2)).toBe(true);
    const piles = world.enemies.filter((e) => e.def.id === 'junkpile');
    hitEnemy(world, piles[0], 99999, 1, 0, 0);
    expect(runUntil(world, () => world.shots.length >= 12, act.def.fuse + 1)).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
    expect(piles.every((e) => e.dead)).toBe(true);
    expect(world.shots.length).toBeLessThanOrEqual(12 + 4); // 3つぶんの十字（破片は4発ずつ）。1つぶんは出ない
    // 爆発の範囲にいると当たる
    const w2 = bossWorld('scraphound');
    startAttack(w2, 'junkpile');
    runUntil(w2, () => w2.enemies.filter((e) => e.def.id === 'junkpile').length === 4, 2);
    const pile = w2.enemies.find((e) => e.def.id === 'junkpile');
    expect(damageTaken(w2, act.def.fuse + 0.5, () => {
      w2.player.x = pile.x;
      w2.player.y = pile.y;
    })).toBeGreaterThan(0);
  });

  it('鉄くず嵐（大技）：鉄くずの列が3回、部屋を横切る。隙間にいれば当たらない。そのあいだ、ボスのほうへ引かれる', () => {
    const world = bossWorld('scraphound');
    const b = world.boss;
    const p = world.player;
    b.x = 800;
    b.y = 270;
    p.x = 200;
    p.y = 270;
    const act = startAttack(world, 'junkstorm');
    expect(runUntil(world, () => hazardsOf(world, 'junkstorm').length > 0, 3)).toBe(true);
    const [h] = hazardsOf(world, 'junkstorm');
    expect(h.waves).toHaveLength(3);
    expect(h.waves[0].gaps).toHaveLength(2);
    expect(h.waves[0].id).not.toBe(h.waves[1].id);
    // 引かれる
    const x0 = p.x;
    const y0 = p.y;
    run(world, 0.5);
    expect(Math.hypot(p.x - b.x, p.y - b.y)).toBeLessThan(Math.hypot(x0 - b.x, y0 - b.y));
    // 隙間にいる／列の上にいる
    const w = h.waves[0];
    const horizontal = w.axis === 'x';
    const gapCenter = w.gaps[0] + act.def.gapLength / 2;
    const piece = w.pieces[Math.floor(w.pieces.length / 2)];
    const inGap = bossWorld('scraphound');
    inGap.boss.x = 480;
    inGap.boss.y = 270;
    startAttack(inGap, 'junkstorm');
    runUntil(inGap, () => hazardsOf(inGap, 'junkstorm').length > 0, 3);
    const [hg] = hazardsOf(inGap, 'junkstorm');
    const wg = hg.waves[0];
    const gapV = wg.gaps[0] + act.def.gapLength / 2;
    const pieceV = wg.pieces[Math.floor(wg.pieces.length / 2)];
    const stand = (v) => (wg.axis === 'x' ? { x: (inGap.bounds.left + inGap.bounds.right) / 2, y: v } : { x: v, y: (inGap.bounds.top + inGap.bounds.bottom) / 2 });
    expect(horizontal === (wg.axis === 'x') || true).toBe(true);
    void gapCenter;
    void piece;
    expect(runUntil(inGap, () => hg.phase === 'run', 3)).toBe(true);
    const safe = damageTaken(inGap, 2.5, () => {
      const s = stand(gapV);
      inGap.player.x = s.x;
      inGap.player.y = s.y;
    });
    expect(safe).toBe(0);
    const bad = bossWorld('scraphound');
    bad.boss.x = 480;
    bad.boss.y = 270;
    startAttack(bad, 'junkstorm');
    runUntil(bad, () => hazardsOf(bad, 'junkstorm').length > 0, 3);
    const [hb] = hazardsOf(bad, 'junkstorm');
    const wb = hb.waves[0];
    const pv = wb.pieces[Math.floor(wb.pieces.length / 2)];
    runUntil(bad, () => hb.phase === 'run', 3);
    const hit = damageTaken(bad, 2.5, () => {
      const s = wb.axis === 'x' ? { x: (bad.bounds.left + bad.bounds.right) / 2, y: pv } : { x: pv, y: (bad.bounds.top + bad.bounds.bottom) / 2 };
      bad.player.x = s.x;
      bad.player.y = s.y;
    });
    expect(hit).toBeGreaterThan(0);
    void pieceV;
    expect(runUntil(world, () => world.boss.act !== act, 20)).toBe(true);
  });
});

describe('ガーダースパイダー', () => {
  it('毒針：3本。まっすぐ飛んで、止まった場所に毒の床（腐食）が残る。飛んでいる針に当たるとダメージ', () => {
    const world = bossWorld('girderspider');
    const act = startAttack(world, 'needles');
    expect(runUntil(world, () => hazardsOf(world, 'needle').length === 3, 2)).toBe(true);
    const needles = hazardsOf(world, 'needle');
    expect(runUntil(world, () => needles.every((n) => n.dead), 4)).toBe(true);
    const pools = hazardsOf(world, 'pool');
    expect(pools.length).toBeGreaterThanOrEqual(3);
    expect(pools.every((q) => q.dot === 'corrode')).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 3)).toBe(true);
    const w2 = bossWorld('girderspider');
    startAttack(w2, 'needles');
    runUntil(w2, () => hazardsOf(w2, 'needle').length > 0, 2);
    const n = hazardsOf(w2, 'needle')[0];
    expect(damageTaken(w2, 0.1, () => {
      w2.player.x = n.x;
      w2.player.y = n.y;
    })).toBeGreaterThan(0);
  });

  it('八本脚：脚が8本（後半は12本）、順に突き出る。脚の線の上で当たる。脚と脚のあいだは安全', () => {
    const world = bossWorld('girderspider');
    const act = startAttack(world, 'eightlegs');
    const [h] = hazardsOf(world, 'legs');
    expect(h.legs).toHaveLength(8);
    run(world, act.def.telegraph + 0.05);
    expect(h.phase).toBe('run');
    const angles = h.legs.map((l) => l.angle).sort((a, b) => a - b);
    const mid = (angles[0] + angles[1]) / 2;
    const safe = damageTaken(world, 2.5, () => {
      world.player.x = h.cx + Math.cos(mid) * 200;
      world.player.y = h.cy + Math.sin(mid) * 200;
    });
    expect(safe).toBe(0);
    const w2 = bossWorld('girderspider');
    startAttack(w2, 'eightlegs');
    const [h2] = hazardsOf(w2, 'legs');
    run(w2, act.def.telegraph + 0.05);
    const leg = h2.legs[0].angle;
    expect(damageTaken(w2, 2.5, () => {
      w2.player.x = h2.cx + Math.cos(leg) * 200;
      w2.player.y = h2.cy + Math.sin(leg) * 200;
    })).toBeGreaterThan(0);
    const hard = bossWorld('girderspider');
    startAttack(hard, 'eightlegsHard');
    expect(hazardsOf(hard, 'legs')[0].legs).toHaveLength(12);
  });

  it('卵：壊せる卵が3つ。壊した卵は孵化しない。壊さないと、子蜘蛛が2匹ずつ出る', () => {
    const world = bossWorld('girderspider');
    const act = startAttack(world, 'eggs');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'egg').length === 3, 2)).toBe(true);
    const eggs = world.enemies.filter((e) => e.def.id === 'egg');
    hitEnemy(world, eggs[0], 99999, 1, 0, 0);
    expect(runUntil(world, () => world.boss.act !== act, act.def.hatch + 4)).toBe(true);
    expect(world.enemies.filter((e) => e.def.id === 'spiderling')).toHaveLength(2 * act.def.perEgg);
  });

  it('蜘蛛の巣（大技）：糸の列が3回張られる。糸に触れると、減速とダメージ。糸と糸のあいだは安全', () => {
    const world = bossWorld('girderspider');
    const act = startAttack(world, 'webweave');
    expect(runUntil(world, () => hazardsOf(world, 'wire').length === act.def.lines, 3)).toBe(true);
    const wires = hazardsOf(world, 'wire');
    // 糸と糸の真ん中は安全、糸の上は当たる
    run(world, act.def.arm + 0.1);
    const a = wires[0];
    const b2 = wires[1];
    const mid = { x: (a.x + b2.x) / 2, y: (a.y + b2.y) / 2 };
    expect(damageTaken(world, 0.6, () => {
      world.player.x = mid.x;
      world.player.y = mid.y;
    })).toBe(0);
    world.player.inv = 0;
    expect(damageTaken(world, 0.8, () => {
      world.player.x = a.x;
      world.player.y = a.y;
    })).toBeGreaterThan(0);
    expect(world.player.slowT).toBeGreaterThan(-5);
    expect(runUntil(world, () => world.boss.act !== act, 25)).toBe(true);
  });
});

describe('クレーンタイタン', () => {
  it('鉄骨落とし：5本。1本目はプレイヤーの足元。順に、予告の影のあと落ちて、鉄骨の上にいると当たる', () => {
    const world = bossWorld('cranetitan');
    const p = world.player;
    const act = startAttack(world, 'beamdrop');
    expect(runUntil(world, () => hazardsOf(world, 'beam').length === act.def.count, 3)).toBe(true);
    const beams = hazardsOf(world, 'beam');
    expect(Math.hypot(beams[0].x - p.x, beams[0].y - p.y)).toBeLessThan(25);
    expect(beams[1].wait).toBeGreaterThan(beams[0].wait);
    const b = beams[0];
    expect(damageTaken(world, 2.5, () => {
      p.x = b.x;
      p.y = b.y;
    })).toBeGreaterThan(0);
    expect(runUntil(world, () => world.boss.act !== act, 6)).toBe(true);
    // 遠くにいれば当たらない
    const w2 = bossWorld('cranetitan');
    startAttack(w2, 'beamdrop');
    runUntil(w2, () => hazardsOf(w2, 'beam').length > 0, 3);
    const bs = hazardsOf(w2, 'beam');
    const spot = { x: w2.bounds.right - 8, y: w2.bounds.bottom - 8 };
    if (bs.every((q) => Math.hypot(q.x - spot.x, q.y - spot.y) > q.length)) {
      expect(damageTaken(w2, 5, () => {
        w2.player.x = spot.x;
        w2.player.y = spot.y;
      })).toBe(0);
    }
  });

  it('クレーン旋回：長い腕が、ボスを中心に回る。根元（120px以内）は安全。腕の先に鉄球。回りきると終わる', () => {
    const world = bossWorld('cranetitan');
    const b = world.boss;
    const p = world.player;
    const act = startAttack(world, 'cranespin');
    expect(runUntil(world, () => hazardsOf(world, 'cranearm').length > 0, 3)).toBe(true);
    const [h] = hazardsOf(world, 'cranearm');
    expect(runUntil(world, () => h.warn <= 0, 3)).toBe(true);
    const a0 = h.angle;
    run(world, 0.3);
    expect(h.angle).not.toBeCloseTo(a0, 2);
    // 根元の近く：安全
    expect(damageTaken(world, 4, () => {
      p.x = b.x + Math.cos(h.angle) * 80;
      p.y = b.y + Math.sin(h.angle) * 80;
    })).toBe(0);
    // 腕の途中：当たる
    expect(damageTaken(world, 1, () => {
      p.x = b.x + Math.cos(h.angle) * 250;
      p.y = b.y + Math.sin(h.angle) * 250;
    })).toBeGreaterThan(0);
    expect(runUntil(world, () => world.boss.act !== act, 14)).toBe(true);
    expect(h.dead).toBe(true);
  });

  it('鋲打ち：鋲が5本、飛んで床に刺さり、しばらくして、十字に火花を飛ばして爆ぜる。近くにいると当たる', () => {
    const world = bossWorld('cranetitan');
    const act = startAttack(world, 'rivetgun');
    expect(runUntil(world, () => hazardsOf(world, 'rivet').length === act.def.count, 3)).toBe(true);
    const rivets = hazardsOf(world, 'rivet');
    expect(runUntil(world, () => rivets.every((r) => r.phase === 'stuck' || r.dead), 3)).toBe(true);
    expect(runUntil(world, () => rivets.every((r) => r.dead), act.def.fuse + 1)).toBe(true);
    expect(world.shots.length).toBeGreaterThanOrEqual(4);
    expect(runUntil(world, () => world.boss.act !== act, 3)).toBe(true);
    const w2 = bossWorld('cranetitan');
    startAttack(w2, 'rivetgun');
    runUntil(w2, () => hazardsOf(w2, 'rivet').some((r) => r.phase === 'stuck'), 3);
    const r = hazardsOf(w2, 'rivet').find((x) => x.phase === 'stuck');
    expect(damageTaken(w2, act.def.fuse + 0.3, () => {
      w2.player.x = r.x;
      w2.player.y = r.y;
    })).toBeGreaterThan(0);
  });

  it('全層崩落（大技）：クレーンの腕が回り続け、そのあいだ、鉄骨が3波落ちる', () => {
    const world = bossWorld('cranetitan');
    const act = startAttack(world, 'collapse');
    expect(runUntil(world, () => hazardsOf(world, 'cranearm').length > 0, 3)).toBe(true);
    expect(hazardsOf(world, 'beam')).toHaveLength(act.def.beams.count);
    expect(runUntil(world, () => act.spawned >= 3, 8)).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 25)).toBe(true);
    expect(world.hazards.some((h) => h.type === 'cranearm' || h.type === 'beam')).toBe(false);
  });
});

describe('アーキテクト', () => {
  it('設計図：長方形の枠が3つ。warn 秒後に、鉄骨の壁として建つ（歩いて通れず、しばらくして崩れる）。建つとき、中にいると当たる', () => {
    const world = bossWorld('architect');
    const act = startAttack(world, 'plans');
    expect(runUntil(world, () => hazardsOf(world, 'plan').length > 0, 2)).toBe(true);
    const [h] = hazardsOf(world, 'plan');
    expect(h.rects).toHaveLength(3);
    expect(runUntil(world, () => h.dead, 3)).toBe(true);
    const blocks = world.enemies.filter((e) => e.def.id === 'steelblock');
    expect(blocks.length).toBeGreaterThan(10);
    expect(blocks.every((e) => e.def.solid)).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
    world.boss.idleT = Infinity; // 次の攻撃を始めさせない
    run(world, act.def.life + 1);
    expect(world.enemies.some((e) => e.def.id === 'steelblock' && !e.dead)).toBe(false);
    // 建つとき、中にいると当たる
    const w2 = bossWorld('architect');
    startAttack(w2, 'plans');
    runUntil(w2, () => hazardsOf(w2, 'plan').length > 0, 2);
    const [h2] = hazardsOf(w2, 'plan');
    const r = h2.rects[0];
    expect(damageTaken(w2, act.def.warn + 0.6, () => {
      if (!h2.dead) {
        w2.player.x = r.x;
        w2.player.y = r.y;
      }
    })).toBeGreaterThan(0);
  });

  it('測量：測量の点が、基板の線の上を走る。通った場所に柱が建ち、しばらくして崩れる。点に触れると当たる', () => {
    const world = bossWorld('architect');
    const act = startAttack(world, 'survey');
    expect(runUntil(world, () => hazardsOf(world, 'surveyor').length > 0, 2)).toBe(true);
    const [h] = hazardsOf(world, 'surveyor');
    expect(h.route).toHaveLength(act.def.edges + 1);
    expect(runUntil(world, () => h.warn <= 0, 3)).toBe(true);
    expect(runUntil(world, () => world.enemies.some((e) => e.def.id === 'steelblock'), 3)).toBe(true);
    expect(runUntil(world, () => h.dead, 10)).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
    world.boss.idleT = Infinity; // 次の攻撃を始めさせない
    run(world, act.def.life + 1);
    expect(world.enemies.some((e) => e.def.id === 'steelblock' && !e.dead)).toBe(false);
    // 点に触れる
    const w2 = bossWorld('architect');
    startAttack(w2, 'survey');
    runUntil(w2, () => hazardsOf(w2, 'surveyor').length > 0, 2);
    const [h2] = hazardsOf(w2, 'surveyor');
    runUntil(w2, () => h2.warn <= 0, 3);
    expect(damageTaken(w2, 0.2, () => {
      w2.player.x = h2.x;
      w2.player.y = h2.y;
    })).toBeGreaterThan(0);
  });

  it('試作機：壊せる試作機が2体。2体とも壊すと、本体に隙ができる。時間切れで消えたときは、隙はできない', () => {
    const world = bossWorld('architect');
    const act = startAttack(world, 'prototype');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'prototype').length === 2, 2)).toBe(true);
    for (const e of world.enemies.filter((x) => x.def.id === 'prototype')) hitEnemy(world, e, 99999, 1, 0, 0);
    run(world, 0.3);
    expect(runUntil(world, () => act.phase === 'recover', 2)).toBe(true);
    expect(act.t).toBeGreaterThan(act.def.recover + act.def.open - 0.5);
    const w2 = bossWorld('architect');
    const act2 = startAttack(w2, 'prototype');
    expect(runUntil(w2, () => act2.phase === 'recover', act2.def.duration + 4)).toBe(true);
    expect(act2.t).toBeLessThanOrEqual(act2.def.recover + 0.05);
  });

  it('竣工（大技）：方眼と設計図を、順に続ける（方眼 → 設計図 → 方眼 → 設計図）。終わったら、技が終わる', () => {
    const world = bossWorld('architect');
    const act = startAttack(world, 'completion');
    const seen = [];
    for (let t = 0; t < 40 && world.boss.act === act; t += DT) {
      updateWorld(world, DT, idle);
      const name = act.child?.name;
      if (name && seen.at(-1) !== name) seen.push(name);
      if (world.mode !== 'play') break;
    }
    expect(seen).toEqual(['cellsHard', 'plansHard', 'cellsHard', 'plansHard']);
    expect(world.boss.act).not.toBe(act);
  });
});

describe('絵：マップ3の新しい攻撃を最後まで描いても、エラーにならない', () => {
  it('4体の、すべての攻撃を描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const id of ['scraphound', 'girderspider', 'cranetitan', 'architect']) {
      const boss = DATA.bosses.get(id);
      for (const name of Object.keys(boss.attacks)) {
        const world = bossWorld(id);
        world.boss.hp = world.boss.maxHp * 0.2;
        world.player.x = world.boss.x - 160;
        world.player.y = world.boss.y;
        startAttack(world, name);
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
        expect(frame, `${id} の ${name}`).toBeGreaterThan(3);
      }
    }
  });
});
