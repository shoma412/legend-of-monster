// ラン中のビルド（装備・インプラント・レベル）の操作
import { LOOT } from '../data/balance.js';
import { COLORS, RARITY_COLORS } from '../data/theme.js';
import { rollImplantChoices } from '../logic/level.js';
import { computeStats } from '../logic/stats.js';
import { floatText, ring } from './fx.js';

// ビルドが変わったらステータスを計算し直す。最大HPが増えたぶんは現在HPにも足す
export function recalcStats(player) {
  const before = player.stats?.maxHp ?? null;
  player.stats = computeStats(player.build);
  if (before != null && player.stats.maxHp > before) player.hp += player.stats.maxHp - before;
  player.hp = Math.min(player.hp, player.stats.maxHp);
}

function announceEquip(world, item) {
  const p = world.player;
  const color = RARITY_COLORS[LOOT.rarities[item.rarity].id];
  floatText(world, p.x, p.y - 30, `装備：${item.name}`, color, 14);
  ring(world, p.x, p.y, 40, color);
}

// 装備を身につける（闇市やデータ金庫で手に入れたとき）。外した装備は足元に落ちる
export function equipItem(world, item) {
  const p = world.player;
  const old = p.build.gear[item.slot];
  p.build.gear[item.slot] = item;
  if (old) world.loot.push({ x: p.x, y: p.y, item: old, t: 0 });
  recalcStats(p);
  announceEquip(world, item);
}

// 足元の装備と付け替える。外した装備はその場に落ちるので、付け直せる
export function equipFocusLoot(world) {
  const l = world.focusLoot;
  if (!l || world.mode === 'dead' || world.choice) return false;
  const p = world.player;
  const item = l.item;
  const old = p.build.gear[item.slot];
  p.build.gear[item.slot] = item;
  if (old) {
    l.item = old;
    l.t = 0;
  } else {
    world.loot = world.loot.filter((x) => x !== l);
  }
  recalcStats(p);
  announceEquip(world, item);
  return true;
}

// レベルアップの選択肢を出す。選ぶまで戦闘は止まる
export function openImplantChoice(world) {
  const options = rollImplantChoices(world.player.build, world.rng);
  if (options.length === 0) return;
  world.choice = { type: 'implant', options };
}

export function chooseImplant(world, index) {
  const choice = world.choice;
  const def = choice?.options[index];
  if (!def) return false;
  addImplant(world, def);
  world.choice = null;
  return true;
}

// インプラントを1つ入れる（レベルアップの3択、闇市）
export function addImplant(world, def) {
  const p = world.player;
  p.build.implants[def.id] = (p.build.implants[def.id] ?? 0) + 1;
  recalcStats(p);
  if (def.onAcquire === 'fullHeal') p.hp = p.stats.maxHp;
  floatText(world, p.x, p.y - 30, `導入：${def.name}`, COLORS.magenta, 14);
  ring(world, p.x, p.y, 50, COLORS.magenta);
}
