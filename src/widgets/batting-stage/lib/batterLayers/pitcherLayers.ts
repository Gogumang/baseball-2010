/** 투수 장비 등급과 투수 겹 여섯 칸 (0x79524) */
import { FIRST_HIDDEN_GRADE, equipmentGradeOf } from '@/widgets/batting-stage/lib/batterLayers/batterEquipment'
import { type BatterLayer, SPRITES } from '@/widgets/batting-stage/lib/batterLayers/batterFolders'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import { PITCHER_OVERLAY_FRAME_OFFSET } from '@/widgets/batting-stage/lib/stageScenery'

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
 * 부위 ↔ 능력치 짝은 **확정**이다 — 모자 = 제구 · 글러브 = 구속 · 아대 = 변화 · 신발 = 체력.
 *    능력치 효과 0xb6414 가 칸 k 에 니블 k(`rec[0x19 + k/2]`, k 짝수 = 상위)를 더하고, 투수 상점 구매(0x14a74)가
 *    부위 row 를 같은 니블 row 에 넣는다 (d15c14d · `pitcherEquipment.ts`). 웹 `pitcherCareer.effectiveAbilityOf` 도 같은 차례다.
 *
 * **원본에서 이 값이 어디서 와서 어디로 가는가** (0x108f8 · 0x10810 을 이번에 떠서 확인했다):
 *   경기 장면을 세우는 0x108f8 은 **그림 한 칸**(장면+0xe4)만 만들고, 전역 모드(장면+0xcc)로
 *   갈래를 탄다 — `mode == 4`(타자편)면 0x54 바이트 + 타자 그림 생성자 0x789f0,
 *   **아니면 0x4c 바이트 + 투수 그림 생성자 0x79368** 이다 (0x109d4~0x109fc).
 *   즉 **투수 장비를 입는 그림은 "내 투수"(모드 3 투수편) 하나뿐**이고, 타석 화면 마운드의
 *   상대 투수는 이 객체가 아니다.
 *   이어서 0x10a14 가 부르는 0x10810 의 루프(0x10866~0x1089a)가 **두 모드 공용**으로
 *   선수 레코드 니블을 읽어 `그림객체->vtbl[0x14](부위 i, 니블−1)` 를 부른다 —
 *   타자면 0x78fd8, **투수면 0x79790** 이다 (vtbl 0xd3a3c / 0xd3ce0, 둘 다 +0x14 칸).
 *   니블 자리도 같다: 부위 0·1 = `rec[0x19]` 의 상·하위, 부위 2·3 = `rec[0x1a]` 의 상·하위이고
 *   `니블 − 1 < 0` 이면 그 부위를 건너뛴다(미장착).
 */
export function pitcherEquipmentOf(nibbles: { control: number; velocity: number; breaking: number; stamina: number }): PitcherEquipment {
  return {
    head: equipmentGradeOf(nibbles.control),
    hand: equipmentGradeOf(nibbles.velocity),
    body: equipmentGradeOf(nibbles.breaking),
    leg: equipmentGradeOf(nibbles.stamina),
  }
}

/**
 * 레코드 니블 네 칸(제구 · 구속 · 변화 · 체력 = 부위 0~3, `rec[0x19 + k/2]`, k 짝수 = 윗니블) → 투수 장비 겹.
 * 타석 교대 0x47cc8 의 48138~4816a 가 마운드 투수(0xae83c(수비 팀))가 마투수가 아니면 이 니블 − 1 로 0x79790 을 부른다(모드 무관).
 * 없으면(undefined) 맨몸이다.
 */
export function pitcherEquipmentOfNibbles(nibbles: readonly number[] | undefined): PitcherEquipment {
  if (nibbles === undefined) return NO_PITCHER_EQUIPMENT
  const [control = 0, velocity = 0, breaking = 0, stamina = 0] = nibbles
  return pitcherEquipmentOf({ control, velocity, breaking, stamina })
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
 * ⚠️ 0x79790 의 갈래 차례가 **다리(부위 3) 먼저 · 손(부위 1) 나중**이라 위에서 아래로 읽으면
 *    손과 다리가 뒤집힌다. 0x79832·0x7984a 가 다리 가지(리터럴 `item/item_pit_leg_0|_7.mpl`,
 *    `str r0,[r7,#0x28]`), 0x79870·0x79888 이 손 가지(`item/item_pit_hand_0|_7.mpl`,
 *    `str r0,[r7,#0x20]`)다. `palette.json` 의 `select` 주석은 13a24c0 에서 이미 바로잡혔다.
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
export function pitcherLayersOf(frame: number, equipment: PitcherEquipment = NO_PITCHER_EQUIPMENT): BatterLayer[] {
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
