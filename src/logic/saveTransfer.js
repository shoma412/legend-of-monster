// セーブデータの書き出し／読み込み（引き継ぎコード）。
// 公開先を変えたときや、別のブラウザ・別のパソコンへ、隠れ家の進行状況を持っていくために使う。
import { SAVE_VERSION, normalizeSave } from './save.js';

// コードの頭に付ける目印。形を変えたら数字を上げる
export const CODE_PREFIX = 'LOM1:';

// 日本語を含む文字列を、コードに使える文字だけにする（Base64）
function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decode(code) {
  const binary = atob(code);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// セーブデータを引き継ぎコードにする
export function exportSaveText(save) {
  return CODE_PREFIX + encode(JSON.stringify(save));
}

// 貼り付けられた文字列からセーブデータを作る。
//   返り値：{ ok: true, save } か { ok: false, reason }
//   引き継ぎコードのほか、ブラウザから直接取り出したセーブデータの文字列（{"version":… で始まるもの）も読める
export function importSaveText(text) {
  let raw = String(text ?? '').trim();
  if (!raw) return { ok: false, reason: 'コードが入っていません。' };
  // コピーのしかたによっては、前後に引用符が付く
  if (/^(".*"|'.*')$/s.test(raw) && !raw.startsWith('"{')) raw = raw.slice(1, -1).trim();
  let data;
  try {
    if (raw.startsWith(CODE_PREFIX)) raw = decode(raw.slice(CODE_PREFIX.length).replace(/\s+/g, ''));
    data = JSON.parse(raw);
    // 文字列として二重に包まれている場合（"{\"version\":…}"）
    if (typeof data === 'string') data = JSON.parse(data);
  } catch {
    return { ok: false, reason: 'コードを読めませんでした。途中で切れていないか、全部コピーできているか確かめてください。' };
  }
  if (!data || typeof data !== 'object' || typeof data.version !== 'number') {
    return { ok: false, reason: 'セーブデータのコードではないようです。' };
  }
  if (data.version > SAVE_VERSION) {
    return { ok: false, reason: 'このゲームより新しい版のデータです。ゲームを最新にしてから読み込んでください。' };
  }
  const save = normalizeSave(data);
  if (!save) return { ok: false, reason: 'セーブデータとして読めませんでした。' };
  return { ok: true, save };
}
