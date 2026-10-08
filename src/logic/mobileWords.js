// モバイル版の言葉と文字の大きさ（画面には触らない。docs/詳細仕様.md「31. モバイル版」の第2段階）。
// 画面の案内は、キーボードとマウスの言葉で書いてある（「E：扉を選ぶ」「Tab：閉じる」など）。
// モバイル版では、画面に出す直前に、ボタンの名前に言い換える。元の文は書き換えない（パソコンでは、今までどおり）。

// 上から順に当てはめる。長い言い方を先に置く
const RULES = [
  [/左クリック長押し/g, '攻撃ボタンの長押し'],
  [/左クリック/g, '攻撃ボタン'],
  [/右クリック/g, '特殊ボタン'],
  [/クリック/g, 'タップ'],
  [/マウスのホイール|ホイール/g, '＋・−'],
  [/ドラッグ/g, 'なぞる'],
  [/マウスカーソル|カーソル/g, 'ねらい'],
  [/Enter：決定/g, '「決定」ボタン'],
  [/1〜\d \/ A・D/g, 'スティック左右'],
  [/A・D/g, 'スティック左右'],
  [/W・S/g, 'スティック上下'],
  [/WASD/g, 'スティック'],
  [/1・2・3 キー/g, '1・2・3 のボタン'],
  [/\bE キー/g, '「調べる」ボタン'],
  [/\bQ キー/g, '「キット」ボタン'],
  [/\bF キー/g, '「しまう」ボタン'],
  [/\bR キー/g, '「標的」ボタン'],
  [/\bM キー/g, '「地図」ボタン'],
  [/(\d) キー/g, '$1 のボタン'],
  [/\bEnter\b/g, '決定'],
  [/\bTab\b/g, 'メニュー'],
  [/\bEsc\b/g, 'メニュー'],
  [/\bShift\b/g, 'ダッシュ'],
  [/(^|[^A-Za-z])E：/g, '$1調べる：'],
  [/(^|[^A-Za-z])Q：/g, '$1キット：'],
  [/(^|[^A-Za-z])F：/g, '$1しまう：'],
  [/(^|[^A-Za-z])R：/g, '$1標的：'],
  [/(^|[^A-Za-z])M：/g, '$1地図：'],
];

// 画面の案内を、モバイル版のボタンの名前に言い換える
export function mobileWords(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  for (const [from, to] of RULES) out = out.replace(from, to);
  return out;
}

// モバイル版の文字の大きさ。小さな文字（14px まで）だけ、2px 大きくする（大きな文字は、そのまま）
export const MOBILE_FONT = { upTo: 14, add: 2 };

export function mobileFontSize(size) {
  const px = typeof size === 'number' ? size : parseFloat(size);
  if (!Number.isFinite(px)) return size;
  return px <= MOBILE_FONT.upTo ? px + MOBILE_FONT.add : px;
}
