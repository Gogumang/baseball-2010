import { describe, expect, it } from 'vitest'
import { DEFENSE_SCENE_START, drawDefenseScene } from '@/features/defense-play/model/defenseScene'
import { redrawDefensePlayScene } from '@/features/defense-play/model/redrawDefensePlay'
import type { DefensePlayState } from '@/features/defense-play/model/runDefensePlay'

/** 연출 칸만 든 진행기 상태 — 창 첫 그림이 고치는 칸만 본다 */
function 상태(scene = DEFENSE_SCENE_START): DefensePlayState {
  return {
    ticks: [
      {
        ball: { x: 20_000, z: 24_500, height: 0, isFlying: false },
        fielders: [{ slot: 4, x: 15_000, z: 20_000, action: 0, actionTick: 0 }],
        runners: [],
        judgeText: { frame: 1, dx: 0, dy: 0, holderSlot: 4 },
      },
    ],
    play: { ballHolderSlot: 4 },
    scene,
    gamePaused: true,
    laserOutFlag: false,
    laserConfirmed: true,
    laserShining: true,
    laserArmed: true,
    deadlyJumpArmed: false,
    deadlySlideArmed: false,
  } as unknown as DefensePlayState
}

describe('창이 선 첫 그림의 수비 화면 연출 0x46c88 (r183)', () => {
  it('레이저 단계 1 의 그림이 한 번 더 돌면 경기 멈춤 +0x1993 이 그 그림에서 풀리고 단계가 2 로 간다 (4403c)', () => {
    const state = 상태({ ...DEFENSE_SCENE_START, laserRunning: true, effectStep: 1 })
    const view = redrawDefensePlayScene(state)
    expect(state.gamePaused).toBe(false)
    expect(state.scene.effectStep).toBe(2)
    // 줌 펀치가 공 가진 야수 자리에서 선다 — 그 그림 칸으로 얹는다
    expect(view?.zoom).toBeDefined()
  })

  it('결과 판 0x46844 도 한 번 더 돈다 — 진행기 그리기와 같은 다음 칸이고, 앞 그림의 연출 칸은 새로 얹는다', () => {
    const state = 상태()
    const 기대 = drawDefenseScene(DEFENSE_SCENE_START, { holderSlot: 4, holder: { x: 15_000, y: 0, z: 20_000 }, holderAction: 0 })
    const view = redrawDefensePlayScene(state)
    expect(state.scene).toEqual(기대.scene)
    expect(view?.judgeText ?? null).toEqual(기대.judgeText)
  })
})
