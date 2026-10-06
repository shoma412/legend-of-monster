// 「閉じる・戻る・取り消す」のキー。フルスクリーン中の Esc はブラウザがフルスクリーンの解除に使うので、Tab でも同じことができるようにする
export const BACK_CODES = ['Tab', 'Escape'];

export function isBackKey(code) {
  return BACK_CODES.includes(code);
}
