// HP が少ないときの警告（画面の縁が赤く脈打つ、HP の棒が点滅する、鼓動の音が鳴る）の段階を決める
import { FEEL } from '../data/balance.js';

// 0：ふつう / 1：少ない（警告）/ 2：あとわずか（危険）。倒れているときは 0
export function lowHpLevel(hp, maxHp) {
  if (!(hp > 0) || !(maxHp > 0)) return 0;
  const ratio = hp / maxHp;
  if (ratio <= FEEL.lowHp.critical) return 2;
  return ratio <= FEEL.lowHp.ratio ? 1 : 0;
}

// 鼓動の音の間隔（秒）。危険なほど速い。鳴らさない段階では null
export function heartbeatInterval(level) {
  return level === 2 ? FEEL.lowHp.beatCritical : level === 1 ? FEEL.lowHp.beat : null;
}
