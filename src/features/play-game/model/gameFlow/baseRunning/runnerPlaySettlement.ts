import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { type PendingSettlementEvents, settlementEventsOfPlay } from '@/features/defense-play/model/settlementEvents'
import { chargePitcherLine } from '@/entities/game/model/gamePitcherLines'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { atBatPopularityPoints, atBatPenaltyCounts } from '@/entities/career/model/gameEvaluation'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { recordPlateAppearance, EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { resolveBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { batterRunnerSafeOfFates } from '@/features/defense-play/model/runnerFates'
import { RECENT_AT_BAT_COUNT, RUNNER_PLAY_OUTCOME_PLACEHOLDER } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **타석 결과 없는 주자 판(견제 종류 4 · 삼진 없는 도루 종류 5)의 정산 0xa8024 — 거르지 않는 칸** (직접 떴다).
 * 사람이 늘 공격이라 수비 칸(36 · 26/27 · state[0x88]·[0x8a] · R[3])은 게이트 · 수비 팀 칸에 막히고, 남는 것은:
 * ```
 * a8cb0  상대 지금 투수 레코드 +0x20 += [sp+0x30]                      ; 판의 아웃은 `withRunnerOnlyPlay` 가 먹였다 — 앞 몫만 더한다
 * a8c02  state[1] == 4(모드 4)면 0xa59c0(ctx, [sp+0x30], [sp+0x20], −1, [sp+0x28], [sp+0x24])  ; 루타 칸 −1 (안타 갈래 아님)
 * ```
 * 0xa59c0(a59c0~a5aec): 0xa56dc(ctx, 지금 타자, 1) — 나(내 타석)고 포스트시즌 · 국가대항전이 아니면 —
 * 끝내기 && 득점 > 0 → +4 끝 / 득점 1 → +1 · 2~3 → +2 / 루타 −1 이면 아웃 > 1 → −1 · 병살 G+0x118 +1 /
 * 아웃 > 0 && 판 뒤 2루에 산 주자(0xa97a1 — +0x96 == 0 && +0x8c == 2) → 득점권 아웃 G+0x11c +1.
 * `events` 는 사건 목록을 훑은 값 — 견제 판은 같은 투구 틈 앞 판의 몫까지 든다(원본 그대로 다시 센다).
 * 돌발 판정 0x8f414 는 결과비트가 0 이라 판정이 없다(0xa599c 는 종류 4·5 면 안 켠다).
 */
export function withRunnerPlaySettlement(
  next: GameProgress,
  before: GameProgress,
  result: DefensePlayResult,
  events: PendingSettlementEvents,
  /** 0xa56dc(ctx, 지금 타자, 1) — 포스트시즌 · 국가대항전이면 거짓. 안 넘기면 참 */
  isRecorded: boolean,
): GameProgress {
  const earlierOuts = events.outs - result.advance.outsAdded
  const pitcherLines =
    earlierOuts > 0
      ? chargePitcherLine(next.pitcherLines, next.opponentTeamId, before.opponentMound.pitcherSlot, { outs: earlierOuts })
      : next.pitcherLines
  if (!isRecorded) return pitcherLines === next.pitcherLines ? next : { ...next, pitcherLines }
  const isWalkOff = next.game.isFinished && next.game.ourScore > next.game.opponentScore && events.runs > 0
  // 안타 갈래가 아니라 루타 −1 — 타석 결과가 없는 판이다(아웃으로 보면 0xa59c0 의 같은 갈래다)
  const outcome: AtBatOutcome = RUNNER_PLAY_OUTCOME_PLACEHOLDER
  const points = atBatPopularityPoints({ outcome, runsBattedIn: events.runs, outsInPlay: events.outs, isWalkOff })
  const penalties = atBatPenaltyCounts({
    outcome,
    outsInPlay: events.outs,
    runsBattedIn: events.runs,
    isWalkOff,
    // 0xa97a1(관리, 2) — 판이 끝난 뒤 2루에 선 산 주자
    hadSecondBaseRunner: result.advance.bases.second,
  })
  return {
    ...next,
    pitcherLines,
    popularityPoints: next.popularityPoints + points,
    doublePlays: next.doublePlays + penalties.doublePlays,
    scoringPositionOuts: next.scoringPositionOuts + penalties.scoringPositionOuts,
  }
}

/**
 * **삼진 없이 3아웃 · 경기 끝으로 정산되는 폭투·포일 판(종류 9)의 정산 0xa8024** — 판정 B 가 아웃 > 2(ae554) · 경기 끝(ae402)이면
 * 종류를 안 가리고 정산한다. 종류 9 는 state[0x26] ∈ {4, 5} 거르기에 안 걸려 **내 타석 칸들이 보통 정산처럼 오른다**(직접 떴다):
 * ```
 * a882e  득점 > 0 && 아웃 > 0 && 안타 아님 → a88d4 (타수 갈래를 건너뜀 — 희생과 같은 갈래)
 * a8840  안타 수 [sp+0x2c] || 아웃 [sp+0x30] → a8852 종류 9 → 타수 +0x20([sp+0x34]) · 코드 8(G+0xec 타수) · 타순 칸 +0x11
 * a89f4  아웃 > 0 && 안타 아님 && 종류 ∉ {4, 5} → 삼진 0 이라 a8a72: 결과 링 ← 6(state[0x1f] 뜬공) / 5 · ctx+0x162 = 0 · 코드 5(G+0xe4 = 0)
 * a8ac8  종류 ∉ {4, 5} → 코드 7(G+0xe8 타석) · 타순 칸 타석 +0x14            ; 아웃이 없는 끝내기 판도 든다
 * a8c02  모드 4 → 0xa59c0(ctx, 아웃, 0, −1, 득점, 0)                        ; 끝내기 && 득점 → +4
 * 0xa599c 결과비트(종류 9 는 거르지 않는다) → 0x17 끝(52a8e)의 0x8f414 가 그 비트로 돌발을 판정한다
 * ```
 * 판에 공 잡은 뜬공이 없어 결과 링은 5 다. 득점권 아웃은 판이 끝난 루(3아웃 정리 전)의 2루 주자를 본다.
 * 그 타석은 끊겨 다음 이닝에 같은 타순이 다시 선다(`arrivePitch` 의 `interrupted`) — 원본 그대로 타석이 두 번 센다.
 */
export function withWildPitchSettlement(
  next: GameProgress,
  before: GameProgress,
  result: DefensePlayResult,
  /** 0xa56dc(ctx, 지금 타자, 1) — 포스트시즌 · 국가대항전이면 거짓 (0xa59c0 게이트) */
  isRecorded: boolean,
): GameProgress {
  const events = settlementEventsOfPlay(result)
  const outs = events.outs
  const atBat = outs > 0 && events.runs === 0
  const slot = before.game.battingOrderIndex
  const records = [...next.ourLineup.records]
  const index = lineupSlotOf(slot)
  records[index] = recordPlateAppearance(records[index] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: false,
    isHomeRun: false,
    ...(outs > 0 ? { resultCode: OUT_RESULT_CODE } : {}),
  })
  const settled: GameProgress = {
    ...withRunnerPlaySettlement(next, before, result, events, isRecorded),
    myStats: {
      ...next.myStats,
      plateAppearances: next.myStats.plateAppearances + 1,
      atBats: next.myStats.atBats + (atBat ? 1 : 0),
    },
    ourLineup: { ...next.ourLineup, records },
    ...(outs > 0
      ? {
          recentAtBatCodes: [...next.recentAtBatCodes, OUT_RESULT_CODE].slice(-RECENT_AT_BAT_COUNT),
          consecutiveHits: 0,
          homeRunStreak: 0,
          reputationCounts: { ...next.reputationCounts, homeRunStreak: 0 },
        }
      : {}),
  }
  if (settled.burst === null) return settled
  const isWalkOff = next.game.isFinished && next.game.ourScore > next.game.opponentScore
  const resolution = resolveBurst(
    settled.burst,
    burstResultBitsOf({
      // 안타 · 볼넷 갈래가 아니다 — B4(타점)는 a8946 갈래(희생플라이 · 볼넷 · 사구) 안이라 안 선다
      outcome: RUNNER_PLAY_OUTCOME_PLACEHOLDER,
      runsBattedIn: 0,
      outsBefore: before.game.outs,
      outsAdded: outs,
      humanTeamWalkOff: isWalkOff,
      // B5 의 r5 — 목록 0번(가장 뒤 주자)이 들어왔는가
      batterRunnerSafe: batterRunnerSafeOfFates(result.runnerFates),
    }),
  )
  return {
    ...settled,
    burst: resolution.session,
    lastBurstResolution: resolution.judgement !== null ? resolution : settled.lastBurstResolution,
  }
}

/** 결과 링 코드 5 — 그 밖의 아웃(땅볼 · 포스 · 태그, a8a9e) */
const OUT_RESULT_CODE = 5
