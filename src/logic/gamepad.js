// ゲームパッドの読み取りと、ボタンの割り当て（画面には触らない。docs/詳細仕様.md「32. ゲームパッド」）。
// ボタンの名前は Xbox のもの。番号は、ブラウザの「標準の並び」（Gamepad API の standard mapping）。
import { stickDirection, stickVector } from './device.js';

export const PAD = {
  trigger: 0.4, // LT・RT を、これより深く引いたら「押した」
  aimReach: 140, // 右スティックで向いているとき、狙う位置までの距離（px）
  repeatDelay: 0.4, // スティック・十字キーを、これだけ倒し続けたら（秒）、速く動く状態になる
  repeatEvery: 0.06, // 速く動く状態での、1つ動くまでの間（秒）
};

export const BUTTONS = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, minus: 8, plus: 9, up: 12, down: 13, left: 14, right: 15 };

// 押したことにするキー。[code, keyCode]（Phaser は keyCode を、メニューは code を見る）
export const PAD_KEYS = {
  interact: ['KeyE', 69],
  stash: ['KeyF', 70],
  kit: ['KeyQ', 81],
  lock: ['KeyR', 82],
  dash: ['ShiftLeft', 16],
  menu: ['Tab', 9],
  map: ['KeyM', 77],
  enter: ['Enter', 13],
  up: ['KeyW', 87],
  down: ['KeyS', 83],
  left: ['KeyA', 65],
  right: ['KeyD', 68],
  digit1: ['Digit1', 49],
  digit2: ['Digit2', 50],
  digit3: ['Digit3', 51],
  digit4: ['Digit4', 52],
  // メニューだけが見る、ゲームパッド専用のキー（キーボードにはない）
  padUp: ['PadUp', 0],
  padDown: ['PadDown', 0],
  padLeft: ['PadLeft', 0],
  padRight: ['PadRight', 0],
  padZoomIn: ['PadZoomIn', 0],
  padZoomOut: ['PadZoomOut', 0],
};

const held = (button) => !!button && (button.pressed || button.value > PAD.trigger);

// ゲームパッド1つの今の状態。gp は navigator.getGamepads() の1つ。
//   move: 左スティックと十字キーを合わせた向き（長さ 0〜1）, aim: 右スティック, down: 押しているボタンの名前 → true
export function readPad(gp) {
  const axes = gp.axes ?? [];
  const down = {};
  for (const [name, index] of Object.entries(BUTTONS)) down[name] = held(gp.buttons?.[index]);
  let move = stickVector(axes[0] ?? 0, axes[1] ?? 0, 1);
  const dx = (down.right ? 1 : 0) - (down.left ? 1 : 0);
  const dy = (down.down ? 1 : 0) - (down.up ? 1 : 0);
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    move = { x: dx / len, y: dy / len };
  }
  return { move, aim: stickVector(axes[2] ?? 0, axes[3] ?? 0, 1), down, direction: stickDirection(move) };
}

// 何か触っているか（スティックを倒している、ボタンを押している）
export function padTouched(now) {
  return now.move.x !== 0 || now.move.y !== 0 || now.aim.x !== 0 || now.aim.y !== 0 || Object.values(now.down).some(Boolean);
}

// 今押した瞬間のもの（ボタンの名前と、スティック・十字キーを大きく倒した向き dir:up など）。prev は、1コマ前の readPad の結果
export function padPressed(prev, now) {
  const list = Object.keys(BUTTONS).filter((name) => now.down[name] && !prev?.down[name] && !(name in PAD_DIRS));
  if (now.direction && now.direction !== prev?.direction) list.push(`dir:${now.direction}`);
  return list;
}
const PAD_DIRS = { up: 1, down: 1, left: 1, right: 1 };

// スティック・十字キーを倒し続けたときの、くり返し。hold は { direction, t }（前のコマの続き）、direction は今倒している向き、dt は秒。
//   返り値は { hold, fire }。fire が true のコマは、その向きにもう1つ動かす
export function padRepeat(hold, direction, dt) {
  if (!direction) return { hold: null, fire: false };
  if (hold?.direction !== direction) return { hold: { direction, t: 0 }, fire: false };
  const t = hold.t + dt;
  if (t < PAD.repeatDelay) return { hold: { direction, t }, fire: false };
  if (t - PAD.repeatDelay >= PAD.repeatEvery) return { hold: { direction, t: PAD.repeatDelay }, fire: true };
  return { hold: { direction, t }, fire: false };
}

// 押した瞬間のものを、画面ごとの働きに直す。
//   mode: play（動き回る）/ talk（会話）/ choice（レベルアップの3択）/ result（リザルト）/ menu（ポーズ画面・隠れ家のメニュー）/ select（タイトル・セーブ枠・マップ選択）
//   state: { item: 選んでいる消耗品の枠, items: 枠の数, choice: 3択のカーソル, options: 3択の数, loot: 足元に装備があるか, canReturn: 「帰還する」が出ているか }
//   返り値: { keys: 押したことにするキーの名前, attack, special, confirm, item, choice }
export function padActions(mode, pressed, state) {
  const out = { keys: [], attack: false, special: false, confirm: false, item: state.item ?? 0, choice: state.choice ?? 0 };
  const key = (name) => out.keys.push(name);
  for (const name of pressed) {
    if (mode === 'play') {
      if (name === 'X') key(state.loot ? 'stash' : 'interact');
      else if (name === 'Y') key('kit');
      else if (name === 'B' && state.items > 0) out.item = (out.item + 1) % state.items;
      else if (name === 'A') {
        if (state.canReturn) key('enter');
        else if (state.items > 0) key(`digit${Math.min(out.item, state.items - 1) + 1}`);
      } else if (name === 'RB') out.attack = true;
      else if (name === 'LB') out.special = true;
      else if (name === 'RT') key('lock');
      else if (name === 'LT') key('dash');
      else if (name === 'plus') key('menu');
      else if (name === 'minus') key('map');
    } else if (mode === 'talk') {
      if (name === 'A') key('interact');
      else if (name === 'X') key('digit1');
      else if (name === 'Y') key('digit2');
      else if (name === 'B' || name === 'plus') key('menu');
    } else if (mode === 'choice') {
      const n = Math.max(1, state.options ?? 3);
      if (name === 'dir:left') out.choice = (out.choice + n - 1) % n;
      else if (name === 'dir:right') out.choice = (out.choice + 1) % n;
      else if (name === 'A') key(`digit${Math.min(out.choice, n - 1) + 1}`);
    } else if (mode === 'result') {
      if (name === 'A') out.confirm = true;
    } else if (mode === 'menu') {
      // メニュー：LB・RB でタブ、左スティック・十字キーで項目やボタンを選ぶ。スキルツリーは、RT で拡大、LT で縮小
      if (name === 'LB') key('left');
      else if (name === 'RB') key('right');
      else if (name === 'dir:up') key('padUp');
      else if (name === 'dir:down') key('padDown');
      else if (name === 'dir:left') key('padLeft');
      else if (name === 'dir:right') key('padRight');
      else if (name === 'RT') key('padZoomIn');
      else if (name === 'LT') key('padZoomOut');
      else if (name === 'A') key('enter');
      else if (name === 'Y') key('stash'); // スキルツリー：次の取れるマスへ（F）
      else if (name === 'B' || name === 'plus') key('menu');
    } else {
      if (name.startsWith('dir:')) key(name.slice(4));
      else if (name === 'LB') key('left');
      else if (name === 'RB') key('right');
      else if (name === 'A') key('enter');
      else if (name === 'B' || name === 'plus') key('menu');
    }
  }
  return out;
}
