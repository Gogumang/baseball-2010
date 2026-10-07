import {
  BEST_DISTANCE_LIMIT,
  COMBO_BONUS_UNIT,
  DERBY_PITCH_COUNT,
  EVENT_ZONE_BONUS,
  derbyGamePointOf,
  nextAceStageOf,
} from '@/entities/home-run-derby/model/derbyRules'

/**
 * 홈런더비 한 판의 상태 — 원본 경기 상태 구조체(경기 장면 this+0x174 = 전역 `0x1552d0c`)의
 * 홈런더비 칸을 그대로 옮긴 것이다 (`docs/re/H-modes.md` H-2, 초기화 `0xb6814`).
 *
 * | 필드 | 원본 칸 |
 * |---|---|
 * | remainingPitches | +0x33 |
 * | totalDistance | +0x34 (s16) |
 * | lastDistance | +0x36 (표시용) |
 * | stage | +0x38 |
 * | combo | +0x39 |
 * | wasPreviousHomeRun | +0x3a |
 * | maxCombo | +0x3d |
 * | isBonusGame | +0x3e |
 * | bonusGamePoint | +0x40 |
 * | pitchesThrown | +0x68 |
 * | comboDisplay | +0x84 |
 *
 * (+0x3b "이번 공 홈런" 과 +0x3f "이번 공 이벤트 존" 은 공 하나가 끝나면 바로 지워지는 임시 칸이라
 *  여기 들고 있지 않고 `applyDerbyPitch` 의 인자로 받는다.)
 */
export interface DerbyRun {
  readonly remainingPitches: number
  readonly totalDistance: number
  readonly lastDistance: number
  readonly stage: number
  readonly combo: number
  readonly wasPreviousHomeRun: boolean
  readonly maxCombo: number
  readonly isBonusGame: boolean
  readonly bonusGamePoint: number
  readonly pitchesThrown: number
  /**
   * **콤보 표시값 +0x84** — 콤보를 올릴 때만 그 값을 쓴다(0xae46c `strb 콤보, [+0x84]`).
   * 마지막 공에서 콤보(+0x39)를 0 으로 지워도(ae470) 이 칸은 **안 지운다**. 지우는 곳은 둘뿐이다:
   * 경기 시작 상태 9 `0x39868`(+0x84 · 장면 +0x1b60 · +0x19ec = 0)과 표시가 끝날 때 `0x45a12`(→ `endComboDisplay`).
   * 읽는 곳도 둘뿐이다: 다음 공 준비(상태 0xf) `0x3d954` 의 `0x3dbf8`(> 0 이면 표시 시작)과 HUD 콤보 그리기 `0x4585c`.
   */
  readonly comboDisplay: number
  /** 경기 상태 0x1a(결과 화면)로 넘어갔는가 */
  readonly isFinished: boolean
}

/** 공 하나의 결과 — 원본이 0xae24c(아웃·헛스윙)·0xae3e8(타구)로 들어갈 때 이미 정해져 있는 값들 */
export interface DerbyPitchOutcome {
  /** 이번 공이 홈런이었나 (+0x3b) */
  readonly isHomeRun: boolean
  /** 이번 타구가 누적에 더한 비거리 (0xa600c) — 홈런 · 홈런 아닌 페어 공의 낙구. 파울 · 못 맞힌 공은 0 이다 (`derbyBattedBall`) */
  readonly distance: number
  /** 이번 공이 이벤트 존에 들었나 (+0x3f) */
  readonly isEventZoneHit: boolean
}

/** 초기화 0xb6814 — 기회 10, 단계 0, 보너스 G 0, 나머지 칸 0 */
export function createDerbyRun(): DerbyRun {
  return {
    remainingPitches: DERBY_PITCH_COUNT,
    totalDistance: 0,
    lastDistance: 0,
    stage: 0,
    combo: 0,
    wasPreviousHomeRun: false,
    maxCombo: 0,
    isBonusGame: false,
    bonusGamePoint: 0,
    pitchesThrown: 0,
    // 초기화 0xb6814 는 +0x84 를 안 건드리고, 경기 시작 상태 9 의 0x39868 이 0 으로 지운다
    comboDisplay: 0,
    isFinished: false,
  }
}

/**
 * 공 하나의 결과 처리 — 둘 다 `구조체+1 == 7` 일 때만 이 길로 간다:
 * - **0xae3e8** — 배트에 맞은 공(번트·파울 포함)이 인플레이(상태 0x17) 끝 `0x524c0 → 0x52a52` 에서 부른다.
 * - **0xae24c** — 맞지 않은 공(상태 0x12 갱신 `0x4e6d4 → 0x4e78c`)과 벤치 클리어링(상태 30 `0x401d4` · 0x1e 키 `0x40628`) 뒤.
 *
 * 두 함수의 모드 7 갈래는 같은 일을 한다(0xae24c 는 이번 공이 홈런일 수 없어 콤보를 올리지 않고 이벤트 존을 안 본다):
 * ```
 * ae42e  r6 = 남은 기회(+0x33) − 1 > 0
 * ae430  직전 공 홈런(+0x3a) 이면:
 * ae43a    이번 공 홈런(+0x3b) 이면  콤보(+0x39)++ · 최대 콤보(+0x3d) = max(·, 콤보) · 보너스 G(+0x40) += 콤보 × 5 · +0x84 = 콤보
 * ae470    !r6 || !이번 공 홈런 이면  콤보 = 0
 * ae49a  +0x3a = +0x3b ; +0x3b = 0
 * ae4b6  r6 이면  기회−− · 던진 공(+0x68)++ · 누적(+0x34) ≥ 표 0xd84dc[단계] 면 단계++ → 0xd / 아니면 0xf
 * ae4ee  아니고 최대 콤보 > 0 && 보너스 전(+0x3e == 0) 이면  +0x3a = 0 · 보너스 = 1 · 기회 = 최대 콤보 · 던진 공++ · 콤보 = 0 → 0xd
 * ae53a  그 밖이면 끝 → 0x1a
 * ae53c  이번 공 이벤트 존(+0x3f) 이면  보너스 G += 200 · +0x3f = 0     (0xae3e8 만)
 * ```
 * 번트를 따로 보는 갈래는 없다 — 번트 판정 0x51226(0x51108 안)·타구 시작 0x51408 · 이 두 함수 어디에도 모드·번트 갈림이 없어
 * 번트 타구도 0x17 끝에서 0xae3e8 로 와서 "홈런 아닌 공" 하나로 셈한다.
 *
 * ⚠️ **정정**: 앞서 "마지막 공은 홈런을 쳐도 콤보가 안 붙는다" 고 옮겼으나 틀렸다 — 콤보++ · 최대 콤보 · 보너스 G 는
 * `r6` 을 보기 **전에** 하고(ae444~ae46e), 마지막 공이면 그 뒤에 콤보만 0 으로 지운다(ae470). 그래서 마지막 공 홈런도
 * 최대 콤보(= 보너스 게임 수)와 보너스 G 를 올린다. 보너스 게임을 열 때는 "직전 공 홈런"(+0x3a)을 0 으로 지우고 던진 공도 센다.
 * ⚠️ **원본 버그 그대로**: 던진 공 수(+0x68)는 기회가 남았을 때와 보너스를 열 때만 올라 마지막 공은 안 센다.
 *    결과 화면이 "총 기회" 를 이 칸이 아니라 `10 + 보너스` 로 따로 세는 이유다(R14 1-3).
 */
export function applyDerbyPitch(run: DerbyRun, outcome: DerbyPitchOutcome): DerbyRun {
  if (run.isFinished) return run

  // 0. 비거리는 타구가 날아가는 동안 이미 더해진다 (0xa600c) — 홈런 순간 · 홈런 아닌 페어 공의 낙구 틱
  const totalDistance = run.totalDistance + outcome.distance
  const hasMoreChances = run.remainingPitches > 1

  // 1. 콤보 — 직전·이번 모두 홈런이면 올리고(ae444), 마지막 공이거나 이번이 홈런이 아니면 지운다(ae470)
  const isComboLinked = run.wasPreviousHomeRun && outcome.isHomeRun
  const raisedCombo = isComboLinked ? run.combo + 1 : run.combo
  const maxCombo = isComboLinked ? Math.max(run.maxCombo, raisedCombo) : run.maxCombo
  let bonusGamePoint = run.bonusGamePoint + (isComboLinked ? raisedCombo * COMBO_BONUS_UNIT : 0)
  const combo = run.wasPreviousHomeRun && !(hasMoreChances && outcome.isHomeRun) ? 0 : raisedCombo
  // 콤보 표시값 +0x84 는 올린 콤보로만 쓴다(ae46c) — 바로 뒤 ae470 이 콤보를 지워도 남는다
  const comboDisplay = isComboLinked ? raisedCombo : run.comboDisplay

  // 5. 이벤트 존은 같은 처리 끝에서 더한다 (0xae548)
  if (outcome.isEventZoneHit) bonusGamePoint += EVENT_ZONE_BONUS

  const common = {
    totalDistance,
    lastDistance: outcome.distance,
    maxCombo,
    bonusGamePoint,
    comboDisplay,
  }

  // 2. 아직 기회가 남았다 — 다음 공
  if (hasMoreChances) {
    return {
      ...run,
      ...common,
      combo,
      wasPreviousHomeRun: outcome.isHomeRun,
      remainingPitches: run.remainingPitches - 1,
      pitchesThrown: run.pitchesThrown + 1,
      stage: nextAceStageOf(run.stage, totalDistance),
    }
  }

  // 3. 보너스 게임 — 최대 콤보 수만큼, 한 번만. "직전 공 홈런" 은 지운다(ae502), 던진 공은 센다(ae51c)
  if (maxCombo > 0 && !run.isBonusGame) {
    return {
      ...run,
      ...common,
      combo: 0,
      wasPreviousHomeRun: false,
      isBonusGame: true,
      remainingPitches: maxCombo,
      pitchesThrown: run.pitchesThrown + 1,
    }
  }

  // 4. 끝
  return { ...run, ...common, combo, wasPreviousHomeRun: outcome.isHomeRun, isFinished: true }
}

/**
 * 공 하나를 처리한 뒤 원본이 예약하는 **다음 장면 상태** — 0xae3e8 · 0xae24c 의 모드 7 갈래가 돌려주는 값 (직접 떴다):
 * ```
 * 0xae3e8  ae4e4 `movs r6,#0xd`(단계++) · ae4ea `movs r6,#0xf` · ae510 `movs r6,#0xd`(보너스 열기) · ae53a `movs r6,#0x1a` → ae5ca 반환
 * 0xae24c  ae2e2 단계++ → ae330 `movs r4,#0xd` · ae372 `movs r4,#0xf` · 보너스 → ae330 0xd · ae334 `movs r4,#0x1a`
 * ```
 * - **0xf** 다음 공 준비 — 곧바로 다음 공이다.
 * - **0xd** 타석 준비 → 0xe — 단계가 올라 새 마투수가 서거나 보너스 게임을 열 때. 0xe 는 사람 OK 를 기다린다 (`0x532b0`).
 * - **0x1a** 결과 창.
 */
export function derbySceneStateAfter(before: DerbyRun, after: DerbyRun): 0xd | 0xf | 0x1a {
  if (after.isFinished) return 0x1a
  if (after.stage > before.stage || (after.isBonusGame && !before.isBonusGame)) return 0xd
  return 0xf
}

/**
 * HUD 콤보 표시가 도는 갱신 수 — `0x4585c` 끝(0x45a00~0x45a18)이 장면 +0x19ec 를 그릴 때마다 1 올리고
 * `> 20` 이 되면 표시(+0x1b60)와 +0x84 를 지운다. 상태 0xf 진입(0x3dc04)에서 +0x19ec = 0 이므로 **21 번** 그린다.
 */
export const COMBO_DISPLAY_FRAMES = 21

/**
 * 다음 공 준비(상태 0xf, `0x3d954`)에서 콤보를 띄울지 — `0x3dbf8` `(s8)[+0x84] > 0` 이면 +0x1b60 = 1 · +0x19ec = 0.
 * 판이 끝나(상태 0x1a) 상태 0xf 를 다시 안 지나면 마지막 공의 +0x84 는 남기만 하고 안 그려진다.
 */
export function shouldShowComboAtNextPitch(run: DerbyRun): boolean {
  return !run.isFinished && run.comboDisplay > 0
}

/** 콤보 표시가 끝났다 — `0x45a12` `strb 0, [+0x84]` */
export function endComboDisplay(run: DerbyRun): DerbyRun {
  return run.comboDisplay === 0 ? run : { ...run, comboDisplay: 0 }
}

/**
 * HUD 의 공 번호 (0x45a54) — `(보너스 중 ? 최대 콤보 : 10) − 남은 기회 + 1`.
 * 공 아이콘 10칸에 이 번호까지를 켠다.
 */
export function derbyBallNumberOf(run: DerbyRun): number {
  return derbyBallCountOf(run) - run.remainingPitches + 1
}

/** 이번 묶음의 공 개수 — 보너스 게임이면 최대 콤보, 아니면 10 */
export function derbyBallCountOf(run: DerbyRun): number {
  return run.isBonusGame ? run.maxCombo : DERBY_PITCH_COUNT
}

/** 결과 화면(0x45c18)이 보여 주는 값들 */
export interface DerbyResult {
  /** 총 기회 = 10 + (보너스 게임을 했으면 최대 콤보) — R14 1-2 `45c8e` */
  readonly pitchCount: number
  readonly maxCombo: number
  /** 현재 비거리(이번 판 누적) */
  readonly totalDistance: number
  /** 최고 비거리(저장 +0x5c) — 갱신된 뒤의 값 */
  readonly bestDistance: number
  readonly isNewRecord: boolean
  /** 획득 GP */
  readonly gainedGamePoint: number
}

/**
 * 결과 정산 (0x4f574 · 0x4f644~).
 * `누적 > 저장 +0x5c` 면 최고 기록을 갈아 끼우고 신기록 플래그(+0x3c)를 세운다.
 */
export function derbyResultOf(run: DerbyRun, bestDistance: number): DerbyResult {
  const isNewRecord = run.totalDistance > bestDistance
  return {
    pitchCount: DERBY_PITCH_COUNT + (run.isBonusGame ? run.maxCombo : 0),
    maxCombo: run.maxCombo,
    totalDistance: run.totalDistance,
    // 저장 칸이 u16 이라 그 눈금을 넘지 않게 자른다 (저장 +0x5c)
    bestDistance: isNewRecord ? Math.min(BEST_DISTANCE_LIMIT, run.totalDistance) : bestDistance,
    isNewRecord,
    gainedGamePoint: derbyGamePointOf(run.totalDistance, run.stage, run.bonusGamePoint),
  }
}
