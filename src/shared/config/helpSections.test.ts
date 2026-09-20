import { describe, expect, it } from 'vitest'
import {
  GAME_INQUIRY_CHAPTER, GAME_VERSION, HELP_CHAPTER_LENGTHS, HELP_LAST_BROWSABLE_CHAPTER, HELP_SECTIONS,
} from '@/shared/config/helpSections'
import { ORIGINAL_HOWTO } from '@/shared/config/original/howto'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

describe('도움말 — 원본 StrHOWTO', () => {
  it('장은 원본 표 0xd0b18 = [5,5,7,6,3,6,4] 그대로 일곱이다 (합 36)', () => {
    expect(HELP_CHAPTER_LENGTHS).toEqual([5, 5, 7, 6, 3, 6, 4])
    expect(HELP_CHAPTER_LENGTHS.reduce((sum, count) => sum + count, 0)).toBe(36)
    expect(HELP_SECTIONS).toHaveLength(7)
    // 홈런더비·미션모드·스페셜·환경설정은 한 장([26]~[31])으로 붙어 있다
    expect(HELP_SECTIONS[5].pages).toHaveLength(6)
    // 게임문의(장 6)는 제 메뉴(상태 10)에서만 열려 메인 도움말은 장 5 까지 돈다
    expect(HELP_LAST_BROWSABLE_CHAPTER).toBe(5)
    expect(GAME_INQUIRY_CHAPTER).toBe(6)
  })

  it('빈 항목([33])을 뺀 원문 35쪽을 빠짐없이 한 번씩 담는다', () => {
    const pages = HELP_SECTIONS.flatMap((section) => section.pages)
    const expected = ORIGINAL_HOWTO.filter((page) => page !== '')

    expect(pages).toHaveLength(35)
    expect([...pages].sort()).toEqual([...expected].sort())
  })

  it('각 묶음 첫 쪽의 제목이 묶음 이름을 담는다', () => {
    const firstTitles = HELP_SECTIONS.map((section) => stripGameMarkup(section.pages[0]).split('\n')[0])

    expect(firstTitles[2]).toBe('<나만의리그에 대하여>')
    expect(firstTitles[3]).toBe('<시즌모드에 대하여>')
  })

  it('해석되지 않은 마크업(!L·!N·!c)이 화면 글자로 남지 않는다', () => {
    const leftovers = HELP_SECTIONS.flatMap((section) =>
      section.pages.filter((page) => /![LNCc]/.test(stripGameMarkup(page, [GAME_VERSION]))),
    )

    expect(leftovers.map((page) => page.slice(0, 20))).toEqual([])
  })
})
