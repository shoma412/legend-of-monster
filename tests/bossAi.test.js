import { describe, expect, it } from 'vitest';
import { BOSS_AI, PLAYER } from '../src/data/balance.js';
import { DATA } from '../src/data/index.js';
import { PATTERNS } from '../src/game/bossPatterns.js';
import { hitEnemy } from '../src/game/combat.js';
import { createWorld, updateWorld } from '../src/game/world.js';
import { chooseMove, moveOptions, reachOf } from '../src/logic/bossAi.js';

// 2026-10-06 のボスの行動の作り直し：状況で技を選ぶ、反応、連携、重ねる攻撃、大技

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function bossWorld(id, rng = () => 0.5) {
  const world = createWorld({ waves: [{ boss: id }], rng });
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  return world;
}

function runUntil(world, cond, limit = 12) {
  for (let t = 0; t < limit; t += DT) {
    if (cond()) return true;
    updateWorld(world, DT, idle);
  }
  return false;
}

// 出した技の名前を、順に記録しながら進める
function watch(world, count, limit = 200) {
  const b = world.boss;
  const seen = [];
  let last = null;
  for (let t = 0; t < limit && seen.length < count; t += DT) {
    updateWorld(world, DT, idle);
    if (b.act && b.act !== last) seen.push(b.act.name);
    last = b.act;
  }
  return seen;
}

describe('ボスの定義（行動の選び方）', () => {
  it('どのボスも、技・連携・重ねる攻撃・反応・大技が、定義された攻撃を指している', () => {
    for (const boss of DATA.bosses.all()) {
      const known = (name, what) => expect(boss.attacks[name], `${boss.id} の ${what} ${name}`).toBeDefined();
      for (const phase of boss.phases) {
        for (const entry of phase.moves) known(typeof entry === 'string' ? entry : entry.move, '技');
        for (const combo of phase.combos ?? []) {
          expect(combo.moves.length, boss.id).toBeGreaterThanOrEqual(2);
          combo.moves.forEach((name) => known(name, '連携'));
        }
        for (const name of phase.side?.moves ?? []) known(name, '重ねる攻撃');
        if (phase.rest) known(phase.rest.move, '冷却');
      }
      for (const r of boss.reactions ?? []) {
        known(r.move, '反応');
        expect(['far', 'behind']).toContain(r.when);
      }
      for (const attack of Object.values(boss.attacks)) expect([undefined, 'near', 'far']).toContain(attack.reach);
    }
  });

  it('どのボスも大技を持ち、後半には連携がある。マップ1〜3の9体は、大技の部品が3種類を3体ずつ。マップ4からは、そのボスだけの大技もある', () => {
    const count = {};
    for (const boss of DATA.bosses.all().filter((b) => !b.hidden)) {
      expect(boss.ultimate?.announce, boss.id).toBeTruthy();
      const pattern = boss.attacks[boss.ultimate.move].pattern;
      count[pattern] = (count[pattern] ?? 0) + 1;
      expect(boss.phases.at(-1).combos?.length, boss.id).toBeGreaterThanOrEqual(1);
    }
    expect(count).toEqual({ endure: 3, safezone: 3, chase: 3, douse: 1 });
  });
});

describe('技の抽選', () => {
  const attacks = { poke: { reach: 'near' }, shot: { reach: 'far' }, wave: {}, jump: { reach: 'far' } };
  const phase = { moves: ['poke', 'shot', 'wave'], combos: [{ moves: ['jump', 'poke'] }] };
  const fresh = { last: null, prev: null, lastCombo: false };
  const weightOf = (options, name) => options.find((o) => o.moves.length === 1 && o.moves[0] === name).weight;

  it('距離を、近い・中くらい・遠いに分ける', () => {
    expect(reachOf(BOSS_AI.near - 1)).toBe('near');
    expect(reachOf((BOSS_AI.near + BOSS_AI.far) / 2)).toBe('mid');
    expect(reachOf(BOSS_AI.far + 1)).toBe('far');
  });

  it('近いときは近距離向きの技が、遠いときは遠距離向きの技が出やすい', () => {
    const near = moveOptions(phase, attacks, fresh, 100);
    expect(weightOf(near, 'poke')).toBeGreaterThan(weightOf(near, 'wave'));
    expect(weightOf(near, 'wave')).toBeGreaterThan(weightOf(near, 'shot'));
    const far = moveOptions(phase, attacks, fresh, 600);
    expect(weightOf(far, 'shot')).toBeGreaterThan(weightOf(far, 'wave'));
    expect(weightOf(far, 'wave')).toBeGreaterThan(weightOf(far, 'poke'));
  });

  it('直前の技は出ない。2つ前の技は出にくい。連携は続けて出ない', () => {
    const options = moveOptions(phase, attacks, { last: 'wave', prev: 'poke', lastCombo: false }, 280);
    expect(weightOf(options, 'wave')).toBe(0);
    expect(weightOf(options, 'poke')).toBeCloseTo(BOSS_AI.repeatPenalty);
    expect(weightOf(options, 'shot')).toBe(1);
    expect(options.some((o) => o.combo)).toBe(true);
    expect(moveOptions(phase, attacks, { last: 'poke', prev: 'jump', lastCombo: true }, 280).some((o) => o.combo)).toBe(false);
  });

  it('何百回選んでも、同じ技が続かない。使える技はどれも出る', () => {
    const rng = seeded(11);
    let memory = fresh;
    const used = new Set();
    for (let i = 0; i < 400; i++) {
      const pick = chooseMove(phase, attacks, memory, 280, rng);
      expect(pick.moves[0]).not.toBe(memory.last);
      pick.moves.forEach((name) => used.add(name));
      memory = { last: pick.moves.at(-1), prev: memory.last, lastCombo: !!pick.combo };
    }
    expect([...used].sort()).toEqual(['jump', 'poke', 'shot', 'wave']);
  });
});

describe('戦いの中での選び方', () => {
  it('同じボスでも、乱数が違えば技の順番が変わる', () => {
    const order = (seed) => {
      const world = bossWorld('boltboar', seeded(seed));
      world.player.inv = Infinity;
      return watch(world, 6).join(',');
    };
    expect(new Set([1, 2, 3, 4, 5, 6].map(order)).size).toBeGreaterThan(1);
  });

  it('遠くに離れ続けると、距離を詰める技で返してくる', () => {
    const world = bossWorld('boltboar');
    const b = world.boss;
    world.player.inv = Infinity;
    b.memory.last = 'stomp';
    b.react.far = 99;
    b.idleT = 0;
    expect(runUntil(world, () => !!b.act, 1)).toBe(true);
    expect(b.act.name).toBe('charge');
    expect(b.react.far).toBeLessThan(1);
  });

  it('甲羅持ちの背後に居続けると、回転の一撃が来る。そのあとの硬直は甲羅が開いている', () => {
    const world = bossWorld('tankcrab');
    const b = world.boss;
    const p = world.player;
    p.inv = Infinity;
    b.idleT = Infinity;
    // ボスは左を向いている。その右側（背後）に立ち続ける
    b.angle = Math.PI;
    b.x = 480;
    p.x = b.x + 120;
    p.y = b.y;
    const need = b.def.reactions.find((r) => r.when === 'behind').seconds;
    for (let t = 0; t < need + 0.2; t += DT) {
      b.angle = Math.PI;
      p.x = b.x + 120;
      p.y = b.y;
      updateWorld(world, DT, idle);
    }
    expect(b.react.behind).toBeGreaterThan(need);
    b.idleT = 0;
    expect(runUntil(world, () => !!b.act, 1)).toBe(true);
    expect(b.act.name).toBe('spin');
    expect(runUntil(world, () => b.act?.phase === 'recover', 3)).toBe(true);
    expect(b.shieldOpen).toBe(true);
  });

  it('連携：2つの技を間を空けずに出し、締めのあとは長めの隙ができる（歩かず、甲羅も開く）', () => {
    const world = bossWorld('tankcrab');
    const b = world.boss;
    const p = world.player;
    p.inv = Infinity;
    b.hp = b.maxHp * 0.4;
    expect(runUntil(world, () => b.phaseIndex === 1)).toBe(true);
    // 連携「跳びかかり→はさみ」を始めさせる
    b.act = null;
    b.queue = ['leap', 'pinch'];
    updateWorld(world, DT, idle);
    expect(b.act.name).toBe('leap');
    expect(b.act.def.recover).toBeLessThanOrEqual(BOSS_AI.comboRecover); // 途中の硬直は短い
    const first = b.act;
    expect(runUntil(world, () => b.act !== first)).toBe(true);
    updateWorld(world, DT, idle);
    expect(b.act?.name).toBe('pinch'); // 間を空けずに次へ
    expect(b.act.def.recover).toBe(b.def.attacks.pinch.recover); // 締めの硬直は元のまま
    expect(runUntil(world, () => !b.act)).toBe(true);
    expect(b.restT).toBeCloseTo(BOSS_AI.comboRest);
    p.x = world.bounds.left + 40;
    p.y = world.bounds.top + 40;
    const at = { x: b.x, y: b.y };
    updateWorld(world, DT, idle);
    updateWorld(world, DT, idle);
    expect(b.x).toBe(at.x);
    expect(b.y).toBe(at.y);
    expect(b.shieldOpen).toBe(true);
  });

  it('連携の途中で壁に激突したら、続きは出さない', () => {
    const world = bossWorld('boltboar');
    const b = world.boss;
    world.player.inv = Infinity;
    // 壁の近くで突進させる（プレイヤーは壁際）
    b.x = world.bounds.left + 260;
    world.player.x = world.bounds.left + 20;
    world.player.y = b.y;
    b.act = null;
    b.queue = ['charge', 'stomp'];
    updateWorld(world, DT, idle);
    expect(b.act.name).toBe('charge');
    expect(runUntil(world, () => b.act?.phase === 'stun', 6)).toBe(true);
    expect(runUntil(world, () => !b.act, 6)).toBe(true);
    expect(b.queue).toHaveLength(0);
  });

  it('重ねる攻撃：後半は、本体の行動とは別に、残る攻撃が差し込まれる', () => {
    const world = bossWorld('cryowyvern', seeded(3));
    const b = world.boss;
    world.player.inv = Infinity;
    b.hp = b.maxHp * 0.4;
    expect(runUntil(world, () => b.phaseIndex === 1)).toBe(true);
    expect(runUntil(world, () => b.side?.name === 'frost', 20)).toBe(true);
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'pool'), 4)).toBe(true);
    // 前半には出ない
    const early = bossWorld('cryowyvern', seeded(3));
    early.player.inv = Infinity;
    expect(runUntil(early, () => !!early.boss.side, 20)).toBe(false);
  });
});

describe('大技', () => {
  // HP を残りわずかにして、大技を始めさせる
  function ultimateWorld(id, rng) {
    const world = bossWorld(id, rng);
    const b = world.boss;
    b.idleT = Infinity;
    b.hp = Math.round(b.maxHp * (BOSS_AI.ultimateAt - 0.01));
    updateWorld(world, DT, idle);
    return world;
  }

  it('HP が残り 25% を切ると、1回だけ使う', () => {
    const world = bossWorld('boltboar');
    const b = world.boss;
    world.player.inv = Infinity;
    b.idleT = Infinity;
    b.hp = b.maxHp * 0.3;
    updateWorld(world, DT, idle);
    expect(b.act).toBeNull();
    b.hp = b.maxHp * 0.24;
    updateWorld(world, DT, idle);
    expect(b.act.name).toBe('overcharge');
    expect(b.act.ultimate).toBe(true);
    expect(b.ultimateDone).toBe(true);
    expect(runUntil(world, () => !b.act, 20)).toBe(true);
    b.idleT = Infinity;
    for (let i = 0; i < 30; i++) updateWorld(world, DT, idle);
    expect(b.act).toBeNull(); // 2回目は出ない
  });

  it('耐える：溜めている間に決まったダメージを与えると中断でき、長いスタンになる。輪は出ない', () => {
    const world = ultimateWorld('boltboar');
    const b = world.boss;
    const def = b.def.attacks.overcharge;
    world.player.inv = Infinity;
    expect(runUntil(world, () => b.act?.phase === 'charge', 3)).toBe(true);
    updateWorld(world, DT, idle);
    hitEnemy(world, b, b.act.need - 5, 1, 0, 0, { unblockable: true });
    updateWorld(world, DT, idle);
    expect(b.act.phase).toBe('charge');
    hitEnemy(world, b, 10, 1, 0, 0, { unblockable: true });
    updateWorld(world, DT, idle);
    expect(b.act.phase).toBe('stun');
    expect(b.act.t).toBeCloseTo(def.stun, 1);
    // スタン中は触れても安全
    world.player.inv = 0;
    world.player.x = b.x;
    world.player.y = b.y;
    world.shots.length = 0;
    world.hazards.length = 0;
    b.side = null;
    updateWorld(world, DT, idle);
    expect(world.player.hp).toBe(PLAYER.maxHp);
    world.player.inv = Infinity;
    expect(runUntil(world, () => !b.act, def.stun + 1)).toBe(true);
    expect(world.hazards.filter((h) => h.type === 'ring' && h.max > 900)).toHaveLength(0);
  });

  it('耐える：中断できないと、部屋の端まで届く輪が決まった回数だけ広がる。溜めている間は、別の技が重ねて出る', () => {
    const world = ultimateWorld('boltboar');
    const b = world.boss;
    const def = b.def.attacks.overcharge;
    world.player.inv = Infinity;
    let rings = 0;
    const seenRings = new Set();
    let pulsed = false;
    for (let t = 0; t < def.telegraph + def.duration + 4 && b.act; t += DT) {
      updateWorld(world, DT, idle);
      if (b.side?.name === def.pulse.move) pulsed = true;
      for (const h of world.hazards) {
        if (h.type === 'ring' && h.max > 900 && !seenRings.has(h)) {
          seenRings.add(h);
          rings++;
        }
      }
    }
    expect(pulsed).toBe(true);
    expect(rings).toBe(def.blast.count);
  });

  it('大再生：中断できないと、HP が回復し、倒した首がすべて生え直す', () => {
    const world = ultimateWorld('sludgehydra');
    const b = world.boss;
    const heads = () => world.enemies.filter((e) => e.anchor === b && !e.dead);
    world.player.inv = Infinity;
    expect(b.act.name).toBe('rebirth');
    for (const e of heads()) e.dead = true;
    world.enemies = world.enemies.filter((e) => !e.dead);
    const hp = b.hp;
    expect(runUntil(world, () => b.act?.phase === 'blast' || b.act?.phase === 'recover', 12)).toBe(true);
    updateWorld(world, DT, idle);
    expect(b.hp).toBe(hp + Math.round(b.maxHp * b.def.attacks.rebirth.heal));
    expect(heads()).toHaveLength(b.def.heads.count);
  });

  it('安全地帯：円の外にいると当たり、中にいれば当たらない。1つ目の円は必ずプレイヤーの近くに出る。決まった回数くり返す', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const world = ultimateWorld('cryowyvern', seeded(seed));
      const b = world.boss;
      const def = b.def.attacks.zero;
      const p = world.player;
      expect(b.act.zones).toHaveLength(def.zones);
      expect(Math.hypot(b.act.zones[0].x - p.x, b.act.zones[0].y - p.y)).toBeLessThanOrEqual(def.within + 1);
      for (const z of b.act.zones) {
        expect(z.x - z.r).toBeGreaterThanOrEqual(world.bounds.left - 1);
        expect(z.x + z.r).toBeLessThanOrEqual(world.bounds.right + 1);
      }
    }

    const world = ultimateWorld('cryowyvern');
    const b = world.boss;
    const def = b.def.attacks.zero;
    const p = world.player;
    b.x = world.bounds.right - 60; // 体に触れないよう、端に寄せる
    b.y = world.bounds.top + 60;
    let waves = 0;
    while (b.act && b.act.phase !== 'recover') {
      // 毎回、円の中へ入る
      const zone = b.act.zones.find((z) => Math.hypot(z.x - b.x, z.y - b.y) > b.r + z.r) ?? b.act.zones[0];
      p.x = zone.x;
      p.y = zone.y;
      const wasActive = b.act.phase === 'active';
      updateWorld(world, DT, idle);
      b.x = world.bounds.right - 60;
      b.y = world.bounds.top + 60;
      if (!wasActive && b.act?.phase === 'active') waves++;
    }
    expect(waves).toBe(def.waves);
    expect(p.hp).toBe(PLAYER.maxHp);

    // 円の外に立ったままだと当たる。予告の間は当たらない
    const w2 = ultimateWorld('cryowyvern');
    const b2 = w2.boss;
    const p2 = w2.player;
    const out = () => {
      p2.x = w2.bounds.left + 20;
      p2.y = w2.bounds.bottom - 20;
      if (b2.act.zones.some((z) => Math.hypot(p2.x - z.x, p2.y - z.y) <= z.r + p2.r)) p2.y = w2.bounds.top + 20;
    };
    while (b2.act.phase === 'telegraph') {
      out();
      expect(p2.hp).toBe(PLAYER.maxHp);
      updateWorld(w2, DT, idle);
    }
    out();
    updateWorld(w2, DT, idle);
    expect(p2.hp).toBe(PLAYER.maxHp - def.damage);
  });

  it('追尾：照準がプレイヤーを追い、止まってから攻撃する。止まったあとに離れれば当たらない', () => {
    const world = ultimateWorld('overload');
    const b = world.boss;
    const def = b.def.attacks.lockon;
    const p = world.player;
    const seekers = () => world.hazards.filter((h) => h.type === 'seeker');
    b.x = world.bounds.right - 60;
    b.y = world.bounds.top + 60;
    p.x = 200;
    p.y = 400;
    expect(runUntil(world, () => seekers().length > 0, 3)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    const s = seekers()[0];
    // 追っている間に、プレイヤーの上まで来る
    expect(runUntil(world, () => s.follow <= 0, 3)).toBe(true);
    expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeLessThan(5);
    // 立ち止まったままだと当たる
    expect(runUntil(world, () => s.dead || p.hp < PLAYER.maxHp, 2)).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp - def.damage);

    // 走り続けていれば当たらない（止まった照準から離れられる）。数は決まった個数
    const w2 = ultimateWorld('overload');
    const b2 = w2.boss;
    const p2 = w2.player;
    let count = 0;
    const seen = new Set();
    const cx = (w2.bounds.left + w2.bounds.right) / 2;
    const cy = (w2.bounds.top + w2.bounds.bottom) / 2;
    p2.x = cx;
    p2.y = cy - 150;
    for (let t = 0; t < 30 && b2.act; t += DT) {
      b2.x = w2.bounds.right - 60;
      b2.y = w2.bounds.top + 60;
      for (const h of w2.hazards) {
        if (h.type !== 'seeker') continue;
        if (!seen.has(h)) {
          seen.add(h);
          count++;
        }
      }
      // 部屋の真ん中のまわりを、円を描いて走り続ける
      const out = Math.hypot(p2.x - cx, p2.y - cy) - 150; // 円からのずれを戻す
      const a = Math.atan2(p2.y - cy, p2.x - cx) + Math.PI / 2 + Math.max(-0.5, Math.min(0.5, out / 40));
      updateWorld(w2, DT, { ...idle, mx: Math.cos(a), my: Math.sin(a) });
    }
    expect(count).toBe(def.count);
    expect(b2.act).toBeNull();
    expect(p2.hp).toBe(PLAYER.maxHp);
  });

  it('配管破裂：攻撃した場所に、汚水の床が残る', () => {
    const world = ultimateWorld('pipeserpent');
    world.player.inv = Infinity;
    expect(world.boss.act.name).toBe('rupture');
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'pool'), 6)).toBe(true);
  });

  it('どのボスの大技も、最後まで動いて終わる', () => {
    for (const boss of DATA.bosses.all()) {
      const world = ultimateWorld(boss.id, seeded(9));
      const b = world.boss;
      world.player.inv = Infinity;
      expect(b.act?.name, boss.id).toBe(boss.ultimate.move);
      expect(PATTERNS[b.act.def.pattern], boss.id).toBeDefined();
      let done = false;
      for (let t = 0; t < 40; t += DT) {
        b.idleT = Infinity;
        updateWorld(world, DT, idle);
        if (!b.act) {
          done = true;
          break;
        }
      }
      expect(done, boss.id).toBe(true);
    }
  });
});
