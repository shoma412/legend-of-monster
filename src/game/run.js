// 1回のラン（出撃から死亡またはクリアまで）の進行。部屋をまたいで持ち越すものをまとめる。
import { ENEMY_SCALING, ROOM, ROOMGEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { advancePlan, createAreaPlan, currentNode, doorOptions } from '../logic/areaGen.js';
import { cycleMods, recordMapClear } from '../logic/maps.js';
import { permanentBonuses, pickFragment, processEvent, recordProgress, startRunRecord } from '../logic/meta.js';
import { createSave } from '../logic/save.js';
import { createBuild, runSpecies } from '../logic/stats.js';
import { buildRoom } from './rooms.js';
import { createWorld } from './world.js';

// マップ1のエリアの順番（記録の「最高到達」の表示に使う。ランが進むエリアは、選んだマップの areas）
export const AREA_ORDER = DATA.maps.get('map1').areas;

// ボスを倒したあとに開く「次のエリアへ」の扉の行き先
export const NEXT_AREA = '@next';

// save: セーブデータ（隠れ家の進行状況）。恒久強化がランに乗り、ボス素材・データ片・実績がここに記録される
//   mapId: 進むマップ / cycle: 何周目か（周が進むほど敵が強い）/ carry: 持ち込みの種族の id（なければ null）
export function createRun({ weaponId = 'greatsword', rng = Math.random, save = createSave(), mapId = 'map1', cycle = 1, carry = null } = {}) {
  const map = DATA.maps.get(mapId);
  const area = DATA.areas.get(map.areas[0]);
  const bonus = permanentBonuses(save);
  const run = {
    weaponId,
    rng,
    save,
    map,
    cycle,
    mods: cycleMods(cycle), // この周での、敵の強さなどの変化
    ending: false, // このランで、7つすべてのマップを初めて完了した（エンディングを出す）
    areaIndex: 0,
    plan: createAreaPlan(area, rng), // エリアの地図と、今いる場所
    build: createBuild(bonus), // 装備・インプラント・レベル・クレジット・修復キット
    hp: null, // 前の部屋を出たときのHP（null は満タン）
    kills: 0,
    started: false,
    visualSeed: Math.floor(Math.random() * 1e9), // 背景の模様を決める数（見た目だけに使う）
    startChoice: bonus.startChoice, // 恒久強化「起動プログラム」：最初にインプラントを1つ選べる
    outcome: null, // 終わり方：dead（死亡）/ clear（マップの最後のボスを倒した）
    // このランで持ち帰ったもの（リザルト画面に出す）
    gained: { materials: {}, fragments: [], achievements: [], notes: [] },
  };
  // このランで選択肢に出る種族：そのマップのボスの種族と、持ち込みの種族
  run.build.species = runSpecies(map, carry);
  run.build.weaponId = weaponId; // 武器ごとのステータス補正が乗る
  startRunRecord(save);
  processEvent(save, run, { type: 'sortie' });
  return run;
}

export function currentArea(run) {
  return DATA.areas.get(run.map.areas[run.areaIndex]);
}

export function hasNextArea(run) {
  return run.areaIndex + 1 < run.map.areas.length;
}

// 今の部屋の world を作る
export function enterRoom(run) {
  const area = currentArea(run);
  const { plan, rng, save } = run;
  // 奥のエリアほど、敵の数が増える（部屋数ぶん先に進んだものとして数える）
  // 周が進むと、さらに敵が増え、エリートの特性も増える
  const depth = plan.step + run.areaIndex * ROOMGEN.depthPerArea + run.mods.stepBonus;
  const ctx = { area, step: depth, build: run.build, rng, fragment: pickFragment(save, area.id, 'vault', rng), eliteTraits: run.mods.eliteTraits, tier: run.areaIndex };
  // 中断から再開した最初の部屋は、クリア済みで扉が開いた状態にする（中身は空）
  const resumed = !!run.resumed;
  run.resumed = false;
  const type = resumed ? 'resume' : currentNode(plan).type;
  // 遭遇部屋で装備を拾ったあと：次の戦闘部屋は、敵が増える
  if (run.build.ambush && (type === 'combat' || type === 'elite')) {
    ctx.step += ROOMGEN.encounter.ambushSteps;
    run.build.ambush = false;
  }
  let doors = doorOptions(plan);
  // ボス部屋：倒したあと、次のエリアがあればそこへの扉が開く
  if (plan.current === 'boss' && hasNextArea(run)) doors = [{ id: NEXT_AREA, type: 'descend' }];
  const room = buildRoom(type, ctx, doors);
  // 奥のエリアほど、雑魚のHPと攻撃力が上がる
  room.enemyScale = ENEMY_SCALING.perArea ** run.areaIndex * (run.map.enemyScale ?? 1);
  // 周回による変化（敵の HP、受けるダメージ、装備のレア度、ボスの行動、補給の回復量）
  room.hpScale = run.mods.hpScale;
  room.damageScale = run.mods.damageScale;
  room.rarityChance = run.mods.rarityChance;
  room.bossHard = run.mods.bossHard;
  room.healScale = run.mods.healScale;
  // 装備のレア度は、奥のエリアほど良くなる。マップの最後のボスは、装備と消耗品を落とさない（倒すと隠れ家に戻るため）
  room.lootTier = run.areaIndex;
  room.noBossLoot = plan.current === 'boss' && !hasNextArea(run);
  const first = !run.started;
  // ランの最初の部屋だけ、3・2・1 のカウントダウンから始まる
  if (first) room.countdown = ROOM.startCountdown.count * ROOM.startCountdown.step;
  run.started = true;
  recordProgress(save, run.areaIndex, plan.step, DATA.maps.all().indexOf(run.map));
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

function note(run, text) {
  const n = { kind: 'achievement', text };
  run.gained.notes.push(n);
  return n;
}

// world で起きた出来事を処理する（ボス素材、データ片、実績、記録）。画面に出す通知を返す
export function handleEvents(run, world) {
  const area = currentArea(run);
  const notes = [];
  for (const event of world.events.splice(0)) {
    if (event.type === 'bossKill') {
      event.area = area.id;
      event.materialBonus = run.mods.materialBonus;
    }
    notes.push(...processEvent(run.save, run, event));
    // マップの最後のエリアのボスを倒したら、そのマップは完了
    if (event.type === 'bossKill' && !hasNextArea(run)) {
      notes.push(...processEvent(run.save, run, { type: 'runClear' }));
      const result = recordMapClear(run.save, run.map.id, run.cycle);
      run.ending = result.ending; // 7つすべてを初めて完了したら、エンディングを出す
      notes.push(...processEvent(run.save, run, { type: 'mapClear', map: run.map.id, cycle: run.cycle }));
      if (result.firstClear) notes.push(note(run, `> マップ完了 // ${run.map.code} ${run.map.name}`));
      if (result.nextCycle) notes.push(note(run, `> ${result.nextCycle}周目が選べるようになった`));
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
