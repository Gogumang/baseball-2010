import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import type { OriginalMission } from '@/shared/config/original/missions'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import {
  RELAY_RESULT_WORDS,
  missionAutoRelayStepsOf,
  relayCodeOf,
  relayLineOf,
} from '@/entities/mission/model/missionAutoRelay'
import { pitcherMissionAutoTicks, startPitcherMission, runPitcherMissionAutoHalves } from '@/entities/mission/model/pitcherRun'
import { batterMissionAutoTicks, runBatterMissionAutoHalves, startMission } from '@/entities/mission/model/missionRun'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { HalfInningPlateAppearance } from '@/entities/game/model/simulateHalfInning'

const missionOf = (side: OriginalMission['side'], id: number): OriginalMission => {
  const found = MISSIONS.find((mission) => mission.side === side && mission.id === id)
  if (found === undefined) throw new Error(`${side} ${id}`)
  return found
}

describe('0x21 중계 글 — 0xc25e4: 이름 + " " + 표 0x140034c[sim+0xc4 − 1]', () => {
  it('표는 15칸 — 1 플라이 아웃 … 12 홈런!!! · 13 파울 · 14 포볼 · 15 데드볼', () => {
    expect(RELAY_RESULT_WORDS).toHaveLength(15)
    expect(relayLineOf('김타자', 12)).toBe('김타자 홈런!!!')
    expect(relayLineOf('김타자', 14)).toBe('김타자 포볼')
    expect(relayLineOf('김타자', 0)).toBeNull()
  })

  it('코드: 삼진 5 · 포볼 14 · 안타 9~11 · 홈런 12 · 땅볼 아웃 1(c164a 가 덮어쓴다) · 코드 0 뜬공은 앞 공 값(파울 13 / 0)', () => {
    expect(relayCodeOf({ kind: '삼진' }, false)).toBe(5)
    expect(relayCodeOf({ kind: '볼넷' }, true)).toBe(14)
    expect(relayCodeOf({ kind: '안타', bases: 1 }, false)).toBe(9)
    expect(relayCodeOf({ kind: '안타', bases: 3 }, false)).toBe(11)
    expect(relayCodeOf({ kind: '홈런' }, false)).toBe(12)
    expect(relayCodeOf({ kind: '아웃', detail: '땅볼아웃' }, false)).toBe(1)
    expect(relayCodeOf({ kind: '아웃', detail: '뜬공아웃' }, false)).toBe(0)
    expect(relayCodeOf({ kind: '아웃', detail: '뜬공아웃' }, true)).toBe(13)
  })

  it('타석마다 교체 틱(글 없음) 뒤 타석 틱 하나 — 점수는 그 틱 뒤 값', () => {
    const appearances: HalfInningPlateAppearance[] = [
      { battingOrderIndex: 0, outcome: { kind: '홈런' }, runsBattedIn: 1 },
      { battingOrderIndex: 1, outcome: { kind: '삼진' }, runsBattedIn: 0, substitutionCalls: 1 },
    ]
    const steps = missionAutoRelayStepsOf({ inning: 3, offenseSide: 1, scores: [2, 0] }, appearances, (pa) => `타자${pa.battingOrderIndex}`)
    expect(steps).toEqual([
      { inning: 3, offenseSide: 1, scores: [2, 1], line: '타자0 홈런!!!' },
      { inning: 3, offenseSide: 1, scores: [2, 1], line: null },
      { inning: 3, offenseSide: 1, scores: [2, 1], line: '타자1 삼진 아웃' },
    ])
  })
})

describe('미션 자동진행의 중계 틱 목록 — 반 이닝들이 한 줄로 이어진다', () => {
  it('투수 미션: 사람 칸 팀 반 이닝의 타석마다 한 틱, 마지막 점수가 경기 점수와 같다', () => {
    const run = startPitcherMission(missionOf('투수', 6))
    const ended = { ...run, game: { ...run.game, halfEnded: true } }
    const after = runPitcherMissionAutoHalves(ended, createSeededRandom(7))
    const relay = after.game.autoRelay
    expect(relay?.serial).toBe(1)
    expect(relay?.steps.length).toBeGreaterThanOrEqual(3)
    const last = relay?.steps[relay.steps.length - 1]
    // 사람 칸 팀이 공격 — 그 측 점수가 경기 점수에 그대로 남는다
    const humanSide = run.mission.humanSide === 0 ? 0 : 1
    expect(last?.offenseSide).toBe(humanSide)
    expect(last?.scores[humanSide]).toBe(after.game.scores[humanSide])
  })

  it('타자 미션: CPU 반 이닝과 미션 타자 차례 전까지의 사람 칸 반 이닝이 같은 목록에 든다', () => {
    const run = startMission(missionOf('타자', 1))
    const ended = { ...run, game: { ...run.game, halfEnded: true } }
    const after = runBatterMissionAutoHalves(ended, createSeededRandom(3))
    const steps = after.game.autoRelay?.steps ?? []
    expect(steps.length).toBeGreaterThanOrEqual(3)
    const cpuSide = run.mission.humanSide === 0 ? 1 : 0
    expect(steps[0]?.offenseSide).toBe(cpuSide)
    // 다음 자동진행은 serial 이 오른다
    const again = runBatterMissionAutoHalves({ ...after, game: { ...after.game, halfEnded: true } }, createSeededRandom(4))
    if (again.status === '진행중') expect(again.game.autoRelay?.serial).toBe(2)
  })
})

/** 씨앗 난수를 감싸 뽑은 수를 센다 */
function counted(seed: number): { readonly port: RandomPort; readonly draws: () => number } {
  const inner = createSeededRandom(seed)
  let draws = 0
  return {
    port: {
      next: () => { draws += 1; return inner.next() },
      nextInRange: (minimum, maximum) => { draws += 1; return inner.nextInRange(minimum, maximum) },
      pick: (candidates) => { draws += 1; return inner.pick(candidates) },
    },
    draws: () => draws,
  }
}

describe('틱마다 한 번 — 0x48480 갱신 한 번 = 0xc262c 한 번 (중계 도중 끊기면 남은 타석은 안 굴린다)', () => {
  it('타자 미션: 틱 꼴을 끝까지 돌리면 한꺼번에 굴린 것과 굴림 · 중계 · 끝 판이 같다', () => {
    const run = startMission(missionOf('타자', 1))
    const ended = { ...run, game: { ...run.game, halfEnded: true } }
    const whole = counted(3)
    const after = runBatterMissionAutoHalves(ended, whole.port)
    const ticked = counted(3)
    const ticks = batterMissionAutoTicks(ended, ticked.port)
    const steps = []
    let next = ticks.next()
    while (next.done !== true) {
      steps.push(next.value)
      next = ticks.next()
    }
    expect(steps).toEqual(after.game.autoRelay?.steps)
    expect(ticked.draws()).toBe(whole.draws())
    expect({ ...next.value.game, autoRelay: null }).toEqual({ ...after.game, autoRelay: null })
  })

  it('투수 미션: 첫 틱만 부르면 그 타석의 굴림만 나간다 — 다음 틱을 안 부르면 남은 타석은 굴리지 않는다', () => {
    const run = startPitcherMission(missionOf('투수', 6))
    const ended = { ...run, game: { ...run.game, halfEnded: true } }
    const whole = counted(7)
    const after = runPitcherMissionAutoHalves(ended, whole.port)
    const partial = counted(7)
    const ticks = pitcherMissionAutoTicks(ended, partial.port)
    const first = ticks.next()
    expect(first.done).toBe(false)
    expect(first.value).toEqual(after.game.autoRelay?.steps[0])
    expect(partial.draws()).toBeGreaterThan(0)
    expect(partial.draws()).toBeLessThan(whole.draws())
  })
})
