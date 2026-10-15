import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data/index.js';
import { ACHIEVEMENT_ICONS } from '../src/render/metaIcons.js';
import { processEvent } from '../src/logic/meta.js';
import { createSave, normalizeSave } from '../src/logic/save.js';

// 武器の実績（docs/詳細仕様.md「12. 実績」の「武器の実績を足した」）

const WEAPONS = ['greatsword', 'sword', 'gun', 'knuckle', 'cannon', 'spear', 'chakram', 'drone'];
const newRun = (weaponId) => ({ weaponId, gained: { materials: {}, fragments: [], achievements: [], notes: [] } });
const clear = (save, weaponId) => processEvent(save, newRun(weaponId), { type: 'runClear' });

describe('武器の実績', () => {
  it('8つの武器すべてに、「初めてクリア」と「30回クリア」がある。アイコンもある', () => {
    for (const w of WEAPONS) {
      expect(DATA.achievements.has(`clear-${w}`), w).toBe(true);
      expect(DATA.achievements.has(`master-${w}`), w).toBe(true);
    }
    for (const def of DATA.achievements.all()) expect(ACHIEVEMENT_ICONS[def.icon], def.id).toBeDefined();
  });

  it('クリアすると、その武器のクリア回数が増え、初めてなら「○○使い」が解除される', () => {
    const save = createSave();
    clear(save, 'knuckle');
    expect(save.records.weaponClears).toEqual({ knuckle: 1 });
    expect(save.achievements).toContain('clear-knuckle');
    expect(save.achievements).not.toContain('clear-spear');
    clear(save, 'spear');
    expect(save.achievements).toContain('clear-spear');
  });

  it('30回クリアすると「○○の達人」。29回では解除されない。ほかの武器の回数は混ざらない', () => {
    const save = createSave();
    for (let i = 0; i < 29; i++) clear(save, 'drone');
    clear(save, 'gun');
    expect(save.achievements).not.toContain('master-drone');
    clear(save, 'drone');
    expect(save.records.weaponClears.drone).toBe(30);
    expect(save.achievements).toContain('master-drone');
    expect(save.achievements).not.toContain('master-gun');
  });

  it('8種類すべての武器でクリアすると「全武器使い」。元からある3つは「初めてクリア」の実績があれば数える', () => {
    const save = createSave();
    save.achievements.push('clear-greatsword', 'clear-sword', 'clear-gun'); // 以前のセーブデータ（回数の記録はない）
    for (const w of ['knuckle', 'cannon', 'spear', 'chakram']) {
      clear(save, w);
      expect(save.achievements).not.toContain('all-weapons');
    }
    clear(save, 'drone');
    expect(save.achievements).toContain('all-weapons');
  });

  it('通算100回クリアで「熟練の回収屋」', () => {
    const save = createSave();
    save.records.clears = 98;
    clear(save, 'sword');
    expect(save.achievements).not.toContain('clears-100');
    clear(save, 'sword');
    expect(save.achievements).toContain('clears-100');
  });

  it('隠しボスを含むすべてのボスを倒すと「狩り尽くし」（隠しボスを最後に倒しても、普通のボスを最後に倒しても）', () => {
    for (const lastHidden of [true, false]) {
      const save = createSave();
      const bosses = DATA.bosses.all();
      const last = bosses.find((b) => !!b.hidden === lastHidden);
      for (const b of bosses) if (b.id !== last.id) save.bossKills[b.id] = 1;
      expect(save.achievements).not.toContain('all-bosses');
      processEvent(save, newRun('sword'), { type: last.hidden ? 'secretKill' : 'bossKill', boss: last.id, map: 'map1', area: DATA.areas.ids()[0] });
      expect(save.achievements, last.id).toContain('all-bosses');
    }
  });

  it('セーブデータを読み直しても、武器ごとのクリア回数が残る。壊れた値は捨てる', () => {
    const save = createSave();
    clear(save, 'chakram');
    const loaded = normalizeSave(JSON.parse(JSON.stringify(save)));
    expect(loaded.records.weaponClears).toEqual({ chakram: 1 });
    const broken = normalizeSave({ ...JSON.parse(JSON.stringify(save)), records: { ...save.records, weaponClears: { gun: 'x', sword: -2, spear: 3 } } });
    expect(broken.records.weaponClears).toEqual({ spear: 3 });
    expect(normalizeSave({ version: 8 }).records.weaponClears).toEqual({});
  });
});
