import * as Phaser from 'phaser';
import { SCREEN } from './data/balance.js';
import { COLORS, FONTS } from './data/theme.js';
import { applyDisplaySize, getSettings, syncEscapeLock } from './game/settingsStore.js';
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
  // 表示の大きさ（設定）。フルスクリーンに出入りしたときも合わせ直す
  applyDisplaySize(game);
  document.addEventListener('fullscreenchange', () => {
    applyDisplaySize(game);
    syncEscapeLock();
  });
});
