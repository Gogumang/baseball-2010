/** 야수 그림 — 그림 폴더 · 동작 → 프레임 (0x3d9xx 동작 표) */
import { FIELDER_ACTION } from '@/shared/config/original/defenseAnimations'
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
export const RUN_STEPS = [0, 1, 0, 2] as const

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
  const ranged = rangedActionFrameOf(action, step, safeTick)
  if (ranged !== null) return ranged
  return singleActionFrameOf(action, step, safeTick)
}

const isBetween = (action: number, first: number, last: number) => action >= first && action <= last

/** 방향 넷이 이어진 동작 — 달리기(네 칸 되풀이) · 다이빙(한 칸) · 슬라이딩 캐치(다섯 칸에서 멈춤). 아니면 null */
function rangedActionFrameOf(action: number, step: number, safeTick: number): number | null {
  if (isBetween(action, FIELDER_ACTION.runDown, FIELDER_ACTION.runRight)) return FIELDER_RUN_BASE[action - 1] + RUN_STEPS[step]
  if (isBetween(action, FIELDER_ACTION.diveDown, FIELDER_ACTION.diveRight)) return FIELDER_DIVE[action - FIELDER_ACTION.diveDown]
  if (isBetween(action, FIELDER_ACTION.slideCatchDown, FIELDER_ACTION.slideCatchRight)) {
    return FIELDER_SLIDE_CATCH[action - FIELDER_ACTION.slideCatchDown] + Math.min(safeTick, 4)
  }
  return null
}

/** 하나짜리 동작 — 송구(되풀이) · 포구 둘 · 멈춰 포구 · 펌블 · 점프(마지막 칸에서 멈춤) */
function singleActionFrameOf(action: number, step: number, safeTick: number): number {
  if (action === FIELDER_ACTION.throw) return FIELDER_THROW[step]
  if (action === FIELDER_ACTION.catchLow) return FIELDER_CATCH_LOW[Math.min(safeTick, FIELDER_CATCH_LOW.length - 1)]
  if (action === FIELDER_ACTION.catchChest) return FIELDER_CATCH_CHEST[Math.min(safeTick, FIELDER_CATCH_CHEST.length - 1)]
  if (action === FIELDER_ACTION.catchStill) return 18
  if (action === FIELDER_ACTION.fumble) return FUMBLE_FIRST + Math.min(safeTick, FUMBLE_COUNT - 1)
  if (action === FIELDER_ACTION.jumpCatch) return JUMP_FIRST + Math.min(safeTick, JUMP_COUNT - 1)
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
