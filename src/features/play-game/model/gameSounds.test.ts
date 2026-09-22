import { describe, expect, it } from 'vitest'
import {
  BURST_START_SOUND,
  gameResultSoundIdOf,
  gameStepSoundIdsOf,
  HALF_INNING_SOUND,
} from '@/features/play-game/model/gameSounds'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'

/**
 * `gameStepSoundIdsOf` 는 진행 전/후의 `GameProgress` 두 장만 견주는 순수 함수라
 * 보는 칸(반 이닝·경기 끝·돌발)만 채운 가벼운 표본으로 확인한다.
 */

interface 표본 {
  readonly half?: '초' | '말'
  readonly inning?: number
  readonly isFinished?: boolean
  readonly burstCurrent?: BurstMissionRow | null
  readonly resolution?: BurstResolution | null
}

const 진행 = ({ half = '초', inning = 1, isFinished = false, burstCurrent = null, resolution = null }: 표본 = {}) =>
  ({
    game: { half, inning, isFinished },
    burst: { current: burstCurrent } as BurstSession,
    lastBurstResolution: resolution,
  }) as unknown as GameProgress

const 돌발행 = { goal: 0 } as unknown as BurstMissionRow
const 판정 = (judgement: BurstResolution['judgement']): BurstResolution =>
  ({ session: {} as BurstSession, row: 돌발행, judgement, deltas: [] })

describe('공수 교대 징글 13 (경기 상태 0x18, 0x4f7ac)', () => {
  it('반 이닝이 바뀌면 낸다', () => {
    expect(gameStepSoundIdsOf(진행({ half: '초' }), 진행({ half: '말' }))).toEqual([HALF_INNING_SOUND])
  })

  it('이닝이 넘어가도 낸다', () => {
    expect(gameStepSoundIdsOf(진행({ inning: 1, half: '말' }), 진행({ inning: 2, half: '초' }))).toEqual([
      HALF_INNING_SOUND,
    ])
  })

  it('같은 반 이닝이면 내지 않는다', () => {
    expect(gameStepSoundIdsOf(진행(), 진행())).toEqual([])
  })

  it('경기가 끝나는 걸음에는 내지 않는다 (R10 2절 — 경기 끝이면 13 을 안 낸다)', () => {
    expect(gameStepSoundIdsOf(진행({ half: '초' }), 진행({ half: '말', isFinished: true }))).toEqual([])
  })
})

describe('돌발미션', () => {
  it('새 돌발이 뜨면 시작음 42 (0x8f000)', () => {
    expect(gameStepSoundIdsOf(진행(), 진행({ burstCurrent: 돌발행 }))).toEqual([BURST_START_SOUND])
  })

  it('돌발이 그대로 걸려 있으면 다시 내지 않는다', () => {
    const 걸린채 = 진행({ burstCurrent: 돌발행 })
    expect(gameStepSoundIdsOf(걸린채, 진행({ burstCurrent: 돌발행 }))).toEqual([])
  })

  it('판정이 나면 성공 36 · 실패 32 · 무효 37 (0x8e5b8)', () => {
    expect(gameStepSoundIdsOf(진행({ burstCurrent: 돌발행 }), 진행({ resolution: 판정('성공') }))).toEqual([36])
    expect(gameStepSoundIdsOf(진행({ burstCurrent: 돌발행 }), 진행({ resolution: 판정('실패') }))).toEqual([32])
    expect(gameStepSoundIdsOf(진행({ burstCurrent: 돌발행 }), 진행({ resolution: 판정('무효') }))).toEqual([37])
  })

  it('판정이 안 난 결과(결과비트 0)는 소리가 없다', () => {
    expect(gameStepSoundIdsOf(진행({ burstCurrent: 돌발행 }), 진행({ resolution: 판정(null) }))).toEqual([])
  })

  it('창을 닫아 판정을 치울 때는 다시 내지 않는다', () => {
    const 판정남 = 진행({ resolution: 판정('성공') })
    expect(gameStepSoundIdsOf(판정남, 진행({ resolution: null }))).toEqual([])
  })

  it('한 걸음에 판정과 교대와 새 발동이 겹치면 원본 순서(판정 → 교대 → 발동)로 담는다', () => {
    const before = 진행({ half: '초', burstCurrent: 돌발행 })
    const after = 진행({ half: '말', burstCurrent: 돌발행, resolution: 판정('성공') })
    expect(gameStepSoundIdsOf(before, after)).toEqual([36, HALF_INNING_SOUND])
  })
})

describe('경기 결과 징글', () => {
  it('승리 31 · 패배 32', () => {
    expect(gameResultSoundIdOf('승')).toBe(31)
    expect(gameResultSoundIdOf('패')).toBe(32)
  })

  it('무승부는 원본이 어느 쪽을 내는지 모르므로 비워 둔다', () => {
    expect(gameResultSoundIdOf('무')).toBeNull()
  })
})
