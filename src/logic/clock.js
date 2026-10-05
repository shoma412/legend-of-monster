// 前のコマから実際に何秒たったかを数える時計。
// Phaser が渡してくる経過時間は、フレームレートに上限をかけると実際より長くなることがある
// （上限とモニターの速さが割り切れないとき、端数が二重に数えられる）。そのまま使うと、
// フレームレートの設定によってゲームの速さが変わってしまうので、時刻の差を自分で測る。
export function createClock() {
  let last = null;
  return {
    // now はミリ秒の時刻。前に呼ばれてからの秒数を返す（最初の1回は 0）
    tick(now) {
      const seconds = last === null ? 0 : Math.max(0, (now - last) / 1000);
      last = now;
      return seconds;
    },
  };
}
