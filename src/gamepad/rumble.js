// つないであるコントローラーを振動させる（docs/詳細仕様.md「32. ゲームパッド」の「振動」）。
// 対応していないブラウザ・コントローラーでは、何も起きない
import { getSettings } from '../game/settingsStore.js';
import { rumbleParams } from '../logic/rumble.js';

export function playRumble(name, index = 0) {
  try {
    const params = rumbleParams(name, index, getSettings().vibration);
    if (!params || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find((g) => g && g.connected && g.vibrationActuator);
    gp?.vibrationActuator.playEffect('dual-rumble', params)?.catch?.(() => {});
  } catch {
    // 振動できない環境では、そのまま
  }
}
