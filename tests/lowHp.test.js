import { describe, expect, it } from 'vitest';
import { FEEL } from '../src/data/balance.js';
import { SE } from '../src/data/audio.js';
import { heartbeatInterval, lowHpLevel } from '../src/logic/lowHp.js';

// HP が少ないときの警告（docs/詳細仕様.md「14. 画面まわり → HP が少ないときの警告」）

describe('HP が少ないときの警告', () => {
  it('30% 以下で警告、15% 以下で危険。それより多ければ出ない', () => {
    expect(lowHpLevel(100, 100)).toBe(0);
    expect(lowHpLevel(31, 100)).toBe(0);
    expect(lowHpLevel(30, 100)).toBe(1);
    expect(lowHpLevel(16, 100)).toBe(1);
    expect(lowHpLevel(15, 100)).toBe(2);
    expect(lowHpLevel(1, 100)).toBe(2);
  });

  it('最大HPが増えていても、割合で決まる', () => {
    expect(lowHpLevel(60, 200)).toBe(1);
    expect(lowHpLevel(61, 200)).toBe(0);
    expect(lowHpLevel(30, 200)).toBe(2);
  });

  it('倒れているときは出ない', () => {
    expect(lowHpLevel(0, 100)).toBe(0);
    expect(lowHpLevel(-5, 100)).toBe(0);
  });

  it('鼓動の音は、危険なほど速い。ふつうのときは鳴らない', () => {
    expect(heartbeatInterval(0)).toBeNull();
    expect(heartbeatInterval(1)).toBe(FEEL.lowHp.beat);
    expect(heartbeatInterval(2)).toBe(FEEL.lowHp.beatCritical);
    expect(FEEL.lowHp.beatCritical).toBeLessThan(FEEL.lowHp.beat);
    expect(SE.heartbeat).toBeDefined();
  });
});
