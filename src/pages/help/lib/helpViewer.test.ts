import { describe, expect, it } from 'vitest'
import { openHelpViewer, stepHelpViewer } from '@/pages/help/lib/helpViewer'

describe('StrHOWTO 뷰어 키 0x637d0 — 장 고르기(+0xe5 = 1) / 쪽 보기(+0xe5 = 0)', () => {
  it('0x63688 은 장 고르기로 연다, 상태 10(잠김)만 쪽 보기로 연다', () => {
    expect(openHelpViewer(0, false)).toEqual({ isChoosingChapter: true, chapter: 0, page: 0 })
    expect(openHelpViewer(6, true)).toEqual({ isChoosingChapter: false, chapter: 6, page: 0 })
  })

  it('장 고르기: 좌우 = 장(0~5 되감기, 쪽 0) · OK·아래 = 쪽 보기 · CLR = 닫기 · 위 = 없음', () => {
    const 고르기 = { isChoosingChapter: true, chapter: 5, page: 0 }
    expect(stepHelpViewer(고르기, '오른', false, 6)).toEqual({ ...고르기, chapter: 0 })
    expect(stepHelpViewer({ ...고르기, chapter: 0 }, '왼', false, 5)).toEqual({ ...고르기, chapter: 5 })
    expect(stepHelpViewer(고르기, 'OK', false, 6)).toEqual({ ...고르기, isChoosingChapter: false })
    expect(stepHelpViewer(고르기, '아래', false, 6)).toEqual({ ...고르기, isChoosingChapter: false })
    expect(stepHelpViewer(고르기, '위', false, 6)).toBe(고르기)
    expect(stepHelpViewer(고르기, 'CLR', false, 6)).toBe('닫기')
  })

  it('쪽 보기: 좌우 = 쪽(되감기) · CLR = 장 고르기로 · OK = 없음', () => {
    const 보기 = { isChoosingChapter: false, chapter: 0, page: 4 }
    expect(stepHelpViewer(보기, '오른', false, 5)).toEqual({ ...보기, page: 0 })
    expect(stepHelpViewer({ ...보기, page: 0 }, '왼', false, 5)).toEqual({ ...보기, page: 4 })
    expect(stepHelpViewer(보기, 'CLR', false, 5)).toEqual({ ...보기, isChoosingChapter: true })
    expect(stepHelpViewer(보기, 'OK', false, 5)).toBe(보기)
  })

  it('잠김(+0x45c): OK·아래는 아무 일 없고 CLR 은 곧장 닫기, 좌우는 잠금을 안 본다', () => {
    const 잠김 = openHelpViewer(6, true)
    expect(stepHelpViewer(잠김, 'OK', true, 3)).toBe(잠김)
    expect(stepHelpViewer(잠김, 'CLR', true, 3)).toBe('닫기')
    expect(stepHelpViewer(잠김, '오른', true, 3)).toEqual({ ...잠김, page: 1 })
  })
})
