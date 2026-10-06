// 文字を貼り付けたり、コピーしたりするための小さな画面（引き継ぎコード用）。
// ゲームの画面（Phaser）は文字の入力欄を持たないので、ここだけブラウザの入力欄を重ねて出す。
// 開いている間は、ゲーム側のキー操作を止める（入力欄で文字を打てるように）。
import { COLORS, FONTS } from '../data/theme.js';

const css = (el, style) => Object.assign(el.style, style);

function makeButton(label, color) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  css(b, {
    font: `700 14px ${FONTS.body}`, color, background: '#110f1d', border: `1px solid ${color}`,
    padding: '9px 18px', cursor: 'pointer', minWidth: '150px',
  });
  return b;
}

// options: {
//   title, message,
//   value: 最初に入れておく文字（書き出しのコード）, readOnly: true なら書き換えられない,
//   placeholder,
//   buttons: [{ label, color, run: (text, dialog) => void }]   押したときに呼ぶ。閉じるかどうかは run が決める
//   onClose: () => void
// }
// 返り値：{ close(), setMessage(text, color), text() }
export function openTextDialog(scene, options) {
  const parent = document.getElementById('game') ?? document.body;
  const manager = scene.input.keyboard.manager;
  const wasEnabled = manager.enabled;
  manager.enabled = false;

  const cover = document.createElement('div');
  css(cover, {
    position: 'fixed', inset: '0', background: 'rgba(7, 6, 13, 0.88)', zIndex: '50',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  const box = document.createElement('div');
  css(box, {
    width: 'min(620px, 90vw)', background: '#110f1d', border: `1px solid ${COLORS.cyan}`, padding: '20px 22px',
    font: `14px ${FONTS.body}`, color: COLORS.ink, boxSizing: 'border-box',
  });
  const title = document.createElement('div');
  title.textContent = options.title;
  css(title, { font: `700 20px ${FONTS.body}`, color: COLORS.cyan, marginBottom: '10px' });
  const message = document.createElement('div');
  css(message, { whiteSpace: 'pre-wrap', lineHeight: '1.7', marginBottom: '12px', color: COLORS.ink });
  const area = document.createElement('textarea');
  area.value = options.value ?? '';
  area.readOnly = !!options.readOnly;
  area.placeholder = options.placeholder ?? '';
  area.spellcheck = false;
  css(area, {
    width: '100%', height: '120px', boxSizing: 'border-box', resize: 'none', background: '#07060d', color: COLORS.ink,
    border: `1px solid ${COLORS.line}`, padding: '8px', font: '12px monospace', wordBreak: 'break-all',
  });
  const row = document.createElement('div');
  css(row, { display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' });

  const dialog = {
    close() {
      cover.remove();
      manager.enabled = wasEnabled;
      options.onClose?.();
    },
    setMessage(text, color = COLORS.ink) {
      message.textContent = text;
      message.style.color = color;
    },
    text: () => area.value,
    select() {
      area.focus();
      area.select();
    },
  };
  dialog.setMessage(options.message ?? '');
  for (const def of options.buttons) {
    const b = makeButton(def.label, def.color ?? COLORS.ink);
    b.addEventListener('click', () => def.run(area.value, dialog));
    row.appendChild(b);
  }
  // 入力欄の外でキーを押しても、ゲームに届かないようにする。Esc では閉じる
  cover.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') dialog.close();
  });
  box.append(title, message, area, row);
  cover.appendChild(box);
  parent.appendChild(cover);
  if (options.readOnly) dialog.select();
  else area.focus();
  return dialog;
}

// 文字列をクリップボードに入れる。できたら true
export async function copyText(text, dialog) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 埋め込まれた画面などで使えないときは、入力欄を選んだ状態にして、古いやり方で試す
    try {
      dialog?.select();
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}
