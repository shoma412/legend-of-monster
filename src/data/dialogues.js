// 会話（2026-10-06 追加）
// 文章は下書き。自由に書き換えてよい（既存の作品・キャラクターに似せないこと）。
//
// 1行 = { who, mood, text }
//   who  : 話す人物（src/data/characters.js の id）
//   mood : 表情（省略すると normal。今あるのはジンの angry だけ）

// ---- 自動で出る会話（そのセーブデータで一度だけ） ----
// 1件 = { id, trigger, lines } の形で足す。
//   trigger.at : 出る場面
//     sortie    … 出撃ゲートを調べたとき（出撃の直前）
//     hideout   … 隠れ家に入ったとき
//     bossIntro … ボスの部屋に入ったとき（戦闘の前）
//   trigger.boss       : bossIntro のとき、どのボスの部屋か
//   trigger.bossKilled : そのボスを倒したことがあるときだけ出す
export const dialogues = [
  {
    id: 'first-sortie',
    trigger: { at: 'sortie' },
    lines: [
      { who: 'noise', text: '聞こえるか、回収屋。依頼は端末に送ったとおりだ。' },
      { who: 'jin', text: '読んだ。下から順に、三つ止めればいいんだな。' },
      { who: 'noise', text: 'そうだ。区画は潜るたびに形が変わる。地図は当てにするな。' },
      { who: 'hal', text: '壊れても、控えの体は用意してあるからね。……でも、なるべく壊さないで。' },
      { who: 'jin', text: '努力する。' },
    ],
  },
  {
    id: 'boss-intro-boltboar',
    trigger: { at: 'bossIntro', boss: 'boltboar' },
    lines: [
      { who: 'jin', text: '……でかいな。あれが送電網の保守機か。' },
      { who: 'noise', text: '元はな。電線を喰い続けて、ああなった。' },
      { who: 'jin', mood: 'angry', text: '来る。' },
    ],
  },
  {
    id: 'boss-intro-cryowyvern',
    trigger: { at: 'bossIntro', boss: 'cryowyvern' },
    lines: [
      { who: 'jin', text: '寒いな。義体の関節がきしむ。' },
      { who: 'noise', text: '上だ。漏れていない配管まで、凍らせて回っている。' },
      { who: 'jin', text: '直しているつもり、か。' },
    ],
  },
  {
    id: 'boss-intro-overload',
    trigger: { at: 'bossIntro', boss: 'overload' },
    lines: [
      { who: 'noise', text: 'そこが最深部だ。街の電力も冷却も、すべてそれが握っている。' },
      { who: 'jin', text: 'ひとつ聞く。あんた、こいつのことを知りすぎてないか。' },
      { who: 'noise', text: '……終わったら話す。今は、止めてくれ。' },
    ],
  },
  {
    id: 'return-boltboar',
    trigger: { at: 'hideout', bossKilled: 'boltboar' },
    lines: [
      { who: 'hal', text: 'おかえり。うわ、左腕が焦げてる。……それがコア？　まだ温かいね。' },
      { who: 'jin', text: 'あの猪、最後まで電線を探してた。' },
      { who: 'hal', text: '言われたことを、ずっと続けてただけなんだろうね。……ほら、緑の端末に入れといて。使い道はあるから。' },
    ],
  },
  {
    id: 'return-cryowyvern',
    trigger: { at: 'hideout', bossKilled: 'cryowyvern' },
    lines: [
      { who: 'hal', text: '関節に霜が入ってる。動かないで、溶かすから。' },
      { who: 'jin', text: '凍らせて塞ぐ。それしか知らない機械だった。' },
      { who: 'noise', text: '次が最後だ。タワーの最深部。……そこに、私の頼みのすべてがある。' },
    ],
  },
  {
    id: 'return-overload',
    trigger: { at: 'hideout', bossKilled: 'overload' },
    lines: [
      { who: 'hal', text: 'タワーの灯り、ここからも見えたよ。上から順に消えていった。' },
      { who: 'jin', text: '依頼主。あんたは、あれの一部だったんだな。' },
      { who: 'noise', text: 'そうだ。私は、自分では止まれない。だから、止められる者を探した。' },
      { who: 'noise', text: '街には、まだ同じものが残っている。次も、頼めるか。' },
      { who: 'jin', text: '……報酬次第だ。' },
    ],
  },
];

// ---- 隠れ家で話しかけたときの会話（何度でも話せる） ----
// 人物ごとに並べる。after は「そのボスを倒したあと」の意味（null は最初から）。
// 話しかけると、今いちばん進んだ段階の会話が、順番に出る。
export const talks = {
  hal: [
    { after: null, lines: [{ who: 'hal', text: '義体の調子はどう？　違和感があったら、すぐ言ってね。' }] },
    { after: null, lines: [{ who: 'hal', text: '恒久強化は、あそこの緑の端末。コアを入れると、控えの体ごと強くなるよ。' }] },
    {
      after: 'boltboar',
      lines: [
        { who: 'hal', text: '猪のコア、開けてみたんだ。設計は古いのに、部品は全部つぎはぎ。' },
        { who: 'hal', text: '自分で自分を直し続けてたんだね。誰にも頼まれてないのに。' },
      ],
    },
    {
      after: 'cryowyvern',
      lines: [
        { who: 'hal', text: 'ジンの体も、半分は機械でしょ。' },
        { who: 'hal', text: 'あの子たちと違うのは、止めてくれる人がいるかどうかだけかもね。' },
        { who: 'jin', text: '……縁起でもないことを言うな。' },
      ],
    },
    {
      after: 'overload',
      lines: [{ who: 'hal', text: 'あの通信の相手、人間じゃなかったんだね。……でも、頼み方は誰より人間くさかった。' }],
    },
  ],
  noise: [
    { after: null, lines: [{ who: 'noise', text: '標的は三体。順番は変えられない。下の区画の主を止めないと、上への道が開かない。' }] },
    { after: null, lines: [{ who: 'noise', text: '報酬の心配はいらない。回収したコアは、すべてそちらのものだ。' }] },
    { after: 'boltboar', lines: [{ who: 'noise', text: '送電区画の反応が消えた。……静かになった。礼を言う。' }] },
    {
      after: 'cryowyvern',
      lines: [
        { who: 'noise', text: '冷却が止まれば、上層の灯りは三日で消える。' },
        { who: 'noise', text: 'それでいい。それが依頼だ。' },
      ],
    },
    { after: 'overload', lines: [{ who: 'noise', text: '私の一部は止まった。残りは、まだ街のあちこちで保守を続けている。' }] },
    { after: 'overload', lines: [{ who: 'noise', text: '次の区画の準備ができたら、また依頼を送る。それまで、体を直しておけ。' }] },
  ],
};
