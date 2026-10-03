// 部屋に置かれているもの（扉・補給端末・闇市の商品・データ金庫の装備）の描画と、その上に出す文字
import { LOOT, ROOM } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, RARITY_COLORS, hex } from '../data/theme.js';

const BODY_FILL = 0x0a0814;

function glowLine(g, color, width, draw) {
  g.lineStyle(width + 5, color, 0.16);
  draw();
  g.lineStyle(width, color, 1);
  draw();
}

function diamond(x, y, r) {
  return [{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }];
}

// 部屋の種類のアイコン（扉の上に出す）。s は大きさ
const ICONS = {
  // 交差した刃
  blades(g, x, y, s, c) {
    glowLine(g, c, 2, () => g.lineBetween(x - s, y - s, x + s, y + s).lineBetween(x + s, y - s, x - s, y + s));
  },
  // 角の生えた頭
  skull(g, x, y, s, c) {
    glowLine(g, c, 2, () => g.strokeCircle(x, y, s * 0.75));
    glowLine(g, c, 2, () => g.lineBetween(x - s * 0.6, y - s * 0.5, x - s * 1.1, y - s * 1.2).lineBetween(x + s * 0.6, y - s * 0.5, x + s * 1.1, y - s * 1.2));
    g.fillStyle(c, 1).fillCircle(x - s * 0.28, y - s * 0.05, 2).fillCircle(x + s * 0.28, y - s * 0.05, 2);
  },
  cross(g, x, y, s, c) {
    glowLine(g, c, 3, () => g.lineBetween(x - s, y, x + s, y).lineBetween(x, y - s, x, y + s));
  },
  coin(g, x, y, s, c) {
    glowLine(g, c, 2, () => g.strokeCircle(x, y, s));
    glowLine(g, c, 2, () => g.lineBetween(x, y - s * 0.55, x, y + s * 0.55));
  },
  vault(g, x, y, s, c) {
    glowLine(g, c, 2, () => g.strokeRect(x - s, y - s, s * 2, s * 2));
    glowLine(g, c, 2, () => g.strokeRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8));
  },
  warning(g, x, y, s, c) {
    const pts = [{ x, y: y - s * 1.1 }, { x: x + s * 1.1, y: y + s * 0.9 }, { x: x - s * 1.1, y: y + s * 0.9 }];
    glowLine(g, c, 2, () => g.strokePoints(pts, true, true));
    g.lineStyle(2, c, 1).lineBetween(x, y - s * 0.4, x, y + s * 0.25);
    g.fillStyle(c, 1).fillCircle(x, y + s * 0.6, 1.5);
  },
};

// 部屋の種類のアイコンを描く（扉、エリアのマップ）
export function drawRoomIcon(g, type, x, y, size, color = null) {
  const room = DATA.rooms.get(type);
  ICONS[room.icon](g, x, y, size, color ?? hex(COLORS[room.color]));
}

export function hasIcon(name) {
  return name in ICONS;
}

function itemColor(item) {
  return hex(RARITY_COLORS[LOOT.rarities[item.rarity].id]);
}

const DRAWERS = {
  door(g, o, world, focused) {
    const room = DATA.rooms.get(o.type);
    const c = hex(COLORS[room.color]);
    const h = 96;
    const pulse = 0.14 + 0.08 * Math.sin(world.time * 6);
    // 壁に開いた出口と、そこから漏れる光
    g.fillStyle(0x0b0914, 1).fillRect(o.x, o.y - h / 2, ROOM.wall, h);
    g.fillStyle(c, focused ? 0.35 : pulse).fillRect(o.x - 46, o.y - h / 2, 46, h);
    g.fillStyle(c, 1).fillRect(o.x - 3, o.y - h / 2, 6, h);
    ICONS[room.icon](g, o.x - 70, o.y, focused ? 13 : 11, c);
  },

  heal(g, o, world) {
    const c = hex(o.used ? COLORS.dim : COLORS.green);
    g.fillStyle(BODY_FILL, 0.9).fillCircle(o.x, o.y, 24);
    glowLine(g, c, 2, () => g.strokeCircle(o.x, o.y, 24));
    if (!o.used) g.lineStyle(1.5, c, 0.5).strokeCircle(o.x, o.y, 30 + 4 * Math.sin(world.time * 4));
    ICONS.cross(g, o.x, o.y, 11, c);
  },

  shop(g, o, world, focused) {
    const amber = hex(COLORS.amber);
    // 台
    g.fillStyle(BODY_FILL, 0.9).fillRect(o.x - 22, o.y + 14, 44, 8);
    g.lineStyle(1.5, amber, 0.8).strokeRect(o.x - 22, o.y + 14, 44, 8);
    const bob = Math.sin(world.time * 3 + o.x) * 2;
    drawGoods(g, o.goods, o.x, o.y - 6 + bob, focused);
  },

  vault(g, o, world, focused) {
    const mag = hex(COLORS.magenta);
    g.fillStyle(BODY_FILL, 0.9).fillRect(o.x - 24, o.y + 14, 48, 8);
    g.lineStyle(1.5, mag, 0.8).strokeRect(o.x - 24, o.y + 14, 48, 8);
    const bob = Math.sin(world.time * 3 + o.x) * 2;
    drawGoods(g, { type: 'gear', item: o.item }, o.x, o.y - 6 + bob, focused);
  },
};

function drawGoods(g, goods, x, y, focused) {
  if (goods.type === 'gear') {
    const c = itemColor(goods.item);
    const pts = diamond(x, y, focused ? 13 : 11);
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    glowLine(g, c, focused ? 3 : 2, () => g.strokePoints(pts, true, true));
  } else if (goods.type === 'kit') {
    const c = hex(COLORS.green);
    g.fillStyle(BODY_FILL, 0.85).fillRect(x - 10, y - 10, 20, 20);
    glowLine(g, c, 2, () => g.strokeRect(x - 10, y - 10, 20, 20));
    ICONS.cross(g, x, y, 5, c);
  } else {
    // インプラント：チップ
    const c = hex(COLORS.magenta);
    g.fillStyle(BODY_FILL, 0.85).fillRect(x - 9, y - 9, 18, 18);
    glowLine(g, c, 2, () => g.strokeRect(x - 9, y - 9, 18, 18));
    g.lineStyle(2, c, 1);
    for (const d of [-5, 0, 5]) g.lineBetween(x + d, y - 14, x + d, y - 9).lineBetween(x + d, y + 9, x + d, y + 14);
  }
}

export function drawObjects(g, world) {
  for (const o of world.objects) DRAWERS[o.kind](g, o, world, o === world.focusObject);
}

function slotName(slotId) {
  return LOOT.slots.find((s) => s.id === slotId).name;
}

// 物の上や下に出す短い文字。[{ x, y, text, color, size }]
export function objectLabels(world) {
  const labels = [];
  const credits = world.player.build.credits;
  for (const o of world.objects) {
    if (o.kind === 'door') {
      const room = DATA.rooms.get(o.type);
      labels.push({ x: o.x - 70, y: o.y - 32, text: room.label, color: COLORS[room.color], size: 13 });
    } else if (o.kind === 'heal') {
      labels.push({ x: o.x, y: o.y - 44, text: o.used ? '補給端末（使用済み）' : '補給端末', color: o.used ? COLORS.dim : COLORS.green, size: 12 });
    } else if (o.kind === 'shop') {
      const g = o.goods;
      const name = g.type === 'gear' ? slotName(g.item.slot) : g.type === 'kit' ? '修復キット' : g.def.name;
      labels.push({ x: o.x, y: o.y - 36, text: name, color: COLORS.ink, size: 12 });
      labels.push({ x: o.x, y: o.y + 34, text: `${g.price} c`, color: credits >= g.price ? COLORS.amber : COLORS.red, size: 13 });
    } else if (o.kind === 'vault') {
      labels.push({ x: o.x, y: o.y - 36, text: slotName(o.item.slot), color: COLORS.ink, size: 12 });
    }
  }
  // エリートは名前（特性つき）を頭の上に出す
  for (const e of world.enemies) {
    if (e.elite && !e.dead && e.spawnT <= 0) labels.push({ x: e.x, y: e.y - e.r - 22, text: e.def.name, color: COLORS.red, size: 11 });
  }
  return labels;
}

// 画面下に出す操作の案内（装備の比較が出るものは、比較パネル側に出す）
export function focusPrompt(world) {
  const o = world.focusObject;
  if (!o) return null;
  const p = world.player;
  if (o.kind === 'door') return { text: `E：${DATA.rooms.get(o.type).label} へ進む`, color: COLORS[DATA.rooms.get(o.type).color] };
  if (o.kind === 'heal') return o.used ? { text: '補給端末は使用済み', color: COLORS.dim } : { text: 'E：修復する（最大HPの40%回復）', color: COLORS.green };
  if (o.kind === 'shop' && o.goods.type === 'kit') return { text: `E：修復キットを買う（${o.goods.price} c）　所持 ${p.build.kits}`, color: COLORS.green };
  if (o.kind === 'shop' && o.goods.type === 'implant') return { text: `E：${o.goods.def.name} を買う（${o.goods.price} c）　${o.goods.def.desc}`, color: COLORS.magenta };
  return null;
}

// 比較パネルに出す装備（落ちている装備、闇市の装備、データ金庫の装備）と、その案内文
export function focusGear(world) {
  if (world.focusLoot) return { item: world.focusLoot.item, head: '落ちている装備', hint: null };
  const o = world.focusObject;
  if (o?.kind === 'shop' && o.goods.type === 'gear') return { item: o.goods.item, head: '売り物', hint: `E：買う（${o.goods.price} c）` };
  if (o?.kind === 'vault') return { item: o.item, head: 'データ金庫', hint: 'E：これを持っていく（残りは消える）' };
  return null;
}
