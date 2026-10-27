import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { DefenseKeyPress, DefensePlayControls } from '@/features/defense-play/model/runDefensePlay'
import { runStealPlay } from '@/features/defense-play/model/stealPlay'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import {
  openPitchArrivalPlay,
  runPitchArrivalPlay,
  type PitchArrivalPlayInput,
} from '@/features/defense-play/model/pitchArrivalPlay'
import { runLiveRunnerPlayWithoutKeys, startLiveRunnerPlay } from '@/features/defense-play/model/liveRunnerPlay'

const 일루 = { ...EMPTY_BASES, first: true }

/** 틱 t 에 키 하나를 누르는 사람 수비 */
const 수비키 = (presses: Readonly<Record<number, string>>): DefensePlayControls => ({
  side: '수비',
  keyAt: (tick) => (presses[tick] === undefined ? null : { key: presses[tick] }),
})

/** 비율 0.5 로만 굴리는 난수 — 굴림 수를 센다 */
function 세는난수(): RandomPort & { readonly count: () => number } {
  let rolls = 0
  const inner = createFractionRandom(() => {
    rolls += 1
    return 0.5
  })
  return { ...inner, count: () => rolls }
}

describe('판 중 사람 송구 키 — 상태 0x17 키 0x53420 → 0x533c8 → 메시지 0x588 → vt60 0xb3118 → +0x160 (판 종류 무관)', () => {
  it('도루 판(종류 5): 키 없이 수동 송구면 포수가 공을 든 채 끝난다 — 판 중 키 2(위)가 오면 그 틱에 2루로 던진다(b4660)', () => {
    const 키없음 = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500 })
    expect(키없음.throwBase).toBe(-1)

    const 키 = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500, controls: 수비키({ 4: '2' }) })
    expect(키.log).toContain('4틱 사람이 2루로 송구 지시')
    expect(키.log.some((line) => line.startsWith('4틱 1번 야수가 2루로 송구'))).toBe(true)
    expect(키.throwBase).toBe(2)
  })

  it('공격 쪽 조작(사람이 주루)이면 송구 키가 아니다 — 0x533c8 은 수비일 때만', () => {
    const 공격 = runStealPlay({
      bases: 일루,
      stealingFrom: [1],
      outs: 0,
      runAbility: 500,
      controls: { side: '공격', keyAt: (tick) => (tick === 4 ? { key: '2' } : null) },
    })
    expect(공격.throwBase).toBe(-1)
  })

  it('판이 열릴 때 +0x160 이 서 있으면(시험용 입력) 첫 쥔 야수가 준비되면 그 루로 보낸다 — 실제 판 시작은 vt1c 0xb0edc 가 −1 로 지운다', () => {
    const 남음 = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500, manualThrowBase: 2 })
    expect(남음.throwBase).toBe(2)
    expect(남음.log.some((line) => line.startsWith('0틱 1번 야수가 2루로 송구'))).toBe(true)
  })

  it('견제 판(종류 4): 받은 1루수가 준비(3틱)된 뒤 키 2 가 오면 2루로 이어 던진다', () => {
    const 키없음 = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0 })
    const 받은틱 = 키없음.throwArrivalTick
    expect(키없음.log.some((line) => line.includes('2루로'))).toBe(false)

    const 키 = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0, controls: 수비키({ [받은틱 + 1]: '2' }) })
    expect(키.log).toContain(`${받은틱 + 1}틱 사람이 2루로 송구 지시`)
    expect(키.log.some((line) => /\d+틱 2번 야수가 2루로 송구/.test(line) || line.includes('2루로 공을 들고 뛴다'))).toBe(true)
  })
})

describe('실시간 손잡이 — 화면이 한 틱씩 키를 먹여도 미리 돌린 판과 같다', () => {
  const 도착: PitchArrivalPlayInput = {
    gameMode: 2,
    batterHand: 0,
    // 볼(2) — 도루가 걸린 공은 종류 5 판을 연다
    pitchJudgement: 2,
    stealingFrom: [1],
    bases: 일루,
    outs: 0,
    defenseIsCpu: false,
    offenseIsCpu: true,
  }

  it('같은 씨앗 · 같은 키면 판 결과 · 그림 · 굴림 차례가 같다 (`startLiveRunnerPlay` ↔ `runPitchArrivalPlay`)', () => {
    const 키: Record<number, string> = { 6: '2' }
    const 미리Random = createSeededRandom(7)
    const 미리 = runPitchArrivalPlay(도착, 미리Random)
    const 실시간Random = createSeededRandom(7)
    const opened = openPitchArrivalPlay(도착, 실시간Random)
    expect(opened?.kind).toBe(5)
    if (opened === null || opened.kind === 2) return
    const stepper = startLiveRunnerPlay({ kind: 'arrival', opened })
    while (!stepper.finished) {
      const press: DefenseKeyPress | null = 키[stepper.tick] === undefined ? null : { key: 키[stepper.tick] }
      stepper.step(press)
    }
    const 결과 = stepper.result()
    // 키 없는 미리 돌림과는 판이 갈린다 — 사람 키가 송구를 냈다
    expect(미리?.result.throwBase).toBe(-1)
    expect(결과.throwBase).toBe(2)

    // 키 없이 실시간으로 돌리면 미리 돌린 판과 한 틱도 안 다르고, 다음 굴림도 같은 자리다
    const 다시Random = createSeededRandom(7)
    const 다시 = openPitchArrivalPlay(도착, 다시Random)
    if (다시 === null || 다시.kind === 2) throw new Error('판이 안 열렸다')
    const 키없음 = runLiveRunnerPlayWithoutKeys({ kind: 'arrival', opened: 다시 })
    expect(키없음.advance).toEqual(미리?.result.advance)
    expect(키없음.ticks.length).toBe(미리?.result.ticks.length)
    expect(다시Random.rand(0, 0x7fffffff)).toBe(미리Random.rand(0, 0x7fffffff))
  })

  it('굴림 수 — 판 시작(0.1% · 도루 리드)은 열 때, 판 안의 굴림(악송구 · 펌블)은 틱을 돌 때다', () => {
    const random = 세는난수()
    const opened = openPitchArrivalPlay({ ...도착, gameMode: 2 }, random)
    // rollPassedBall 1 + 도루 리드 rand(0,9) 1
    expect(random.count()).toBe(2)
    if (opened === null || opened.kind === 2) return
    const stepper = startLiveRunnerPlay({ kind: 'arrival', opened })
    while (!stepper.finished) stepper.step(stepper.tick === 3 ? { key: '2' } : null)
    // 송구의 악송구 굴림 · 긴 송구 흔들림 · 받는 야수의 펌블 굴림
    expect(random.count()).toBeGreaterThan(2)
  })
})

describe('판 안의 판정 콜 — 결과 메시지 0xbba(b4562) → 0x51a56 → 0x51c14(17) · 0x51b36(62/20), 그 틱에 난다', () => {
  /** 판을 한 틱씩 돌리며 그 틱의 소리를 (틱, 소리)로 모은다 — 화면 `LiveRunnerPlayback` 이 하는 일 */
  const 틱소리 = (play: Parameters<typeof startLiveRunnerPlay>[0], presses: Readonly<Record<number, string>> = {}) => {
    const stepper = startLiveRunnerPlay(play)
    const sounds: { readonly tick: number; readonly id: number }[] = []
    while (!stepper.finished) {
      const tick = stepper.tick
      stepper.step(presses[tick] === undefined ? null : { key: presses[tick] })
      for (const id of stepper.soundsThisTick) sounds.push({ tick, id })
    }
    return { sounds, result: stepper.result(), lastTick: stepper.ticks.length - 1 }
  }

  /** 로그 줄에서 그 틱 */
  const 틱of = (log: readonly string[], pattern: RegExp) => Number(/^(\d+)틱/.exec(log.find((line) => pattern.test(line)) ?? '')?.[1])

  it('견제사: 받은 야수가 태그한 틱(결과 13 · state[0x87])에 62 — 판 끝이 아니다', () => {
    const { sounds, result, lastTick } = 틱소리({ kind: 'pickoff', input: { targetBase: 1, bases: 일루, outs: 0 } })
    const 아웃틱 = 틱of(result.log, /견제사 \(0xb36d0/)
    expect((result as { readonly resultCode?: number | null }).resultCode).toBe(13)
    expect(sounds).toEqual([{ tick: 아웃틱, id: 62 }])
    expect(아웃틱).toBeLessThan(lastTick)
  })

  it('도루 판: 키 2 로 2루에 던져 세이프 — 받은 야수가 쥐는 틱(결과 9)에 17 (종류 5 는 0x51c14 51c22 에서 곧장 17)', () => {
    // 발 빠른 주자(주루 999) — 한 틱 이동 0xbf158 이 맨해튼 거리로 나눠 대각선 1→2루가 느려 주루 500 은 2루 앞에서 잡힌다
    const opened = openPitchArrivalPlay(
      { batterHand: 0, gameMode: 2, pitchJudgement: 2, stealingFrom: [1], bases: 일루, outs: 0, defenseIsCpu: false, offenseIsCpu: true, runAbility: 999 },
      createSeededRandom(1),
    )
    if (opened === null || opened.kind === 2) throw new Error('도루 판이 안 열렸다')
    const { sounds, result, lastTick } = 틱소리({ kind: 'arrival', opened }, { 4: '2' })
    const 세이프틱 = 틱of(result.log, /2루 세이프 \(결과 9\)/)
    expect((result as { readonly resultCode?: number | null }).resultCode).toBe(9)
    // 빠른 주자는 4틱에 71% 를 넘어 CPU 주루의 슬라이딩(0xa9690)이 걸리고 효과음 10 이 먼저 난다
    expect(sounds).toEqual([
      { tick: 4, id: 10 },
      { tick: 세이프틱, id: 17 },
    ])
    expect(세이프틱).toBeLessThan(lastTick)
  })

  it('키 없는 수동 도루 판(포수가 든 채 끝)은 결과 메시지가 없어 콜도 없다', () => {
    const opened = openPitchArrivalPlay(
      { batterHand: 0, gameMode: 2, pitchJudgement: 2, stealingFrom: [1], bases: 일루, outs: 0, defenseIsCpu: false, offenseIsCpu: true },
      createSeededRandom(1),
    )
    if (opened === null || opened.kind === 2) throw new Error('도루 판이 안 열렸다')
    const { sounds, result } = 틱소리({ kind: 'arrival', opened })
    expect((result as { readonly resultCode?: number | null }).resultCode).toBeNull()
    expect(sounds).toEqual([])
  })
})
