import { type AtBatOutcome, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { applyAtBatOutcome } from '@/entities/game/model/gameState'
import { withSettlementEvents, settlementEventsOfPlay } from '@/features/defense-play/model/settlementEvents'
import { atBatPopularityPoints, atBatPenaltyCounts } from '@/entities/career/model/gameEvaluation'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { advanceUntilPlayerTurn } from '@/features/play-game/model/gameFlow/autoPlay/advance'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import { chargeOpponentRunsOf } from '@/features/play-game/model/gameFlow/settlement/chargeRuns'
import { moundsOf } from '@/features/play-game/model/gameFlow/settlement/decisions'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **내 삼진 + 도루 판(종류 5)의 한 정산** — 판정 A 0xae24c 가 state[0xb] 3·4 라 정산 없이 0x17 로 보내고, 판 끝 판정 B 0xae3e8 이
 * state[0xc] == 5 && 종류 5 라 0xd 로 가며 0xa8024 를 **종류 5 로 한 번** 부른다(ae586 · ae5a8). 삼진 콜 0xa7c4c(사건 5)는 공 도착
 * 0x3dfac 가 이미 했고, 판의 진루 · 아웃 · 득점은 `arrivePitch` 가 주자 판으로 먹였다. 정산 안에서 state[0x26] ∈ {4, 5} 가 막는 칸
 * (직접 떴다):
 * ```
 * a8852  내 타수 레코드 +0x20 · 코드 8(G+0xec 타수) · 타순 칸 +0x11            — 건너뜀
 * a8a04  코드 0xf(G+0x108 삼진) · 시즌 코드 · 결과 링 7 · ctx+0x162 = 0 · 코드 5(G+0xe4 = 0) — 건너뜀
 * a8ac8  코드 7(G+0xe8 타석) · 타순 칸 타석 +0x14                             — 건너뜀
 * 0xa599c 결과비트 — 종류 4·5 면 안 켠다(a59a8) → 0x12 끝 · 0x17 끝의 0x8f414 가 비트 0 으로 돌아 돌발 판정이 없다(8f41e)
 * ```
 * 남는 칸: a8cb0 상대 지금 투수 +0x20 += [sp+0x30](삼진 사건 5 + 판의 아웃 사건) · a8d00 +0x26 += [sp+0x20](탈삼진) ·
 * a8c02 모드 4 의 0xa59c0(ctx, [sp+0x30], [sp+0x20], −1, [sp+0x28], [sp+0x24]) — 아웃은 **삼진과 판의 아웃을 합한 값**이다
 * (예: 삼진 + 도루 저지 = 2 → −1 · 병살 G+0x118). 득점권 아웃은 판 뒤 2루에 산 주자(0xa97a1)를 본다.
 * 그래서 내 경기 기록(타수 · 삼진) · 결과 링 · 백투백 · 타순 칸 기록이 이 삼진에 안 오른다(원본 그대로).
 */
export function finishStrikeoutStealSettlement(
  progress: GameProgress,
  outcome: AtBatOutcome,
  arrival: PitchArrivalPlay,
  random: RandomPort,
  /** 0xa56dc(ctx, 지금 타자, 1) — 포스트시즌 · 국가대항전이면 거짓 */
  isRecorded: boolean,
): GameProgress {
  const nextGame = applyAtBatOutcome(progress.game, outcome)
  // 사건 목록 — 삼진 콜의 사건 5 하나와 판의 아웃 · 득점 사건 (판은 그 공의 0x11 이 목록을 비운 뒤라 앞 몫이 없다)
  const events = withSettlementEvents(settlementEventsOfPlay(arrival.result), { outs: 1, runs: 0 })
  const isWalkOff = nextGame.isFinished && events.runs > 0 && nextGame.ourScore > nextGame.opponentScore
  // 0xa59c0 — 안타 갈래가 아니라 루타 −1 이다(삼진이든 자리 채움이든 같은 갈래)
  const points = isRecorded ? atBatPopularityPoints({ outcome, runsBattedIn: events.runs, outsInPlay: events.outs, isWalkOff }) : 0
  const penalties = isRecorded
    ? atBatPenaltyCounts({
        outcome,
        outsInPlay: events.outs,
        runsBattedIn: events.runs,
        isWalkOff,
        // 0xa97a1(관리, 2) — 판이 끝난 뒤 2루에 선 산 주자. 삼진은 주자를 안 움직인다
        hadSecondBaseRunner: arrival.result.advance.bases.second,
      })
    : { doublePlays: 0, scoringPositionOuts: 0 }
  const settled: GameProgress = appendLog(
    {
      ...progress,
      game: nextGame,
      decisions: decisionsAfterPlay(progress.decisions, progress.game, nextGame, moundsOf(progress)),
      opponentMound: { ...progress.opponentMound, justChanged: false },
      // a8cb0 +0x20 · a8d00 +0x26 은 판 종류를 안 거른다 — 판의 아웃은 `arrivePitch` 가 이미 매겼고 여기는 삼진 사건 몫이다.
      // 삼진은 주자를 안 움직여 실점이 없다 — 반 이닝이 넘어가면 책임 투수 장부도 빈 루로
      ...chargeOpponentRunsOf(
        progress,
        chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, progress.opponentMound.pitcherSlot, {
          outs: outsAddedBetween(progress.game, nextGame),
          strikeouts: 1,
        }),
        nextGame,
        null,
        [],
      ),
      // 실시간으로 이미 보여 준 판(`shownLive`)은 재생 칸에 다시 안 넣는다
      lastDefensePlay: arrival.shownLive === true ? progress.lastDefensePlay : arrival.result,
      popularityPoints: progress.popularityPoints + points,
      doublePlays: progress.doublePlays + penalties.doublePlays,
      scoringPositionOuts: progress.scoringPositionOuts + penalties.scoringPositionOuts,
    },
    `${progress.game.inning}회${progress.game.half} 나 — ${describeOutcome(outcome)}`,
    true,
  )
  return advanceUntilPlayerTurn(settled, random)
}
