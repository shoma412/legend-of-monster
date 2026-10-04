# CREDITS

外部素材・AI生成素材を入れたら、ここに「ファイル名・ツール名・プラン・日付・プロンプトや出典」を記録する。

## フォント

| 素材 | 使っている場所 | 出典 | ライセンス | 追加日 |
|---|---|---|---|---|
| Chakra Petch（500 / 700） | 見出し・英数字。`index.html` から Google Fonts を読み込み | https://fonts.google.com/specimen/Chakra+Petch | SIL Open Font License 1.1 | 2026-10-04 |
| Noto Sans JP（400 / 700） | 日本語の文字。`index.html` から Google Fonts を読み込み | https://fonts.google.com/noto/specimen/Noto+Sans+JP | SIL Open Font License 1.1 | 2026-10-04 |

## 絵

外部の画像素材・AI生成の画像素材は使っていない。
キャラクター、敵、ボス、エフェクト、アイコン、UI は、すべてコードで描いている（`src/render/`）。

## SE

外部の音声素材・AI生成の音声素材は使っていない。
効果音は、ブラウザの Web Audio でその場で合成している。音の作り方（波形・高さ・長さ）は `src/data/audio.js` の `SE` に書いてある。

## BGM

外部の音声素材・AI生成の音声素材は使っていない。
今鳴っているのは、コードで合成した仮の曲（`src/data/audio.js` の `BGM_SYNTH`）。

音楽生成AI（Suno など）で作った曲に差し替えるときは、ファイルを `public/audio/bgm/` に置き、`src/data/audio.js` の `BGM` の `file` に場所を書く。そのうえで、下の表に記録する。

| ファイル名 | 使う場面 | ツール名 | プラン | 作った日 | プロンプト |
|---|---|---|---|---|---|
| （まだなし） | | | | | |

注意：Suno の無料プランで作った曲は個人的・非商用の利用に限られる。販売や収益化をすることになったら、有料プランで作り直すか、別の曲に差し替える。

## 文章

ゲーム内の文章（依頼文、通信ログ、データ片、エンディング、実績の名前）は、Claude Code（Anthropic）の下書きを元にしている。既存の作品・キャラクター・作家に似せる指示はしていない。
