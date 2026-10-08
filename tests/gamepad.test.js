import { describe, expect, it } from 'vitest';
import { BUTTONS, PAD_KEYS, padActions, padPressed, padTouched, readPad } from '../src/logic/gamepad.js';

// ゲームパッドのふり。down: 押しているボタンの名前, axes: [左X, 左Y, 右X, 右Y]
function fake(down = [], axes = [0, 0, 0, 0], values = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  for (const name of down) buttons[BUTTONS[name]] = { pressed: true, value: 1 };
  for (const [name, value] of Object.entries(values)) buttons[BUTTONS[name]] = { pressed: false, value };
  return { axes, buttons };
}
const state = (extra = {}) => ({ item: 0, items: 2, choice: 0, options: 3, loot: false, canReturn: false, ...extra });

describe('ゲームパッドの読み取り', () => {
  it('左スティックの小さな傾きは、0 として扱う', () => {
    expect(readPad(fake([], [0.1, -0.1, 0, 0])).move).toEqual({ x: 0, y: 0 });
    expect(readPad(fake([], [0.9, 0, 0, 0])).move.x).toBeCloseTo(0.9);
  });

  it('十字キーでも動ける（斜めは、長さ1）', () => {
    const now = readPad(fake(['right', 'down']));
    expect(Math.hypot(now.move.x, now.move.y)).toBeCloseTo(1);
    expect(now.move.x).toBeGreaterThan(0);
  });

  it('右スティックは、向き', () => {
    expect(readPad(fake([], [0, 0, 0, -1])).aim).toEqual({ x: 0, y: -1 });
  });

  it('LT・RT は、少し引いただけでは押したことにならない', () => {
    expect(readPad(fake([], [0, 0, 0, 0], { LT: 0.2 })).down.LT).toBe(false);
    expect(readPad(fake([], [0, 0, 0, 0], { LT: 0.8 })).down.LT).toBe(true);
  });

  it('何も触っていなければ、触っていない', () => {
    expect(padTouched(readPad(fake()))).toBe(false);
    expect(padTouched(readPad(fake(['A'])))).toBe(true);
  });

  it('押した瞬間だけを拾う（押しっぱなしは、2回目から出ない）', () => {
    const a = readPad(fake());
    const b = readPad(fake(['A']));
    expect(padPressed(a, b)).toEqual(['A']);
    expect(padPressed(b, b)).toEqual([]);
  });

  it('スティックや十字キーを大きく倒した向きは、倒した瞬間に1回だけ出る', () => {
    const a = readPad(fake());
    const b = readPad(fake(['up']));
    const c = readPad(fake([], [1, 0, 0, 0]));
    expect(padPressed(a, b)).toEqual(['dir:up']);
    expect(padPressed(b, b)).toEqual([]);
    expect(padPressed(b, c)).toEqual(['dir:right']);
  });
});

describe('ゲームパッドのボタンの働き', () => {
  it('戦闘：村田さんの割り当てどおり', () => {
    const keys = (name, extra) => padActions('play', [name], state(extra)).keys;
    expect(keys('X')).toEqual(['interact']);
    expect(keys('X', { loot: true })).toEqual(['stash']);
    expect(keys('Y')).toEqual(['kit']);
    expect(keys('RT')).toEqual(['lock']);
    expect(keys('LT')).toEqual(['dash']);
    expect(keys('plus')).toEqual(['menu']);
    expect(keys('minus')).toEqual(['map']);
    expect(padActions('play', ['RB'], state()).attack).toBe(true);
    expect(padActions('play', ['LB'], state()).special).toBe(true);
  });

  it('戦闘：B で消耗品の枠を順に切り替え、A で使う', () => {
    expect(padActions('play', ['B'], state()).item).toBe(1);
    expect(padActions('play', ['B'], state({ item: 1 })).item).toBe(0);
    expect(padActions('play', ['A'], state({ item: 1 })).keys).toEqual(['digit2']);
    expect(padActions('play', ['A'], state({ items: 0 })).keys).toEqual([]);
  });

  it('戦闘：「帰還する」が出ている間の A は、決定', () => {
    expect(padActions('play', ['A'], state({ canReturn: true })).keys).toEqual(['enter']);
  });

  it('メニュー：LB・RB でタブ、スティック・十字キーで項目、A で決定、B で閉じる', () => {
    const keys = (name) => padActions('menu', [name], state()).keys;
    expect(keys('LB')).toEqual(['left']);
    expect(keys('RB')).toEqual(['right']);
    expect(keys('dir:up')).toEqual(['up']);
    expect(keys('dir:down')).toEqual(['down']);
    expect(keys('dir:left')).toEqual(['up']);
    expect(keys('dir:right')).toEqual(['down']);
    expect(keys('A')).toEqual(['enter']);
    expect(keys('B')).toEqual(['menu']);
  });

  it('タイトル・セーブ枠・マップ選択：倒した向きのキー', () => {
    expect(padActions('select', ['dir:left'], state()).keys).toEqual(['left']);
    expect(padActions('select', ['A'], state()).keys).toEqual(['enter']);
  });

  it('レベルアップの3択：左右で選んで、A で決める', () => {
    expect(padActions('choice', ['dir:right'], state()).choice).toBe(1);
    expect(padActions('choice', ['dir:left'], state()).choice).toBe(2);
    expect(padActions('choice', ['A'], state({ choice: 2 })).keys).toEqual(['digit3']);
  });

  it('会話：A で進める。X・Y で選択肢', () => {
    expect(padActions('talk', ['A'], state()).keys).toEqual(['interact']);
    expect(padActions('talk', ['X'], state()).keys).toEqual(['digit1']);
    expect(padActions('talk', ['Y'], state()).keys).toEqual(['digit2']);
  });

  it('リザルト：A で戻る', () => {
    expect(padActions('result', ['A'], state()).confirm).toBe(true);
  });

  it('押したことにするキーは、すべて定義がある', () => {
    for (const mode of ['play', 'talk', 'choice', 'result', 'menu', 'select']) {
      for (const name of [...Object.keys(BUTTONS), 'dir:up', 'dir:down', 'dir:left', 'dir:right']) {
        for (const key of padActions(mode, [name], state({ loot: true })).keys) expect(PAD_KEYS[key], `${mode} ${name}`).toBeTruthy();
      }
    }
  });
});
