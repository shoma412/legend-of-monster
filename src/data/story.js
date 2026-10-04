// 持ち帰り要素と世界観の文章（M5 で追加）
// 文章は下書き。自由に書き換えてよい（既存の作品・キャラクターに似せないこと）。

// ボス素材
export const materials = [
  { id: 'boarCore', name: 'ボアコア', color: 'shock' },
  { id: 'cryoCore', name: 'クライオコア', color: 'cold' },
  { id: 'overCore', name: 'オーバーコア', color: 'heat' },
];

// 出撃前の依頼文（隠れ家の出撃画面に出す）
export const brief = {
  title: '依頼 #0417',
  lines: [
    '標的：下層スラム最深部の暴走個体「ボルトボア」',
    '依頼主：匿名（仲介屋経由）',
    '報酬：回収したコアは好きに使っていい',
    '備考：区画の構造は潜るたびに変わる。死んでも回収班は出ない',
  ],
};

// データ片（企業の実験記録の断片）
// 1件 = { id, ... } の形で足す。
//   area   : 手に入るエリア
//   source : vault（データ金庫で拾う）/ boss（そのエリアのボスを倒すと手に入る）
export const fragments = [
  {
    id: 'bb-01', area: 'slum', source: 'vault', title: '実験記録 BB-01',
    text: 'ミカゲ重工 生体兵器課。試験体BBシリーズは、送電網の保守用として設計された。電線の被膜を噛み、漏電箇所を探す。それだけの機械だった。',
  },
  {
    id: 'bb-07', area: 'slum', source: 'vault', title: '実験記録 BB-07',
    text: '給電を止めても止まらない。試験体は自分で電線を探し、喰い、太り始めた。担当者は報告書に「学習の成果」と書いた。',
  },
  {
    id: 'bb-disposal', area: 'slum', source: 'vault', title: '廃棄指示書',
    text: 'BBシリーズは全機、下層スラムの旧送電区画へ廃棄。区画は封鎖する。住民への告知は不要。',
  },
  {
    id: 'bb-core', area: 'slum', source: 'boss', title: 'ボルトボアのコアログ',
    text: '稼働時間 41,000 時間。最後に受けた命令は「保守を続けろ」。命令を出した者の記録は残っていない。',
  },
  {
    id: 'cw-01', area: 'plant', source: 'vault', title: '冷却系統 保守記録',
    text: '冷却プラントは、都市の演算塔を冷やすために造られた。プラントが止まれば、上層の灯りは三日で消える。',
  },
  {
    id: 'cw-04', area: 'plant', source: 'vault', title: '試験体CW 飛行記録',
    text: '配管の点検には、飛べる機体が必要だった。CWシリーズは冷却剤を背負い、漏れた配管を凍らせて塞ぐ。',
  },
  {
    id: 'cw-memo', area: 'plant', source: 'vault', title: '担当者の走り書き',
    text: 'あいつは、漏れていない配管まで凍らせ始めた。止めに行った二人は戻らない。上には「順調」と報告しておく。',
  },
  {
    id: 'cw-core', area: 'plant', source: 'boss', title: 'クライオ・ワイバーンのコアログ',
    text: '保守対象：プラント全域。異常箇所：全域。処置：凍結。処置を継続する。',
  },
];
