import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { isOurOffense } from '@/features/play-team-game/model/teamGameFlow'
import { dueUpLineupSlotOf } from '@/widgets/game-scene/lib/halfInningCardsLayout'
import type { HalfInningCardsData } from '@/widgets/game-scene/ui/HalfInningCards'

/** DUE UP 줄 수 (0x4245e i = 0..2) */
const DUE_UP_ROWS = 3
/** 타순 칸 수 */
const LINEUP_SIZE = 9

/**
 * **팀경기 교대 판의 두 팀 판 값** (0x4fe9c 교대 가지 → 0x420dc · 0x42364).
 *
 * 판은 진행기가 다음 사람 타석 앞(이미 새 반 이닝)에 세운다 — 그래서 st[9] 는 지금 반 이닝의 공격 측이다.
 * - st[4]·st[5]·st[6] = 0 — 판이 서는 길(3아웃 뒤 0x3ac90 · 경기 첫 타석)은 모두 빈 카운트다.
 *   카운트가 남는 자동진행 0x21 → 0x18 은 판이 안 선다(`withHalfInningBoard` 의 autoSinceHuman).
 * - PITCHER = 수비 팀 지금 투수 `0xae83c(팀[st[0xa]])` — 명단 칸의 이름.
 * - DUE UP = 공격 팀 타순 칸 `(팀[+0x32] + i) mod 9` 의 선수 `0xae914` — 명단 칸의 이름(내 선수 칸 포함, 마선수는 그 이름).
 * - 타석 준비 0x3d954 의 CPU 교체(0xac428 · 0xac228)는 판 뒤 0xe 의 OK(`confirmScene`) 다음이라 판은 바뀌기 앞 이름이다.
 */
export function teamHalfInningCardsOf(progress: TeamGameProgress, half: '초' | '말'): HalfInningCardsData {
  const ourBatting = isOurOffense(progress)
  const entries = ourBatting ? progress.ourEntry : progress.opponentEntry
  const pitcher = ourBatting
    ? progress.opponentPitcherEntry[progress.opponentPitcherIndex]
    : progress.ourPitcherEntry[progress.ourPitcherIndex]
  const orderIndex = ourBatting ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const currentOrder = ((orderIndex % LINEUP_SIZE) + LINEUP_SIZE) % LINEUP_SIZE
  return {
    battingSide: half === '초' ? 0 : 1,
    count: { strikes: 0, balls: 0, outs: 0 },
    pitcherName: pitcher?.name ?? null,
    currentOrder,
    dueUpNames: Array.from(
      { length: DUE_UP_ROWS },
      (_unused, row) => entries[dueUpLineupSlotOf(currentOrder, row)]?.name ?? null,
    ),
  }
}
