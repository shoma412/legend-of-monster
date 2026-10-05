// 持ち帰り要素（ボス素材・恒久強化・データ片・実績・記録）の処理。セーブデータを書き換える。
import { META } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { weaponUnlocks } from '../data/upgrades.js';
import { unlockAchievements } from './achievements.js';

// ---- 恒久強化 ----

export function upgradeLevel(save, id) {
  return save.upgrades[id] ?? 0;
}

// 次の段階に必要な素材。最大まで上げていたら null
export function nextUpgradeCost(save, def) {
  const level = upgradeLevel(save, def.id);
  return level >= def.max ? null : def.costs[level];
}

export function canAfford(save, cost) {
  return Object.entries(cost).every(([id, n]) => (save.materials[id] ?? 0) >= n);
}

function pay(save, cost) {
  for (const [id, n] of Object.entries(cost)) save.materials[id] -= n;
}

export function buyUpgrade(save, id) {
  const def = DATA.upgrades.get(id);
  const cost = nextUpgradeCost(save, def);
  if (def.ready === false || !cost || !canAfford(save, cost)) return false;
  pay(save, cost);
  save.upgrades[id] = upgradeLevel(save, id) + 1;
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
  const bonus = { effects: [], kits: 0, startChoice: false, ougi: [], carrySlots: 1 };
  for (const def of DATA.upgrades.all()) {
    const level = upgradeLevel(save, def.id);
    for (let i = 0; i < level; i++) {
      if (def.perLevel.mods) bonus.effects.push({ mods: def.perLevel.mods });
      bonus.kits += def.perLevel.kits ?? 0;
      if (def.perLevel.startChoice) bonus.startChoice = true;
      if (def.perLevel.ougi) bonus.ougi.push(def.perLevel.ougi);
      bonus.carrySlots += def.perLevel.carrySlots ?? 0;
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

  if (event.type === 'fragment') gainFragment(save, run, event.id, notes);

  if (event.type === 'runClear') save.records.clears++;

  for (const def of unlockAchievements(save, run, event)) addAchievement(run, notes, def);
  return notes;
}

function addAchievement(run, notes, def) {
  run.gained.achievements.push(def.id);
  addNote(run, notes, { kind: 'achievement', text: `> 実績解除 // ${def.name}` });
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
