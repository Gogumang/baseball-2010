import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import {
  arrivalApplicationOf,
  arrivesUnhit,
  PITCH_JUDGEMENT,
  pitchJudgementOf,
  rollCpuStealStart,
  runPitchArrivalPlay,
  startHumanSteal,
  stealBaseOfKey,
  stealRecordIdsOf,
} from '@/features/defense-play/model/pitchArrivalPlay'

/** 굴림마다 같은 비율을 내고 굴린 수를 센다 */
function 세는난수(ratio: number): RandomPort & { readonly count: () => number } {
  let rolls = 0
  return {
    next: () => {
      rolls += 1
      return ratio
    },
    nextInRange: (minimum, maximum) => {
      rolls += 1
      return minimum + ratio * (maximum - minimum)
    },
    pick: (candidates) => candidates[0],
    count: () => rolls,
  }
}

const 일루 = { ...EMPTY_BASES, first: true }

describe('투구 하나의 주자 판 — 0x3dfac 의 0x35034 → 0x9d57c → 종류 9 / 5', () => {
  it('못 맞힌 공만 공 도착 판정을 지난다', () => {
    expect(arrivesUnhit({ kind: '볼' })).toBe(true)
    expect(arrivesUnhit({ kind: '스트라이크', isSwinging: true })).toBe(true)
    expect(arrivesUnhit({ kind: '사구' })).toBe(true)
    expect(arrivesUnhit({ kind: '파울' })).toBe(false)
    expect(arrivesUnhit({ kind: '타구', outcome: { kind: '홈런' } })).toBe(false)
  })

  it('투구 판정 v — 사구 4 · 볼넷 3 · 삼진 5 · 볼 2 · 스트라이크 1', () => {
    expect(pitchJudgementOf({ kind: '사구' }, { kind: '사구' })).toBe(PITCH_JUDGEMENT.HIT_BY_PITCH)
    expect(pitchJudgementOf({ kind: '볼' }, { kind: '볼넷' })).toBe(PITCH_JUDGEMENT.WALK)
    expect(pitchJudgementOf({ kind: '볼' }, null)).toBe(PITCH_JUDGEMENT.BALL)
    expect(pitchJudgementOf({ kind: '스트라이크', isSwinging: false }, { kind: '삼진' })).toBe(PITCH_JUDGEMENT.STRIKEOUT)
    expect(pitchJudgementOf({ kind: '스트라이크', isSwinging: true }, null)).toBe(PITCH_JUDGEMENT.STRIKE)
  })

  it('사람 도루 키 — 3 → 1루 · 2 → 2루 · 1 → 3루, canStartSteal 이 막으면 그대로', () => {
    expect(stealBaseOfKey('3')).toBe(1)
    expect(stealBaseOfKey('2')).toBe(2)
    expect(stealBaseOfKey('1')).toBe(3)
    expect(stealBaseOfKey('5')).toBeNull()
    expect(startHumanSteal(일루, [], 1)).toEqual([1])
    const blocked: readonly (1 | 2 | 3)[] = []
    expect(startHumanSteal({ ...EMPTY_BASES, first: true, second: true }, blocked, 1)).toBe(blocked)
    expect(startHumanSteal({ ...EMPTY_BASES, third: true }, [], 3)).toEqual([3])
  })

  it('CPU 도루 출발 — 후보가 있을 때만 rand(0,1000) 한 번', () => {
    const none = 세는난수(0)
    expect(rollCpuStealStart({ bases: EMPTY_BASES, offenseIsCpu: true, runAbilityOf: () => 500 }, none)).toEqual([])
    expect(none.count()).toBe(0)
    const low = 세는난수(0)
    expect(rollCpuStealStart({ bases: 일루, offenseIsCpu: true, runAbilityOf: () => 500 }, low)).toEqual([1])
    expect(low.count()).toBe(1)
    const high = 세는난수(0.5)
    expect(rollCpuStealStart({ bases: 일루, offenseIsCpu: true, runAbilityOf: () => 500 }, high)).toEqual([])
    expect(high.count()).toBe(1)
  })

  it('0.1% 가 안 서고 도루도 없으면 판이 없다 — 굴림은 rollPassedBall 한 번', () => {
    const random = 세는난수(0.5)
    expect(
      runPitchArrivalPlay(
        { gameMode: 4, pitchJudgement: PITCH_JUDGEMENT.BALL, stealingFrom: [], bases: 일루, outs: 0 },
        random,
      ),
    ).toBeNull()
    expect(random.count()).toBe(1)
  })

  it('모드 7(홈런더비)은 0.1% 굴림이 없다', () => {
    const random = 세는난수(0)
    expect(
      runPitchArrivalPlay(
        { gameMode: 7, pitchJudgement: PITCH_JUDGEMENT.BALL, stealingFrom: [], bases: 일루, outs: 0 },
        random,
      ),
    ).toBeNull()
    expect(random.count()).toBe(0)
  })

  it('도루 중이면 종류 5 — 아무도 안 던지면(키 없는 사람 수비 · 잡을 루가 없는 CPU) 콜 없이 8 후보', () => {
    // 1루 도루는 늘 세이프라 CPU 점수식도 루를 안 고르고, 키 없는 사람 수동 송구는 아예 안 던진다
    // → 결과 코드(9 세이프 · 13 아웃)가 안 서서 판정 콜도 없다
    const play = runPitchArrivalPlay(
      { gameMode: 4, pitchJudgement: PITCH_JUDGEMENT.BALL, stealingFrom: [1], bases: 일루, outs: 0, runAbility: 500 },
      세는난수(0.5),
    )
    expect(play?.kind).toBe(5)
    expect(play?.callSoundId).toBeNull()
    expect(play?.recordIds).toEqual([8])
    expect(play !== null && arrivalApplicationOf(play)).toBe('runnerOnly')
  })

  it('번트 종류(장면 +0xfdc)를 도루 판에 싣는다 — 도루 안 한 주자의 판 시작 리드 0x3d7b8 이 +3 틱', () => {
    // 1·2루, 2루 주자만 출발 — 1루 주자는 도루 안 한 주자라 리드 6 틱(번트 종류가 서면 9 틱) 뒤 제 루로 돌아오는 중이다
    const 일이루 = { ...EMPTY_BASES, first: true, second: true }
    const playOf = (buntKind?: number) =>
      runPitchArrivalPlay(
        {
          gameMode: 4,
          pitchJudgement: PITCH_JUDGEMENT.STRIKE,
          stealingFrom: [2],
          bases: 일이루,
          outs: 0,
          runAbility: 500,
          ...(buntKind === undefined ? {} : { buntKind }),
        },
        세는난수(0.5),
      )
    const 번트 = playOf(2)
    const 그냥 = playOf(0)
    expect(번트?.kind).toBe(5)
    expect(그냥?.kind).toBe(5)
    // 안 넘기면 0 과 같다
    expect(JSON.stringify(playOf()?.result.ticks[0])).toBe(JSON.stringify(그냥?.result.ticks[0]))
    // 판 첫 틱의 1루 주자 자리가 다르다(리드 틱 수가 다르다)
    expect(JSON.stringify(번트?.result.ticks[0])).not.toBe(JSON.stringify(그냥?.result.ticks[0]))
  })

  it('2아웃 삼진이면 도루 판이 안 열린다', () => {
    expect(
      runPitchArrivalPlay(
        { gameMode: 4, pitchJudgement: PITCH_JUDGEMENT.STRIKEOUT, stealingFrom: [1], bases: 일루, outs: 2 },
        세는난수(0.5),
      ),
    ).toBeNull()
  })

  it('0.1% 가 서면 종류 9 — 1루 비고 삼진이면 낫아웃(타자주자)', () => {
    const play = runPitchArrivalPlay(
      { gameMode: 4, pitchJudgement: PITCH_JUDGEMENT.STRIKEOUT, stealingFrom: [], bases: EMPTY_BASES, outs: 0 },
      세는난수(0),
    )
    expect(play?.kind).toBe(9)
    expect(play?.strikeout).toBe('batterRuns')
    expect(play?.recordIds).toEqual([])
    expect(play !== null && arrivalApplicationOf(play)).toBe('batterRuns')
  })

  it('도루 기록 — 잡힌 주자가 있으면 24 한 번뿐', () => {
    expect(stealRecordIdsOf({ stolenFrom: [2], caughtFrom: [1] })).toEqual([24])
    expect(stealRecordIdsOf({ stolenFrom: [1, 2], caughtFrom: [] })).toEqual([
      8,
      8,
    ])
  })
})
