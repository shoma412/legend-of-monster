// 実績の定義（M5 で追加）
// 1件 = { id, ... } の形で足す。仕上げやテストプレイの中で増やしていく前提。
//
// on    : きっかけになる出来事
//         sortie（出撃）/ kill（敵を倒した）/ eliteKill / bossKill / implant（インプラントを入れた）/
//         equip（装備を身につけた）/ fragment（データ片を手に入れた）/ runClear（最後のボスを倒した）
// check : 追加の条件の部品の名前（src/logic/achievements.js の CHECKS）。書かなければ、出来事が起きただけで解除
export const achievements = [
  { id: 'first-sortie', name: '初仕事', desc: '初めて出撃した', on: 'sortie' },
  { id: 'boltboar', name: '電線喰らい狩り', desc: 'ボルトボアを倒した', on: 'bossKill', check: 'bossIs', boss: 'boltboar' },
  { id: 'cryowyvern', name: '冷却塔の主狩り', desc: 'クライオ・ワイバーンを倒した', on: 'bossKill', check: 'bossIs', boss: 'cryowyvern' },
  { id: 'no-damage-boss', name: '無傷の仕事', desc: 'ダメージを受けずにボスを倒した', on: 'bossKill', check: 'noDamage' },
  { id: 'elite', name: '危険個体処理', desc: 'エリートを倒した', on: 'eliteKill' },
  { id: 'family', name: '系統特化', desc: '同じ系統のインプラントを3つそろえた', on: 'implant', check: 'familyBonus' },
  { id: 'legend', name: '伝説の一品', desc: 'レジェンド装備を身につけた', on: 'equip', check: 'rarityAtLeast', rarity: 3 },
  { id: 'fragment-first', name: '記録の断片', desc: 'データ片を初めて手に入れた', on: 'fragment', check: 'fragmentCount', count: 1 },
  { id: 'fragment-all', name: '全記録回収', desc: 'データ片をすべて集めた', on: 'fragment', check: 'allFragments' },
  { id: 'kills-100', name: '百体処理', desc: '累計で100体倒した', on: 'kill', check: 'totalKills', count: 100 },
  { id: 'clear-greatsword', name: '大剣使い', desc: '大剣で初めてクリアした', on: 'runClear', check: 'weaponIs', weapon: 'greatsword' },
  { id: 'clear-sword', name: '片手剣使い', desc: '片手剣で初めてクリアした', on: 'runClear', check: 'weaponIs', weapon: 'sword' },
  { id: 'clear-gun', name: '銃使い', desc: '銃で初めてクリアした', on: 'runClear', check: 'weaponIs', weapon: 'gun' },
];
