import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { BOARD_COLUMNS, BOARD_ROWS, boardPoints } from '../src/game/map1Bosses.js';
import { onIce } from '../src/game/ice.js';
import { hitEnemy } from '../src/game/combat.js';
import { createWorld, updateWorld } from '../src/game/world.js';

// マップ1のボス3体の、固有の攻撃（docs/詳細仕様.md「ボス「ボルトボア」…」）。共通の部品は使わない

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

// 同じ種なら同じ並びになる乱数（場所をばらけさせたい攻撃のテスト用。いつも 0.5 を返す乱数だと、場所が全部同じになる）
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
  world.boss.idleT = Infinity;
  world.player.inv = Infinity; // ふだんは、攻撃を受けない（受けるかどうかを調べるときだけ 0 にする）
  world.player.stats.maxHp = 99999; // 何回当たっても倒れない（倒れると、そこで時間が止まる）
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

// 受けたダメージを数える（受ける状態にして、seconds 秒進める）
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

describe('マップ1の3体：共通部品を使わない', () => {
  const converted = ['boltboar', 'cryowyvern', 'overload'];

  it('3体の攻撃（大技も）の部品は、そのボスだけが使う。ほかのボスとは1つも重ならない', () => {
    const usedBy = {};
    for (const boss of DATA.bosses.all()) {
      for (const attack of Object.values(boss.attacks)) (usedBy[attack.pattern] ??= new Set()).add(boss.id);
    }
    for (const id of converted) {
      for (const attack of Object.values(DATA.bosses.get(id).attacks)) {
        if (attack.pattern === 'vent') continue; // 冷却の隙（オーバーロードだけが使う。攻撃ではない）
        expect([...usedBy[attack.pattern]], `${id} の ${attack.pattern}`).toEqual([id]);
      }
    }
  });

  it('3体とも、前半に固有の攻撃が5つあり、大技も固有。後半には連携がある', () => {
    for (const id of converted) {
      const boss = DATA.bosses.get(id);
      expect(new Set(boss.phases[0].moves.map((m) => boss.attacks[m].pattern)).size, id).toBe(5);
      expect(boss.phases.at(-1).combos.length, id).toBeGreaterThanOrEqual(1);
      expect(PATTERNS[boss.attacks[boss.ultimate.move].pattern], id).toBeDefined();
    }
  });

  it('反応（離れ続けたとき）も、固有の攻撃', () => {
    expect(DATA.bosses.get('boltboar').reactions[0].move).toBe('wirepull');
    expect(DATA.bosses.get('cryowyvern').reactions[0].move).toBe('featherbolt');
    expect(DATA.bosses.get('overload').reactions[0].move).toBe('satellites');
  });
});

describe('ボルトボア', () => {
  it('電線ひっぱり：予告の間は当たらず、電線が通ると当たる。電線の幅の外へ出れば当たらない。伸びきると逆向きに戻ってくる', () => {
    const world = bossWorld('boltboar');
    const p = world.player;
    const act = startAttack(world, 'wirepull');
    const [h] = hazardsOf(world, 'wirepass');
    expect(h.phase).toBe('warn');
    expect(damageTaken(world, act.def.telegraph - 0.2)).toBe(0);
    // 電線の通る場所に立ち続ける
    const hit = damageTaken(world, 8, () => {
      if (h.phase === 'leg') {
        p.x = h.axis === 'x' ? h.pos : h.cross;
        p.y = h.axis === 'x' ? h.cross : h.pos;
      }
    });
    expect(hit).toBeGreaterThan(0);
    expect(h.leg).toBe(2); // 戻ってきた
    // 外へ出ていれば当たらない
    const w2 = bossWorld('boltboar');
    const act2 = startAttack(w2, 'wirepull');
    const [h2] = hazardsOf(w2, 'wirepass');
    run(w2, act2.def.telegraph + 0.05);
    const far = h2.axis === 'x' ? { x: w2.player.x, y: h2.cross + act2.def.length / 2 + 80 } : { x: h2.cross + act2.def.length / 2 + 80, y: w2.player.y };
    w2.player.x = far.x;
    w2.player.y = far.y;
    expect(damageTaken(w2, 8)).toBe(0);
    expect(h2.dead).toBe(true);
  });

  it('電線ひっぱり（後半）：2本の電線が、反対の側から来る', () => {
    const world = bossWorld('boltboar');
    startAttack(world, 'wirepullHard');
    const hs = hazardsOf(world, 'wirepass');
    expect(hs).toHaveLength(2);
    expect(hs[0].from).not.toBe(hs[1].from);
  });

  it('碍子落とし：予告の円が先に出て、落ちると破片が全方向に飛び、電気の床が残る', () => {
    const world = bossWorld('boltboar');
    const act = startAttack(world, 'insulators');
    const def = act.def;
    expect(runUntil(world, () => hazardsOf(world, 'mark').length === def.count, 3)).toBe(true);
    expect(world.shots).toHaveLength(0);
    expect(runUntil(world, () => world.shots.length > 0, 3)).toBe(true);
    expect(world.shots.length).toBeGreaterThanOrEqual(def.shards.count);
    expect(hazardsOf(world, 'pool').length).toBeGreaterThan(0);
    // 全部の碍子が、落ちて割れる
    const marks = [...world.hazards.filter((h) => h.type === 'mark')];
    expect(runUntil(world, () => marks.every((m) => m.dead), 4)).toBe(true);
    expect(marks.every((m) => m.shards && m.pool)).toBe(true);
  });

  it('杭の放電：杭が3本。杭を結ぶ線に隙間が1か所。効き始める前と、内側にいるときは当たらない。線に触れると当たる', () => {
    const world = bossWorld('boltboar');
    const p = world.player;
    p.x = 480;
    p.y = 270;
    const act = startAttack(world, 'stakefence');
    expect(runUntil(world, () => hazardsOf(world, 'fence').length > 0, 2)).toBe(true);
    const [h] = hazardsOf(world, 'fence');
    expect(h.stakes).toHaveLength(3);
    expect(h.segs).toHaveLength(4); // 3辺のうち1辺が、隙間で2つに分かれる
    // 効き始める前は、線の上にいても当たらない
    const seg = h.segs[0];
    p.x = (seg[0].x + seg[1].x) / 2;
    p.y = (seg[0].y + seg[1].y) / 2;
    expect(damageTaken(world, act.def.arm - 0.2, () => {})).toBe(0);
    // 効き始めたら、線の上で当たる
    run(world, 0.4);
    p.inv = 0;
    p.x = (seg[0].x + seg[1].x) / 2;
    p.y = (seg[0].y + seg[1].y) / 2;
    const hp = p.hp;
    run(world, 0.1);
    expect(p.hp).toBeLessThan(hp);
    // 重心（内側）は安全
    const cx = h.stakes.reduce((s, q) => s + q.x, 0) / 3;
    const cy = h.stakes.reduce((s, q) => s + q.y, 0) / 3;
    p.inv = 0;
    p.x = cx;
    p.y = cy;
    const hp2 = p.hp;
    run(world, 0.5);
    expect(p.hp).toBe(hp2);
    // 一定時間たつと消える
    run(world, act.def.life + 1);
    expect(h.dead).toBe(true);
  });

  it('杭の放電（後半）：杭が4本になる', () => {
    const world = bossWorld('boltboar');
    startAttack(world, 'stakefenceHard');
    run(world, 1);
    const [h] = hazardsOf(world, 'fence');
    expect(h.stakes).toHaveLength(4);
  });

  it('帯電：稲妻は放射状にのび、ゆっくり回る。稲妻の上で当たり、すき間は安全', () => {
    const world = bossWorld('boltboar');
    const b = world.boss;
    const p = world.player;
    const act = startAttack(world, 'statics');
    expect(runUntil(world, () => hazardsOf(world, 'rays').length > 0, 2)).toBe(true);
    const [h] = hazardsOf(world, 'rays');
    run(world, act.def.warn + 0.05);
    const a0 = h.angle;
    run(world, 0.5);
    expect(h.angle).not.toBeCloseTo(a0, 3);
    // 稲妻の上
    p.x = b.x + Math.cos(h.angle) * 200;
    p.y = b.y + Math.sin(h.angle) * 200;
    expect(damageTaken(world, 0.05, () => {
      p.x = b.x + Math.cos(h.angle) * 200;
      p.y = b.y + Math.sin(h.angle) * 200;
    })).toBeGreaterThan(0);
    // すき間（稲妻と稲妻の真ん中）
    const gap = Math.PI / act.def.rays;
    p.inv = 0;
    expect(damageTaken(world, 0.5, () => {
      p.x = b.x + Math.cos(h.angle + gap) * 200;
      p.y = b.y + Math.sin(h.angle + gap) * 200;
    })).toBe(0);
    run(world, act.def.live + 1);
    expect(h.dead).toBe(true);
  });

  it('牙の突き上げ：床板が前へ順に跳ね上がる。当たると宙に浮かされて、その間は操作できない', () => {
    const world = bossWorld('boltboar');
    const b = world.boss;
    const p = world.player;
    b.x = 300;
    b.y = 270;
    p.x = 420;
    p.y = 270;
    const act = startAttack(world, 'tuskrip');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length >= 2, 2)).toBe(true);
    const marks = hazardsOf(world, 'mark');
    // 前へ進む（ボスから遠くなる順に、あとで跳ねる）
    expect(marks[1].x).toBeGreaterThan(marks[0].x);
    expect(marks[1].t).toBeGreaterThan(marks[0].t);
    // 立っていると当たり、浮かされる
    p.inv = 0;
    const hp = p.hp;
    expect(runUntil(world, () => p.hp < hp, 3)).toBe(true);
    expect(p.floatT).toBeGreaterThan(0);
    const x = p.x;
    updateWorld(world, DT, { ...idle, mx: 1 });
    expect(p.x).toBe(x); // 動けない
    run(world, act.def.float + 0.1);
    expect(p.floatT).toBeLessThanOrEqual(0);
  });

  it('過電圧（大技）：壁ぎわの電線が3回狭まる。壁ぎわにいると当たり、真ん中は安全。安全の円の中なら、壁ぎわでも当たらない', () => {
    const world = bossWorld('boltboar');
    const b = world.boss;
    const p = world.player;
    b.hp = b.maxHp * 0.2;
    b.ultimateDone = true;
    const act = startAttack(world, 'overvolt');
    expect(runUntil(world, () => hazardsOf(world, 'squeeze').length > 0, 3)).toBe(true);
    const [h] = hazardsOf(world, 'squeeze');
    expect(h.steps).toEqual([50, 100, 150]);
    h.safes = []; // 安全の円は、あとで調べる
    // 最初の予告のあと、電線が効き始める
    expect(runUntil(world, () => h.phase === 'live', 3)).toBe(true);
    const wall = world.bounds.left + 10;
    const center = { x: (world.bounds.left + world.bounds.right) / 2, y: (world.bounds.top + world.bounds.bottom) / 2 };
    expect(damageTaken(world, 1.2, () => {
      p.x = wall;
      p.y = center.y;
    })).toBeGreaterThan(0);
    expect(damageTaken(world, 1.2, () => {
      p.x = center.x;
      p.y = center.y;
    })).toBe(0);
    // 安全の円の中
    h.safes = [{ x: wall, y: center.y, r: 70 }];
    expect(damageTaken(world, 1.2, () => {
      p.x = wall;
      p.y = center.y;
    })).toBe(0);
    // 3回狭まって、終わる
    expect(runUntil(world, () => h.dead, 14)).toBe(true);
    expect(h.i).toBe(3);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
  });
});

describe('クライオ・ワイバーン', () => {
  it('氷の羽根：3枚を投げ、弧を描いて飛んだあと、竜のところへ戻ってくる。戻ると消える', () => {
    const world = bossWorld('cryowyvern');
    const b = world.boss;
    const act = startAttack(world, 'featherbolt');
    expect(runUntil(world, () => hazardsOf(world, 'feather').length === 3, 2)).toBe(true);
    const feathers = hazardsOf(world, 'feather');
    // 弧を描く：向きが少しずつ変わる
    const ang0 = feathers[0].ang;
    run(world, 0.5);
    expect(feathers[0].ang).not.toBeCloseTo(ang0, 2);
    expect(runUntil(world, () => feathers.every((f) => f.phase === 'back'), 3)).toBe(true);
    // 戻る先は、そのときの竜の位置
    b.x = 700;
    b.y = 100;
    run(world, 0.3);
    const f = feathers.find((x) => !x.dead);
    if (f) expect(Math.abs(f.ang - Math.atan2(b.y - f.y, b.x - f.x))).toBeLessThan(0.3);
    expect(runUntil(world, () => feathers.every((x) => x.dead), 8)).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 3)).toBe(true);
  });

  it('氷の羽根：当たるとダメージ（行きで当たる）。後半は5枚', () => {
    const world = bossWorld('cryowyvern');
    startAttack(world, 'featherbolt');
    run(world, 1);
    const [f] = hazardsOf(world, 'feather');
    const p = world.player;
    expect(damageTaken(world, 0.05, () => {
      p.x = f.x;
      p.y = f.y;
    })).toBeGreaterThan(0);
    const hard = bossWorld('cryowyvern');
    startAttack(hard, 'featherboltHard');
    run(hard, 1);
    expect(hazardsOf(hard, 'feather')).toHaveLength(5);
  });

  it('氷柱の波：爪でなぞった線に沿って、氷柱が順に生える。後半は3本の線', () => {
    const world = bossWorld('cryowyvern');
    const b = world.boss;
    b.x = 200;
    b.y = 270;
    world.player.x = 600;
    world.player.y = 270;
    startAttack(world, 'iciclewave');
    expect(runUntil(world, () => hazardsOf(world, 'mark').length >= 6, 3)).toBe(true);
    const marks = hazardsOf(world, 'mark');
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i].x).toBeGreaterThan(marks[i - 1].x);
      expect(marks[i].t).toBeGreaterThan(marks[i - 1].t);
    }
    const hard = bossWorld('cryowyvern');
    hard.boss.x = 200;
    hard.boss.y = 270;
    hard.player.x = 600;
    hard.player.y = 270;
    startAttack(hard, 'iciclewaveHard');
    run(hard, 1);
    expect(hazardsOf(hard, 'mark').length).toBeGreaterThan(marks.length);
  });

  it('凍る息：扇の中でダメージと減速。扇の外は当たらない。吹いた場所に凍る床が残る（上限あり）', () => {
    const world = bossWorld('cryowyvern');
    const b = world.boss;
    const p = world.player;
    b.x = 500;
    b.y = 270;
    p.x = 300;
    p.y = 270;
    const act = startAttack(world, 'frostbreath');
    expect(runUntil(world, () => act.phase === 'active', 3)).toBe(true);
    p.inv = 0;
    const hp = p.hp;
    p.x = b.x + act.dirX * 200;
    p.y = b.y + act.dirY * 200;
    run(world, 0.4);
    expect(p.hp).toBeLessThan(hp);
    expect(p.slowT).toBeGreaterThan(0);
    run(world, act.def.duration + 1);
    const patches = hazardsOf(world, 'ice');
    expect(patches.length).toBeGreaterThan(0);
    expect(patches.length).toBeLessThanOrEqual(act.def.patch.max);
    // 真後ろは当たらない
    const w2 = bossWorld('cryowyvern');
    const act2 = startAttack(w2, 'frostbreath');
    runUntil(w2, () => act2.phase === 'active', 3);
    w2.player.x = w2.boss.x - act2.dirX * 200;
    w2.player.y = w2.boss.y - act2.dirY * 200;
    expect(damageTaken(w2, 0.4, () => {
      w2.player.x = w2.boss.x - act2.dirX * 200;
      w2.player.y = w2.boss.y - act2.dirY * 200;
    })).toBe(0);
  });

  it('凍る床：上にいる間は、慣性がついて止まりにくい。床の外では、すぐ止まる', () => {
    const slide = (onIceSpot) => {
      const world = bossWorld('cryowyvern');
      const p = world.player;
      p.x = 400;
      p.y = 300;
      if (onIceSpot) world.hazards.push({ type: 'ice', x: 400, y: 300, r: 400, life: 30, max: 30, color: '#8fd8ff' });
      expect(onIce(world, p.x, p.y)).toBe(onIceSpot);
      run(world, 0.6, { ...idle, mx: 1 });
      const x = p.x;
      run(world, 0.3); // 入力をやめる
      return p.x - x;
    };
    expect(slide(true)).toBeGreaterThan(30);
    expect(slide(false)).toBeLessThan(2);
  });

  it('霜の翼：左右に氷の壁が立って一本道ができ、通路に氷柱の波が走る。壁は歩いて通れず、しばらくすると崩れる', () => {
    const world = bossWorld('cryowyvern');
    const p = world.player;
    p.x = 480;
    p.y = 270;
    const act = startAttack(world, 'frostwings');
    expect(runUntil(world, () => world.enemies.some((e) => e.def.id === 'icepillar'), 3)).toBe(true);
    const pillars = world.enemies.filter((e) => e.def.id === 'icepillar');
    const xs = [...new Set(pillars.map((e) => Math.round(e.x)))];
    expect(xs).toHaveLength(2);
    expect(Math.abs(xs[0] - xs[1])).toBe(act.def.gap);
    expect(pillars.every((e) => e.def.solid)).toBe(true);
    // 通路の中に氷柱の予告が順に出る
    expect(runUntil(world, () => hazardsOf(world, 'mark').length >= 3, 3)).toBe(true);
    const marks = hazardsOf(world, 'mark');
    expect(marks.every((m) => Math.abs(m.x - 480) < act.def.gap / 2)).toBe(true);
    // 崩れる
    run(world, act.def.life + 1);
    expect(world.enemies.some((e) => e.def.id === 'icepillar' && !e.dead)).toBe(false);
  });

  it('寒空の影：竜が空へ消え、影が動き回る。止まった場所に降りてきて、周りにいると当たる', () => {
    const world = bossWorld('cryowyvern');
    const b = world.boss;
    const p = world.player;
    b.x = 700;
    b.y = 100;
    const act = startAttack(world, 'skyshadow');
    expect(runUntil(world, () => b.hidden, 2)).toBe(true);
    const [shadow] = hazardsOf(world, 'shadow');
    const x0 = shadow.x;
    run(world, 1);
    expect(Math.hypot(shadow.x - x0, shadow.y - 100)).toBeGreaterThan(20); // 動き回る
    expect(runUntil(world, () => shadow.phase === 'land', 5)).toBe(true);
    p.inv = 0;
    const hp = p.hp;
    for (let t = 0; t < 2 && !shadow.dead; t += DT) {
      p.x = shadow.x;
      p.y = shadow.y;
      updateWorld(world, DT, idle);
    }
    run(world, 0.1);
    expect(p.hp).toBeLessThan(hp);
    expect(shadow.landed).toBe(true);
    expect(b.hidden).toBe(false);
    expect(Math.hypot(b.x - shadow.x, b.y - shadow.y)).toBeLessThan(3);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
  });

  it('絶対零度（大技）：凍えは、焚き火の外でたまり、中で下がる。満タンで凍結ダメージ。焚き火は予告のあと動く', () => {
    const world = bossWorld('cryowyvern');
    const p = world.player;
    const act = startAttack(world, 'absolutezero');
    expect(runUntil(world, () => hazardsOf(world, 'coldfield').length > 0, 3)).toBe(true);
    const [h] = hazardsOf(world, 'coldfield');
    expect(h.fires).toHaveLength(3);
    const fire = h.fires[0];
    // 焚き火の中：たまらない
    run(world, 2, idle);
    p.x = fire.x;
    p.y = fire.y;
    h.chill = 0.5;
    run(world, 0.5);
    expect(h.chill).toBeLessThan(0.5);
    // 焚き火の外：たまり、満タンで凍る
    const far = world.bounds.left + 5;
    h.fires = [{ x: world.bounds.right - 100, y: world.bounds.bottom - 100 }];
    h.moveT = 999;
    p.x = far;
    p.y = world.bounds.top + 5;
    h.chill = 0.9;
    p.inv = 0;
    const hp = p.hp;
    for (let t = 0; t < 1; t += DT) {
      p.x = far;
      p.y = world.bounds.top + 5;
      updateWorld(world, DT, idle);
    }
    expect(p.hp).toBeLessThan(hp);
    expect(h.chill).toBeLessThan(0.9); // 凍ったあと、半分ほどに戻る
    // 焚き火は、予告のあと別の場所へ動く
    h.moveT = h.warn + 0.05;
    run(world, 0.2);
    expect(h.next).not.toBeNull();
    run(world, h.warn + 0.2);
    expect(h.fires).not.toEqual([{ x: world.bounds.right - 100, y: world.bounds.bottom - 100 }]);
    expect(runUntil(world, () => h.dead, 16)).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 4)).toBe(true);
  });
});

describe('オーバーロード', () => {
  it('命令ブロック：番号は1〜6が1つずつ。番号の順に爆発し、爆発の範囲にいると当たる', () => {
    const world = bossWorld('overload');
    const act = startAttack(world, 'opblocks');
    expect(runUntil(world, () => hazardsOf(world, 'opblocks').length > 0, 2)).toBe(true);
    const [h] = hazardsOf(world, 'opblocks');
    expect(h.blocks.map((b) => b.n).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    // 爆発した順
    const order = [];
    for (let t = 0; t < 8 && !h.dead; t += DT) {
      updateWorld(world, DT, idle);
      for (const b of h.blocks) if (b.done && !order.includes(b.n)) order.push(b.n);
    }
    expect(order).toEqual([1, 2, 3, 4, 5, 6]);
    expect(runUntil(world, () => world.boss.act !== act, 3)).toBe(true);
    // 当たる／当たらない
    const w2 = bossWorld('overload');
    startAttack(w2, 'opblocks');
    runUntil(w2, () => hazardsOf(w2, 'opblocks').length > 0, 2);
    const [h2] = hazardsOf(w2, 'opblocks');
    const first = h2.blocks.find((b) => b.n === 1);
    const p = w2.player;
    expect(damageTaken(w2, 3, () => {
      if (!first.done) {
        p.x = first.x;
        p.y = first.y;
      }
    })).toBeGreaterThan(0);
  });

  it('配線トレース：基板の線の上を、曲がりながら走る。通ったあとの線に触れると当たる。通る前の線は当たらない', () => {
    const world = bossWorld('overload');
    const act = startAttack(world, 'tracepath');
    expect(runUntil(world, () => hazardsOf(world, 'trace').length > 0, 2)).toBe(true);
    const [h] = hazardsOf(world, 'trace');
    expect(h.route).toHaveLength(act.def.edges + 1);
    // 隣の交差点へ、折り返さずに進む
    for (let i = 1; i < h.route.length; i++) {
      const a = h.route[i - 1];
      const b = h.route[i];
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
      if (i > 1) expect(h.route[i - 2]).not.toBe(b);
    }
    // 予告のあいだは当たらない。通る前の線の上にいても、当たらない
    const p = world.player;
    const lastSeg = h.segs.at(-1);
    expect(damageTaken(world, 0.5, () => {
      p.x = lastSeg.x2;
      p.y = lastSeg.y2;
    })).toBe(0);
    // 最初の線を通ったあと、その上にいると当たる
    const first = h.segs[0];
    expect(runUntil(world, () => h.edge >= 1 || h.dead, 4)).toBe(true);
    p.inv = 0;
    const hp = p.hp;
    p.x = (first.x1 + first.x2) / 2;
    p.y = (first.y1 + first.y2) / 2;
    run(world, 0.1);
    expect(p.hp).toBeLessThan(hp);
    expect(runUntil(world, () => h.dead, 16)).toBe(true);
    expect(runUntil(world, () => world.boss.act !== act, 3)).toBe(true);
  });

  it('基板の線：4列 × 3段の12か所', () => {
    expect(boardPoints(createWorld({ waves: [{}] }).bounds)).toHaveLength(BOARD_COLUMNS.length * BOARD_ROWS.length);
  });

  it('子機の円陣：子機が3つ、本体のまわりを回る。全部壊すと、本体に隙ができる。時間切れで消えたときは、隙はできない', () => {
    const world = bossWorld('overload');
    const b = world.boss;
    const act = startAttack(world, 'satellites');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'satdrone').length === 3, 2)).toBe(true);
    const drones = world.enemies.filter((e) => e.def.id === 'satdrone');
    expect(drones.every((e) => e.anchor === b)).toBe(true);
    // 回っている
    const a0 = drones[0].anchorAngle;
    run(world, 0.5);
    expect(drones[0].anchorAngle).not.toBeCloseTo(a0, 2);
    // 撃ってくる
    expect(runUntil(world, () => world.shots.length > 0, 4)).toBe(true);
    // 全部壊す
    for (const e of drones) hitEnemy(world, e, 99999, 1, 0, 0);
    expect(runUntil(world, () => act.phase === 'recover', 2)).toBe(true);
    expect(act.t).toBeGreaterThan(act.def.recover + act.def.open - 0.5);
    // 時間切れ
    const w2 = bossWorld('overload');
    const act2 = startAttack(w2, 'satellites');
    expect(runUntil(w2, () => act2.phase === 'recover', act2.def.duration + 3)).toBe(true);
    expect(act2.t).toBeLessThanOrEqual(act2.def.recover + 0.05);
    expect(w2.enemies.filter((e) => e.def.id === 'satdrone' && !e.dead)).toHaveLength(0);
  });

  it('再起動：四隅に端末が出る。1つも壊さないと放電（部屋の端は安全）。1つでも壊すと、放電は止まって、本体に隙ができる', () => {
    // 壊さない：真ん中にいると当たる
    const world = bossWorld('overload');
    const p = world.player;
    const act = startAttack(world, 'reboot');
    expect(runUntil(world, () => world.enemies.filter((e) => e.def.id === 'terminal').length === 4, 2)).toBe(true);
    const bd = world.bounds;
    p.x = (bd.left + bd.right) / 2;
    p.y = (bd.top + bd.bottom) / 2;
    p.inv = 0;
    const hp = p.hp;
    for (let t = 0; t < act.def.charge + 0.5; t += DT) {
      p.x = (bd.left + bd.right) / 2;
      p.y = (bd.top + bd.bottom) / 2;
      updateWorld(world, DT, idle);
    }
    expect(p.hp).toBe(hp - act.def.damage);
    expect(world.enemies.filter((e) => e.def.id === 'terminal' && !e.dead)).toHaveLength(0);
    // 壊さない：壁ぎわなら当たらない
    const w2 = bossWorld('overload');
    const act2 = startAttack(w2, 'reboot');
    runUntil(w2, () => w2.enemies.filter((e) => e.def.id === 'terminal').length === 4, 2);
    w2.player.inv = 0;
    const hp2 = w2.player.hp;
    for (let t = 0; t < act2.def.charge + 0.5; t += DT) {
      w2.player.x = w2.bounds.left + 20;
      w2.player.y = (w2.bounds.top + w2.bounds.bottom) / 2;
      updateWorld(w2, DT, idle);
    }
    expect(w2.player.hp).toBe(hp2);
    // 1つ壊す
    const w3 = bossWorld('overload');
    const act3 = startAttack(w3, 'reboot');
    runUntil(w3, () => w3.enemies.filter((e) => e.def.id === 'terminal').length === 4, 2);
    const [t0] = w3.enemies.filter((e) => e.def.id === 'terminal');
    hitEnemy(w3, t0, 99999, 1, 0, 0);
    w3.player.x = (w3.bounds.left + w3.bounds.right) / 2;
    w3.player.y = (w3.bounds.top + w3.bounds.bottom) / 2;
    w3.player.inv = 0;
    const hp3 = w3.player.hp;
    expect(runUntil(w3, () => act3.phase === 'recover', 2)).toBe(true);
    expect(act3.t).toBeGreaterThan(act3.def.recover + act3.def.open - 0.5);
    run(w3, 1);
    expect(w3.player.hp).toBe(hp3);
  });

  it('基板ショート：交差点が順に光り、十字（横と縦）の稲妻が走る', () => {
    const world = bossWorld('overload');
    const act = startAttack(world, 'shortcircuit');
    expect(runUntil(world, () => world.hazards.filter((h) => h.type === 'bar').length === act.def.count * 2, 2)).toBe(true);
    const bars = world.hazards.filter((h) => h.type === 'bar');
    const points = boardPoints(world.bounds);
    for (const bar of bars) expect(points.some((q) => q.x === bar.x && q.y === bar.y)).toBe(true);
    expect(new Set(bars.map((b) => b.angle))).toEqual(new Set([0, Math.PI / 2]));
    expect(bars[2].t).toBeGreaterThan(bars[0].t); // 順に
    expect(runUntil(world, () => world.boss.act !== act, 6)).toBe(true);
  });

  it('全システム停止（大技）：ブロックが12個。番号は、最初の数秒だけ見える。配線トレースが遅れて重なる', () => {
    const world = bossWorld('overload');
    const act = startAttack(world, 'systemhalt');
    const def = act.def;
    expect(runUntil(world, () => hazardsOf(world, 'opblocks').length > 0, 3)).toBe(true);
    const [h] = hazardsOf(world, 'opblocks');
    expect(h.blocks.length).toBeGreaterThanOrEqual(10);
    expect(h.blocks.map((b) => b.n).sort((a, b) => a - b)).toEqual(h.blocks.map((_, i) => i + 1));
    expect(h.dim).toBe(def.dim);
    expect(h.hideAfter).toBe(def.hideAfter);
    const [trace] = hazardsOf(world, 'trace');
    expect(trace.warn).toBeGreaterThan(def.trace.warn + def.traceDelay - 0.2);
    expect(runUntil(world, () => world.boss.act !== act, 30)).toBe(true);
    expect(world.hazards.some((x) => x.type === 'opblocks' || x.type === 'trace')).toBe(false);
  });

  it('後半の重ねる攻撃は、配線トレース', () => {
    const boss = DATA.bosses.get('overload');
    expect(boss.phases[1].side.moves).toEqual(['tracepath']);
    expect(boss.phases[1].rest.move).toBe('vent');
  });
});

describe('絵：新しい攻撃を最後まで描いても、エラーにならない', () => {
  it('3体の、すべての攻撃（予告・残る攻撃・ボス本体・子機・氷の壁・端末）を描ける', async () => {
    const { drawBossTelegraph, drawEnemies, drawHazards, drawPlayer } = await import('../src/render/draw.js');
    const g = new Proxy({}, { get: () => () => g });
    for (const id of ['boltboar', 'cryowyvern', 'overload']) {
      const boss = DATA.bosses.get(id);
      for (const name of Object.keys(boss.attacks)) {
        const world = bossWorld(id);
        world.boss.hp = world.boss.maxHp * 0.4;
        startAttack(world, name);
        let frame = 0;
        for (let t = 0; t < 14 && world.boss.act; t += DT) {
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
