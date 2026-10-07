import type { OriginalMission } from '@/shared/config/original/missions'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'

/**
 * **마선수 대결도 미션 클리어 칸을 올린다** — 미션 끝 0x509a0 → `0xa5368(미션객체, 목표 달성?)` (직접 떴다).
 *
 * ```
 * 8d878  SYS 8(match): 0x1fa55(저장, 모드) 의 +0xbf = 모드(투수편 5 · 타자편 6) · +0xbd = team − 1   ; g[0x175] / g[0xf7] 와 같은 값
 *        (투수편이면 g[0x176] = 1, 타자편이면 g[0x11f] = 1) 뒤 0xa5368(obj, 0)
 * a5368  편 = (+0xbf == 6) ? 0 : 1
 *        성공 && (s8)[+0xbd] ≤ 15 일 때만:
 *          [+0xa0] = 0xa52b0(obj)                      ; 보상액 — 대결은 0x4ef3e 가 g[0x11f]·g[0x176] 을 보고 지급을 건너뛴다
 *          횟수 = (s8)(전역기록 +0x150 + 편×16 + idx) + 1, 99 에서 멈춤
 *          idx ≤ 12 이고 다음 칸이 −1 이면 다음 미션을 연다   ; 대결 idx 는 15 이상이라 안 탄다
 *          저장 0x1f1b9
 *        [+0xbc] = 성공
 * ```
 * 0xa5368 은 g[0x11f]·g[0x176] 을 안 본다 — 그래서 이벤트 데이터의 team 16~20(레코드 15~19) 가운데 **team 16(레코드 15)** 을
 * 이겼을 때만 그 편의 15번 칸이 오른다(투수편 g[0x176] · 타자편 g[0x11f] 모두 같은 길). 17~20 은 idx > 15 라 건너뛴다.
 *
 * 15번 칸은 목록에 없는 대결 레코드 칸이라 새 저장 0x9f26c 의 `memset(+0x150, 0xff, 32)` 이 −1(잠김)로 둔 채이고
 * (0번·14번 칸만 0 으로 연다), 보통 미션 해금(idx ≤ 12 → idx + 1)도 닿지 않는다 — **첫 승리는 −1 → 0**, 그 뒤로 1, 2, ….
 * 웹 기록(`편:번호` → 횟수)에서 이 칸이 없으면 원본 −1 로 읽는다.
 */
export const ACE_MATCH_CLEAR_LAST_INDEX = 15
const LOCKED = -1
const MAXIMUM_CLEARS = 99

/** 대결 레코드가 클리어 칸을 올리는가 — idx = 레코드 번호 = `mission.id − 1` ≤ 15 */
export function aceMatchClearKeyOf(mission: OriginalMission): string | null {
  return mission.id - 1 <= ACE_MATCH_CLEAR_LAST_INDEX ? missionKeyOf(mission) : null
}

/** 대결을 이긴 뒤의 칸 값 — 없던 칸은 −1(새 저장) 에서 센다, 99 에서 멈춘다 */
export function aceMatchClearCountAfterWin(previous: number | undefined): number {
  return Math.min(MAXIMUM_CLEARS, (previous ?? LOCKED) + 1)
}
