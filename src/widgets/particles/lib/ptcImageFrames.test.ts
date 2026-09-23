import { describe, expect, it } from 'vitest'
import { PTC_IMAGE_FRAMES, PTC_PART_IMAGE, ptcPartOf } from '@/widgets/particles/lib/ptcImageFrames'
import { drawAlphaOf, DRAW_STRENGTH_MAX } from '@/widgets/particles/lib/renderParticles'

describe('ptcimg 프레임 표', () => {
  it('프레임 17개를 든다', () => {
    expect(PTC_IMAGE_FRAMES.length).toBe(17)
  })

  it('R5 7절이 적어 둔 프레임 4·6·10·14 의 파트가 맞다', () => {
    const 번호 = (img: number) => PTC_IMAGE_FRAMES[img].map((part) => part.image)
    expect(번호(4)).toEqual([42, 43, 44])
    expect(번호(6)).toEqual([1, 2, 3])
    expect(번호(10)).toEqual([48, 49, 50])
    expect(번호(14)).toEqual([30, 31, 32, 33])
  })

  it('프레임 11·12 는 같은 그림 28 이고 12 만 좌우로 뒤집는다 (삼진 양끝)', () => {
    expect(PTC_IMAGE_FRAMES[11][0]).toEqual({ image: 28, dx: -39, dy: -14 })
    expect(PTC_IMAGE_FRAMES[12][0].flip).toBe(true)
  })

  it('파트는 합성 프레임이 아니라 낱장 그림을 쓴다', () => {
    expect(PTC_PART_IMAGE(48)).toBe('./sprites/ptcimg/048.png')
  })
})

describe('파트 고르기 — 파트[ life % 파트수 ]', () => {
  it('수명이 줄면서 파트를 돌아가며 쓴다', () => {
    expect([5, 4, 3, 2, 1, 0].map((life) => ptcPartOf(10, life)?.image)).toEqual([50, 49, 48, 50, 49, 48])
  })

  it('파트가 하나면 늘 같은 그림이다', () => {
    expect([9, 3, 0].map((life) => ptcPartOf(11, life)?.image)).toEqual([28, 28, 28])
  })

  it('없는 프레임이면 null 이다', () => {
    expect(ptcPartOf(99, 3)).toBeNull()
  })
})

describe('A → 알파 (유력)', () => {
  it('mode 2 는 A 를 0~256 비율로 쓴다', () => {
    expect(drawAlphaOf(2, DRAW_STRENGTH_MAX)).toBe(1)
    expect(drawAlphaOf(2, 128)).toBe(0.5)
  })

  it('mode 0 은 A 를 보지 않는다 (파일 001)', () => {
    expect(drawAlphaOf(0, 0)).toBe(1)
  })

  it('A 가 범위를 벗어나도 0~1 안에 든다', () => {
    expect([drawAlphaOf(2, -10), drawAlphaOf(2, 9999)]).toEqual([0, 1])
  })
})
