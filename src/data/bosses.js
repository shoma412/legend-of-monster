// ボスの定義。攻撃パターンの組み合わせと順番を書く（M2 から追加）
// 1件 = { id, ... } の形で足す。
//
// attacks: このボスが使う攻撃。pattern は部品の名前（src/game/bossPatterns.js）
//   charge    : 予告線 → 突進 → 硬直。壁に当たるとスタン。repeat で連続回数
//   shockwave : 足元に予告 → 衝撃波の輪が広がる → 硬直
//   cone      : 扇形の予告 → その範囲に噴射し続ける → 硬直。slow: true なら当たると減速
//   slam      : 自分の周りに円の予告 → その範囲を一度に攻撃 → 硬直
//   rain      : 落下地点の予告を次々に出し、少し遅れてそこに落ちてくる → 硬直
//   laser     : 細い線の予告 → 太いレーザーが turn 度ぶん回転する → 硬直
//   summon    : 予告 → 雑魚を count 体呼ぶ（部屋にいる雑魚が max 体を超えない範囲で）→ 硬直
//   vent      : duration 秒のあいだ動けない（大きな隙）。その間は体に触れても安全
//   barrage   : 予告 → 弾をばらまく。spread 360 で全方向、それより小さいとプレイヤーへ扇形。waves 回、rotate 度ずつずらして撃つ
//   leap      : プレイヤーの場所に着地点の予告 → 跳ぶ → 着地で周りを攻撃。ring を書くと衝撃波の輪も出る
//   lines     : 部屋を横切る線を count 本、順に光らせる。orient: aim / horizontal / vertical / cross
//   pools     : その場に残る危険な床を count 個置く。slow: true なら踏むと減速
//   pendulum  : 吊ったフックが、予告の線の上を passes 回、行ったり来たりする。lines 本（1本目は横、2本目は縦）。プレイヤーのいる場所を通る
//   girder    : 予告の線に沿って、杭の列（壁）を張る。lines 本。杭は post の敵（置かれたもの）で、gap の幅の隙間が gaps か所ある。部屋に残せるのは max 本まで
//   magnet    : duration 秒のあいだ、プレイヤーを strength の速さで引き寄せる（ダッシュ中は引かれない）。最後に radius の範囲を叩く
//   endure    : 大技「耐える」。duration 秒溜める。その間に最大HPの break の割合だけダメージを与えると中断でき、stun 秒のスタン。中断できないと、輪が blast.count 回広がる
//   safezone  : 大技「安全地帯」。部屋全体が危険になり、zones 個の円（radius）の中だけが助かる。waves 回くり返す
//   chase     : 大技「追尾」。照準の円が count 個、プレイヤーを follow 秒追い、lock 秒止まってから攻撃する
//   orbit     : 固有（スクラップハウンド）。体のまわりを刃が count 枚回り、その間もプレイヤーを追う。当たると持続ダメージ（dot）
//   wires     : 固有（ガーダースパイダー）。部屋を横切る糸を count 本張る。life 秒残り、触れている間は減速と、tick 秒ごとのダメージ
//   weld      : 固有（クレーンタイタン）。ビームがプレイヤーをゆっくり追って回る（turn 度/秒）。通ったあとに燃える床（trail）が残る
//   cells     : 固有（アーキテクト）。部屋をマスに分け、市松模様の半分 → 残りの半分の順に攻撃する（waves 回）
//   ink       : 固有（アーキテクト）。足元から広がっていく床を置く。中にいると持続ダメージ
//   dot       : 持続ダメージの種類（balance の STATUS.dots：burn 炎上 / bleed 裂傷 / corrode 腐食）。ダッシュすると消える
//   douse     : 固有（ランプイーター）。非常灯を消して1本を壊し（breakAll なら全部）、暗闇の中で位置を変えてから、突進を lunges 回
//   scales    : 固有（ランプイーター）。鱗粉の雲を count 個まく。中にいると「目くらみ」（見える範囲が狭くなる）
//   burrow    : 潜って姿を消し（その間は攻撃が当たらない）、予告の円から飛び出して周りを攻撃する。repeat で連続回数。pool を書くと、飛び出した場所に床が残る
//   sweep     : 固有（ダクトクローラー）。壁の通気口から長い体で部屋を横切る。通る帯（width）が telegraph 秒のあいだ赤く光り、体（length）が speed で走る。帯の途中の「継ぎ目」（seams か所、seamLen）にいれば当たらない
//   ventburst : 固有（ダクトクローラー）。床の通気口が count 回、interval 秒ごとに光り、delay 秒後に熱の柱が噴く。選ばれる口は、プレイヤーの動いている向きの先
//   blowthrough : 大技（ダクトクローラー）。sweeps 本の横断を stagger 秒ずつ遅らせて通し、そのあいだ vents の熱排気を重ねる
//   ボルトボア        : wirepull 電線ひっぱり / insulators 碍子落とし / stakefence 杭の放電 / statics 帯電 / tuskrip 牙の突き上げ / overvolt 大技（動きは src/game/map1Bosses.js）
//   クライオ・ワイバーン: featherbolt 氷の羽根 / iciclewave 氷柱の波 / frostbreath 凍る息 / frostwings 霜の翼 / skyshadow 寒空の影 / absolutezero 大技
//   オーバーロード    : opblocks 命令ブロック / tracepath 配線トレース / satellites 子機の円陣 / reboot 再起動 / shortcircuit 基板ショート / systemhalt 大技
//   パイプサーペント  : burrow（固有）/ coilcrush とぐろ締め / pipeburst 配管破裂 / sludgeglob 汚水の塊 / grapple 巻きつき / mudflow 大技（動きは src/game/map2Bosses.js）
//   タンククラブ      : pincerclose はさみ打ち / bubbleswarm 泡の群れ / sidestep 横走り / jetcross 水圧噴射 / rollshell 甲羅転がし / hightide 大技
//   スラッジハイドラ  : sludgesplit 分裂 / sludgefount 汚泥の噴水 / headsweep 首の掃射 / bogs 泥沼 / entangle 首の絡み / regrowth 大技
//   スクラップハウンド: magnet・orbit（固有）/ junkbounce 跳ね鉄くず / triplebite 三連噛み / junkpile 鉄くずの山 / junkstorm 大技（動きは src/game/map3Bosses.js）
//   ガーダースパイダー: wires・girder（固有）/ needles 毒針 / eightlegs 八本脚 / eggs 卵 / webweave 大技
//   クレーンタイタン  : weld・pendulum（固有）/ beamdrop 鉄骨落とし / cranespin クレーン旋回 / rivetgun 鋲打ち / collapse 大技
//   アーキテクト      : cells・ink（固有）/ plans 設計図 / surveyrun 測量 / prototype 試作機 / finishwork 大技
//   ランプイーター    : douse・scales（固有）/ lamptarget 灯り目がけ / windflap 羽ばたきの風 / glowscales 光の鱗（動きは src/game/map4Bosses.js）
//   センチネル        : searchlight・flare（固有）/ sweeplights 探照の掃き / flashring 閃光の輪
//   ブレーカー        : blackout・afterimage（固有）/ shortout 短絡 / cutterarm 遮断の腕 / railrush 過負荷突進
//   ノクターン        : shadowstep・mirror（固有）/ leadblade 先読みの刃 / shadowring 影の包囲 / afterwing 黒い羽ばたき
// 【決まり】2026-10-13 から、攻撃の部品は、そのボスだけが使う（共通の部品はなくす）。上の「charge」から「burrow」までの共通の部品は、まだ作り直していないボスが使っているあいだだけ残してある
//   echo / trailstrike / collect / censorbars / backup / rewind : 固有（アーカイバー）。数値の意味は、下の定義の注釈
//   gateclose / holdshots / callguards / fissure / tailbomb / lockdown : 固有（ゲートキーパー）。数値の意味は、下の定義の注釈
//   twister / sweepup / swirlshot / spiralbolt / cycloneram / eyestorm : 固有（サイクロン）。数値の意味は、下の定義の注釈
//   compass / gust / windseed / windturn / windrush / stormfury : 固有（ウェザーベーン）。それぞれの数値の意味は、下の定義の注釈
// shield: { arc } を書くと、正面のその角度（度）からの武器の攻撃を防ぐ（甲羅）。硬直中は開いて防げない
// heads: { enemy, count, orbit, reduce } を書くと、体から首が生える。首が残っている間、本体へのダメージが reduce の割合だけ減る
// turnRate: 攻撃の合間に向きを変える速さ（ラジアン/秒）。書かなければ、すぐにプレイヤーのほうを向く
// 攻撃に reach: 'near' / 'far' を書くと、プレイヤーが近い・遠いときに出やすくなる（書かなければ、いつでも同じ）
// reactions: プレイヤーが同じ動きを続けたときに返す技。when は 'far'（離れ続ける）か 'behind'（背後に居続ける）、seconds 秒続くと move を出す
// ultimate: { move, announce } HP が残りわずか（balance の BOSS_AI.ultimateAt）になると、1回だけ使う大技
// phases: HP の割合で切り替わる行動。上から順に見て、残りHPの割合が hpAbove より大きい最初のものを使う
//   moves    : この段階で使う技（attacks の名前）。この中から、状況に合うものを抽選する（src/logic/bossAi.js）
//   combos   : 連携。[{ moves: [技, 技] }] と書くと、間を空けずに続けて出す。締めのあとは長めの隙ができる
//   side     : 重ねる攻撃。{ moves: [技…], every: { min, max } } と書くと、本体の行動とは別に、その間隔（秒）で差し込まれる
//   rest     : { after, move } after 回攻撃するごとに、必ず move（冷却の隙）を出す
//   idle     : 攻撃と攻撃の間に歩いて近づく時間（秒）
//   speed    : この段階の速さの倍率（予告も攻撃も、合間の時間も速くなる）
//   noShield : true なら、この段階では甲羅で防げない
//   regrow   : この段階では、倒された首がこの秒数ごとに1本ずつ生え直す
//   arena    : この段階に入ると、部屋の端から inset px まで seconds 秒かけて凍りつき、動ける範囲が狭まる
export const bosses = [
  {
    id: 'boltboar',
    name: 'ボルトボア',
    alias: '電線喰らい', // 登場時に出す異名
    shape: 'boar',
    color: 'shock',
    weakness: 'cold',
    material: 'boarCore', // 倒すと持ち帰れるボス素材（src/data/story.js の materials）
    radius: 42,
    hp: 2100,
    speed: 70,
    contactDamage: 26,
    xp: 120,
    credits: 60,
    drops: { count: 3, rarityBonus: 1 }, // 倒すと必ず落とす装備の数と、レア度の底上げ
    attacks: {
      // 固有「電線ひっぱり」：電柱のあいだの電線が、部屋を横切ってしなり、伸びきったら、逆向きに戻ってくる。端まで逃げるか、電線の幅の外へ出る
      wirepull: { pattern: 'wirepull', telegraph: 0.9, lockTime: 0.35, wires: 1, length: 360, offset: 170, speed: 380, backSpeed: 470, damage: 34, recover: 0.8, reach: 'far' },
      wirepullHard: { pattern: 'wirepull', telegraph: 0.9, lockTime: 0.35, wires: 2, length: 360, offset: 170, speed: 420, backSpeed: 520, damage: 34, recover: 0.8, reach: 'far' },
      // 固有「碍子落とし」：天井の碍子が落ちて割れ、破片が全方向に飛ぶ。割れた場所に、短い間だけ電気の床が残る
      insulators: { pattern: 'insulators', telegraph: 0.6, count: 6, minDist: 90, radius: 42, delay: 0.85, stagger: 0.16, damage: 28, shards: { count: 8, speed: 220, radius: 6, damage: 18, life: 2.6 }, pool: { radius: 34, arm: 0.1, life: 2.2, tick: 0.5, damage: 12 }, recover: 0.8 },
      insulatorsHard: { pattern: 'insulators', telegraph: 0.5, count: 8, minDist: 90, radius: 42, delay: 0.8, stagger: 0.14, damage: 28, shards: { count: 8, speed: 230, radius: 6, damage: 18, life: 2.6 }, pool: { radius: 34, arm: 0.1, life: 2.2, tick: 0.5, damage: 12 }, recover: 0.8 },
      // 固有「杭の放電」：プレイヤーのまわりに杭を打ち、杭を結ぶ線が電気を帯びる。内側は安全だが、外へ出る隙間（gap px）は1か所だけ
      stakefence: { pattern: 'stakefence', telegraph: 0.7, stakes: 3, radius: 150, gap: 90, arm: 0.9, life: 5, damage: 30, recover: 1.0 },
      stakefenceHard: { pattern: 'stakefence', telegraph: 0.6, stakes: 4, radius: 170, gap: 80, arm: 0.8, life: 5, damage: 30, recover: 1.0 },
      // 固有「帯電」：体に電気をため、放射状の稲妻がのびて、ゆっくり回る。稲妻のすき間に入れば当たらない
      statics: { pattern: 'statics', telegraph: 0.9, rays: 8, spin: 0.55, width: 14, warn: 0.6, live: 3.2, damage: 32, recover: 0.9, reach: 'near' },
      staticsHard: { pattern: 'statics', telegraph: 0.8, rays: 12, spin: 0.65, width: 14, warn: 0.5, live: 3.4, damage: 32, recover: 0.9, reach: 'near' },
      // 固有「牙の突き上げ」：前の床を掘り返し、床板が順に跳ね上がる。当たると宙に浮かされて、float 秒のあいだ操作できない
      tuskrip: { pattern: 'tuskrip', telegraph: 0.8, lockTime: 0.25, count: 8, step: 66, radius: 40, delay: 0.55, stagger: 0.1, damage: 30, float: 0.5, recover: 0.9, reach: 'near' },
      // 大技「過電圧」：壁ぎわの電線が、内側へ3回狭まる。電線と壁のあいだは、いる間ずっとダメージ。電柱のそば（安全の円）だけが助かる
      overvolt: { pattern: 'overvolt', telegraph: 1.8, steps: [50, 100, 150], warn: 1.1, hold: 2.3, tick: 0.5, damage: 34, safes: 2, safeRadius: 70, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'wirepull' }],
    ultimate: { move: 'overvolt', announce: '過電圧' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.3, max: 2.2 }, moves: ['wirepull', 'insulators', 'stakefence', 'statics', 'tuskrip'] },
      {
        hpAbove: 0,
        idle: { min: 1.0, max: 1.6 },
        moves: ['wirepullHard', 'insulatorsHard', 'stakefenceHard', 'staticsHard', 'tuskrip'],
        combos: [{ moves: ['tuskrip', 'wirepullHard'] }, { moves: ['stakefenceHard', 'staticsHard'] }],
        announce: '暴走',
      },
    ],
  },
  {
    id: 'cryowyvern',
    name: 'クライオ・ワイバーン',
    alias: '冷却塔の主', // 登場時に出す異名
    shape: 'wyvern',
    color: 'cold',
    weakness: 'heat',
    material: 'cryoCore',
    radius: 38,
    hp: 3400,
    speed: 96,
    contactDamage: 31,
    xp: 200,
    credits: 90,
    drops: { count: 3, rarityBonus: 1 },
    attacks: {
      // 固有「氷の羽根」：羽根を投げる。羽根は弧を描いて飛び、outT 秒後に、竜のいる場所へ戻ってくる（行きと帰りで当たる）
      featherbolt: { pattern: 'featherbolt', telegraph: 0.7, lockTime: 0.2, count: 3, spread: 50, speed: 260, turn: 1.1, outT: 1.5, back: 300, damage: 26, radius: 11, recover: 0.8, reach: 'far' },
      featherboltHard: { pattern: 'featherbolt', telegraph: 0.6, lockTime: 0.2, count: 5, spread: 70, speed: 270, turn: 1.3, outT: 1.5, back: 320, damage: 26, radius: 11, recover: 0.8, reach: 'far' },
      // 固有「氷柱の波」：爪でなぞった線に沿って、氷柱が順に生える
      iciclewave: { pattern: 'iciclewave', telegraph: 0.7, lockTime: 0.25, lines: 1, lineSpread: 0, count: 10, step: 58, radius: 32, delay: 0.5, stagger: 0.09, damage: 28, recover: 0.8 },
      iciclewaveHard: { pattern: 'iciclewave', telegraph: 0.6, lockTime: 0.25, lines: 3, lineSpread: 50, count: 10, step: 58, radius: 32, delay: 0.5, stagger: 0.09, damage: 28, recover: 0.8 },
      // 固有「凍る息」：扇形に冷気を吹く（浴びると減速）。吹いた場所に、凍る床（慣性がついて止まりにくい）が残る
      frostbreath: { pattern: 'frostbreath', telegraph: 0.9, lockTime: 0.3, range: 400, arc: 54, duration: 1.2, tick: 0.3, damage: 24, patch: { r: 54, life: 7, max: 12 }, recover: 0.8 },
      // 固有「霜の翼」：左右に氷の壁が立って、一本道の通路ができる。通路に、氷柱の波が走る。壁は life 秒で崩れる
      frostwings: { pattern: 'frostwings', telegraph: 0.8, pillar: 'icepillar', gap: 150, spacing: 30, life: 7, marks: 10, laneOffset: 38, markRadius: 44, delay: 0.9, stagger: 0.3, damage: 30, recover: 1.0 },
      // 固有「寒空の影」：竜が空へ消え、影が部屋の中を動き回る。止まった場所に降りてきて、周りを凍らせる
      skyshadow: { pattern: 'skyshadow', telegraph: 0.6, roam: 3.0, speed: 300, wander: 140, land: 0.8, radius: 110, damage: 36, recover: 0.9 },
      // 大技「絶対零度」：部屋が凍りつき、「凍え」がたまる。焚き火の円の中にいる間だけ、下がる。満タンで凍結ダメージ
      absolutezero: { pattern: 'absolutezero', telegraph: 1.9, duration: 14, fires: 3, radius: 90, move: 3.6, warn: 0.9, rate: 0.16, cool: 0.5, damage: 40, freeze: 0.8, after: 0.55, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'featherbolt' }],
    ultimate: { move: 'absolutezero', announce: '絶対零度' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, moves: ['featherbolt', 'iciclewave', 'frostbreath', 'frostwings', 'skyshadow'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.4 },
        moves: ['featherboltHard', 'iciclewaveHard', 'frostbreath', 'frostwings', 'skyshadow'],
        combos: [{ moves: ['frostbreath', 'iciclewaveHard'] }, { moves: ['skyshadow', 'featherboltHard'] }],
        announce: '凍結開始',
        arena: { inset: 90, seconds: 22 },
      },
    ],
  },
  {
    id: 'overload',
    name: 'オーバーロード',
    alias: '統合管理機構', // 登場時に出す異名
    shape: 'core',
    color: 'heat',
    weakness: 'shock',
    material: 'overCore',
    radius: 48,
    hp: 5500,
    speed: 34,
    contactDamage: 36,
    xp: 300,
    credits: 150,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「命令ブロック」：番号つきのブロックが、番号の順に爆発する。次に爆発するブロックの枠が光る
      opblocks: { pattern: 'opblocks', telegraph: 0.7, count: 6, sep: 100, radius: 56, warn: 0.9, gap: 0.55, damage: 34, recover: 0.8 },
      opblocksHard: { pattern: 'opblocks', telegraph: 0.6, count: 8, sep: 92, radius: 56, warn: 0.8, gap: 0.45, damage: 34, recover: 0.8 },
      // 固有「配線トレース」：基板の線の上を、光の点が、曲がりながら走る。通ったあとの線は、しばらく感電する
      tracepath: { pattern: 'tracepath', telegraph: 0.7, edges: 7, warn: 1.1, speed: 380, trailLife: 2.8, width: 12, damage: 30, recover: 0.8 },
      tracepathHard: { pattern: 'tracepath', telegraph: 0.6, edges: 10, warn: 1.0, speed: 440, trailLife: 2.8, width: 12, damage: 30, recover: 0.8 },
      // 固有「子機の円陣」：子機が本体のまわりを回り、プレイヤーへ弾を撃つ。duration 秒たつと戻る。全部壊すと、本体に open 秒の隙ができる
      satellites: { pattern: 'satellites', telegraph: 0.7, enemy: 'satdrone', count: 3, orbit: 92, spin: 1.1, duration: 8, open: 3, recover: 0.8, reach: 'far' },
      // 固有「再起動」：四隅の端末が光る。charge 秒のあいだに1つでも壊さないと、部屋の端（safe px）以外に放電する。壊すと、本体に隙ができる
      reboot: { pattern: 'reboot', telegraph: 0.7, terminal: 'terminal', inset: 60, charge: 6.5, safe: 80, damage: 44, open: 3.5, recover: 1.0 },
      // 固有「基板ショート」：基板の線の交差点が順に光り、十字の稲妻が走る
      shortcircuit: { pattern: 'shortcircuit', telegraph: 0.7, count: 5, delay: 0.9, stagger: 0.4, width: 26, damage: 32, recover: 0.8 },
      shortcircuitHard: { pattern: 'shortcircuit', telegraph: 0.6, count: 7, delay: 0.85, stagger: 0.32, width: 26, damage: 32, recover: 0.8 },
      // 冷却：数秒の大きな隙
      vent: { pattern: 'vent', duration: 3.6 },
      // 大技「全システム停止」：部屋が暗転し、命令ブロックが12個。番号は最初の数秒しか見えない。配線トレースも重なる
      systemhalt: {
        pattern: 'systemhalt', telegraph: 1.8, count: 12, sep: 72, radius: 50, warn: 1.2, gap: 0.38, damage: 34, dim: 0.4, hideAfter: 3.2, traceDelay: 2.5,
        trace: { edges: 9, warn: 1.0, speed: 420, trailLife: 2.6, width: 12, damage: 30 },
        recover: 1.5,
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'satellites' }],
    ultimate: { move: 'systemhalt', announce: '全システム停止' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.8 }, moves: ['opblocks', 'tracepath', 'satellites', 'reboot', 'shortcircuit'] },
      // オーバーヒート：攻撃が速くなるが、3回攻撃するたびに冷却の隙ができる
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.1 },
        speed: 1.4,
        moves: ['opblocksHard', 'tracepathHard', 'satellites', 'reboot', 'shortcircuitHard'],
        combos: [{ moves: ['shortcircuitHard', 'opblocksHard'] }],
        side: { moves: ['tracepath'], every: { min: 10, max: 14 } },
        rest: { after: 3, move: 'vent' },
        announce: 'オーバーヒート',
      },
    ],
  },
  // ---- ここからマップ2「排水区」 ----
  {
    id: 'pipeserpent',
    name: 'パイプサーペント',
    alias: '配管呑み', // 登場時に出す異名
    shape: 'serpent',
    color: 'green',
    weakness: 'shock',
    material: 'serpentCore',
    radius: 34,
    hp: 4600,
    speed: 88,
    contactDamage: 34,
    xp: 240,
    credits: 110,
    drops: { count: 3, rarityBonus: 1 },
    attacks: {
      // 潜行（固有・前からある）：配管に潜って姿を消し、プレイヤーの足元から飛び出す
      burrow: { pattern: 'burrow', dive: 0.5, under: 1.3, lockTime: 0.45, radius: 92, damage: 38, repeat: 1, recover: 1.0 },
      burrowHard: {
        pattern: 'burrow', dive: 0.4, under: 1.1, lockTime: 0.4, radius: 92, damage: 38, repeat: 2, recover: 1.0,
        pool: { radius: 70, arm: 0.2, life: 6, tick: 0.5, damage: 16, slow: true },
      },
      // 固有「とぐろ締め」：プレイヤーを囲む体の輪が、外から縮む。輪の隙間（gap 度）から外へ出る
      coilcrush: { pattern: 'coilcrush', telegraph: 1.0, lockTime: 0.35, r0: 300, rEnd: 60, shrink: 2.5, gap: 50, damage: 38, recover: 0.9 },
      coilcrushHard: { pattern: 'coilcrush', telegraph: 0.9, lockTime: 0.35, r0: 320, rEnd: 60, shrink: 2.0, gap: 42, damage: 38, recover: 0.9 },
      // 固有「配管破裂」：壁の配管が順に漏れ、予告の線のあと、反対の壁まで水柱が噴く
      pipeburst: { pattern: 'pipeburst', telegraph: 0.7, count: 4, gap: 0.55, leak: 0.8, aim: 0.5, width: 44, damage: 36, recover: 0.9 },
      pipeburstHard: { pattern: 'pipeburst', telegraph: 0.6, count: 6, gap: 0.45, leak: 0.7, aim: 0.5, width: 44, damage: 36, recover: 0.9 },
      // 固有「汚水の塊」：汚水の塊を山なりに吐く。落ちた場所に減速の床が残り、小さな塊が3つ、周りへ飛び散って落ちる
      sludgeglob: {
        pattern: 'sludgeglob', telegraph: 0.7, radius: 56, delay: 0.95, damage: 32, recover: 0.8, reach: 'far',
        pool: { radius: 54, arm: 0.2, life: 6, tick: 0.5, damage: 16, slow: true },
        split: { count: 3, dist: 120, radius: 38, delay: 0.65, damage: 24, pool: { radius: 40, arm: 0.2, life: 4, tick: 0.5, damage: 12, slow: true } },
      },
      // 固有「巻きつき」：予告線のあと、体で素早く突っ込む。当たると巻きつかれて、hold 秒のあいだ、tick 秒ごとにダメージ。ダッシュで振りほどける
      grapple: { pattern: 'grapple', telegraph: 0.8, lockTime: 0.25, speed: 700, duration: 0.6, hold: 1.6, tick: 0.8, damage: 30, recover: 1.0, reach: 'far' },
      // 大技「濁流」：水の壁が、部屋を横切る（3回）。配管の柱の真後ろだけが安全
      mudflow: { pattern: 'mudflow', telegraph: 1.8, waves: 3, warn: 1.3, speed: 340, thick: 90, pillars: 3, pillarRadius: 34, damage: 44, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'burrow' }],
    ultimate: { move: 'mudflow', announce: '濁流' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.1, max: 1.8 }, moves: ['burrow', 'coilcrush', 'pipeburst', 'sludgeglob', 'grapple'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.3 },
        moves: ['burrowHard', 'coilcrushHard', 'pipeburstHard', 'sludgeglob', 'grapple'],
        combos: [{ moves: ['grapple', 'sludgeglob'] }, { moves: ['pipeburstHard', 'coilcrushHard'] }],
        side: { moves: ['sludgeglob'], every: { min: 9, max: 13 } },
        announce: '詰まり検知',
      },
    ],
  },
  {
    id: 'tankcrab',
    name: 'タンククラブ',
    alias: '水門の番', // 登場時に出す異名
    shape: 'crab',
    color: 'amber',
    weakness: 'cold',
    material: 'crabCore',
    radius: 46,
    hp: 5600,
    speed: 62,
    contactDamage: 36,
    xp: 300,
    credits: 140,
    drops: { count: 3, rarityBonus: 1 },
    shield: { arc: 170 }, // 甲羅：正面からの武器の攻撃を防ぐ
    turnRate: 1.5, // 向きを変えるのは遅いので、背後に回り込める
    attacks: {
      // 固有「はさみ打ち」：プレイヤーの左右に爪が出て、プレイヤーの場所へ向かって閉じる。爪の線の外（前後）へ出る
      pincerclose: { pattern: 'pincerclose', telegraph: 0.9, lockTime: 0.3, sets: 1, setGap: 0.9, dist0: 190, len: 150, thick: 40, close: 0.8, damage: 40, recover: 1.0, reach: 'near' },
      pincercloseHard: { pattern: 'pincerclose', telegraph: 0.8, lockTime: 0.3, sets: 2, setGap: 0.9, dist0: 190, len: 150, thick: 40, close: 0.75, damage: 40, recover: 1.0, reach: 'near' },
      // 固有「泡の群れ」：壊せる泡が、ゆっくり寄ってくる。触れると破裂する。life 秒で消える
      bubbleswarm: { pattern: 'bubbleswarm', telegraph: 0.7, enemy: 'bubble', count: 6, speed: 60, life: 9, recover: 1.0, reach: 'far' },
      bubbleswarmHard: { pattern: 'bubbleswarm', telegraph: 0.6, enemy: 'bubble', count: 9, speed: 75, life: 9, recover: 0.9, reach: 'far' },
      // 固有「横走り」：横へ素早くずれて、止まるたびに、前方（swing px 先）へ爪を振る
      sidestep: { pattern: 'sidestep', telegraph: 0.65, count: 3, dist: 150, moveT: 0.22, swing: 100, radius: 72, delay: 0.45, hold: 0.55, damage: 38, recover: 1.0 },
      sidestepHard: { pattern: 'sidestep', telegraph: 0.55, count: 4, dist: 160, moveT: 0.2, swing: 100, radius: 72, delay: 0.4, hold: 0.5, damage: 38, recover: 0.9 },
      // 固有「水圧噴射」：甲羅の弁から、十字の水の線が出る。止まっては、turn 度ずつ回る
      jetcross: { pattern: 'jetcross', telegraph: 0.8, steps: 3, stepGap: 0.9, turn: 22.5, width: 30, delay: 0.8, damage: 34, recover: 1.0 },
      jetcrossHard: { pattern: 'jetcross', telegraph: 0.7, steps: 4, stepGap: 0.8, turn: 22.5, width: 30, delay: 0.75, damage: 34, recover: 0.9 },
      // 固有「甲羅転がし」：甲羅にこもって転がり、壁に当たるたびに跳ね返る（bounces 回）。止まったあとは、隙が長い
      rollshell: { pattern: 'rollshell', telegraph: 0.8, lockTime: 0.25, speed: 540, bounces: 3, maxTime: 6, damage: 40, recover: 1.4 },
      // 大技「満潮」：水位が、部屋の一辺から3回上がる。水の中は、減速とダメージ。高台（安全の円）の上だけが助かる
      hightide: { pattern: 'hightide', telegraph: 1.9, pulses: 3, depth: 0.6, warn: 1.3, rise: 0.8, hold: 2.2, drain: 0.6, islands: 3, islandRadius: 70, tick: 0.5, damage: 34, recover: 1.6 },
    },
    reactions: [
      { when: 'behind', seconds: 2.4, move: 'rollshell' },
      { when: 'far', seconds: 4, move: 'bubbleswarm' },
    ],
    ultimate: { move: 'hightide', announce: '満潮' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, moves: ['pincerclose', 'bubbleswarm', 'sidestep', 'jetcross', 'rollshell'] },
      // 甲羅が割れる：防げなくなる代わりに、攻撃が速くなる
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.3 },
        speed: 1.3,
        noShield: true,
        moves: ['pincercloseHard', 'bubbleswarmHard', 'sidestepHard', 'jetcrossHard', 'rollshell'],
        combos: [{ moves: ['sidestepHard', 'pincercloseHard'] }, { moves: ['rollshell', 'jetcrossHard'] }],
        side: { moves: ['jetcross'], every: { min: 10, max: 14 } },
        announce: '甲羅破損',
      },
    ],
  },
  {
    id: 'sludgehydra',
    name: 'スラッジハイドラ',
    alias: '汚泥の多頭', // 登場時に出す異名
    shape: 'hydra',
    color: 'magenta',
    weakness: 'heat',
    material: 'hydraCore',
    radius: 50,
    hp: 5200,
    speed: 26,
    contactDamage: 38,
    xp: 360,
    credits: 180,
    drops: { count: 3, rarityBonus: 2 },
    // 首：3本。体の前側に付いて、弾を吐く。残っている間は、本体へのダメージが 75% 減る
    heads: { enemy: 'hydrahead', count: 3, orbit: 78, reduce: 0.75 },
    attacks: {
      // 固有「分裂」：汚泥のしずくを生む（部屋の雑魚が max 体を超えない範囲で）
      spawn: { pattern: 'sludgesplit', telegraph: 0.7, enemy: 'sludgelet', count: 3, max: 8, recover: 0.7 },
      // 固有「汚泥の噴水」：汚泥を山なりに吐く。落ちた場所に、広がり続ける汚泥の床（半径 radius から rMax まで）が残る
      sludgefount: {
        pattern: 'sludgefount', telegraph: 0.7, count: 4, spread: 150, radius: 46, delay: 0.9, stagger: 0.25, damage: 30, recover: 0.9,
        pool: { radius: 36, rMax: 110, grow: 22, arm: 0.2, life: 7, tick: 0.5, damage: 16, slow: true },
      },
      sludgefountHard: {
        pattern: 'sludgefount', telegraph: 0.6, count: 6, spread: 170, radius: 46, delay: 0.85, stagger: 0.2, damage: 30, recover: 0.8,
        pool: { radius: 36, rMax: 110, grow: 22, arm: 0.2, life: 7, tick: 0.5, damage: 16, slow: true },
      },
      // 固有「首の掃射」：生きている首が、それぞれ、汚泥の線を扇形（arc 度）に掃く。首が倒れているほど、線が減る
      headsweep: { pattern: 'headsweep', telegraph: 0.7, warn: 0.7, sweepT: 1.8, arc: 90, width: 16, damage: 30, recover: 1.0 },
      headsweepHard: { pattern: 'headsweep', telegraph: 0.6, warn: 0.6, sweepT: 1.5, arc: 120, width: 16, damage: 30, recover: 0.9 },
      // 固有「泥沼」：中心へ、少しずつ引き込まれる床（pull px/秒）。中心（core px）に近いとダメージ
      bogs: { pattern: 'bogs', telegraph: 0.7, count: 3, radius: 90, core: 24, arm: 0.8, life: 8, pull: 70, tick: 0.5, damage: 20, recover: 0.9 },
      // 固有「首の絡み」：首が1本、プレイヤーへ絡みつく（減速、ダッシュできない）。その首を倒せば解ける。hold 秒で解けないと、引き寄せられて叩かれる
      entangle: { pattern: 'entangle', telegraph: 0.8, range: 420, hold: 2.0, damage: 36, recover: 1.0 },
      // 大技「大再生」：倒された首の根元が光り、順に（gap 秒ごとに）首が生え直す。根元を壊せば、その首は止まる。生え直るたびに、HP が heal の割合だけ回復する
      regrowth: { pattern: 'regrowth', telegraph: 1.2, root: 'root', first: 1.0, gap: 0.8, heal: 0.04, volleys: 3, volleyGap: 0.8, ring: 8, shotSpeed: 200, shotDamage: 28, recover: 1.5 },
    },
    ultimate: { move: 'regrowth', announce: '大再生' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.2, max: 1.9 }, moves: ['sludgefount', 'headsweep', 'bogs', 'entangle', 'spawn'] },
      // 再生：倒された首が、時間で生え直す
      {
        hpAbove: 0,
        idle: { min: 0.9, max: 1.4 },
        regrow: 9,
        moves: ['sludgefountHard', 'headsweepHard', 'bogs', 'entangle', 'spawn'],
        combos: [{ moves: ['bogs', 'sludgefountHard'] }, { moves: ['entangle', 'headsweepHard'] }],
        side: { moves: ['sludgefount'], every: { min: 10, max: 14 } },
        announce: '再生開始',
      },
    ],
  },
  // ---- ここからマップ3「建設区」 ----
  {
    id: 'scraphound',
    name: 'スクラップハウンド',
    alias: '資材喰い', // 登場時に出す異名
    shape: 'hound',
    color: 'red',
    weakness: 'cold',
    material: 'houndCore',
    radius: 34,
    hp: 7400,
    speed: 128,
    contactDamage: 40,
    xp: 400,
    credits: 200,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 磁力（固有・前からある）：引き寄せてから、周りを叩く
      magnet: { pattern: 'magnet', telegraph: 0.6, duration: 2.6, strength: 130, radius: 135, damage: 46, recover: 1.1 },
      magnetHard: { pattern: 'magnet', telegraph: 0.5, duration: 2.4, strength: 175, radius: 150, damage: 46, recover: 1.0 },
      // 刃の渦（固有・前からある）：鉄くずの刃を体のまわりで回しながら、追いかけてくる。当たると裂傷（持続ダメージ）
      shred: { pattern: 'orbit', telegraph: 0.7, duration: 3.2, count: 3, radius: 92, bladeRadius: 16, spin: 200, chase: 0.75, damage: 30, dot: 'bleed', recover: 0.9 },
      shredHard: { pattern: 'orbit', telegraph: 0.6, duration: 3.6, count: 4, radius: 96, bladeRadius: 16, spin: 230, chase: 0.9, damage: 30, dot: 'bleed', recover: 0.9 },
      // 固有「跳ね鉄くず」：鉄くずを扇形に投げる。壁に当たるたびに跳ね返る（bounces 回まで）
      junkbounce: { pattern: 'junkbounce', telegraph: 0.65, lockTime: 0.2, count: 6, spread: 70, speed: 340, radius: 14, bounces: 3, damage: 30, recover: 0.8, reach: 'far' },
      junkbounceHard: { pattern: 'junkbounce', telegraph: 0.55, lockTime: 0.2, count: 9, spread: 90, speed: 370, radius: 14, bounces: 3, damage: 30, recover: 0.8, reach: 'far' },
      // 固有「三連噛み」：3回続けて噛みつきの突進。通った道に、鉄くずのトゲが残る（踏むとダメージ）
      triplebite: { pattern: 'triplebite', telegraph: 0.6, repeatTelegraph: 0.35, lockTime: 0.18, count: 3, speed: 700, duration: 0.5, damage: 42, spikeEvery: 0.07, spike: { radius: 16, arm: 0.25, life: 4, tick: 0.5, damage: 14 }, recover: 0.9, reach: 'far' },
      // 固有「鉄くずの山」：壊せる山が出て、fuse 秒後に、十字に破片を飛ばして爆発する。先に壊せば、爆発しない
      junkpile: { pattern: 'junkpile', telegraph: 0.7, count: 4, pile: 'junkpile', fuse: 2.5, radius: 56, damage: 34, shotSpeed: 320, shotDamage: 26, recover: 0.9 },
      // 大技「鉄くず嵐」：鉄くずの列（隙間 gaps か所）が、部屋を横切る（waves 回）。そのあいだ、ボスのほうへ弱く引かれる
      junkstorm: { pattern: 'junkstorm', telegraph: 1.8, waves: 3, warn: 1.2, speed: 380, gaps: 2, gapLength: 100, pieceSpacing: 44, pieceRadius: 16, damage: 44, pull: 90, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'triplebite' }],
    ultimate: { move: 'junkstorm', announce: '鉄くず嵐' },
    phases: [
      { hpAbove: 0.5, idle: { min: 0.9, max: 1.5 }, moves: ['magnet', 'shred', 'junkbounce', 'triplebite', 'junkpile'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.1 },
        speed: 1.2,
        moves: ['magnetHard', 'shredHard', 'junkbounceHard', 'triplebite', 'junkpile'],
        combos: [{ moves: ['triplebite', 'junkbounceHard'] }, { moves: ['magnetHard', 'junkpile'] }],
        announce: '不足検知',
      },
    ],
  },
  {
    id: 'girderspider',
    name: 'ガーダースパイダー',
    alias: '橋げた張り', // 登場時に出す異名
    shape: 'spider',
    color: 'ice',
    weakness: 'heat',
    material: 'spiderCore',
    radius: 40,
    hp: 8200,
    speed: 92,
    contactDamage: 40,
    xp: 440,
    credits: 220,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 張り糸（固有・前からある）：部屋を横切る糸を張る。しばらく残り、触れている間は減速とダメージ
      wires: { pattern: 'wires', telegraph: 0.5, count: 3, spread: 130, arm: 0.9, life: 7, width: 10, damage: 18, tick: 0.5, recover: 0.7 },
      wiresHard: { pattern: 'wires', telegraph: 0.4, count: 5, spread: 170, arm: 0.8, life: 8, width: 10, damage: 18, tick: 0.5, recover: 0.6 },
      // 橋げた（固有・前からある。アーキテクトの「図面展開」をやめたので、スパイダー専用）：部屋を横切る壁を張る
      girder: { pattern: 'girder', telegraph: 1.0, lines: 2, offset: 110, spacing: 34, gap: 96, gaps: 2, max: 46, post: 'girderpost', recover: 0.8 },
      girderHard: { pattern: 'girder', telegraph: 0.8, lines: 3, offset: 100, spacing: 34, gap: 90, gaps: 2, max: 60, post: 'girderpost', recover: 0.7 },
      // 固有「毒針」：針を3本、プレイヤーへ撃つ。止まった場所に、毒の床（腐食）が残る
      needles: { pattern: 'needles', telegraph: 0.6, count: 3, spread: 28, speed: 540, damage: 30, pool: { radius: 40, arm: 0.2, life: 5, tick: 0.5, damage: 12, dot: 'corrode' }, recover: 0.8, reach: 'far' },
      // 固有「八本脚」：プレイヤーを中心に、脚が8本（後半は12本）、順に突き出る（予告の細い線のあと）。突かれる方向の間に立つ
      eightlegs: { pattern: 'eightlegs', telegraph: 1.0, lockTime: 0.35, legs: 8, gap: 0.16, flash: 0.22, length: 280, width: 18, damage: 44, recover: 0.9, reach: 'near' },
      eightlegsHard: { pattern: 'eightlegs', telegraph: 0.9, lockTime: 0.35, legs: 12, gap: 0.12, flash: 0.22, length: 280, width: 18, damage: 44, recover: 0.8, reach: 'near' },
      // 固有「卵」：壊せる卵が出る。hatch 秒で孵化して、子蜘蛛が perEgg 匹ずつ出る。先に壊せば出ない
      eggs: { pattern: 'eggs', telegraph: 0.7, count: 3, egg: 'egg', hatch: 5, spawn: 'spiderling', perEgg: 2, recover: 0.8 },
      // 大技「蜘蛛の巣」：糸の列が、向きを変えながら3回張られる（lines 本ずつ）。糸に触れると減速とダメージ。糸と糸のあいだを抜ける
      webweave: { pattern: 'webweave', telegraph: 1.8, waves: 3, waveGap: 2.4, lines: 5, spacing: 120, arm: 0.9, life: 6, damage: 22, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'needles' }],
    ultimate: { move: 'webweave', announce: '蜘蛛の巣' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['wires', 'girder', 'needles', 'eightlegs', 'eggs'] },
      {
        hpAbove: 0,
        idle: { min: 0.8, max: 1.2 },
        moves: ['wiresHard', 'girderHard', 'needles', 'eightlegsHard', 'eggs'],
        combos: [{ moves: ['needles', 'eightlegsHard'] }, { moves: ['wiresHard', 'girderHard'] }],
        side: { moves: ['eggs'], every: { min: 13, max: 17 } },
        announce: '架設続行',
      },
    ],
  },
  {
    id: 'cranetitan',
    name: 'クレーンタイタン',
    alias: '未完の巨人', // 登場時に出す異名
    shape: 'titan',
    color: 'heat',
    weakness: 'shock',
    material: 'titanCore',
    radius: 58,
    hp: 9600,
    speed: 0, // 本体は動かない
    contactDamage: 44,
    xp: 520,
    credits: 260,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 溶接ビーム（固有・前からある）：ビームがゆっくり追ってくる。当たると炎上。通ったあとに燃える床が残る
      weld: { pattern: 'weld', telegraph: 0.9, duration: 3.2, turn: 38, width: 26, range: 900, damage: 40, dot: 'burn', trail: { every: 0.35, radius: 34, arm: 0.15, life: 4, tick: 0.5, damage: 10 }, recover: 1.0 },
      weldHard: { pattern: 'weld', telegraph: 0.75, duration: 4, turn: 46, width: 26, range: 900, damage: 40, dot: 'burn', trail: { every: 0.3, radius: 34, arm: 0.15, life: 5, tick: 0.5, damage: 10 }, recover: 0.9 },
      // 振り子（固有・前からある）：吊ったフックが、部屋を行ったり来たりする
      swing: { pattern: 'pendulum', telegraph: 1.0, lines: 1, passes: 3, period: 1.5, radius: 36, damage: 46, recover: 0.6 },
      swingHard: { pattern: 'pendulum', telegraph: 0.8, lines: 2, passes: 4, period: 1.3, radius: 36, damage: 46, recover: 0.5 },
      // 固有「鉄骨落とし」：長い鉄骨が、向きを変えながら、順に落ちる（予告の影のあと）。1本目はプレイヤーの足元
      beamdrop: { pattern: 'beamdrop', telegraph: 0.7, count: 5, spread: 200, length: 260, width: 44, stagger: 0.35, warn: 0.9, damage: 46, recover: 0.9 },
      beamdropHard: { pattern: 'beamdrop', telegraph: 0.6, count: 8, spread: 230, length: 260, width: 44, stagger: 0.25, warn: 0.85, damage: 46, recover: 0.8 },
      // 固有「クレーン旋回」：長い腕（length px）が、ボスを中心に、turns 周ゆっくり回る。腕の根元（inner px 以内）は届かず、安全
      cranespin: { pattern: 'cranespin', telegraph: 0.8, speed: 1.5, turns: 1.5, inner: 120, length: 420, width: 22, ball: 26, warn: 0.8, damage: 48, recover: 1.0 },
      cranespinHard: { pattern: 'cranespin', telegraph: 0.7, speed: 1.9, turns: 2, inner: 120, length: 420, width: 22, ball: 26, warn: 0.7, damage: 48, recover: 0.9 },
      // 固有「鋲打ち」：鋲を一直線に撃ち込む。床に刺さって、fuse 秒後に、十字に火花を飛ばして爆ぜる
      rivetgun: { pattern: 'rivetgun', telegraph: 0.7, count: 5, spread: 60, speed: 520, fuse: 1.4, radius: 48, damage: 34, sparkSpeed: 300, sparkDamage: 26, sparkLife: 1.3, recover: 0.9 },
      rivetgunHard: { pattern: 'rivetgun', telegraph: 0.6, count: 7, spread: 80, speed: 540, fuse: 1.3, radius: 48, damage: 34, sparkSpeed: 320, sparkDamage: 26, sparkLife: 1.3, recover: 0.8 },
      // 大技「全層崩落」：鉄骨が3波続けて落ち、そのあいだ、クレーンの腕が回り続ける
      collapse: {
        pattern: 'collapse', telegraph: 1.8, waves: 3, waveGap: 2.2, recover: 1.5,
        arm: { speed: 1.5, turns: 2.5, inner: 120, length: 420, width: 22, ball: 26, warn: 0.8, damage: 48 },
        beams: { count: 4, spread: 200, length: 260, width: 44, stagger: 0.4, warn: 0.9, damage: 46 },
      },
    },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['weld', 'swing', 'beamdrop', 'cranespin', 'rivetgun'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['weldHard', 'swingHard', 'beamdropHard', 'cranespinHard', 'rivetgunHard'],
        combos: [{ moves: ['beamdropHard', 'cranespinHard'] }, { moves: ['rivetgunHard', 'weldHard'] }],
        side: { moves: ['swing'], every: { min: 10, max: 14 } },
        announce: '増築再開',
      },
    ],
    ultimate: { move: 'collapse', announce: '全層崩落' },
  },
  // ---- ここからマップ4「停電区」 ----
  {
    id: 'lampeater',
    name: 'ランプイーター',
    alias: '灯り喰い', // 登場時に出す異名
    shape: 'moth',
    color: 'magenta',
    weakness: 'heat',
    material: 'mothCore',
    radius: 40,
    hp: 11000,
    speed: 82,
    contactDamage: 46,
    xp: 600,
    credits: 300,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 消灯（固有・前からある）：非常灯を消して、暗闇の中で突進する
      douse: {
        pattern: 'douse', telegraph: 1.0, breakTime: 14, reposition: { distance: 250, time: 0.45 },
        lunges: 1, lungeTelegraph: 0.6, lockTime: 0.2, speed: 640, duration: 0.55, damage: 50, wallStun: 1.2, recover: 0.8,
      },
      douseHard: {
        pattern: 'douse', telegraph: 0.9, breakTime: 14, reposition: { distance: 250, time: 0.4 },
        lunges: 2, lungeTelegraph: 0.5, lockTime: 0.18, speed: 680, duration: 0.55, damage: 50, wallStun: 1.2, recover: 0.8,
      },
      // 鱗粉（固有・前からある）：鱗粉の雲をまく。中にいると「目くらみ」
      scales: { pattern: 'scales', telegraph: 0.6, count: 3, radius: 62, spread: 120, arm: 0.6, life: 6, recover: 0.6 },
      scalesHard: { pattern: 'scales', telegraph: 0.5, count: 5, radius: 62, spread: 160, arm: 0.5, life: 7, recover: 0.6 },
      // 固有「灯り目がけ」：点いている灯りを順に狙って突っ込み、壊す（count か所まで）。点いている灯りがなければ、プレイヤーを狙う
      lamptarget: { pattern: 'lamptarget', telegraph: 0.7, lockTime: 0.2, repeatTelegraph: 0.4, count: 1, speed: 680, duration: 0.9, damage: 50, breakTime: 14, recover: 0.7, reach: 'far' },
      lamptargetHard: { pattern: 'lamptarget', telegraph: 0.6, lockTime: 0.2, repeatTelegraph: 0.35, count: 3, speed: 700, duration: 0.9, damage: 50, breakTime: 14, recover: 0.7, reach: 'far' },
      // 固有「羽ばたきの風」：両羽根から、斜めの風の線が4本、波になって走る（waves 回。波ごとに向きがずれる）
      windflap: { pattern: 'windflap', telegraph: 0.8, waves: 2, stagger: 0.6, width: 34, delay: 0.8, damage: 36, recover: 0.8, reach: 'near' },
      windflapHard: { pattern: 'windflap', telegraph: 0.7, waves: 3, stagger: 0.5, width: 34, delay: 0.75, damage: 36, recover: 0.7, reach: 'near' },
      // 固有「光の鱗」：壊せる光る鱗が、ゆっくり寄ってくる。壊すと、その場所が明るくなる。触れると破裂する
      glowscales: { pattern: 'glowscales', telegraph: 0.55, enemy: 'glowscale', count: 4, speed: 70, life: 8, recover: 0.6, reach: 'far' },
      glowscalesHard: { pattern: 'glowscales', telegraph: 0.5, enemy: 'glowscale', count: 6, speed: 85, life: 8, recover: 0.6, reach: 'far' },
      // 大技「全消灯」（固有・前からある）
      blackout: {
        pattern: 'douse', telegraph: 1.3, breakAll: true, breakTime: 22, blind: true, reposition: { distance: 240, time: 0.4 },
        lunges: 4, lungeTelegraph: 0.55, lockTime: 0.18, speed: 680, duration: 0.5, damage: 52, wallStun: 1.6, recover: 1.5,
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'lamptarget' }],
    ultimate: { move: 'blackout', announce: '全消灯' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['douse', 'scales', 'lamptarget', 'windflap', 'glowscales'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['douseHard', 'scalesHard', 'lamptargetHard', 'windflapHard', 'glowscalesHard'],
        combos: [{ moves: ['scalesHard', 'lamptargetHard'] }, { moves: ['windflapHard', 'glowscalesHard'] }],
        announce: '灯りを寄こせ',
      },
    ],
  },
  {
    id: 'sentinel',
    name: 'サーチライト・センチネル',
    alias: '照射番', // 登場時に出す異名
    shape: 'sentinel',
    color: 'amber',
    weakness: 'shock',
    material: 'lensCore',
    radius: 42,
    hp: 12500,
    speed: 58,
    contactDamage: 46,
    xp: 640,
    credits: 320,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 照射（固有・前からある）
      beam: {
        pattern: 'searchlight', telegraph: 0.9, count: 1, arc: 46, range: 1100, spin: 0.55, life: 14, need: 0.8, decay: 0.4,
        snipe: { aim: 0.75, lock: 0.25, width: 14, range: 1100, damage: 46, interval: 1.2 }, recover: 0.5,
      },
      beamHard: {
        pattern: 'searchlight', telegraph: 0.8, count: 2, arc: 46, range: 1100, spin: 0.6, life: 15, need: 0.8, decay: 0.4,
        snipe: { aim: 0.65, lock: 0.22, width: 14, range: 1100, damage: 46, interval: 1.0 }, recover: 0.5,
      },
      // 閃光（固有・前からある）
      flare: { pattern: 'flare', telegraph: 1.2, count: 1, gap: 0, facing: 70, blind: 6, light: 1400, lightLife: 2.5, recover: 0.7 },
      flareHard: { pattern: 'flare', telegraph: 1.2, count: 2, gap: 0.75, facing: 70, blind: 6, light: 1400, lightLife: 2.5, recover: 0.7 },
      // 固有「探照の掃き」：2つの光が、プレイヤーのまわりを回りながら、重なる点を作る。重なった点に、interval 秒ごとに、狙撃が落ちる
      sweeplights: { pattern: 'sweeplights', telegraph: 0.8, warm: 1.2, duration: 6, orbit: 150, spin: 1.3, interval: 0.9, strike: { radius: 54, delay: 0.6, damage: 44 }, recover: 0.8, reach: 'far' },
      sweeplightsHard: { pattern: 'sweeplights', telegraph: 0.7, warm: 1.0, duration: 7, orbit: 170, spin: 1.5, interval: 0.7, strike: { radius: 54, delay: 0.55, damage: 44 }, recover: 0.8, reach: 'far' },
      // 固有「閃光の輪」：目くらましの輪が、ボスから広がる。帯に触れると、ダメージと目くらみ
      flashring: { pattern: 'flashring', telegraph: 0.8, count: 1, gap: 0.9, speed: 300, max: 420, width: 36, damage: 30, blind: 2.5, recover: 0.8, reach: 'near' },
      flashringHard: { pattern: 'flashring', telegraph: 0.7, count: 3, gap: 0.8, speed: 330, max: 440, width: 36, damage: 30, blind: 2.5, recover: 0.7, reach: 'near' },
      // 大技「全照射」（固有・前からある）
      fullbeam: { pattern: 'searchlight', telegraph: 1.7, count: 4, arc: 36, range: 1100, spin: 0.6, life: 9, touch: 40, hold: true, recover: 1.6 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'sweeplights' }],
    ultimate: { move: 'fullbeam', announce: '全照射' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['beam', 'flare', 'sweeplights', 'flashring'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['beamHard', 'flareHard', 'sweeplightsHard', 'flashringHard', 'beam'],
        combos: [{ moves: ['flareHard', 'sweeplightsHard'] }, { moves: ['flashringHard', 'beamHard'] }],
        announce: '侵入者、捕捉',
      },
    ],
  },
  {
    id: 'breaker',
    name: 'ブレーカー',
    alias: '主幹遮断器', // 登場時に出す異名
    shape: 'breaker',
    color: 'cyan',
    weakness: 'cold',
    material: 'breakerCore',
    radius: 42,
    hp: 14000,
    speed: 70,
    contactDamage: 48,
    xp: 680,
    credits: 340,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 停電（固有・前からある）
      cutoff: {
        pattern: 'blackout', telegraph: 1.0, duration: 4, vision: 0.6,
        strikes: { first: 0.5, interval: 0.7, spread: 70, radius: 50, delay: 0.85, damage: 44 }, surge: 3, overload: 2, recover: 0.3,
      },
      cutoffHard: {
        pattern: 'blackout', telegraph: 0.9, duration: 5.5, vision: 0.6,
        strikes: { first: 0.4, interval: 0.55, spread: 80, radius: 50, delay: 0.8, damage: 44 }, surge: 3, overload: 2, recover: 0.3,
      },
      // 残像（固有・前からある）
      mirage: {
        pattern: 'afterimage', telegraph: 0.8, count: 3, rounds: 1, decoy: 'afterimage', distance: 250,
        aim: 0.9, lockTime: 0.25, speed: 620, duration: 0.55, damage: 50, decoyDamage: 24, recover: 0.9,
      },
      mirageHard: {
        pattern: 'afterimage', telegraph: 0.7, count: 5, rounds: 2, decoy: 'afterimage', distance: 250,
        aim: 0.85, lockTime: 0.22, speed: 640, duration: 0.55, damage: 50, decoyDamage: 24, recover: 0.9,
      },
      // 固有「短絡」：配線の交差点が、count か所、順に光り、そのたびに電気が走る
      shortout: { pattern: 'shortout', telegraph: 0.7, count: 5, radius: 58, delay: 0.9, stagger: 0.4, damage: 44, recover: 0.7 },
      shortoutHard: { pattern: 'shortout', telegraph: 0.6, count: 7, radius: 58, delay: 0.85, stagger: 0.32, damage: 44, recover: 0.6 },
      // 固有「遮断の腕」：扇形の遮断器が、プレイヤーのほうで閉じる（刃が両端から寄る）。扇の外へ出る
      cutterarm: { pattern: 'cutterarm', telegraph: 1.0, lockTime: 0.3, wedges: 1, wedgeGap: 0.9, arc: 120, radius: 230, damage: 50, recover: 0.8, reach: 'near' },
      cutterarmHard: { pattern: 'cutterarm', telegraph: 0.9, lockTime: 0.3, wedges: 2, wedgeGap: 0.8, arc: 110, radius: 240, damage: 50, recover: 0.7, reach: 'near' },
      // 固有「過負荷突進」：壁から壁へ、プレイヤーを通る直線を、一気に走る（予告の線のとおり。最後の lockTime 秒だけ、線が止まる）
      railrush: { pattern: 'railrush', telegraph: 1.0, lockTime: 0.25, speed: 900, damage: 52, recover: 0.8, reach: 'far' },
      // 大技「全系統遮断」（固有・前からある）
      shutdown: {
        pattern: 'afterimage', telegraph: 1.6, count: 6, rounds: 3, decoy: 'afterimage', distance: 260,
        aim: 0.9, lockTime: 0.22, speed: 640, duration: 0.55, damage: 52, decoyDamage: 26,
        blackout: { duration: 12, vision: 0.6 }, surge: 4, recover: 2.2,
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'railrush' }],
    ultimate: { move: 'shutdown', announce: '全系統遮断' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['cutoff', 'mirage', 'shortout', 'cutterarm', 'railrush'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['cutoffHard', 'mirageHard', 'shortoutHard', 'cutterarmHard', 'railrush'],
        combos: [{ moves: ['cutterarmHard', 'railrush'] }, { moves: ['shortoutHard', 'mirageHard'] }],
        announce: '過負荷',
      },
    ],
  },
  // ---- ここからマップ5「溶解区」 ----
  {
    id: 'rusteater',
    name: 'ラストイーター',
    alias: '錆び喰い', // 登場時に出す異名
    shape: 'rusteater',
    color: 'heat',
    weakness: 'corrode',
    material: 'rustCore',
    radius: 44,
    hp: 15000,
    speed: 76,
    contactDamage: 50,
    xp: 720,
    credits: 360,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「溶解」：床が溶けて、酸の穴になる。穴は、ボスを倒すまで消えない。count 個ずつ増えて、全部で max 個まで
      melt: { pattern: 'melt', telegraph: 0.9, count: 2, max: 7, radius: 52, spread: 110, arm: 0.6, tick: 0.5, damage: 18, recover: 0.6 },
      meltHard: { pattern: 'melt', telegraph: 0.8, count: 3, max: 10, radius: 52, spread: 130, arm: 0.5, tick: 0.5, damage: 18, recover: 0.6 },
      // 固有「噛みつき」：予告線つきの突進。当たると「錆」（rust：duration 秒のあいだ、与えるダメージが amount の割合だけ下がる）
      gnaw: { pattern: 'gnaw', telegraph: 0.7, lockTime: 0.2, speed: 660, duration: 0.6, damage: 52, rust: { amount: 0.3, duration: 5 }, wallStun: 1.3, recover: 0.7, reach: 'far' },
      // 固有「鉄片散らし」：歯の欠けた歯車の破片が、跳ねながら飛ぶ（bounces 回跳ねる）。当たると「錆」
      scrapfling: { pattern: 'scrapfling', telegraph: 0.7, lockTime: 0.2, count: 5, spread: 70, speed: 300, radius: 16, bounces: 2, damage: 36, rust: { amount: 0.3, duration: 5 }, recover: 0.7, reach: 'far' },
      scrapflingHard: { pattern: 'scrapfling', telegraph: 0.6, lockTime: 0.2, count: 7, spread: 90, speed: 330, radius: 16, bounces: 3, damage: 38, rust: { amount: 0.3, duration: 5 }, recover: 0.7, reach: 'far' },
      // 固有「錆の波」：ボスから広がる錆の帯。通った場所に、drops 個ずつ、錆の床（pool）が残る
      rustwave: { pattern: 'rustwave', telegraph: 0.9, speed: 300, max: 560, width: 22, damage: 44, drops: 5, pool: { radius: 46, arm: 0.5, life: 6, tick: 0.5, damage: 16 }, recover: 0.8, reach: 'near' },
      // 固有「噛み砕き」：あごが2つ、プレイヤーの両側から閉じる（真ん中の細いすき間だけが安全）
      jawsnap: { pattern: 'jawsnap', telegraph: 0.95, lockTime: 0.3, arc: 70, radius: 200, spread: 58, damage: 56, recover: 0.8, reach: 'near' },
      // 大技「大溶解」：部屋の外まわりが、ぐるりと酸の穴になる（rx・ry は、部屋の真ん中からの距離）。同時に、雨が rain 秒降る
      meltdown: { pattern: 'melt', telegraph: 1.7, ring: { count: 12, rx: 330, ry: 150 }, max: 99, radius: 62, arm: 0.6, tick: 0.5, damage: 20, rain: 6, recover: 1.4 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'gnaw' }],
    ultimate: { move: 'meltdown', announce: '大溶解' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['melt', 'gnaw', 'scrapfling', 'rustwave', 'jawsnap'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['meltHard', 'gnaw', 'scrapflingHard', 'rustwave', 'jawsnap'],
        combos: [{ moves: ['meltHard', 'gnaw'] }, { moves: ['rustwave', 'scrapflingHard'] }],
        announce: '錆を、寄こせ',
      },
    ],
  },
  {
    id: 'buffertank',
    name: 'バッファータンク',
    alias: '中和槽', // 登場時に出す異名
    shape: 'tank',
    color: 'ice',
    weakness: null, // 弱点は、体の色（attune）で切り替わる
    material: 'bufferCore',
    radius: 46,
    hp: 16500,
    speed: 62,
    contactDamage: 50,
    xp: 760,
    credits: 380,
    drops: { count: 3, rarityBonus: 2 },
    // 体の色（＝今の弱点）が、every 秒ごとに切り替わる。telegraph 秒前から、次の色の輪が出る。
    //   属性は付いているが色に合わない攻撃は、resist 倍になる。大技のあとは、frenzyEvery 秒ごとに切り替わる
    attune: { elements: ['shock', 'heat', 'cold', 'corrode'], every: 9, telegraph: 1.5, resist: 0.6, frenzyEvery: 3 },
    attacks: {
      // 固有「放出」：今の色に合わせた攻撃を出す（属性ごとに、ほかの部品の数値で書く）
      emit: {
        pattern: 'emit',
        byElement: {
          shock: { pattern: 'colorjets', telegraph: 0.6, count: 4, gap: 0.45, leak: 0.7, aim: 0.8, width: 34, damage: 46, recover: 0.6 },
          heat: { pattern: 'emberpools', telegraph: 0.7, count: 4, radius: 58, spread: 130, arm: 0.6, life: 5, tick: 0.5, damage: 16, recover: 0.6 },
          cold: { pattern: 'frostspiral', telegraph: 0.6, arms: 4, shots: 30, gap: 0.1, turn: 11, speed: 230, damage: 32, recover: 0.6 },
          corrode: { pattern: 'acidpools', telegraph: 0.7, count: 3, radius: 70, spread: 150, arm: 0.6, life: 7, tick: 0.5, damage: 14, recover: 0.6 },
        },
      },
      // 固有「飽和」：色の印が3つ並び、その順番で「放出」を続けて出す
      saturate: { pattern: 'saturate', telegraph: 1.4, sequence: 3, move: 'emit' },
      // 固有「中和の渦」：色の違う渦が2つ、プレイヤーをはさんで現れ、近づく。引き込まれる（ダッシュ中は引かれない）。ぶつかると大きく爆ぜる
      neutralvortex: { pattern: 'neutralvortex', telegraph: 0.9, pairs: 1, radius: 70, core: 26, arm: 0.7, life: 7, drift: 55, pull: 130, damage: 20, burstRadius: 150, burstDamage: 58, recover: 0.8, reach: 'far' },
      neutralvortexHard: { pattern: 'neutralvortex', telegraph: 0.8, pairs: 2, radius: 70, core: 26, arm: 0.7, life: 7, drift: 60, pull: 140, damage: 20, burstRadius: 150, burstDamage: 58, recover: 0.8, reach: 'far' },
      // 固有「槽の突進」：壁ぎわを、角を3つ曲がって走る。角に、今の色の床が残る
      // 固有「排水の輪」：ボスのまわりに、予告の円が輪になって並ぶ（rings の半径ごと）。内側の輪から順に落ちる
      flushring: { pattern: 'flushring', telegraph: 0.8, rings: [130, 230, 330], perRing: 6, radius: 48, delay: 0.9, stagger: 0.45, damage: 46, recover: 0.8, reach: 'near' },
      tankrun: { pattern: 'tankrun', telegraph: 0.9, speed: 560, damage: 52, pool: { radius: 54, arm: 0.5, life: 6, tick: 0.5, damage: 14 }, recover: 1.1, reach: 'far' },
      // 大技「全属性飽和」：4つの色すべての「放出」を続けて出す。そのあと frenzy 秒のあいだ、色の切り替わりが速くなる
      overflow: { pattern: 'saturate', telegraph: 1.8, sequence: 4, move: 'emit', frenzy: 12 },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'tankrun' }],
    ultimate: { move: 'overflow', announce: '全属性飽和' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['emit', 'saturate', 'neutralvortex', 'tankrun', 'flushring'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['emit', 'saturate', 'neutralvortexHard', 'tankrun', 'flushring'],
        combos: [{ moves: ['tankrun', 'neutralvortexHard'] }, { moves: ['emit', 'emit'] }],
        announce: '中和、開始',
      },
    ],
  },
  {
    id: 'rainmaker',
    name: 'レインメーカー',
    alias: '雨降らし', // 登場時に出す異名
    shape: 'rainmaker',
    color: 'green',
    weakness: 'shock',
    material: 'rainCore',
    radius: 44,
    hp: 18000,
    speed: 60,
    contactDamage: 52,
    xp: 800,
    credits: 400,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「瓦落とし」：屋根を count 個崩す（breakTime 秒のあいだ使えない）。崩れた瞬間に下にいると、damage
      unroof: { pattern: 'unroof', telegraph: 1.2, count: 1, breakTime: 20, damage: 44, recover: 0.6 },
      unroofHard: { pattern: 'unroof', telegraph: 1.1, count: 2, breakTime: 20, damage: 44, recover: 0.6 },
      // 固有「雨雲」：プレイヤーを追う雨雲を呼ぶ。真下に雨が降り、strike.every 秒ごとに、雲の真下に落雷（delay は予告の時間）
      cloud: { pattern: 'stormcloud', telegraph: 0.8, count: 1, radius: 84, speed: 82, life: 10, strike: { every: 2.5, delay: 0.85, radius: 56, damage: 46 }, recover: 0.5 },
      cloudHard: { pattern: 'stormcloud', telegraph: 0.7, count: 2, radius: 84, speed: 88, life: 11, strike: { every: 2.3, delay: 0.8, radius: 56, damage: 46 }, recover: 0.5 },
      // 固有「雷の網」：プレイヤーの足元を含む点を、電撃の線で結ぶ。予告（warn 秒）のあと、一瞬だけ当たる（屋根でも防げない）
      thundernet: { pattern: 'thundernet', telegraph: 0.7, points: 4, closed: false, warn: 1.1, width: 26, damage: 48, recover: 0.8, reach: 'far' },
      thundernetHard: { pattern: 'thundernet', telegraph: 0.6, points: 5, closed: true, warn: 1.05, width: 26, damage: 50, recover: 0.8, reach: 'far' },
      // 固有「降雨の波」：雨の帯が、部屋の一辺から反対側へ降り進む。帯の中で、屋根の外にいると当たる
      rainfront: { pattern: 'rainfront', telegraph: 0.9, waves: 2, warn: 1.0, speed: 260, thick: 150, tick: 0.4, damage: 30, recover: 0.8, reach: 'far' },
      rainfrontHard: { pattern: 'rainfront', telegraph: 0.8, waves: 3, warn: 0.9, speed: 300, thick: 160, tick: 0.4, damage: 32, recover: 0.8, reach: 'far' },
      // 固有「雷線」：雷が、直線に並んで、端から順に落ちる
      lightningline: { pattern: 'lightningline', telegraph: 0.6, lines: 1, count: 8, step: 90, radius: 44, delay: 0.7, stagger: 0.12, lineGap: 0.4, damage: 46, recover: 0.7, reach: 'far' },
      lightninglineHard: { pattern: 'lightningline', telegraph: 0.5, lines: 2, count: 8, step: 90, radius: 44, delay: 0.7, stagger: 0.12, lineGap: 0.5, damage: 46, recover: 0.7, reach: 'far' },
      // 大技「豪雨」：すべての屋根を崩し、雨を rain 秒降らせ、雨雲を2つ呼ぶ
      downpour: {
        pattern: 'unroof', telegraph: 1.8, all: true, breakTime: 14, damage: 46, rain: 12,
        clouds: { count: 2, radius: 84, speed: 86, life: 12, strike: { every: 2.4, delay: 0.85, radius: 56, damage: 46 } }, recover: 1.4,
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'thundernet' }],
    ultimate: { move: 'downpour', announce: '豪雨' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['unroof', 'cloud', 'thundernet', 'rainfront', 'lightningline'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['unroofHard', 'cloudHard', 'thundernetHard', 'rainfrontHard', 'lightninglineHard'],
        combos: [{ moves: ['cloudHard', 'lightninglineHard'] }, { moves: ['rainfrontHard', 'thundernetHard'] }],
        announce: '降雨量、最大',
      },
    ],
  },
  // ---- マップ5の隠しボス（docs/詳細仕様.md「28. マップ5」の「隠しボス「カタリスト」」）。出し方は、マップの定義（secretBoss.rule）----
  {
    id: 'catalyst',
    name: 'カタリスト',
    alias: '触媒', // 登場時に出す異名
    hidden: true,
    bgm: 'bossCatalyst', // この隠しボスだけの曲
    shape: 'catalyst',
    color: 'ink',
    weakness: null,
    material: 'catalystCore', // 倒すたびに1個
    radius: 40,
    hp: 19500,
    speed: 92,
    contactDamage: 52,
    xp: 840,
    credits: 420,
    drops: { count: 3, rarityBonus: 2, minRarity: 2 }, // 装備は、エピック以上を保証
    comms: {
      intro: [
        '@noise＞ ……濡れていないお前を、あれは調べている。',
        '@noise＞ お前の持っている属性を、写し取る。持っているほど、厄介になる。円からは、出ろ。弱点は、ない。',
      ],
      defeated: [
        '@noise＞ ……反応が、止まった。',
        '@noise＞ 通行証を拾え。コアも持っていけ。いつか、使い道がある。',
      ],
    },
    attacks: {
      // 固有「反応」：プレイヤーへ弾を撃つ。弾には、写し取った属性の効き目が乗る（電撃のときは shockSpeed 倍に速い）。
      //   属性を写し取れなかったときは、ダメージが plainBonus 倍になる
      reflect: { pattern: 'reflect', telegraph: 0.6, count: 5, spread: 56, waves: 3, interval: 0.4, track: true, shotSpeed: 300, shockSpeed: 1.35, shotRadius: 7, damage: 34, plainBonus: 1.25, recover: 0.6 },
      reflectHard: { pattern: 'reflect', telegraph: 0.5, count: 7, spread: 70, waves: 4, interval: 0.34, track: true, shotSpeed: 310, shockSpeed: 1.35, shotRadius: 7, damage: 34, plainBonus: 1.25, recover: 0.6 },
      // 固有「奪取」：ボスのまわりの円（radius）。中にいると、ダメージに加えて、seal 秒のあいだ属性を奪われる
      seize: { pattern: 'seize', telegraph: 1.3, radius: 230, damage: 38, seal: 10, recover: 0.8 },
      // 固有「軌跡」：突進。通ったあと（gap px ごと）に、写し取った属性の床が残る。壁に当たると隙
      streak: {
        pattern: 'streak', telegraph: 0.7, lockTime: 0.2, speed: 680, duration: 0.65, damage: 52, plainBonus: 1.25, wallStun: 1.3, recover: 0.7, reach: 'far',
        trail: { gap: 70, radius: 42, arm: 0.5, life: 5, damage: 14, strike: 40, strikeDelay: 0.8 },
      },
      // 固有「写し身の波」：写し取った属性の色の輪が、count 回、広がる。当たると、その属性の効き目（属性を写せなかったときは plainBonus 倍）
      wavecopy: { pattern: 'wavecopy', telegraph: 0.9, count: 2, gap: 0.55, speed: 300, max: 420, width: 18, damage: 40, plainBonus: 1.25, recover: 0.8, reach: 'near' },
      // 固有「属性追尾」：写し取った属性の光の玉が、プレイヤーをゆっくり追う（電撃は速い）。属性ごとに1つずつ
      homers: { pattern: 'homers', telegraph: 0.8, count: 3, gap: 0.5, speed: 150, turn: 1.3, life: 5, damage: 40, plainBonus: 1.25, recover: 0.8, reach: 'far' },
      // 大技「連鎖反応」：4つの属性すべてを乗せた弾を、全方向に何度も撃つ
      chainreaction: { pattern: 'reflect', telegraph: 1.7, all: true, count: 14, spread: 360, waves: 7, interval: 0.42, rotate: 13, shotSpeed: 220, shockSpeed: 1.2, shotRadius: 7, damage: 34, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'streak' }],
    ultimate: { move: 'chainreaction', announce: '連鎖反応' },
    phases: [
      { hpAbove: 0.6, idle: { min: 1.0, max: 1.6 }, moves: ['reflect', 'seize', 'streak', 'wavecopy'] },
      {
        hpAbove: 0.3,
        idle: { min: 0.8, max: 1.3 },
        moves: ['reflectHard', 'seize', 'streak', 'wavecopy', 'homers'],
        combos: [{ moves: ['streak', 'wavecopy'] }, { moves: ['seize', 'reflectHard'] }],
        announce: '反応、加速',
      },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        speed: 1.15,
        moves: ['reflectHard', 'seize', 'streak', 'wavecopy', 'homers'],
        combos: [{ moves: ['streak', 'reflectHard'] }, { moves: ['seize', 'streak'] }, { moves: ['homers', 'wavecopy'] }],
        announce: '平衡、破れる',
      },
    ],
  },
  // ---- ここからマップ6「送風区」 ----
  {
    id: 'intake',
    name: 'インテーク',
    alias: '吸い込み口', // 登場時に出す異名
    shape: 'intake',
    color: 'cold',
    weakness: 'corrode',
    material: 'intakeCore',
    radius: 46,
    hp: 21000,
    speed: 60,
    contactDamage: 54,
    xp: 780,
    credits: 400,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「吸引」：正面の扇形（arc 度）にあるものを、口へ吸い寄せる。吸っている間、ゆっくり向きを変える（turnRate ラジアン/秒）。
      //   プレイヤーは pull px/秒 で引かれる（ダッシュ中と、遮風板の陰では引かれない）。口のすぐ前（mouth px）にいると、tick 秒ごとにダメージ。
      //   がれきは debrisPull px/秒 で吸われて、飲み込まれる。最初の1回だけ、部屋にがれきを seed 個まく。終わると、then の技（吐き出し）を出す
      inhale: { pattern: 'inhale', telegraph: 0.9, duration: 3.0, arc: 80, turnRate: 0.7, pull: 170, debrisPull: 300, mouth: 30, tick: 0.4, damage: 34, seed: 5, then: 'exhale', recover: 0.4, reach: 'far' },
      inhaleHard: { pattern: 'inhale', telegraph: 0.8, duration: 3.4, arc: 100, turnRate: 0.85, pull: 185, debrisPull: 340, mouth: 30, tick: 0.4, damage: 34, seed: 5, then: 'exhale', recover: 0.4, reach: 'far' },
      // 固有「吐き出し」：飲み込んだがれきを、扇形に吐く。弾の数は base ＋ 飲み込んだ数 × perDebris（max まで）。
      //   壁に当たった弾は、litter の確率で、がれきになって床に残る（部屋のがれきは maxDebris 個まで）
      exhale: { pattern: 'exhale', telegraph: 0.6, lockTime: 0.2, base: 4, perDebris: 2, max: 18, spread: 80, shotSpeed: 330, shotRadius: 9, damage: 42, litter: 0.5, maxDebris: 8, recover: 0.8 },
      // 固有「羽根の乱射」：回る羽根（blades 枚）が弾を出す。reverseAt 発目で、回る向きが逆になる
      bladevolley: { pattern: 'bladevolley', telegraph: 0.7, blades: 3, shots: 34, gap: 0.09, turn: 10, reverseAt: 17, shotSpeed: 260, shotRadius: 7, damage: 36, recover: 0.7, reach: 'far' },
      bladevolleyHard: { pattern: 'bladevolley', telegraph: 0.6, blades: 4, shots: 40, gap: 0.08, turn: 10, reverseAt: 20, shotSpeed: 280, shotRadius: 7, damage: 38, recover: 0.7, reach: 'far' },
      // 固有「吸気の輪」：部屋の外から、ボスへ縮んでくる輪が count 本。輪に触れると当たる
      suctionring: { pattern: 'suctionring', telegraph: 0.8, count: 2, gap: 0.8, start: 700, min: 60, speed: 300, width: 20, damage: 44, recover: 0.8, reach: 'far' },
      // 固有「排気の打ち下ろし」：空気の塊が落ちる。当たると knock の強さで外へ吹き飛ばされる
      downdraft: { pattern: 'downdraft', telegraph: 0.7, count: 5, spread: 180, radius: 62, delay: 0.85, stagger: 0.22, damage: 48, knock: 520, recover: 0.7, reach: 'near' },
      // 大技「全開」：部屋ぜんたいを吸う。遮風板の陰（口の反対側）でしのぐ。strip.every 秒ごとに、プレイヤーにいちばん近い板が、
      //   strip.warn 秒揺れてから飛ぶ（keep 枚は残る。飛んだ板は restore 秒で戻る）。最後に、飲み込んだがれきを全方向に吐く
      fullopen: {
        pattern: 'fullopen', telegraph: 1.7, duration: 7, pull: 180, debrisPull: 340, mouth: 34, tick: 0.35, damage: 36,
        strip: { first: 1.4, every: 2.2, warn: 0.8, restore: 9, keep: 1 },
        burst: { base: 14, perDebris: 2, max: 30, shotSpeed: 280, shotRadius: 9, damage: 42 },
        recover: 1.5,
      },
    },
    reactions: [{ when: 'far', seconds: 4, move: 'inhale' }],
    ultimate: { move: 'fullopen', announce: '全開' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.6 }, moves: ['inhale', 'exhale', 'bladevolley', 'suctionring', 'downdraft'] },
      {
        hpAbove: 0,
        idle: { min: 0.7, max: 1.2 },
        moves: ['inhaleHard', 'exhale', 'bladevolleyHard', 'suctionring', 'downdraft'],
        combos: [{ moves: ['downdraft', 'bladevolleyHard'] }, { moves: ['suctionring', 'inhaleHard'] }],
        announce: '全部、吸う',
      },
    ],
  },
  // ---- マップ6 エリア2（docs/詳細仕様.md「30. マップ6「送風区」」の「②エリア2」）。マップ6から、ボスは強めに作る（HP は前のボスより +4000） ----
  {
    id: 'ductcrawler',
    name: 'ダクトクローラー',
    alias: '管這い', // 登場時に出す異名
    shape: 'ductcrawler',
    color: 'amber',
    weakness: 'heat',
    material: 'ductCore',
    radius: 48,
    hp: 25000,
    speed: 64,
    contactDamage: 58,
    xp: 880,
    credits: 450,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「横断」：長い体で部屋を横切る。帯に入っていると当たる。継ぎ目（水色の枠）の中なら当たらない
      sweep: { pattern: 'sweep', telegraph: 1.15, speed: 720, width: 130, length: 300, seams: 2, seamLen: 110, damage: 60, recover: 0.9, reach: 'far' },
      sweepHard: { pattern: 'sweep', telegraph: 1.0, speed: 800, width: 130, length: 320, seams: 1, seamLen: 110, damage: 62, recover: 0.8, reach: 'far' },
      // 固有「熱排気」：通気口が、プレイヤーの動いている向きの先へ、順番に熱の柱を噴く
      ventburst: { pattern: 'ventburst', telegraph: 0.7, count: 5, interval: 0.34, delay: 0.85, radius: 54, damage: 54, recover: 0.8 },
      ventburstHard: { pattern: 'ventburst', telegraph: 0.6, count: 8, interval: 0.28, delay: 0.8, radius: 58, damage: 56, recover: 0.8 },
      // 固有「鱗の棘」：床の通気口が、順に、プレイヤーへ棘を飛ばす（vents 個の口から、spines 本ずつ）
      spinevolley: { pattern: 'spinevolley', telegraph: 0.7, vents: 5, gap: 0.35, spines: 3, spread: 30, shotSpeed: 340, shotRadius: 7, damage: 42, recover: 0.7, reach: 'far' },
      spinevolleyHard: { pattern: 'spinevolley', telegraph: 0.6, vents: 7, gap: 0.3, spines: 3, spread: 36, shotSpeed: 360, shotRadius: 7, damage: 44, recover: 0.7, reach: 'far' },
      // 固有「管の振動」：プレイヤーに近い通気口が光り、少しあとに、小さな輪が広がる
      ductquake: { pattern: 'ductquake', telegraph: 0.7, count: 4, delay: 0.9, stagger: 0.3, speed: 300, max: 300, width: 18, damage: 46, recover: 0.8, reach: 'near' },
      ductquakeHard: { pattern: 'ductquake', telegraph: 0.6, count: 6, delay: 0.85, stagger: 0.25, speed: 320, max: 320, width: 18, damage: 48, recover: 0.8, reach: 'near' },
      // 固有「噛みつき加速」：じわじわ速くなる突進（speedFrom から speedTo へ）。速いほど痛い（bonus）。壁に当たると隙ができる
      ductbite: { pattern: 'ductbite', telegraph: 0.8, lockTime: 0.25, speedFrom: 280, speedTo: 900, duration: 1.1, damage: 56, bonus: 0.3, wallStun: 1.2, recover: 0.7, reach: 'far' },
      // 大技「吹き抜け」：横断が3本、時間差で通る。そのあいだ、熱排気も重なる
      blowthrough: {
        pattern: 'blowthrough', telegraph: 1.8, sweeps: 3, stagger: 1.15, warn: 1.0, speed: 780, width: 120, length: 320, seams: 1, seamLen: 120, damage: 62,
        vents: { count: 6, interval: 0.55, delay: 0.9, radius: 54, damage: 54 },
        recover: 1.5,
      },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'ductbite' }],
    ultimate: { move: 'blowthrough', announce: '吹き抜け' },
    phases: [
      { hpAbove: 0.5, idle: { min: 0.9, max: 1.4 }, moves: ['sweep', 'ventburst', 'spinevolley', 'ductquake', 'ductbite'] },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        moves: ['sweepHard', 'ventburstHard', 'spinevolleyHard', 'ductquakeHard', 'ductbite'],
        combos: [{ moves: ['ventburstHard', 'sweepHard'] }, { moves: ['ductquakeHard', 'spinevolleyHard'] }],
        announce: '通気口、全開',
      },
    ],
  },
  // ---- マップ6 エリア3（docs/詳細仕様.md「30. マップ6「送風区」」の「③エリア3」）。HP は前のボスより +4000 ----
  {
    id: 'weathervane',
    name: 'ウェザーベーン',
    alias: '風見', // 登場時に出す異名
    shape: 'weathervane',
    color: 'cyan',
    weakness: 'shock',
    material: 'vaneCore',
    radius: 50,
    hp: 29000,
    speed: 62,
    contactDamage: 62,
    xp: 960,
    credits: 480,
    drops: { count: 3, rarityBonus: 2 },
    // 風上を向く盾（arc 度）。風の予告が出ると、vaneTurn ラジアン/秒で風上へ回る。プレイヤーのほうは向かない。硬直中は開く
    shield: { arc: 120 },
    windShield: true,
    vaneTurn: 2.0,
    attacks: {
      // 固有「方位撃ち」：東西南北に大きな弾を撃ち、次は斜め4方向。volleys 回、羅針盤のように回る（twist 度ずつずらす）
      compass: { pattern: 'compass', telegraph: 0.8, volleys: 6, gap: 0.55, twist: 12, shotSpeed: 300, shotRadius: 11, damage: 46, recover: 0.7, reach: 'far' },
      compassHard: { pattern: 'compass', telegraph: 0.7, volleys: 8, gap: 0.45, twist: 14, shotSpeed: 330, shotRadius: 11, damage: 48, recover: 0.7, reach: 'far' },
      // 固有「突風」：盾の正面（arc 度、range px）に、強い風を duration 秒吹かせる。押す強さは push px/秒。ダメージはない（壁へ押し込まれると危ない）
      gust: { pattern: 'gust', telegraph: 0.9, duration: 2.2, range: 560, arc: 70, push: 380, recover: 0.7, reach: 'near' },
      gustHard: { pattern: 'gust', telegraph: 0.8, duration: 2.8, range: 620, arc: 90, push: 440, recover: 0.7, reach: 'near' },
      // 固有「風種」：風で流される種を count 個まく。風がやむと地雷になる（life 秒で消える）。壊せる。hold 秒で次の行動へ
      windseed: { pattern: 'windseed', telegraph: 0.8, enemy: 'windseed', count: 4, spread: 90, life: 14, hold: 1.5, recover: 0.8, reach: 'far' },
      windseedHard: { pattern: 'windseed', telegraph: 0.7, enemy: 'windseed', count: 6, spread: 110, life: 14, hold: 1.5, recover: 0.8, reach: 'far' },
      // 固有「風向き返し」：風向きを反対にする（warn 秒の予告のあと、blow 秒吹く）。風下へ、すき間（gapSize px）のある風の刃が blades 本、stagger 秒ずつ遅れて走る
      windturn: { pattern: 'windturn', telegraph: 0.9, warn: 0.9, blow: 4, blades: 3, stagger: 0.9, speed: 380, width: 26, gapSize: 130, damage: 52, recover: 1.0, reach: 'far' },
      windturnHard: { pattern: 'windturn', telegraph: 0.8, warn: 0.9, blow: 4, blades: 4, stagger: 0.75, speed: 420, width: 26, gapSize: 115, damage: 54, recover: 1.0, reach: 'far' },
      // 固有「向かい風突進」：盾の向き（風上）へ、反対側の壁ぎわから、プレイヤーの横位置に合わせて一気に走る。最後の lockTime 秒だけ、位置を固定する。壁に当たると隙
      windrush: { pattern: 'windrush', telegraph: 1.0, lockTime: 0.3, speed: 880, damage: 62, wallStun: 1.2, recover: 0.6, reach: 'far' },
      // 大技「乱風」：duration 秒のあいだ、風向きが every 秒ごとに変わり、盾も速く（vaneTurn）追って回る。方位撃ちも重なる
      stormfury: { pattern: 'stormfury', telegraph: 1.8, duration: 9, every: 1.5, volleyGap: 1.8, vaneTurn: 5, shotSpeed: 250, shotRadius: 11, damage: 46, recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'windrush' }],
    ultimate: { move: 'stormfury', announce: '乱風' },
    phases: [
      { hpAbove: 0.5, idle: { min: 1.0, max: 1.5 }, moves: ['compass', 'gust', 'windseed', 'windturn', 'windrush'] },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        vaneTurn: 3.4,
        moves: ['compassHard', 'gustHard', 'windseedHard', 'windturnHard', 'windrush'],
        combos: [{ moves: ['windseedHard', 'compassHard'] }, { moves: ['windturnHard', 'gustHard'] }],
        announce: '風向き、乱れる',
      },
    ],
  },
  // ---- マップ6 エリア4（docs/詳細仕様.md「30. マップ6「送風区」」の「④エリア4」）。HP は前のボスより +4000 ----
  {
    id: 'cyclone',
    name: 'サイクロン',
    alias: '大渦', // 登場時に出す異名
    shape: 'cyclone',
    color: 'cold',
    weakness: 'cold',
    material: 'cycloneCore',
    radius: 52,
    hp: 33000,
    speed: 66,
    contactDamage: 66,
    xp: 1040,
    credits: 520,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「竜巻」：竜巻が count 本出て、プレイヤーへ寄ってくる（life 秒で消える）。芯（core px）に触れるとダメージ。pullR px 以内では、毎秒 pull px まで引き込まれる
      twister: { pattern: 'twister', telegraph: 0.8, count: 2, core: 26, pullR: 170, pull: 95, speed: 58, life: 8, damage: 42, tick: 0.5, hold: 1.5, recover: 0.8, reach: 'far' },
      twisterHard: { pattern: 'twister', telegraph: 0.7, count: 3, core: 26, pullR: 180, pull: 105, speed: 64, life: 8, damage: 44, tick: 0.5, hold: 1.5, recover: 0.8, reach: 'far' },
      // 固有「巻き上げ投げ」：瓦礫が count 個、ボスのまわり（orbit px）を回る。hold 秒後から、gap 秒ずつ、プレイヤーめがけて飛ぶ。回っている間に壊せる
      sweepup: { pattern: 'sweepup', telegraph: 0.9, enemy: 'flotsam', count: 6, orbit: 110, spin: 2.6, hold: 1.8, gap: 0.55, flingSpeed: 430, recover: 0.8, reach: 'near' },
      sweepupHard: { pattern: 'sweepup', telegraph: 0.8, enemy: 'flotsam', count: 8, orbit: 115, spin: 3.0, hold: 1.6, gap: 0.45, flingSpeed: 470, recover: 0.8, reach: 'near' },
      // 固有「渦巻きの弾」：曲がりながら飛ぶ弾を、arms 本の腕から撃つ（腕ごとに曲がる向きが逆。turn ラジアン/秒）。step 度ずつ、撃つ向きが回る
      swirlshot: { pattern: 'swirlshot', telegraph: 0.8, arms: 2, shots: 24, gap: 0.12, step: 13, turn: 1.0, speed: 230, radius: 8, damage: 38, life: 5, recover: 0.7, reach: 'far' },
      swirlshotHard: { pattern: 'swirlshot', telegraph: 0.7, arms: 3, shots: 26, gap: 0.11, step: 11, turn: 1.1, speed: 245, radius: 8, damage: 40, life: 5, recover: 0.7, reach: 'far' },
      // 固有「螺旋落雷」：ボスから外へ、螺旋の形に、落雷の予告が count 個並ぶ。内側から順に落ちる
      spiralbolt: { pattern: 'spiralbolt', telegraph: 0.7, count: 14, inner: 100, step: 36, turn: 0.55, radius: 46, delay: 0.9, stagger: 0.12, damage: 50, recover: 0.8, reach: 'near' },
      spiralboltHard: { pattern: 'spiralbolt', telegraph: 0.6, count: 18, inner: 100, step: 32, turn: 0.55, radius: 46, delay: 0.85, stagger: 0.1, damage: 52, recover: 0.8, reach: 'near' },
      // 固有「渦巻き突進」：曲がりながら（curve ラジアン/秒）突進する。予告で道の線が見える（最後の lockTime 秒だけ向きを固定）。壁に当たると隙
      cycloneram: { pattern: 'cycloneram', telegraph: 1.0, lockTime: 0.3, speed: 640, curve: 1.3, duration: 1.4, damage: 66, wallStun: 1.2, recover: 0.7, reach: 'far' },
      // 大技「台風の目」：部屋ぜんたいが暴風圏。目（安全な円。半径 eye から eyeEnd へ縮む）の外にいる間は、tick 秒ごとに damage。目は drift px/秒で動く。竜巻も every 秒ごとに count 本出る
      eyestorm: {
        pattern: 'eyestorm', telegraph: 1.8, duration: 12, eye: 130, eyeEnd: 85, drift: 36, tick: 0.6, damage: 18,
        twister: { count: 2, every: 4, core: 26, pullR: 170, pull: 90, speed: 56, life: 8, damage: 42, tick: 0.5 },
        recover: 1.5,
      },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'cycloneram' }],
    ultimate: { move: 'eyestorm', announce: '台風の目' },
    phases: [
      { hpAbove: 0.5, idle: { min: 0.9, max: 1.4 }, moves: ['twister', 'sweepup', 'swirlshot', 'spiralbolt', 'cycloneram'] },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        moves: ['twisterHard', 'sweepupHard', 'swirlshotHard', 'spiralboltHard', 'cycloneram'],
        combos: [{ moves: ['twisterHard', 'spiralboltHard'] }, { moves: ['sweepupHard', 'swirlshotHard'] }],
        announce: '渦が、荒れる',
      },
    ],
  },
  // ---- マップ7 エリア1（docs/詳細仕様.md「36. マップ7「核心区」と、ミシック」）。最後のマップ。HP は前のボスより +7000 ----
  {
    id: 'gatekeeper',
    name: 'ゲートキーパー',
    alias: '門番', // 登場時に出す異名
    shape: 'gatekeeper',
    color: 'red',
    weakness: 'heat',
    material: 'gateCore',
    radius: 54,
    hp: 40000,
    speed: 60,
    contactDamage: 72,
    xp: 1200,
    credits: 600,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「閉門」：予告の帯（赤）のあと、両側から門板が閉まる。waves 回、向きは交互。すき間（gap px）に入る。stagger 秒ずつずれて閉まる
      gateclose: { pattern: 'gateclose', telegraph: 0.8, waves: 2, stagger: 1.0, gap: 150, warn: 1.0, hold: 0.5, speed: 1400, damage: 70, recover: 0.9, reach: 'far' },
      gatecloseHard: { pattern: 'gateclose', telegraph: 0.7, waves: 3, stagger: 0.85, gap: 135, warn: 0.9, hold: 0.45, speed: 1500, damage: 72, recover: 0.9, reach: 'far' },
      // 固有「検問弾」：ボスのまわりに弾が count 発浮かんで止まり（hold 秒）、止まったあとのプレイヤーの位置めがけて飛ぶ（stagger 秒ずつずれる）
      holdshots: { pattern: 'holdshots', telegraph: 0.7, count: 8, ring: 30, hold: 1.1, stagger: 0.12, speed: 380, radius: 10, damage: 54, recover: 0.8, reach: 'far' },
      holdshotsHard: { pattern: 'holdshots', telegraph: 0.6, count: 12, ring: 30, hold: 1.0, stagger: 0.1, speed: 420, radius: 10, damage: 56, recover: 0.8, reach: 'far' },
      // 固有「衛兵召喚」：盾を持った門衛が count 体、プレイヤーのまわりに出る（体力は hpMul 倍、life 秒で消える）
      callguards: { pattern: 'callguards', telegraph: 0.9, enemy: 'gateguard', count: 2, spread: 170, hpMul: 0.45, life: 16, hold: 1.5, recover: 0.8, reach: 'near' },
      callguardsHard: { pattern: 'callguards', telegraph: 0.8, enemy: 'gateguard', count: 3, spread: 180, hpMul: 0.45, life: 16, hold: 1.5, recover: 0.8, reach: 'near' },
      // 固有「裂け目」：プレイヤーのほうへ、床の裂け目が count 本（spread 度ずつ開く）走る。warn 秒の予告のあと、一瞬だけ当たる
      fissure: { pattern: 'fissure', telegraph: 0.8, count: 1, spread: 0, len: 1100, width: 70, warn: 0.9, damage: 66, recover: 0.8, reach: 'far' },
      fissureHard: { pattern: 'fissure', telegraph: 0.7, count: 3, spread: 28, len: 1100, width: 66, warn: 0.8, damage: 68, recover: 0.8, reach: 'far' },
      // 固有「尾行爆弾」：プレイヤーを追いかける爆弾が count 個。触れるか fuse 秒で爆発する（範囲 blast px）
      tailbomb: { pattern: 'tailbomb', telegraph: 0.8, count: 2, stagger: 0.5, speed: 125, fuse: 3.4, blast: 100, damage: 66, recover: 0.8, reach: 'near' },
      tailbombHard: { pattern: 'tailbomb', telegraph: 0.7, count: 3, stagger: 0.45, speed: 140, fuse: 3.0, blast: 105, damage: 68, recover: 0.8, reach: 'near' },
      // 大技「全門閉鎖」：門板の波が waves 回、向きを変えながら every 秒ごとに閉まる（すき間は、毎回プレイヤーの近く）。検問弾も重なる
      lockdown: { pattern: 'lockdown', telegraph: 1.8, waves: 6, every: 1.1, gap: 140, warn: 0.9, hold: 0.4, speed: 1500, damage: 72, shots: 10, shotHold: 1.2, shotSpeed: 420, shotDamage: 54, recover: 1.6 },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'fissure' }],
    ultimate: { move: 'lockdown', announce: '全門閉鎖' },
    phases: [
      { hpAbove: 0.5, idle: { min: 0.9, max: 1.4 }, moves: ['gateclose', 'holdshots', 'callguards', 'fissure', 'tailbomb'] },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        moves: ['gatecloseHard', 'holdshotsHard', 'callguardsHard', 'fissureHard', 'tailbombHard'],
        combos: [{ moves: ['gatecloseHard', 'holdshotsHard'] }, { moves: ['fissureHard', 'tailbombHard'] }],
        announce: '門が、閉じる',
      },
    ],
  },
  // ---- マップ7 エリア2（docs/詳細仕様.md「36. マップ7「核心区」と、ミシック」の「②エリア2」）。HP は前のボスより +6000 ----
  {
    id: 'archivist',
    name: 'アーカイバー',
    alias: '記録係', // 登場時に出す異名
    shape: 'archivist',
    color: 'cyan',
    weakness: 'shock',
    material: 'archiveCore',
    radius: 52,
    hp: 46000,
    speed: 58,
    contactDamage: 76,
    xp: 1300,
    credits: 650,
    drops: { count: 3, rarityBonus: 2 },
    attacks: {
      // 固有「再生」：プレイヤーの通った道をなぞる影が count 体、delay 秒遅れで追ってくる（gap 秒ずつ遅れが増える）。life 秒で消える
      echo: { pattern: 'echo', telegraph: 0.9, count: 1, delay: 2.2, gap: 1.2, life: 9, radius: 18, damage: 62, hold: 1.5, recover: 0.8, reach: 'far' },
      echoHard: { pattern: 'echo', telegraph: 0.8, count: 2, delay: 2.0, gap: 1.2, life: 9, radius: 18, damage: 64, hold: 1.5, recover: 0.8, reach: 'far' },
      // 固有「足跡爆撃」：予告のあいだに歩いた場所（every 秒ごと）に、あとから落雷の予告が並ぶ（最後の count か所）。delay 秒後から、stagger 秒ずつ落ちる
      trailstrike: { pattern: 'trailstrike', telegraph: 1.6, every: 0.25, count: 6, radius: 48, delay: 0.9, stagger: 0.18, damage: 62, recover: 0.8, reach: 'far' },
      trailstrikeHard: { pattern: 'trailstrike', telegraph: 1.8, every: 0.2, count: 9, radius: 48, delay: 0.85, stagger: 0.14, damage: 64, recover: 0.8, reach: 'far' },
      // 固有「回収弾」：部屋の外まわりから、ボスめがけて弾が count 発（gap 秒ずつ）飛んでくる。ボスのいる場所を通る
      collect: { pattern: 'collect', telegraph: 0.8, count: 14, gap: 0.22, speed: 330, radius: 9, damage: 56, recover: 0.8, reach: 'near' },
      collectHard: { pattern: 'collect', telegraph: 0.7, count: 22, gap: 0.17, speed: 360, radius: 9, damage: 58, recover: 0.8, reach: 'near' },
      // 固有「検閲帯」：黒い帯が count 本。warn 秒の予告のあと一瞬当たり、shift px ずれて、rewarn 秒の予告のあと、もう一度当たる
      censorbars: { pattern: 'censorbars', telegraph: 0.8, count: 2, width: 110, shift: 220, warn: 1.1, rewarn: 0.8, stagger: 0.5, damage: 70, recover: 0.9, reach: 'far' },
      censorbarsHard: { pattern: 'censorbars', telegraph: 0.7, count: 3, width: 105, shift: 240, warn: 1.0, rewarn: 0.7, stagger: 0.4, damage: 72, recover: 0.9, reach: 'far' },
      // 固有「復元」：記録の柱が count 本出る（体力は hpMul 倍）。残っている間、ボスのHPが毎秒 healPerSec の割合 × 本数で回復する。maxTime 秒で切り上げる
      backup: { pattern: 'backup', telegraph: 0.9, enemy: 'datapylon', count: 2, hpMul: 0.5, healPerSec: 0.012, maxTime: 14, recover: 0.8, reach: 'near' },
      backupHard: { pattern: 'backup', telegraph: 0.8, enemy: 'datapylon', count: 3, hpMul: 0.5, healPerSec: 0.012, maxTime: 14, recover: 0.8, reach: 'near' },
      // 大技「巻き戻し」：再生の影が count 体（遅れをずらして）追ってくる。同時に、酸の雨が rain 秒降る
      rewind: { pattern: 'rewind', telegraph: 1.8, count: 3, delay: 1.6, gap: 1.4, life: 13, radius: 18, damage: 66, rain: 12, recover: 1.6 },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'trailstrike' }],
    ultimate: { move: 'rewind', announce: '巻き戻し' },
    phases: [
      { hpAbove: 0.5, idle: { min: 0.9, max: 1.4 }, moves: ['echo', 'trailstrike', 'collect', 'censorbars', 'backup'] },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        moves: ['echoHard', 'trailstrikeHard', 'collectHard', 'censorbarsHard', 'backupHard'],
        combos: [{ moves: ['echoHard', 'censorbarsHard'] }, { moves: ['collectHard', 'trailstrikeHard'] }],
        announce: '記録を、上書きする',
      },
    ],
  },
  // ---- マップ4の隠しボス（docs/詳細仕様.md「24. マップ4」の「隠しボス「ノクターン」」）。出し方は、マップの定義（secretBoss.rule）----
  {
    id: 'nocturne',
    name: 'ノクターン',
    alias: '影', // 登場時に出す異名
    hidden: true,
    bgm: 'bossNocturne', // この隠しボスだけの曲
    shape: 'nocturne',
    color: 'magenta',
    weakness: null,
    material: 'nocturneCore', // 倒すたびに1個（恒久強化「記憶領域」に使う）
    radius: 38,
    hp: 15500,
    speed: 96,
    contactDamage: 50,
    xp: 760,
    credits: 360,
    drops: { count: 3, rarityBonus: 2, minRarity: 2 }, // 装備は、エピック以上を保証
    comms: {
      intro: [
        '@noise＞ ……灯りを点けたから、影ができた。あれは、お前の影だ。',
        '@noise＞ 通った道を、遅れてなぞってくる。同じ場所に戻るな。弱点は、ない。',
      ],
      defeated: [
        '@noise＞ ……影が、足元に戻った。',
        '@noise＞ 通行証を拾え。いつか、要るかもしれない。',
      ],
    },
    attacks: {
      // 影踏み（固有・前からある）：lag 秒前にいた場所が、interval 秒ごとに攻撃される
      shadowstep: { pattern: 'shadowstep', telegraph: 0.8, trail: { life: 9, lag: 2, interval: 0.4, delay: 0.7, radius: 44, damage: 46 }, recover: 0.5 },
      shadowstepHard: { pattern: 'shadowstep', telegraph: 0.7, trail: { life: 11, lag: 1.7, interval: 0.3, delay: 0.65, radius: 46, damage: 46 }, recover: 0.5 },
      // 写し身（固有・前からある）：動きを delays 秒遅れて真似る影。触れるとダメージ
      mirror: { pattern: 'mirror', telegraph: 0.8, echoes: { delays: [1.5], life: 10, radius: 20, damage: 44 }, recover: 0.5 },
      mirrorHard: { pattern: 'mirror', telegraph: 0.7, echoes: { delays: [1.2, 2.4], life: 11, radius: 20, damage: 44 }, recover: 0.5 },
      // 固有「先読みの刃」：いま動いている向きの先（delay 秒後にいそうな場所）に、影の刃が落ちる。続けて何回も。向きを変えれば避けられる
      leadblade: { pattern: 'leadblade', telegraph: 0.7, count: 3, gap: 0.55, delay: 0.8, radius: 52, damage: 46, recover: 0.7 },
      leadbladeHard: { pattern: 'leadblade', telegraph: 0.6, count: 5, gap: 0.42, delay: 0.75, radius: 52, damage: 46, recover: 0.6 },
      // 固有「影の包囲」：プレイヤーのまわりに、影の輪が出て縮む。出口（gap 度）は1か所
      shadowring: { pattern: 'shadowring', telegraph: 1.0, lockTime: 0.35, r0: 300, rEnd: 60, shrink: 2.4, gap: 48, damage: 44, recover: 0.8 },
      shadowringHard: { pattern: 'shadowring', telegraph: 0.9, lockTime: 0.35, r0: 320, rEnd: 60, shrink: 1.9, gap: 40, damage: 44, recover: 0.7 },
      // 固有「黒い羽ばたき」：プレイヤーが通った場所から、影が飛び出して、いまのプレイヤーへ向かう
      afterwing: { pattern: 'afterwing', telegraph: 1.4, count: 6, gap: 0.12, speed: 360, radius: 8, damage: 40, recover: 0.8 },
      afterwingHard: { pattern: 'afterwing', telegraph: 1.4, count: 9, gap: 0.1, speed: 380, radius: 8, damage: 40, recover: 0.7 },
      // 大技「夜想」（固有・前からある）：暗闇の中で、影踏みと、写し身2体が同時に来る
      nocturne: {
        pattern: 'shadowstep', telegraph: 1.6,
        trail: { life: 14, lag: 1.7, interval: 0.3, delay: 0.65, radius: 46, damage: 48 },
        echoes: { delays: [1.2, 2.4], life: 14, radius: 20, damage: 46 },
        blackout: { duration: 14, vision: 0.7 }, recover: 0.8,
      },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'afterwing' }],
    ultimate: { move: 'nocturne', announce: '夜想' },
    phases: [
      { hpAbove: 0.6, idle: { min: 1.0, max: 1.6 }, moves: ['shadowstep', 'mirror', 'leadblade', 'afterwing'] },
      {
        hpAbove: 0.3,
        idle: { min: 0.8, max: 1.3 },
        moves: ['shadowstepHard', 'mirror', 'shadowring', 'leadblade', 'afterwing'],
        combos: [{ moves: ['mirror', 'afterwing'] }, { moves: ['shadowstepHard', 'leadblade'] }],
        announce: '影が、濃くなる',
      },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        speed: 1.15,
        moves: ['shadowstepHard', 'mirrorHard', 'shadowringHard', 'leadbladeHard', 'afterwingHard'],
        combos: [{ moves: ['shadowringHard', 'leadbladeHard'] }, { moves: ['mirrorHard', 'afterwingHard'] }],
        announce: '夜が、明けない',
      },
    ],
  },
  // ---- 隠しボス（docs/詳細仕様.md「21. 隠しボスと通行証」） ----
  // hidden: true のボスは、エリアのボスではない。ひび割れた壁の奥にいて、倒すとそのマップの通行証が手に入る。素材を1個落とす。データ片は持たない
  {
    id: 'architect',
    name: 'アーキテクト',
    alias: '設計者', // 登場時に出す異名
    hidden: true,
    shape: 'architect',
    color: 'amber',
    weakness: 'cold',
    material: 'architectCore', // 倒すたびに1個（恒久強化「記憶領域」に使う）
    radius: 42,
    hp: 12000,
    speed: 74,
    contactDamage: 48,
    xp: 700,
    credits: 320,
    drops: { count: 3, rarityBonus: 2, minRarity: 2 }, // 装備は、エピック以上を保証
    comms: {
      intro: [
        '@noise＞ ……図面にない部屋だ。ここで、塔の形を書き換え続けている。',
        '@noise＞ 設計者だ。線と杭に気をつけろ。冷却が効く。',
      ],
      defeated: [
        '@noise＞ ……図面が、止まった。',
        '@noise＞ 通行証を拾え。その先へ行くのに、要る。',
      ],
    },
    attacks: {
      // 方眼（固有・前からある）：部屋をマスに分け、市松模様の半分が光る。続けて、残りの半分が光る
      cells: { pattern: 'cells', telegraph: 1.1, second: 0.85, cols: 6, rows: 4, waves: 2, active: 0.2, damage: 50, recover: 0.8 },
      cellsHard: { pattern: 'cells', telegraph: 0.95, second: 0.7, cols: 6, rows: 4, waves: 3, active: 0.2, damage: 50, recover: 0.7 },
      // インク流し（固有・前からある）：足元から広がっていく床。中にいると腐食（持続ダメージ）
      ink: { pattern: 'ink', telegraph: 0.7, count: 1, start: 44, grow: 55, maxRadius: 185, arm: 0.5, life: 6, tick: 0.5, damage: 14, dot: 'corrode', recover: 0.6 },
      inkHard: { pattern: 'ink', telegraph: 0.6, count: 2, start: 44, grow: 70, maxRadius: 170, arm: 0.45, life: 6.5, tick: 0.5, damage: 14, dot: 'corrode', recover: 0.6 },
      // 固有「設計図」：長方形の枠が出て、warn 秒後に、鉄骨の壁として建つ（life 秒）。建つとき、中にいるとダメージ。壁は歩いて通れず、弾も止める
      plans: { pattern: 'plans', telegraph: 0.7, count: 3, long: 150, short: 80, warn: 1.0, block: 'steelblock', life: 7, damage: 44, recover: 0.8 },
      plansHard: { pattern: 'plans', telegraph: 0.6, count: 4, long: 150, short: 80, warn: 0.85, block: 'steelblock', life: 7, damage: 44, recover: 0.7 },
      // 固有「測量」：測量の点が、基板のような線の上を走り、通った場所に、柱が建つ（life 秒で崩れる）。点に触れるとダメージ
      survey: { pattern: 'surveyrun', telegraph: 0.7, edges: 6, warn: 1.0, speed: 420, spacing: 80, block: 'steelblock', life: 5, damage: 40, recover: 0.8 },
      surveyHard: { pattern: 'surveyrun', telegraph: 0.6, edges: 8, warn: 0.9, speed: 480, spacing: 80, block: 'steelblock', life: 5, damage: 40, recover: 0.7 },
      // 固有「試作機」：壊せる試作機が出て、プレイヤーへ弾を撃つ（duration 秒で消える）。全部壊すと、本体に open 秒の隙ができる
      prototype: { pattern: 'prototype', telegraph: 0.7, count: 2, enemy: 'prototype', duration: 10, open: 3, recover: 0.8 },
      // 大技「竣工」：方眼と設計図を、順に続ける
      completion: { pattern: 'finishwork', steps: ['cellsHard', 'plansHard', 'cellsHard', 'plansHard'], recover: 1.5 },
    },
    reactions: [{ when: 'far', seconds: 3.5, move: 'survey' }],
    ultimate: { move: 'completion', announce: '竣工' },
    phases: [
      { hpAbove: 0.6, idle: { min: 1.0, max: 1.6 }, moves: ['survey', 'cells', 'plans', 'ink', 'prototype'] },
      {
        hpAbove: 0.3,
        idle: { min: 0.8, max: 1.3 },
        moves: ['surveyHard', 'cells', 'plans', 'ink', 'prototype'],
        combos: [{ moves: ['plans', 'ink'] }, { moves: ['surveyHard', 'cells'] }],
        side: { moves: ['survey'], every: { min: 11, max: 15 } },
        announce: '設計変更',
      },
      {
        hpAbove: 0,
        idle: { min: 0.6, max: 1.0 },
        speed: 1.15,
        moves: ['cellsHard', 'surveyHard', 'plansHard', 'inkHard', 'prototype'],
        combos: [{ moves: ['inkHard', 'cellsHard'] }, { moves: ['surveyHard', 'plansHard'] }],
        side: { moves: ['prototype'], every: { min: 12, max: 16 } },
        announce: '最終図面',
      },
    ],
  },
];
