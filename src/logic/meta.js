// 持ち帰り要素（ボス素材・恒久強化・データ片・実績・記録）の処理。セーブデータを書き換える。
import { META } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { weaponUnlocks } from '../data/upgrades.js';
import { unlockAchievements } from './achievements.js';
import { buildTree, isReachable } from './skillTree.js';

// ---- 恒久強化 ----

export function upgradeLevel(save, id) {
  return save.upgrades[id] ?? 0;
}


export function canAfford(save, cost) {
  return Object.entries(cost).every(([id, n]) => (save.materials[id] ?? 0) >= n);
}

function pay(save, cost) {
  for (const [id, n] of Object.entries(cost)) save.materials[id] -= n;
}

// そのセーブデータのスキルツリー（配置は save.tree.seed で決まる）
export function saveTree(save) {
  return buildTree(save.tree.seed);
}

// スキルツリーのマスの状態：owned（取った）/ open（手前を取ってあり、素材も足りる）/ short（手前は取ってあるが、素材が足りない）/ locked（手前をまだ取っていない）
export function treeNodeState(save, id) {
  const tree = saveTree(save);
  if (save.tree.owned.includes(id)) return 'owned';
  if (!isReachable(tree, save.tree.owned, id)) return 'locked';
  return canAfford(save, tree.byId[id].cost) ? 'open' : 'short';
}

// スキルツリーのマスを取る。手前のマスを取ってあり、素材が足りるときだけ。取れたら true
export function buyNode(save, id) {
  if (treeNodeState(save, id) !== 'open') return false;
  const node = saveTree(save).byId[id];
  pay(save, node.cost);
  save.tree.owned.push(id);
  save.upgrades[node.upgrade] = upgradeLevel(save, node.upgrade) + 1;
  return true;
}

export function unlockWeapon(save, weaponId) {
  const def = weaponUnlocks.find((w) => w.weapon === weaponId);
  if (!def || def.ready === false || !def.cost || save.weapons.includes(weaponId) || !canAfford(save, def.cost)) return false;
  pay(save, def.cost);
  save.weapons.push(weaponId);
  return true;
}

// ラン開始時に乗る恒久強化。{ effects: ステータス補正の並び, kits: 修復キットの追加, startChoice: 最初にインプラントを選べるか }
export function permanentBonuses(save) {
  const bonus = { effects: [], kits: 0, startChoice: false, ougi: [], carrySlots: 1, itemSlots: 0, keepImplants: META.carryOver.implants, weaponMods: {}, implantSlots: 0, skips: 0 };
  for (const def of DATA.upgrades.all()) {
    const level = upgradeLevel(save, def.id);
    for (let i = 0; i < level; i++) {
      if (def.perLevel.mods) bonus.effects.push({ mods: def.perLevel.mods });
      bonus.kits += def.perLevel.kits ?? 0;
      if (def.perLevel.startChoice) bonus.startChoice = true;
      if (def.perLevel.ougi) bonus.ougi.push(def.perLevel.ougi);
      bonus.carrySlots += def.perLevel.carrySlots ?? 0;
      bonus.itemSlots += def.perLevel.itemSlots ?? 0;
      bonus.keepImplants += def.perLevel.keepImplants ?? 0;
      bonus.implantSlots += def.perLevel.implantSlots ?? 0;
      bonus.skips += def.perLevel.skips ?? 0;
      // 武器ごとの強化：{ 武器の id: { special, scale, stageTime } }
      if (def.perLevel.weaponMod) bonus.weaponMods[def.perLevel.weaponMod.weapon] = def.perLevel.weaponMod;
    }
  }
  return bonus;
}

// ---- ラン中の出来事 ----

function addNote(run, notes, note) {
  notes.push(note);
  run.gained.notes.push(note);
}

function gainFragment(save, run, id, notes) {
  if (!id || save.fragments.includes(id)) return;
  save.fragments.push(id);
  run.gained.fragments.push(id);
  addNote(run, notes, { kind: 'fragment', text: `> データ片回収 // ${DATA.fragments.get(id).title}` });
}

// まだ持っていないデータ片を1つ選ぶ（なければ null）
export function pickFragment(save, areaId, source, rng) {
  const pool = DATA.fragments.all().filter((f) => f.area === areaId && f.source === source && !save.fragments.includes(f.id));
  return pool.length > 0 ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].id : null;
}

// world から出てきた出来事を1つ処理する。save と run.gained を書き換え、画面に出す通知を返す
//   出来事：{ type: 'sortie' | 'kill' | 'eliteKill' | 'bossKill' | 'implant' | 'equip' | 'fragment' | 'runClear' | 'mapClear', ... }
export function processEvent(save, run, event) {
  const notes = [];

  if (event.type === 'kill') save.records.kills++;

  if (event.type === 'bossKill') {
    // ボス素材はボスを倒した時点で確定する。初回撃破だけ多くもらえる
    const boss = DATA.bosses.get(event.boss);
    const first = !save.bossKills[boss.id];
    // 周が進んでいると、もらえる数が増える
    const count = (first ? META.firstKillMaterials : 1) + (event.materialBonus ?? 0);
    save.bossKills[boss.id] = (save.bossKills[boss.id] ?? 0) + 1;
    save.materials[boss.material] = (save.materials[boss.material] ?? 0) + count;
    run.gained.materials[boss.material] = (run.gained.materials[boss.material] ?? 0) + count;
    addNote(run, notes, { kind: 'material', text: `> 素材回収 // ${DATA.materials.get(boss.material).name} ×${count}${first ? '（初回撃破）' : ''}` });
    // そのボスのデータ片
    const fragment = DATA.fragments.all().find((f) => f.source === 'boss' && f.area === event.area);
    if (fragment) {
      gainFragment(save, run, fragment.id, notes);
      if (run.gained.fragments.includes(fragment.id)) for (const def of unlockAchievements(save, run, { type: 'fragment' })) addAchievement(run, notes, def);
    }
  }

  // 隠しボスを倒した：そのマップの通行証が手に入る（素材とデータ片はない）
  if (event.type === 'secretKill') {
    save.bossKills[event.boss] = (save.bossKills[event.boss] ?? 0) + 1;
    // 隠しボスの素材：倒すたびに1個
    const material = DATA.bosses.get(event.boss).material;
    if (material) {
      save.materials[material] = (save.materials[material] ?? 0) + 1;
      run.gained.materials[material] = (run.gained.materials[material] ?? 0) + 1;
      addNote(run, notes, { kind: 'material', text: `> 素材回収 // ${DATA.materials.get(material).name} ×1` });
    }
    save.passes ??= [];
    if (!save.passes.includes(event.map)) {
      save.passes.push(event.map);
      addNote(run, notes, { kind: 'material', text: `> 通行証を入手 // ${DATA.maps.get(event.map).name}の通行証` });
    }
  }

  if (event.type === 'fragment') gainFragment(save, run, event.id, notes);

  if (event.type === 'runClear') save.records.clears++;

  for (const def of unlockAchievements(save, run, event)) addAchievement(run, notes, def);
  return notes;
}

function addAchievement(run, notes, def) {
  run.gained.achievements.push(def.id);
  addNote(run, notes, { kind: 'achievement', text: `> 実績解除 // ${def.name}` });
}

// ---- マップをクリアしたあとの持ち越し（docs/詳細仕様.md「25. マップをクリアしたあとの持ち越し」） ----

// マップをクリアしたとき：次の出撃に持ち越せるものを、セーブデータに書く。build はクリアした時点のもの
//   credits : 持ち越すクレジット（持っていた額の半分）
//   implants: 持ち越せるインプラントの候補（そのとき持っていたもの）
//   picked  : 出撃先を選ぶ画面で選んだもの（枠ごと。選んでいなければ null）
export function recordCarryOver(save, build) {
  save.carryOver = {
    credits: Math.floor((build.credits ?? 0) * META.carryOver.creditRate),
    implants: Object.keys(build.implants ?? {}),
    picked: [],
  };
  return save.carryOver;
}

// 今、持ち越しで選ばれているインプラント（枠ごと。候補にないものや、ほかの枠と同じものは null）
export function carryOverPicks(save) {
  const co = save.carryOver;
  const slots = permanentBonuses(save).keepImplants;
  const picked = [];
  for (let slot = 0; slot < slots; slot++) {
    const id = co?.picked?.[slot] ?? null;
    picked.push(id && co.implants.includes(id) && DATA.implants.has(id) && !picked.includes(id) ? id : null);
  }
  return picked;
}

// 出撃したとき：持ち越しを使う。build にクレジットとインプラントを足して、セーブデータの持ち越しを消す
export function applyCarryOver(save, build) {
  const co = save.carryOver;
  if (!co) return null;
  const implants = carryOverPicks(save).filter(Boolean);
  build.credits += co.credits ?? 0;
  for (const id of implants) build.implants[id] = META.carryOver.level;
  save.carryOver = null;
  return { credits: co.credits ?? 0, implants };
}

// 出撃したとき
export function startRunRecord(save) {
  save.records.runs++;
}

// 最高到達の更新（部屋に入るたびに呼ぶ）。マップ → エリア → 部屋の順に、奥まで進んだほうを残す
export function recordProgress(save, areaIndex, step, mapIndex = 0) {
  const r = save.records;
  const now = [mapIndex, areaIndex, step];
  const best = [r.bestMap ?? 0, r.bestArea, r.bestStep];
  const i = now.findIndex((v, k) => v !== best[k]); // 最初に違いが出るところ
  if (i >= 0 && now[i] > best[i]) {
    r.bestMap = mapIndex;
    r.bestArea = areaIndex;
    r.bestStep = step;
  }
}
