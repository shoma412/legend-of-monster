// 部屋に置かれているもの（扉・補給端末・闇市の商品・データ金庫の装備）の描画と、その上に出す文字
import { LOOT, ROOM } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, ELEMENT_COLORS, RARITY_COLORS, hex } from '../data/theme.js';
import { implantDesc, nextImplantLevel } from '../logic/stats.js';
import { drawItemIcon, drawSlotIcon } from './icons.js';

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
  // 下向きの矢印（次のエリアへ降りる）
  down(g, x, y, s, c) {
    const pts = [{ x: x - s, y: y - s * 0.3 }, { x, y: y + s * 0.8 }, { x: x + s, y: y - s * 0.3 }];
    glowLine(g, c, 2.5, () => g.strokePoints(pts, false, false));
    glowLine(g, c, 2.5, () => g.lineBetween(x, y - s, x, y + s * 0.6));
  },
  // 吹き出し（遭遇）
  talk(g, x, y, s, c) {
    const pts = [
      { x: x - s, y: y - s * 0.8 }, { x: x + s, y: y - s * 0.8 }, { x: x + s, y: y + s * 0.35 },
      { x: x - s * 0.1, y: y + s * 0.35 }, { x: x - s * 0.6, y: y + s }, { x: x - s * 0.55, y: y + s * 0.35 }, { x: x - s, y: y + s * 0.35 },
    ];
    glowLine(g, c, 2, () => g.strokePoints(pts, true, true));
    g.fillStyle(c, 1).fillCircle(x - s * 0.45, y - s * 0.22, 1.3).fillCircle(x, y - s * 0.22, 1.3).fillCircle(x + s * 0.45, y - s * 0.22, 1.3);
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

// 武器ラックに立てかけてある武器の形
const WEAPON_GLYPHS = {
  greatsword(g, x, y, c) {
    glowLine(g, c, 5, () => g.lineBetween(x - 9, y + 16, x + 9, y - 18));
    glowLine(g, c, 2, () => g.lineBetween(x - 12, y + 6, x - 1, y + 12));
  },
  sword(g, x, y, c) {
    glowLine(g, c, 2.5, () => g.lineBetween(x - 6, y + 14, x + 7, y - 14));
    glowLine(g, c, 2, () => g.lineBetween(x - 9, y + 6, x, y + 10));
  },
  gun(g, x, y, c) {
    glowLine(g, c, 4, () => g.lineBetween(x - 12, y - 6, x + 13, y - 6));
    glowLine(g, c, 4, () => g.lineBetween(x - 8, y - 6, x - 11, y + 10));
  },
};

// 人物の線画。who で形を変える
const FIGURES = {
  // 立っている人（頭・肩・胴）
  person(g, x, y, c) {
    g.fillStyle(BODY_FILL, 0.9).fillCircle(x, y - 17, 7);
    glowLine(g, c, 2, () => g.strokeCircle(x, y - 17, 7));
    const body = [{ x: x - 10, y: y - 8 }, { x: x + 10, y: y - 8 }, { x: x + 7, y: y + 16 }, { x: x - 7, y: y + 16 }];
    g.fillStyle(BODY_FILL, 0.9).fillPoints(body, true);
    glowLine(g, c, 2, () => g.strokePoints(body, true, true));
  },
  hal(g, x, y, c, world) {
    FIGURES.person(g, x, y, c);
    // 結んだ髪と、手に持った工具
    g.fillStyle(c, 1).fillCircle(x + 9, y - 21, 3);
    const swing = Math.sin(world.time * 3) * 2;
    glowLine(g, c, 2, () => g.lineBetween(x - 12, y + 2 + swing, x - 19, y - 8 + swing));
  },
  peddler(g, x, y, c) {
    FIGURES.person(g, x, y, c);
    // つばの広い帽子と、背負った荷
    glowLine(g, c, 2, () => g.lineBetween(x - 14, y - 22, x + 14, y - 22));
    g.fillStyle(BODY_FILL, 0.9).fillRect(x + 10, y - 10, 12, 20);
    glowLine(g, c, 1.5, () => g.strokeRect(x + 10, y - 10, 12, 20));
  },
  machine(g, x, y, c, world) {
    // 四角い頭、点滅する片目、曲がったアンテナ
    g.fillStyle(BODY_FILL, 0.9).fillRect(x - 11, y - 24, 22, 17).fillRect(x - 13, y - 4, 26, 20);
    glowLine(g, c, 2, () => g.strokeRect(x - 11, y - 24, 22, 17));
    glowLine(g, c, 2, () => g.strokeRect(x - 13, y - 4, 26, 20));
    glowLine(g, c, 1.5, () => g.lineBetween(x - 5, y - 24, x - 5, y - 31).lineBetween(x - 5, y - 31, x, y - 35));
    g.fillStyle(c, 1).fillRect(x - 7, y - 19, 5, 4);
    if (Math.sin(world.time * 9) > 0.2) g.fillStyle(c, 0.6).fillRect(x + 2, y - 19, 5, 4);
    g.lineStyle(1.5, c, 0.7).lineBetween(x + 13, y + 2, x + 20, y + 12);
  },
  scavenger(g, x, y, c) {
    // 壁にもたれて倒れている
    g.fillStyle(BODY_FILL, 0.9).fillCircle(x - 14, y + 2, 7);
    glowLine(g, c, 2, () => g.strokeCircle(x - 14, y + 2, 7));
    const body = [{ x: x - 7, y: y - 4 }, { x: x + 16, y: y + 2 }, { x: x + 18, y: y + 14 }, { x: x - 8, y: y + 12 }];
    g.fillStyle(BODY_FILL, 0.9).fillPoints(body, true);
    glowLine(g, c, 2, () => g.strokePoints(body, true, true));
    g.lineStyle(2, c, 0.8).lineBetween(x + 18, y + 12, x + 28, y + 16);
  },
};

// 隠れ家に置いてあるものの見た目
const STATION_ICONS = {
  // 人物（ハル）
  npc(g, o, world, focused, c) {
    (FIGURES[o.who] ?? FIGURES.person)(g, o.x, o.y, c, world);
    if (focused) g.lineStyle(1, c, 0.5).strokeCircle(o.x, o.y, 34);
  },
  // 通信端末（依頼主と話す）：画面と、電波を出すアンテナ
  comm(g, o, world, focused, c) {
    g.fillStyle(BODY_FILL, 0.9).fillRect(o.x - 20, o.y - 12, 40, 26);
    glowLine(g, c, 2, () => g.strokeRect(o.x - 20, o.y - 12, 40, 26));
    // 画面の波形
    g.lineStyle(2, c, 0.9);
    for (let i = 0; i < 6; i++) {
      const h = 3 + 6 * Math.abs(Math.sin(world.time * 5 + i * 1.3));
      g.lineBetween(o.x - 13 + i * 5, o.y + 1 - h, o.x - 13 + i * 5, o.y + 1 + h);
    }
    glowLine(g, c, 2, () => g.lineBetween(o.x + 12, o.y - 12, o.x + 12, o.y - 26));
    const wave = (world.time * 1.5) % 1;
    g.lineStyle(1.5, c, 1 - wave).strokeCircle(o.x + 12, o.y - 26, 3 + wave * 10);
    g.lineStyle(2, c, 1).lineBetween(o.x, o.y + 14, o.x, o.y + 22).lineBetween(o.x - 12, o.y + 22, o.x + 12, o.y + 22);
  },
  weapon(g, o, world, focused, c) {
    g.fillStyle(BODY_FILL, 0.9).fillRect(o.x - 24, o.y + 18, 48, 8);
    g.lineStyle(1.5, c, 0.8).strokeRect(o.x - 24, o.y + 18, 48, 8);
    if (o.selected) g.lineStyle(2, c, 0.5 + 0.3 * Math.sin(world.time * 5)).strokeCircle(o.x, o.y, 34);
    (WEAPON_GLYPHS[o.weapon] ?? WEAPON_GLYPHS.sword)(g, o.x, o.y - 2, c);
  },
  terminal(g, o, world, focused, c) {
    g.fillStyle(BODY_FILL, 0.9).fillRect(o.x - 22, o.y - 18, 44, 30);
    glowLine(g, c, 2, () => g.strokeRect(o.x - 22, o.y - 18, 44, 30));
    g.lineStyle(2, c, 0.8);
    for (let i = 0; i < 3; i++) g.lineBetween(o.x - 14, o.y - 10 + i * 7, o.x - 14 + 12 + ((i * 7 + Math.floor(world.time * 2)) % 3) * 6, o.y - 10 + i * 7);
    g.lineStyle(2, c, 1).lineBetween(o.x, o.y + 12, o.x, o.y + 22).lineBetween(o.x - 12, o.y + 22, o.x + 12, o.y + 22);
  },
  gate(g, o, world, focused, c) {
    const h = 120;
    const pulse = 0.14 + 0.08 * Math.sin(world.time * 6);
    g.fillStyle(c, focused ? 0.35 : pulse).fillRect(o.x - 46, o.y - h / 2, 46, h);
    g.fillStyle(c, 1).fillRect(o.x - 7, o.y - h / 2, 6, h);
    const pts = [{ x: o.x - 84, y: o.y - 9 }, { x: o.x - 66, y: o.y }, { x: o.x - 84, y: o.y + 9 }];
    glowLine(g, c, 2, () => g.strokePoints(pts, false, false));
  },
};

const DRAWERS = {
  // 落ちている消耗品
  pickup(g, o, world, focused) {
    const def = DATA.consumables.get(o.id);
    const c = consumableColor(def);
    const bob = Math.sin(world.time * 4 + o.x) * 3;
    drawItemIcon(g, def.icon, o.x, o.y + bob, focused ? 11 : 9, c);
    if (focused) g.lineStyle(1, c, 0.5).strokeCircle(o.x, o.y, LOOT.pickupRadius * 0.7);
  },
  station(g, o, world, focused) {
    STATION_ICONS[o.icon](g, o, world, focused, hex(o.color ?? COLORS.ink));
  },

  // 遭遇部屋の人物
  npc(g, o, world, focused) {
    const c = hex(o.used ? COLORS.dim : COLORS[o.color] ?? COLORS.ink);
    (FIGURES[o.who] ?? FIGURES.person)(g, o.x, o.y, c, world);
    if (!o.used) g.lineStyle(1.5, c, focused ? 0.7 : 0.3 + 0.2 * Math.sin(world.time * 4)).strokeCircle(o.x, o.y, 36);
  },

  // データ片：ゆっくり回る記録チップ
  fragment(g, o, world, focused) {
    const c = hex(COLORS.cyan);
    const a = world.time * 1.5;
    const r = focused ? 13 : 11;
    const pts = [0, 1, 2, 3, 4, 5].map((i) => ({ x: o.x + Math.cos(a + (i * Math.PI) / 3) * r, y: o.y + Math.sin(a + (i * Math.PI) / 3) * r }));
    g.fillStyle(BODY_FILL, 0.85).fillPoints(pts, true);
    glowLine(g, c, 2, () => g.strokePoints(pts, true, true));
    g.fillStyle(c, 1).fillCircle(o.x, o.y, 2.5);
  },

  door(g, o, world, focused) {
    const room = DATA.rooms.get(o.type);
    const c = hex(COLORS[room.color]);
    const h = 96;
    const pulse = 0.14 + 0.08 * Math.sin(world.time * 6);
    // 壁に開いた出口と、そこから漏れる光
    g.fillStyle(c, focused ? 0.35 : pulse).fillRect(o.x - 46, o.y - h / 2, 46, h);
    g.fillStyle(c, 1).fillRect(o.x - 7, o.y - h / 2, 6, h);
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

export function consumableColor(def) {
  return hex(ELEMENT_COLORS[def.color] ?? COLORS[def.color] ?? COLORS.ink);
}

function drawGoods(g, goods, x, y, focused) {
  if (goods.type === 'gear') {
    // 装備はスロットごとの形（刃・盾・指輪）で、色はレア度
    drawSlotIcon(g, goods.item.slot, x, y, focused ? 13 : 11, itemColor(goods.item));
  } else if (goods.type === 'item') {
    const def = DATA.consumables.get(goods.id);
    drawItemIcon(g, def.icon, x, y, focused ? 12 : 10, consumableColor(def));
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
    if (o.kind === 'station') {
      const gate = o.icon === 'gate';
      labels.push({ x: gate ? o.x - 76 : o.x, y: gate ? o.y - 34 : o.y - 42, text: o.label ?? '', color: o.color ?? COLORS.ink, size: 13 });
      if (o.sub) labels.push({ x: o.x, y: o.y + 40, text: o.sub, color: o.color ?? COLORS.dim, size: 11 });
    } else if (o.kind === 'door') {
      const room = DATA.rooms.get(o.type);
      labels.push({ x: o.x - 70, y: o.y - 32, text: room.label, color: COLORS[room.color], size: 13 });
    } else if (o.kind === 'heal') {
      labels.push({ x: o.x, y: o.y - 44, text: o.used ? '補給端末（使用済み）' : '補給端末', color: o.used ? COLORS.dim : COLORS.green, size: 12 });
    } else if (o.kind === 'shop') {
      const g = o.goods;
      const name = g.type === 'gear' ? slotName(g.item.slot) : g.type === 'kit' ? '修復キット' : g.type === 'item' ? DATA.consumables.get(g.id).name : g.def.name;
      labels.push({ x: o.x, y: o.y - 36, text: name, color: COLORS.ink, size: 12 });
      labels.push({ x: o.x, y: o.y + 34, text: `${g.price} c`, color: credits >= g.price ? COLORS.amber : COLORS.red, size: 13 });
    } else if (o.kind === 'vault') {
      labels.push({ x: o.x, y: o.y - 36, text: slotName(o.item.slot), color: COLORS.ink, size: 12 });
    } else if (o.kind === 'fragment') {
      labels.push({ x: o.x, y: o.y - 28, text: 'データ片', color: COLORS.cyan, size: 12 });
    } else if (o.kind === 'npc') {
      labels.push({ x: o.x, y: o.y - 50, text: DATA.characters.get(o.who).name, color: o.used ? COLORS.dim : COLORS[o.color] ?? COLORS.ink, size: 12 });
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
  if (o.kind === 'station') return o.prompt ? { text: o.prompt, color: o.color ?? COLORS.ink } : null;
  if (o.kind === 'door' && o.type === 'descend') return { text: 'E：次のエリアへ進む', color: COLORS.cyan };
  if (o.kind === 'door') return { text: `E：${DATA.rooms.get(o.type).label} へ進む`, color: COLORS[DATA.rooms.get(o.type).color] };
  if (o.kind === 'pickup') {
    const def = DATA.consumables.get(o.id);
    return { text: `E：${def.name} を拾う — ${def.desc}`, color: ELEMENT_COLORS[def.color] ?? COLORS[def.color] ?? COLORS.ink };
  }
  if (o.kind === 'shop' && o.goods.type === 'item') {
    const def = DATA.consumables.get(o.goods.id);
    return { text: `E：${def.name} を買う（${o.goods.price} c）　${def.desc}`, color: ELEMENT_COLORS[def.color] ?? COLORS[def.color] ?? COLORS.ink };
  }
  if (o.kind === 'fragment') return { text: 'E：データ片を回収する（死んでも失わない）', color: COLORS.cyan };
  if (o.kind === 'npc') return o.used ? null : { text: 'E：話しかける', color: COLORS[o.color] ?? COLORS.ink };
  if (o.kind === 'heal') return o.used ? { text: '補給端末は使用済み', color: COLORS.dim } : { text: 'E：修復する（最大HPの40%回復）', color: COLORS.green };
  if (o.kind === 'shop' && o.goods.type === 'kit') return { text: `E：修復キットを買う（${o.goods.price} c）　所持 ${p.build.kits}`, color: COLORS.green };
  if (o.kind === 'shop' && o.goods.type === 'implant') {
    // 持っているインプラントなら、買うと強化になる
    const def = o.goods.def;
    const owned = p.build.implants[def.id] ?? 0;
    const level = nextImplantLevel(p.build, def.id);
    const head = owned > 0 ? `${def.name} を Lv${level} に強化する` : `${def.name} を買う`;
    return { text: `E：${head}（${o.goods.price} c）　${implantDesc(def, level)}`, color: COLORS.magenta };
  }
  return null;
}

// 比較パネルに出す装備（落ちている装備、闇市の装備、データ金庫の装備）と、その案内文
export function focusGear(world) {
  if (world.focusLoot) return { item: world.focusLoot.item, head: '落ちている装備', hint: null, stash: true };
  const o = world.focusObject;
  if (o?.kind === 'shop' && o.goods.type === 'gear') return { item: o.goods.item, head: '売り物', hint: `E：買う（${o.goods.price} c）` };
  if (o?.kind === 'vault') return { item: o.item, head: 'データ金庫', hint: 'E：これを持っていく（残りは消える）' };
  return null;
}
