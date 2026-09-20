/**
 * 수비 화면이 받는 순수 데이터와 그림 고르기 (R3-field-view 2·7절 · R2-game-effects 2절).
 *
 * 야수·주자·공을 굴리는 모델(`entities/fielding`)은 아직 다른 사람이 만드는 중이라,
 * 화면은 **한 틱치 스냅샷**만 받는다. 모델이 붙으면 그 쪽에서 이 모양으로 넘겨 주면 된다.
 */

import type { WorldPoint } from '@/pages/defense/lib/defenseCamera'

/** 수비 배경 stadium/defense.pzx — 310×500 한 장 (FOR-IMPLEMENTER B-1) */
export const DEFENSE_BACKGROUND_URL = './sprites/defense/000.png'
export const DEFENSE_BACKGROUND_WIDTH = 310
export const DEFENSE_BACKGROUND_HEIGHT = 500

/** 보통 수비수 그림 (defender.pzx, 합성 프레임 125장 = 000~124) */
export const DEFENDER_FRAMES = './sprites/defender/frames'
/** 주자·공 그림 */
export const BALL_FRAMES = './sprites/ball/frames'
/** 공 잡는 순간 번쩍임 (R2 2절) */
export const DEADLY_EFFECT_FRAMES = './sprites/deadly_effect/frames'

/**
 * 마선수 수비 그림 (R3 7-1, 이름 표 0xd3f0c / 0xd4008).
 * 타자 마선수 다섯은 defender 와 같은 125장이지만, **투수 마선수 다섯은 38장뿐**이다
 * (public/sprites 에서 직접 셈). 그래서 38 이상 프레임은 보통 그림으로 되돌린다.
 */
export const ACE_BATTER_DEFENDER_FRAMES = [
  './sprites/defender_medica/frames',
  './sprites/defender_kao/frames',
  './sprites/defender_roze/frames',
  './sprites/defender_death/frames',
  './sprites/defender_tiger/frames',
] as const
export const ACE_PITCHER_DEFENDER_FRAMES = [
  './sprites/defender_psyker/frames',
  './sprites/defender_leony/frames',
  './sprites/defender_bbmachine/frames',
  './sprites/defender_ballantine/frames',
  './sprites/defender_dragona/frames',
] as const
/** 투수 마선수 그림이 가진 프레임 수 — 이보다 크면 보통 그림으로 되돌린다 */
export const ACE_PITCHER_FRAME_COUNT = 38

/** 야수 동작 번호 (R3 2-1, 야수 vt44 = 0xa1234 가 +0xa8 에 넣는 값) */
export const FIELDER_ACTION = {
  stand: 0,
  runDown: 1,
  runUp: 2,
  runLeft: 3,
  runRight: 4,
  throw: 5,
  catchLow: 6,
  catchChest: 7,
  diveDown: 8,
  diveUp: 9,
  diveLeft: 0xa,
  diveRight: 0xb,
  catchStill: 0xc,
  fumble: 0xd,
  jumpCatch: 0xe,
  slideCatchDown: 0xf,
  slideCatchUp: 0x10,
  slideCatchLeft: 0x11,
  slideCatchRight: 0x12,
  /** 원본에 프레임 14 로 남아 있는데 **거는 곳을 못 찾은** 동작 (R3 2-1 마지막 줄) */
  unknown0x78: 0x78,
} as const

/** 주자 동작 번호 (R3 8-1 vt40 = 0xa0070 이 프레임으로 바꾸는 값) */
export const RUNNER_ACTION = {
  stand: 0,
  run: 1,
  run2: 2,
  run3: 3,
  run4: 4,
  run5: 5,
  slide: 6,
} as const

/** 달리기 칸 표 0xd781c — 한 바퀴 네 칸 */
const RUN_STEPS = [0, 1, 0, 2] as const

/** 야수 달리기 동작 1·2·3·4 의 첫 프레임 (I 1c: 0 / 3 / 6 / 9 + 칸) */
const FIELDER_RUN_BASE = [0, 3, 6, 9] as const
/** 송구 동작 5 (12,13,14,12) */
const FIELDER_THROW = [12, 13, 14, 12] as const
/** 낮은 공 포구 6 (18,15,0) */
const FIELDER_CATCH_LOW = [18, 15, 0] as const
/** 가슴 높이 포구 7 (15,16,17,18,15,0) */
const FIELDER_CATCH_CHEST = [15, 16, 17, 18, 15, 0] as const
/** 몸 날리기 8·9·0xa·0xb — 방향별 한 장씩 (25 / 28 / 22 / 19) */
const FIELDER_DIVE = [25, 28, 22, 19] as const
/** 슬라이딩 캐치 0xf·0x10·0x11·0x12 의 첫 프레임 + 0..4 */
const FIELDER_SLIDE_CATCH = [60, 65, 55, 50] as const
/** 공 놓침 0xd — 31~37 */
const FUMBLE_FIRST = 31
const FUMBLE_COUNT = 7
/** 점프 캐치 0xe — 38~49 */
const JUMP_FIRST = 38
const JUMP_COUNT = 12

/**
 * 야수 동작 → 프레임 (R3 2-1 표 = I-controls 1c).
 *
 * `tick` 은 그 동작이 걸린 뒤 흐른 갱신 횟수다. 원본이 칸마다 몇 틱을 머무는지는
 * I 1c 에 안 적혀 있어서(프레임 목록만 있다) **한 틱에 한 칸**으로 두고,
 * 한 번만 도는 동작(포구·펌블·점프·슬라이딩 캐치)은 마지막 칸에서 멈춘다.
 */
export function fielderFrameOf(action: number, tick: number): number {
  const step = ((tick % 4) + 4) % 4
  const safeTick = Math.max(0, tick)
  if (action >= FIELDER_ACTION.runDown && action <= FIELDER_ACTION.runRight) {
    return FIELDER_RUN_BASE[action - 1] + RUN_STEPS[step]
  }
  if (action === FIELDER_ACTION.throw) return FIELDER_THROW[step]
  if (action === FIELDER_ACTION.catchLow) {
    return FIELDER_CATCH_LOW[Math.min(safeTick, FIELDER_CATCH_LOW.length - 1)]
  }
  if (action === FIELDER_ACTION.catchChest) {
    return FIELDER_CATCH_CHEST[Math.min(safeTick, FIELDER_CATCH_CHEST.length - 1)]
  }
  if (action >= FIELDER_ACTION.diveDown && action <= FIELDER_ACTION.diveRight) {
    return FIELDER_DIVE[action - FIELDER_ACTION.diveDown]
  }
  if (action === FIELDER_ACTION.catchStill) return 18
  if (action === FIELDER_ACTION.fumble) return FUMBLE_FIRST + Math.min(safeTick, FUMBLE_COUNT - 1)
  if (action === FIELDER_ACTION.jumpCatch) return JUMP_FIRST + Math.min(safeTick, JUMP_COUNT - 1)
  if (action >= FIELDER_ACTION.slideCatchDown && action <= FIELDER_ACTION.slideCatchRight) {
    return FIELDER_SLIDE_CATCH[action - FIELDER_ACTION.slideCatchDown] + Math.min(safeTick, 4)
  }
  // 원본에 프레임 14 로 남은 동작 0x78 — 어디서 거는지 못 찾았다(R3 2-1). 들어오면 그대로 그린다.
  if (action === FIELDER_ACTION.unknown0x78) return 14
  return 0
}

/** 슬라이딩 프레임 표 0xd7818 / 0xd7814 — 어느 쪽이 진루/귀루인지는 미확정(R3 8-1) */
const RUNNER_SLIDE_ADVANCE = [2, 3, 0, 1] as const
const RUNNER_SLIDE_RETURN = [3, 0, 1, 2] as const

/**
 * 주자 동작 → 프레임 (R3 8-1, 주자 vt40 = 0xa0070 의 식 그대로).
 * 야수 표(2-1)와 칸 배치가 다르다 — 원본이 같은 그림 객체(0x79944)를 쓰면서도
 * 주자 쪽은 0~16 만 쓴다(R10 4절의 작은 다이아몬드 주자도 같은 객체다).
 * 저장소에 주자 전용 그림판이 따로 없어 `defender` 를 그대로 쓴다.
 */
export function runnerFrameOf(
  action: number,
  tick: number,
  base: number,
  isAdvancing: boolean,
): number {
  const step = ((tick % 4) + 4) % 4
  if (action === RUNNER_ACTION.stand) return 0
  if (action === RUNNER_ACTION.run) return [0, 1][((tick % 2) + 2) % 2]
  if (action >= RUNNER_ACTION.run2 && action <= RUNNER_ACTION.run5) {
    return [1, 4, 7, 10][action - RUNNER_ACTION.run2] + RUN_STEPS[step]
  }
  if (action === RUNNER_ACTION.slide) {
    const table = isAdvancing ? RUNNER_SLIDE_ADVANCE : RUNNER_SLIDE_RETURN
    return 13 + table[((base % 4) + 4) % 4]
  }
  return 0
}

/** 공 (카메라 대상은 (x, z − 높이) 다 — R3 1-3) */
export interface DefenseBall extends WorldPoint {
  /** 월드 단위 높이 */
  readonly height: number
  /** 공.vt18 — 날아가는 중인가. 멈추면 카메라가 타자주자를 본다 */
  readonly isFlying: boolean
}

/** 야수 한 명 */
export interface DefenseFielder {
  /** 수비 칸 0 투수 · 1 포수 · 2 1루 · 3 2루 · 4 3루 · 5 유격 · 6 우익 · 7 좌익 · 8 중견 (R3 2-2) */
  readonly slot: number
  readonly x: number
  readonly z: number
  /** FIELDER_ACTION */
  readonly action: number
  /** 그 동작이 걸린 뒤 흐른 갱신 횟수 */
  readonly actionTick: number
  /**
   * 좌우 반전 (0x43278 의 c: 칸 ≠ 0 이고 선수 +0xb 상위 니블 ∈ {2,3}).
   * 원본은 그리기 플래그 +0x11 을 얹는다 — 뜻이 "유력" 이라(R3 7-3) 기준점 중심 뒤집기로 둔다.
   */
  readonly isFlipped?: boolean
  /** 마선수 번호 0~4, 마선수가 아니면 null (R3 7-1) */
  readonly aceIndex?: number | null
}

/** 주자 한 명 */
export interface DefenseRunner {
  /** 주자 칸 0 = 타자주자 (R3 1-3 이 카메라 대상으로 쓰는 주자다) */
  readonly index: number
  readonly x: number
  readonly z: number
  /** RUNNER_ACTION */
  readonly action: number
  readonly actionTick: number
  /** 슬라이딩 프레임을 고르는 루 번호 (vt40 이 `루 % 4` 로 쓴다) */
  readonly base: number
  /** 진루 중인가 — 슬라이딩 표 둘 중 하나를 고른다 */
  readonly isAdvancing: boolean
  /** 아웃돼 퇴장 중이어도 걸어 나가는 동안은 그린다(R3 3-4). 아예 안 그릴 때만 false */
  readonly isVisible?: boolean
}

/**
 * 공 잡는 순간 번쩍임 (R2 2절).
 * A(0x4403c)는 줌 펀치만 하고 **그리지 않으므로** 여기 종류에 없다.
 */
export interface DefenseFlash {
  /** 'b' = 0x441c4 (공 +0x1f7) · 'c' = 0x44398 (공 +0x1f8) */
  readonly kind: 'b' | 'c'
  /** deadly_effect 애니 0 의 칸 0~3 */
  readonly step: number
  /** 공 +0xa8 방향 0xf 아래 · 0x10 위 · 0x11 왼 · 0x12 오른 — kind 'c' 에서만 쓴다 */
  readonly direction?: number
}

/** 번쩍임을 공 화면점에서 얼마나 옮겨 그리나 (R2 2절 표) */
export function flashOffsetOf(flash: DefenseFlash): { readonly x: number; readonly y: number } {
  if (flash.kind === 'b') return { x: 0, y: -50 }
  switch (flash.direction) {
    case 0xf:
      return { x: 0, y: 10 }
    case 0x10:
      return { x: 0, y: -10 }
    case 0x11:
      return { x: -10, y: 0 }
    case 0x12:
      return { x: 10, y: 0 }
    default:
      return { x: 0, y: 0 }
  }
}

/** 화면 한 틱치 스냅샷 */
export interface DefenseViewState {
  readonly ball: DefenseBall
  readonly fielders: readonly DefenseFielder[]
  readonly runners: readonly DefenseRunner[]
  /** 번쩍임이 돌고 있으면 그 상태, 아니면 null */
  readonly flash?: DefenseFlash | null
  /**
   * 카메라가 따로 볼 곳. 원본은 상태 0x18(경기 끝 직전)에 투수판 (20000, 24500) 의
   * (x, z − 2000) 을 1%/틱 으로 본다 (R3 1-3). 없으면 아래 규칙대로 공/타자주자를 본다.
   */
  readonly cameraTarget?: WorldPoint | null
}

/**
 * 카메라가 볼 점 (0x3f060).
 * 공이 날아가는 중이면 공 (x, z − 높이), 멈췄으면 타자주자(주자 0).
 */
export function cameraTargetOf(state: DefenseViewState): WorldPoint {
  if (state.cameraTarget != null) return state.cameraTarget
  if (!state.ball.isFlying) {
    const batterRunner = state.runners.find((runner) => runner.index === 0)
    if (batterRunner !== undefined) return { x: batterRunner.x, z: batterRunner.z }
  }
  return { x: state.ball.x, z: state.ball.z - state.ball.height }
}

/** 야수가 쓸 그림판 (R3 7-3 의 a·b 갈래) */
export function fielderFramesOf(fielder: DefenseFielder, frame: number): string {
  const ace = fielder.aceIndex
  if (ace == null || ace < 0 || ace > 4) return DEFENDER_FRAMES
  if (fielder.slot === 0) {
    // 투수 마선수 그림은 38장뿐이라 그 위 프레임은 보통 그림으로 되돌린다(에셋 확인 결과).
    return frame < ACE_PITCHER_FRAME_COUNT ? ACE_PITCHER_DEFENDER_FRAMES[ace] : DEFENDER_FRAMES
  }
  return ACE_BATTER_DEFENDER_FRAMES[ace]
}

/**
 * 공 그림 프레임.
 * ball.pzx 는 000~010 이 2~12px 짜리 동그라미(높이별 크기로 보인다),
 * 011~022 가 세로로 늘어난 것, 023~033 이 납작한 그림자다.
 * 고르는 식은 공 궤적 코드(0xb3b38·0xb401c) 안이라 읽지 않았다 —
 * 여기서는 500 월드 단위마다 한 칸 굵어지는 것으로 근사한다.
 */
export const BALL_HEIGHT_PER_FRAME = 500
export function ballFrameOf(height: number): number {
  return Math.max(0, Math.min(10, Math.trunc(height / BALL_HEIGHT_PER_FRAME)))
}
/** 그림자 프레임 — 동그라미와 같은 칸의 납작한 그림 (023~033) */
export function ballShadowFrameOf(height: number): number {
  return 23 + ballFrameOf(height)
}
