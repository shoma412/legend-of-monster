// 会話の画面。画面下に、顔イラスト・名前・本文を出す。隠れ家と戦闘画面で同じものを使う。
//   左クリック・E・Enter：次へ（文字が出ている途中なら、まず全部表示する）
//   Esc：その会話をまるごと飛ばす（選択肢があれば、選択肢まで飛ぶ）
//   1・2：選択肢を選ぶ（クリックでも選べる）
// 開いている間は、使う側がゲームの進行を止める（isOpen を見る）。
import { playSe } from '../audio/audio.js';
import { SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, FONTS, hex } from '../data/theme.js';
import { displayName } from '../logic/dialogue.js';
import { PORTRAIT_SIZE, ensurePortrait } from '../render/portraits.js';

const W = SCREEN.width;
const H = SCREEN.height;
const PANEL_H = 152;
const PANEL_Y = H - PANEL_H - 14;
const FACE = PORTRAIT_SIZE * 2; // 顔は2倍に拡大して出す
const TEXT_X = 40 + 14 + FACE + 18;
const TYPE_SPEED = 48; // 1秒に出す文字数
const GLITCH_INTERVAL = 90; // ごまかした名前を入れ替える間隔（ミリ秒）
const GUARD_MS = 180; // 閉じた直後に、同じキーやクリックがゲーム側に効かないようにする時間

export function createDialogueBox(scene) {
  const root = scene.add.container(0, 0).setDepth(40).setVisible(false);
  // 画面全体でクリックを受ける（後ろのゲームには届かせない）
  const backdrop = scene.add.rectangle(0, 0, W, H, 0x05040a, 0.35).setOrigin(0).setInteractive();
  const panel = scene.add.rectangle(40, PANEL_Y, W - 80, PANEL_H, 0x0c0e1c, 0.96).setOrigin(0).setStrokeStyle(2, hex(COLORS.cyan));
  const faceFrame = scene.add.rectangle(40 + 12, PANEL_Y + 10, FACE + 4, FACE + 4, 0x10142a, 1).setOrigin(0).setStrokeStyle(1, hex(COLORS.line));
  const face = scene.add.image(40 + 14, PANEL_Y + 12, '__DEFAULT').setOrigin(0).setDisplaySize(FACE, FACE);
  const nameText = scene.add.text(TEXT_X, PANEL_Y + 12, '', { fontFamily: FONTS.body, fontStyle: '700', fontSize: '16px', color: COLORS.amber });
  const bodyText = scene.add.text(TEXT_X, PANEL_Y + 40, '', {
    fontFamily: FONTS.body, fontSize: '17px', color: COLORS.ink, lineSpacing: 9, wordWrap: { width: W - 80 - (TEXT_X - 40) - 24, useAdvancedWrap: true },
  });
  const hint = scene.add.text(W - 54, PANEL_Y + PANEL_H - 10, '', { fontFamily: FONTS.body, fontSize: '11px', color: COLORS.dim }).setOrigin(1, 1);
  root.add([backdrop, panel, faceFrame, face, nameText, bodyText, hint]);

  // 選択肢のボタン（2つ）
  const buttons = [0, 1].map((i) => {
    const y = PANEL_Y + 70 + i * 38;
    const bg = scene.add.rectangle(TEXT_X, y, 530, 32, 0x110f1d, 0.95).setOrigin(0).setStrokeStyle(1, hex(COLORS.cyan)).setInteractive({ useHandCursor: true });
    const label = scene.add.text(TEXT_X + 12, y + 16, '', { fontFamily: FONTS.body, fontStyle: '700', fontSize: '14px', color: COLORS.ink }).setOrigin(0, 0.5);
    bg.on('pointerdown', (_pointer, _x, _y, event) => {
      event.stopPropagation();
      pick(i);
    });
    root.add([bg, label]);
    return { bg, label };
  });

  let lines = [];
  let index = 0;
  let shown = 0; // 今の行で、何文字まで出したか
  let speaker = null;
  let glitchT = 0;
  let options = {};
  let choosing = false;
  let closedAt = -Infinity;
  const box = {
    isOpen: false,
    // 開いているか、閉じた直後か。ゲームの操作を受け付けないほうがよいとき true
    get blocking() {
      return box.isOpen || performance.now() - closedAt < GUARD_MS;
    },

    // lines を順に出す。options: {
    //   choices: [{ label, blocked }]  最後の行のあとに出す選択肢（blocked は選べない理由。選べるなら null）
    //   onChoice: (i) => lines | null   選んだあとに続ける会話を返す
    //   onDone: () => void              全部終わったとき
    // }
    play(newLines, newOptions = {}) {
      if (!newLines?.length) {
        newOptions.onDone?.();
        return;
      }
      lines = newLines;
      options = newOptions;
      index = 0;
      choosing = false;
      box.isOpen = true;
      root.setVisible(true);
      showLine();
    },

    update(deltaMs) {
      if (!box.isOpen) return;
      const full = lines[index].text;
      if (shown < full.length) {
        shown = Math.min(full.length, shown + (TYPE_SPEED * deltaMs) / 1000);
        bodyText.setText(full.slice(0, Math.floor(shown)));
      }
      // 依頼主の名前は、記号がちらちら入れ替わる
      if (speaker.glitch) {
        glitchT -= deltaMs;
        if (glitchT <= 0) {
          glitchT = GLITCH_INTERVAL;
          nameText.setText(displayName(speaker));
        }
      }
    },
  };

  function showLine() {
    const line = lines[index];
    speaker = DATA.characters.get(line.who);
    shown = 0;
    glitchT = 0;
    face.setTexture(ensurePortrait(scene, speaker.portrait, line.mood ?? 'normal')).setDisplaySize(FACE, FACE);
    nameText.setText(displayName(speaker)).setColor(COLORS[speaker.color] ?? COLORS.amber);
    bodyText.setText('');
    setChoices(false);
    hint.setText('クリック / E：次へ　　Esc：飛ばす');
  }

  function setChoices(on) {
    choosing = on;
    buttons.forEach(({ bg, label }, i) => {
      const choice = on ? options.choices?.[i] : null;
      bg.setVisible(!!choice);
      label.setVisible(!!choice);
      if (!choice) return;
      const blocked = !!choice.blocked;
      label.setText(`${i + 1}　${choice.label}${blocked ? `（${choice.blocked}）` : ''}`).setColor(blocked ? COLORS.dim : COLORS.ink);
      bg.setStrokeStyle(1, hex(blocked ? COLORS.line : COLORS.cyan));
    });
    if (on) {
      // 選択肢を出すときは、本文を1行ぶんにして場所を空ける
      bodyText.setText(lines[index].text);
      hint.setText('1 / 2 かクリックで選ぶ');
    }
  }

  function close() {
    box.isOpen = false;
    closedAt = performance.now();
    root.setVisible(false);
    const done = options.onDone;
    options = {};
    done?.();
  }

  function atLastLine() {
    return index >= lines.length - 1;
  }

  function advance() {
    if (!box.isOpen || choosing) return;
    const full = lines[index].text;
    if (shown < full.length) {
      shown = full.length;
      bodyText.setText(full);
      return;
    }
    playSe('select');
    if (!atLastLine()) {
      index++;
      showLine();
    } else if (options.choices?.length) {
      setChoices(true);
    } else {
      close();
    }
  }

  function skip() {
    if (!box.isOpen || choosing) return;
    if (options.choices?.length) {
      index = lines.length - 1;
      showLine();
      shown = lines[index].text.length;
      setChoices(true);
    } else {
      close();
    }
  }

  function pick(i) {
    if (!box.isOpen || !choosing) return;
    const choice = options.choices?.[i];
    if (!choice) return;
    if (choice.blocked) {
      playSe('deny');
      return;
    }
    playSe('confirm');
    const next = options.onChoice?.(i);
    // 選んだあとの会話に続ける（選択肢はもう出さない）
    options = { onDone: options.onDone };
    if (next?.length) {
      lines = next;
      index = 0;
      showLine();
    } else {
      close();
    }
  }

  backdrop.on('pointerdown', () => advance());
  const kb = scene.input.keyboard;
  kb.on('keydown-E', advance);
  kb.on('keydown-ENTER', advance);
  kb.on('keydown-ESC', skip);
  kb.on('keydown-ONE', () => pick(0));
  kb.on('keydown-TWO', () => pick(1));

  return box;
}
