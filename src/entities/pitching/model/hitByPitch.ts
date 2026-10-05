import type { Pitch } from '@/entities/pitching/model/pitch'
import { projectToPlate } from '@/entities/pitching/model/pitchCurve'

/**
 * 사구 사각형 — 표 `0xcfd50` = (x 171, y 240, 폭 38, 높이 130). 판정 좌표계(카메라 오프셋 없음, `projectToPlate`)다.
 * 우타자(side 0) 몸 자리다 — 타자 앵커 x 184(표 0xcfb2c)가 이 안에 든다.
 */
export const HIT_BY_PITCH_BOX = { x: 171, y: 240, width: 38, height: 130 } as const
/** 좌타 뒤집기 기준 폭 — `0x35a7a~0x35a84`: x ← 480 − x − w (월드 폭 480) */
const HIT_BY_PITCH_MIRROR_WIDTH = 480
const LEFT_HANDED_BATTER = 1

/**
 * **몸에 맞는 공 상자 판정 `0x35a20`** 의 상자 부분 — 스윙하지 않은 공에만 부른다.
 *
 * ```
 * 35a2c: 스윙 객체([scene+0xf9c])+0xd ≠ 0  또는  state[0x10](= 스윙 객체 +0xe, 0x3dfbe) ≠ 0  → 0
 * 35a40: 상자 = 표 0xcfd50 (x, y, w, h)
 * 35a6c: 0xb63c0(0xae89d(ctx) = 공격 팀 현재 타자) 참(좌타)이면 x ← 480 − x − w
 * 35a86: (px, py) = (scene+0x10dc, scene+0x10e0)                            ; 공 도착 판정 좌표
 * 35aaa: x ≤ px ≤ x+w  그리고  y ≤ py ≤ y+h  → 1                           ; 경계 포함
 * ```
 * 판정 좌표는 공 도착점이다 — 궤적 마지막 점을 `projectToPlate` 로 옮긴 자리(0x4dff8 과 같은 투영).
 * 난수를 쓰지 않는다. 궤적이 없는 투구(`worldPath === null`)는 판정 좌표가 없어 사구를 내지 않는다.
 *
 * 사람 타석은 `features/play-at-bat/model/resolvePitch.isHitByPitch` 가 같은 판정을 한다.
 */
export function isPitchInHitByPitchBox(pitch: Pitch, batterSide: number): boolean {
  const path = pitch.worldPath
  if (path === null || path.length === 0) return false
  const point = projectToPlate(path[path.length - 1], pitch.stageSide)
  const box = HIT_BY_PITCH_BOX
  const left = batterSide === LEFT_HANDED_BATTER ? HIT_BY_PITCH_MIRROR_WIDTH - box.x - box.width : box.x
  return point.x >= left && point.x <= left + box.width && point.y >= box.y && point.y <= box.y + box.height
}
