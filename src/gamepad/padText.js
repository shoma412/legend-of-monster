// ゲームパッドで操作している間だけ、画面に出す文字を、ゲームパッドのボタンの名前に言い換える（docs/詳細仕様.md「32. ゲームパッド」）。
// どの画面の文字も、Phaser の Text を通るので、そこに1か所だけ手を入れる。
// ゲームパッドとマウスを持ち替えたときは、今出ている文字を、元の文から出し直す。
import { pad } from '../game/padInput.js';
import { padWords } from '../logic/padWords.js';

const convert = (value) => (Array.isArray(value) ? value.map(padWords) : padWords(value));

export function installPadText(Phaser) {
  const proto = Phaser.GameObjects.Text.prototype;
  const setText = proto.setText;
  proto.setText = function setTextPad(value) {
    this.padRaw = value; // 元の文（持ち替えたときに、出し直す）
    return setText.call(this, pad.active ? convert(value) : value);
  };
}

// 今出ている文字を、すべて出し直す。game は Phaser.Game
function refresh(list) {
  for (const obj of list) {
    if (obj.list) refresh(obj.list); // 入れ物（Container）の中も
    else if (obj.type === 'Text' && obj.padRaw !== undefined) obj.setText(obj.padRaw);
  }
}

export function watchPadText(game) {
  pad.onActive = () => {
    for (const scene of game.scene.getScenes(true)) refresh(scene.children.list);
  };
}
