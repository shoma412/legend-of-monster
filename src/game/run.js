// 1回のラン（出撃から死亡またはクリアまで）の進行。部屋をまたいで持ち越すものをまとめる。
import { ROOM } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { advancePlan, createAreaPlan, currentNode, doorOptions } from '../logic/areaGen.js';
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
    plan: createAreaPlan(area, rng), // エリアの地図と、今いる場所
    build: createBuild(), // 装備・インプラント・レベル・クレジット・修復キット
    hp: null, // 前の部屋を出たときのHP（null は満タン）
    kills: 0,
    started: false,
  };
}

export function currentArea(run) {
  return DATA.areas.get(AREA_ORDER[run.areaIndex]);
}

// 今の部屋の world を作る
export function enterRoom(run) {
  const area = currentArea(run);
  const { plan, rng } = run;
  const room = buildRoom(currentNode(plan).type, { area, step: plan.step, build: run.build, rng }, doorOptions(plan));
  // ランの最初の部屋だけ、3・2・1 のカウントダウンから始まる
  if (!run.started) room.countdown = ROOM.startCountdown.count * ROOM.startCountdown.step;
  run.started = true;
  return createWorld({
    weaponId: run.weaponId,
    rng,
    room,
    carry: { hp: run.hp, build: run.build },
  });
}

// 扉を選んで次の部屋へ。world は出ていく部屋、nextId は進む先（地図の id）
export function leaveRoom(run, world, nextId) {
  run.hp = world.player.hp;
  run.kills += world.kills;
  advancePlan(run.plan, nextId);
}

// 確認用：途中を飛ばしてボス部屋へ
export function skipToBoss(run, world) {
  const plan = run.plan;
  run.hp = world.player.hp;
  plan.current = 'boss';
  plan.visited.push('boss');
  plan.step = plan.nodes.boss.col;
}
