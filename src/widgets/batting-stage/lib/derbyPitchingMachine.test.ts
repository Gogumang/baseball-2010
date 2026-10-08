import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DERBY_MACHINE_FRAME,
  derbyMachinePlacementOf,
  drawsDerbyPitchingMachine,
} from '@/widgets/batting-stage/lib/derbyPitchingMachine'
import { BATTER_SIDE } from '@/widgets/batting-stage/lib/stageLayout'

const origins = JSON.parse(readFileSync('public/sprites/trainning/frames/origins.json', 'utf8')) as Record<
  string,
  { x: number; y: number; width: number; height: number }
>

describe('홈런더비 투구 기계 — 0x42f2c', () => {
  it('모드 7 에서만 그린다', () => {
    expect(drawsDerbyPitchingMachine(7)).toBe(true)
    expect(drawsDerbyPitchingMachine(1)).toBe(false)
    expect(drawsDerbyPitchingMachine(undefined)).toBe(false)
  })

  it('그림은 trainning 프레임 0 (43 × 37, 원점 (−17, −28))', () => {
    expect(DERBY_MACHINE_FRAME).toBe(0)
    expect(origins['000']).toEqual({ x: -17, y: -28, width: 43, height: 37 })
  })

  it('자리는 투수 그림 객체 — 투수 앵커, 좌투면 x + 1 에 뒤집기', () => {
    // 좌타 배치의 투수 앵커 (83, 188) · 우타 (156, 188)
    expect(derbyMachinePlacementOf(BATTER_SIDE.좌타, 0)).toEqual({ x: 83, y: 188, isMirrored: false })
    expect(derbyMachinePlacementOf(BATTER_SIDE.좌타, 1)).toEqual({ x: 84, y: 188, isMirrored: true })
    expect(derbyMachinePlacementOf(BATTER_SIDE.우타, 0)).toEqual({ x: 156, y: 188, isMirrored: false })
  })
})
