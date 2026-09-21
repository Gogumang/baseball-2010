import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import {
  ACE_CHALLENGE_MISSIONS,
  BATTER_MISSIONS,
  goalsOf,
  PITCHER_MISSIONS,
  missionKeyOf,
  requiredCountOf,
} from '@/entities/mission/model/missionGoal'
import {
  applyOutcome,
  applySteal,
  canSteal,
  checkSwingsExhausted,
  recordSwing,
  startMission,
} from '@/entities/mission/model/missionRun'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import {
  applyPitcherOutcome,
  recordPitch,
  startPitcherMission,
} from '@/entities/mission/model/pitcherRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { MISSIONS } from '@/shared/config/original/missions'
import type { OriginalMission } from '@/shared/config/original/missions'

const SINGLE: AtBatOutcome = { kind: '안타', bases: 1 }
const DOUBLE: AtBatOutcome = { kind: '안타', bases: 2 }
const TRIPLE: AtBatOutcome = { kind: '안타', bases: 3 }
const HOME_RUN: AtBatOutcome = { kind: '홈런' }
const STRIKEOUT: AtBatOutcome = { kind: '삼진' }
const PITCHES_PER_STRIKEOUT = 3
const MAXIMUM_PLATE_APPEARANCES = 30

const findMission = (side: '타자' | '투수', id: number): OriginalMission => {
  const mission = MISSIONS.find((candidate) => candidate.side === side && candidate.id === id)
  if (mission === undefined) throw new Error(`미션 없음: ${side} ${id}`)
  return mission
}

/** 미션마다 가장 이상적인 타석 결과 순서 */
function idealBatterOutcomes(mission: OriginalMission): AtBatOutcome[] {
  if (mission.goals.includes('사이클링히트')) return [SINGLE, DOUBLE, TRIPLE, HOME_RUN]
  // 그라운드홈런은 이제 홈런으로 센다 (E-8)
  if (mission.goals.includes('그라운드홈런')) return [HOME_RUN]
  if (mission.goals.includes('2루타')) return [DOUBLE, HOME_RUN]
  return Array.from({ length: MAXIMUM_PLATE_APPEARANCES }, () => HOME_RUN)
}

function playIdealBatter(mission: OriginalMission): MissionRun {
  let run = startMission(mission)
  if (mission.goals.includes('도루')) run = applySteal(run)
  const isBunt = mission.goals.includes('번트')

  for (const outcome of idealBatterOutcomes(mission)) {
    if (run.status !== '진행중') break
    const played = isBunt ? SINGLE : outcome
    run = recordSwing(run)
    run = applyOutcome(run, played, isBunt)
  }
  return run
}

function playIdealPitcher(mission: OriginalMission): PitcherRun {
  let run = startPitcherMission(mission)
  for (let plate = 0; plate < MAXIMUM_PLATE_APPEARANCES && run.status === '진행중'; plate += 1) {
    for (let pitch = 0; pitch < PITCHES_PER_STRIKEOUT; pitch += 1) run = recordPitch(run, true)
    run = applyPitcherOutcome(run, STRIKEOUT)
  }
  return run
}

describe('원본 미션 레코드 38개(목록 28 + 마선수 공략 10)는 모두 클리어할 수 있다', () => {
  it.each(
    [...BATTER_MISSIONS, ...ACE_CHALLENGE_MISSIONS.filter((mission) => mission.side === '타자')].map(
      (mission) => [mission.id, mission.name, mission] as const,
    ),
  )(
    '타자편 %i %s',
    (_id, _name, mission) => {
      const run = playIdealBatter(mission)

      expect(run.status, `progress was: ${JSON.stringify(run.progress.counts)}`).toBe('성공')
    },
  )

  it.each(
    [...PITCHER_MISSIONS, ...ACE_CHALLENGE_MISSIONS.filter((mission) => mission.side === '투수')].map(
      (mission) => [mission.id, mission.name, mission] as const,
    ),
  )(
    '투수편 %i %s',
    (_id, _name, mission) => {
      const run = playIdealPitcher(mission)

      expect(run.status, `progress was: ${JSON.stringify(run.progress.counts)}`).toBe('성공')
    },
  )
})

describe('원본 레코드의 제한값', () => {
  it('목표 이름에 제어문자가 섞여 있지 않다', () => {
    // eslint-disable-next-line no-control-regex
    const broken = MISSIONS.flatMap((mission) => mission.goals).filter((goal) => /[\x00-\x1f]/.test(goal))

    expect(broken).toEqual([])
  })

  it('제한시간은 u16 이라 노히트노런은 300초다', () => {
    expect(findMission('투수', 13).timeLimitSeconds).toBe(300)
  })

  it('설명문과 같은 타석·스윙·투구 수 제한을 갖는다', () => {
    expect(findMission('타자', 8).plateAppearanceLimit).toBe(3)
    expect(findMission('타자', 10).swingLimit).toBe(3)
    expect(findMission('투수', 3).pitchLimit).toBe(10)
    expect(findMission('투수', 4)).toMatchObject({ plateAppearanceLimit: 1, pitchLimit: 6 })
  })

  it('마선수 미션은 상대 마선수 순번을 갖는다', () => {
    expect(findMission('타자', 4).opponentAce).toBe(2)
    expect(findMission('투수', 12).opponentAce).toBe(5)
    expect(findMission('타자', 1).opponentAce).toBe(0)
  })
})

describe('목표 개수는 레코드 뒤쪽 칸에 있다', () => {
  it('투수 1번 "깔끔하게 경기를 마무리" 는 아웃 3개가 필요하다 — 설명문에 숫자가 없다', () => {
    const mission = findMission('투수', 1)
    expect(requiredCountOf(mission, '아웃')).toBe(3)

    let run = startPitcherMission(mission)
    run = applyPitcherOutcome(run, STRIKEOUT)
    expect(run.status).toBe('진행중')
  })

  it('노히트노런 막대는 이닝×3 아웃 기준이다', () => {
    const mission = findMission('투수', 13)
    let run = startPitcherMission(mission)
    run = applyPitcherOutcome(run, STRIKEOUT)

    expect(goalsOf(mission, run.progress)).toEqual([{ name: '노히트노런', required: 15, achieved: 1 }])
  })

  it('볼넷은 아웃이 아니라 노히트노런 막대를 올리지 않는다', () => {
    const mission = findMission('투수', 13)
    const run = applyPitcherOutcome(startPitcherMission(mission), { kind: '볼넷' })

    expect(goalsOf(mission, run.progress)[0].achieved).toBe(0)
  })
})

describe('시작 상황 — 레코드 3·4·5번 바이트', () => {
  it('타자 1번은 3루 주자가 있어 단타 하나로 1타점이다', () => {
    const run = applyOutcome(startMission(findMission('타자', 1)), SINGLE)

    expect(run.progress.counts['타점']).toBe(1)
  })

  it('타자 12번은 만루라 홈런 한 방이 4타점·만루홈런이다', () => {
    const run = applyOutcome(startMission(findMission('타자', 12)), HOME_RUN)

    expect(run.progress.counts['타점']).toBe(4)
    expect(run.status).toBe('성공')
  })

  it('주자가 없으면 홈런은 만루홈런이 아니다', () => {
    const run = applyOutcome(startMission(findMission('타자', 6)), HOME_RUN)

    expect(run.progress.counts['만루홈런'] ?? 0).toBe(0)
  })

  it('도루는 1루 주자가 있어야 한다 — 타자 5번은 1루, 타자 1번은 3루뿐', () => {
    expect(canSteal(startMission(findMission('타자', 5)))).toBe(true)
    expect(canSteal(startMission(findMission('타자', 1)))).toBe(false)
    expect(canSteal(applySteal(startMission(findMission('타자', 5))))).toBe(false)
  })
})

describe('판정 규칙', () => {
  it('스윙 제한을 다 쓰면 타석 도중이라도 실패다', () => {
    let run = startMission(findMission('타자', 10))
    for (let swing = 0; swing < 3; swing += 1) run = recordSwing(run)

    expect(checkSwingsExhausted(run).status).toBe('실패')
  })

  it('스윙이 남아 있으면 실패가 아니다', () => {
    const run = recordSwing(startMission(findMission('타자', 10)))

    expect(checkSwingsExhausted(run).status).toBe('진행중')
  })

  it('"3번의 타석을 모두 홈런" 은 홈런 3개가 필요하다', () => {
    const run = applyOutcome(startMission(findMission('타자', 13)), HOME_RUN)

    expect(run.status).toBe('진행중')
  })

  it('"MAX투구게이지 6구" 는 PERFECT 6번이 필요하다', () => {
    let run = startPitcherMission(findMission('투수', 2))
    run = recordPitch(run, true)
    run = applyPitcherOutcome(run, { kind: '아웃', detail: '땅볼아웃' })
    run = applyPitcherOutcome(run, { kind: '아웃', detail: '땅볼아웃' })

    expect(run.status).toBe('진행중')
  })

  it('무안타 미션은 안타를 맞으면 실패다', () => {
    const run = applyPitcherOutcome(startPitcherMission(findMission('투수', 10)), SINGLE)

    expect(run.status).toBe('실패')
  })

  /**
   * ⚠️ 예전에는 "단타는 버틴다" 였다 — `baseState` 의 **고정 진루표 근사**(1루타면 3루 주자만
   * 득점)로 2루 주자가 3루까지만 갔기 때문이다. 이제 미션도 수비 시뮬레이션을 돌리므로
   * 자동 진루 0xaf918 이 2루 주자를 홈까지 불러들인다 (P2 7절 "1루타에 2루 주자 득점").
   * 실점 한도 1 짜리 미션이라 그 자리에서 실패다. 씨앗이 아니라 **상태로 못 박았다**.
   */
  it('투수 5번은 2루 주자가 있어 단타에도 1점을 내준다 — 실점 한도 1 에 닿아 실패다', () => {
    const afterSingle = applyPitcherOutcome(startPitcherMission(findMission('투수', 5)), SINGLE)
    expect(afterSingle.allowed.runs).toBe(1)
    expect(afterSingle.status).toBe('실패')

    expect(applyPitcherOutcome(startPitcherMission(findMission('투수', 5)), DOUBLE).status).toBe('실패')
  })

  it('투수 14번(퍼펙트)은 볼넷 하나로 실패다 — 볼넷 한도 1', () => {
    expect(applyPitcherOutcome(startPitcherMission(findMission('투수', 14)), { kind: '볼넷' }).status).toBe('실패')
  })

  it('투수 1번은 실점 한도 2 — 1실점까지는 버틴다', () => {
    let run = startPitcherMission(findMission('투수', 1))
    run = applyPitcherOutcome(run, HOME_RUN)
    expect(run.status).toBe('진행중')

    expect(applyPitcherOutcome(run, HOME_RUN).status).toBe('실패')
  })

  it('클리어 기록 키는 타자편·투수편을 구분한다', () => {
    expect(missionKeyOf(findMission('타자', 12))).not.toBe(missionKeyOf(findMission('투수', 12)))
  })
})
