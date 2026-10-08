// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { MissionPlayScreen } from '@/pages/mission-play/ui/MissionPlayScreen'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { startMission } from '@/entities/mission/model/missionRun'
import { MISSIONS } from '@/shared/config/original/missions'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

const stageProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }))

// 타석 화면은 넘겨받은 값만 본다 — 캔버스 없이 props 만 잡는다
vi.mock('@/widgets/batting-stage/ui/BattingStage', () => ({
  BattingStage: (props: Record<string, unknown>) => {
    stageProps.last = props
    return null
  },
}))

afterEach(() => {
  cleanup()
  stageProps.last = null
})

/** 압도 22 — 0xb62b4(타자, 22) 장착이면 CPU 실투율 +5 (0x33d52) */
const 압도 = [22]

describe('미션 타석은 치는 선수의 장착 스킬을 타석 화면에 넘긴다', () => {
  it('미션 (모드 6)', () => {
    const mission = MISSIONS.find((candidate) => candidate.side === '타자')!
    render(
      <MissionPlayScreen
        run={startMission(mission)}
        ability={ROOKIE_BATTER_ABILITY}
        batterSkillIds={압도}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        opponent={null}
        atBat={createAtBat()}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onGiveUp={vi.fn()}
        onFinish={vi.fn()}
        onSteal={vi.fn()}
      />,
    )
    expect(stageProps.last?.batterSkillIds).toEqual(압도)
  })
})

describe('미션 타석은 마선수 레벨과 CPU 견제 콜백을 타석 화면에 넘긴다', () => {
  it('aceLevels(마구 횟수 0xd8509) · onPickoff(0x345fc 종류 4)', () => {
    const mission = MISSIONS.find((candidate) => candidate.side === '타자' && candidate.opponentAce > 0)!
    const levels = { 1: 3 }
    const onPickoff = vi.fn()
    render(
      <MissionPlayScreen
        run={startMission(mission)}
        ability={ROOKIE_BATTER_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        opponent={null}
        atBat={createAtBat()}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        aceLevels={levels}
        onPickoff={onPickoff}
        onPitchResolved={vi.fn()}
        onGiveUp={vi.fn()}
        onFinish={vi.fn()}
        onSteal={vi.fn()}
      />,
    )
    expect(stageProps.last?.aceLevels).toBe(levels)
    expect(stageProps.last?.onPickoff).toBe(onPickoff)
  })
})

describe('미션 타석의 번트는 목표와 상관없이 켜진다 (0x535a4 → 0x6a7 → 0x51e48, 모드·목표 갈림 없음)', () => {
  it('번트 목표가 없는 타자 미션도 canBunt', () => {
    const mission = MISSIONS.find((candidate) => candidate.side === '타자' && !candidate.goals.includes('번트'))!
    render(
      <MissionPlayScreen
        run={startMission(mission)}
        ability={ROOKIE_BATTER_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        opponent={null}
        atBat={createAtBat()}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onGiveUp={vi.fn()}
        onFinish={vi.fn()}
        onSteal={vi.fn()}
      />,
    )
    expect(stageProps.last?.canBunt).toBe(true)
  })
})

describe('교체 연출 0x16 — 그리기 0x4da30 의 "CHANGE" 애니 (0xf 진입 CPU 투수 교체 뒤)', () => {
  it('서 있는 동안 타석을 멈추고 17 그림 뒤 끝을 알린다 — 그동안 0xe 대기를 세지 않는다', () => {
    vi.useFakeTimers()
    try {
      const mission = MISSIONS.find((candidate) => candidate.side === '타자')!
      const onDone = vi.fn()
      const view = render(
        <MissionPlayScreen
          run={startMission(mission)}
          ability={ROOKIE_BATTER_ABILITY}
          pitcherAbility={DEFAULT_PITCHER_ABILITY}
          opponent={null}
          atBat={createAtBat()}
          isPaused={false}
          bannerText=""
          random={createSeededRandom(1)}
          onPitchResolved={vi.fn()}
          onGiveUp={vi.fn()}
          onFinish={vi.fn()}
          onSteal={vi.fn()}
          sceneConfirm={{ entries: 1 }}
          substitutionScene={{ serial: 1, incomingIsAce: false, entrySoundId: 14 }}
          onSubstitutionSceneDone={onDone}
        />,
      )
      expect(stageProps.last?.isPaused).toBe(true)
      const scene = view.getByTestId('교체연출')
      expect(scene.dataset.frame).toBe('79')
      act(() => {
        vi.advanceTimersByTime(millisecondsPerFrame() * 7)
      })
      expect(view.getByTestId('교체연출').dataset.frame).toBe('82')
      act(() => {
        vi.advanceTimersByTime(millisecondsPerFrame() * 9)
      })
      expect(view.getByTestId('교체연출').dataset.frame).toBe('84')
      expect(onDone).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(millisecondsPerFrame())
      })
      expect(onDone).toHaveBeenCalledTimes(1)
      // 0xe 대기는 아직 OK 를 받지 않는다 (연출 동안 세지 않음)
      expect((view.getByRole('button', { name: '확인' }) as HTMLButtonElement).disabled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('미션 HUD 는 경기 칸 run.game 을 그린다 — 점수판 0xb69b0 · 이닝 st[0x6b] · 공격 측 st[9]', () => {
  it('자동진행 반 이닝 득점이 든 점수 · 넘어간 이닝', () => {
    const mission = MISSIONS.find((candidate) => candidate.side === '타자')!
    const start = startMission(mission)
    const human = start.mission.humanSide
    const scores: [number, number] = [start.game.scores[0], start.game.scores[1]]
    scores[human === 0 ? 1 : 0] += 3
    const run = { ...start, game: { ...start.game, inning: start.game.inning + 1, scores } }
    render(
      <MissionPlayScreen
        run={run}
        ability={ROOKIE_BATTER_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        opponent={null}
        atBat={createAtBat()}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onGiveUp={vi.fn()}
        onFinish={vi.fn()}
        onSteal={vi.fn()}
      />,
    )
    expect(stageProps.last?.hud).toMatchObject({
      inning: run.game.inning + 1,
      ourScore: scores[human],
      opponentScore: scores[human === 0 ? 1 : 0],
    })
  })
})
