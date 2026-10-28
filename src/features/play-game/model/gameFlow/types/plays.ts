import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { LiveRunnerPlay } from '@/features/defense-play/model/liveRunnerPlay'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

export interface PlayerOutcomeOptions {
  readonly pattern?: BattedBallPattern
  readonly isUncatchable?: boolean
  /**
   * 이 타석 투구 중에 난 **연속 파울 기록**(32·33, `0xa7dbc`) — 타석 쪽 집계
   * (`features/play-at-bat/model/atBatPitchTally`)의 `foulRecordIds` 를 그대로 넘긴다.
   * 원본은 파울이 난 그 순간 `0x51408` v=7 갈래에서 지급하므로 타석 결과보다 **먼저** 얹는다 —
   * 인플레이 타구로 주자 처리가 뒤로 미뤄져도 이 기록은 이 자리에서 들어간다.
   * 사람 타석에서만 나온다(간이 엔진 동료 타석에는 파울 판정 0x51408 이 없다).
   */
  readonly foulRecordIds?: readonly number[]
  /**
   * 이 공이 도착하며 연 주자 판(`arrivePitch`). 낫아웃(종류 9 · `'batterRuns'`)이면 그 판의 advance 가 곧 이 삼진
   * 타석의 진루다. 그 밖(볼넷·사구·삼진 + 도루·폭투)은 `arrivePitch` 가 이미 주자 판으로 먹였으니
   * 재생 칸만 지킨다 — 이 타석 결과가 재생 칸을 비우면 판이 화면에 안 나온다.
   */
  readonly arrivalPlay?: PitchArrivalPlay | null
  /**
   * 이 공의 **번트 종류** 장면 +0xfdc (0 스윙 · 1~3 번트 — `BattingStage.onPitchResolved` 넷째 인자). 타구 판 시작 리드
   * (0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더한다(`DefensePlayInput.buntKind`). 안 넘기면 0.
   * `useCareerSession.handlePitchResolved` 가 타석 화면의 넷째 인자를 그대로 싣는다.
   */
  readonly buntKind?: number
  /**
   * 0xa56dc(ctx, 지금 타자, 1) — 포스트시즌 · 국가대항전이면 거짓 (`arrivePitch` 의 `isRecorded`). 삼진 + 도루 판의 한 정산이
   * 0xa59c0(인기도 · 병살 · 득점권 아웃)에 이 게이트를 본다. 안 넘기면 참
   */
  readonly isRecorded?: boolean
}

/**
 * **0xf 진입 때의 볼카운트** — state [0x1552d0c]+4 스트라이크 · +5 볼. 원본은 경기 상태 한 곳에 있지만 웹은 타석 세션
 * (`useAtBatRunner`)이 들어, 0xf 로 들어서는 진행기 입구(`arrivePitch` · `resolveDefensePlay` 의 파울 판 끝 · `cpuPickoff`)가
 * 그 순간 값을 받아 교체 틱 굴림(0x344dc)에 넘긴다. 새 타석(`prepareMyAtBat`)은 0xd 가 지운 0-0 이다.
 * - 볼 · 스트라이크 · 파울(판 없이): 판정 A 0xae24c 가 카운트를 올린 **뒤** 0xf 를 예약한다 — 이 공을 먹인 값
 * - 파울 각 공 판 끝: 같은 틱 0x528b0 이 판정 B(52a52)와 0x35108(52a66 → 35174 0xb6b58 스트라이크 ≤ 1 이면 +1)을 부르고
 *   0xf 진입은 다음 틱이다 — 파울 스트라이크를 먹인 값
 * - 견제 판 끝(ae592): 카운트는 그대로
 */
export interface AtBatCount {
  readonly strikes: number
  readonly balls: number
}

/** 타자편의 붙든 주자 판 — 판과, 판 뒤 `arrivePitch` · `cpuPickoff` 의 나머지가 쓰는 값 */
export type GamePendingRunnerPlay =
  | (Extract<LiveRunnerPlay, { readonly kind: 'arrival' }> & {
      /** 공 도착 판 — 이 공 뒤의 타석 결과(없으면 같은 타석 다음 공)와 타자 게이트 0xa56dc */
      readonly arrival: {
        readonly outcomeAfter: AtBatOutcome | null
        readonly isRecorded: boolean
        /** 이 공을 먹인 뒤의 볼카운트 — 판이 도는 동안 안 바뀐다. 판 끝 0xf 진입의 교체 틱 굴림(0x344dc)이 본다 */
        readonly countAfter: AtBatCount
      }
    })
  | (Extract<LiveRunnerPlay, { readonly kind: 'pickoff' }> & {
      /** CPU 견제 판 — 타자 게이트 0xa56dc 와 지금 볼카운트(판 끝 0xf 진입의 교체 틱 굴림) */
      readonly pickoff: { readonly isRecorded: boolean; readonly count: AtBatCount }
    })
