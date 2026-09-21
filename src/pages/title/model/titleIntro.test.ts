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

  /**
   * 예전 테스트는 8프레임마다 켜고 끄는 TOUCH SCREEN 을 못박고 있었다.
   * 이 빌드는 TOUCH SCREEN(애니 2)을 쓰지 않고 **애니 1 의 PRESS ANY KEY** 를 돌린다
   * (F-4·4-1 확정): 프레임 13(2틱 안 보임) → 16(1틱 흐림) → 17(4틱 밝음) → 16(1틱 흐림).
   */
  it('끝난 뒤 PRESS ANY KEY 가 8틱 주기로 안보임2·흐림1·밝음4·흐림1 을 돈다', () => {
    const 주기 = [0, 1, 2, 3, 4, 5, 6, 7].map((tick) => titlePoseAt(프레임(16 + tick)).promptPhase)

    expect(주기).toEqual(['hidden', 'hidden', 'dim', 'bright', 'bright', 'bright', 'bright', 'dim'])
    expect(titlePoseAt(프레임(16 + 8)).promptPhase).toBe('hidden')
  })

  /**
   * 예전에는 전체이용가를 인트로 **중에만** (0,5) 에 그렸다.
   * 원본 0x2cbac 은 저작권·판 번호·전체이용가를 인트로가 끝난 뒤에만 지나간다.
   */
  it('인트로 중에는 저작권·판 번호·전체이용가를 그리지 않는다', () => {
    expect(titlePoseAt(프레임(2)).isSettled).toBe(false)
    expect(titlePoseAt(프레임(15)).isSettled).toBe(false)
    expect(titlePoseAt(프레임(16)).isSettled).toBe(true)
  })

  it('음수 시간은 첫 프레임으로 본다', () => {
    expect(titlePoseAt(-500).playerY).toBe(159)
  })
})
