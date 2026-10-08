import { describe, expect, it } from 'vitest';
import { createSettings, normalizeSettings } from '../src/logic/settings.js';
import { MOBILE_FONT, mobileFontSize, mobileWords } from '../src/logic/mobileWords.js';

// モバイル版の第2段階：言葉と文字の大きさ（docs/詳細仕様.md「31. モバイル版」）

describe('モバイル版の言葉', () => {
  it('キーの名前を、ボタンの名前に言い換える', () => {
    expect(mobileWords('E：扉を選ぶ')).toBe('調べる：扉を選ぶ');
    expect(mobileWords('E：恒久強化を買う')).toBe('調べる：恒久強化を買う');
    expect(mobileWords('閉じる（Tab）')).toBe('閉じる（メニュー）');
    expect(mobileWords('はい（Enter）')).toBe('はい（決定）');
    expect(mobileWords('F：次の取れるマス')).toBe('しまう：次の取れるマス');
    expect(mobileWords('R キーで切り替え')).toBe('「標的」ボタンで切り替え');
  });

  it('マウスの言葉を、指の言葉に言い換える', () => {
    expect(mobileWords('Enter か、もう一度クリックで取る')).toBe('決定 か、もう一度タップで取る');
    expect(mobileWords('右クリックで周囲に衝撃波')).toBe('特殊ボタンで周囲に衝撃波');
    expect(mobileWords('左クリック長押し')).toBe('攻撃ボタンの長押し');
    expect(mobileWords('インプラントを1つ選ぶ（1・2・3 キー または クリック）')).toBe('インプラントを1つ選ぶ（1・2・3 のボタン または タップ）');
  });

  it('メニューの下の案内', () => {
    expect(mobileWords('1〜6 / A・D：切り替え　W・S：選ぶ　Enter：決定　Tab：閉じる')).toBe('スティック左右：切り替え　スティック上下：選ぶ　「決定」ボタン　メニュー：閉じる');
  });

  it('キーの名前でない文字は、変えない', () => {
    for (const text of ['MAP 06  送風区', 'LEGEND OF MONSTER', 'SORTIE // 出撃先を選ぶ', 'WAVE 1/2　敵 3', 'Stun!', 'Weakness', 'HIDEOUT', 'ボアコア ×2', 'CORE：停止', 'Rust!', '']) {
      expect(mobileWords(text)).toBe(text);
    }
    expect(mobileWords(null)).toBe(null);
  });
});

describe('モバイル版の文字の大きさ', () => {
  it('小さな文字だけ、少し大きくする。大きな文字は、そのまま', () => {
    expect(mobileFontSize(11)).toBe(11 + MOBILE_FONT.add);
    expect(mobileFontSize('12px')).toBe(12 + MOBILE_FONT.add);
    expect(mobileFontSize(14)).toBe(14 + MOBILE_FONT.add);
    expect(mobileFontSize(16)).toBe(16);
    expect(mobileFontSize('26px')).toBe(26);
  });
});

describe('モバイル版の設定の初期値', () => {
  it('画質の初期値は、パソコンは「標準」、モバイル版は「高」。自分で選んだ値は、そのまま', () => {
    expect(createSettings().quality).toBe(1);
    expect(createSettings({ mobile: true }).quality).toBe(2);
    expect(normalizeSettings(null, { mobile: true }).quality).toBe(2);
    expect(normalizeSettings({ quality: 1 }, { mobile: true }).quality).toBe(1);
    expect(normalizeSettings({ quality: 3 }).quality).toBe(3);
  });
});
