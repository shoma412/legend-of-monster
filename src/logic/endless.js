// 終わりのない強化の計算（docs/詳細仕様.md「37. 周回の長い先と、終わりのない強化」）。段数は save.endless に持つ。画面には依存しない。
import { endlessLines } from '../data/endless.js';

export const ENDLESS_LINES = endlessLines;

export function endlessLevel(save, id) {
  return Math.max(0, Math.floor(save.endless?.[id] ?? 0));
}

// 段 level のときの、ステータスに足す値（level 0 は 0）
export function endlessValue(line, level) {
  if (level <= 0) return 0;
  if (line.kind === 'exp') return line.scale * (line.rate ** level - 1);
  if (line.kind === 'asym') return (line.sign ?? 1) * line.max * (1 - line.rate ** level);
  return (line.sign ?? 1) * line.per * level;
}

// 次の段（nextLevel。1 から数える）の値段。素材は pool をぐるぐる回り、個数は 10段ごとに +1
export function endlessCost(line, nextLevel) {
  const core = line.pool[(nextLevel - 1) % line.pool.length];
  return { [core]: 1 + Math.floor((nextLevel - 1) / 10) };
}

const round = (v) => Math.round(v * 1000) / 1000;

// 画面に出す値の文（例：「+12.5%」「+130」「毎秒 +4.5」）
export function describeEndless(line, value) {
  const v = Math.abs(value);
  const sign = line.sign === -1 ? '−' : '+';
  if (line.fmt === 'pct') return `${sign}${Math.round(v * 1000) / 10}%`;
  if (line.fmt === 'sec') return `毎秒 ${sign}${round(v)}`;
  return `${sign}${Math.round(v)}`;
}

// 買う。素材が足りれば、素材を使って、段を1つ上げる（上限はない）。買えたら true
export function buyEndless(save, id) {
  const line = endlessLines.find((l) => l.id === id);
  if (!line) return false;
  const level = endlessLevel(save, id);
  const cost = endlessCost(line, level + 1);
  if (!Object.entries(cost).every(([m, n]) => (save.materials[m] ?? 0) >= n)) return false;
  for (const [m, n] of Object.entries(cost)) save.materials[m] -= n;
  save.endless = { ...(save.endless ?? {}), [id]: level + 1 };
  return true;
}

// ラン開始時に乗るステータス補正（ステータスの種類ごとに、全部の系統を足した、1つの補正の並び）
export function endlessMods(save) {
  const mods = [];
  for (const line of endlessLines) {
    const level = endlessLevel(save, line.id);
    if (level > 0) mods.push({ stat: line.stat, add: endlessValue(line, level) });
  }
  return mods;
}
