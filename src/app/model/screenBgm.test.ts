// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { NARI_STATE, pitcherLeagueBgmOf, restartsManagementBgmFrom, restartsMenuBgm, screenBgmOf, stopsSoundOnEnter, useResumeCoverStop, useSceneEnterStop, seasonEndingBgmOf, seasonMenuBgmOf, seasonSceneBgmOf, restartsTeamSelectBgm, restartsNextGameStandingsBgm, playEndingContinueBgm, usePitcherLeagueBgm, usePitcherLeagueBgmRestart, useScreenBgm, useSeasonMenuBgm } from '@/app/model/screenBgm'
import type { Screen } from '@/app/model/screen'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import { useSceneBgm } from '@/app/model/useSound'
import type { PitcherScene } from '@/app/model/usePitcherLeagueSession'

describe('포스트시즌 대진 128 배경음 — 진입 0x120a4 (이전 상태 1 일 때만 4)', () => {
  it('이어하기(100 → 1 → 128)면 배경음 4', () => {
    expect(screenBgmOf({ kind: '포스트시즌', popup: null, fromReentry: true })).toBe(4)
    // 팝업이 떠도 같은 배경음 — 진입에서만 정한다
    expect(screenBgmOf({ kind: '포스트시즌', popup: { kind: '정규시즌우승' }, fromReentry: true })).toBe(4)
  })

  it('131 뒤·경기 뒤는 114 이벤트 재생을 지나와 그 배경음 40 이 이어진다', () => {
    expect(screenBgmOf({ kind: '포스트시즌', popup: null })).toBe(40)
    expect(screenBgmOf({ kind: '포스트시즌', popup: null, fromReentry: false })).toBe(40)
  })
})

describe('투수편 배경음 — 안쪽 장면을 본다 (128 진입 0x120a4 는 타자편과 같다)', () => {
  it('장면 0x106 에 들어선 순간 128 이면 이어하기 — 4, 128 을 떠났다 다시 오면 114 의 40', () => {
    const { result, rerender } = renderHook(
      ({ isActive, scene }: { isActive: boolean; scene: PitcherScene }) => usePitcherLeagueBgm(isActive, scene),
      { initialProps: { isActive: false, scene: '포스트시즌' as PitcherScene } },
    )
    expect(result.current).toBeNull()
    rerender({ isActive: true, scene: '포스트시즌' })
    expect(result.current).toBe(4)
    // 142 를 들렀다 취소로 돌아와도 128 진입은 이전 142 라 배경음을 안 바꾼다 — 이어하기 4 그대로
    rerender({ isActive: true, scene: '경기준비' })
    expect(result.current).toBeNull()
    rerender({ isActive: true, scene: '포스트시즌' })
    expect(result.current).toBe(4)
    // 경기 장면은 0x3e350 이 끊고 시작한다 — 화면 표는 안 바꾼다
    rerender({ isActive: true, scene: '경기' })
    expect(result.current).toBeNull()
    rerender({ isActive: true, scene: '포스트시즌' })
    expect(result.current).toBe(40)
    // 메인 메뉴로 나갔다가 다시 들어오면 다시 이어하기 진입이다
    rerender({ isActive: false, scene: '포스트시즌' })
    rerender({ isActive: true, scene: '포스트시즌' })
    expect(result.current).toBe(4)
  })

  it('105 관리 화면은 틀 0x1aec4 의 4 (모드 갈림 없음) — 상점·외출은 그 4 가 이어진다', () => {
    expect(pitcherLeagueBgmOf('관리', false)).toBe(4)
    expect(pitcherLeagueBgmOf('상점', false)).toBe(4)
    expect(pitcherLeagueBgmOf('외출', false)).toBe(4)
  })

  it('그 밖 장면은 예전 근사 3', () => {
    expect(pitcherLeagueBgmOf('등록', false)).toBe(3)
    expect(pitcherLeagueBgmOf('포스트시즌', true)).toBe(4)
    expect(pitcherLeagueBgmOf('포스트시즌', false)).toBe(40)
    // 109 진입 0x10d8c — 타자편과 같은 4 (이전 ≠ 105 면 0x6ea6d(…, 4, −1, 1), 105 에서 오면 105 의 4 그대로)
    expect(pitcherLeagueBgmOf('다음경기순위', false)).toBe(4)
    // 142 진입 0x1c46c 는 배경음을 안 건드린다
    expect(pitcherLeagueBgmOf('경기준비', false)).toBeNull()
  })

  it('시즌 끝 사슬(136 · 130 · 131 · 132 · 133)과 국가대항전(134 · 135)은 배경음을 안 건드린다 — 진입 · 처리 · 키 · 그리기에 소리 호출이 없다', () => {
    expect(pitcherLeagueBgmOf('국가대항전', false)).toBeNull()
  })
})

describe('시즌 관리 메뉴 0xc9 의 틀 0x73b8 — 이전 상태가 목록에 들면 배경음 4', () => {
  it('원본 목록 {0xcb, 0xcc, 0xe3, 0xde, 0xf9, 0xe4, 0xe6, 0xe5, 0xd3, 1} 과 장면 첫 진입(0xcb)', () => {
    for (const from of [0xcb, 0xcc, 0xe3, 0xde, 0xf9, 0xe4, 0xe6, 0xe5, 0xd3, 1]) expect(seasonMenuBgmOf(from)).toBe(4)
    expect(seasonMenuBgmOf(null)).toBe(4)
  })

  it('목록 밖(0xcd 시즌정보 · 0xce 구단관리 · 0xd8 다음경기 · 0xf1 마무리)이면 안 바꾼다', () => {
    // 0xd1 외출 지도의 취소 — 외출은 이제 0xe3 을 거쳐 온다
    for (const from of [0xcd, 0xce, 0xd8, 0xf1, 0xd0, 0xd1]) expect(seasonMenuBgmOf(from)).toBeNull()
  })

  it('훅 — 시즌모드에 들어서며 0xc9 면 틀고, 목록 밖에서 돌아오면 안 튼다', () => {
    const sound = createSilentSound()
    const played: number[] = []
    const port = { ...sound, playBgm: (id: number) => { played.push(id) } }
    const { rerender } = renderHook(
      ({ isActive, scene }: { isActive: boolean; scene: number }) => useSeasonMenuBgm(port, isActive, scene),
      { initialProps: { isActive: false, scene: 0xc9 } },
    )
    expect(played).toEqual([])
    rerender({ isActive: true, scene: 0xc9 })
    expect(played).toEqual([4])
    rerender({ isActive: true, scene: 0xcd })
    rerender({ isActive: true, scene: 0xc9 })
    expect(played).toEqual([4])
    rerender({ isActive: true, scene: 0xd3 })
    rerender({ isActive: true, scene: 0xc9 })
    expect(played).toEqual([4, 4])
  })

  it('트레이닝 0xcf — 결과 팝업이 섰으면(원본 0xde) 4 를 다시 틀고, 취소로 돌아오면 안 튼다', () => {
    const played: number[] = []
    const port = { ...createSilentSound(), playBgm: (id: number) => { played.push(id) } }
    const { rerender } = renderHook(
      ({ scene, shown }: { scene: number; shown: boolean }) => useSeasonMenuBgm(port, true, scene, shown),
      { initialProps: { scene: 0xc9, shown: false } },
    )
    expect(played).toEqual([4])
    rerender({ scene: 0xcf, shown: false })
    rerender({ scene: 0xc9, shown: false })
    expect(played).toEqual([4])
    rerender({ scene: 0xcf, shown: false })
    rerender({ scene: 0xcf, shown: true })
    rerender({ scene: 0xc9, shown: false })
    expect(played).toEqual([4, 4])
  })
})

describe('안쪽 상태별 배경음 (r296 — 호출지 전수)', () => {
  it("최상위 '시즌모드' 는 배경음을 안 바꾼다 — 0xcb 진입 분기가 고른 첫 상태가 튼다", () => {
    expect(screenBgmOf({ kind: '시즌모드' })).toBeNull()
  })

  it('시즌 상태 진입 — 0xca 팀 고르기 0x50a8 은 조건 없이 3, 0xc9 는 이전 상태 목록이면 4, 그 밖(0xd8 · 0xf3 …)은 안 바꾼다', () => {
    expect(seasonSceneBgmOf(null, 0xca)).toBe(3)
    expect(seasonSceneBgmOf(0xc9, 0xca)).toBe(3)
    expect(seasonSceneBgmOf(null, 0xc9)).toBe(4)
    expect(seasonSceneBgmOf(0xcd, 0xc9)).toBeNull()
    for (const scene of [0xd8, 0xf3, 0xcd, 0xe1, 0xdd]) expect(seasonSceneBgmOf(null, scene)).toBeNull()
  })

  it('훅 — 시즌모드에 0xca 로 들어서면 3, 관리 메뉴에서 0xca 로 가도 3 을 처음부터, 0xd8 로 들어서면 아무것도 안 튼다', () => {
    const played: number[] = []
    const port = { ...createSilentSound(), playBgm: (id: number) => { played.push(id) } }
    const { rerender } = renderHook(
      ({ isActive, scene }: { isActive: boolean; scene: number }) => useSeasonMenuBgm(port, isActive, scene),
      { initialProps: { isActive: true, scene: 0xca } },
    )
    expect(played).toEqual([3])
    rerender({ isActive: true, scene: 0xc9 })
    rerender({ isActive: true, scene: 0xca })
    expect(played).toEqual([3, 4, 3])
    rerender({ isActive: false, scene: 0xd8 })
    rerender({ isActive: true, scene: 0xd8 })
    expect(played).toEqual([3, 4, 3])
  })

  it('타자편 등록(102)에서 팀 고르기(101)로 물러나면 101 진입 0x10790 이 3 을 처음부터 다시 튼다', () => {
    expect(restartsTeamSelectBgm('선수등록', '팀선택')).toBe(true)
    expect(restartsTeamSelectBgm('메인메뉴', '팀선택')).toBe(false)
    const { result, rerender } = renderHook(({ screen }: { screen: Screen }) => useScreenBgm(screen), {
      initialProps: { screen: { kind: '팀선택' } as Screen },
    })
    const start = result.current.restartSerial
    rerender({ screen: { kind: '선수등록', teamId: 1 } as Screen })
    expect(result.current.restartSerial).toBe(start)
    rerender({ screen: { kind: '팀선택' } as Screen })
    expect(result.current.restartSerial).toBe(start + 1)
    expect(result.current.bgm).toBe(3)
  })

  it('투수편 — 3 은 등록(101)만, 마선수 대결(경기 장면이 끊음)과 판정 없는 엔딩은 안 바꾼다', () => {
    expect(pitcherLeagueBgmOf('등록', false)).toBe(3)
    expect(pitcherLeagueBgmOf('마선수대결', false)).toBeNull()
    expect(pitcherLeagueBgmOf('엔딩', false, null)).toBeNull()
  })

  it('엔딩 141 이어하기 1be2a~1be40 — 끊고(0x6e418) 4 를 튼다', () => {
    const calls: string[] = []
    const port = {
      ...createSilentSound(),
      stop: () => { calls.push('stop') },
      playBgm: (id: number) => { calls.push(`bgm ${id}`) },
    }
    playEndingContinueBgm(port)
    expect(calls).toEqual(['stop', 'bgm 4'])
  })
})

describe('109 진입 0x10d8c — 142 취소로 돌아오면(이전 ≠ 105) 4 를 처음부터 다시 튼다', () => {
  it('규칙 — 경기준비 → 다음경기순위만', () => {
    expect(restartsNextGameStandingsBgm('경기준비', '다음경기순위')).toBe(true)
    expect(restartsNextGameStandingsBgm('관리', '다음경기순위')).toBe(false)
    expect(restartsNextGameStandingsBgm('경기준비', '포스트시즌')).toBe(false)
  })

  it('타자편 — 관리 → 109 는 잇고, 142 → 109 는 다시 틀기 표가 오른다', () => {
    const { result, rerender } = renderHook(({ screen }: { screen: Screen }) => useScreenBgm(screen), {
      initialProps: { screen: { kind: '관리' } as Screen },
    })
    const start = result.current.restartSerial
    rerender({ screen: { kind: '다음경기순위', fromManagement: true } as Screen })
    expect(result.current.restartSerial).toBe(start)
    rerender({ screen: { kind: '경기준비' } as Screen })
    rerender({ screen: { kind: '다음경기순위', fromManagement: false } as Screen })
    expect(result.current.restartSerial).toBe(start + 1)
    expect(result.current.bgm).toBe(4)
  })

  it('투수편 — 경기준비 → 다음경기순위에 표가 오른다', () => {
    const { result, rerender } = renderHook(
      ({ scene }: { scene: '관리' | '다음경기순위' | '경기준비' }) => usePitcherLeagueBgmRestart(true, scene),
      { initialProps: { scene: '관리' as '관리' | '다음경기순위' | '경기준비' } },
    )
    rerender({ scene: '다음경기순위' })
    expect(result.current).toBe(0)
    rerender({ scene: '경기준비' })
    rerender({ scene: '다음경기순위' })
    expect(result.current).toBe(1)
  })
})

describe('관리 화면 105 처리 0x1aec4 — 외출 지도(112)에서 돌아오면 4 를 처음부터 다시 튼다', () => {
  it('타자편 — 외출 → 관리는 다시 틀기 표가 오르고, 상점 → 관리는 안 오른다', () => {
    const { result, rerender } = renderHook(({ screen }: { screen: Screen }) => useScreenBgm(screen), {
      initialProps: { screen: { kind: '관리' } as Screen },
    })
    const start = result.current.restartSerial
    rerender({ screen: { kind: '외출' } as Screen })
    rerender({ screen: { kind: '관리' } as Screen })
    expect(result.current.restartSerial).toBe(start + 1)
    expect(result.current.bgm).toBe(4)
    rerender({ screen: { kind: '아이템', tab: '장착' } as Screen })
    rerender({ screen: { kind: '관리' } as Screen })
    expect(result.current.restartSerial).toBe(start + 1)
  })

  it('투수편 — 안쪽 장면 외출 → 관리에서 오른다', () => {
    const { result, rerender } = renderHook(
      ({ scene }: { scene: '관리' | '외출' | '상점' }) => usePitcherLeagueBgmRestart(true, scene),
      { initialProps: { scene: '관리' as '관리' | '외출' | '상점' } },
    )
    expect(result.current).toBe(0)
    rerender({ scene: '외출' })
    rerender({ scene: '관리' })
    expect(result.current).toBe(1)
    rerender({ scene: '상점' })
    rerender({ scene: '관리' })
    expect(result.current).toBe(1)
  })

  it('useSceneBgm — 표가 오르면 같은 4 도 처음부터 다시 튼다', () => {
    const played: number[] = []
    const port = { ...createSilentSound(), playBgm: (id: number) => { played.push(id) } , currentBgm: () => 4 }
    const { rerender } = renderHook(({ serial }: { serial: number }) => useSceneBgm(port, 4, serial), {
      initialProps: { serial: 0 },
    })
    expect(played).toEqual([4])
    rerender({ serial: 0 })
    expect(played).toEqual([4])
    rerender({ serial: 1 })
    expect(played).toEqual([4, 4])
  })
})

describe('엔딩 141 배경음 — 진입 0x12300 의 12328 `cmp e,#1 ; bgt` (부호 있음)', () => {
  it('e ≤ 1(−1 판정 없음 · 0 부상 · 1 방출)이면 0x34, 그 밖은 0x2e', () => {
    expect(screenBgmOf({ kind: '엔딩', endingIndex: -1 })).toBe(52)
    expect(screenBgmOf({ kind: '엔딩', endingIndex: 0 })).toBe(52)
    expect(screenBgmOf({ kind: '엔딩', endingIndex: 1 })).toBe(52)
    expect(screenBgmOf({ kind: '엔딩', endingIndex: 2 })).toBe(46)
    expect(screenBgmOf({ kind: '엔딩', endingIndex: 9 })).toBe(46)
  })

  it('투수편도 같은 진입이다 (모드 갈림 없음)', () => {
    expect(pitcherLeagueBgmOf('엔딩', false, -1)).toBe(52)
    expect(pitcherLeagueBgmOf('엔딩', false, 0)).toBe(52)
    expect(pitcherLeagueBgmOf('엔딩', false, 5)).toBe(46)
  })
})

describe('시즌모드 10년차 엔딩 0xf5 배경음 — 진입 0x6be8 의 6c4a `cmp r5,#0 ; bne` (0 하나만 52)', () => {
  it('엔딩 0(비 인기 구단) → 52, 1~4 · 판정 없음(−1) → 46', () => {
    expect(seasonEndingBgmOf(0)).toBe(52)
    expect(seasonEndingBgmOf(1)).toBe(46)
    expect(seasonEndingBgmOf(4)).toBe(46)
    expect(seasonEndingBgmOf(null)).toBe(46)
  })
})

describe('경기 장면 — 0x3e340 의 맨 앞 0x3e350 이 소리를 끊고 시작한다 (경기 안 배경음은 중계 33 · 벤치클리어링 44 뿐)', () => {
  it('경기 · 미션 · 마선수대결 화면은 배경음을 안 바꾼다', () => {
    expect(screenBgmOf({ kind: '경기' })).toBeNull()
    expect(pitcherLeagueBgmOf('경기', false)).toBeNull()
  })

  it('화면 배경음 훅 — 끊긴 뒤 같은 번호의 화면으로 돌아오면 다시 튼다', () => {
    const played: number[] = []
    let remembered: number | null = null
    const port = {
      ...createSilentSound(),
      playBgm: (id: number) => {
        played.push(id)
        remembered = id
      },
      currentBgm: () => remembered,
    }
    const { rerender } = renderHook(({ bgm }: { bgm: number | null }) => useSceneBgm(port, bgm), {
      initialProps: { bgm: 4 as number | null },
    })
    expect(played).toEqual([4])
    // 같은 번호가 기억돼 있으면 다시 안 튼다
    rerender({ bgm: null })
    rerender({ bgm: 4 })
    expect(played).toEqual([4])
    // 경기 장면이 끊었다(0x6e418 — 기억도 잊는다)
    rerender({ bgm: null })
    remembered = null
    rerender({ bgm: 4 })
    expect(played).toEqual([4, 4])
  })
})

describe('메인 메뉴 아래 화면 — 상태 7 · 8 · 13 · 하위 목록은 진입 표 0xcea84 의 빈 칸이라 1 이 이어진다', () => {
  it('도움말 · 환경설정 · 스페셜은 배경음을 안 바꾼다', () => {
    for (const kind of ['도움말', '환경설정', '스페셜'] as const) expect(screenBgmOf({ kind })).toBeNull()
    expect(screenBgmOf({ kind: '메인메뉴' })).toBe(1)
  })

  it('환경설정 진입 0x259fc 는 끝에서 소리를 끊는다(0x6e419) — 다른 메뉴 아래 화면은 안 끊는다', () => {
    expect(stopsSoundOnEnter({ kind: '환경설정' })).toBe(true)
    expect(stopsSoundOnEnter({ kind: '도움말' })).toBe(false)
    const stops: string[] = []
    const port = { ...createSilentSound(), stop: () => stops.push('끊기') }
    const { rerender } = renderHook(({ screen }: { screen: Screen }) => useSceneEnterStop(port, screen), {
      initialProps: { screen: { kind: '메인메뉴' } as Screen },
    })
    rerender({ screen: { kind: '환경설정' } })
    rerender({ screen: { kind: '환경설정' } })
    expect(stops).toEqual(['끊기'])
  })

  it('환경설정에서 돌아올 때(0x24a40 이전 8) · 게임시작 목록으로 새로 설 때(0x25b88 이전 ≠ 4)만 1 을 처음부터', () => {
    expect(restartsMenuBgm('환경설정', { kind: '메인메뉴' })).toBe(true)
    expect(restartsMenuBgm('도움말', { kind: '메인메뉴' })).toBe(false)
    expect(restartsMenuBgm('스페셜', { kind: '메인메뉴' })).toBe(false)
    expect(restartsMenuBgm('관리', { kind: '메인메뉴', openTier: 5 })).toBe(true)
    expect(restartsMenuBgm('메인메뉴', { kind: '메인메뉴', openTier: 5 })).toBe(false)
  })

  it('훅 — 메뉴 → 환경설정 → 메뉴면 1 을 끊고 다시 튼다, 도움말을 다녀오면 그대로', () => {
    const played: string[] = []
    let remembered: number | null = null
    const port = {
      ...createSilentSound(),
      playBgm: (id: number) => {
        played.push(`틀기 ${id}`)
        remembered = id
      },
      stop: () => {
        played.push('끊기')
        remembered = null
      },
      currentBgm: () => remembered,
    }
    const { rerender } = renderHook(({ screen }: { screen: Screen }) => {
      const bgm = useScreenBgm(screen)
      useSceneBgm(port, bgm.bgm, bgm.restartSerial)
    }, { initialProps: { screen: { kind: '메인메뉴' } as Screen } })
    expect(played).toEqual(['틀기 1'])
    rerender({ screen: { kind: '도움말' } })
    rerender({ screen: { kind: '메인메뉴' } })
    expect(played).toEqual(['틀기 1'])
    rerender({ screen: { kind: '환경설정' } })
    rerender({ screen: { kind: '메인메뉴' } })
    expect(played).toEqual(['틀기 1', '끊기', '틀기 1'])
  })
})

describe('이벤트 재생 배경음 40 — 114 진입 0x11d00 · 0xd3 진입 0x5110 의 두 가드 (S+0x50 ≠ 2 · [관리자+0x39f] == 0)', () => {
  it('타자편 이벤트는 40, 연초 115 내장 이벤트는 안 바꾼다', () => {
    expect(screenBgmOf({ kind: '이벤트', eventId: 370, context: '시즌' })).toBe(40)
    expect(screenBgmOf({ kind: '이벤트', eventId: 451, context: '연초' })).toBeNull()
  })

  it('투수편 이벤트 장면 — 연초는 안 바꾸고 중간평가(105 진입이 S+0x50 = 3)는 40, 116 경기 결과는 안 바꾼다', () => {
    expect(pitcherLeagueBgmOf('이벤트', false, null, { storyContext: '중간평가' })).toBe(40)
    expect(pitcherLeagueBgmOf('이벤트', false, null, { storyContext: '연초' })).toBeNull()
    expect(pitcherLeagueBgmOf('경기결과', false)).toBeNull()
  })

  it('경기 뒤 116 → 114 → 128 은 S+0x50 == 2 라 40 이 없다 — 131 뒤는 40', () => {
    expect(screenBgmOf({ kind: '포스트시즌', popup: null }, '경기평가')).toBeNull()
    expect(screenBgmOf({ kind: '포스트시즌', popup: null }, '이벤트')).toBe(40)
    const { result, rerender } = renderHook(
      ({ scene }: { scene: PitcherScene }) => usePitcherLeagueBgm(true, scene),
      { initialProps: { scene: '경기결과' as PitcherScene } },
    )
    rerender({ scene: '포스트시즌' })
    expect(result.current).toBeNull()
    rerender({ scene: '경기준비' })
    rerender({ scene: '포스트시즌' })
    expect(result.current).toBeNull()
    rerender({ scene: '이벤트' })
    rerender({ scene: '포스트시즌' })
    expect(result.current).toBe(40)
  })
})

describe('137 "N년차" 표지 뒤 배경음 — 105 처리 0x1aec4 의 이전 상태 목록에 0x89 가 없다 (1aece~1aef2)', () => {
  it('타자편: 137 · 그 뒤 105 · 105 에서 간 109/상점/외출은 앞 배경음을 잇고, 외출 → 105 는 4 를 다시 튼다', () => {
    const { result, rerender } = renderHook(({ screen }: { screen: Screen }) => useScreenBgm(screen), {
      initialProps: { screen: { kind: '이벤트', eventId: 380, context: '시즌' } as Screen },
    })
    expect(result.current.bgm).toBe(40)
    rerender({ screen: { kind: '연차표지' } })
    expect(result.current.bgm).toBeNull()
    rerender({ screen: { kind: '관리' } })
    expect(result.current.bgm).toBeNull()
    rerender({ screen: { kind: '아이템', tab: '장착' } })
    expect(result.current.bgm).toBeNull()
    rerender({ screen: { kind: '관리' } })
    expect(result.current.bgm).toBeNull()
    rerender({ screen: { kind: '외출' } })
    expect(result.current.bgm).toBeNull()
    rerender({ screen: { kind: '관리' } })
    expect(result.current.bgm).toBe(4)
  })

  it('투수편: 137 → 105 는 잇고, 이벤트를 지나면 다시 표대로', () => {
    const { result, rerender } = renderHook(
      ({ scene }: { scene: PitcherScene }) => usePitcherLeagueBgm(true, scene),
      { initialProps: { scene: '연차표지' as PitcherScene } },
    )
    expect(result.current).toBeNull()
    rerender({ scene: '관리' })
    expect(result.current).toBeNull()
    rerender({ scene: '상점' })
    expect(result.current).toBeNull()
    rerender({ scene: '이벤트' })
    expect(result.current).toBe(40)
    rerender({ scene: '관리' })
    expect(result.current).toBe(4)
  })
})

describe('화면이 관리인 채 105 로 다시 들어올 때 — 0x1aec4 목록(125 든다 · 127 빠진다)', () => {
  it('목록은 100 · 116 · 132 · 125 · 126 · 114 · 134 · 1 · 112 — 127 휴식 · 106/107/110 하위 메뉴는 밖', () => {
    expect([0x64, 0x74, 0x84, 0x7d, 0x7e, 0x72, 0x86, 1, 0x70].every(restartsManagementBgmFrom)).toBe(true)
    expect([NARI_STATE.휴식, 0x6a, 0x6b, 0x6e, 0x89].some(restartsManagementBgmFrom)).toBe(false)
    expect(restartsManagementBgmFrom(NARI_STATE.훈련결과)).toBe(true)
  })

  it('타자편: 125 → 105 수가 오르면 다시 틀기 표가 오르고, 137 뒤 잇던 배경음도 끝나 4', () => {
    const { result, rerender } = renderHook(
      ({ screen, restart }: { screen: Screen; restart: number }) => useScreenBgm(screen, restart),
      { initialProps: { screen: { kind: '연차표지' } as Screen, restart: 0 } },
    )
    rerender({ screen: { kind: '관리' }, restart: 0 })
    expect(result.current.bgm).toBeNull()
    const before = result.current.restartSerial
    rerender({ screen: { kind: '관리' }, restart: 1 })
    expect(result.current.bgm).toBe(4)
    expect(result.current.restartSerial).toBe(before + 1)
    // 같은 수로 다시 그려도 더 오르지 않는다
    rerender({ screen: { kind: '관리' }, restart: 1 })
    expect(result.current.restartSerial).toBe(before + 1)
  })

  it('투수편: 같은 수가 다시 틀기 표와 137 뒤 잇기를 함께 친다', () => {
    const bgm = renderHook(
      ({ restart }: { restart: number }) => usePitcherLeagueBgm(true, '관리', null, null, restart),
      { initialProps: { restart: 0 } },
    )
    const serial = renderHook(
      ({ restart }: { restart: number }) => usePitcherLeagueBgmRestart(true, '관리', restart),
      { initialProps: { restart: 0 } },
    )
    const before = serial.result.current
    bgm.rerender({ restart: 1 })
    serial.rerender({ restart: 1 })
    expect(bgm.result.current).toBe(4)
    expect(serial.result.current).toBe(before + 1)
  })
})

describe('이어하기 길의 137 — 100 진입 1c15e stopBgm', () => {
  it('표지가 이어하기 길로 설 때 한 번 배경음을 멈춘다', () => {
    const sound = createSilentSound()
    let stops = 0
    const counted = { ...sound, stopBgm: () => { stops += 1 } }
    const { rerender } = renderHook(({ on }: { on: boolean }) => useResumeCoverStop(counted, on), { initialProps: { on: false } })
    expect(stops).toBe(0)
    rerender({ on: true })
    rerender({ on: true })
    expect(stops).toBe(1)
    rerender({ on: false })
    rerender({ on: true })
    expect(stops).toBe(2)
  })
})

describe('메인 메뉴 상태 표 0xcea84 (0x24ab8, r197 직접 뜸)', () => {
  it('상태 3 타이틀은 조건 없이 1 (24ae0)', () => {
    expect(screenBgmOf({ kind: '타이틀' })).toBe(1)
    expect(screenBgmOf({ kind: '타이틀' }, '로고')).toBe(1)
  })

  it('상태 16 홈런더비 고르기는 이전 상태 5(게임시작 목록)면 3 (24af0) — 그 밖 길은 안 바꾼다', () => {
    expect(screenBgmOf({ kind: '홈런더비' }, '메인메뉴')).toBe(3)
    expect(screenBgmOf({ kind: '홈런더비' })).toBeNull()
  })
})
