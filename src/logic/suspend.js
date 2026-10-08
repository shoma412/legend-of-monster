// 中断セーブ：ランの途中（部屋をクリアして、次の扉を選べる状態）を保存して、あとで同じ部屋から再開する。
// セーブ枠ごとに1つ。再開した時点で消す（やり直しでの厳選はできない）。
// 保存先（storage）は外から渡すので、テストでは偽物を使える。
import { DATA } from '../data/index.js';
import { cycleMods } from './maps.js';

// 中断データの形を変えたら上げる。番号が合わない中断データは捨てて、隠れ家から始める
export const SUSPEND_VERSION = 1;

export function suspendKey(slot) {
  return `legend-of-monster/suspend-${slot}`;
}

// マップの最後のボスを倒したあとか（倒すとランが終わるので、中断はできない）
function atFinalBoss(run) {
  return run.plan.current === 'boss' && run.areaIndex + 1 >= run.map.areas.length;
}

// 今、中断できるか。部屋をクリアして、次の扉を選べる状態のときだけ
export function canSuspend(run, world) {
  return world.mode === 'clear' && !run.inSecret && !run.outcome && !world.choice && !(world.pendingLevelUps > 0) && !atFinalBoss(run);
}

// 中断データを作る（そのまま JSON にできる形）
export function snapshotRun(run, world) {
  return JSON.parse(JSON.stringify({
    version: SUSPEND_VERSION,
    weaponId: run.weaponId,
    mapId: run.map.id,
    cycle: run.cycle,
    areaIndex: run.areaIndex,
    plan: run.plan,
    build: world.player.build,
    hp: world.player.hp,
    kills: run.kills + world.kills,
    visualSeed: run.visualSeed,
    gained: run.gained,
    // 灯りを点けて回るマップ：中断した部屋に、点けていない非常灯が残っていたら、このエリアでは道が開かない
    secret: run.secret ? { ...run.secret, ...(run.secret.rule === 'lamps' ? { lampsOk: run.secret.lampsOk && (world.lamps ?? []).every((l) => l.lit) } : {}) } : null,
  }));
}

// 中断データの中身が、今のゲームのデータで再開できるものか
function isValid(data) {
  if (!data || data.version !== SUSPEND_VERSION) return false;
  if (!DATA.maps.has(data.mapId) || !DATA.weapons.has(data.weaponId)) return false;
  const map = DATA.maps.get(data.mapId);
  const areaId = map.areas[data.areaIndex];
  const { plan, build } = data;
  if (!areaId || !plan || plan.areaId !== areaId || !plan.nodes?.[plan.current]) return false;
  if (!build || !Array.isArray(build.items) || !Array.isArray(build.bag) || !build.gear || !build.implants) return false;
  if (!Object.keys(build.implants).every((id) => DATA.implants.has(id))) return false;
  const gear = [...Object.values(build.gear), ...build.bag].filter(Boolean);
  for (const item of gear) {
    if (!item.effects.every((line) => DATA.gearEffects.has(line.id))) return false;
    if (item.unique && !DATA.legendEffects.has(item.unique)) return false;
  }
  if (!build.items.every((slot) => !slot || DATA.consumables.has(slot.id))) return false;
  return typeof data.hp === 'number' && data.hp > 0;
}

// 中断データからランを作り直す。再開できないデータなら null
//   save: 今のセーブデータ / rng: 乱数（中断の前後で、この先の部屋の中身は変わる）
export function restoreRun(data, save, rng = Math.random) {
  if (!isValid(data)) return null;
  return {
    weaponId: data.weaponId,
    rng,
    save,
    map: DATA.maps.get(data.mapId),
    cycle: data.cycle,
    mods: cycleMods(data.cycle),
    ending: false,
    areaIndex: data.areaIndex,
    plan: data.plan,
    build: data.build,
    hp: data.hp,
    kills: data.kills ?? 0,
    started: true,
    visualSeed: data.visualSeed ?? 0,
    startChoice: false,
    outcome: null,
    gained: data.gained ?? { materials: {}, fragments: [], achievements: [], notes: [] },
    secret: data.secret ?? null,
    inSecret: false,
    resumed: true, // 最初に入る部屋は、クリア済みで扉が開いた状態にする（src/game/run.js の enterRoom）
  };
}

// セーブ枠の選択画面に出す、中断した場所（例：MAP 01 中枢区 // 下層スラム 3/9）。読めないデータなら null
export function suspendSummary(data) {
  if (!isValid(data)) return null;
  const map = DATA.maps.get(data.mapId);
  const area = DATA.areas.get(map.areas[data.areaIndex]);
  const lap = data.cycle > 1 ? `${data.cycle}周目 ` : '';
  return `${lap}${map.code} ${map.name} // ${area.name} ${data.plan.step + 1}/${data.plan.columns}`;
}

export function storeSuspend(storage, slot, data) {
  try {
    storage?.setItem(suspendKey(slot), JSON.stringify(data));
    return !!storage;
  } catch {
    return false;
  }
}

// その枠の中断データ。なければ（または読めなければ）null
export function loadSuspend(storage, slot) {
  try {
    const raw = storage?.getItem(suspendKey(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function deleteSuspend(storage, slot) {
  try {
    storage?.removeItem(suspendKey(slot));
  } catch {
    // 消せなくても止まらない
  }
}
