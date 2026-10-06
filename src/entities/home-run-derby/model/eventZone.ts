import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * 이벤트 존 (H-2 · P7 H1).
 *
 * 원본(0x36dfc, 공 그리기 — 조건 읽기 0x372ca): 모드 7 이고 · 아직 존이 안 놓였고 · 공이 비행 상태(0x357e0 의 24~26)이고 ·
 * **공의 화면 y 가 화면 높이/3 보다 위**이고 · 플레이 객체 +0x127 이 서 있으면 그 자리에 존을 놓고 동시에 `+0x3f = 1` 을
 * 세운다. 0x41098 이 그 자리에 `stadium/event_zone.pzx` 를 **8프레임 주기로 깜빡이며** 그리고, 공 하나가 끝날 때
 * +0x3f 가 서 있으면 보너스 G += 200 이다.
 *
 * +0x127 (확정, P7 H1): 타구 시작 0x51408 이 0 으로 비우고(0x51470), 덱에서 꺼낸 패턴이 `0xb07c8(덱, 결과, 패턴)` == 1
 * — **패턴 플래그 & 2** — 이면 1 로 세운다(0x514e6). 곧 존은 **플래그 비트1 이 선 패턴**(주로 결과 18~20 의 큰 뜬공)에서만 생긴다.
 *
 * ⚠️ **원본 그대로**: 존을 "놓는" 코드가 곧바로 "적중" 칸까지 세운다 — 곧 조건만 맞으면
 * 공이 실제로 존에 닿았는지 따로 보지 않고 200 G 가 붙는다. 버그로 보이지만 고치지 않는다
 * (`docs/re/DECISIONS.md` — 원본 버그는 그대로 옮긴다).
 *
 * ⚠️ 미해결: "공 화면 y < 화면 높이/3" 고리. 이식판 홈런더비는 타구 비행을 화면에 그리지 않아(타석 화면만 쓴다)
 * 공의 화면 y 가 없다 — 이 고리는 **보지 않는다**(늘 참으로 둔다). 예전에 이 자리를 메우던 "궤적 최고 높이 ≥ 5000" 은
 * 원본에 없는 지어낸 값이라 걷었다. 비행 화면을 옮기면 그 카메라로 이 고리를 더해야 한다.
 */

/** 존이 깜빡이는 주기 — 8프레임 (0x41098) */
export const EVENT_ZONE_BLINK_PERIOD = 8

/** 존 그림 — `stadium/event_zone.pzx` (this+0x1070, 0x486e0 로드) */
export const EVENT_ZONE_FRAMES = './sprites/event_zone/frames'

/** 존이 뜨는 화면 높이 비율 — "공 화면 y < 화면 높이/3" (0x36dfc). 위 미해결대로 아직 쓰는 곳이 없다 */
export const EVENT_ZONE_SCREEN_TOP_RATIO = 1 / 3

/** 플레이 +0x127 을 세우는 패턴 플래그 비트 — 0xb07c8 = `플래그 & 2` */
export const BIG_FLY_PATTERN_FLAG = 2

/** 이 패턴이 플레이 +0x127 을 세우는가 (0x514e6 · 0xb07c8) */
export function isBigFlyPattern(pattern: BattedBallPattern): boolean {
  return (pattern[3] & BIG_FLY_PATTERN_FLAG) !== 0
}

export interface EventZoneCondition {
  /** 이번 타구가 뽑은 패턴 (맞은 공이 아니면 null — 비행 상태 24~26 에 들지 않는다) */
  readonly pattern: BattedBallPattern | null
  /** 이미 이번 공에서 존이 놓였는가 (0x3de10 이 공마다 −1 로 비운다) */
  readonly isZonePlaced?: boolean
}

/** 이번 공에 이벤트 존이 뜨는가(= 적중하는가). 위 ⚠️ 대로 둘이 같은 판정이다 */
export function isEventZoneHit({ pattern, isZonePlaced = false }: EventZoneCondition): boolean {
  if (isZonePlaced) return false
  if (pattern === null) return false
  return isBigFlyPattern(pattern)
}

/**
 * 8프레임 주기 깜빡임 — 반은 보이고 반은 안 보인다.
 * 듀티(4/8)는 원본 코드에서 못 읽어 **추정**이다. 주기 8 은 확정이다.
 */
export function isEventZoneVisibleAt(tick: number): boolean {
  return ((tick % EVENT_ZONE_BLINK_PERIOD) + EVENT_ZONE_BLINK_PERIOD) % EVENT_ZONE_BLINK_PERIOD <
    EVENT_ZONE_BLINK_PERIOD / 2
}
