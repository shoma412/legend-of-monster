# CREDITS

外部素材・AI生成素材を入れたら、ここに「ファイル名・ツール名・プラン・日付・プロンプトや出典」を記録する。

## フォント

| 素材 | 使っている場所 | 出典 | ライセンス | 追加日 |
|---|---|---|---|---|
| DotGothic16（400） | ゲーム中のすべての文字（ドット文字）。`index.html` から Google Fonts を読み込み | https://fonts.google.com/specimen/DotGothic16 | SIL Open Font License 1.1 | 2026-10-05 |
| Noto Sans JP（400 / 700） | DotGothic16 に無い字の補い。`index.html` から Google Fonts を読み込み | https://fonts.google.com/noto/specimen/Noto+Sans+JP | SIL Open Font License 1.1 | 2026-10-04 |

2026-10-05 まで見出しに使っていた Chakra Petch は、DotGothic16 への切り替えで使わなくなった。

## 絵

外部の画像素材・AI生成の画像素材は使っていない。
キャラクター、敵、ボス、エフェクト、アイコン、背景、UI は、すべてコードで描いている（`src/render/`）。

## SE

外部の音声素材・AI生成の音声素材は使っていない。
効果音は、ブラウザの Web Audio でその場で合成している。音の作り方（波形・高さ・長さ）は `src/data/audio.js` の `SE` に書いてある。

## BGM

**音楽：魔王魂**（https://maou.audio/ ）

BGM は、無料の音楽素材サイト「魔王魂」の曲を使っている。AI生成の曲ではない。

- ライセンス：クリエイティブ・コモンズ 表示 4.0 国際（CC BY 4.0）。利用規約：https://maou.audio/rule/ （2026-10-05 に確認）
- 条件：クレジット表記が必須（タイトル画面に「音楽：魔王魂」と表示している）。加工は可。自作の曲として公開しない
- ファイルは `public/audio/bgm/` に置き、`src/data/audio.js` の `BGM` の `file` で場面に割り当てている。加工はしていない（配布されているループ用の ogg ファイルそのまま）

| ファイル名 | 使う場面 | 曲名 | 出典 | 入手日 |
|---|---|---|---|---|
| maou_loop_bgm_cyber33.ogg | タイトル | サイバー33 | https://maou.audio/bgm_cyber33/ | 2026-10-05 |
| maou_loop_bgm_cyber34.ogg | 隠れ家 | サイバー34 | https://maou.audio/bgm_cyber34/ | 2026-10-05 |
| maou_loop_bgm_cyber38.ogg | エリア1 下層スラム | サイバー38 | https://maou.audio/bgm_cyber38/ | 2026-10-05 |
| maou_loop_bgm_cyber19.ogg | エリア2 冷却プラント | サイバー19 | https://maou.audio/bgm_cyber19/ | 2026-10-05 |
| maou_loop_bgm_cyber24.ogg | エリア3 企業タワー | サイバー24 | https://maou.audio/bgm_cyber24/ | 2026-10-05 |
| maou_loop_bgm_neorock80.ogg | ボス1 ボルトボア | ネオロック80 | https://maou.audio/bgm_neorock80/ | 2026-10-05 |
| maou_loop_bgm_neorock65.ogg | ボス2 クライオ・ワイバーン | ネオロック65 | https://maou.audio/bgm_neorock65/ | 2026-10-05 |
| maou_loop_bgm_cyber39.ogg | ボス3 オーバーロード | サイバー39 | https://maou.audio/bgm_cyber39/ | 2026-10-05 |
| maou_loop_bgm_cyber17.ogg | エンディング | サイバー17 | https://maou.audio/bgm_cyber17/ | 2026-10-05 |
| maou_loop_bgm_cyber42.ogg | マップ2 エリア1 下水道 | サイバー42 | https://maou.audio/bgm_cyber42/ | 2026-10-06 |
| maou_loop_bgm_cyber18.ogg | マップ2 エリア2 貯水槽 | サイバー18 | https://maou.audio/bgm_cyber18/ | 2026-10-06 |
| maou_loop_bgm_cyber08.ogg | マップ2 エリア3 浄水プラント | サイバー08 | https://maou.audio/bgm_cyber08/ | 2026-10-06 |
| maou_loop_bgm_neorock82.ogg | マップ2 ボス1 パイプサーペント | ネオロック82 | https://maou.audio/bgm_neorock82/ | 2026-10-06 |
| maou_loop_bgm_neorock62.ogg | マップ2 ボス2 タンククラブ | ネオロック62 | https://maou.audio/bgm_neorock62/ | 2026-10-06 |
| maou_loop_bgm_neorock59.ogg | マップ2 ボス3 スラッジハイドラ | ネオロック59 | https://maou.audio/bgm_neorock59/ | 2026-10-06 |
| maou_loop_bgm_cyber14.ogg | マップ3 エリア1 資材置き場 | サイバー14 | https://maou.audio/bgm_cyber14/ | 2026-10-07 |
| maou_loop_bgm_cyber28.ogg | マップ3 エリア2 高架の現場 | サイバー28 | https://maou.audio/bgm_cyber28/ | 2026-10-07 |
| maou_loop_bgm_cyber26.ogg | マップ3 エリア3 未完の塔 | サイバー26 | https://maou.audio/bgm_cyber26/ | 2026-10-07 |
| maou_loop_bgm_neorock68.ogg | マップ3 ボス1 スクラップハウンド | ネオロック68 | https://maou.audio/bgm_neorock68/ | 2026-10-07 |
| maou_loop_bgm_neorock66.ogg | マップ3 ボス2 ガーダースパイダー | ネオロック66 | https://maou.audio/bgm_neorock66/ | 2026-10-07 |
| maou_loop_bgm_neorock77.ogg | マップ3 ボス3 クレーンタイタン（隠しボスも、見つけたエリアのボス曲が流れる） | ネオロック77 | https://maou.audio/bgm_neorock77/ | 2026-10-07 |

曲のファイルを読み込めなかったときは、コードで合成した曲（`src/data/audio.js` の `SONGS`）が代わりに鳴る。こちらは外部素材を使っていない。

## 文章

ゲーム内の文章（依頼文、通信ログ、データ片、エンディング、実績の名前）は、Claude Code（Anthropic）の下書きを元にしている。既存の作品・キャラクター・作家に似せる指示はしていない。
