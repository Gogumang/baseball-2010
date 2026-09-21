// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SpecialSwingWindow } from '@/widgets/special-swing/ui/SpecialSwingWindow'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

/**
 * 필살타법 창 (0x803d4). 확인 키 규칙은 상태에 따라 갈린다 —
 * 선수정보 쪽 **0x17cec**(고르기, StrMODE[69]~[71])와 트레이닝 쪽 **0x17828**(배우기, [62]~[66]).
 */

afterEach(cleanup)

/** 줄바꿈(!N)은 DOM 에서 요소로 갈라지니 비교 전에 없앤다 */
const 한줄로 = (text: string) => stripGameMarkup(text).replace(/\s+/g, '')
const 문구 = (index: number) => 한줄로(ORIGINAL_MODE_TEXT[index])
const 알림글 = () => 한줄로(screen.getByRole('dialog', { name: '알림' }).textContent ?? '')
const 칸누르기 = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('기술 고르기 — 상태 0x7b · 0x17cec', () => {
  it('배우지 않은 칸은 StrMODE[71] "트레이닝 완료 후 사용할 수 있습니다" 다', () => {
    render(<SpecialSwingWindow level={2} sessions={0} battingTypeIndex={0} onClose={vi.fn()} />)

    칸누르기('미라지 스윙')

    expect(알림글()).toContain(문구(71))
  })

  it('배운 칸을 고르면 StrMODE[70] 로 묻고, "예" 가 고른 번호를 바꾼다', () => {
    const onSelectNumber = vi.fn()
    render(<SpecialSwingWindow level={4} sessions={0} battingTypeIndex={0}
      selectedNumber={1} onSelectNumber={onSelectNumber} onClose={vi.fn()} />)

    칸누르기('토네이도스윙')
    expect(알림글()).toContain('토네이도스윙')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onSelectNumber).toHaveBeenCalledWith(3)
  })

  it('이미 쓰는 기술이면 StrMODE[69] 로 막는다 — 장타형 넷째 칸은 번호 5 다', () => {
    render(<SpecialSwingWindow level={4} sessions={0} battingTypeIndex={1}
      selectedNumber={5} onClose={vi.fn()} />)

    칸누르기('메테오 스윙')

    expect(알림글()).toContain(문구(69))
  })

  it('"아니오" 면 고른 번호를 바꾸지 않는다', () => {
    const onSelectNumber = vi.fn()
    render(<SpecialSwingWindow level={4} sessions={0} battingTypeIndex={0}
      selectedNumber={1} onSelectNumber={onSelectNumber} onClose={vi.fn()} />)

    칸누르기('플레임 스윙')
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(onSelectNumber).not.toHaveBeenCalled()
  })
})

describe('배우기 — 상태 0x6c · 0x17828', () => {
  const 훈련창 = (overrides: Partial<Parameters<typeof SpecialSwingWindow>[0]> = {}) => {
    const onTrain = vi.fn()
    render(<SpecialSwingWindow mode="훈련" level={0} sessions={0} battingTypeIndex={0}
      popularity={9999} gamePoint={9999} onTrain={onTrain} onClose={vi.fn()} {...overrides} />)
    return { onTrain }
  }

  it('배운 칸은 StrMODE[63] "이미 훈련 완료된 스킬입니다" 다 (L > i)', () => {
    훈련창({ level: 2 })

    칸누르기('파워 스윙')

    expect(알림글()).toContain(문구(63))
  })

  it('칸 i 의 필요 인기도는 100·500·1000·1500 이고 모자라면 StrMODE[62] 다 (표 0xcc3ea)', () => {
    훈련창({ level: 1, popularity: 499 })

    칸누르기('플레임 스윙')

    expect(알림글()).toContain(한줄로('필요한 인기도 : 500'))
  })

  it('앞 칸을 안 배웠으면 StrMODE[64] 로 막는다 (L < i)', () => {
    훈련창({ level: 0 })

    칸누르기('플레임 스윙')

    expect(알림글()).toContain(문구(64))
  })

  it('G포인트가 모자라면 StrMODE[65] 로 막는다 — 웹에 없던 막음이다', () => {
    const { onTrain } = 훈련창({ level: 0, gamePoint: 499 })

    칸누르기('파워 스윙')
    expect(알림글()).toContain(문구(65))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(onTrain).not.toHaveBeenCalled()
  })

  it('조건을 다 채우면 StrMODE[66] 에 비용을 넣어 묻고 "예" 가 훈련을 시작한다 (레벨 0 = 500 G)', () => {
    const { onTrain } = 훈련창({ level: 0, gamePoint: 500 })

    칸누르기('파워 스윙')
    expect(알림글()).toContain(한줄로('500 G포인트'))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onTrain).toHaveBeenCalledTimes(1)
  })
})
