import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SPECIAL_SWING_BADGE_ANIMATION,
  showsSpecialSwingBadge,
  specialSwingBadgeFrameOf,
  specialSwingBadgeLayoutOf,
  specialSwingCountImagesOf,
} from '@/widgets/batting-stage/lib/specialSwingBadge'
import { BATTER_SIDE } from '@/widgets/batting-stage/lib/stageLayout'

const animations = JSON.parse(readFileSync('public/sprites/game_ui/frames/animations.json', 'utf8')) as {
  frame: number
  delay: number
}[][]
const entries = animations[SPECIAL_SWING_BADGE_ANIMATION]

describe('필살 남은 횟수 표시 — 0x38a30', () => {
  it('기준 점은 타자 앵커에서 좌타 −0x20 · 우타 −0x38, 판은 (+15, −10) · 숫자는 (+0x40, −8)', () => {
    // 좌타 앵커 (175, 281) · 우타 앵커 (64, 281)
    expect(specialSwingBadgeLayoutOf(BATTER_SIDE.좌타)).toEqual({ plate: { x: 158, y: 271 }, count: { x: 207, y: 273 } })
    expect(specialSwingBadgeLayoutOf(BATTER_SIDE.우타)).toEqual({ plate: { x: 23, y: 271 }, count: { x: 72, y: 273 } })
  })

  it('상태 0x11 까지만 · 남은 횟수 > 0 일 때만 그린다', () => {
    expect(showsSpecialSwingBadge({ kind: '대기', tick: 0, isPaused: true }, 2)).toBe(true)
    expect(showsSpecialSwingBadge({ kind: '투구중', tick: 3, isPaused: false }, 1)).toBe(true)
    expect(showsSpecialSwingBadge({ kind: '결과', tick: 0, isPaused: false }, 2)).toBe(false)
    expect(showsSpecialSwingBadge({ kind: '타격', tick: 0, isPaused: false }, 2)).toBe(false)
    expect(showsSpecialSwingBadge({ kind: '대기', tick: 0, isPaused: false }, 0)).toBe(false)
    expect(showsSpecialSwingBadge({ kind: '대기', tick: 0, isPaused: false }, null)).toBe(false)
  })

  it('애니 5 는 62~68 · 62 — 0xe · 0xf 에 들어선 뒤 그림마다 한 칸, 끝 칸 62 에 멈춘다', () => {
    expect(entries.map((entry) => entry.frame)).toEqual([62, 63, 64, 65, 66, 67, 68, 62])
    const frames = [0, 1, 2, 3, 4, 5, 6, 7, 8, 20].map((tick) =>
      specialSwingBadgeFrameOf(entries, { kind: '대기', tick, isPaused: false }),
    )
    expect(frames).toEqual([62, 63, 64, 65, 66, 67, 68, 62, 62, 62])
    expect(specialSwingBadgeFrameOf(entries, { kind: '투구중', tick: 2, isPaused: false })).toBe(62)
  })

  it('숫자는 num 그림 117 + 자리, 맨 왼쪽 자리부터', () => {
    expect(specialSwingCountImagesOf(3)).toEqual([120])
    expect(specialSwingCountImagesOf(12)).toEqual([118, 119])
  })
})
