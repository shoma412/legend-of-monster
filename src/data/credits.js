// タイトル画面の「クレジット」に出す内容。素材を足したら、CREDITS.md と合わせてここも直す
export const CREDITS = [
  {
    title: '音楽',
    lines: [{ name: '魔王魂', note: 'BGM（全曲）　https://maou.audio/' }],
  },
  {
    title: '文字',
    lines: [
      { name: 'DotGothic16', note: 'ゲーム中の文字（SIL Open Font License 1.1）' },
      { name: 'Noto Sans JP', note: '足りない字の補い（SIL Open Font License 1.1）' },
    ],
  },
  {
    title: '使用ツール',
    lines: [
      { name: 'Phaser', note: 'ゲームの土台' },
      { name: 'Vite', note: 'ビルド' },
    ],
  },
  {
    title: '制作',
    lines: [
      { name: '村田', note: '企画・仕様・テストプレイ' },
      { name: 'Claude Code', note: '実装（絵と効果音はコードで作成）' },
    ],
  },
];
