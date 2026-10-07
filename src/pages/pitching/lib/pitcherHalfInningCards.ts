import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { opponentBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { dueUpLineupSlotOf } from '@/widgets/game-scene/lib/halfInningCardsLayout'
import type { HalfInningCardsData } from '@/widgets/game-scene/ui/HalfInningCards'

/** DUE UP 줄 수 (0x4245e i = 0..2) */
const DUE_UP_ROWS = 3

/**
 * **나리 투수편 교대 판의 두 팀 판 값** (0x4fe9c 교대 가지 → 0x420dc · 0x42364).
 *
 * 모드 3 은 1회초 판만 선다(후공이고 오늘 선발, 진행기 `withHalfInningBoard`) — 공격은 늘 상대 팀, 마운드는 나다.
 * - st[4]·st[5]·st[6] = 0 — 경기 첫 공 앞.
 * - PITCHER = 수비 팀 지금 투수 `0xae83c(팀[st[0xa]])` = 내 투수 — 이름은 부르는 쪽이 넘긴다(소개 판과 같은 `pitcherName`).
 * - DUE UP = 상대 타순 칸 `(팀[+0x32] + i) mod 9` 의 선수 `0xae914` — `opponentBatterOf` 와 같은 길(명단 칸 → 붙박이 표 이름,
 *   마타자 칸은 마선수 이름)으로 칸만 옮겨 읽는다.
 */
export function pitcherHalfInningCardsOf(
  progress: PitcherGameProgress,
  pitcherName: string | undefined,
  half: '초' | '말',
): HalfInningCardsData {
  const currentOrder = lineupSlotOf(progress.opponentOrderIndex)
  return {
    battingSide: half === '초' ? 0 : 1,
    count: { strikes: 0, balls: 0, outs: 0 },
    pitcherName: pitcherName ?? null,
    currentOrder,
    dueUpNames: Array.from({ length: DUE_UP_ROWS }, (_unused, row) =>
      opponentBatterOf({ ...progress, opponentOrderIndex: dueUpLineupSlotOf(currentOrder, row) }).name ?? null,
    ),
  }
}
