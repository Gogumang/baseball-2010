import { cosineSixteen, sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import { ABILITY_AXIS_ANGLES } from '@/pages/create-player/lib/teamSelectLayout'
import type { ChartPoint } from '@/pages/create-player/lib/teamSelectLayout'

/**
 * **능력치 도형 0x5aefc 의 바탕·축 칸** (ABILITY 판, 직접 떴다).
 *
 * 그리는 차례:
 * ```
 * 5af4e  slt_frame 이미지 3(31×62 반원)을 (x − 31, y − 31) · 효과 0x11(좌우 뒤집기)로 (x − 1, y − 31)   ; 둥근 바탕
 * 5b3ba  0x764c9 — 바탕 테두리(고정 29, #6B92F4)와 값 도형(자라는 애니)
 * 5b412  축 i = 0..3 (각도 표 0xd1b0c = [225, 315, 45, 135]):
 *          끝 = 가운데 + (R + 18) × (cos, sin) >> 16                         ; 0x6c7f5 · 0x6c7c1, R = [anim+0x1d8]
 *          선 0x6a905(끝 → 지금 꼭짓점 [축+0x14 · +0x18], #6B92F4)
 *          상자 x = 끝x < 가운데x ? 끝x − 상자폭 + 2 : 끝x − 1                 ; 0x5b48c~0x5b4a6
 *          상자 y = 끝y > 가운데y ? 끝y − 상자높이 + 2 : 끝y − 1               ; 0x5b4a8~0x5b4ba
 *          d = |30 − R| — (u16)(각도 − 90) ≤ 180 이면 상자 x += d 아니면 −= d     ; 0x5b4cc~0x5b4fc
 *                         각도 ≤ 180 이면 상자 y += d 아니면 −= d                 ; 0x5b4fe~0x5b532
 *          slt_frame 이미지 0x11(26×29) 을 상자에 · img_text 팔레트 0 · 축 이름 표 0xd1b14[이름 번호] 를 상자 + 3   ; 0x5b534~0x5b578
 *          값 칸 [anim+0x1e4] ≠ 0 이고 지금값 > 0 → 숫자 0x6aff9(상자 x + 0x12, 상자 y + 0x11, 지금값, −1, 0x14, …, 앵커 4)
 *          그 밖 → "???"(0xd2080) 를 RGB(0xff, 0xb6, 0x29) 로 상자 가운데 (상자 x + (26 − 글폭) / 2, 상자 y + 0x11) 와 x + 1 에 두 번   ; 0x5b69c~0x5b758
 * ```
 * 숫자 색은 [sp+0x194](여덟째 인자) ≠ 0 이고 다 자랐을 때만 기본값과 견준다 — 마선수 고르기 · 명전 목록은 0 이라 늘 기본색이다.
 */
export const ABILITY_RADAR_BACK = { image: 3, width: 31 } as const
export const ABILITY_RADAR_BOX = { image: 0x11, width: 26, height: 29, labelInset: 3, numberDx: 0x12, numberDy: 0x11 } as const
/** 축 끝이 반지름보다 더 나가는 길이 — `0x5b42a adds r4,#0x12` */
const AXIS_END_REACH = 0x12
/** 상자 자리 보정의 기준 반지름 — `movs r3,#0x1e` */
const BOX_BASE_RADIUS = 30
/** "???" (0xd2080) 와 그 색 makeColor(0xff, 0xb6, 0x29) */
export const ABILITY_RADAR_EMPTY = { text: '???', color: '#FFB629' } as const

/** 축 이름 img_text 표 0xd1b14 — [이름 번호] (투수 0~3 · 타자 4~7 · 팀 8~11) */
const AXIS_LABEL_FRAMES = [37, 38, 39, 40, 41, 42, 43, 44, 46, 45, 204, 205] as const
/** 종류 1 · 3(투수) 은 이름 번호 0~3 (37 제구 · 38 구속 · 39 변화 · 40 체력), 1 · 2(타자) 는 4~7 (41 히트 · 42 파워 · 43 수비 · 44 주루) */
export const ABILITY_RADAR_LABELS = {
  pitcher: AXIS_LABEL_FRAMES.slice(0, 4),
  batter: AXIS_LABEL_FRAMES.slice(4, 8),
} as const

export interface AbilityRadarAxis {
  /** 축 끝 — 선이 여기서 지금 꼭짓점으로 간다 */
  readonly end: ChartPoint
  /** 이름 상자 왼쪽 위 */
  readonly box: ChartPoint
}

/** 네 축의 끝과 이름 상자 자리 (0x5b412~0x5b532) */
export function abilityRadarAxesOf(center: ChartPoint, radius: number): readonly AbilityRadarAxis[] {
  const reach = radius + AXIS_END_REACH
  const shift = Math.abs(BOX_BASE_RADIUS - radius)
  return ABILITY_AXIS_ANGLES.map((angle) => {
    const end = {
      x: center.x + ((reach * cosineSixteen(angle)) >> 16),
      y: center.y + ((reach * sineSixteen(angle)) >> 16),
    }
    const x = end.x < center.x ? end.x - ABILITY_RADAR_BOX.width + 2 : end.x - 1
    const y = end.y > center.y ? end.y - ABILITY_RADAR_BOX.height + 2 : end.y - 1
    return {
      end,
      box: {
        x: x + (((angle - 90) & 0xffff) <= 180 ? shift : -shift),
        y: y + (angle <= 180 ? shift : -shift),
      },
    }
  })
}
