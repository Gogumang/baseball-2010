// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/** 나만의리그 투수편 한 판 (원본 모드 3, 장면 0x106) — 저장·장면 전환만 본다 */

function 메모리저장(): JsonStorePort {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
  }
}

const 신인 = {
  role: PITCHER_ROLE.starter,
  typeIndex: 0,
  handIndex: 0,
  skinIndex: 0,
  breakingPitchSlots: [],
  teamId: 3,
}

const 띄우기 = (store: JsonStorePort = 메모리저장()) =>
  renderHook(() => usePitcherLeagueSession(store, createSeededRandom(20100901), false))

describe('투수편 세션', () => {
  it('커리어가 없으면 등록부터다', () => {
    const { result } = 띄우기()

    expect(result.current.career).toBeNull()
    expect(result.current.scene).toBe('등록')
  })

  it('등록하면 관리로 가고 고른 팀이 들어간다', () => {
    const { result } = 띄우기()

    act(() => result.current.actions.create('투수', 신인))

    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.name).toBe('투수')
    expect(result.current.career?.teamId).toBe(3)
  })

  it('타자편과 **다른 저장 칸**을 쓴다 — 다시 띄우면 이어진다', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    act(() => 첫판.result.current.actions.create('투수', 신인))

    const 둘째판 = 띄우기(store)

    expect(둘째판.result.current.career?.name).toBe('투수')
    expect(둘째판.result.current.scene).toBe('관리')
  })

  it('경기를 세우면 커리어에서 옵션 15칸이 채워진다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))

    act(() => result.current.actions.beginGame())

    expect(result.current.scene).toBe('경기')
    expect(result.current.gameOptions?.ourTeamId).toBe(3)
    expect(result.current.gameOptions?.role).toBe(PITCHER_ROLE.starter)
    // 환경설정 "투구 게이지" — 원본 기본값은 꺼짐이다 (K 5-2)
    expect(result.current.gameOptions?.gaugeSettingOn).toBe(false)
  })
})
