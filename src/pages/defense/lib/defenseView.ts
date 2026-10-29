/**
 * 수비 화면이 받는 순수 데이터와 그림 고르기 (R3-field-view 2·7절 · R2-game-effects 2절).
 *
 * 스냅샷 모양(`DefenseViewState`)은 `entities/fielding/model/defenseView`, 동작 번호 표는 `shared/config/original/defenseAnimations` 에 있다.
 * 화면은 진행기가 낸 **한 틱치 스냅샷**만 받아 그림을 고른다.
 */

import type { DefenseFielder, DefenseRunner } from '@/entities/fielding/model/defenseView/defenseFigures'
import type { DefenseBall, DefenseFlash, DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { WorldPoint } from '@/pages/defense/lib/defenseCamera'
import { FIELDER_ACTION, RUNNER_ACTION } from '@/shared/config/original/defenseAnimations'
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

/**
 * 0x36dfc 가 공(과 그림자)을 그리는가 — 36e24 재생 틱 > 0 이고, 36e86~36ea4: 홈런 뒤 · 담장 뒤가 아니고 쥔 공(+0x12c)이 아닐 때.
 * 두 번째 비거리 판(37388)은 첫 판(46cb6)과 같은 자리 · 같은 층(그리기 목록 앞)에 다시 칠할 뿐이라 따로 그리지 않는다.
 */
export function isBallDrawn(ball: DefenseBall): boolean {
  return ball.isPlaybackStart !== true && ball.isHeld !== true && ball.isBeyondFence !== true
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

// 동작 번호 표 · 스냅샷 모양은 아래 층으로 내렸다(r379) — `widgets/field-walk` 가 아직 이 파일에서 읽어 다시 내보낸다
export { FIELDER_ACTION } from '@/shared/config/original/defenseAnimations'
export type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
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
