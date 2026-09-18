import { describe, expect, it } from 'vitest'
import { GAME_VERSION, HELP_SECTIONS } from '@/shared/config/helpSections'
import { ORIGINAL_HOWTO } from '@/shared/config/original/howto'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

describe('도움말 — 원본 StrHOWTO', () => {
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
