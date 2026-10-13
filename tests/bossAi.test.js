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

  it('どのボスも大技を持ち、後半には連携がある。どのボスも、そのボスだけの大技（共通の大技の部品は、もう誰も使っていない）（順に作り直す）', () => {
    const count = {};
    for (const boss of DATA.bosses.all().filter((b) => !b.hidden)) {
      expect(boss.ultimate?.announce, boss.id).toBeTruthy();
      const pattern = boss.attacks[boss.ultimate.move].pattern;
      count[pattern] = (count[pattern] ?? 0) + 1;
      expect(boss.phases.at(-1).combos?.length, boss.id).toBeGreaterThanOrEqual(1);
    }
    expect(count).toEqual({ douse: 1, searchlight: 1, afterimage: 1, melt: 1, saturate: 1, unroof: 1, fullopen: 1, blowthrough: 1, overvolt: 1, absolutezero: 1, systemhalt: 1, mudflow: 1, hightide: 1, regrowth: 1, stormfury: 1, junkstorm: 1, webweave: 1, collapse: 1 });
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
    b.memory.last = 'tuskrip';
    b.react.far = 99;
    b.idleT = 0;
    expect(runUntil(world, () => !!b.act, 1)).toBe(true);
    expect(b.act.name).toBe('wirepull');
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
    expect(b.act.name).toBe('rollshell');
    expect(runUntil(world, () => b.act?.phase === 'recover', 12)).toBe(true);
    expect(b.shieldOpen).toBe(true);
  });

  it('重ねる攻撃：後半は、本体の行動とは別に、残る攻撃が差し込まれる', () => {
    const world = bossWorld('overload', seeded(3));
    const b = world.boss;
    world.player.inv = Infinity;
    b.hp = b.maxHp * 0.4;
    expect(runUntil(world, () => b.phaseIndex === 1)).toBe(true);
    expect(runUntil(world, () => b.side?.name === 'tracepath', 25)).toBe(true);
    expect(runUntil(world, () => world.hazards.some((h) => h.type === 'trace'), 4)).toBe(true);
    // 前半には出ない
    const early = bossWorld('overload', seeded(3));
    early.player.inv = Infinity;
    expect(runUntil(early, () => !!early.boss.side, 20)).toBe(false);
  });
});

describe('大技', () => {
  // HP を残りわずかにして、大技を始めさせる
  //   move を書くと、そのボスの大技を、共通の部品の大技（overcharge / zero / lockon）に差し替える
  function ultimateWorld(id, rng, move = null) {
    const world = bossWorld(id, rng);
    const b = world.boss;
    if (move) b.def = { ...b.def, ultimate: { move, announce: move } };
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
    expect(b.act.name).toBe('overvolt');
    expect(b.act.ultimate).toBe(true);
    expect(b.ultimateDone).toBe(true);
    expect(runUntil(world, () => !b.act, 30)).toBe(true);
    b.idleT = Infinity;
    for (let i = 0; i < 30; i++) updateWorld(world, DT, idle);
    expect(b.act).toBeNull(); // 2回目は出ない
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
