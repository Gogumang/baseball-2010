import { describe, expect, it } from 'vitest'
import { entryPointsOf, SUBSTITUTION_ENTRY_PARTICLES, substitutionEntryParticleOf } from '@/widgets/batting-stage/lib/substitutionEntryParticle'
import { BATTER_SIDE } from '@/widgets/batting-stage/lib/stageLayout'

describe('교체 등판 파티클 0x38b64', () => {
  it('투수 가지는 ptc/004(id 3) · 프레임 9, 타자 가지는 ptc/003(id 2) · 프레임 4 (38bc0~38bc8 · 38c5c~38c66)', () => {
    expect(SUBSTITUTION_ENTRY_PARTICLES).toEqual({ 투수: { id: 3, img: 9 }, 타자: { id: 2, img: 4 } })
  })

  it('투수 자리 = 투수 앵커(표 0xcfb18) — 좌투면 x + 1 (38db8)', () => {
    expect(substitutionEntryParticleOf('투수', entryPointsOf(BATTER_SIDE.우타, 0, 0))).toEqual({ id: 3, img: 9, x: 156, y: 188 })
    expect(substitutionEntryParticleOf('투수', entryPointsOf(BATTER_SIDE.우타, 1, 0))).toEqual({ id: 3, img: 9, x: 157, y: 188 })
    expect(substitutionEntryParticleOf('투수', entryPointsOf(BATTER_SIDE.좌타, 0, 0))).toEqual({ id: 3, img: 9, x: 83, y: 188 })
  })

  it('타자 자리 = 타자 앵커(표 0xcfb2c) + 좌우 이동 [+0xfe4], y 는 + 10 (38c5a)', () => {
    expect(substitutionEntryParticleOf('타자', entryPointsOf(BATTER_SIDE.좌타, 0, 0))).toEqual({ id: 2, img: 4, x: 175, y: 291 })
    expect(substitutionEntryParticleOf('타자', entryPointsOf(BATTER_SIDE.우타, 1, 0))).toEqual({ id: 2, img: 4, x: 64, y: 291 })
    expect(substitutionEntryParticleOf('타자', entryPointsOf(BATTER_SIDE.우타, 0, -3))).toEqual({ id: 2, img: 4, x: 61, y: 291 })
  })
})
