// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { DEFAULT_SETTINGS, SPEED_LEVEL_COUNT } from '@/entities/settings/model/gameSettings'
import {
  IN_GAME_PANEL, MENU_ROW, MODE_RESET_ROW, MODE_RESET_TITLE, OK_BUTTON, PANEL, SOUND_BARS, SPEED_MARKS, VALUE_ROW,
  bottomAlignOffset, isSelectedOutlineShown, modeResetRowTopOf, rowTopOf,
} from '@/pages/settings/lib/settingsLayout'

/**
 * 환경설정 창 (공용 페이지 0x593c8 종류 8 — P6 5절).
 * 줄 여섯이 25px 간격이고, 앞 셋은 값 줄(77px 막대) 뒤 셋은 메뉴 줄(142px 막대)이다.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof SettingsScreen>[0]> = {}) =>
  render(
    <SettingsScreen
      settings={DEFAULT_SETTINGS}
      hasSavedCareer
      onChange={vi.fn()}
      onResetCareer={vi.fn()}
      onResetEditedNames={vi.fn()}
      mainMenu={{ gamePoint: 1234 }}
      onBack={vi.fn()}
      {...overrides}
    />,
  )

const 줄 = (name: string) => screen.getByRole('button', { name })

describe('환경설정 창 배치', () => {
  it('원본 여섯 줄을 모두 보여 준다 — 사운드·진동도 뺐다가 되돌렸다', () => {
    띄우기()

    for (const name of ['사운드', '속도', '진동', '상세 설정', '모드 초기화', '게임 데이터 관리']) {
      expect(줄(name)).toBeTruthy()
    }
  })

  it('줄 간격은 25px 이고 Y = 49 + 25i 다', () => {
    띄우기()

    expect(줄('사운드').style.top).toBe(`${rowTopOf(0) + VALUE_ROW.bar.dy}px`)
    expect(줄('속도').style.top).toBe(`${rowTopOf(1) + VALUE_ROW.bar.dy}px`)
    expect(줄('상세 설정').style.top).toBe(`${rowTopOf(3) + MENU_ROW.bar.dy}px`)
  })

  it('값 줄 막대는 77px, 메뉴 줄 막대는 142px 다 (프레임 35 · 37)', () => {
    띄우기()

    expect(줄('속도').style.width).toBe(`${VALUE_ROW.bar.width}px`)
    expect(줄('모드 초기화').style.width).toBe(`${MENU_ROW.bar.width}px`)
  })

  it('판은 가운데 192×212 다 (24, 54)', () => {
    const { container } = 띄우기()
    const panel = container.querySelector(`div[style*="${PANEL.width}px"]`) as HTMLElement

    expect(panel.style.left).toBe(`${PANEL.x}px`)
    expect(panel.style.top).toBe(`${PANEL.y}px`)
    expect(panel.style.width).toBe(`${PANEL.width}px`)
    expect(panel.style.height).toBe(`${PANEL.height}px`)
  })
})

/**
 * 예전에는 `alignSelf:'end'` 로 아래 맞춤을 흉내 냈는데, 그 그림들은 `position:absolute` 라
 * 아무 효과가 없어 막대가 **천장에 붙은 내림 계단**으로 나왔다 (최대 9px 어긋남).
 * P6 5절 확정 식 `y = Y + 35 + (h최대 − h)` · `y = Y + 37 아래 맞춤` 을 직접 더하도록 바꿨다.
 */
describe('소리 막대·속도 꺾쇠는 아래 맞춤이다 (P6 5절 확정)', () => {
  it('소리 막대 넷(12×2·5·8·11)의 밑변이 모두 Y + 46 에 모인다', () => {
    const 밑변 = SOUND_BARS.sizes.map(
      (size, k) => SOUND_BARS.dy + bottomAlignOffset(SOUND_BARS.sizes, k) + size.height,
    )

    expect(밑변).toEqual([46, 46, 46, 46])
  })

  /**
   * 꺾쇠는 **넷이 아니라 다섯**이다 — 속도 [옵션+0x2f] 는 0~4 고(K-5 5-1, 프레임 표 0xd7624 =
   * [250,100,62,45,35] 다섯 칸) 그리는 쪽은 `속도 + 1 개만큼 이미지 102 + k` 라(P6 5절)
   * 최대 속도에서 **102~106 다섯 장**이 나온다. 106 은 13×11 이라(public/sprites/slt_frame/106.png)
   * h최대가 9 에서 11 로 올라가고 밑변은 Y + 48 이 된다.
   * 예전 표는 102~105 넷만 적어 다섯째 장을 넷째 크기(12×9)로 보고 혼자 2px 내려앉혔다.
   */
  it('속도 꺾쇠 다섯(11×7·11×7·12×9·12×9·13×11)의 밑변이 모두 Y + 48 에 모인다', () => {
    const 밑변 = SPEED_MARKS.sizes.map(
      (size, k) => SPEED_MARKS.dy + bottomAlignOffset(SPEED_MARKS.sizes, k) + size.height,
    )

    expect(SPEED_MARKS.sizes.length).toBe(SPEED_LEVEL_COUNT)
    expect(밑변).toEqual([48, 48, 48, 48, 48])
  })

  it('가장 낮은 막대는 9px 내려 앉는다 — 예전 값(0)과 다른 곳이다', () => {
    expect(bottomAlignOffset(SOUND_BARS.sizes, 0)).toBe(9)
    expect(bottomAlignOffset(SOUND_BARS.sizes, 3)).toBe(0)
  })
})

describe('환경설정 값 바꾸기', () => {
  it('값 줄에서 좌우 키가 값을 돌린다 — 속도는 0~4 를 순환한다', () => {
    const onChange = vi.fn()
    띄우기({ onChange })

    fireEvent.keyDown(window, { key: 'ArrowDown' })  // 속도 줄로
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, speedLevel: DEFAULT_SETTINGS.speedLevel + 1 })
  })

  it('진동 줄은 좌우 어느 쪽이든 ON/OFF 를 뒤집는다', () => {
    const onChange = vi.fn()
    띄우기({ onChange })

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, isVibrationOn: false })
  })

  it('진동을 켜면 100ms 흔든다 (0x29684) — 끌 때는 안 울린다', () => {
    const vibrateSpy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, configurable: true, writable: true })
    try {
      const { rerender } = 띄우기({ settings: { ...DEFAULT_SETTINGS, isVibrationOn: false } })
      fireEvent.click(줄('진동'))
      expect(vibrateSpy).toHaveBeenCalledWith(100)

      vibrateSpy.mockClear()
      rerender(
        <SettingsScreen settings={{ ...DEFAULT_SETTINGS, isVibrationOn: true }} hasSavedCareer
          onChange={vi.fn()} onResetCareer={vi.fn()} onBack={vi.fn()} />,
      )
      fireEvent.click(줄('진동'))
      expect(vibrateSpy).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(navigator, 'vibrate')
    }
  })

  it('게임 데이터 관리는 통신이 필요해 안내만 띄운다 (🌐)', () => {
    띄우기()

    fireEvent.click(줄('게임 데이터 관리'))

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('메인 메뉴에서 에디트 초기화를 안 넘기면 모드 초기화 줄은 있되 들어가지 않는다', () => {
    띄우기({ onResetEditedNames: undefined })

    fireEvent.click(줄('모드 초기화'))

    expect(줄('모드 초기화')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '에디트 초기화' })).toBeNull()
  })
})

/**
 * 경기 중 메뉴 "설정" — 경기 장면 초기화 0x3301c 가 skin+0x125 = 1 을 세워 0x593c8 종류 8 이 **작은 판**(높이 130,
 * 0x5940c) 에 **세 줄**(0x595e4) 만 그린다. 격자 1×4(0x3c3ac) — 넷째 칸이 OK 단추(고르면 popup 18, 0x59df0),
 * OK·좌우 모두 0x3cccc 로 경기 중 메뉴로 돌아간다. 모드 초기화(에디트 초기화 포함)는 줄 자체가 없다.
 */
describe('경기 중 메뉴 "설정" — 작은 판 세 줄 (skin+0x125)', () => {
  const 경기중 = (overrides: Partial<Parameters<typeof SettingsScreen>[0]> = {}) =>
    띄우기({ mainMenu: undefined, onResetEditedNames: undefined, ...overrides })

  it('사운드·속도·진동 세 줄만 있다 — 상세 설정·모드 초기화·게임 데이터 관리 줄이 없다', () => {
    경기중()

    for (const name of ['사운드', '속도', '진동']) expect(줄(name)).toBeTruthy()
    for (const name of ['상세 설정', '모드 초기화', '게임 데이터 관리']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })

  it('판은 (24, 95, 192, 130) — y0 = 160 − 65, 줄·OK 가 41 내려간다', () => {
    경기중()

    expect(IN_GAME_PANEL).toEqual({ x: 24, y: 95, width: 192, height: 130 })
    expect(줄('사운드').style.top).toBe(`${rowTopOf(0) + 41 + VALUE_ROW.bar.dy}px`)
    expect(줄('확인').style.top).toBe(`${OK_BUTTON.y + 41}px`)
  })

  it('넷째 커서 칸이 OK — 고르면 popup 프레임 18, OK 를 누르면 경기 중 메뉴로', () => {
    const onBack = vi.fn()
    경기중({ onBack })

    for (let k = 0; k < 3; k += 1) fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(줄('확인').querySelector('img')?.getAttribute('src')).toContain('popup/frames/018.png')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onBack).toHaveBeenCalledTimes(1)

    // 한 칸 더 내려가면 첫 줄로 돈다 (칸 넷)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(줄('확인').querySelector('img')?.getAttribute('src')).toContain('popup/frames/000.png')
  })

  it('OK 칸의 좌우도 돌아가기다 (0x3cba4 → 칸 3 → 0x3cccc)', () => {
    const onBack = vi.fn()
    경기중({ onBack })

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

/**
 * 모드 초기화 — 원본 장면 상태 0x21 (갱신 0x2c6d8 · 그리기 0x5a316, 직접 읽음).
 * 칸 0 [82] 나만의리그 · 1 [83] 시즌모드 · 2 [84] 에디트. 에디트는 확인 0xcf8d4 → 0x204c1 → 0xcf900.
 */
describe('환경설정 → 모드 초기화 (원본 상태 0x21, 세 줄)', () => {
  const 모드초기화열기 = (overrides: Partial<Parameters<typeof SettingsScreen>[0]> = {}) => {
    띄우기(overrides)
    fireEvent.click(줄('모드 초기화'))
  }

  it('나리 저장이 없어도 들어간다 — 칸 4 는 조건 없이 0xbcb49(…, 0x21)', () => {
    모드초기화열기({ hasSavedCareer: false })

    for (const name of ['나만의리그 초기화', '시즌모드 초기화', '에디트 초기화']) expect(줄(name)).toBeTruthy()
  })

  it('줄은 Y = 54 + 30i 의 114px 막대(프레임 36) 이고 제목은 img_text 291 이다', () => {
    모드초기화열기()

    expect(줄('나만의리그 초기화').style.top).toBe(`${modeResetRowTopOf(0) + MODE_RESET_ROW.bar.dy}px`)
    expect(줄('에디트 초기화').style.top).toBe(`${PANEL.y + 60 + 0x25}px`)
    expect(줄('에디트 초기화').style.left).toBe(`${PANEL.x + 0x32}px`)
    expect(줄('에디트 초기화').style.width).toBe('114px')
    expect(MODE_RESET_TITLE).toEqual({ frame: 291, x: 36, y: 59 })
  })

  it('에디트 초기화: 확인 0xcf8d4 에 예 → 이름표를 비우고 0xcf900 "초기화 되었습니다"', () => {
    const onResetEditedNames = vi.fn()
    모드초기화열기({ onResetEditedNames })

    fireEvent.click(줄('에디트 초기화'))
    expect(screen.getByRole('dialog').textContent).toContain('선수 이름을 초기화')
    expect(onResetEditedNames).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onResetEditedNames).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog').textContent).toContain('초기화 되었습니다')

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(줄('에디트 초기화')).toBeTruthy()
  })

  it('에디트 초기화: 아니오면 아무것도 안 지우고 목록으로', () => {
    const onResetEditedNames = vi.fn()
    모드초기화열기({ onResetEditedNames })

    fireEvent.click(줄('에디트 초기화'))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(onResetEditedNames).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('세 확인 창은 처음 커서가 [아니오] 다 — 0x749d5(창, 1) (0x2c930 · 0x2c7fa · 0x2c81c)', () => {
    const onResetCareer = vi.fn()
    const onResetSeason = vi.fn()
    const onResetEditedNames = vi.fn()
    모드초기화열기({ onResetCareer, onResetSeason, onResetEditedNames })

    for (const name of ['나만의리그 초기화', '시즌모드 초기화', '에디트 초기화']) {
      fireEvent.click(줄(name))
      expect(screen.getByRole('button', { name: '아니오' }).querySelector('img')?.getAttribute('src'))
        .toContain('popup/frames/007.png')
      // 바로 OK 를 누르면 [아니오] — 아무것도 안 지운다
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(screen.queryByRole('dialog')).toBeNull()
    }
    expect(onResetCareer).not.toHaveBeenCalled()
    expect(onResetSeason).not.toHaveBeenCalled()
    expect(onResetEditedNames).not.toHaveBeenCalled()
  })

  it('키: 아래 두 번 → OK 가 에디트 확인을 띄우고, CLR 은 환경설정 첫 화면으로', () => {
    모드초기화열기()

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('dialog').textContent).toContain('선수 이름을 초기화')
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(줄('사운드')).toBeTruthy()
  })

  it('나만의리그: 저장이 있을 때만 [210] 확인 → 예면 지우고 0xcf900', () => {
    const onResetCareer = vi.fn()
    모드초기화열기({ onResetCareer })

    fireEvent.click(줄('나만의리그 초기화'))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onResetCareer).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog').textContent).toContain('초기화 되었습니다')
  })

  it('시즌모드: 시즌 지우기를 안 넘기면(웹 미배선) 확인 창이 안 뜨고, 넘기면 0xcf870 확인', () => {
    모드초기화열기()
    fireEvent.click(줄('시즌모드 초기화'))
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()

    const onResetSeason = vi.fn()
    모드초기화열기({ onResetSeason })
    fireEvent.click(줄('시즌모드 초기화'))
    expect(screen.getByRole('dialog').textContent).toContain('시즌 모드 초기화를')
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onResetSeason).toHaveBeenCalledTimes(1)
  })
})

/**
 * 상세 설정 — 원본은 팝업이 아니라 **딴 페이지**(장면 상태 0x20 · 페이지 32)고
 * 그리기 루프가 `cmp r6,#4` 로 **네 줄**이다 (P7-leftovers K2 확정).
 * 줄 아이콘 표 0xd1afc = [93,94,90,97] · 값 라벨 첫 번호 표 0xd1b04 = [74,76,76,78] →
 * 값 0 이 앞 문구(기본 · 수동 · 수동 · OFF) 이고 지금 값만 흰색이다.
 * 다섯째 줄 "터치"(StrMAINMENU[73])는 원본이 값만 읽고 그리지 않아 웹에도 없다.
 */
describe('환경설정 → 상세 설정 (원본 페이지 32, 네 줄)', () => {
  const 상세열기 = (overrides: Partial<Parameters<typeof SettingsScreen>[0]> = {}) => {
    띄우기(overrides)
    fireEvent.click(줄('상세 설정'))
  }

  it('투구·주루·송구·전광판 네 줄이 나오고 터치 줄은 없다', () => {
    상세열기()

    for (const name of ['투구', '주루', '송구', '전광판']) expect(줄(name)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '터치' })).toBeNull()
  })

  it('지금 값만 흰색이고 아닌 칸은 #7B93D4 다 — 기본값 투구는 [74] 기본이다', () => {
    상세열기()

    expect(screen.getByText('기본').style.color).toBe('rgb(255, 255, 255)')
    expect(screen.getByText('게이지').style.color).toBe('rgb(123, 147, 212)')
  })

  it('줄을 누르면 값이 뒤집힌다 (갱신 0x288ac 의 `eor #1`)', () => {
    const onChange = vi.fn()
    상세열기({ onChange })

    fireEvent.click(줄('주루'))

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, runningMode: '수동' })
  })

  it('웹 배선이 없는 전광판도 원본에 줄이 있으니 그대로 바꿀 수 있다', () => {
    const onChange = vi.fn()
    상세열기({ onChange })

    fireEvent.click(줄('전광판'))

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, isScoreboardOn: false })
  })
})

/**
 * 머리띠 `0x54d95(skin, 0, 5, 0)` — 메인 메뉴 상태 8·0x20·0x21 그리기(0x2dc90 · 0x2dc48 · 0x2dc00)가 모두 그린다.
 * 경기 중 메뉴 그리기 0x3cdd0 은 종류 8 판만 그린다.
 */
describe('환경설정 머리띠와 흰 테두리 깜빡임', () => {
  const 되돌아가기 = () => screen.queryByRole('button', { name: '되돌아가기' })

  it('메인 메뉴 환경설정은 세 페이지 모두 머리띠(제목 0 · 바닥 5 되돌아가기)를 그린다', () => {
    const onBack = vi.fn()
    띄우기({ onBack })
    expect(되돌아가기()).toBeTruthy()

    fireEvent.click(줄('모드 초기화'))
    expect(줄('에디트 초기화')).toBeTruthy()
    expect(되돌아가기()).toBeTruthy()
    // 모드 초기화의 되돌아가기는 첫 화면으로 (CLR 0xbcb49(…, 8))
    fireEvent.click(되돌아가기() as HTMLElement)
    expect(줄('사운드')).toBeTruthy()
    expect(onBack).not.toHaveBeenCalled()

    fireEvent.click(줄('상세 설정'))
    expect(되돌아가기()).toBeTruthy()
  })

  it('경기 중 메뉴 "설정"(mainMenu 없음)은 머리띠가 없다', () => {
    띄우기({ mainMenu: undefined })
    expect(되돌아가기()).toBeNull()
  })

  it('흰 테두리는 그릴 때마다 +1 한 카운터 % 8 ≤ 3 일 때만 — 8 갱신 중 4 갱신', () => {
    const shown = Array.from({ length: 8 }, (_unused, updates) => isSelectedOutlineShown(updates))
    expect(shown).toEqual([true, true, true, false, false, false, false, true])
  })
})
