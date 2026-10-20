// コントローラーの振動の計算（画面には触らない。docs/詳細仕様.md「32. ゲームパッド」の「振動」）。
import { RUMBLE } from '../data/balance.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 場面の名前と、設定の強さから、Gamepad API に渡す値を作る。振動しないときは null
//   index：段階（溜め斬りの溜め：0＝1段目）
export function rumbleParams(name, index, level) {
  const scale = RUMBLE.levels[level];
  if (!scale) return null; // 切る、または知らない値
  const entry = RUMBLE.events[name];
  const e = Array.isArray(entry) ? entry[Math.min(Math.max(0, index), entry.length - 1)] : entry;
  if (!e) return null;
  return { duration: e.ms, weakMagnitude: clamp01(e.weak * scale), strongMagnitude: clamp01(e.strong * scale), startDelay: 0 };
}
