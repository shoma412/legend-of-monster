// 会話の進行に関する判定（どの会話を出すか、既読の記録、名前のごまかし）。画面には依存しない。
import { GLITCH, NOISE_TAG } from '../data/characters.js';
import { dialogues, talks } from '../data/dialogues.js';

// 記号の並びでごまかした名前（依頼主）。出すたびに変わる
export function glitchName(rng = Math.random) {
  const chars = [...GLITCH.chars];
  let name = '';
  for (let i = 0; i < GLITCH.length; i++) name += chars[Math.min(chars.length - 1, Math.floor(rng() * chars.length))];
  return name;
}

// 画面に出す名前
export function displayName(character, rng = Math.random) {
  return character.glitch ? glitchName(rng) : character.name;
}

// 文章の中の印（@noise）を、ごまかした名前に置き換える（通信ログ、エンディング）
export function resolveNames(lines, rng = Math.random) {
  return lines.map((line) => line.split(NOISE_TAG).join(glitchName(rng)));
}

function matches(trigger, save, at, ctx) {
  if (trigger.at !== at) return false;
  if (trigger.boss && trigger.boss !== ctx.boss) return false;
  if (trigger.bossKilled && !(save.bossKills[trigger.bossKilled] > 0)) return false;
  return true;
}

// その場面で自動的に出す会話（まだ見ていないもののうち、最初の1つ）。なければ null
//   at : sortie / hideout / bossIntro　　ctx : { boss }（bossIntro のとき）
export function pendingDialogue(save, at, ctx = {}) {
  return dialogues.find((d) => !save.seenDialogues.includes(d.id) && matches(d.trigger, save, at, ctx)) ?? null;
}

export function markSeen(save, id) {
  if (!save.seenDialogues.includes(id)) save.seenDialogues.push(id);
}

// 隠れ家で話しかけたときの会話。今いちばん進んだ段階のものを、count 回目として順番に返す
export function talkLines(save, who, count = 0) {
  const list = talks[who] ?? [];
  const open = list.filter((t) => !t.after || save.bossKills[t.after] > 0);
  if (open.length === 0) return null;
  const stage = open[open.length - 1].after;
  const current = open.filter((t) => t.after === stage);
  return current[count % current.length].lines;
}
