import { describe, expect, it } from 'vitest'
import { MAGIC_PITCH_RELEASE_SOUND, pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { PITCH_RELEASE_SOUND } from '@/features/play-at-bat/model/atBatSounds'

describe('투구 순간 소리 0x3f378 (12 / 28)', () => {
  it('구질 22(게임+0xfc8 == 0x16)면 누가 던지든 28 이다 (3f470 beq)', () => {
    expect(pitchReleaseSoundIdOf({ typeNumber: 22, pitcherMagicNumber: 1, ballMagicNumber: 0 })).toBe(28)
    expect(pitchReleaseSoundIdOf({ typeNumber: 22, pitcherMagicNumber: 7, ballMagicNumber: 0 })).toBe(28)
    expect(MAGIC_PITCH_RELEASE_SOUND).toBe(28)
  })

  it('마구가 아니고 공+0x10 이 비었으면 12 다', () => {
    expect(pitchReleaseSoundIdOf({ typeNumber: 1, pitcherMagicNumber: 0, ballMagicNumber: 0 })).toBe(PITCH_RELEASE_SOUND)
    expect(pitchReleaseSoundIdOf({ typeNumber: 1, pitcherMagicNumber: 6, ballMagicNumber: 0 })).toBe(12)
  })

  it('마투수(마선수 레코드 +0x18 = 5~9)는 공+0x10 이 남아 있으면 직구에도 28 — 안 지워지는 원본 그대로 (3f488)', () => {
    expect(pitchReleaseSoundIdOf({ typeNumber: 1, pitcherMagicNumber: 5, ballMagicNumber: 5 })).toBe(28)
    expect(pitchReleaseSoundIdOf({ typeNumber: 3, pitcherMagicNumber: 9, ballMagicNumber: 9 })).toBe(28)
  })

  it('육성 투수(마구 1~4, 0xb633d 거짓)는 공+0x10 이 남아도 직구면 12 다 (3f486 beq)', () => {
    expect(pitchReleaseSoundIdOf({ typeNumber: 1, pitcherMagicNumber: 1, ballMagicNumber: 1 })).toBe(12)
    expect(pitchReleaseSoundIdOf({ typeNumber: 2, pitcherMagicNumber: 4, ballMagicNumber: 4 })).toBe(12)
  })
})
