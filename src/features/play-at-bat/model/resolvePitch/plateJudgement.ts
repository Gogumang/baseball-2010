import { projectToPlate } from '@/entities/pitching/model/pitchCurve'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'

/**
 * **공 도착점 판정** — 상태 0x12 진입 `0x3dfac` 가 보는 세 가지: 판정 오차(0x51226) · 사구 상자(0x35a20) · 스트라이크 상자(0x3dfd8).
 * 셋 다 궤적 마지막 점을 `projectToPlate` 로 옮긴 판정 좌표를 본다. 난수를 쓰지 않는다.
 */

/** 존 좌표 1.0 이 원본 픽셀 몇 개인가 — 33px 존의 절반 (stageLayout 과 같은 값) */
const ZONE_HALF_PIXELS = 16.5

/** 판정 기준점 (표 0xcfb54) — side 0 · 1 */
const SWEET_SPOTS = [
  { x: 242, y: 326 },
  { x: 237, y: 326 },
]

/**
 * 도착점 − 기준점(0xcfb54) + 좌우 이동 (0x51226). 원본 궤적이 있으면 마지막 점을 투영한 판정 좌표(0x4dff8)를 쓴다.
 * 궤적이 없는 공(와인드업 자리 공 `windUpCpuPitchOf` · 시험 공 — 경기 중 판정에는 오지 않는다)만 웹 존 가운데(0,0)를
 * 기준점으로 보고 존 좌표를 픽셀로 옮긴다 (원본에 없는 대체 길).
 */
export function plateErrorOf(pitch: Pitch, shift: number): { horizontal: number; vertical: number } {
  const path = pitch.worldPath
  if (path !== null && path.length > 0) {
    const plate = projectToPlate(path[path.length - 1], pitch.stageSide)
    const sweet = SWEET_SPOTS[pitch.stageSide] ?? SWEET_SPOTS[0]
    return { horizontal: plate.x - sweet.x + shift, vertical: plate.y - sweet.y }
  }
  return {
    horizontal: Math.round(pitch.plate.x * ZONE_HALF_PIXELS) + shift,
    vertical: -Math.round(pitch.plate.y * ZONE_HALF_PIXELS) || 0,
  }
}

/**
 * 사구 사각형 — 표 `0xcfd50` = (x 171, y 240, 폭 38, 높이 130). 판정 좌표계(카메라 오프셋 없음, `projectToPlate`)다.
 * 우타자(side 0) 몸 자리다 — 타자 앵커 x 184(표 0xcfb2c)가 이 안에 든다.
 */
const HIT_BY_PITCH_BOX = { x: 171, y: 240, width: 38, height: 130 } as const
/** 좌타 뒤집기 기준 폭 — `0x35a7a~0x35a84`: x ← 480 − x − w (월드 폭 480) */
const HIT_BY_PITCH_MIRROR_WIDTH = 480
const LEFT_HANDED_BATTER = 1

/**
 * **몸에 맞는 공 판정 `0x35a20`** — 상태 0x12 진입(공 도착 판정) `0x3dfac` 가 맨 먼저 부르고(0x3dfc4)
 * 결과를 state[0x12] 에 넣는다(0x3dfc8). 투구 판정 `0x9d57c` 는 이 칸을 **볼·스트라이크보다 먼저** 본다.
 *
 * ```
 * 35a2c: 스윙 객체([scene+0xf9c])+0xd ≠ 0  또는  state[0x10] ≠ 0  → 0     ; 스윙(번트 포함)했으면 사구 없음
 * 35a40: 상자 = 표 0xcfd50 (x, y, w, h)
 * 35a6c: 0xb63c0(현재 타자) 참(좌타)이면 x ← 480 − x − w
 * 35a86: (px, py) = (scene+0x10dc, scene+0x10e0)                            ; 공 도착 판정 좌표
 * 35aaa: x ≤ px ≤ x+w  그리고  y ≤ py ≤ y+h  → 1                           ; 경계 포함
 * ```
 * 판정 좌표는 공 도착점이다 — 웹은 `plateErrorOf` 와 같은 자리(궤적 마지막 점을 `projectToPlate`)를 쓴다.
 * 난수를 쓰지 않는다.
 * 궤적이 없는 투구(`worldPath === null`)는 판정 좌표가 없어 사구를 내지 않는다 — 경기에서 판정에 오는 공은
 * CPU · 사용자 투구 모두 늘 궤적이 있다(없는 것은 와인드업 자리 공 · 시험 공뿐).
 */
export function isHitByPitch(pitch: Pitch, batterSide: number): boolean {
  const path = pitch.worldPath
  if (path === null || path.length === 0) return false
  const point = projectToPlate(path[path.length - 1], pitch.stageSide)
  const box = HIT_BY_PITCH_BOX
  const left = batterSide === LEFT_HANDED_BATTER ? HIT_BY_PITCH_MIRROR_WIDTH - box.x - box.width : box.x
  return point.x >= left && point.x <= left + box.width && point.y >= box.y && point.y <= box.y + box.height
}

/**
 * 스트라이크 상자 — 표 `0xcfb7c[+0x17e1]` = side 0 (226, 310, 33, 33) · side 1 (221, 310, 33, 33) (x, y, 폭, 높이, s16).
 * 판정 좌표계(카메라 오프셋 없음, `projectToPlate`)다.
 */
export const STRIKE_ZONE_BOXES = [
  { x: 226, y: 310, width: 33, height: 33 },
  { x: 221, y: 310, width: 33, height: 33 },
] as const

/**
 * **스트라이크 판정 — 상태 0x12 진입 `0x3dfac`** (직접 뜸):
 * ```
 * 3dfd8  상자 = 0xcfb7c[경기+0x17e1] (x, y, w, h)
 * 3dff0  (px, py) = (경기+0x10dc, 경기+0x10e0)                              ; 공 도착 판정 좌표 — 사구 0x35a20 과 같은 칸
 * 3e016  x ≤ px ≤ x+w  그리고  y ≤ py ≤ y+h                                ; 경계 포함
 * ```
 * 판정 좌표는 궤적 마지막 점을 `projectToPlate` 로 옮긴 자리다(`isHitByPitch` 와 같다). 궤적이 없는 공(와인드업
 * 자리 공 · 시험 공)만 정규화 존(|x|, |y| ≤ 1)으로 본다(원본에 없는 대체 길).
 */
export function isStrikeZonePitch(pitch: Pitch): boolean {
  const path = pitch.worldPath
  if (path === null || path.length === 0) return isInsideStrikeZone(pitch.plate)
  const point = projectToPlate(path[path.length - 1], pitch.stageSide)
  const box = STRIKE_ZONE_BOXES[pitch.stageSide] ?? STRIKE_ZONE_BOXES[0]
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
}
