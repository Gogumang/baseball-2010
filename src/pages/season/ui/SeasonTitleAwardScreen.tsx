import { RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { NO_TEAM } from '@/entities/awards/model/seasonAwards'
import type { TitleSlot } from '@/entities/awards/model/seasonAwards'
import {
  SEASON_AWARD_INTRO_EVENT_ID, seasonAwardRewardOf, seasonTitleResultEventId,
} from '@/widgets/season/lib/seasonAwardEvents'
import type { SeasonAwardRole } from '@/widgets/season/lib/seasonAwardEvents'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { MILLION_TO_TEN_THOUSAND } from '@/widgets/season/lib/seasonWindowLayout'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

export interface SeasonTitleAwardScreenProps {
  /** **0xeb = 타자 · 0xec = 투수** (P4 2b 표) */
  readonly role: SeasonAwardRole
  /**
   * 발표할 타이틀 칸. `entities/awards/model/seasonAwards.ts` 의 `judgeTitles` 결과를 그대로 넘긴다.
   *
   * ⚠️ 시즌모드는 `isMine` 을 **"1위 팀 == 내 팀"** 으로 본다 (나리는 선수 레코드 +0xa 부호 비트).
   * 그러니 부르는 쪽이 `LeagueRecord.isMine` 을 그렇게 채워 넘겨야 한다 (B 4절 2번).
   * ⚠️ 시즌모드 **투수 타이틀은 네 칸**(다승·삼진·방어·**세이브**)이다 — 자세한 것은
   * `widgets/season/lib/seasonAwardEvents.ts` 의 `SEASON_PITCHER_TITLE_KINDS` 주석 참고.
   */
  readonly titles: readonly TitleSlot[]
  /** 확인 — 타자시상 다음은 투수시상(0xec), 투수시상 다음은 최우수선수(0xed) 다 */
  readonly onNext: () => void
}

/** 수상자가 없는 칸 — 원본 0x8dad4 는 팀 칸을 10 으로 초기화한다 */
const NO_WINNER = '없음'
/** 우리 팀 수상자 표시 (**근사** — 원본 발표 창의 표시 기호는 문서에 없다) */
const MINE_MARK = '★'

function winnerTextOf(title: TitleSlot): string {
  if (title.teamId === NO_TEAM || title.winnerName === '') return NO_WINNER
  const team = TEAMS[title.teamId]
  return `${team === undefined ? '' : team.name} ${title.winnerName}`.trim()
}

/**
 * 타자시상(**0xeb**, 갱신 `0xe854`) · 투수시상(**0xec**, 갱신 `0xe900`) — P4 1a·2b 절.
 *
 * 두 상태가 하는 일은 같다: `phase` 를 0xc·0xd 로 세우고 **이벤트 370 / 371**(시상 확인, SYS 3)
 * 을 튼 뒤 다음 단계로 넘긴다. 시상 판정과 순위표는 `entities/awards` 가 가진다 — 이 화면은
 * **판정 결과를 보여 주기만** 한다(성적을 지어내지 않는다).
 *
 * 결과 이벤트는 **시즌모드 전용 번호**다: 타자 372(없음)/**373**(수상) · 투수 374/**375**,
 * 수상이면 평판 +10 · 소지금 +5(500만) (P4 2a 표 확정).
 * 나리의 `titleResultEventId`(371 + 수상 개수)와 섞어 쓰면 안 된다.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 원본 그리기(`0x9ffc`/`0xa014` → 공통 틀 `0x9f60`)는 커맨드 줄·
 * 상태판·가운데 판만 그리고 발표 내용은 **이벤트 창(SYS 3 → `0x8b3bc`)** 이 띄운다. 그 창의
 * 좌표는 아직 안 풀려서 다른 시즌 화면과 같은 공용 판 (24, 54, 192, 212) 목록으로 그린다.
 */
export function SeasonTitleAwardScreen({ role, titles, onNext }: SeasonTitleAwardScreenProps) {
  const rows: readonly SeasonListRow[] = titles.map((title) => ({
    // 원본 발표 글은 StrUSER_EVT[title.userEventIndex] = "[홈런왕] 선정" 꼴이다
    id: title.name,
    label: `${title.isMine ? MINE_MARK : ' '} ${title.name}`,
    value: winnerTextOf(title),
  }))

  const hasWinner = titles.some((title) => title.isMine)
  const eventId = seasonTitleResultEventId(role, hasWinner)
  const reward = seasonAwardRewardOf(eventId)
  const rewardText = [
    ['인기도', reward.popularity],
    ['평판', reward.reputation],
  ]
    .filter(([, value]) => value !== 0)
    .map(([name, value]) => `${name} ${(value as number) > 0 ? '+' : ''}${value}`)
    // s_event 보상의 소지금은 100만 원 단위다 — 문구는 **만원**으로 적는다 (5 → 500만, P4 2a)
    .concat(reward.money === 0 ? [] : [`소지금 +${reward.money * MILLION_TO_TEN_THOUSAND}만`])
    .join(' · ')

  const { cursor, moveTo } = useSeasonCursor({ count: rows.length, onSelect: onNext, onCancel: onNext })

  return (
    <RawScreen>
      <SeasonListWindow
        title={`${role} 시상`}
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={onNext}
        onBack={onNext}
        backLabel="다음"
        footer={
          `이벤트 ${SEASON_AWARD_INTRO_EVENT_ID[role]} → ${eventId}\n` +
          (hasWinner ? `우리 팀 수상 — ${rewardText}` : '우리 팀 수상자 없음')
        }
      />
    </RawScreen>
  )
}
