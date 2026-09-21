// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonSummaryScreen } from '@/pages/season/ui/SeasonSummaryScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { advancePostseason, startPostseason } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { TEAMS } from '@/shared/config/original/teams'

/**
 * 시즌 결산 (0xef, 갱신 0x6900 · 그리기 0xb7b8 = 대진표 0x853ac) — P4 4b 확정.
 * 우승 팝업 StrMODE[137] → 보상 [197]/[198] → 리그 1위 G [223] 차례를 못박는다.
 */

afterEach(cleanup)

const 기록 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  inPostseason: true,
  ...덮어쓰기,
})

/** 팀 0·1·2·3 이 1~4위, 1위(팀 0)가 끝까지 이겨 우승한 시리즈 */
function 우승시리즈(): PostseasonSeries {
  let series = startPostseason([0, 1, 2, 3])
  for (let game = 0; game < 3; game += 1) series = advancePostseason(series, 3) // 준PO 4위 승
  for (let game = 0; game < 3; game += 1) series = advancePostseason(series, 3) // PO 4위 승
  for (let game = 0; game < 4; game += 1) series = advancePostseason(series, 0) // KS 1위 승
  return series
}

const 확인 = () => fireEvent.click(screen.getByRole('button', { name: 'OK' }))

describe('한국시리즈 우승 보상', () => {
  it('우승이면 [137] → [197] 인기도 +25 · 평판 +30 · 소지금 +4000만 이다', () => {
    const onApply = vi.fn()
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록()}
        series={우승시리즈()}
        postseasonRank={0}
        leagueFirstAwardedBits={0}
        onApplyKoreanSeriesReward={onApply}
        onLeagueFirstAward={vi.fn()}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    // StrMODE[137] "한국시리즈 우승! [팀]"
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain(TEAMS[0].name)

    확인()
    expect(onApply).toHaveBeenCalledWith({
      popularity: 25, reputation: 30, money: 40, gamePoint: 0, messageId: 197,
    })
    // 문구의 소지금은 만원 단위 — 40 × 100 = 4000
    const 보상글 = screen.getByRole('dialog', { name: '알림' }).textContent ?? ''
    expect(보상글).toContain('인기도 +25')
    expect(보상글).toContain('평판 +30')
    expect(보상글).toContain('4000만')

    확인()
    expect(onFinish).toHaveBeenCalled()
  })

  it('준우승이면 [198] 15 · 15 · 1500만 이다', () => {
    const onApply = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록()}
        series={우승시리즈()}
        postseasonRank={1}
        leagueFirstAwardedBits={0}
        onApplyKoreanSeriesReward={onApply}
        onLeagueFirstAward={vi.fn()}
        onFinish={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인()

    expect(onApply).toHaveBeenCalledWith({
      popularity: 15, reputation: 15, money: 15, gamePoint: 0, messageId: 198,
    })
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('1500만')
  })

  it('3위 아래면 보상 문구도 보상도 없이 바로 끝난다', () => {
    const onApply = vi.fn()
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록()}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0}
        onApplyKoreanSeriesReward={onApply}
        onLeagueFirstAward={vi.fn()}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인()

    expect(onApply).not.toHaveBeenCalled()
    expect(onFinish).toHaveBeenCalled()
  })
})

describe('리그 1위 누적 G (StrMODE[223])', () => {
  it('1위 3회면 1000 G 를 한 번 준다', () => {
    const onAward = vi.fn()
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts: 3 })}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0}
        onApplyKoreanSeriesReward={vi.fn()}
        onLeagueFirstAward={onAward}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인() // [137] 우승 팝업 → 순위 2 라 보상 없이 리그 1위 검사로

    const 글 = screen.getByRole('dialog', { name: '알림' }).textContent ?? ''
    expect(글).toContain('1위 3회')
    expect(글).toContain('1000 G포인트')

    확인()
    expect(onAward).toHaveBeenCalledWith({ threshold: 3, gamePoint: 1000, bit: 0 })
    expect(onFinish).toHaveBeenCalled()
  })

  it('1위 10회인데 아직 아무 비트도 안 켜졌으면 3회분 → 10회분 을 하나씩 잇달아 준다', () => {
    const onAward = vi.fn()
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts: 10 })}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0}
        onApplyKoreanSeriesReward={vi.fn()}
        onLeagueFirstAward={onAward}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인()
    확인() // 3회분
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('5000 G포인트')
    확인() // 10회분

    expect(onAward).toHaveBeenNthCalledWith(1, { threshold: 3, gamePoint: 1000, bit: 0 })
    expect(onAward).toHaveBeenNthCalledWith(2, { threshold: 10, gamePoint: 5000, bit: 1 })
    expect(onFinish).toHaveBeenCalled()
  })

  it('이미 받은 비트는 다시 주지 않는다 (저장 전역 +0x145)', () => {
    const onAward = vi.fn()
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts: 3 })}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0b1}
        onApplyKoreanSeriesReward={vi.fn()}
        onLeagueFirstAward={onAward}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인()

    expect(onAward).not.toHaveBeenCalled()
    expect(onFinish).toHaveBeenCalled()
  })
})

describe('아직 안 끝난 포스트시즌', () => {
  it('대진표만 그리고 "경기" 로 다음 시리즈 경기로 간다', () => {
    const onContinue = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록()}
        series={startPostseason([0, 1, 2, 3])}
        postseasonRank={0}
        leagueFirstAwardedBits={0}
        onApplyKoreanSeriesReward={vi.fn()}
        onLeagueFirstAward={vi.fn()}
        onContinuePostseason={onContinue}
        onFinish={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: '포스트시즌 대진표' })).toBeDefined()
    expect(document.body.textContent).toContain('준플레이오프 진행 중')

    fireEvent.click(screen.getByRole('button', { name: '경기' }))
    expect(onContinue).toHaveBeenCalled()
  })
})
