// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { DEFAULT_SETTINGS, SPEED_LEVEL_COUNT } from '@/entities/settings/model/gameSettings'
import {
  IN_GAME_PANEL, MENU_ROW, MODE_RESET_ROW, MODE_RESET_TITLE, OK_BUTTON, PANEL, SOUND_BARS, SPEED_MARKS, VALUE_ROW,
  bottomAlignOffset, closingFold, isSelectedOutlineShown, modeResetRowTopOf, nextPanelFold, openingFold, panelClipOf,
  rowTopOf,
} from '@/pages/settings/lib/settingsLayout'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

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

  it('판은 가운데 192×212 다 (24, 54) — 다 펴진 뒤', () => {
    vi.useFakeTimers()
    const { container } = 띄우기()
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 4)
    })
    vi.useRealTimers()
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
      // 나리 칸은 고르기 창이 먼저 — 타자편을 고르면 [210]
      if (name === '나만의리그 초기화') fireEvent.click(screen.getByRole('button', { name: '타자편' }))
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

  it('나만의리그: 저장 유무와 상관없이 고르기 창 0xcf848 — 타자편(고른 13)·투수편(보통 12), 처음 커서 타자편', () => {
    모드초기화열기({ hasSavedCareer: false })

    fireEvent.click(줄('나만의리그 초기화'))
    expect(screen.getByRole('dialog').textContent).toContain('초기화할 데이터를 선택하세요')
    expect(screen.getByRole('button', { name: '타자편' }).querySelector('img')?.getAttribute('src'))
      .toContain('popup/frames/013.png')
    expect(screen.getByRole('button', { name: '투수편' }).querySelector('img')?.getAttribute('src'))
      .toContain('popup/frames/012.png')
  })

  it('나만의리그: 타자편 → [210] 예 → 0x224ec(4) · 0xcf900 / 투수편 → [211] 예 → 0x224ec(3)', () => {
    const onResetCareer = vi.fn()
    모드초기화열기({ onResetCareer })

    fireEvent.click(줄('나만의리그 초기화'))
    fireEvent.click(screen.getByRole('button', { name: '타자편' }))
    expect(screen.getByRole('dialog').textContent).toContain('나만의 리그 타자편')
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onResetCareer).toHaveBeenLastCalledWith('타자편')
    expect(screen.getByRole('dialog').textContent).toContain('초기화 되었습니다')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    fireEvent.click(줄('나만의리그 초기화'))
    fireEvent.click(screen.getByRole('button', { name: '투수편' }))
    expect(screen.getByRole('dialog').textContent).toContain('나만의 리그 투수편')
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onResetCareer).toHaveBeenLastCalledWith('투수편')
    expect(onResetCareer).toHaveBeenCalledTimes(2)
  })

  it('나만의리그: 고르기 창 CLR(−1) 은 목록으로 — 아무것도 안 지운다', () => {
    const onResetCareer = vi.fn()
    모드초기화열기({ onResetCareer })

    fireEvent.click(줄('나만의리그 초기화'))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onResetCareer).not.toHaveBeenCalled()
  })

  it('나만의리그: 시즌 중 막기면 그 글(종류 1)만 띄우고 확인 창 없이 목록으로 — 투수편은 [213] 글이다', () => {
    const onResetCareer = vi.fn()
    const careerResetBlockOf = vi.fn((edition: '타자편' | '투수편') =>
      (edition === '투수편' ? '시즌모드 경기 진행 중에는!N삭제 하실 수 없습니다' : null))
    모드초기화열기({ onResetCareer, careerResetBlockOf })

    fireEvent.click(줄('나만의리그 초기화'))
    fireEvent.click(screen.getByRole('button', { name: '투수편' }))
    expect(careerResetBlockOf).toHaveBeenLastCalledWith('투수편')
    expect(screen.getByRole('dialog').textContent).toContain('삭제 하실 수 없습니다')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onResetCareer).not.toHaveBeenCalled()

    // 타자편은 통과 — [210]
    fireEvent.click(줄('나만의리그 초기화'))
    fireEvent.click(screen.getByRole('button', { name: '타자편' }))
    expect(screen.getByRole('dialog').textContent).toContain('나만의 리그 타자편')
  })

  it('시즌모드: 시즌 지우기를 안 넘기면 확인 창이 안 뜨고, 넘기면 0xcf870 확인', () => {
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

  it('배치는 0x59e82~ 그대로 — 줄 Y = 54 + 30i, 값 칸 x0 + 98 + 39j, 지금 값 노랑 테두리 (x0 + 99 + 39·값, Y + 38) · OK 단추 없음', () => {
    상세열기()

    // 투구 기본값 0 → 첫 칸, 주루 기본값 1(자동) → 둘째 칸
    const 투구 = screen.getByTestId('상세값테두리-0')
    expect([투구.style.left, 투구.style.top, 투구.style.width, 투구.style.height]).toEqual(['123px', '92px', '35px', '15px'])
    const 주루 = screen.getByTestId('상세값테두리-1')
    expect([주루.style.left, 주루.style.top]).toEqual(['162px', '122px'])
    expect(screen.getByText('게이지').style.left).toBe('161px')
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
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

/**
 * 첫 화면 격자 1×7 (진입 0x259fc `vtbl+0x10(1, 7, 1, 0x20, 0)`) — 일곱째 칸이 OK 단추.
 * OK(−5)·CLR(−16) 은 0x295e2: 저장 → 판 접힘 → 갱신 끝 0x29688 이 상태 4.
 * 판 펼침·접힘은 0x593c8 끝 0x5a6fe — 걸음 ×4.
 */
describe('환경설정 첫 화면 — OK 칸과 판 펼침·접힘', () => {
  const 판높이 = (container: HTMLElement) =>
    (container.querySelector(`div[style*="${PANEL.width}px"]`) as HTMLElement).style.height
  const 한틱 = () => act(() => {
    vi.advanceTimersByTime(millisecondsPerFrame())
  })
  const OK그림 = () => 줄('확인').querySelector('img')?.getAttribute('src') ?? ''

  it('펼침은 0x20 에서 걸음 ×4 — 그려지는 높이 32 · 36 · 52 · 116 · 212 (경기 중은 130 에서 멈춘다)', () => {
    const heights: number[] = []
    let fold = openingFold()
    for (let draw = 0; draw < 6; draw += 1) {
      heights.push(fold.height)
      fold = nextPanelFold(fold, PANEL.height)
    }
    expect(heights).toEqual([32, 36, 52, 116, 212, 212])

    let small = openingFold()
    for (let draw = 0; draw < 4; draw += 1) small = nextPanelFold(small, IN_GAME_PANEL.height)
    expect(small).toMatchObject({ height: 130, isDone: true })
  })

  it('접힘은 걸음 ×4 로 줄여 10 에서 끝 — 212 · 208 · 192 · 128 을 그린다', () => {
    const heights: number[] = []
    let fold = closingFold(nextPanelFold({ ...openingFold(), height: 212, isDone: true }, PANEL.height))
    while (!fold.isDone) {
      heights.push(fold.height)
      fold = nextPanelFold(fold, PANEL.height)
    }
    expect(heights).toEqual([212, 208, 192, 128])
    expect(fold.height).toBe(10)
  })

  it('펴는 동안은 잘라내기가 판 안쪽 5px, 다 펴지면 바깥 5px 다 (0xbae25)', () => {
    expect(panelClipOf(52, 212)).toEqual({ y: 160 - 26 + 5, height: 42 })
    expect(panelClipOf(212, 212)).toEqual({ y: 54 - 5, height: 222 })
  })

  it('화면도 판을 펴며 들어온다 — 펴는 동안은 흰 테두리가 없다', () => {
    vi.useFakeTimers()
    const { container } = 띄우기()
    expect(판높이(container)).toBe('32px')
    expect(container.querySelector('div[class*="selectedOutline"]')).toBeNull()
    한틱()
    expect(판높이(container)).toBe('36px')
    한틱()
    한틱()
    한틱()
    expect(판높이(container)).toBe(`${PANEL.height}px`)
    vi.useRealTimers()
  })

  it('↑ 한 번이면 감겨 일곱째 OK 칸 — 고르면 popup 프레임 18, ↓ 는 사운드로 돌아온다', () => {
    띄우기()
    expect(OK그림()).toContain('popup/frames/000.png')

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(OK그림()).toContain('popup/frames/018.png')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(OK그림()).toContain('popup/frames/000.png')
  })

  it('OK 칸의 좌우는 아무 일도 없다 (0x29604/0x2960a 는 칸 0~2 만)', () => {
    const onBack = vi.fn()
    const onChange = vi.fn()
    띄우기({ onBack, onChange })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    expect(onBack).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('OK 칸에서 OK 는 판을 접은 뒤 나간다 — 접히는 네 장 동안은 아직 안 나간다', () => {
    vi.useFakeTimers()
    const onBack = vi.fn()
    const { container } = 띄우기({ onBack })
    for (let tick = 0; tick < 4; tick += 1) 한틱()

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onBack).not.toHaveBeenCalled()
    expect(판높이(container)).toBe('212px')
    한틱()
    expect(판높이(container)).toBe('208px')
    한틱()
    한틱()
    expect(판높이(container)).toBe('128px')
    expect(onBack).not.toHaveBeenCalled()
    한틱()
    expect(onBack).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('파일 저장 0x1f1b9 는 첫 화면을 나갈 때(0x295e2) 한 번 — 값을 바꾸거나 상세 설정을 오갈 때는 안 쓴다', () => {
    const onSave = vi.fn()
    const onChange = vi.fn()
    띄우기({ onSave, onChange })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalled()
    fireEvent.click(줄('상세 설정'))
    fireEvent.click(줄('주루'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('CLR 도 같은 0x295e2 — 접고 나서 나간다', () => {
    vi.useFakeTimers()
    const onBack = vi.fn()
    띄우기({ onBack })
    for (let tick = 0; tick < 4; tick += 1) 한틱()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).not.toHaveBeenCalled()
    for (let tick = 0; tick < 4; tick += 1) 한틱()
    expect(onBack).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('하위 페이지에서 돌아온 첫 화면은 다시 펴지 않는다 (0x259fc 앞 상태 0x20~0x22)', () => {
    vi.useFakeTimers()
    const { container } = 띄우기()
    for (let tick = 0; tick < 4; tick += 1) 한틱()
    fireEvent.click(줄('상세 설정'))
    for (let tick = 0; tick < 4; tick += 1) 한틱()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(판높이(container)).toBe(`${PANEL.height}px`)
    vi.useRealTimers()
  })

  /**
   * 하위 페이지 진입 0x2421c(0x20) · 0x242a4(0x21) 도 skin+0x90 = 0x20 · +0x94 = 1 · +0x98 = 0 · +0x99 = 1 —
   * 공용 페이지 0x593c8 종류 0x20(끝 0x5a314) · 0x21(끝 0x5a4f6 → 0x5a6f8)도 같은 꼬리 0x5a6fe 로 편다.
   */
  it.each(['상세 설정', '모드 초기화'])('%s 페이지도 판을 32 에서 펴며 들어오고, 펴는 동안은 흰 테두리가 없다', (row) => {
    vi.useFakeTimers()
    const { container } = 띄우기()
    for (let tick = 0; tick < 4; tick += 1) 한틱()
    fireEvent.click(줄(row))
    expect(판높이(container)).toBe('32px')
    expect(container.querySelector('div[class*="selectedOutline"]')).toBeNull()
    한틱()
    expect(판높이(container)).toBe('36px')
    한틱()
    한틱()
    expect(판높이(container)).toBe('116px')
    한틱()
    expect(판높이(container)).toBe(`${PANEL.height}px`)
    vi.useRealTimers()
  })

  it('펴는 도중 돌아가면 첫 화면이 그 판을 이어서 편다 — 처음(32)부터 다시 펴지 않는다', () => {
    vi.useFakeTimers()
    const { container } = 띄우기()
    for (let tick = 0; tick < 4; tick += 1) 한틱()
    fireEvent.click(줄('상세 설정'))
    한틱()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(판높이(container)).toBe('36px')
    한틱()
    expect(판높이(container)).toBe('52px')
    vi.useRealTimers()
  })
})
