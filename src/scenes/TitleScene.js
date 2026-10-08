import { setTouchMode } from '../game/touchInput.js';
import * as Phaser from 'phaser';
import { playBgm, playSe, unlockAudio } from '../audio/audio.js';
import { SCREEN } from '../data/balance.js';
import { COLORS, FONTS, hex } from '../data/theme.js';
import { setupView } from '../render/view.js';
import { MenuOverlay } from './menuOverlay.js';

// タイトル画面。メニュー（はじめる／設定／クレジット）から、セーブ枠の選択か、設定・クレジットの画面へ。
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    setTouchMode('select');
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

    // メニュー：W・S か ↑・↓ で選び、Enter・Space・クリックで決定
    this.cursor = 0;
    this.items = [
      { label: 'はじめる', run: () => this.scene.start('SaveSelect') },
      { label: '設定', run: () => this.menu.open('settings') },
      { label: 'クレジット', run: () => this.menu.open('credits') },
    ];
    this.itemTexts = this.items.map((item, i) => {
      const t = this.add.text(W / 2, H * 0.62 + i * 38, item.label, { fontFamily: FONTS.body, fontStyle: '700', fontSize: '22px', color: COLORS.dim }).setOrigin(0.5);
      t.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', () => {
          this.select(i);
          this.decide();
        });
      return t;
    });
    this.add.text(W / 2, H - 40, 'W・S：選ぶ　Enter：決定', { fontFamily: FONTS.body, fontSize: '12px', color: COLORS.dim }).setOrigin(0.5);
    this.refresh();

    // 設定とクレジットは、ポーズ画面と同じ作りの画面で出す（ここからは Tab・Esc では開かない）
    this.menu = new MenuOverlay(this, {
      title: 'LEGEND OF MONSTER',
      tabs: ['settings', 'credits'],
      context: () => ({}),
      canOpen: () => false,
      actions: [{ label: '閉じる（Tab）', run: () => this.menu.close() }],
    });

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
    this.input.keyboard.on('keydown', (event) => {
      if (event.repeat || this.menu.isOpen) return;
      const code = event.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.select((this.cursor + this.items.length - 1) % this.items.length);
      else if (code === 'KeyS' || code === 'ArrowDown') this.select((this.cursor + 1) % this.items.length);
      else if (code === 'Enter' || code === 'Space' || code === 'KeyE') this.decide();
    });
  }

  select(index) {
    if (this.menu?.isOpen || index === this.cursor) return;
    this.cursor = index;
    playSe('select');
    this.refresh();
  }

  decide() {
    if (this.menu.isOpen) return;
    playSe('confirm');
    this.items[this.cursor].run();
  }

  refresh() {
    this.itemTexts.forEach((t, i) => {
      const on = i === this.cursor;
      t.setText(on ? `▶ ${this.items[i].label} ◀` : this.items[i].label).setColor(on ? COLORS.amber : COLORS.dim);
      if (on) t.setShadow(0, 0, COLORS.amber, 10, false, true);
      else t.setShadow(0, 0, COLORS.amber, 0, false, false);
    });
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
