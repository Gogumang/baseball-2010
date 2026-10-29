import type { CpuSpecialSwingInput, CpuSwingChoice } from '@/entities/pitching/model/simulateBatter/types'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 0x3445a — 번트 종류 rand(1,4) → 1·2·3 (사람 번트 키 '8'=1 · '7'=2 · '9'=3 과 같은 칸 +0xfdc) */
const BUNT_KIND_MINIMUM = 1
const BUNT_KIND_LIMIT = 4
/** 번트 종류 칸 +0xfdc 의 0 — 보통 스윙 */
const NO_BUNT = 0
/** 필살 번호 칸 S+0x10 의 0 — 보통 스윙 */
const NO_SPECIAL_SWING = 0

/**
 * 휘두르기로 정한 뒤 번트 종류 — 원본 0x34446~0x34464 (타이밍 0x340f8 **다음**에 돈다).
 *
 * ```
 * scene[+0xfdc] = 0
 * if choice == 1 and not 0xb633d(타자): scene[+0xfdc] = rand(1,4)   ; 번트 1~3
 * ```
 * 마선수(0xb633d = 레코드 [10] 비트6)는 번트 칸을 뽑아도 번트하지 않고 그냥 친다.
 * 난수는 번트할 때만 한 번 돈다. 0 이면 보통 스윙이다.
 */
export function cpuBuntKindOf(choice: CpuSwingChoice, isMagicBatter: boolean, random: RandomPort): number {
  if (choice !== '번트' || isMagicBatter) return NO_BUNT
  return random.rand(BUNT_KIND_MINIMUM, BUNT_KIND_LIMIT)
}

/**
 * CPU 타자의 이번 스윙 필살 번호 (`[scene+0xf9c]+0x10`) — 원본 0x34442~0x34488. 0 이면 보통 스윙.
 *
 * ```
 * 34444  [+0xf9c][+0x10] = 0                                  ; 새 공마다 지운다
 * 34446  if choice == 1 and not 0xb633d(타자): 번트 (필살 없음)
 * 34468  elif 0xb633d(타자) and 0xaea30(팀) != 0:
 * 34488      [+0xf9c][+0x10] = 타자[+0x18]
 * 0xaea30(팀) = 타자[+0x18] == 0 ? 0 : s8 팀[+0x29 + 팀[+0x32]]
 * ```
 * 즉 **마타자는 휘두를 때마다, 번호가 있고 남은 횟수가 0 이 아니면 무조건 필살**이다 —
 * 번트 칸을 뽑아도 필살 스윙이다. 일반 CPU 타자는 번호가 있어도 절대 쓰지 않는다
 * (S+0x10 에 CPU 가 쓰는 곳은 여기 하나, Q1 5절). 난수는 쓰지 않는다.
 *
 * `pitchAgainstBatterDetailed` 가 이 값을 잇는다 — 보정 구조체 0x34d6c 타자 쪽(마타자 레벨 표),
 * 스윙 순간 소모 0x4e136, 맞은 공의 성공 굴림 0x34c74(마타자 30%).
 */
export function cpuSpecialSwingNumberOf(input: CpuSpecialSwingInput): number {
  // 일반 타자는 번트든 치기든 0, 마타자는 번트 갈래(0x34446)로 안 가니 표 선택과 무관하다
  if (!input.isMagicBatter) return NO_SPECIAL_SWING
  if (input.swingNumber === NO_SPECIAL_SWING) return NO_SPECIAL_SWING
  return input.remaining !== 0 ? input.swingNumber : NO_SPECIAL_SWING
}
