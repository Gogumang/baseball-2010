import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import {
  basePosition,
  isSamePoint,
  progressPercent,
  SLIDING_PROGRESS_RANGE,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import { NONE, type FielderState, type RunnerState } from '@/entities/fielding/model/fieldingState'
import {
  FIELDER_ACTION,
  RUNNER_ACTION,
  type DefenseFielder,
  type DefenseFlash,
  type DefenseRunner,
  type DefenseViewState,
} from '@/pages/defense/lib/defenseView'

/**
 * 한 틱치 화면 스냅샷 만들기.
 *
 * 모양(`DefenseViewState`)은 `pages/defense/lib/defenseView.ts` 가 이미 정해 두었고 그 파일은
 * 건드리지 않기로 했으므로 **타입만 가져다 쓴다**. 화면 결선(라우팅)은 여기 몫이 아니다.
 *
 * 동작 번호는 R3 2-1(야수 vt44 = 0xa1234) · R3 8-1(주자 vt40 = 0xa0070) 의 표를 따른다.
 * 어느 틱에 어느 칸을 쓰는지는 원본 동작 큐를 안 읽었으므로 **움직이는 방향에서 뽑아 쓴다(근사)**.
 */

/** 진행기가 내주는 한 틱 — 화면이 쓰는 스냅샷에 틱 번호만 붙였다 */
export interface DefensePlayView extends DefenseViewState {
  readonly tick: number
}

/** 같은 동작이 언제부터 이어지고 있는지 기억하는 칸 (`actionTick` 을 세려면 필요하다) */
export type ActionMemory = Map<string, { action: number; since: number }>

export interface ViewStateInput {
  readonly tick: number
  readonly ball: WorldPoint
  readonly ballIsFlying: boolean
  readonly fielders: readonly FielderState[]
  readonly runners: readonly RunnerState[]
  /** 이번 틱에 포구 동작 중이면 그 종류, 아니면 null */
  readonly catchKind: number | null
  readonly chaserSlot: number
  /** 이번 틱에 송구 동작 중인 야수 칸. 없으면 −1 */
  readonly throwingSlot: number
  /** 송구가 가고 있는 루. 없으면 −1 */
  readonly throwBase: number
  readonly previousActions: ActionMemory

  // ── 아래 셋은 **그림에만 쓰인다**. 안 주면 지금까지와 똑같이 논다. ──
  // (번쩍임은 따로 받을 것이 없다 — 켜짐 칸이 포구 종류라 `catchKind` 로 이미 알 수 있다. `flashOf` 참고)

  /** 수비 칸별 마선수 번호 0~4 (없으면 null·undefined). 이름 표 0xd3f10, 20바이트 간격 — C-16 */
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 팀 번호 0~14 — 야수 그림 팔레트 (C-1) */
  readonly defenseTeamIndex?: number | null
  /** 공격 팀 번호 0~14 — 주자 그림 팔레트 */
  readonly offenseTeamIndex?: number | null
}

export function viewStateOf(input: ViewStateInput): DefensePlayView {
  const fielders: DefenseFielder[] = input.fielders.map((fielder) => {
    const action = fielderActionOf(fielder, input)
    return {
      slot: fielder.slot,
      x: fielder.position.x,
      z: fielder.position.z,
      action,
      actionTick: tickSince(input.previousActions, `f${fielder.slot}`, action, input.tick),
      aceIndex: aceIndexOf(input.aceIndexes, fielder.slot),
      teamIndex: input.defenseTeamIndex ?? null,
    }
  })

  const runners: DefenseRunner[] = input.runners.map((runner) => {
    const action = runnerActionOf(runner, input)
    return {
      index: runner.index,
      x: runner.position.x,
      z: runner.position.z,
      action,
      actionTick: tickSince(input.previousActions, `r${runner.index}`, action, input.tick),
      base: ((runner.targetBase % 4) + 4) % 4,
      isAdvancing: runner.targetBase > runner.startBase,
      // 아웃된 주자도 걸어 나가는 동안은 그린다 (R3 3-4)
      isVisible: true,
      teamIndex: input.offenseTeamIndex ?? null,
    }
  })

  return {
    tick: input.tick,
    ball: { x: input.ball.x, z: input.ball.z, height: input.ball.y, isFlying: input.ballIsFlying },
    fielders,
    runners,
    flash: flashOf(input, fielders),
    cameraTarget: null,
  }
}

/** 수비 칸 → 마선수 번호. 표에 없거나 0~4 밖이면 보통 수비수 그림이다 */
function aceIndexOf(
  aces: readonly (number | null | undefined)[] | undefined,
  slot: number,
): number | null {
  const ace = aces?.[slot]
  if (ace == null || !Number.isInteger(ace) || ace < 0 || ace > 4) return null
  return ace
}

/** 번쩍임 켜짐 칸을 기억에 적는 번호 — 0 은 "꺼짐" 이다 */
const FLASH_NONE = 0
/** 플레이+0x1f7 = 필살 점프 캐치 → 번쩍임 B */
const FLASH_JUMP = 1
/** 플레이+0x1f8 = 필살 슬라이딩 캐치 → 번쩍임 C */
const FLASH_SLIDE = 2

/**
 * 공 자리 번쩍임 (`deadly_effect`, R2 2절) — **짝짓기 확정**.
 *
 * 앞서 이 자리에는 "켜짐 칸을 세우는 곳이 안 읽혀 근사" 라고 적어 두었는데, **이미 읽혀 있었다**.
 * 플레이 틱 `0xb401c` 의 포구 동작 분기표 **0xd87f4** 가 동작 시작 틱(플레이+0x176)에 종류별로
 * 동작을 걸면서 켜짐 칸을 함께 세운다 (P2 2b · 3절, 확정):
 * ```
 * 0 → f.vt94 · 1 → f.vt5c · 2 → f.vt60 · 3 → f.vt90 + 플레이+0x1f7 = 1 · 4 → f.vt98 + 플레이+0x1f8 = 1
 * ```
 * R2 2절이 "공 +0x1f7/+0x1f8" 이라 적은 그 객체는 **플레이 객체다** — 같은 절의 켜는 곳 0x400bc 가
 * 보는 `+0x160`(송구 목표)·`+0x12c`(공 쥠)이 플레이 객체 칸이고(I-controls 2d), 세 번쩍임이 끝에
 * 함께 지우는 `+0x1f4` 도 플레이 객체의 레이저 송구 칸이다.
 *
 * 그래서 짝은 이렇다 — 레이저와는 **아무 상관이 없다**:
 *   B(`kind 'b'`, 공 위 −50, 0x441c4 ← +0x1f7) = **필살 점프 캐치**(포구 종류 3)
 *   C(`kind 'c'`, 방향별 ±10, 0x44398 ← +0x1f8) = **필살 슬라이딩 캐치**(포구 종류 4)
 * C 의 방향 값(+0xa8 = 0xf 아래 · 0x10 위 · 0x11 왼 · 0x12 오른)이 슬라이딩 캐치 동작 번호
 * 0xf~0x12 와 그대로 같은 것도 이것으로 설명된다.
 *
 * 원본대로 B 가 먼저다 — C 는 +0x1f7 == 0 일 때만 돈다(0x525c8). 굴림이 점프에 실패했을 때만
 * 슬라이딩을 굴리므로(I-controls 2c) 한 플레이에서 둘이 같이 서지는 않지만 순서는 원본대로 둔다.
 *
 * ⚠️ **남은 근사는 길이뿐이다.** 원본은 켜짐 칸을 동작 시작 틱에 세우고 deadly_effect 가 애니를
 * 다 돌린 뒤에야 지운다(B 는 대기 5틱 뒤부터, C 는 2틱 뒤부터 그린다). 여기서는 화면 모양에
 * 그 단계 칸이 없어 **포구 동작이 걸려 있는 틱 동안**(동작 시작 틱 ~ 포구 틱) 그린다.
 * 칸(`step`)은 deadly_effect 애니 0 [0,1,2,3] 지연 0 을 틱마다 한 칸씩 넘기고 마지막에서 멈춘다.
 *
 * ⚠️ 레이저 송구 반짝임 경기+0x19ad 는 deadly_effect 가 **아니다** — 0x43278 이 야수 위에
 * 빨강(255,0,0)·크기 12 로 찍는 **다른 표시**다(R2 2절). 화면 모양(`DefenseViewState`)에 그 칸이
 * 없어 아직 못 붙였다 — `pages/defense` 쪽 일이다.
 */
function flashOf(input: ViewStateInput, fielders: readonly DefenseFielder[]): DefenseFlash | null {
  const chaser = fielders.find((fielder) => fielder.slot === input.chaserSlot)
  const action = chaser?.action ?? FIELDER_ACTION.stand
  // 포구 종류 3·4 만 켜짐 칸을 세운다. 그 두 종류는 필살수비 창이 열려야 골라지므로
  // (예측기 0xb12d0 의 높이·거리 창) 여기서 창을 따로 볼 것이 없다 — 동작 번호가 곧 답이다.
  const kind =
    action === FIELDER_ACTION.jumpCatch
      ? FLASH_JUMP
      : action >= FIELDER_ACTION.slideCatchDown && action <= FIELDER_ACTION.slideCatchRight
        ? FLASH_SLIDE
        : FLASH_NONE
  // 꺼져 있어도 기억은 갱신해 둬야 다음 번쩍임이 0 칸부터 다시 돈다
  const since = tickSince(input.previousActions, 'flash', kind, input.tick)
  if (kind === FLASH_NONE) return null

  const step = Math.min(since, DEADLY_EFFECT_STEPS - 1)
  // 점프 캐치(0xe)는 방향 칸이 없다 — 공 자리에서 위로 50 만 올려 그린다
  if (kind === FLASH_JUMP) return { kind: 'b', step }
  return { kind: 'c', step, direction: action }
}

/** deadly_effect 애니 0 의 칸 수 — 프레임 [0,1,2,3] (R2 2절) */
const DEADLY_EFFECT_STEPS = 4

/** 야수 동작 — 포구 > 송구 > 달리기 > 제자리 */
function fielderActionOf(fielder: FielderState, input: ViewStateInput): number {
  if (fielder.slot === input.chaserSlot && input.catchKind !== null) {
    return catchActionOf(input.catchKind, fielder.position, input.ball)
  }
  if (fielder.slot === input.throwingSlot) return FIELDER_ACTION.throw
  return runActionOf(fielder.position, fielder.target, FIELDER_ACTION.stand, [
    FIELDER_ACTION.runDown,
    FIELDER_ACTION.runUp,
    FIELDER_ACTION.runLeft,
    FIELDER_ACTION.runRight,
  ])
}

/** 포구 종류 → 동작 번호 (R3 2-1 표) */
function catchActionOf(kind: number, fielder: WorldPoint, ball: WorldPoint): number {
  switch (kind) {
    case CATCH_KIND.CHEST:
      return FIELDER_ACTION.catchChest
    case CATCH_KIND.JUMP:
      return FIELDER_ACTION.jumpCatch
    case CATCH_KIND.SLIDE:
      return FIELDER_ACTION.slideCatchDown + directionIndexOf(fielder, ball)
    default:
      return FIELDER_ACTION.catchLow
  }
}

/** 주자 동작 — 루에 서 있으면 제자리, 막판에 송구가 오면 슬라이딩, 아니면 달리기 */
function runnerActionOf(runner: RunnerState, input: ViewStateInput): number {
  const target = basePosition(runner.targetBase)
  if (isSamePoint(runner.position, target)) return RUNNER_ACTION.stand
  const progress = progressPercent(runner.legStart, runner.position, target)
  const playedOn =
    input.throwBase !== NONE && ((input.throwBase % 4) + 4) % 4 === ((runner.targetBase % 4) + 4) % 4
  if (
    playedOn &&
    progress >= SLIDING_PROGRESS_RANGE.minimum &&
    progress <= SLIDING_PROGRESS_RANGE.maximum
  ) {
    return RUNNER_ACTION.slide
  }
  return RUNNER_ACTION.run
}

/** 0 아래 · 1 위 · 2 왼 · 3 오른 — 방향별 동작표의 칸 번호 */
function directionIndexOf(from: WorldPoint, to: WorldPoint): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 3 : 2
  return dz > 0 ? 0 : 1
}

function runActionOf(
  position: WorldPoint,
  target: WorldPoint,
  standAction: number,
  runActions: readonly [number, number, number, number],
): number {
  if (position.x === target.x && position.z === target.z) return standAction
  return runActions[directionIndexOf(position, target)]
}

function tickSince(memory: ActionMemory, key: string, action: number, tick: number): number {
  const previous = memory.get(key)
  if (previous === undefined || previous.action !== action) {
    memory.set(key, { action, since: tick })
    return 0
  }
  return tick - previous.since
}
