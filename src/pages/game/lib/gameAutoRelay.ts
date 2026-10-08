import type { GameAutoRelayTick } from '@/features/play-game/model/gameFlow'
import { moundPitcherNameAt, teamBatterNameAt } from '@/features/play-game/model/gameFlow'
import { lineScoreSlotsOf } from '@/entities/game/model/gameState'
import { lineupSlotOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import { relayCodeOf, relayLineOf, type MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { dueUpLineupSlotOf } from '@/widgets/game-scene/lib/halfInningCardsLayout'

/** DUE UP 줄 수 (0x4245e i = 0..2) */
const DUE_UP_ROWS = 3

/**
 * **나리 타자편 0x21 중계 칸** (그리기 0x4258c 의 모드 4 갈래 — 미션과 같은 몫: 점수판 · 두 팀 판 · 공격팀 띠 · 중계 글).
 * - 중계 글 0xc25e4: 타석 틱이면 친 타자 이름 0xb62c0 + 결과 낱말(`relayCodeOf`), 교체 틱은 글이 없다.
 * - 두 팀 판: PITCHER = 그 틱 수비 팀 마운드 투수, 카운트 = 타석 끝 st[4] · st[5](교체 틱 0), 아웃 = 그 틱 그림의 st[6];
 *   DUE UP = 공격 팀 팀[+0x32] 부터 세 칸 — 내 선수 칸(`playerOrderIndex`)은 0xb62c0 이 기록 +1 의 이름(내 이름)을 준다.
 * - 점수판 0x41c18: 그 틱 그림 경기의 이닝별 칸(`lineScoreSlotsOf`).
 */
export function gameAutoRelayStepsOf(ticks: readonly GameAutoRelayTick[], myName: string | null): MissionAutoRelayStep[] {
  return ticks.map((tick) => {
    const { progress, game } = tick
    const slots = lineScoreSlotsOf(game)
    const currentOrder = lineupSlotOf(tick.orderIndex)
    const nameAtSlot = (slot: number): string | null => {
      if (tick.offenseOurs && slot === lineupSlotOf(game.playerOrderIndex)) return myName
      return teamBatterNameAt(progress, tick.offenseOurs, rosterSlotAt(tick.lineup, slot))
    }
    const atBat = tick.atBat
    return {
      inning: slots.inning,
      offenseSide: slots.offenseSide,
      scores: slots.totals,
      line:
        atBat === null
          ? null
          : relayLineOf(
              teamBatterNameAt(progress, tick.offenseOurs, atBat.rosterSlot) ?? '',
              relayCodeOf(atBat.outcome, atBat.fouled),
            ),
      inningRuns: slots.inningRuns,
      cards: {
        pitcherName: moundPitcherNameAt(progress, !tick.offenseOurs, tick.pitcherSlot),
        strikes: atBat?.strikes ?? 0,
        balls: atBat?.balls ?? 0,
        outs: game.outs,
        currentOrder,
        dueUpNames: Array.from({ length: DUE_UP_ROWS }, (_unused, row) => nameAtSlot(dueUpLineupSlotOf(currentOrder, row))),
        gameOver: game.isFinished,
      },
    }
  })
}
