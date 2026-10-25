import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { commands } from 'vitest/browser'
import '@/app/styles/global.css'
import { useWholeScreenOffset } from '@/shared/lib/screenShake/useWholeScreenOffset'
import { screenRectOf } from '@/shared/lib/viewportFit/zoomedRect'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'

/**
 * **브라우저 시험 — 화면 흔들기 0xba888 가 배율(CSS zoom) 판에서 원본 px × 배율로 옮기고 옮기기 전 판 자리로 자르는가** (r255).
 *
 * 웹킷(아이폰 Safari)은 zoom 판 안 요소의 `getBoundingClientRect` 를 zoom 뺀 좌표로 낸다(r242). 흔들기가 그 값으로 자르는 사각형
 * (clip-path)을 재면 판 자리가 배율만큼 왼쪽 위로 작게 잡혀, 흔드는 동안 판 오른쪽 · 아래가 잘려 검게 보이고 그 자리 탭이 안 먹혔다.
 * 잘린 몫은 그려지지도 눌리지도 않으므로 진짜 손가락 탭(`touchTap`)으로 판 네 귀퉁이 · 판 바깥이 눌리는지 본다.
 */

const ZOOM = 1.625
/** 원본 px — 0xba888(화면, dx, dy) */
const SHAKE = { x: 4, y: 6 }

const hosts: HTMLElement[] = []

afterEach(() => {
  cleanup()
  for (const element of hosts.splice(0)) element.remove()
  document.documentElement.style.removeProperty('--zoom')
  document.documentElement.style.removeProperty('--game-height')
})

function Shaker({ offset }: { readonly offset: { readonly x: number; readonly y: number } | null }) {
  useWholeScreenOffset(offset)
  return null
}

/** `#root` 안 배율 판 + 판을 꽉 채운 누름 칸. 흔들기 전 판의 화면 좌표 사각형을 돌려준다 */
function 세우기() {
  document.documentElement.style.setProperty('--zoom', String(ZOOM))
  document.documentElement.style.setProperty('--game-height', `${Math.round(320 * ZOOM)}px`)
  const root = document.createElement('div')
  root.id = 'root'
  document.body.append(root)
  hosts.push(root)
  const presses: string[] = []
  const ui = (offset: { readonly x: number; readonly y: number } | null) => (
    <RawScreen>
      <div data-testid="판" style={{ position: 'absolute', inset: 0 }} onPointerDown={() => presses.push('판')} />
      <Shaker offset={offset} />
    </RawScreen>
  )
  const { rerender } = render(ui(null), { container: root })
  const stage = root.querySelector('[data-original-screen]') as HTMLElement
  const before = screenRectOf(stage)
  return { presses, before, root, shake: () => rerender(ui(SHAKE)) }
}

async function 눌림(presses: string[], x: number, y: number): Promise<boolean> {
  const count = presses.length
  await commands.touchTap(x, y)
  await new Promise((resolve) => setTimeout(resolve, 50))
  return presses.length > count
}

describe('화면 흔들기 — 배율 판', () => {
  it('판은 원본 240×320 × 배율이다 (화면 좌표)', () => {
    const { before } = 세우기()
    expect(before.width).toBeCloseTo(240 * ZOOM, 0)
    expect(before.height).toBeCloseTo(320 * ZOOM, 0)
  })

  it('흔드는 동안 옮긴 판의 오른쪽 아래 귀퉁이는 보이고 눌린다 — 옮기기 전 판 자리 안', async () => {
    const { presses, before, shake } = 세우기()
    shake()
    const right = before.left + before.width
    const bottom = before.top + before.height
    expect(await 눌림(presses, right - 3, bottom - 3)).toBe(true)
    // 옮긴 판의 왼쪽 위 귀퉁이 — 원본 px × 배율만큼 오른쪽 아래
    expect(await 눌림(presses, before.left + SHAKE.x * ZOOM + 3, before.top + SHAKE.y * ZOOM + 3)).toBe(true)
  })

  it('옮기기 전 판 자리 바깥은 잘린다 — 옮긴 판이 삐져나온 몫도 안 눌린다', async () => {
    const { presses, before, shake } = 세우기()
    shake()
    const right = before.left + before.width
    const bottom = before.top + before.height
    // 옮긴 판은 오른쪽으로 4 × 배율 = 6.5px 삐져나오지만 잘려 안 보인다
    expect(await 눌림(presses, right + 3, before.top + before.height / 2)).toBe(false)
    expect(await 눌림(presses, before.left + before.width / 2, bottom + 3)).toBe(false)
  })

  it('판 바깥 틀 자리에 깐 검정 받침은 바깥 틀의 화면 크기(240 × 배율 폭)다', () => {
    const { before, shake } = 세우기()
    shake()
    const backing = document.querySelector<HTMLElement>('[data-screen-shake-backing]')
    expect(backing).not.toBeNull()
    const box = (backing as HTMLElement).getBoundingClientRect()
    expect(box.width).toBeCloseTo(before.width, 0)
    expect(box.height).toBeGreaterThanOrEqual(before.height - 1)
  })

  it('비운 줄 · 칸(옮긴 판의 왼쪽 위 바깥)은 판이 아니다', async () => {
    const { presses, before, shake } = 세우기()
    shake()
    expect(await 눌림(presses, before.left + 2, before.top + 2)).toBe(false)
  })
})
