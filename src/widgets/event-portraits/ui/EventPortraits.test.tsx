// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { EventPortraits } from '@/widgets/event-portraits/ui/EventPortraits'
import type { EventPortrait } from '@/shared/config/original/eventTypes'

/**
 * 이벤트 초상화 — 주인공은 피부 팔레트와 장타형 몸(+8)을 따라간다 (C-1 확정).
 *
 * 칠하기 자체는 캔버스(`recoloredSpriteUrl`) 몫인데 jsdom 에는 캔버스가 없다 — 그래서 여기서는
 * **`<img src>` 가 어느 프레임을 가리키는지**만 본다. 색이 실제로 바뀌는지는
 * `shared/lib/sprite/paletteSwap.test.ts` 의 순수 함수(`recolorPixels`) 쪽에서 검사한다.
 */

const 그림폴더 = 'public/sprites/event_char_0/frames'
const 자료: Readonly<Record<string, unknown>> = {
  animations: JSON.parse(readFileSync(`${그림폴더}/animations.json`, 'utf8')) as unknown,
  origins: JSON.parse(readFileSync(`${그림폴더}/origins.json`, 'utf8')) as unknown,
  palette: JSON.parse(readFileSync('public/sprites/event_char_0/palette.json', 'utf8')) as unknown,
}

vi.stubGlobal('fetch', (url: string) => {
  const name = url.split('/').pop()?.replace('.json', '') ?? ''
  const body = 자료[name]
  return body === undefined
    ? Promise.resolve({ ok: false, status: 404 } as Response)
    : Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as unknown as Response)
})

afterEach(cleanup)

/** 주인공 표정 3 — 애니 3 은 프레임 10 부터, 장타형(애니 11)은 프레임 37 부터다 */
const 주인공: EventPortrait = { file: 'event_char_0', animation: 3, side: 'left' }

const 그림주소 = (container: HTMLElement) =>
  waitFor(() => {
    const image = container.querySelector('img')
    if (image === null) throw new Error('아직 초상화가 안 떴다')
    return image.getAttribute('src') ?? ''
  })

describe('이벤트 초상화 — 장타형 주인공은 프레임 +8 짜리 몸을 쓴다', () => {
  it('타격형은 애니 3 (프레임 010)', async () => {
    const { container } = render(<EventPortraits portraits={[주인공]} height={120} battingTypeIndex={0} />)
    expect(await 그림주소(container)).toBe('./sprites/event_char_0/frames/010.png')
  })

  it('장타형은 애니 11 = 3 + 8 (프레임 037)', async () => {
    const { container } = render(<EventPortraits portraits={[주인공]} height={120} battingTypeIndex={1} />)
    expect(await 그림주소(container)).toBe('./sprites/event_char_0/frames/037.png')
  })

  it('피부를 바꿔도 캔버스가 없으면 구운 그림을 그대로 쓴다 (조용히 물러난다)', async () => {
    const { container } = render(<EventPortraits portraits={[주인공]} height={120} skinIndex={2} />)
    expect(await 그림주소(container)).toBe('./sprites/event_char_0/frames/010.png')
  })
})
