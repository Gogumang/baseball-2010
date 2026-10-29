import {
  FIELDER_COUNT,
  FIELDER_SPEED,
  FIELDER_START_POSITIONS,
  abilityGradeOf,
  basePosition,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import { throwSpeedOf, UNSEARCHED_FIELDER_SLOT } from '@/entities/fielding/model/fieldingState/throwStats'
import { AI_STATE, NONE, type FielderState, type PlayView, type RunnerState } from '@/entities/fielding/model/fieldingState/types'

/** 선수 없는 칸의 g (b106a `movs r0,#2`) — 송구 속도 940 + 8 × 2 */
const NO_PLAYER_THROW_G = 2

/**
 * 플레이 시작 때의 야수 9명 (판 시작 vt20 0xb0fb4 — 0xb0f88 은 부르는 BL · 리터럴이 없는 죽은 함수다, r190 · 감사 r220).
 * 능력치는 송구 속도·악송구·펌블·필살수비 확률에만 쓰이고 **이동 속도에는 전혀 안 들어간다** (P2 1c).
 * `teamBonus` 는 `defenseTeamBonusOf` — 아홉 칸(칸 0 포함) 모두의 송구 속도에 더한다(등급 · 악송구 보정은 그대로).
 */
export function createFielders(defenseAbilities: readonly (number | null)[], teamBonus = 0): readonly FielderState[] {
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    // 칸 0(투수)은 b1032 가 선수를 찾지 않아 g = 2 고정 — 등급으로는 g − 1 = 1 (입력 능력치를 안 읽는다)
    const grade = slot === UNSEARCHED_FIELDER_SLOT ? NO_PLAYER_THROW_G - 1 : abilityGradeOf(defenseAbilities[slot] ?? 0)
    const start = FIELDER_START_POSITIONS[slot]
    // 0xa0fc4(야수, v): +0xdc = +0xd4 = v · +0xd8 = v × 130 / 100
    const throwSpeed = throwSpeedOf(grade, teamBonus)
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
      // 판 시작 0xb0fb4 의 b112e 가 야수마다 vt10 — 동작 0 · 워드 0
      action: 0,
      actionFrame: 0,
      pose: 0,
      defenseGrade: grade,
      throwSpeed,
      baseThrowSpeed: throwSpeed,
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
 * 루 위에 있는 주자는 **루 좌표에 비트까지 정확히** 선다 (리드 폭이라는 값은 없다 — S8 6절).
 * 다만 수비 판이 열릴 때 `0x3d7b8` 이 주자 틱을 몇 번 몰아서 돌린다 — `runnerLead` (지금은 도루 판만 붙였다).
 */
export function createRunner(index: number, fromBase: number, speed: number, overrides: Partial<RunnerState> = {}): RunnerState {
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

/** 타석 자리의 홈 x 비킴 — 0xa0884 a089e `movs r0,#0xaf ; lsls #2`(= 700) · a08a6 리터럴 0xfffffd44(= −700) */
export const BATTER_BOX_OFFSET_X = 700
/** 타석 자리의 홈 z 비킴 — 0xa0884 a08ae `subs r3,#0x64`(z − 100, 내야 쪽) */
export const BATTER_BOX_OFFSET_Z = 100

/**
 * **타자주자 vt94 = 0xa0884(주자, 손) — 타석 자리에 세우기** (직접 뜬 것, r324 Q-07).
 * ```
 * a0888  p = 0xd77d8[0]                          ; 홈 (20000, 0, 29445)
 * a089a  손 ≠ 0 → p.x += 700 ; 아니면 p.x −= 700 ; p.z −= 100
 * a08c6  0xbef58(주자, p) = 0xbee60(위치 +0x20 · +0x14 ← p) + vt14(p)(이동 목표점 +0x2c ← p)
 * ```
 * 부르는 곳은 타자주자 만들기 `0xa93ac` 의 a9446 하나 — vt10 · vt88(0) · vt48(1) 다음에 `0xb63c0(타자)`(손, 1 = 좌타)를 넘긴다.
 * 곧 **타자주자는 홈이 아니라 타석 자리(좌타 1루 쪽 x+700 · 우타 3루 쪽 x−700, z−100)에서 뛰기 시작한다.**
 * 이동 목표점은 상태 0x17 진입 리드 고리 `0x3d7b8` 의 vt48(1)이 1루 좌표로 되돌린다(b == 0 이라 0xbee60 순간이동 없음,
 * 틱 0xcffb0[0] = 0). 다음 판 세우기 `0xa9e44` 는 목록 번호 1 부터 돌아 타자주자를 안 건드린다(a9e62 `[sp+8] = 1`).
 */
export function batterBoxPosition(hand: number): WorldPoint {
  const home = basePosition(0)
  return {
    x: home.x + (hand !== 0 ? BATTER_BOX_OFFSET_X : -BATTER_BOX_OFFSET_X),
    y: home.y,
    z: home.z - BATTER_BOX_OFFSET_Z,
  }
}
