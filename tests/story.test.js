import { describe, expect, it } from 'vitest';
import { ROOMGEN } from '../src/data/balance.js';
import { GLITCH, NOISE_TAG } from '../src/data/characters.js';
import { dialogues, talks } from '../src/data/dialogues.js';
import { DATA } from '../src/data/index.js';
import { ending } from '../src/data/story.js';
import { COLORS } from '../src/data/theme.js';
import { choiceBlocked, chooseEncounter, hasEncounterAction } from '../src/game/encounters.js';
import { interact, updateFocus } from '../src/game/objects.js';
import { buildRoom } from '../src/game/rooms.js';
import { createRun, enterRoom } from '../src/game/run.js';
import { createWorld } from '../src/game/world.js';
import { glitchName, markSeen, pendingDialogue, resolveNames, talkLines } from '../src/logic/dialogue.js';
import { SAVE_VERSION, createSave, loadSlot, slotKey } from '../src/logic/save.js';
import { PORTRAIT_SIZE, hasPortrait, portraitGrid } from '../src/render/portraits.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}

const allLines = () => [
  ...dialogues.flatMap((d) => d.lines),
  ...Object.values(talks).flatMap((list) => list.flatMap((t) => t.lines)),
  ...DATA.encounters.all().flatMap((e) => [...e.intro, ...e.choices.flatMap((c) => c.result)]),
];

describe('人物と顔イラスト', () => {
  it('どの人物にも顔イラストがあり、64×64 で、何か描かれている', () => {
    expect(PORTRAIT_SIZE).toBe(64);
    for (const c of DATA.characters.all()) {
      expect(hasPortrait(c.portrait), c.id).toBe(true);
      const grid = portraitGrid(c.portrait);
      expect(grid).toHaveLength(64);
      expect(grid.every((row) => row.length === 64)).toBe(true);
      const filled = grid.flat().filter(Boolean).length;
      expect(filled, c.id).toBeGreaterThan(64 * 64 * 0.3);
      expect(COLORS[c.color], c.id).toBeDefined();
    }
  });

  it('表情を変えると、絵が少し変わる（ジンの怒り）', () => {
    const a = portraitGrid('jin', 'normal').flat();
    const b = portraitGrid('jin', 'angry').flat();
    const diff = a.filter((color, i) => color !== b[i]).length;
    expect(diff).toBeGreaterThan(10);
    expect(diff).toBeLessThan(300);
  });

  it('会話のどの行も、定義された人物が話していて、文章が空でない', () => {
    for (const line of allLines()) {
      expect(DATA.characters.has(line.who), line.text).toBe(true);
      expect(line.text.length).toBeGreaterThan(0);
    }
  });
});

describe('依頼主の名前のごまかし', () => {
  it('記号だけの並びになり、出すたびに変わる', () => {
    const names = new Set();
    for (let i = 0; i < 30; i++) {
      const name = glitchName();
      expect([...name]).toHaveLength(GLITCH.length);
      for (const ch of name) expect(GLITCH.chars.includes(ch)).toBe(true);
      names.add(name);
    }
    expect(names.size).toBeGreaterThan(5);
  });

  it('通信ログとエンディングの印（@noise）は、表示するときに記号へ置き換わる', () => {
    const texts = [...DATA.areas.all().flatMap((a) => [...a.comms.bossIntro, ...a.comms.bossDefeated]), ...ending.lines];
    expect(texts.some((t) => t.includes(NOISE_TAG))).toBe(true);
    for (const line of resolveNames(texts)) {
      expect(line.includes(NOISE_TAG)).toBe(false);
      expect(line.includes('依頼主＞')).toBe(false);
      expect(line.includes('ノイズ')).toBe(false);
    }
  });
});

describe('自動で出る会話', () => {
  it('初めての出撃の前に1回だけ出る', () => {
    const save = createSave();
    const d = pendingDialogue(save, 'sortie');
    expect(d.id).toBe('first-sortie');
    markSeen(save, d.id);
    expect(pendingDialogue(save, 'sortie')).toBeNull();
  });

  it('ボスの前の会話は、そのボスの部屋でだけ出る。どのボスにも用意してある', () => {
    const save = createSave();
    for (const boss of DATA.bosses.all().filter((b) => !b.hidden)) {
      const d = pendingDialogue(save, 'bossIntro', { boss: boss.id });
      expect(d, boss.id).not.toBeNull();
      expect(d.trigger.boss).toBe(boss.id);
    }
    expect(pendingDialogue(save, 'bossIntro', { boss: 'nobody' })).toBeNull();
  });

  it('帰還後の会話は、そのボスを倒したあとの隠れ家で出る。複数あれば順に出る', () => {
    const save = createSave();
    expect(pendingDialogue(save, 'hideout')).toBeNull();
    save.bossKills.boltboar = 1;
    save.bossKills.cryowyvern = 1;
    const first = pendingDialogue(save, 'hideout');
    expect(first.id).toBe('return-boltboar');
    markSeen(save, first.id);
    const second = pendingDialogue(save, 'hideout');
    expect(second.id).toBe('return-cryowyvern');
    markSeen(save, second.id);
    expect(pendingDialogue(save, 'hideout')).toBeNull();
  });

  it('会話の条件に書いたボスは、実際にいる', () => {
    for (const d of dialogues) {
      for (const id of [d.trigger.boss, d.trigger.bossKilled]) if (id) expect(DATA.bosses.has(id), d.id).toBe(true);
    }
    for (const list of Object.values(talks)) for (const t of list) if (t.after) expect(DATA.bosses.has(t.after)).toBe(true);
  });
});

describe('隠れ家で話しかける', () => {
  it('話しかけるたびに、今の段階の会話が順番に出る', () => {
    const save = createSave();
    const a = talkLines(save, 'hal', 0);
    const b = talkLines(save, 'hal', 1);
    expect(a).not.toBe(b);
    expect(talkLines(save, 'hal', 2)).toBe(a);
  });

  it('ボスを倒すと、話す内容が変わる', () => {
    const save = createSave();
    const before = talkLines(save, 'noise', 0);
    save.bossKills.boltboar = 1;
    const after = talkLines(save, 'noise', 0);
    expect(after).not.toBe(before);
    expect(after[0].text).toContain('送電区画');
  });

  it('ハルにも通信端末にも、最初から話せる', () => {
    const save = createSave();
    for (const who of ['hal', 'noise']) expect(talkLines(save, who, 0).length).toBeGreaterThan(0);
  });
});

describe('セーブデータ（会話の既読）', () => {
  it('版1のセーブデータを読むと、既読が空で足される', () => {
    const old = { ...createSave(), version: 1, bossKills: { boltboar: 2 } };
    delete old.seenDialogues;
    const loaded = loadSlot(fakeStorage({ [slotKey(1)]: JSON.stringify(old) }), 1);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.seenDialogues).toEqual([]);
    expect(loaded.bossKills.boltboar).toBe(2);
  });

  it('既読は保存して読み直しても残る', () => {
    const save = createSave();
    markSeen(save, 'first-sortie');
    markSeen(save, 'first-sortie');
    const loaded = loadSlot(fakeStorage({ [slotKey(2)]: JSON.stringify(save) }), 2);
    expect(loaded.seenDialogues).toEqual(['first-sortie']);
  });
});

describe('遭遇部屋', () => {
  const area = DATA.areas.get('slum');
  const rngOf = (v) => () => v;

  function encounterWorld(id) {
    const ids = DATA.encounters.ids();
    const room = buildRoom('encounter', { area, step: 1, build: null, rng: rngOf((ids.indexOf(id) + 0.5) / ids.length) });
    const world = createWorld({ room, rng: rngOf(0.5) });
    const npc = world.objects.find((o) => o.kind === 'npc');
    return { world, npc, def: DATA.encounters.get(id) };
  }

  it('どの遭遇も、選択肢が2つあり、起きることが定義されている', () => {
    for (const e of DATA.encounters.all()) {
      expect(DATA.characters.has(e.who), e.id).toBe(true);
      expect(e.choices).toHaveLength(2);
      for (const c of e.choices) expect(hasEncounterAction(c.action), `${e.id}: ${c.action}`).toBe(true);
    }
  });

  it('どのエリアの特殊部屋の候補にも入っている', () => {
    for (const a of DATA.areas.all()) expect(a.specialRooms).toContain('encounter');
  });

  it('部屋には人物が1人いて、敵は出ない。近づいて E で話しかけられる', () => {
    const { world, npc } = encounterWorld('peddler');
    expect(world.waves).toHaveLength(0);
    expect(npc.encounter).toBe('peddler');
    world.player.x = npc.x - 20;
    world.player.y = npc.y;
    updateFocus(world);
    interact(world);
    expect(world.request).toBe('encounter:peddler');
  });

  it('流れの商人：HPを払うと装備が足元に落ちる。HPが足りないと選べない', () => {
    const { world, npc, def } = encounterWorld('peddler');
    const p = world.player;
    const cost = Math.round(p.stats.maxHp * ROOMGEN.encounter.hpCost);
    const hp = p.hp;
    expect(chooseEncounter(world, npc, def.choices[0])).toBe(true);
    expect(p.hp).toBe(hp - cost);
    expect(world.loot).toHaveLength(1);
    expect(npc.used).toBe(true);
    // 1つの部屋で選べるのは1回
    expect(chooseEncounter(world, npc, def.choices[1])).toBe(false);

    const low = encounterWorld('peddler');
    low.world.player.hp = cost;
    expect(choiceBlocked(low.world, low.def.choices[0])).toBe('HPが足りない');
    expect(chooseEncounter(low.world, low.npc, low.def.choices[0])).toBe(false);
    expect(low.world.loot).toHaveLength(0);
  });

  it('壊れかけの保守機：修復キットで直すとインプラントが増える。キットがないと選べない', () => {
    const { world, npc, def } = encounterWorld('machine');
    const build = world.player.build;
    build.kits = 1;
    expect(chooseEncounter(world, npc, def.choices[0])).toBe(true);
    expect(build.kits).toBe(0);
    expect(Object.keys(build.implants)).toHaveLength(1);

    const none = encounterWorld('machine');
    none.world.player.build.kits = 0;
    expect(choiceBlocked(none.world, none.def.choices[0])).toBe('修復キットがない');
  });

  it('壊れかけの保守機：部品を抜くとクレジットが増える', () => {
    const { world, npc, def } = encounterWorld('machine');
    const before = world.player.build.credits;
    chooseEncounter(world, npc, def.choices[1]);
    expect(world.player.build.credits).toBe(before + ROOMGEN.encounter.salvageCredits);
  });

  it('倒れた回収屋：休むとHPが回復する', () => {
    const { world, npc, def } = encounterWorld('scavenger');
    const p = world.player;
    p.hp = 10;
    chooseEncounter(world, npc, def.choices[1]);
    expect(p.hp).toBe(10 + Math.round(p.stats.maxHp * ROOMGEN.encounter.restHeal));
  });

  it('倒れた回収屋：装備を拾うと、次の戦闘部屋の敵が増える（1部屋ぶんだけ）', () => {
    const count = (world) => world.waves.reduce((sum, wave) => sum + Object.values(wave).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0), 0);
    const seeded = (seed) => {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    };
    let normal = 0;
    let ambushed = 0;
    for (let n = 1; n <= 40; n++) {
      const seed = (n * 2654435761) % 4294967296;
      normal += count(enterRoom(createRun({ rng: seeded(seed) })));
      const run = createRun({ rng: seeded(seed) });
      run.build.ambush = true;
      ambushed += count(enterRoom(run));
      expect(run.build.ambush).toBe(false);
    }
    expect(ambushed).toBeGreaterThan(normal);
  });
});
