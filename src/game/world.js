// 1部屋ぶんの戦闘の状態と進行。Phaser に依存しないので、そのままテストできる。
import { ROOM, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { roomBounds } from '../logic/geometry.js';
import { createEnemy, updateEnemies, updateShots } from './enemyAI.js';
import { createFx, updateFx } from './fx.js';
import { createPlayer, updatePlayer } from './player.js';

// waves: [{ 敵のid: 数, ... }, ...]
export function createWorld({ weaponId = 'greatsword', waves = [], rng = Math.random } = {}) {
  const bounds = roomBounds(SCREEN, ROOM.wall);
  return {
    mode: 'play', // play / dead / clear
    time: 0,
    rng,
    bounds,
    player: createPlayer(weaponId, bounds.left + 90, SCREEN.height / 2),
    enemies: [],
    shots: [],
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
  updateWaves(world, dt);
}

function updateWaves(world, dt) {
  if (world.mode !== 'play' || world.enemies.length > 0) return;
  if (world.wave + 1 >= world.waves.length) {
    world.mode = 'clear';
    world.shots = [];
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
