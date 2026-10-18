// 言語の切り替えと、文の翻訳（docs/詳細仕様.md「38. 言語（英語・韓国語）」）。画面には依存しない。
// 日本語の文は、コードとデータに書いたまま。英語・韓国語は、src/data/i18n/ の対応表（「日本語の文 → 訳」）で引く。
// 対応表に無い文は、日本語のまま出る。
import { en } from '../data/i18n/en.js';
import { ko } from '../data/i18n/ko.js';
import { isKanaWord, romanizeKana } from './kana.js';

export const LANGS = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
  { id: 'ko', label: '한국어' },
];

const DICTS = { en, ko };
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;
const CACHE_LIMIT = 4000;

// ブラウザの言語の並び（navigator.languages）から、最初のゲームの言語を決める。ja → 日本語、ko → 韓国語、それ以外 → English
export function detectLang(list = []) {
  for (const item of list) {
    const code = String(item ?? '').toLowerCase();
    if (code.startsWith('ja')) return 'ja';
    if (code.startsWith('ko')) return 'ko';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

export const isLang = (id) => LANGS.some((l) => l.id === id);

let current = 'ja';
export const getLang = () => current;
const listeners = new Set();
// 言語が切り替わったときに呼ぶ関数を登録する（HTML の部品など、Phaser の文字ではないものを、出し直すため）
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLang(id) {
  current = isLang(id) ? id : 'ja';
  caches.clear();
  for (const fn of listeners) fn(current);
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 対応表を、引きやすい形にする。キーに {} が入っているものは、数や名前が入る文（{} の中身は、それぞれ訳す）
const compiled = new Map();
function compile(lang) {
  if (compiled.has(lang)) return compiled.get(lang);
  const dict = DICTS[lang] ?? { strings: {}, names: {} };
  const exact = new Map();
  const templates = [];
  for (const [key, value] of Object.entries(dict.strings ?? {})) {
    if (!key.includes('{}')) {
      exact.set(key, value);
      continue;
    }
    const parts = key.split('{}');
    const literal = parts.join('').length;
    const regex = new RegExp(`^${parts.map(escapeRegex).join('([\\s\\S]+?)')}$`);
    templates.push({ regex, value, literal });
  }
  templates.sort((a, b) => b.literal - a.literal); // 決まった文字の多いものを先に（細かい型を優先）
  const names = Object.entries(dict.names ?? {}).sort((a, b) => b[0].length - a[0].length);
  const result = { exact, templates, names };
  compiled.set(lang, result);
  return result;
}

const caches = new Map();

// str を、今の言語（lang）に訳す。訳せなければ、そのまま返す
export function translate(str, lang = current) {
  if (lang === 'ja' || typeof str !== 'string' || str === '' || !JAPANESE.test(str)) return str;
  let cache = caches.get(lang);
  if (!cache) caches.set(lang, (cache = new Map()));
  const hit = cache.get(str);
  if (hit !== undefined) return hit;
  const result = lookup(str, lang);
  // 開発中の画面だけ：訳せなかった文を window.__i18nMissing に集める（対応表に足す文を探すため）
  if (import.meta.env?.DEV && JAPANESE.test(result)) (globalThis.__i18nMissing ??= new Set()).add(str);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(str, result);
  return result;
}

function lookup(str, lang) {
  const { exact, templates, names } = compile(lang);
  if (exact.has(str)) return exact.get(str);
  for (const t of templates) {
    const m = t.regex.exec(str);
    if (!m) continue;
    const out = t.value.replace(/\{(\d+)\}/g, (_, i) => translate(m[Number(i)] ?? '', lang));
    // 決まった文字の少ない型（「{}、{}」など）は、中身を訳しきれないとき（日本語が残るとき）は使わない（訳せない文が、中途半端に変わらないように）
    if (t.literal <= 3 && JAPANESE.test(out)) continue;
    return out;
  }
  // 何行かの文は、1行ずつ
  if (str.includes('\n')) return str.split('\n').map((line) => translate(line, lang)).join('\n');
  // 名前だけ置き換える（名前と数がつながった文など）
  let out = str;
  for (const [ja, tr] of names) if (out.includes(ja)) out = out.split(ja).join(tr);
  // 名前だけで出来ている文だけ、置き換える（訳せない文の一部だけが、英語・韓国語に変わらないように）
  if (out !== str && JAPANESE.test(out)) return str;
  // カタカナだけの語（頭文字の並びなど）は、ローマ字・ハングルに写す
  if (isKanaWord(out)) return romanizeKana(out, lang);
  return out;
}
