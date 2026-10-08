// マップの定義（2026-10-06 追加）
// 1回の出撃で進むのは、1つのマップ。マップは、エリア（src/data/areas.js）が順に並んだもの。
// 1件 = { id, ... } の形で足す。上から順に解放される（前のマップを完了すると、次が選べる）。
//
//   code  : 画面に出す番号
//   name  : マップの名前
//   areas : 進むエリアの順番。最後のエリアのボスを倒すと、このマップは完了
//   enemyScale : 雑魚のHPと攻撃力にかかる倍率（書かなければ 1）
//   ready : false は、まだ中身ができていないもの（マップを選ぶ画面に「準備中」と出て、選べない）
// 最終的に7つにする。マップ2〜7は、枠だけ先に置いてある。
export const maps = [
  { id: 'map1', code: 'MAP 01', name: '中枢区', areas: ['slum', 'plant', 'tower'] },
  // 排水区。enemyScale は、雑魚のHPと攻撃力にかかるマップごとの倍率
  { id: 'map2', code: 'MAP 02', name: '排水区', areas: ['sewer', 'reservoir', 'purifier'], enemyScale: 1.5 },
  // 建設区
  // secretBoss: 隠しボス。出撃ごとに、このマップのどこか1部屋に「ひび割れた壁」が出る。倒すと、このマップの通行証が手に入る
  {
    id: 'map3', code: 'MAP 03', name: '建設区', areas: ['yard', 'viaduct', 'spire'], enemyScale: 2.2,
    secretBoss: { boss: 'architect', hint: ['@noise＞ ……壁の向こうに、反応がある。'] },
  },
  // requiresPass: このマップに入るのに必要な通行証（そのマップの id）
  // 停電区。environment は、このマップのすべての部屋に効く決まり（src/data/environments.js）
  { id: 'map4', code: 'MAP 04', name: '停電区', areas: ['darkstreet', 'substation', 'control'], enemyScale: 3, environment: 'dark', requiresPass: 'map3',
    // 隠しボスの出し方が、マップ3とは違う（rule: 'lamps'）：そのエリアで通ってきた部屋の非常灯を、すべて1回は点けていると、ボス前の補給部屋に道が開く
    secretBoss: { boss: 'nocturne', rule: 'lamps', hint: ['@noise＞ ……灯りを全部点けたな。壁の向こうで、何かが目を覚ました。'] },
  },
  // 溶解区。環境は「酸の雨」。入るには、停電区の通行証（マップ4の隠しボス）が要る。エリア2・3と隠しボスは、これから足す
  { id: 'map5', code: 'MAP 05', name: '溶解区', areas: ['drainway'], enemyScale: 4, environment: 'acidrain', requiresPass: 'map4' },
  { id: 'map6', code: 'MAP 06', name: '？？？', areas: [], ready: false },
  { id: 'map7', code: 'MAP 07', name: '？？？', areas: [], ready: false },
];
