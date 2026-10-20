// ゲームパッドで操作しているときの言葉（画面には触らない。docs/詳細仕様.md「32. ゲームパッド」）。
// 画面の案内は、キーボードとマウスの言葉で書いてある（「E：扉を選ぶ」「Tab：閉じる」など）。
// ゲームパッドで操作している間は、画面に出す直前に、ゲームパッドのボタンの名前に言い換える。元の文は書き換えない。

import { getLang } from '../i18n/translate.js';

// 上から順に当てはめる。長い言い方を先に置く
const RULES = [
  // 落ちている装備：X は、バッグに入れる（身につけるのは、ポーズ画面から）
  [/E：(付け替える|装備する)[　 ]*F：バッグに入れる/g, 'X：バッグに入れる'],
  [/クリック \/ E：次へ/g, 'A：次へ'],
  [/1 \/ 2 かクリックで選ぶ/g, '十字キー + A、または X・Y で選ぶ'],
  [/1・2・3 キー または クリック/g, '左スティックで選んで、A で決定'],
  [/引き直す（4 キー）/g, '引き直す（Y）'],
  [/下のボタンか Enter で帰還する/g, 'A で帰還する'],
  [/Enter か、もう一度クリックで取る/g, 'A で取る'],
  [/F：次の取れるマス/g, 'Y：次の取れるマス　X：絞り込み'],
  [/ホイール：拡大・縮小[　 ]*ドラッグ：動かす（拡大中）[　 ]*/g, 'RT：拡大　LT：縮小　　'],
  [/ホイール \/ W・S：スクロール/g, '左スティック：スクロール'],
  [/1〜\d \/ A・D：切り替え/g, 'LB・RB：切り替え'],
  [/1・2・3 \/ A・D：選ぶ/g, '左スティック：選ぶ'],
  [/A・D：マップ/g, '左スティック左右：マップ'],
  [/W・S：周回/g, '上下：周回'],
  // マップ選択：持ち込みは X・Y、持ち越しは LT・RT で、次のものに切り替える
  [/Q・E：1つ目　Z・C：2つ目/g, 'X：1つ目　Y：2つ目'],
  [/Q・E で切り替え/g, 'X で切り替え'],
  [/Q・E：切り替え/g, 'LT・RT：切り替え'], // 記録の中のタブ
  [/R：1つ目　F：2つ目/g, 'LT：1つ目　RT：2つ目'],
  [/R で切り替え/g, 'LT で切り替え'],
  [/（最大4枠。3・4 キーで使う）/g, '（最大4枠）'],
  [/カーソルの位置に投げ/g, '向いている先に投げ'],
  [/カーソルのあるほうを向く/g, '右スティックを倒したほうを向く'],
  [/左クリック長押し/g, 'RB 長押し'],
  [/左クリック/g, 'RB'],
  [/右クリック/g, 'LB'],
  [/W・S/g, '左スティック'],
  [/A・D/g, 'LB・RB'],
  [/WASD/g, '左スティック'],
  [/M で閉じる/g, '− で閉じる'],
  [/\bEnter\b/g, 'A'],
  [/\bTab\b/g, 'B'],
  [/\bEsc\b/g, 'B'],
  [/\bShift\b/g, 'LT'],
  [/(^|[^A-Za-z])[EF]：/g, '$1X：'],
  [/(^|[^A-Za-z])Q：/g, '$1Y：'],
  [/(^|[^A-Za-z])R：/g, '$1RT：'],
  [/(^|[^A-Za-z])M：/g, '$1−：'],
];

// 英語・韓国語の画面（訳したあとの文）。キーの名前は、アルファベットのまま書いてあるので、日本語の言い換えは使えない（2026-10-20）
//   例：「E: Swap」「Press 1 / 2 or click to choose」「Tab: Skip」
const LATIN_KEYS = [
  [/E: (?:Swap|Equip)[^\n]*?F: Put in bag/g, 'X: Put in bag'],
  [/E: [^\n]*?F: 가방에 넣기/g, 'X: 가방에 넣기'],
  [/(?:Click|클릭) \/ E:/g, 'A:'],
  [/\bEnter:/g, 'A:'],
  [/\bor Enter\b/g, 'or A'],
  [/\bTab\b/g, 'B'],
  [/\bEsc\b/g, 'B'],
  [/\bShift\b/g, 'LT'],
  [/A·D/g, 'LB·RB'],
  [/W·S/g, 'Left stick'],
  [/(^|[^A-Za-z])[EF]: /g, '$1X: '],
  [/(^|[^A-Za-z])Q: /g, '$1Y: '],
  [/(^|[^A-Za-z])R: /g, '$1RT: '],
  [/(^|[^A-Za-z])M: /g, '$1−: '],
];
const RULES_EN = [[/Press 1 \/ 2 or click to choose/g, 'D-pad + A, or X / Y, to choose'], ...LATIN_KEYS];
const RULES_KO = [[/1 \/ 2 또는 클릭으로 선택/g, '십자키 + A, 또는 X / Y로 선택'], ...LATIN_KEYS];

// 画面の案内を、ゲームパッドのボタンの名前に言い換える
export function padWords(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  const lang = getLang();
  const rules = lang === 'en' ? RULES_EN : lang === 'ko' ? RULES_KO : RULES;
  for (const [from, to] of rules) out = out.replace(from, to);
  return out;
}
