// @vitest-environment jsdom
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonRoute } from '@/app/ui/SeasonRoute'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { useGameSettings } from '@/app/model/useGameSettings'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { attendanceOf } from '@/entities/season-mode/model/seasonAttendance'
import { LEAGUE_SIDE_HOME, leagueSideOf } from '@/entities/league/model/league'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/**
 * **시즌 홈경기 타석에 장착한 전광판·관중석이 실제로 간다** — 배선만 못박는다.
 *
 * 원본 배경 고르기 `0x40ff0` 은 모드 2 이고 `0xb6bdc(경기, 1) == SR[1]`(내 팀 = side 1 = 홈)
 * 일 때만 시즌 구장 `0x77494` 로 간다. 웹에서 그 side 를 정하는 것은 `leagueSideOf`(0xb7844)
 * 이고, 그 값이 그대로 `playerSide` 다 — 그래서 **원정이면 안 넘겨야** 원본과 같다.
 *
 * 값 자체(`0x353ac~0x353e6`)는 `entities/season-mode` 의 `seasonStadiumOf` 가 본다.
 *
 * 관중 단계(만원 판정 SR+0x65 + 1)는 **이 경기의 것**이다 — 경기 장면 셋업(0x39fdc 모드 2 갈래 0x3a3e4)이 정규시즌이면
 * 관중·수입 0xa34b8 을 돌려 그 칸을 새로 쓴 뒤 타석 준비 0x353c2 가 읽는다. 9경기까지는 순위를 안 본다(+100).
 */
const 이경기관중단계 = (record: SeasonRecord) => attendanceOf(record, { myRank: 0, opponentRank: 0 }).crowdLevel + 1

/** 타석 화면은 캔버스라 여기서는 띄우지 않는다 — 넘어온 prop 만 받아 적는다 */
const 받은Prop = vi.hoisted(() => ({ 값: undefined as unknown }))
vi.mock('@/pages/team-game/ui/TeamGameScreen', () => ({
  TeamGameScreen: (props: { readonly seasonStadium?: unknown }) => {
    받은Prop.값 = props.seasonStadium
    return <div>경기화면</div>
  },
}))

afterEach(cleanup)

function 메모리저장(초기: unknown = null): JsonStorePort {
  let held = 초기
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
  }
}

const 설정저장 = 메모리저장()

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

function 시즌화면({ store }: { readonly store: JsonStorePort }) {
  const session = useSeasonSession(store, createSeededRandom(20100901))
  const gameSettings = useGameSettings(설정저장)
  const { goto } = session.actions
  useEffect(() => {
    goto(SEASON_SCENE_STATE.다음경기)
  }, [goto])
  return (
    <SeasonRoute
      session={session}
      random={createSeededRandom(20100901)}
      gameSettings={gameSettings}
      onExit={vi.fn()}
    />
  )
}

/** "다음경기" 확인 → 마선수 고르기 0xd7 → 경기정보 0xdd → 경기(0xe1 → 0x104)까지 간다 */
function 경기를연다(record: SeasonRecord) {
  받은Prop.값 = undefined
  render(<시즌화면 store={메모리저장({ state: { record } })} />)
  // 다음경기 0xd8 의 확인 (키 0x48d0 −5) → 0xd7 경기 전 마선수 고르기
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  // 새 저장은 싸이커(칸 0)·메디카(칸 5)만 열려 있다 — 단계마다 누를 수 있는 격자 칸이 하나뿐이다
  const 열린칸 = () => screen.getAllByRole('button')
    .filter((button) => button.hasAttribute('aria-pressed') && !(button as HTMLButtonElement).disabled)[0]
  fireEvent.click(열린칸())
  fireEvent.click(열린칸())
  // 0xdd 경기정보 — 처음이라 경기진행 설정 창이 저절로 열린다. CLR 로 닫고 경기 시작
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: '경기 시작' }))
  return 받은Prop.값
}

describe('시즌 구장 배선 — 홈경기에만 장착 장비가 간다 (0x40ff0)', () => {
  it('홈경기면 관중석·전광판·관중 단계를 그대로 넘긴다 (0x353ac~0x353e6)', () => {
    // 팀 0 은 0일차에 홈이다 (0xb7844)
    expect(leagueSideOf(0, 0)).toBe(LEAGUE_SIDE_HOME)

    const record = 레코드({ games: 0, stadiumEquipped: [3, 5, 2], crowdLevel: 2 })
    // 저장에 남은 앞 경기 판정(2)이 아니라 셋업이 새로 낸 값이다
    expect(이경기관중단계(record)).toBe(2)
    expect(경기를연다(record)).toEqual({ stand: 3, crowd: 2, board: 5, grassPalette: 0 })
  })

  it('⚠️ 원정경기면 안 넘긴다 — 일반 구장(0x77974)으로 그려져야 원본과 같다', () => {
    // 팀 0 은 9일차에 원정이다
    expect(leagueSideOf(9, 0)).not.toBe(LEAGUE_SIDE_HOME)

    expect(경기를연다(레코드({ games: 9, stadiumEquipped: [3, 5, 2], crowdLevel: 2 }))).toBeUndefined()
  })

  it('아무것도 안 샀으면 0번 칸이 가고, 관중은 이 경기 만원 판정 + 1 단계다', () => {
    const record = 레코드({ games: 0 })
    expect(경기를연다(record)).toEqual({ stand: 0, crowd: 이경기관중단계(record), board: 0, grassPalette: 2 })
  })

  it('잔디도 같이 간다 — 칸 3(특급천연잔디)만 줄이 없어 기본 팔레트다 (0x786c8)', () => {
    const 특급 = 레코드({ games: 0, stadiumEquipped: [0, 0, 3] })
    expect(경기를연다(특급)).toEqual({ stand: 0, crowd: 이경기관중단계(특급), board: 0, grassPalette: null })
    const 천연 = 레코드({ games: 0, stadiumEquipped: [0, 0, 1] })
    expect(경기를연다(천연)).toEqual({ stand: 0, crowd: 이경기관중단계(천연), board: 0, grassPalette: 1 })
  })
})
