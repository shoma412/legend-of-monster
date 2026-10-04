// 1部屋ぶんの戦闘の状態と進行。Phaser に依存しないので、そのままテストできる。
import { ROOM, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { roomBounds } from '../logic/geometry.js';
import { createBoss } from './boss.js';
import { openImplantChoice } from './build.js';
import { makeElite } from './elite.js';
import { updateFocus } from './objects.js';
import { doorObjects } from './rooms.js';
import { updateZones } from './effects.js';
import { updateHazards } from './bossPatterns.js';
import { createEnemy, updateEnemies, updateShots } from './enemyAI.js';
import { createFx, updateFx } from './fx.js';
import { createPlayer, updatePlayer } from './player.js';

// room: 部屋の中身（src/game/rooms.js の buildRoom が作る）{ type, waves, objects, doors, clearCredits }
//   waves: [{ 敵のid: 数, ... }, ...]。{ boss: ボスのid } はボスを、{ elite: { base, trait } } はエリートを出す
// waves だけを直接渡してもよい（テスト用）
// carry: 前の部屋から引き継ぐもの { hp, build }（省略するとまっさらな状態）
export function createWorld({ weaponId = 'greatsword', waves = [], rng = Math.random, carry = null, room = null } = {}) {
  room ??= { type: 'combat', waves, objects: [], doors: [], clearCredits: 0 };
  const bounds = roomBounds(SCREEN, ROOM.wall);
  const player = createPlayer(weaponId, bounds.left + 90, SCREEN.height / 2, carry);
  return {
    mode: 'play', // play / dead / clear（clear のあとも歩き回って装備を拾える）
    time: 0,
    rng,
    bounds,
    player,
    enemies: [],
    boss: null, // ボス部屋のボス（HPバー表示用。倒した後も残す）
    shots: [],
    hazards: [],
    zones: [], // ダメージ床など、プレイヤー側のその場に残る効果
    loot: [], // 落ちている装備 { x, y, item }
    focusLoot: null, // 足元の装備（比較表示と付け替えの対象）
    room,
    objects: [...room.objects], // 扉・補給端末・闇市の商品・データ金庫の装備
    focusObject: null, // 近くにある、E で調べられるもの
    exit: null, // 扉を選んだら、進む先の部屋（地図の id）が入る
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
    updateShots(world, dt);
    updateHazards(world, dt);
    updateZones(world, dt);
    updateWaves(world, dt);
  }
  for (const l of world.loot) l.t += dt;
  updateFocus(world);
}

function updateWaves(world, dt) {
  if (world.mode !== 'play' || world.enemies.length > 0) return;
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

// 部屋をクリアした：報酬を渡して、次の部屋への扉を開く
function clearRoom(world) {
  const p = world.player;
  world.mode = 'clear';
  world.shots = [];
  world.hazards = [];
  world.zones = [];
  p.build.credits += Math.round(world.room.clearCredits * p.stats.creditMul);
  // ボスを倒したら全回復
  if (world.boss) p.hp = p.stats.maxHp;
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
  if (wave.boss) {
    const def = DATA.bosses.get(wave.boss);
    world.boss = createBoss(def, b.right - 200, (b.top + b.bottom) / 2, ROOM.bossWarning);
    world.enemies.push(world.boss);
    return;
  }
  if (wave.elite) {
    const { x, y } = randomSpot(world, 60);
    const e = createEnemy(DATA.enemies.get(wave.elite.base), x, y, ROOM.spawnWarning + 0.4, world.rng);
    world.enemies.push(makeElite(e, wave.elite.trait));
  }
  for (const [id, count] of Object.entries(wave)) {
    if (id === 'elite') continue;
    const def = DATA.enemies.get(id);
    for (let i = 0; i < count; i++) {
      const { x, y } = randomSpot(world, margin);
      world.enemies.push(createEnemy(def, x, y, ROOM.spawnWarning + world.rng() * 0.3, world.rng));
    }
  }
}
