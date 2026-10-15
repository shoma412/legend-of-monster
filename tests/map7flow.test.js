import { describe, expect, it } from 'vitest';
import { hitEnemy } from '../src/game/combat.js';
import { NEXT_AREA, createRun, enterRoom, handleEvents, hasNextArea, leaveRoom, skipToBoss } from '../src/game/run.js';
import { updateWorld } from '../src/game/world.js';
import { advanceCycle, allMapsCleared, cycleComplete, mapState, recordMapClear } from '../src/logic/maps.js';
import { createSave } from '../src/logic/save.js';

// マップ7を、最初のエリアから最後のボスまで通しで進める（エンディングと、2周目の解放まで）

const DT = 1 / 60;
const idle = { mx: 0, my: 0, attack: false, attackPressed: false, dashPressed: false };

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function killBossOfCurrentArea(run) {
  skipToBoss(run, enterRoom(run));
  const world = enterRoom(run);
  while (!world.boss || world.boss.spawnT > 0) updateWorld(world, DT, idle);
  world.player.inv = Infinity;
  // 最後のボスは、懇願の段階（動かない）まで、HP を削ってから倒す
  hitEnemy(world, world.boss, 99999999, 1, 0, 0, { unblockable: true });
  for (let i = 0; i < 90; i++) updateWorld(world, DT, idle);
  return { world, notes: handleEvents(run, world) };
}

describe('マップ7を通しで遊ぶ', () => {
  it('マップ6までを完了していると選べる。5つのエリアを順に進み、最後のボスを倒すとマップ完了とエンディング、2周目の解放', () => {
    const save = createSave();
    for (const id of ['map1', 'map2', 'map3', 'map4', 'map5', 'map6']) recordMapClear(save, id, 1);
    save.passes.push('map3', 'map4', 'map5');
    const map7 = { id: 'map7' };
    expect(mapState(save, { ...map7, areas: ['gate'], ready: true })).toBe('open');
    expect(allMapsCleared(save)).toBe(false);

    const run = createRun({ weaponId: 'sword', rng: seeded(11), save, mapId: 'map7' });
    const expected = ['gate', 'archive', 'factory', 'logic', 'core'];
    for (let i = 0; i < 5; i++) {
      expect(run.map.areas[run.areaIndex]).toBe(expected[i]);
      const { world } = killBossOfCurrentArea(run);
      expect(world.boss.def.id).toBe(['gatekeeper', 'archivist', 'fabricator', 'cogitor', 'noise'][i]);
      if (i < 4) {
        expect(hasNextArea(run)).toBe(true);
        leaveRoom(run, world, NEXT_AREA);
      } else {
        expect(hasNextArea(run)).toBe(false);
      }
    }
    // 最後のボスを倒した：マップ完了と、エンディング
    expect(run.ending).toBe(true);
    expect(save.bossKills.noise).toBe(1);
    expect(save.cycle).toBe(1); // 周は、自動では進まない（隠れ家の通信端末で話して進める）
    expect(cycleComplete(save)).toBe(true);
    expect(advanceCycle(save)).toBe(true);
    expect(save.cycle).toBe(2);
    expect(save.materials.noiseCore).toBeGreaterThanOrEqual(1);
    expect(save.achievements).toContain('map7');
    expect(allMapsCleared(save)).toBe(true);
  });
});
