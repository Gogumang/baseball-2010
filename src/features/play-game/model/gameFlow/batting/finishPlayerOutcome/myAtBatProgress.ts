import { type AtBatOutcome, isFreePass, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { atBatPopularityPoints, atBatPenaltyCounts } from '@/entities/career/model/gameEvaluation'
import { recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import { backToBackRecordOf } from '@/entities/game/model/gameRecords'
import { recordLineupPlay, lineupSlotOf } from '@/entities/game/model/quickLineup'
import { chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { atBatRecordCodeOf } from '@/entities/batting/model/swingSkills'
import type { DefensePlayResult } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/otherSlices'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { burstFieldsOf, myAtBatBurstOf } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/myAtBatBurst'
import type { MyAtBatFacts } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/myAtBatFacts'
import { addReputationCounts } from '@/features/play-game/model/gameFlow/records/reputation'
import { chargeOpponentRunsOf, scoredFromBasesOfMyPlay } from '@/features/play-game/model/gameFlow/settlement/chargeRuns'
import { moundsOf } from '@/features/play-game/model/gameFlow/settlement/decisions'
import { MAXIMUM_PITCHER_COUNTER, RECENT_AT_BAT_COUNT } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 같은 정산이 상대 마운드 투수 레코드에 아웃(결과 코드 5·0xd)·탈삼진을 쌓고(0xa8cca · 0xa8d1c), 실점은 들어온 주자의
 * 책임 투수에게 매긴다(0xa8ee4 — 주자 운명대로, 3아웃 갈래 포함)
 */
function chargedMyAtBatOf(progress: GameProgress, outcome: AtBatOutcome, defensePlay: DefensePlayResult | null, facts: MyAtBatFacts) {
  const { nextGame } = facts
  return chargeOpponentRunsOf(
    progress,
    chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, progress.opponentMound.pitcherSlot, {
      outs: outsAddedBetween(progress.game, nextGame) + (facts.droppedThirdStrike ? 1 : 0),
      strikeouts: outcome.kind === '삼진' ? 1 : 0,
      // a8b04~a8bee — 볼넷(사람 판정 3e1ae 가 볼을 넷째로 센다) · 사구면 지금 마운드 투수 +0x2a
      walks: isFreePass(outcome) ? 1 : 0,
    }),
    nextGame,
    lineupSlotOf(progress.game.battingOrderIndex),
    scoredFromBasesOfMyPlay(progress.game, nextGame, outcome, defensePlay, facts.runsBattedIn),
  )
}

/**
 * a8506 — 안타 갈래([sp+0x14])이고 번트 타구(state[0x13] — 판 입력의 번트 종류)면 코드 10 → G+0xf4.
 * 0xa57f8 의 게이트 0xa56dc(R, 타자, 1)가 거짓(포스트시즌 · 국가대항전)이면 안 센다
 */
function isRecordedBuntHit(outcome: AtBatOutcome, defensePlay: DefensePlayResult | null, isRecorded: boolean): boolean {
  if (!isRecorded || defensePlay?.buntBall !== true) return false
  return outcome.kind === '안타' || outcome.kind === '홈런'
}

/** 내 타석 정산을 먹인 진행 — 점수 · 승패 · 상대 투수 · 기록 · 돌발 · 평판 칸 */
export function myAtBatProgressOf(
  progress: GameProgress,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
  facts: MyAtBatFacts,
): GameProgress {
  const { nextGame, runsBattedIn, isWalkOff, homeRunCounted } = facts
  const points = atBatPopularityPoints({ outcome, runsBattedIn, outsInPlay: facts.settledOuts, isWalkOff })
  const penalties = atBatPenaltyCounts({
    outcome,
    outsInPlay: facts.settledOuts,
    runsBattedIn,
    isWalkOff,
    // 0xa59c0 a5ace~a5ad8: 0xa97a1(주자 목록 ctx+0x14, 2) — **판이 끝난 뒤** 2루에 선 산 주자(+0x96 == 0 · +0x8c == 2).
    // 반 이닝이 바뀌기 전, 판 끝 정산 0xa8024(a8c2a) 시점의 루다
    hadSecondBaseRunner: facts.basesAfterPlay.second,
  })
  // 기록 판정은 동료 타석과 같은 함수를 쓴다 — 원본은 기록을 팀 단위로 센다 (0xa77f0)
  const recorded = recordBatterAtBat({ stats: progress.myStats, consecutiveHits: progress.consecutiveHits }, outcome, runsBattedIn, {
    homeRunCounted,
  })
  // 백투백 6·7 — 정산 0xa8024 의 홈런 갈래(@a8606)가 0xa794c 를 부른다. 공격 팀이 사람 팀(우리)이다.
  // 홈런 갈래를 건너뛴 장내 홈런은 안타 갈래 a86b4 가 ctx+0x162 를 0 으로 둔다
  const backToBack = backToBackRecordOf({ streak: progress.homeRunStreak, humanOffense: true, isHomeRun: homeRunCounted })
  return {
    ...progress,
    game: nextGame,
    // 득점 처리 0xa5c34 — 내 타석에서 난 점수도 한 점씩 승·패·세 칸을 고친다
    decisions: decisionsAfterPlay(progress.decisions, progress.game, nextGame, moundsOf(progress)),
    // 내 타석에서 난 점수도 상대 투수 실점 A·B 에 붙는다. 공을 하나라도 던졌으니 교체 직후 표시(state[0xd])도 내려가 있다 (0xa5e72).
    // 투구 수·스태미나는 공이 손을 떠날 때마다 `throwOpponentPitch` 가 이미 깎았다 (0xa5e14).
    opponentMound: {
      ...progress.opponentMound,
      runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentMound.runsAllowed + runsBattedIn),
      justChanged: false,
    },
    opponentInningRunsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentInningRunsAllowed + runsBattedIn),
    // 내 타석도 같은 정산 0xa8024 가 타순 칸 기록(안타·홈런·타석)을 세운다
    ourLineup: recordLineupPlay(progress.ourLineup, progress.game.battingOrderIndex, outcome, { homeRunCounted }),
    ...chargedMyAtBatOf(progress, outcome, defensePlay, facts),
    lastDefensePlay: playback,
    ...burstFieldsOf(progress, myAtBatBurstOf(progress, outcome, defensePlay, facts)),
    myStats: recorded.log.stats,
    consecutiveHits: recorded.log.consecutiveHits,
    homeRunStreak: backToBack.streak,
    recordIds: [...progress.recordIds, ...recorded.recordIds, ...backToBack.recordIds],
    popularityPoints: progress.popularityPoints + points,
    recentAtBatCodes: [...progress.recentAtBatCodes, atBatRecordCodeOf(outcome)].slice(-RECENT_AT_BAT_COUNT),
    doublePlays: progress.doublePlays + penalties.doublePlays,
    scoringPositionOuts: progress.scoringPositionOuts + penalties.scoringPositionOuts,
    reputationCounts: addReputationCounts(progress.reputationCounts, {
      outcome,
      runsBattedIn,
      isWalkOff,
      ourScoreBefore: progress.game.ourScore,
      opponentScore: progress.game.opponentScore,
      isBuntHit: isRecordedBuntHit(outcome, defensePlay, facts.isRecorded),
    }),
  }
}

/** 기록 줄 — 3아웃으로 날아간 보류 득점(state[0])은 점수판에 안 올라가므로 기록으로만 남긴다 */
export function myAtBatLogOf(progress: GameProgress, outcome: AtBatOutcome, defensePlay: DefensePlayResult | null, runsBattedIn: number): string {
  const runs = runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
  const voided = defensePlay !== null && defensePlay.voidedRuns > 0 ? ` (${defensePlay.voidedRuns}점 무효)` : ''
  return `${progress.game.inning}회${progress.game.half} 나 — ${describeOutcome(outcome)}${runs}${voided}`
}
