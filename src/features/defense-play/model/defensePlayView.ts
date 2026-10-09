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
  DUST_TRAIL_OFF,
  slideDustDirectionOf,
  stepDustTrail,
  type DustTrailState,
} from '@/features/defense-play/model/playerEffects'
import {
  FIELDER_ACTION,
  HOLDER_MARK_ANIM,
  RUNNER_ACTION,
  type DefenseFielder,
  type HolderMark,
  type HolderPlate,
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

export type { HolderMark, HolderPlate }

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
  // (필살 포구 번쩍임은 여기서 안 고른다 — 진행기의 `defenseScene` 이 연출 단계대로 싣는다)

  /** 수비 칸별 마선수 번호 0~4 (없으면 null·undefined). 이름 표 0xd3f10, 20바이트 간격 — C-16 */
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /**
   * 레이저 송구 반짝임(경기+0x19ad)을 띄울 야수 칸. 안 주면 아무도 안 반짝인다.
   * 세 조건(공 쥔 야수 · +0x19ad · deadly_effect A 안 돎)은 **진행기가** 본다 — `defenseView.ts` 주석.
   */
  readonly laserShiningSlot?: number | null
  /** 수비 팀 번호 0~14 — 야수 그림 팔레트 (C-1) */
  readonly defenseTeamIndex?: number | null
  /** 공격 팀 번호 0~14 — 주자 그림 팔레트 */
  readonly offenseTeamIndex?: number | null
  /** 공 가진 야수 고리 (0x43cb0) — 진행기가 `holderMarkOf` 로 고른다. 안 주면 없다 */
  readonly holderMark?: HolderMark | null
  /** 고리와 같이 그리는 이름 판에 적을 선수. 고리가 없으면 버린다 */
  readonly holderPlate?: HolderPlate | null
  /** 칸별 야수 +0xb8(펌블 표시) — 진행기가 센다. 안 주면 0 */
  readonly fumbleTicks?: readonly number[]
  /** 칸별 야수 +0xc0(송구 실수 표시) — 진행기가 센다. 안 주면 0 */
  readonly throwErrorTicks?: readonly number[]
  /** 주자 칸 → +0x84(직전 목표 루). 슬라이딩 먼지 방향 0x9ff40 의 0x9fe80 이 본다. 안 주면 +0x8c(닿은 루) */
  readonly previousTargetOf?: (runnerIndex: number) => number
}

/**
 * 야수마다의 달리기 먼지 자국 상태 — 그리기가 돌리는 칸이라 스냅샷 한 장마다 한 걸음 간다.
 * 진행기마다 판 하나 동안 들고 있는 `previousActions` 에 붙여 둔다(따로 넘길 칸을 늘리지 않으려고).
 */
const dustTrailsOf = new WeakMap<ActionMemory, DustTrailState[]>()

export function viewStateOf(input: ViewStateInput): DefensePlayView {
  const fielders: DefenseFielder[] = input.fielders.map((fielder) => {
    const action = fielderActionOf(fielder, input)
    const trails = dustTrailsOf.get(input.previousActions) ?? []
    dustTrailsOf.set(input.previousActions, trails)
    const trail = stepDustTrail(trails[fielder.slot] ?? DUST_TRAIL_OFF, action, fielder.position)
    trails[fielder.slot] = trail.state
    return {
      slot: fielder.slot,
      x: fielder.position.x,
      z: fielder.position.z,
      action,
      actionTick: tickSince(input.previousActions, `f${fielder.slot}`, action, input.tick),
      aceIndex: aceIndexOf(input.aceIndexes, fielder.slot),
      teamIndex: input.defenseTeamIndex ?? null,
      // +0xb0 — 세우는 곳이 가슴 높이(7) · 점프(0xe) 포구 세터뿐이고 동작이 끝나면 지운다 (근사: 지금 동작이 그 둘이면 선 것으로 본다)
      catchFlag: action === FIELDER_ACTION.catchChest || action === FIELDER_ACTION.jumpCatch,
      lockTicks: fielder.actionLockTicks,
      fumbleTicks: input.fumbleTicks?.[fielder.slot] ?? 0,
      throwErrorTicks: input.throwErrorTicks?.[fielder.slot] ?? 0,
      dustTrail:
        trail.mark === null
          ? null
          : { x: trail.mark.point.x, z: trail.mark.point.z - trail.mark.point.y, frame: trail.mark.frame },
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
      // +0x96 = 아웃 또는 홈 밟음 (`runnerFates` — 웹 isOut 은 아웃만이라 scored 를 더한다)
      isFinished: runner.isOut || runner.scored,
      // 0x43b0a: 주자 +0xb8(슬라이딩 중)이면 0x9ff40 방향
      slideDirection: runner.sliding
        ? slideDustDirectionOf(runner, input.previousTargetOf?.(runner.index) ?? runner.startBase)
        : 0,
    }
  })

  return {
    tick: input.tick,
    ball: { x: input.ball.x, z: input.ball.z, height: input.ball.y, isFlying: input.ballIsFlying },
    fielders,
    runners,
    // 필살 포구 번쩍임(deadly_effect B · C)은 진행기가 연출 단계 기계로 그린 그림에만 싣는다 (`defenseScene`)
    flash: null,
    // 레이저 반짝임은 그릴 칸 하나로 끝이다 — 고르는 조건은 진행기 몫이다(0x43406~0x4342c)
    laserShiningSlot: laserShiningSlotOf(input.laserShiningSlot),
    cameraTarget: null,
    holderMark: input.holderMark ?? null,
    holderPlate: input.holderMark == null ? null : (input.holderPlate ?? null),
  }
}

/**
 * 공 가진 야수 고리를 띄울지와 그 애니 (0x43cb0 머리 0x43cb0~0x43d28, 직접 뜬 것).
 * ```
 * 43cc6: [[경기+0x200]+0x118](플레이 종류) == 8 이면 끝        ; 더비 판 종류 — 웹 수비 판에는 없는 종류다
 * 43cd4: H = 0xb0c91(플레이) = 야수[플레이+0x130] ; 없으면 끝
 * 43cfc: 경기+0x19ac == 0 이면 끝                              ; 쥐기 0xb2710 의 메시지 0x15 가 세움, 0x17 진입 0x467de 가 지움
 * 43ce2: 애니 = state[0x31 + state[9]] == 0 (공격이 사람) ? 3 : 1
 * 43d1c: 경기+0x19ad(레이저 반짝임)면 애니 = 2
 * ```
 * ⚠️ 레이저 반짝임 야수 칠하기(0x43406)와 달리 deadly_effect A(+0x1990)를 **안 본다**.
 */
export function holderMarkOf(input: {
  /** 경기+0x19ac — 이 판에 누가 한 번이라도 쥐었나 */
  readonly grabbed: boolean
  /** 플레이+0x130 — 마지막으로 쥔 야수 칸. 없으면 −1 */
  readonly holderSlot: number
  /** state[0x31 + state[9]] == 1 */
  readonly offenseIsCpu: boolean
  /** 경기+0x19ad */
  readonly isShining: boolean
}): HolderMark | null {
  if (!input.grabbed) return null
  if (!Number.isInteger(input.holderSlot) || input.holderSlot < 0 || input.holderSlot > 8) return null
  const anim = input.isShining
    ? HOLDER_MARK_ANIM.shining
    : input.offenseIsCpu
      ? HOLDER_MARK_ANIM.cpuOffense
      : HOLDER_MARK_ANIM.humanOffense
  return { slot: input.holderSlot, anim }
}

/** 반짝일 야수 칸 고르기 — 0~8 밖이면 아무도 안 반짝이는 것으로 본다(−1 이 "없음" 이다) */
function laserShiningSlotOf(slot: number | null | undefined): number | null {
  if (slot == null || !Number.isInteger(slot) || slot < 0 || slot > 8) return null
  return slot
}

/**
 * 타자 마선수 그림을 **팀당 첫 한 명으로 뭉갠다** — 원본 버그 그대로다 (R3 7-3).
 *
 * 원본 적재(0x3a680~0x3a716)는 팀 선수 목록에서 `+0xa & 0x40` 인 **첫 선수** 하나로만
 * `0x79a5c(obj, 번호)` 를 부르고, 그리는 쪽 `0x79b48` 의 b 갈래는 "그 칸 선수가 마선수인가" 만
 * 본다. 그래서 한 팀에 타자 마선수가 둘 이상이면 **둘째부터도 첫째의 그림**으로 나온다.
 *
 * 칸 0(투수)은 따로 적재되는 그림(`0x79ab0`, 표 0xd4008)이라 **건드리지 않는다** —
 * a 갈래가 b 갈래보다 먼저다.
 *
 * `viewStateOf` 는 이것을 **자동으로 해 주지 않는다**(진행기는 받은 표를 그대로 넘긴다).
 * 버그를 되살리려면 표를 만드는 쪽이 이 함수를 통과시켜야 한다.
 */
export function aceIndexesWithOriginalBug(
  aces: readonly (number | null | undefined)[] | undefined,
): readonly (number | null | undefined)[] | undefined {
  if (aces === undefined) return undefined
  // 칸 1 부터 훑어 첫 타자 마선수를 찾는다 (칸 0 은 투수 마선수라 셈에서 뺀다)
  let first: number | null = null
  for (let slot = 1; slot < aces.length; slot += 1) {
    const ace = aceIndexOf(aces, slot)
    if (ace === null) continue
    first = ace
    break
  }
  if (first === null) return aces
  return aces.map((ace, slot) => (slot === 0 || aceIndexOf(aces, slot) === null ? ace : first))
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
