// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { resetSkinBlinkCounter } from '@/shared/lib/skinBlink/skinBlink'

/** 켠 스킬 비트(+0xf4 타자 · +0xf8 투수)만 세운 기록연감 — 스킬 탭 '얻음' 은 0x58a3c 가 이 비트로 가른다 */
const 켠스킬 = (batterBits: number[], pitcherBits: number[] = []) => ({
  ...EMPTY_COLLECTION,
  stats: {
    ...EMPTY_COLLECTION.stats,
    batterEquippedSkillBits: batterBits.reduce((bits, bit) => (bits | (1 << bit)) >>> 0, 0),
    pitcherEquippedSkillBits: pitcherBits.reduce((bits, bit) => (bits | (1 << bit)) >>> 0, 0),
  },
})

/** 프레임 원점을 (0, 0) 으로 박아 FrameSprite 가 바로 서게 한다 — 같은 객체를 늘 돌려준다 */
vi.mock('@/shared/lib/sprite/useFrameOrigins', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/sprite/useFrameOrigins')>()
  const origins = new Proxy({}, { get: () => ({ x: 0, y: 0, width: 40, height: 10 }) })
  return { ...actual, useFrameOrigins: () => origins }
})

const { RecordAnnals } = await import('@/pages/record/ui/RecordAnnals')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 틱 = (count: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * count))
const 시계맞추기 = () => act(() => void vi.advanceTimersByTime(16))
const 띄우기 = (collection = EMPTY_COLLECTION) => {
  vi.useFakeTimers()
  render(<RecordAnnals collection={collection} onBack={vi.fn()} />)
  시계맞추기()
  틱(4)
}

describe('기록연감 탭 2 — 얻은 스킬 그림 두 장 (0x2f3b0~0x2f488)', () => {
  it('얻은 스킬은 등급 img_text(281 공통 · 149 타자 · 150 투수)를 (59, 185) 에, 화살 이미지 0x7c/0x7d 를 (84, 184 + 깜박임) 에 그린다 (0x2f3b0~0x2f488)', () => {
    띄우기(켠스킬([0, 2], [33 - 16]))
    fireEvent.click(screen.getByRole('button', { name: '스킬' }))
    const 등급 = (frame: number) => document.querySelector(`img[src="./sprites/img_text/frames/${frame}.png"]`) as HTMLImageElement | null
    const 화살 = () => screen.getByTestId('스킬-화살') as HTMLImageElement

    // 칸 0 병아리 — 공통 · 플러스(파란 위 화살 0x7c = 124)
    expect(등급(281)).not.toBeNull()
    expect(등급(281)?.style.left).toBe('59px')
    expect(등급(281)?.style.top).toBe('185px')
    expect(화살().getAttribute('src')).toBe('./sprites/slt_frame/124.png')
    expect(화살().style.left).toBe('84px')
    expect(['184px', '185px']).toContain(화살().style.top)

    // 칸 1 전국구는 못 얻었다 — 두 그림 다 없다
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.queryByTestId('스킬-화살')).toBeNull()
    expect(등급(281)).toBeNull()

    // 칸 2 먹튀 — 비트 2 는 0x5f351 비트 1(마이너스) → 빨간 아래 화살 0x7d = 125
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(화살().getAttribute('src')).toBe('./sprites/slt_frame/125.png')

    // 칸 33 새가슴 — 투수 등급 150, 표 [+0x13c] 값은 비트 33 − 16 = 17(마이너스) → 0x7d
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    for (let i = 0; i < 8; i += 1) fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/효과 :/)).toBeTruthy()
    expect(등급(150)?.style.top).toBe('185px')
    expect(화살().getAttribute('src')).toBe('./sprites/slt_frame/125.png')
  })

  it('판이 여닫히는 동안(높이 ≤ 211)은 깜박임 [sp+0xa8] 이 꺼진다 (0x2e42e~0x2e456)', () => {
    // [skin+0x410] 은 앱에 하나라 앞 시험이 남긴 값을 지운다 — 앱을 막 켠 것처럼 0 (U-90)
    resetSkinBlinkCounter()
    vi.useFakeTimers()
    render(<RecordAnnals collection={켠스킬([0])} onBack={vi.fn()} />)
    시계맞추기()
    const 탭커서 = () => document.querySelector('img[src="./sprites/slt_frame/frames/009.png"]')
    // 첫 그림(높이 32) — 카운터 1 은 `% 8 ≤ 3` 이지만 판이 열리는 중이라 꺼진다(탭 막대 초점이라 탭 커서가 안 보인다)
    expect(탭커서()).toBeNull()
    // 다 열린 뒤 틱 4(카운터 5)는 `% 8 ≤ 3` 이 아니라 꺼짐, 틱 8(카운터 9)은 켜짐
    틱(4)
    expect(탭커서()).toBeNull()
    틱(4)
    expect(탭커서()).not.toBeNull()
  })
})
