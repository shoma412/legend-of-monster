// エリアの定義（M4 で追加。エリア2は M7、エリア3は M8 で足す）
// 1件 = { id, ... } の形で足す。
//
// code / name : 区画名の表示に使う（例：「SECTOR 01 // 下層スラム」）
// theme       : 床と壁の色（src/data/theme.js の AREA_THEMES）と、背景の模様（src/render/backdrop.js）
// bgm / bossBgm : このエリアの曲と、ボス戦の曲（src/data/audio.js の BGM のキー）
// first       : 最初に入る部屋の種類
// map         : 地図の作り方。length 最初の部屋からボスまでに通る部屋の数（毎回この範囲で変わる）/ preBoss ボスの1つ前に必ず置く部屋 / elites エリート部屋の数 /
//               specials 特殊部屋の数（別々の種類が入る）/ crossChance 斜めの線が引かれる確率
// specialRooms: 特殊部屋の候補
// enemies     : 出る雑魚と出やすさ（weight）
// eliteBases  : エリートになる雑魚
// boss        : エリアの最後のボス
// comms       : 通信ログ。下書きなので、文章は自由に書き換えてよい。@noise は依頼主の名前（記号の並びでごまかして表示される）
export const areas = [
  {
    id: 'slum',
    code: 'SECTOR 01',
    name: '下層スラム',
    theme: 'slum',
    bgm: 'slum',
    bossBgm: 'bossSlum',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.5 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    enemies: [
      { id: 'drone', weight: 5 },
      { id: 'grunt', weight: 3 },
      { id: 'turret', weight: 2 },
    ],
    eliteBases: ['grunt', 'turret'],
    boss: 'boltboar',
    final: false, // 最後のエリアなら true（ここのボスを倒すとクリア）
    comms: {
      bossIntro: [
        '@noise＞ 最深部に大型反応。そいつが今回の標的だ。',
        '@noise＞ 電線を喰って肥えた猪だ。突っ込んできたら、壁にぶつけてやれ。',
      ],
      bossDefeated: [
        '@noise＞ 反応消失を確認。コアを回収しろ。',
        '@noise＞ 下の冷却プラントへ降りるルートが開いた。',
      ],
    },
  },
  {
    id: 'plant',
    code: 'SECTOR 02',
    name: '冷却プラント',
    theme: 'plant',
    bgm: 'plant',
    bossBgm: 'bossPlant',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.5 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    enemies: [
      { id: 'drone', weight: 3 },
      { id: 'grunt', weight: 2 },
      { id: 'turret', weight: 2 },
      { id: 'bomber', weight: 3 },
      { id: 'sprayer', weight: 3 },
    ],
    eliteBases: ['grunt', 'turret', 'sprayer'],
    boss: 'cryowyvern',
    final: false,
    comms: {
      bossIntro: [
        '@noise＞ プラントの心臓部だ。上を飛んでいるのが次の標的だ。',
        '@noise＞ 冷気を浴びると足が鈍る。熱が効くはずだ。',
      ],
      bossDefeated: [
        '@noise＞ 冷却が止まった。上の連中が騒ぎ出す前に進め。',
        '@noise＞ 次は企業タワーの最深部だ。',
      ],
    },
  },
  {
    id: 'tower',
    code: 'SECTOR 03',
    name: '企業タワー',
    theme: 'tower',
    bgm: 'tower',
    bossBgm: 'bossTower',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.5 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    enemies: [
      { id: 'drone', weight: 2 },
      { id: 'grunt', weight: 2 },
      { id: 'turret', weight: 2 },
      { id: 'bomber', weight: 2 },
      { id: 'shield', weight: 3 },
      { id: 'sniper', weight: 2 },
    ],
    eliteBases: ['grunt', 'turret', 'shield'],
    boss: 'overload',
    final: true, // ここのボスを倒すとクリア
    comms: {
      bossIntro: [
        '@noise＞ タワーの最深部だ。街の電力も冷却も、全部そいつが握っている。',
        '@noise＞ 熱を持ちすぎると、冷却で動きが止まる。そこを叩け。電撃が効く。',
      ],
      bossDefeated: [
        '@noise＞ ……止まったか。よくやった。',
        '@noise＞ 帰ってこい。報酬の話をしよう。',
      ],
    },
  },
];
