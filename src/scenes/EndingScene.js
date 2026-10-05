import * as Phaser from 'phaser';
import { playBgm, unlockAudio } from '../audio/audio.js';
import { SCREEN } from '../data/balance.js';
import { ending } from '../data/story.js';
import { COLORS, FONTS, hex } from '../data/theme.js';
import { resolveNames } from '../logic/dialogue.js';
import { setupView } from '../render/view.js';

const LINE_INTERVAL = 900; // 1行ずつ出す間隔（ミリ秒）

// エンディング。最後のボスを初めて倒したときに出す。文章は src/data/story.js の ending。
//   lines: このランのリザルト（到達、撃破数、持ち帰ったもの）
export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  init(data) {
    this.resultLines = data?.lines ?? [];
  }

  create() {
    const { width: W, height: H } = SCREEN;
    setupView(this);
    this.cameras.main.fadeIn(600, 7, 6, 13);
    unlockAudio(this);
    playBgm('ending');
    const g = this.add.graphics();
    g.lineStyle(1, hex(COLORS.line), 0.4);
    for (let x = 0; x <= W; x += 48) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 48) g.lineBetween(0, y, W, y);
    g.lineStyle(2, hex(COLORS.amber), 0.8).strokeRect(14, 14, W - 28, H - 28);

    this.add.text(W / 2, 62, ending.title, { fontFamily: FONTS.display, fontStyle: '700', fontSize: '34px', color: COLORS.amber })
      .setOrigin(0.5).setShadow(0, 0, COLORS.amber, 16, false, true);

    // 物語の行を、上から1行ずつ出す
    const body = { fontFamily: FONTS.body, fontSize: '16px', color: COLORS.ink };
    let y = 118;
    const texts = resolveNames(ending.lines).map((line) => {
      const t = this.add.text(W / 2, y, line, body).setOrigin(0.5, 0).setAlpha(0);
      y += line === '' ? 14 : 28;
      return t;
    });
    texts.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, duration: 600, delay: 400 + i * LINE_INTERVAL }));
    const storyDone = 400 + texts.length * LINE_INTERVAL;

    // そのあとに、このランのリザルト
    const result = this.add.text(W / 2, y + 16, this.resultLines.filter((l) => l !== '').join('\n'), {
      fontFamily: FONTS.body, fontSize: '13px', color: COLORS.dim, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0).setAlpha(0);
    this.tweens.add({ targets: result, alpha: 1, duration: 600, delay: storyDone });

    const thanks = this.add.text(W / 2, H - 78, 'THANK YOU FOR PLAYING', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '22px', color: COLORS.cyan })
      .setOrigin(0.5).setShadow(0, 0, COLORS.cyan, 12, false, true).setAlpha(0);
    // 隠れ家に戻るボタン（クリック。Enter でも進める）
    const prompt = this.add.text(W / 2, H - 44, '［ 隠れ家に戻る ］', { fontFamily: FONTS.body, fontStyle: '700', fontSize: '16px', color: COLORS.amber }).setOrigin(0.5).setAlpha(0);
    prompt.setInteractive({ useHandCursor: true }).on('pointerdown', () => prompt.alpha > 0.9 && this.scene.start('Hideout'));
    this.tweens.add({ targets: [thanks, prompt], alpha: 1, duration: 600, delay: storyDone + 700 });

    // 文章が出きる前でも、Enter を2回押せば先へ進める（1回目で全部表示）
    let skipped = false;
    this.input.keyboard.on('keydown-ENTER', () => {
      if (!skipped && this.time.now < storyDone + 700) {
        skipped = true;
        this.tweens.killAll();
        [...texts, result, thanks, prompt].forEach((t) => t.setAlpha(1));
        return;
      }
      this.scene.start('Hideout');
    });
  }
}
