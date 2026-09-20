// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NationalCupStandings } from '@/pages/national-cup/ui/NationalCupStandings'
import { NATIONAL_CUP_ROW_COUNT, ROW_CELLS, ROW_STEP } from '@/pages/national-cup/lib/nationalCupLayout'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'

/**
 * 국가대항전 순위 화면 (나리 134 · 시즌 243) — 순위표 `0x7f070` 의 **4줄 가지**다.
 * 배치는 정규 순위표와 같은 값을 그대로 쓴다.
 */

afterEach(cleanup)

const 띄우기 = (cup: NationalCup) => render(<NationalCupStandings cup={cup} onConfirm={vi.fn()} />)

/** 그려진 줄을 위에서부터 [순위, 팀번호] 로 읽는다 */
const 줄 = (container: HTMLElement) =>
  [...container.querySelectorAll('div[data-team]')].map((node) => ({
    rank: Number(node.getAttribute('data-rank')),
    teamId: Number(node.getAttribute('data-team')),
  }))

describe('국가대항전 순위표', () => {
  it('정규 10줄이 아니라 참가 4국 4줄이다 (L+0xac 가지)', () => {
    const { container } = 띄우기(createNationalCup())
    expect(줄(container)).toHaveLength(NATIONAL_CUP_ROW_COUNT)
    expect(NATIONAL_CUP_ROW_COUNT).toBe(4)
  })

  it('첫 줄은 대한민국·일본·쿠바·미국 차례고, 이름표는 img_text 75~78 이다', () => {
    const { container } = 띄우기(createNationalCup())
    expect(줄(container).map((row) => row.teamId)).toEqual([10, 11, 12, 13])

    for (const name of ['대한민국', '일본', '쿠바', '미국']) {
      expect(screen.getByAltText(name)).toBeTruthy()
    }
    expect(screen.getByAltText('대한민국').getAttribute('src')).toContain('/img_text/frames/075.png')
    expect(screen.getByAltText('미국').getAttribute('src')).toContain('/img_text/frames/078.png')
  })

  it('승 내림차순 → 패 오름차순으로 줄을 세운다 (0xb7f0c)', () => {
    const cup: NationalCup = { ...createNationalCup(), wins: [1, 2, 2, 1], losses: [1, 0, 1, 2] }
    const { container } = 띄우기(cup)

    expect(줄(container).map((row) => row.teamId)).toEqual([11, 12, 10, 13])
    expect(줄(container).map((row) => row.rank)).toEqual([1, 2, 3, 4])
  })

  it('줄은 18px 씩 내려 그린다', () => {
    const { container } = 띄우기(createNationalCup())
    const 이름표 = [...container.querySelectorAll('div[data-team] img')]
      .filter((node) => (node.getAttribute('src') ?? '').includes('/img_text/'))
      .map((node) => Number.parseInt((node as HTMLElement).style.top, 10))

    expect(이름표[1] - 이름표[0]).toBe(ROW_STEP)
    expect(이름표[0]).toBeGreaterThanOrEqual(ROW_CELLS.team.y - ROW_STEP)
  })

  it('확인을 누르면 다음으로 넘어간다', () => {
    const onConfirm = vi.fn()
    render(<NationalCupStandings cup={createNationalCup()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
