// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createNariMainMenuCursor } from '@/pages/management/model/nariMainMenuCursor'

/**
 * 나만의리그 **투수편 관리 화면** (원본 장면 0x106 의 상태 105·106·107).
 * 커맨드 여섯 칸은 타자편과 같고(StrHOWTO[11] · 점프표 0xcc540), 하위 메뉴 둘만 투수 것이다.
 */

afterEach(cleanup)

/** 고정 난수 0 — 씨앗 몫이 늘 0 이라 `rand(lo, hi)` 는 아래끝, `rand(n)` 은 0 */
const 난수: RandomPort = {
  rand: (lo, hi) => Math.min(lo, hi),
  rand9d: () => 0,
}

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  morale: 50,
  skillIds: [],
  ...overrides,
  // 얻은 스킬은 자리가 있으면 자동 장착된다(0xa4bd8) — 따로 안 주면 보유 = 장착으로 둔다
  equippedSkillIds: overrides.equippedSkillIds ?? overrides.skillIds ?? [],
})

interface 화면옵션 {
  readonly career?: PitcherCareer
  readonly onSave?: (career: PitcherCareer) => void
  readonly onNextGame?: () => void
  readonly onExit?: () => void
  readonly onOuting?: () => void
  readonly onOpenShop?: (tab: PitcherShopTab) => void
}

const 화면 = (options: 화면옵션 = {}) =>
  render(
    <PitcherManagementScreen
      career={options.career ?? 투수()}
      random={난수}
      onSave={options.onSave ?? (() => {})}
      onNextGame={options.onNextGame ?? (() => {})}
      onOuting={options.onOuting}
      onOpenShop={options.onOpenShop}
      onExit={options.onExit ?? (() => {})}
    />,
  )

/** 메시지 상자 버튼([예]·[확인])은 글자가 아니라 그림이라 이름표로 찾는다 */
const 칸 = (name: string) => screen.getByRole('button', { name })

/** 칸 글자 — 팝업 단추는 글자, 커맨드 줄 칸(0x7e418)은 그림이라 단추 이름표가 칸 id 다 */
const 칸이름 = (element: Element) => (element.textContent ?? '').replace('▶', '').trim()
const 칸이름들 = () => [...document.querySelectorAll('[data-testid="command-bar"] button')].map((button) => button.getAttribute('aria-label'))

/** 커맨드·하위 메뉴 칸 (`role="option"`) 과 보통 버튼을 함께 찾는다 */
function 누르기(name: string) {
  const candidates = [...screen.queryAllByRole('option'), ...screen.queryAllByRole('button')]
  // 바닥띠 되돌아가기(ScreenFrame)는 그림 단추라 이름표로 찾는다
  const found = candidates.find((element) => 칸이름(element).startsWith(name))
    ?? candidates.find((element) => element.getAttribute('aria-label') === name)
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

    // 105 바닥도 되돌아가기(바닥 5) — 취소(−16)는 메인 메뉴로
    누르기('되돌아가기')
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

describe('상태판 0x7d34c 모드 3 · 커맨드 줄 0x7e418 투수 표', () => {
  it('105 는 공 무늬 · 상태판 · 가운데 판(선수 하나)을 깔고, 스태미나 막대를 그린다', () => {
    const { container } = 화면({ career: 투수({ stamina: 4_250 }) })

    expect(screen.getByTestId('바탕-공무늬')).toBeTruthy()
    expect(screen.getByRole('group', { name: '상태판' })).toBeTruthy()
    expect(screen.getByTestId('스태미나막대')).toBeTruthy()
    expect(container.querySelector('[data-testid="가운데판"]')).not.toBeNull()
  })

  it('트레이닝 하위 메뉴는 투수 표 0xd4818 아이콘 · 0xd4822 이름표, 칸 4 이름표 116 은 x −6 (0x7e30c)', () => {
    const { container } = 화면()
    누르기('트레이닝')
    for (let i = 0; i < 4; i += 1) fireEvent.keyDown(window, { key: 'ArrowRight' })

    const 아이콘 = [...container.querySelectorAll('[data-testid="command-bar"] button img')].map((img) => img.getAttribute('src'))
    expect(아이콘).toEqual([
      './sprites/mode_icon/016.png', './sprites/mode_icon/017.png', './sprites/mode_icon/018.png',
      './sprites/mode_icon/012.png', './sprites/management/icon_selected_19.png',
    ])
    const 이름표 = container.querySelector('img[src$="command_label_116.png"]') as HTMLElement
    // 칸 4 (199, 236) 은 가운데 정렬 — 폭을 못 읽는 jsdom 에선 trunc(32/2) = 16 → 199 − 6 + 16 − 1
    expect(이름표.style.left).toBe('208px')
  })
})

describe('트레이닝 하위 메뉴 (상태 107 · 키 0x12d48)', () => {
  it('칸 0~3 이 제구·구속·변화·체력이고 칸 4 가 마구다', () => {
    화면()

    누르기('트레이닝')

    // 커맨드 줄 칸에는 값을 적지 않는다 (0x7e418 은 아이콘 · 이름표뿐)
    expect(칸이름들()).toEqual(['제구', '구속', '변화', '체력', '마구'])
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
    // 타자편과 같은 상세 결과 창(0x872a1)이 먼저 뜨고, 닫으면 커맨드 줄로 돌아간다 (R9 8절 107 줄)
    const 창 = screen.getByRole('dialog', { name: '상세정보' })
    expect(창.textContent).toContain('제구 4 상승하였습니다')
    fireEvent.click(창)
    expect(screen.getByRole('button', { name: '다음경기' })).toBeTruthy()
  })

  it('상세 결과 창 이름표는 img_text 340~343 · 사기 84 다 (0x87314 `0x7b984` 모드 3 갈래)', () => {
    화면()
    누르기('트레이닝')
    누르기('구속')
    fireEvent.click(칸('예'))

    const 그림들 = Array.from(screen.getByRole('dialog', { name: '상세정보' }).querySelectorAll('img'))
      .map((image) => image.getAttribute('src') ?? '')
    for (const frame of ['340', '341', '342', '343', '084']) {
      expect(그림들).toContain(`./sprites/img_text/frames/${frame}.png`)
    }
  })

  it('창을 닫을 때 부상 판정 0x1b4c4 를 굴린다 — 사기 30 이하면 일반 열 5%, 고정 난수 0 이면 다친다', () => {
    const onSave = vi.fn()
    화면({ career: 투수({ morale: 20 }), onSave })
    누르기('트레이닝')
    누르기('제구')
    fireEvent.click(칸('예'))
    expect(onSave).toHaveBeenCalledOnce()

    fireEvent.keyDown(window, { key: 'Enter' })

    const injured = onSave.mock.calls[1][0] as PitcherCareer
    expect([injured.isInjured, injured.injuryRemaining]).toEqual([true, 3])
    expect(screen.getByText('부상을 당했습니다.')).toBeTruthy()
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

  it('[아이템/스킬] 은 스킬 창(122)이다 — 비트 8 부터 투수 이름(비트+16)으로 늘어놓고, 해제하면 장착만 끈다 (0x8457c · 0xa4b04)', () => {
    const onSave = vi.fn()
    화면({ career: 투수({ skillIds: [0, 8] }), onSave })

    누르기('선수정보')
    누르기('아이템/스킬')
    // 비트 8 = 표 24 "신선함" (타자편이면 "의외성")
    expect(screen.queryByRole('button', { name: '의외성' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '신선함' }))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('해제하시겠습니까')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    const saved = onSave.mock.calls[0][0] as PitcherCareer
    expect(saved.equippedSkillIds).toEqual([0])
    expect(saved.skillIds).toEqual([0, 8])
  })

  it('스킬 창이 가득 차면 5000 G 확장을 묻고, "예" 면 G 를 깎고 단계 1(상한 8)로 저장한다 (0x1484c)', () => {
    const onSave = vi.fn()
    const plus = [0, 1, 6, 7, 8, 9]
    화면({ career: 투수({ skillIds: [...plus, 10], equippedSkillIds: plus, gamePoint: 6000 }), onSave })

    누르기('선수정보')
    누르기('아이템/스킬')
    // 비트 10 = 표 26 "끈기"
    fireEvent.click(screen.getByRole('button', { name: '끈기' }))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('5000')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onSave.mock.calls[0][0]).toMatchObject({ skillSlotLevel: 1, gamePoint: 1000 })
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('8개로 확장')
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
    // 사기 결과 창(상세 창 0x872a1)을 닫아야 회복 판정이 돈다 (콜백 0x1d671)
    fireEvent.click(screen.getByRole('dialog', { name: '상세정보' }))

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
    // 탭 1 → 108 창을 거친다 (진입 0x17730 — 커서는 배운 수 L = 0 칸)
    expect(screen.getByText('마구 훈련')).toBeTruthy()
    expect(screen.queryByText(/가 소모됩니다/)).toBeNull()

    키('Enter')
    // StrMODE[66] "%d G포인트가 소모됩니다" — 창의 확인 키 0x17828 이 띄운다 (색 바꿈 `!c` 로 글이 나뉜다)
    expect(screen.getByText(/가 소모됩니다/)).toBeTruthy()
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
    expect(칸이름들()).toContain('마구')
  })

  it('키만으로 마구 훈련 한 바퀴를 끝까지 돈다 — 확인 상자도 키로 닫힌다', () => {
    const onSave = vi.fn()
    엄격화면({ onSave })

    키로마구칸까지()
    키('Enter')
    // 108 창 — 커서 칸(L = 0)을 확인한다
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

describe('[아이템] 110 하위 메뉴 → 111 장비 상점 · [장비착용] 121', () => {
  it('[아이템] 은 곧장 상점이 아니라 장착·서브·GP 하위 메뉴(110)를 띄운다', () => {
    화면({ onOpenShop: vi.fn() })

    누르기('아이템')

    expect(칸이름들()).toEqual(['장착', '서브', 'GP'])
  })

  it('[장착] 은 장비 상점으로, [장비착용] 은 장비착용 창으로 간다', () => {
    const onOpenShop = vi.fn()
    화면({ onOpenShop })

    누르기('아이템')
    누르기('장착')
    expect(onOpenShop).toHaveBeenLastCalledWith('장착')

    누르기('되돌아가기')
    누르기('선수정보')
    누르기('장비착용')
    expect(onOpenShop).toHaveBeenLastCalledWith('착용')
  })

  it('[서브]·[GP] 도 같은 111 상점으로 간다 — 고른 칸이 창 종류 1·2 다 (키 0x11478)', () => {
    const onOpenShop = vi.fn()
    화면({ onOpenShop })

    누르기('아이템')
    누르기('서브')
    expect(onOpenShop).toHaveBeenLastCalledWith('서브')

    누르기('GP')
    expect(onOpenShop).toHaveBeenLastCalledWith('GP')
  })
})

describe('하위 메뉴로 돌아오기 — 111 → 110 · 121 → 106 · 하위 창 → 106 (0x107e0 · 0x11530 은 커서를 안 건드린다)', () => {
  const 다시띄우기 = (mainCursor: ReturnType<typeof createNariMainMenuCursor>, onOpenShop: (tab: PitcherShopTab) => void) =>
    render(
      <PitcherManagementScreen career={투수({ hasActedThisCycle: true })} random={난수} onSave={() => {}} onNextGame={() => {}}
        onOpenShop={onOpenShop} onExit={() => {}} mainCursor={mainCursor} />,
    )
  const 커서칸 = () => [...document.querySelectorAll('[data-testid="command-bar"] button')]
    .find((button) => button.getAttribute('aria-current') === 'true')?.getAttribute('aria-label')

  it('상점에서 돌아오면 아이템 하위 메뉴 고른 칸에 서고, 그 취소가 105 진입(이전 110 — 행동함이어도 아이템 칸)이다', () => {
    const mainCursor = createNariMainMenuCursor()
    const onOpenShop = vi.fn()
    다시띄우기(mainCursor, onOpenShop)
    누르기('아이템')
    누르기('GP')
    expect(onOpenShop).toHaveBeenLastCalledWith('GP')
    cleanup()

    다시띄우기(mainCursor, onOpenShop)
    expect(칸이름들()).toEqual(['장착', '서브', 'GP'])
    expect(커서칸()).toBe('GP')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(칸이름들()).toHaveLength(6)
    expect(커서칸()).toBe('아이템')
    cleanup()

    다시띄우기(mainCursor, onOpenShop)
    expect(칸이름들()).toHaveLength(6)
  })

  it('121 장비착용 취소 → 106 장비착용 칸 (0x17ad0 17aee → 0x6a · 0x11530 은 이전 ≠ 105 면 커서를 안 건드린다)', () => {
    const mainCursor = createNariMainMenuCursor()
    const onOpenShop = vi.fn()
    다시띄우기(mainCursor, onOpenShop)
    누르기('선수정보')
    누르기('장비착용')
    expect(onOpenShop).toHaveBeenLastCalledWith('착용')
    cleanup()

    다시띄우기(mainCursor, onOpenShop)
    expect(칸이름들()).toEqual(['기본정보', '장비착용', '아이템/스킬', '구질', '기록실'])
    expect(커서칸()).toBe('장비착용')
  })

  it('하위 창(124 기록실)에서 106 으로 돌아오면 그 칸 그대로 — 하위 창이 커맨드 줄을 덮었다 걷혀도 첫 칸이 아니다', () => {
    다시띄우기(createNariMainMenuCursor(), vi.fn())
    누르기('선수정보')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(커서칸()).toBe('기록실')
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(칸이름들()).toEqual([])
    누르기('되돌아가기')
    expect(커서칸()).toBe('기록실')
  })
})

describe('머리띠·바닥 (0x16928 · 0x166cc)', () => {
  const 바닥표시 = (container: HTMLElement) =>
    [...container.querySelectorAll('img[data-footer-mark]')].map((node) => Number((node as HTMLElement).dataset.footerMark))

  it('105 는 바닥 5 — 되돌아가기만', () => {
    const { container } = 화면()
    expect(바닥표시(container)).toEqual([])
    expect(screen.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
  })

  it('기본정보(119)는 바닥 0x87 — "#닉네임"(프레임 8)·"0상세정보"(프레임 1)·되돌아가기 (0x166f2)', () => {
    const { container } = 화면()
    누르기('선수정보')
    누르기('기본정보')
    expect(바닥표시(container)).toEqual([8, 1])
    expect(screen.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
  })
})

describe('능력치 상세 창(120) — 기본정보에서 \'0\' (키 0x1056c · 0x1b654)', () => {
  it("'0' 으로 열면 투수 이름표 표와 글이 뜨고 바닥은 5, 되돌아가기는 119 로", () => {
    const { container } = 화면({ career: 투수({ morale: 20 }) })
    누르기('선수정보')
    누르기('기본정보')
    fireEvent.keyDown(window, { key: '0' })

    expect(screen.getByRole('dialog', { name: '상세정보' })).toBeTruthy()
    expect(container.querySelector('img[src$="img_text/frames/340.png"]')).not.toBeNull()
    expect(screen.getByText('사기')).toBeTruthy()
    expect(container.querySelectorAll('img[data-footer-mark]').length).toBe(0)

    누르기('되돌아가기')
    expect(screen.queryByRole('dialog', { name: '상세정보' })).toBeNull()
    expect(container.querySelectorAll('img[data-footer-mark]').length).toBe(2)
  })
})

describe('108 마구 창(탭 1) — 진입 0x17730 · 확인 키 0x17828 (탭 0 필살타법과 같은 갈래)', () => {
  const 마구창까지 = () => {
    누르기('트레이닝')
    누르기('마구')
    누르기('마구')
    expect(screen.getByText('마구 훈련')).toBeTruthy()
  }
  const 커서칸 = () => screen.getAllByRole('button').filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.textContent)

  it('처음 커서는 min(배운 수 L, 3) 칸이다 (177c8~17806)', () => {
    화면({ career: 투수({ magicLevel: 2, popularity: 2000, gamePoint: 5000 }) })
    마구창까지()
    const 칸들 = screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'))
    expect(칸들.findIndex((button) => button.getAttribute('aria-pressed') === 'true')).toBe(2)
  })

  it('배운 칸은 StrMODE[63] · 앞 칸이 남았으면 [64] · 인기도가 모자라면 [62] (그 칸 값)', () => {
    화면({ career: 투수({ magicLevel: 1, popularity: 600, gamePoint: 5000 }) })
    마구창까지()
    const 칸들 = () => screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'))

    fireEvent.click(칸들()[0])
    expect(screen.getByText(/이미 훈련 완료된 스킬입니다/)).toBeTruthy()
    fireEvent.click(칸('확인'))

    // 칸 2: 인기도 600 < 1000 → [62] 가 [64] 보다 먼저다
    fireEvent.click(칸들()[2])
    expect(screen.getByText(/필요한 인기도 : 1000/)).toBeTruthy()
    fireEvent.click(칸('확인'))
  })

  it('G 부족 [65] 의 "예"(→ 139)는 결제 없이 떠난 길 — G 그대로 108 을 다시 들어서 커서가 L 칸이다', () => {
    const onSave = vi.fn()
    화면({ career: 투수({ magicLevel: 1, popularity: 2000, gamePoint: 100 }), onSave })
    마구창까지()
    const 칸들 = () => screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'))
    // 커서를 칸 3 으로 옮겨 둔다 — 139 에서 돌아오면 108 진입이 다시 L 칸에 둔다
    fireEvent.pointerEnter(칸들()[3])
    fireEvent.click(칸들()[1])
    expect(screen.getByText(/G포인트가 부족합니다/)).toBeTruthy()
    fireEvent.click(칸('예'))

    expect(screen.getByText('마구 훈련')).toBeTruthy()
    expect(칸들().findIndex((button) => button.getAttribute('aria-pressed') === 'true')).toBe(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('취소는 107(트레이닝)로 — 0x17828 17a76 → 0x6b', () => {
    화면()
    마구창까지()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('마구 훈련')).toBeNull()
    expect(칸이름들()).toContain('마구')
    expect(커서칸()).toEqual([])
  })
})
