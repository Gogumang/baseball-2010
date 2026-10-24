// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SubstitutionWindow } from '@/pages/team-game/ui/SubstitutionWindow'
import type { SubstitutionRow } from '@/pages/team-game/lib/substitutionWindow'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'

afterEach(() => {
  cleanup()
  resetTouchKeyOffersForTest()
})

const 줄 = (index: number, name: string): SubstitutionRow => ({
  index, name, badge: null, rate: null, count: null, stamina: null, fielderType: null,
})

describe('교체 창 0x384b8 — 터치 CLR (r194)', () => {
  it("'#' · CLR 글자 자리가 없어 '취소' 상황 버튼(Escape)을 낸다 — 투명 칸은 그대로", () => {
    const onCancel = vi.fn()
    render(
      <SubstitutionWindow kind="투수" ourTeamId={0} current={줄(0, '선발')} bench={[줄(1, '불펜')]}
        detailOf={() => null} onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    expect(touchKeyOffersNow()).toContainEqual({ key: 'Escape', label: '취소' })
    fireEvent.click(screen.getByRole('button', { name: '# 취소' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
