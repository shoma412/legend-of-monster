// モバイル版の入力の置き場。画面のスティックとボタン（src/mobile/touchControls.js）が書き込み、戦闘と隠れ家の画面が読む。
// パソコンでは enabled が false のままで、何も変わらない。
export const touch = {
  enabled: false, // モバイル版か（スマホ・タブレットで開いたときだけ true）
  mx: 0, // スティックの傾き（-1〜1）
  my: 0,
  attack: false, // 攻撃ボタンを押している間 true
  attackPressed: false, // 攻撃ボタンを押した瞬間（読んだら消える）
  specialPressed: false, // 特殊ボタンを押した瞬間（読んだら消える）
  mode: 'menu', // 今の画面。play（動き回る画面）/ menu（タイトル・セーブ枠・メニューなど）。menu の間は、戦闘用のボタンを隠す
  onMode: null, // mode が変わったときに呼ぶ（ボタンを出し入れする）
};

// 今の画面が、動き回る画面（play）か、メニューの画面（menu）かを伝える。各画面が呼ぶ。パソコンでは何もしない
export function setTouchMode(mode) {
  if (!touch.enabled || touch.mode === mode) return;
  touch.mode = mode;
  touch.onMode?.(mode);
}

// 押した瞬間の入力を読んで、消す
export function takeTouchPresses() {
  const presses = { attackPressed: touch.attackPressed, specialPressed: touch.specialPressed };
  touch.attackPressed = false;
  touch.specialPressed = false;
  return presses;
}
