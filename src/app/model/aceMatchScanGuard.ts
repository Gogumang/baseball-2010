import { isAceMatchHeld } from '@/entities/mode-save/model/modeSave'
import type { AceMatchHoldPort } from '@/entities/mode-save/model/modeSave'
import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * **자동 훑기 0x1cf9c 의 대결 대기 가드** (1cfe4~1d008, 직접 떴다 — 나리 두 편 공용):
 * ```
 * 1cfdc  [다음] − 0x72 ≤ 1 (114 · 115 예약) → 건너뜀
 * 1cfe4  전역기록 g[0x11f] ≠ 0 → 건너뜀              ; 타자편 대결 대기
 * 1cff8  전역기록 g[0x176] ≠ 0 → 건너뜀              ; 투수편 대결 대기
 * 1d02c  0x8be81(관리자, 모드, 상태 105 | 112, …)     ; 훑기
 * ```
 * 모드를 보지 않는다. 105 진입 곁가지(0x11b46~0x11bbe)는 **제 편** 칸만 보고 140 으로 보내므로(그 길은 위 가드가 아니어도 이미
 * 막힌다), 이 가드가 따로 막는 것은 **다른 편** 대결 대기뿐이다 — 투수편 대결을 나가기로 그만두면(미션 나가기는 칸을 안 지운다)
 * 투수편 105 에 다시 들어가 140 을 볼 때까지 타자편 105 · 112 의 자동 이벤트가 하나도 안 선다(반대도 같다). 원본 버그 B-124.
 * **고친 길**(기본): 다른 편 대기는 보지 않는다 — 제 편 대기는 105 진입이 먼저 140 으로 보내므로 훑기에 닿지 않는다.
 * 원본 길은 건너뛴 훑기가 굴리지 않으므로(0x8be80 의 무작위 조건) 그 진입만큼 난수를 덜 쓴다.
 */
export function isAutoScanHeldByAceMatch(hold: AceMatchHoldPort | undefined): boolean {
  if (hold === undefined || isBugFixed('B-124')) return false
  return isAceMatchHeld(hold.read())
}
