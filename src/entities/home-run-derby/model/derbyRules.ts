import { BATTING_POINT } from '@/entities/batting/model/battedBallFlight'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'

/**
 * 홈런더비(게임 모드 7)의 수치 — **규칙 전체가 확정이다**
 * (`docs/re/H-modes.md` H-2 절 · 4절 "1. 홈런더비 (모드 7)").
 *
 * 경기 상태 구조체는 경기 장면 this+0x174 = 전역 `0x1552d0c` 이고, 초기화는 `0xb6814` 다.
 * 아래 상수 옆의 주소는 그 값을 읽어 낸 원본 코드 자리다.
 *
 * 궤적 물리는 여기서 만들지 않는다 — 타구는 `entities/batting/model/battedBallFlight` 를
 * 불러다 쓴다(원본 물리 루프 0xb3b38·0xb401c 는 이 저장소의 해독 금지 주제다).
 */

/** 기회 10구 (+0x33, `0xb6846: movs r3,#0xa ; strb r3,[+0x33]`) */
export const DERBY_PITCH_COUNT = 10

/**
 * 비거리 기준점 = 표 `0xd81f8` = `0xcfb70` = (20000, 1000, 30000).
 * `battedBallFlight.BATTING_POINT` 와 **같은 점**이라 그것을 그대로 쓴다 — 두 곳에 같은 수를
 * 적어 두면 한쪽만 고쳐질 수 있다.
 */
export const DERBY_DISTANCE_ORIGIN: WorldPoint = BATTING_POINT

/** 비거리 나누는 수 (0xa600c) */
export const DERBY_DISTANCE_DIVISOR = 265

/** 한 타구 비거리 상한 (`0xa606a: movs r1,#0xa0 ; cmp r0,#0xa0 ; bge`) */
export const DERBY_DISTANCE_LIMIT = 160

/**
 * 한 타구의 비거리. **결과가 홈런일 때만** 누적에 더한다 (0x524c0 → 0xa600c:
 * 결과 코드 +0x26 이 8(홈런)이고 0xb68dc 가 거짓일 때).
 *
 * `d = |착지점 − (20000, 1000, 30000)| / 265`, 160 을 넘으면 160.
 * 원본은 정수 나눗셈이라 버림이다.
 */
export function derbyDistanceOf(landing: WorldPoint, origin: WorldPoint = DERBY_DISTANCE_ORIGIN): number {
  const length = Math.hypot(landing.x - origin.x, landing.y - origin.y, landing.z - origin.z)
  const distance = Math.trunc(length / DERBY_DISTANCE_DIVISOR)
  return distance >= DERBY_DISTANCE_LIMIT ? DERBY_DISTANCE_LIMIT : distance
}

/**
 * 마투수 등장 문턱 — 표 `0xd84dc` = [800, 1200, 1600, 2000, 99999] (0xae4xx 2번 항).
 * 마지막 99999 는 "단계 4 에서는 더 안 오른다" 는 뜻으로 표에 들어 있는 값이다.
 */
export const ACE_STAGE_THRESHOLDS: readonly number[] = [800, 1200, 1600, 2000, 99_999]

/** 마투수 단계의 최댓값 (표 길이 − 1) */
export const ACE_STAGE_MAX = ACE_STAGE_THRESHOLDS.length - 1

/** 누적 비거리가 지금 단계의 문턱을 넘었으면 단계 +1. 공 하나가 끝날 때만 본다 (0xae3e8 2번 항) */
export function nextAceStageOf(stage: number, totalDistance: number): number {
  const threshold = ACE_STAGE_THRESHOLDS[stage]
  if (threshold === undefined) return stage
  return totalDistance >= threshold ? Math.min(stage + 1, ACE_STAGE_MAX) : stage
}

/** 단계별 G 배율 — 표 `0xcfb10` = [1, 2, 3, 4, 5] (s8, 0x3af4c) */
export const GAME_POINT_MULTIPLIERS: readonly number[] = [1, 2, 3, 4, 5]

/** 콤보 보너스 단위 — 콤보 한 칸마다 G (0xae45a~0xae46a: `r3 = 콤보*5`) */
export const COMBO_BONUS_UNIT = 5

/** 이벤트 존 적중 보너스 (`0xae548: adds r3,#0xc8`) */
export const EVENT_ZONE_BONUS = 200

/** G 상한 (0x4f6ea) */
export const GAME_POINT_LIMIT = 99_999

/**
 * 이번 홈런더비로 번 G — `G = (누적 비거리 / 100) × 배율[단계] + 보너스 G` (0x3af4c).
 * 누적/100 은 원본 정수 나눗셈이라 버림이다.
 *
 * 상한 99999 는 원본에서는 **정산할 때 보유 G 쪽에** 걸린다(0x4f6ea, `addDerbyGamePoint`).
 * H-2 요약이 "99999 상한" 으로 적은 것과 맞추려고 번 G 에도 같은 상한을 둔다 —
 * 실제로 여기까지 오려면 누적 비거리가 200만 가까이 돼야 해서 두 길의 결과는 같다.
 */
export function derbyGamePointOf(totalDistance: number, stage: number, bonusGamePoint: number): number {
  const multiplier = GAME_POINT_MULTIPLIERS[stage] ?? GAME_POINT_MULTIPLIERS[GAME_POINT_MULTIPLIERS.length - 1]
  const earned = Math.trunc(Math.max(0, totalDistance) / 100) * multiplier + Math.max(0, bonusGamePoint)
  return Math.min(GAME_POINT_LIMIT, earned)
}

/** 정산 — 보유 G 에 더하고 99999 로 자른다 (0x4f6ea) */
export function addDerbyGamePoint(heldGamePoint: number, earned: number): number {
  return Math.min(GAME_POINT_LIMIT, heldGamePoint + earned)
}

/**
 * 단계 0 의 투수는 **구질 1 고정**이다
 * (`0x344dc`: 모드 7 이면 `단계 > 0 ? 0x16(22, 마구) : 1`).
 */
export const DERBY_ORDINARY_PITCH_TYPE = 1

/** 단계 ≥ 1 의 마투수는 **구질 22(마구)만** 던진다 (0x344dc · 0x48d50) */
export const DERBY_MAGIC_PITCH_TYPE = 22

/**
 * 단계 0 의 목표점 — 타자 좌우(경기 this+0x17e1)별 **고정 표** `0xcfbcc` (0x345fc, 확정).
 * 일반 경기와 달리 목표 종류를 굴리지 않고 존 한가운데로만 던진다.
 */
export const DERBY_ZONE_CENTERS: Readonly<Record<'left' | 'right', WorldPoint>> = {
  left: { x: 19_415, y: 1_202, z: 29_705 },
  right: { x: 20_585, y: 1_202, z: 29_705 },
}

/** 신기록 효과음 / 보통 효과음 (0x4f644~) */
export const NEW_RECORD_SOUND_ID = 0x1f
export const NORMAL_RECORD_SOUND_ID = 0x20

/** 최고 비거리 저장 칸은 u16 (저장 +0x5c) — 갱신 값도 그 눈금을 넘지 않게 자른다 */
export const BEST_DISTANCE_LIMIT = 0xffff
