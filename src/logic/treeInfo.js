// スキルツリーの画面で出す「案内」の計算（画面には触らない。docs/詳細仕様.md「23. スキルツリー」の「案内」）。
//   道筋：選んだマスまでに、あと取る必要のあるマスと、その素材の合計
//   合計：その強化を取ると、恒久強化ぜんたいの数値がどう変わるか
//   次の取れるマス：キー1つで、今すぐ取れるマスを順に選ぶ

// 中心からそのマスまでの道のうち、まだ取っていないマス（中心に近い順。最後が、そのマス自身）。取ってあるマスなら空
export function pathTo(tree, owned, id) {
  const path = [];
  for (let node = tree.byId[id]; node && !owned.includes(node.id); node = node.parent ? tree.byId[node.parent] : null) path.unshift(node);
  return path;
}

// マスの並びの、素材の合計（{ 素材のid: 個数 }）
export function totalCost(nodes) {
  const total = {};
  for (const node of nodes) for (const [id, n] of Object.entries(node.cost)) total[id] = (total[id] ?? 0) + n;
  return total;
}

// 数値で表せる効果の、画面での名前。percent は「%」で出すもの
const STAT_LABELS = {
  maxHp: { label: '最大HP' },
  attackMul: { label: '攻撃力', percent: true },
  dashCharges: { label: 'ダッシュの回数' },
  dashHaste: { label: 'ダッシュの回復', percent: true },
  damageTaken: { label: '被ダメージ', percent: true },
  moveSpeedMul: { label: '移動速度', percent: true },
  critChance: { label: '会心率', percent: true },
  critMul: { label: '会心ダメージ', percent: true },
  visionBonus: { label: '暗闇で見える範囲', percent: true },
  dotResist: { label: '持続ダメージの軽減', percent: true },
  weakBonus: { label: '弱点へのダメージ', percent: true },
  kitBonus: { label: '修復キットの回復量', percent: true },
  statusTime: { label: '状態異常の時間', percent: true },
};
const COUNT_LABELS = {
  kits: '開始時の修復キット',
  itemSlots: '消耗品の枠',
  carrySlots: '持ち込みの種族の枠',
  keepImplants: '持ち越せるインプラント',
};

// その強化の1段ぶんの効果のうち、数値で表せるもの（[{ key, label, percent, add }]）
function numericEffects(def) {
  const list = [];
  for (const mod of def.perLevel.mods ?? []) {
    const info = STAT_LABELS[mod.stat];
    if (info && typeof mod.add === 'number') list.push({ key: `stat:${mod.stat}`, label: info.label, percent: !!info.percent, add: mod.add });
  }
  for (const [key, label] of Object.entries(COUNT_LABELS)) {
    if (typeof def.perLevel[key] === 'number') list.push({ key, label, percent: false, add: def.perLevel[key] });
  }
  return list;
}

function signed(value, percent) {
  const n = percent ? Math.round(value * 100) : Math.round(value * 100) / 100;
  return `${n < 0 ? '−' : '+'}${Math.abs(n)}${percent ? '%' : ''}`;
}

// その強化をもう1段取ると、恒久強化ぜんたいの合計がどう変わるか。
//   defs: すべての強化の定義、levels: { 強化のid: 取った段数 }、def: 見ている強化
//   返り値：[{ label, now, next }]（now・next は「+20」「−6%」のような文字）。数値で表せない強化（奥義など）は空
export function upgradePreview(defs, levels, def) {
  return numericEffects(def).map((effect) => {
    let now = 0;
    for (const other of defs) {
      const level = levels[other.id] ?? 0;
      if (level === 0) continue;
      for (const e of numericEffects(other)) if (e.key === effect.key) now += e.add * level;
    }
    return { label: effect.label, now: signed(now, effect.percent), next: signed(now + effect.add, effect.percent) };
  });
}

// 今の位置（cursor）の次にある、取れるマスの番号。states は、並び順どおりの状態の並び。
//   今すぐ取れるマス（open）がなければ、素材が足りないだけのマス（short）を探す。どちらもなければ -1
export function nextOpenIndex(states, cursor) {
  for (const want of ['open', 'short']) {
    for (let k = 1; k <= states.length; k++) {
      const i = (cursor + k) % states.length;
      if (states[i] === want) return i;
    }
  }
  return -1;
}
