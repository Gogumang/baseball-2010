import type { RandomPort } from '@/shared/api/random/randomPort'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { rollCpuSteal, type CpuStealInput } from '@/entities/fielding/model/cpuSteal'
import {
  passedBallShot,
  passedBallStrikeoutOf,
  rollPassedBall,
  type PassedBallStrikeout,
} from '@/entities/fielding/model/passedBall'
import { canStartSteal, pitchPlayKindOf, type StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import { stealPlayRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import {
  passedBallCallSoundIdOf,
  runPassedBallPlay,
  type PassedBallPlayResult,
} from '@/features/defense-play/model/passedBallPlay'
import { runStealPlay, stealCallSoundIdOf, type StealPlayResult } from '@/features/defense-play/model/stealPlay'

/**
 * **투구 하나에 붙는 주자 판** — 사람 경기에서 공이 날아가는 동안(상태 0x11) 출발한 도루와, 공이 도착한
 * 순간(상태 0x12 진입 `0x3dfac`) 여는 폭투·포일(종류 9)·도루(종류 5) 판을 한 줄로 잇는다.
 * 진행기(타자편·팀 경기·투수편·미션)가 같은 차례로 부르도록 모아 둔 것이다.
 *
 * ## 출발 — 상태 0x11 (메시지 0x583 → `0xa9bd4`)
 * - 사람 공격: 키 '3' → 1루 · '2' → 2루 · '1' → 3루 주자 (`0x53610`). `canStartSteal` 이 받으면 `stealingFrom` 에 넣는다.
 *   **난수 없음** (`startHumanSteal`).
 * - CPU 공격(사람 수비): `0x537dc` 가 상태 0x11 의 10번째 틱에 메시지 0x583(−1) → `0x520de` 가 루를 고른다.
 *   같은 상태의 11번째 틱이 CPU 타자 결정 `0x34334` 다 — 곧 **타자 결정 굴림 바로 앞**에서 후보가 있을 때만
 *   `rand(0,1000)` 한 번 (`rollCpuStealStart`). 이어서 `canStartSteal`(0xa9bd4).
 *
 * ## 공 도착 — `0x3dfac` (못 맞힌 투구만: 볼 · 스트라이크(헛스윙 포함) · 사구)
 * ```
 * 0x3e038  r = 0x35034                 ; rollPassedBall — 모드 7 빼고 매 투구 rand(0,10000) 한 번
 * 0x3e05a  v = 0x9d57c                 ; 투구 판정 (1 스트라이크 · 2 볼 · 3 볼넷 · 4 사구 · 5 삼진)
 * 0x3e062  r && v ≠ 3·4 → 0x3507c(rand 두 번) · 종류 9 ; v == 5 면 낫아웃 갈래 (passedBallStrikeoutOf)
 * 0x3e0e4  아니고 도루 중 && !(아웃 > 1 && v == 5) → 종류 5
 * ```
 * 맞힌 공(파울·인플레이)은 `0x3dfac` 가 아니라 타격 갈래로 가서 이 굴림이 없다.
 *
 * ## 판 뒤
 * - 진루·아웃·득점은 `result.advance` (판 안의 자동 진루 0xaf918 까지 다 돈 값).
 * - 콜: 도루 판 `stealCallSoundIdOf` · 폭투 판 `passedBallCallSoundIdOf`.
 * - 기록: 도루 판만 정산 0xa8024 @a83c6·@a83de(state[0x26] == 5) → `stealPlayRecordIdsOf` (8 도루 · 24 도루 저지).
 *   0xa77f0 게이트(8 은 사람 공격 · 24 는 사람 수비)는 부르는 쪽이 건다.
 * - `outs` 는 **이 투구 전의 아웃 수** — 0x3dfac 는 판정 칸만 적고 0x17 로 간다(삼진 아웃은 판 뒤에 붙는다).
 */

/** 0x9d57c 투구 판정 — E 4b: 1 스트라이크 · 2 볼 · 3 볼넷 · 4 사구 · 5 삼진 */
export const PITCH_JUDGEMENT = {
  STRIKE: 1,
  BALL: 2,
  WALK: 3,
  HIT_BY_PITCH: 4,
  STRIKEOUT: 5,
} as const

/** 공 도착 판정 `0x3dfac` 를 지나는 공인가 — 맞히지 못한 공(볼·스트라이크·사구)만 */
export function arrivesUnhit(resolution: PitchResolution): boolean {
  return resolution.kind === '볼' || resolution.kind === '스트라이크' || resolution.kind === '사구'
}

/**
 * 못 맞힌 공의 투구 판정 v (0x9d57c) — 이 공을 먹인 뒤의 타석 결과로 고른다.
 * 사구가 맨 먼저(0x9d582), 그다음 스트라이크 쪽(+4 > 1 이면 5) · 볼 쪽(+5 > 2 이면 3).
 */
export function pitchJudgementOf(resolution: PitchResolution, outcomeAfter: AtBatOutcome | null): number {
  if (resolution.kind === '사구') return PITCH_JUDGEMENT.HIT_BY_PITCH
  if (resolution.kind === '볼') return outcomeAfter?.kind === '볼넷' ? PITCH_JUDGEMENT.WALK : PITCH_JUDGEMENT.BALL
  return outcomeAfter?.kind === '삼진' ? PITCH_JUDGEMENT.STRIKEOUT : PITCH_JUDGEMENT.STRIKE
}

/** 사람 공격의 도루 키 — `canStartSteal` 이 받으면 넣는다. 난수 없음. 못 받으면 같은 배열을 돌려준다 */
export function startHumanSteal(
  bases: BaseState,
  stealingFrom: readonly StealBase[],
  base: StealBase,
): readonly StealBase[] {
  if (!canStartSteal({ bases, alreadyStealing: stealingFrom }, base)) return stealingFrom
  return [...stealingFrom, base]
}

/** 사람 공격의 도루 키 '3'·'2'·'1' → 대상 주자의 루 (`0x53610`). 다른 키는 null */
export function stealBaseOfKey(key: string): StealBase | null {
  if (key === '3') return 1
  if (key === '2') return 2
  if (key === '1') return 3
  return null
}

/**
 * CPU 공격의 도루 출발 — `0x520de`(rollCpuSteal) → `0xa9bd4`(canStartSteal).
 * 부르는 자리는 CPU 타자 결정 `0x34334` 굴림 **바로 앞**. 후보가 없으면 굴리지 않는다.
 */
export function rollCpuStealStart(input: CpuStealInput, random: RandomPort): readonly StealBase[] {
  const base = rollCpuSteal(input, random)
  if (base === null) return []
  return canStartSteal({ bases: input.bases }, base) ? [base] : []
}

export interface PitchArrivalPlayInput {
  /** 전역 모드 (`[scene+0x1104]`) — 7(홈런더비)이면 0.1% 굴림을 안 한다 */
  readonly gameMode: number
  /** 0x9d57c 투구 판정 v (`pitchJudgementOf`) */
  readonly pitchJudgement: number
  /** 이번 투구에 출발한 주자들의 루 (state[0x14+루]) */
  readonly stealingFrom: readonly StealBase[]
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 이 투구 전의 아웃 수 (state[6]) */
  readonly outs: number
  readonly defenseAbilities?: readonly number[]
  /** 루별 주자 주루 (0 = 낫아웃 타자주자) */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
  readonly defenseIsCpu?: boolean
  readonly throwMode?: ManualAutoMode
  readonly offenseIsCpu?: boolean
  readonly runningMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
}

export type PitchArrivalPlay =
  | {
      readonly kind: 9
      readonly result: PassedBallPlayResult
      /** 0x3e09e 낫아웃 갈래 — `'batterRuns'` 면 판의 advance 에 타자주자가 들어 있다 */
      readonly strikeout: PassedBallStrikeout
      readonly callSoundId: number | null
      /** 종류 9 정산에는 도루 기록이 없다 */
      readonly recordIds: readonly number[]
    }
  | {
      readonly kind: 5
      readonly result: StealPlayResult
      readonly strikeout: 'none'
      readonly callSoundId: number | null
      /** 0xa8024 @a83c6·@a83de 의 후보 (게이트 전) */
      readonly recordIds: readonly number[]
    }

/**
 * 공 도착 한 번. **난수 차례**: `rollPassedBall` 1번(모드 7 제외) → 종류 9 면 `passedBallShot` 2번 → 판 안의 굴림
 * (펌블 · 악송구 · 특수 송구) / 종류 5 면 판 안의 굴림(도루 주자마다 리드 rand(0,9) · 악송구 · 특수 송구).
 * 판이 안 열리면 null.
 */
export function runPitchArrivalPlay(input: PitchArrivalPlayInput, random: RandomPort): PitchArrivalPlay | null {
  const passedBall = rollPassedBall(input.gameMode, random)
  const kind = pitchPlayKindOf({
    passedBall,
    pitchJudgement: input.pitchJudgement,
    stealing: input.stealingFrom.length > 0,
    outs: input.outs,
  })
  if (kind === null) return null
  const common = {
    bases: input.bases,
    outs: input.outs,
    defenseAbilities: input.defenseAbilities,
    runAbility: input.runAbility,
    runnerTeamGrade: input.runnerTeamGrade,
    random,
    defenseIsCpu: input.defenseIsCpu,
    throwMode: input.throwMode,
    offenseIsCpu: input.offenseIsCpu,
    runningMode: input.runningMode,
    aceIndexes: input.aceIndexes,
    defenseTeamIndex: input.defenseTeamIndex,
    offenseTeamIndex: input.offenseTeamIndex,
  }
  if (kind === 9) {
    const shot = passedBallShot(random)
    const strikeout = passedBallStrikeoutOf({
      pitchJudgement: input.pitchJudgement,
      firstBaseOccupied: input.bases.first,
      outs: input.outs,
    })
    const result = runPassedBallPlay({
      ...common,
      shot,
      batterRuns: strikeout === 'batterRuns',
      runAbilities: input.runAbilities,
    })
    return { kind: 9, result, strikeout, callSoundId: passedBallCallSoundIdOf(result), recordIds: [] }
  }
  const runAbilities = input.runAbilities
  const result = runStealPlay({
    ...common,
    stealingFrom: input.stealingFrom,
    runAbilities:
      runAbilities === undefined ? undefined : { 1: runAbilities[1], 2: runAbilities[2], 3: runAbilities[3] },
  })
  return {
    kind: 5,
    result,
    strikeout: 'none',
    callSoundId: stealCallSoundIdOf(result),
    recordIds: stealRecordIdsOf(result),
  }
}

/** 도루 판 정산 — 잡힌 도루 주자가 있으면 24 한 번, 아니면 루를 옮긴 도루 주자마다 8 */
export function stealRecordIdsOf(result: Pick<StealPlayResult, 'stolenFrom' | 'caughtFrom'>): number[] {
  const runner = (fromBase: StealBase, safe: boolean) => ({
    stealStarted: true,
    fromBase,
    currentBase: safe ? fromBase + 1 : fromBase,
    targetBase: fromBase + 1,
    finished: true,
    safe,
  })
  return stealPlayRecordIdsOf({
    isRunnerPlay: true,
    runners: [
      ...result.caughtFrom.map((from) => runner(from, false)),
      ...result.stolenFrom.map((from) => runner(from, true)),
    ],
  })
}

/**
 * 판이 끝난 뒤 타석 결과를 어떻게 먹이나 — 부르는 진행기 공용 규칙.
 * - `'runnerOnly'`: 판의 advance 를 주자 판(견제와 같은 꼴, 타순 그대로)으로 먼저 먹이고, 타석이 끝났으면
 *   (볼넷·사구·삼진) 그 뒤 보통 길로 타석 결과를 먹인다.
 * - `'batterRuns'`: 낫아웃 — 판의 advance 가 곧 이 타석의 진루다(타자주자 포함). 삼진 기록은 그대로.
 *
 * ⚠️ 판에서 3아웃이 나면 그 타석은 끊긴다(다음 이닝 같은 타자부터) — 견제사로 끊긴 타석과 같은 근사.
 *   원본이 판 뒤 판정 칸 `[scene+0x10ac]`(볼넷·삼진)를 읽는 자리는 안 떴다.
 */
export function arrivalApplicationOf(play: PitchArrivalPlay): 'runnerOnly' | 'batterRuns' {
  return play.kind === 9 && play.strikeout === 'batterRuns' ? 'batterRuns' : 'runnerOnly'
}
