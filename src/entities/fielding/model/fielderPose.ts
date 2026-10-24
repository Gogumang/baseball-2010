import { AI_STATE, type FielderState } from '@/entities/fielding/model/fieldingState'

/**
 * **야수 동작 번호 +0xa8 · 동작 프레임 +0xac · 자세 워드 +0xb0** (야수 vtable 0xd7934 — 전부 직접 뜬 것, r171).
 *
 * 자세 워드는 바이트 넷(+0xb0 · +0xb1 · +0xb2 · +0xb3)이고, 읽는 쪽은 워드 하나로 본다:
 * - vtC4 `0xa20ec`(던질 준비) = `[+0xb0] 워드 == 0 && +0xb4 ≤ 0 && +0xc8 ≤ 0` — CPU 송구 0xafa60(afa86) · 송구 0xb2e38(b2e4e) ·
 *   사람 목표 b4660(b467c) · 레이저 창 0xb2648(b2670) · 레이저 발사 0x400bc 가 본다.
 * - vtcc `0xa2138` = `[+0xb0] 워드 == 0 && +0xb4 ≤ 0 && +0xcc ≤ 0` — 커버 b1dbe(막힘) · AI 0 b4772 · AI 2~5 b4804 · AI 1 b4ad2.
 * - vtc8 `0xa2118` = `+0xb1 == 0 && +0xcc ≤ 0` — 야수 틱의 이동 · 지우기 관문.
 * - 0xa0f7c(야수 틱 a1348) = `+0xb0 바이트 == 0 || +0xac ∈ {1, 2}` — 이동 관문(점프 · 가슴 높이 포구 동작 중에는 프레임 1 · 2 만 걷는다).
 *
 * 세우는 곳 (바이트마다):
 * - 플레이 틱 0xb401c 의 b4134~b419c — 공 틱이 동작 시작 틱(플레이+0x176)이면 포구 종류(+0x16c)로 표 0xd87f4 를 뛰어 잡을 야수
 *   (+0x170)에게: 0 → vt94 0xa1e28(동작 6 · **+0xb2**) · 1 → vt5c 0xa1490(동작 7 · **+0xb0**) · 2 → vt60 0xa1ed8(동작 8~0xb ·
 *   **+0xb3**) · 3 → vt90 0xa14ac(동작 0xe · **+0xb0**, 플레이+0x1f7 = 1) · 4 → vt98 0xa1e9c(동작 0xf~0x12 · **+0xb3**, 플레이+0x1f8 = 1).
 * - 같은 함수 b40ca~b4130 — 잡을 야수가 서 있고(vt18) 목표점 x · z 가 포구 틱 공 점(0xa25b0(공, +0x174))과 같고
 *   +0x174 < 공+0xaa0(낙구 틱) && +0x16c == 0 이면 **매 틱** vt9c 0xa1e44(동작 0xc · **+0xb2**) — 뜬공 기다리기.
 * - 던지기 0xa1620 끝 a1a26~a1a3a · 레이저 0xa222c 끝 a240c~a2418 — 동작 5 · **+0xb1**.
 *
 * 지우는 곳:
 * - 야수 틱 0xa1284 의 a137a~a1456(`listTickFielder`) — 동작 번호와 프레임으로.
 * - vt10 0xa124c — 0xbf2b0(목표 = 위치) · 동작 0 · 워드 0 · +0xbc · +0xb4 · +0xe8 = 0. 부르는 곳: 위 지우기 · 잠금이 0 이 된 야수 틱(a12c8) ·
 *   다시 쏘기 0xb3148 의 b31f0(공 가진 야수, 잠금 · +0xbc 가 없을 때) · 판 시작 0xb0fb4(b112e) · 협살 시작 0xb3a94 b3b0c(잠금 없는 두 야수 —
 *   잠긴 야수는 AI 8 도 안 된다) · AI 8 의 공 없는 야수 b4aaa(주자 틱 r0 < r ≤ r0 + 4).
 * - vt34 0xa157c — +0xb0 바이트만(웹 진행기에는 부르는 곳이 없다).
 *
 * 동작 번호 칸은 vt44 `0xa1234` 로만 바뀐다 — 다른 번호일 때만 +0xa8 = 번호 · +0xac = 0 (같으면 프레임을 안 되감는다).
 * 야수 틱 머리(a1286~a1290)가 **잠금과 상관없이** +0xac 를 하나 올린다.
 *
 * 받는 송구 · 줍는 공(주자 판 진행기 `runnerPlayEngine` · `pickoffPlay` 포함)도 같은 플레이 틱 b4134 로 선다 — 종류(+0x16c)와 시작 틱(+0x176)은
 * 고르기 0xb3b38 이 송구 0xb2e38 b307c · 다시 쏘기 b32a4 · 판 시작에서 적는 그대로다(`LooseBallChase.kind` · `actionStartTick`, r176).
 *
 * **걸음 방향 동작 1~4 — 0xa0ee8 (직접 뜬 것, r176)**: 위치(+0x20)와 목표(+0x2c)가 같으면 0, 아니면 dx = 목표 x − 위치 x · dz = 목표 z − 위치 z 로
 * |dx| > |dz| 면 (dx > 0 ? 4 : 3), 아니면 (dz > 0 ? 1 : 2) → vt44. 부르는 곳은 셋 — 야수 틱 a145a(지우기 뒤: vt10 이 목표 = 위치로 둔 뒤거나
 * +0x3b(막 닿음)라 **늘 0** — 웹 0 과 같다) · vt14 0xa14c8(잠금 +0xb4 ≤ 0 · vtc8 · 목표가 바뀔 때만 0xbf2cc 로 목표를 적고 부른다) · 0xa21bc.
 * 웹은 vt14 의 방향 번호를 옮기지 않았다(목표를 적는 곳이 vt14 관문 없이 적는다). 그림은 이 칸을 안 읽고, 규칙 칸으로는
 * "포구 동작 중 vt14 로 목표가 바뀌면 번호가 1~4 로 바뀌어 프레임 지우기 조건(6·2 · 7·5 · 0xe·0xf)을 놓쳐 워드가 남는" 경우만 갈린다.
 * **확정(r180 — 센 값)**: 표 전체(타구 1275 패턴 × 주자 3 × 씨앗 2 × CPU · 사람 '6' · 사람 '2' 22950 판 + 도루 · 견제 · 폭투 1980 판)에서
 * 포구 동작(6 · 7 · 8 · 0xe · 0xf, 워드가 선) 중에 목표가 바뀐 목록 틱은 **0 번**이다 — 바뀐 목표는 모두 던지기(동작 5, 다음 목록 틱의
 * `!vtc8` 지우기가 vt10 으로 목표 = 위치로 덮는다)나 동작 0 이었다. 포구 동작 중 vt14 를 부르는 원본 길(커버 b482c · AI 0xb b4b5c ·
 * 다이빙 b4728)은 같은 좌표라 바뀌지 않고, AI 0 · 1 · 0xc 는 vtcc · vt14 관문에서 막힌다. 다이빙의 vt60(0xa1ed8)은 방향 번호로
 * 8~0xb 를 고르지만 지우기는 +0xb3 && 프레임 5 라 번호를 안 본다(웹은 8). 0xa21bc(같은 방향 셈)는 공수 교대 판 걷기(0x3fac4 ·
 * 0x401d4 · 0x3a5f0 · 0x3a8e0)만 부른다.
 */

/** 자세 워드의 바이트 — 웹은 비트 하나씩으로 든다 */
export const POSE = {
  /** +0xb0 — 가슴 높이(동작 7) · 점프(동작 0xe) 포구. 이동 관문 0xa0f7c 가 본다 */
  FREEZE: 1 << 0,
  /** +0xb1 — 던진 뒤 (0xa1620 · 0xa222c). vtc8 이 본다 */
  THROWN: 1 << 1,
  /** +0xb2 — 낮은 공 포구(동작 6) · 뜬공 기다리기(동작 0xc) */
  LOW: 1 << 2,
  /** +0xb3 — 바운드 전 낮은 공(동작 8~0xb) · 슬라이딩(동작 0xf~0x12) */
  LOW_SWEEP: 1 << 3,
} as const

/** 야수 동작 번호 (+0xa8) — 이 진행기가 쓰는 것만 */
export const FIELDER_ACTION = {
  /** 서 있기 · 걷기(방향 1~4 는 0 으로 본다 — 머리말 ⚠️) · vt10 */
  NONE: 0,
  /** 던지기 (0xa1620 a1a26 · 0xa222c a240c) */
  THROW: 5,
  /** 낮은 공 포구 (vt94) */
  LOW_CATCH: 6,
  /** 가슴 높이 포구 (vt5c) */
  CHEST_CATCH: 7,
  /** 바운드 전 낮은 공 (vt60 — 방향 2 · 3 · 4 면 9 · 0xa · 0xb) */
  GROUNDER_CATCH: 8,
  /** 뜬공 기다리기 (vt9c) */
  WAIT_FLY: 0xc,
  /** 필살타법 타구에 맞음 (vte4 0xa1e60 — +0xb4 = 15) */
  HIT_STAGGER: 0xd,
  /** 필살 점프 캐치 (vt90) */
  JUMP_CATCH: 0xe,
  /** 필살 슬라이딩 캐치 (vt98 — 방향 2 · 3 · 4 면 0x10 · 0x11 · 0x12) */
  SLIDE_CATCH: 0xf,
} as const

type PoseFields = Pick<FielderState, 'action' | 'actionFrame' | 'pose'>

/** vt44 `0xa1234` — 번호가 다를 때만 +0xa8 = 번호 · +0xac = 0 */
export function withAction<F extends PoseFields>(fielder: F, action: number): F {
  if (fielder.action === action) return fielder
  return { ...fielder, action, actionFrame: 0 }
}

/**
 * 포구 동작 시작 b4134~b419c — 표 0xd87f4[포구 종류]. 종류가 0~4 밖이면(b414c `cmp r3,#4 ; bhi`) 아무것도 안 한다.
 * 플레이+0x1f7 · +0x1f8(필살 표시)은 부르는 쪽이 적는다.
 */
export function withCatchMotion<F extends PoseFields>(fielder: F, catchKind: number): F {
  switch (catchKind) {
    case 0:
      // vt94 0xa1e28: vt44(6) · +0xb2 = 1
      return { ...withAction(fielder, FIELDER_ACTION.LOW_CATCH), pose: fielder.pose | POSE.LOW }
    case 1:
      // vt5c 0xa1490: vt44(7) · +0xb0 = 1
      return { ...withAction(fielder, FIELDER_ACTION.CHEST_CATCH), pose: fielder.pose | POSE.FREEZE }
    case 2:
      // vt60 0xa1ed8: +0xb3 = 1 · vt44(8 — 방향 2 · 3 · 4 면 9 · 0xa · 0xb)
      return { ...withAction(fielder, FIELDER_ACTION.GROUNDER_CATCH), pose: fielder.pose | POSE.LOW_SWEEP }
    case 3:
      // vt90 0xa14ac: vt44(0xe) · +0xb0 = 1
      return { ...withAction(fielder, FIELDER_ACTION.JUMP_CATCH), pose: fielder.pose | POSE.FREEZE }
    case 4:
      // vt98 0xa1e9c: +0xb3 = 1 · vt44(0xf — 방향 2 · 3 · 4 면 0x10 · 0x11 · 0x12)
      return { ...withAction(fielder, FIELDER_ACTION.SLIDE_CATCH), pose: fielder.pose | POSE.LOW_SWEEP }
    default:
      return fielder
  }
}

/** vt9c 0xa1e44 — vt44(0xc) · +0xb2 = 1 (뜬공 기다리기, b4130) */
export function withFlyWaitPose<F extends PoseFields>(fielder: F): F {
  return { ...withAction(fielder, FIELDER_ACTION.WAIT_FLY), pose: fielder.pose | POSE.LOW }
}

/** 던지기 0xa1620 끝 a1a26~a1a3a(레이저 0xa222c 의 a240c~a2418 도 같다) — vt44(5) · +0xb1 = 1 */
export function withThrowMotion<F extends PoseFields>(fielder: F): F {
  return { ...withAction(fielder, FIELDER_ACTION.THROW), pose: fielder.pose | POSE.THROWN }
}

/**
 * vt10 `0xa124c` — a1252 0xbf2b0(목표 +0x2c = 위치 +0x20 · +0x3a = 1) · +0xa8 = 0 · 워드 0 · +0xb4 = 0 (+0xac 는 그대로) (r176).
 * 웹 AI 0xb(`PICK_UP`)는 목표 칸에 +0x90 을 담아 두므로 그 칸은 안 바꾼다 — 원본도 같은 틱 AI 고리 b4b5c 가 vt14(+0x90)로
 * 곧바로 되돌린다(vt14 0xa14c8 관문 +0xb4 ≤ 0 · vtc8 은 vt10 뒤라 열려 있다).
 */
export function withPoseCleared<
  F extends PoseFields & Pick<FielderState, 'actionLockTicks' | 'position' | 'target' | 'aiState'>,
>(fielder: F): F {
  return {
    ...fielder,
    target: fielder.aiState === AI_STATE.PICK_UP ? fielder.target : fielder.position,
    action: FIELDER_ACTION.NONE,
    pose: 0,
    actionLockTicks: 0,
  }
}

/** vtC4 `0xa20ec` — 던질 준비: 워드 0 · 잠금 +0xb4 ≤ 0 · 준비 틱 +0xc8 ≤ 0 */
export function isReadyToThrow(
  fielder: Pick<FielderState, 'pose' | 'actionLockTicks' | 'actionRemainingTicks'>,
): boolean {
  return fielder.pose === 0 && fielder.actionLockTicks <= 0 && fielder.actionRemainingTicks <= 0
}

/** vtcc `0xa2138` — 워드 0 · 잠금 +0xb4 ≤ 0 · +0xcc ≤ 0 */
export function isFreeToRetarget(
  fielder: Pick<FielderState, 'pose' | 'actionLockTicks' | 'arrivalSlackTicks'>,
): boolean {
  return fielder.pose === 0 && fielder.actionLockTicks <= 0 && fielder.arrivalSlackTicks <= 0
}

/** vtc8 `0xa2118` — +0xb1 == 0 && +0xcc ≤ 0 */
export function isFreeToStep(fielder: Pick<FielderState, 'pose' | 'arrivalSlackTicks'>): boolean {
  return (fielder.pose & POSE.THROWN) === 0 && fielder.arrivalSlackTicks <= 0
}

/**
 * **다음 야수 틱의 이동 관문** (a1346~a1376) — 웹은 이동을 판 틱 끝(6 절)에 미리 하므로 그때의 칸으로 원본 다음 야수 틱을 본다:
 * 프레임은 그 틱 머리(a128e)에서 하나 오른 값이다. `0xa0f7c`(+0xb0 바이트 == 0 || 프레임 ∈ {1, 2}) && vtc8 && +0xb4 ≤ 0.
 */
export function canStepNextListTick(
  fielder: Pick<FielderState, 'pose' | 'actionFrame' | 'actionLockTicks' | 'arrivalSlackTicks'>,
): boolean {
  return isFreezeOpen(fielder.pose, fielder.actionFrame + 1) && isFreeToStep(fielder) && fielder.actionLockTicks <= 0
}

/**
 * **야수 틱 0xa1284 의 이동 밖 몫** (전부 직접 뜬 것):
 * ```
 * a1286  +0xac += 1                                         ; 잠금과 상관없이
 * a12b4  +0xb4 > 0 이면 −1 ; 0 이 되면 +0xbd = 1 · vt10 ; 끝    ; 아래 전부 없음
 * a1310  +0xc8 > 0 && +0xe0(쥠) 이면 −1 (0 아래로 안 감)
 * a1330  +0xcc > 0 이면 −1
 * a1346  (이동 — `canStepNextListTick`)
 * a137a  a = +0xa8 · f = +0xac
 *        s4 = a == 7 && f == 5 ; r1 = a == 0xe && f == 0xf ; s0 = a == 5 && f == 2 ; r2 = a == 6 && f == 2 ; r7 = +0xb3 && f == 5
 * a13ea  0xe ≤ a ≤ 0x12 → a141c:  a == 0xe ? (f == 0xf 면 지움) : (f == 0xc 면 지움)        ; vtc8 을 안 본다
 *        아니면 r1 || s4 || s0 || r2 || r7 || !vtc8() 면 지움
 * a143e  지움 = +0xb0 · +0xb1 · +0xb2 · +0xb3 = 0 · vt10
 * a145a  (+0x3b || s4 || s0 || r7) && 워드 == 0 이면 0xa0ee8(방향 동작 0~4 — 머리말 ⚠️, 웹은 0 이라 바뀌는 것이 없다)
 * ```
 * 그래서 포구 동작 시작 틱 S 뒤 워드가 남는 마지막 판 틱은 — 낮은 공 S+1 · 가슴 높이 S+4 · 바운드 전 낮은 공 S+4 · 점프 S+14 ·
 * 슬라이딩 S+11 이고(그 다음 야수 틱이 지운다), 그동안 vtC4 가 거짓이라 쥔 야수가 못 던진다.
 * 던진 야수(동작 5 · +0xb1)는 다음 야수 틱에 `!vtc8` 로 곧바로 지워진다.
 */
export function listTickFielder(fielder: FielderState): FielderState {
  const frame = fielder.actionFrame + 1
  if (fielder.actionLockTicks > 0) {
    const lock = fielder.actionLockTicks - 1
    const ticked = { ...fielder, actionFrame: frame, actionLockTicks: lock }
    // a12c8 — 잠금이 막 0 이 되면 vt10
    return lock <= 0 ? withPoseCleared(ticked) : ticked
  }
  let next: FielderState = {
    ...fielder,
    actionFrame: frame,
    actionRemainingTicks:
      fielder.holdingBall && fielder.actionRemainingTicks > 0
        ? Math.max(0, fielder.actionRemainingTicks - 1)
        : fielder.actionRemainingTicks,
    arrivalSlackTicks: Math.max(0, fielder.arrivalSlackTicks - 1),
  }
  if (shouldClearPose(next)) next = withPoseCleared(next)
  return next
}

/** 0xa0f7c — +0xb0 바이트 == 0 || 프레임(이미 올린 값) ∈ {1, 2} */
export function isFreezeOpen(pose: number, frame: number): boolean {
  return (pose & POSE.FREEZE) === 0 || frame === 1 || frame === 2
}

/** a137a~a143e 의 지우기 판정 — 프레임은 야수 틱 머리에서 이미 올린 값 (`listTickFielder` 머리말) */
export function shouldClearPose(fielder: PoseFields & Pick<FielderState, 'arrivalSlackTicks'>): boolean {
  const { action, actionFrame: frame } = fielder
  if (action >= 0xe && action <= 0x12) {
    return action === 0xe ? frame === 0xf : frame === 0xc
  }
  const chestEnd = action === FIELDER_ACTION.CHEST_CATCH && frame === 5
  const throwEnd = action === FIELDER_ACTION.THROW && frame === 2
  const lowEnd = action === FIELDER_ACTION.LOW_CATCH && frame === 2
  const sweepEnd = (fielder.pose & POSE.LOW_SWEEP) !== 0 && frame === 5
  return chestEnd || throwEnd || lowEnd || sweepEnd || !isFreeToStep(fielder)
}
