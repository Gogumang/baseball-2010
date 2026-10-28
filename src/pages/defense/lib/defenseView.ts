/**
 * 수비 화면이 받는 순수 데이터와 그림 고르기 (R3-field-view 2·7절 · R2-game-effects 2절).
 *
 * 야수·주자·공을 굴리는 모델(`entities/fielding`)은 아직 다른 사람이 만드는 중이라,
 * 화면은 **한 틱치 스냅샷**만 받는다. 모델이 붙으면 그 쪽에서 이 모양으로 넘겨 주면 된다.
 */

import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { WorldPoint } from '@/pages/defense/lib/defenseCamera'
import { TEAM_COUNT } from '@/shared/lib/sprite/paletteSwap'
import { ballShadowPiecesAt } from '@/shared/lib/ballShadow/ballShadowPieces'
import type { BallShadowPiece } from '@/shared/lib/ballShadow/ballShadowPieces'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 수비 배경 stadium/defense.pzx — 310×500 한 장 (FOR-IMPLEMENTER B-1) */
export const DEFENSE_BACKGROUND_URL = assetUrl('./sprites/defense/000.png')
export const DEFENSE_BACKGROUND_WIDTH = 310
export const DEFENSE_BACKGROUND_HEIGHT = 500

/** 보통 수비수 그림 (defender.pzx, 합성 프레임 125장 = 000~124) */
export const DEFENDER_FRAMES = assetUrl('./sprites/defender/frames')
/** 주자·공 그림 */
export const BALL_FRAMES = assetUrl('./sprites/ball/frames')
/** 공 잡는 순간 번쩍임 (R2 2절) */
export const DEADLY_EFFECT_FRAMES = assetUrl('./sprites/deadly_effect/frames')

/**
 * 마선수 수비 그림 (R3 7-1, 이름 표 0xd3f0c / 0xd4008).
 * 타자 마선수 다섯은 defender 와 같은 125장이고 **투수 마선수 다섯은 38장뿐**인데,
 * 그 까닭이 S12 8절에서 풀렸다 — 야수 그리기 `0x79b48` 은 프레임에 **+17** 을 더하지만
 * 투수 마선수 갈래(`a != 0`)만 **더하지 않는다**. 투수는 주자 칸(0~16)이 필요 없어 제 동작을 0 부터 담았다.
 * 그래서 "38 이상이면 보통 그림으로 되돌린다" 던 땜질(`ACE_PITCHER_FRAME_COUNT`)은 **필요 없다** — 지웠다.
 */
export const ACE_BATTER_DEFENDER_FRAMES = [
  assetUrl('./sprites/defender_medica/frames'),
  assetUrl('./sprites/defender_kao/frames'),
  assetUrl('./sprites/defender_roze/frames'),
  assetUrl('./sprites/defender_death/frames'),
  assetUrl('./sprites/defender_tiger/frames'),
] as const
export const ACE_PITCHER_DEFENDER_FRAMES = [
  assetUrl('./sprites/defender_psyker/frames'),
  assetUrl('./sprites/defender_leony/frames'),
  assetUrl('./sprites/defender_bbmachine/frames'),
  assetUrl('./sprites/defender_ballantine/frames'),
  assetUrl('./sprites/defender_dragona/frames'),
] as const

/**
 * 야수 프레임에 더하는 값 — `0x79b48:0x79b6e` 의 `프레임 + 0x11` (S12 8-1 **확정**).
 * `defender.pzx` 125장은 **앞 17장(000~016)이 주자 칸, 017~086 이 야수 칸**으로 갈린다.
 * (앞 노트가 "좌우 반전 비트" 로 읽은 것은 틀렸다 — 이 함수에는 뒤집기가 아예 없다.)
 */
export const FIELDER_FRAME_OFFSET = 0x11

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

/** 달리기 칸 표 0xd781c(주자) · 0xd7ae8(야수) — 값이 같다. 한 바퀴 네 칸 */
const RUN_STEPS = [0, 1, 0, 2] as const

/**
 * 동작 프레임 한 칸이 머무는 틱 — **1틱 확정** (S12 5절).
 * 애니 카운터를 주자는 틱 끝(0xa0386)에서 `+0xb4 += 1`, 야수는 틱 맨 앞(0xa128a)에서 `+0xac += 1` 로
 * 틱마다 정확히 한 번 올린다. 달리기는 `[0,1,0,2]` 네 칸이라 4틱 주기다.
 */
export const TICKS_PER_ACTION_FRAME = 1

/**
 * 한 번짜리 동작의 총 길이 (틱) — 야수 틱 `0xa1376`~`0xa143e` 가 이 틱에 동작을 푼다 (S12 5-1 확정).
 * 프레임 표는 `min(t, 상한)` 으로 마지막 칸에서 멈춰 있다가 아래 틱 수를 채우면 동작이 풀린다.
 */
export const FIELDER_ACTION_TICKS = {
  /** 5 송구 — +0xac 가 2 에서 끝난다 (12,13,14) */
  throw: 3,
  /** 6 낮은 공 포구 */
  catchLow: 3,
  /** 7 가슴 높이 포구 */
  catchChest: 6,
  /** 8~0xb 몸 날리기 (+0xb3) */
  dive: 6,
  /** 0xe 점프 캐치 — +0xac 가 0xf 에서 끝난다 */
  jumpCatch: 16,
  /** 0xf~0x12 슬라이딩 캐치 — +0xac 가 0xc 에서 끝난다 */
  slideCatch: 13,
} as const

/** 주자 슬라이딩 자세 — `주자+0xb4 == 5` 에서 `0x9ffcc` 로 풀린다 (0xa0376) */
export const RUNNER_SLIDE_TICKS = 5

/** 야수 달리기 동작 1·2·3·4 의 첫 프레임 — vt40 **날값** (0xa1058: 0 / 3 / 6 / 9 + 칸) */
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
 * 야수 동작 → **vt40 날값** (야수 vt40 = `0xa1058`, R3 2-1 표 = I-controls 1c).
 *
 * `tick` 은 그 동작이 걸린 뒤 흐른 갱신 횟수이고 **한 틱에 한 칸**이다(S12 5절 확정).
 * 한 번만 도는 동작(포구·펌블·점프·슬라이딩 캐치)은 마지막 칸에서 멈춘다.
 *
 * 실제로 그리는 프레임은 여기에 **+17** 이다 — `fielderFrameOf` 를 쓴다.
 */
export function fielderActionFrameOf(action: number, tick: number): number {
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

/**
 * 야수 동작 → **실제로 그리는 `defender.pzx` 프레임** (날값 + 17, S12 4-2·8-1).
 * 프레임 020(= 동작 2 달리기↑ 첫 칸 3 + 17)이 뒤통수 그림인 것으로 에셋에서도 확인했다.
 * 투수 마선수 그림만 +17 을 안 한 날값을 쓴다 — `fielderSpriteOf` 참고.
 */
export function fielderFrameOf(action: number, tick: number): number {
  return fielderActionFrameOf(action, tick) + FIELDER_FRAME_OFFSET
}

/** 슬라이딩 프레임 표 0xd7818 / 0xd7814 — 어느 쪽이 진루/귀루인지는 미확정(R3 8-1) */
const RUNNER_SLIDE_ADVANCE = [2, 3, 0, 1] as const
const RUNNER_SLIDE_RETURN = [3, 0, 1, 2] as const

/**
 * 주자 동작 → 프레임 (R3 8-1, 주자 vt40 = 0xa0070 의 식 그대로).
 *
 * 주자 전용 그림판은 **없다(확정, S12 4-1)** — 적재 `0x4831e`(야수)·`0x48394`(주자)가 같은
 * `defender.pzx`·`defender.mpl` 을 그림 객체 둘(게임+0xf20 · +0xf24)에 넣는다.
 * 주자 그리기 `0x79d10` 은 vt40 값을 **그대로** 쓰므로 주자 칸은 `defender.pzx` 앞 17장(000~016)이고,
 * 야수 쪽만 +17 이 붙어 017~086 을 쓴다 — 두 구역은 겹치지 않는다.
 */
export function runnerFrameOf(action: number, tick: number, base: number, isAdvancing: boolean): number {
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
  /**
   * 진행기가 보는 "아직 날아가는 중(포구 · 송구 도착 전)" 표시. **카메라는 이것을 안 본다** — 0x3f060 은 공.vt18(멈춤)과
   * 홈런 칸만 본다(`cameraTargetOf`). 옛 화면이 "날지 않으면 타자주자" 로 읽던 칸이다.
   */
  readonly isFlying: boolean
  /**
   * 공.vt18 = 0xa27f0 — **멈췄는가**(지금 점의 속도 · 수직 속도 워드가 0, 목표가 있으면 목표점에 닿음 — I-controls 2b).
   * 야수가 쥔 공도 손에 붙어 안 움직여 멈춘 것으로 본다(관문 파울 갈래와 같은 읽기 — 유력). 안 주면 거짓.
   */
  readonly isStopped?: boolean
  /** 플레이 +0x12c — 야수가 쥐고 있다. 공 그리기 0x36dfc 가 공 · 그림자를 안 그린다(36e90). 안 주면 거짓 */
  readonly isHeld?: boolean
  /**
   * 담장을 넘어 사라졌다 — 공+0x68(재생 틱)이 낙구 aa0 + 2 와 담장선 aa4 + 6 을 **둘 다** 넘었고, 담장선이 있거나(aa4 > 0, 36e5c)
   * 홈런(+0x111, 36e32)이다. 0x36dfc 가 공 · 그림자를 안 그린다(36e9e). 안 주면 거짓
   */
  readonly isBeyondFence?: boolean
  /**
   * 공+0x68(재생 틱) ≤ 0 — 공을 막 깐 그림이다. 0x36dfc 머리 36e24 `공+0x68 > 0` 이 거짓이면 3738c 로 곧장 빠져 공 · 그림자(37268) ·
   * 두 번째 비거리 판(37388 0x36cd4)을 모두 안 그린다. 공+0x68 은 판 시작 vt18(b27ec — 종류 1 · 9 는 vt24(1) 0xb12d0 의 b12da,
   * 2 · 3 · 4 · 5 는 0xa276d) · 송구 0xb2e38(b307c vt24(0)) · 다시 쏘기 0xb3148(b3294 vt24(1))이 0 으로 두고, 그 그림 그리기 **뒤**
   * 0x3f378(3f3c6 — 안 쥐었고 G4 가 열렸을 때)만 0xa2594 로 +1 한다. 곧 공을 깐 그 그림만 0 이다. 안 주면 거짓
   */
  readonly isPlaybackStart?: boolean
}

/**
 * 0x36dfc 가 공(과 그림자)을 그리는가 — 36e24 재생 틱 > 0 이고, 36e86~36ea4: 홈런 뒤 · 담장 뒤가 아니고 쥔 공(+0x12c)이 아닐 때.
 * 두 번째 비거리 판(37388)은 첫 판(46cb6)과 같은 자리 · 같은 층(그리기 목록 앞)에 다시 칠할 뿐이라 따로 그리지 않는다.
 */
export function isBallDrawn(ball: DefenseBall): boolean {
  return ball.isPlaybackStart !== true && ball.isHeld !== true && ball.isBeyondFence !== true
}

/** 야수 한 명 */
export interface DefenseFielder {
  /** 수비 칸 0 투수 · 1 포수 · 2 1루 · 3 2루 · 4 3루 · 5 유격 · 6 우익 · 7 좌익 · 8 중견 (R3 2-2) */
  readonly slot: number
  readonly x: number
  readonly z: number
  /**
   * 높이(야수 +0x24). 그림 · 결과 판 자리는 (x, z − y) 다(0x43278 의 432f0~43318 — 0xb94b4(카메라, x, z − y)). 안 주면 0.
   * 원본에서도 늘 0 이다 — 이동체 틱 0xbf0dc 의 높이 식(bf204~bf226: y = +0x18 + v·t − g·t²/2, 0 아래 자름)에 수직 속도
   * v(+0x40)를 넣는 0xbec7c(속도, v)를 야수는 v = 0 으로만 부른다(a0dca 판 시작 · a155c 송구 뒤). 그래도 식대로 싣는다.
   */
  readonly y?: number
  /** FIELDER_ACTION */
  readonly action: number
  /** 그 동작이 걸린 뒤 흐른 갱신 횟수 (한 칸 = 1틱) */
  readonly actionTick: number
  /*
   * 좌우 반전 칸(`isFlipped`)은 **지웠다** — R3 7-3 이 "그리기 플래그 +0x11 = 좌우 반전 비트" 라고
   * 읽은 것이 틀렸다(S12 8절). `+0x11` 은 프레임에 더하는 17 이고, 야수 그리기 `0x79b48` 에는
   * 뒤집기를 거는 자리가 아예 없다 — 좌/우는 동작 3·4 가 **다른 프레임 묶음**으로 처리한다.
   */
  /** 마선수 번호 0~4, 마선수가 아니면 null (R3 7-1) */
  readonly aceIndex?: number | null
  /** 수비 팀 번호 0~14 — 그림 색을 갈아 끼우는 데 쓴다. 안 주면 구운 색 그대로다 (C-1) */
  readonly teamIndex?: number | null
  /** 야수 +0xec 선수 레코드 — 실책 그림 0x43278 이 [+0xec]+0x2e 를 올리는 대상(`entities/fielding/model/fielderRecords`). null = 0(안 올린다), 안 주면 모른다 */
  readonly record?: FielderRecordSeat | null

  // ── player_effect 부착 효과 칸 (0x43278 이 본다 — `playerEffectMarksOf`). 안 주면 아무것도 안 붙는다 ──

  /** +0xb0 — 가슴 높이 포구(7, 0xa1490) · 점프 캐치(0xe, 0xa14ac) 세터가 세우고 동작 끝(0xa143e)에 지운다 → 애니 4 */
  readonly catchFlag?: boolean
  /** +0xb4 동작 잠금 — 필살타법 타구에 맞은 야수 15(0xa1e60). > 0 이면 애니 4 + 머리 위 애니 15 */
  readonly lockTicks?: number
  /** +0xb8 — 펌블(b4280)이 6 으로 세우고 야수 틱이 잠금 없을 때 −1. > 0 이면 "!"(애니 13) */
  readonly fumbleTicks?: number
  /** +0xc0 — 악송구(a1908) · 원바운드(a17fc) · 아무도 못 받는 송구(예보 b188e, 던진 야수)가 4. > 0 이면 "!" */
  readonly throwErrorTicks?: number
  /** 달리기 먼지 자국 (vt6c~vt84) — 이번 그림에 찍을 점(바닥 x, z − y)과 player_effect 프레임. 없으면 null */
  readonly dustTrail?: { readonly x: number; readonly z: number; readonly frame: number } | null
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
  /** 공격 팀 번호 0~14 — 주자도 `defender.pzx` 를 쓰므로 같은 팔레트 표를 탄다. 안 주면 구운 색이다 */
  readonly teamIndex?: number | null
  /** +0x96 처리 끝 — 아웃이 됐거나 홈을 밟았다. 작은 지도(0x395f4)가 이 주자를 안 찍는다. 안 주면 아직이다 */
  readonly isFinished?: boolean
  /**
   * 슬라이딩 먼지 방향 — 주자 +0xb8(슬라이딩 중, 0x9ff39)이 서 있을 때 0x9ff40 이 주는 1~4, 아니면 0.
   * 그리기 0x43b18 이 1 → player_effect 애니 5 · 2 → 6 · 3 → 8 · 4 → 7 을 주자 자리에 붙인다.
   */
  readonly slideDirection?: number
  /**
   * 주자 +0x9c ≠ −1 — 마선수 주자. 그림은 이 주자의 것이 아니라 장면에 **하나 실린** 그림(`runnerAceSprite`)이다(0x79d10).
   */
  readonly isAce?: boolean
}

/**
 * 수비수 그림이 쓸 팔레트 번호 — `defender.mpl` 은 **피부가 없어 팀 번호가 곧 벌 번호**다
 * (`palette.json` 의 `select: "팀"`, 15벌 · 적재 0x48658). 몸통처럼 `피부 × 15 + 팀` 을
 * 쓰는 것은 batter/pitcher 뿐이라 여기서는 `outfitPaletteIndex` 를 쓰지 않는다.
 * 팀 번호가 없거나 범위를 벗어나면 null — 구운 벌(2번)을 그대로 쓴다.
 */
export function defenderPaletteIndexOf(teamIndex: number | null | undefined): number | null {
  if (teamIndex == null || !Number.isInteger(teamIndex)) return null
  if (teamIndex < 0 || teamIndex >= TEAM_COUNT) return null
  return teamIndex
}

/**
 * 필살 포구 번쩍임 (R2 2절 — `features/defense-play/model/defenseScene`).
 * A(0x4403c)는 줌 펀치만 하고 **그리지 않으므로** 여기 종류에 없다.
 */
export interface DefenseFlash {
  /** 'b' = 0x441c4 (플레이 +0x1f7 필살 점프 캐치) · 'c' = 0x44398 (플레이 +0x1f8 필살 슬라이딩 캐치) */
  readonly kind: 'b' | 'c'
  /** deadly_effect 애니 0 의 칸 0~3 */
  readonly step: number
  /** +0x1996 = 공 가진 야수 +0xa8 동작 0xf 아래 · 0x10 위 · 0x11 왼 · 0x12 오른 — kind 'c' 에서만 쓴다 */
  readonly direction?: number
  /**
   * 그리는 점 — 공 가진 야수(0xb0c91 = 플레이+0x130)의 +0x20 월드 (x, z − y). 없으면 공 화면점에 그린다(옛 스냅샷).
   */
  readonly x?: number
  readonly z?: number
}

/** 번쩍임을 기준점에서 얼마나 옮겨 그리나 (R2 2절 표) */
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

/**
 * 레이저 송구 **반짝임**(경기+0x19ad)을 칠하는 색 — `0x1400748` = RGB(255,0,0) (I-controls 1c 끝).
 * `deadly_effect` 번쩍임(B·C)과는 **다른 표시**다. 그쪽은 공 자리에 그림을 겹치고,
 * 이쪽은 **공을 쥔 야수의 몸**을 빨갛게 그린다.
 */
export const LASER_SHINE_COLOR = { r: 255, g: 0, b: 0 } as const
/**
 * 그 야수를 그릴 때 쓰는 그리기 효과 번호 — `0x79b48` 에 넘기는 **12** (I-controls 1c 끝 0x43406~0x4342c).
 * 0xbb91d 의 종류가 아니라 프레임 그리기 효과 번호다(0x79b48 → 0xbe8d5 → 0xbe810). 효과 0xc 의 픽셀 함수
 * 0x98351 · 0x9af71 은 그림 픽셀과 인자 색을 565 채널마다 반반 섞는다 — 식과 그리기는 `lib/laserShine`.
 */
export const LASER_SHINE_EFFECT_KIND = 12

/**
 * 공 가진 야수 고리 (0x43cb0) — game_ui 애니 번호. 0x43cf4~0x43d28:
 * `state[0x31 + state[9]] == 0`(공격이 사람)이면 3, 아니면 1, 그리고 경기+0x19ad(레이저 반짝임)면 2 로 덮는다.
 */
export const HOLDER_MARK_ANIM = { cpuOffense: 1, shining: 2, humanOffense: 3 } as const

export interface HolderMark {
  /** 공 가진 야수의 수비 칸 (플레이+0x130) */
  readonly slot: number
  /** game_ui 애니 1(하늘) · 2(노랑, 반짝임) · 3(빨강) */
  readonly anim: number
}

/**
 * 이름 판에 적을 것 — 0x43e3e: 야수 +0x88(수비 칸) == 0 이면 **지금 마운드 투수**(0xae83d(팀[state[0xa]]))의
 * 보직(0xb6ded → 0xb6705 = 레코드 +0xb & 3 — 대결 판의 0xb6704 와 **같은 함수**다, 썽크일 뿐)으로 0x545e8,
 * 아니면 야수 +0xec 선수 레코드의 `+0x1c & 0xf` 로 0x54590 을 부른다. 이름은 같은 레코드의 0xb62c1.
 */
export interface HolderPlate {
  readonly name: string
  /** 칸 0(투수)일 때 — 레코드 +0xb & 3 (0 선발 · 1 중계 · 2 구원) */
  readonly pitcherRole?: number
  /** 칸 1~8 일 때 — 레코드 +0x1c & 0xf */
  readonly positionCode?: number
}

/**
 * 공 그리기 0x36dfc 의 파티클 두 갈래 중 **진행기 쪽 조건** (직접 뜬 것 — 화면 쪽 조건 · 좌표는 `lib/ballParticles`):
 * ```
 * 36e24  공+0x68(공 틱) > 0 이 아니면 끝                    ; 그 앞 36e0a · 36e12 는 공 그림판이 있나
 * 36e86  쥔 공 · 담장 뒤로 사라진 공이면 그림 없음(→ 3736c)
 * 36f76  경기+0x199a && state[0x26](판 종류) ∈ {1, 8} → 0xbbc85(…, 4, 10)            ; 큰 타구
 * 36fe0  … 높이 투영 == 0 이면: 공+0x6c − 1 > 공+0x68 && !0x357e0 && +0xfd4 ∉ {9,10,11}
 *          && 0xa25fd(공 틱 + 1 점)의 높이 투영 ≠ 0 → 공+0xab4 = 1 · 0xbbc85(…, 0, 8)   ; 튐
 * ```
 */
export interface BallParticleFacts {
  /** 큰 타구 갈래 0x36f76~0x36f92 — 경기+0x199a(0x392ac) && 판 종류 ∈ {1, 8} */
  readonly bigHit: boolean
  /**
   * 튐 갈래의 화면 밖 조건(궤적 안 끝남 · 0x357e0 거짓 · 결과 코드 ∉ {9,10,11})이 다 맞으면 **다음 점(공 틱 + 1)의 높이**(월드 y),
   * 아니면 null. 높이 투영(0xb94b5 의 둘째 값)은 화면 쪽이 한다.
   */
  readonly bounceNextHeight: number | null
}

/** 화면 한 틱치 스냅샷 */
export interface DefenseViewState {
  readonly ball: DefenseBall
  readonly fielders: readonly DefenseFielder[]
  readonly runners: readonly DefenseRunner[]
  /** 번쩍임이 돌고 있으면 그 상태, 아니면 null */
  readonly flash?: DefenseFlash | null
  /**
   * 레이저 송구 반짝임(경기+0x19ad)을 띄울 **야수 칸**. 아무도 안 반짝이면 null 이다.
   *
   * 원본 0x43278 은 야수 9명을 도는 그 자리(0x43406~0x4342c)에서 세 조건을 모두 볼 때만
   * 이 야수를 효과 12 + 빨강으로 그린다 (I-controls 1c 끝 · R2 2절):
   *   1. 이 야수가 **공을 쥔 야수**(플레이+0x130) 이고,
   *   2. 경기+0x19ad(반짝임)가 켜져 있고,
   *   3. deadly_effect A(+0x1990)가 **안 돌고 있다**.
   * 셋을 보는 쪽은 진행기다 — 화면은 "몇 번 칸" 한 칸만 받아서 그린다.
   *
   * ⚠️ **번쩍임(`flash`)과 헷갈리지 마라.** 저쪽은 `deadly_effect.pzx` 를 공 자리에 겹치는
   * 필살 포구 연출이고, 이쪽은 야수 몸 색이다. 원본에서도 함수가 다르다(0x441c4/0x44398 대 0x43278).
   */
  readonly laserShiningSlot?: number | null
  /**
   * 레이저 연출 단계 1 의 **줌 펀치**(0xbb84c → 0xbb43c) — 이 그림을 그린 뒤 화면을 늘리는 배율(110 · 110 · 105 · 100%)과 중심(바탕 그림 좌표).
   * 늘리는 것은 결과 판까지다(`features/defense-play/model/laserPresentation`). 없으면 그대로.
   */
  readonly zoom?: { readonly percent: number; readonly centerX: number; readonly centerY: number } | null
  /**
   * 결과 판 0x46844 의 **큰 OUT** — game_judge 애니 2 의 이 그림 프레임과, 자리를 정하는 공 가진 야수 칸(−1 이면 화면 가운데).
   * 야수 그림 자리에서 y − 60 에 그린다.
   */
  readonly bigOut?: { readonly frame: number; readonly holderSlot: number } | null
  /**
   * 결과 판 0x46844 의 **보통 판정 글자** — 0x393b4(x, y − 30, v, 1, 0) 가 그리기 목록에 넣고 0x46844 꼬리가 그린 game_judge
   * 애니 칸(SAFE · OUT · FOUL · GROUND RULE DOUBLE …)과 dx · dy, 자리를 정하는 공 가진 야수 칸(−1 이면 화면 가운데).
   */
  readonly judgeText?: { readonly frame: number; readonly dx: number; readonly dy: number; readonly holderSlot: number } | null
  /**
   * **공 가진 야수 고리** — 0x43cb0(그리기 0x46c88 의 0x46cbc, 비거리 판 뒤 · 야수 목록 앞에 곧바로 그린다).
   * 경기+0x19ac(쥐기 0xb2710 의 메시지 0x15 가 1 로 세우고 0x17 진입 0x467de 가 0 으로 내린다)가 서 있고
   * 공 가진 야수(플레이+0x130, 0xb0c91)가 있을 때만 뜬다. 고르는 쪽은 진행기다(`holderMarkOf`).
   */
  readonly holderMark?: HolderMark | null
  /**
   * 고리와 같이 그리는 **오른쪽 아래 이름 판** — 공 가진 야수의 선수 이름과 수비 칸 표시(0x43e3e~0x43fc2).
   * 고리가 없으면 판도 없다. 판을 그릴지(칸 아이콘 > 0)는 화면 쪽이 표(0x54590 · 0x545e8)로 정한다.
   */
  readonly holderPlate?: HolderPlate | null
  /**
   * 마선수 주자를 그릴 그림판 — 타석 교대 0x483a0 이 실은 타자 마선수 번호 0~4(`ACE_BATTER_DEFENDER_FRAMES`). 없으면 null.
   * `isAce` 인 주자는 모두 이 그림 하나로 그린다(원본 그대로) · 팔레트 없음 · 프레임은 vt40 날값 그대로.
   */
  readonly runnerAceSprite?: number | null
  /**
   * **레이저 잔상** (공 그리기 0x36dfc 의 0x37076~0x3724a) — 장면 +0x1991 이 서 있으면 지금 공 궤적의 t = 0 점(0xa25b1(공, 0)).
   * 화면이 그 점에서 공까지 공 그림을 반투명으로 늘어놓는다(`laserTrailMarksOf`). 없으면 null
   */
  readonly laserTrailFrom?: { readonly x: number; readonly z: number; readonly height: number } | null
  /**
   * 공 그리기 0x36dfc 가 **파티클을 쏠지** 보는 것 중 화면(카메라) 밖의 조건 — 진행기가 정한다(`lib/ballParticles`).
   * 없으면 아무것도 안 쏜다(재생 · 주자 판).
   */
  readonly ballParticles?: BallParticleFacts | null
  /**
   * 경기 +0xfd4 — **주자 판**(밀어내기 · 견제 · 도루 · 폭투 · 포일)이 열린 때 남아 있던 스윙 판정 결과 코드(`features/defense-play/model/sceneResultCode`).
   * 득점 함성 · 점수판의 홈런성(0x357e0, 24~26)이 본다. null 이면 원본에서 정해지지 않은 값(헛스윙) · 없으면(undefined) 타구 판이다
   */
  readonly sceneResultCode?: number | null
  /**
   * 카메라가 따로 볼 곳. 원본은 상태 0x18(경기 끝 직전)에 투수판 (20000, 24500) 의
   * (x, z − 2000) 을 1%/틱 으로 본다 (R3 1-3). 없으면 아래 규칙대로 공/타자주자를 본다.
   */
  readonly cameraTarget?: WorldPoint | null
  /**
   * 이 그림에서 카메라가 **안 움직인다** — 0x3f060 이 대상 · 따라가기(3f1c0 vt20 · vt28)까지 가지 않는 그림이다(직접 뜸):
   * ```
   * 3f0a4  장면 +0x1993(경기 멈춤 — 레이저 발사 0x400bc 다음 그림) → 돌아감
   * 3f0b8  판 진행 관문 0xb0d28(G1) 이 닫혔으면 r6 = 0 → 3f0ea 에서 돌아감(상태 0x17 은 0x33c98 참)
   * ```
   * 진행기는 멈춘 그림(머리에서 +0x1993)에 싣고, 재생 화면은 판이 닫힌 뒤(마지막 그림 다음 갱신부터) 싣는다. 안 주면 움직인다.
   */
  readonly cameraFrozen?: boolean
  /**
   * **판이 슬롯 2 머리 G2(52502)에서만 닫힌 그림** — 공용 갱신 0x3f060 의 G1(3f0b8)은 열려 목록 틱(야수 · 주자 한 걸음)과 카메라 따라가기는
   * 돌고, 슬롯 2 는 529f0(+0x1094 = 1)으로 빠진 그림이다(`playGate.passPlayGateBetweenTicks` 의 `listTickOpen`). 진행기의 마지막 스냅샷이며,
   * 재생 화면은 이 그림을 판이 닫힌 첫 갱신으로 세고(+0x1094) 카메라를 이 그림까지 움직인 뒤 그 다음부터 세운다. 안 주면 거짓.
   */
  readonly closingListFrame?: boolean
  /**
   * **이 판 틱에 진행기가 낸 소리**(차례대로) — 주자 판(도루 · 폭투 · 견제)의 판정 콜(결과 메시지 0xbba → 0x51a56: 9 → 17 · 13 → 62/20)과
   * 슬라이딩 10. 재생 화면 · 실시간 주자 판 화면 모두 그 틱을 그릴 때 낸다(`DefensePlayback` 의 `playRunnerTickSounds`). 없으면 소리 없음
   */
  readonly tickSoundIds?: readonly number[]
  /**
   * **이 판 틱의 득점 0xaa0a8(슬롯 2 525fc)이 `tickSoundIds` 의 몇 번째 자리에 끼는가** — 그 앞(사람 슬라이딩 키 · 플레이 틱 525e8 의
   * 판정 콜)을 낸 뒤 득점 함성(메시지 0x13 → 0x51fb8)을 내고, 그 뒤(자동 슬라이딩 10, 52670)를 낸다. 소리 통로가 하나라 차례가 곧 들리는
   * 소리다. 없으면 `tickSoundIds` 를 다 낸 뒤 함성이다
   */
  readonly tickRunInSoundAt?: number
  /** 플레이 +0x111 — 사건 코드 8(홈런). 안 주면 거짓 */
  readonly homeRunFlag?: boolean
  /** 플레이 +0x129 — 사건 코드 12(폴 홈런). 안 주면 거짓 */
  readonly poleHomeRunFlag?: boolean
}

/**
 * 카메라가 볼 점 (0x3f060 — 3f0f0~3f1be, 직접 뜸).
 * ```
 * 3f0f0  P = [장면+0x200] ; P+0x111(홈런) || P+0x129(폴 홈런) 이 아니면 → 3f194
 * 3f106  [장면+0x204](공).vt18()(멈춤) 거짓이면 → 3f194
 * 3f11c  주자 = 0xa9564([장면+0x20c], 0)(목록 0번 = 타자주자) ; 대상 = (주자+0x20 x, 주자+0x28 z)   ; 높이를 안 뺀다
 * 3f194  공 점 0xa25d4(공) ; 대상 = (x, z − y)
 * 3f1c0  카메라 vt20(대상) · vt28(따라가기)
 * ```
 * 곧 **홈런 · 폴 홈런 판에서 공이 멈췄을 때만** 타자주자를 보고, 그 밖은 늘 공 (x, z − 높이) 다 —
 * 보통 타구는 공이 멈춰도(포구 · 송구가 끝나도) 공을 본다.
 */
export function cameraTargetOf(state: DefenseViewState): WorldPoint {
  if (state.cameraTarget != null) return state.cameraTarget
  if ((state.homeRunFlag === true || state.poleHomeRunFlag === true) && state.ball.isStopped === true) {
    const batterRunner = state.runners.find((runner) => runner.index === 0)
    if (batterRunner !== undefined) return { x: batterRunner.x, z: batterRunner.z }
  }
  return { x: state.ball.x, z: state.ball.z - state.ball.height }
}

/**
 * 주자 한 명을 그릴 그림판 (0x79d10) — 마선수 주자(+0x9c ≠ −1)는 실린 마선수 그림(팔레트 없음), 아니면 `defender.pzx`.
 * 마선수 주자인데 실린 그림이 없으면(웹에서만 나는 경우) 보통 그림으로 둔다.
 */
export function runnerSpriteFolderOf(
  runner: DefenseRunner,
  loadedAce: number | null | undefined,
): {
  readonly folder: string
  readonly isAce: boolean
} {
  if (runner.isAce === true && loadedAce != null && loadedAce >= 0 && loadedAce <= 4) {
    return { folder: ACE_BATTER_DEFENDER_FRAMES[loadedAce], isAce: true }
  }
  return { folder: DEFENDER_FRAMES, isAce: false }
}

/** 야수 한 명을 그릴 그림판과 프레임 (0x79b48 의 a 갈래 + 프레임 +17) */
export interface FielderSprite {
  readonly folder: string
  readonly frame: number
}

/**
 * 야수가 쓸 그림판과 프레임 (R3 7-3 의 a 갈래 · S12 8-2).
 *
 * | 그림 | 프레임 |
 * |---|---|
 * | 보통 `defender` · 타자 마선수 (125장) | 날값 **+17** (야수 칸 017~086) |
 * | 투수 마선수 (38장, `a != 0`) | 날값 그대로 (0~37) |
 */
export function fielderSpriteOf(fielder: DefenseFielder): FielderSprite {
  const raw = fielderActionFrameOf(fielder.action, fielder.actionTick)
  const ace = fielder.aceIndex
  if (ace == null || ace < 0 || ace > 4) {
    return { folder: DEFENDER_FRAMES, frame: raw + FIELDER_FRAME_OFFSET }
  }
  if (fielder.slot === 0) return { folder: ACE_PITCHER_DEFENDER_FRAMES[ace], frame: raw }
  return { folder: ACE_BATTER_DEFENDER_FRAMES[ace], frame: raw + FIELDER_FRAME_OFFSET }
}

/**
 * 공 그림 프레임 — 0x17 공 그리기 0x36dfc(36efa~36f56, 직접 뜸).
 *
 * ball.pzx 는 **공 종류 3 × 크기 11칸**이다 (그림 = 크기 + 11 × 종류):
 *   - 000~010 보통 야구공 (2×2 → 12×12)
 *   - 011~022 **불꽃 공** — 마구 1 "파이어 볼" 쪽 그림
 *   - 023~033 **날개 달린 공** — 또 다른 마구 그림 (가로로 길다, 최대 33×11)
 *
 * ```
 * 36efa  크기 = 0xca7b4(공 높이 y, 2000) + 4 ; 크기 > 10 이면 10           ; 아래 자르기는 없다
 * 36f3a  그림 = 크기 + 11 × [경기+0x1080]                                     ; 0xbe8d4 로 그리기 목록에
 * ```
 * 경기+0x1080(공 그림 종류)은 0x17 진입 0x46418 이 끝(467fe)에서 **0 으로 둔다** — 그 뒤 0x17 동안 쓰는 곳이 없다
 * (쓰는 곳 전수 R2 14-1: 0x3d78e · 0x3d988 · 0x467fe 는 0, 마구 갈래 0x4725c · 0x4736e · 0x3b55e 는 타석 그리기 0x4d64c ·
 * 0x3b2f4 안). 그래서 수비 화면의 공은 늘 보통 공(종류 0)이고, 땅에 있어도 004 부터다(000~003 은 안 쓴다).
 */
export const BALL_HEIGHT_PER_FRAME = 2000
/** 땅(높이 0)의 크기 칸 (36f06 `adds r0, #4`) */
export const BALL_GROUND_FRAME = 4
const BALL_MAX_FRAME = 10
export function ballFrameOf(height: number): number {
  return Math.min(Math.trunc(height / BALL_HEIGHT_PER_FRAME) + BALL_GROUND_FRAME, BALL_MAX_FRAME)
}

export type { BallShadowPiece } from '@/shared/lib/ballShadow/ballShadowPieces'
export { BALL_SHADOW_RIM_COLOR } from '@/shared/lib/ballShadow/ballShadowPieces'
/** 공중 공의 그림자 크기 (36fbc) · 땅 공(화면 높이 0)의 크기 (36fda) */
export const BALL_SHADOW_SIZE_AIR = 3
export const BALL_SHADOW_SIZE_GROUND = 5

/**
 * **공 그림자** — 0x36dfc 의 37268 이 부르는 0x356f8(x, y, s) (직접 뜸). 공 땅점 (x, z)의 화면 자리에 그린다.
 * ```
 * 36fba  s = 3 ; 화면 높이 h(0xb94b4(카메라, 0, y)) < 0 이면 그림자 없음(3736c)
 * 36fc6  땅점 화면 y(ff0 + z 투영) < 1 이면 그림자 없음
 * 36fd4  h == 0(땅)이면 s = 5
 * 37268  0x356f8(땅점 화면 x, 땅점 화면 y, s)
 * 356f8  x0 = x − (s >> 1) · y0 = y − (s >> 1) ; 색 0(검정) ; 기기 사각 칠 0x14006e8(x0, y0, s + 1, s + 1)
 * 35734  s > 2 면 색 (100, 100, 100) ; 기기 선 0x14006c8 넷(두 끝 다 칠한다):
 *          (x0 − 1, y0 + 1)–(x0 − 1, y0 + s − 1) · (x0 + s + 1, y0 + 1)–(x0 + s + 1, y0 + s − 1)
 *          (x0 + 1, y0 − 1)–(x0 + s − 1, y0 − 1) · (x0 + 1, y0 + s + 1)–(x0 + s − 1, y0 + s + 1)
 * ```
 * 그리기 목록(0xbe6a0)이 아니라 **곧바로 화면에** 칠하므로 목록으로 그리는 야수 · 주자 · 공보다 아래다.
 * 공을 안 그리는 그림(`isBallDrawn` 거짓)에는 그림자도 없다(36ef8 → 3736c).
 */
export function ballShadowOf(ground: { readonly x: number; readonly y: number }, screenHeight: number): readonly BallShadowPiece[] {
  if (screenHeight < 0 || ground.y < 1) return []
  const size = screenHeight === 0 ? BALL_SHADOW_SIZE_GROUND : BALL_SHADOW_SIZE_AIR
  return ballShadowPiecesAt(ground.x, ground.y, size)
}
