import * as Phaser from 'phaser';
import { SCREEN } from './data/balance.js';
import { COLORS, FONTS } from './data/theme.js';
import { BattleScene } from './scenes/BattleScene.js';
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
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: SCREEN.width,
    height: SCREEN.height,
    backgroundColor: COLORS.void,
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [TitleScene, BattleScene],
  });
});
