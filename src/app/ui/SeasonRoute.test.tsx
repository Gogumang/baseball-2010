// @vitest-environment jsdom
import { useEffect } from 'react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonRoute } from '@/app/ui/SeasonRoute'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { useGameSettings } from '@/app/model/useGameSettings'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_PHASE, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { stadiumOwnedIndexOf } from '@/entities/season-mode/model/stadiumItems'
import { TEAMS } from '@/shared/config/original/teams'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import type { Collection, HallOfFamePitcher, HallOfFamer } from '@/entities/collection/model/collection'

/**
 * 시즌 모드 라우팅(0x105) 배선 — **화면이 있는데 라우팅에 없어 못 뜨던 것**들을 못박는다.
 *   ① 엔딩 0xf5 → `SeasonEndingScreen` (P4 1a · P6 4b)
 *   ② 구장 상점의 히든 해금 플래그(app+0xe0, S3 7절) 를 세션과 잇는다
 */

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

/** 환경설정 저장은 어느 판에서나 같은 칸을 쓴다 (매 렌더 새로 만들면 효과가 계속 돈다) */
const 설정저장 = 메모리저장()

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

/** 시즌 세이브 한 칸 — `normalizeSeasonSave` 가 리그·로스터를 채워 준다 */
const 세이브 = (record: SeasonRecord) => ({ state: { record } })

interface 화면Props {
  readonly store: JsonStorePort
  /** 들어오자마자 옮겨 갈 장면 (원본 상태 번호) */
  readonly 장면?: SeasonSceneState
  readonly onExit: () => void
  readonly hallOfFame?: Collection
  readonly nari?: NonNullable<ComponentProps<typeof SeasonRoute>['nari']>
  readonly nariRecords?: NonNullable<ComponentProps<typeof SeasonRoute>['nariRecords']>
}

function 시즌화면({ store, 장면, onExit, hallOfFame, nari, nariRecords }: 화면Props) {
  const session = useSeasonSession(store, createSeededRandom(20100901))
  const gameSettings = useGameSettings(설정저장)
  const { goto } = session.actions
  useEffect(() => {
    if (장면 !== undefined) goto(장면)
  }, [goto, 장면])
  return (
    <SeasonRoute
      session={session}
      random={createSeededRandom(20100901)}
      gameSettings={gameSettings}
      onExit={onExit}
      {...(hallOfFame === undefined ? {} : { hallOfFame })}
      {...(nari === undefined ? {} : { nari })}
      {...(nariRecords === undefined ? {} : { nariRecords })}
    />
  )
}

const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('엔딩 0xf5 배선', () => {
  it('phase 6 으로 들어오면 **엔딩 화면**이 뜬다 — 예전에는 "화면이 없습니다" 로 샜다', () => {
    const store = 메모리저장(세이브(레코드({
      phase: SEASON_PHASE.엔딩, yearIndex: 9, popularity: 900,
      // 10년을 다 치른 시즌이라 대상 4 자동 이벤트(400·1·5·100)는 이미 봤다 — 안 그러면 관리 메뉴 폴링이 400 을 튼다
      seenEvents: [400, 1, 5, 100],
    })))

    render(<시즌화면 store={store} onExit={vi.fn()} />)

    // 인기도 900 · 1위 0회 → 판정 1 = StrENDING[16] 지역 인기 구단 (0xa3084)
    expect(document.body.textContent).toContain('지역 인기 구단')
    expect(screen.getByLabelText('원형 전환')).toBeDefined()
  })

  it('엔딩 보너스까지 보고 나면 **메인 메뉴로 나간다**', () => {
    const onExit = vi.fn()
    const store = 메모리저장(세이브(레코드({
      phase: SEASON_PHASE.엔딩, yearIndex: 9, popularity: 900,
      // 10년을 다 치른 시즌이라 대상 4 자동 이벤트(400·1·5·100)는 이미 봤다 — 안 그러면 관리 메뉴 폴링이 400 을 튼다
      seenEvents: [400, 1, 5, 100],
    })))
    render(<시즌화면 store={store} onExit={onExit} />)

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    // 판정 1 → 표값 3 × 1000 = 3000 G (StrMODE[214])
    expect(알림글()).toContain('3000 G포인트')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(onExit).toHaveBeenCalled()
  })

  it('엔딩을 그리면 SR+0x1bc 가 서서 다음에 들어올 때는 관리 메뉴다 (0x8bd8 → 0xcb)', () => {
    const store = 메모리저장(세이브(레코드({
      phase: SEASON_PHASE.엔딩, yearIndex: 9, popularity: 900,
      // 10년을 다 치른 시즌이라 대상 4 자동 이벤트(400·1·5·100)는 이미 봤다 — 안 그러면 관리 메뉴 폴링이 400 을 튼다
      seenEvents: [400, 1, 5, 100],
    })))
    render(<시즌화면 store={store} onExit={vi.fn()} />)
    cleanup()

    render(<시즌화면 store={store} onExit={vi.fn()} />)

    expect(document.body.textContent).not.toContain('지역 인기 구단')
    expect(screen.getByRole('button', { name: '다음경기' })).toBeDefined()
  })
})

describe('구장 상점 히든 해금 배선 (app+0xe0)', () => {
  const 관중석 = (slots: readonly number[], 덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => {
    const base = 레코드({ popularity: 9999, money: 9999, ...덮어쓰기 })
    return {
      ...base,
      stadiumOwned: base.stadiumOwned.map((owned, index) =>
        slots.some((slot) => stadiumOwnedIndexOf('관중석', slot) === index) ? true : owned,
      ),
    }
  }

  it('기본 4칸을 모으면 히든 칸이 **열린 채로 남는다** — 예전에는 onUnlock 이 없어 사라졌다', () => {
    const store = 메모리저장(세이브(관중석([0, 1, 2])))
    render(<시즌화면 store={store} 장면={SEASON_SCENE_STATE.아이템상점} onExit={vi.fn()} />)
    // 사기 전에는 히든 세 칸이 모두 "???" 다
    expect(screen.getAllByRole('button', { name: '관중석 ???' })).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: '관중석 4단 관중석' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' })) // 구매 완료 팝업 닫기

    // 컬렉터 해금 13 이 열려 관중석 히든 4(트로피컬) 이름이 보인다
    expect(screen.getByRole('button', { name: '관중석 트로피컬' })).toBeDefined()
    expect(screen.getAllByRole('button', { name: '관중석 ???' })).toHaveLength(2)
  })

  it('열린 히든 칸은 실제로 살 수 있다 (checkStadiumPurchase 의 미오픈 가드를 지난다)', () => {
    const store = 메모리저장(세이브(관중석([0, 1, 2])))
    render(<시즌화면 store={store} 장면={SEASON_SCENE_STATE.아이템상점} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '관중석 4단 관중석' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    fireEvent.click(screen.getByRole('button', { name: '관중석 트로피컬' }))

    // 미오픈(StrMODE[76]) 이 아니라 구매 확인(StrMODE[79]) 이 뜬다
    expect(알림글()).toContain('구매하겠습니까')
  })
})

describe('구단관리 트레이드·코치채용 배선 (0xe4 · 0xd7)', () => {
  it('트레이드를 고르면 "아직 없습니다" 가 아니라 **팀 고르기**가 뜬다', () => {
    const store = 메모리저장(세이브(레코드()))
    render(<시즌화면 store={store} 장면={SEASON_SCENE_STATE.구단관리} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /트레이드/ }))

    expect(document.body.textContent).not.toContain('아직 없습니다')
    expect(screen.getAllByRole('button', { name: TEAMS[1].name }).length).toBeGreaterThan(0)
  })

  it('트레이드를 한 번 쓰면(SR+0x56) 가드가 걸린다', () => {
    const store = 메모리저장(세이브(레코드({ tradeUsed: 1 })))
    render(<시즌화면 store={store} 장면={SEASON_SCENE_STATE.구단관리} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /트레이드/ }))

    expect(알림글()).toContain('이미 사용했습니다')
    expect(screen.queryAllByRole('button', { name: TEAMS[1].name })).toHaveLength(0)
  })

  it('코치채용을 고르면 코치 목록이 뜨고, 뽑은 코치가 **저장에 남는다** (SR+0x185)', () => {
    const store = 메모리저장(세이브(레코드({ money: 9999, popularity: 9999 })))
    render(<시즌화면 store={store} 장면={SEASON_SCENE_STATE.구단관리} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /코치채용/ }))
    expect(screen.getByRole('button', { name: /싸이커/ })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /싸이커/ }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    const saved = store.load() as { state: { record: SeasonRecord } }
    expect(saved.state.record.coach).toBe(0)
    // 계약금 1억(= 100) 이 빠졌다
    expect(saved.state.record.money).toBe(9899)
  })
})

describe('이벤트 재생 0xd3 배선', () => {
  it('해마다 첫 관리 메뉴에서 연초 목표 — 감독 대사 다음 올해의 목표 창, 닫으면 관리 메뉴', () => {
    const store = 메모리저장(세이브(레코드({ seenEvents: [400, 1] })))
    render(<시즌화면 store={store} onExit={vi.fn()} />)

    expect(document.body.textContent).toContain('올해의 목표다!!')
    fireEvent.click(screen.getByText(/올해의 목표다!!/))
    // SYS(sub 1) 창 — 제목 StrUSER_EVT[0] 아래에 1년차 다섯 목표
    expect(document.body.textContent).toContain('순위 5위 이내')
    fireEvent.click(screen.getByText(/순위 5위 이내/))

    expect(screen.getByRole('button', { name: '다음경기' })).toBeDefined()
  })
})

describe('아이템 메뉴 0xd0 배선', () => {
  it('구장아이템은 아이템 상점(0xdc 창 4)으로 가고, 웹에 없는 창(GP아이템 2)은 "아직 없음" 으로 막는다', () => {
    const store = 메모리저장(세이브(레코드({ seenEvents: [400, 1], yearGoalShown: true })))
    render(<시즌화면 store={store} 장면={SEASON_SCENE_STATE.아이템} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'GP아이템' }))
    expect(알림글()).toContain('창 종류 2')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    fireEvent.click(screen.getByRole('button', { name: '구장아이템' }))
    expect(screen.getAllByRole('button', { name: /관중석/ }).length).toBeGreaterThan(0)
  })
})

describe('선수영입 후보 목록 = 명예의 전당 목록 종류 0 (진입 0xe1dc · 키 0xe340)', () => {
  const 띄우기 = () => {
    const store = 메모리저장(세이브(레코드({ seenEvents: [400, 1, 5, 100], yearGoalShown: true })))
    const 투수 = {
      name: '김전당', ability: { control: 1, velocity: 2, breaking: 3, stamina: 4 },
      equippedAbility: { control: 1, velocity: 2, breaking: 3, stamina: 4 }, endingIndex: 5, season: 10, titleIds: [], slot: 1,
      look: { typeIndex: 0, handIndex: 0, skinIndex: 0, teamId: 1 },
    } satisfies HallOfFamePitcher
    const 타자 = { name: '이전당', ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [] } satisfies HallOfFamer
    render(
      <시즌화면
        store={store}
        장면={SEASON_SCENE_STATE.선수영입}
        onExit={vi.fn()}
        hallOfFame={{ ...EMPTY_COLLECTION, hallOfFamePitchers: [투수], hallOfFame: [타자] }}
      />,
    )
    return store
  }
  const 슬롯 = (index: number) => screen.getByRole('button', { name: `${index + 1}번 슬롯` })

  it('명예 투수·타자가 0x5eb8c 칸 배치(투수 1~4 · 타자 6~9)에 찬 칸으로 뜨고, 나리 칸은 없음(상태 2)', () => {
    띄우기()

    // 투수 칸 1 → 격자 2, 타자 칸 0(옛 저장 = 목록 순서) → 격자 6
    expect(슬롯(2).dataset.kind).toBe('찬칸')
    expect(슬롯(6).dataset.kind).toBe('찬칸')
    expect(슬롯(0).dataset.state).toBe('2')
    expect(슬롯(1).dataset.state).toBe('4')
  })

  it('열린 빈 칸은 StrCOMMON[39], 나리 없음은 [38] — 목록이 띄우고 자리 고르기로 가지 않는다', () => {
    띄우기()

    fireEvent.click(슬롯(1))
    expect(screen.getByText(/명예의전당 선수를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(슬롯(0))
    expect(screen.getByText(/나만의리그 선수를/)).toBeTruthy()
  })

  it('명예 선수를 고르면 자리 고르기(0xdf)로 가고, 고른 자리에 기록 번호 칸 + 0xb4 로 끼워 넣는다', () => {
    const store = 띄우기()

    fireEvent.click(슬롯(2))
    const 자리 = screen.getAllByRole('button').find((button) => /#0/.test(button.textContent ?? ''))
    expect(자리).toBeTruthy()
    fireEvent.click(자리!)

    const saved = store.load() as { roster: { pitchers: { id: number }[] } }
    expect(saved.roster.pitchers[0]?.id).toBe(0xb5)
  })
})

describe('선수영입 나리 칸 0·5 — 0x22168 · 0x220ec 의 내 선수 기록을 id 0xfe 로 통째 옮긴다', () => {
  const 나리투수 = {
    name: '나리투수', ability: [10, 20, 30, 40] as const,
    repertoire: { name: '나리투수', form: 0, magicId: 2, pitchMask: 0b101 }, role: 2 as const,
  }
  const 나리타자 = { name: '나리타자', ability: [1, 2, 3, 4] as const }
  const 띄우기 = () => {
    const store = 메모리저장(세이브(레코드({ seenEvents: [400, 1, 5, 100], yearGoalShown: true })))
    render(
      <시즌화면
        store={store}
        장면={SEASON_SCENE_STATE.선수영입}
        onExit={vi.fn()}
        hallOfFame={EMPTY_COLLECTION}
        nari={{ 투수: { name: '나리투수', equippedAbility: [10, 20, 30, 40] }, 타자: { name: '나리타자', equippedAbility: [1, 2, 3, 4] } }}
        nariRecords={{ 투수: 나리투수, 타자: 나리타자 }}
      />,
    )
    return store
  }
  const 슬롯 = (index: number) => screen.getByRole('button', { name: `${index + 1}번 슬롯` })
  const 자리0 = () => screen.getAllByRole('button').find((button) => /#0/.test(button.textContent ?? ''))

  it('나리 투수를 고르면 자리 고르기(0xdf)로 가고 id 0xfe · +0xa 0x80(칸 번호 갈아끼움) · 기록 사본으로 끼워 넣는다', () => {
    const store = 띄우기()

    fireEvent.click(슬롯(0))
    fireEvent.click(자리0()!)

    const saved = store.load() as { roster: { pitchers: { id: number; kindByte: number; stamina: number; record?: unknown }[] } }
    expect(saved.roster.pitchers[0]).toMatchObject({ id: 0xfe, kindByte: 0x80, stamina: 10000, record: 나리투수 })
  })

  it('나리 타자는 +0xa 0xa0 · 기록 사본으로 끼워 넣는다', () => {
    const store = 띄우기()

    fireEvent.click(슬롯(5))
    fireEvent.click(자리0()!)
    const saved = store.load() as { roster: { batters: { id: number; kindByte: number; record?: unknown }[] } }
    expect(saved.roster.batters[0]).toMatchObject({ id: 0xfe, kindByte: 0xa0, record: 나리타자 })
  })
})
