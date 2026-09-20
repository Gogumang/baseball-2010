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
  /** 경기 상태 0x1a(결과 화면)로 넘어갔는가 */
  readonly isFinished: boolean
}

/** 공 하나의 결과 — 원본이 0xae24c(아웃·헛스윙)·0xae3e8(타구)로 들어갈 때 이미 정해져 있는 값들 */
export interface DerbyPitchOutcome {
  /** 이번 공이 홈런이었나 (+0x3b) */
  readonly isHomeRun: boolean
  /** 이번 타구의 비거리 (0xa600c). 홈런이 아니면 0 이다 */
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
    isFinished: false,
  }
}

/**
 * 공 하나의 결과 처리 — 0xae24c(아웃·헛스윙 쪽)·0xae3e8(타구 쪽). 둘 다 `구조체+1 == 7` 일 때만
 * 이 길로 간다. 차례는 원본 그대로다:
 *
 * 0. (타구 처리 0xa600c) 홈런이면 누적 비거리에 더한다
 * 1. 직전 공과 이번 공이 모두 홈런이면 콤보++ · 최대 콤보 갱신 · **보너스 G += 콤보 × 5**,
 *    아니거나 기회가 다했으면 콤보 0. 그다음 "직전 공 = 이번 공"
 * 2. 남은 기회가 1 보다 많으면 기회−−, 던진 공++, 그리고 누적 ≥ 단계표[단계] 면 단계++
 * 3. 기회가 다했고 최대 콤보 > 0 이고 아직 보너스 전이면 보너스 게임 시작 (기회 = 최대 콤보)
 * 4. 그 밖이면 끝(상태 0x1a)
 * 5. 이번 공이 이벤트 존에 들었으면 보너스 G += 200
 *
 * ⚠️ **원본 버그 그대로** ①: 콤보는 `남은 기회 > 1` 일 때만 올라간다 — 곧 **마지막 공은
 * 홈런을 쳐도 콤보가 붙지 않고 0 으로 지워진다**. 최대 콤보(= 보너스 게임 수)도 그만큼 손해다.
 * ⚠️ **원본 버그 그대로** ②: 던진 공 수(+0x68)도 같은 `> 1` 안에서만 올라가 10 구를 다 치면
 * 9 에서 멈춘다. 결과 화면이 "총 기회" 를 이 칸이 아니라 `10 + 보너스` 로 따로 세는 이유다(R14 1-3).
 */
export function applyDerbyPitch(run: DerbyRun, outcome: DerbyPitchOutcome): DerbyRun {
  if (run.isFinished) return run

  // 0. 비거리는 타구가 날아가는 동안 이미 더해진다 (0xa600c) — 홈런일 때만 0 보다 크다
  const totalDistance = run.totalDistance + outcome.distance

  // 1. 콤보
  const isComboLinked = run.wasPreviousHomeRun && outcome.isHomeRun && run.remainingPitches > 1
  const combo = isComboLinked ? run.combo + 1 : 0
  const maxCombo = isComboLinked ? Math.max(run.maxCombo, combo) : run.maxCombo
  let bonusGamePoint = run.bonusGamePoint + (isComboLinked ? combo * COMBO_BONUS_UNIT : 0)

  // 5. 이벤트 존은 같은 처리 끝에서 더한다 (0xae548)
  if (outcome.isEventZoneHit) bonusGamePoint += EVENT_ZONE_BONUS

  const common = {
    totalDistance,
    lastDistance: outcome.distance,
    maxCombo,
    wasPreviousHomeRun: outcome.isHomeRun,
    bonusGamePoint,
  }

  // 2. 아직 기회가 남았다 — 다음 공
  if (run.remainingPitches > 1) {
    return {
      ...run,
      ...common,
      combo,
      remainingPitches: run.remainingPitches - 1,
      pitchesThrown: run.pitchesThrown + 1,
      stage: nextAceStageOf(run.stage, totalDistance),
    }
  }

  // 3. 보너스 게임 — 최대 콤보 수만큼, 한 번만
  if (maxCombo > 0 && !run.isBonusGame) {
    return {
      ...run,
      ...common,
      combo: 0,
      isBonusGame: true,
      remainingPitches: maxCombo,
    }
  }

  // 4. 끝
  return { ...run, ...common, combo, isFinished: true }
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
