import { describe, expect, it } from 'vitest'
import {
  BIG_HIT_FLASH_TRIANGLES,
  bigHitBorderRectsOf,
  bigHitEndTickOf,
  bigHitReleaseTickOf,
  bigHitFlashesAt,
  bigHitScreenOf,
  bigHitSwingSkipsOf,
  bigHitZoomCenterOf,
  bigHitZoomPercentOf,
} from '@/widgets/batting-stage/lib/bigHitScreen'

describe('큰 타구 0x13 그리기 0x4cb1c 의 꼬리', () => {
  const 점 = { x: 120, y: 250 }

  it('감상 플래그가 꺼진 타구는 아무것도 안 그린다 (4cb7c)', () => {
    expect(bigHitScreenOf(false, 0, 0, 점)).toBeNull()
  })

  it('틱 0~7 은 멈춤 갈래 — [+0x10a8] 옛값 6 · 5 · … · −1, 틱 8 부터 뒤 갈래(애니 3 칸 0 부터)', () => {
    expect(bigHitScreenOf(true, 0, 1, 점)).toEqual({ kind: '멈춤', counter: 6, side: 1 })
    expect(bigHitScreenOf(true, 7, 0, 점)).toEqual({ kind: '멈춤', counter: -1, side: 0 })
    expect(bigHitScreenOf(true, 8, 0, 점)).toEqual({ kind: '뒤', drawCall: 0, point: 점 })
    expect(bigHitScreenOf(true, 11, 0, 점)).toEqual({ kind: '뒤', drawCall: 3, point: 점 })
  })

  it('확대 배율 100 + 2 × (6 − 옛값) — 100 % 에서 114 % 까지, 번쩍임은 옛값이 홀수(5 · 3 · 1 · −1)인 그림', () => {
    expect([6, 5, 4, 3, 2, 1, 0, -1].map(bigHitZoomPercentOf)).toEqual([100, 102, 104, 106, 108, 110, 112, 114])
    expect([6, 5, 4, 3, 2, 1, 0, -1].map(bigHitFlashesAt)).toEqual([false, true, false, true, false, true, false, true])
  })

  it('확대 중심 = 표 0xcfb54 를 480 × 390 에서 화면으로 — 우타 (121, 267) · 좌타 (118, 267)', () => {
    expect(bigHitZoomCenterOf(0, 240, 320)).toEqual({ x: 121, y: 267 })
    expect(bigHitZoomCenterOf(1, 240, 320)).toEqual({ x: 118, y: 267 })
  })

  it('번쩍임 표 0xd0244 = 세모 16 개 · 테두리 4 줄', () => {
    expect(BIG_HIT_FLASH_TRIANGLES).toHaveLength(16)
    expect(BIG_HIT_FLASH_TRIANGLES[0]).toEqual([{ x: 52, y: 0 }, { x: 56, y: 0 }, { x: 82, y: 108 }])
    expect(bigHitBorderRectsOf(240, 320)).toEqual([[0, 0, 240, 4], [0, 0, 4, 320], [0, 316, 240, 4], [236, 0, 4, 320]])
  })
})

describe('0x13 의 스윙 멈춤 · 반 속도 (3f1ea · 3f2dc)', () => {
  it('큰 타구는 틱 0~7 에 서 있고 틱 8 부터 홀수 틱을 건너뛴다', () => {
    expect(bigHitSwingSkipsOf(true, 100, null, 100)).toBe(1)
    expect(bigHitSwingSkipsOf(true, 100, null, 107)).toBe(8)
    expect(bigHitSwingSkipsOf(true, 100, null, 108)).toBe(8)
    expect(bigHitSwingSkipsOf(true, 100, null, 109)).toBe(9)
    expect(bigHitSwingSkipsOf(true, 100, null, 112)).toBe(10)
  })

  it('0x13 이 끝나면 더 건너뛰지 않는다 · 큰 타구가 아니면 늘 0', () => {
    expect(bigHitSwingSkipsOf(true, 100, 110, 140)).toBe(9)
    expect(bigHitSwingSkipsOf(false, 100, null, 120)).toBe(0)
    expect(bigHitSwingSkipsOf(true, 100, null, 99)).toBe(0)
  })
})

describe('창이 선 첫 그림([창+0x250])의 0x13 그리기 — 갱신 없이 0x4cb1c 가 한 번 더 돈다 (r175)', () => {
  const 점 = { x: 120, y: 250 }

  it('창 그림이 없으면 틱 7 에 풀리고 끝은 그대로', () => {
    expect(bigHitReleaseTickOf([])).toBe(7)
    expect(bigHitEndTickOf(20, 7)).toBe(20)
    expect(bigHitEndTickOf(0, 7)).toBe(0)
  })

  it('틱 3 뒤 창 그림 하나 — [+0x10a8] 이 한 번 더 줄어 틱 6 에 풀리고 공 틱 · 끝 · 스윙이 한 틱 당겨진다', () => {
    // 창 그림 자신은 틱 4 자리의 그림(옛값 2)
    expect(bigHitScreenOf(true, 4, 0, 점, [])).toEqual({ kind: '멈춤', counter: 2, side: 0 })
    expect(bigHitReleaseTickOf([3])).toBe(6)
    expect(bigHitScreenOf(true, 4, 0, 점, [3])).toEqual({ kind: '멈춤', counter: 1, side: 0 })
    expect(bigHitScreenOf(true, 6, 0, 점, [3])).toEqual({ kind: '멈춤', counter: -1, side: 0 })
    expect(bigHitScreenOf(true, 7, 0, 점, [3])).toEqual({ kind: '뒤', drawCall: 0, point: 점 })
    expect(bigHitEndTickOf(20, 6)).toBe(19)
    expect(bigHitSwingSkipsOf(true, 100, null, 107, 6)).toBe(8)
    expect(bigHitSwingSkipsOf(true, 100, null, 108, 6)).toBe(8)
  })

  it('틱 6 뒤 창 그림이 막음을 풀어도 공 틱은 그 틀에 안 올라 틱 7 그림이 다시 푼다', () => {
    // 창 그림(틱 7 자리) 옛값 −1 → 풀고 016
    expect(bigHitScreenOf(true, 7, 0, 점, [])).toEqual({ kind: '멈춤', counter: -1, side: 0 })
    expect(bigHitReleaseTickOf([6])).toBe(7)
    expect(bigHitScreenOf(true, 7, 0, 점, [6])).toEqual({ kind: '멈춤', counter: -2, side: 0 })
    expect(bigHitScreenOf(true, 8, 0, 점, [6])).toEqual({ kind: '뒤', drawCall: 0, point: 점 })
  })

  it('풀린 뒤의 창 그림은 애니 3 을 한 칸 더 넘긴다', () => {
    expect(bigHitScreenOf(true, 10, 0, 점, [9])).toEqual({ kind: '뒤', drawCall: 2 + 1, point: 점 })
  })
})
