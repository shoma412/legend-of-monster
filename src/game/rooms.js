// 部屋の中身を作る。部屋の種類の定義（src/data/rooms.js）の build で、下の部品を選ぶ。
import { ROOM, SCREEN, SECRET } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { generateEliteWaves, generateShop, generateVault, generateWaves } from '../logic/areaGen.js';

const CX = SCREEN.width / 2;
const CY = SCREEN.height / 2;

// 横一列に並べる位置
function row(count, spacing, y) {
  return Array.from({ length: count }, (_, i) => ({ x: CX + (i - (count - 1) / 2) * spacing, y }));
}

// 部屋の仕掛けを抽選する（エリアの定義の gimmicks）。付かなければ null
function rollGimmick(area, rng) {
  for (const g of area.gimmicks ?? []) if (rng() < g.chance) return DATA.gimmicks.get(g.id);
  return null;
}

// ctx: { area, step, build, rng, fragment, eliteTraits } → { waves, objects, gimmick }
const BUILDERS = {
  // 戦闘：雑魚の波。エリアによっては、部屋の仕掛けが付く
  combat: ({ area, step, rng }) => ({ waves: generateWaves(area, step, rng), gimmick: rollGimmick(area, rng) }),
  elite: ({ area, step, rng, eliteTraits }) => ({ waves: generateEliteWaves(area, step, rng, eliteTraits ?? 1) }),
  boss: ({ area }) => ({ waves: [{ boss: area.boss }] }),
  none: () => ({}),
  // 隠しボスの部屋
  secretBoss: ({ secretBoss }) => ({ waves: [{ boss: secretBoss }] }),

  // 補給：端末を調べるとHPが回復する
  supply: () => ({ objects: [{ kind: 'heal', x: CX, y: CY, r: 50, used: false }] }),

  // 闇市：商品が並ぶ
  market: ({ build, rng, tier }) => {
    const goods = generateShop(build, rng, tier);
    const spots = row(goods.length, 130, CY - 10);
    return { objects: goods.map((g, i) => ({ kind: 'shop', ...spots[i], r: 44, goods: g })) };
  },

  // データ金庫：装備が並び、1つだけ持っていける
  // fragment: ここで拾えるデータ片の id（まだ持っていないものがあるときだけ）
  vault: ({ rng, fragment, tier }) => {
    const items = generateVault(rng, tier);
    const spots = row(items.length, 140, CY - 10);
    const objects = items.map((item, i) => ({ kind: 'vault', ...spots[i], r: 44, item }));
    if (fragment) objects.push({ kind: 'fragment', id: fragment, x: CX, y: CY + 110, r: 44 });
    return { objects };
  },

  // 遭遇：人物が1人いる。話しかけると選択肢が出る
  encounter: ({ rng }) => {
    const ids = DATA.encounters.ids();
    const def = DATA.encounters.get(ids[Math.min(ids.length - 1, Math.floor(rng() * ids.length))]);
    return { objects: [{ kind: 'npc', encounter: def.id, who: def.who, color: def.color, x: CX + 60, y: CY, r: 64, used: false }] };
  },
};

// 部屋を作る。doors は、クリア後に開く扉（進める部屋 { id, type } の並び）
export function buildRoom(type, ctx, doors = []) {
  const def = DATA.rooms.get(type);
  const built = BUILDERS[def.build](ctx);
  return {
    type,
    waves: built.waves ?? [],
    objects: built.objects ?? [],
    gimmick: built.gimmick ?? null, // 部屋の仕掛け（src/data/gimmicks.js。なければ null）
    doors,
    clearCredits: def.clearCredits ?? 0,
  };
}

export function hasRoomBuilder(name) {
  return name in BUILDERS;
}

// 隠し扉の行き先：隠しボスの部屋へ入る／そこから元の部屋へ戻る
export const SECRET_IN = '@secret';
export const SECRET_OUT = '@secretBack';

// ひび割れた壁の場所を決める。上か左の壁のどこか（右の壁は次の部屋への扉が並び、下の壁は操作の案内と重なる）
export function makeCrack(rng) {
  const W = SCREEN.width;
  const H = SCREEN.height;
  const side = ['top', 'left'][Math.min(1, Math.floor(rng() * 2))];
  const along = rng();
  if (side === 'left') {
    const lo = ROOM.wallTop + SECRET.sideMargin * 0.6;
    const hi = H - ROOM.wall - SECRET.sideMargin * 0.6;
    return { side, x: ROOM.wall + SECRET.wallMargin, y: lo + along * (hi - lo), enemy: null, broken: false };
  }
  const lo = ROOM.wall + SECRET.sideMargin;
  const hi = W - ROOM.wall - SECRET.sideMargin;
  return { side, x: lo + along * (hi - lo), y: ROOM.wallTop + SECRET.wallMargin, enemy: null, broken: false };
}

// クリア後の扉を右の壁に並べる
export function doorObjects(doors) {
  const x = SCREEN.width - ROOM.wall;
  // door は { id, type }。種類の名前だけでもよい（テスト用）
  return doors.map((door, i) => ({
    kind: 'door',
    type: door.type ?? door,
    target: door.id ?? door, // 進む先（world.exit に入る）
    x,
    y: CY + (i - (doors.length - 1) / 2) * ROOM.doorSpacing,
    r: 56,
  }));
}
