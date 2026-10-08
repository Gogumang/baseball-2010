import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SUBSTITUTION_ANCHOR,
  SUBSTITUTION_ANIMATION,
  SUBSTITUTION_ANIMATION_INDEX,
  SUBSTITUTION_FRAME_BOX,
  SUBSTITUTION_SCENE_DRAWS,
  isSubstitutionSceneLastDraw,
  substitutionFrameAt,
} from '@/features/play-game/model/substitutionScene'

const GAME_UI = resolve(__dirname, '../../../../public/sprites/game_ui/frames')

describe('교체 연출 0x16 — 그리기 0x4da30 의 game_ui 애니 9', () => {
  it('애니 칸은 game_ui animations.json [9] 그대로다', () => {
    const animations = JSON.parse(readFileSync(resolve(GAME_UI, 'animations.json'), 'utf8')) as {
      frame: number
      delay: number
    }[][]
    expect(animations[SUBSTITUTION_ANIMATION_INDEX].map(({ frame, delay }) => ({ frame, delay }))).toEqual(
      SUBSTITUTION_ANIMATION,
    )
  })

  it('자리는 프레임 81 상자(0xba815 종류 1)로 가운데 — (120 − 49, 160 − 9)', () => {
    const origins = JSON.parse(readFileSync(resolve(GAME_UI, 'origins.json'), 'utf8')) as Record<
      string,
      { width: number; height: number }
    >
    expect(origins['081']).toMatchObject({ width: SUBSTITUTION_FRAME_BOX.width, height: SUBSTITUTION_FRAME_BOX.height })
    expect(SUBSTITUTION_ANCHOR).toEqual({ x: 71, y: 151 })
  })

  it('그리기가 진행보다 먼저라 그림 0 이 첫 칸이고, 지연 합 17 번째 그림(마지막 칸 84)이 끝 비트를 보고 0xd 를 보낸다', () => {
    expect(SUBSTITUTION_SCENE_DRAWS).toBe(17)
    const frames = Array.from({ length: SUBSTITUTION_SCENE_DRAWS }, (_, draw) => substitutionFrameAt(draw))
    expect(frames).toEqual([79, 79, 80, 80, 81, 81, 82, 82, 82, 82, 82, 82, 82, 83, 83, 84, 84])
    expect(isSubstitutionSceneLastDraw(15)).toBe(false)
    expect(isSubstitutionSceneLastDraw(16)).toBe(true)
    // 반복이 아니라 마지막 칸에 멈춘다 (0x93d30(애니, 0))
    expect(substitutionFrameAt(40)).toBe(84)
  })
})
