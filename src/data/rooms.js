// 部屋の種類の定義（M4 で追加）
// 1件 = { id, ... } の形で足す。
//
// label : 扉の上や区画名に出す名前
// tag   : 区画名の表示に使う端末風の呼び名
// color : src/data/theme.js の色名
// icon  : 扉の上に描くアイコンの種類（src/render/objects.js の ICONS）
// build : 部屋の中身を作る部品の名前（src/game/rooms.js の BUILDERS）
// clearCredits : クリアしたときにもらえるクレジット
export const rooms = [
  { id: 'combat', label: '戦闘', tag: '戦闘区画', color: 'cyan', icon: 'blades', build: 'combat', clearCredits: 10 },
  { id: 'elite', label: 'エリート', tag: '危険個体', color: 'red', icon: 'skull', build: 'elite', clearCredits: 20 },
  { id: 'supply', label: '補給', tag: '補給ポイント', color: 'green', icon: 'cross', build: 'supply' },
  { id: 'market', label: '闇市', tag: '闇市', color: 'amber', icon: 'coin', build: 'market' },
  { id: 'vault', label: 'データ金庫', tag: 'データ金庫', color: 'magenta', icon: 'vault', build: 'vault' },
  // 遭遇：人物と会い、選択肢で結果が変わる（src/data/encounters.js）
  { id: 'encounter', label: '遭遇', tag: '反応あり', color: 'ice', icon: 'talk', build: 'encounter' },
  { id: 'boss', label: 'BOSS', tag: '最深部', color: 'red', icon: 'warning', build: 'boss', clearCredits: 50 },
  // ボスを倒したあとに開く、次のエリアへの扉（部屋ではない）
  // 中断したランを再開したときの部屋（クリア済みで、扉が開いている）。地図には出ない
  { id: 'resume', label: '再開', tag: '再開地点', color: 'green', icon: 'cross', build: 'none' },
  { id: 'descend', label: '次のエリアへ', tag: '', color: 'cyan', icon: 'down', build: 'none' },
];
