import { afterEach, describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { implants, species } from '../src/data/implants.js';
import { setLang, translate } from '../src/i18n/translate.js';

// 名前と説明（段階3）が、英語・韓国語で、日本語が残らずに訳せること（docs/詳細仕様.md「38. 言語（英語・韓国語）」）

const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;
afterEach(() => setLang('ja'));

// 定義の中の、日本語を含む文字列を、すべて集める（関数は呼ばない）
function strings(value, out = new Set(), depth = 0) {
  if (depth > 8 || value === null || value === undefined) return out;
  if (typeof value === 'string') {
    if (JAPANESE.test(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) strings(v, out, depth + 1);
  } else if (typeof value === 'object') {
    for (const v of Object.values(value)) strings(v, out, depth + 1);
  }
  return out;
}

// 訳せなかった文を、まとめて返す
function untranslated(lang, list) {
  setLang(lang);
  return [...new Set(list)].filter((s) => JAPANESE.test(translate(s)));
}

// 物語（会話・データ片・実績）は、段階4
const STAGE3 = ['weapons', 'consumables', 'gearEffects', 'legendEffects', 'environments', 'rooms', 'maps', 'enemies', 'bosses', 'areas', 'materials', 'upgrades', 'eliteTraits', 'characters', 'encounters', 'gimmicks', 'dialogues', 'fragments', 'achievements'];

describe('名前と説明の訳（段階3）', () => {
  for (const lang of ['en', 'ko']) {
    for (const key of STAGE3) {
      it(`${key}：${lang} に、日本語が残らない`, () => {
        expect(untranslated(lang, [...strings(DATA[key].all())])).toEqual([]);
      });
    }
    it(`インプラントと種族：${lang} に、日本語が残らない（Lv1〜3の説明）`, () => {
      const list = implants.flatMap((i) => [i.name, i.desc?.(1), i.desc?.(2), i.desc?.(3)].filter(Boolean));
      list.push(...strings(species));
      expect(untranslated(lang, list)).toEqual([]);
    });
  }
});

describe('装備の名前と効果の行（段階3）', () => {
  it('どのレア度・部位の装備も、英語・韓国語に、日本語が残らない', async () => {
    const { makeItem, describeItem } = await import('../src/logic/loot.js');
    const { LOOT } = await import('../src/data/balance.js');
    let s = 7;
    const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const list = [];
    for (let rarity = 0; rarity < LOOT.rarities.length; rarity++) {
      for (const slot of LOOT.slots) {
        for (let i = 0; i < 12; i++) {
          const item = makeItem(rng, { rarity, slot: slot.id });
          list.push(item.name, ...describeItem(item));
        }
      }
    }
    for (const lang of ['en', 'ko']) expect(untranslated(lang, list)).toEqual([]);
  });

  it('武器のステータス補正の文も、訳せる', async () => {
    const { weaponTraitText } = await import('../src/logic/stats.js');
    const list = DATA.weapons.all().map((w) => weaponTraitText(w)).filter(Boolean);
    expect(list.length).toBeGreaterThan(0);
    for (const lang of ['en', 'ko']) expect(untranslated(lang, list)).toEqual([]);
  });
});

describe('物語（段階4）', () => {
  it('依頼文・エンディング・ほかの文章が、英語・韓国語に、日本語が残らない', async () => {
    const story = await import('../src/data/story.js');
    const list = [...strings(story.brief), ...strings(story.ending), ...strings(DATA.dialogues.all())];
    const { talks } = await import('../src/data/dialogues.js');
    list.push(...strings(talks));
    for (const lang of ['en', 'ko']) expect(untranslated(lang, list)).toEqual([]);
  });
});

describe('操作の説明の、武器ごとのクリック', () => {
  it('英語・韓国語に、日本語が残らない（今の武器の印も含む）', async () => {
    const { mouseLines } = await import('../src/scenes/controlsPanel.js');
    const list = [];
    for (const w of DATA.weapons.all()) {
      for (const line of mouseLines(w)) {
        list.push(`${line.name}${line.current ? '　← 今の武器' : ''}`, `左クリック：${line.left}`, `右クリック：${line.right}`, `RB：${line.left}`, `LB：${line.right}`);
      }
    }
    for (const lang of ['en', 'ko']) expect(untranslated(lang, list)).toEqual([]);
  });
});

describe('エリートの名前', () => {
  it('「敵の名前［特性・特性］」が、英語・韓国語に、日本語が残らない', () => {
    const traits = DATA.eliteTraits.all().map((t) => t.name);
    const list = [];
    for (const e of DATA.enemies.all()) {
      list.push(`${e.name}［${traits[0]}］`, `${e.name}［${traits[0]}・${traits[1]}］`, `${e.name}［${traits.join('・')}］`);
    }
    for (const lang of ['en', 'ko']) expect(untranslated(lang, list)).toEqual([]);
  });
});
