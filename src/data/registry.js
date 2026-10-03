// 定義データ（敵・武器・インプラントなど）をまとめる入れ物。
// 「データを1件足す」だけで要素を増やせるように、どの種類も同じ形で登録・検索する。

export function defineRegistry(kind, entries) {
  const byId = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || entry.id === '') {
      throw new Error(`${kind}: id のない定義があります`);
    }
    if (byId.has(entry.id)) {
      throw new Error(`${kind}: id「${entry.id}」が重複しています`);
    }
    byId.set(entry.id, Object.freeze({ ...entry }));
  }

  return {
    kind,
    get(id) {
      const entry = byId.get(id);
      if (!entry) throw new Error(`${kind}: id「${id}」は定義されていません`);
      return entry;
    },
    has: (id) => byId.has(id),
    all: () => [...byId.values()],
    ids: () => [...byId.keys()],
  };
}
