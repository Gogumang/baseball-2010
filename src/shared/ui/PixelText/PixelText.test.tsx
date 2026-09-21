// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PixelText, pieceMaskStyle } from '@/shared/ui/PixelText/PixelText'
import { ASCII_ATLAS, HANGUL_ATLAS } from '@/shared/lib/font/atlas'

afterEach(cleanup)

/** jsdom 에는 canvas 가 없으므로 조각을 DOM 으로 찍고 그 DOM 을 본다 */
function 조각들(): HTMLElement[] {
  return Array.from(screen.getByRole('img').querySelectorAll('span'))
}

describe('PixelText', () => {
  it('한글 한 글자를 초성·중성 조각 두 개로 찍는다', () => {
    render(<PixelText>{'가'}</PixelText>)
    const pieces = 조각들()
    expect(pieces).toHaveLength(2)
    expect(pieces.every((piece) => piece.dataset.atlas === 'hangul')).toBe(true)
    expect(pieces[0].style.width).toBe(`${HANGUL_ATLAS.glyphWidth}px`)
    expect(pieces[0].style.height).toBe(`${HANGUL_ATLAS.glyphHeight}px`)
  })

  it('받침이 있으면 조각이 셋이다', () => {
    render(<PixelText>{'강'}</PixelText>)
    expect(조각들()).toHaveLength(3)
  })

  it('영문은 영문 아틀라스에서 한 조각만 뜬다', () => {
    render(<PixelText>{'A'}</PixelText>)
    const pieces = 조각들()
    expect(pieces).toHaveLength(1)
    expect(pieces[0].dataset.atlas).toBe('ascii')
    expect(pieces[0].style.width).toBe(`${ASCII_ATLAS.glyphWidth}px`)
  })

  it('2350자 밖 글자는 아무것도 안 찍고 자리도 안 차지한다', () => {
    render(<PixelText>{'뷁'}</PixelText>)
    expect(조각들()).toHaveLength(0)
    expect(screen.getByRole('img').style.width).toBe('0px')
  })

  it('글 전체를 aria-label 로 읽을 수 있게 남긴다', () => {
    render(<PixelText>{'게임빌 2010 프로야구'}</PixelText>)
    expect(screen.getByLabelText('게임빌 2010 프로야구')).toBeDefined()
  })

  it('자간 prop 으로 앱 글꼴(1)과 글상자 글꼴(2)을 고른다', () => {
    const { unmount } = render(<PixelText spacing="app">{'가나'}</PixelText>)
    expect(조각들()[2].style.left).toBe('10px')
    unmount()
    render(<PixelText spacing="textBox">{'가나'}</PixelText>)
    expect(조각들()[2].style.left).toBe('11px')
  })

  it('줄바꿈은 줄높이 + 줄간만큼 내려간다', () => {
    render(<PixelText spacing="app">{'A\nB'}</PixelText>)
    expect(조각들().map((piece) => piece.style.top)).toEqual(['0px', '14px'])
  })

  it('정수 배율은 좌표·칸·마스크를 함께 키운다', () => {
    render(<PixelText scale={2}>{'가나'}</PixelText>)
    const pieces = 조각들()
    expect(pieces[2].style.left).toBe('20px')
    expect(pieces[0].style.width).toBe('18px')
    expect(screen.getByRole('img').style.height).toBe('22px')
  })

  it('마스크는 아틀라스 칸을 정확히 집는다', () => {
    // 강 = 초성 ㄱ(벌 5) · 중성 ㅏ(벌 1) · 종성 ㅇ(벌 0)
    const 가운데조각 = { atlas: 'hangul', column: 0, row: HANGUL_ATLAS.jungRow + 1, x: 0, y: 0, width: 9, height: 11 } as const
    expect(pieceMaskStyle(가운데조각, 1)).toMatchObject({
      WebkitMaskImage: `url(${HANGUL_ATLAS.atlas})`,
      WebkitMaskSize: `${HANGUL_ATLAS.atlasWidth}px ${HANGUL_ATLAS.atlasHeight}px`,
      WebkitMaskPosition: `0px ${-(HANGUL_ATLAS.jungRow + 1) * 11}px`,
    })
    // 배율은 칸 크기와 자리를 같이 키운다
    expect(pieceMaskStyle(가운데조각, 2)).toMatchObject({
      WebkitMaskSize: `${HANGUL_ATLAS.atlasWidth * 2}px ${HANGUL_ATLAS.atlasHeight * 2}px`,
      WebkitMaskPosition: `0px ${-(HANGUL_ATLAS.jungRow + 1) * 22}px`,
    })
  })

  it('아틀라스 PNG 가 public 에 실제로 있다', async () => {
    const { existsSync } = await import('node:fs')
    for (const url of [HANGUL_ATLAS.atlas, ASCII_ATLAS.atlas]) {
      expect(existsSync(`public/${url.replace(/^\.\//, '')}`)).toBe(true)
    }
  })
})
