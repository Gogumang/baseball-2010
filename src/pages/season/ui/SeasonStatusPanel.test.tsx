// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import { SeasonStatusPanel } from '@/pages/season/ui/SeasonStatusPanel'

afterEach(cleanup)

const 그림들 = (container: HTMLElement) => [...container.querySelectorAll('img')].map((img) => img.src)

describe('시즌 상태판 — 0x7d34c 모드 2', () => {
  it('이름표 넷째 칸은 332 "연봉" 대신 227 "관중", 그 옆에 344 "명" 을 붙인다', () => {
    const record = { ...startNewSeason(0, '테스트').record, lastAttendance: 870 }
    const { container } = render(<SeasonStatusPanel record={record} teamMorale={50} hour={12} />)
    const 글 = 그림들(container).filter((src) => src.includes('img_text/frames/')).map((src) => src.slice(-7, -4))
    expect(글).toEqual(expect.arrayContaining(['065', '314', '327', '302', '331', '227', '344', '084']))
    expect(글).not.toContain('332')
  })

  it('관중 숫자는 num 20번대로 박스 9 오른끝 − 11 에 붙는다', () => {
    const record = { ...startNewSeason(0, '테스트').record, lastAttendance: 870 }
    const { container } = render(<SeasonStatusPanel record={record} teamMorale={50} hour={12} />)
    const 숫자 = [...container.querySelectorAll('img')]
      .filter((img) => img.style.top === '183px' && img.src.includes('/sprites/num/') && parseInt(img.style.left, 10) >= 157)
      .map((img) => [img.src.slice(-7, -4), img.style.left])
    // 8 7 0 → 폭 6 + 자간 1 씩, 오른끝 204 에서 21 만큼 앞
    expect(숫자).toEqual([['028', '183px'], ['027', '190px'], ['020', '197px']])
  })
})
