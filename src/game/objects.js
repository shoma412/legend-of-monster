// 部屋に置かれているもの（落ちている装備、扉、補給端末、闇市の商品、データ金庫の装備）と、E キーでの操作
import { LOOT, PLAYER, ROOMGEN } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { DATA } from '../data/index.js';
import { addImplant, equipFocusLoot, equipItem, stashFocusLoot } from './build.js';
import { healPlayer } from './combat.js';
import { addItem } from './consumables.js';
import { floatText, ring, sfx } from './fx.js';

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
  // 隠れ家に置いてあるもの（武器ラック、端末、人物、出撃ゲート）。world.request を見て、画面側が処理する
  station(world, o) {
    world.request = o.id;
  },

  // 扉：次の部屋へ。world.exit を見て、画面側が部屋を切り替える
  door(world, o) {
    world.exit = o.target;
    sfx(world, 'door');
  },

  // 隠し扉：隠しボスの部屋へ
  secretDoor(world, o) {
    world.exit = o.target;
    sfx(world, 'door');
  },

  heal(world, o) {
    if (o.used) return;
    const p = world.player;
    const amount = Math.round(healPlayer(world, Math.round(p.stats.maxHp * ROOMGEN.supply.heal * (world.room.healScale ?? 1))));
    o.used = true;
    sfx(world, 'heal');
    say(world, `修復 +${amount}`, COLORS.green);
    ring(world, o.x, o.y, 60, COLORS.green);
  },

  shop(world, o) {
    const p = world.player;
    const g = o.goods;
    if (p.build.credits < g.price) {
      say(world, 'クレジット不足', COLORS.red);
      sfx(world, 'deny');
      return;
    }
    p.build.credits -= g.price;
    if (g.type === 'gear') equipItem(world, g.item);
    else if (g.type === 'kit') {
      p.build.kits++;
      say(world, '修復キット +1', COLORS.green);
    } else if (g.type === 'implant') addImplant(world, g.def);
    else if (g.type === 'item') {
      if (!addItem(p.build, g.id)) {
        // 持ち物がいっぱいなら買えない（クレジットを戻す）
        p.build.credits += g.price;
        say(world, '持ち物がいっぱい', COLORS.red);
        return;
      }
      say(world, `${DATA.consumables.get(g.id).name} を買った`, COLORS.ink);
    }
    world.objects = world.objects.filter((x) => x !== o);
    sfx(world, 'buy');
    world.events.push({ type: 'buy' });
  },

  // 落ちている消耗品：拾って持ち物に入れる
  pickup(world, o) {
    const p = world.player;
    if (!addItem(p.build, o.id)) {
      say(world, '持ち物がいっぱい', COLORS.red);
      return;
    }
    say(world, `${DATA.consumables.get(o.id).name} を拾った`, COLORS.ink);
    sfx(world, 'pickup');
    world.objects = world.objects.filter((x) => x !== o);
  },

  // データ片：拾った時点で持ち帰りが確定する（ラン側がセーブデータに記録する）
  fragment(world, o) {
    world.events.push({ type: 'fragment', id: o.id });
    sfx(world, 'fragment');
    ring(world, o.x, o.y, 50, COLORS.cyan);
    world.objects = world.objects.filter((x) => x !== o);
  },

  // 遭遇部屋の人物：話しかける。world.request を見て、画面側が会話を出す
  npc(world, o) {
    if (!o.used) world.request = `encounter:${o.encounter}`;
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

// F キー：足元の装備を、身につけずにバッグに入れる
export function stash(world) {
  return stashFocusLoot(world);
}

// Q キー：修復キットを使う
export function useKit(world) {
  const p = world.player;
  if (world.mode === 'dead' || world.choice || p.build.kits <= 0 || p.hp >= p.stats.maxHp) return false;
  p.build.kits--;
  sfx(world, 'heal');
  // 修復キットの回復量は、インプラントで増える
  const healed = Math.round(healPlayer(world, PLAYER.kit.heal * (1 + (p.stats.kitBonus ?? 0))));
  say(world, `修復キット +${healed}`, COLORS.green);
  ring(world, p.x, p.y, 40, COLORS.green);
  return true;
}
