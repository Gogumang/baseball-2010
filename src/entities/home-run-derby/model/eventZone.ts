import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'

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

/**
 * **존 보상 "200G" 애니** — `ui/trainning.pzx`(장면 +0x19e8) 애니 3 = 프레임 15~24(지연 2 × 9 · 7, trainning/frames/animations.json [3]).
 * 21~23 은 0x67 파트(빛 줄이 글자를 훑는 더하기 겹 b = 200)가 든 프레임이다. 직접 뜸(2026-10-24):
 * ```
 * 372f8  존을 놓는 그 자리(0x36dfc, 위 머리말의 +0x3f = 1 바로 뒤):
 *        애니 = [[[장면+0x19e8]+0x10]+8]+0xc (애니 표 칸 3)
 * 3730e  0x93d31(애니, 1)   ; 멈춤 · 첫 칸 · 끝 비트 지움
 * 37328  0x93cfd(애니, 1)   ; 재생 — 인자 1 이 +2 비트 0x10(반복)을 세운다(93d18~93d1e)
 * 41098  모드 7(장면+0x1104) 이고 존 x(+0x17cc) > 0 · 존 y(+0x17d0) > 0 이면 event_zone 다음에
 * 4111c  x = (s16 +0xfcc) + 0x5a < 0 ? 0x32 : 0x8c          ; +0xfcc = 판정 0xab214 의 수평각(웹 패턴 각의 부호 뒤집음)
 * 4115c  0x93c45(애니, x, 0x46, 0, 0, 0)   ; 부른 쪽 효과 0 → 0x67 파트는 화면 더하기(0xc9f98 ca198)
 * 4116e  0x93d91(애니)                      ; 그린 뒤 한 칸 — 반복이라 끝 칸(24) 뒤 첫 칸(15)으로 돈다(93e16~93e30)
 * ```
 * 0x41098 은 필드 그리기 0x411e0(구장 0x78931 다음)이 부르고, 0x411e0 은 판(0x17) 그리기 0x46c88 → 0x43228 과 그리기 표 0x52c50 →
 * 0x41230 이 부른다. 존(+0x17cc/+0x17d0)은 다음 공 0x3de10 이 −1 로 비울 때까지 남는다.
 */
export const EVENT_ZONE_REWARD = {
  folder: './sprites/trainning/frames',
  /** 애니 표 칸 3 */
  animation: 3,
  /** 0x41158 `movs r2, #0x46` */
  y: 0x46,
} as const

/** 애니 3 의 칸 (animations.json [3] — 시험이 맞춰 본다). 프레임 15 는 빈 그림이다(frames/015.png 없음) */
export const EVENT_ZONE_REWARD_ENTRIES: readonly { readonly frame: number; readonly delay: number }[] = [
  { frame: 15, delay: 2 },
  { frame: 16, delay: 2 },
  { frame: 17, delay: 2 },
  { frame: 18, delay: 2 },
  { frame: 19, delay: 2 },
  { frame: 20, delay: 2 },
  { frame: 21, delay: 2 },
  { frame: 22, delay: 2 },
  { frame: 23, delay: 2 },
  { frame: 24, delay: 7 },
]

/**
 * "200G" 의 x — 0x4111c: 원본 각 `+0xfcc`(= −웹 패턴 각, `hitParticles` 와 같은 뒤집음) + 0x5a 가 음수면 0x32(왼쪽), 아니면 0x8c(오른쪽).
 * 곧 웹 패턴 각 > 90(3루 쪽)이면 왼쪽 · ≤ 90(1루 쪽)이면 오른쪽이다.
 */
export function eventZoneRewardXOf(patternAngle: number): number {
  return -patternAngle + 0x5a < 0 ? 0x32 : 0x8c
}

/**
 * 존을 놓은 뒤 `updates` 번째 그림의 프레임 — 첫 그림이 첫 칸(그린 뒤 0x93d91 로 한 칸), 반복이라 지연 합 25 마다 돈다
 */
export function eventZoneRewardFrameAt(updates: number): number {
  return animationStepAt(EVENT_ZONE_REWARD_ENTRIES, updates)?.frame ?? EVENT_ZONE_REWARD_ENTRIES[0]!.frame
}
