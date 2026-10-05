// 実績の定義（M5 で追加）
// 1件 = { id, ... } の形で足す。仕上げやテストプレイの中で増やしていく前提。
//
// on    : きっかけになる出来事
//         sortie（出撃）/ kill（敵を倒した）/ eliteKill / bossKill / implant（インプラントを入れた）/
//         equip（装備を身につけた）/ fragment（データ片を手に入れた）/ runClear（最後のボスを倒した）/
//         levelup（レベルが上がった）/ guard（ジャストガード成功）/ ougi（奥義を使った）/ buy（闇市で買った）/ item（消耗品を使った）
// icon  : 見た目（src/render/metaIcons.js の ACHIEVEMENT_ICONS）。color を書くと、解除したときの色が変わる（書かなければ金色）
// check : 追加の条件の部品の名前（src/logic/achievements.js の CHECKS）。書かなければ、出来事が起きただけで解除
export const achievements = [
  { id: 'first-sortie', icon: 'flag', name: '初仕事', desc: '初めて出撃した', on: 'sortie' },
  { id: 'boltboar', icon: 'skull', color: 'shock', name: '電線喰らい狩り', desc: 'ボルトボアを倒した', on: 'bossKill', check: 'bossIs', boss: 'boltboar' },
  { id: 'cryowyvern', icon: 'skull', color: 'cold', name: '冷却塔の主狩り', desc: 'クライオ・ワイバーンを倒した', on: 'bossKill', check: 'bossIs', boss: 'cryowyvern' },
  { id: 'overload', icon: 'skull', color: 'heat', name: '機構停止', desc: 'オーバーロードを倒した', on: 'bossKill', check: 'bossIs', boss: 'overload' },
  { id: 'no-damage-boss', icon: 'shield', name: '無傷の仕事', desc: 'ダメージを受けずにボスを倒した', on: 'bossKill', check: 'noDamage' },
  { id: 'elite', icon: 'star', name: '危険個体処理', desc: 'エリートを倒した', on: 'eliteKill' },
  { id: 'family', icon: 'chip', name: '系統特化', desc: '同じ系統のインプラントを3つそろえた', on: 'implant', check: 'familyBonus' },
  { id: 'legend', icon: 'crown', name: '伝説の一品', desc: 'レジェンド装備を身につけた', on: 'equip', check: 'rarityAtLeast', rarity: 3 },
  { id: 'fragment-first', icon: 'doc', name: '記録の断片', desc: 'データ片を初めて手に入れた', on: 'fragment', check: 'fragmentCount', count: 1 },
  { id: 'fragment-all', icon: 'docs', name: '全記録回収', desc: 'データ片をすべて集めた', on: 'fragment', check: 'allFragments' },
  { id: 'kills-100', icon: 'tally', name: '百体処理', desc: '累計で100体倒した', on: 'kill', check: 'totalKills', count: 100 },
  { id: 'clear-greatsword', icon: 'greatsword', name: '大剣使い', desc: '大剣で初めてクリアした', on: 'runClear', check: 'weaponIs', weapon: 'greatsword' },
  { id: 'clear-sword', icon: 'sword', name: '片手剣使い', desc: '片手剣で初めてクリアした', on: 'runClear', check: 'weaponIs', weapon: 'sword' },
  { id: 'clear-gun', icon: 'gun', name: '銃使い', desc: '銃で初めてクリアした', on: 'runClear', check: 'weaponIs', weapon: 'gun' },
  { id: 'level-8', icon: 'up', name: 'フル改造', desc: '1回のランでレベル8に届いた', on: 'levelup', check: 'levelAtLeast', level: 8 },
  { id: 'just-guard', icon: 'guard', name: '見切り', desc: 'ジャストガードを成功させた', on: 'guard' },
  { id: 'ougi', icon: 'burst', name: '起死回生', desc: '奥義を使った', on: 'ougi' },
  { id: 'market', icon: 'coin', name: '闇市の客', desc: '闇市で買い物をした', on: 'buy' },
  { id: 'item', icon: 'grenade', name: '道具使い', desc: '消耗品を使った', on: 'item' },
  { id: 'runs-10', icon: 'repeat', name: '常連', desc: '10回出撃した', on: 'sortie', check: 'runsAtLeast', count: 10 },
  { id: 'kills-500', icon: 'tally', name: '五百体処理', desc: '累計で500体倒した', on: 'kill', check: 'totalKills', count: 500 },
];
