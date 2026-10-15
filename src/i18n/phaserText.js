// 画面に出す文字を、今の言語に訳す（docs/詳細仕様.md「38. 言語（英語・韓国語）」）。
// どの画面の文字も、Phaser の Text を通るので、そこに1か所だけ手を入れる（ゲームパッド・モバイルの言い換えより、外側）。
// 訳した文が、元の日本語の文より幅が広いときは、文字を縮めて元の幅に収める（折り返す文は、そのまま折り返す）。
import { getLang, translate } from './translate.js';

export const MIN_FIT = 0.65; // 縮める下限（元の大きさに対する割合）
export const SHORT_EM = 7.5; // 訳した文が、これだけの文字数ぶん（文字の大きさ × この値）の幅までなら、縮めない
const ratios = new Map();

const baseSizeOf = (text) => {
  text.i18nBase ??= parseFloat(text.style.fontSize) || 16;
  return text.i18nBase;
};

function setTranslated(text, inner, ja) {
  const lang = getLang();
  const out = translate(ja, lang);
  const base = baseSizeOf(text);
  const wraps = !!text.style.wordWrapWidth;
  if (lang === 'ja' || out === ja || wraps) {
    if (text.i18nScaled) {
      text.style.setFontSize(base, false);
      text.i18nScaled = false;
    }
    return inner.call(text, out);
  }
  const key = `${lang}|${base}|${text.style.fontFamily}|${text.style.fontStyle}|${text.style.letterSpacing ?? 0}|${ja}`;
  let ratio = ratios.get(key);
  if (ratio === undefined) {
    // 日本語の文の幅と、訳した文の幅を測って、割合を決める
    text.style.setFontSize(base, false);
    inner.call(text, ja);
    const before = text.width;
    inner.call(text, out);
    const after = text.width;
    // 短い日本語の語（2〜3字）は、訳すと何倍にも広がる。そのため、元の幅が狭いときも、文字の大きさ × SHORT_EM までは縮めない
    const allowed = Math.max(before, SHORT_EM * base);
    ratio = after > allowed + 2 && allowed > 0 ? Math.max(MIN_FIT, allowed / after) : 1;
    if (ratios.size > 4000) ratios.clear();
    ratios.set(key, ratio);
  }
  if (ratio < 1) {
    text.style.setFontSize(Math.max(6, Math.floor(base * ratio * 10) / 10), false);
    text.i18nScaled = true;
  } else if (text.i18nScaled) {
    text.style.setFontSize(base, false);
    text.i18nScaled = false;
  }
  return inner.call(text, out);
}

export function installTextTranslation(Phaser) {
  const proto = Phaser.GameObjects.Text.prototype;
  const inner = proto.setText;
  proto.setText = function setTextTranslated(value) {
    const ja = Array.isArray(value) ? value.join('\n') : value === null || value === undefined ? '' : String(value);
    this.i18nRaw = ja; // 元の日本語の文（言語を切り替えたとき、出し直す）
    return setTranslated(this, inner, ja);
  };
  proto.setFontSize = ((setFontSize) =>
    function setFontSizeI18n(size) {
      this.i18nBase = undefined; // 大きさを変えたら、基準も変わる
      this.i18nScaled = false;
      return setFontSize.call(this, size);
    })(proto.setFontSize);
}

// 今出ている文字を、すべて今の言語で出し直す。game は Phaser.Game
function refresh(list) {
  for (const obj of list) {
    if (obj.list) refresh(obj.list);
    else if (obj.type === 'Text' && obj.i18nRaw !== undefined) obj.setText(obj.i18nRaw);
  }
}

export function retranslateGame(game) {
  for (const scene of game.scene.getScenes(true)) refresh(scene.children.list);
}
