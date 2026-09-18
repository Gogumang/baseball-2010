import { describe, expect, it } from 'vitest'
import { INTRO_FRAME_COUNT, titlePoseAt } from '@/pages/title/model/titleIntro'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

const 프레임 = (index: number) => index * millisecondsPerFrame()

describe('titlePoseAt — 원본 main_title 프레임 순서', () => {
  it('f00 은 배경 없이 선수가 y=159 에서 시작한다', () => {
    const pose = titlePoseAt(0)
    expect(pose.playerY).toBe(159)
    expect(pose.isBackgroundVisible).toBe(false)
    expect(pose.isSettled).toBe(false)
  })

  it('f13 부터 배경이 깔리고 로고가 원본 좌표대로 밀려 들어온다', () => {
    expect(titlePoseAt(프레임(13)).logoX).toBe(-86)
    expect(titlePoseAt(프레임(14)).logoX).toBe(-47)
    expect(titlePoseAt(프레임(15)).logoX).toBe(-9)
    expect(titlePoseAt(프레임(13)).isBackgroundVisible).toBe(true)
  })

  it('f16 에서 로고가 x=4 에 닿으며 인트로가 끝난다', () => {
    expect(INTRO_FRAME_COUNT).toBe(16)
    const pose = titlePoseAt(프레임(16))
    expect(pose.logoX).toBe(4)
    expect(pose.isSettled).toBe(true)
  })

  it('끝난 뒤 TOUCH SCREEN 은 켜졌다 꺼졌다 한다', () => {
    const 켜짐 = titlePoseAt(프레임(16)).isPromptVisible
    const 꺼짐 = titlePoseAt(프레임(24)).isPromptVisible
    expect(켜짐).toBe(true)
    expect(꺼짐).toBe(false)
  })

  it('음수 시간은 첫 프레임으로 본다', () => {
    expect(titlePoseAt(-500).playerY).toBe(159)
  })
})
