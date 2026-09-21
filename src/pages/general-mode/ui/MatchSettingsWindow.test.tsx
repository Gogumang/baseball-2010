// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  FULL_PLAY_SETTINGS, INNING_VALUE, MATCH_SETTING_KIND,
} from '@/features/play-team-game/model/matchSettings'
import { SETTINGS_EMPTY_TEXT } from '@/pages/general-mode/lib/matchSettingsText'
import { MatchSettingsWindow } from '@/pages/general-mode/ui/MatchSettingsWindow'

/** 경기진행 설정 창 (경기정보의 '0', 일반모드만 — R4 4절) */

afterEach(cleanup)

type Props = Parameters<typeof MatchSettingsWindow>[0]

const 띄우기 = (overrides: Partial<Props> = {}) =>
  render(
    <MatchSettingsWindow
      settings={FULL_PLAY_SETTINGS}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  )

describe('단계 0 — 종류 고르기', () => {
  it('찬스·이닝·상세 셋을 보여 준다', () => {
    띄우기()

    expect(screen.getByRole('button', { name: '찬스 플레이' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '이닝 플레이' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '상세 플레이' })).toBeTruthy()
  })

  it('CLR 이면 저장하지 않고 창만 닫는다', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    띄우기({ onCancel, onConfirm })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('단계 1 — 이닝', () => {
  it('자동진행 없음·3이닝·6이닝 셋이다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '이닝 플레이' }))

    expect(screen.getByRole('button', { name: '자동진행 없음' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '3이닝 자동진행' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '6이닝 자동진행' })).toBeTruthy()
  })

  it('고른 값을 확인창을 거쳐 넘긴다', () => {
    const onConfirm = vi.fn()
    띄우기({ onConfirm })

    fireEvent.click(screen.getByRole('button', { name: '이닝 플레이' }))
    fireEvent.click(screen.getByRole('button', { name: '6이닝 자동진행' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: MATCH_SETTING_KIND.이닝,
        value: INNING_VALUE.일곱째이닝부터,
      }),
    )
  })

  it('종류를 고르는 순간 값이 0 으로 되돌아간다 (0x5ffcc)', () => {
    const onConfirm = vi.fn()
    띄우기({ settings: { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.이닝, value: 2 }, onConfirm })

    fireEvent.click(screen.getByRole('button', { name: '찬스 플레이' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ kind: MATCH_SETTING_KIND.찬스, value: 0 }),
    )
  })
})

describe('단계 1 — 상세', () => {
  it('네 줄 모두 0 이면 "최소 한가지" 로 막는다 (StrMAINMENU[126])', () => {
    const onConfirm = vi.fn()
    띄우기({ onConfirm })

    fireEvent.click(screen.getByRole('button', { name: '상세 플레이' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByText(SETTINGS_EMPTY_TEXT)).toBeTruthy()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('타순·이닝은 9칸, 주자는 3칸이고 누르면 비트가 켜진다', () => {
    const onConfirm = vi.fn()
    띄우기({ onConfirm })

    fireEvent.click(screen.getByRole('button', { name: '상세 플레이' }))
    // 투수조작 9번 칸 = 비트 8 = 9회 이후 전부(연장 포함)
    fireEvent.click(screen.getByRole('button', { name: '투수조작 9' }))
    fireEvent.click(screen.getByRole('button', { name: '수비주자 3' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: MATCH_SETTING_KIND.상세,
        pitchingInningBits: 1 << 8,
        defenseRunnerBits: 0b100,
      }),
    )
  })

  it('주자 줄은 세 칸뿐이다 (1·2·3루)', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '상세 플레이' }))

    expect(screen.queryByRole('button', { name: '공격주자 4' })).toBeNull()
    expect(screen.getByRole('button', { name: '공격주자 3' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '타자조작 9' })).toBeTruthy()
  })
})
