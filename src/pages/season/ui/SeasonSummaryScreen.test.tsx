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
 * 진입(0x6900)마다 리그 1위 G [223] 하나(또는 0x29 해금 알림 → 0x87e8 의 G 하나), "결과" 키로 우승 팝업 StrMODE[137]
 * → 보상 [197]/[198] → 끝(0x87b4) 차례를 못박는다.
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
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록()}
        series={우승시리즈()}
        postseasonRank={0}
        leagueFirstAwardedBits={0}
        entry={null}
        onLeagueFirstAward={vi.fn()}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    // StrMODE[137] "한국시리즈 우승! [팀]"
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain(TEAMS[0].name)

    확인()
    // 보상은 [137] 이 닫힐 때가 아니라 [197] 이 닫힐 때 더한다 (0x85ec 꼬리표 9 갈래 0x86dc~)
    expect(onFinish).not.toHaveBeenCalled()
    // 문구의 소지금은 만원 단위 — 40 × 100 = 4000
    const 보상글 = screen.getByRole('dialog', { name: '알림' }).textContent ?? ''
    expect(보상글).toContain('인기도 +25')
    expect(보상글).toContain('평판 +30')
    expect(보상글).toContain('4000만')

    확인()
    expect(onFinish).toHaveBeenCalledWith({
      popularity: 25, reputation: 30, money: 40, gamePoint: 0, messageId: 197,
    })
  })

  it('준우승이면 [198] 15 · 15 · 1500만 이다', () => {
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록()}
        series={우승시리즈()}
        postseasonRank={1}
        leagueFirstAwardedBits={0}
        entry={null}
        onLeagueFirstAward={vi.fn()}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인()

    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('1500만')
    확인()
    expect(onFinish).toHaveBeenCalledWith({
      popularity: 15, reputation: 15, money: 15, gamePoint: 0, messageId: 198,
    })
  })

  it('3위 아래면 보상 문구도 보상도 없이 바로 끝난다', () => {
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록()}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0}
        entry={null}
        onLeagueFirstAward={vi.fn()}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인()

    expect(onFinish).toHaveBeenCalledWith(null)
  })
})

describe('리그 1위 누적 G (StrMODE[223]) — 결산 진입(0x6900)마다 하나', () => {
  const 진입 = (serial: number, opensAutobotBat = false) => ({ serial, opensAutobotBat })

  it('1위 1회면 진입하자마자 3000 G 팝업이 뜨고 그 자리에서 준다 (Q2 5-1 · 0x6a5e 팝업 → 0x6a64~ 지급)', () => {
    const onAward = vi.fn()
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts: 1 })}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0}
        entry={진입(1)}
        onLeagueFirstAward={onAward}
        onFinish={onFinish}
      />,
    )

    const 글 = screen.getByRole('dialog', { name: '알림' }).textContent ?? ''
    expect(글).toContain('1위 1회')
    expect(글).toContain('3000 G포인트')
    expect(onAward).toHaveBeenCalledWith({ threshold: 1, gamePoint: 3000, bit: 0 })

    // 팝업이 떠 있는 동안 "결과" 키는 먹지 않는다
    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('3000 G포인트')

    확인() // 꼬리표 1 — 닫혀도 아무 가지에도 안 걸려 대진표로
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
    expect(onFinish).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인() // [137] → 순위 2 라 보상 없이 곧장 0x87b4
    expect(onAward).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalled()
  })

  it('1위 10회인데 아무 비트도 안 켜졌으면 진입마다 하나씩 준다 — 한 진입에서 잇달아 주지 않는다', () => {
    const onAward = vi.fn()
    const 그리기 = (bits: number, serial: number) => (
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts: 10 })}
        series={startPostseason([0, 1, 2, 3])}
        postseasonRank={2}
        leagueFirstAwardedBits={bits}
        entry={진입(serial)}
        onLeagueFirstAward={onAward}
        onFinish={vi.fn()}
      />
    )
    const { rerender, unmount } = render(그리기(0, 1))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('3000 G포인트')
    확인()
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
    expect(onAward).toHaveBeenCalledTimes(1)

    // 같은 진입에서 값이 바뀌어도 다시 보지 않는다
    rerender(그리기(0b1, 1))
    expect(onAward).toHaveBeenCalledTimes(1)
    unmount()

    // 포스트시즌 경기를 치르고 다시 들어오면(새 진입) 다음 칸
    render(그리기(0b1, 2))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('10000 G포인트')
    확인()
    cleanup()
    render(그리기(0b11, 3))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('20000 G포인트')

    expect(onAward).toHaveBeenNthCalledWith(1, { threshold: 1, gamePoint: 3000, bit: 0 })
    expect(onAward).toHaveBeenNthCalledWith(2, { threshold: 5, gamePoint: 10000, bit: 1 })
    expect(onAward).toHaveBeenNthCalledWith(3, { threshold: 10, gamePoint: 20000, bit: 2 })
  })

  it('이미 받은 비트는 다시 주지 않는다 (저장 전역 +0x145)', () => {
    const onAward = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts: 1 })}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0b1}
        entry={진입(1)}
        onLeagueFirstAward={onAward}
        onFinish={vi.fn()}
      />,
    )

    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
    expect(onAward).not.toHaveBeenCalled()
  })

  it('진입 효과가 아직 안 돌았으면(entry null) 아무것도 띄우지 않는다', () => {
    const onAward = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts: 1 })}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0}
        entry={null}
        onLeagueFirstAward={onAward}
        onFinish={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
    expect(onAward).not.toHaveBeenCalled()
  })

  it('한국시리즈 보상 팝업(꼬리표 9·10)이 닫히면 G 검사 없이 곧장 0x87b4 로 끝난다', () => {
    const onAward = vi.fn()
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts: 1 })}
        series={우승시리즈()}
        postseasonRank={0}
        leagueFirstAwardedBits={0}
        entry={null}
        onLeagueFirstAward={onAward}
        onFinish={onFinish}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인() // [137]
    확인() // [197]
    expect(onAward).not.toHaveBeenCalled()
    expect(onFinish).toHaveBeenCalled()
  })
})

describe('0x29 가 새로 열린 결산 진입 (0x69ce → 0x6ac8 · 닫힘 0x87e8)', () => {
  const 띄우기 = (regularSeasonFirsts: number) => {
    const onAward = vi.fn()
    const onFinish = vi.fn()
    render(
      <SeasonSummaryScreen
        record={기록({ regularSeasonFirsts })}
        series={우승시리즈()}
        postseasonRank={2}
        leagueFirstAwardedBits={0}
        entry={{ serial: 1, opensAutobotBat: true }}
        onLeagueFirstAward={onAward}
        onFinish={onFinish}
      />,
    )
    return { onAward, onFinish }
  }

  it('해금 알림 창이 먼저 뜨고, 닫으면 리그 1위 G 를 한 번 본다 — 문턱 미달이면 아무것도 없다', () => {
    const { onAward, onFinish } = 띄우기(0)
    expect(document.body.textContent).toContain('오토봇 배트')
    expect(onAward).not.toHaveBeenCalled()
    확인()
    expect(onAward).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인()
    expect(onAward).not.toHaveBeenCalled()
    expect(onFinish).toHaveBeenCalled()
  })

  it('문턱을 넘었으면 알림을 닫을 때 하나만 준다(꼬리표 1 이라 이어지지 않는다)', () => {
    const { onAward, onFinish } = 띄우기(20)
    expect(onAward).not.toHaveBeenCalled() // 진입의 G 검사는 건너뛴다
    확인() // 해금 알림
    expect(document.body.textContent).toContain('G포인트')
    expect(onAward).toHaveBeenCalledTimes(1)
    expect(onAward.mock.calls[0]?.[0]).toMatchObject({ bit: 0 })
    확인() // G 팝업
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '결과' }))
    확인()
    expect(onAward).toHaveBeenCalledTimes(1)
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
        entry={null}
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

describe('머리띠·바닥 (0xef — 0x853ac 끝 0x7f4ec)', () => {
  it('시즌모드 제목(그림 22) · 바닥 1 — 되돌아가기가 없다', () => {
    const { container } = render(
      <SeasonSummaryScreen record={기록()} series={우승시리즈()} postseasonRank={0} leagueFirstAwardedBits={0}
        entry={null} onLeagueFirstAward={vi.fn()} onFinish={vi.fn()} />,
    )
    expect(container.querySelector('img[src*="game_frame/022"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
  })
})
