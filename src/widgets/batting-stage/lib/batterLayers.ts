/**
 * 타자 그림 (binary.mod 0xb905c 자세 · 0x78cfc 레이어 — 위치 분석 5차, 바이트 확인).
 * 모든 레이어를 같은 앵커에 프레임 원점대로 겹친다. 레이어 폴더 프레임 = 자세 f + 레이어 가산값.
 *   bodyType t = 타자 폼 >> 1 (0 balancer · 1 sluger) — `bodyTypeOf` 참고.
 * 아이템 레이어(머리 +0x1c · 손 +0x14/+0x20/+0x44 · 다리 +0x28)는 장비 등급 순번 n 으로 고른다 —
 * `equipmentGradeOf`·`batterEquipmentOf` 주석 참고 (0x78fd8 적재 · 0x78cfc 겹치기, 디스어셈 확인).
 * 그림자는 +0x48 플래그일 때만 그리는데 플래그를 세우는 자리를 못 찾아 늘 그린다 (추정).
 *
 * 파일 끝에 **투수 장비 레이어**(0x79790 적재 · 0x79524 겹치기)도 같이 있다 — 같은
 * `BatterLayer`·`layerPaletteIndexOf` 를 쓰기 때문이다. 두 쪽 차이는 `PitcherEquipment` 주석 참고.
 */
import { outfitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import { PITCHER_OVERLAY_FRAME_OFFSET } from '@/widgets/batting-stage/lib/stageScenery'

const SPRITES = './sprites'
const BODY_FOLDERS = [`${SPRITES}/batter_balancer/frames`, `${SPRITES}/batter_sluger/frames`]
const SHADOW = `${SPRITES}/batter_shadow/frames`
const HELMET = `${SPRITES}/batter_helmet/frames`
const BAT = `${SPRITES}/batter_batter/frames`
const GHOST = `${SPRITES}/batter_ghost/frames`

export interface BatterLayer {
  readonly folder: string
  readonly frame: number
  /**
   * 등급 색 `.mpl` 줄 (손·다리 장비만). `drawBatter` 가 이 값을 그대로 `placedFrame` 의
   * 팔레트 번호로 넘겨 칠한다 — 번호 지도는 `public/sprites/item_…` 폴더의 `frames/index/NNN.png`.
   *
   * ⚠️ 장비 폴더는 `palette.json` 의 `baked` 가 **null** 이다 (벌 0 이 아니다). 줄 −1 = "그림
   * 기본색" 이라 구운 PNG 가 `.mpl` 벌 목록 밖에 있어서다 — 그래서 줄 0 도 갈아 끼워야 한다.
   * 줄이 없는 등급(기본색)은 이 값을 **아예 안 붙인다**.
   */
  readonly gradePaletteRow?: number
}

/**
 * 장비 한 부위의 **등급 순번 n** (0~10, −1 = 미장착).
 *
 * 원본 호출지 0x10866 은 부위 0~3 을 돌며 선수 레코드의 장비 니블(+0x19·+0x1a, 부위마다 4비트)에서
 * `n = 니블 − 1` 을 꺼내 그림 객체 vtable 슬롯 5(0x78fd8)에 `(부위, n)` 으로 넘긴다.
 * **니블이 0(미장착)이면 아예 부르지 않는다** (`subs r2,r1,#1; bmi`) — 그래서 웹도 −1 로 둔다.
 * 웹 `career.equipmentLevels` 가 그 니블(0 미장착 · 1~11 = 레벨+1)을 그대로 들고 있다.
 */
export function equipmentGradeOf(nibble: number): number {
  const level = Math.trunc(nibble) - 1
  return level < 0 ? -1 : Math.min(EQUIPMENT_GRADE_MAX, level)
}

const EQUIPMENT_GRADE_MAX = 10

/** 타자 그림에 보이는 세 부위 (부위 2 밴드는 원본도 그림이 없다 — 0x7907c `cmp r6,#2` 에서 끝낸다) */
export interface BatterEquipment {
  /** 부위 0 헬멧 아이템 */
  readonly head: number
  /** 부위 1 배트 */
  readonly hand: number
  /** 부위 3 슈즈 */
  readonly leg: number
}

export const NO_EQUIPMENT: BatterEquipment = { head: -1, hand: -1, leg: -1 }

/** 니블 묶음(career.equipmentLevels 순서 = 히트·파워·수비·주루 = 헬멧·배트·밴드·슈즈) → 등급 순번 */
export function batterEquipmentOf(nibbles: { hit: number; power: number; run: number }): BatterEquipment {
  return {
    head: equipmentGradeOf(nibbles.hit),
    hand: equipmentGradeOf(nibbles.power),
    leg: equipmentGradeOf(nibbles.run),
  }
}

/** 등급 7 부터가 히든이고 파일·팔레트가 갈린다 (0x790f6 `cmp r7,#6 / bgt` · 0x7922e) */
const FIRST_HIDDEN_GRADE = 7

/**
 * 부위별 장비 그림 (문자열 표 0xd3bfc~0xd3cc0 · 적재 0x78fd8, 디스어셈 확인):
 *   머리        `item_bat_head_{n}`                                → +0x1c
 *   손 n ≤ 6    `item_bat_hand` + `item_bat_hand.mpl` 줄 (n ≤ 1 → 기본색, 아니면 n−2)  → +0x14
 *      덧그림   `item_bat_hand_{2_0 · 3·5 → 35_0 · 6_0 · 그 밖 014_0}`               → +0x20
 *   손 n ≥ 7    `item_bat_hand_{n}`                                → +0x14 (덧그림 없음)
 *   손 셋째     n ∈ {1,4,5} 면 `item_bat_hand_{n}_1`               → +0x44
 *   다리 n ≤ 6  `item_bat_leg_0` + `.mpl` 줄 n−1                   → +0x28
 *   다리 n ≥ 7  `item_bat_leg_7` + `.mpl` 줄 n−8                   → +0x28
 * 벌 수도 딱 맞는다 — item_bat_hand 5벌(n 2~6) · leg_0 6벌(n 1~6) · leg_7 3벌(n 8~10).
 */
const HAND_OVERLAY_NAMES: Readonly<Record<number, string>> = { 2: '2_0', 3: '35_0', 5: '35_0', 6: '6_0' }
const HAND_THIRD_GRADES = [1, 4, 5]

function headItemLayer(grade: number, frame: number): BatterLayer | null {
  return grade < 0 ? null : { folder: `${SPRITES}/item_bat_head_${grade}/frames`, frame }
}

function handLayer(grade: number, frame: number): BatterLayer {
  // 손 장비가 없으면 원본도 기본 배트를 쥔다 (0x78c88 — 몸통 적재가 +0x14 에 batter_batter 를 넣는다)
  if (grade < 0) return { folder: BAT, frame }
  if (grade >= FIRST_HIDDEN_GRADE) return { folder: `${SPRITES}/item_bat_hand_${grade}/frames`, frame }
  // n ≤ 1 은 원본도 줄 −1 = 기본색이라 벌을 안 붙인다
  const folder = `${SPRITES}/item_bat_hand/frames`
  return grade <= 1 ? { folder, frame } : { folder, frame, gradePaletteRow: grade - 2 }
}

function handOverlayLayer(grade: number, frame: number): BatterLayer | null {
  if (grade < 0 || grade >= FIRST_HIDDEN_GRADE) return null
  return { folder: `${SPRITES}/item_bat_hand_${HAND_OVERLAY_NAMES[grade] ?? '014_0'}/frames`, frame }
}

function handThirdLayer(grade: number, frame: number): BatterLayer | null {
  if (!HAND_THIRD_GRADES.includes(grade)) return null
  return { folder: `${SPRITES}/item_bat_hand_${grade}_1/frames`, frame }
}

/** 슈즈를 신지 않으면 다리 레이어가 **아예 없다** (0x78e24 `s8[+0x41] < 0` 이면 슬롯을 비워 둔다) */
function legItemLayer(grade: number, frame: number): BatterLayer | null {
  if (grade < 0) return null
  // 줄 −1 (n = 0 · 7) 은 기본색이라 벌을 안 붙인다
  const folder = grade >= FIRST_HIDDEN_GRADE ? `${SPRITES}/item_bat_leg_7/frames` : `${SPRITES}/item_bat_leg_0/frames`
  const row = grade >= FIRST_HIDDEN_GRADE ? grade - 8 : grade - 1
  return row < 0 ? { folder, frame } : { folder, frame, gradePaletteRow: row }
}

/**
 * 원본 "폼" = 선수 레코드 `rec[0xb]` 의 **윗니블 = 2 × 타입 + 손** (C 5절 0x16f9a).
 * 몸통 파일 적재 0x78ab0 이 그 니블로 고른다 — `≤ 1 → bat/batter_balancer · 2·3 → bat/batter_sluger`
 * (C-create-palette 127행). 곧 **t = 폼 >> 1 = 타입**(0 타격형 · 1 장타형)이다.
 * 웹은 `career.battingTypeIndex`(타입) 와 `career.battingSide`(손) 를 들고 있어 폼을 그대로 만들 수 있다.
 */
export function bodyTypeOf(form: number): number {
  return Math.max(0, Math.trunc(form)) >> 1 === 0 ? 0 : 1
}

/**
 * 레이어 한 겹이 쓸 대체 팔레트(.mpl) 번호 — 없으면 null (C-1 확정).
 *   몸통 `bat/batter_balancer`·`batter_sluger` → **피부 × 15 + 팀** (0x78be8)
 *   헬멧 `bat/batter_helmet`                  → **팀** (0x78c14 — 헬멧엔 피부가 없다)
 * 그림자·기본 배트·잔상은 .mpl 이 아예 없어 원본도 구운 색 그대로 그린다
 * (장비 손·다리는 .mpl 이 있지만 팀이 아니라 **등급**으로 갈려서 `gradePaletteRow` 쪽이다).
 *
 * 순수 함수라 캔버스가 없는 곳(테스트)에서도 쓸 수 있다. 실제로 칠하는 것은 두 갈래다 —
 * <img> 는 `shared/lib/sprite/paletteSwap.ts` 의 `useRecoloredSprite`(등록·수비·초상화),
 * 캔버스(타석)는 `spriteLoader.placedFrame(folder, frame, paletteIndex)` 가 맡는다.
 */
export function batterLayerPaletteIndex(folder: string, skinIndex: number, teamIndex: number): number | null {
  if (folder === BODY_FOLDERS[0] || folder === BODY_FOLDERS[1]) return outfitPaletteIndex(skinIndex, teamIndex)
  if (folder === HELMET) return teamIndex
  return null
}

/**
 * 레이어 한 겹을 칠할 팔레트 번호 — 장비(손·다리)는 **등급 줄**, 몸통·헬멧은 피부×15+팀.
 * 한 레이어가 둘을 같이 쓰는 일은 없다 (장비 폴더는 `batterLayerPaletteIndex` 가 null 을 준다).
 *
 * ⚠️ `??` 여야 한다 — 등급 줄 **0 은 진짜 0번 벌**이라 `||` 로 쓰면 기본색으로 새어 나간다.
 * 장비 폴더는 `palette.json` 의 `baked` 가 null(= 구운 그림이 벌 목록 밖)이라 줄 0 도 갈아 끼운다.
 */
export function layerPaletteIndexOf(layer: BatterLayer, skinIndex: number, teamIndex: number): number | null {
  return layer.gradePaletteRow ?? batterLayerPaletteIndex(layer.folder, skinIndex, teamIndex)
}

interface PoseTable {
  readonly idle: readonly number[]
  readonly swingStart: number
  readonly swingLength: number
  readonly bunt: number
}

/** u > 4(일반 타자) 분기 — v 0·1 과 v 2·3 */
const POSES: readonly PoseTable[] = [
  { idle: [0, 1, 2, 3], swingStart: 6, swingLength: 7, bunt: 13 },
  { idle: [0, 1, 2, 3, 4], swingStart: 7, swingLength: 5, bunt: 12 },
]
/** 대기 칸은 카운터가 지연 3 에 닿으면 넘어간다 → 칸마다 4틱 */
const IDLE_TICKS_PER_FRAME = 4

export interface BatterPoseInput {
  /** 지금 틱 */
  readonly tick: number
  /** 스윙을 누른 틱. 스윙 중이 아니면 null */
  readonly swingTick: number | null
  readonly isBunting: boolean
  readonly bodyType: number
}

export function batterFrameAt({ tick, swingTick, isBunting, bodyType }: BatterPoseInput): number {
  const pose = POSES[bodyType] ?? POSES[0]
  if (isBunting) return pose.bunt
  if (swingTick !== null) {
    const elapsed = tick - swingTick
    if (elapsed >= 0 && elapsed < pose.swingLength) return pose.swingStart + elapsed
  }
  const cell = Math.floor(Math.max(0, tick) / IDLE_TICKS_PER_FRAME) % pose.idle.length
  return pose.idle[cell]
}

/** 겹침 규칙 표 order[f + adj] (0xd3a54) */
const ORDER_RULES = [
  [1, 1, 1, 1, 0, 0, 1, 1, 2, 1, 1, 1, 1, 2],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 1, 1, 3],
]
const SLUGER_ADJUST = 14
const FRONT_OFFSETS = [14, 13]
const GHOST_FRAMES = [8, 9]
const GHOST_BALANCER_OFFSET = 6
const GHOST_SLUGER_OFFSET = 8
const GHOST_SLOT = 4
const GHOST_SLOT_LATE = 1

/**
 * 자세 f 의 레이어 목록 — `equipment` 를 안 주면 아무것도 장착하지 않은 선수다.
 *
 * 슬롯 0~8 = 그림자 · 몸통 · 헬멧 · 머리아이템 · 배트(손) · 몸통앞 · 손덧그림 · 손셋째 · 다리.
 * 규칙 1·2·3 의 자리바꿈(0x78e54·0x78e66·0x78e88)을 슬롯 순서 표로 적어 둔 것이라
 * 아이템 슬롯도 그 표의 빈 자리에 그대로 들어간다 (바이트 단위로 다시 확인했다).
 */
export function batterLayersOf(frame: number, bodyType: number, equipment: BatterEquipment = NO_EQUIPMENT): BatterLayer[] {
  const type = bodyType === 1 ? 1 : 0
  const adjust = type === 1 ? SLUGER_ADJUST : 0
  const body: BatterLayer = { folder: BODY_FOLDERS[type], frame }
  const front: BatterLayer = { folder: BODY_FOLDERS[type], frame: frame + FRONT_OFFSETS[type] }
  const shadow: BatterLayer = { folder: SHADOW, frame: frame + adjust }
  // 머리 장비가 등급 2 이상이면 원본은 **헬멧을 지운다** (0x78df4 — 헬멧 슬롯에 0 을 넣는다)
  const helmet: BatterLayer | null = equipment.head > 1 ? null : { folder: HELMET, frame: frame + adjust }
  const head = headItemLayer(equipment.head, frame + adjust)
  const bat = handLayer(equipment.hand, frame + adjust)
  const handOverlay = handOverlayLayer(equipment.hand, frame + adjust)
  const handThird = handThirdLayer(equipment.hand, frame + adjust)
  const leg = legItemLayer(equipment.leg, frame + adjust)

  const rule = ORDER_RULES[type][frame] ?? 0
  const slots: (BatterLayer | null)[] =
    rule === 1
      ? [shadow, body, helmet, head, front, bat, handOverlay, handThird, leg]
      : rule === 2
        ? [shadow, bat, body, helmet, head, front, handOverlay, handThird, leg]
        : rule === 3
          ? [shadow, bat, handOverlay, handThird, front, body, helmet, head, leg]
          : [shadow, body, helmet, head, bat, front, handOverlay, handThird, leg]

  if (GHOST_FRAMES.includes(frame)) {
    const ghost: BatterLayer = { folder: GHOST, frame: frame - (type === 0 ? GHOST_BALANCER_OFFSET : GHOST_SLUGER_OFFSET) }
    const after = frame === GHOST_FRAMES[1] ? GHOST_SLOT_LATE : GHOST_SLOT
    slots.splice(after + 1, 0, ghost)
  }
  return slots.filter((layer): layer is BatterLayer => layer !== null)
}

/* ── 투수 장비 레이어 (적재 0x79790 · 겹치기 0x79524 — 이번에 다시 떠서 확인했다) ───────── */

/**
 * **투수 장비 부위별 등급 순번** (0~10, −1 = 미장착).
 *
 * 적재 `0x79790(그림객체, 부위, n)` 은 타자 `0x78fd8` 과 **인자 모양이 똑같다** —
 * 부위 0 머리(모자) · 1 손(글러브) · 2 몸(아대) · 3 다리(신발) 이고 `객체+0x3e+부위 = n`
 * 이다 (0x797c2 `adds r3,r4,r7 / adds r3,#0x3e / strb r5,[r3]` — 타자도 0x79088 에서 같은 칸).
 * `n < 0` 이면 슬롯 그림만 풀고 끝낸다 (0x797b2).
 *
 * **타자와 다른 곳 넷** (직접 대조했다):
 *   1. 슬롯 주소가 **부위 번호와 1:1** 이다 — `+0x1c + 부위×4` (0x79792 `lsls r3,r1,#2`) 라
 *      머리 +0x1c · 손 +0x20 · 몸 +0x24 · 다리 +0x28. 타자는 손이 +0x14(기본 배트 자리)·
 *      덧그림 +0x20 · 셋째 겹 +0x44 로 흩어져 있다.
 *   2. 부위 2 가 타자는 **그림 자체가 없고**(0x7907c `cmp r6,#2` → 반환), 투수는
 *      **등급 7 이상만** `item_pit_body_{n}` 이 있다 (0x797b8~0x797c0 `부위 2 && n ≤ 6 → 반환`).
 *   3. 손 파일 규칙이 타자는 `item_bat_hand` 한 장 + 줄 n−2 + 덧그림/셋째 겹인데,
 *      투수는 **다리와 글자 하나까지 같은** `_0`/`_7` 두 장 + 줄 n−1 / n−8 이다.
 *   4. 겹침 순서가 타자는 자세마다 바뀌는 표(0xd3a54)에 sluger +14 보정까지 있는데,
 *      투수는 **고정 여섯 칸**이고 프레임 보정이 전혀 없다 (`pitcherLayersOf`).
 */
export interface PitcherEquipment {
  /** 부위 0 모자 (StrITEM 44~54) */
  readonly head: number
  /** 부위 1 글러브 (55~65) */
  readonly hand: number
  /** 부위 2 아대·선글라스·스카우터… (66~76) — **등급 6 이하는 그림이 없다** */
  readonly body: number
  /** 부위 3 신발 (77~87) */
  readonly leg: number
}

export const NO_PITCHER_EQUIPMENT: PitcherEquipment = { head: -1, hand: -1, body: -1, leg: -1 }

/**
 * 니블 묶음(`PitcherCareer.equipmentLevels` = 제구·구속·변화·체력) → 부위별 등급 순번.
 * 니블 → 순번은 타자와 같은 `equipmentGradeOf`(n = 니블 − 1)다.
 *
 * ⚠️ **추정**: 부위 ↔ 능력치 짝은 타자 쪽 규칙("부위 i = 능력치 i", 0x10866 루프)을 그대로 옮긴 것이다 —
 *    모자 = 제구 · 글러브 = 구속 · 아대 = 변화 · 신발 = 체력. 원본 투수 상점에서 부위와 능력치를
 *    맺어 주는 자리는 아직 안 떴다 (웹 `pitcherCareer.effectiveAbilityOf` 도 이미 같은 차례를 쓴다).
 */
export function pitcherEquipmentOf(nibbles: {
  control: number
  velocity: number
  breaking: number
  stamina: number
}): PitcherEquipment {
  return {
    head: equipmentGradeOf(nibbles.control),
    hand: equipmentGradeOf(nibbles.velocity),
    body: equipmentGradeOf(nibbles.breaking),
    leg: equipmentGradeOf(nibbles.stamina),
  }
}

const PITCHER_HEAD_FOLDER = (grade: number) => `${SPRITES}/item_pit_head_${grade}/frames`
const PITCHER_BODY_FOLDER = (grade: number) => `${SPRITES}/item_pit_body_${grade}/frames`
/** 기본 `_0`(등급 0~6) · 히든 `_7`(7~10) 두 장뿐이고 나머지는 `.mpl` 줄로 갈린다 */
const PITCHER_HAND_FOLDERS = [`${SPRITES}/item_pit_hand_0/frames`, `${SPRITES}/item_pit_hand_7/frames`]
const PITCHER_LEG_FOLDERS = [`${SPRITES}/item_pit_leg_0/frames`, `${SPRITES}/item_pit_leg_7/frames`]

/**
 * 손·다리 한 겹 — `_0` + 줄 n−1 (0x79870·0x79832) · `_7` + 줄 n−8 (0x79888·0x7984a).
 * 줄이 음수(n = 0 · 7)면 **그림 기본색**이라 벌을 아예 안 붙인다 (0xb9718 넷째 인자 −1).
 *
 * ⚠️ 앞 작업 메모와 `public/sprites/item_pit_…` 폴더 `palette.json` 의 `select` 주석은 손과 다리의
 *    주소가 **뒤바뀌어** 있다 — 0x79832·0x7984a 는 다리 가지([r7+0x28]), 0x79870·0x79888 이
 *    손 가지([r7+0x20])다. 식(n−1 / n−8)은 두 부위가 같아 결과는 달라지지 않는다.
 */
function pitcherGradeLayer(folders: readonly string[], grade: number, frame: number): BatterLayer | null {
  if (grade < 0) return null
  const isHidden = grade >= FIRST_HIDDEN_GRADE
  const folder = folders[isHidden ? 1 : 0]
  const row = isHidden ? grade - 8 : grade - 1
  return row < 0 ? { folder, frame } : { folder, frame, gradePaletteRow: row }
}

/**
 * 자세 f 의 투수 레이어 여섯 칸 — 그리기 `0x79524` 의 `+0x3d < 0` 갈래가 쌓는 순서 그대로다
 * (0x7961e~0x79692, 칸 배열 sp+0x4c / 프레임 배열 sp+0x34):
 * ```
 * 0 바탕 pitcher.pzx  프레임 f            [+0x0c]
 * 1 머리 아이템       프레임 f            [+0x1c]  (obj[0x3e] ≥ 0 일 때만, 0x79644)
 * 2 몸  아이템        프레임 f            [+0x24]  (obj[0x40] ≥ 0 일 때만, 0x79658)
 * 3 바탕 pitcher.pzx  프레임 f + 0x16     [+0x0c]  ← 조건 없이 늘 쌓인다 (0x79664 adds r3,#0x16)
 * 4 손  아이템        프레임 f            [+0x20]  (obj[0x3f] ≥ 0 일 때만, 0x79674)
 * 5 다리 아이템       프레임 f            [+0x28]  (obj[0x41] ≥ 0 일 때만, 0x7968a)
 * ```
 * 빈 칸은 그리기 루프(0x7969a `cmp r2,#0 / beq`)가 건너뛴다 — 여기서도 `null` 을 걸러 낸다.
 * **아이템 칸에는 프레임 보정이 없다** — 여섯 칸 모두 같은 f 이고 3번 칸만 +22 다.
 */
export function pitcherLayersOf(
  frame: number,
  equipment: PitcherEquipment = NO_PITCHER_EQUIPMENT,
): BatterLayer[] {
  const slots: (BatterLayer | null)[] = [
    { folder: PITCHER_FRAMES, frame },
    equipment.head < 0 ? null : { folder: PITCHER_HEAD_FOLDER(equipment.head), frame },
    // 등급 6 이하는 원본이 그림 객체를 아예 안 만든다 — 칸이 비어 그리기 루프가 건너뛴다
    equipment.body < FIRST_HIDDEN_GRADE ? null : { folder: PITCHER_BODY_FOLDER(equipment.body), frame },
    { folder: PITCHER_FRAMES, frame: frame + PITCHER_OVERLAY_FRAME_OFFSET },
    pitcherGradeLayer(PITCHER_HAND_FOLDERS, equipment.hand, frame),
    pitcherGradeLayer(PITCHER_LEG_FOLDERS, equipment.leg, frame),
  ]
  return slots.filter((layer): layer is BatterLayer => layer !== null)
}
