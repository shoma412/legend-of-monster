// テスト用：恒久強化を1段、持っていることにする（効果だけを確かめたいとき用。スキルツリーの買い方は tests/skillTree.test.js で確かめる）
export function grantUpgrade(save, id, levels = 1) {
  save.upgrades[id] = (save.upgrades[id] ?? 0) + levels;
}
