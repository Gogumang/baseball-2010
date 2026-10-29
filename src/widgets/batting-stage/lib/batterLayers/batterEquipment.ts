/** 타자 장비 등급(니블 → 순번)과 장비 겹(머리 · 손 · 다리) */
import { BAT, type BatterLayer, SPRITES } from '@/widgets/batting-stage/lib/batterLayers/batterFolders'

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
export const FIRST_HIDDEN_GRADE = 7

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

export function headItemLayer(grade: number, frame: number): BatterLayer | null {
  return grade < 0 ? null : { folder: `${SPRITES}/item_bat_head_${grade}/frames`, frame }
}

export function handLayer(grade: number, frame: number): BatterLayer {
  // 손 장비가 없으면 원본도 기본 배트를 쥔다 (0x78c88 — 몸통 적재가 +0x14 에 batter_batter 를 넣는다)
  if (grade < 0) return { folder: BAT, frame }
  if (grade >= FIRST_HIDDEN_GRADE) return { folder: `${SPRITES}/item_bat_hand_${grade}/frames`, frame }
  // n ≤ 1 은 원본도 줄 −1 = 기본색이라 벌을 안 붙인다
  const folder = `${SPRITES}/item_bat_hand/frames`
  return grade <= 1 ? { folder, frame } : { folder, frame, gradePaletteRow: grade - 2 }
}

export function handOverlayLayer(grade: number, frame: number): BatterLayer | null {
  if (grade < 0 || grade >= FIRST_HIDDEN_GRADE) return null
  return { folder: `${SPRITES}/item_bat_hand_${HAND_OVERLAY_NAMES[grade] ?? '014_0'}/frames`, frame }
}

export function handThirdLayer(grade: number, frame: number): BatterLayer | null {
  if (!HAND_THIRD_GRADES.includes(grade)) return null
  return { folder: `${SPRITES}/item_bat_hand_${grade}_1/frames`, frame }
}

/** 슈즈를 신지 않으면 다리 레이어가 **아예 없다** (0x78e24 `s8[+0x41] < 0` 이면 슬롯을 비워 둔다) */
export function legItemLayer(grade: number, frame: number): BatterLayer | null {
  if (grade < 0) return null
  // 줄 −1 (n = 0 · 7) 은 기본색이라 벌을 안 붙인다
  const folder = grade >= FIRST_HIDDEN_GRADE ? `${SPRITES}/item_bat_leg_7/frames` : `${SPRITES}/item_bat_leg_0/frames`
  const row = grade >= FIRST_HIDDEN_GRADE ? grade - 8 : grade - 1
  return row < 0 ? { folder, frame } : { folder, frame, gradePaletteRow: row }
}
