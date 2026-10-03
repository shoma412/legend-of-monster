// 雑魚敵の定義（M1 から追加）
// 1件 = { id, ... } の形で足す。
//
// behavior は動き方の種類（src/game/enemyAI.js にある部品の名前）
//   swarm   : ふらつきながら突っ込む。体当たりでダメージ
//   brawler : 近づいて、構えてから前方を殴る
//   gunner  : 距離を取り、狙いをつけてから弾を撃つ
// shape は見た目（src/render/draw.js）、color は src/data/theme.js の色名
export const enemies = [
  {
    id: 'drone',
    name: 'スカウトドローン',
    behavior: 'swarm',
    shape: 'triangle',
    color: 'cyan',
    radius: 10,
    hp: 28,
    speed: 125,
    damage: 8,
    wobble: 0.6, // ふらつきの強さ
  },
  {
    id: 'grunt',
    name: 'ストリートグラント',
    behavior: 'brawler',
    shape: 'square',
    color: 'magenta',
    radius: 15,
    hp: 64,
    speed: 72,
    damage: 13,
    knockbackResist: 0.5, // 吹き飛びにくさ（0〜1）
    attack: { triggerRange: 46, range: 58, arc: 110, windup: 0.45, recover: 0.7 },
  },
  {
    id: 'turret',
    name: '監視タレット',
    behavior: 'gunner',
    shape: 'circle',
    color: 'amber',
    radius: 13,
    hp: 46,
    speed: 30,
    damage: 10,
    keepDistance: { min: 240, max: 360 },
    shot: { interval: 1.9, aim: 0.45, speed: 235, radius: 5, life: 3 },
  },
];
