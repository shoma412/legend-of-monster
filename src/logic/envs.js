// 環境の組み合わせ（docs/詳細仕様.md「37. 周回の長い先」）。暗闇・酸の雨・強風の3つのうち、どれが入っているかで、環境の id が決まる。
//   周が進むと、ふだん環境のないエリアにも、ランダムで1つ重なる（run.js）。画面には依存しない。
export const ENV_FLAGS = ['dark', 'rain', 'wind'];
const ID_BY_KEY = {
  dark: 'dark',
  rain: 'acidrain',
  wind: 'gale',
  'dark+rain': 'darkrain',
  'dark+wind': 'darkgale',
  'rain+wind': 'raingale',
  'dark+rain+wind': 'storm',
};

// 環境の定義から、入っているものの名前を並べる（['dark', 'wind'] など）
export function flagsOf(env) {
  return env ? ENV_FLAGS.filter((f) => !!env[f]) : [];
}

// 入っているものの名前から、環境の id（なければ null）
export function envIdFor(flags) {
  const key = ENV_FLAGS.filter((f) => flags.includes(f)).join('+');
  return ID_BY_KEY[key] ?? null;
}

// いまの環境に、まだ入っていないものを1つ足した環境の id。pickIndex は 0 以上 1 未満の乱数
export function addOneEnv(env, pickIndex) {
  const have = flagsOf(env);
  const rest = ENV_FLAGS.filter((f) => !have.includes(f));
  if (rest.length === 0) return envIdFor(have);
  const extra = rest[Math.min(rest.length - 1, Math.floor(pickIndex * rest.length))];
  return envIdFor([...have, extra]);
}
