import { describe, expect, it } from 'vitest';
import { takeTouchPresses, touch } from '../src/game/touchInput.js';
import { STICK, detectMobile, stickDirection, stickVector } from '../src/logic/device.js';

// モバイル版（docs/詳細仕様.md「31. モバイル版」）

describe('スマホ・タブレットの見分け', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15'; // iPad は、Mac を名乗る

  it('スマホとタブレットは、モバイル版になる', () => {
    expect(detectMobile({ touchPoints: 5, coarse: true, userAgent: android })).toBe(true);
    expect(detectMobile({ touchPoints: 5, coarse: true, userAgent: iphone })).toBe(true);
    expect(detectMobile({ touchPoints: 5, coarse: true, userAgent: ipad })).toBe(true);
    expect(detectMobile({ touchPoints: 5, coarse: false, userAgent: android })).toBe(true);
  });

  it('パソコンは、モバイル版にならない。タッチ画面つきのノートパソコンも、ならない', () => {
    expect(detectMobile({ touchPoints: 0, coarse: false, userAgent: windows })).toBe(false);
    expect(detectMobile({ touchPoints: 10, coarse: false, userAgent: windows })).toBe(false);
    expect(detectMobile()).toBe(false);
  });

  it('アドレスの末尾の ?mobile=1 / ?mobile=0 で、切り替えられる（確認用）', () => {
    expect(detectMobile({ search: '?mobile=1', userAgent: windows })).toBe(true);
    expect(detectMobile({ search: '?mobile=0', touchPoints: 5, coarse: true, userAgent: android })).toBe(false);
  });
});

describe('画面のスティック', () => {
  it('倒した向きと大きさが、そのまま傾きになる。いちばん外より先は、1 で止まる', () => {
    expect(stickVector(30, 0, 60)).toEqual({ x: 0.5, y: 0 });
    const far = stickVector(0, -300, 60);
    expect(far.x).toBeCloseTo(0, 5);
    expect(far.y).toBeCloseTo(-1, 5);
    const diagonal = stickVector(60, 60, 60);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 5);
  });

  it('少し触っただけでは、動かない', () => {
    expect(stickVector(60 * STICK.dead * 0.9, 0, 60)).toEqual({ x: 0, y: 0 });
    expect(stickVector(0, 0, 60)).toEqual({ x: 0, y: 0 });
  });

  it('大きく倒した向きが、上下左右のどれかになる（メニューを動かすのに使う）', () => {
    expect(stickDirection({ x: 0.9, y: 0.1 })).toBe('right');
    expect(stickDirection({ x: -0.9, y: 0.3 })).toBe('left');
    expect(stickDirection({ x: 0.2, y: -0.8 })).toBe('up');
    expect(stickDirection({ x: 0.1, y: 0.7 })).toBe('down');
    expect(stickDirection({ x: 0.3, y: 0.2 })).toBe(null);
  });
});

describe('モバイル版の入力', () => {
  it('パソコンでは、モバイル版の入力は切れている', () => {
    expect(touch.enabled).toBe(false);
  });

  it('押した瞬間の入力は、1回読むと消える', () => {
    touch.attackPressed = true;
    touch.specialPressed = true;
    expect(takeTouchPresses()).toEqual({ attackPressed: true, specialPressed: true });
    expect(takeTouchPresses()).toEqual({ attackPressed: false, specialPressed: false });
  });
});
