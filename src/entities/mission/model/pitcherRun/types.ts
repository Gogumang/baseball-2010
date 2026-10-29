import type { DefensePlayResult, RunnerFate } from '@/entities/mission/model/pitcherRun/otherSlices'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { RandomPort } from '@/shared/api/random/randomPort'

export interface PitcherRun extends MissionRun {
  /** 남은 투구 수. 제한이 없으면 null. */
  readonly remainingPitches: number | null
  /** 이번 타석에서 나온 PERFECT 게이지 수 */
  readonly perfectGauges: number
  /** 지금까지 잡은 아웃 수 (이닝 목표 계산용) */
  readonly totalOuts: number
  /** 허용한 실점·피안타·볼넷(사구 제외)·출루 허용 — 레코드 실패 한도와 비교한다 (0xaac76~0xaaccc) */
  readonly allowed: {
    readonly runs: number
    readonly hits: number
    readonly walks: number
    /**
     * R+0x130 — **누계가 아니라 방금 정산한 플레이 하나의 값**(0/1). 정산 0xa8c86 이
     * `0xa57f8(R, 0x17, r5)` 로 넣고 점프표 0xd8218[0x17] = 0xa591c 가 `strb (r5 != 0)` 로 **덮어쓴다**.
     * 판정 0xaaa6c 은 정산 바로 뒤에 돌고(0xae24c: 0xae36a → 0xae382 · 0xae3e8: 0xae5b0 → 0xae5c4)
     * 실패(2)는 다음 판정부터 맨 앞(0xaaa8e)에서 돌아가 버려 그대로 남는다.
     */
    readonly baserunner: number
  }
}

/** 미션 투수편 = 원본 전역 모드 **5** (타자편이 6 다 — Q2-mission-rewards 1-0 확정) */
export const MISSION_PITCHER_MODE = 5

export interface PitcherOutcomeOptions {
  /** 주면 수비 진행기의 원본 확률 굴림(펌블·악송구·필살수비)이 돈다 */
  readonly random?: RandomPort
  /** 화면(상태 0x17)이 이미 다 돌린 수비 플레이. 주면 여기서 또 굴리지 않는다 */
  readonly played?: DefensePlayResult
  /**
   * 이 삼진과 **한 정산**인 주자 판(도루 종류 5 · 삼진 그대로인 폭투·포일 종류 9)의 주자 운명 — 판정 B 가 그 판 끝에서 정산
   * 0xa8024 를 한 번 부르므로(ae576 · ae596 → ae5a8) R+0x130(a8c5c~a8c86)은 그 판의 주자 목록 마지막 원소로 정해진다.
   * 안 주면 판 없는 삼진의 목록(`runnerFatesWithoutPlay`)이다
   */
  readonly settledRunnerFates?: readonly RunnerFate[]
}
