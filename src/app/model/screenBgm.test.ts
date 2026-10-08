// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { pitcherLeagueBgmOf, screenBgmOf, seasonEndingBgmOf, seasonMenuBgmOf, usePitcherLeagueBgm, useSeasonMenuBgm } from '@/app/model/screenBgm'
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
})

describe('시즌 관리 메뉴 0xc9 의 틀 0x73b8 — 이전 상태가 목록에 들면 배경음 4', () => {
  it('원본 목록 {0xcb, 0xcc, 0xe3, 0xde, 0xf9, 0xe4, 0xe6, 0xe5, 0xd3, 1} 과 장면 첫 진입(0xcb)', () => {
    for (const from of [0xcb, 0xcc, 0xe3, 0xde, 0xf9, 0xe4, 0xe6, 0xe5, 0xd3, 1]) expect(seasonMenuBgmOf(from)).toBe(4)
    expect(seasonMenuBgmOf(null)).toBe(4)
  })

  it('목록 밖(0xcd 시즌정보 · 0xce 구단관리 · 0xd8 다음경기 · 0xf1 마무리)이면 안 바꾼다', () => {
    for (const from of [0xcd, 0xce, 0xd8, 0xf1, 0xd0]) expect(seasonMenuBgmOf(from)).toBeNull()
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
  it('경기 · 미션 · 마선수대결 · 홈런더비 화면은 배경음을 안 바꾼다', () => {
    expect(screenBgmOf({ kind: '경기' })).toBeNull()
    expect(screenBgmOf({ kind: '홈런더비' })).toBeNull()
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
