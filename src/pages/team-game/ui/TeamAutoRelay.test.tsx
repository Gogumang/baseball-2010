// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { setAutoRelaySpeed } from '@/pages/team-game/model/autoRelaySpeed'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
  // 사람이 한 타석도 안 잡는 설정 — 첫 타석부터 중계
  settings: { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 },
}

const 소리 = { playBgm: vi.fn<(id: number) => void>(), stopBgm: vi.fn<() => void>() }

beforeEach(() => {
  setAutoRelaySpeed(0)
  소리.playBgm.mockClear()
  소리.stopBgm.mockClear()
  setActiveSound({ ...createSilentSound(), playBgm: 소리.playBgm, stopBgm: 소리.stopBgm })
})
afterEach(() => {
  cleanup()
  setActiveSound(null)
  vi.useRealTimers()
})

const 흘리기 = (frames: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * frames))

/** 인트로(0xc)를 OK 로 닫으면 중계(0x21)가 선다 */
const 띄우기 = () => {
  vi.useFakeTimers()
  render(<TeamGameScreen options={기본옵션} random={createSeededRandom(1)} onFinish={vi.fn()} onQuit={vi.fn()} />)
  fireEvent.keyDown(window, { key: 'Enter' })
}

describe('팀경기 자동진행 중계 화면 (상태 0x21 — 갱신 0x48480 · 그리기 0x4258c · 키 0x3e25c)', () => {
  it('속도 0 은 8틱마다 한 번 0xc262c 를 굴린다 — 진입에 배경음 33', () => {
    띄우기()
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('0')
    expect(소리.playBgm).toHaveBeenCalledWith(33)
    흘리기(7)
    expect(screen.queryByTestId('중계-글')).toBeNull()
    흘리기(1)
    expect(screen.getByTestId('중계-글')).toBeTruthy()
  })

  it('←/4 · →/6 이 속도를 0..2 안에서 바꾼다 — 2 면 안내 띠 · 속도 칸이 없다', () => {
    띄우기()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('0')
    fireEvent.keyDown(window, { key: '6' })
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('1')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.queryByTestId('중계-속도')).toBeNull()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: '4' })
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('1')
  })

  it('3아웃 뒤 반 이닝을 넘기는 틱에 "CHANGE" 가 선다 (sim+0x9d = 10)', () => {
    띄우기()
    let 봤다 = false
    for (let frame = 0; frame < 8 * 60 && !봤다; frame += 1) {
      흘리기(1)
      봤다 = screen.queryByTestId('중계-CHANGE') !== null
    }
    expect(봤다).toBe(true)
  })

  it('CLR → StrGAME[6] 질문 → 예 — 다음 갱신에 중계가 끝나 사람 장면이 서고 배경음을 끈다', () => {
    띄우기()
    흘리기(8 * 3)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText('자동진행을 중단하시겠습니까?')).toBeTruthy()
    흘리기(10)
    fireEvent.keyDown(window, { key: 'Enter' })
    흘리기(20)
    expect(screen.queryByText('자동진행을 중단하시겠습니까?')).toBeNull()
    흘리기(8)
    expect(screen.queryByTestId('중계-공격팀')).toBeNull()
    // 설정이 모두 자동이어도 sim+0x9f 가 이겨 사람 장면(0xe OK 대기)이다
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
    expect(소리.stopBgm).toHaveBeenCalled()
  })
})
