// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'

afterEach(cleanup)

const 기본옵션: PitcherGameOptions = {
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  role: PITCHER_ROLE.starter,
  positionCode: 0,
  dayCounter: 2,
  isPostseason: false,
  stats: { control: 500, velocity: 500, breaking: 500, stamina: 400 },
  staminaAbility: 400,
  stamina: FULL_STAMINA,
  repertoire: { pitchMask: 0b101_0111, form: 0, magicNumber: 1 },
  magicCount: 4,
  teamMorale: 80,
  reputation: 500,
  gaugeSettingOn: false,
}

const 띄우기 = (options: Partial<PitcherGameOptions> = {}, seed = 20100901) =>
  render(
    <PitcherGameScreen
      options={{ ...기본옵션, ...options }}
      random={createSeededRandom(seed)}
      onFinish={vi.fn()}
    />,
  )

describe('투수편 경기 화면', () => {
  it('등판일이면 1단계 구질 고르기가 뜬다 (상태 0xf)', () => {
    띄우기()

    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
    expect(screen.getByText('FASTBALL')).toBeTruthy()
  })

  it('마구 칸이 남은 횟수와 함께 뜬다 (칸 5 = 0 키)', () => {
    띄우기()

    expect(screen.getByText('파이어 볼')).toBeTruthy()
    expect(screen.getByText(/마구 · 남은 4회/)).toBeTruthy()
  })

  it('구질을 고르면 2단계 코스 고르기로 넘어간다 (상태 0x10)', () => {
    띄우기()
    fireEvent.click(screen.getByText('FASTBALL'))

    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
  })

  it('환경설정 게이지가 꺼져 있으면 코스를 확정하는 순간 던진다 (원본 기본값)', () => {
    띄우기()
    fireEvent.click(screen.getByText('FASTBALL'))
    fireEvent.click(screen.getAllByRole('button', { name: /[◎·]/ })[0])

    // 다시 1단계로 돌아왔다 — 한 개를 던졌다는 뜻이다
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
  })

  it('게이지를 켜면 3단계 투구 결정이 뜬다 (상태 0x11)', () => {
    띄우기({ gaugeSettingOn: true })
    fireEvent.click(screen.getByText('FASTBALL'))
    fireEvent.click(screen.getAllByRole('button', { name: /[◎·]/ })[0])

    expect(screen.getByText('3. 투구 결정')).toBeTruthy()
    expect(screen.getByLabelText(/투구 게이지/)).toBeTruthy()
  })

  it('`#` 를 누르면 StrGAME[104] "그만 던지시겠습니까?" 가 뜬다 — 모드 3 은 교체 화면이 없다', () => {
    띄우기()
    fireEvent.click(screen.getByText('# 강판'))

    expect(screen.getByText('그만 던지시겠습니까?')).toBeTruthy()
    expect(screen.getByText('예')).toBeTruthy()
  })

  it('감독 강판이 나면 대사 창이 뜨고 던질 수 없다 (상태 0x23)', () => {
    띄우기({ stamina: 0, reputation: 0 })

    // 글만 있는 창이고 화자 머리글은 "[감독님] : " 다
    expect(screen.getByText(/\[감독님\]/)).toBeTruthy()
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
  })

  it('감독 대사 창은 확인 키 하나뿐이라 강판을 무를 수 없다', () => {
    띄우기({ stamina: 0, reputation: 0 })

    expect(screen.getByText('확인')).toBeTruthy()
    expect(screen.queryByText('아니오')).toBeNull()
  })

  it('등판일이 아니면 경기가 끝나 있어 결과 화면이 뜬다', () => {
    띄우기({ dayCounter: 3 })

    expect(screen.getByText('경기 결과')).toBeTruthy()
    // 감독 평가 글은 StrUSER_EVT 에서 온다
    expect(ORIGINAL_USER_EVENTS.length).toBeGreaterThan(38)
  })
})
