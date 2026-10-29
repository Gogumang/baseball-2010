import type { ReactNode } from 'react'
import type { EvaluationChangeValues } from '@/pages/story/lib/evaluationChangeWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import type { RewardNotice } from '@/entities/story/model/rewardNotice'

export interface EvaluationEventPlayerProps {
  /** 116 · 114 밑그림 — 공 무늬 · 상태판([이벤트+0xb] = 1) · 머리띠 */
  readonly underlay: ReactNode
  /** 명령 1 글 — 기록 줄 + 감독 글 (0x8bab8 — 말하는 이 0 이라 머리말 없음) */
  readonly dialogue: string
  /** 명령 1 표정 [명령+8] (`batterEvaluationExpressionOf` · `pitcherEvaluationExpressionOf`) */
  readonly dialogueExpression: number
  readonly changeValues: EvaluationChangeValues
  readonly goals: YearGoalWindowSource
  readonly year: number
  readonly game: number
  /** 명령 3 글 — 연속 기록 알림 줄(전역 버퍼 0x1552af4). 빈 글이면 명령이 없다 */
  readonly streak: string
  readonly streakExpression: number
  /**
   * 0x8587c 의 인기도 변화 막대 — S+0x4a 와 d(`evaluationGaugeDivisorOf`). 0x8b5ac 가 틀마다 대사 상자 뒤에
   * 0x847e0 · 0x85944 · 0x858cc 로 그린다(`EvaluationGauge`)
   */
  readonly gauge: { readonly popularityChange: number; readonly divisor: number }
  /**
   * 마지막 명령 system sub 5 의 글 — 시즌 0xd3 에서 구내매점이 끝났으면 StrUSER_EVT[113] (0x8a6fc). 공용 창 0x74ef4(종류 1, OK)로
   * 띄우고, 떠 있는 동안에도 0x8b5ac 가 틀마다 0x7fbc4 로 마지막 say 상자 · 초상화와 인기도 막대를 그린다. 없으면 null
   */
  readonly finalNotice?: string | null
  /**
   * 0x8a6fc 가 연속 기록 say 뒤에 쌓은 **보상 명령**(종류 7, 명령마다 항목 하나 — 8ac54 평판 합 · 8ad22~8af8a 스킬 ±n)의 창.
   * 실행 0x8d4c4 가 명령마다 0x8beb8 글로 첫 종류 4 면 스킬 창(0x741a1 · 그리기 0x87108 · 키 0x8e054), 그 밖이면 공용 알림 0x74ef4
   * 종류 1 을 띄우고 같은 갱신에 0x8c460 으로 보상을 준다 — 기다림 0x8daa0 · 0x8e054 가 키를 받은 그 갱신에 다음 명령
   * (`rewardNoticeOf`, StoryScreen 과 같은 창). 없으면 빈 목록
   */
  readonly rewardNotices?: readonly RewardNotice[]
  /**
   * 밑그림을 보상 몫만큼 고쳐 그린다 — 0x8c460 이 창을 띄운 갱신에 보상을 주므로(평판 → 상태판 0x7d34c 칸) 그 창부터 새 값이다.
   * 인자는 이미 준 보상 명령 수. 없으면 `underlay` 그대로
   */
  readonly underlayAfterRewards?: (givenRewardCount: number) => ReactNode
  /**
   * 보상 명령의 창이 선 갱신 — 0x8c460 이 그 명령의 보상을 주고 끝(0x8b0e4 · 0x8cd44)에서 **저장한다**(S+0x50 은 114 진입이 이미 3 ·
   * 0xb). 인자는 이제까지 준 보상 명령 수. 세션이 그 몫을 주고 저장한다(Q-23)
   */
  readonly onRewardsGiven?: (givenRewardCount: number) => void
  /** 마지막 명령이 끝나면 — 114 끝 */
  readonly onDone: () => void
}
