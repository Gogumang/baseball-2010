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
import { createMemoryAutoRelayRecordPort, setAutoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'
import type { AutoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
  // 사람이 한 타석도 안 잡는 설정 — 첫 타석부터 중계
  settings: { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 },
}

const 소리 = { playBgm: vi.fn<(id: number) => void>(), stop: vi.fn<() => void>() }

let 기록: AutoRelayRecordPort

beforeEach(() => {
  기록 = createMemoryAutoRelayRecordPort()
  setAutoRelayRecordPort(기록)
  setAutoRelaySpeed(0)
  소리.playBgm.mockClear()
  소리.stop.mockClear()
  setActiveSound({ ...createSilentSound(), playBgm: 소리.playBgm, stop: 소리.stop })
})
afterEach(() => {
  cleanup()
  setAutoRelayRecordPort(null)
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

  it('←/4 · →/6 이 속도를 0..2 안에서 바꾼다 — 2 여도 안내 띠 · 속도 칸은 서고(42ab2 · 42bbe 는 모드만 본다) 운동장 그림만 없다', () => {
    띄우기()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('0')
    fireEvent.keyDown(window, { key: '6' })
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('1')
    expect(screen.getByTestId('중계-투수')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('2')
    expect(screen.queryByTestId('중계-투수')).toBeNull()
    expect(screen.queryByTestId('중계-타자')).toBeNull()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: '4' })
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('1')
  })

  it('운동장 그림 (0x4258c 425bc~42812) — 배경 위에 투수(프레임 17) · 포수(90) · 타자(좌타 7 / 우타 10) · 주자(0)', async () => {
    띄우기()
    // 원점 표를 읽을 때까지 기다린다
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('중계-배경')).toBeTruthy()
    let 주자봤다 = false
    for (let frame = 0; frame < 8 * 80 && !주자봤다; frame += 1) {
      흘리기(1)
      주자봤다 = screen.queryByTestId('중계-주자-1') !== null
    }
    expect(screen.getByTestId('중계-투수').dataset.frame).toBe('17')
    expect(screen.getByTestId('중계-포수').dataset.frame).toBe('90')
    expect(['7', '10']).toContain(screen.getByTestId('중계-타자').dataset.frame)
    expect(주자봤다).toBe(true)
    expect(screen.getByTestId('중계-주자-1').dataset.frame).toBe('0')
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

  it('질문 창이 떠 있는 동안은 장면이 멈춘다 — 틱 · 갱신(0xc262c)이 안 돌고, 아니오로 닫으면 멈춘 틱부터 다시 돈다 (52cc6 0x754f9)', () => {
    띄우기()
    흘리기(8)
    const 첫글 = screen.getByTestId('중계-글').textContent
    // 8틱째 갱신 바로 앞 그림에 CLR — 그 그림(틱 15)은 갱신이 없고, 창이 선 뒤로는 틱이 멈춰 16 에 닿지 않는다
    흘리기(6)
    fireEvent.keyDown(window, { key: 'Escape' })
    흘리기(1)
    expect(screen.getByText('자동진행을 중단하시겠습니까?')).toBeTruthy()
    흘리기(8 * 10)
    expect(screen.getByTestId('중계-글').textContent).toBe(첫글)
    // 아니오 — 다 닫힌 뒤 틱 16 에서 다음 0xc262c
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Enter' })
    for (let frame = 0; frame < 30 && screen.queryByText('자동진행을 중단하시겠습니까?') !== null; frame += 1) 흘리기(1)
    expect(screen.queryByText('자동진행을 중단하시겠습니까?')).toBeNull()
    expect(screen.getByTestId('중계-글').textContent).toBe(첫글)
    흘리기(1)
    expect(screen.getByTestId('중계-글').textContent).not.toBe(첫글)
  })

  it('CLR → StrGAME[6] 질문 → 예 — 다음 갱신에 중계가 끝나 사람 장면이 서고 배경음을 끈다', () => {
    띄우기()
    흘리기(8 * 3)
    fireEvent.keyDown(window, { key: 'Escape' })
    // 창은 키를 받은 그림(갱신 · 그리기를 마친 뒤)에 선다
    expect(screen.queryByText('자동진행을 중단하시겠습니까?')).toBeNull()
    흘리기(1)
    expect(screen.getByText('자동진행을 중단하시겠습니까?')).toBeTruthy()
    흘리기(10)
    fireEvent.keyDown(window, { key: 'Enter' })
    흘리기(20)
    expect(screen.queryByText('자동진행을 중단하시겠습니까?')).toBeNull()
    흘리기(8)
    expect(screen.queryByTestId('중계-공격팀')).toBeNull()
    // 설정이 모두 자동이어도 sim+0x9f 가 이겨 사람 장면(0xe OK 대기)이다
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
    // 0x4856c — 0x6e418 소리 끊기
    expect(소리.stop).toHaveBeenCalled()
    // 0xc0ea8(sim, 1) — 전역기록 +0x14d + m(시즌 칸 1)에도 쓴다
    expect(기록.read().stopped).toEqual([false, true, false])
  })

  it('속도는 전역기록 +0xbc 에 쓴다 — 다음 중계도 그 속도로 선다 (새 저장은 1)', () => {
    setAutoRelayRecordPort(createMemoryAutoRelayRecordPort())
    띄우기()
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('1')
    fireEvent.keyDown(window, { key: '4' })
    cleanup()
    띄우기()
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('0')
  })

  it('새 경기는 그 모드 칸의 중단 표시를 0 으로 쓰고 연다 (경기를 여는 키 → 장면 초기화 0xc0e60)', () => {
    기록.setStopped(1, true)
    띄우기()
    expect(기록.read().stopped[1]).toBe(false)
    expect(screen.getByTestId('중계-공격팀')).toBeTruthy()
  })
})
