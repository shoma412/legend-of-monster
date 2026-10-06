// 1部屋ぶんの戦闘の状態と進行。Phaser に依存しないので、そのままテストできる。
import { FEEL, ROOM, SCREEN, SECRET } from '../data/balance.js';
import { COLORS } from '../data/theme.js';
import { DATA } from '../data/index.js';
import { roomBounds } from '../logic/geometry.js';
import { createBoss } from './boss.js';
import { openImplantChoice } from './build.js';
import { makeElite } from './elite.js';
import { updateFocus } from './objects.js';
import { SECRET_IN, doorObjects } from './rooms.js';
import { updateZones } from './effects.js';
import { updateHazards } from './bossPatterns.js';
import { updatePlayerDot } from './combat.js';
import { updateDarkness } from './darkness.js';
import { createEnemy, updateEnemies, updateShots } from './enemyAI.js';
import { addShake, burst, createFx, floatText, sfx, updateFx } from './fx.js';
import { updateDevices } from './devices.js';
import { updateGimmick } from './gimmicks.js';
import { canUseOugi, createPlayer, updatePlayer, updatePlayerShots } from './player.js';

// room: 部屋の中身（src/game/rooms.js の buildRoom が作る）{ type, waves, objects, doors, clearCredits }
//   waves: [{ 敵のid: 数, ... }, ...]。{ boss: ボスのid } はボスを、{ elite: { base, trait } } はエリートを出す
// waves だけを直接渡してもよい（テスト用）
// carry: 前の部屋から引き継ぐもの { hp, build }（省略するとまっさらな状態）
export function createWorld({ weaponId = 'greatsword', waves = [], rng = Math.random, carry = null, room = null } = {}) {
  room ??= { type: 'combat', waves, objects: [], doors: [], clearCredits: 0 };
  const bounds = roomBounds(SCREEN, ROOM.wall, ROOM.wallTop);
  const player = createPlayer(weaponId, bounds.left + 90, SCREEN.height / 2, carry);
  return {
    mode: 'play', // play / dead / clear（clear のあとも歩き回って装備を拾える）
    time: 0,
    rng,
    bounds,
    player,
    enemies: [],
    boss: null, // ボス部屋のボス（HPバー表示用。倒した後も残す）
    shots: [], // 敵の弾
    playerShots: [], // プレイヤーの弾（銃）
    hazards: [],
    arena: null, // ボスが部屋を狭めているとき { inset, target, speed, base }
    zones: [], // ダメージ床など、プレイヤー側のその場に残る効果
    devices: [], // 設置物（地雷・小型タレット）。部屋を出ると消える
    lamps: (room.lamps ?? []).map((l) => ({ x: l.x, y: l.y, on: 0, broken: 0 })), // 非常灯（環境「暗闇」）。on は点いている残り秒数、broken は壊されていて点かない残り秒数
    lights: [], // 一時的な光（攻撃が当たった瞬間など。環境「暗闇」）
    loot: [], // 落ちている装備 { x, y, item }
    focusLoot: null, // 足元の装備（比較表示と付け替えの対象）
    room,
    objects: [...room.objects], // 扉・補給端末・闇市の商品・データ金庫の装備
    focusObject: null, // 近くにある、E で調べられるもの
    exit: null, // 扉を選んだら、進む先の部屋（地図の id）が入る
    ougiReady: false, // 奥義が今使えるか（表示用）
    request: null, // 隠れ家で、E で調べたもの（武器ラック・端末・出撃ゲート）の id が入る
    countdown: room.countdown ?? 0, // 開始前のカウントダウンの残り（秒）。0 になるまで敵は出ない
    events: [], // 起きた出来事（敵を倒した、装備した、など）。ラン側が読んで、実績やボス素材を処理する
    damageTaken: 0, // この部屋で受けたダメージの合計
    choice: null, // 選択待ち（レベルアップのインプラント3択）。出ている間は戦闘が止まる
    pendingLevelUps: 0,
    waves: room.waves,
    wave: -1,
    waveTimer: 0.4,
    kills: 0,
    fx: createFx(),
  };
}

// 画面1コマぶんの時間（秒）だけゲームを進める。
// フレームレートが低くて1コマが長いときは、細かく分けて進める。こうしないと、
// 1コマで進める時間の上限に引っかかって、フレームレートが低いほどゲームが遅くなる。
const STEP = 1 / 60; // 1回で進める長さの目安
const MAX_ADVANCE = 0.1; // 処理が大きく止まったあとでも、1コマでこれ以上は進めない

export function advanceWorld(world, seconds, input) {
  const total = Math.min(Math.max(seconds, 0), MAX_ADVANCE);
  const steps = Math.max(1, Math.ceil(total / STEP - 0.05));
  const dt = total / steps;
  // 「押した瞬間」の入力は、最初の1回だけに渡す（2回ぶん攻撃やダッシュが出ないように）
  const held = { ...input, attackPressed: false, specialPressed: false, dashPressed: false };
  for (let i = 0; i < steps; i += 1) {
    updateWorld(world, dt, i === 0 ? input : held);
    // 部屋を出る・隠れ家の端末を開くなど、画面側の処理が必要になったらそこで止める
    if (world.exit || world.request) break;
  }
}

export function updateWorld(world, dt, input) {
  world.time += dt;
  updateFx(world, dt);
  if (world.fx.hitstop > 0) {
    world.fx.hitstop -= dt;
    return;
  }
  if (world.choice || world.mode === 'dead') return;
  if (world.pendingLevelUps > 0) {
    world.pendingLevelUps--;
    openImplantChoice(world);
    if (world.choice) return;
  }

  updatePlayer(world, dt, input);
  if (world.countdown > 0) {
    // カウントダウン中は動けるが、敵はまだ出ない
    world.countdown -= dt;
  } else if (world.mode === 'play') {
    updateEnemies(world, dt);
    updatePlayerShots(world, dt);
    updateShots(world, dt);
    updateGimmick(world, dt);
    updateDevices(world, dt);
    updateHazards(world, dt);
    updatePlayerDot(world, dt);
    updateArena(world, dt);
    updateWaves(world, dt);
  }
  // ダメージ床は、カウントダウン中や部屋をクリアしたあとでも、時間がたてば消える
  updateZones(world, dt);
  // クリア後や隠れ家でも、撃った弾は飛ぶ（試し撃ち）
  if (world.mode === 'clear') updatePlayerShots(world, dt);
  updateSecret(world);
  updateDarkness(world, dt);
  for (const l of world.loot) l.t += dt;
  world.ougiReady = canUseOugi(world); // 表示用
  updateFocus(world);
}

// ひび割れた壁：部屋をクリアしてから壊せるようになる。壊すと、隠し扉が現れる
function updateSecret(world) {
  const s = world.room.secret;
  if (!s || s.broken || world.mode !== 'clear') return;
  if (!s.enemy) {
    s.enemy = createEnemy(DATA.enemies.get('crackwall'), s.x, s.y, 0, world.rng);
    world.enemies.push(s.enemy);
  } else if (s.enemy.dead) {
    s.broken = true;
    world.enemies = world.enemies.filter((e) => e !== s.enemy);
    world.objects.push({ kind: 'secretDoor', x: s.x, y: s.y, r: SECRET.doorRadius, side: s.side, target: SECRET_IN });
    sfx(world, 'explode');
    addShake(world, FEEL.shake.heavy);
    burst(world, s.x, s.y, COLORS.amber, 30, 280);
    floatText(world, s.x, s.y + (s.side === 'top' ? 34 : -34), '隠し扉', COLORS.amber, 18);
  }
}

function updateWaves(world, dt) {
  // 柵などの「置かれたもの」は、残っていても数えない
  if (world.mode !== 'play' || world.enemies.some((e) => !e.def.prop)) return;
  if (world.wave + 1 >= world.waves.length) {
    clearRoom(world);
    return;
  }
  world.waveTimer -= dt;
  if (world.waveTimer <= 0) {
    world.wave++;
    world.waveTimer = ROOM.waveDelay;
    spawnWave(world, world.waves[world.wave]);
  }
}

// 凍りついて狭まっていく部屋。world.bounds を少しずつ内側に寄せる（プレイヤーも敵もその中に押し戻される）
function updateArena(world, dt) {
  const a = world.arena;
  if (!a || a.inset >= a.target) return;
  a.inset = Math.min(a.target, a.inset + a.speed * dt);
  world.bounds.left = a.base.left + a.inset;
  world.bounds.top = a.base.top + a.inset;
  world.bounds.right = a.base.right - a.inset;
  world.bounds.bottom = a.base.bottom - a.inset;
}

// 部屋をクリアした：報酬を渡して、次の部屋への扉を開く
function clearRoom(world) {
  const p = world.player;
  world.mode = 'clear';
  p.dot = null;
  world.shots = [];
  world.hazards = [];
  world.zones = [];
  world.devices = [];
  // 残っている柵や橋げたは、片づける
  for (const e of world.enemies) burst(world, e.x, e.y, e.color, 6, 160);
  world.enemies = [];
  p.build.credits += Math.round(world.room.clearCredits * p.stats.creditMul);
  // ボスを倒したら全回復
  if (world.boss) p.hp = p.stats.maxHp;
  // 狭まっていた部屋は元に戻る
  if (world.arena) {
    Object.assign(world.bounds, world.arena.base);
    world.arena = null;
  }
  world.objects.push(...doorObjects(world.room.doors));
}

function randomSpot(world, margin) {
  const b = world.bounds;
  const p = world.player;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 30; tries++) {
    x = b.left + margin + world.rng() * (b.right - b.left - margin * 2);
    y = b.top + margin + world.rng() * (b.bottom - b.top - margin * 2);
    if (Math.hypot(x - p.x, y - p.y) >= ROOM.spawnMinDistance) break;
  }
  return { x, y };
}

export function spawnWave(world, wave) {
  const b = world.bounds;
  const margin = 30;
  const scale = world.room.enemyScale ?? 1; // エリアが進んだぶんの、雑魚のHPと攻撃力の倍率
  const hpScale = world.room.hpScale ?? 1; // 周回による、HPの倍率
  if (wave.boss) {
    const def = DATA.bosses.get(wave.boss);
    world.boss = createBoss(def, b.right - 200, (b.top + b.bottom) / 2, ROOM.bossWarning, { hpScale, hard: world.room.bossHard });
    world.enemies.push(world.boss);
    return;
  }
  if (wave.elite) {
    const { x, y } = randomSpot(world, 60);
    const e = createEnemy(DATA.enemies.get(wave.elite.base), x, y, ROOM.spawnWarning + 0.4, world.rng, scale, hpScale);
    world.enemies.push(makeElite(e, wave.elite.traits ?? wave.elite.trait));
  }
  for (const [id, count] of Object.entries(wave)) {
    if (id === 'elite') continue;
    const def = DATA.enemies.get(id);
    for (let i = 0; i < count; i++) {
      const { x, y } = randomSpot(world, margin);
      world.enemies.push(createEnemy(def, x, y, ROOM.spawnWarning + world.rng() * 0.3, world.rng, scale, hpScale));
    }
  }
}
