import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { opponentMoundOf } from '@/features/play-game/model/gameFlow'
import { ACE_BATTER_ROSTER_SLOT, aceBatterPlayerOf } from '@/features/play-game/model/gameAces'
import { lineupSlotOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import { teamBatters } from '@/entities/team/model/teamRoster'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { dueUpLineupSlotOf } from '@/widgets/game-scene/lib/halfInningCardsLayout'
import type { HalfInningCardsData } from '@/widgets/game-scene/ui/HalfInningCards'

/** DUE UP 줄 수 (0x4245e i = 0..2) */
const DUE_UP_ROWS = 3

/**
 * **나리 타자편 교대 판의 두 팀 판 값** (0x4fe9c 교대 가지 → 0x420dc · 0x42364).
 *
 * 타자편은 1회초 판만 선다(선공이고 내가 1번 타자, `gameFlow.withFirstInningBoard`) — 공격은 늘 내 팀이다.
 * - st[9] = 0(초) — 왼쪽 DUE UP. 판이 다른 반 이닝에 서는 길은 없지만 `half` 를 그대로 옮긴다.
 * - st[4]·st[5]·st[6] = 0 — 0x3ac90 이 지웠거나(3아웃 뒤) 경기 첫 공 앞이다.
 * - PITCHER = 수비 팀 지금 투수 `0xae83c(팀[st[0xa]])` → 상대 마운드(`opponentMoundOf`) 이름.
 * - DUE UP = 공격 팀 타순 칸 `(팀[+0x32] + i) mod 9` 의 선수 `0xae914` — 내 선수 칸(`playerOrderIndex`)은 내 이름,
 *   142 가 넣은 마타자 칸은 마선수 이름, 나머지는 붙박이 표 행 이름(읽을 때 0xb62c0 을 거친다).
 */
export function gameHalfInningCardsOf(
  progress: GameProgress,
  career: Pick<PlayerCareer, 'name'>,
  half: '초' | '말',
): HalfInningCardsData {
  const { game } = progress
  const currentOrder = lineupSlotOf(game.battingOrderIndex)
  const roster = teamBatters(progress.ourTeamId)
  const nameAt = (slot: number): string | null => {
    if (slot === lineupSlotOf(game.playerOrderIndex)) return career.name
    const rosterSlot = rosterSlotAt(progress.ourLineup, slot)
    if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
      const index = progress.aces?.ours.batter
      return index === undefined ? null : aceBatterPlayerOf(index)?.name ?? null
    }
    return roster[rosterSlot % roster.length]?.name ?? null
  }
  return {
    battingSide: half === '초' ? 0 : 1,
    count: { strikes: 0, balls: 0, outs: 0 },
    pitcherName: opponentMoundOf(progress).name ?? null,
    currentOrder,
    dueUpNames: Array.from({ length: DUE_UP_ROWS }, (_unused, row) => nameAt(dueUpLineupSlotOf(currentOrder, row))),
  }
}
