// ラン中のビルド（装備・バッグ・インプラント・レベル）の操作
import { BAG, LOOT } from '../data/balance.js';
import { COLORS, RARITY_COLORS } from '../data/theme.js';
import { rollImplantChoices } from '../logic/level.js';
import { computeStats } from '../logic/stats.js';
import { floatText, ring, sfx } from './fx.js';

// ビルドが変わったらステータスを計算し直す。最大HPが増えたぶんは現在HPにも足す
export function recalcStats(player) {
  const before = player.stats?.maxHp ?? null;
  player.stats = computeStats(player.build);
  if (before != null && player.stats.maxHp > before) player.hp += player.stats.maxHp - before;
  player.hp = Math.min(player.hp, player.stats.maxHp);
}

function say(world, text, color) {
  const p = world.player;
  floatText(world, p.x, p.y - 30, text, color, 14);
}

function announceEquip(world, item) {
  const p = world.player;
  world.events.push({ type: 'equip', rarity: item.rarity });
  sfx(world, 'equip');
  const color = RARITY_COLORS[LOOT.rarities[item.rarity].id];
  floatText(world, p.x, p.y - 30, `装備：${item.name}`, color, 14);
  ring(world, p.x, p.y, 40, color);
}

export function bagHasRoom(build) {
  return build.bag.length < BAG.size;
}

// 外した装備の行き先：バッグに空きがあればバッグへ、なければ足元に落ちる
function putAway(world, item) {
  const p = world.player;
  if (bagHasRoom(p.build)) p.build.bag.push(item);
  else world.loot.push({ x: p.x, y: p.y, item, t: 0 });
}

// 装備を身につける（闇市やデータ金庫で手に入れたとき）。外した装備はバッグへ（いっぱいなら足元へ）
export function equipItem(world, item) {
  const p = world.player;
  const old = p.build.gear[item.slot];
  p.build.gear[item.slot] = item;
  if (old) putAway(world, old);
  recalcStats(p);
  announceEquip(world, item);
}

// E キー：足元の装備を身につける。外した装備はバッグへ（いっぱいなら、その場に落ちる）
export function equipFocusLoot(world) {
  const l = world.focusLoot;
  if (!l || world.mode === 'dead' || world.choice) return false;
  const p = world.player;
  const item = l.item;
  const old = p.build.gear[item.slot];
  p.build.gear[item.slot] = item;
  if (old && bagHasRoom(p.build)) {
    p.build.bag.push(old);
    world.loot = world.loot.filter((x) => x !== l);
  } else if (old) {
    l.item = old;
    l.t = 0;
  } else {
    world.loot = world.loot.filter((x) => x !== l);
  }
  recalcStats(p);
  announceEquip(world, item);
  return true;
}

// F キー：足元の装備を、身につけずにバッグへ入れる
export function stashFocusLoot(world) {
  const l = world.focusLoot;
  if (!l || world.mode === 'dead' || world.choice) return false;
  const p = world.player;
  if (!bagHasRoom(p.build)) {
    say(world, 'バッグがいっぱい', COLORS.red);
    sfx(world, 'deny');
    return false;
  }
  p.build.bag.push(l.item);
  world.loot = world.loot.filter((x) => x !== l);
  say(world, `バッグへ：${l.item.name}`, RARITY_COLORS[LOOT.rarities[l.item.rarity].id]);
  sfx(world, 'pickup');
  return true;
}

// ポーズ画面：バッグの装備を身につける。今の装備は、バッグの同じ場所に入れ替わる
export function equipFromBag(world, index) {
  const p = world.player;
  const item = p.build.bag[index];
  if (!item) return false;
  const old = p.build.gear[item.slot];
  p.build.gear[item.slot] = item;
  if (old) p.build.bag[index] = old;
  else p.build.bag.splice(index, 1);
  recalcStats(p);
  world.events.push({ type: 'equip', rarity: item.rarity });
  return true;
}

// ポーズ画面：装備を外してバッグへ。バッグがいっぱいなら外せない
export function unequipToBag(world, slot) {
  const p = world.player;
  const item = p.build.gear[slot];
  if (!item || !bagHasRoom(p.build)) return false;
  p.build.gear[slot] = null;
  p.build.bag.push(item);
  recalcStats(p);
  return true;
}

// ポーズ画面：バッグの装備を捨てる。足元に落ちるので、その部屋にいる間は拾い直せる
export function discardFromBag(world, index) {
  const p = world.player;
  const [item] = p.build.bag.splice(index, 1);
  if (!item) return false;
  world.loot.push({ x: p.x, y: p.y, item, t: 0 });
  return true;
}

// レベルアップの選択肢を出す。選ぶまで戦闘は止まる
export function openImplantChoice(world) {
  const options = rollImplantChoices(world.player.build, world.rng);
  if (options.length === 0) return;
  world.choice = { type: 'implant', options };
  sfx(world, 'levelup');
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
  world.events.push({ type: 'implant', id: def.id });
  sfx(world, 'implant');
  floatText(world, p.x, p.y - 30, `導入：${def.name}`, COLORS.magenta, 14);
  ring(world, p.x, p.y, 50, COLORS.magenta);
}
