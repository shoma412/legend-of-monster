# Legend of Monster（コードネーム）

サイバーパンク都市を舞台にした、ブラウザで遊べる見下ろし視点の2Dハクスラ×ローグライク（ローグライト）アクション。
オーナーは村田さん。企画・仕様・テストプレイは村田さん、実装はClaude Codeが担当する。身内で遊ぶ非商用の趣味兼、大学での個人開発実績。

## 最重要ルール：仕様書は許可制

- `docs/` 以下（企画書.md・詳細仕様.md・実装計画.md）と、この `CLAUDE.md` は **村田さんの明示的な許可なしに編集しない**。シェルコマンド経由の書き換えも同じ扱い。
- 仕様を変えたほうがよいと思ったら、編集する前に「どのファイルのどこを、どう変えるか」を差分の形で提示し、許可をもらってから書き換える。
- 実装中に仕様と食い違う・仕様に書かれていないことが出てきたら、勝手に決めずに質問する。小さな数値調整（`src/data/balance` の値）だけは、変更内容を報告すれば仕様の更新なしで行ってよい。
- `.claude/settings.json` で上記ファイルの編集は毎回確認が出るようにしてある。この設定も勝手に外さない。

## 要素追加の要望が来たとき

村田さんはテストプレイしながら「ボスを増やしたい」「この要素が欲しい」と後から要望を出す前提。

1. 要望を仕様の言葉に直し、`docs/詳細仕様.md` への追記案を提示する
2. 村田さんの許可をもらって `docs/` を更新する
3. 実装する。データ定義の追加で済むなら、それで済ませる
4. 遊べる状態で報告する（何を足したか、どこで確かめられるか）

## 資料

- `docs/企画書.md`：目的、決定事項、素材の方針
- `docs/詳細仕様.md`：ラン構成、恒久強化、武器、装備、インプラント、敵、数値の目安
- `docs/実装計画.md`：マイルストーンと完了条件。上から順に進める
- `docs/試作版.html`：雰囲気確認用の1ファイル試作。見た目と手触りの参考にする（コードはそのまま流用しなくてよい）

## 技術

- HTML + JavaScript。ゲームフレームワークは Phaser、ビルドは Vite を想定。バージョンは作業開始時に公式サイトで最新の安定版を確認して決め、`package.json` に固定する
- 公開：GitHub Pages（GitHub Actions でビルドして公開）
- テスト：ゲームロジック（ダメージ計算、ドロップ抽選、部屋の生成、セーブデータ）は Vitest でユニットテストを書く
- セーブ：隠れ家の進行状況（ボス素材、恒久強化、解放済み武器、記録、データ片、実績）だけを localStorage に保存。ラン途中は自動では保存しないが、部屋をクリアしたところで「中断して終了」ができる（中断データはセーブ枠ごとに1つ。再開すると消える）。セーブデータにはバージョン番号を持たせる。セーブ枠は3つ。設定（音量・画面）はセーブ枠とは別に保存する

## 設計方針：後から要素を足しやすくする

- **データ駆動**：敵、ボス、武器、装備の効果、レジェンド固有効果、インプラント、部屋の種類、恒久強化は `src/data/` の定義データとして書く。新しい要素は原則「データを1件足す」で増やせるようにする
- **ボスの行動**：攻撃パターン（予告→攻撃→硬直）を部品として作り、ボスはその組み合わせと順番をデータで定義する。部品の仕組みは共通で使うが、**新しく作るボスの行動パターンは、既存のボスと似た行動を極力避ける**（そのボスだけの固有の攻撃を最低1つ用意する。既存の部品は脇役として使う。くわしくは `docs/詳細仕様.md` の「新しいボスを作るときの決まり」）
- **効果の仕組み**：装備効果・インプラント・属性は「ステータス補正」と「イベントで発動する効果（撃破時、被弾時、ダッシュ時など）」の2種類に統一し、同じ仕組みで処理する
- **数値の集約**：調整用の数値は `src/data/balance` に集める。コードに直書きしない
- **音の差し替え**：BGM・SEはファイル名を直接書かず、`src/data/audio` の対応表を通して読む。BGMは後から差し替える可能性がある

## 絵と音

- ゲーム中のキャラ・敵・エフェクト・UIは、コードで描くネオン線画を基本にする（試作版の方式）
- 外部素材やAI生成素材を入れるときは、`CREDITS.md` に「ファイル名・ツール名・プラン・日付・プロンプトや出典」を必ず記録する
- 無料で作る方針。BGM は無料の素材サイト（魔王魂）の曲を使い、「音楽：魔王魂」の表記を必ず入れる
- 既存の作品・キャラクター・作家に似せた素材は作らない（プロンプトに作品名や作家名を入れない）

## 進め方

- `docs/実装計画.md` のマイルストーンを順に進める。1つ終わるごとに、遊べる状態で村田さんに確認してもらう
- 開発は Claude desktop の Code タブ（Local セッション）で行う。村田さんはコードを VS Code で読む。報告で触れるファイルはパスを書き、VS Code で開いて確認できるようにする
- 村田さんはコードを書かない。報告は「何ができるようになったか」「どう操作して確かめるか」を中心に、専門用語を減らして日本語で書く
- コミットは小さく、メッセージは日本語でよい

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
