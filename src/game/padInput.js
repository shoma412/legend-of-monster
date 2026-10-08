// ゲームパッドの入力の置き場。src/gamepad/gamepad.js が書き込み、戦闘と隠れ家の画面が読む（docs/詳細仕様.md「32. ゲームパッド」）。
// ゲームパッドをつないで触るまでは active が false のままで、何も変わらない。
export const pad = {
  active: false, // ゲームパッドで操作しているか（触ると true、マウスを動かすと false）
  mx: 0, // 左スティック・十字キーの傾き（-1〜1）
  my: 0,
  ax: 0, // 右スティックの傾き
  ay: 0,
  attack: false, // RB を押している間 true
  attackPressed: false, // 押した瞬間（読んだら消える）
  specialPressed: false,
  confirmPressed: false, // リザルトで A を押した瞬間（読んだら消える）
  mode: 'select', // 今の画面（src/logic/gamepad.js の padActions の mode）
  item: 0, // 選んでいる消耗品の枠
  items: 0, // 消耗品の枠の数（戦闘の画面が書く。隠れ家では 0）
  choice: 0, // レベルアップの3択のカーソル
  options: 3,
  loot: false, // 足元に装備が落ちているか（戦闘の画面が書く）
  canReturn: false, // 「帰還する」のボタンが出ているか（戦闘の画面が書く）
};

// 押した瞬間の入力を読んで、消す
export function takePadPresses() {
  const presses = { attackPressed: pad.attackPressed, specialPressed: pad.specialPressed, confirmPressed: pad.confirmPressed };
  pad.attackPressed = false;
  pad.specialPressed = false;
  pad.confirmPressed = false;
  return presses;
}

// 右スティックを倒しているか（倒している間は、その向きを向く）
export function padAiming() {
  return pad.active && (pad.ax !== 0 || pad.ay !== 0);
}
