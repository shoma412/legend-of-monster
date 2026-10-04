// 雑魚敵の定義（M1 から追加）
// 1件 = { id, ... } の形で足す。
//
// behavior は動き方の種類（src/game/enemyAI.js にある部品の名前）
//   swarm   : ふらつきながら突っ込む。体当たりでダメージ
//   brawler : 近づいて、構えてから前方を殴る
//   gunner  : 距離を取り、狙いをつけてから弾を撃つ
//   bomber  : 近づいて、点滅してから自爆する。爆発の範囲は床に出る
//   sprayer : 近づいて、構えてから前方に冷気を噴射する。当たると減速
// shape は見た目（src/render/draw.js）、color は src/data/theme.js の色名
// hp と damage は、エリアが進むごとに倍率がかかる（src/data/balance.js の ENEMY_SCALING）
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
    xp: 6,
    credits: 2, // 倒したときにもらえるクレジット
    cost: 1, // 部屋の敵を選ぶときの重さ（予算から引く）
    dropChance: 0.12, // 倒したとき装備を落とす確率
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
    xp: 12,
    credits: 4,
    cost: 2,
    dropChance: 0.24,
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
    xp: 10,
    credits: 4,
    cost: 2,
    dropChance: 0.24,
    keepDistance: { min: 240, max: 360 },
    shot: { interval: 1.9, aim: 0.45, speed: 235, radius: 5, life: 3 },
  },
  {
    id: 'bomber',
    name: '自爆ボット',
    behavior: 'bomber',
    shape: 'hexagon',
    color: 'red',
    radius: 11,
    hp: 26,
    speed: 150,
    damage: 16,
    xp: 8,
    credits: 3,
    cost: 2,
    dropChance: 0.12,
    // triggerRange まで近づくと fuse 秒点滅して爆発する。爆発前に倒せば爆発しない
    bomb: { triggerRange: 62, fuse: 1, radius: 86 },
  },
  {
    id: 'sprayer',
    name: 'フロストスプレイヤー',
    behavior: 'sprayer',
    shape: 'pentagon',
    color: 'ice',
    radius: 14,
    hp: 40,
    speed: 64,
    damage: 5, // 噴射が当たるたびのダメージ
    xp: 12,
    credits: 4,
    cost: 2,
    dropChance: 0.24,
    // triggerRange まで近づくと windup 秒構え、duration 秒のあいだ前方の扇に冷気を噴く
    spray: { triggerRange: 150, range: 175, arc: 46, windup: 0.55, duration: 1.3, recover: 1.4 },
  },
];
