import {
  FIELDER_COUNT,
  FIELDER_SPEED,
  FIELDER_START_POSITIONS,
  abilityGradeOf,
  basePosition,
  horizontalDistance,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'

/**
 * 수비 시뮬레이션이 읽는 상태 묶음.
 *
 * 원본은 경기 장면 +0x200 의 "플레이" 객체(vtable 0xd8618) 하나에 야수 9명(+0x18)·주자관리(+0x20)·
 * 공(+0x24)·경기 상태(+0x28)를 달아 두고 매 틱 돌린다. 여기서는 그 칸들을 읽기 전용 구조체로 옮긴다.
 * 칸 이름 옆의 `+0x..` 는 원본 오프셋이다 (P2 0·2b·4절 · S7 5절 · S8 0절).
 */

/** AI 상태 분기표 0xd8808 (16칸) 의 번호 — P2 1c · S8 1·2·3절 */
export const AI_STATE = {
  /** 대기 — 시작 위치 0xd86ec[칸] 으로 돌아간다 */
  IDLE: 0,
  /** 공 쫓기 */
  CHASE: 1,
  /** 루 커버 (상태 − 2 = 루 번호) */
  COVER_HOME: 2,
  COVER_FIRST: 3,
  COVER_SECOND: 4,
  COVER_THIRD: 5,
  /** 공을 직접 들고 루로 뛰기 (0xb2c90 이 커버가 없을 때 세운다) */
  CARRY: 6,
  /** 협살 (0xb48b6) */
  RUNDOWN: 8,
  /** 송구 받기 대기 — 도착 틱이 송구 도착 틱 이하가 될 때까지 송구를 미루는 게이트 (0xb4838) */
  RECEIVE: 9,
  /** 동작 중 — 분기표가 아무것도 안 하는 칸 (6·7·0xa·0xd 가 0xb4c60 으로 간다) */
  BUSY: 0xa,
  /** 아무도 먼저 못 잡을 때 줍는 지점으로 (0xb4b5c) */
  PICK_UP: 0xb,
  /** 외야 백업 (0xb4b78) */
  BACKUP: 0xc,
  /** 비필살 다이빙 (0xb46e2) */
  DIVE: 0xd,
  /** 견제 송구 — 플레이.vt58(state[0x27]) (0xb47da) */
  PICKOFF: 0xe,
  /** 시작 위치로 돌아가기 (0xb4c2a) */
  RETURN: 0xf,
} as const

/** 없음을 뜻하는 −1 (루·야수 번호 칸 모두 이 값을 쓴다) */
export const NONE = -1

export interface FielderState {
  /** 수비 칸 0~8 (+0x88). 0 투수 · 1 포수 · 2 1루수 · 3 2루수 · 4 3루수 · 5 유격수 · 6~8 외야 */
  readonly slot: number
  /** 현재 위치 (+0x20) */
  readonly position: WorldPoint
  /** 목표점 (+0x2c) */
  readonly target: WorldPoint
  /** 달리기 속도 (+0x3c). 원본은 9명 모두 220 이다 */
  readonly speed: number
  /** 목표 루 (vt68 = 0xa0b4c). 없으면 −1 */
  readonly targetBase: number
  /** 공을 쥐고 있는가 (+0xe0) */
  readonly holdingBall: boolean
  /** AI 상태 (+0x84) */
  readonly aiState: number
  /** 진행 중인 동작의 남은 틱 (+0xc8) */
  readonly actionRemainingTicks: number
  /** 도착 틱에 더해지는 여유 (+0xcc). vtc0 = 남은 이동 틱 + 이 값 */
  readonly arrivalSlackTicks: number
  /** 동작 잠금 카운트 (+0xb4). 0 보다 크면 다른 동작을 못 받는다 */
  readonly actionLockTicks: number
  /** 경기용 수비 능력치 등급 0~7 (0xbbe98) */
  readonly defenseGrade: number
  /** 송구 공 속도 (0xa0fc4: cfg+0x1a 940 + cfg+0x2a 8 × (등급+1) + 팀 보너스) */
  readonly throwSpeed: number
}

export interface RunnerState {
  /** 주자 번호. 0 = 타자주자 */
  readonly index: number
  /** 현재 위치 (+0x20) */
  readonly position: WorldPoint
  /** 이번 구간의 출발점 (+0x14). 진행률·전체 틱(0xbf01c)의 분모가 된다 */
  readonly legStart: WorldPoint
  /** 이번 구간 출발 루 (+0x7c) */
  readonly startBase: number
  /** 반드시 밟아야 할 루 (+0x88). 없으면 −1 */
  readonly requiredBase: number
  /** 목표 루 (+0x8c) */
  readonly targetBase: number
  /** 투구 때 있던 루 (+0x90) */
  readonly pitchBase: number
  /** 판정끝 표시 (+0x94) — 요구 루를 아직 안 밟았다 */
  readonly settled: boolean
  /** 득점 표시 (+0x95) */
  readonly scored: boolean
  /** 아웃 (+0x96) */
  readonly isOut: boolean
  /** 이번 타석의 타자주자인가 (+0x98) */
  readonly isBatterRunner: boolean
  /** 슬라이딩 중 (+0xb8) */
  readonly sliding: boolean
  /** 이동 속도 (+0x3c) */
  readonly speed: number
}

/** 수비 플레이 객체(경기 장면 +0x200) 의 읽기 전용 그림자 */
export interface PlayView {
  /** 플레이 종류 (+0x118). 1 타구 · 2 볼넷 밀어내기 · 4 견제 · 5 주자만 · 8 홈런더비 · 9 폭투/도루 송구 */
  readonly kind: number
  /** 루 0~3 을 커버하는 야수 번호 (+0xf0, 4칸). 없으면 −1 */
  readonly coverOfBase: readonly number[]
  /** 공을 쥔(쫓는) 야수 **번호** (+0x130). 포인터가 아니다 — S8 정정 1 */
  readonly ballHolderSlot: number
  /** 포구할 야수 번호 (+0x170) */
  readonly catchFielderSlot: number
  /** 포구 종류 (+0x16c) */
  readonly catchKind: number
  /** 포구 틱 (+0x174) */
  readonly catchTick: number
  /** 포구 동작 시작 틱 (+0x176) */
  readonly actionStartTick: number
  /** 가장 이른 포구 가능 틱 (+0x11c) */
  readonly earliestCatchTick: number
  /** 이번 플레이에서 공이 한 번이라도 쥐어졌는가 (+0x112) */
  readonly everHeld: boolean
  /** 지금 누군가 쥐고 있는가 (+0x12c) */
  readonly held: boolean
  /** 플레이가 끝났는가 (+0x111) */
  readonly finished: boolean
  /**
   * 자동 주루의 **또 하나의 무조건 진루 갈래** (+0x129).
   *
   * ⚠️ 예전 주석의 `+0x12a` 는 오프셋 오독이었다 — 0xaf918 이 직접 뜨는 자리는
   * `af964: subs r2,#7`(0x118 − 7 = **0x111**) · `af970: adds r2,#0x18`(0x111 + 0x18 = **0x129**) 다.
   * `R3-field-view.md` 도 같은 두 칸을 `+0x111`·`+0x129` 로 적고 있다.
   * 이름이 "막는 칸" 이었던 것도 거꾸로였다 — 이 칸이 서면 자동 진루가 **꺼지는 것이 아니라
   * 틱 비교 없이 무조건 한 루 간다** (`autoAdvance.ts` 참고).
   */
  readonly suppressed: boolean
  /** 송구를 해야 한다는 표시 (+0x128) */
  readonly wantsThrow: boolean
  /** 사람이 고른 송구 목표 루 (+0x160). −1 이면 자동 규칙(0xb1c90) */
  readonly manualThrowBase: number
}

/** 수비 판단 함수들이 함께 받는 한 틱 분량의 문맥 */
export interface DefenseContext {
  readonly play: PlayView
  readonly fielders: readonly FielderState[]
  readonly runners: readonly RunnerState[]
  /** 공 객체 +0x68 = 재생 중인 현재 틱 (제어기 +0x14 의 +0x68 으로도 읽힌다 — S7 정정 3) */
  readonly currentTick: number
  /** 타구 궤적의 낙구 틱 (공 +0xaa0). 높이가 처음 0 이하가 된 점 번호 */
  readonly landingTick: number
}

/** 송구 공 속도 (0xa0fc4). g = 등급 + 1, 선수가 없으면 g = 2 */
export function throwSpeedOf(defenseGrade: number, teamBonus = 0): number {
  return 940 + 8 * (defenseGrade + 1) + teamBonus
}

/** 악송구 보정 +0xe4 = cfg+0x2c(2) − 등급 + 8 = 10 − 등급 (0xb0fb4) */
export function throwErrorBiasOf(defenseGrade: number): number {
  return 10 - defenseGrade
}

/**
 * 플레이 시작 때의 야수 9명 (0xb0fb4 + 0xb0f88).
 * 능력치는 송구 속도·악송구·펌블·필살수비 확률에만 쓰이고 **이동 속도에는 전혀 안 들어간다** (P2 1c).
 */
export function createFielders(defenseAbilities: readonly number[], teamBonus = 0): readonly FielderState[] {
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    const grade = abilityGradeOf(defenseAbilities[slot] ?? 0)
    const start = FIELDER_START_POSITIONS[slot]
    return {
      slot,
      position: start,
      target: start,
      speed: FIELDER_SPEED,
      targetBase: NONE,
      holdingBall: false,
      aiState: AI_STATE.IDLE,
      actionRemainingTicks: 0,
      arrivalSlackTicks: 0,
      actionLockTicks: 0,
      defenseGrade: grade,
      throwSpeed: throwSpeedOf(grade, teamBonus),
    }
  })
}

/**
 * 플레이 초기화 0xb67d0 — 타석/플레이가 시작될 때의 빈 상태.
 * 커버·야수 번호 칸은 −1, 담장/폴 틱과 득점 보류 칸도 여기서 지워진다.
 */
export function initialPlayView(kind = 1): PlayView {
  return {
    kind,
    coverOfBase: [NONE, NONE, NONE, NONE],
    ballHolderSlot: 0,
    catchFielderSlot: 0,
    catchKind: 0,
    catchTick: 0,
    actionStartTick: 0,
    earliestCatchTick: 0xffff,
    everHeld: false,
    held: false,
    finished: false,
    suppressed: false,
    wantsThrow: false,
    manualThrowBase: NONE,
  }
}

/**
 * 주자 하나. 타자주자는 0xa93ac 이 만들고, 루에 있던 주자는 0xa9374 가 한 칸씩 민다.
 * 루 위에 있는 주자는 **루 좌표에 비트까지 정확히** 선다 (리드 폭이 없다 — S8 6절).
 */
export function createRunner(
  index: number,
  fromBase: number,
  speed: number,
  overrides: Partial<RunnerState> = {},
): RunnerState {
  const start = basePosition(fromBase)
  return {
    index,
    position: start,
    legStart: start,
    startBase: fromBase,
    requiredBase: NONE,
    targetBase: fromBase,
    pitchBase: fromBase,
    settled: false,
    scored: false,
    isOut: false,
    isBatterRunner: index === 0,
    sliding: false,
    speed,
    ...overrides,
  }
}

/** 목표점까지 남은 틱 — 0xbefec = self.vt1c(self+0x2c) */
export function remainingTicksOf(mover: { position: WorldPoint; target: WorldPoint; speed: number }): number {
  return ticksToReach(mover.position, mover.target, mover.speed)
}

/** 이번 구간 전체 틱 — 0xbf01c = 거리(+0x14, +0x2c) ÷ 속도 */
export function legTotalTicksOf(runner: RunnerState): number {
  return ticksToReach(runner.legStart, basePosition(runner.targetBase), runner.speed)
}

/** 주자가 목표 루까지 남은 틱 — 0xbefec(주자) */
export function runnerRemainingTicks(runner: RunnerState): number {
  return ticksToReach(runner.position, basePosition(runner.targetBase), runner.speed)
}

/**
 * 주자 vt0xa0 = 0xa06ec = **한 루 더 갈 때의 총 틱**
 * = 거리(루[(목표루+1)%4], 루[목표루]) ÷ 속도 + 지금 목표까지 남은 틱 (S7 5절, 확정).
 */
export function runnerOneMoreBaseTicks(runner: RunnerState): number {
  const next = basePosition(runner.targetBase + 1)
  const current = basePosition(runner.targetBase)
  const legs = runner.speed === 0 ? 0 : Math.trunc(horizontalDistance(next, current) / runner.speed)
  return legs + runnerRemainingTicks(runner)
}

/** 주자가 목표점에 도착해 멈췄는가 — vt18 = 0xbf3a0 = (위치 == 목표점) (S8 정정 5) */
export function isRunnerStopped(runner: RunnerState): boolean {
  const target = basePosition(runner.targetBase)
  return runner.position.x === target.x && runner.position.z === target.z
}

/** 야수 vtc0 = 0xa1c3c = 목표점까지 남은 틱 + +0xcc */
export function fielderArrivalTicks(fielder: FielderState): number {
  return remainingTicksOf(fielder) + fielder.arrivalSlackTicks
}
