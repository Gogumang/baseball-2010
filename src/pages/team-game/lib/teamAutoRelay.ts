import type { TeamAutoRelayTick, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { lineScoreSlotsOf, PLAYER_SIDE_FIRST_BAT, type GameState } from '@/entities/game/model/gameState'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { relayCodeOf, relayLineOf, type MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { dueUpLineupSlotOf } from '@/widgets/game-scene/lib/halfInningCardsLayout'

/** DUE UP 줄 수 (0x4245e i = 0..2) */
const DUE_UP_ROWS = 3

/**
 * 그 틱 그림의 경기 — 3아웃 넘김 0xb6b6c 는 **다음** 틱의 0xc2198(c21fc)이라 3아웃을 낸 타석 틱은 앞 반 이닝 그대로(아웃 3) 그린다.
 * 웹 간이 타석은 반 이닝 넘김을 그 타석 안에서 하므로 앞 경기의 이닝 · 초말로 되돌린다. 경기가 끝났으면 넘김이 없다.
 */
function drawnGameOf(after: GameState, before: GameState): GameState {
  if (after.isFinished || (after.inning === before.inning && after.half === before.half)) return after
  return { ...after, inning: before.inning, half: before.half, outs: 3 }
}

/** 그 팀 타순 칸의 타자 이름 (대타가 선 칸은 대타 이름) — 모르면 null */
function batterNameAt(progress: TeamGameProgress, ours: boolean, orderIndex: number): string | null {
  const entries = ours ? progress.ourEntry : progress.opponentEntry
  return entries[lineupSlotOf(orderIndex)]?.name ?? null
}

/** 수비 팀 지금 투수 이름 (0xae83c → 0xb62c0) */
function moundPitcherNameOf(progress: TeamGameProgress, ours: boolean): string | null {
  const pitcher = ours ? progress.ourPitcherEntry[progress.ourPitcherIndex] : progress.opponentPitcherEntry[progress.opponentPitcherIndex]
  return pitcher?.name ?? null
}

/**
 * **팀경기(모드 1 · 2 · 8 · 9) 0x21 중계 칸** — 그리기 0x4258c 의 미션과 같은 몫(점수판 · 두 팀 판 · 공격팀 띠 · 중계 글).
 * - 중계 글 0xc25e4: 타석 틱이면 친 타자 이름 + 결과 낱말(`relayCodeOf`), 교체 틱은 글이 없다(c2630 sim+0xc4 = 0).
 * - 두 팀 판: PITCHER = 수비 팀 지금 투수, 카운트 = 타석 끝 st[4] · st[5](교체 틱은 0xc0ee8 이 지운 0), 아웃 = 그 틱 그림의 st[6];
 *   DUE UP = 공격 팀 팀[+0x32](타석 틱이면 방금 친 타자) 부터 세 칸.
 * - 점수판 0x41c18: 그 틱 그림 경기의 이닝별 칸(`lineScoreSlotsOf`).
 */
export function teamAutoRelayStepOf(tick: Pick<TeamAutoRelayTick, 'progress' | 'before' | 'atBat'>): MissionAutoRelayStep {
  const progress = tick.progress
  const game = drawnGameOf(progress.game, tick.before)
  const slots = lineScoreSlotsOf(game)
  const ourHalf = game.playerSide === PLAYER_SIDE_FIRST_BAT ? '초' : '말'
  const offenseOurs = game.half === ourHalf
  const atBat = tick.atBat
  const currentOrder = lineupSlotOf(
    atBat !== null ? atBat.orderIndex : offenseOurs ? progress.game.battingOrderIndex : progress.opponentOrderIndex,
  )
  const line =
    atBat === null
      ? null
      : relayLineOf(batterNameAt(progress, atBat.ours, atBat.orderIndex) ?? '', relayCodeOf(atBat.outcome, atBat.fouled))
  return {
    inning: slots.inning,
    offenseSide: slots.offenseSide,
    scores: slots.totals,
    line,
    inningRuns: slots.inningRuns,
    cards: {
      pitcherName: moundPitcherNameOf(progress, !offenseOurs),
      strikes: atBat?.strikes ?? 0,
      balls: atBat?.balls ?? 0,
      outs: game.outs,
      currentOrder,
      dueUpNames: Array.from({ length: DUE_UP_ROWS }, (_unused, row) =>
        batterNameAt(progress, offenseOurs, dueUpLineupSlotOf(currentOrder, row))),
      gameOver: game.isFinished,
    },
  }
}

/** 중계에 막 들어선 그림 — 아직 0xc262c 를 안 돌려 글이 없고 카운트는 지금 경기 그대로다 */
export function teamAutoRelayEntryStepOf(progress: TeamGameProgress): MissionAutoRelayStep {
  return teamAutoRelayStepOf({ progress, before: progress.game, atBat: null })
}
