// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { SEASON_GAME_COUNT } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/** 시즌 모드 한 판을 잇는 훅 (원본 장면 0x105) — 저장·장면 전환만 본다 */

function 메모리저장(): JsonStorePort {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
  }
}

const 띄우기 = (store: JsonStorePort = 메모리저장()) =>
  renderHook(() => useSeasonSession(store, createSeededRandom(20100901)))

describe('시즌 세션', () => {
  it('저장이 없으면 팀 고르기부터다 (0xca)', () => {
    const { result } = 띄우기()

    expect(result.current.state).toBeNull()
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.팀고르기)
  })

  it('팀을 고르면 새 시즌이 서고 관리 메뉴로 간다 — 소지금 50 · 인기도 0 · 사기 100 (0x5758)', () => {
    const { result } = 띄우기()

    act(() => result.current.actions.chooseTeam(3))

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(result.current.state?.record.teamId).toBe(3)
    expect(result.current.state?.record.money).toBe(50)
    expect(result.current.state?.teamMorale).toBe(100)
  })

  it('저장 칸에 담기고 다시 띄우면 이어진다', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    act(() => 첫판.result.current.actions.chooseTeam(5))

    const 둘째판 = 띄우기(store)

    expect(둘째판.result.current.state?.record.teamId).toBe(5)
    // 경기 수 0 · phase 새시즌이면 관리 메뉴가 열린다 (enterSeasonScene)
    expect(둘째판.result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
  })

  it('경기를 치르면 경기 수가 오르고 관중수입 창으로 간다 (0xe9)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))

    act(() => result.current.actions.playNextGame())

    expect(result.current.state?.record.games).toBe(1)
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관중수입)
    // 경기를 치르면 이번 주기의 트레이닝·외출 표시를 지운다 (0x4f158)
    expect(result.current.state?.record.acted).toBe(false)
  })

  it('수입을 확인하면 2경기 주기에 따라 다음이 갈린다 (afterGameNext)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.playNextGame())

    // 1경기째 뒤 → 홀수라 관리 메뉴가 안 열리고 다음경기로
    act(() => result.current.actions.confirmIncome(result.current.state!.record))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
  })

  it('정규시즌이 끝나고 국가대항전 연차면 대회가 열린다 (연차idx 짝수)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    // 1년차(연차idx 0)는 국가대항전 연차다
    const 마지막경기 = { ...result.current.state!.record, games: SEASON_GAME_COUNT }

    act(() => result.current.actions.confirmIncome(마지막경기))

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.국가대항전)
    expect(result.current.state?.record.nationalCup).toBe(true)
    expect(result.current.cup?.teams).toEqual([10, 11, 12, 13])
  })
})

describe('시즌 관리 커맨드', () => {
  it('트레이닝은 고른 칸만 올리고 사기를 깎는다 (J 4-6)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    const 전 = result.current.state!

    act(() => result.current.actions.runTraining(1))

    const 후 = result.current.state!
    const 내팀 = 후.record.teamId
    expect(후.teamAbilities[내팀][1]).toBeGreaterThan(전.teamAbilities[내팀][1])
    // 고르지 않은 칸은 그대로다
    expect(후.teamAbilities[내팀][0]).toBe(전.teamAbilities[내팀][0])
    expect(후.teamMorale).toBeLessThan(전.teamMorale)
    expect(후.record.acted).toBe(true)
  })

  it('지옥훈련은 네 칸을 모두 올린다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    const 전 = result.current.state!.teamAbilities[0]

    act(() => result.current.actions.runTraining(4))

    const 후 = result.current.state!.teamAbilities[0]
    expect(후.every((value, index) => value > 전[index])).toBe(true)
  })

  it('친선경기는 사기를 깎고 소지금을 준다 — 사기 난수의 부호를 뒤집는다 (0xc8b0)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    const 전 = result.current.state!
    // 새 시즌 사기는 100(최대)이라 올리는 쪽은 여기서 안 보인다 — 원본 0x5758 이 100 으로 시작한다
    expect(전.teamMorale).toBe(100)

    act(() => result.current.actions.runOuting(0))

    const 후 = result.current.state!
    expect(후.teamMorale).toBeLessThan(전.teamMorale)
    expect(후.record.money).toBeGreaterThan(전.record.money)
    expect(후.record.acted).toBe(true)
  })

  it('회식은 사기를 올리고 소지금 4 를 깎는다 — 사기가 깎여 있을 때 보인다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.runOuting(0)) // 친선경기로 사기를 먼저 깎는다
    const 전 = result.current.state!

    act(() => result.current.actions.runOuting(1))

    const 후 = result.current.state!
    expect(후.teamMorale).toBeGreaterThan(전.teamMorale)
    expect(후.record.money).toBe(전.record.money - 4)
  })
})
