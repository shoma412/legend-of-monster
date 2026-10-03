// 1回のラン（出撃から死亡またはクリアまで）の進行。部屋をまたいで持ち越すものをまとめる。
import { DATA } from '../data/index.js';
import { advancePlan, createAreaPlan, doorOptions } from '../logic/areaGen.js';
import { createBuild } from '../logic/stats.js';
import { buildRoom } from './rooms.js';
import { createWorld } from './world.js';

// エリアの順番。エリア2・3は M7・M8 で足す
export const AREA_ORDER = ['slum'];

export function createRun({ weaponId = 'greatsword', rng = Math.random } = {}) {
  const area = DATA.areas.get(AREA_ORDER[0]);
  return {
    weaponId,
    rng,
    areaIndex: 0,
    plan: createAreaPlan(area, rng),
    build: createBuild(), // 装備・インプラント・レベル・クレジット・修復キット
    hp: null, // 前の部屋を出たときのHP（null は満タン）
    kills: 0,
  };
}

export function currentArea(run) {
  return DATA.areas.get(AREA_ORDER[run.areaIndex]);
}

// 今の部屋の world を作る
export function enterRoom(run) {
  const area = currentArea(run);
  const { plan, rng } = run;
  const room = buildRoom(plan.current, { area, step: plan.step, build: run.build, rng }, doorOptions(plan, rng));
  return createWorld({
    weaponId: run.weaponId,
    rng,
    room,
    carry: { hp: run.hp, build: run.build },
  });
}

// 扉を選んで次の部屋へ。world は出ていく部屋
export function leaveRoom(run, world, nextType) {
  run.hp = world.player.hp;
  run.kills += world.kills;
  advancePlan(run.plan, nextType);
}
