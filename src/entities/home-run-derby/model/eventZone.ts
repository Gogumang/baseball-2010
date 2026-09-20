/**
 * 이벤트 존 (H-2 · 해독 판정 **유력** — 조건 한 고리가 미확인이다).
 *
 * 원본(0x36dfc, 공 그리기): 모드 7 이고 · 아직 존이 안 놓였고 · 공이 비행 상태(0x357e0 의 24~26)이고 ·
 * **공의 화면 y 가 화면 높이/3 보다 위**이고 · 필드 객체 +0x127 플래그가 서 있으면
 * 그 자리에 존을 놓고 동시에 `+0x3f = 1` 을 세운다. 0x41098 이 그 자리에 `stadium/event_zone.pzx`
 * 를 **8프레임 주기로 깜빡이며** 그리고, 공 하나가 끝날 때 +0x3f 가 서 있으면 보너스 G += 200 이다.
 *
 * ⚠️ **원본 그대로**: 존을 "놓는" 코드가 곧바로 "적중" 칸까지 세운다 — 곧 조건만 맞으면
 * 공이 실제로 존에 닿았는지 따로 보지 않고 200 G 가 붙는다. 버그로 보이지만 고치지 않는다
 * (`docs/re/DECISIONS.md` — 원본 버그는 그대로 옮긴다).
 *
 * 미해결: 필드 +0x127 플래그의 뜻. 홈런더비에서는 늘 서 있는 것으로 본다 (**추정**).
 */

/** 존이 깜빡이는 주기 — 8프레임 (0x41098) */
export const EVENT_ZONE_BLINK_PERIOD = 8

/** 존 그림 — `stadium/event_zone.pzx` (this+0x1070, 0x486e0 로드) */
export const EVENT_ZONE_FRAMES = './sprites/event_zone/frames'

/** 존이 뜨는 화면 높이 비율 — "공 화면 y < 화면 높이/3" (0x36dfc) */
export const EVENT_ZONE_SCREEN_TOP_RATIO = 1 / 3

/**
 * 존이 뜨는 타구 높이 (월드). **내가 정한 값이다.**
 *
 * 원본 조건은 "공의 **화면** y" 인데 이식판 타석 화면은 타구를 그리지 않아 화면 y 가 없다.
 * 대신 `battedBallFlight` 궤적의 최고 높이로 같은 뜻을 낸다. 5000 을 고른 기준: 원본 패턴 표에서
 * 홈런으로 판정되는 타구의 최고 높이가 3996~6256 이라, 그 한가운데를 잡으면 "높이 뜬 타구" 만
 * 존을 얻는다. 물리 루프를 풀면 이 상수는 사라진다.
 */
export const EVENT_ZONE_APEX_HEIGHT = 5_000

export interface EventZoneCondition {
  /** 이번 타구 궤적의 최고 높이 */
  readonly apexHeight: number
  /** 필드 +0x127 플래그. 뜻이 미해결이라 홈런더비에서는 늘 참으로 본다 */
  readonly hasFieldFlag?: boolean
  /** 이미 이번 공에서 존이 놓였는가 (0x3de10 이 공마다 −1 로 비운다) */
  readonly isZonePlaced?: boolean
}

/** 이번 공에 이벤트 존이 뜨는가(= 적중하는가). 위 ⚠️ 대로 둘이 같은 판정이다 */
export function isEventZoneHit({
  apexHeight,
  hasFieldFlag = true,
  isZonePlaced = false,
}: EventZoneCondition): boolean {
  if (isZonePlaced) return false
  if (!hasFieldFlag) return false
  return apexHeight >= EVENT_ZONE_APEX_HEIGHT
}

/**
 * 8프레임 주기 깜빡임 — 반은 보이고 반은 안 보인다.
 * 듀티(4/8)는 원본 코드에서 못 읽어 **추정**이다. 주기 8 은 확정이다.
 */
export function isEventZoneVisibleAt(tick: number): boolean {
  return ((tick % EVENT_ZONE_BLINK_PERIOD) + EVENT_ZONE_BLINK_PERIOD) % EVENT_ZONE_BLINK_PERIOD <
    EVENT_ZONE_BLINK_PERIOD / 2
}
