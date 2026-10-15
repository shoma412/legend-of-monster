import { afterEach, describe, expect, it } from 'vitest';
import { installTextTranslation, retranslateGame } from '../src/i18n/phaserText.js';
import { setLang } from '../src/i18n/translate.js';

// 文字の訳を、Phaser の Text に入れる仕組み（画面は使わず、Text の動きだけをまねた偽物で確かめる）

afterEach(() => setLang('ja'));

// Phaser の Text のまね：作るとき最初は _text が無い。大きさを変えると、描き直し（updateText）が走る（そこで _text を読む）
function makeFakePhaser() {
  class Text {
    constructor(text, fontSize = 16, wordWrapWidth = 0) {
      this.type = 'Text';
      this.width = 0;
      const self = this;
      this.style = {
        fontSize: `${fontSize}px`,
        fontFamily: 'x',
        fontStyle: '',
        wordWrapWidth,
        setFontSize(size) {
          this.fontSize = `${size}px`;
          self.updateText();
        },
      };
      this.setText(text);
    }
    setText(value) {
      this._text = String(value);
      this.updateText();
      return this;
    }
    updateText() {
      const lines = this._text.split('\n'); // _text が無いと、ここで落ちる
      const size = parseFloat(this.style.fontSize);
      this.width = Math.max(...lines.map((l) => [...l].length)) * size; // 1文字 = 文字の大きさ
    }
    setFontSize(size) {
      this.style.setFontSize(size);
      return this;
    }
  }
  return { GameObjects: { Text } };
}

describe('Text への訳の取り付け', () => {
  it('作っている途中の Text でも落ちない。訳した文が日本語より広いとき、文字を縮めて収める', () => {
    const Phaser = makeFakePhaser();
    installTextTranslation(Phaser);
    setLang('en');
    const t = new Phaser.GameObjects.Text('はじめる', 22);
    expect(t._text).toBe('Start');
    // 日本語（4字）の幅以内か、短い語の許容（文字の大きさ × 7.5）以内に収まる
    expect(t.width).toBeLessThanOrEqual(Math.max(4 * 22, 7.5 * 22) + 1);
    // 長い文は、元の幅に収めるように縮む（下限 65%）
    const long = new Phaser.GameObjects.Text('再開する（Tab）', 14);
    expect(long.width).toBeGreaterThan(0);
    expect(parseFloat(long.style.fontSize)).toBeGreaterThanOrEqual(14 * 0.65 - 0.2);
  });

  it('日本語に戻すと、元の大きさに戻る。切り替えで、出ている文字が出し直される', () => {
    const Phaser = makeFakePhaser();
    installTextTranslation(Phaser);
    setLang('en');
    const t = new Phaser.GameObjects.Text('設定を、あとで、ぜんぶ見直す大事な文', 16); // 訳が無い文は、そのまま
    expect(t._text).toBe('設定を、あとで、ぜんぶ見直す大事な文');
    const label = new Phaser.GameObjects.Text('はじめる', 22);
    const game = { scene: { getScenes: () => [{ children: { list: [label] } }] } };
    setLang('ko');
    retranslateGame(game);
    expect(label._text).toBe('시작');
    setLang('ja');
    retranslateGame(game);
    expect(label._text).toBe('はじめる');
    expect(parseFloat(label.style.fontSize)).toBe(22);
  });
});
