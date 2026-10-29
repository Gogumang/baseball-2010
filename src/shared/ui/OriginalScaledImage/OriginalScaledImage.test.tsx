// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OriginalScaledImage } from '@/shared/ui/OriginalScaledImage/OriginalScaledImage'

afterEach(cleanup)

describe('OriginalScaledImage — 0x663c4 버퍼를 제 크기로 찍는 0x66431', () => {
  it('줄이기 전(캔버스 없음)에는 원본 그림을 폭 × 높이 로 그 자리에 둔다', () => {
    render(<OriginalScaledImage alt="로고" src="./sprites/team_logo/000.png" boxWidth={35} boxHeight={34} style={{ left: 3, top: 4 }} />)
    const image = screen.getByAltText('로고') as HTMLImageElement
    expect(image.getAttribute('src')).toBe('./sprites/team_logo/000.png')
    expect(image.style.width).toBe('35px')
    expect(image.style.height).toBe('34px')
    expect(image.style.left).toBe('3px')
    expect(image.dataset.originalScaled).toBeUndefined()
  })
})
