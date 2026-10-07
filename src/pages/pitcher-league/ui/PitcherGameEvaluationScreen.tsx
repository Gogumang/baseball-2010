import { DialogueBox, MarkupText, Panel, PixelScreen } from '@/shared/ui'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { NO_LAST_EVALUATION, pitcherLastGameLineOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer, PitcherLastGame } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherStreakEventOfCareer, pitcherStreakMarkupOf } from '@/entities/pitcher-career/model/pitcherStreaks'

/** StrUSER_EVT[75] "사기 변화: %d / 현재 사기: %d / … 평판" */
const EVALUATION_POPUP_INDEX = 75

const fillNumbers = (raw: string, values: readonly number[]) => {
  let index = 0
  return raw.replace(/%d/g, () => String(values[index++] ?? ''))
}

interface PitcherGameEvaluationScreenProps {
  /** 116 진입이 쓴 뒤의 선수 — 지금 사기·인기도·평판과 S+0x4a · +0x64 · +7 변화를 읽는다 */
  readonly career: PitcherCareer
  readonly lastGame: PitcherLastGame
  /** [확인] = 114 */
  readonly onConfirm: () => void
}

/**
 * **투수편 116 경기 뒤 평가** (장면 0x106 상태 116, 진입 0x1278c — 타자편과 같은 상태, 모드 3 갈래).
 * 진입이 평가 내장 이벤트 0x8a6fc(장면+0x160, 모드, 글 번호, 기록 줄, …, S+7 · 사기 · +0x4a · 인기도 · +0x64 · +0x62)를 쌓고
 * 이 창이 그것을 보인다: 기록 줄(`승리 6.0이닝 5삼진 1실점`), 감독 글 StrUSER_EVT[2~38], 변화 글 [75].
 * 경기 장면의 정산 판(0x19)에는 평가가 없다 — 평가는 이 상태의 몫이다.
 *
 * 0x8a6fc 의 투수편 연속 기록 알림(모드 레코드 +0x1bc · 글 103~107 · 109~112)은 따로 줄로 보인다(`pitcherStreakEventOf`) —
 * 그 보상은 [확인](114)이 먹는다.
 * ⚠️ 미해결: 평가 글 줄의 그림 배치(내장 이벤트 창)는 원본 좌표를 안 떠 상자로 둔다.
 */
export function PitcherGameEvaluationScreen({ career, lastGame, onConfirm }: PitcherGameEvaluationScreenProps) {
  const changes = career.lastEvaluation ?? NO_LAST_EVALUATION
  const streakMarkup = pitcherStreakMarkupOf(pitcherStreakEventOfCareer(career), ORIGINAL_USER_EVENTS)
  return (
    <PixelScreen title="경기 평가" leftKey={{ label: '확인', onPress: onConfirm }}>
      <Panel heading="오늘의 투구">
        <MarkupText raw={pitcherLastGameLineOf(lastGame)} />
      </Panel>
      <Panel heading="감독 평가">
        <DialogueBox>
          <MarkupText raw={ORIGINAL_USER_EVENTS[lastGame.managerCommentIndex] ?? ''} />
        </DialogueBox>
        <MarkupText
          raw={fillNumbers(ORIGINAL_USER_EVENTS[EVALUATION_POPUP_INDEX] ?? '', [
            changes.moraleChange,
            career.morale,
            changes.popularityChange,
            career.popularity,
            changes.reputationChange,
            career.reputation,
          ])}
        />
      </Panel>
      {streakMarkup !== '' && (
        <Panel heading="연속 기록">
          <MarkupText raw={streakMarkup} />
        </Panel>
      )}
    </PixelScreen>
  )
}
