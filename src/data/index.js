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

export const DATA = {
  enemies: defineRegistry('敵', enemies),
  bosses: defineRegistry('ボス', bosses),
  weapons: defineRegistry('武器', weapons),
  gearEffects: defineRegistry('装備効果', gearEffects),
  legendEffects: defineRegistry('レジェンド固有効果', legendEffects),
  implants: defineRegistry('インプラント', implants),
  rooms: defineRegistry('部屋の種類', rooms),
  upgrades: defineRegistry('恒久強化', upgrades),
};
