// 画面いっぱいに重ねるメニュー。戦闘中のポーズ画面と、隠れ家の端末で同じものを使う。
//   タブ：ステータス／装備／地図／恒久強化／記録／データ片／実績／操作／設定（どれを出すかは使う側が選ぶ）
//   下のボタン：再開、隠れ家に戻る、など（使う側が渡す）
// 開いている間は、使う側がゲームの進行を止める（isOpen を見る）。
import { applyVolume, playSe } from '../audio/audio.js';
import { BAG, LOOT, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { CREDITS } from '../data/credits.js';
import { isBackKey } from '../logic/keys.js';
import { firstTarget, moveFocus, nearestTarget } from '../logic/focusNav.js';
import { pad } from '../game/padInput.js';
import { species } from '../data/implants.js';
import { AREA_THEMES, COLORS, ELEMENT_COLORS, FONTS, RARITY_COLORS, hex } from '../data/theme.js';
import { discardFromBag, equipFromBag, unequipToBag } from '../game/build.js';
import { bestReachText } from '../logic/maps.js';
import { applyDisplaySize, applyFrameRate, canFullscreen, getSettings, isFullscreen, saveSettings, toggleFullscreen } from '../game/settingsStore.js';
import { nodeState } from '../logic/areaGen.js';
import { xpToNext } from '../logic/level.js';
import { ELEMENT_NAMES, describeItem } from '../logic/loot.js';
import { buyNode, saveTree, treeNodeState } from '../logic/meta.js';
import { layoutTree } from '../logic/skillTree.js';
import { nextOpenIndex, pathTo, totalCost, upgradePreview } from '../logic/treeInfo.js';
import { TREE_VIEW, centerOn, clipSegment, createTreeView, inRect, panBy, toScreen, zoomAt } from '../logic/treeView.js';
import { CONTROL_MODES, DISPLAY_SIZES, FRAME_RATES, QUALITIES, VOLUME_STEPS, stepVolume } from '../logic/settings.js';
import { activeSpeciesBonuses, implantDesc } from '../logic/stats.js';
import { drawAreaMap, nodePosition } from '../render/areaMap.js';
import { drawSlotIcon } from '../render/icons.js';
import { drawAchievementIcon, drawFragmentIcon, drawMaterialIcon } from '../render/metaIcons.js';
import { renderControls } from './controlsPanel.js';
import { touch } from '../game/touchInput.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL = 0x110f1d;
const LOCKED = '#4a4470';

// スキルツリーの円を出す枠と、その真ん中
// マスが57個に増えて混んできたので（2026-10-09）、枠を横に広げ、円を横長にして、マス同士の間をあけている
const TREE_RECT = { left: 40, top: 166, right: 580, bottom: 462 };
const TREE_CENTER = { x: 310, y: 316 };
const TREE_RINGS = [0, 24, 46, 68, 86, 101, 114]; // 段ごとの、中心からの距離（縦の長さ。拡大していないとき）
const TREE_STRETCH = 2.15; // 横は、縦の何倍に広げるか（枠が横長なので、横に広げてマスの間をあける）
// 絞り込み：選んだもの以外のマスを薄くする
const TREE_FILTERS = [
  { id: 'all', label: 'すべて', w: 58 },
  { id: 'open', label: '取れる', w: 58 },
  { id: 'body', label: '体', w: 34 },
  { id: 'skill', label: '技', w: 34 },
  { id: 'gear', label: '備', w: 34 },
];

// モバイル版：メニューを拡大する倍率（「拡大」ボタン。拡大中は、指でなぞって動かす）
const MENU_ZOOM = 1.45;

const TAB_LABELS = {
  status: 'ステータス', gear: '装備', map: '地図', upgrade: '恒久強化', record: '記録',
  fragment: 'データ片', achievement: '実績', controls: '操作', settings: '設定', credits: 'クレジット',
};

export function materialColor(def) {
  return ELEMENT_COLORS[def.color] ?? COLORS[def.color];
}

// 素材の名前。1回も手に入れたことのない素材は、名前を伏せる（save を渡したときだけ）
export function materialName(id, save = null) {
  return !save || id in save.materials ? DATA.materials.get(id).name : '？？？';
}

// その費用に使う素材を、いくつ持っているか（例：所持 ボアコア ×1）
export function ownedText(save, cost) {
  return `所持 ${Object.keys(cost).map((id) => `${materialName(id, save)} ×${save.materials[id] ?? 0}`).join('　')}`;
}

// 費用を文にする（例：ボアコア ×2）。save を渡すと、手に入れたことのない素材の名前は伏せる
export function costText(cost, save = null) {
  return Object.entries(cost).map(([id, n]) => `${materialName(id, save)} ×${n}`).join('　');
}

const percent = (v) => `${Math.round(v * 100)}%`;
const rarityColor = (item) => RARITY_COLORS[LOOT.rarities[item.rarity].id];

export class MenuOverlay {
  // options: {
  //   title, tabs: ['status', ...], actions: [{ label, color, run }],
  //   context: () => ({ save, player, world, run }),  今のセーブデータ・プレイヤー・部屋・ラン（使うタブに必要なものだけ）
  //   canOpen: () => boolean,              Esc・Tab で開いてよいか
  //   readOnlyUpgrades: true,              恒久強化を見るだけにする
  //   onBuy: () => void,                   恒久強化を買ったあとに呼ぶ
  //   onClose: () => void,
  // }
  constructor(scene, options) {
    this.scene = scene;
    this.options = options;
    this.isOpen = false;
    this.tab = 0;
    this.cursor = 0;
    this.dialog = null; // 確認の案内 { message, yes }
    this.iconLayers = [];
    // ゲームパッド：押せるもの（ボタン）の場所と働き。描き直すたびに集め直す。focusAt は、選んでいるものの中心（なければ null）
    this.targets = [];
    this.focusAt = null;
    this.collectAs = 'content'; // 今集めているのが、タブの中身（content）か、下のボタン（action）か
    this.root = scene.add.container(0, 0).setDepth(30).setVisible(false);
    this.scroll = 0; // 一覧が長いときの、いちばん上に出ている行（タブを切り替えると 0 に戻る）
    this.scrollMax = 0; // 今のタブで動かせる上限（描くたびに決まる）
    scene.input.keyboard.addCapture('TAB');
    scene.input.keyboard.on('keydown', (event) => this.onKey(event));
    this.treeView = createTreeView(); // スキルツリーの円の、拡大と位置
    this.treeDrag = null; // 円を引っぱって動かしている最中の、前のマウスの位置
    // モバイル版：メニューぜんたいの拡大（on のとき MENU_ZOOM 倍。x・y は、ずらした量）と、「拡大」ボタン
    this.zoom = { on: false, x: 0, y: 0 };
    this.zoomDrag = null;
    this.zoomButton = null;
    if (touch.enabled) {
      this.zoomButton = scene.add.text(W - 40, 30, '拡大', { fontFamily: FONTS.body, fontSize: '15px', fontStyle: '700', color: COLORS.amber, backgroundColor: '#110f1d', padding: { x: 14, y: 8 } })
        .setOrigin(1, 0).setDepth(31).setVisible(false).setInteractive({ useHandCursor: true });
      this.zoomButton.on('pointerdown', () => this.setZoom(!this.zoom.on));
    }
    // マウスのホイール：スキルツリーの円の上では拡大・縮小（上に回すと拡大）。それ以外では、長い一覧を上下に動かす
    scene.input.on('wheel', (pointer, _over, _dx, dy) => {
      if (!this.isOpen || this.dialog || dy === 0) return;
      if (this.overTree(pointer)) {
        this.treeView = zoomAt(this.treeView, TREE_CENTER, this.local(pointer), dy < 0 ? 1 : -1);
        this.render();
        return;
      }
      this.scrollBy(dy > 0 ? 1 : -1);
    });
    // スキルツリーの円は、拡大しているとき、引っぱって動かせる
    scene.input.on('pointerdown', (pointer) => {
      const at = this.local(pointer);
      this.treeDrag = this.overTree(pointer) ? { x: at.x, y: at.y, moved: false } : null;
      // メニューを拡大しているとき：なぞって動かす（スキルツリーの円を動かしているときは、そちらが先）
      const treePan = this.treeDrag && this.treeView.zoom > TREE_VIEW.min;
      this.zoomDrag = this.isOpen && this.zoom.on && !treePan ? { x: pointer.worldX, y: pointer.worldY, moved: false } : null;
    });
    scene.input.on('pointerup', () => {
      this.treeDrag = null;
      this.zoomDrag = null;
    });
    scene.input.on('pointermove', (pointer) => {
      const zd = this.zoomDrag;
      if (zd && pointer.isDown && this.isOpen && this.zoom.on) {
        const dx = pointer.worldX - zd.x;
        const dy = pointer.worldY - zd.y;
        if (!zd.moved && Math.hypot(dx, dy) < 6) return;
        zd.moved = true;
        zd.x = pointer.worldX;
        zd.y = pointer.worldY;
        this.zoom.x += dx;
        this.zoom.y += dy;
        this.applyZoom();
        return;
      }
      const drag = this.treeDrag;
      if (!drag || !pointer.isDown || !this.isOpen || this.tabId !== 'upgrade' || this.treeView.zoom <= TREE_VIEW.min) return;
      const at = this.local(pointer);
      const dx = at.x - drag.x;
      const dy = at.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return; // クリックのつもりの、小さなぶれは無視する
      drag.moved = true;
      drag.x = at.x;
      drag.y = at.y;
      this.treeView = panBy(this.treeView, dx, dy);
      this.render();
    });
  }

  // マウス（指）の位置を、メニューの中の位置に直す（メニューを拡大しているときは、そのぶんを戻す）
  local(pointer) {
    const z = this.zoom.on ? MENU_ZOOM : 1;
    return { x: (pointer.worldX - this.root.x) / z, y: (pointer.worldY - this.root.y) / z };
  }

  // モバイル版：メニューを拡大する・戻す
  setZoom(on) {
    this.zoom = { on, x: 0, y: 0 };
    this.applyZoom();
  }

  // 拡大と、ずらした量を、画面に反映する（画面の外まで、ずらしすぎないようにする）
  applyZoom() {
    const z = this.zoom.on ? MENU_ZOOM : 1;
    this.zoom.x = Math.max(W - W * z, Math.min(0, this.zoom.x));
    this.zoom.y = Math.max(H - H * z, Math.min(0, this.zoom.y));
    this.root.setScale(z).setPosition(this.zoom.x, this.zoom.y);
    this.zoomButton?.setText(this.zoom.on ? '戻す' : '拡大');
  }

  // マウスが、スキルツリーの円の枠の上にあるか
  overTree(pointer) {
    const at = this.local(pointer);
    return this.isOpen && !this.dialog && this.tabId === 'upgrade' && inRect(at.x, at.y, TREE_RECT);
  }

  // スキルツリーのマスの、円の中での位置（中心が 0,0。拡大していないときの長さ）
  treeLocal(layout, id) {
    const p = layout.pos[id];
    const angle = -Math.PI / 2 + (Math.PI * 2 * p.row * Math.max(1, layout.leaves - 1)) / layout.leaves;
    const radius = TREE_RINGS[Math.min(TREE_RINGS.length - 1, p.col)];
    return { x: Math.cos(angle) * radius * TREE_STRETCH, y: Math.sin(angle) * radius };
  }

  get tabId() {
    return this.options.tabs[this.tab];
  }

  open(tabId = this.options.tabs[0]) {
    this.isOpen = true;
    this.tab = Math.max(0, this.options.tabs.indexOf(tabId));
    this.cursor = 0;
    this.scroll = 0;
    this.focusAt = null;
    this.dialog = null;
    this.root.setVisible(true);
    this.zoomButton?.setVisible(true);
    this.setZoom(false);
    // スキルツリーは、今すぐ取れるマスがあれば、そこを選んだ状態で開く
    if (this.tabId === 'upgrade' && !this.options.readOnlyUpgrades) this.jumpToOpen(false);
    this.render();
  }

  close() {
    this.isOpen = false;
    this.dialog = null;
    this.root.setVisible(false);
    this.root.removeAll(true);
    this.zoomButton?.setVisible(false);
    this.options.onClose?.();
  }

  // 「はい／いいえ」の確認を出す
  confirm(message, yes) {
    this.dialog = { message, yes };
    if (this.zoom.on) this.setZoom(false); // 確認の案内は、画面の真ん中に出るので、拡大を戻す
    this.render();
  }

  onKey(event) {
    if (event.repeat) return;
    const code = event.code;
    if (!this.isOpen) {
      const can = this.options.canOpen?.() ?? true;
      if (can && isBackKey(code)) this.open();
      return;
    }
    if (this.dialog) {
      if (code === 'Enter') {
        const { yes } = this.dialog;
        this.dialog = null;
        yes();
      } else if (isBackKey(code)) {
        this.dialog = null;
        this.render();
      }
      return;
    }
    const tabs = this.options.tabs;
    const digit = /^Digit([1-9])$/.exec(code);
    if (digit && Number(digit[1]) <= tabs.length) this.setTab(Number(digit[1]) - 1);
    else if (code === 'KeyA' || code === 'ArrowLeft') this.setTab((this.tab + tabs.length - 1) % tabs.length);
    else if (code === 'KeyD' || code === 'ArrowRight') this.setTab((this.tab + 1) % tabs.length);
    else if (code.startsWith('Pad')) this.onPad(code);
    else if (code === 'KeyW' || code === 'ArrowUp') this.moveCursor(-1);
    else if (code === 'KeyS' || code === 'ArrowDown') this.moveCursor(1);
    else if ((code === 'Enter' || code === 'KeyE') && this.focused()) this.focused().run();
    else if (code === 'Enter' || code === 'KeyE') this.confirmRow();
    else if (code === 'KeyF' && this.tabId === 'upgrade') this.jumpToOpen();
    else if (isBackKey(code)) this.close();
  }

  // ---- ゲームパッド：左スティック・十字キーで、ボタンを選ぶ ----

  // 今選んでいるボタン（なければ null）
  focused() {
    if (!this.focusAt || this.targets.length === 0) return null;
    return this.targets[nearestTarget(this.targets, this.focusAt)] ?? null;
  }

  setFocus(target) {
    this.focusAt = target ? { x: target.x + target.w / 2, y: target.y + target.h / 2 } : null;
    playSe('select');
    this.render();
  }

  // ゲームパッド専用のキー（src/logic/gamepad.js の PAD_KEYS）
  onPad(code) {
    if (code === 'PadZoomIn' || code === 'PadZoomOut') {
      if (this.tabId !== 'upgrade') return;
      // スキルツリー：RT で拡大、LT で縮小（選んでいるマスが、見える位置に来る）
      this.treeView = zoomAt(this.treeView, TREE_CENTER, TREE_CENTER, code === 'PadZoomIn' ? 1 : -1);
      this.treeFollow = true;
      this.render();
      return;
    }
    const dir = code.slice(3).toLowerCase();
    const vertical = dir === 'up' || dir === 'down';
    const content = this.targets.filter((t) => t.kind === 'content');
    const actions = this.targets.filter((t) => t.kind === 'action');
    // 行を選ぶタブ（スキルツリー・データ片）と、ボタンのないタブ（記録・実績など）：上下で行を選ぶ（一覧を動かす）。左右で、下のボタンを選ぶ
    if (this.rowCount() > 0 || content.length === 0) {
      if (vertical) {
        this.focusAt = null;
        this.moveCursor(dir === 'up' ? -1 : 1);
        return;
      }
      if (actions.length === 0) return;
      const now = actions.indexOf(this.focused());
      const step = dir === 'left' ? -1 : 1;
      this.setFocus(actions[now < 0 ? (step > 0 ? 0 : actions.length - 1) : Math.max(0, Math.min(actions.length - 1, now + step))]);
      return;
    }
    // ボタンのあるタブ（装備・設定）：上下左右で、ボタンを選ぶ
    const now = this.focused();
    const next = now ? moveFocus(this.targets, this.targets.indexOf(now), dir) : firstTarget(content.length > 0 ? content : this.targets);
    this.setFocus(now ? this.targets[next] : (content.length > 0 ? content : this.targets)[next]);
  }

  setTab(index) {
    playSe('select');
    this.tab = index;
    this.cursor = 0;
    this.scroll = 0;
    this.focusAt = null;
    this.render();
  }

  rowCount() {
    if (this.tabId === 'upgrade') return this.treeOrder().length;
    if (this.tabId === 'fragment') return DATA.fragments.all().length;
    return 0;
  }

  moveCursor(delta) {
    const n = this.rowCount();
    // 選ぶ行のないタブ（実績、ステータス）では、W・S は一覧を上下に動かす
    if (n === 0) {
      this.scrollBy(delta);
      return;
    }
    this.cursor = (this.cursor + delta + n) % n;
    this.followCursor = true; // 選んだ行が見える位置まで、一覧を動かす
    this.treeFollow = true; // スキルツリーでは、選んだマスが枠の外なら、見える位置まで動かす
    playSe('select');
    this.render();
  }

  // 一覧を上下に動かす（ホイール、W・S）
  scrollBy(delta) {
    const next = Math.max(0, Math.min(this.scrollMax, this.scroll + delta));
    if (next === this.scroll) return;
    this.scroll = next;
    this.render();
  }

  // 長い一覧の、今出す範囲を決める。total 行のうち visible 行だけ出す。返り値は、最初に出す行の番号
  //   bar: { x, y, h } を渡すと、右端にスクロールバーを描く
  window(total, visible, bar = null) {
    this.scrollMax = Math.max(0, total - visible);
    if (this.followCursor) {
      if (this.cursor < this.scroll) this.scroll = this.cursor;
      if (this.cursor >= this.scroll + visible) this.scroll = this.cursor - visible + 1;
      this.followCursor = false;
    }
    this.scroll = Math.max(0, Math.min(this.scrollMax, this.scroll));
    if (bar && this.scrollMax > 0) {
      const track = this.scene.add.rectangle(bar.x, bar.y, 4, bar.h, hex(COLORS.line), 1).setOrigin(0);
      const size = Math.max(24, (bar.h * visible) / total);
      const thumb = this.scene.add.rectangle(bar.x, bar.y + ((bar.h - size) * this.scroll) / this.scrollMax, 4, size, hex(COLORS.cyan), 1).setOrigin(0);
      this.root.add([track, thumb]);
      this.text(bar.x + 4, bar.y - 14, 'ホイール / W・S：スクロール', 11, COLORS.dim).setOrigin(1, 0);
    }
    return this.scroll;
  }

  // スキルツリー：次の「取れるマス」を選ぶ（F キー、「今取れる」の表示をクリック）。なければ、素材が足りないだけのマス
  jumpToOpen(sound = true) {
    const { save } = this.options.context();
    const states = this.treeOrder().map((n) => treeNodeState(save, n.id));
    const i = nextOpenIndex(states, sound ? this.cursor : -1);
    if (i < 0) return;
    this.cursor = i;
    this.treeFollow = true;
    if (sound) {
      playSe('select');
      this.render();
    }
  }

  confirmRow() {
    if (this.tabId === 'upgrade') this.buy(this.treeOrder()[this.cursor].id);
  }

  buy(id) {
    if (this.options.readOnlyUpgrades) return;
    const { save } = this.options.context();
    if (buyNode(save, id)) {
      playSe('buy');
      this.options.onBuy?.();
    } else {
      playSe('deny');
    }
    this.render();
  }

  // ---- 描画の部品 ----

  style(size, color = COLORS.ink, extra = {}) {
    return { fontFamily: FONTS.body, fontSize: `${size}px`, color, ...extra };
  }

  text(x, y, str, size, color, extra = {}, onClick = null) {
    const t = this.scene.add.text(x, y, str, this.style(size, color, extra));
    if (onClick) t.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.root.add(t);
    return t;
  }

  panel(x, y, w, h, stroke = COLORS.line, onClick = null) {
    const r = this.scene.add.rectangle(x, y, w, h, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, hex(stroke));
    if (onClick) r.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    if (onClick && this.collectAs) this.targets.push({ x, y, w, h, run: onClick, kind: this.collectAs });
    this.root.add(r);
    return r;
  }

  // 押せるボタン（枠と文字）
  button(x, y, w, h, label, color, onClick, size = 12) {
    this.panel(x, y, w, h, color, onClick);
    return this.text(x + w / 2, y + h / 2, label, size, color, { fontStyle: '700' }).setOrigin(0.5);
  }

  // アイコンなどを描くための Graphics（メニューを描き直すたびに作り直す）
  graphics() {
    const g = this.scene.add.graphics();
    this.root.add(g);
    this.iconLayers.push(g);
    return g;
  }

  render() {
    const ctx = this.options.context();
    const { save } = ctx;
    this.root.removeAll(true);
    this.iconLayers = [];
    this.targets = [];
    this.collectAs = 'content';
    this.scrollMax = 0;
    // 後ろの画面を暗くして、クリックも通さない
    const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.92).setInteractive();
    this.root.add(dim);

    this.text(40, 28, this.options.title, 26, COLORS.cyan, { fontFamily: FONTS.display, fontStyle: '700' }).setShadow(0, 0, COLORS.cyan, 12, false, true);
    // タブ（数が多いときは幅を詰める）
    const tabs = this.options.tabs;
    const gap = 6;
    const tw = Math.min(140, Math.floor((W - 80 - gap * (tabs.length - 1)) / tabs.length));
    tabs.forEach((id, i) => {
      const on = i === this.tab;
      const tx = 40 + i * (tw + gap);
      const r = this.scene.add.rectangle(tx, 78, tw, 30, on ? 0x1b1631 : PANEL, 0.95).setOrigin(0).setStrokeStyle(on ? 2 : 1, hex(on ? COLORS.cyan : COLORS.line));
      r.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setTab(i));
      this.root.add(r);
      this.text(tx + tw / 2, 93, `${i + 1} ${TAB_LABELS[id]}`, tw < 110 ? 12 : 14, on ? COLORS.cyan : COLORS.dim, { fontStyle: '700' }).setOrigin(0.5);
    });

    const id = this.tabId;
    if (id === 'status') this.renderStatus(ctx.player);
    else if (id === 'gear') this.renderGear(ctx.world);
    else if (id === 'map') this.renderMap(ctx.run);
    else if (id === 'upgrade') this.renderUpgrades(save);
    else if (id === 'record') this.renderRecords(save);
    else if (id === 'fragment') this.renderFragments(save);
    else if (id === 'achievement') this.renderAchievements(save);
    else if (id === 'controls') renderControls(this, ctx.player?.weapon ?? null);
    else if (id === 'settings') this.renderSettings();
    else if (id === 'credits') this.renderCredits();

    // アイコンは、あとから足した枠に隠れないよう、いちばん手前に出す
    for (const layer of this.iconLayers) this.root.bringToTop(layer);

    // 下のボタン
    this.collectAs = 'action';
    const actions = this.options.actions;
    actions.forEach((action, i) => {
      const bx = W / 2 + (i - (actions.length - 1) / 2) * 226;
      this.button(bx - 105, 470, 210, 34, action.label, action.color ?? COLORS.ink, action.run, 14);
    });
    this.text(W / 2, H - 20, `1〜${tabs.length} / A・D：切り替え　W・S：選ぶ　Enter：決定　Tab：閉じる`, 12, COLORS.dim).setOrigin(0.5);

    // ゲームパッド：選んでいるボタンに、黄色い枠を付ける
    this.collectAs = null;
    const focus = pad.active && !this.dialog ? this.focused() : null;
    if (focus) {
      const mark = this.scene.add.rectangle(focus.x - 3, focus.y - 3, focus.w + 6, focus.h + 6).setOrigin(0).setStrokeStyle(2, hex(COLORS.amber));
      this.root.add(mark);
    }

    if (this.dialog) this.renderDialog();
  }

  // クレジット（音楽・文字・使用ツール・制作）。中身は src/data/credits.js
  renderCredits() {
    this.panel(40, 122, W - 80, 336);
    let y = 140;
    for (const group of CREDITS) {
      this.text(64, y, group.title, 12, COLORS.cyan, { fontStyle: '700' });
      y += 22;
      for (const line of group.lines) {
        this.text(84, y, line.name, 15, COLORS.ink, { fontStyle: '700' });
        this.text(330, y + 1, line.note, 13, COLORS.dim);
        y += 24;
      }
      y += 12;
    }
  }

  renderDialog() {
    const cover = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x07060d, 0.8).setInteractive();
    this.root.add(cover);
    this.panel(W / 2 - 270, H / 2 - 90, 540, 180, COLORS.amber);
    this.text(W / 2, H / 2 - 42, this.dialog.message, 15, COLORS.ink, { fontStyle: '700', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    const yes = () => {
      const run = this.dialog.yes;
      this.dialog = null;
      run();
    };
    const no = () => {
      this.dialog = null;
      this.render();
    };
    this.button(W / 2 - 190, H / 2 + 30, 170, 36, 'はい（Enter）', COLORS.amber, yes, 14);
    this.button(W / 2 + 20, H / 2 + 30, 170, 36, 'いいえ（Tab）', COLORS.ink, no, 14);
  }

  // ---- ステータス：数値、装備の詳細、インプラント ----
  renderStatus(player) {
    if (!player) return;
    const s = player.stats;
    const b = player.build;
    const elements = s.elements.length > 0 ? s.elements.map((e) => ELEMENT_NAMES[e]).join('・') : 'なし';
    const rows = [
      ['レベル', `${b.level}（次まで ${xpToNext(b.level) - b.xp}）`],
      ['HP', `${Math.ceil(player.hp)} / ${s.maxHp}`],
      ['攻撃力', percent(s.attackMul)],
      ['会心率', percent(s.critChance)],
      ['会心ダメージ', percent(s.critMul)],
      ['攻撃速度', percent(1 + s.attackSpeed)],
      ['移動速度', percent(s.moveSpeedMul)],
      ['被ダメージ', percent(s.damageTaken)],
      ['近接の範囲／角度', `${percent(s.meleeRange)} ／ ${percent(s.meleeArc)}`],
      ['撃破時HP回復', `${s.killHeal}`],
      ['属性', elements],
      ['クレジット', `${b.credits} c（獲得 ${percent(s.creditMul)}）`],
      ['修復キット', `${b.kits}`],
      ...(b.ougi.includes(player.weapon.id) ? [['奥義', b.ougiUsed ? 'このエリアでは使用済み' : 'HP20%以下で使える']] : []),
      ['消耗品', b.items.filter(Boolean).map((it) => `${DATA.consumables.get(it.id).name}×${it.count}`).join('、') || 'なし'],
    ];
    this.panel(40, 122, 270, 336);
    this.text(54, 130, `${player.weapon.name}`, 14, COLORS.cyan, { fontStyle: '700' });
    rows.forEach(([label, value], i) => {
      this.text(54, 154 + i * 20, label, 12, COLORS.dim);
      this.text(296, 154 + i * 20, value, value.length > 14 ? 10 : 12, COLORS.ink, { fontStyle: '700' }).setOrigin(1, 0);
    });

    // 装備（付け替えは「装備」タブで）
    this.panel(322, 122, 290, 336);
    this.text(336, 130, '装備', 14, COLORS.cyan, { fontStyle: '700' });
    const g = this.graphics();
    let y = 156;
    for (const slot of LOOT.slots) {
      const item = b.gear[slot.id];
      drawSlotIcon(g, slot.id, 344, y + 8, 6, item ? hex(rarityColor(item)) : 0x4a4470);
      this.text(358, y, slot.name, 11, COLORS.dim);
      if (item) {
        this.text(336, y + 17, item.name, 13, rarityColor(item), { fontStyle: '700' });
        const lines = this.text(336, y + 35, describeItem(item).join('\n'), 11, COLORS.ink, { lineSpacing: 2, wordWrap: { width: 262, useAdvancedWrap: true } });
        y += 42 + lines.height;
      } else {
        this.text(336, y + 17, 'なし', 13, LOCKED);
        y += 42;
      }
    }

    // インプラント
    this.panel(624, 122, 296, 336);
    this.text(638, 130, 'インプラント', 14, COLORS.cyan, { fontStyle: '700' });
    const entries = Object.entries(b.implants);
    if (entries.length === 0) this.text(638, 156, 'なし', 13, LOCKED);
    // 入りきらないときは説明を省いて、名前だけ並べる。それでも多ければスクロールで見る
    const bonuses = activeSpeciesBonuses(b);
    const LIST_BOTTOM = 448;
    const compact = entries.length * 46 + bonuses.length * 18 > LIST_BOTTOM - 156;
    const compactRows = Math.floor((LIST_BOTTOM - 156) / 17);
    const firstEntry = compact ? this.window(entries.length + bonuses.length, compactRows, { x: 910, y: 156, h: LIST_BOTTOM - 160 }) : 0;
    let iy = 156;
    let line = 0; // 上から何行目か（詰めて並べるときに数える）
    const hidden = () => compact && (line++ < firstEntry || line > firstEntry + compactRows);
    for (const [id, n] of entries) {
      if (hidden()) continue;
      const def = DATA.implants.get(id);
      const fam = species[def.species];
      const color = ELEMENT_COLORS[fam.color] ?? COLORS[fam.color];
      this.text(638, iy, `${def.name}　Lv${n}`, 12, color, { fontStyle: '700' });
      if (compact) {
        iy += 17;
      } else {
        const desc = this.text(638, iy + 15, implantDesc(def, n), 10, COLORS.dim, { wordWrap: { width: 270, useAdvancedWrap: true } });
        iy += 20 + desc.height;
      }
    }
    for (const bonus of bonuses) {
      if (hidden()) continue;
      this.text(638, iy + 2, `◆ ${species[bonus.species].name}×${bonus.need}：${bonus.desc}`, 11, COLORS.amber, { fontStyle: '700', wordWrap: { width: 270, useAdvancedWrap: true } });
      iy += 18;
    }
  }

  // ---- 装備：身につけている装備と、バッグの中身。付ける・外す・捨てる ----
  renderGear(world) {
    if (!world) return;
    const p = world.player;
    const b = p.build;
    const g = this.graphics();
    const act = (fn, ok = 'equip') => () => {
      playSe(fn() ? ok : 'deny');
      this.render();
    };

    this.panel(40, 122, 420, 336);
    this.text(54, 130, '身につけている装備', 14, COLORS.cyan, { fontStyle: '700' });
    LOOT.slots.forEach((slot, i) => {
      const y = 158 + i * 98;
      const item = b.gear[slot.id];
      drawSlotIcon(g, slot.id, 66, y + 12, 9, item ? hex(rarityColor(item)) : 0x4a4470);
      this.text(86, y, slot.name, 11, COLORS.dim);
      if (item) {
        this.text(86, y + 15, item.name, 14, rarityColor(item), { fontStyle: '700' });
        this.text(54, y + 38, describeItem(item).join('　'), 11, COLORS.ink, { lineSpacing: 3, wordWrap: { width: 390, useAdvancedWrap: true } });
        const full = b.bag.length >= BAG.size;
        this.button(380, y, 66, 24, '外す', full ? LOCKED : COLORS.amber, act(() => unequipToBag(world, slot.id), 'pickup'));
      } else {
        this.text(86, y + 15, 'なし', 14, LOCKED);
      }
    });

    this.panel(472, 122, 448, 336);
    this.text(486, 130, `バッグ　${b.bag.length} / ${BAG.size}`, 14, COLORS.cyan, { fontStyle: '700' });
    this.text(906, 132, '「付ける」で今の装備と入れ替え。「捨てる」と足元に落ちる', 10, COLORS.dim).setOrigin(1, 0);
    if (b.bag.length === 0) this.text(486, 162, '空。落ちている装備の上で F を押すと、ここに入る', 12, LOCKED);
    b.bag.forEach((item, i) => {
      const y = 156 + i * 50;
      this.panel(482, y, 428, 46, COLORS.line);
      drawSlotIcon(g, item.slot, 500, y + 23, 8, hex(rarityColor(item)));
      this.text(518, y + 4, item.name, 13, rarityColor(item), { fontStyle: '700' });
      this.text(518, y + 24, describeItem(item).join('　'), 10, COLORS.ink, { wordWrap: { width: 262, useAdvancedWrap: true }, maxLines: 2 });
      this.button(790, y + 11, 54, 24, '付ける', COLORS.green, act(() => equipFromBag(world, i)));
      this.button(850, y + 11, 54, 24, '捨てる', COLORS.dim, act(() => discardFromBag(world, i), 'pickup'));
    });
  }

  // ---- 地図：今のエリアの全体 ----
  renderMap(run) {
    if (!run) return;
    const plan = run.plan;
    const area = DATA.areas.get(run.map.areas[run.areaIndex]);
    this.panel(40, 122, 880, 336);
    this.text(W / 2, 140, `${area.code} // ${area.name} — MAP`, 15, AREA_THEMES[area.theme].edge, { fontStyle: '700' }).setOrigin(0.5);
    const colGap = Math.min(150, 780 / (plan.columns - 1));
    const layout = { x: W / 2 - ((plan.columns - 1) * colGap) / 2, y: 290, colGap, rowGap: 130, icon: 14, line: 2, bg: PANEL };
    drawAreaMap(this.graphics(), plan, layout);
    for (const node of Object.values(plan.nodes)) {
      const pos = nodePosition(node, layout);
      const room = DATA.rooms.get(node.type);
      // 通った部屋と、もう行けない部屋の名前は暗くする
      const state = nodeState(plan, node.id);
      const color = state === 'off' ? LOCKED : state === 'done' ? '#2f6b4c' : COLORS[room.color];
      this.text(pos.x, pos.y + 28, room.label, 12, color, { fontStyle: '700' }).setOrigin(0.5);
    }
    this.text(W / 2, 440, '白い枠＝今いる部屋　明るい線＝進める道　暗い部屋＝もう行けない', 12, COLORS.dim).setOrigin(0.5);
  }

  // ボス素材1つぶん（アイコン・名前・個数）を描く。withName が false なら、アイコンと個数だけ。返り値は、使った幅
  materialCell(g, def, count, x, y, withName = true) {
    const color = materialColor(def);
    drawMaterialIcon(g, def.id, x + 7, y + 8, 6, hex(color));
    const t = this.text(x + 18, y, withName ? `${def.name} ×${count}` : `×${count}`, 12, color, { fontStyle: '700' });
    return 18 + t.width;
  }

  // 持っているボス素材を、1行の帯に並べる（恒久強化の画面の上）。素材の種類が多いので、名前は出さず、アイコンと個数だけにする
  //   （どのアイコンが何の素材かは、マスを選ぶと右の欄に名前つきで出る）。幅に入りきらないぶんは「ほか n 種類」
  renderMaterialStrip(save, x, y, width) {
    const g = this.graphics();
    const owned = DATA.materials.all().filter((def) => (save.materials[def.id] ?? 0) > 0);
    const label = this.text(x, y, 'ボス素材', 12, COLORS.dim, { fontStyle: '700' });
    let cx = x + label.width + 16;
    if (owned.length === 0) {
      this.text(cx, y, 'まだ持っていない（ボスを倒すと手に入る）', 12, LOCKED);
      return;
    }
    const REST = 86; // 「ほか n 種類」を書くために、右に残しておく幅
    for (let i = 0; i < owned.length; i++) {
      const def = owned[i];
      const count = save.materials[def.id];
      const w = 18 + 8 * `×${count}`.length + 16; // 描く前に、だいたいの幅で入るかを見る
      const last = i === owned.length - 1;
      if (cx + w > x + width - (last ? 0 : REST)) {
        this.text(x + width, y, `ほか ${owned.length - i} 種類`, 12, COLORS.dim).setOrigin(1, 0);
        return;
      }
      cx += this.materialCell(g, def, count, cx, y, false) + 16;
    }
  }

  // ---- 恒久強化（スキルツリー） ----

  // ツリーのマスを、画面での並び順（上の段から、左から）にしたもの。W・S で選ぶ順番
  treeOrder() {
    const { save } = this.options.context();
    const tree = saveTree(save);
    const { pos } = layoutTree(tree);
    return [...tree.nodes].sort((n1, n2) => n1.depth - n2.depth || pos[n1.id].row - pos[n2.id].row);
  }

  renderUpgrades(save) {
    const readOnly = this.options.readOnlyUpgrades;
    this.text(40, 114, readOnly ? '取った恒久強化（取るのは隠れ家の強化端末で）' : 'ボス素材で、死んでも残る強化を取る。中心から線でつながったマスを、外へ向かって順に取っていく', 12, COLORS.dim);
    // 持っているボス素材（ここで使うので、ここに出す）
    this.panel(40, 132, 880, 28);
    this.renderMaterialStrip(save, 54, 138, 852);

    const tree = saveTree(save);
    const layout = layoutTree(tree);
    const order = this.treeOrder();
    this.cursor = Math.max(0, Math.min(order.length - 1, this.cursor));
    const picked = order[this.cursor];
    // 位置：円の真ん中が中心で、外の輪ほど奥の段。枝は、中心から放射状に広がる。ホイールで拡大・縮小、引っぱって動かせる
    if (this.treeFollow) {
      this.treeFollow = false;
      const p = toScreen(this.treeView, TREE_CENTER, this.treeLocal(layout, picked.id));
      if (!inRect(p.x, p.y, TREE_RECT, 16)) this.treeView = centerOn(this.treeView, this.treeLocal(layout, picked.id));
    }
    const view = this.treeView;
    const zoom = view.zoom;
    const at = (id) => toScreen(view, TREE_CENTER, this.treeLocal(layout, id));
    const root = toScreen(view, TREE_CENTER, { x: 0, y: 0 });
    const R = 8 * Math.min(2, zoom ** 0.7); // マスの大きさ（寄ると、少し大きくなる）
    const CATEGORY = { body: { label: '体', color: COLORS.green }, skill: { label: '技', color: COLORS.red }, gear: { label: '備', color: COLORS.cyan } };
    const state = Object.fromEntries(tree.nodes.map((n) => [n.id, treeNodeState(save, n.id)]));
    // 絞り込み：選んだもの以外は、薄く描く（線も）。「取れる」は、手前を取ってあるマス（素材が足りないものも含む）
    const filter = (this.treeFilter ??= 'all');
    const matches = (n) => filter === 'all' || (filter === 'open' ? state[n.id] === 'open' || state[n.id] === 'short' : DATA.upgrades.get(n.upgrade).category === filter);

    this.panel(TREE_RECT.left, TREE_RECT.top, TREE_RECT.right - TREE_RECT.left, TREE_RECT.bottom - TREE_RECT.top);
    // マスの中の文字が隠れないよう、いちばん手前に出す層（this.graphics()）ではなく、ふつうの層に描く
    const g = this.scene.add.graphics();
    this.root.add(g);
    // 枠からはみ出さないように、線は枠の中だけに切りつめて描く
    const inner = { left: TREE_RECT.left + 2, top: TREE_RECT.top + 2, right: TREE_RECT.right - 2, bottom: TREE_RECT.bottom - 2 };
    const line = (x1, y1, x2, y2) => {
      const c = clipSegment(x1, y1, x2, y2, inner);
      if (c) g.lineBetween(c.x1, c.y1, c.x2, c.y2);
    };
    // 段の目安の輪（薄く）。枠の中に見えているところだけ、短い線をつないで描く
    for (let d = 1; d < TREE_RINGS.length; d++) {
      g.lineStyle(1, hex(COLORS.line), d <= 3 ? 0.32 : 0.2);
      const parts = 72;
      for (let k = 0; k < parts; k++) {
        const a1 = (k / parts) * Math.PI * 2;
        const a2 = ((k + 1) / parts) * Math.PI * 2;
        const p1 = toScreen(view, TREE_CENTER, { x: Math.cos(a1) * TREE_RINGS[d] * TREE_STRETCH, y: Math.sin(a1) * TREE_RINGS[d] });
        const p2 = toScreen(view, TREE_CENTER, { x: Math.cos(a2) * TREE_RINGS[d] * TREE_STRETCH, y: Math.sin(a2) * TREE_RINGS[d] });
        line(p1.x, p1.y, p2.x, p2.y);
      }
    }
    // 線：取ってあるマス同士は明るく、これから取れるマスへは少し明るく
    for (const n of tree.nodes) {
      const to = at(n.id);
      const from = n.parent ? at(n.parent) : root;
      const lit = state[n.id] === 'owned';
      const near = state[n.id] === 'open' || state[n.id] === 'short';
      const shown = matches(n);
      g.lineStyle(lit ? 2 : 1.5, hex(lit ? COLORS.green : near ? COLORS.amber : COLORS.dim), (lit ? 0.7 : near ? 0.75 : 0.4) * (shown ? 1 : 0.25));
      line(from.x, from.y, to.x, to.y);
    }
    // 道筋：選んだマスまでに、あと取る必要のあるマスを、中心（か、取ってあるマス）からつないで光らせる
    const path = pathTo(tree, save.tree.owned, picked.id);
    if (path.length > 1) {
      g.lineStyle(3, hex(COLORS.cyan), 0.85);
      for (const n of path) {
        const to = at(n.id);
        const from = n.parent ? at(n.parent) : root;
        line(from.x, from.y, to.x, to.y);
      }
    }
    const onPath = new Set(path.length > 1 ? path.map((n) => n.id) : []);
    // 中心
    if (inRect(root.x, root.y, TREE_RECT, 10)) {
      g.fillStyle(hex(COLORS.cyan), 1).fillCircle(root.x, root.y, 5);
      g.lineStyle(2, hex(COLORS.cyan), 0.5).strokeCircle(root.x, root.y, 9);
    }
    // マス（枠の中に見えているものだけ）
    order.forEach((n, i) => {
      const p = at(n.id);
      if (!inRect(p.x, p.y, TREE_RECT, R + 5)) return;
      const def = DATA.upgrades.get(n.upgrade);
      const cat = CATEGORY[def.category] ?? CATEGORY.body;
      const st = state[n.id];
      const color = st === 'owned' ? COLORS.green : st === 'open' ? COLORS.amber : st === 'short' ? COLORS.dim : LOCKED;
      const shown = matches(n);
      if (!shown) {
        // 絞り込みから外れたマス：小さく、薄く（場所だけ分かる。クリックはできる）
        g.fillStyle(PANEL, 1).fillCircle(p.x, p.y, R * 0.55);
        g.lineStyle(1, hex(color), 0.35).strokeCircle(p.x, p.y, R * 0.55);
        if (i === this.cursor) g.lineStyle(2, hex(COLORS.cyan), 1).strokeCircle(p.x, p.y, R + 4);
      } else {
      g.fillStyle(PANEL, 1).fillCircle(p.x, p.y, R);
      if (st === 'owned') g.fillStyle(hex(COLORS.green), 0.35).fillCircle(p.x, p.y, R);
      g.lineStyle(st === 'open' ? 2.5 : 1.5, hex(color), 1).strokeCircle(p.x, p.y, R);
      if (st === 'open') g.lineStyle(4, hex(COLORS.amber), 0.2).strokeCircle(p.x, p.y, R + 3);
      if (i === this.cursor) g.lineStyle(2, hex(COLORS.cyan), 1).strokeCircle(p.x, p.y, R + 4);
      else if (onPath.has(n.id)) g.lineStyle(1.5, hex(COLORS.cyan), 0.8).strokeCircle(p.x, p.y, R + 3);
      this.text(p.x, p.y, cat.label, Math.round(10 * Math.min(1.6, zoom ** 0.7)), st === 'locked' ? LOCKED : cat.color, { fontStyle: '700' }).setOrigin(0.5);
      // 十分に寄ったら、マスの下に強化の名前も出す
      if (zoom >= 1.9 && inRect(p.x, p.y + R + 12, TREE_RECT, 8)) this.text(p.x, p.y + R + 3, def.name, 10, st === 'locked' ? LOCKED : COLORS.ink).setOrigin(0.5, 0);
      }
      // クリックで選ぶ。選んであるマスをもう一度クリックすると、取る（引っぱって動かした直後は、何もしない）
      const hit = this.scene.add.circle(p.x, p.y, R + 3, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.treeDrag?.moved) return;
        if (this.cursor === i) this.buy(n.id);
        else {
          this.cursor = i;
          playSe('select');
          this.render();
        }
      });
      this.root.add(hit);
    });
    // 操作の案内と、今の倍率（マスや線と重ならないよう、下に帯を敷く）
    const strip = this.scene.add.rectangle(TREE_RECT.left + 1, TREE_RECT.bottom - 25, TREE_RECT.right - TREE_RECT.left - 2, 24, PANEL, 0.96).setOrigin(0);
    this.root.add(strip);
    this.text(TREE_RECT.left + 10, TREE_RECT.bottom - 20, touch.enabled ? 'ドラッグ：動かす（拡大中）　F：次の取れるマス' : 'ホイール：拡大・縮小　　ドラッグ：動かす（拡大中）　　F：次の取れるマス', 11, COLORS.dim);
    // モバイル版：ホイールがないので、拡大・縮小のボタンを出す
    if (touch.enabled) {
      [['−', -1, 108], ['＋', 1, 76]].forEach(([label, direction, dx]) => {
        this.button(TREE_RECT.right - dx, TREE_RECT.bottom - 24, 28, 22, label, COLORS.cyan, () => {
          this.treeView = zoomAt(this.treeView, TREE_CENTER, TREE_CENTER, direction);
          this.render();
        }, 14);
      });
    }
    // 絞り込みのボタン（枠の上の帯）。選んだもの以外のマスが、薄くなる
    const bar = this.scene.add.rectangle(TREE_RECT.left + 1, TREE_RECT.top + 1, TREE_RECT.right - TREE_RECT.left - 2, 30, PANEL, 0.96).setOrigin(0);
    this.root.add(bar);
    this.text(TREE_RECT.left + 10, TREE_RECT.top + 9, '絞り込み', 11, COLORS.dim);
    let fx = TREE_RECT.left + 66;
    for (const f of TREE_FILTERS) {
      const on = filter === f.id;
      const fcolor = f.id === 'all' || f.id === 'open' ? COLORS.ink : CATEGORY[f.id].color;
      this.button(fx, TREE_RECT.top + 4, f.w, 22, f.label, on ? fcolor : COLORS.dim, () => {
        this.treeFilter = f.id;
        playSe('select');
        this.render();
      }, 12);
      if (on) this.root.add(this.scene.add.rectangle(fx, TREE_RECT.top + 27, f.w, 2, hex(fcolor), 1).setOrigin(0));
      fx += f.w + 6;
    }
    const counts = { owned: tree.nodes.filter((n) => state[n.id] === 'owned').length, open: tree.nodes.filter((n) => state[n.id] === 'open').length };
    this.text(TREE_RECT.right - 10, TREE_RECT.top + 9, `取得 ${counts.owned} / ${tree.nodes.length}　今取れる ${counts.open}`, 11, counts.open > 0 ? COLORS.amber : COLORS.dim, {}, () => this.jumpToOpen()).setOrigin(1, 0);
    this.text(TREE_RECT.right - 10, TREE_RECT.bottom - 20, `×${zoom.toFixed(1)}`, 11, zoom > TREE_VIEW.min ? COLORS.cyan : COLORS.dim, { fontStyle: '700' }).setOrigin(1, 0);

    // 右側：選んでいるマスの中身
    const def = DATA.upgrades.get(picked.upgrade);
    const cat = CATEGORY[def.category] ?? CATEGORY.body;
    const st = state[picked.id];
    const have = save.upgrades[picked.upgrade] ?? 0;
    const X = 592;
    this.panel(X, 166, 328, 296, st === 'open' ? COLORS.amber : COLORS.line);
    this.text(X + 18, 180, `［${cat.label}］${def.name}`, 17, cat.color, { fontStyle: '700' });
    this.text(X + 18, 204, def.desc, 13, COLORS.ink, { wordWrap: { width: 294, useAdvancedWrap: true }, lineSpacing: 3 });
    // 取ったらどうなるか：恒久強化ぜんたいの合計（今 → 取ったあと）。数値で表せない強化（奥義など）には出さない
    const preview = upgradePreview(DATA.upgrades.all(), save.upgrades, def)[0];
    if (preview) {
      const head = this.text(X + 18, 244, `合計　${preview.label} ${preview.now}`, 12, COLORS.ink);
      if (st !== 'owned') this.text(X + 18 + head.width, 244, ` → ${preview.next}`, 12, COLORS.green, { fontStyle: '700' });
    }
    this.text(X + 18, 262, `取った数 ${have} / ${def.max}　　中心から ${picked.depth} 段目`, 11, COLORS.dim);
    this.text(X + 18, 282, st === 'owned' ? '使った素材' : '必要な素材', 12, COLORS.cyan, { fontStyle: '700' });
    Object.entries(picked.cost).forEach(([id, n], k) => {
      const mat = DATA.materials.get(id);
      const own = save.materials[id] ?? 0;
      const enough = st === 'owned' || own >= n;
      // 1回も手に入れたことのない素材は、名前を伏せる（どのボスの素材かが、先に分かってしまわないように）
      const known = id in save.materials;
      this.text(X + 30, 300 + k * 18, `${materialName(id, save)} ×${n}`, 13, known ? materialColor(mat) : LOCKED, { fontStyle: '700' });
      if (st !== 'owned') this.text(X + 310, 300 + k * 18, `所持 ${own}`, 12, enough ? COLORS.dim : COLORS.red).setOrigin(1, 0);
    });
    const status = {
      owned: ['取得済み', COLORS.green],
      open: [readOnly ? '取れる（隠れ家の強化端末で）' : 'Enter か、もう一度クリックで取る', COLORS.amber],
      short: ['素材が足りない', COLORS.red],
      locked: ['手前のマスを取ると、取れるようになる', LOCKED],
    }[st];
    this.text(X + 18, 358, status[0], 13, status[1], { fontStyle: '700' });
    // 道筋：手前のマスも合わせて、ここまでに要る素材の合計（持っている数／要る数）
    if (path.length > 1) {
      const total = totalCost(path);
      const enough = Object.entries(total).every(([id, n]) => (save.materials[id] ?? 0) >= n);
      this.text(X + 18, 377, `ここまでの道　あと ${path.length} マス`, 12, COLORS.cyan, { fontStyle: '700' });
      this.text(X + 310, 378, enough ? '素材は足りる' : '素材が足りない', 11, enough ? COLORS.green : COLORS.red).setOrigin(1, 0);
      Object.entries(total).slice(0, 6).forEach(([id, n], k) => {
        const own = save.materials[id] ?? 0;
        const known = id in save.materials;
        this.text(X + 24 + (k % 2) * 148, 393 + Math.floor(k / 2) * 13, `${materialName(id, save)} ${own}/${n}`, 11, own >= n ? COLORS.dim : known ? COLORS.red : LOCKED);
      });
    }
    // 凡例
    [['体', '耐久', CATEGORY.body.color], ['技', '攻撃', CATEGORY.skill.color], ['備', '装備・移動', CATEGORY.gear.color]].forEach(([mark, meaning, color], k) => {
      this.text(X + 18 + k * 88, 431, mark, 11, color, { fontStyle: '700' });
      this.text(X + 33 + k * 88, 431, meaning, 11, COLORS.dim);
    });
    [['取得済み', 0, COLORS.green], ['取れる', 76, COLORS.amber], ['素材不足', 138, COLORS.dim], ['まだ', 214, LOCKED]].forEach(([label, dx, color]) => this.text(X + 18 + dx, 446, `● ${label}`, 11, color, { fontStyle: '700' }));
  }

  // ---- 記録 ----
  // 行が多いので、1行ずつの一覧にして、ホイールや W・S で上下に動かせるようにする
  renderRecords(save) {
    const r = save.records;
    const best = bestReachText(save, (id) => DATA.areas.get(id));
    const X = 60;
    const TOP = 138;
    const LINE = 24;
    const VISIBLE = 13;
    const g = this.graphics();
    this.panel(40, 122, 880, 336);

    const lines = []; // 1行ぶんを描く関数（y を受け取る）の並び
    const row = (label, value) => lines.push((y) => {
      this.text(X, y + 3, label, 14, COLORS.dim);
      this.text(X + 240, y + 3, value, 14, COLORS.ink, { fontStyle: '700' });
    });
    const head = (label) => lines.push((y) => {
      g.lineStyle(1, hex(COLORS.line), 1).lineBetween(X, y + LINE - 3, X + 830, y + LINE - 3);
      this.text(X, y + 4, label, 12, COLORS.cyan, { fontStyle: '700' });
    });
    // items を columns 列のマス目にして、1段ずつ行に足す
    const grid = (items, columns, cell) => {
      const cw = 830 / columns;
      for (let i = 0; i < items.length; i += columns) {
        const part = items.slice(i, i + columns);
        lines.push((y) => part.forEach((item, k) => cell(item, X + k * cw, y + 4)));
      }
    };

    row('出撃した回数', `${r.runs}`);
    row('クリアした回数', `${r.clears}`);
    row('最高到達', best);
    row('倒した敵の数（累計）', `${r.kills}`);
    row('データ片', `${save.fragments.length} / ${DATA.fragments.all().length}`);
    row('実績', `${save.achievements.length} / ${DATA.achievements.all().length}`);

    // ボス撃破。隠しボスは、倒すまで名前を出さない
    const bosses = DATA.bosses.all().filter((b) => !b.hidden || (save.bossKills[b.id] ?? 0) > 0);
    lines.push(() => {});
    head('ボス撃破');
    grid(bosses, 3, (b, x, y) => {
      const n = save.bossKills[b.id] ?? 0;
      this.text(x, y, `${b.name}　×${n}`, 13, n > 0 ? COLORS.ink : LOCKED, { fontStyle: '700' });
    });

    // 持っているボス素材
    const owned = DATA.materials.all().filter((def) => (save.materials[def.id] ?? 0) > 0);
    lines.push(() => {});
    head('ボス素材（持っているもの）');
    if (owned.length === 0) lines.push((y) => this.text(X, y + 4, 'まだ持っていない（ボスを倒すと手に入る）', 12, LOCKED));
    else grid(owned, 4, (def, x, y) => this.materialCell(g, def, save.materials[def.id], x, y));

    const start = this.window(lines.length, VISIBLE, { x: 908, y: TOP, h: VISIBLE * LINE });
    lines.slice(start, start + VISIBLE).forEach((draw, i) => draw(TOP + i * LINE));
  }

  // ---- データ片 ----
  renderFragments(save) {
    const list = DATA.fragments.all();
    const g = this.graphics();
    this.panel(40, 122, 300, 336);
    const fragmentRows = 12;
    const firstFragment = this.window(list.length, fragmentRows, { x: 332, y: 132, h: 316 });
    list.forEach((f, index) => {
      if (index < firstFragment || index >= firstFragment + fragmentRows) return;
      const i = index - firstFragment; // 画面の上から何行目か
      const have = save.fragments.includes(f.id);
      const selected = index === this.cursor;
      const color = selected ? COLORS.cyan : have ? COLORS.ink : LOCKED;
      // エリアの色のアイコン。未回収は中身のない暗いアイコン
      drawFragmentIcon(g, 60, 141 + i * 26, 6, have ? hex(AREA_THEMES[DATA.areas.get(f.area).theme].edge) : 0x4a4470, !have);
      this.text(76, 132 + i * 26, have ? f.title : '？？？', 13, color, { fontStyle: have ? '700' : '400' }, () => {
        this.cursor = index;
        this.render();
      });
      if (selected) this.text(46, 132 + i * 26, '▶', 9, COLORS.cyan).setY(135 + i * 26);
    });
    this.panel(356, 122, 564, 336);
    const f = list[this.cursor];
    if (!f) return;
    const area = DATA.areas.get(f.area);
    if (save.fragments.includes(f.id)) {
      drawFragmentIcon(g, 388, 152, 12, hex(AREA_THEMES[area.theme].edge));
      this.text(412, 140, f.title, 16, COLORS.cyan, { fontStyle: '700' });
      this.text(376, 182, f.text, 14, COLORS.ink, { lineSpacing: 10, wordWrap: { width: 524, useAdvancedWrap: true } });
    } else {
      const where = f.source === 'boss' ? 'ボスを倒すと手に入る' : 'データ金庫で見つかる';
      drawFragmentIcon(g, 388, 152, 12, 0x4a4470, true);
      this.text(412, 140, '未回収', 16, LOCKED, { fontStyle: '700' });
      this.text(376, 182, `${area.name}の${where}。`, 14, COLORS.dim);
    }
  }

  // ---- 実績 ----
  renderAchievements(save) {
    const list = DATA.achievements.all();
    const g = this.graphics();
    this.text(40, 114, `解除 ${save.achievements.length} / ${list.length}`, 12, COLORS.dim);
    // 3列に並べる。一度に出すのは6行ぶん（下のボタンに重ならない範囲）で、残りはスクロールで見る
    const achievementRows = 6;
    const firstRow = this.window(Math.ceil(list.length / 3), achievementRows, { x: 926, y: 134, h: achievementRows * 47 - 5 });
    list.forEach((def, i) => {
      const row = Math.floor(i / 3) - firstRow;
      if (row < 0 || row >= achievementRows) return;
      const x = 40 + (i % 3) * 297;
      const y = 134 + row * 47;
      const done = save.achievements.includes(def.id);
      const color = done ? (ELEMENT_COLORS[def.color] ?? COLORS.amber) : LOCKED;
      this.panel(x, y, 287, 42, done ? COLORS.amber : COLORS.line);
      drawAchievementIcon(g, def.icon, x + 21, y + 21, 10, hex(color));
      this.text(x + 42, y + 4, def.name, 13, done ? COLORS.amber : COLORS.dim, { fontStyle: '700' });
      this.text(x + 42, y + 24, def.desc, 10, done ? COLORS.ink : LOCKED);
    });
  }

  // ---- 設定：音量、表示の大きさ、画質 ----
  renderSettings() {
    const s = getSettings();
    const game = this.scene.game;
    const changed = () => {
      saveSettings();
      applyVolume();
      this.render();
    };
    this.panel(40, 122, 880, 336);

    // 音量のゲージ。[−][＋] か、ゲージを直接クリックして変える
    const volumeRow = (y, label, key) => {
      const value = s.volume[key];
      this.text(64, y + 4, label, 14, COLORS.ink, { fontStyle: '700' });
      const set = (v) => () => {
        s.volume[key] = v;
        changed();
        playSe('select');
      };
      this.button(220, y, 30, 26, '−', COLORS.ink, set(stepVolume(value, -1)), 16);
      const filled = Math.round(value * VOLUME_STEPS);
      for (let i = 0; i < VOLUME_STEPS; i++) {
        const cell = this.scene.add.rectangle(262 + i * 24, y + 3, 20, 20, i < filled ? hex(COLORS.cyan) : PANEL, 1).setOrigin(0).setStrokeStyle(1, hex(i < filled ? COLORS.cyan : COLORS.dim));
        cell.setInteractive({ useHandCursor: true }).on('pointerdown', set((i + 1) / VOLUME_STEPS));
        this.root.add(cell);
      }
      this.button(510, y, 30, 26, '＋', COLORS.ink, set(stepVolume(value, 1)), 16);
      this.text(556, y + 4, `${Math.round(value * 100)}%`, 14, COLORS.dim);
    };
    this.text(64, 134, '音', 12, COLORS.cyan, { fontStyle: '700' });
    volumeRow(156, '全体の音量', 'master');
    volumeRow(190, 'BGM', 'bgm');
    volumeRow(224, '効果音', 'se');
    this.button(660, 156, 150, 26, s.muted ? '消音：ON' : '消音：OFF', s.muted ? COLORS.red : COLORS.dim, () => {
      s.muted = !s.muted;
      changed();
    });

    // 操作方法（マニュアル／オート）。音の欄の右に置く
    this.text(660, 196, '操作方法', 12, COLORS.cyan, { fontStyle: '700' });
    if (touch.enabled) {
      // モバイル版：オートに固定（選べない。設定の中身は書き換えないので、パソコンで選んだ操作方法は残る）
      this.button(660, 216, 116, 26, 'オート（固定）', COLORS.cyan, () => playSe('deny'));
      this.text(660, 248, 'ロックオンした敵を向く。R：切り替え', 11, COLORS.dim);
    } else {
      CONTROL_MODES.forEach((opt, i) => {
        this.button(660 + i * 122, 216, 116, 26, opt.label, opt.id === s.controls ? COLORS.cyan : COLORS.dim, () => {
          s.controls = opt.id;
          saveSettings();
          playSe('select');
          this.render();
        });
      });
      this.text(660, 248, s.controls === 'auto' ? 'ロックオンした敵を向く。R：切り替え' : 'カーソルのあるほうを向く', 11, COLORS.dim);
    }

    // 選択肢を横に並べる
    const choiceRow = (y, label, options, current, pick) => {
      this.text(64, y + 4, label, 14, COLORS.ink, { fontStyle: '700' });
      options.forEach((opt, i) => {
        const on = opt.id === current;
        this.button(220 + i * 156, y, 148, 26, opt.label, on ? COLORS.cyan : COLORS.dim, () => pick(opt));
      });
    };
    this.text(64, 270, '画面', 12, COLORS.cyan, { fontStyle: '700' });
    choiceRow(292, '表示の大きさ', DISPLAY_SIZES, s.displaySize, (opt) => {
      s.displaySize = opt.id;
      saveSettings();
      applyDisplaySize(game);
      playSe('select');
      this.render();
    });
    choiceRow(326, '画質', QUALITIES, s.quality, (opt) => {
      if (opt.id === s.quality) return;
      // 画質は起動時に決まるので、変えるには読み込み直す必要がある
      this.confirm('画質を変えるには、ゲームを読み込み直します。\nランの途中なら、今回の進捗は失われます。よろしいですか？', () => {
        s.quality = opt.id;
        saveSettings();
        window.location.reload();
      });
    });
    this.text(696, 331, '上げるほどくっきりするが、重くなる', 11, COLORS.dim);
    choiceRow(360, 'フレームレート', FRAME_RATES, s.frameRate, (opt) => {
      s.frameRate = opt.id;
      saveSettings();
      applyFrameRate(game);
      playSe('select');
      this.render();
    });
    this.text(64, 398, 'フルスクリーン', 14, COLORS.ink, { fontStyle: '700' });
    if (canFullscreen()) {
      this.button(220, 394, 148, 26, isFullscreen() ? '解除する' : '切り替える', COLORS.dim, () => {
        toggleFullscreen().then((ok) => {
          if (!ok) playSe('deny');
          this.scene.time.delayedCall(200, () => this.isOpen && this.render());
        });
      });
    } else {
      // アプリに埋め込まれた画面などでは、フルスクリーンにできない
      this.button(220, 394, 148, 26, '使えない', LOCKED, () => playSe('deny'));
      this.text(380, 399, 'この画面ではフルスクリーンにできない（Chrome などのブラウザで開くと使える）', 11, COLORS.dim);
    }
    this.text(64, 432, '設定は、セーブデータとは別に、このブラウザに保存される。', 11, COLORS.dim);
  }
}
