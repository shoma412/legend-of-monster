// モバイル版：画面に出す文字を、まとめて直す（言葉をボタンの名前に、小さな文字を少し大きく）。
// どの画面の文字も、Phaser の Text を通るので、そこに1か所だけ手を入れる。スマホ・タブレットで開いたときだけ呼ぶ。
import { mobileFontSize, mobileWords } from '../logic/mobileWords.js';

export function installMobileText(Phaser) {
  const proto = Phaser.GameObjects.Text.prototype;
  // 言葉：画面に出す直前に、言い換える（何行かに分かれた文も）
  const setText = proto.setText;
  proto.setText = function setTextMobile(value) {
    return setText.call(this, Array.isArray(value) ? value.map(mobileWords) : mobileWords(value));
  };
  // 大きさ：あとから大きさを変える文字（ダメージの数字など）
  const setFontSize = proto.setFontSize;
  proto.setFontSize = function setFontSizeMobile(size) {
    return setFontSize.call(this, mobileFontSize(size));
  };
  // 大きさ：作るときに決まる文字
  const factory = Phaser.GameObjects.GameObjectFactory.prototype;
  const makeText = factory.text;
  factory.text = function textMobile(x, y, text, style, ...rest) {
    // style に fixedSize: true と書いた文字は、大きくしない（戦闘画面の上の帯など、場所が詰まっている所）
    const size = style?.fixedSize ? null : style?.fontSize;
    const bumped = size != null ? { ...style, fontSize: `${mobileFontSize(size)}px` } : style;
    return makeText.call(this, x, y, text, bumped, ...rest);
  };
}
