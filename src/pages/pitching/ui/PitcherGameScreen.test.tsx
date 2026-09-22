// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'

afterEach(cleanup)

/**
 * 수비 화면에 무엇이 넘어가는지 적어 두려고 **원본을 그대로 감싼다** (그림은 원본이 그린다).
 * ⭐ 투수편은 사람이 **수비**라 `side="수비"` 여야 한다 — 표 0절이 "공격이면 0x5331c 주루 /
 * 수비면 0x533c8 송구" 라고 가른다.
 */
const { 수비화면props } = vi.hoisted(() => ({ 수비화면props: vi.fn() }))

vi.mock('@/pages/defense/ui/DefensePlayback', async (importOriginal) => {
  const 원본 = await importOriginal<typeof import('@/pages/defense/ui/DefensePlayback')>()
  return {
    ...원본,
    DefensePlayback: (props: Parameters<typeof 원본.DefensePlayback>[0]) => {
      수비화면props(props)
      return <원본.DefensePlayback {...props} />
    },
  }
})

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

describe('경기 중 메뉴 (표 0xcfcfc 행 2 — 나만의리그)', () => {
  it('네 칸뿐이다 — 자동진행·다시하기가 없다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    for (const 칸 of ['계속', '조작방법', '설정', '나가기']) {
      expect(screen.getByText(칸)).toBeTruthy()
    }
    expect(screen.queryByText('자동진행')).toBeNull()
    expect(screen.queryByText('다시하기')).toBeNull()
  })

  it('메뉴가 떠 있는 동안에는 투구 단계가 가려진다', () => {
    띄우기()
    fireEvent.keyDown(window, { key: '*' })

    expect(screen.queryByText('1. 구질 선택')).toBeNull()
  })
})

/**
 * 원본은 타구가 뜬 순간 경기 장면이 상태 0x17(수비 인플레이)로 넘어가 공이 멈출 때까지 같은
 * 루프를 돌며 **매 갱신 눌린 키를 읽는다** (R10 · I 문서). 웹 투수편도 이제 같은 모양이다 —
 * 진행기를 화면에서 한 틱씩 돌리고, 다 돌면 그 결과가 그때 경기 상태가 된다.
 */
describe('내가 던진 인플레이 타구 — 수비 화면이 실시간으로 돈다 (상태 0x17)', () => {
  /** 한 개 던진다 — 구질 FASTBALL → 코스 가운데 (게이지가 꺼져 있어 코스 확정이 곧 투구다) */
  function 한개던지기() {
    fireEvent.click(screen.getByText('FASTBALL'))
    fireEvent.click(screen.getAllByRole('button', { name: /[◎·]/ })[0])
  }

  /** 인플레이 타구가 떠서 수비 화면이 설 때까지 던진다 */
  function 수비화면까지던지기(최대 = 80) {
    for (let pitch = 0; pitch < 최대; pitch += 1) {
      if (screen.queryByText('1. 구질 선택') === null) return
      한개던지기()
    }
  }

  it('인플레이 타구가 뜨면 타석 대신 수비 화면이 서고, 그 동안 다음 공이 못 나간다', () => {
    띄우기({}, 3)
    수비화면까지던지기()

    // 원본이 0x17 을 도는 동안 0xf(구질 고르기)로 안 돌아가는 그 자리다
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
    expect(screen.getAllByTestId('defense-background-left').length).toBeGreaterThan(0)
  })

  it('⭐ 사람이 잡는 쪽은 "수비" 다 — 타자편과 정반대로 송구 키를 읽는다 (0x533c8)', () => {
    수비화면props.mockClear()
    띄우기({}, 3)
    수비화면까지던지기()

    const props = 수비화면props.mock.calls.at(-1)?.[0]
    expect(props).toBeDefined()
    expect(props.side).toBe('수비')
    // 미리 계산해 둔 틱 재생이 아니라 **실시간으로 돌리는** 갈래다
    expect(props.input).toBeDefined()
    expect(props.ticks).toBeUndefined()
  })

  it('수비 화면이 다 돌면 붙든 상태가 풀려 타석으로 돌아온다', () => {
    vi.useFakeTimers()
    try {
      띄우기({}, 3)
      수비화면까지던지기()
      expect(screen.queryByText('1. 구질 선택')).toBeNull()

      for (let 갱신 = 0; 갱신 < 400 && screen.queryByText('1. 구질 선택') === null; 갱신 += 1) {
        act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      }

      expect(screen.getByText('1. 구질 선택')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
