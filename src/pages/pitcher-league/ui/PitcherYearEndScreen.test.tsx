// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherYearEndScreen } from '@/pages/pitcher-league/ui/PitcherYearEndScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/** 연말 은퇴 선택 — 원본 이벤트 502 의 갈림길 (상태 132) */

afterEach(cleanup)

const 투수 = () => ({ ...createPitcherCareer('테스트'), season: 9 })

describe('투수편 연말 은퇴 선택', () => {
  it('502 의 선택지 두 개를 띄운다', () => {
    render(<PitcherYearEndScreen career={투수()} onContinueCareer={() => {}} onRetire={() => {}} />)

    expect(screen.getByText('9년차 연말')).toBeDefined()
    expect(screen.getByText('연봉 협상한다 (다음연차 진행)')).toBeDefined()
    expect(screen.getByText('은퇴한다 (명예의 전당 등록)')).toBeDefined()
  })

  it('"연봉 협상한다" 는 다음 연차로, "은퇴한다" 는 엔딩으로 보낸다', () => {
    const onContinueCareer = vi.fn()
    const onRetire = vi.fn()
    render(<PitcherYearEndScreen career={투수()} onContinueCareer={onContinueCareer} onRetire={onRetire} />)

    fireEvent.click(screen.getByText('연봉 협상한다 (다음연차 진행)'))
    expect(onContinueCareer).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('은퇴한다 (명예의 전당 등록)'))
    expect(onRetire).toHaveBeenCalledTimes(1)
  })
})
