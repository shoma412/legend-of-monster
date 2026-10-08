// モバイル版の入力の置き場。画面のスティックとボタン（src/mobile/touchControls.js）が書き込み、戦闘と隠れ家の画面が読む。
// パソコンでは enabled が false のままで、何も変わらない。
export const touch = {
  enabled: false, // モバイル版か（スマホ・タブレットで開いたときだけ true）
  mx: 0, // スティックの傾き（-1〜1）
  my: 0,
  attack: false, // 攻撃ボタンを押している間 true
  attackPressed: false, // 攻撃ボタンを押した瞬間（読んだら消える）
  specialPressed: false, // 特殊ボタンを押した瞬間（読んだら消える）
};

// 押した瞬間の入力を読んで、消す
export function takeTouchPresses() {
  const presses = { attackPressed: touch.attackPressed, specialPressed: touch.specialPressed };
  touch.attackPressed = false;
  touch.specialPressed = false;
  return presses;
}
