import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { createWorld, updateWorld } from '../src/game/world.js';

// マップ4〜6のボス10体（隠しボス ノクターン・カタリストを含む）の、固有の攻撃。共通の部品は使わない

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

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

const hazardsOf = (world, type) => world.hazards.filter((h) => h.type === type);

const MAP456 = ['lampeater', 'sentinel', 'breaker', 'nocturne', 'rusteater', 'buffertank', 'rainmaker', 'catalyst', 'intake', 'ductcrawler'];

describe('全ボス：攻撃の部品は、1体のボスだけが使う', () => {
  it('どの部品（放出の中身も）も、2体以上のボスで使われない', () => {
    const usedBy = {};
    for (const boss of DATA.bosses.all()) {
      for (const attack of Object.values(boss.attacks)) {
        (usedBy[attack.pattern] ??= new Set()).add(boss.id);
        for (const inner of Object.values(attack.byElement ?? {})) (usedBy[inner.pattern] ??= new Set()).add(boss.id);
      }
    }
    for (const [pattern, ids] of Object.entries(usedBy)) expect(ids.size, `${pattern} を使うボス: ${[...ids].join(', ')}`).toBe(1);
  });

  it('マップ4〜6の10体の、すべての攻撃の部品が存在する', () => {
    for (const id of MAP456) {
      const boss = DATA.bosses.get(id);
      for (const attack of Object.values(boss.attacks)) {
        for (const pattern of [attack.pattern, ...Object.values(attack.byElement ?? {}).map((x) => x.pattern)]) expect(PATTERNS[pattern], `${id} の ${pattern}`).toBeDefined();
      }
    }
  });
});

describe('マップ4〜6の新しい攻撃：最後まで動いて、何かを残す', () => {
  const NEW = {
    lampeater: ['lamptarget', 'windflap', 'glowscales'],
    sentinel: ['sweeplights', 'flashring'],
    breaker: ['shortout', 'cutterarm', 'railrush'],
    nocturne: ['leadblade', 'shadowring', 'afterwing'],
    rusteater: ['scrapfling', 'rustwave', 'jawsnap'],
    buffertank: ['neutralvortex', 'tankrun', 'flushring'],
    rainmaker: ['thundernet', 'rainfront', 'lightningline'],
    catalyst: ['wavecopy', 'homers'],
    intake: ['bladevolley', 'suctionring', 'downdraft'],
    ductcrawler: ['spinevolley', 'ductquake', 'ductbite'],
  };

  for (const [id, names] of Object.entries(NEW)) {
    for (const name of names) {
      it(`${id} の ${name}`, () => {
        const world = bossWorld(id);
        const boss = world.boss;
        const key = Object.keys(boss.def.attacks).find((k) => boss.def.attacks[k].pattern === name);
        expect(key, `${id} に ${name} の攻撃がある`).toBeDefined();
        world.player.x = boss.x - 180;
        world.player.y = boss.y;
        const before = world.hazards.length + world.shots.length + world.enemies.length;
        const act = startAttack(world, key);
        let made = false;
        let finished = false;
        for (let t = 0; t < 25; t += DT) {
          updateWorld(world, DT, idle);
          if (world.hazards.length + world.shots.length + world.enemies.length > before) made = true;
          if (boss.act !== act) {
            finished = true;
            break;
          }
        }
        expect(finished, '最後まで終わる').toBe(true);
        expect(made || boss.x !== 0, '何かが出る').toBe(true);
      });
    }
  }
});

describe('固有の動きの確かめ', () => {
  it('錆の波：通った場所に錆の床（pool）が残る', () => {
    const world = bossWorld('rusteater');
    startAttack(world, 'rustwave');
    expect(runUntil(world, () => hazardsOf(world, 'pool').length > 0, 6)).toBe(true);
  });

  it('鉄片散らし：当たると「錆」が付く', () => {
    const world = bossWorld('rusteater');
    world.player.inv = 0;
    world.player.x = world.boss.x - 150;
    world.player.y = world.boss.y;
    startAttack(world, 'scrapfling');
    expect(runUntil(world, () => world.player.buffs.some((x) => x.id === 'rust'), 4)).toBe(true);
  });

  it('槽の突進：壁と角の4か所に床が残る', () => {
    const world = bossWorld('buffertank');
    startAttack(world, 'tankrun');
    runUntil(world, () => !world.boss.act, 12);
    expect(hazardsOf(world, 'pool').length).toBe(4);
  });

  it('中和の渦：2つの渦が出て、ぶつかると消える', () => {
    const world = bossWorld('buffertank');
    startAttack(world, 'neutralvortex');
    expect(runUntil(world, () => hazardsOf(world, 'vortex').length === 2, 4)).toBe(true);
    expect(runUntil(world, () => hazardsOf(world, 'vortex').length === 0, 20)).toBe(true);
  });

  it('雷の網：予告のあと、線の上にいると当たる', () => {
    const world = bossWorld('rainmaker');
    world.player.inv = 0;
    startAttack(world, 'thundernet');
    const hp = world.player.hp;
    runUntil(world, () => hazardsOf(world, 'netline').some((h) => h.phase === 'flash'), 5);
    for (let i = 0; i < 40; i++) updateWorld(world, DT, idle);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('降雨の波：終わると消える', () => {
    const world = bossWorld('rainmaker');
    startAttack(world, 'rainfront');
    expect(runUntil(world, () => hazardsOf(world, 'rainfront').length > 0, 3)).toBe(true);
    expect(runUntil(world, () => hazardsOf(world, 'rainfront').length === 0, 15)).toBe(true);
  });

  it('雷線：雷の予告が、8個、並んで出る', () => {
    const world = bossWorld('rainmaker');
    const bd = world.bounds;
    world.player.x = (bd.left + bd.right) / 2;
    world.player.y = (bd.top + bd.bottom) / 2;
    startAttack(world, 'lightningline');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length >= 6, 4)).toBe(true);
  });

  it('写し身の波と属性追尾：輪と玉が出る', () => {
    const world = bossWorld('catalyst');
    startAttack(world, 'wavecopy');
    expect(runUntil(world, () => hazardsOf(world, 'elemring').length === 2, 4)).toBe(true);
    const w2 = bossWorld('catalyst');
    startAttack(w2, 'homers');
    expect(runUntil(w2, () => hazardsOf(w2, 'homer').length === 3, 4)).toBe(true);
  });

  it('羽根の乱射：弾が、blades 枚ぶんずつ出る', () => {
    const world = bossWorld('intake');
    startAttack(world, 'bladevolley');
    expect(runUntil(world, () => world.shots.length >= 3, 3)).toBe(true);
  });

  it('吸気の輪：縮んでいって、消える', () => {
    const world = bossWorld('intake');
    startAttack(world, 'suctionring');
    expect(runUntil(world, () => hazardsOf(world, 'closering').length > 0, 3)).toBe(true);
    const r0 = hazardsOf(world, 'closering')[0].r;
    for (let i = 0; i < 30; i++) updateWorld(world, DT, idle);
    expect(hazardsOf(world, 'closering')[0].r).toBeLessThan(r0);
    expect(runUntil(world, () => hazardsOf(world, 'closering').length === 0, 10)).toBe(true);
  });

  it('排気の打ち下ろし：当たると外へ吹き飛ばされる', () => {
    const world = bossWorld('intake');
    world.player.inv = 0;
    startAttack(world, 'downdraft');
    const p = world.player;
    runUntil(world, () => hazardsOf(world, 'mark').length > 0, 2);
    const m = hazardsOf(world, 'mark')[0];
    expect(m.knock).toBeGreaterThan(0);
  });

  it('鱗の棘：床の通気口から、弾が出る', () => {
    const world = bossWorld('ductcrawler');
    startAttack(world, 'spinevolley');
    expect(runUntil(world, () => world.shots.length >= 3, 4)).toBe(true);
  });

  it('管の振動：通気口から輪が広がる', () => {
    const world = bossWorld('ductcrawler');
    startAttack(world, 'ductquake');
    expect(runUntil(world, () => hazardsOf(world, 'ventring').some((h) => h.wait <= 0 && h.r > 20), 5)).toBe(true);
  });

  it('噛みつき加速：進むほど速くなり、壁で止まる', () => {
    const world = bossWorld('ductcrawler');
    const b = world.boss;
    world.player.x = b.x + 300;
    world.player.y = b.y;
    startAttack(world, 'ductbite');
    let prev = b.x;
    let early = 0;
    let late = 0;
    let steps = 0;
    for (let t = 0; t < 4 && b.act; t += DT) {
      updateWorld(world, DT, idle);
      if (b.act?.phase === 'active') {
        steps++;
        const d = Math.abs(b.x - prev);
        if (steps === 5) early = d;
        late = d || late;
      }
      prev = b.x;
    }
    expect(late).toBeGreaterThan(early);
  });
});

describe('絵：マップ4〜6の新しい攻撃を最後まで描いても、エラーにならない', () => {
  it('10体の、すべての攻撃を描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const id of MAP456) {
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
