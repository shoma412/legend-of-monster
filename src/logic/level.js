// 経験値とレベル、インプラントの選択肢の抽選
import { LEVEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { isAvailable } from './stats.js';

// そのレベルから次のレベルに上がるのに必要な経験値
export function xpToNext(level) {
  return Math.round(LEVEL.baseXp * LEVEL.growth ** (level - 1));
}

// 経験値を足す。上がったレベルの数を返す
export function addXp(build, amount) {
  build.xp += amount;
  let ups = 0;
  while (build.xp >= xpToNext(build.level)) {
    build.xp -= xpToNext(build.level);
    build.level++;
    ups++;
  }
  return ups;
}

// レベルアップ時の選択肢。重ねがけできないものは、持っていたら出さない
export function rollImplantChoices(build, rng, count = LEVEL.choices) {
  const pool = DATA.implants.all().filter((d) => isAvailable(d) && (d.stack || !build.implants[d.id]));
  const choices = [];
  while (choices.length < count && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    choices.push(pool.splice(i, 1)[0]);
  }
  return choices;
}
