import * as Phaser from 'phaser';
import { playBgm, playSe, unlockAudio } from '../audio/audio.js';
import { SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, FONTS, hex } from '../data/theme.js';
import { isBackKey } from '../logic/keys.js';
import { bestReachText } from '../logic/maps.js';
import { eraseSlot, getSlots, selectSlot, suspendText, takeSuspendedRun } from '../game/saveStore.js';
import { setupView } from '../render/view.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL = 0x110f1d;
const CARD_W = 270;
const CARD_H = 300;
const CARD_GAP = 24;

// セーブ枠の選択。タイトルのあとに出る。枠は3つで、保存は遊んでいる間ずっと自動。
export class SaveSelectScene extends Phaser.Scene {
  constructor() {
    super('SaveSelect');
  }

  create() {
    setupView(this);
    this.cameras.main.fadeIn(200, 7, 6, 13);
    unlockAudio(this);
    playBgm('title');
    this.cursor = 0;
    this.confirmDelete = null; // 消す確認を出している枠（1〜3）

    const g = this.add.graphics();
    g.lineStyle(1, hex(COLORS.line), 0.45);
    for (let x = 0; x <= W; x += 48) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 48) g.lineBetween(0, y, W, y);
    g.lineStyle(2, hex(COLORS.cyan), 0.8).strokeRect(14, 14, W - 28, H - 28);

    this.add.text(W / 2, 56, 'SAVE DATA', { fontFamily: FONTS.display, fontStyle: '700', fontSize: '32px', color: COLORS.cyan })
      .setOrigin(0.5).setShadow(0, 0, COLORS.cyan, 14, false, true);
    this.add.text(W / 2, 92, 'セーブデータを選ぶ。進行状況は、遊んでいる間ずっと自動で保存される', { fontFamily: FONTS.body, fontSize: '13px', color: COLORS.dim }).setOrigin(0.5);
    this.add.text(W / 2, H - 30, '1・2・3 / A・D：選ぶ　Enter：決定　Tab：タイトルへ', { fontFamily: FONTS.body, fontSize: '12px', color: COLORS.dim }).setOrigin(0.5);

    this.root = this.add.container(0, 0);
    this.input.keyboard.addCapture('TAB');
    this.input.keyboard.on('keydown', (event) => this.onKey(event));
    this.render();
  }

  onKey(event) {
    if (event.repeat) return;
    const code = event.code;
    if (this.confirmDelete) {
      if (code === 'Enter') this.erase(this.confirmDelete);
      else if (isBackKey(code)) this.cancelDelete();
      return;
    }
    const digit = /^Digit([1-3])$/.exec(code);
    if (digit) this.move(Number(digit[1]) - 1 - this.cursor);
    else if (code === 'KeyA' || code === 'ArrowLeft') this.move(-1);
    else if (code === 'KeyD' || code === 'ArrowRight') this.move(1);
    else if (code === 'Enter' || code === 'KeyE') this.start(this.cursor + 1);
    else if (isBackKey(code)) this.scene.start('Title');
  }

  move(delta) {
    this.cursor = (this.cursor + delta + 3) % 3;
    playSe('select');
    this.render();
  }

  start(slot) {
    playSe('confirm');
    selectSlot(slot);
    // 中断データがあれば、隠れ家ではなく、中断した部屋から再開する（取り出した時点で中断データは消える）
    const run = takeSuspendedRun();
    if (run) this.scene.start('Battle', { run });
    else this.scene.start('Hideout');
  }

  erase(slot) {
    eraseSlot(slot);
    this.confirmDelete = null;
    playSe('deny');
    this.render();
  }

  cancelDelete() {
    this.confirmDelete = null;
    this.render();
  }

  text(x, y, str, size, color, extra = {}) {
    const t = this.add.text(x, y, str, { fontFamily: FONTS.body, fontSize: `${size}px`, color, ...extra });
    this.root.add(t);
    return t;
  }

  button(x, y, w, h, label, color, onClick) {
    const r = this.add.rectangle(x, y, w, h, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, hex(color));
    r.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.root.add(r);
    this.text(x + w / 2, y + h / 2, label, 13, color, { fontStyle: '700' }).setOrigin(0.5);
  }

  render() {
    this.root.removeAll(true);
    const slots = getSlots();
    const g = this.add.graphics();
    this.root.add(g);
    const left = (W - CARD_W * 3 - CARD_GAP * 2) / 2;

    slots.forEach((save, i) => {
      const slot = i + 1;
      const x = left + i * (CARD_W + CARD_GAP);
      const y = 124;
      const on = i === this.cursor;
      const card = this.add.rectangle(x, y, CARD_W, CARD_H, on ? 0x1b1631 : PANEL, 0.95).setOrigin(0).setStrokeStyle(on ? 2 : 1, hex(on ? COLORS.cyan : COLORS.line));
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.confirmDelete) return;
        if (this.cursor !== i) this.move(i - this.cursor);
      });
      this.root.addAt(card, 0);
      this.text(x + 18, y + 14, `DATA ${slot}`, 20, on ? COLORS.cyan : COLORS.dim, { fontFamily: FONTS.display, fontStyle: '700' });

      if (!save) {
        this.text(x + CARD_W / 2, y + 120, 'データなし', 15, '#4a4470', { fontStyle: '700' }).setOrigin(0.5);
        this.button(x + 18, y + CARD_H - 54, CARD_W - 36, 36, 'はじめから', COLORS.green, () => this.start(slot));
        return;
      }

      const r = save.records;
      const best = bestReachText(save, (id) => DATA.areas.get(id));
      const rows = [
        ['出撃', `${r.runs} 回`],
        ['クリア', `${r.clears} 回`],
        ['最高到達', best],
        ['実績', `${save.achievements.length} / ${DATA.achievements.all().length}`],
        ['データ片', `${save.fragments.length} / ${DATA.fragments.all().length}`],
      ];
      rows.forEach(([label, value], k) => {
        this.text(x + 18, y + 52 + k * 24, label, 13, COLORS.dim);
        this.text(x + CARD_W - 18, y + 52 + k * 24, value, 13, COLORS.ink, { fontStyle: '700' }).setOrigin(1, 0);
      });
      // 持っているボス素材（種類が増えていくので、数だけ出す）
      const counts = Object.values(save.materials).filter((n) => n > 0);
      this.text(x + 18, y + 52 + rows.length * 24, 'ボス素材', 13, COLORS.dim);
      this.text(x + CARD_W - 18, y + 52 + rows.length * 24, counts.length > 0 ? `${counts.length} 種類・${counts.reduce((a, b) => a + b, 0)} 個` : 'なし', 13, COLORS.ink, { fontStyle: '700' }).setOrigin(1, 0);
      // 中断中のランがあれば、その場所を出す
      const suspended = suspendText(slot);
      if (suspended) {
        this.text(x + 18, y + CARD_H - 104, '中断中', 12, COLORS.amber, { fontStyle: '700' });
        this.text(x + 18, y + CARD_H - 88, suspended, 12, COLORS.amber, { wordWrap: { width: CARD_W - 36, useAdvancedWrap: true } });
      }
      this.button(x + 18, y + CARD_H - 54, CARD_W - 110, 36, suspended ? '再開する' : 'つづきから', COLORS.green, () => this.start(slot));
      this.button(x + CARD_W - 82, y + CARD_H - 54, 64, 36, '消す', COLORS.dim, () => {
        this.confirmDelete = slot;
        this.render();
      });
    });

    if (this.confirmDelete) this.renderConfirm();
  }

  // セーブデータを消す前の確認
  renderConfirm() {
    const cover = this.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.82).setInteractive();
    const box = this.add.rectangle(W / 2 - 260, H / 2 - 86, 520, 172, PANEL, 0.98).setOrigin(0).setStrokeStyle(1, hex(COLORS.red));
    this.root.add([cover, box]);
    this.text(W / 2, H / 2 - 38, `DATA ${this.confirmDelete} を消します。\n恒久強化・実績・データ片など、すべて元に戻せません。よろしいですか？`, 14, COLORS.ink, { fontStyle: '700', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    this.button(W / 2 - 190, H / 2 + 28, 170, 36, '消す（Enter）', COLORS.red, () => this.erase(this.confirmDelete));
    this.button(W / 2 + 20, H / 2 + 28, 170, 36, 'やめる（Tab）', COLORS.ink, () => this.cancelDelete());
  }
}
