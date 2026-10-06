// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { pitcherLeagueBgmOf, screenBgmOf, usePitcherLeagueBgm } from '@/app/model/screenBgm'
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
    rerender({ isActive: true, scene: '경기' })
    expect(result.current).toBe(3)
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
