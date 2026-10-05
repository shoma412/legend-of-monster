// BGM・SE の対応表。ゲーム側は「キー」だけを使い、中身はここにだけ書く。
// 今はすべてコードで合成している（外部の音声ファイルは使っていない）。
// 素材のファイルを足したら CREDITS.md にも記録すること。

// ---- SE ----
// 1つの音は、1つ以上の「層」を重ねて作る。層の書き方：
//   wave : sine / square / sawtooth / triangle / noise
//   freq : [始まりの高さ, 終わりの高さ]（Hz）。noise のときは音のこもり具合（フィルタの高さ）
//   dur  : 長さ（秒） / vol : 大きさ（0〜1） / delay : 鳴り始めを遅らせる（秒）
// ファイルに差し替えるときは、{ file: 'audio/se/slash.wav' } と書く（public/ からの場所）
export const SE = {
  // プレイヤー
  swing: [{ wave: 'noise', freq: [2400, 500], dur: 0.12, vol: 0.22 }],
  swingHeavy: [{ wave: 'noise', freq: [1600, 240], dur: 0.2, vol: 0.3 }, { wave: 'sawtooth', freq: [180, 60], dur: 0.18, vol: 0.14 }],
  shoot: [{ wave: 'square', freq: [900, 260], dur: 0.07, vol: 0.13 }, { wave: 'noise', freq: [4000, 1200], dur: 0.05, vol: 0.12 }],
  dash: [{ wave: 'noise', freq: [600, 3200], dur: 0.14, vol: 0.16 }],
  charge: [{ wave: 'sine', freq: [520, 880], dur: 0.12, vol: 0.14 }],
  guard: [{ wave: 'square', freq: [1400, 2200], dur: 0.08, vol: 0.2 }, { wave: 'triangle', freq: [700, 1400], dur: 0.25, vol: 0.2, delay: 0.04 }],
  ougi: [{ wave: 'sawtooth', freq: [90, 30], dur: 0.7, vol: 0.34 }, { wave: 'noise', freq: [3000, 200], dur: 0.6, vol: 0.3 }, { wave: 'sine', freq: [880, 220], dur: 0.5, vol: 0.16 }],
  hurt: [{ wave: 'sawtooth', freq: [300, 90], dur: 0.2, vol: 0.26 }, { wave: 'noise', freq: [1200, 300], dur: 0.14, vol: 0.2 }],
  death: [{ wave: 'sawtooth', freq: [260, 30], dur: 0.9, vol: 0.3 }, { wave: 'noise', freq: [2000, 100], dur: 0.8, vol: 0.24 }],
  heal: [{ wave: 'sine', freq: [520, 780], dur: 0.14, vol: 0.16 }, { wave: 'sine', freq: [780, 1040], dur: 0.2, vol: 0.14, delay: 0.1 }],
  // 当たったとき
  hit: [{ wave: 'square', freq: [320, 140], dur: 0.06, vol: 0.14 }, { wave: 'noise', freq: [2600, 800], dur: 0.05, vol: 0.12 }],
  crit: [{ wave: 'square', freq: [900, 300], dur: 0.1, vol: 0.18 }, { wave: 'noise', freq: [5000, 1000], dur: 0.08, vol: 0.16 }],
  block: [{ wave: 'triangle', freq: [1300, 1100], dur: 0.07, vol: 0.16 }],
  kill: [{ wave: 'noise', freq: [3000, 300], dur: 0.16, vol: 0.2 }, { wave: 'square', freq: [240, 60], dur: 0.14, vol: 0.12 }],
  bossKill: [{ wave: 'sawtooth', freq: [200, 24], dur: 1.2, vol: 0.34 }, { wave: 'noise', freq: [4000, 80], dur: 1.2, vol: 0.32 }],
  // 敵
  enemyShot: [{ wave: 'square', freq: [520, 300], dur: 0.08, vol: 0.09 }],
  snipe: [{ wave: 'sawtooth', freq: [1800, 200], dur: 0.16, vol: 0.2 }, { wave: 'noise', freq: [6000, 1500], dur: 0.08, vol: 0.16 }],
  explode: [{ wave: 'noise', freq: [1800, 120], dur: 0.36, vol: 0.3 }, { wave: 'sine', freq: [120, 40], dur: 0.3, vol: 0.24 }],
  bossCharge: [{ wave: 'sawtooth', freq: [80, 220], dur: 0.35, vol: 0.22 }],
  laser: [{ wave: 'sawtooth', freq: [140, 160], dur: 1.2, vol: 0.14 }, { wave: 'square', freq: [1200, 1260], dur: 1.2, vol: 0.05 }],
  warning: [{ wave: 'square', freq: [440, 440], dur: 0.18, vol: 0.16 }, { wave: 'square', freq: [330, 330], dur: 0.18, vol: 0.16, delay: 0.22 }],
  // 拾う・選ぶ
  equip: [{ wave: 'triangle', freq: [520, 1040], dur: 0.1, vol: 0.18 }],
  pickup: [{ wave: 'triangle', freq: [700, 1050], dur: 0.08, vol: 0.16 }],
  item: [{ wave: 'square', freq: [600, 900], dur: 0.08, vol: 0.14 }],
  fragment: [{ wave: 'sine', freq: [660, 660], dur: 0.1, vol: 0.16 }, { wave: 'sine', freq: [990, 990], dur: 0.1, vol: 0.16, delay: 0.1 }, { wave: 'sine', freq: [1320, 1320], dur: 0.2, vol: 0.16, delay: 0.2 }],
  levelup: [{ wave: 'square', freq: [440, 440], dur: 0.09, vol: 0.14 }, { wave: 'square', freq: [660, 660], dur: 0.09, vol: 0.14, delay: 0.09 }, { wave: 'square', freq: [880, 880], dur: 0.22, vol: 0.14, delay: 0.18 }],
  implant: [{ wave: 'sine', freq: [300, 1200], dur: 0.25, vol: 0.18 }],
  achievement: [{ wave: 'triangle', freq: [784, 784], dur: 0.1, vol: 0.18 }, { wave: 'triangle', freq: [1175, 1175], dur: 0.28, vol: 0.18, delay: 0.1 }],
  buy: [{ wave: 'triangle', freq: [880, 1320], dur: 0.12, vol: 0.16 }],
  deny: [{ wave: 'square', freq: [160, 120], dur: 0.14, vol: 0.14 }],
  door: [{ wave: 'noise', freq: [400, 1800], dur: 0.3, vol: 0.18 }],
  // 画面
  count: [{ wave: 'square', freq: [660, 660], dur: 0.08, vol: 0.14 }],
  go: [{ wave: 'square', freq: [990, 990], dur: 0.25, vol: 0.16 }],
  select: [{ wave: 'square', freq: [520, 520], dur: 0.04, vol: 0.08 }],
  confirm: [{ wave: 'square', freq: [660, 990], dur: 0.09, vol: 0.12 }],
};

// ---- BGM ----
// 場面ごとの曲。file を書くと、そのファイル（public/ からの場所）をループ再生する。
// file が null のとき、またはファイルを読み込めなかったときは、song の名前の曲（下の SONGS）をコードで鳴らす。
// 曲を差し替えるときは、ここの file を書き換えるだけでよい。
// 今のファイルは、すべて「魔王魂」のループ用の曲（出典とライセンスは CREDITS.md）。
// エリアごとの曲とボス戦の曲は、エリアの定義（src/data/areas.js の bgm / bossBgm）からこのキーで選ぶ。
export const BGM = {
  title: { file: 'audio/bgm/maou_loop_bgm_cyber33.ogg', song: 'title' },
  hideout: { file: 'audio/bgm/maou_loop_bgm_cyber34.ogg', song: 'hideout' },
  slum: { file: 'audio/bgm/maou_loop_bgm_cyber38.ogg', song: 'slum' },
  plant: { file: 'audio/bgm/maou_loop_bgm_cyber19.ogg', song: 'plant' },
  tower: { file: 'audio/bgm/maou_loop_bgm_cyber24.ogg', song: 'tower' },
  bossSlum: { file: 'audio/bgm/maou_loop_bgm_neorock80.ogg', song: 'bossSlum' },
  bossPlant: { file: 'audio/bgm/maou_loop_bgm_neorock65.ogg', song: 'bossPlant' },
  bossTower: { file: 'audio/bgm/maou_loop_bgm_cyber39.ogg', song: 'bossTower' },
  ending: { file: 'audio/bgm/maou_loop_bgm_cyber17.ogg', song: 'ending' },
};

// ---- コードで鳴らす曲 ----
// 曲は「セクション」（4小節）を arrangement の順に並べて作る。最後まで行ったら最初に戻る。
//   bpm  : 速さ / key : 基準の音の高さ（Hz）。音はすべて短調の音階の「何番目の音か」で書く（0 = 基準の音, 7 = 1オクターブ上）
// セクションの書き方：
//   chords : 4小節ぶんの和音（音階の何番目の音から積むか）
//   bass   : ベースの刻み方（下の BASS の名前）/ arp : 和音の散らし方（ARP の名前）/ drums : ドラム（DRUMS の名前）
//   pad    : true なら、和音を長く伸ばした音を後ろに敷く
//   lead   : メロディ。4小節ぶん、1小節 = 16個（16分音符）。数字は音階の何番目か、. は休み
//   どれも省略でき、省略したパートは鳴らない
export const SONGS = {
  title: {
    bpm: 80, key: 110, leadWave: 'triangle', arpWave: 'triangle',
    arrangement: ['A', 'B'],
    sections: {
      A: { chords: [0, 5, 3, 4], pad: true, arp: 'sparse' },
      B: { chords: [5, 6, 0, 4], pad: true, arp: 'sparse', lead: ['14 . . . 11 . . . 9 . . . 11 . . .', '12 . . . . . . . 9 . . . . . . .', '7 . . . 9 . . . 11 . . . 9 . . .', '8 . . . . . . . . . . . . . . .'] },
    },
  },
  hideout: {
    bpm: 92, key: 110, leadWave: 'triangle', arpWave: 'triangle',
    arrangement: ['A', 'A', 'B', 'A', 'C'],
    sections: {
      A: { chords: [0, 5, 3, 4], pad: true, arp: 'sparse', bass: 'long', drums: 'soft' },
      B: { chords: [5, 6, 0, 4], pad: true, arp: 'updown', bass: 'long', drums: 'soft', lead: ['11 . . 9 . . 7 . 9 . . . . . . .', '12 . . 11 . . 9 . 8 . . . . . . .', '7 . 9 . 11 . 14 . 11 . . . 9 . . .', '8 . . . . . 9 . 8 . . . . . . .'] },
      C: { chords: [3, 4, 5, 4], pad: true, arp: 'sparse', bass: 'long' },
    },
  },
  // エリア1：下層スラム。夜の路地を走る感じ
  slum: {
    bpm: 118, key: 73.42, leadWave: 'square', arpWave: 'square',
    arrangement: ['A', 'A', 'B', 'A', 'B', 'C'],
    sections: {
      A: { chords: [0, 0, 5, 6], bass: 'drive', arp: 'up', drums: 'four' },
      B: { chords: [3, 5, 0, 4], bass: 'drive', arp: 'up', drums: 'four', pad: true, lead: ['14 . 14 . 12 . 11 . 12 . . . 9 . . .', '12 . 12 . 11 . 9 . 11 . . . 7 . . .', '14 . 16 . 14 . 11 . 9 . 11 . 12 . . .', '11 . . . 9 . . . 8 . . . . . . .'] },
      C: { chords: [0, 6, 5, 4], bass: 'long', arp: 'updown', pad: true, drums: 'break' },
    },
  },
  // エリア2：冷却プラント。冷たくて広い感じ
  plant: {
    bpm: 104, key: 92.5, leadWave: 'triangle', arpWave: 'triangle',
    arrangement: ['A', 'B', 'A', 'B', 'C'],
    sections: {
      A: { chords: [0, 3, 5, 4], bass: 'long', arp: 'bell', drums: 'half', pad: true },
      B: { chords: [5, 3, 0, 6], bass: 'pump', arp: 'bell', drums: 'half', pad: true, lead: ['18 . . . . . 16 . 14 . . . . . . .', '16 . . . . . 14 . 12 . . . . . . .', '14 . . 16 . . 18 . 21 . . . 18 . . .', '17 . . . . . . . 15 . . . . . . .'] },
      C: { chords: [0, 0, 3, 4], arp: 'bell', pad: true },
    },
  },
  // エリア3：企業タワー。機械的で攻撃的な感じ
  tower: {
    bpm: 132, key: 82.41, leadWave: 'sawtooth', arpWave: 'square',
    arrangement: ['A', 'A', 'B', 'A', 'B', 'C'],
    sections: {
      A: { chords: [0, 5, 0, 6], bass: 'gallop', arp: 'up', drums: 'drive' },
      B: { chords: [3, 4, 0, 0], bass: 'gallop', arp: 'up', drums: 'drive', pad: true, lead: ['7 . 9 . 10 . 9 . 7 . . . 11 . . .', '8 . 9 . 11 . 9 . 8 . . . 12 . . .', '14 . 12 . 11 . 9 . 11 . 12 . 14 . . .', '14 . . . 13 . . . 14 . . . . . . .'] },
      C: { chords: [5, 6, 0, 0], bass: 'pump', arp: 'updown', drums: 'break', pad: true },
    },
  },
  // ボス戦。エリアごとに高さと速さを変える
  bossSlum: {
    bpm: 150, key: 73.42, leadWave: 'sawtooth', arpWave: 'square',
    arrangement: ['A', 'B', 'A', 'B', 'C'],
    sections: {
      A: { chords: [0, 6, 5, 4], bass: 'gallop', arp: 'up', drums: 'boss' },
      B: { chords: [0, 1, 0, 4], bass: 'gallop', arp: 'up', drums: 'boss', pad: true, lead: ['14 . 14 13 14 . 16 . 14 . . . 11 . . .', '15 . 15 14 15 . 17 . 15 . . . 12 . . .', '14 . 16 . 18 . 16 . 14 . 12 . 11 . . .', '11 . . . 12 . . . 13 . . . 11 . . .'] },
      C: { chords: [5, 5, 4, 4], bass: 'pump', arp: 'updown', drums: 'break', pad: true },
    },
  },
  bossPlant: {
    bpm: 148, key: 92.5, leadWave: 'triangle', arpWave: 'triangle',
    arrangement: ['A', 'B', 'A', 'B', 'C'],
    sections: {
      A: { chords: [0, 3, 5, 4], bass: 'gallop', arp: 'bell', drums: 'boss', pad: true },
      B: { chords: [5, 4, 0, 1], bass: 'gallop', arp: 'up', drums: 'boss', pad: true, lead: ['18 . . 16 . . 14 . 16 . . . 18 . . .', '17 . . 15 . . 13 . 15 . . . 17 . . .', '14 . 16 . 18 . 21 . 18 . 16 . 14 . . .', '15 . . . . . 14 . 13 . . . . . . .'] },
      C: { chords: [3, 3, 4, 4], bass: 'long', arp: 'bell', drums: 'break', pad: true },
    },
  },
  bossTower: {
    bpm: 160, key: 82.41, leadWave: 'sawtooth', arpWave: 'square',
    arrangement: ['A', 'B', 'A', 'B', 'C'],
    sections: {
      A: { chords: [0, 0, 6, 5], bass: 'gallop', arp: 'up', drums: 'boss' },
      B: { chords: [3, 4, 5, 4], bass: 'gallop', arp: 'up', drums: 'boss', pad: true, lead: ['14 14 . 14 16 . 14 . 12 . 14 . 11 . . .', '15 15 . 15 17 . 15 . 13 . 15 . 12 . . .', '16 . 14 . 12 . 11 . 12 . 14 . 16 . 18 .', '18 . . . 17 . . . 18 . . . . . . .'] },
      C: { chords: [0, 1, 0, 1], bass: 'pump', arp: 'updown', drums: 'break', pad: true },
    },
  },
  ending: {
    bpm: 76, key: 130.81, leadWave: 'triangle', arpWave: 'triangle',
    arrangement: ['A', 'B'],
    sections: {
      A: { chords: [2, 6, 0, 5], pad: true, arp: 'sparse', bass: 'long' },
      B: { chords: [2, 6, 5, 4], pad: true, arp: 'updown', bass: 'long', lead: ['16 . . . 14 . . . 13 . . . 11 . . .', '13 . . . . . . . 11 . . . . . . .', '12 . . . 14 . . . 16 . . . 14 . . .', '11 . . . . . . . . . . . . . . .'] },
    },
  },
};

// ベースの刻み方。1小節 = 16個。0 = 和音の一番下の音、4 = その5度上、7 = 1オクターブ上、null は休み
const _ = null;
export const BASS = {
  long: [0, _, _, _, _, _, _, _, _, _, _, _, 0, _, _, _],
  pump: [0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 0, _],
  drive: [0, 0, _, 0, 0, _, 0, _, 0, 0, _, 0, 0, _, 4, _],
  gallop: [0, _, 0, 0, 0, _, 0, 0, 0, _, 0, 0, 7, _, 0, 0],
};

// 和音の散らし方。1小節 = 16個。数字は和音の何番目の音か（0〜2、3 は1オクターブ上の一番下の音）
export const ARP = {
  sparse: [0, _, _, _, 2, _, _, _, 1, _, _, _, 3, _, _, _],
  updown: [0, _, 1, _, 2, _, 3, _, 2, _, 1, _, 0, _, 1, _],
  up: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
  bell: [3, _, _, 2, _, _, 1, _, _, 3, _, _, 2, _, 0, _],
};

// ドラム。1小節 = 16個。k = キック, s = スネア, h = ハイハット
export const DRUMS = {
  soft: { k: 'x.......x.......', s: '................', h: '....x.......x...' },
  half: { k: 'x.........x.....', s: '........x.......', h: 'x...x...x...x...' },
  four: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
  drive: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  boss: { k: 'x.x.x..xx.x.x..x', s: '....x.......x.x.', h: 'xxxxxxxxxxxxxxxx' },
  break: { k: 'x...............', s: '............x...', h: '....x.......x...' },
};
