// 定義データの一覧。中身は各マイルストーンで足していく（M0 では枠だけ）。
import { defineRegistry } from './registry.js';
import { enemies } from './enemies.js';
import { bosses } from './bosses.js';
import { weapons } from './weapons.js';
import { gearEffects } from './gearEffects.js';
import { legendEffects } from './legendEffects.js';
import { implants } from './implants.js';
import { rooms } from './rooms.js';
import { upgrades } from './upgrades.js';
import { areas } from './areas.js';
import { eliteTraits } from './eliteTraits.js';
import { achievements } from './achievements.js';
import { consumables } from './consumables.js';
import { fragments, materials } from './story.js';

export const DATA = {
  enemies: defineRegistry('敵', enemies),
  bosses: defineRegistry('ボス', bosses),
  weapons: defineRegistry('武器', weapons),
  gearEffects: defineRegistry('装備効果', gearEffects),
  legendEffects: defineRegistry('レジェンド固有効果', legendEffects),
  implants: defineRegistry('インプラント', implants),
  rooms: defineRegistry('部屋の種類', rooms),
  upgrades: defineRegistry('恒久強化', upgrades),
  areas: defineRegistry('エリア', areas),
  eliteTraits: defineRegistry('エリートの特性', eliteTraits),
  materials: defineRegistry('ボス素材', materials),
  fragments: defineRegistry('データ片', fragments),
  achievements: defineRegistry('実績', achievements),
  consumables: defineRegistry('消耗品', consumables),
};
