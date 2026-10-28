import { type AtBatOutcome, isFreePass, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { applyAtBatOutcome } from '@/entities/game/model/gameState'
import { survivorsFromBaseOfFates, batterRunnerSafeOfFates } from '@/features/defense-play/model/runnerFates'
import { advanceRunners } from '@/entities/game/model/baseState'
import { atBatPopularityPoints, atBatPenaltyCounts } from '@/entities/career/model/gameEvaluation'
import { recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import { backToBackRecordOf } from '@/entities/game/model/gameRecords'
import { resolveBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { recordLineupPlay, lineupSlotOf } from '@/entities/game/model/quickLineup'
import { chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { atBatRecordCodeOf } from '@/entities/batting/model/swingSkills'
import { advanceUntilPlayerTurn } from '@/features/play-game/model/gameFlow/autoPlay/advance'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import { addReputationCounts } from '@/features/play-game/model/gameFlow/records/reputation'
import { chargeOpponentRunsOf, scoredFromBasesOfMyPlay } from '@/features/play-game/model/gameFlow/settlement/chargeRuns'
import { moundsOf } from '@/features/play-game/model/gameFlow/settlement/decisions'
import { MAXIMUM_PITCHER_COUNTER, RECENT_AT_BAT_COUNT } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 타석 하나를 경기 상태에 먹이고 다음 내 차례까지 자동 진행한다 — 예전 `applyPlayerOutcome` 의 몸통이다.
 *
 * `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운다. `playback` 은 화면에 재생시킬 것 —
 * 실시간으로 이미 다 보여 준 플레이는 null 이고, 홈런은 여기서 비행 틱을 따로 만든다.
 */
export function finishPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  defensePlay: DefensePlayResult | null,
  /**
   * 화면에 재생시킬 틱 묶음. 홈런 비행이거나, 미리 다 돌려 버린 갈래의 그 결과다.
   * **실시간으로 이미 다 보여 준 플레이는 null** — 넣으면 같은 장면을 한 번 더 튼다.
   */
  playback: DefensePlayResult | null,
  /** 타자 게이트 [sp+0x34] (`resolveDefensePlay` 의 `isRecorded`). 안 넘기면 참 */
  options: { readonly isRecorded?: boolean } = {},
): GameProgress {
  // 수비 진행기를 돈 판이면 살아남은 주자로 신원을 앉힌다
  const nextGame = applyAtBatOutcome(
    progress.game,
    outcome,
    defensePlay?.advance,
    defensePlay === null ? undefined : { survivorsFromBase: survivorsFromBaseOfFates(defensePlay.runnerFates) },
  )
  const runsBattedIn = nextGame.ourScore - progress.game.ourScore
  const plainAdvance = defensePlay === null ? advanceRunners(progress.game.bases, outcome, progress.game.outs) : null
  const outsInPlay = defensePlay?.advance.outsAdded ?? plainAdvance?.outsAdded ?? 0
  // 낫아웃(state[0x1a]) — 0x3e09e 갈래의 삼진 콜 0xa7c4c 가 사건 5 를 넣고 타자주자 판을 돈다(판 운명을 진루로 먹이는 삼진은
  // 이 갈래뿐이다). 정산 [sp+0x30] 에 그 사건이 판의 아웃 사건 앞에 하나 더 든다 — 0xa59c0 의 아웃(−1 · 병살 G+0x118 ·
  // 득점권 아웃) · 결과비트 B8/B10 · 상대 투수 +0x20(a8cb0, 보정 없음)이 그 값을 본다
  const droppedThirdStrike = outcome.kind === '삼진' && defensePlay !== null
  const settledOuts = outsInPlay + (droppedThirdStrike ? 1 : 0)
  const isWalkOff = nextGame.isFinished && runsBattedIn > 0 && nextGame.ourScore > nextGame.opponentScore
  const points = atBatPopularityPoints({ outcome, runsBattedIn, outsInPlay: settledOuts, isWalkOff })
  const penalties = atBatPenaltyCounts({
    outcome,
    outsInPlay: settledOuts,
    runsBattedIn,
    isWalkOff,
    // 0xa59c0 a5ace~a5ad8: 0xa97a1(주자 목록 ctx+0x14, 2) — **판이 끝난 뒤** 2루에 선 산 주자(+0x96 == 0 · +0x8c == 2).
    // 반 이닝이 바뀌기 전, 판 끝 정산 0xa8024(a8c2a) 시점의 루다
    hadSecondBaseRunner: (defensePlay?.advance.bases ?? plainAdvance?.bases ?? progress.game.bases).second,
  })

  // 타자 게이트 [sp+0x34] — 포스트시즌 · 국가대항전이면 거짓 (`resolveDefensePlay`)
  const isRecorded = options.isRecorded !== false
  // 홈런 수 [sp+0x24] > 0 — 담장을 넘긴 사건 8 은 게이트 없이 센다(a80a8). 장내 홈런 state[0x25] 는 a84d6 이 [sp+0x34] 가
  // 참일 때만 더해, 거짓이면 루타 4 안타로만 적히고 홈런 갈래 a85be~a86b4(레코드 홈런 · 기록 1~4 · 백투백 0xa794c · B0)와
  // a8728 의 타순 칸 홈런 +0x13 · 0xa7b00(12~14)을 건너뛴다. 결과 링은 루타 4(a8704) 그대로라 사이클 · 뒤 타석의 한 타자
  // 홈런 셈(링 코드 4)에는 든다 — 이 경기 기록(`myStats`)의 홈런도 그대로 센다(포스트시즌 레코드 줄은 `withoutRecordLine` 이 뺀다)
  const homeRunCounted = outcome.kind === '홈런' && !(defensePlay?.groundHomeRun === true && !isRecorded)
  // 기록 판정은 동료 타석과 같은 함수를 쓴다 — 원본은 기록을 팀 단위로 센다 (0xa77f0)
  const recorded = recordBatterAtBat({ stats: progress.myStats, consecutiveHits: progress.consecutiveHits }, outcome, runsBattedIn, {
    homeRunCounted,
  })
  const myStats = recorded.log.stats
  const consecutiveHits = recorded.log.consecutiveHits
  // 백투백 6·7 — 정산 0xa8024 의 홈런 갈래(@a8606)가 0xa794c 를 부른다. 공격 팀이 사람 팀(우리)이다.
  // 홈런 갈래를 건너뛴 장내 홈런은 안타 갈래 a86b4 가 ctx+0x162 를 0 으로 둔다
  const backToBack = backToBackRecordOf({
    streak: progress.homeRunStreak,
    humanOffense: true,
    isHomeRun: homeRunCounted,
  })
  const recordIds = [...recorded.recordIds, ...backToBack.recordIds]

  // 돌발 판정은 타석이 끝나는 자리에서 한다 (0x4e6d4 → 0x8f414). 결과비트가 0 이거나
  // 목표 5번이면 판정이 나지 않고 돌발이 남지만, 다음 타석은 늘 자동진행(0x21)이라 그 진입(0x8f628)에서
  // 판정 없이 내려간다 (`withoutPendingBurst`).
  const resolution =
    progress.burst === null
      ? null
      : resolveBurst(
          progress.burst,
          burstResultBitsOf({
            // 사구도 B5(출루)·B11 을 켠다 — burstResultBitsOf 가 '사구' 를 받는다 (0xa882a · 0xa8bf4)
            outcome,
            runsBattedIn,
            outsBefore: progress.game.outs,
            // [sp+0x30] — 낫아웃은 삼진 사건이 하나 더 들고 B9 를 안 켠다 (a8fc6)
            outsAdded: settledOuts,
            strikeoutWhileRunning: droppedThirdStrike,
            humanTeamWalkOff: isWalkOff,
            // B5 — 안타 없이 살아 나간 타자주자(야수 선택)도 출루다 (0xa87ba r5)
            batterRunnerSafe: defensePlay === null ? undefined : batterRunnerSafeOfFates(defensePlay.runnerFates),
            // B6 — 번트 타구(state[0x13]) && (희생 [sp+8] || 득점) (a88e0 · a88f8)
            isBunt: defensePlay?.buntBall === true,
            runnersAdvanced: defensePlay?.sacrifice === true,
            // B7 — 루프 a88fc: !0xb68dc(파울 — 정산에 오는 판은 번트 파울 아웃뿐) && 2·3루 첫 산 주자가 타자 아님 && 번트
            foulBall: defensePlay?.buntFoulOut === true,
            runnerInScoringPositionAfter: defensePlay?.scoringBaseRunnerAfter === true,
            homeRunCounted,
          }),
        )

  const afterMyAtBat: GameProgress = appendLog(
    {
      ...progress,
      game: nextGame,
      // 득점 처리 0xa5c34 — 내 타석에서 난 점수도 한 점씩 승·패·세 칸을 고친다
      decisions: decisionsAfterPlay(progress.decisions, progress.game, nextGame, moundsOf(progress)),
      // 내 타석에서 난 점수도 상대 투수 실점 A·B 에 붙는다. 공을 하나라도 던졌으니 교체 직후
      // 표시(state[0xd])도 내려가 있다 (0xa5e72).
      // 투구 수·스태미나는 공이 손을 떠날 때마다 `throwOpponentPitch` 가 이미 깎았다 (0xa5e14).
      opponentMound: {
        ...progress.opponentMound,
        runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentMound.runsAllowed + runsBattedIn),
        justChanged: false,
      },
      opponentInningRunsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentInningRunsAllowed + runsBattedIn),
      // 내 타석도 같은 정산 0xa8024 가 타순 칸 기록(안타·홈런·타석)을 세운다
      ourLineup: recordLineupPlay(progress.ourLineup, progress.game.battingOrderIndex, outcome, { homeRunCounted }),
      // 같은 정산이 상대 마운드 투수 레코드에 아웃(결과 코드 5·0xd)·탈삼진을 쌓고(0xa8cca · 0xa8d1c), 실점은 들어온 주자의
      // 책임 투수에게 매긴다(0xa8ee4 — 주자 운명대로, 3아웃 갈래 포함)
      ...chargeOpponentRunsOf(
        progress,
        chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, progress.opponentMound.pitcherSlot, {
          outs: outsAddedBetween(progress.game, nextGame) + (droppedThirdStrike ? 1 : 0),
          strikeouts: outcome.kind === '삼진' ? 1 : 0,
          // a8b04~a8bee — 볼넷(사람 판정 3e1ae 가 볼을 넷째로 센다) · 사구면 지금 마운드 투수 +0x2a
          walks: isFreePass(outcome) ? 1 : 0,
        }),
        nextGame,
        lineupSlotOf(progress.game.battingOrderIndex),
        scoredFromBasesOfMyPlay(progress.game, nextGame, outcome, defensePlay, runsBattedIn),
      ),
      lastDefensePlay: playback,
      burst: resolution === null ? progress.burst : resolution.session,
      // 아직 안 보여 준 판정을 지우지 않는다 — 지우는 것은 창을 닫을 때뿐이다.
      // (판정은 이제 내 타석 끝에서만 나므로 앞 판정이 안 보인 채 남을 일은 없다 — 안전하게 둔다)
      lastBurstResolution: resolution !== null && resolution.judgement !== null ? resolution : progress.lastBurstResolution,
      myStats,
      consecutiveHits,
      homeRunStreak: backToBack.streak,
      recordIds: [...progress.recordIds, ...recordIds],
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
        // a8506 — 안타 갈래([sp+0x14])이고 번트 타구(state[0x13] — 판 입력의 번트 종류)면 코드 10 → G+0xf4.
        // 0xa57f8 의 게이트 0xa56dc(R, 타자, 1)가 거짓(포스트시즌 · 국가대항전)이면 안 센다
        isBuntHit: isRecorded && defensePlay?.buntBall === true && (outcome.kind === '안타' || outcome.kind === '홈런'),
      }),
    },
    `${progress.game.inning}회${progress.game.half} 나 — ${describeOutcome(outcome)}${runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''}${
      // 3아웃으로 날아간 보류 득점(state[0])은 점수판에 안 올라가므로 기록으로만 남긴다
      defensePlay !== null && defensePlay.voidedRuns > 0 ? ` (${defensePlay.voidedRuns}점 무효)` : ''
    }`,
    true,
  )

  return advanceUntilPlayerTurn(afterMyAtBat, random)
}
