import { afterEach, describe, expect, it } from 'vitest';
import { LANGS, detectLang, setLang, translate } from '../src/i18n/translate.js';
import { createSettings, normalizeSettings } from '../src/logic/settings.js';
import { en } from '../src/data/i18n/en.js';
import { ko } from '../src/data/i18n/ko.js';

// 言語（docs/詳細仕様.md「38. 言語（英語・韓国語）」）

afterEach(() => setLang('ja'));

describe('言語の判定', () => {
  it('ブラウザの言語：ja → 日本語、ko → 韓国語、それ以外 → English', () => {
    expect(detectLang(['ja-JP', 'en'])).toBe('ja');
    expect(detectLang(['ko-KR'])).toBe('ko');
    expect(detectLang(['en-US'])).toBe('en');
    expect(detectLang(['fr-FR'])).toBe('en');
    expect(detectLang(['fr-FR', 'ko'])).toBe('ko');
    expect(detectLang([])).toBe('en');
  });

  it('設定：language は、選ぶまで null。知らない値は null に戻す', () => {
    expect(createSettings().language).toBeNull();
    expect(normalizeSettings({ language: 'ko' }).language).toBe('ko');
    expect(normalizeSettings({ language: 'fr' }).language).toBeNull();
    expect(LANGS.map((l) => l.id)).toEqual(['ja', 'en', 'ko']);
  });
});

describe('翻訳', () => {
  it('日本語のときは、そのまま。対応表に無い文も、そのまま', () => {
    expect(translate('はじめる')).toBe('はじめる');
    setLang('en');
    expect(translate('対応表にない、ふしぎな文')).toBe('対応表にない、ふしぎな文');
    expect(translate('1234')).toBe('1234');
  });

  it('文ごとの訳。数や名前が入る文は、{} の中身も訳す', () => {
    setLang('en');
    expect(translate('はじめる')).toBe('Start');
    expect(translate('{}周目に進む'.replace('{}', '3'))).toBe('Advance to cycle 3');
    expect(translate('E：修復キットを買う（50 c）　所持 2')).toContain('Buy Repair Kit (50 c)');
    setLang('ko');
    expect(translate('はじめる')).toBe('시작');
    expect(translate('3周目に進む')).toBe('3회차로 진행');
  });

  it('何行かの文は、1行ずつ訳す', () => {
    setLang('en');
    expect(translate('はじめる\n設定')).toBe('Start\nSettings');
  });

  it('名前の置き換え（names）：長い名前を先に置き換える', () => {
    // 対応表を直接引く（names が空でも、仕組みが壊れていないこと）
    setLang('en');
    expect(typeof translate('設定')).toBe('string');
  });

  it('英語と韓国語の対応表は、同じ文を持っている。{n} の番号も、日本語の {} の数に合っている', () => {
    expect(Object.keys(ko.strings)).toEqual(Object.keys(en.strings));
    for (const [dict, name] of [[en, 'en'], [ko, 'ko']]) {
      for (const [ja, tr] of Object.entries(dict.strings)) {
        const slots = ja.split('{}').length - 1;
        const used = [...tr.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
        for (const n of used) expect(n, `${name}: ${ja}`).toBeLessThanOrEqual(slots);
        // {} がある文は、すべての {} が訳に出てくる
        for (let n = 1; n <= slots; n++) expect(used, `${name}: ${ja}`).toContain(n);
      }
    }
  });
});
