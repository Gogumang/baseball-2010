import { describe, expect, it } from 'vitest'
import { openHelpViewer, stepHelpViewer } from '@/pages/help/lib/helpViewer'

describe('StrHOWTO 뷰어 키 0x637d0 — 장 고르기(+0xe5 = 1) / 쪽 보기(+0xe5 = 0)', () => {
  it('0x63688 은 장 고르기로 연다, 상태 10(잠김)만 쪽 보기로 연다', () => {
    expect(openHelpViewer(0, false)).toEqual({ isChoosingChapter: true, chapter: 0, page: 0, scrollTop: 0 })
    expect(openHelpViewer(6, true)).toEqual({ isChoosingChapter: false, chapter: 6, page: 0, scrollTop: 0 })
  })

  it('장 고르기: 좌우 = 장(0~5 되감기, 쪽 0) · OK·아래 = 쪽 보기 · CLR = 닫기 · 위 = 없음', () => {
    const 고르기 = { isChoosingChapter: true, chapter: 5, page: 0, scrollTop: 0 }
    expect(stepHelpViewer(고르기, '오른', false, 6)).toEqual({ ...고르기, chapter: 0 })
    expect(stepHelpViewer({ ...고르기, chapter: 0 }, '왼', false, 5)).toEqual({ ...고르기, chapter: 5 })
    expect(stepHelpViewer(고르기, 'OK', false, 6)).toEqual({ ...고르기, isChoosingChapter: false })
    expect(stepHelpViewer(고르기, '아래', false, 6)).toEqual({ ...고르기, isChoosingChapter: false })
    expect(stepHelpViewer(고르기, '위', false, 6)).toBe(고르기)
    expect(stepHelpViewer(고르기, 'CLR', false, 6)).toBe('닫기')
  })

  it('쪽 보기: 좌우 = 쪽(되감기) · CLR = 장 고르기로 · OK = 없음', () => {
    const 보기 = { isChoosingChapter: false, chapter: 0, page: 4, scrollTop: 0 }
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

describe('쪽 보기의 줄 넘기기 0x61ce4 — 위·아래·\'2\'·\'8\' (보이는 줄 11)', () => {
  const 보기 = { isChoosingChapter: false, chapter: 5, page: 3, scrollTop: 0 }

  it('줄이 11 보다 많으면 아래로 한 줄씩, 끝(줄수 − 11)에서 멈춘다', () => {
    const 한줄 = stepHelpViewer(보기, '아래', false, 6, 13)
    expect(한줄).toEqual({ ...보기, scrollTop: 1 })
    const 두줄 = stepHelpViewer(한줄 as typeof 보기, '8', false, 6, 13)
    expect(두줄).toEqual({ ...보기, scrollTop: 2 })
    expect(stepHelpViewer(두줄 as typeof 보기, '아래', false, 6, 13)).toBe(두줄)
    expect(stepHelpViewer(두줄 as typeof 보기, '2', false, 6, 13)).toEqual({ ...보기, scrollTop: 1 })
  })

  it('줄이 11 이하면 움직이지 않는다 · 장 고르기에서는 줄 넘기기를 안 부른다', () => {
    expect(stepHelpViewer(보기, '아래', false, 6, 11)).toBe(보기)
    const 고르기 = { ...보기, isChoosingChapter: true }
    expect(stepHelpViewer(고르기, '8', false, 6, 30)).toBe(고르기)
    expect(stepHelpViewer(고르기, '아래', false, 6, 30)).toEqual({ ...고르기, isChoosingChapter: false })
  })

  it('쪽·장을 바꾸면 0x635d0 이 맨 윗줄을 0 으로 되돌린다 — CLR 로 장 고르기에 가면 그대로', () => {
    const 내림 = { ...보기, scrollTop: 2 }
    expect(stepHelpViewer(내림, '오른', false, 6, 30)).toEqual({ ...보기, page: 4, scrollTop: 0 })
    expect(stepHelpViewer(내림, 'CLR', false, 6, 30)).toEqual({ ...내림, isChoosingChapter: true })
  })
})
