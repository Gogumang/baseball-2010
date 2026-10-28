import { describe, expect, it } from 'vitest'
import { specialSwingEffectFrameAt, specialSwingStageEffectOf } from '@/widgets/batting-stage/lib/specialSwingEffect'

describe('필살 연출 그림 0x49aec — 갈래', () => {
  it('번호 → +0x103c 그림, 번호 2 는 우타면 뒤집고 늘 타자 아래, 번호 3 은 y + 25', () => {
    expect(specialSwingStageEffectOf(1, 0, -1, 0)).toMatchObject({
      folder: './sprites/effect_power/frames',
      isMirrored: false,
      isBehindBatter: false,
      offsetY: 0,
    })
    expect(specialSwingStageEffectOf(2, 0, -1, 0)).toMatchObject({ folder: './sprites/effect_frame/frames', isMirrored: true, isBehindBatter: true })
    expect(specialSwingStageEffectOf(2, 1, -1, 1)).toMatchObject({ isMirrored: false, isBehindBatter: true })
    expect(specialSwingStageEffectOf(3, 0, -1, 0)).toMatchObject({ folder: './sprites/effect_tornado/frames', offsetY: 25 })
  })

  it('번호 4 — 폼 니블 2·3(장타형, 0xb8e6d 참)이면 미라지 없음, 아니면 미라지 타자', () => {
    expect(specialSwingStageEffectOf(4, 2, -1, 0)?.showsMirage).toBe(false)
    expect(specialSwingStageEffectOf(4, 3, -1, 1)?.showsMirage).toBe(false)
    expect(specialSwingStageEffectOf(4, 0, -1, 0)?.showsMirage).toBe(true)
    expect(specialSwingStageEffectOf(4, 5, -1, 1)?.showsMirage).toBe(true)
  })

  it('마타자 순번 → +0x1034 그림, 어거지죠(1)는 우타면 뒤집기 · 깊이 −1, 크라이져(3)는 y + 25', () => {
    expect(specialSwingStageEffectOf(0, 0, 0, 0)?.folder).toBe('./sprites/medica_effect/frames')
    expect(specialSwingStageEffectOf(0, 0, 1, 0)).toMatchObject({ folder: './sprites/effect_frame/frames', isMirrored: true, isBehindBatter: true })
    expect(specialSwingStageEffectOf(0, 0, 3, 1)).toMatchObject({ offsetY: 25, showsMirage: false })
  })

  it('번호가 없거나 마타자 순번이 4 를 넘으면 갈래를 안 탄다 — 보통 타격 불꽃이 나간다', () => {
    expect(specialSwingStageEffectOf(0, 0, -1, 0)).toBeNull()
    expect(specialSwingStageEffectOf(0, 0, 5, 0)).toBeNull()
  })
})

describe('필살 그림 애니 — k 번째 부름은 k 칸 나아간 뒤', () => {
  // effect_meteor 애니 0: 지연 0,0,0,2,2,3
  const 표 = [0, 0, 0, 2, 2, 3].map((delay, frame) => ({ frame, delay }))
  it('칸 0 은 길이 1 이라 첫 부름에 이미 넘어간다 · 끝 칸을 돌면 null', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => specialSwingEffectFrameAt(표, k))).toEqual([1, 2, 3, 3, 4, 4, 5, 5, 5, null])
    expect(specialSwingEffectFrameAt(표, 0)).toBeNull()
  })
})
