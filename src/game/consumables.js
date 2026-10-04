// 消耗品を拾う・使う。定義（src/data/consumables.js）の use で、下の部品を選ぶ。
import { ITEMS } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { COLORS, ELEMENT_COLORS } from '../data/theme.js';
import { applyStop, effectDamage } from './combat.js';
import { addShake, burst, floatText, ring, sfx } from './fx.js';

function itemColor(def) {
  return ELEMENT_COLORS[def.color] ?? COLORS[def.color] ?? COLORS.ink;
}

function enemiesNear(world, x, y, radius) {
  return world.enemies.filter((e) => !e.dead && e.spawnT <= 0 && Math.hypot(e.x - x, e.y - y) <= radius + e.r);
}

// 効果の部品。(world, 定義, 狙う位置) → 使えたら true
const USES = {
  // カーソルの位置に投げる。遠すぎるときは届く距離まで
  blast(world, def, aim) {
    const p = world.player;
    let dx = (aim?.x ?? p.x + p.fx * def.range) - p.x;
    let dy = (aim?.y ?? p.y + p.fy * def.range) - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > def.range) {
      dx *= def.range / dist;
      dy *= def.range / dist;
    }
    const x = p.x + dx;
    const y = p.y + dy;
    const color = itemColor(def);
    ring(world, x, y, def.radius, color);
    burst(world, x, y, color, 24, 300);
    addShake(world, 6);
    sfx(world, 'explode');
    for (const e of enemiesNear(world, x, y, def.radius)) {
      effectDamage(world, e, def.damage, def.element);
      if (def.stop) applyStop(e, def.stop);
    }
    return true;
  },

  aura(world, def) {
    const p = world.player;
    const color = itemColor(def);
    ring(world, p.x, p.y, def.radius, color);
    burst(world, p.x, p.y, color, 20, 320);
    for (const e of enemiesNear(world, p.x, p.y, def.radius)) effectDamage(world, e, def.damage, def.element);
    p.slowT = 0; // 自分にかかっている減速も消える
    return true;
  },

  buff(world, def) {
    const p = world.player;
    p.buffs.push({ id: def.id, stat: def.stat, add: def.add, t: def.duration, max: def.duration, color: itemColor(def) });
    ring(world, p.x, p.y, 44, itemColor(def));
    return true;
  },

  smoke(world, def) {
    const p = world.player;
    p.smokeT = def.duration;
    p.smokeRadius = def.radius;
    p.inv = Math.max(p.inv, def.duration);
    ring(world, p.x, p.y, def.radius, itemColor(def));
    return true;
  },
};

export function hasUse(name) {
  return name in USES;
}

// 拾う。同じ種類は1枠に重ねられる。入らなければ false
export function addItem(build, id) {
  const slots = build.items;
  const same = slots.find((s) => s && s.id === id && s.count < ITEMS.stack);
  if (same) {
    same.count++;
    return true;
  }
  const empty = slots.findIndex((s) => !s);
  if (empty < 0) return false;
  slots[empty] = { id, count: 1 };
  return true;
}

// 使う（1・2 キー）。aim: 狙う位置 { x, y }
export function useItem(world, slotIndex, aim = null) {
  const p = world.player;
  const slot = p.build.items[slotIndex];
  if (!slot || world.mode === 'dead' || world.choice) return false;
  const def = DATA.consumables.get(slot.id);
  if (!USES[def.use](world, def, aim)) return false;
  slot.count--;
  if (slot.count <= 0) p.build.items[slotIndex] = null;
  floatText(world, p.x, p.y - 30, def.name, itemColor(def), 14);
  sfx(world, 'item');
  world.events.push({ type: 'item', id: def.id });
  return true;
}

// 敵が落とす消耗品を1つ選ぶ
export function rollConsumable(rng) {
  const ids = DATA.consumables.ids();
  return ids[Math.min(ids.length - 1, Math.floor(rng() * ids.length))];
}

// 効果時間の進行（プレイヤーの更新から毎フレーム呼ぶ）
export function updateItemEffects(world, dt) {
  const p = world.player;
  for (const b of p.buffs) b.t -= dt;
  p.buffs = p.buffs.filter((b) => b.t > 0);
  if (p.smokeT > 0) {
    p.smokeT -= dt;
    // 煙の中に入ってきた敵の弾を消す
    for (const s of world.shots) {
      if (Math.hypot(s.x - p.x, s.y - p.y) <= p.smokeRadius) s.life = 0;
    }
  }
}
