// エリアの地図を描く。画面右上の小さい地図と、M キーで出す大きい地図で同じ描き方を使う。
import { nodeState, reachableNodes } from '../logic/areaGen.js';
import { COLORS, hex } from '../data/theme.js';
import { drawRoomIcon } from './objects.js';

const DONE = 0x2f6b4c; // 通った部屋と道（暗い緑）
const OFF = 0x2a2546; // もう行けない部屋と道

// layout: { x, y, colGap, rowGap, icon }  (x, y) は最初の部屋の位置
export function nodePosition(node, layout) {
  return { x: layout.x + node.col * layout.colGap, y: layout.y + (node.row - 0.5) * layout.rowGap };
}

export function drawAreaMap(g, plan, layout) {
  const reachable = reachableNodes(plan);
  const state = (id) => nodeState(plan, id, reachable);
  const nodes = Object.values(plan.nodes);

  // 道。通った道は緑、これから通れる道は明るく、行けなくなった道は暗く
  for (const node of nodes) {
    const from = nodePosition(node, layout);
    for (const id of node.next) {
      const to = nodePosition(plan.nodes[id], layout);
      const a = state(node.id);
      const b = state(id);
      const walked = plan.visited.includes(node.id) && plan.visited.includes(id) && plan.visited.indexOf(id) === plan.visited.indexOf(node.id) + 1;
      const open = (a === 'current' || a === 'next' || a === 'ahead') && b !== 'off';
      if (walked) g.lineStyle(layout.line, DONE, 1);
      else if (open) g.lineStyle(layout.line, hex(COLORS.ink), a === 'current' ? 0.9 : 0.45);
      else g.lineStyle(layout.line, OFF, 1);
      g.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  // 部屋。アイコンの下地を塗って、道の線がアイコンに重ならないようにする
  for (const node of nodes) {
    const { x, y } = nodePosition(node, layout);
    const s = state(node.id);
    const size = layout.icon;
    g.fillStyle(layout.bg, 1).fillRect(x - size - 3, y - size - 3, (size + 3) * 2, (size + 3) * 2);
    if (s === 'current') g.lineStyle(layout.line, hex(COLORS.ink), 1).strokeRect(x - size - 3, y - size - 3, (size + 3) * 2, (size + 3) * 2);
    drawRoomIcon(g, node.type, x, y, size, s === 'done' ? DONE : s === 'off' ? OFF : null);
  }
}
