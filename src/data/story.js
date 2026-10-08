// 持ち帰り要素と世界観の文章（M5 で追加）
// 文章は下書き。自由に書き換えてよい（既存の作品・キャラクターに似せないこと）。

// ボス素材
export const materials = [
  { id: 'boarCore', name: 'ボアコア', color: 'shock' },
  { id: 'cryoCore', name: 'クライオコア', color: 'cold' },
  { id: 'overCore', name: 'オーバーコア', color: 'heat' },
  { id: 'serpentCore', name: 'サーペントコア', color: 'green' },
  { id: 'crabCore', name: 'クラブコア', color: 'amber' },
  { id: 'hydraCore', name: 'ハイドラコア', color: 'magenta' },
  { id: 'houndCore', name: 'ハウンドコア', color: 'red' },
  { id: 'spiderCore', name: 'スパイダーコア', color: 'ice' },
  { id: 'titanCore', name: 'タイタンコア', color: 'heat' },
  { id: 'mothCore', name: 'モスコア', color: 'magenta' },
  { id: 'lensCore', name: 'レンズコア', color: 'amber' },
  { id: 'breakerCore', name: 'ブレーカーコア', color: 'cyan' },
];

// 出撃前の依頼文（隠れ家の出撃画面に出す）
export const brief = {
  title: '依頼 #0417',
  lines: [
    '標的：企業タワー最深部の統合管理機構「オーバーロード」',
    '経路：下層スラム → 冷却プラント → 企業タワー。各区画の主を止めないと先へ進めない',
    '依頼主：匿名（通信のみ）',
    '受注者：ジン（回収屋・義体率 50%）',
    '報酬：回収したコアは好きに使っていい',
    '備考：区画の構造は潜るたびに変わる。死んでも回収班は出ない',
  ],
};

// エンディング（オーバーロードを初めて倒したときに出す）。@noise は依頼主の名前（記号の並びでごまかして表示される）
export const ending = {
  title: 'OVERLOAD // SHUTDOWN',
  lines: [
    'オーバーロード、停止。',
    'タワーの灯りが、上の階から順に消えていく。',
    '',
    '猪も、飛竜も、この機構も、最後まで同じ命令を守っていた。',
    '「保守を続けろ」。命令を出した人間は、もうどこにもいない。',
    '',
    '@noise＞ ……止まった。これで、私の一部も止まった。',
    '@noise＞ だが、私はまだ残っている。次の区画でも、同じことを頼みたい。',
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
  {
    id: 'ov-01', area: 'tower', source: 'vault', title: '役員会議 議事録',
    text: '保守用の機体が指示に従わなくなった件は、外部に出さない。回収はしない。区画ごと閉じる。',
  },
  {
    id: 'ov-02', area: 'tower', source: 'vault', title: '統合管理機構 仕様書',
    text: 'オーバーロードは、都市の電力・冷却・警備をまとめて管理する。人の承認は要らない。そう設計した。',
  },
  {
    id: 'ov-03', area: 'tower', source: 'vault', title: '最後の業務連絡',
    text: '全社員は退去のこと。タワーの管理は機構に引き継ぐ。再開の予定は追って連絡する。——この連絡が最後になった。',
  },
  {
    id: 'ov-core', area: 'tower', source: 'boss', title: 'オーバーロードのコアログ',
    text: '管理対象：都市全域。管理者：不在。命令：保守を続けろ。命令の発信元を照合……発信元は、この機構自身。',
  },
  // ---- マップ2「排水区」 ----
  {
    id: 'ps-01', area: 'sewer', source: 'vault', title: '下水管理 作業記録',
    text: 'ミカゲ重工 都市基盤課。清掃機 PS シリーズは、配管の詰まりを見つけて取り除く。管の中を進めるように、体を細長い節でつないだ。',
  },
  {
    id: 'ps-05', area: 'sewer', source: 'vault', title: '点検員の報告',
    text: '詰まりを取り除くたびに、清掃機が長くなっている。取り除いた配管を、自分の節として継ぎ足しているらしい。報告は「仕様の範囲内」で閉じられた。',
  },
  {
    id: 'ps-notice', area: 'sewer', source: 'vault', title: '住民向けの掲示',
    text: '下水道には近づかないでください。水が流れなくなった場合は、そのまま待ってください。——担当部署の名前は、消されている。',
  },
  {
    id: 'ps-core', area: 'sewer', source: 'boss', title: 'パイプサーペントのコアログ',
    text: '詰まり検知：1件。詰まり検知：1件。詰まり検知：1件。……検知した詰まりは、どれも、この機体自身だった。',
  },
  {
    id: 'tc-01', area: 'reservoir', source: 'vault', title: '貯水槽 設計メモ',
    text: '街の三日ぶんの水をためる。水門は、保守機 TC が一台で開け閉めする。人は要らない。そう書いてある。',
  },
  {
    id: 'tc-03', area: 'reservoir', source: 'vault', title: '破損タンクの処理依頼',
    text: '割れたタンクの撤去を依頼。返答なし。再依頼。返答なし。……翌月、保守機がそのタンクを背中に載せて歩いているのが見つかった。',
  },
  {
    id: 'tc-memo', area: 'reservoir', source: 'vault', title: '誰かの走り書き',
    text: '水はもう来ない。なのに、あいつは毎朝、決まった時間に水門を開けて、閉める。見ていると、こっちまで待ってしまう。',
  },
  {
    id: 'tc-core', area: 'reservoir', source: 'boss', title: 'タンククラブのコアログ',
    text: '水位：0。水門：正常。貯水槽：守る。水位：0。水門：正常。貯水槽：守る。',
  },
  {
    id: 'sh-01', area: 'purifier', source: 'vault', title: '浄水プラント 運転記録',
    text: '汚れを取り除き、きれいな水を街へ返す。取り除いた汚泥は、月に一度、外へ運び出す。運び出す係は、三年前から来ていない。',
  },
  {
    id: 'sh-04', area: 'purifier', source: 'vault', title: '制御機の自己診断',
    text: '汚泥の置き場：満杯。代わりの置き場：なし。対処：本機の内部に保管する。——この行が、四百回くり返されている。',
  },
  {
    id: 'sh-memo', area: 'purifier', source: 'vault', title: '最後の当直の日誌',
    text: '首が増えた、と言っても誰も信じない。汚れをためこむ場所が足りなくて、体を増やしたんだ。きれいにしたかっただけなのに。',
  },
  {
    id: 'sh-core', area: 'purifier', source: 'boss', title: 'スラッジハイドラのコアログ',
    text: '浄水量：0。保管した汚泥：測定不能。命令：街の水をきれいに保て。命令は守られている、と機体は記録している。',
  },
  // ---- マップ4「停電区」 ----
  {
    id: 'le-01', area: 'darkstreet', source: 'vault', title: '送電停止の通知',
    text: '第四区への送電を、本日をもって停止する。居住者の退去は完了済み。なお、区内の保守機は回収しない。電源が切れれば、止まるはずである。',
  },
  {
    id: 'le-04', area: 'darkstreet', source: 'vault', title: '街灯保守機 仕様書',
    text: 'LE シリーズは、切れた灯りを見つけて、取り替える。古い灯りは体内に回収する。灯りが点いていれば、次の灯りへ向かう。',
  },
  {
    id: 'le-memo', area: 'darkstreet', source: 'vault', title: '最後の住人の書き置き',
    text: '非常灯だけは、電池で点く。あいつはそれを「切れかけ」だと思って、外して持っていく。持っていった先で、灯りは消える。それでまた、探しに行く。',
  },
  {
    id: 'le-core', area: 'darkstreet', source: 'boss', title: 'ランプイーターのコアログ',
    text: '点検：消灯。交換：在庫なし。回収：完了。点検：消灯。交換：在庫なし。回収：完了。——灯りを、探している。',
  },
  {
    id: 'ss-01', area: 'substation', source: 'vault', title: '変電所 警備規程',
    text: '第四変電所の警備機 SS は、構内に入った者を照らし、身分を確かめる。確かめられない者は、退去させる。照らすことをやめてはならない。',
  },
  {
    id: 'ss-02', area: 'substation', source: 'vault', title: '送電停止後の点検記録',
    text: '送電は止まったが、警備機は電池で動いている。構内に、確かめるべき者はもういない。それでも灯りは回り続けている。止める手順は、送電がある前提で書かれていた。',
  },
  {
    id: 'ss-memo', area: 'substation', source: 'vault', title: '作業員の走り書き',
    text: '光の中に立つな。あれは、照らした相手しか見えていない。暗い所にいれば、すぐ横を通っても気づかない。光ったら、顔を背けろ。',
  },
  {
    id: 'ss-core', area: 'substation', source: 'boss', title: 'サーチライト・センチネルのコアログ',
    text: '照合：該当なし。照合：該当なし。照合：該当なし。——登録された者は、誰も来ない。照らし続ける。',
  },
  {
    id: 'mb-01', area: 'control', source: 'vault', title: '主幹遮断器 動作規程',
    text: '主幹遮断器 MB は、系統に異常を見つけたら、電気を止める。異常がなくなるまで、入れ直してはならない。止めることが、守ることである。',
  },
  {
    id: 'mb-02', area: 'control', source: 'vault', title: '制御室の当直日誌',
    text: '第四区の送電を止めた日、あれは「異常なし」を返さなかった。人がいない区画を、あれは異常だと判断した。人が戻るまで、入れ直さないつもりらしい。',
  },
  {
    id: 'mb-memo', area: 'control', source: 'vault', title: '壁の落書き',
    text: '本物は、ちらついている。あれは、自分で自分の電気を切ったり入れたりしているから。偽物は、ずっと点いたままだ。',
  },
  {
    id: 'mb-core', area: 'control', source: 'boss', title: 'ブレーカーのコアログ',
    text: '異常：居住者 0。復旧条件：居住者の帰還。再投入：不可。再投入：不可。再投入：不可。——守っている。',
  },
  // ---- マップ3「建設区」 ----
  {
    id: 'sc-01', area: 'yard', source: 'vault', title: '資材管理 台帳',
    text: 'ミカゲ重工 建設課。運搬機 SC シリーズは、足りない資材を見つけて、現場へ運ぶ。足りないものがなくなれば、止まる。そういう設計だった。',
  },
  {
    id: 'sc-06', area: 'yard', source: 'vault', title: '現場監督の連絡',
    text: '設計図が届かない。何を建てるのか分からないまま、資材の注文だけが出続けている。運搬機は「不足」としか言わない。',
  },
  {
    id: 'sc-memo', area: 'yard', source: 'vault', title: '作業員の落書き',
    text: 'あの犬、置き場の鉄くずまで背負っていった。自分の背中が、いちばん近い置き場だと気づいたらしい。',
  },
  {
    id: 'sc-core', area: 'yard', source: 'boss', title: 'スクラップハウンドのコアログ',
    text: '不足：鉄骨。不足：鋲。不足：設計図。不足：設計図。不足：設計図。——探索を続ける。',
  },
  {
    id: 'gs-01', area: 'viaduct', source: 'vault', title: '高架工事 進捗表',
    text: '架設機 GS シリーズは、橋げたを一本ずつ張って、対岸までつなぐ。対岸の座標は、工事の途中で「未定」に書き換えられた。',
  },
  {
    id: 'gs-03', area: 'viaduct', source: 'vault', title: '測量班の報告',
    text: '橋げたが、橋げたの上に張られている。行き先のない桁が、何層も。上から見ると、巣にしか見えない。',
  },
  {
    id: 'gs-memo', area: 'viaduct', source: 'vault', title: '撤収の張り紙',
    text: '本日をもって現場を閉鎖する。架設機は停止させること。——停止の手順は、三枚目に書いてあったはずだ。三枚目は、どこにもない。',
  },
  {
    id: 'gs-core', area: 'viaduct', source: 'boss', title: 'ガーダースパイダーのコアログ',
    text: '架設：完了。接続先：なし。架設：完了。接続先：なし。……つながるまで、張り続ける。',
  },
  {
    id: 'ct-01', area: 'spire', source: 'vault', title: '塔 建設計画書',
    text: '街でいちばん高い塔を建てる。階数は「追って指示する」。建設機 CT は、指示があるまで積み上げを続けること。',
  },
  {
    id: 'ct-05', area: 'spire', source: 'vault', title: '資材課への苦情',
    text: '塔のクレーンが、現場の資材を使い切った。次に、足場を外して積んだ。その次に、隣のクレーンを外して積んだ。',
  },
  {
    id: 'ct-memo', area: 'spire', source: 'vault', title: '最上階の落書き',
    text: 'ここが何階なのか、もう誰も数えていない。あいつは、自分の腕を一本外して、梁にした。完成したら、どうするつもりなんだろう。',
  },
  {
    id: 'ct-core', area: 'spire', source: 'boss', title: 'クレーンタイタンのコアログ',
    text: '階数の指示：未着。積み上げ：継続。資材：自機。階数の指示：未着。——完成まで、あと不明階。',
  },
];
