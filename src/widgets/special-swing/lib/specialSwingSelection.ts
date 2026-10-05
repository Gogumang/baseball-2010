/**
 * 필살타법 창의 **칸 → 기술 번호** 와 두 키 처리 규칙 (H-4 · R7 4절 확정).
 *
 * 원본은 같은 창 그림(0x803d4)을 두 상태가 나눠 쓴다:
 *   - 상태 **0x7b** (선수정보 칸 3) — 배운 기술 중 하나를 **고른다**. 키 처리 `0x17cec`, StrMODE[69]~[71]
 *   - 상태 **0x6c** (트레이닝 칸 4) — 다음 칸을 **배운다**.     키 처리 `0x17828`, StrMODE[62]~[66]
 * 웹도 창은 하나라 `mode` 로 갈라 쓴다.
 */
import { BATTER_BURSTS } from '@/shared/config/original/bursts'

/** 칸 → 기술 번호 표 (타자 `0xcc378` · 투수 `0xcc368`, 둘 다 [1,2,3,4]) */
export const SPECIAL_SWING_SLOT_NUMBERS: readonly number[] = [1, 2, 3, 4]
/** 넷째 칸만 `4 + 타입`(레코드 +0xb 상위 3비트)이다 */
const TYPED_NUMBER = 4

/**
 * 칸 i 의 기술 번호 — `표[i]`, 다만 번호가 4 면 **`4 + 타입`** 이다 (0x17828·0x17cec 공통).
 * 타격형(0)이면 4 = 미라지 스윙, 장타형(1)이면 5 = 메테오 스윙.
 */
export function specialSwingNumberOf(slot: number, battingTypeIndex: number): number {
  const number = SPECIAL_SWING_SLOT_NUMBERS[slot] ?? SPECIAL_SWING_SLOT_NUMBERS[0]
  return number === TYPED_NUMBER ? TYPED_NUMBER + battingTypeIndex : number
}

/**
 * 칸 i 를 골랐을 때 **선수 +0x18 에 실제로 쓰는 번호** — 표 `0xcc378[i]` 그대로(1~4)다
 * (0x18166~0x1816c `ldr 표[칸] → strb [선수+0x18]`, H2 2절 확정). 넷째 칸도 타입을 안 더한다.
 */
export function specialSwingStoredNumberOf(slot: number): number {
  return SPECIAL_SWING_SLOT_NUMBERS[slot] ?? SPECIAL_SWING_SLOT_NUMBERS[0]
}

/** 기술 이름 — `StrCOMMON[24 + 번호]`. `BATTER_BURSTS` 가 0-기준이라 1 을 뺀다 */
export function specialSwingNameOf(number: number): string {
  return BATTER_BURSTS[number - 1] ?? ''
}

/**
 * 아직 아무것도 안 고른 상태. 원본은 선수 레코드 **+0x18** 에 고른 번호를 들고 있는데
 * 그 칸의 **초기값은 문서에 없다** — 0 을 "안 고름" 으로 둔다 (**추정**).
 */
export const NO_SPECIAL_SWING_NUMBER = 0

/**
 * 상태 0x7b (기술 고르기) 의 결과 — 어느 StrMODE 를 띄울지.
 * `'묻기'` 의 `number` 는 **저장할 번호**(1~4)이고 `name` 은 `4 + 타입` 으로 고른 이름이다.
 */
export type SpecialSwingPick =
  | { readonly kind: '사용중' }
  | { readonly kind: '미습득' }
  | { readonly kind: '묻기'; readonly number: number; readonly name: string }

/**
 * 기술 고르기 키 처리 `0x17cec` (확인 키 −5 / '5', 탭 0·1, H-4 확정):
 *
 * ```
 * 1. 이미 사용 중(0xa43c4: 레코드 +0x18 == 번호)  → StrMODE[69] "현재 사용 중인 스킬입니다"
 * 2. 배운 수(저장 +0x201) ≤ i                     → StrMODE[71] "트레이닝 완료 후 사용할 수 있습니다"
 * 3. 그 밖                                        → StrMODE[70] "[이름] 을 사용하시겠습니까?"
 * ```
 * 1 의 비교값은 `0xa43c4(선수, 칸)` = `칸+1, 그게 4 면 + 타입` 이다 — 그런데 저장은 `표[칸]`(4)이라
 * ⚠️ **원본 그대로의 어긋남**: 장타형(타입 1)이 메테오 스윙을 고르면 +0x18 = 4 인데 비교값은 5 라,
 * 다시 골라도 "사용 중" 이 안 뜨고 주황 아이콘(0x803d4 도 같은 0xa43c4)도 안 붙는다. 고치지 않는다.
 */
export function specialSwingPickOf(
  slot: number,
  battingTypeIndex: number,
  learnedCount: number,
  selectedNumber: number,
): SpecialSwingPick {
  const number = specialSwingNumberOf(slot, battingTypeIndex)
  if (number === selectedNumber) return { kind: '사용중' }
  if (learnedCount <= slot) return { kind: '미습득' }
  return { kind: '묻기', number: specialSwingStoredNumberOf(slot), name: specialSwingNameOf(number) }
}
