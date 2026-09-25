// @vitest-environment jsdom
import { StrictMode } from 'react'
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

  it('123 창 탭 1 — 마구 칸을 고르면 StrMODE[70] 을 묻고 레코드 +0x18 에 번호를 넣는다 (0x17cec)', () => {
    const onSave = vi.fn()
    화면({ career: 투수({ magicLevel: 2 }), onSave })

    누르기('선수정보')
    누르기('구질')
    누르기('마구')

    // 칸 넷은 표 0xcc368 = [1,2,3,4] 이름 그대로다 (번호 4 는 폼 0 → 샤이닝 볼)
    누르기('웨이브 볼')
    expect(screen.getByText('[웨이브 볼] 을 사용하시겠습니까?')).toBeTruthy()
    fireEvent.click(칸('예'))

    expect((onSave.mock.calls[0][0] as PitcherCareer).selectedMagicNumber).toBe(2)
  })

  it('아직 배우지 않은 칸은 StrMODE[71], 이미 쓰는 칸은 StrMODE[69] 로 막는다', () => {
    const onSave = vi.fn()
    const { unmount } = 화면({ career: 투수({ magicLevel: 1, selectedMagicNumber: 1 }), onSave })

    누르기('선수정보')
    누르기('구질')
    누르기('마구')

    누르기('웨이브 볼')
    expect(screen.getByText('트레이닝 완료 후 사용할 수 있습니다')).toBeTruthy()

    누르기('파이어 볼')
    expect(screen.getByText('현재 사용 중인 스킬입니다')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
    unmount()
  })

  it('123 창 탭 2 — 구질을 고르면 StrMODE[73] 을 묻고, 이미 쓰는 구질은 [72] 로 막는다', () => {
    const onSave = vi.fn()
    화면({ onSave })

    누르기('선수정보')
    누르기('구질')
    누르기('구질')

    // 등록이 무조건 주는 FASTBALL (0xb6d5e)
    누르기('FASTBALL')
    expect(screen.getByText('해당 구질을 사용하시겠습니까?')).toBeTruthy()
    fireEvent.click(칸('예'))
    expect((onSave.mock.calls[0][0] as PitcherCareer).selectedPitchType).toBe(1)
  })

  it('[기록실] 은 StrMODE[74] 두 갈래 팝업(0x80)을 거쳐 124 로 간다', () => {
    화면()

    누르기('선수정보')
    누르기('기록실')
    expect(screen.getByText('보고 싶은 기록을 선택해주세요')).toBeTruthy()

    // 장면+0x164 = 0 → 기본 엔트리 목록 창(0x5cfec) 자리 — 주인공이 투수 0번(선발)이다
    누르기('팀 엔트리')
    expect(screen.getByText('투수 엔트리')).toBeTruthy()
    expect(screen.getByText('0 테스트')).toBeTruthy()
    expect(screen.queryByText('1년차 성적')).toBeNull()
  })

  it('두 번째 갈래는 나리 판 목록(0x5796c) 자리 — 내 투수 성적이다', () => {
    화면()

    누르기('선수정보')
    누르기('기록실')
    누르기('선수 성적')

    expect(screen.getByText('1년차 성적')).toBeTruthy()
    expect(screen.getByText('통산 성적')).toBeTruthy()
    expect(screen.queryByText('투수 엔트리')).toBeNull()
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

  it('결과 창을 닫을 때 회복 판정 0x1b308 을 굴린다 (질병 60% · 부상 30%)', () => {
    const onSave = vi.fn()
    화면({ career: 투수({ isInjured: true, injuryRemaining: 3, isSick: true, illnessName: '감기' }), onSave })

    누르기('휴식')
    fireEvent.click(칸('예'))
    // 사기 결과 창을 닫아야 회복 판정이 돈다
    fireEvent.click(칸('확인'))

    // 고정 난수 0 → 질병·부상 둘 다 낫는다
    const recovered = onSave.mock.calls[1][0] as PitcherCareer
    expect([recovered.isSick, recovered.isInjured]).toEqual([false, false])
    expect(screen.getByText(/부상에서 회복 되었습니다/)).toBeTruthy()
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

describe('칭호 목록 창 (기본정보 119 → 129)', () => {
  const 칭호투수 = () => 투수({ titleIds: ['이름 없는 신인', '닥터 K'], equippedTitle: 50 })

  /**
   * ⚠️ 원작 **설명서** StrHOWTO[15] 는 "(#) 키" 라 적었지만 119 의 키 처리 0x1056c 가 보는 값은
   * **'*'(0x2a)** 다 (R9 301~303). 설명서와 코드가 어긋나는 자리라 코드 쪽을 그대로 옮긴다.
   */
  it("기본정보에서 '*' 를 누르면 얻은 칭호가 번호 오름차순으로 뜬다", () => {
    화면({ career: 칭호투수() })
    누르기('선수정보')
    누르기('기본정보')

    expect(screen.queryByRole('dialog', { name: '칭호' })).toBeNull()
    fireEvent.keyDown(window, { key: '*' })

    const 창 = screen.getByRole('dialog', { name: '칭호' })
    expect([...창.querySelectorAll('button')].map((칸) => 칸.textContent)).toEqual([
      '이름 없는 신인',
      '닥터 K',
    ])
  })

  it("'*' 를 다시 누르면 119 로 돌아간다 (0x11f9a)", () => {
    화면({ career: 칭호투수() })
    누르기('선수정보')
    누르기('기본정보')

    fireEvent.keyDown(window, { key: '*' })
    fireEvent.keyDown(window, { key: '*' })

    expect(screen.queryByRole('dialog', { name: '칭호' })).toBeNull()
    // 기본정보 카드는 그대로 남는다
    expect(screen.getByText('기본정보')).toBeTruthy()
  })

  it('고르면 선수 +0x1c4 가 바뀌어 저장된다 — 팝업은 이름 + StrMODE[138] 이다', () => {
    const onSave = vi.fn()
    화면({ career: 칭호투수(), onSave })
    누르기('선수정보')
    누르기('기본정보')
    fireEvent.keyDown(window, { key: '*' })

    fireEvent.click(screen.getByRole('button', { name: '이름 없는 신인' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].equippedTitle).toBe(0)
    expect(screen.getByText(/닉네임이 적용되었습니다/)).toBeTruthy()
  })

  it('장착 없음(−1)이면 기본정보 카드에 칭호 줄이 없다 (0x7d5cc)', () => {
    화면({ career: 투수({ titleIds: ['이름 없는 신인'] }) })
    누르기('선수정보')
    누르기('기본정보')

    expect(screen.queryByText('칭호')).toBeNull()
  })
})

/**
 * 두 갈래 팝업(0x78 구질/마구 · 0x80 기록실)의 **키**.
 *
 * 웹판은 팝업이 뜨면 커맨드 목록(`MenuList`)을 화면에서 내리는데, 팝업 쪽에 키를 보는 데가 없어
 * **키보드로 몰면 여기서 아무 키도 안 먹혀 앞으로도 뒤로도 못 갔다**(마우스로만 진행됐다).
 * 원본은 이 창이 키를 직접 본다 — 좌우로 `장면+0x166` 토글, 확인으로 고르기, 취소(−16)로 닫기
 * (그리기 0x190f8 · 키 0x19398).
 *
 * ⚠️ 이 묶음은 **`StrictMode` 로** 띄운다 — 고리를 두 번 붙였다 떼는 자리에서 놓친 버그가 있었다.
 */
describe('두 갈래 팝업의 키 (0x19398 · StrictMode)', () => {
  const 훈련가능투수 = () => 투수({ morale: 100, popularity: 5_000, gamePoint: 9_000 })

  const 엄격화면 = (options: 화면옵션 = {}) =>
    render(
      <StrictMode>
        <PitcherManagementScreen
          career={options.career ?? 훈련가능투수()}
          random={난수}
          onSave={options.onSave ?? (() => {})}
          onNextGame={options.onNextGame ?? (() => {})}
          onOuting={options.onOuting}
          onExit={options.onExit ?? (() => {})}
        />
      </StrictMode>,
    )

  const 키 = (key: string) => fireEvent.keyDown(window, { key })
  /** 관리(105) → 트레이닝(107) → 칸 4(마구) 까지 **키만으로** 간다 */
  const 키로마구칸까지 = () => {
    키('ArrowDown')
    키('Enter')
    for (let i = 0; i < 4; i += 1) 키('ArrowDown')
    키('Enter')
  }

  it('마우스 없이 키만으로 팝업까지 오고, 확인 키가 첫 칸(마구)을 고른다', () => {
    엄격화면()

    키로마구칸까지()
    expect(screen.getByText('원하는 항목을 선택해주세요')).toBeTruthy()

    키('Enter')

    // StrMODE[66] "%d G포인트가 소모됩니다" — 마구 훈련 확인 팝업까지 왔다
    expect(screen.getByText(/G포인트가 소모됩니다/)).toBeTruthy()
  })

  it('좌우 키가 `+0x166` 을 토글한다 — 오른쪽으로 옮기면 [구질] 이 열린다', () => {
    엄격화면()

    키로마구칸까지()
    키('ArrowRight')
    키('Enter')

    expect(screen.getByText('구질 훈련')).toBeTruthy()
  })

  it('좌우는 칸 수로 감긴다 — 왼쪽 한 번이면 마지막 칸(구질)이다', () => {
    엄격화면()

    키로마구칸까지()
    키('ArrowLeft')
    키('Enter')

    expect(screen.getByText('구질 훈련')).toBeTruthy()
  })

  it('취소(−16)는 팝업만 닫고 트레이닝 목록으로 돌려보낸다', () => {
    엄격화면()

    키로마구칸까지()
    키('Escape')

    expect(screen.queryByText('원하는 항목을 선택해주세요')).toBeNull()
    expect(screen.queryByText('구질 훈련')).toBeNull()
    // 107 목록이 그대로 있다 (칸 4 는 마구 레벨을 옆에 적는다)
    expect(칸이름들()).toContain('마구레벨 0/4')
  })

  it('키만으로 마구 훈련 한 바퀴를 끝까지 돈다 — 확인 상자도 키로 닫힌다', () => {
    const onSave = vi.fn()
    엄격화면({ onSave })

    키로마구칸까지()
    키('Enter')
    // StrMODE[66] 확인 팝업의 [예]
    키('Enter')

    expect(onSave).toHaveBeenCalled()
    expect(screen.getByText(/마구 훈련 1\/4회/)).toBeTruthy()

    // 결과 알림을 닫으면 105 허브로 돌아온다
    키('Enter')
    expect(칸이름들()).toEqual(['선수정보', '트레이닝', '휴식', '외출', '아이템', '다음경기'])
  })

  it('[기록실] 팝업(0x80)도 같은 키로 돈다 — 오른쪽 칸이 나리 판 성적이다', () => {
    엄격화면()

    // 105 → 106 선수정보 (커서 0 번 칸)
    키('Enter')
    // 106 칸 4 [기록실]
    for (let i = 0; i < 4; i += 1) 키('ArrowDown')
    키('Enter')
    expect(screen.getByText('보고 싶은 기록을 선택해주세요')).toBeTruthy()

    키('ArrowRight')
    키('Enter')

    expect(screen.queryByText('보고 싶은 기록을 선택해주세요')).toBeNull()
  })
})
