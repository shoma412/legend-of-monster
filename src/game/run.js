// 1回のラン（出撃から死亡またはクリアまで）の進行。部屋をまたいで持ち越すものをまとめる。
import { ENEMY_SCALING, ROOM, ROOMGEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { advancePlan, createAreaPlan, currentNode, doorOptions } from '../logic/areaGen.js';
import { permanentBonuses, pickFragment, processEvent, recordProgress, startRunRecord } from '../logic/meta.js';
import { createSave } from '../logic/save.js';
import { createBuild } from '../logic/stats.js';
import { buildRoom } from './rooms.js';
import { createWorld } from './world.js';

// エリアの順番
export const AREA_ORDER = ['slum', 'plant', 'tower'];

// ボスを倒したあとに開く「次のエリアへ」の扉の行き先
export const NEXT_AREA = '@next';

// save: セーブデータ（隠れ家の進行状況）。恒久強化がランに乗り、ボス素材・データ片・実績がここに記録される
export function createRun({ weaponId = 'greatsword', rng = Math.random, save = createSave() } = {}) {
  const area = DATA.areas.get(AREA_ORDER[0]);
  const bonus = permanentBonuses(save);
  const run = {
    weaponId,
    rng,
    save,
    areaIndex: 0,
    plan: createAreaPlan(area, rng), // エリアの地図と、今いる場所
    build: createBuild(bonus), // 装備・インプラント・レベル・クレジット・修復キット
    hp: null, // 前の部屋を出たときのHP（null は満タン）
    kills: 0,
    started: false,
    startChoice: bonus.startChoice, // 恒久強化「起動プログラム」：最初にインプラントを1つ選べる
    firstClear: false,
    outcome: null, // 終わり方：dead（死亡）/ areaClear（今あるエリアを最後まで進んだ）/ clear（最後のボスを倒した）
    // このランで持ち帰ったもの（リザルト画面に出す）
    gained: { materials: {}, fragments: [], achievements: [], notes: [] },
  };
  startRunRecord(save);
  processEvent(save, run, { type: 'sortie' });
  return run;
}

export function currentArea(run) {
  return DATA.areas.get(AREA_ORDER[run.areaIndex]);
}

export function hasNextArea(run) {
  return run.areaIndex + 1 < AREA_ORDER.length;
}

// 今の部屋の world を作る
export function enterRoom(run) {
  const area = currentArea(run);
  const { plan, rng, save } = run;
  // 奥のエリアほど、敵の数が増える（部屋数ぶん先に進んだものとして数える）
  const depth = plan.step + run.areaIndex * ROOMGEN.depthPerArea;
  const ctx = { area, step: depth, build: run.build, rng, fragment: pickFragment(save, area.id, 'vault', rng) };
  let doors = doorOptions(plan);
  // ボス部屋：倒したあと、次のエリアがあればそこへの扉が開く
  if (plan.current === 'boss' && hasNextArea(run)) doors = [{ id: NEXT_AREA, type: 'descend' }];
  const room = buildRoom(currentNode(plan).type, ctx, doors);
  // 奥のエリアほど、雑魚のHPと攻撃力が上がる
  room.enemyScale = ENEMY_SCALING.perArea ** run.areaIndex;
  const first = !run.started;
  // ランの最初の部屋だけ、3・2・1 のカウントダウンから始まる
  if (first) room.countdown = ROOM.startCountdown.count * ROOM.startCountdown.step;
  run.started = true;
  recordProgress(save, run.areaIndex, plan.step);
  const world = createWorld({
    weaponId: run.weaponId,
    rng,
    room,
    carry: { hp: run.hp, build: run.build },
  });
  if (first && run.startChoice) world.pendingLevelUps = 1;
  return world;
}

// 扉を選んで次の部屋へ。world は出ていく部屋、nextId は進む先（地図の id）
export function leaveRoom(run, world, nextId) {
  run.hp = world.player.hp;
  run.kills += world.kills;
  if (nextId === NEXT_AREA) {
    // 次のエリアへ。新しい地図を作る
    run.areaIndex++;
    run.plan = createAreaPlan(currentArea(run), run.rng);
    run.build.ougiUsed = false; // 奥義はエリアごとに1回
    return;
  }
  advancePlan(run.plan, nextId);
}

// world で起きた出来事を処理する（ボス素材、データ片、実績、記録）。画面に出す通知を返す
export function handleEvents(run, world) {
  const area = currentArea(run);
  const notes = [];
  for (const event of world.events.splice(0)) {
    if (event.type === 'bossKill') event.area = area.id;
    notes.push(...processEvent(run.save, run, event));
    // 最後のエリアのボスを倒したらクリア
    if (event.type === 'bossKill' && area.final) {
      run.firstClear = run.save.records.clears === 0; // 初めてのクリアなら、エンディングを出す
      notes.push(...processEvent(run.save, run, { type: 'runClear' }));
    }
  }
  return notes;
}

// ランの終わりを決める（最初に決まったものが残る）。world は最後にいた部屋
export function finishRun(run, world, outcome) {
  if (run.outcome) return;
  run.outcome = outcome;
  run.kills += world.kills;
  run.hp = world.player.hp;
}

// 確認用：途中を飛ばしてボス部屋へ
export function skipToBoss(run, world) {
  const plan = run.plan;
  run.hp = world.player.hp;
  plan.current = 'boss';
  plan.visited.push('boss');
  plan.step = plan.nodes.boss.col;
}
