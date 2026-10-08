// スマホ・タブレットで開いているかの見分けと、画面のスティックの計算（画面には触らない。docs/詳細仕様.md「31. モバイル版」）。

// スマホ・タブレットか。指で触る画面（touchPoints が 1 以上）で、主な入力が指（coarse）か、スマホ・タブレットの名乗り（userAgent）のとき。
//   タッチ画面つきのノートパソコンは、主な入力がマウスなので、パソコンとして扱う。
//   アドレスの末尾に ?mobile=1 を付けると、パソコンでもモバイル版になる（確認用）。?mobile=0 で、スマホでもパソコン版になる
export function detectMobile({ search = '', touchPoints = 0, coarse = false, userAgent = '' } = {}) {
  const forced = new URLSearchParams(search).get('mobile');
  if (forced === '1') return true;
  if (forced === '0') return false;
  return touchPoints > 0 && (coarse || /Android|iPhone|iPad|iPod/i.test(userAgent));
}

export const STICK = {
  dead: 0.22, // これより小さい傾きは、0 として扱う（指のぶれで動かないように）
  tap: 0.6, // これより大きく倒したら、その向きのキーを1回押したことにする（メニューの上下左右）
};

// スティックの傾き。(dx, dy) は、スティックの中心から指までの距離（px）、radius は、いちばん倒したときの距離。
//   返り値は { x, y }（長さ 0〜1）。倒し方が小さければ { 0, 0 }
export function stickVector(dx, dy, radius) {
  const len = Math.hypot(dx, dy);
  const k = Math.min(1, len / radius);
  if (len === 0 || k < STICK.dead) return { x: 0, y: 0 };
  return { x: (dx / len) * k, y: (dy / len) * k };
}

// スティックを大きく倒している向き（'up' / 'down' / 'left' / 'right'）。倒していなければ null。斜めは、大きいほうの向き
export function stickDirection(v) {
  if (Math.hypot(v.x, v.y) < STICK.tap) return null;
  if (Math.abs(v.x) > Math.abs(v.y)) return v.x > 0 ? 'right' : 'left';
  return v.y > 0 ? 'down' : 'up';
}
