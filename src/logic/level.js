// 経験値とレベル、インプラントの選択肢の抽選
import { LEVEL } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { inRunPool, isAvailable } from './stats.js';

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

// 持てるインプラントの種類の数（中断データなど、数を持っていない古い build は、最初の数）
export function implantCap(build) {
  return build.implantSlots ?? LEVEL.implantKinds;
}

// 今持っているインプラントの種類の数
export function implantKinds(build) {
  return Object.keys(build.implants).length;
}

// そのインプラントを入れられるか：持っているもの（強化）か、枠が空いていれば入る
export function canAddImplant(build, id) {
  return (build.implants[id] ?? 0) > 0 || implantKinds(build) < implantCap(build);
}

// レベルアップ時の選択肢。持っているものは「強化」として出る。レベルが上限のものは出さない。
// 出るのは、汎用と、このランに出る種族（そのマップの種族＋持ち込み）の部品だけ。
// 枠がいっぱいのときは、持っているものの強化だけが出る
export function rollImplantChoices(build, rng, count = LEVEL.choices) {
  const pool = DATA.implants.all().filter((d) => isAvailable(d) && inRunPool(build, d) && (build.implants[d.id] ?? 0) < LEVEL.implantMax && canAddImplant(build, d.id));
  const choices = [];
  while (choices.length < count && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    choices.push(pool.splice(i, 1)[0]);
  }
  return choices;
}
