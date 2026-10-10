import * as Phaser from 'phaser';
import { SCREEN } from './data/balance.js';
import { COLORS, FONTS } from './data/theme.js';
import { applyDisplaySize, getSettings, syncEscapeLock } from './game/settingsStore.js';
import { detectMobile } from './logic/device.js';
import { touch } from './game/touchInput.js';
import { installMobileText } from './mobile/mobileText.js';
import { initTouchControls } from './mobile/touchControls.js';
import { initGamepad } from './gamepad/gamepad.js';
import { installPadText, watchPadText } from './gamepad/padText.js';
import { installCursor } from './render/cursor.js';
import { setRenderScale } from './render/view.js';
import { BattleScene } from './scenes/BattleScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { HideoutScene } from './scenes/HideoutScene.js';
import { SaveSelectScene } from './scenes/SaveSelectScene.js';
import { TitleScene } from './scenes/TitleScene.js';

// Webフォントの読み込みを待ってから起動する（待たないと最初の文字が代替フォントで描かれる）。
// 読み込めなくても遊べるように、失敗や時間切れでもそのまま進む。
async function loadFonts() {
  if (!document.fonts) return;
  const wanted = [`700 32px ${FONTS.display}`, `400 16px ${FONTS.body}`];
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  await Promise.race([
    Promise.all(wanted.map((f) => document.fonts.load(f, 'Legend 出撃'))).catch(() => {}),
    timeout,
  ]);
}

loadFonts().then(() => {
  // モバイル版：スマホ・タブレットで開いたときだけ。設定を読む前に決める（画質の初期値が変わるため）。パソコンでは、何も変わらない
  const mobile = detectMobile({
    search: window.location.search,
    touchPoints: navigator.maxTouchPoints ?? 0,
    coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    userAgent: navigator.userAgent,
  });
  touch.enabled = mobile;
  // ゲームパッド：つないで触ったときだけ働く
  initGamepad();
  installPadText(Phaser);
  // 画面の案内をボタンの名前に言い換え、小さな文字を少し大きくする
  if (mobile) installMobileText(Phaser);
  // パソコン：ゲームの画面の上では、マウスカーソルを、見やすい照準の形にする
  else installCursor();
  // 画質：ゲームの中の座標は 960×540 のまま、描く先のキャンバスだけを倍の細かさで作る（src/render/view.js）
  const quality = getSettings().quality;
  setRenderScale(quality);
  if (quality !== 1) {
    // 文字も同じ細かさで描く（そうしないと、文字だけぼやける）
    const factory = Phaser.GameObjects.GameObjectFactory.prototype;
    const makeText = factory.text;
    factory.text = function text(...args) {
      return makeText.apply(this, args).setResolution(quality);
    };
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: SCREEN.width * quality,
    height: SCREEN.height * quality,
    backgroundColor: COLORS.void,
    banner: false,
    fps: { limit: getSettings().frameRate }, // フレームレートの上限（設定。0 は制限なし）
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [TitleScene, SaveSelectScene, HideoutScene, BattleScene, EndingScene],
  });
  watchPadText(game);
  // モバイル版：画面にスティックとボタンを出す
  if (mobile) initTouchControls(document.getElementById('game'));
  // 表示の大きさ（設定）。フルスクリーンに出入りしたときも合わせ直す
  applyDisplaySize(game);
  document.addEventListener('fullscreenchange', () => {
    applyDisplaySize(game);
    syncEscapeLock();
  });
});
