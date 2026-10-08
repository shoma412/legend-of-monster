// モバイル版の、画面のスティックとボタン（docs/詳細仕様.md「31. モバイル版」）。スマホ・タブレットで開いたときだけ作る。
// ゲームの画面（canvas）の上に、HTML の部品として重ねる。
//   スティック・攻撃・特殊 … src/game/touchInput.js に書き込む（戦闘と隠れ家の画面が読む）
//   そのほかのボタン       … キーボードのキーを押したことにする（どの画面でも、キーと同じ働きをする）
import { touch } from '../game/touchInput.js';
import { stickDirection, stickVector } from '../logic/device.js';

// ボタンの定義。key を書いたものは、そのキーを押したことにする。label の下に、小さく hint（画面の案内に出てくるキーの名前）を出す
//   size: big / mid / small
const ACTION_BUTTONS = [
  { id: 'attack', label: '攻撃', size: 'big', right: 3, bottom: 5 },
  { id: 'dash', label: 'ダッシュ', hint: 'Shift', size: 'mid', right: 27, bottom: 4, key: ['ShiftLeft', 16] },
  { id: 'special', label: '特殊', size: 'mid', right: 5, bottom: 30 },
  { id: 'interact', label: '調べる', hint: 'E', size: 'mid', right: 25, bottom: 24, key: ['KeyE', 69] },
  { id: 'kit', label: 'キット', hint: 'Q', size: 'small', right: 5, bottom: 52, key: ['KeyQ', 81] },
  { id: 'stash', label: 'しまう', hint: 'F', size: 'small', right: 21, bottom: 46, key: ['KeyF', 70] },
];
// 画面の右端・左端に、縦に並べる小さなボタン（横長のスマホでは、ゲームの画面の外の余白に収まる）
const RIGHT_BUTTONS = [
  { id: 'pause', label: 'メニュー', key: ['Tab', 9] },
  { id: 'enter', label: '決定', key: ['Enter', 13] },
];
const LEFT_BUTTONS = [
  { id: 'lock', label: '標的', key: ['KeyR', 82] },
  { id: 'map', label: '地図', key: ['KeyM', 77] },
  { id: 'full', label: '全画面' },
];
const ITEM_BUTTONS = [
  { id: 'item1', label: '1', key: ['Digit1', 49] },
  { id: 'item2', label: '2', key: ['Digit2', 50] },
  { id: 'item3', label: '3', key: ['Digit3', 51] },
  { id: 'item4', label: '4', key: ['Digit4', 52] },
];
const STICK_KEYS = { up: ['KeyW', 87], down: ['KeyS', 83], left: ['KeyA', 65], right: ['KeyD', 68] };

const CSS = `
html, body { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#touch { position: fixed; inset: 0; z-index: 20; pointer-events: none; font-family: "DotGothic16", "Noto Sans JP", sans-serif; --u: 1vh; }
#touch * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
#touch .tbtn { position: absolute; pointer-events: auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 50%; border: 2px solid rgba(46, 242, 255, 0.55); background: rgba(17, 15, 29, 0.45); color: rgba(230, 240, 255, 0.92);
  font-weight: 700; line-height: 1.1; touch-action: none; }
#touch .tbtn small { font-size: 0.62em; opacity: 0.7; font-weight: 400; }
#touch .tbtn.on { background: rgba(46, 242, 255, 0.4); border-color: #2ef2ff; }
#touch .big { width: calc(var(--u) * 24); height: calc(var(--u) * 24); font-size: calc(var(--u) * 5); border-color: rgba(255, 182, 72, 0.7); }
#touch .mid { width: calc(var(--u) * 18); height: calc(var(--u) * 18); font-size: calc(var(--u) * 3.6); }
#touch .small { width: calc(var(--u) * 13); height: calc(var(--u) * 13); font-size: calc(var(--u) * 3); }
#touch .row { position: absolute; display: flex; gap: calc(var(--u) * 1.6); pointer-events: none; }
#touch .row .tbtn { position: static; border-radius: calc(var(--u) * 1.6); width: auto; min-width: calc(var(--u) * 11); height: calc(var(--u) * 9);
  padding: 0 calc(var(--u) * 2); font-size: calc(var(--u) * 3.2); border-width: 1px; }
#touch .col { flex-direction: column; top: calc(var(--u) * 14); }
#touch .col.right { right: calc(var(--u) * 1.5); }
#touch .col.left { left: calc(var(--u) * 1.5); }
#touch .items { bottom: calc(var(--u) * 2); left: calc(var(--u) * 46); opacity: 0.75; }
#touch .items .tbtn { min-width: calc(var(--u) * 10); }
#touch .stick { position: absolute; pointer-events: auto; left: calc(var(--u) * 5); bottom: calc(var(--u) * 6); width: calc(var(--u) * 36); height: calc(var(--u) * 36);
  border-radius: 50%; border: 2px solid rgba(46, 242, 255, 0.35); background: rgba(17, 15, 29, 0.3); touch-action: none; }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 42%; height: 42%; margin: -21% 0 0 -21%; border-radius: 50%;
  border: 2px solid rgba(46, 242, 255, 0.8); background: rgba(46, 242, 255, 0.25); }
#touch .turn { display: none; position: fixed; inset: 0; pointer-events: auto; background: #07060d; color: #2ef2ff; align-items: center; justify-content: center;
  text-align: center; font-size: 5vw; line-height: 1.8; padding: 8vw; }
@media (orientation: portrait) { #touch .turn { display: flex; } }
`;

// キーを1回押したことにする（押して、すぐ離す）。Phaser は keyCode を、メニューは code を見る
function tapKey([code, keyCode]) {
  for (const type of ['keydown', 'keyup']) {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code, keyCode, which: keyCode, bubbles: true }));
  }
}

function el(tag, className, parent, html = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.innerHTML = html;
  parent.appendChild(node);
  return node;
}

// ボタン1つ。押した瞬間に onDown、離したときに onUp
function button(parent, def, className, onDown, onUp = null) {
  const node = el('div', `tbtn ${className}`, parent, def.hint ? `${def.label}<small>${def.hint}</small>` : def.label);
  node.dataset.id = def.id;
  const release = (event) => {
    event.preventDefault();
    node.classList.remove('on');
    onUp?.();
  };
  node.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      // 指を追いかけられなくても、押した瞬間の入力は通す
    }
    node.classList.add('on');
    onDown();
  });
  node.addEventListener('pointerup', release);
  node.addEventListener('pointercancel', release);
  return node;
}

function toggleFullscreen() {
  const target = document.getElementById('game');
  if (document.fullscreenElement) document.exitFullscreen?.();
  else target?.requestFullscreen?.().catch(() => {});
}

// 画面のスティックとボタンを作る。parent は、ゲームの画面を入れている要素（フルスクリーンにしても、一緒に出るように、その中に作る）
export function initTouchControls(parent) {
  touch.enabled = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = el('div', '', parent);
  root.id = 'touch';

  // スティック：倒した向きに動く。大きく倒すと、その向きのキーを1回押したことにもなる（メニューの上下左右）
  const stick = el('div', 'stick', root);
  const knob = el('div', 'knob', stick);
  let stickPointer = null;
  let lastDirection = null;
  const moveStick = (event) => {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width / 2;
    const v = stickVector(event.clientX - (rect.left + radius), event.clientY - (rect.top + radius), radius);
    touch.mx = v.x;
    touch.my = v.y;
    knob.style.transform = `translate(${v.x * radius * 0.6}px, ${v.y * radius * 0.6}px)`;
    const direction = stickDirection(v);
    if (direction && direction !== lastDirection) tapKey(STICK_KEYS[direction]);
    lastDirection = direction;
  };
  const releaseStick = (event) => {
    if (event.pointerId !== stickPointer) return;
    stickPointer = null;
    lastDirection = null;
    touch.mx = 0;
    touch.my = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    stickPointer = event.pointerId;
    try {
      stick.setPointerCapture(event.pointerId);
    } catch {
      // 追いかけられなくても、触っている間は動かせる
    }
    moveStick(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === stickPointer) moveStick(event);
  });
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  // 右下のボタン
  for (const def of ACTION_BUTTONS) {
    const node = button(root, def, def.size, () => {
      if (def.id === 'attack') {
        touch.attack = true;
        touch.attackPressed = true;
      } else if (def.id === 'special') {
        touch.specialPressed = true;
      } else {
        tapKey(def.key);
      }
    }, def.id === 'attack' ? () => { touch.attack = false; } : null);
    node.style.right = `calc(var(--u) * ${def.right})`;
    node.style.bottom = `calc(var(--u) * ${def.bottom})`;
  }
  // 右端・左端の小さなボタン
  for (const [side, defs] of [['right', RIGHT_BUTTONS], ['left', LEFT_BUTTONS]]) {
    const col = el('div', `row col ${side}`, root);
    for (const def of defs) {
      if (def.id === 'full' && !document.fullscreenEnabled) continue; // フルスクリーンにできない端末（iPhone など）には出さない
      button(col, def, '', () => (def.id === 'full' ? toggleFullscreen() : tapKey(def.key)));
    }
  }
  // 下（スティックの右）：消耗品（レベルアップの3択にも使える）
  const items = el('div', 'row items', root);
  for (const def of ITEM_BUTTONS) button(items, def, '', () => tapKey(def.key));
  // 縦向きのときの案内
  el('div', 'turn', root, 'スマホを横向きにしてください<br>ROTATE YOUR DEVICE');
  // 長押しのメニューや、2本指の拡大を止める
  for (const type of ['contextmenu', 'gesturestart', 'dblclick']) document.addEventListener(type, (event) => event.preventDefault());
  return root;
}
