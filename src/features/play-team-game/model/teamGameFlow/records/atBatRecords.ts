import { passesRecordTeamGate, backToBackRecordOf, pinchHitHomeRunRecordIdsOf, foulRecordOf } from '@/entities/game/model/gameRecords'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { recordBatterAtBat, EMPTY_BATTER_GAME_LOG } from '@/entities/game/model/batterGameLog'
import type { GameState } from '@/entities/game/model/gameState'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'
import type { TeamRecordTally } from '@/features/play-team-game/model/teamGameFlow/types/records'

/* ── 기록달성 (0xa8024 등 → 지급 0xa77f0) ─────────────────────────────────────── */

/**
 * 지급 게이트 `0xa77f0` 을 지나 기록을 쌓는다 (R8 1절).
 * a77f2 게이트(`[ctx+0x24]`, 투수편 강판 뒤)는 팀 경기에서 늘 열려 있고, 번호마다 방향(a7818·a785e·a78bc)을 본다 — 팀 경기에서 사람 팀은 우리 팀 하나라
 * 우리 공격이면 공격 팀이, 우리 수비면 수비 팀이 사람이다. 모드 5·6·7 갈래(a780a)는 팀 경기에 없다.
 */
export function withGameRecords(progress: TeamGameProgress, recordIds: readonly number[], humanOffense: boolean): TeamGameProgress {
  if (recordIds.length === 0) return progress
  const passed = recordIds.filter((id) => passesRecordTeamGate(id, { offenseIsHuman: humanOffense, defenseIsHuman: !humanOffense }))
  return passed.length === 0 ? progress : { ...progress, recordIds: [...progress.recordIds, ...passed] }
}

/**
 * **우리 타석 하나의 기록달성** — 정산 `0xa8024` 의 안타 갈래(5-3)와 범타·볼넷·사구 갈래(5-4).
 *
 * - 0 3루타 · 1~4 홈런 단계 · 9~11 연타석 · 12~14 한 타자 홈런 · 15 사이클 · 34·35 한 타자 볼넷 —
 *   타순 칸 결과 목록(`ourBatterLogs`)으로 가린다(`recordBatterAtBat`, 타자편 동료 타석과 같은 함수).
 * - 6·7 백투백 — `ctx+0x162` (`backToBackRecordOf`). 홈런 아닌 결과면 0.
 * - 5 대타 홈런 — 사람이 대타를 낸 그 타석의 홈런 (`ctx+0x160`).
 * 사람 장면 타석과 간이 엔진 타석(0xc11f0·0xc15a4 도 같은 0xa8024 를 지난다) 둘 다 여기로 온다.
 */
export function withOurAtBatRecords(
  progress: TeamGameProgress,
  slot: number,
  outcome: AtBatOutcome,
  runsBattedIn: number,
  isPinchHitAtBat: boolean,
  /** 정산 [sp+0x24] > 0 — 홈런 갈래에 드는가 (`homeRunCountedOf`). 안 넘기면 홈런이면 참 */
  homeRunCounted = outcome.kind === '홈런',
): TeamGameProgress {
  const recorded = recordBatterAtBat(progress.ourBatterLogs[slot] ?? EMPTY_BATTER_GAME_LOG, outcome, runsBattedIn, {
    homeRunCounted,
  })
  // 홈런 갈래를 건너뛴 장내 홈런은 안타 갈래 a86b4 가 ctx+0x162 를 0 으로 둔다 · a8764 대타 홈런도 홈런 갈래 안이다
  const isHomeRun = homeRunCounted
  const backToBack = backToBackRecordOf({
    streak: progress.recordTally.homeRunStreak,
    humanOffense: true,
    isHomeRun,
  })
  const ourBatterLogs = [...progress.ourBatterLogs]
  ourBatterLogs[slot] = recorded.log
  return withGameRecords(
    { ...progress, ourBatterLogs, recordTally: { ...progress.recordTally, homeRunStreak: backToBack.streak } },
    [
      ...recorded.recordIds,
      ...backToBack.recordIds,
      // a8764 — 홈런이고 ctx+0x160 이 서 있으면
      ...pinchHitHomeRunRecordIdsOf({ isHomeRun, isPinchHitAtBat }),
    ],
    true,
  )
}

/** 지금 반 이닝에 던진 공 수 (`ctx+0x16c`) — 반 이닝이 바뀌었으면 0xa5b00 이 0 으로 되돌린 것이다 */
export function halfInningPitchesOf(tally: TeamRecordTally, game: GameState): number {
  const half = tally.halfInningPitches
  return half.inning === game.inning && half.half === game.half ? half.pitches : 0
}

/** 공 `pitches` 개를 반 이닝 투구 수에 더한다 (0xa5e14 의 a5e4e) */
export function withHalfInningPitches(tally: TeamRecordTally, game: GameState, pitches: number): TeamRecordTally {
  return {
    ...tally,
    halfInningPitches: {
      inning: game.inning,
      half: game.half,
      pitches: halfInningPitchesOf(tally, game) + pitches,
    },
  }
}

/**
 * **32·33 연속 파울** — 파울 판정 `0x51408` 의 v = 7 갈래가 `0xa7dbc` 로 `ctx+0x15f` 를 올리고 3·4 에서 준다(사람 공격).
 * 파울이 아닌 공이 오면 공 도착 판정 `0x3dfac` 끝의 `0xa5fdc` 가 0 으로 되돌린다 — **모든 갈래가 지난다**(직접 떴다): 0x3dfac 의
 * 나가는 곳은 3e1fc 의 pop 하나이고, 점프표 0xcffb4(결과 1~13)의 열세 칸과 그 밖 갈래가 모두 3e1d4 → 3e1ec → 3e1f6 `0xa5fdc` 를
 * 지난다(R8 4-4 의 "유력" 을 닫는다). 타석 초기화 0xa5bcc 도 지운다(`prepareAtBat`).
 */
export function withFoulRecords(progress: TeamGameProgress, isFoul: boolean): TeamGameProgress {
  if (!isFoul) {
    return progress.recordTally.foulStreak === 0 ? progress : { ...progress, recordTally: { ...progress.recordTally, foulStreak: 0 } }
  }
  const fouled = foulRecordOf(progress.recordTally.foulStreak)
  return withGameRecords({ ...progress, recordTally: { ...progress.recordTally, foulStreak: fouled.foulStreak } }, fouled.recordIds, true)
}
