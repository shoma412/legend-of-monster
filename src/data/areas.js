// エリアの定義（M4 で追加。エリア2は M7、エリア3は M8 で足す）
// 1件 = { id, ... } の形で足す。
//
// code / name : 区画名の表示に使う（例：「SECTOR 01 // 下層スラム」）
// theme       : 床と壁の色（src/data/theme.js の AREA_THEMES）と、背景の模様（src/render/backdrop.js）
// bgm / bossBgm : このエリアの曲と、ボス戦の曲（src/data/audio.js の BGM のキー）
// first       : 最初に入る部屋の種類
// map         : 地図の作り方。length 最初の部屋からボスまでに通る部屋の数（毎回この範囲で変わる）/ preBoss ボスの1つ前に必ず置く部屋 / elites エリート部屋の数 /
//               lanes 途中の1列に並ぶ部屋の数（列ごとにこの範囲で変わる。これが扉の選択肢の数になる）/
//               specials 特殊部屋の数（別々の種類が入る。列の数より少ないと、足りないぶんが足される）/ crossChance 次の列が3部屋のとき、3部屋すべてへ進める確率
// specialRooms: 特殊部屋の候補
// gimmicks    : 部屋の仕掛け（省略できる）。[{ id, chance }] … 戦闘部屋に、その確率で付く
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
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    enemies: [
      { id: 'drone', weight: 5 },
      { id: 'grunt', weight: 3 },
      { id: 'turret', weight: 2 },
    ],
    eliteBases: ['grunt', 'turret'],
    boss: 'boltboar',
    final: false, // 昔の目印（マップ1の最後のエリアだけ true）。今は、マップの定義（src/data/maps.js）の areas の最後が、そのマップの最後のエリア
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
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
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
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
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
  // ---- ここからマップ2「排水区」 ----
  {
    id: 'sewer',
    code: 'DRAIN 01',
    name: '下水道',
    theme: 'sewer',
    bgm: 'sewer',
    bossBgm: 'bossSewer',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    enemies: [
      { id: 'roller', weight: 3 },
      { id: 'leech', weight: 4 },
      { id: 'pipegun', weight: 2 },
      { id: 'drone', weight: 2 },
      { id: 'grunt', weight: 2 },
    ],
    eliteBases: ['roller', 'grunt', 'pipegun'],
    boss: 'pipeserpent',
    final: false,
    comms: {
      bossIntro: [
        '@noise＞ その先が、下水の幹線だ。配管そのものが、標的だ。',
        '@noise＞ 潜っている間は手が出せない。飛び出したところを叩け。電撃が効く。',
      ],
      bossDefeated: [
        '@noise＞ 流れが止まった。……静かだな。',
        '@noise＞ コアを回収しろ。この下には、まだ貯水槽がある。',
      ],
    },
  },
  {
    id: 'reservoir',
    code: 'DRAIN 02',
    name: '貯水槽',
    theme: 'tank',
    bgm: 'reservoir',
    bossBgm: 'bossReservoir',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    enemies: [
      { id: 'sludge', weight: 3 },
      { id: 'poacher', weight: 2 },
      { id: 'roller', weight: 2 },
      { id: 'leech', weight: 3 },
      { id: 'pipegun', weight: 2 },
    ],
    eliteBases: ['sludge', 'poacher', 'roller'],
    boss: 'tankcrab',
    final: false,
    comms: {
      bossIntro: [
        '@noise＞ 水門の前に、大型反応。甲羅を背負っている。',
        '@noise＞ 正面からは通らない。攻撃のあとの隙か、背中を狙え。冷却が効く。',
      ],
      bossDefeated: [
        '@noise＞ 水門が開いた。……もう、ためる水はないのに。',
        '@noise＞ コアを回収しろ。残りは、いちばん下の浄水プラントだ。',
      ],
    },
  },
  {
    id: 'purifier',
    code: 'DRAIN 03',
    name: '浄水プラント',
    theme: 'filter',
    bgm: 'purifier',
    bossBgm: 'bossPurifier',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    enemies: [
      { id: 'sludge', weight: 4 },
      { id: 'poacher', weight: 2 },
      { id: 'roller', weight: 2 },
      { id: 'leech', weight: 2 },
      { id: 'pipegun', weight: 3 },
      { id: 'bomber', weight: 2 },
    ],
    eliteBases: ['sludge', 'poacher', 'pipegun'],
    boss: 'sludgehydra',
    final: false,
    comms: {
      bossIntro: [
        '@noise＞ 沈殿池の中央だ。首が三本、見えるはずだ。',
        '@noise＞ 首を落とさないと、本体にはほとんど通らない。熱が効く。',
      ],
      bossDefeated: [
        '@noise＞ ……止まった。排水区は、これで全部だ。',
        '@noise＞ 帰ってこい。礼を言いたい。',
      ],
    },
  },
  // ---- ここからマップ3「建設区」 ----
  {
    id: 'yard',
    code: 'SITE 01',
    name: '資材置き場',
    theme: 'yard',
    bgm: 'yard',
    bossBgm: 'bossYard',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    // 部屋の仕掛け：戦闘部屋に、この確率で付く（src/data/gimmicks.js）
    gimmicks: [{ id: 'girders', chance: 0.4 }],
    enemies: [
      { id: 'welder', weight: 3 },
      { id: 'riveter', weight: 3 },
      { id: 'carrier', weight: 2 },
      { id: 'grunt', weight: 2 },
      { id: 'bomber', weight: 2 },
    ],
    eliteBases: ['welder', 'riveter', 'grunt'],
    boss: 'scraphound',
    final: false,
    comms: {
      bossIntro: [
        '@noise＞ 鉄くずの山が動いた。それが標的だ。',
        '@noise＞ 磁力で引き寄せてくる。逆らって歩け。冷却が効く。',
      ],
      bossDefeated: [
        '@noise＞ ……探すのを、やめたようだ。',
        '@noise＞ コアを回収しろ。この先に、作りかけの高架がある。',
      ],
    },
  },
  {
    id: 'viaduct',
    code: 'SITE 02',
    name: '高架の現場',
    theme: 'bridge',
    bgm: 'viaduct',
    bossBgm: 'bossViaduct',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    gimmicks: [{ id: 'girders', chance: 0.3 }],
    enemies: [
      { id: 'scaffolder', weight: 2 },
      { id: 'lobber', weight: 3 },
      { id: 'welder', weight: 2 },
      { id: 'riveter', weight: 3 },
      { id: 'carrier', weight: 2 },
    ],
    eliteBases: ['lobber', 'riveter', 'welder'],
    boss: 'girderspider',
    final: false,
    comms: {
      bossIntro: [
        '@noise＞ 橋げたの巣の真ん中だ。あれが標的だ。',
        '@noise＞ 壁を張って、動ける場所を狭めてくる。壊すか、ダッシュですり抜けろ。熱が効く。',
      ],
      bossDefeated: [
        '@noise＞ ……張るのを、やめた。',
        '@noise＞ コアを回収しろ。残りは、未完の塔だ。',
      ],
    },
  },
  {
    id: 'spire',
    code: 'SITE 03',
    name: '未完の塔',
    theme: 'frame',
    bgm: 'spire',
    bossBgm: 'bossSpire',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    gimmicks: [{ id: 'girders', chance: 0.45 }],
    enemies: [
      { id: 'scaffolder', weight: 2 },
      { id: 'lobber', weight: 3 },
      { id: 'welder', weight: 2 },
      { id: 'riveter', weight: 3 },
      { id: 'carrier', weight: 3 },
      { id: 'sniper', weight: 2 },
    ],
    eliteBases: ['lobber', 'riveter', 'scaffolder'],
    boss: 'cranetitan',
    final: false,
    comms: {
      bossIntro: [
        '@noise＞ 最上階だ。塔そのものが、標的だ。',
        '@noise＞ 本体は動かない。吊ったフックと、腕のなぎ払いを避けろ。電撃が効く。',
      ],
      bossDefeated: [
        '@noise＞ ……積むのを、やめた。建設区は、これで全部だ。',
        '@noise＞ 帰ってこい。',
      ],
    },
  },
  // ---- ここからマップ4「停電区」 ----
  {
    id: 'darkstreet',
    code: 'GRID 01',
    name: '消灯街',
    theme: 'night',
    bgm: 'darkstreet',
    bossBgm: 'bossDarkstreet',
    first: 'combat',
    map: { length: { min: 8, max: 10 }, lanes: { min: 2, max: 3 }, preBoss: 'supply', elites: { min: 2, max: 3 }, specials: 3, crossChance: 0.35 },
    specialRooms: ['supply', 'market', 'vault', 'encounter'],
    enemies: [
      { id: 'stalker', weight: 3 },
      { id: 'glowbug', weight: 3 },
      { id: 'lampbreaker', weight: 2 },
      { id: 'drone', weight: 2 },
      { id: 'bomber', weight: 2 },
      { id: 'sniper', weight: 1 },
    ],
    eliteBases: ['grunt', 'lampbreaker'],
    boss: 'lampeater',
    final: false,
    comms: {
      bossIntro: [
        '@noise＞ 灯りが消えていく。あれが、食べている。',
        '@noise＞ 非常灯を点けておけ。姿が見える。熱が効く。',
      ],
      bossDefeated: [
        '@noise＞ ……もう、灯りを探していない。',
        '@noise＞ コアを回収しろ。この下に、変電所がある。',
      ],
    },
  },
];
