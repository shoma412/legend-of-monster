import { describe, expect, it } from 'vitest';
import { COMBAT, ENEMY_SCALING, PLAYER, SCREEN } from '../src/data/balance.js';

// docs/詳細仕様.md「9. 数値の目安」の初期値と、値同士のつじつまを確かめる
describe('balance', () => {
  it('画面は 960×540', () => {
    expect(SCREEN).toEqual({ width: 960, height: 540 });
  });

  it('ダッシュの無敵時間は、ダッシュ時間以上でクールダウンより短い', () => {
    expect(PLAYER.dash.invincible).toBeGreaterThanOrEqual(PLAYER.dash.duration);
    expect(PLAYER.dash.invincible).toBeLessThan(PLAYER.dash.cooldown);
  });

  it('確率と倍率が妥当な範囲にある', () => {
    expect(PLAYER.critChance).toBeGreaterThanOrEqual(0);
    expect(PLAYER.critChance).toBeLessThanOrEqual(1);
    expect(PLAYER.critMultiplier).toBeGreaterThan(1);
    expect(COMBAT.weaknessMultiplier).toBeGreaterThan(1);
    expect(ENEMY_SCALING.perArea).toBeGreaterThan(1);
  });
});
