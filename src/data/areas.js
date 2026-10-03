// エリアの定義（M4 で追加。エリア2は M7、エリア3は M8 で足す）
// 1件 = { id, ... } の形で足す。
//
// code / name : 区画名の表示に使う（例：「SECTOR 01 // 下層スラム」）
// first       : 最初に入る部屋の種類
// pool        : 残りの部屋。扉の2択で、この中から選んで進む
// specialRooms: 特殊部屋の候補。ランごとに1つ選ばれて pool に加わる
// enemies     : 出る雑魚と出やすさ（weight）
// eliteBases  : エリートになる雑魚
// boss        : エリアの最後のボス
// comms       : 通信ログ。下書きなので、文章は自由に書き換えてよい
export const areas = [
  {
    id: 'slum',
    code: 'SECTOR 01',
    name: '下層スラム',
    first: 'combat',
    pool: ['combat', 'elite'],
    specialRooms: ['supply', 'market', 'vault'],
    enemies: [
      { id: 'drone', weight: 5 },
      { id: 'grunt', weight: 3 },
      { id: 'turret', weight: 2 },
    ],
    eliteBases: ['grunt', 'turret'],
    boss: 'boltboar',
    comms: {
      bossIntro: [
        '依頼主＞ 最深部に大型反応。そいつが今回の標的だ。',
        '依頼主＞ 電線を喰って肥えた猪だ。突っ込んできたら、壁にぶつけてやれ。',
      ],
      bossDefeated: [
        '依頼主＞ 反応消失を確認。コアを回収しろ。',
        '依頼主＞ 下の冷却プラントへ降りるルートが開いた。',
      ],
    },
  },
];
