// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import {
  BURST_HEADLINE_BAND, BURST_PROPOSAL_LINE, BURST_RESULT_HEADLINE, BURST_WINDOW, burstLineIndexOf,
} from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import { BURST_TEXT_LINE } from '@/entities/burst-mission/model/burstMissionJudge'
import type { OriginalBurstLine } from '@/shared/config/original/burstMissions'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

/**
 * 돌발미션 창 (경기 장면 상태 0x1b — K 4절 1-6).
 * 제안 대사(줄 0) 한 모습과, 결과 대사(줄 1/2/3) + "돌발미션 성공!!"·"실패!!" 한 모습이다.
 */

afterEach(cleanup)

/** 원본 타자 표 첫 행의 대사 4줄 — 줄 0 에 !cFFFF00 색이 들어 있다 */
const 원본줄 = ORIGINAL_BURST_TABLES.BATTER.lines[0] as readonly OriginalBurstLine[]

const 띄우기 = (
  judgement: Parameters<typeof BurstMissionWindow>[0]['judgement'],
  overrides: Partial<Parameters<typeof BurstMissionWindow>[0]> = {},
) => {
  const onClose = overrides.onClose ?? vi.fn()
  render(<BurstMissionWindow lines={원본줄} judgement={judgement} {...overrides} onClose={onClose} />)
  return { onClose, dialog: screen.getByRole('dialog', { name: '돌발미션' }) }
}

describe('돌발미션 창 세 모습', () => {
  it('제안은 줄 0 대사만 띄우고 결과 문구가 없다', () => {
    const { dialog } = 띄우기(null)

    expect(burstLineIndexOf(null)).toBe(BURST_PROPOSAL_LINE)
    expect(dialog.textContent).toContain(stripGameMarkup(원본줄[BURST_PROPOSAL_LINE].text))
    expect(dialog.textContent).not.toContain('돌발미션')
  })

  it('성공은 줄 1 대사와 "돌발미션 성공!!"(0xd5114) 을 함께 띄운다', () => {
    const { dialog } = 띄우기('성공')

    expect(BURST_TEXT_LINE.성공).toBe(1)
    expect(dialog.textContent).toContain(stripGameMarkup(원본줄[1].text))
    expect(screen.getByText('돌발미션 성공!!')).toBeTruthy()
  })

  it('실패는 줄 2 대사와 "돌발미션 실패!!"(0xd512c) 을 함께 띄운다', () => {
    const { dialog } = 띄우기('실패')

    expect(BURST_TEXT_LINE.실패).toBe(2)
    expect(dialog.textContent).toContain(stripGameMarkup(원본줄[2].text))
    expect(screen.getByText('돌발미션 실패!!')).toBeTruthy()
  })

  it('무효는 줄 3 대사만 나간다 — 원본에 무효 문구가 없다', () => {
    const { dialog } = 띄우기('무효')

    expect(BURST_TEXT_LINE.무효).toBe(3)
    expect(BURST_RESULT_HEADLINE.무효).toBeNull()
    expect(dialog.textContent).toContain(stripGameMarkup(원본줄[3].text))
    expect(dialog.textContent).not.toContain('돌발미션')
  })
})

describe('돌발미션 창 배치', () => {
  it('결과 문구 띠는 game_ui 프레임 8 을 가로 가운데(34) 에 둔다', () => {
    const { dialog } = 띄우기('성공')
    const band = dialog.querySelector('img') as HTMLImageElement

    expect(band.getAttribute('src')).toBe('./sprites/game_ui/frames/008.png')
    expect(band.style.left).toBe(`${BURST_HEADLINE_BAND.x}px`)
    expect(BURST_HEADLINE_BAND.x).toBe(34)
  })

  it('제안 모습에는 띠 그림이 없다', () => {
    const { dialog } = 띄우기(null)
    expect(dialog.querySelector('img')).toBeNull()
  })

  it('대사 판은 근사 좌표 (8, 212) 에 224×96 이다', () => {
    const { dialog } = 띄우기(null)
    const panel = dialog.querySelector(`div[style*="${BURST_WINDOW.width}px"]`) as HTMLElement

    expect(panel.style.left).toBe(`${BURST_WINDOW.x}px`)
    expect(panel.style.top).toBe(`${BURST_WINDOW.y}px`)
    expect(panel.style.height).toBe(`${BURST_WINDOW.height}px`)
  })
})

describe('돌발미션 창 마크업', () => {
  it('!cFFFF00 은 노란 글씨가 된다 — 목표 낱말만 노랗다', () => {
    띄우기(null)

    // 원본 줄 0 = "!cFFFF00안타!cFFFFFF 쳐주지 않겠나? …" — !cFFFFFF 는 기본색으로 되돌린다
    expect(screen.getByText('안타').style.color).toBe('rgb(255, 255, 0)')
    expect(screen.getByText(/쳐주지 않겠나/).style.color).toBe('')
  })

  it('결과 문구도 마크업 색을 그대로 쓴다 (0xd5114 의 !cffff00)', () => {
    띄우기('성공')
    expect(screen.getByText('돌발미션 성공!!').style.color).toBe('rgb(255, 255, 0)')
  })

  it('!N 은 줄을 바꾼다', () => {
    const 두줄: readonly OriginalBurstLine[] = [
      { speaker: 3, expression: 0, text: '첫 줄!N둘째 줄' },
      ...원본줄.slice(1),
    ]
    const { dialog } = 띄우기(null, { lines: 두줄 })
    const paragraphs = [...dialog.querySelectorAll('p')].map((p) => p.textContent)

    expect(paragraphs).toEqual(['첫 줄', '둘째 줄'])
  })
})

describe('돌발미션 창 닫기', () => {
  it('아무 키나 누르면 다음으로 간다 (상태 0x1b → 0xf)', () => {
    const { onClose } = 띄우기(null)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('화면을 눌러도 닫힌다', () => {
    const { onClose, dialog } = 띄우기('성공')
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
