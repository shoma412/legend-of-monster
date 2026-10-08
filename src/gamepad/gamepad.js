// ゲームパッドを毎コマ読んで、src/game/padInput.js に書き込む（docs/詳細仕様.md「32. ゲームパッド」）。
//   スティック・攻撃・特殊 … padInput.js に書き込む（戦闘と隠れ家の画面が読む）
//   そのほかのボタン       … キーボードのキーを押したことにする（どの画面でも、キーと同じ働きをする）
import { pad } from '../game/padInput.js';
import { PAD_KEYS, padActions, padPressed, padTouched, readPad } from '../logic/gamepad.js';

// キーを1回押したことにする（押して、すぐ離す）。Phaser は keyCode を、メニューは code を見る
function tapKey([code, keyCode]) {
  for (const type of ['keydown', 'keyup']) {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code, keyCode, which: keyCode, bubbles: true }));
  }
}

function release() {
  pad.mx = 0;
  pad.my = 0;
  pad.ax = 0;
  pad.ay = 0;
  pad.attack = false;
}

export function initGamepad() {
  if (!navigator.getGamepads) return;
  let prev = null;
  // マウスを動かしたら、マウスの操作に戻す（向きが、またカーソルのほうになる）
  for (const type of ['mousemove', 'mousedown']) {
    window.addEventListener(type, () => {
      pad.active = false;
    });
  }
  const step = () => {
    requestAnimationFrame(step);
    const gp = [...navigator.getGamepads()].find((g) => g && g.connected);
    if (!gp) {
      if (prev) release();
      prev = null;
      return;
    }
    const now = readPad(gp);
    if (padTouched(now)) pad.active = true;
    const pressed = prev ? padPressed(prev, now) : [];
    prev = now;
    if (!pad.active) {
      release();
      return;
    }
    const playing = pad.mode === 'play';
    pad.mx = playing ? now.move.x : 0;
    pad.my = playing ? now.move.y : 0;
    pad.ax = playing ? now.aim.x : 0;
    pad.ay = playing ? now.aim.y : 0;
    pad.attack = playing && now.down.RB;
    const out = padActions(pad.mode, pressed, pad);
    pad.item = out.item;
    pad.choice = out.choice;
    if (out.attack) pad.attackPressed = true;
    if (out.special) pad.specialPressed = true;
    if (out.confirm) pad.confirmPressed = true;
    for (const name of out.keys) tapKey(PAD_KEYS[name]);
  };
  requestAnimationFrame(step);
}
