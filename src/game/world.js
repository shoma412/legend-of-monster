// 1部屋ぶんの戦闘の状態と進行。Phaser に依存しないので、そのままテストできる。
import { ROOM, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { roomBounds } from '../logic/geometry.js';
import { createBoss } from './boss.js';
import { updateHazards } from './bossPatterns.js';
import { createEnemy, updateEnemies, updateShots } from './enemyAI.js';
import { createFx, updateFx } from './fx.js';
import { createPlayer, updatePlayer } from './player.js';

// waves: [{ 敵のid: 数, ... }, ...]。{ boss: ボスのid } はボスを出す
// playerHp: 前の部屋から引き継ぐHP（省略すると満タン）
export function createWorld({ weaponId = 'greatsword', waves = [], rng = Math.random, playerHp = null } = {}) {
  const bounds = roomBounds(SCREEN, ROOM.wall);
  const player = createPlayer(weaponId, bounds.left + 90, SCREEN.height / 2);
  if (playerHp != null) player.hp = Math.min(player.stats.maxHp, playerHp);
  return {
    mode: 'play', // play / dead / clear
    time: 0,
    rng,
    bounds,
    player,
    enemies: [],
    boss: null, // ボス部屋のボス（HPバー表示用。倒した後も残す）
    shots: [],
    hazards: [],
    waves,
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
  if (world.mode !== 'play') return;

  updatePlayer(world, dt, input);
  updateEnemies(world, dt);
  updateShots(world, dt);
  updateHazards(world, dt);
  updateWaves(world, dt);
}

function updateWaves(world, dt) {
  if (world.mode !== 'play' || world.enemies.length > 0) return;
  if (world.wave + 1 >= world.waves.length) {
    world.mode = 'clear';
    world.shots = [];
    world.hazards = [];
    return;
  }
  world.waveTimer -= dt;
  if (world.waveTimer <= 0) {
    world.wave++;
    world.waveTimer = ROOM.waveDelay;
    spawnWave(world, world.waves[world.wave]);
  }
}

export function spawnWave(world, wave) {
  const b = world.bounds;
  const p = world.player;
  const margin = 30;
  if (wave.boss) {
    const def = DATA.bosses.get(wave.boss);
    world.boss = createBoss(def, b.right - 200, (b.top + b.bottom) / 2, ROOM.bossWarning);
    world.enemies.push(world.boss);
    return;
  }
  for (const [id, count] of Object.entries(wave)) {
    const def = DATA.enemies.get(id);
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 30; tries++) {
        x = b.left + margin + world.rng() * (b.right - b.left - margin * 2);
        y = b.top + margin + world.rng() * (b.bottom - b.top - margin * 2);
        if (Math.hypot(x - p.x, y - p.y) >= ROOM.spawnMinDistance) break;
      }
      world.enemies.push(createEnemy(def, x, y, ROOM.spawnWarning + world.rng() * 0.3, world.rng));
    }
  }
}
