import * as Phaser from 'phaser';
import { playBgm, playSe, unlockAudio } from '../audio/audio.js';
import { SCREEN } from '../data/balance.js';
import { COLORS, FONTS, hex } from '../data/theme.js';
import { setupView } from '../render/view.js';

// タイトル画面。何かキーを押すと、セーブ枠の選択へ。
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width: W, height: H } = SCREEN;
    setupView(this);
    this.drawBackdrop(W, H);

    const titleStyle = { fontFamily: FONTS.display, fontStyle: '700', fontSize: '64px' };
    const legend = this.add.text(0, 0, 'LEGEND OF ', { ...titleStyle, color: COLORS.cyan })
      .setShadow(0, 0, COLORS.cyan, 18, false, true);
    const monster = this.add.text(0, 0, 'MONSTER', { ...titleStyle, color: COLORS.magenta })
      .setShadow(0, 0, COLORS.magenta, 18, false, true);
    const left = (W - legend.width - monster.width) / 2;
    legend.setPosition(left, H * 0.3);
    monster.setPosition(left + legend.width, H * 0.3);

    this.add.text(W / 2, H * 0.3 + 92, 'CYBERPUNK HACK & SLASH ROGUELITE', {
      fontFamily: FONTS.display, fontStyle: '500', fontSize: '15px', color: COLORS.dim,
    }).setOrigin(0.5).setLetterSpacing(4);

    // 公開版（体験版）だけに出す表示。開発中の画面には出ない
    if (!import.meta.env.DEV) {
      this.add.text(W / 2, H * 0.3 + 128, '― 体験版 ―', {
        fontFamily: FONTS.body, fontSize: '20px', color: COLORS.amber,
      }).setOrigin(0.5).setShadow(0, 0, COLORS.amber, 8, false, true);
    }

    const prompt = this.add.text(W / 2, H * 0.68, 'PRESS ANY KEY', {
      fontFamily: FONTS.display, fontStyle: '700', fontSize: '22px', color: COLORS.amber,
    }).setOrigin(0.5).setShadow(0, 0, COLORS.amber, 10, false, true);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(W - 16, H - 14, `v${__APP_VERSION__} `, {
      fontFamily: FONTS.display, fontStyle: '500', fontSize: '12px', color: COLORS.dim,
    }).setOrigin(1, 1);
    // BGM の出典（魔王魂の利用条件で、表記が必要）
    this.add.text(16, H - 14, '音楽：魔王魂', {
      fontFamily: FONTS.body, fontSize: '12px', color: COLORS.dim,
    }).setOrigin(0, 1);

    // どのキーでも、クリックでも始まる
    unlockAudio(this);
    playBgm('title');
    const start = () => {
      playSe('confirm');
      this.scene.start('SaveSelect');
    };
    this.input.keyboard.once('keydown', start);
    this.input.once('pointerdown', start);
  }

  drawBackdrop(W, H) {
    const g = this.add.graphics();
    g.lineStyle(1, hex(COLORS.line), 0.55);
    for (let x = 0; x <= W; x += 48) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 48) g.lineBetween(0, y, W, y);

    // 画面の縁取り（ネオン線画）
    g.lineStyle(2, hex(COLORS.cyan), 0.8);
    g.strokeRect(14, 14, W - 28, H - 28);
    g.lineStyle(2, hex(COLORS.magenta), 0.8);
    g.lineBetween(14, H * 0.3 + 124, W * 0.32, H * 0.3 + 124);
    g.lineBetween(W * 0.68, H * 0.3 + 124, W - 14, H * 0.3 + 124);
  }
}
