// 操作説明：キーボードとマウスの図と、それぞれの操作。メニュー（src/scenes/menuOverlay.js）の「操作」タブに描く。
import { DATA } from '../data/index.js';
import { COLORS, hex } from '../data/theme.js';

const KEY = 32; // キー1つの大きさ
const GAP = 4;
const PANEL = 0x110f1d;

// 操作の種類ごとの色と説明。keys に書いたキーが、図の中でその色になる
const GROUPS = [
  { color: COLORS.cyan, keys: ['W', 'A', 'S', 'D'], name: 'W A S D', text: '移動' },
  { color: COLORS.cyan, keys: ['Shift'], name: 'Shift', text: 'ダッシュ回避（無敵あり）' },
  { color: COLORS.green, keys: ['E'], name: 'E', text: '調べる・装備を付ける・扉を選ぶ' },
  { color: COLORS.green, keys: ['F'], name: 'F', text: '落ちている装備をバッグに入れる' },
  { color: COLORS.green, keys: ['Q'], name: 'Q', text: '修復キットを使う（HP回復）' },
  { color: COLORS.amber, keys: ['1', '2', '3'], name: '1・2（・3）', text: '消耗品を使う／レベルアップの3択を選ぶ' },
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
  const lines = { greatsword: ['攻撃（3段斬り）／長押しで溜め斬り', '奥義（HP20%以下・エリアごとに1回）'], sword: ['攻撃（4段コンボ）', 'ジャストガード'], gun: ['撃つ（押している間ずっと）', '拡散射撃'], knuckle: ['殴る（押している間ずっと）', 'バーストブロー（ゲージ満タンで）'] };
  return DATA.weapons.all().map((w) => ({ name: w.name, left: lines[w.id]?.[0] ?? '攻撃', right: lines[w.id]?.[1] ?? w.special.name, current: weapon?.id === w.id }));
}

// menu: MenuOverlay（text / panel / graphics を借りる）, weapon: 今持っている武器（なければ null）
export function renderControls(menu, weapon) {
  menu.panel(40, 122, 880, 336);
  const g = menu.graphics();

  // ---- キーボード ----
  menu.text(60, 132, 'キーボード', 12, COLORS.cyan, { fontStyle: '700' });
  ROWS.forEach((row, r) => {
    let x = 60;
    const y = 154 + r * (KEY + GAP);
    for (const key of row) {
      const w = KEY * (key.w ?? 1) + GAP * ((key.w ?? 1) - 1);
      const color = keyColor(key.k);
      g.fillStyle(color ? hex(color) : PANEL, color ? 0.22 : 1).fillRect(x, y, w, KEY);
      g.lineStyle(color ? 2 : 1, color ? hex(color) : hex(COLORS.line), 1).strokeRect(x, y, w, KEY);
      if (color || key.w) menu.text(x + w / 2, y + KEY / 2, key.k, key.k.length > 1 ? 10 : 13, color ?? '#4a4470', { fontStyle: '700' }).setOrigin(0.5);
      x += w + GAP;
    }
  });

  // ---- マウス ----
  const mx = 452;
  const my = 160;
  menu.text(mx - 34, 132, 'マウス', 12, COLORS.cyan, { fontStyle: '700' });
  // 本体
  g.fillStyle(PANEL, 1).fillRoundedRect(mx - 34, my, 68, 104, 26);
  g.lineStyle(2, hex(COLORS.dim), 1).strokeRoundedRect(mx - 34, my, 68, 104, 26);
  // 左ボタン（攻撃）と右ボタン（特殊）
  g.fillStyle(hex(COLORS.cyan), 0.3).fillRoundedRect(mx - 34, my, 33, 44, { tl: 26, tr: 0, bl: 0, br: 0 });
  g.lineStyle(2, hex(COLORS.cyan), 1).strokeRoundedRect(mx - 34, my, 33, 44, { tl: 26, tr: 0, bl: 0, br: 0 });
  g.fillStyle(hex(COLORS.amber), 0.3).fillRoundedRect(mx + 1, my, 33, 44, { tl: 0, tr: 26, bl: 0, br: 0 });
  g.lineStyle(2, hex(COLORS.amber), 1).strokeRoundedRect(mx + 1, my, 33, 44, { tl: 0, tr: 26, bl: 0, br: 0 });
  menu.text(mx - 18, my + 22, '左', 12, COLORS.cyan, { fontStyle: '700' }).setOrigin(0.5);
  menu.text(mx + 18, my + 22, '右', 12, COLORS.amber, { fontStyle: '700' }).setOrigin(0.5);
  menu.text(mx, my + 122, 'カーソルの方向を向く\n攻撃もその方向に出る', 11, COLORS.dim, { align: 'center', lineSpacing: 3 }).setOrigin(0.5, 0);

  // 武器ごとの左・右クリック（今の武器は明るく）
  menu.text(510, 132, '武器ごとのクリック', 12, COLORS.cyan, { fontStyle: '700' });
  mouseLines(weapon).forEach((line, i) => {
    const y = 154 + i * 62;
    const on = line.current || !weapon;
    menu.panel(510, y, 396, 56, on ? COLORS.ink : COLORS.line);
    menu.text(522, y + 6, line.name, 13, on ? COLORS.ink : COLORS.dim, { fontStyle: '700' });
    menu.text(586, y + 7, `左：${line.left}`, 11, on ? COLORS.cyan : '#4a4470');
    menu.text(586, y + 30, `右：${line.right}`, 11, on ? COLORS.amber : '#4a4470');
  });

  // ---- キーの説明（2列） ----
  GROUPS.forEach((group, i) => {
    const x = 60 + (i % 2) * 430;
    const y = 352 + Math.floor(i / 2) * 24;
    g.fillStyle(hex(group.color), 0.3).fillRect(x, y + 2, 12, 12);
    g.lineStyle(1.5, hex(group.color), 1).strokeRect(x, y + 2, 12, 12);
    menu.text(x + 20, y, group.name, 12, group.color, { fontStyle: '700' });
    menu.text(x + 110, y, group.text, 12, COLORS.ink);
  });

  // 確認用のキー（開発中の画面だけ。公開版では出ないし、効かない）
  if (import.meta.env.DEV) {
    menu.text(60, 443, '確認用（開発中の画面だけ）：戦闘中に B ボス部屋へ／N 次のエリアへ／O 奥義を使える状態に　隠れ家で U 武器を全解放', 10, COLORS.dim);
  }
}
