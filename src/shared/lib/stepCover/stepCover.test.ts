import { describe, expect, it } from 'vitest'
import { blackStepCoverOpacityOf, blackStepCoverPixel565, colorStepCoverOpacityOf, colorStepCoverPixel565 } from '@/shared/lib/stepCover/stepCover'

describe('단계 덮기 [0x15605d4] · [0x15605d0]', () => {
  it('검정 0x9aac4 는 화면을 단계/16 만큼 남긴다 — 단계 0 은 완전 검정', () => {
    expect(blackStepCoverOpacityOf(0)).toBe(1)
    expect(blackStepCoverOpacityOf(1)).toBe(15 / 16)
    expect(blackStepCoverOpacityOf(8)).toBe(8 / 16)
    expect(blackStepCoverOpacityOf(15)).toBe(1 / 16)
  })

  it('색 0x9a52c 는 색 몫 (단계 + 1)/16 — 단계 15 는 색 그대로', () => {
    expect(colorStepCoverOpacityOf(0)).toBe(1 / 16)
    expect(colorStepCoverOpacityOf(3)).toBe(4 / 16)
    expect(colorStepCoverOpacityOf(15)).toBe(1)
  })

  it('감싸는 0x9b234 · 0x9b3f4 는 단계가 0~15 밖이면 안 칠한다', () => {
    expect(blackStepCoverOpacityOf(16)).toBe(0)
    expect(colorStepCoverOpacityOf(16)).toBe(0)
    expect(blackStepCoverOpacityOf(-1)).toBe(0)
  })
})

describe('단계 덮기 몸통 픽셀 — 0x9aac4 · 0x9a52c 갈래를 직접 떠 옮긴 표 (r280)', () => {
  /** 갈래마다 (화면 항 · 색 항) 의 밀기 — 마스크는 밀기 1 · 2 · 3 · 4 에 0xf7de · 0xe79c · 0xc718 · 0x8610 */
  const MASK_OF: Readonly<Record<number, number>> = { 1: 0xf7de, 2: 0xe79c, 3: 0xc718, 4: 0x8610 }
  // 0x9a52c 표 0xd5f48 의 갈래 0x9a54c · 0x9a598 · 0x9a5dc · 0x9a628 · 0x9a664 · 0x9a6b0 · 0x9a6f4 · 0x9a740 · 0x9a774 · 0x9a7c0 ·
  // 0x9a804 · 0x9a864 · 0x9a8a0 · 0x9a8ea · 0x9a92c (단계 15 = 0x9a976 색 그대로)
  const COLOR_CASES: readonly (readonly [screen: readonly number[], color: readonly number[]])[] = [
    [[1, 2, 3, 4], [4]],
    [[1, 2, 3], [3]],
    [
      [1, 2, 4],
      [3, 4],
    ],
    [[1, 2], [2]],
    [
      [1, 3, 4],
      [2, 4],
    ],
    [
      [1, 3],
      [2, 3],
    ],
    [
      [1, 4],
      [2, 3, 4],
    ],
    [[1], [1]],
    [
      [2, 3, 4],
      [1, 4],
    ],
    [
      [2, 3],
      [1, 3],
    ],
    [
      [2, 4],
      [1, 3, 4],
    ],
    [[2], [1, 2]],
    [
      [3, 4],
      [1, 2, 4],
    ],
    [[3], [1, 2, 3]],
    [[4], [1, 2, 3, 4]],
  ]
  // 0x9aac4 표 0xd5f88 의 갈래 0x9aae2(0 검정) · 0x9ab06 · … · 0x9add0
  const BLACK_CASES: readonly (readonly number[])[] = [
    [],
    [4],
    [3],
    [3, 4],
    [2],
    [2, 4],
    [2, 3],
    [2, 3, 4],
    [1],
    [1, 4],
    [1, 3],
    [1, 3, 4],
    [1, 2],
    [1, 2, 4],
    [1, 2, 3],
    [1, 2, 3, 4],
  ]
  const terms = (pixel: number, shifts: readonly number[]) => shifts.reduce((sum, shift) => sum + ((pixel & MASK_OF[shift]) >> shift), 0)
  const samples = [0, 0xffff, 0x0841, 0xf800, 0x07e0, 0x001f, 0x8410, 0x1234, 0xabcd, 0x7bef, 0x39e7, 0xc618]

  it('색 덮기 — 단계 s 는 화면 (15 − s)/16 · 색 (s + 1)/16 의 마스크 항 합, 단계 15 는 색 그대로', () => {
    for (let step = 0; step < 15; step += 1) {
      for (const screen of samples) {
        for (const color of samples) {
          const [screenShifts, colorShifts] = COLOR_CASES[step]
          expect(colorStepCoverPixel565(step, color, screen)).toBe(terms(screen, screenShifts) + terms(color, colorShifts))
        }
      }
    }
    expect(colorStepCoverPixel565(15, 0x1234, 0xffff)).toBe(0x1234)
    expect(colorStepCoverPixel565(16, 0x1234, 0xffff)).toBe(0xffff)
  })

  it('검정 덮기 — 단계 s 는 화면을 s/16 만큼(채널마다 내림) 남긴다', () => {
    for (let step = 0; step < 16; step += 1) {
      for (const screen of samples) expect(blackStepCoverPixel565(step, screen)).toBe(terms(screen, BLACK_CASES[step]))
    }
    // 단계 9(외출 지도 밤): 흰색 → R 31>>1 + 31>>4 = 16 · G 63>>1 + 63>>4 = 34 — CSS 9/16 의 17.4 · 35.4 보다 어둡다
    expect(blackStepCoverPixel565(9, 0xffff)).toBe((16 << 11) | (34 << 5) | 16)
    expect(blackStepCoverPixel565(16, 0x1234)).toBe(0x1234)
  })
})
