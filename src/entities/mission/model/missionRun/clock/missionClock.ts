import type { MissionRun } from '@/entities/mission/model/missionRun/types'

/** 0xaa940(미션, 1, 남은 초) — 남은 초가 이 값에 닿으면 실패 */
const LAST_SECOND = 1

/** aae18~aae1e — `0xfa << 2` = 1000ms. 이 값을 **넘어야**(같으면 아님, `bls`) 1초를 뺀다 */
const MISSION_SECOND_MILLISECONDS = 1000

/**
 * 시간을 흘린다. **남은 초가 1 이 되는 순간 실패**다 — 실제로 쓸 수 있는 시간은 한도 − 1 초. 투수편도 같은 규칙이다 (직접 재역어셈):
 * ```
 * 0xaada4  (장면 갱신 0x52c50 의 52ed0 — 모드 5 · 6 이면 상태를 안 가리고 매 틀)
 * aadb2    미션 상태 +0x1c == 0(목표 다 참)이면 돌아감 · aadca 상태 = 1
 * aadf4    시간 한도(레코드 +0xb · +0xc) > 0 일 때만:
 * aae02      벽시계 0x14005c8 − 시작 [st+0xac] > 1000ms 면 남은 초 [0x1552af0] −1 · 0xa5bb0(시작 다시 잼)
 * aae38      0xaa940(미션, 1, 남은 초) — 남은 초 > 0 이고 1 ≥ 남은 초면 상태 2(실패) → aae4a 메시지 0x76d
 * ```
 * 남은 초는 한 번에 1 씩만 줄어 0 까지 가지 않는다 — 화면의 초도 1 에서 멈춘다.
 * 시작 시각은 상태 9 갱신 0x3f584 가 적는다(3f718 남은 초 = 한도 · 3f8c0 미션 객체 0xaa57c 상태 1 · 3fa16 0xa5bb0) — 상태 8 의
 * 동기 적재 **앞**이라, 그 틀 끝 0xaada4 는 적재에 1초가 넘게 걸리면 곧바로 1초를 뺀다(한 틀에 한 번이라 1초뿐).
 * ⚠️ 웹 로딩 판(`LoadingTip`) 길이는 단말 적재 시간이 아니라 근사라 그 1초는 안 뺀다 — 타이머는 로딩 판이 끝난 뒤부터 센다.
 */
export function tick<T extends MissionRun>(run: T, elapsedSeconds: number): T {
  if (run.status !== '진행중' || run.remainingSeconds === null) return run

  const remaining = Math.max(0, run.remainingSeconds - elapsedSeconds)
  return {
    ...run,
    remainingSeconds: remaining,
    status: remaining <= LAST_SECOND ? '실패' : '진행중',
  }
}

/**
 * **제한 시간 한 갱신 0xaada4 의 초 셈** — 경기 장면 갱신(52ed0~52ee4)마다 한 번 돈다.
 * ```
 * aae02  0x14005c8()(벽시계) − [st+0xac](64비트 sbcs) 가 1000 을 넘으면(aae10~aae1e)
 * aae20    남은 초 [0x1552af0] −1
 * aae2a    0xa5bb1(st) — 0xa5bb0 이 벽시계를 다시 읽어 [st+0xac] 에 적는다(a5bb6~a5bbe). 시작 + 1000 이 아니라 **지금** 이다
 * ```
 * 그래서 한 초는 늘 1000ms 를 넘긴 첫 갱신까지라 조금씩 늦고, 공용 창이 서 있어 갱신을 건너뛴(52cc6) 뒤 닫힌 첫 갱신은
 * 벽시계가 그동안 흘렀으므로 곧바로 1초를 빼고 시각을 다시 적는다 — 몇 초를 멈췄든 1초뿐이다.
 * `markedAt` 은 마지막으로 적은 벽시계 시각, `now` 는 이번 갱신의 벽시계 시각(같은 단위 ms).
 */
export function missionClockStep(markedAt: number, now: number): { readonly elapsed: boolean; readonly markedAt: number } {
  return now - markedAt > MISSION_SECOND_MILLISECONDS ? { elapsed: true, markedAt: now } : { elapsed: false, markedAt }
}
