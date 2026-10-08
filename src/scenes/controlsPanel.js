// 操作説明。メニュー（src/scenes/menuOverlay.js）の「操作」タブに描く。
//   左：キーボードとマウスの図（動かない）
//   右：キーの操作と、武器ごとのクリックの一覧（長いので、ホイールや W・S で上下に動かせる）
import { DATA } from '../data/index.js';
import { COLORS, hex } from '../data/theme.js';
import { getSettings } from '../game/settingsStore.js';
import { touch } from '../game/touchInput.js';

// モバイル版の操作説明：画面のボタンと、その働き（docs/詳細仕様.md「31. モバイル版」）
const TOUCH_GROUPS = [
  { color: COLORS.cyan, name: 'スティック', text: '移動。メニューでは、左右でタブ、上下で項目を選ぶ' },
  { color: COLORS.amber, name: '攻撃', text: '押している間、攻撃する。長押しで、溜め斬り・連射' },
  { color: COLORS.amber, name: '特殊', text: '特殊アクション（武器ごとに違う。下の一覧）' },
  { color: COLORS.cyan, name: 'ダッシュ', text: 'ダッシュ回避（無敵あり）' },
  { color: COLORS.green, name: '調べる', text: '扉を選ぶ・買う・装備を付ける・話しかける' },
  { color: COLORS.green, name: 'キット', text: '修復キットを使う（HP回復）' },
  { color: COLORS.green, name: 'しまう', text: '落ちている装備をバッグに入れる' },
  { color: COLORS.amber, name: '1〜4', text: '消耗品を使う／レベルアップの3択を選ぶ' },
  { color: COLORS.red, name: '標的', text: 'ロックオンする敵を切り替える' },
  { color: COLORS.magenta, name: '地図', text: 'エリアの地図' },
  { color: COLORS.ink, name: 'メニュー', text: 'ポーズ画面を開く・閉じる。会話を飛ばす' },
  { color: COLORS.ink, name: '決定', text: '決定。最後まで進んだあと、リザルトへ' },
];

function renderTouchControls(menu, weapon) {
  const g = menu.graphics();
  menu.text(60, 132, '画面のボタン', 12, COLORS.cyan, { fontStyle: '700' });
  menu.text(900, 132, '向きは、いつもオート（近くの敵をロックオンして、その敵のほうを向く）', 11, COLORS.dim).setOrigin(1, 0);
  TOUCH_GROUPS.forEach((group, i) => {
    const y = 156 + i * 21;
    g.fillStyle(hex(group.color), 0.3).fillRect(60, y + 2, 12, 12);
    g.lineStyle(1, hex(group.color), 1).strokeRect(60, y + 2, 12, 12);
    menu.text(80, y, group.name, 12, group.color, { fontStyle: '700' });
    menu.text(166, y, group.text, 12, COLORS.ink);
  });
  // 右：武器ごとの、攻撃と特殊
  menu.text(560, 156, '武器ごとの攻撃と特殊（今の武器は、明るい）', 12, COLORS.cyan, { fontStyle: '700' });
  mouseLines(weapon).forEach((w, i) => {
    const y = 180 + i * 36;
    const color = w.current ? COLORS.ink : COLORS.dim;
    menu.text(560, y, w.name, 12, w.current ? COLORS.amber : COLORS.dim, { fontStyle: '700' });
    menu.text(640, y, w.left, 11, color);
    menu.text(640, y + 15, `特殊：${w.right}`, 11, color);
  });
}

const KEY = 32; // キー1つの大きさ
const GAP = 4;
const PANEL = 0x110f1d;
const LOCKED = '#4a4470';

// 右の一覧の場所と、1行の高さ
const LIST_X = 452;
const LIST_Y = 156;
const LIST_W = 446;
const LINE = 22;
const VISIBLE = 13; // 一度に見える行の数

// 操作の種類ごとの色と説明。keys に書いたキーが、図の中でその色になる
const GROUPS = [
  { color: COLORS.cyan, keys: ['W', 'A', 'S', 'D'], name: 'W A S D', text: '移動' },
  { color: COLORS.cyan, keys: ['Shift'], name: 'Shift', text: 'ダッシュ回避（無敵あり）' },
  { color: COLORS.green, keys: ['E'], name: 'E', text: '調べる・装備を付ける・扉を選ぶ' },
  { color: COLORS.green, keys: ['F'], name: 'F', text: '落ちている装備をバッグに入れる' },
  { color: COLORS.green, keys: ['Q'], name: 'Q', text: '修復キットを使う（HP回復）' },
  { color: COLORS.amber, keys: ['1', '2', '3', '4'], name: '1〜4', text: '消耗品を使う／レベルアップの3択を選ぶ' },
  { color: COLORS.red, keys: ['R'], name: 'R', text: 'ロックオンの切り替え（操作方法がオートのとき）' },
  { color: COLORS.magenta, keys: ['M'], name: 'M', text: 'エリアの地図' },
  { color: COLORS.ink, keys: ['Esc', 'Tab'], name: 'Tab・Esc', text: 'ポーズ画面（装備の付け替え、設定など）' },
];

// キーボードの並び（左側だけ）。w は横幅の倍率
const ROWS = [
  [{ k: 'Esc', w: 1.3 }],
  [{ k: '`' }, { k: '1' }, { k: '2' }, { k: '3' }, { k: '4' }, { k: '5' }, { k: '6' }],
  [{ k: 'Tab', w: 1.5 }, { k: 'Q' }, { k: 'W' }, { k: 'E' }, { k: 'R' }, { k: 'T' }, { k: 'Y' }],
  [{ k: 'Caps', w: 1.8 }, { k: 'A' }, { k: 'S' }, { k: 'D' }, { k: 'F' }, { k: 'G' }, { k: 'H' }],
  [{ k: 'Shift', w: 2.3 }, { k: 'Z' }, { k: 'X' }, { k: 'C' }, { k: 'V' }, { k: 'B' }, { k: 'N' }, { k: 'M' }],
];

function keyColor(name) {
  return GROUPS.find((g) => g.keys.includes(name))?.color ?? null;
}

// 武器ごとの、マウスの左右のボタンの説明
function mouseLines(weapon) {
  const lines = { greatsword: ['攻撃（3段斬り）／長押しで溜め斬り', '奥義（HP20%以下・エリアごとに1回）'], sword: ['攻撃（4段コンボ）', 'ジャストガード'], gun: ['撃つ（押している間ずっと）', '拡散射撃'], knuckle: ['殴る（押している間ずっと）', 'バーストブロー（ゲージ満タンで）'], cannon: ['砲弾を撃つ（押している間ずっと）', '徹甲砲撃（溜めて撃つ）'], spear: ['突く（3段。敵をすべて貫く）', '突進突き（踏み込みの間は無敵）'], chakram: ['輪を投げる（戻ってくる。押している間ずっと）', '設置（回り続ける輪を置く）'] };
  return DATA.weapons.all().map((w) => ({ name: w.name, left: lines[w.id]?.[0] ?? '攻撃', right: lines[w.id]?.[1] ?? w.special.name, current: weapon?.id === w.id }));
}

// 右の一覧の行。{ draw(menu, g, y) } の並び。1行は LINE px
function listLines(weapon) {
  const head = (label) => ({
    draw(menu, g, y) {
      g.lineStyle(1, hex(COLORS.line), 1).lineBetween(LIST_X, y + LINE - 3, LIST_X + LIST_W, y + LINE - 3);
      menu.text(LIST_X, y + 3, label, 12, COLORS.cyan, { fontStyle: '700' });
    },
  });
  const blank = { draw() {} };
  const lines = [head('キーの操作')];
  for (const group of GROUPS) {
    lines.push({
      draw(menu, g, y) {
        g.fillStyle(hex(group.color), 0.3).fillRect(LIST_X, y + 5, 12, 12);
        g.lineStyle(1.5, hex(group.color), 1).strokeRect(LIST_X, y + 5, 12, 12);
        menu.text(LIST_X + 20, y + 3, group.name, 12, group.color, { fontStyle: '700' });
        menu.text(LIST_X + 104, y + 3, group.text, 12, COLORS.ink);
      },
    });
  }
  lines.push(blank, head('武器ごとのクリック（今の武器は、明るい）'));
  for (const line of mouseLines(weapon)) {
    const on = line.current || !weapon;
    lines.push(
      { draw: (menu, g, y) => menu.text(LIST_X, y + 4, `${line.name}${line.current ? '　← 今の武器' : ''}`, 13, on ? COLORS.ink : COLORS.dim, { fontStyle: '700' }) },
      { draw: (menu, g, y) => menu.text(LIST_X + 20, y + 3, `左クリック：${line.left}`, 12, on ? COLORS.cyan : LOCKED) },
      { draw: (menu, g, y) => menu.text(LIST_X + 20, y + 3, `右クリック：${line.right}`, 12, on ? COLORS.amber : LOCKED) },
    );
  }
  // 確認用のキー（開発中の画面だけ。公開版では出ないし、効かない）
  if (import.meta.env.DEV) {
    lines.push(
      blank,
      head('確認用（開発中の画面だけ）'),
      { draw: (menu, g, y) => menu.text(LIST_X, y + 3, '戦闘中：B ボス部屋へ／N 次のエリアへ／O 奥義を使える状態に', 11, COLORS.dim) },
      { draw: (menu, g, y) => menu.text(LIST_X, y + 3, '隠れ家：U 武器を全解放', 11, COLORS.dim) },
    );
  }
  return lines;
}

// menu: MenuOverlay（text / panel / graphics / window を借りる）, weapon: 今持っている武器（なければ null）
export function renderControls(menu, weapon) {
  menu.panel(40, 122, 880, 336);
  if (touch.enabled) {
    renderTouchControls(menu, weapon);
    return;
  }
  const g = menu.graphics();

  // ---- 左：キーボードの図 ----
  menu.text(60, 132, 'キーボード', 12, COLORS.cyan, { fontStyle: '700' });
  ROWS.forEach((row, r) => {
    let x = 60;
    const y = 154 + r * (KEY + GAP);
    for (const key of row) {
      const w = KEY * (key.w ?? 1) + GAP * ((key.w ?? 1) - 1);
      const color = keyColor(key.k);
      g.fillStyle(color ? hex(color) : PANEL, color ? 0.22 : 1).fillRect(x, y, w, KEY);
      g.lineStyle(color ? 2 : 1, color ? hex(color) : hex(COLORS.line), 1).strokeRect(x, y, w, KEY);
      if (color || key.w) menu.text(x + w / 2, y + KEY / 2, key.k, key.k.length > 1 ? 10 : 13, color ?? LOCKED, { fontStyle: '700' }).setOrigin(0.5);
      x += w + GAP;
    }
  });

  // ---- 左下：マウスの図と、向きの決め方 ----
  const mx = 94;
  const my = 362;
  menu.text(60, 342, 'マウス', 12, COLORS.cyan, { fontStyle: '700' });
  g.fillStyle(PANEL, 1).fillRoundedRect(mx - 34, my, 68, 86, 24);
  g.lineStyle(2, hex(COLORS.dim), 1).strokeRoundedRect(mx - 34, my, 68, 86, 24);
  // 左ボタン（攻撃）と右ボタン（特殊）
  g.fillStyle(hex(COLORS.cyan), 0.3).fillRoundedRect(mx - 34, my, 33, 38, { tl: 24, tr: 0, bl: 0, br: 0 });
  g.lineStyle(2, hex(COLORS.cyan), 1).strokeRoundedRect(mx - 34, my, 33, 38, { tl: 24, tr: 0, bl: 0, br: 0 });
  g.fillStyle(hex(COLORS.amber), 0.3).fillRoundedRect(mx + 1, my, 33, 38, { tl: 0, tr: 24, bl: 0, br: 0 });
  g.lineStyle(2, hex(COLORS.amber), 1).strokeRoundedRect(mx + 1, my, 33, 38, { tl: 0, tr: 24, bl: 0, br: 0 });
  menu.text(mx - 18, my + 19, '左', 12, COLORS.cyan, { fontStyle: '700' }).setOrigin(0.5);
  menu.text(mx + 18, my + 19, '右', 12, COLORS.amber, { fontStyle: '700' }).setOrigin(0.5);
  menu.text(146, my + 2, '左クリック：攻撃', 12, COLORS.cyan, { fontStyle: '700' });
  menu.text(146, my + 22, '右クリック：特殊（武器ごとに違う）', 12, COLORS.amber, { fontStyle: '700' });
  // 向きの決め方は、設定の「操作方法」で変わる
  const auto = getSettings().controls === 'auto';
  menu.text(146, my + 48, auto ? '操作方法：オート\nロックオンした敵のほうを向く（R で切り替え）' : '操作方法：マニュアル\nカーソルのあるほうを向く。攻撃もその向きに出る', 11, COLORS.dim, { lineSpacing: 4 });

  // 左と右を分ける線
  g.lineStyle(1, hex(COLORS.line), 1).lineBetween(436, 134, 436, 446);

  // ---- 右：一覧（上下に動かせる） ----
  const lines = listLines(weapon);
  const start = menu.window(lines.length, VISIBLE, { x: 908, y: LIST_Y, h: VISIBLE * LINE });
  lines.slice(start, start + VISIBLE).forEach((line, i) => line.draw(menu, g, LIST_Y + i * LINE));
}
