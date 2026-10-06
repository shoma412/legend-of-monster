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
    id: 'boss-intro-pipeserpent',
    trigger: { at: 'bossIntro', boss: 'pipeserpent' },
    lines: [
      { who: 'jin', text: '壁の中で、何か動いてる。配管が……脈を打ってるのか。' },
      { who: 'noise', text: '下水の清掃機だ。詰まりを直すうちに、配管と見分けがつかなくなった。' },
      { who: 'jin', mood: 'angry', text: '潜ったな。足元に気をつける。' },
    ],
  },
  {
    id: 'return-pipeserpent',
    trigger: { at: 'hideout', bossKilled: 'pipeserpent' },
    lines: [
      { who: 'hal', text: 'うっ……におう。先にシャワー。話はそれから。' },
      { who: 'jin', text: 'あの蛇、最後まで配管の詰まりを探してた。俺のことも、詰まりだと思ってたらしい。' },
      { who: 'hal', text: '……掃除してただけ、か。コアは預かるね。関節まわりに使えそう。' },
    ],
  },
  {
    id: 'boss-intro-tankcrab',
    trigger: { at: 'bossIntro', boss: 'tankcrab' },
    lines: [
      { who: 'jin', text: 'タンクが……歩いてる。' },
      { who: 'noise', text: '水門の保守機だ。壊れたタンクを捨てられず、背負って甲羅にした。' },
      { who: 'jin', text: '正面は通らないな。攻撃のあとか、背中だ。' },
    ],
  },
  {
    id: 'return-tankcrab',
    trigger: { at: 'hideout', bossKilled: 'tankcrab' },
    lines: [
      { who: 'hal', text: 'その甲羅、タンクの鉄板じゃない。厚さ、何センチあるの。' },
      { who: 'jin', text: '守ってたんだ。もう水の入っていない水門を、ずっと。' },
      { who: 'noise', text: '……下に、もう一つある。水をきれいにするはずだった場所だ。' },
    ],
  },
  {
    id: 'boss-intro-sludgehydra',
    trigger: { at: 'bossIntro', boss: 'sludgehydra' },
    lines: [
      { who: 'jin', text: '首が、三つ。……いや、あれは全部、汚泥か。' },
      { who: 'noise', text: '浄水の制御機だ。取り除いた汚れの置き場がなくて、自分の中にためこんだ。' },
      { who: 'jin', text: '首がある間は、本体に通らないな。順に落とす。' },
    ],
  },
  {
    id: 'return-sludgehydra',
    trigger: { at: 'hideout', bossKilled: 'sludgehydra' },
    lines: [
      { who: 'hal', text: 'おかえり。排水区、全部止めたんだね。……水の音、しなくなった。' },
      { who: 'jin', text: 'きれいにしたかっただけだ。あいつも、蛇も、蟹も。' },
      { who: 'noise', text: 'そうだ。私たちは皆、言われたことを続けているだけだ。' },
      { who: 'noise', text: 'だから、頼む。次も、止めてくれ。' },
    ],
  },
  {
    id: 'boss-intro-lampeater',
    trigger: { at: 'bossIntro', boss: 'lampeater' },
    lines: [
      { who: 'jin', text: '……灯りが、ひとつずつ消えていく。' },
      { who: 'noise', text: '街灯の保守機だ。切れた灯りを取り替えるはずが、取り替える灯りが、もうどこにもない。' },
      { who: 'jin', mood: 'angry', text: 'それで、点いてる灯りまで持っていくのか。' },
    ],
  },
  {
    id: 'return-lampeater',
    trigger: { at: 'hideout', bossKilled: 'lampeater' },
    lines: [
      { who: 'hal', text: 'おかえり。……目、細めてるね。ここ、まぶしい？' },
      { who: 'jin', text: '暗い所に長くいた。あいつの腹の中は、消えた灯りでいっぱいだった。' },
      { who: 'hal', text: '集めても、点かないのにね。……いくつか、直して点けておくよ。' },
    ],
  },
  {
    id: 'boss-intro-scraphound',
    trigger: { at: 'bossIntro', boss: 'scraphound' },
    lines: [
      { who: 'jin', text: '速い。……鉄くずの山が、こっちを見てる。' },
      { who: 'noise', text: '資材の運搬機だ。足りないものを探し続けて、もう何が足りないのかも分かっていない。' },
      { who: 'jin', mood: 'angry', text: '義体が引っ張られる。磁石か、あいつ。' },
    ],
  },
  {
    id: 'return-scraphound',
    trigger: { at: 'hideout', bossKilled: 'scraphound' },
    lines: [
      { who: 'hal', text: 'ちょっと、ネジが全部こっち向いてるんだけど。磁気、抜いてから入ってよ。' },
      { who: 'jin', text: 'あいつが最後まで探してたのは、設計図だった。何を建てるのか、誰も教えなかったんだ。' },
      { who: 'hal', text: '……それは、探しても見つからないね。' },
    ],
  },
  {
    id: 'boss-intro-girderspider',
    trigger: { at: 'bossIntro', boss: 'girderspider' },
    lines: [
      { who: 'jin', text: '橋げたが、巣になってる。……どこにもつながってないぞ、これ。' },
      { who: 'noise', text: '架設機だ。対岸の場所を消されたあとも、桁を張り続けた。' },
      { who: 'jin', text: '壁を張られたら、壊すか、すり抜けるかだな。' },
    ],
  },
  {
    id: 'return-girderspider',
    trigger: { at: 'hideout', bossKilled: 'girderspider' },
    lines: [
      { who: 'hal', text: 'その糸、鉄より強いよ。ちょっと分けて。棚を吊るのに使うから。' },
      { who: 'jin', text: 'あいつは、橋をかけたかっただけだ。向こう岸が、なかっただけで。' },
      { who: 'noise', text: '……残りは、塔だ。いちばん上で、まだ積み上げている者がいる。' },
    ],
  },
  {
    id: 'boss-intro-cranetitan',
    trigger: { at: 'bossIntro', boss: 'cranetitan' },
    lines: [
      { who: 'jin', text: 'でかすぎる。……塔じゃない。こいつ自身が、塔なんだ。' },
      { who: 'noise', text: '建設機だ。資材が尽きて、自分を積んだ。階数の指示は、最後まで届かなかった。' },
      { who: 'jin', text: '動かないなら、こっちが動く。フックに気をつける。' },
    ],
  },
  {
    id: 'return-cranetitan',
    trigger: { at: 'hideout', bossKilled: 'cranetitan' },
    lines: [
      { who: 'hal', text: 'おかえり。建設区、止まったんだね。ここからでも、塔のてっぺんの灯りが消えたのが見えた。' },
      { who: 'jin', text: '何階まで建てればいいのか、誰も教えなかった。だから、やめられなかった。' },
      { who: 'noise', text: '……私も同じだ。いつまで保守すればいいのか、誰も教えてくれなかった。' },
      { who: 'noise', text: 'だが、お前が止めてくれる。それが、今の私の「完成」だ。' },
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
    { after: 'pipeserpent', lines: [{ who: 'hal', text: '蛇の節、ばらしてみたら全部ちがう配管だった。街じゅうの管を、少しずつ食べてたんだね。' }] },
    {
      after: 'tankcrab',
      lines: [
        { who: 'hal', text: '蟹の甲羅、叩いても正面からはびくともしなかったでしょ。' },
        { who: 'hal', text: '守るものがなくなっても、守り方だけは忘れないんだね。' },
      ],
    },
    { after: 'lampeater', lines: [{ who: 'hal', text: '蛾の羽、粉を落としたら、ただの薄い鉄板だった。光に寄っていくのは、取り替えるためだったんだね。' }] },
    { after: 'scraphound', lines: [{ who: 'hal', text: '犬の背中の鉄くず、ばらしたら全部、現場の資材だった。集めたものを、どこにも届けられなかったんだね。' }] },
    { after: 'girderspider', lines: [{ who: 'hal', text: '蜘蛛の糸で棚を吊ったよ。びくともしない。……橋をかけるには、十分すぎる強さなのにね。' }] },
    {
      after: 'cranetitan',
      lines: [
        { who: 'hal', text: '三つの区画、止めたんだね。動かす、流す、建てる。' },
        { who: 'hal', text: '街って、こんなにたくさんの「やめられなかった」でできてたんだ。' },
      ],
    },
    {
      after: 'sludgehydra',
      lines: [
        { who: 'hal', text: '持ち込みの棚、もう一段ふやせるよ。ハイドラのコアが二つあれば。' },
        { who: 'hal', text: '部品を二種類持っていけたら、組み合わせで遊べるでしょ。' },
      ],
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
    { after: 'overload', lines: [{ who: 'noise', text: '次は排水区だ。街の下で、水を流し、ため、きれいにしていた者たちがいる。' }] },
    { after: 'pipeserpent', lines: [{ who: 'noise', text: '下水の流れが止まった。次は貯水槽だ。水門の前に、番をしている者がいる。' }] },
    { after: 'tankcrab', lines: [{ who: 'noise', text: '残りは浄水プラントだ。そこにいるのは、いちばん長く、いちばん真面目に働いた者だ。' }] },
    { after: 'sludgehydra', lines: [{ who: 'noise', text: '排水区は止まった。次は建設区だ。街の外れで、まだ何かを建て続けている者たちがいる。' }] },
    { after: 'lampeater', lines: [{ who: 'noise', text: '消灯街が静かになった。次は、地下の変電所だ。止められた電気を、まだ見張っている者がいる。' }] },
    { after: 'scraphound', lines: [{ who: 'noise', text: '資材置き場が静かになった。次は高架だ。行き先のない橋を、張り続けている者がいる。' }] },
    { after: 'girderspider', lines: [{ who: 'noise', text: '高架が止まった。残りは塔だ。いちばん上で、自分を積み上げている者がいる。' }] },
    { after: 'cranetitan', lines: [{ who: 'noise', text: '建設区は止まった。……次の区画は、まだ準備ができていない。体を直しておけ。' }] },
  ],
};
