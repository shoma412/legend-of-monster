// 部屋の中身を作る。部屋の種類の定義（src/data/rooms.js）の build で、下の部品を選ぶ。
import { ROOM, SCREEN } from '../data/balance.js';
import { DATA } from '../data/index.js';
import { generateEliteWaves, generateShop, generateVault, generateWaves } from '../logic/areaGen.js';

const CX = SCREEN.width / 2;
const CY = SCREEN.height / 2;

// 横一列に並べる位置
function row(count, spacing, y) {
  return Array.from({ length: count }, (_, i) => ({ x: CX + (i - (count - 1) / 2) * spacing, y }));
}

// ctx: { area, step, build, rng } → { waves, objects }
const BUILDERS = {
  combat: ({ area, step, rng }) => ({ waves: generateWaves(area, step, rng) }),
  elite: ({ area, step, rng }) => ({ waves: generateEliteWaves(area, step, rng) }),
  boss: ({ area }) => ({ waves: [{ boss: area.boss }] }),

  // 補給：端末を調べるとHPが回復する
  supply: () => ({ objects: [{ kind: 'heal', x: CX, y: CY, r: 50, used: false }] }),

  // 闇市：商品が並ぶ
  market: ({ build, rng }) => {
    const goods = generateShop(build, rng);
    const spots = row(goods.length, 130, CY - 10);
    return { objects: goods.map((g, i) => ({ kind: 'shop', ...spots[i], r: 44, goods: g })) };
  },

  // データ金庫：装備が並び、1つだけ持っていける
  vault: ({ rng }) => {
    const items = generateVault(rng);
    const spots = row(items.length, 140, CY - 10);
    return { objects: items.map((item, i) => ({ kind: 'vault', ...spots[i], r: 44, item })) };
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
    doors,
    clearCredits: def.clearCredits ?? 0,
  };
}

export function hasRoomBuilder(name) {
  return name in BUILDERS;
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
