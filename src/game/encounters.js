// 遭遇部屋の選択肢で起きること。遭遇の定義（src/data/encounters.js）の action で、下の部品を選ぶ。
import { LOOT, ROOMGEN } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { rollImplantChoices } from '../logic/level.js';
import { makeItem } from '../logic/loot.js';
import { addImplant } from './build.js';
import { floatText, ring, sfx } from './fx.js';

const cfg = () => ROOMGEN.encounter;

function say(world, text, color) {
  const p = world.player;
  floatText(world, p.x, p.y - 30, text, color, 14);
}

// 装備を足元に落とす（拾うかどうかは、比べてから決められる）
//   部位はランダム。いま着ている、その部位の装備のレア度を基準にする（2026-10-20）。
//     mode 'up'     ：確定で、1段階上（流れの商人）
//     mode 'upOrSame'：同じか、1段階上（倒れた回収屋）。1段階上になる確率は cfg().lootStepChance
//   上限はレジェンド（着ているものがレジェンドなら、レジェンドのまま。通常のミシックの抽選だけ、そのまま使う）。
//   その部位に何も着けていないときは、今までどおり（rarityBonus の底上げ）
function dropGear(world, rarityBonus, mode) {
  const p = world.player;
  const slot = LOOT.slots[Math.floor(world.rng() * LOOT.slots.length)].id;
  const options = { rarityBonus, tier: world.room.lootTier, mythic: world.room.mythicChance ?? 0, mythicLuck: !!world.room.mythicLuck, slot };
  const current = p.build.gear[slot];
  if (current) {
    const top = LOOT.rarities.findIndex((r) => r.id === 'legend');
    if (current.rarity >= top) options.rarity = current.rarity; // レジェンド・ミシックを着ているときは、そのまま（ミシックは、通常の抽選で出る）
    else if (mode === 'up') options.rarity = current.rarity + 1;
    else options.rarity = current.rarity + (world.rng() < cfg().lootStepChance ? 1 : 0);
    // レジェンドになるときだけ、通常のミシックの抽選（確率は、そのマップ・エリアのもの）を使う
    if (options.rarity === top && world.rng() < (world.room.mythicChance ?? 0)) options.rarity = LOOT.rarities.findIndex((r) => r.mythic);
  }
  world.loot.push({ x: p.x + 46, y: p.y, item: makeItem(world.rng, options), t: 0 });
  sfx(world, 'equip');
}

function hpCost(world) {
  return Math.round(world.player.stats.maxHp * cfg().hpCost);
}

// can : 選べないときは、その理由（選択肢の横に出す）。選べるなら null
// run : 選んだときに起きること
const ACTIONS = {
  none: { can: () => null, run: () => {} },

  // 流れの商人：HPを払って装備を1つもらう
  payHpForGear: {
    can: (world) => (world.player.hp > hpCost(world) ? null : 'HPが足りない'),
    run(world) {
      const cost = hpCost(world);
      world.player.hp -= cost;
      say(world, `HP -${cost}`, COLORS.red);
      dropGear(world, cfg().gearRarityBonus, 'up');
    },
  },

  // 壊れかけの保守機：修復キットを1つ使って直すと、インプラントを1つもらえる
  repairForImplant: {
    can: (world) => (world.player.build.kits > 0 ? null : '修復キットがない'),
    run(world) {
      const build = world.player.build;
      build.kits--;
      const [implant] = rollImplantChoices(build, world.rng, 1);
      if (implant) addImplant(world, implant);
    },
  },

  // 壊れかけの保守機：部品を抜いて売る
  salvageCredits: {
    can: () => null,
    run(world) {
      const amount = Math.round(cfg().salvageCredits * world.player.stats.creditMul);
      world.player.build.credits += amount;
      say(world, `+${amount} c`, COLORS.amber);
      sfx(world, 'buy');
    },
  },

  // 倒れた回収屋：装備を拾う。代わりに、次の戦闘部屋の敵が増える
  lootBody: {
    can: () => null,
    run(world) {
      dropGear(world, cfg().lootRarityBonus, 'upOrSame');
      world.player.build.ambush = true;
    },
  },

  // 倒れた回収屋：そのままにして休む
  rest: {
    can: () => null,
    run(world) {
      const p = world.player;
      const amount = Math.round(p.stats.maxHp * cfg().restHeal);
      p.hp = Math.min(p.stats.maxHp, p.hp + amount);
      say(world, `修復 +${amount}`, COLORS.green);
      ring(world, p.x, p.y, 44, COLORS.green);
      sfx(world, 'heal');
    },
  },
};

export function hasEncounterAction(name) {
  return name in ACTIONS;
}

// その選択肢を選べない理由（選べるなら null）
export function choiceBlocked(world, choice) {
  return ACTIONS[choice.action].can(world);
}

// 選択肢を選ぶ。選べたら true。npc は部屋にいる人物（1回選ぶと、もう話せなくなる）
export function chooseEncounter(world, npc, choice) {
  if (npc.used || choiceBlocked(world, choice)) return false;
  ACTIONS[choice.action].run(world);
  npc.used = true;
  world.events.push({ type: 'encounter', id: npc.encounter, action: choice.action });
  return true;
}
