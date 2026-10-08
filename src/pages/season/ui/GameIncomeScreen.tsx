import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { STORE_EXPIRED_USER_EVENT } from '@/entities/season-mode/model/seasonAttendance'
import {
  SEASON_EVALUATION_GAUGE_DIVISOR, seasonGameEvaluationExpressionOf,
} from '@/entities/season-mode/model/seasonGameEvaluation'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { EvaluationEventPlayer } from '@/pages/story/ui/EvaluationEventPlayer'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { messageGameNumberOf } from '@/pages/management/lib/managementLayout'
import { SeasonEventUnderlay } from '@/pages/season/ui/SeasonEventUnderlay'

export interface GameIncomeScreenProps {
  /** 0xe9 진입 뒤의 레코드 — 구내매점 SR+0x55 는 이미 줄었다(0x8a6fc) */
  readonly record: SeasonRecord
  readonly teamMorale: number
  readonly gamePoint: number
  /** 0xdea0 이 지은 기록 줄 (`seasonGameEvaluationLineOf` — 구내매점을 줄이기 전 레코드로) */
  readonly line: string
  /** 0x8a6fc 에서 SR+0x55 가 0 이 됐는가 — 이벤트 끝에 system sub 5 → StrUSER_EVT[113] 창 */
  readonly storeExpired: boolean
  /** 변화 창 아래 올해의 목표 표 (0x8656c 시즌 갈래) */
  readonly goals: YearGoalWindowSource
  /** 이벤트 끝 — 0xdea0 이 걸어 둔 다음 상태(0xf1 · 포스트시즌 0xee/0xef)로 */
  readonly onDone: () => void
}

/**
 * **경기 뒤 0xe9 → 0xd3 평가 내장 이벤트** (`entities/season-mode/model/seasonGameEvaluation` 머리말).
 * 0xe9(0xdea0)는 그림도 키도 없이 이벤트를 쌓고 곧장 0xd3 으로 넘긴다 — 웹은 그 0xd3 재생을 이 화면이 맡는다.
 * 재생은 나리 116 과 같은 `EvaluationEventPlayer`(명령 1 say → 명령 2 변화 창)이고, 밑그림은 0x8b5ac 의 공 무늬 · 상태판
 * ([이벤트+0xb] = 1 — 막 치른 경기) · 머리띠다(`SeasonEventUnderlay`). 시즌은 연속 기록이 없고(명령 3 없음) 감독 글도 없다
 * (글 번호 50000 — 대사 = 기록 줄). 구내매점이 이 경기로 끝났으면 마지막 명령 system sub 5 가 StrUSER_EVT[113] 창을 연다.
 *
 * ⚠️ 0xd3 이 끝난 한 틀(0xa09c 의 공통 틀 — 앞 상태 0xe9 라 칸 없음)은 그리지 않는다.
 */
export function GameIncomeScreen({ record, teamMorale, gamePoint, line, storeExpired, goals, onDone }: GameIncomeScreenProps) {
  const [isExpiryOpen, setExpiryOpen] = useState(false)
  // 0x86531(gfx, S+7, 사기, S+0x4a, 인기도, S+0x64, 평판) — 0xdea0 이 넘기는 차례 (e07c~e0d0)
  const changeValues = {
    changes: [record.lastMoraleChange, record.lastPopularityChange, record.lastReputationGrade],
    currents: [teamMorale, record.popularity, record.reputation],
  } as const

  const underlay = <SeasonEventUnderlay record={record} teamMorale={teamMorale} gamePoint={gamePoint} isPreviousGame />

  // ⚠️ 근사: 원본은 [113] 창 밑에 마지막 say 상자(0x7fbc4)가 남는다 — 재생기가 변화 창을 닫은 단계를 밖에 안 내줘 밑그림만 남긴다
  if (isExpiryOpen) {
    return (
      <RawScreen>
        {underlay}
        <MessageBox text={ORIGINAL_USER_EVENTS[STORE_EXPIRED_USER_EVENT] ?? ''} buttons={['확인']} onAnswer={onDone} />
      </RawScreen>
    )
  }

  return (
    <RawScreen>
      <EvaluationEventPlayer
        underlay={underlay}
        dialogue={line}
        dialogueExpression={seasonGameEvaluationExpressionOf(record.lastPopularityChange)}
        changeValues={changeValues}
        goals={goals}
        year={record.yearIndex + 1}
        game={messageGameNumberOf(record.games, record.inPostseason, true)}
        streak=""
        streakExpression={0}
        gauge={{ popularityChange: record.lastPopularityChange, divisor: SEASON_EVALUATION_GAUGE_DIVISOR }}
        onDone={() => (storeExpired ? setExpiryOpen(true) : onDone())}
      />
    </RawScreen>
  )
}
