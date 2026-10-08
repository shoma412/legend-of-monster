import { describe, expect, it } from 'vitest';
import { padWords } from '../src/logic/padWords.js';

describe('ゲームパッドの言葉への言い換え', () => {
  it('調べる・キット・ダッシュなどのキーを、ボタンの名前にする', () => {
    expect(padWords('E：次のエリアへ進む')).toBe('X：次のエリアへ進む');
    expect(padWords('E：出撃先を選ぶ（大剣）')).toBe('X：出撃先を選ぶ（大剣）');
    expect(padWords('ロックオンした敵を向く。R：切り替え')).toBe('ロックオンした敵を向く。RT：切り替え');
  });

  it('落ちている装備は、X でバッグに入れる', () => {
    expect(padWords('E：付け替える　　F：バッグに入れる')).toBe('X：バッグに入れる');
    expect(padWords('E：装備する　　F：バッグに入れる')).toBe('X：バッグに入れる');
  });

  it('メニューの案内', () => {
    expect(padWords('1〜6 / A・D：切り替え　W・S：選ぶ　Enter：決定　Tab：閉じる')).toBe('LB・RB：切り替え　左スティック：選ぶ　A：決定　B：閉じる');
    expect(padWords('閉じる（Tab）')).toBe('閉じる（B）');
    expect(padWords('はい（Enter）')).toBe('はい（A）');
    expect(padWords('ホイール / W・S：スクロール')).toBe('左スティック：スクロール');
    expect(padWords('ホイール：拡大・縮小　　ドラッグ：動かす（拡大中）　　F：次の取れるマス')).toBe('RT：拡大　LT：縮小　　Y：次の取れるマス');
  });

  it('タイトル・セーブ枠・マップ選択の案内', () => {
    expect(padWords('W・S：選ぶ　Enter：決定')).toBe('左スティック：選ぶ　A：決定');
    expect(padWords('1・2・3 / A・D：選ぶ　Enter：決定　Tab：タイトルへ')).toBe('左スティック：選ぶ　A：決定　B：タイトルへ');
    expect(padWords('武器：大剣　　A・D：マップ　W・S：周回　Enter：出撃　Tab：やめる')).toBe('武器：大剣　　左スティック左右：マップ　上下：周回　A：出撃　B：やめる');
  });

  it('会話・3択・帰還', () => {
    expect(padWords('クリック / E：次へ　　Tab：飛ばす')).toBe('A：次へ　　B：飛ばす');
    expect(padWords('1 / 2 かクリックで選ぶ')).toBe('X・Y で選ぶ');
    expect(padWords('インプラントを1つ選ぶ（1・2・3 キー または クリック）')).toBe('インプラントを1つ選ぶ（左スティックで選んで、A で決定）');
    expect(padWords('装備を見終わったら、下のボタンか Enter で帰還する')).toBe('装備を見終わったら、A で帰還する');
  });

  it('クリックは、RB と LB', () => {
    expect(padWords('左クリック長押し 溜め斬り')).toBe('RB 長押し 溜め斬り');
    expect(padWords('右クリック ジャストガード')).toBe('LB ジャストガード');
    expect(padWords('ゲージ MAX // 右クリック')).toBe('ゲージ MAX // LB');
  });

  it('英語の言葉や、キーと関係のない文は、変えない', () => {
    expect(padWords('> TARGET DOWN // ボルトボア')).toBe('> TARGET DOWN // ボルトボア');
    expect(padWords('HIDEOUT // 隠れ家')).toBe('HIDEOUT // 隠れ家');
    expect(padWords('RB：攻撃（3段斬り）')).toBe('RB：攻撃（3段斬り）');
    expect(padWords('')).toBe('');
    expect(padWords(null)).toBe(null);
  });
});
