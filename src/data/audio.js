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
// file が null の間は、synth の名前の仮の曲（下の BGM_SYNTH）をコードで鳴らす。
// Suno などで作った曲に差し替えるときは、ここの file を書き換えるだけでよい。
export const BGM = {
  title: { file: null, synth: 'calm' },
  hideout: { file: null, synth: 'calm' },
  battle: { file: null, synth: 'drive' },
  boss: { file: null, synth: 'tense' },
  ending: { file: null, synth: 'calm' },
};

// 仮の曲。16分音符ごとの並びで、数字は音の高さ（半音。0 = root の高さ）、null は休み
//   bpm : 速さ / root : 基準の高さ（Hz） / bass・lead : 音の並び / hat : true のところでハイハット
export const BGM_SYNTH = {
  calm: {
    bpm: 84, root: 110,
    bass: [0, null, null, null, null, null, 0, null, -5, null, null, null, null, null, -2, null],
    lead: [12, null, 15, null, 19, null, null, null, 17, null, 15, null, 10, null, null, null],
    hat: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    vol: 0.5,
  },
  drive: {
    bpm: 128, root: 98,
    bass: [0, 0, null, 0, 0, null, 0, null, -2, -2, null, -2, 3, null, 3, null],
    lead: [12, null, null, 15, null, 12, null, null, 10, null, null, 12, null, 15, 17, null],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
    vol: 0.55,
  },
  tense: {
    bpm: 148, root: 87,
    bass: [0, 0, 0, null, 0, 0, 1, null, 0, 0, 0, null, 3, 3, 1, null],
    lead: [12, null, 13, null, 12, null, 18, null, 12, null, 13, null, 19, 18, 13, null],
    hat: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    vol: 0.6,
  },
};
