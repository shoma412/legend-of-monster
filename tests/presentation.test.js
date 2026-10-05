import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileSong } from '../src/audio/music.js';
import { ARP, BASS, BGM, DRUMS, SE, SONGS } from '../src/data/audio.js';
import { DATA } from '../src/data/index.js';
import { AREA_THEMES } from '../src/data/theme.js';
import { hasBackdrop } from '../src/render/backdrop.js';
import { ACHIEVEMENT_ICONS, MATERIAL_ICONS } from '../src/render/metaIcons.js';

describe('アイコン', () => {
  it('実績は、どれもアイコンがある', () => {
    for (const def of DATA.achievements.all()) expect(ACHIEVEMENT_ICONS[def.icon], def.id).toBeDefined();
  });

  it('ボス素材は、どれも専用のアイコンがある', () => {
    for (const def of DATA.materials.all()) expect(MATERIAL_ICONS[def.id], def.id).toBeDefined();
  });
});

describe('背景', () => {
  it('エリアと隠れ家は、どれも色と背景の模様がある', () => {
    for (const area of DATA.areas.all()) {
      expect(AREA_THEMES[area.theme], area.id).toBeDefined();
      expect(hasBackdrop(area.theme), area.id).toBe(true);
    }
    expect(AREA_THEMES.hideout).toBeDefined();
    expect(hasBackdrop('hideout')).toBe(true);
  });
});

describe('BGM', () => {
  it('ファイルの曲は、public/ に実際に置いてある', () => {
    for (const [key, def] of Object.entries(BGM)) {
      if (def.file) expect(existsSync(`public/${def.file}`), `${key}: ${def.file}`).toBe(true);
    }
  });

  it('エリアごとに、道中の曲とボス戦の曲がある（エリアどうしで別の曲）', () => {
    const used = new Set();
    for (const area of DATA.areas.all()) {
      for (const key of [area.bgm, area.bossBgm]) {
        expect(BGM[key], `${area.id} の ${key}`).toBeDefined();
        expect(SONGS[BGM[key].song], key).toBeDefined();
        expect(used.has(key), key).toBe(false);
        used.add(key);
      }
    }
    for (const key of ['title', 'hideout', 'ending']) expect(SONGS[BGM[key].song], key).toBeDefined();
  });

  it('曲は、どれも正しい形で書かれている（4小節×16、使っている刻み方がある）', () => {
    for (const name of Object.keys(SONGS)) {
      const song = compileSong(name);
      expect(song.bpm).toBeGreaterThan(40);
      expect(song.arrangement.length).toBeGreaterThan(0);
      for (const id of song.arrangement) expect(song.sections[id], `${name} の ${id}`).toBeDefined();
      for (const [id, sec] of Object.entries(song.sections)) {
        expect(sec.chords, `${name} ${id}`).toHaveLength(4);
        if (sec.bass) expect(BASS[sec.bass], `${name} ${id} bass`).toHaveLength(16);
        if (sec.arp) expect(ARP[sec.arp], `${name} ${id} arp`).toHaveLength(16);
        if (sec.drums) for (const part of ['k', 's', 'h']) expect(DRUMS[sec.drums][part], `${name} ${id} drums`).toHaveLength(16);
        if (sec.lead) {
          expect(sec.lead).toHaveLength(4);
          for (const bar of sec.lead) {
            expect(bar, `${name} ${id} lead`).toHaveLength(16);
            for (const n of bar) expect(n === null || Number.isFinite(n)).toBe(true);
          }
        }
      }
    }
  });

  it('単調にならないよう、道中とボス戦の曲は3つ以上のセクションでできている', () => {
    for (const area of DATA.areas.all()) {
      for (const key of [area.bgm, area.bossBgm]) {
        const song = SONGS[BGM[key].song];
        expect(Object.keys(song.sections).length, key).toBeGreaterThanOrEqual(3);
        expect(Object.values(song.sections).some((s) => s.lead), key).toBe(true);
      }
    }
  });

  it('効果音は、どれも1つ以上の層でできている', () => {
    for (const [name, def] of Object.entries(SE)) {
      expect(def.length, name).toBeGreaterThan(0);
      for (const layer of def) {
        expect(layer.freq, name).toHaveLength(2);
        expect(layer.dur, name).toBeGreaterThan(0);
      }
    }
  });
});
