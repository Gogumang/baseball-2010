import { describe, expect, it } from 'vitest'

import type { Pitch } from '@/entities/pitching/model/pitch'
import {
  EFFECT_FIRE_FRAMES,
  EFFECT_SHINNING_FRAMES,
  MAGIC_BALL_EFFECT_FIRST_PATH_INDEX,
  magicBallEffectFolderOf,
  magicBallEffectFrameAt,
} from '@/widgets/batting-stage/lib/magicBallEffect'

const 공: Pitch = {
  type: '마구',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 600,
  frameCount: 20,
  controlTier: 5,
  worldPath: null,
  stageSide: 1,
}

/** effect_fire/frames/animations.json · effect_shinning 도 같다 — 네 칸, 지연 0 */
const 네칸 = [0, 1, 2, 3].map((frame) => ({ frame, delay: 0 }))

describe('마구 공 이펙트 고르기 (0x3b4e2 · 0x481c4)', () => {
  it('구질이 마구가 아니면 아무것도 안 겹친다 — 공 +0x10 이 남아 있어도 마찬가지다', () => {
    expect(magicBallEffectFolderOf({ ...공, pitcherMagicNumber: 1, magicNumber: 1 })).toBeNull()
    expect(magicBallEffectFolderOf({ ...공, isMagicPitch: false, pitcherMagicNumber: 1 })).toBeNull()
  })

  it('마구 번호 1 은 effect_fire 다 — 폼을 안 가린다', () => {
    for (const form of [0, 1, 2, 3, 4, 5]) {
      expect(magicBallEffectFolderOf({ ...공, isMagicPitch: true, pitcherMagicNumber: 1, pitcherForm: form }))
        .toBe(EFFECT_FIRE_FRAMES)
    }
  })

  it('마구 번호 4 는 폼 묶음 0(폼 0·1)일 때만 effect_shinning 이다', () => {
    const 이펙트 = (form: number) =>
      magicBallEffectFolderOf({ ...공, isMagicPitch: true, pitcherMagicNumber: 4, pitcherForm: form })
    expect(이펙트(0)).toBe(EFFECT_SHINNING_FRAMES)
    expect(이펙트(1)).toBe(EFFECT_SHINNING_FRAMES)
    expect(이펙트(2)).toBeNull()
    expect(이펙트(5)).toBeNull()
  })

  it('마구 번호 2·3 은 그림 이펙트가 없다 (원본도 파티클만 쓴다)', () => {
    expect(magicBallEffectFolderOf({ ...공, isMagicPitch: true, pitcherMagicNumber: 2 })).toBeNull()
    expect(magicBallEffectFolderOf({ ...공, isMagicPitch: true, pitcherMagicNumber: 3 })).toBeNull()
  })

  it('마선수 마구(5~9)는 이 갈래가 아니다 — 경기+0x1038 쪽이라 아직 안 옮겼다', () => {
    for (const number of [5, 6, 7, 8, 9]) {
      expect(magicBallEffectFolderOf({ ...공, isMagicPitch: true, pitcherMagicNumber: number })).toBeNull()
    }
  })
})

describe('마구 공 이펙트 칸 (0x3b554 · 0x3b576)', () => {
  it('공 경로 번호가 7 이하면 안 뜬다', () => {
    for (let index = 0; index < MAGIC_BALL_EFFECT_FIRST_PATH_INDEX; index += 1) {
      expect(magicBallEffectFrameAt(네칸, index)).toBeNull()
    }
  })

  it('8 번째 경로부터 한 틱에 한 칸씩 넘어간다', () => {
    expect(magicBallEffectFrameAt(네칸, 8)).toBe(0)
    expect(magicBallEffectFrameAt(네칸, 9)).toBe(1)
    expect(magicBallEffectFrameAt(네칸, 10)).toBe(2)
  })

  it('마지막 칸은 안 그린다 — 한 번 돌고 사라진다', () => {
    expect(magicBallEffectFrameAt(네칸, 11)).toBeNull()
    expect(magicBallEffectFrameAt(네칸, 30)).toBeNull()
  })

  it('지연이 있으면 그만큼 칸이 머문다 (0x93d90 의 max(1, 지연))', () => {
    const 지연2 = [
      { frame: 0, delay: 2 },
      { frame: 1, delay: 0 },
      { frame: 2, delay: 0 },
    ]
    expect(magicBallEffectFrameAt(지연2, 8)).toBe(0)
    expect(magicBallEffectFrameAt(지연2, 9)).toBe(0)
    expect(magicBallEffectFrameAt(지연2, 10)).toBe(1)
    expect(magicBallEffectFrameAt(지연2, 11)).toBeNull()
  })

  it('칸이 하나뿐인 애니는 그릴 칸이 없다', () => {
    expect(magicBallEffectFrameAt([{ frame: 0, delay: 0 }], 8)).toBeNull()
  })
})
