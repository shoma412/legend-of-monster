import { describe, expect, it } from 'vitest';
import { RUMBLE } from '../src/data/balance.js';
import { rumbleParams } from '../src/logic/rumble.js';
import { VIBRATIONS, createSettings, normalizeSettings } from '../src/logic/settings.js';
import { createFx, rumble } from '../src/game/fx.js';

// コントローラーの振動（docs/詳細仕様.md「32. ゲームパッド」の「振動」）

describe('振動の計算', () => {
  it('「切る」では振動しない', () => {
    expect(rumbleParams('hurt', 0, 'off')).toBeNull();
    expect(rumbleParams('hurt', 0, 'ふめい')).toBeNull();
    expect(rumbleParams('ふめい', 0, 'normal')).toBeNull();
  });

  it('溜め斬りの溜めは、段が上がるほど強く、長くなる', () => {
    const [a, b, c] = [0, 1, 2].map((i) => rumbleParams('chargeStage', i, 'normal'));
    expect(RUMBLE.events.chargeStage.length).toBe(3);
    expect(a.weakMagnitude + a.strongMagnitude).toBeLessThan(b.weakMagnitude + b.strongMagnitude);
    expect(b.weakMagnitude + b.strongMagnitude).toBeLessThan(c.weakMagnitude + c.strongMagnitude);
    expect(a.duration).toBeLessThan(c.duration);
    // 段の数を超えても、最後の段になる
    expect(rumbleParams('chargeStage', 9, 'normal')).toEqual(c);
  });

  it('設定の強さで、倍率が変わり、1を超えない', () => {
    const low = rumbleParams('bigHurt', 0, 'low');
    const normal = rumbleParams('bigHurt', 0, 'normal');
    const high = rumbleParams('bigHurt', 0, 'high');
    expect(low.strongMagnitude).toBeLessThan(normal.strongMagnitude);
    expect(high.strongMagnitude).toBeLessThanOrEqual(1);
    expect(high.weakMagnitude).toBeGreaterThan(normal.weakMagnitude);
  });

  it('どの場面も、値が範囲に収まる', () => {
    for (const level of VIBRATIONS.map((v) => v.id)) {
      for (const [name, entry] of Object.entries(RUMBLE.events)) {
        for (let i = 0; i < (Array.isArray(entry) ? entry.length : 1); i++) {
          const p = rumbleParams(name, i, level);
          if (level === 'off') continue;
          expect(p.weakMagnitude, name).toBeGreaterThanOrEqual(0);
          expect(p.strongMagnitude, name).toBeLessThanOrEqual(1);
          expect(p.duration, name).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('振動の予約と設定', () => {
  it('予約は、たまりすぎない', () => {
    const world = { fx: createFx() };
    for (let i = 0; i < 30; i++) rumble(world, 'hurt');
    expect(world.fx.rumbles.length).toBe(8);
  });

  it('設定の初期値は「普通」で、壊れた値は初期値に戻る', () => {
    expect(createSettings().vibration).toBe('normal');
    expect(normalizeSettings({ vibration: 'high' }).vibration).toBe('high');
    expect(normalizeSettings({ vibration: 'あれ' }).vibration).toBe('normal');
    expect(normalizeSettings({}).vibration).toBe('normal');
  });
});
