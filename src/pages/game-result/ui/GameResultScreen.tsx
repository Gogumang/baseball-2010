import { BigResult, DialogueBox, MarkupText, Notice, Panel, PixelScreen, StatGrid, TitleTag } from '@/shared/ui'
import type { GameEvaluation, StreakNotice } from '@/entities/career/model/gameEvaluation'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { RECORD_NAMES } from '@/entities/game/model/gameRecords'
import { battingAverageOf, formatBattingAverage } from '@/entities/career/model/seasonStats'
import * as styles from '@/pages/game-result/ui/GameResultScreen.css'

/**
 * 승패 글자 그림 — ui/result.pzx 합성 프레임 0 "YOU WIN", 1 "YOU LOSE". 무승부 그림은 원본에 없다.
 * 화면 안 위치는 코드 안이라 모른다 — 결과 칸 맨 위에 둔다 (추정).
 */
const RESULT_SPRITE: Readonly<Partial<Record<GameSummary['result'], string>>> = {
  승: '/sprites/result/frames/000.png',
  패: '/sprites/result/frames/001.png',
}

interface GameResultScreenProps {
  readonly summary: GameSummary
  readonly gamePointReward: number
  readonly newTitles: readonly string[]
  readonly evaluation: GameEvaluation
  readonly streakNotices: readonly StreakNotice[]
  /** 평가가 반영된 뒤의 선수 — "현재 사기" 등을 보여준다 */
  readonly career: PlayerCareer
  readonly onContinue: () => void
}

/** StrUSER_EVT[75] "사기 변화: %d / 현재 사기: %d / … 평판" */
const EVALUATION_POPUP_INDEX = 75

const fillNumbers = (raw: string, values: readonly number[]) => {
  let index = 0
  return raw.replace(/%d/g, () => String(values[index++] ?? ''))
}

export function GameResultScreen({
  summary,
  gamePointReward,
  newTitles,
  evaluation,
  streakNotices,
  career,
  onContinue,
}: GameResultScreenProps) {
  const { stats } = summary

  return (
    <PixelScreen title="경기 결과" leftKey={{ label: '확인', onPress: onContinue }}>
      <Panel>
        {RESULT_SPRITE[summary.result] !== undefined && (
          <img className={styles.resultSprite} src={RESULT_SPRITE[summary.result]} alt={summary.result} />
        )}
        <BigResult>
          {summary.ourScore} : {summary.opponentScore} {summary.result}
        </BigResult>
      </Panel>

      <Panel heading="감독 평가">
        <DialogueBox>
          <MarkupText raw={ORIGINAL_USER_EVENTS[evaluation.commentIndex] ?? ''} />
        </DialogueBox>
        <MarkupText
          raw={fillNumbers(ORIGINAL_USER_EVENTS[EVALUATION_POPUP_INDEX] ?? '', [
            evaluation.moraleChange,
            career.morale,
            evaluation.popularityChange,
            career.popularity,
            evaluation.reputationChange,
            career.reputation,
          ])}
        />
        {streakNotices.map((notice) => (
          <Notice key={notice.labelIndex}>
            {notice.count}{ORIGINAL_USER_EVENTS[notice.labelIndex]} · {ORIGINAL_USER_EVENTS[notice.commentIndex]} (평판{' '}
            {notice.reputationChange > 0 ? '+' : ''}
            {notice.reputationChange})
          </Notice>
        ))}
      </Panel>

      <Panel heading="오늘의 성적">
        <StatGrid
          entries={[
            { label: '타수', value: stats.atBats },
            { label: '안타', value: stats.hits },
            { label: '홈런', value: stats.homeRuns },
            { label: '타점', value: stats.runsBattedIn },
            { label: '볼넷', value: stats.walks },
            { label: '삼진', value: stats.strikeouts },
          ]}
        />
      </Panel>

      <Panel heading="보상">
        <Notice>
          경기 타율 {formatBattingAverage(battingAverageOf(stats))} · G포인트 +
          {gamePointReward.toLocaleString('ko-KR')}
        </Notice>
        {/* 달성 기록 목록 (0x4ea0c 결과 화면) — 이름 StrGAME[id+8] */}
        {summary.recordIds.length > 0 && <Notice>달성 기록 · {summary.recordIds.map((id) => RECORD_NAMES[id]).join(' · ')}</Notice>}
      </Panel>

      {newTitles.length > 0 && (
        <Panel heading="칭호 획득!">
          {newTitles.map((title) => (
            <TitleTag key={title}>
              {title}
            </TitleTag>
          ))}
        </Panel>
      )}
    </PixelScreen>
  )
}
