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

  // ── 아래 넷은 **아직 부르는 쪽이 안 넘긴다**. 안 주면 지금까지와 똑같이 논다. ──

  /**
   * 경기+0x19ad — 레이저 송구 반짝임이 켜져 있는가 (진행기 `laserShining`).
   * 켜져 있는 동안 공 자리에 번쩍임 B(0x441c4, 공 +0x1f7)를 그린다.
   */
  readonly laserShining?: boolean
  /**
   * 필살수비 창 — 0x66b30(점프) / 0x66be4(슬라이딩). 열린 창으로 실제 필살 포구가 나가는
   * 틱에 번쩍임 C(0x44398, 공 +0x1f8)를 그린다.
   */
  readonly specialDefense?: { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean } | null
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

/** 번쩍임 켜짐 칸 세 가지를 기억에 적는 번호 — 0 은 "꺼짐" 이다 */
const FLASH_NONE = 0
const FLASH_LASER = 1
const FLASH_SPECIAL = 2

/**
 * 공 자리 번쩍임 (`deadly_effect`, R2 2절).
 *
 * 원본은 켜짐 칸이 **공 +0x1f7(B) · +0x1f8(C)** 인데 그 둘을 세우는 곳은 공 처리 코드
 * (0xb3b38·0xb401c) 안이라 읽지 않았다(R2 2절 "미해결"). 그래서 진행기가 이미 들고 있는
 * 두 상태로 **근사다**:
 *   B(`kind 'b'`, 공 위 −50) ← 레이저 반짝임 경기+0x19ad 가 켜져 있는 틱
 *   C(`kind 'c'`, 방향별 ±10) ← 열린 필살수비 창으로 실제 점프·슬라이딩 포구가 나가는 틱
 * C 의 방향 값(공 +0xa8 = 0xf 아래 · 0x10 위 · 0x11 왼 · 0x12 오른)이 슬라이딩 캐치 동작
 * 번호 0xf~0x12 와 **그대로 맞아떨어지는 것**이 이 짝짓기의 근거다.
 *
 * 원본대로 B 가 먼저다 — C 는 공 +0x1f7 == 0 일 때만 돈다(0x525c8).
 * 칸(`step`)은 deadly_effect 애니 0 [0,1,2,3] 지연 0 을 틱마다 한 칸씩 넘기고 마지막에서 멈춘다.
 */
function flashOf(input: ViewStateInput, fielders: readonly DefenseFielder[]): DefenseFlash | null {
  const chaser = fielders.find((fielder) => fielder.slot === input.chaserSlot)
  const kind = input.laserShining === true ? FLASH_LASER : specialFlashOf(input, chaser)
  // 꺼져 있어도 기억은 갱신해 둬야 다음 번쩍임이 0 칸부터 다시 돈다
  const since = tickSince(input.previousActions, 'flash', kind, input.tick)
  if (kind === FLASH_NONE) return null

  const step = Math.min(since, DEADLY_EFFECT_STEPS - 1)
  if (kind === FLASH_LASER) return { kind: 'b', step }
  const action = chaser?.action ?? 0
  const hasDirection =
    action >= FIELDER_ACTION.slideCatchDown && action <= FIELDER_ACTION.slideCatchRight
  // 점프 캐치(0xe)는 방향 칸이 없다 — 공 자리 그대로 그린다
  return hasDirection ? { kind: 'c', step, direction: action } : { kind: 'c', step }
}

/** deadly_effect 애니 0 의 칸 수 — 프레임 [0,1,2,3] (R2 2절) */
const DEADLY_EFFECT_STEPS = 4

/** 열린 필살수비 창으로 실제 필살 포구가 나가고 있으면 C, 아니면 꺼짐 */
function specialFlashOf(input: ViewStateInput, chaser: DefenseFielder | undefined): number {
  const window = input.specialDefense
  if (window == null || chaser === undefined) return FLASH_NONE
  if (window.jumpUnlocked && chaser.action === FIELDER_ACTION.jumpCatch) return FLASH_SPECIAL
  if (
    window.slideUnlocked &&
    chaser.action >= FIELDER_ACTION.slideCatchDown &&
    chaser.action <= FIELDER_ACTION.slideCatchRight
  ) {
    return FLASH_SPECIAL
  }
  return FLASH_NONE
}

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
