// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 나만의리그 **투수편 관리 화면** (원본 장면 0x106 의 상태 105·106·107).
 * 커맨드 여섯 칸은 타자편과 같고(StrHOWTO[11] · 점프표 0xcc540), 하위 메뉴 둘만 투수 것이다.
 */

afterEach(cleanup)

const 난수: RandomPort = {
  next: () => 0,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
}

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  morale: 50,
  skillIds: [],
  ...overrides,
})

interface 화면옵션 {
  readonly career?: PitcherCareer
  readonly onSave?: (career: PitcherCareer) => void
  readonly onNextGame?: () => void
  readonly onExit?: () => void
  readonly onOuting?: () => void
}

const 화면 = (options: 화면옵션 = {}) =>
  render(
    <PitcherManagementScreen
      career={options.career ?? 투수()}
      random={난수}
      onSave={options.onSave ?? (() => {})}
      onNextGame={options.onNextGame ?? (() => {})}
      onOuting={options.onOuting}
      onExit={options.onExit ?? (() => {})}
    />,
  )

/** 메시지 상자 버튼([예]·[확인])은 글자가 아니라 그림이라 이름표로 찾는다 */
const 칸 = (name: string) => screen.getByRole('button', { name })

/** 칸 글자 — `MenuList` 는 커서 '▶' 를 칸 안에 넣고, 옆에 값이 붙는 칸도 있다 */
const 칸이름 = (element: Element) => (element.textContent ?? '').replace('▶', '').trim()
const 칸이름들 = () => screen.getAllByRole('option').map(칸이름)

/** 커맨드·하위 메뉴 칸 (`role="option"`) 과 보통 버튼을 함께 찾는다 */
function 누르기(name: string) {
  const candidates = [...screen.queryAllByRole('option'), ...screen.queryAllByRole('button')]
  const found = candidates.find((element) => 칸이름(element).startsWith(name))
  if (found === undefined) throw new Error(`칸을 찾지 못했습니다: ${name}`)
  fireEvent.click(found)
}

describe('커맨드 여섯 칸 (상태 105 · 점프표 0xcc540)', () => {
  it('투수편도 [선수정보][트레이닝][휴식][외출][아이템][다음경기] 여섯이다 (StrHOWTO[11])', () => {
    화면()

    expect(칸이름들()).toEqual([
      '선수정보',
      '트레이닝',
      '휴식',
      '외출',
      '아이템',
      '다음경기',
    ])
  })

  it('[다음경기] 는 경기로 넘긴다 (원본 109 → 142 → 144 → 장면 0x104)', () => {
    const onNextGame = vi.fn()
    화면({ onNextGame })

    누르기('다음경기')

    expect(onNextGame).toHaveBeenCalledOnce()
  })

  it('하위 메뉴에서 되돌아가면 105 로, 105 에서 되돌아가면 메인 메뉴로 나간다 (취소 −16)', () => {
    const onExit = vi.fn()
    화면({ onExit })

    누르기('트레이닝')
    누르기('되돌아가기')
    expect(onExit).not.toHaveBeenCalled()

    누르기('나가기')
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('옮기지 않은 화면([외출])을 고르면 알림만 뜬다 — 핸들러를 주면 그쪽으로 간다', () => {
    const onOuting = vi.fn()
    const { unmount } = 화면()

    누르기('외출')
    expect(screen.getByText('아직 옮기지 않은 화면입니다')).toBeTruthy()
    unmount()

    화면({ onOuting })
    누르기('외출')
    expect(onOuting).toHaveBeenCalledOnce()
  })
})

describe('등판 예고 · 스태미나 · 보직 (투수편만 있는 줄)', () => {
  it('선발은 날짜 카운터가 짝수인 날 등판한다 (0xa4f60, StrHOWTO[11] "2경기마다")', () => {
    화면({ career: 투수({ gamesPlayed: 2 }) })

    // 보직 줄과 오늘 등판 줄 둘 다 '선발' 이다
    expect(screen.getAllByText('선발')).toHaveLength(2)
    expect(screen.getByText('오늘')).toBeTruthy()
  })

  it('홀수 날 선발은 대기이고 다음 선발이 한 경기 뒤다', () => {
    화면({ career: 투수({ gamesPlayed: 3 }) })

    expect(screen.getByText('대기')).toBeTruthy()
    expect(screen.getByText('1경기 뒤')).toBeTruthy()
  })

  it('구원은 늘 매 경기 8회 등판이다 (0xc1ba4)', () => {
    화면({ career: 투수({ role: PITCHER_ROLE.relief, gamesPlayed: 3 }) })

    expect(screen.getAllByText('구원')).toHaveLength(2)
    expect(screen.getByText('매 경기 8회')).toBeTruthy()
  })

  it('스태미나(+0x2c)를 퍼센트로 보여 준다 — 경기 사이에 이어지는 칸이다', () => {
    화면({ career: 투수({ stamina: 4_250 }) })

    expect(screen.getByText('42%')).toBeTruthy()
  })
})

describe('트레이닝 하위 메뉴 (상태 107 · 키 0x12d48)', () => {
  it('칸 0~3 이 제구·구속·변화·체력이고 칸 4 가 마구다', () => {
    화면()

    누르기('트레이닝')

    // 칸마다 지금 값 / 보직 한계(선발 800)가 붙는다. 칸 4 는 마구 레벨이다
    const 신인 = 투수()
    expect(칸이름들()).toEqual([
      `제구${신인.ability.control}/800`,
      `구속${신인.ability.velocity}/800`,
      `변화${신인.ability.breaking}/800`,
      `체력${신인.ability.stamina}/800`,
      '마구레벨 0/4',
    ])
  })

  it('StrMODE[85] 확인 상자에 예를 하면 훈련한 커리어를 돌려주고 105 로 돌아온다', () => {
    const onSave = vi.fn()
    화면({ onSave })

    누르기('트레이닝')
    누르기('제구')
    expect(screen.getByText('[제구훈련]을 하시겠습니까?')).toBeTruthy()
    fireEvent.click(칸('예'))

    expect(onSave).toHaveBeenCalledOnce()
    const trained = onSave.mock.calls[0][0] as PitcherCareer
    // 고정 난수 0 → bfa55(4,7) 의 최솟값 4
    expect(trained.ability.control).toBe(투수().ability.control + 4)
    expect(trained.hasActedThisCycle).toBe(true)
    // 훈련 연출이 끝나면 커맨드 줄로 돌아간다 (R9 8절 107 줄)
    expect(screen.getByText('다음경기')).toBeTruthy()
  })

  it('능력치가 보직 한계면 StrMODE[192] 로 막는다', () => {
    화면({ career: 투수({ ability: { control: 800, velocity: 100, breaking: 100, stamina: 100 } }) })

    누르기('트레이닝')
    누르기('제구')

    expect(screen.getByText('더 이상 능력치를 올릴 수 없습니다')).toBeTruthy()
  })

  it('⚠️ 원본 그대로: 사기 0 검사가 맨 앞이라 마구·구질 창(칸 4)도 열리지 않는다 (0x12d48)', () => {
    화면({ career: 투수({ morale: 0 }) })

    누르기('트레이닝')
    누르기('마구')

    expect(screen.getByText('사기가 부족하여 훈련할 수 없습니다')).toBeTruthy()
    expect(screen.queryByText('원하는 항목을 선택해주세요')).toBeNull()
  })

  it('칸 4 는 팝업 0x78 로 마구·구질을 먼저 묻고, 구질을 고르면 구질 훈련 창(108)이 열린다', () => {
    화면()

    누르기('트레이닝')
    누르기('마구')
    expect(screen.getByText('원하는 항목을 선택해주세요')).toBeTruthy()

    누르기('구질')

    // PitchTrainingScreen 이 그대로 열린다 — 새로 만들지 않는다
    expect(screen.getByText('구질 훈련')).toBeTruthy()
  })
})

describe('선수정보 하위 메뉴 (상태 106 · 점프표 0xcc69c)', () => {
  it('다섯 칸은 기본정보·장비착용·아이템/스킬·구질·기록실이다', () => {
    화면()

    누르기('선수정보')

    expect(칸이름들()).toEqual([
      '기본정보',
      '장비착용',
      '아이템/스킬',
      '구질',
      '기록실',
    ])
  })

  it('[구질] 은 팝업 0x78 을 거쳐 보기 창(123)으로 간다 — 훈련 창이 아니다', () => {
    화면()

    누르기('선수정보')
    누르기('구질')
    expect(screen.getByText('원하는 항목을 선택해주세요')).toBeTruthy()

    누르기('구질')

    expect(screen.getByText('구질 / 마구')).toBeTruthy()
    expect(screen.queryByText('구질 훈련')).toBeNull()
  })

  it('[기본정보] 는 능력치와 보직 한계를 보여 준다 (상태 119)', () => {
    화면({ career: 투수({ role: PITCHER_ROLE.relief }) })

    누르기('선수정보')
    누르기('기본정보')

    // 보직이 구원이면 체력 한계가 600 이다 (표 0xd80be × 10) — 타자처럼 타입으로 고르지 않는다
    expect(screen.getByText('200 / 600')).toBeTruthy()
  })
})

describe('휴식 (상태 105 칸 2 → 팝업 0x2a → 127)', () => {
  it('StrMODE[90] 에 예를 하면 사기가 10~15 오른다 (0x18e3c)', () => {
    const onSave = vi.fn()
    화면({ onSave })

    누르기('휴식')
    expect(screen.getByText('휴식을 취하시겠습니까?')).toBeTruthy()
    fireEvent.click(칸('예'))

    expect((onSave.mock.calls[0][0] as PitcherCareer).morale).toBe(60)
    expect(screen.getByText('사기 10 상승하였습니다')).toBeTruthy()
  })

  it('⚠️ 원본 그대로: 사기가 최고면 아프거나 다쳤어도 StrMODE[91] 로 거절한다 (0x12682)', () => {
    const onSave = vi.fn()
    화면({ career: 투수({ morale: 100, isInjured: true, injuryRemaining: 3 }), onSave })

    누르기('휴식')

    expect(screen.getByText('사기 최고 상태입니다')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('한 주기에 한 가지만 — 이미 행동했으면 막는다 (r_event_txt[176])', () => {
    화면({ career: 투수({ hasActedThisCycle: true }) })

    누르기('휴식')

    expect(screen.getByText('트레이닝·휴식·외출은 한 번에 한 가지만 할 수 있습니다')).toBeTruthy()
  })
})
