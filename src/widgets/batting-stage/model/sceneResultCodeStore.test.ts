import { afterEach, describe, expect, it } from 'vitest'
import {
  clearSceneResultCodeOnPitch,
  resetSceneResultCode,
  sceneResultCodeNow,
  writeSceneResultCode,
} from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { leaveGameSceneObject } from '@/widgets/game-scene/model/gameSceneObject'

describe('경기 장면 객체의 결과 코드 칸 [장면+0xfd4]', () => {
  afterEach(() => resetSceneResultCode())

  it('장면 객체는 0 채움(0x3874 → new)이라 처음은 0', () => {
    expect(sceneResultCodeNow()).toBe(0)
  })

  it('0x6aa 가 쓴 값은 타석 부품이 바뀌어도 남고, 0x11 진입(3deea)이 0 으로 지운다', () => {
    writeSceneResultCode(25)
    expect(sceneResultCodeNow()).toBe(25)
    clearSceneResultCodeOnPitch()
    expect(sceneResultCodeNow()).toBe(0)
  })

  it('장면을 나가면(0x332b8) 다음 장면은 새 객체 — 0', () => {
    writeSceneResultCode(24)
    leaveGameSceneObject()
    expect(sceneResultCodeNow()).toBe(0)
  })
})
