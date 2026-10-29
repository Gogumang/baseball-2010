import { EMPTY_BASES } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import type { BaseRunners } from '@/entities/game/model/baseRunners'
import type { RunnerPitcherTags } from '@/entities/game/model/runnerPitchers'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { rosterSlotAt, withLineupRecordSlot } from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import { threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type {
  HalfInningDefense,
  HalfInningMound,
  HalfInningPitcherChange,
  HalfInningPitcherLine,
} from '@/entities/game/model/simulateHalfInning/types/defense'
import type { HalfInningHooks, HalfInningPitching, HalfInningSwingContext } from '@/entities/game/model/simulateHalfInning/types/inputs'
import type { HalfInningOffense } from '@/entities/game/model/simulateHalfInning/types/offense'
import type {
  HalfInningPinchHit,
  HalfInningPlateAppearance,
  HalfInningResult,
  HalfInningStolenBase,
} from '@/entities/game/model/simulateHalfInning/types/result'

/** 반 이닝 내내 같은 입력 — `simulateHalfInningTicks` 의 인자 그대로 */
export interface HalfInningInput {
  readonly batterAt: (battingOrderIndex: number) => QuickAtBatBatter
  readonly pitcher: QuickAtBatPitcher
  readonly inning: number
  readonly random: RandomPort
  readonly before: HalfInningPitching
  readonly hooks: HalfInningHooks
  readonly defense: HalfInningDefense | undefined
  readonly offense: HalfInningOffense | undefined
  readonly swing: HalfInningSwingContext | undefined
}

/** 반 이닝을 도는 동안 바뀌는 칸 — 틱마다 엔진 단계 함수(`applyXxx`)가 고친다 */
export interface HalfInningRun {
  bases: BaseState
  /** 공격 팀 레코드 +2 를 0xb570c 가 덮었는가 (`HalfInningResult.offenseRecordTouched`) */
  offenseRecordTouched: boolean
  /** 루에 선 주자의 타순 커서 — 원본 주자 목록(sim+0x80, `baseRunners.ts`). 반 이닝은 빈 루에서 시작한다 */
  runners: BaseRunners
  /** 루별 책임 투수(주자+0x30) — 반 이닝은 빈 목록에서 시작한다(0xa9250) */
  runnerPitchers: RunnerPitcherTags | undefined
  outs: number
  runs: number
  hits: number
  walks: number
  strikeouts: number
  pitches: number
  steals: number
  readonly stolenBases: HalfInningStolenBase[]
  combo: number
  order: number
  readonly recordIds: number[]
  readonly plateAppearances: HalfInningPlateAppearance[]
  mound: HalfInningMound | undefined
  lineup: QuickLineup | undefined
  pinchHitUsed: boolean | undefined
  readonly pinchHits: HalfInningPinchHit[]
  readonly pitcherChanges: HalfInningPitcherChange[]
  /**
   * **A(`+0x284`)** 이 투수의 이번 이닝 실점. 이닝 교대 0xa5b00 이 0 으로 되돌리므로
   * 반 이닝마다 0 에서 시작한다 (P7 E1).
   */
  inningRunsAllowed: number
  /** `hooks.endsGame` 이 참을 낸 타석에서 멈췄나 */
  gameEnded: boolean
  /** `hooks.stopsBefore` 가 참을 낸 타석 앞에서 멈췄나 */
  stoppedBeforeBatter: boolean
  /** 투수 칸마다 이 이닝 줄 — 처음 던진 차례대로 */
  readonly lines: Map<number, HalfInningPitcherLine>
}

export function createHalfInningRun(battingOrderIndex: number, input: HalfInningInput): HalfInningRun {
  return {
    bases: EMPTY_BASES,
    offenseRecordTouched: false,
    runners: EMPTY_BASE_RUNNERS,
    runnerPitchers: undefined,
    outs: 0,
    runs: 0,
    hits: 0,
    walks: 0,
    strikeouts: 0,
    pitches: 0,
    steals: 0,
    stolenBases: [],
    combo: input.before.strikeoutCombo,
    order: battingOrderIndex,
    recordIds: [],
    plateAppearances: [],
    mound: input.defense?.mound,
    lineup: input.offense?.lineup,
    pinchHitUsed: input.offense?.pinchHitUsed,
    pinchHits: [],
    pitcherChanges: [],
    inningRunsAllowed: 0,
    gameEnded: false,
    stoppedBeforeBatter: false,
    lines: new Map(),
  }
}

/** 이 타순 커서에 지금 선 타자 — 명단이 있으면 명단에서, 없으면 예전처럼 `batterAt` 으로 */
export function batterOnOf(run: HalfInningRun, input: HalfInningInput, cursor: number): QuickAtBatBatter {
  const { offense } = input
  const { lineup } = run
  if (offense === undefined || lineup === undefined) return input.batterAt(cursor)
  // 레코드 칸 0xb6394 는 명단이 든다 — 경기 준비가 다시 매긴 배열 첨자(`QuickLineup.recordSlots`)
  return withLineupRecordSlot(offense.batterOf(rosterSlotAt(lineup, cursor)), lineup, cursor)
}

/** 반 이닝이 끝난 자리의 결과 — 삼구 삼자범퇴(25) 기록을 마지막에 얹는다 */
export function halfInningResultOf(run: HalfInningRun): HalfInningResult {
  run.recordIds.push(...threePitchInningRecordIdsOf(run.pitches, run.outs))
  return {
    runs: run.runs,
    nextBattingOrderIndex: run.order,
    plateAppearances: run.plateAppearances,
    hits: run.hits,
    walks: run.walks,
    outs: run.outs,
    strikeouts: run.strikeouts,
    pitches: run.pitches,
    recordIds: run.recordIds,
    strikeoutCombo: run.combo,
    steals: run.steals,
    stolenBases: run.stolenBases,
    pitcherLines: [...run.lines.values()],
    mound: run.mound,
    pitcherChanges: run.pitcherChanges,
    lineup: run.lineup,
    pinchHitUsed: run.pinchHitUsed,
    pinchHits: run.pinchHits,
    gameEnded: run.gameEnded,
    ...(run.stoppedBeforeBatter ? { stoppedBeforeBatter: run.stoppedBeforeBatter } : {}),
    bases: run.bases,
    runners: run.runners,
    offenseRecordTouched: run.offenseRecordTouched,
  }
}
