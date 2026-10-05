// ボスが次に出す技を選ぶ（ゲームの状態には触らない、計算だけの部分）
import { BOSS_AI } from '../data/balance.js';

// プレイヤーとの距離を、近い・中くらい・遠い に分ける
export function reachOf(dist) {
  return dist <= BOSS_AI.near ? 'near' : dist >= BOSS_AI.far ? 'far' : 'mid';
}

function reachFactor(reach, where) {
  if (!reach || where === 'mid') return 1;
  return reach === where ? BOSS_AI.match : BOSS_AI.mismatch;
}

// その段階で使える技と連携から、出やすさ（weight）つきの候補を作る
//   phase:  { moves: [技の名前 または { move, weight }], combos: [{ moves: [技の名前…], weight }] }
//   memory: { last: 直前の技, prev: 2つ前の技, lastCombo: 直前が連携だったか }
export function moveOptions(phase, attacks, memory, dist) {
  const where = reachOf(dist);
  const options = [];
  for (const entry of phase.moves) {
    const name = typeof entry === 'string' ? entry : entry.move;
    let weight = (entry.weight ?? 1) * reachFactor(attacks[name].reach, where);
    if (name === memory.last) weight = 0; // 同じ技を続けて出さない
    else if (name === memory.prev) weight *= BOSS_AI.repeatPenalty;
    options.push({ moves: [name], weight });
  }
  // 連携は続けて出さない
  if (!memory.lastCombo) {
    for (const combo of phase.combos ?? []) {
      let weight = (combo.weight ?? BOSS_AI.comboWeight) * reachFactor(attacks[combo.moves[0]].reach, where);
      if (combo.moves[0] === memory.last) weight = 0;
      options.push({ moves: combo.moves, weight, combo: true });
    }
  }
  return options;
}

// 候補から1つ抽選する。返り値は { moves: [技の名前…], combo }
export function chooseMove(phase, attacks, memory, dist, rng) {
  const options = moveOptions(phase, attacks, memory, dist);
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  if (total <= 0) return options[0];
  let roll = rng() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll < 0) return o;
  }
  return options.filter((o) => o.weight > 0).at(-1);
}
