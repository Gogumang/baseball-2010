import type { RandomPort } from '@/shared/api/random/randomPort'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { rollCpuSteal, type CpuStealInput } from '@/entities/fielding/model/cpuSteal'
import {
  PASSED_BALL_PLAY_KIND,
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
import { runWalkPlay, type WalkPlayResult } from '@/features/defense-play/model/walkPlay'

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
 * 0x3e11a  switch [scene+0x10ac](v) — 표 0xcffb4 (직접 뜬 것, 판 종류를 정한 **뒤** 같은 진입에서 곧장 돈다)
 *          1 → 0x3e134 state[4](스트라이크)++ · 2 → 0x3e156 state[5](볼)++
 *          3 → 0x3e1ae state[5]++ 뒤 4 와 같이 · 4 → 0x3e1b4 0xaf020 · **0xb0cb8(플레이, 2)** ; 종류를 2(밀어내기)로 덮어쓴다
 *          5 → 0x3e15e 삼진 기록 칸 · **state[6](아웃)++**  · 그 밖(0 = 낫아웃이 지운 칸) → 건너뜀
 * 0x3e1d4  v ≠ 0 이면 state[0xc] = v · 메시지 0xbba(v) ; 0x3e1f4 0xa5fdc (연속 파울 지우기)
 * ```
 * 맞힌 공(파울·인플레이)은 `0x3dfac` 가 아니라 타격 갈래로 가서 이 굴림이 없다.
 *
 * ## 판정 칸은 판 **앞**에서 먹는다 — 판 뒤에 `[scene+0x10ac]` 를 읽는 자리는 없다
 * `0x10ac` 상수를 읽는 곳은 5곳뿐이다(xval): 0x35108 · 0x39504(그림) · 0x3dfac(여기 둘) · 0x46844(수비 화면) ·
 * 0x51408(판 끝 메시지가 **판정 결과로 덮어쓴다**). 판 끝 판정 B 0xae3e8 은 v 를 안 읽고 state[0xc] 만 본다:
 * 종류 4·5 → state[0xc] == 5 && 종류 5 면 0xd(새 타석) 아니면 0xf · 종류 9 → state[0xc] == 5 면 0xd 아니면 0xf(정산 0xa8024
 * 건너뜀) · 아웃 > 2 → 0x18. 그래서:
 * - **볼넷·사구**: 0x3e0e4 가 종류 5 를 세웠든 9 굴림(v ≠ 3·4 라 안 선다)이든 스위치 0x3e1cc 가 종류 2(밀어내기 판)로 덮어쓴다
 *   — 판정 A 0xae24c 가 그 판(상태 0x17)으로 보낸다(`walkPlay`). 출발한 주자는 그 판에서 리드(0x3d7b8 — 종류 2 의 도루 주자는
 *   틱 0)를 타고, 밀리지 않으면 제 루로 돌아간다(0x46664).
 * - **삼진 + 도루(1아웃 이하)**: 삼진 아웃이 판 앞에서 붙어 판은 **아웃 + 1** 로 열린다(`playOutsOf`). 판에서 셋째 아웃이 나도
 *   삼진은 그대로다(이미 센 아웃). 종류 9 에서 삼진이 선(1루 주자 && 아웃 ≤ 1) 판도 같다. 낫아웃은 판정 칸을 0 으로 지워 아웃이 없다.
 * - **볼·스트라이크 + 판에서 3아웃**: 카운트는 이미 올랐고 판정 B 가 0x18(공수 교대)로 보낸다 — 그 타석은 끊긴다.
 *
 * ## 판 뒤
 * - 진루·아웃·득점은 `result.advance` (판 안의 자동 진루 0xaf918 까지 다 돈 값, 아웃은 판을 연 아웃 수에 더할 값).
 * - 콜: 도루 판 `stealCallSoundIdOf` · 폭투 판 `passedBallCallSoundIdOf`.
 * - 기록: 도루 판만 정산 0xa8024 @a83c6·@a83de(state[0x26] == 5) → `stealPlayRecordIdsOf` (8 도루 · 24 도루 저지).
 *   0xa77f0 게이트(8 은 사람 공격 · 24 는 사람 수비)는 부르는 쪽이 건다.
 * - `PitchArrivalPlayInput.outs` 는 **이 투구 전의 아웃 수**(종류 고르기 0x3e0ee 가 읽는 값)다. 부르는 쪽은 판의 advance 를
 *   이 아웃 수 위에 주자 판으로 먼저 먹이고, 타석이 끝났으면(삼진) 그 뒤 보통 길로 삼진 아웃을 더한다 — 판을 연 아웃 수
 *   (투구 전 + 1)에 판 아웃을 더한 것과 합이 같다. 판 아웃은 셋째 아웃에서 멈추므로 이 순서로 3아웃을 넘지 않는다.
 * - 밀어내기 판(종류 2)은 `walkPlay` 가 돈다 — 난수가 없고 진루 결과는 보통 길(밀어내기)과 같아, 부르는 쪽은 경기 상태를
 *   보통 길로 먹이고 이 판은 재생 칸에만 넣는다(`arrivalApplicationOf` 가 `'freePass'`). 사구 벤치 클리어링(0x1e)이 서면 그 뒤에 재생한다.
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
  /** 이 투구 전의 아웃 수 (state[6]) — 판 종류 고르기(0x3e0ee)가 읽는다. 판은 삼진이 서면 + 1 로 연다(`playOutsOf`) */
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
  /**
   * 장면 +0xfdc — 공이 도착할 때의 번트 종류(0 = 없음). 판 시작 리드 `0x3d7b8`(3d8e0 이 장면 +0xfdc 를 바로 읽는다)이
   * 도루 안 한 주자에게 +3 틱을 더한다 — 도루 판(종류 5)의 `runStealPlay` 로 넘긴다. 못 맞힌 번트(번트 헛스윙 · 번트 자세로 맞이한 볼)면
   * 그 공의 번트 종류가 서 있다. 기본 0.
   * ⚠️ 종류 9(폭투·포일) 판은 웹이 판 시작 리드를 아직 안 옮겨(`runPassedBallPlay`) 이 값을 안 본다.
   * ⚠️ 미해결(남은 것): +0xfdc 를 쓰는 곳은 CPU 스윙 결정 0x34436(휘두를 때만 0 → 번트면 rand(1, 4)) · 사람 키
   *   0x51dce · 0x51e2c(스윙 0) · 0x51e84(번트 종류) · 0x51eba(번트 거두기 0) 다섯뿐이라(`xval 0xfdc` 전수), 안 휘두른 공은
   *   **앞 공의 값이 그대로 남는다** — 부르는 쪽은 아직 이 공의 번트 종류만 넘기고 안 휘두른 공은 0 으로 둔다.
   */
  readonly buntKind?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) — 열린 판이 이어받고 결과의 `scene` 으로 돌려준다 */
  readonly scene?: DefenseScene
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
  | {
      /** 볼넷 · 사구 밀어내기 판 (0x3e1b4 0xb0cb8(플레이, 2)) — 판정 콜 · 판 기록이 없다 */
      readonly kind: 2
      readonly result: WalkPlayResult
      readonly strikeout: 'none'
      readonly callSoundId: null
      readonly recordIds: readonly number[]
    }

/**
 * 공 도착 한 번. **난수 차례**: `rollPassedBall` 1번(모드 7 제외) → 종류 9 면 `passedBallShot` 2번 → 판 안의 굴림
 * (펌블 · 악송구 · 특수 송구) / 종류 5 면 판 안의 굴림(도루 주자마다 리드 rand(0,9) · 악송구 · 특수 송구) /
 * 종류 2(볼넷 · 사구)는 굴림 없음. 판이 안 열리면 null.
 */
export function runPitchArrivalPlay(input: PitchArrivalPlayInput, random: RandomPort): PitchArrivalPlay | null {
  const passedBall = rollPassedBall(input.gameMode, random)
  const kind = pitchPlayKindOf({
    passedBall,
    pitchJudgement: input.pitchJudgement,
    stealing: input.stealingFrom.length > 0,
    outs: input.outs,
  })
  // 0x3e1cc — 볼넷·사구면 판정 칸 스위치가 종류를 2(밀어내기)로 덮어쓴다 — 0x3e062 의 종류 9 는 v ≠ 3·4 일 때만이라
  // 여기 오는 것은 종류 없음 · 종류 5(도루) 둘뿐이고, 어느 쪽이든 밀어내기 판이 열린다
  if (input.pitchJudgement === PITCH_JUDGEMENT.WALK || input.pitchJudgement === PITCH_JUDGEMENT.HIT_BY_PITCH) {
    const result = runWalkPlay({
      bases: input.bases,
      outs: input.outs,
      pitchJudgement: input.pitchJudgement,
      stealingFrom: input.stealingFrom,
      defenseAbilities: input.defenseAbilities,
      runAbilities: input.runAbilities,
      runAbility: input.runAbility,
      runnerTeamGrade: input.runnerTeamGrade,
      aceIndexes: input.aceIndexes,
      defenseTeamIndex: input.defenseTeamIndex,
      offenseTeamIndex: input.offenseTeamIndex,
      scene: input.scene,
    })
    return { kind: 2, result, strikeout: 'none', callSoundId: null, recordIds: [] }
  }
  if (kind === null) return null
  const strikeout =
    kind === PASSED_BALL_PLAY_KIND
      ? passedBallStrikeoutOf({
          pitchJudgement: input.pitchJudgement,
          firstBaseOccupied: input.bases.first,
          outs: input.outs,
        })
      : 'none'
  const common = {
    bases: input.bases,
    outs: playOutsOf(input.outs, input.pitchJudgement, strikeout),
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
    scene: input.scene,
  }
  if (kind === PASSED_BALL_PLAY_KIND) {
    const shot = passedBallShot(random)
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
    // 0x3d7b8 — 도루 안 한 주자의 리드 +3 틱(번트 종류가 서 있으면)
    buntKind: input.buntKind,
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

/**
 * 판을 여는 아웃 수 — 0x3e15e 가 삼진(v == 5)이면 판 앞에서 state[6]++ 한다. 도루 판(5)은 1아웃 이하 삼진만 열리고,
 * 폭투 판(9)은 삼진이 선 판(`'strikeoutStands'`)만 아웃이 붙는다(낫아웃은 0x3e0aa 가 판정 칸을 0 으로 지워 스위치를 건너뛴다).
 */
function playOutsOf(outs: number, pitchJudgement: number, strikeout: PassedBallStrikeout | 'none'): number {
  if (pitchJudgement !== PITCH_JUDGEMENT.STRIKEOUT) return outs
  return strikeout === 'batterRuns' ? outs : outs + 1
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
 *   (삼진) 그 뒤 보통 길로 타석 결과를 먹인다.
 * - `'batterRuns'`: 낫아웃 — 판의 advance 가 곧 이 타석의 진루다(타자주자 포함). 삼진 기록은 그대로.
 * - `'freePass'`: 볼넷 · 사구 밀어내기 판(종류 2) — advance 를 먹이지 않는다. 타석 결과(볼넷 · 사구)를 보통 길로 먹이면
 *   진루가 판과 같다(판정 B → 정산 0xa8024 → 0xd). 판은 재생 칸에만 넣는다.
 *
 * 판에서 3아웃이 나는 것은 볼·스트라이크(카운트만 오른 공)뿐이다 — 판정 B 0xae3e8 이 0x18 로 보내 그 타석은 끊긴다
 * (다음 이닝 같은 타자부터 — ⚠️ 정산 0xa8024 가 종류 5 에서 타순을 미는지는 안 읽었다). 삼진은 판 앞에서 아웃이 붙고
 * (위 머리말), 볼넷·사구는 도루 판이 안 열린다.
 */
export function arrivalApplicationOf(play: PitchArrivalPlay): 'runnerOnly' | 'batterRuns' | 'freePass' {
  if (play.kind === 2) return 'freePass'
  return play.kind === 9 && play.strikeout === 'batterRuns' ? 'batterRuns' : 'runnerOnly'
}
