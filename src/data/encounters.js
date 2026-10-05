// 遭遇（特殊部屋「遭遇」で会う人物と、選択肢）（2026-10-06 追加）
// 1件 = { id, ... } の形で足す。文章は下書き。
//   who     : 部屋にいる人物（src/data/characters.js の id）
//   color   : 部屋での見た目の色（src/data/theme.js の色名）
//   intro   : 話しかけたときの会話。最後の行のあとに選択肢が出る
//   choices : 選択肢（2つ）
//     label  : 選択肢に出す文
//     action : 起きること（src/game/encounters.js の ACTIONS の名前）
//     result : 選んだあとの会話
// 数値（払うHP、もらえるクレジットなど）は src/data/balance.js の ROOMGEN.encounter。
export const encounters = [
  {
    id: 'peddler',
    who: 'peddler',
    color: 'amber',
    intro: [
      { who: 'peddler', text: '……生きてる客は久しぶりだ。金はいらない。代わりに、あんたの冷却液を少しもらう。' },
      { who: 'jin', text: '冷却液？' },
      { who: 'peddler', text: '義体のやつさ。こっちじゃ金より値が張る。いい品を一つやるよ。' },
    ],
    choices: [
      {
        label: 'HPを払って装備をもらう',
        action: 'payHpForGear',
        result: [{ who: 'peddler', text: '毎度。……顔色が悪いな。まあ、死にはしないさ。' }],
      },
      {
        label: '断る',
        action: 'none',
        result: [{ who: 'peddler', text: 'そうかい。気が変わっても、次に会えるとは限らないがね。' }],
      },
    ],
  },
  {
    id: 'machine',
    who: 'machine',
    color: 'green',
    intro: [
      { who: 'machine', text: 'ホ……保守ヲ、続ケ……ル。部品ガ、足リナイ。' },
      { who: 'jin', text: '襲ってこないな。壊れかけか。' },
      { who: 'machine', text: '直シテ、クレルナラ……預カッタ物ヲ、渡ス。' },
    ],
    choices: [
      {
        label: '修復キットで直してやる',
        action: 'repairForImplant',
        result: [
          { who: 'machine', text: '……稼働率、回復。感謝スル。コレハ、アナタニ。' },
          { who: 'jin', text: '義体用の部品か。もらっておく。' },
        ],
      },
      {
        label: '部品を抜く',
        action: 'salvageCredits',
        result: [
          { who: 'machine', text: '保守ヲ……続ケ……' },
          { who: 'jin', text: '悪いな。こっちも仕事だ。' },
        ],
      },
    ],
  },
  {
    id: 'scavenger',
    who: 'scavenger',
    color: 'ice',
    intro: [
      { who: 'jin', text: '同業者か。……もう動かない。' },
      { who: 'jin', text: '装備はまだ使えそうだ。だが、こいつをやった奴が近くにいる。' },
    ],
    choices: [
      {
        label: '装備を拾う（次の戦闘で敵が増える）',
        action: 'lootBody',
        result: [{ who: 'jin', mood: 'angry', text: '……音を立てすぎた。来るぞ。' }],
      },
      {
        label: 'そのままにして、少し休む',
        action: 'rest',
        result: [{ who: 'jin', text: '借りは作らない。……少しだけ、ここで息を整える。' }],
      },
    ],
  },
];
