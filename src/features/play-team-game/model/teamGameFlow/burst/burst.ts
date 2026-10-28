import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { resolveBurst, cancelBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { withSeasonBurstMorale } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 돌발 경기 기록 검사 `0x8ec9c`(b6·b7)가 보는 세 값 — 돌발 객체의 state(+0x22c)·팀 표(+0x230)로 읽는다:
 * ```
 * 8ecbe  b6 == 1: team = 팀[state[9]](공격) ; rec = team + 0x34 + team[0x32]·0x18 ; rec[+0x12]   ; 그 타순 칸 안타
 * 8ece8  b6 == 2:                                 같은 rec 의 [+0x13]                            ; 그 타순 칸 홈런
 * 8ed14  b6 == 3: team = 팀[state[0xa]](수비) ; 0xb8cec(team)[0]                                ; 지금 투수 경기 탈삼진
 * ```
 * `+0x13` 은 정산 `0xa8024` 의 안타 갈래 a874c 가 `[sp+0x24] > 0` 일 때 올린다 — sp+0x24 는 홈런 이벤트(8)·그라운드
 * 홈런(state[0x25])이 세는 **홈런 수**다(a80a8 · E-defense 1e, 바로 뒤가 한 타자 홈런 0xa7b00·대타 홈런 5).
 * `0xb8cec` 는 `team + 0x244 + 4·team[0]` — 지금 마운드 투수의 경기 기록이고 R[0] 이 탈삼진이다(`recordTally` 주석).
 *
 * 웹 칸: 안타·홈런 = 타순 칸 기록 `+0x12`·`+0x13`(`*EntryRecords[칸].hits`·`.homeRuns` — 양 팀 같은 칸),
 * 우리 투수 탈삼진 = `recordTally.moundStrikeouts`(교체 때 0), 상대 투수 탈삼진 = 그 투수의 경기 줄(`pitcherLines`).
 *
 * **상대 마투수의 탈삼진**은 마투수가 붙박이 표 칸이 없어 경기 줄에서 빠지므로 `opponentAceStrikeouts` 로 따로 센다(r278).
 * 시즌 표(XlsSEASON_BURST 56행)에는 b6 ≠ 0 인 행이 하나도 없어 지금 경기 결과는 바뀌지 않는다 (b6 은 타자·투수편 표만 쓴다).
 */
export function burstGameRecordOf(
  progress: TeamGameProgress,
  humanBatting: boolean,
): { readonly hitsInGame: number; readonly homeRunsInGame: number; readonly strikeoutsInGame: number } {
  if (humanBatting) {
    const slot = progress.game.battingOrderIndex
    const entry = pitcherEntryAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex)
    const line =
      entry?.tableSlot === undefined || entry.aceIndex >= 0
        ? undefined
        : progress.pitcherLines.find(
            (candidate) => candidate.teamId === (entry.tableTeamId ?? progress.options.opponentTeamId) && candidate.pitcherSlot === entry.tableSlot,
          )
    return {
      hitsInGame: progress.ourEntryRecords[slot]?.hits ?? 0,
      homeRunsInGame: progress.ourEntryRecords[slot]?.homeRuns ?? 0,
      strikeoutsInGame: entry !== undefined && entry.aceIndex >= 0 ? progress.opponentAceStrikeouts : (line?.strikeouts ?? 0),
    }
  }
  return {
    hitsInGame: progress.opponentEntryRecords[progress.opponentOrderIndex]?.hits ?? 0,
    homeRunsInGame: progress.opponentEntryRecords[progress.opponentOrderIndex]?.homeRuns ?? 0,
    strikeoutsInGame: progress.recordTally.moundStrikeouts,
  }
}

/** 타석이 끝나는 자리에서 돌발을 판정한다 (0x8f414) */
export function resolveBurstFor(
  progress: TeamGameProgress,
  play: {
    outcome: AtBatOutcome
    runsBattedIn: number
    outsBefore: number
    outsAdded: number
    humanTeamWalkOff: boolean
    /** B5 — 안타 없이 살아 나간 타자주자(야수 선택)도 출루다 (0xa87ba r5). 판 없는 타석은 undefined */
    batterRunnerSafe?: boolean
    /** B6 — 번트 타구(state[0x13]) */
    isBunt?: boolean
    /** B6 — 희생 [sp+8] (`DefensePlayResult.sacrifice`) */
    runnersAdvanced?: boolean
    /** B7 — 0xb68dc 파울 (`DefensePlayResult.buntFoulOut`) */
    foulBall?: boolean
    /** B7 — 판 끝 2·3루의 산 앞 주자 (`DefensePlayResult.scoringBaseRunnerAfter`) */
    runnerInScoringPositionAfter?: boolean
    /** B0 — 정산 홈런 수 [sp+0x24] > 0 (`homeRunCountedOf`) */
    homeRunCounted?: boolean
    /** B9 — 낫아웃(state[0x1a])이면 삼진이어도 안 켠다 (a8fc6) */
    strikeoutWhileRunning?: boolean
  },
): TeamGameProgress {
  if (progress.burst === null) return progress
  // 사구도 B5(출루)·B11 을 켠다 (0xa882a "볼 4개 || 사구" · 0xa8bf4) — burstResultBitsOf 가 '사구' 를 직접 받는다
  const resolution = resolveBurst(progress.burst, burstResultBitsOf(play))
  // 시즌모드 사기(종류 1)는 판정 그 경기 중에 팀 레코드 +2 에 쌓인다 — 다음 공부터 용량 · 사기 감소가 본다 (`withSeasonBurstMorale`)
  const options = resolution.deltas.length === 0 ? progress.options : withSeasonBurstMorale(progress.options, resolution.deltas)
  return {
    ...progress,
    ...(options === progress.options ? {} : { options }),
    burst: resolution.session,
    lastBurstResolution: resolution.judgement !== null ? resolution : null,
    burstRewardDeltas: resolution.deltas.length === 0 ? progress.burstRewardDeltas : [...progress.burstRewardDeltas, ...resolution.deltas],
  }
}

/** 돌발 결과 창을 닫는다 (보상은 앱이 시즌 레코드에 얹는다 — 판정에 변화량이 들어 있다) */
export function closeBurstWindow(progress: TeamGameProgress): TeamGameProgress {
  return progress.lastBurstResolution === null ? progress : { ...progress, lastBurstResolution: null }
}

/**
 * **남은 돌발을 판정 없이 내린다** — `0x8f628` (`cancelBurst`, 굴림 없음 · obj+0x21c·+0xc 만 −1).
 * 부르는 곳은 상태 0x21(자동진행) 진입 `0x3abf0` 과 0x18 뒤집힘 진입 `0x3ac90` 둘뿐이다.
 * 돌발 객체는 시즌(모드 2)에만 있어 다른 모드에서는 아무 일도 없다.
 */
export function withoutPendingBurst(progress: TeamGameProgress): TeamGameProgress {
  if (progress.burst === null) return progress
  const burst = cancelBurst(progress.burst)
  return burst === progress.burst ? progress : { ...progress, burst }
}

/**
 * 상태 0x18 진입 `0x3ac90` — 경기가 안 끝났고 `0xb6b6c`(아웃 > 2 → 초/말 뒤집기)가 참이면 `0x8f628`.
 * 사람이 잡은 마지막 반 이닝(`lastHumanHalf`)과 지금 반 이닝이 다르면 그 사이에 뒤집힘이 있었다
 * (그 사이 자동 타석이 있었으면 0x21 진입이 이미 내렸다 — 두 번 내려도 같다).
 */
export function withoutBurstOnHalfFlip(progress: TeamGameProgress): TeamGameProgress {
  const last = progress.lastHumanHalf
  if (last === null || (last.inning === progress.game.inning && last.half === progress.game.half)) return progress
  return withoutPendingBurst(progress)
}
