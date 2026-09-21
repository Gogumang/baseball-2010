import { describe, expect, it } from 'vitest'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  ACE_PHASE, FIRST_BAT_PHASE, GENERAL_MODE_STEP, NO_ACE,
} from '@/pages/general-mode/lib/generalModeSetup'
import {
  chooseAce, chooseAiTeam, chooseFirstBat, chooseStadium, chooseUserTeam, createFlowState,
  moveFirstBat, moveStadium, stepBack,
} from '@/pages/general-mode/lib/generalModeFlow'

/** 일반모드 준비 흐름 (하위 상태 18~22, StrHOWTO[6] · R4 3a/3b) */

const 처음 = () => createFlowState()

describe('앞으로 가기', () => {
  it('18 → 19 → 20(선공) → 20(구장) → 21(마투수) → 21(마타자) → 22 순서다', () => {
    let state = 처음()
    expect(state.step).toBe(GENERAL_MODE_STEP.유저팀)

    state = chooseUserTeam(state, 3)
    expect(state.step).toBe(GENERAL_MODE_STEP.AI팀)
    expect(state.setup.userTeamId).toBe(3)

    state = chooseAiTeam(state, 7)
    expect(state.step).toBe(GENERAL_MODE_STEP.선공구장)
    expect(state.firstBatPhase).toBe(FIRST_BAT_PHASE.선공)

    state = chooseFirstBat(state, PLAYER_SIDE_LAST_BAT)
    expect(state.firstBatPhase).toBe(FIRST_BAT_PHASE.구장)
    expect(state.setup.playerSide).toBe(PLAYER_SIDE_LAST_BAT)

    state = chooseStadium(state, 5)
    expect(state.step).toBe(GENERAL_MODE_STEP.마선수)
    // 마투수를 먼저 고른다 ([skin+0xd0] = 1)
    expect(state.acePhase).toBe(ACE_PHASE.마투수)
    expect(state.setup.stadiumId).toBe(5)

    state = chooseAce(state, 2)
    expect(state.step).toBe(GENERAL_MODE_STEP.마선수)
    expect(state.acePhase).toBe(ACE_PHASE.마타자)
    expect(state.setup.acePitcherId).toBe(2)

    // 아랫줄 칸 7 = 마타자 2번
    state = chooseAce(state, 7)
    expect(state.step).toBe(GENERAL_MODE_STEP.경기정보)
    expect(state.setup.aceBatterId).toBe(2)
  })

  it('⚠️ AI 팀이 유저 팀과 같아도 막지 않는다 — 원본에 검사가 없다', () => {
    const state = chooseAiTeam(chooseUserTeam(처음(), 4), 4)

    expect(state.setup.userTeamId).toBe(4)
    expect(state.setup.aiTeamId).toBe(4)
    expect(state.step).toBe(GENERAL_MODE_STEP.선공구장)
  })

  it('커서만 옮기는 손잡이는 단계를 바꾸지 않는다', () => {
    const 선공 = moveFirstBat(chooseAiTeam(chooseUserTeam(처음(), 0), 1), PLAYER_SIDE_LAST_BAT)
    expect(선공.firstBatPhase).toBe(FIRST_BAT_PHASE.선공)
    expect(선공.setup.playerSide).toBe(PLAYER_SIDE_LAST_BAT)

    const 구장 = moveStadium(chooseFirstBat(선공, PLAYER_SIDE_FIRST_BAT), 8)
    expect(구장.firstBatPhase).toBe(FIRST_BAT_PHASE.구장)
    expect(구장.setup.stadiumId).toBe(8)
  })
})

describe('CLR 로 뒤로 가기', () => {
  it('첫 화면에서는 더 뒤가 없다 — 모드 목록으로 나간다', () => {
    expect(stepBack(처음())).toBeNull()
  })

  it('구장 단계에서는 선공 단계로 돌아가고 고른 구장은 남는다', () => {
    const 구장 = moveStadium(chooseFirstBat(chooseAiTeam(chooseUserTeam(처음(), 0), 1), PLAYER_SIDE_FIRST_BAT), 6)

    const 뒤 = stepBack(구장)

    expect(뒤?.step).toBe(GENERAL_MODE_STEP.선공구장)
    expect(뒤?.firstBatPhase).toBe(FIRST_BAT_PHASE.선공)
    expect(뒤?.setup.stadiumId).toBe(6)
  })

  it('마타자 단계에서는 마투수 단계로, 마투수 단계에서는 상태 20 으로 돌아간다', () => {
    const 마타자단계 = chooseAce(chooseStadium(chooseFirstBat(chooseAiTeam(chooseUserTeam(처음(), 0), 1), PLAYER_SIDE_FIRST_BAT), 0), 0)

    const 마투수단계 = stepBack(마타자단계)
    expect(마투수단계?.acePhase).toBe(ACE_PHASE.마투수)
    expect(마투수단계?.step).toBe(GENERAL_MODE_STEP.마선수)

    // 진입 0x23ed0 이 단계를 0(선공)으로 되돌린다
    const 선공구장 = stepBack(마투수단계!)
    expect(선공구장?.step).toBe(GENERAL_MODE_STEP.선공구장)
    expect(선공구장?.firstBatPhase).toBe(FIRST_BAT_PHASE.선공)
  })

  it('경기정보에서는 마선수의 **마타자** 단계로 돌아간다', () => {
    const state = createFlowState()
    const 경기정보 = { ...state, step: GENERAL_MODE_STEP.경기정보 } as typeof state

    const 뒤 = stepBack(경기정보)

    expect(뒤?.step).toBe(GENERAL_MODE_STEP.마선수)
    expect(뒤?.acePhase).toBe(ACE_PHASE.마타자)
  })
})

describe('빠른실행으로 들어온 판', () => {
  it('준비 1~6 단계를 건너뛰고 경기정보에서 시작한다', () => {
    const state = createFlowState({ isQuickStart: true })

    expect(state.step).toBe(GENERAL_MODE_STEP.경기정보)
    expect(state.isQuickStart).toBe(true)
  })

  it('경기정보에서 CLR 하면 더 뒤가 없다 — 모드 목록으로 나간다', () => {
    expect(stepBack(createFlowState({ isQuickStart: true }))).toBeNull()
  })
})

describe('처음 기록', () => {
  it('마선수는 고른 것이 없는 상태로 시작한다', () => {
    expect(처음().setup.acePitcherId).toBe(NO_ACE)
    expect(처음().setup.aceBatterId).toBe(NO_ACE)
  })
})
