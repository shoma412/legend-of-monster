// 終わりのない強化（2026-10-15 追加。docs/詳細仕様.md「37. 周回の長い先と、終わりのない強化」）
// スキルツリーを取りきったあとも、ボス素材がある限り、段を上げ続けられる強化。段に上限はない。
//   kind  : exp（段が上がるほど、増え方が大きくなる。value = scale × (rate^段 − 1)）
//           asym（上限に近づく。value = max × (1 − rate^段)。被ダメージ軽減のように、行きすぎるとおかしくなるもの）
//           linear（1段ごとに per ずつ。value = per × 段）
//   stat  : 効くステータス（インプラント・装備と同じ名前）。sign が −1 なら、値を引く（被ダメージ）
//   pool  : 段ごとに使う素材（段 1 から順に、この並びをぐるぐる回る）。1段の値段は「素材1種類 × (1 + 10段ごとに +1) 個」
//   fmt   : 画面での出し方（flat 数 / pct パーセント / sec 毎秒）
export const endlessLines = [
  { id: 'hp', name: '無限骨格', stat: 'maxHp', kind: 'exp', scale: 100, rate: 1.035, fmt: 'flat', label: '最大HP', pool: ['titanCore', 'ductCore', 'gateCore'] },
  { id: 'atk', name: '無限火力', stat: 'attackMul', kind: 'exp', scale: 1, rate: 1.03, fmt: 'pct', label: '攻撃力', pool: ['cryoCore', 'architectCore', 'noiseCore'] },
  { id: 'guard', name: '無限装甲', stat: 'damageTaken', sign: -1, kind: 'asym', max: 0.45, rate: 0.975, fmt: 'pct', label: '被ダメージ −', pool: ['crabCore', 'fabCore', 'cycloneCore'] },
  { id: 'crit', name: '無限会心', stat: 'critChance', kind: 'asym', max: 0.4, rate: 0.97, fmt: 'pct', label: '会心率', pool: ['spiderCore', 'lensCore', 'cogCore'] },
  { id: 'critMul', name: '無限会心威力', stat: 'critMul', kind: 'linear', per: 0.02, fmt: 'pct', label: '会心ダメージ', pool: ['overCore', 'archiveCore', 'nocturneCore'] },
  { id: 'aspd', name: '無限連撃', stat: 'attackSpeed', kind: 'asym', max: 0.6, rate: 0.98, fmt: 'pct', label: '攻撃速度', pool: ['serpentCore', 'vaneCore', 'intakeCore'] },
  { id: 'move', name: '無限脚力', stat: 'moveSpeedMul', kind: 'asym', max: 0.4, rate: 0.98, fmt: 'pct', label: '移動速度', pool: ['houndCore', 'mothCore', 'ductCore'] },
  { id: 'dash', name: '無限回避', stat: 'dashHaste', kind: 'asym', max: 0.5, rate: 0.97, fmt: 'pct', label: 'ダッシュの回復', pool: ['mothCore', 'breakerCore', 'cycloneCore'] },
  { id: 'regen', name: '無限再生', stat: 'hpRegen', kind: 'linear', per: 0.3, fmt: 'sec', label: 'HP の回復', pool: ['hydraCore', 'rainCore', 'rustCore'] },
  { id: 'weak', name: '無限弱点', stat: 'weakBonus', kind: 'linear', per: 0.02, fmt: 'pct', label: '弱点ダメージ', pool: ['lensCore', 'bufferCore', 'catalystCore'] },
  { id: 'kit', name: '無限補給', stat: 'kitBonus', kind: 'linear', per: 0.03, fmt: 'pct', label: '修復キットの回復', pool: ['rainCore', 'boarCore', 'rustCore'] },
  { id: 'credit', name: '無限報酬', stat: 'creditMul', kind: 'linear', per: 0.02, fmt: 'pct', label: 'クレジット', pool: ['boarCore', 'cryoCore', 'overCore'] },
];
