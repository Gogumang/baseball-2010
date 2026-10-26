import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * 이벤트 존 (H-2 · P7 H1 · U-93).
 *
 * 원본(0x36dfc 3726c~3732a — 필드 화면 공 그리기, 그림자 0x356f8 바로 뒤): 공을 그리는 그림에서 높이 투영 ≤ 0x36 이고 · 모드 7 이고 ·
 * 아직 존이 안 놓였고 · **땅점 화면 y(+0xff0 + z 투영) < 화면 높이/3** 이고 · **결과 코드 [+0xfd4] 가 24~26(0x357e0)** 이고 ·
 * 플레이 +0x127 이 서 있으면 그 자리에 존을 놓고 동시에 `+0x3f = 1` 을 세운다. 0x41098 은 `stadium/event_zone.pzx` 프레임 0 을
 * 필드 화면 오프셋(+0xfec · +0xff0)에 늘 그리고 존이 서면 **8틱 주기로 앞 4틱 반투명**(`isEventZoneTranslucentAt`)으로 깜빡인다 —
 * 존 좌표는 그리는 자리가 아니다(U-44). 공 하나가 끝날 때 +0x3f 가 서 있으면 보너스 G += 200 이다.
 * 조건 셈은 필드 카메라를 아는 쪽(`pages/home-run-derby/lib/derbyField` 의 `derbyFieldTimelineOf`)이 한다(r274 — 판의 필드 화면).
 *
 * +0x127 (확정, P7 H1): 타구 시작 0x51408 이 0 으로 비우고(0x51470), 덱에서 꺼낸 패턴이 `0xb07c8(덱, 결과, 패턴)` == 1
 * — **패턴 플래그 & 2** — 이면 1 로 세운다(0x514e6). 플래그 비트1 패턴은 결과 18~20 에 65 장, 24 · 25 · 26 에 2 · 1 · 4 장, 4 · 5 에
 * 1 장씩이다 — 결과 코드 24~26 조건까지 맞는 것은 일곱 장뿐이다.
 *
 * ⚠️ **원본 버그(B-32)**: 존을 "놓는" 코드(0x372d4~0x372f6 — 존 좌표 = 그때 공 화면 자리)가 곧바로 "적중" 칸 +0x3f 까지 세운다 —
 * 곧 조건만 맞으면 공이 관중석의 존 그림(event_zone 프레임 0 의 두 칸)에 실제로 닿았는지 따로 보지 않고 200 G 가 붙는다.
 * 고친 길(기본)은 공 자리가 두 칸 안일 때만 적중으로 친다(`isBallInEventZone`) — 필드 화면(`derbyFieldTimelineOf`)이 그 그림의
 * 공 자리(필드 오프셋 기준)를 넘긴다.
 */

/** 존이 깜빡이는 주기 — 8프레임 (0x41098) */
export const EVENT_ZONE_BLINK_PERIOD = 8

/** 존 그림 — `stadium/event_zone.pzx` (this+0x1070, 0x486e0 로드). 프레임 0 = 부품 두 장(원점 (51, 16) · 518×66) */
export const EVENT_ZONE_FRAMES = './sprites/event_zone/frames'

/** 플레이 +0x127 을 세우는 패턴 플래그 비트 — 0xb07c8 = `플래그 & 2` */
export const BIG_FLY_PATTERN_FLAG = 2

/** 이 패턴이 플레이 +0x127 을 세우는가 (0x514e6 · 0xb07c8) */
export function isBigFlyPattern(pattern: BattedBallPattern): boolean {
  return (pattern[3] & BIG_FLY_PATTERN_FLAG) !== 0
}

/** 필드 화면 좌표(필드 오프셋 +0xfec · +0xff0 기준)의 한 점 */
export interface EventZonePoint {
  readonly x: number
  readonly y: number
}

export interface EventZoneCondition {
  /** 이번 타구가 뽑은 패턴 (맞은 공이 아니면 null — 비행 상태 24~26 에 들지 않는다) */
  readonly pattern: BattedBallPattern | null
  /** 이미 이번 공에서 존이 놓였는가 (0x3de10 이 공마다 −1 로 비운다) */
  readonly isZonePlaced?: boolean
  /**
   * 존이 놓이는 틀의 공 자리 — 0x372d4~0x372e4 가 존 좌표로 적는 공 화면 자리에서 필드 오프셋을 뺀 값. B-32 고친 길만 본다.
   * 필드 화면(`derbyFieldTimelineOf`)은 직접 `isBallInEventZone` 을 부른다 — 안 넘기면 판단하지 않는다(원본대로)
   */
  readonly ballFieldPoint?: EventZonePoint
}

/**
 * 존 그림 — `stadium/event_zone.pzx` 프레임 0(원점 (51, 16) · 518×66)의 **부품 두 장**(각 70×66, 합성 그림 x 0~69 · 448~517).
 * 필드 화면 오프셋 기준 사각형이다(그림 알파로 잰 값)
 */
export const EVENT_ZONE_RECTS: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[] = [
  { x: 51, y: 16, width: 70, height: 66 },
  { x: 51 + 448, y: 16, width: 70, height: 66 },
]

/** 공 자리가 존 그림 두 칸 중 하나 안에 드는가 (B-32 고친 길의 적중 판정) */
export function isBallInEventZone(point: EventZonePoint): boolean {
  return EVENT_ZONE_RECTS.some((rect) =>
    point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height)
}

/**
 * 이번 공에 이벤트 존이 뜨는가(= 적중하는가). 원본은 둘이 같은 판정이다(위 ⚠️).
 * B-32 고침이면 공 자리(`ballFieldPoint`)를 받았을 때 존 칸 안이어야 적중이다 — 굴림 없는 판정이라 난수 차례는 같다
 */
export function isEventZoneHit({ pattern, isZonePlaced = false, ballFieldPoint }: EventZoneCondition): boolean {
  if (isZonePlaced) return false
  if (pattern === null) return false
  if (!isBigFlyPattern(pattern)) return false
  if (ballFieldPoint === undefined || !isBugFixed('B-32')) return true
  return isBallInEventZone(ballFieldPoint)
}

/** 존이 선 동안 반투명으로 그리는 효과 1 의 단계 — 0x41098 410ec `movs r2, #5` → [sp+8] (그림 5/16 + 화면 11/16) */
export const EVENT_ZONE_TRANSLUCENT_LEVEL = 5

/**
 * **존이 선 동안의 깜빡임** (0x41098 직접 뜸 — 410bc~41116): t = 상태 틱 [장면+0x2c], `t − (t / 8 내림 0쪽) · 8 ≤ 3` 이면
 * 프레임 0 을 효과 1 · 단계 5(반투명)로, 아니면 효과 0(그대로)으로 그린다. 곧 8틱 주기에 앞 4틱 반투명 · 뒤 4틱 불투명이다.
 * 존이 안 섰으면(+0x17cc · +0x17d0 ≤ 0) 늘 효과 0 — 그림 자체는 늘 그린다.
 */
export function isEventZoneTranslucentAt(tick: number): boolean {
  // asrs 앞의 음수 보정(410c4 `adds r3, r2, #7`)은 0 쪽 내림 — 나머지가 음수면 ≤ 3 이라 반투명 쪽이다
  const remainder = tick - Math.trunc(tick / EVENT_ZONE_BLINK_PERIOD) * EVENT_ZONE_BLINK_PERIOD
  return remainder <= 3
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
 * 0x41098 은 필드 그리기 0x411e0(구장 0x78931 다음)이 부르고, 0x411e0 을 부르는 곳은 틀 그리기 0x41230 의 413a2(0x33c98 참일 때 —
 * 0x52c50 52f36 이 상태 7 · 8 · 9 말고 늘 부른다)와 상태 0x1e 그리기 0x43228 의 4322c 둘뿐이다(감사 2026-10-24 정정: 예전 주석의
 * "판(0x17) 그리기 0x46c88 → 0x43228" 은 틀렸다 — 0x46c88 은 0x43228 · 0x411e0 을 부르지 않는다). 0x17 에서는 52f36 0x41230 이 그리기 표의
 * 0x46c88 보다 먼저 존을 그린다. 존(+0x17cc/+0x17d0)은 다음 공 0x3de10 이 −1 로 비울 때까지 남는다.
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
