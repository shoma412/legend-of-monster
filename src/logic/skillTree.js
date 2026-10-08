// 恒久強化のスキルツリー（docs/詳細仕様.md「23. スキルツリー」）。
// 強化の1段ぶんが、ツリーの「マス」1つになる。マスは線でつながっていて、手前のマスを取ると次のマスが取れる。
// 配置は、セーブデータごとの種（seed）から決まる。同じ種なら、いつ作っても同じ配置になる。
//
// ゲームバランスを変えないための決まり（配置がどうなっても守る）：
//   1. マスの値段は、強化ごとに決まっている（src/data/upgrades.js の costs）。配置では変わらない
//   2. 値段の「素材の種類の数」で、置ける深さが決まる：1種類 → 1〜3段目、2種類 → 4〜5段目、3種類 → 6段目以降
//   3. 手前のマスは、そのマスより先のボスの素材を要求しない（素材の順番は src/data/story.js の materials の並び）。
//      だから、あるボスまで倒した人は、そこまでの素材で買えるマスに、必ずたどり着ける
import { upgrades } from '../data/upgrades.js';
import { materials } from '../data/story.js';

// 置ける深さ（素材の種類の数ごと）と、1つのマスから伸ばせる枝の数
export const TREE = {
  roots: 3, // 中心から伸びる枝の数
  depthByTypes: { 1: [1, 3], 2: [4, 5], 3: [6, 9] },
  maxChildren: 3, // 1〜2段目のマスから伸ばせる数
  maxChildrenDeep: 2, // 3段目より先のマスから伸ばせる数
  attempts: 400, // 決まりを満たす配置が見つかるまで、作り直す回数の上限
};

const RANK = Object.fromEntries(materials.map((m, i) => [m.id, i]));

// そのマスの値段に含まれる素材のうち、いちばん先のボスの素材の順番
function rankOf(cost) {
  return Math.max(...Object.keys(cost).map((id) => RANK[id] ?? 0));
}

// すべてのマス（配置を決める前）。id は「強化のid#何段目か」で、配置が変わっても同じ
export function treeNodeDefs() {
  const list = [];
  for (const def of upgrades) {
    if (def.ready === false) continue;
    def.costs.forEach((cost, index) => {
      list.push({ id: `${def.id}#${index}`, upgrade: def.id, index, cost, types: Object.keys(cost).length, rank: rankOf(cost), maxDepth: def.treeMaxDepth ?? null, since: def.since ?? 1 });
    });
  }
  return list;
}

// 種から作る乱数（0 以上 1 未満）。同じ種なら同じ並びになる
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

// 最初の配置（since が 1 のマスだけ）を1回作ってみる。決まりを満たせなかったら null
//   ここを変えると、今あるセーブデータの配置が変わってしまう。あとから足すマスは、下の extendTree で付け足す
function tryBuild(rng) {
  const defs = treeNodeDefs().filter((d) => d.since === 1);
  const placed = [];
  const children = new Map();
  const place = (def, parent) => {
    const node = { ...def, parent: parent ? parent.id : null, depth: parent ? parent.depth + 1 : 1 };
    placed.push(node);
    children.set(node.id, 0);
    if (parent) children.set(parent.id, children.get(parent.id) + 1);
    return node;
  };
  const room = (node) => children.get(node.id) < (node.depth <= 2 ? TREE.maxChildren : TREE.maxChildrenDeep);
  const inRange = (def, depth) => depth >= TREE.depthByTypes[def.types][0] && depth <= Math.min(def.maxDepth ?? 99, TREE.depthByTypes[def.types][1]);
  // そのマスの親にできるマス：深さが合い、枝に空きがあり、親のほうが先のボスの素材を要求しない
  const parentsFor = (def) => placed.filter((n) => inRange(def, n.depth + 1) && room(n) && n.rank <= def.rank);

  // 1種類の素材で買えるマス（1〜3段目）。最初のボスの素材のマスから、枝の根元を選ぶ
  const single = shuffle(defs.filter((d) => d.types === 1), rng);
  const lowest = Math.min(...single.map((d) => d.rank));
  const roots = single.filter((d) => d.rank === lowest).slice(0, TREE.roots);
  if (roots.length < TREE.roots) return null;
  for (const def of roots) place(def, null);
  // 残りは、先のボスの素材ほど後から置く（手前のマスが、先の素材を要求しないように）
  const rest = single.filter((d) => !roots.includes(d)).sort((a, b) => a.rank - b.rank);
  for (const def of rest) {
    const options = parentsFor(def);
    if (options.length === 0) return null;
    place(def, pick(options, rng));
  }

  // 2種類・3種類の素材で買えるマス（4段目より先）
  const double = shuffle(defs.filter((d) => d.types === 2), rng).sort((a, b) => a.rank - b.rank);
  const triple = shuffle(defs.filter((d) => d.types >= 3), rng).sort((a, b) => a.rank - b.rank);
  const waiting = [...double];
  for (const top of triple) {
    // 3種類のマスは6段目より先なので、その手前に 2種類のマスを2つ並べた道を作る
    //   （2つ目は5段目になるので、4段目までと決まっているマスは使わない）
    const usable = waiting.filter((d) => d.rank <= top.rank);
    const second = usable.find((d) => inRange(d, 5));
    const first = usable.find((d) => d !== second);
    if (!first || !second) return null;
    const steps = [first, second];
    let parent = null;
    for (const def of steps) {
      const options = parent ? [parent] : parentsFor(def);
      if (options.length === 0) return null;
      parent = place(def, pick(options, rng));
      waiting.splice(waiting.indexOf(def), 1);
    }
    if (!inRange(top, parent.depth + 1)) return null;
    place(top, parent);
  }
  for (const def of waiting) {
    const options = parentsFor(def);
    if (options.length === 0) return null;
    place(def, pick(options, rng));
  }
  return placed.length === defs.length ? placed : null;
}

// あとから足したマス（since が 2 以上）を、今ある配置に付け足す。今あるマスの場所と親は、変えない。
//   深さの決まりと、「手前のマスは、先のボスの素材を要求しない」は、足したマスにも当てはまる。枝に空きがなければ、その枝から1本多く伸ばす。
//   乱数は、足した回（since）ごとに別のものを使う（次にまた足しても、前に足したマスの場所は変わらない）
function extendTree(nodes, key) {
  const extra = treeNodeDefs().filter((d) => d.since > 1).sort((a, b) => a.since - b.since || a.types - b.types || a.rank - b.rank || a.upgrade.localeCompare(b.upgrade) || a.index - b.index);
  if (extra.length === 0) return nodes;
  const placed = [...nodes];
  const children = new Map(placed.map((n) => [n.id, 0]));
  for (const n of placed) if (n.parent) children.set(n.parent, children.get(n.parent) + 1);
  const room = (node) => children.get(node.id) < (node.depth <= 2 ? TREE.maxChildren : TREE.maxChildrenDeep);
  const inRange = (def, depth) => depth >= TREE.depthByTypes[def.types][0] && depth <= Math.min(def.maxDepth ?? 99, TREE.depthByTypes[def.types][1]);
  const rngs = new Map();
  for (const def of extra) {
    if (!rngs.has(def.since)) rngs.set(def.since, mulberry((key ^ Math.imul(def.since, 0x51ed270b)) >>> 0));
    const rng = rngs.get(def.since);
    const options = placed.filter((n) => inRange(def, n.depth + 1) && n.rank <= def.rank);
    if (options.length === 0) throw new Error(`スキルツリーに、マス ${def.id} を足せませんでした（seed ${key}）`);
    const free = options.filter(room);
    const parent = pick(free.length > 0 ? free : options, rng);
    placed.push({ ...def, parent: parent.id, depth: parent.depth + 1 });
    children.set(def.id, 0);
    children.set(parent.id, children.get(parent.id) + 1);
  }
  return placed;
}

const cache = new Map();

// その種の配置。{ nodes: [{ id, upgrade, index, cost, types, rank, parent, depth }], byId }
//   parent が null のマスは、中心（最初から取れる場所）につながっている
export function buildTree(seed) {
  const key = seed >>> 0;
  if (cache.has(key)) return cache.get(key);
  let nodes = null;
  for (let attempt = 0; attempt < TREE.attempts && !nodes; attempt++) nodes = tryBuild(mulberry((key ^ Math.imul(attempt, 0x9e3779b1)) >>> 0));
  if (!nodes) throw new Error(`スキルツリーの配置を作れませんでした（seed ${key}）`);
  nodes = extendTree(nodes, key);
  const tree = { nodes, byId: Object.fromEntries(nodes.map((n) => [n.id, n])) };
  if (cache.size > 16) cache.clear();
  cache.set(key, tree);
  return tree;
}

// 新しいセーブデータ用の種
export function newTreeSeed(rng = Math.random) {
  return Math.floor(rng() * 2147483647);
}

// そのマスを、いま取れるか（手前のマスを取ってあるか。素材が足りるかは別に調べる）
export function isReachable(tree, owned, id) {
  const node = tree.byId[id];
  return !!node && !owned.includes(id) && (node.parent === null || owned.includes(node.parent));
}

// 取ってあるマスの並びから、中身のおかしいもの（知らないマス、手前を取っていないマス）を除く
export function cleanOwned(tree, owned) {
  const ok = [];
  const list = [...new Set(owned)].filter((id) => tree.byId[id]).sort((a, b) => tree.byId[a].depth - tree.byId[b].depth);
  for (const id of list) {
    const parent = tree.byId[id].parent;
    if (parent === null || ok.includes(parent)) ok.push(id);
  }
  return ok;
}

// 取ってあるマスから、強化ごとの段数を数える（{ 強化のid: 段数 }）
export function upgradeCounts(tree, owned) {
  const counts = {};
  for (const id of owned) {
    const node = tree.byId[id];
    if (node) counts[node.upgrade] = (counts[node.upgrade] ?? 0) + 1;
  }
  return counts;
}

// 画面に並べる位置。返り値は { id: { col, row } }（col は中心からの段、row は 0〜1 の割合で、円のまわりの位置になる）と、根元の row、先のないマスの数（leaves）
//   葉（先のないマス）を上から順に等間隔に置き、枝分かれのマスは、その先のマスの真ん中に置く
export function layoutTree(tree) {
  const kids = new Map();
  for (const n of tree.nodes) {
    const key = n.parent ?? '@root';
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(n);
  }
  const pos = {};
  let next = 0;
  const walk = (node) => {
    const list = kids.get(node.id) ?? [];
    if (list.length === 0) {
      pos[node.id] = { col: node.depth, row: next++ };
      return pos[node.id].row;
    }
    const rows = list.map(walk);
    pos[node.id] = { col: node.depth, row: (rows[0] + rows.at(-1)) / 2 };
    return pos[node.id].row;
  };
  const rootRows = (kids.get('@root') ?? []).map(walk);
  const leaves = Math.max(1, next - 1);
  for (const p of Object.values(pos)) p.row /= leaves;
  return { pos, leaves: next, rootRow: (rootRows[0] + rootRows.at(-1)) / 2 / leaves, maxDepth: Math.max(...tree.nodes.map((n) => n.depth)) };
}
