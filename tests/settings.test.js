import { describe, expect, it } from 'vitest';
import { createClock } from '../src/logic/clock.js';
import { DISPLAY_SIZES, FRAME_RATES, QUALITIES, SETTINGS_KEY, createSettings, loadSettings, normalizeSettings, stepVolume, storeSettings } from '../src/logic/settings.js';

function fakeStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

describe('設定', () => {
  it('保存して読み込むと元に戻る。セーブデータとは別の場所に保存する', () => {
    const storage = fakeStorage();
    const s = createSettings();
    s.volume.bgm = 0.3;
    s.displaySize = '1280';
    s.quality = 2;
    s.frameRate = 60;
    s.muted = true;
    expect(storeSettings(storage, s)).toBe(true);
    expect(SETTINGS_KEY).not.toContain('save');
    expect(loadSettings(storage)).toEqual(s);
  });

  it('壊れた値や知らない値は、初期値に戻す', () => {
    const base = createSettings();
    expect(normalizeSettings(null)).toEqual(base);
    const s = normalizeSettings({ volume: { master: 5, bgm: -1, se: 'x' }, displaySize: '9999', quality: 7, frameRate: 45 });
    expect(s.frameRate).toBe(0);
    expect(s.volume).toEqual({ master: 1, bgm: 0, se: base.volume.se });
    expect(s.displaySize).toBe('fit');
    expect(s.quality).toBe(1);
    const storage = fakeStorage();
    storage.setItem(SETTINGS_KEY, '{こわれた');
    expect(loadSettings(storage)).toEqual(base);
  });

  it('音量は10段階で上げ下げでき、0〜1に収まる', () => {
    expect(stepVolume(0.5, 1)).toBeCloseTo(0.6);
    expect(stepVolume(0.5, -1)).toBeCloseTo(0.4);
    expect(stepVolume(1, 1)).toBe(1);
    expect(stepVolume(0, -1)).toBe(0);
  });

  it('表示の大きさは4種類、画質は3種類（標準・高・最高）、フレームレートは4種類から選ぶ', () => {
    expect(DISPLAY_SIZES.map((d) => d.id)).toEqual(['fit', '960', '1280', '1600']);
    expect(QUALITIES.map((q) => q.id)).toEqual([1, 2, 3]);
    // フレームレートは 制限なし（0）／30／60／120。最初は制限なし
    expect(FRAME_RATES.map((r) => r.id)).toEqual([0, 30, 60, 120]);
    expect(createSettings().frameRate).toBe(0);
  });
});

describe('経過時間の時計', () => {
  it('前のコマからの秒数を返す。最初の1回は 0', () => {
    const clock = createClock();
    expect(clock.tick(1000)).toBe(0);
    expect(clock.tick(1016)).toBeCloseTo(0.016, 6);
    expect(clock.tick(1516)).toBeCloseTo(0.5, 6);
  });

  it('時刻が戻っても、負の時間にはならない', () => {
    const clock = createClock();
    clock.tick(1000);
    expect(clock.tick(900)).toBe(0);
  });
});
