import { describe, expect, it } from 'vitest'
import {
  NO_PRE_GAME_ACE, PRE_GAME_ACES_START, PRE_GAME_ACE_PHASE,
  cancelPreGameAce, choosePreGameAce, matchInfoCancelScene,
} from '@/entities/season-mode/model/preGameFlow'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'

describe('경기 전 마선수 고르기 0xd7 (this+0x11c = 1, 키 0xa248)', () => {
  it('들어올 때마다 마투수 단계부터다 — 0x5268 이 메뉴+0xd0 = 1 을 쓴다', () => {
    expect(PRE_GAME_ACES_START).toEqual({
      phase: PRE_GAME_ACE_PHASE.마투수, pitcher: NO_PRE_GAME_ACE, batter: NO_PRE_GAME_ACE,
    })
  })

  it('마투수 OK 는 rec+0xe 에 칸을 적고 마타자 단계로, 마타자 OK 는 rec+0xd = 칸 − 5 로 0xdd 에 간다', () => {
    const 첫 = choosePreGameAce(PRE_GAME_ACES_START, 3)
    expect(첫).toEqual({ kind: '고르기', aces: { phase: PRE_GAME_ACE_PHASE.마타자, pitcher: 3, batter: NO_PRE_GAME_ACE } })

    const 둘 = choosePreGameAce(첫.aces, 7)
    expect(둘).toEqual({ kind: '경기정보', aces: { phase: PRE_GAME_ACE_PHASE.마타자, pitcher: 3, batter: 2 } })
  })

  it('CLR — 마타자 단계는 마투수로, 마투수 단계는 포스트시즌이면 0xef · 아니면 0xd8 (0xa900)', () => {
    const 마타자단계 = { phase: PRE_GAME_ACE_PHASE.마타자, pitcher: 1, batter: NO_PRE_GAME_ACE }
    expect(cancelPreGameAce(마타자단계, false)).toEqual({ kind: '고르기', aces: { ...마타자단계, phase: PRE_GAME_ACE_PHASE.마투수 } })

    expect(cancelPreGameAce(PRE_GAME_ACES_START, false)).toEqual({ kind: '나감', scene: SEASON_SCENE_STATE.다음경기 })
    expect(cancelPreGameAce(PRE_GAME_ACES_START, true)).toEqual({ kind: '나감', scene: SEASON_SCENE_STATE.시즌결산 })
  })
})

describe('경기정보 0xdd 의 CLR (0x844e)', () => {
  it('국가대항전 중이면 대회 쪽(0xf4 → 0xf3), 아니면 0xd7 선수단', () => {
    expect(matchInfoCancelScene(true)).toBe(SEASON_SCENE_STATE.국가대항전)
    expect(matchInfoCancelScene(false)).toBe(SEASON_SCENE_STATE.선수단)
  })

  it('0xdd 는 경기정보, 경기 화면은 그 뒤 전환 0xe1 이다', () => {
    expect(SEASON_SCENE_STATE.경기정보).toBe(0xdd)
    expect(SEASON_SCENE_STATE.경기직전).toBe(0xe1)
  })
})
