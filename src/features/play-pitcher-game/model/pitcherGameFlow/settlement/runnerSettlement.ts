import { type GameState, runnersOfGame } from '@/entities/game/model/gameState'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { chargedRunsByPitcher, type RunnerPitcherSettlement, scoredFromBasesOf, settleRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { chargedFromBasesOfFates, runnerFatesWithoutPlay } from '@/features/defense-play/model/runnerFates'
import type { OpponentAtBatResult } from '@/features/play-pitcher-game/model/pitcherGameState'
import { chargeCpuPitcherLine } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 이 플레이에서 **내 투수에게 매겨지는** 실점 — R+0x128 과 레코드 +0x22 (정산 0xa8024 주자 루프):
 * ```
 * a8ea4  for 주자 in 주자 목록:
 * a8eb2    주자+0x95(득점) == 0 → 건너뜀
 * a8ec0    아웃 == 3 이고 목록 0번 주자+0x96(아웃) != 0 → 건너뜀
 * a8ee4    P = 0xb8c44(수비 팀, 주자+0x30)          ; 그 주자를 내보낸 투수
 * a8ef4    0xa56dc(R, P, 0) 이면 P+0x22(실점)++
 * a8f3c    0xb6388(P)(+0xa 비트7 = 육성·명전) && 0xa56dc(R, P, 0) 이면
 * a8f56      R+0x128 += 1
 * ```
 * 모드 3 의 0xa56dc(R, P, 0) 갈래(0xa571c)는 "시즌 객체 S(0x1fa2d)+0x12c(국가대항전)·+0xb4(포스트시즌)가 둘 다 0
 * 이고 P 가 마선수(0xb633d, 비트6)가 아님" 이다. 투수편의 내 투수는 육성 선수라 비트7 이 서고 마선수가 아니므로
 * **내가 내보낸 주자가 들어올 때마다 1** 이다. 일반 선수인 동료 투수는 비트7 이 없어
 * R+0x128 에 안 든다(+0x22 에는 든다 — 웹은 동료 투수 레코드를 따로 두지 않는다).
 *
 * 들어온 주자마다 **그 주자를 내보낸 투수**(주자+0x30, `runnerPitchers`)에게 매긴다 — 강판 때 루에 남겨 둔 내 주자가 강판 뒤
 * 간이 엔진 타석에 들어와도 내 실점이고, 동료가 남긴 주자가 들어오면 그 동료 줄(+0x22) 몫이다.
 *
 * 실점을 매길 주자는 내가 던진 타석이면 주자 운명(`runnerFates`, 90c7864)으로 센다 — 인플레이 타구는 진행기 결과,
 *   삼진·볼넷·사구·홈런은 `runnerFatesWithoutPlay`. 그래서 3아웃 갈래(0xa8ec0: 목록 0번 주자가 살았으면 보류됐다 날아간
 *   득점까지 세고, 죽었으면 하나도 안 센다)도 원본대로다. `outsAfterPlay` 는 3아웃 정리 전의 아웃 수.
 *   간이 엔진 타석은 주자가 죽지 않아(0xc0fb4) 루에서 빠진 앞선 주자부터 점수판 득점만큼이다(`scoredFromBasesOf`).
 *
 * 포스트시즌이면 0xa56dc 가 거짓이라 R+0x128 · +0x22 와 0xa57f8 의 R 칸(코드 0x14~0x1f)을 하나도 안 센다
 * (`countsMyPitcherRecord`). 루별 책임 투수 장부는 그대로 옮긴다 — 세는 일만 막힌다.
 */
export function runnerSettlementOf(
  progress: PitcherGameProgress,
  before: GameState,
  applied: OpponentAtBatResult,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
): RunnerPitcherSettlement {
  const runnersAtPitch = runnersOfGame(before, progress.opponentOrderIndex)
  const halfChangedByPlay = applied.game.half !== before.half || applied.game.inning !== before.inning
  const runnersAfterPlay = halfChangedByPlay ? EMPTY_BASE_RUNNERS : runnersOfGame(applied.game, applied.opponentOrderIndex)
  const runnerSettlement = settleRunnerPitchers({
    tags: progress.runnerPitchers,
    before: runnersAtPitch,
    after: runnersAfterPlay,
    batter: lineupSlotOf(progress.opponentOrderIndex),
    // 새로 나간 타자주자의 책임 투수 = 지금 우리 마운드 (내가 서 있으면 `MY_PITCHER_SLOT`)
    pitcher: progress.ourMound.pitcherSlot,
    scoredFromBases:
      defensePlay !== null || (mine && outcome.kind !== '안타' && outcome.kind !== '아웃')
        ? chargedFromBasesOfFates(defensePlay?.runnerFates ?? runnerFatesWithoutPlay(before.bases, outcome), before.outs + applied.outsAdded)
        : scoredFromBasesOf(runnersAtPitch, runnersAfterPlay, applied.runsScored),
  })
  return runnerSettlement
}

/** 동료 투수가 내보낸 주자의 실점을 그 동료 줄(+0x22)에 — `applyDefensivePlay` 의 `pitcherLines` */
export function pitcherLinesChargedOf(
  progress: PitcherGameProgress,
  charged: RunnerPitcherSettlement['charged'],
): PitcherGameProgress['pitcherLines'] {
  return chargedRunsByPitcher(charged).reduce(
    (lines, [pitcherSlot, runsAllowed]) => chargeCpuPitcherLine(lines, progress.options.ourTeamId, pitcherSlot, { runsAllowed }),
    progress.pitcherLines,
  )
}
