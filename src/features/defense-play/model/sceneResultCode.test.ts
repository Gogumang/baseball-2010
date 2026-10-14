import { describe, expect, it } from 'vitest'
import { registerContact, type BattedContact } from '@/entities/batting/model/battedContact'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import {
  SCENE_RESULT_CODE_START,
  sceneResultCodeAfterPitch,
  sceneResultCodeOfThrown,
} from '@/features/defense-play/model/sceneResultCode'

describe('경기 +0xfd4 — 0x11 진입(3deea)이 공마다 0, 휘두른 공만 스윙 판정(5130e)이 덮는다', () => {
  it('안 휘두른 공(볼 · 루킹 · 사구)은 0', () => {
    expect(SCENE_RESULT_CODE_START).toBe(0)
    expect(sceneResultCodeAfterPitch({ kind: '볼' })).toBe(0)
    expect(sceneResultCodeAfterPitch({ kind: '사구' })).toBe(0)
    expect(sceneResultCodeAfterPitch({ kind: '스트라이크', isSwinging: false })).toBe(0)
  })

  it('헛스윙은 0xab214 가 out+8 을 안 써 원본에서도 정해지지 않는다 — null', () => {
    expect(sceneResultCodeAfterPitch({ kind: '스트라이크', isSwinging: true })).toBeNull()
  })

  it('맞은 공은 방향까지 붙인 결과 코드', () => {
    expect(sceneResultCodeAfterPitch({ kind: '파울' }, 10)).toBe(10)
    const contact = { pattern: { angle: 0, strength: 0, height: 0 }, resultCode: 25 } as unknown as BattedContact
    const outcome = registerContact({ kind: '홈런' } as unknown as AtBatOutcome, contact)
    expect(sceneResultCodeOfThrown({ kind: '타구', outcome })).toBe(25)
    expect(sceneResultCodeOfThrown({ kind: '파울' }, contact)).toBe(25)
    expect(sceneResultCodeOfThrown({ kind: '파울' })).toBeNull()
  })
})
