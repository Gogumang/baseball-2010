import { RawScreen } from '@/shared/ui'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { NO_LAST_EVALUATION, pitcherLastGameLineOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer, PitcherLastGame } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherStreakEventOfCareer, pitcherStreakMarkupOf } from '@/entities/pitcher-career/model/pitcherStreaks'
import { PitcherEventUnderlay } from '@/pages/pitcher-league/ui/PitcherEventUnderlay'
import { EvaluationEventPlayer } from '@/pages/story/ui/EvaluationEventPlayer'
import { evaluationGaugeDivisorOf } from '@/pages/story/lib/evaluationGauge'
import { pitcherEvaluationExpressionOf, streakSayExpressionOf } from '@/pages/story/lib/evaluationDialogue'
import { pitcherYearGoalWindowValuesOf } from '@/entities/pitcher-career/model/pitcherYearGoals'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { messageGameNumberOf } from '@/pages/management/lib/managementLayout'

/** 기록 줄 끝 — 원본 글 0xcc9e0 은 "실점!N" 이라 감독 글이 다음 줄에서 시작한다 (웹 `pitcherLastGameLineOf` 는 "실점" 까지) */
const RECORD_LINE_END = '!N'

interface PitcherGameEvaluationScreenProps {
  /** 116 진입이 쓴 뒤의 선수 — 지금 사기·인기도·평판과 S+0x4a · +0x64 · +7 변화를 읽는다 */
  readonly career: PitcherCareer
  readonly lastGame: PitcherLastGame
  /** [확인] = 114 */
  readonly onConfirm: () => void
}

/**
 * **투수편 116 경기 뒤 평가** (장면 0x106 상태 116, 진입 0x1278c — 타자편과 같은 상태, 모드 3 갈래).
 * 진입이 평가 내장 이벤트 0x8a6fc(장면+0x160, 모드, 글 번호, 기록 줄, …, S+7 · 사기 · +0x4a · 인기도 · +0x64 · +0x62)를 쌓아
 * 114 로 넘기고, 114 가 그 이벤트를 튼다.
 *
 * 그림 (타자편 `GameResultScreen` 의 `underlay` 와 같은 틀 — 040883f):
 * ```
 * 0x11e0c(116) · 0x8b5ac(114 대화창)  공 무늬 0x5fd61 → 상태판 0x7d34c(gfx, [이벤트+0xb] = 1 — 0x8a71e) → 머리띠(제목 9)
 * 0x8a6fc  명령 1(+0x14, 0xac7e5): 대사 — 글 번호 [+0x1e] = 감독 글 StrUSER_EVT[2~38], 기록 줄은 이벤트 +0x2cc
 *          0x8bab8: [이벤트+0xb] 면 대사 = 기록 줄 + 감독 글 (한 대사 상자)
 *          명령 2(+0x18, 0xac8b5): 종류 2(system) · sub 2 · arg 0x4b — **arg 는 안 읽는다**(sub 2 0x8d386).
 *          값 여섯은 0x86531 이 [gfx+0x260~0x274] 에 — 변화 창 0x86c90 (`EvaluationChangeWindow`, 직접 떴다)
 *          감독 글 38 이면 연속 기록(0x8a836~)을 통째로 건너뛴다
 * ```
 * 변화 창은 글(StrUSER_EVT[75])이 아니라 mode_ui 프레임 84 창이다 — 사기 · 인기도 · 평판 세 줄(현재 · ▲▼ 변화)과
 * 아래 올해의 목표 표(0x8656c, `pitcherYearGoalWindowValuesOf`), 제목 줄 오른쪽에 "N년 G/45경기"(0x7d120, 막 치른 경기).
 * 0x8a6fc 의 투수편 연속 기록 알림(모드 레코드 +0x1bc · 글 103~107 · 109~112)은 **명령 3 say**(0x8ac1a — 글 10000 = 전역 버퍼)다
 * (`pitcherStreakEventOf`) — 알림 창이 아니라 같은 대사 상자에 찍힌다. 그 보상은 [확인](114)이 먹는다.
 * 대사 상자 · 찍기 · 표정 [명령+8] 은 `EvaluationEventPlayer` · `pages/story/lib/eventDialogue` · `evaluationDialogue` (직접 떴다).
 */
export function PitcherGameEvaluationScreen({ career, lastGame, onConfirm }: PitcherGameEvaluationScreenProps) {
  const changes = career.lastEvaluation ?? NO_LAST_EVALUATION
  const streakEvent = pitcherStreakEventOfCareer(career)
  const dialogue = `${pitcherLastGameLineOf(lastGame)}${RECORD_LINE_END}${ORIGINAL_USER_EVENTS[lastGame.managerCommentIndex] ?? ''}`
  // 0x86531(gfx, S+7, 사기, S+0x4a, 인기도, S+0x64, 평판) — 116 0x12b08~0x12b70 이 넘기는 차례
  const changeValues = {
    changes: [changes.moraleChange, changes.popularityChange, changes.reputationChange],
    currents: [career.morale, career.popularity, career.reputation],
  } as const
  // 0x7d120(…, 1) — 막 치른 경기 번호
  const changeGame = messageGameNumberOf(leagueDayCounterOf(career), career.postseason !== null, true)

  return (
    <RawScreen>
      <EvaluationEventPlayer
        underlay={<PitcherEventUnderlay career={career} isPreviousGame />}
        dialogue={dialogue}
        dialogueExpression={pitcherEvaluationExpressionOf(career.reputation, lastGame.managerCommentIndex)}
        changeValues={changeValues}
        goals={pitcherYearGoalWindowValuesOf(career)}
        year={career.season}
        game={changeGame}
        streak={pitcherStreakMarkupOf(streakEvent, ORIGINAL_USER_EVENTS)}
        streakExpression={streakSayExpressionOf(streakEvent.bad !== null)}
        gauge={{ popularityChange: changes.popularityChange, divisor: evaluationGaugeDivisorOf({ kind: 'pitcher', role: career.role }) }}
        onDone={onConfirm}
      />
    </RawScreen>
  )
}
