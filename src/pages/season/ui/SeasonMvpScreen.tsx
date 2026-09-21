import { RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import type { AwardWinner } from '@/entities/awards/model/seasonAwards'
import {
  SEASON_AWARD_INTRO_EVENT_ID, seasonAwardRewardOf, seasonMvpResultEventId,
} from '@/widgets/season/lib/seasonAwardEvents'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { MILLION_TO_TEN_THOUSAND } from '@/widgets/season/lib/seasonWindowLayout'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

export interface SeasonMvpScreenProps {
  /**
   * 발표할 MVP. 없으면 null.
   *
   * ⚠️ **시즌모드 MVP 는 나리와 뽑는 법이 다르다** (B-3 확정): 나리는 타이틀 세 칸으로 판정하지만,
   * 시즌모드는 종류 표 **0xd4f34 = `[9, 11, 12, 1, 6, 4, 3]`** 에서 `rand(0..6)` 하나를 골라
   * 그 순위표의 1위를 MVP 로 발표한다. 굴림에 난수가 필요해 화면에서 하지 않는다 —
   * `widgets/season/lib/seasonAwardEvents.ts` 의 `SEASON_MVP_LEADER_KINDS` 와
   * `entities/awards` 의 `leaderOf` 로 **부르는 쪽**이 고른 결과만 여기에 넘긴다.
   */
  readonly winner: AwardWinner | null
  /** 그 1위의 팀이 **내 팀**인가 (원본 이벤트 객체 +0x388) */
  readonly isMine: boolean
  /** 확인 — 다음은 **정규시즌 순위 0xf0** 이다 */
  readonly onNext: () => void
}

/**
 * 원본 발표 창(`0x8b23c`)이 쓰는 글 — StrUSER_EVT **[83]** 제목, 내 선수면 **[84]** 축하.
 * (원문: `!C[!cFFFF00페넌트레이스 MVP!cFFFFFF]!N!N` · `축하합니다!!!N[…]!N로 선정되었습니다.`)
 */
const MVP_TITLE = '페넌트레이스 MVP'
const MVP_CONGRATULATION = '축하합니다!'

/**
 * 최우수선수 (장면 0x105 상태 **0xed**, 갱신 `0xe7ac` — P4 1a·2b 절).
 *
 * `phase = 0xe` 를 세우고 **이벤트 376**(MVP 발표, SYS 4)을 튼 뒤 **0xf0 정규시즌 순위**로 넘긴다.
 * 결과 이벤트는 시즌모드 전용으로 **378 없음 / 379 있음**이고, 379 는 인기도 +10 · 평판 +20 ·
 * 소지금 +10(1000만) 이다 (P4 2a 표 확정). 나리의 376/377 과 번호가 겹치지만 뜻이 다르다.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 원본 그리기(`0xa020` → 공통 틀 `0x9f60`)는 발표 내용을 그리지
 * 않고 이벤트 창(SYS 4 → `0x8b23c`)이 띄운다. 그 창 좌표가 안 풀려 공용 판 (24, 54, 192, 212)
 * 목록으로 그린다.
 */
export function SeasonMvpScreen({ winner, isMine, onNext }: SeasonMvpScreenProps) {
  const team = winner === null ? undefined : TEAMS[winner.teamId]
  const rows: readonly SeasonListRow[] = [
    {
      id: 'mvp',
      label: MVP_TITLE,
      value: winner === null ? '없음' : `${team === undefined ? '' : team.name} ${winner.name}`.trim(),
    },
  ]

  const eventId = seasonMvpResultEventId(isMine)
  const reward = seasonAwardRewardOf(eventId)
  const rewardText = [
    ['인기도', reward.popularity],
    ['평판', reward.reputation],
  ]
    .filter(([, value]) => value !== 0)
    .map(([name, value]) => `${name} ${(value as number) > 0 ? '+' : ''}${value}`)
    // s_event 보상의 소지금은 100만 원 단위다 — 문구는 **만원**으로 적는다 (10 → 1000만, P4 2a)
    .concat(reward.money === 0 ? [] : [`소지금 +${reward.money * MILLION_TO_TEN_THOUSAND}만`])
    .join(' · ')

  const { cursor, moveTo } = useSeasonCursor({ count: rows.length, onSelect: onNext, onCancel: onNext })

  return (
    <RawScreen>
      <SeasonListWindow
        title="최우수선수"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={onNext}
        onBack={onNext}
        backLabel="다음"
        footer={
          `이벤트 ${SEASON_AWARD_INTRO_EVENT_ID.MVP} → ${eventId}\n` +
          (isMine ? `${MVP_CONGRATULATION} ${rewardText}` : '우리 팀 MVP 없음')
        }
      />
    </RawScreen>
  )
}
