// ダメージ計算。乱数は外から渡せるようにして、テストで結果を固定できるようにする。

export function calcDamage({
  base,
  attackMul = 1,
  critChance = 0,
  critMul = 2,
  element = null,
  weakness = null,
  weaknessMul = 1.5,
  rng = Math.random,
}) {
  const crit = rng() < critChance;
  const weak = element != null && element === weakness;
  let amount = base * attackMul;
  if (crit) amount *= critMul;
  if (weak) amount *= weaknessMul;
  return { amount: Math.max(1, Math.round(amount)), crit, weak };
}
