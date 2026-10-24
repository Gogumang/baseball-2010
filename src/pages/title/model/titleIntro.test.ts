import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INTRO_ANIMATION, INTRO_FRAME_COUNT, PROMPT_ANIMATION, titleSceneAt } from '@/pages/title/model/titleIntro'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

const 그리기 = (index: number) => index * millisecondsPerFrame()

describe('titleSceneAt — main_title 애니 0 · 1 그대로 (0x2cbac · 0x93d91)', () => {
  it('애니 표는 frames/animations.json 과 같다', () => {
    const table = JSON.parse(readFileSync('public/sprites/main_title/frames/animations.json', 'utf8')) as {
      frame: number
      delay: number
    }[][]
    expect(table[0].map(({ frame, delay }) => ({ frame, delay }))).toEqual(INTRO_ANIMATION)
    expect(table[1].map(({ frame, delay }) => ({ frame, delay }))).toEqual(PROMPT_ANIMATION)
  })

  it('지연대로 칸이 넘어간다 — 0·0·1·1·2·2·3·4·5·7·6·8 …', () => {
    const frames = Array.from({ length: 19 }, (_, draw) => titleSceneAt(그리기(draw)).introFrame)
    expect(frames).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 5, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15])
  })

  it('지연 합 20 — 20 번째 그리기(차례 19)가 넘기며 끝 깃발이 서고 그 그리기부터 애니 1 을 그린다', () => {
    expect(INTRO_FRAME_COUNT).toBe(19)
    expect(titleSceneAt(그리기(18))).toEqual({ introFrame: 15, promptFrame: null, isSettled: false })
    expect(titleSceneAt(그리기(19))).toEqual({ introFrame: 13, promptFrame: 13, isSettled: true })
    // 한 번만 도는 애니라 마지막 칸 13 에 선다
    expect(titleSceneAt(그리기(400)).introFrame).toBe(13)
  })

  it('끝난 뒤 애니 1 이 8 그리기 주기로 13 ×2 · 16 · 17 ×4 · 16 을 돈다', () => {
    const cycle = Array.from({ length: 9 }, (_, tick) => titleSceneAt(그리기(19 + tick)).promptFrame)
    expect(cycle).toEqual([13, 13, 16, 17, 17, 17, 17, 16, 13])
  })

  it('음수 시간은 첫 그리기로 본다', () => {
    expect(titleSceneAt(-500).introFrame).toBe(0)
  })
})
