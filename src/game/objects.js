// 部屋に置かれているもの（落ちている装備、扉、補給端末、闇市の商品、データ金庫の装備）と、E キーでの操作
import { LOOT, PLAYER, ROOMGEN } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { addImplant, equipFocusLoot, equipItem } from './build.js';
import { floatText, ring } from './fx.js';

// 一番近い「調べられるもの」を探す。落ちている装備は world.focusLoot、それ以外は world.focusObject
export function updateFocus(world) {
  const p = world.player;
  let best = null;
  let bestDist = Infinity;
  for (const l of world.loot) {
    const d = Math.hypot(l.x - p.x, l.y - p.y);
    if (d <= LOOT.pickupRadius && d < bestDist) {
      best = { loot: l };
      bestDist = d;
    }
  }
  for (const o of world.objects) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d <= o.r && d < bestDist) {
      best = { object: o };
      bestDist = d;
    }
  }
  world.focusLoot = best?.loot ?? null;
  world.focusObject = best?.object ?? null;
}

function say(world, text, color) {
  const p = world.player;
  floatText(world, p.x, p.y - 30, text, color, 14);
}

const HANDLERS = {
  // 隠れ家に置いてあるもの。world.request を見て、画面側が処理する
  station(world, o) {
    world.request = o.id;
  },

  // 扉：次の部屋へ。world.exit を見て、画面側が部屋を切り替える
  door(world, o) {
    world.exit = o.target;
  },

  heal(world, o) {
    if (o.used) return;
    const p = world.player;
    const amount = Math.round(p.stats.maxHp * ROOMGEN.supply.heal);
    p.hp = Math.min(p.stats.maxHp, p.hp + amount);
    o.used = true;
    say(world, `修復 +${amount}`, COLORS.green);
    ring(world, o.x, o.y, 60, COLORS.green);
  },

  shop(world, o) {
    const p = world.player;
    const g = o.goods;
    if (p.build.credits < g.price) {
      say(world, 'クレジット不足', COLORS.red);
      return;
    }
    p.build.credits -= g.price;
    if (g.type === 'gear') equipItem(world, g.item);
    else if (g.type === 'kit') {
      p.build.kits++;
      say(world, '修復キット +1', COLORS.green);
    } else if (g.type === 'implant') addImplant(world, g.def);
    world.objects = world.objects.filter((x) => x !== o);
  },

  // データ片：拾った時点で持ち帰りが確定する（ラン側がセーブデータに記録する）
  fragment(world, o) {
    world.events.push({ type: 'fragment', id: o.id });
    ring(world, o.x, o.y, 50, COLORS.cyan);
    world.objects = world.objects.filter((x) => x !== o);
  },

  // データ金庫：1つ取ると残りは消える
  vault(world, o) {
    equipItem(world, o.item);
    world.objects = world.objects.filter((x) => x.kind !== 'vault');
  },
};

// E キー
export function interact(world) {
  if (world.mode === 'dead' || world.choice) return false;
  if (world.focusLoot) return equipFocusLoot(world);
  const o = world.focusObject;
  if (!o) return false;
  HANDLERS[o.kind](world, o);
  updateFocus(world);
  return true;
}

// Q キー：修復キットを使う
export function useKit(world) {
  const p = world.player;
  if (world.mode === 'dead' || world.choice || p.build.kits <= 0 || p.hp >= p.stats.maxHp) return false;
  p.build.kits--;
  p.hp = Math.min(p.stats.maxHp, p.hp + PLAYER.kit.heal);
  say(world, `修復キット +${PLAYER.kit.heal}`, COLORS.green);
  ring(world, p.x, p.y, 40, COLORS.green);
  return true;
}
